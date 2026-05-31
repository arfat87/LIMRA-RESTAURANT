import { createAdminClient } from '@insforge/sdk';
import { config } from '../config.js';
import { TEMPLATES } from '../templates/messages.js';
import { sendWhatsAppMessage } from '../providers/whatsappMock.js';

const insforge = createAdminClient({ baseUrl: config.insforgeUrl, apiKey: config.insforgeAdminKey });

// Local cache to store order statuses: orderId -> status
const orderStatuses = {};
let isFirstRun = true;

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
  * Core polling daemon.
  * Queries database once every 4 seconds to inspect any status updates or newly placed orders.
  */
async function pollDatabaseChanges() {
  if (isFirstRun) return;
  console.log(`🔍 [DB Poller] Scanning orders table...`);
  
  try {
    const { data: recentOrders, error } = await insforge.database
      .from('orders')
      .select('id, order_number, customer_name, customer_phone, total_amount, status, created_at')
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
        // Cache the status to avoid duplicate processing
        orderStatuses[orderId] = currentStatus;
        
        console.log(`📥 [DB Poller] New Order Placed: #${order.order_number}`);
        const text = TEMPLATES.orderPlaced(order.customer_name, order.order_number, order.total_amount);
        await sendWhatsAppMessage(phone, text);
        continue;
      }
      
      // 2. Detect Order Status Updates (Update)
      const oldStatus = orderStatuses[orderId];
      if (oldStatus !== currentStatus) {
        // Update local status cache
        orderStatuses[orderId] = currentStatus;
        
        console.log(`🔄 [DB Poller] Order #${order.order_number} status change: ${oldStatus} -> ${currentStatus}`);
        let messageText = '';
        const name = order.customer_name;
        const num = order.order_number;
        
        switch (currentStatus) {
          case 'confirmed':
            messageText = TEMPLATES.orderConfirmed(name, num);
            break;
          case 'completed':
            messageText = TEMPLATES.orderCompleted(name, num);
            break;
          case 'delivered':
            messageText = TEMPLATES.orderDelivered(name, num);
            break;
        }
        
        if (messageText) {
          await sendWhatsAppMessage(phone, messageText);
          
          // Queue a Review follow-up message 1 hour later if status is 'delivered'
          if (currentStatus === 'delivered') {
            console.log(`⏳ [DB Poller] Queueing Review request follow-up for order #${num} in 1 hour...`);
            setTimeout(async () => {
              const reviewText = TEMPLATES.reviewRequest(name);
              await sendWhatsAppMessage(phone, reviewText);
            }, 3600 * 1000); // 1 hour
          }
        }
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
  
  // Step 1: Populate cache with existing orders to prevent back-processing old orders
  initializeCache();
  
  // Step 2: Set interval poller running every 4 seconds
  setInterval(pollDatabaseChanges, 4000);
}
