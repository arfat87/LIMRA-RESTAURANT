import { createAdminClient } from '@insforge/sdk';
import { db } from './dbService.js';
import { config } from '../config.js';
import { sendWhatsAppMessage } from '../providers/whatsappMock.js';

const insforge = createAdminClient({ baseUrl: config.insforgeUrl, apiKey: config.insforgeAdminKey });

// Local cache to store order statuses: orderId -> status
const orderStatuses = {};
let isFirstRun = true;

/**
 * Extracts structured metadata and addresses from order notes.
 */
function parseNotesMetadata(notes) {
  const result = {
    email: '',
    type: 'pickup',
    address: 'Self Pickup at Restaurant',
    distance: '',
    charge: '',
    payment: '',
    paymentStatus: '',
    customNote: ''
  };
  
  if (!notes) return result;
  
  const emailMatch = notes.match(/\[EMAIL:\s*([^\]|]+)\]/i);
  if (emailMatch) {
    result.email = emailMatch[1].trim();
  }
  
  if (notes.includes('[DELIVERY]')) {
    result.type = 'delivery';
  } else if (notes.includes('[SELF PICKUP]')) {
    result.type = 'pickup';
  }
  
  if (result.type === 'delivery') {
    const addrMatch = notes.match(/Address:\s*([^|\]]+)/i);
    const distMatch = notes.match(/Distance:\s*([^|\]]+)/i);
    const chargeMatch = notes.match(/Delivery charge:\s*([^|\]]+)/i);
    
    if (addrMatch) result.address = addrMatch[1].trim();
    if (distMatch) result.distance = distMatch[1].trim();
    if (chargeMatch) result.charge = chargeMatch[1].trim();
  }
  
  const paymentMatch = notes.match(/\[PAYMENT:\s*([^\]|]+)\]/i);
  if (paymentMatch) {
    result.payment = paymentMatch[1].trim();
  }
  const statusMatch = notes.match(/\[PAYMENT_STATUS:\s*([^\]|]+)\]/i);
  if (statusMatch) {
    result.paymentStatus = statusMatch[1].trim();
  }
  
  return result;
}

/**
 * Queries recent orders from the database to initialize the local status cache.
 */
async function initializeCache() {
  try {
    const { data: recentOrders, error } = await insforge.database
      .from('orders')
      .select('id, status')
      .order('created_at', { ascending: false })
      .limit(100);
      
    if (error) throw error;
    
    if (recentOrders) {
      for (const order of recentOrders) {
        orderStatuses[order.id] = order.status;
      }
    }
    
    console.log(`✅ [DB Poller] Cache initialized successfully with ${Object.keys(orderStatuses).length} orders.`);
    isFirstRun = false;
  } catch (err) {
    console.error('⚠️ [DB Poller] Failed to initialize order cache. Retrying in 5 seconds...', err.message || err);
    setTimeout(initializeCache, 5000);
  }
}

/**
 * Fetches order items and triggers automated template rendering & WhatsApp dispatch.
 */
async function triggerOrderAutomation(order, status) {
  const settings = db.settings.get();
  
  // Exit if global notifications are disabled
  if (settings.enableOrderNotifications === false) {
    console.log(`🔕 [Order Automation] Notifications disabled globally in Settings.`);
    return;
  }
  
  const phone = order.customer_phone;
  const name = order.customer_name;
  const orderId = order.order_number;
  const total = `₹${order.total_amount}`;
  const notesMeta = parseNotesMetadata(order.notes);
  const address = notesMeta.address;
  
  console.log(`⚡ [Order Automation] Dispatching status "${status}" workflow for Order #${orderId}...`);
  
  // 1. Fetch Ordered items from PostgreSQL DB
  let itemsText = '• 1x Special Combo Dish';
  try {
    const { data: items, error } = await insforge.database
      .from('order_items')
      .select('item_name, quantity, line_total')
      .eq('order_id', order.id);
      
    if (!error && items && items.length) {
      itemsText = items.map(item => `• ${item.quantity}x ${item.item_name} (₹${item.line_total})`).join('\n');
    }
  } catch (err) {
    console.warn(`⚠️ [Order Automation] Failed to query order_items:`, err.message || err);
  }
  
  // 2. Fetch template text or fallback
  const templates = settings.orderTemplates || {};
  let templateText = '';
  
  switch (status) {
    case 'confirmed':
      templateText = templates.confirmed;
      break;
    case 'preparing':
      templateText = templates.preparing;
      break;
    case 'ready':
      templateText = templates.ready;
      break;
    case 'out_for_delivery':
      templateText = templates.out_for_delivery;
      break;
    case 'delivered':
      templateText = templates.delivered;
      break;
    case 'cancelled':
      templateText = templates.cancelled;
      break;
  }
  
  if (!templateText) {
    console.warn(`⚠️ [Order Automation] No template defined for status: ${status}`);
    return;
  }
  
  // 3. Replace template variables
  const renderedText = templateText
    .replace(/{{name}}/g, name)
    .replace(/{{orderId}}/g, orderId)
    .replace(/{{items}}/g, itemsText)
    .replace(/{{total}}/g, total)
    .replace(/{{address}}/g, address)
    .replace(/{{partner}}/g, 'SK Arif (Owner)')
    .replace(/{{partnerPhone}}/g, '+91 97390 83418');
    
  // 4. Save notification directly into Customer WhatsApp Timeline History!
  db.messages.add(phone, 'ai', renderedText);
  
  // 5. Send mock/live WhatsApp message
  await sendWhatsAppMessage(phone, renderedText);
  const displayPhone = phone.startsWith('+') ? phone : `+${phone}`;
  console.log(`📬 [Order Automation] Instant WhatsApp notification delivered successfully to ${displayPhone}.`);
  
  // 6. Deliberate secondary trigger: delivered triggers automatic review request after 8 seconds!
  if (status === 'delivered') {
    console.log(`⏳ [Order Automation] Scheduling automatic Google Review request for Order #${orderId} in 8 seconds...`);
    setTimeout(async () => {
      const revTemplate = templates.review_request || `Hi {{name}}, we hope you loved your meal! Can you please rate your experience? ⭐⭐⭐⭐⭐`;
      const renderedReview = revTemplate
        .replace(/{{name}}/g, name)
        .replace(/{{orderId}}/g, orderId);
        
      db.messages.add(phone, 'ai', renderedReview);
      await sendWhatsAppMessage(phone, renderedReview);
      console.log(`📬 [Order Automation] Automated feedback review query delivered successfully to ${displayPhone}.`);
    }, 8000);
  }
}

/**
 * Core polling daemon.
 * Queries database once every 4 seconds to inspect any status updates or newly placed orders.
 */
async function pollDatabaseChanges() {
  if (isFirstRun) return;
  console.log(`🔍 [DB Poller] Scanning orders table...`);
  
  try {
    const { data: recentOrders, error } = await insforge.database
      .from('orders')
      .select('id, order_number, customer_name, customer_phone, total_amount, status, notes, created_at')
      .order('created_at', { ascending: false })
      .limit(40);
      
    if (error) throw error;
    if (!recentOrders) {
      console.log('🔍 [DB Poller] No order records returned.');
      return;
    }
    
    console.log(`🔍 [DB Poller] Fetched ${recentOrders.length} order records.`);
    
    for (const order of recentOrders) {
      const orderId = order.id;
      const currentStatus = order.status;
      const phone = order.customer_phone || '';
      
      // 1. Detect New Order Placement (Insert)
      const hasOrderSeen = orderStatuses.hasOwnProperty(orderId);
      if (!hasOrderSeen) {
        orderStatuses[orderId] = currentStatus;
        console.log(`📥 [DB Poller] New Order Placed: #${order.order_number}`);
        
        // Auto-register conversation in agent console
        db.conversations.upsert(phone, {
          customer_name: order.customer_name,
          mode: 'ai',
          status: 'active',
          last_message: `Order #${order.order_number} placed`,
          unread_count: 0
        });
        
        // Custom onboarding message
        const welcomeText = `👋 Hello ${order.customer_name}! Thank you for placing your Order #${order.order_number} at LIMRA Restaurant!\nTotal amount is ${order.total_amount}.\n\nOur system will keep you updated on the delivery status automatically in real time!`;
        db.messages.add(phone, 'ai', welcomeText);
        await sendWhatsAppMessage(phone, welcomeText);
        
        continue;
      }
      
      // 2. Detect Order Status Updates (Update)
      const oldStatus = orderStatuses[orderId];
      if (oldStatus !== currentStatus) {
        orderStatuses[orderId] = currentStatus;
        console.log(`🔄 [DB Poller] Order #${order.order_number} status change: ${oldStatus} -> ${currentStatus}`);
        
        // Trigger automated status templates messaging workflows!
        await triggerOrderAutomation(order, currentStatus);
      }
    }
  } catch (err) {
    console.error('❌ [DB Poller] Daemon execution error:', err.message || err);
  }
}

/**
 * Initializes the database polling daemon.
 */
export function initRealtimeListener() {
  console.log('📡 Booting Database Status Polling Daemon (Interval: 4 seconds)...');
  initializeCache();
  setInterval(pollDatabaseChanges, 4000);
}
