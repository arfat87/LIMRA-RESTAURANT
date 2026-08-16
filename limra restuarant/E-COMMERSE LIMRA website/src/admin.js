import './style.css';
import './admin.css';
import { Chart, registerables } from 'chart.js';
import { insforge, getMenuOverrides, saveMenuOverride, getCoupons, saveCoupon, deleteCoupon, getCombos, saveCombo, deleteCombo } from './lib/insforge.js';
import { PaymentService } from './lib/payments.js';
import { menuItems, categoryImages, categoryLabels, categoryEmojis } from './data/menu.js';
import { getAdminLoginUrl } from './lib/admin-routes.js';
import { sendEmailNotification, generateOrderConfirmedHtml, generateOrderCancelledHtml } from './lib/email-service.js';
import QRCode from 'qrcode';


Chart.register(...registerables);

// ═══════════════════════════════════════
// AUDIO CONTEXT & NOTIFICATION CHIME
// ═══════════════════════════════════════

// Persistent AudioContext — initialized lazily after first user gesture
let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (Ctor) _audioCtx = new Ctor();
  }
  if (_audioCtx && _audioCtx.state === 'suspended') {
    _audioCtx.resume().catch(() => {});
  }
  return _audioCtx;
}

// Warm up AudioContext on first user gesture so chime can play
function warmUpAudio() {
  try { getAudioCtx(); } catch(e) {}
}

function playNotificationChime() {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;

    const playTone = (freq, startTime, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    playTone(783.99, now, 0.35);         // G5
    playTone(1046.50, now + 0.1, 0.5);  // C6
    playTone(1318.51, now + 0.22, 0.6); // E6
  } catch(e) {}
}

// ═══════════════════════════════════════
// GLOBAL STATE & CONSTANTS
// ═══════════════════════════════════════

const ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled', 'hold'];
const BOOKING_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STATUS_LABEL = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  hold: 'Hold'
};

let orders = [];
let orderItems = [];
let bookings = [];
let adminPlaces = [];
let dashboardMap = null;
let dashboardMarkersGroup = null;
let activeMapFilter = 'all';
let currentUser = null;
let selectedOrderId = null;
let ordersPage = 1;
let activeOrderTypeFilter = 'all';
const ORDERS_PER_PAGE = 10;
const charts = {};

const knownNotificationIds = new Set();
let activeNotifications = [];

// ═══════════════════════════════════════
// REAL-TIME NOTIFICATION STATE & CHIME
// ═══════════════════════════════════════

function renderNotifications() {
  const dot = $('notification-dot');
  const list = $('notification-items');
  if (!list) return;
  
  if (activeNotifications.length === 0) {
    if (dot) hide(dot);
    list.innerHTML = '<p class="adm-dropdown-empty">No new notifications</p>';
    return;
  }
  
  if (dot) show(dot);
  
  list.innerHTML = activeNotifications.map(n => {
    const icon = (n.type === 'order' || n.type === 'order_status') ? '🍽️' : '📅';
    const timeStr = new Date(n.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const isUnreadCls = n.is_read ? '' : 'unread';
    return `
      <div class="adm-notification-item ${isUnreadCls}" data-item-id="${n.item_id}" data-type="${n.type}" data-notif-id="${n.id}">
        <div class="adm-notification-icon">${icon}</div>
        <div class="adm-notification-body">
          <p class="adm-notification-title">${escapeHtml(n.title)}</p>
          <p class="adm-notification-desc">${escapeHtml(n.description)}</p>
          <p class="adm-notification-time">${timeStr}</p>
        </div>
        <button class="adm-notif-dismiss" data-dismiss-id="${n.id}" title="Mark as read">✕</button>
      </div>
    `;
  }).join('');
  
  list.querySelectorAll('.adm-notif-dismiss').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.dismissId);
      try {
        await insforge.database.from('notifications').update({ is_read: true }).eq('id', id);
        const match = activeNotifications.find(x => x.id === id);
        if (match) match.is_read = true;
        renderNotifications();
        refreshDashboard(false);
      } catch (err) {
        console.warn('Failed to dismiss notification:', err);
      }
    });
  });

  list.querySelectorAll('.adm-notification-item').forEach(el => {
    el.addEventListener('click', async (e) => {
      if (e.target.classList.contains('adm-notif-dismiss')) return;
      const type = el.dataset.type;
      const itemId = el.dataset.itemId;
      const notifId = Number(el.dataset.notifId);
      
      try {
        await insforge.database.from('notifications').update({ is_read: true }).eq('id', notifId);
        const match = activeNotifications.find(x => x.id === notifId);
        if (match) match.is_read = true;
      } catch (err) {
        console.warn('Failed to mark notification read:', err);
      }
      
      hide($('notification-dropdown'));
      
      if (type === 'order' || type === 'order_status') {
        selectedOrderId = itemId;
        switchPanel('orders');
        renderOrderDetail(itemId);
      } else {
        switchPanel('bookings');
        $('bookings-list')?.scrollIntoView({ behavior: 'smooth' });
      }
      
      refreshDashboard(false);
    });
  });

  list.querySelectorAll('.adm-notification-item').forEach(el => {
    el.addEventListener('click', async (e) => {
      if (e.target.classList.contains('adm-notif-dismiss')) return;
      const type = el.dataset.type;
      const itemId = el.dataset.itemId;
      const notifId = Number(el.dataset.notifId);
      
      try {
        await insforge.database.from('notifications').update({ is_read: true }).eq('id', notifId);
        const match = activeNotifications.find(x => x.id === notifId);
        if (match) match.is_read = true;
      } catch (err) {
        console.warn('Failed to mark notification read:', err);
      }
      
      hide($('notification-dropdown'));
      
      if (type === 'order' || type === 'order_status') {
        selectedOrderId = itemId;
        switchPanel('orders');
        renderOrderDetail(itemId);
      } else {
        switchPanel('bookings');
        $('bookings-list')?.scrollIntoView({ behavior: 'smooth' });
      }
      
      refreshDashboard(false);
    });
  });
}

function initToastContainer() {
  let container = document.getElementById('dashboard-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'dashboard-toast-container';
    container.className = 'fixed top-6 right-6 z-[200] flex flex-col gap-3 w-80 max-w-full pointer-events-none';
    document.body.appendChild(container);
  }
}

function showAdminToast(message, type = 'success') {
  initToastContainer();
  const container = document.getElementById('dashboard-toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'p-4 rounded-2xl border shadow-xl flex items-center justify-between gap-3 transition-all duration-500 translate-x-80 opacity-0 pointer-events-auto cursor-pointer backdrop-blur-md';
  
  toast.style.background = 'rgba(255, 255, 255, 0.95)';
  toast.style.borderColor = type === 'success' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)';
  toast.style.color = 'var(--adm-text)';
  toast.style.fontSize = '0.85rem';
  toast.style.fontWeight = '600';
  
  const icon = type === 'success' ? '✅' : '❌';
  toast.innerHTML = `
    <div style="display:flex; align-items:center; gap:0.5rem;">
      <span style="font-size:1.2rem;">${icon}</span>
      <span>${escapeHtml(message)}</span>
    </div>
    <button style="background:none; border:none; color:#999; cursor:pointer; font-weight:bold; font-size:1rem;">✕</button>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.remove('translate-x-80', 'opacity-0');
  }, 50);
  
  const close = () => {
    toast.classList.add('translate-x-80', 'opacity-0');
    setTimeout(() => toast.remove(), 500);
  };
  
  toast.addEventListener('click', close);
  toast.querySelector('button').addEventListener('click', (e) => {
    e.stopPropagation();
    close();
  });
  
  setTimeout(close, 4000);
}

function showDashboardToast(title, msg, type = 'info', orderId = null) {
  initToastContainer();
  const container = document.getElementById('dashboard-toast-container');
  
  const toast = document.createElement('div');
  toast.className = 'p-4 rounded-2xl border shadow-xl flex gap-3 transition-all duration-500 translate-x-80 opacity-0 pointer-events-auto cursor-pointer hover:scale-[1.02] backdrop-blur-md';
  
  // Custom glassmorphic styling
  toast.style.background = 'rgba(255, 255, 255, 0.9)';
  toast.style.borderColor = type === 'success' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(217, 119, 6, 0.4)';
  
  const icon = type === 'success' ? '🍽️' : '📅';
  
  toast.innerHTML = `
    <div class="text-2xl shrink-0">${icon}</div>
    <div class="flex-1">
      <h4 class="font-bold text-sm text-slate-800">${title}</h4>
      <p class="text-xs text-slate-600 mt-1">${msg}</p>
    </div>
    <button class="text-slate-400 hover:text-slate-600 text-xs shrink-0 self-start">✕</button>
  `;
  
  container.appendChild(toast);
  
  // Slide in
  setTimeout(() => {
    toast.classList.remove('translate-x-80', 'opacity-0');
  }, 50);
  
  // Click handler to open order details if orderId is provided!
  if (orderId) {
    toast.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      selectedOrderId = orderId;
      switchPanel('orders');
      renderOrderDetail(orderId);
      toast.remove();
    });
  }
  
  // Close button click handler
  toast.querySelector('button').addEventListener('click', (e) => {
    e.stopPropagation();
    toast.classList.add('translate-x-80', 'opacity-0');
    setTimeout(() => toast.remove(), 500);
  });
  
  // Auto remove after 8 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.add('translate-x-80', 'opacity-0');
      setTimeout(() => toast.remove(), 500);
    }
  }, 8000);
}

const $ = id => document.getElementById(id);
const show = el => { if (el) { el.classList.remove('adm-hidden', 'hidden'); } };
const hide = el => { if (el) { el.classList.add('adm-hidden'); } };

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseNotesMetadata(notes, order = null) {
  const result = {
    email: '',
    type: 'pickup',
    address: '',
    area: '',
    distance: '',
    charge: '',
    deliveryFee: 0,
    discountPct: 0,
    discountAmt: 0,
    cgstRate: null,
    sgstRate: null,
    payment: '',
    paymentStatus: '',
    customNote: '',
    tableNumber: ''
  };
  
  if (order) {
    if (order.order_type === 'table') {
      result.type = 'table';
      result.tableNumber = String(order.table_number || '');
    } else if (order.order_type === 'delivery') {
      result.type = 'delivery';
    } else if (order.order_type === 'pickup') {
      result.type = 'pickup';
    }
  }
  
  if (!notes) return result;
  
  const emailMatch = notes.match(/\[EMAIL:\s*([^\]|]+)\]/i);
  if (emailMatch) {
    result.email = emailMatch[1].trim();
  }
  
  const tableMatch = notes.match(/\[TABLE:\s*([^\]|]+)\]/i);
  if (tableMatch) {
    result.tableNumber = tableMatch[1].trim();
    result.type = 'table';
  } else if (notes.includes('[DELIVERY]')) {
    result.type = 'delivery';
  } else if (notes.includes('[SELF PICKUP]')) {
    result.type = 'pickup';
  }
  
  if (result.type === 'delivery') {
    const addrMatch = notes.match(/Address:\s*([^|\]]+)/i);
    const areaMatch = notes.match(/Selected Area:\s*([^|\]]+)/i);
    const distMatch = notes.match(/Distance:\s*([^|\]]+)/i);
    const chargeMatch = notes.match(/Delivery charge:\s*([^|\]]+)/i);
    
    if (addrMatch) result.address = addrMatch[1].trim();
    if (areaMatch) result.area = areaMatch[1].trim();
    if (distMatch) result.distance = distMatch[1].trim();
    if (chargeMatch) {
      result.charge = chargeMatch[1].trim();
      const parsedNum = parseFloat(result.charge.replace(/[^0-9.]/g, ''));
      if (!isNaN(parsedNum)) result.deliveryFee = parsedNum;
    }
  }

  const deliveryFeeMatch = notes.match(/\[DELIVERY_FEE:\s*([^\]|]+)\]/i);
  if (deliveryFeeMatch) {
    const dNum = parseFloat(deliveryFeeMatch[1].replace(/[^0-9.]/g, ''));
    if (!isNaN(dNum)) result.deliveryFee = dNum;
  }

  const discPctMatch = notes.match(/\[(?:DISCOUNT_PCT|DISCOUNT):\s*([^\]|%]+)%?\]/i);
  if (discPctMatch) {
    const pNum = parseFloat(discPctMatch[1]);
    if (!isNaN(pNum)) result.discountPct = pNum;
  }

  const discAmtMatch = notes.match(/\[DISCOUNT_AMT:\s*([^\]|]+)\]/i);
  if (discAmtMatch) {
    const aNum = parseFloat(discAmtMatch[1].replace(/[^0-9.]/g, ''));
    if (!isNaN(aNum)) result.discountAmt = aNum;
  }

  const cgstMatch = notes.match(/\[CGST:\s*([^\]|%]+)%?\]/i);
  if (cgstMatch) {
    const cNum = parseFloat(cgstMatch[1]);
    if (!isNaN(cNum)) result.cgstRate = cNum;
  }

  const sgstMatch = notes.match(/\[SGST:\s*([^\]|%]+)%?\]/i);
  if (sgstMatch) {
    const sNum = parseFloat(sgstMatch[1]);
    if (!isNaN(sNum)) result.sgstRate = sNum;
  }
  
  const paymentMatch = notes.match(/\[PAYMENT:\s*([^\]|]+)\]/i);
  if (paymentMatch) {
    result.payment = paymentMatch[1].trim();
  }
  const statusMatch = notes.match(/\[PAYMENT_STATUS:\s*([^\]|]+)\]/i);
  if (statusMatch) {
    result.paymentStatus = statusMatch[1].trim();
  }
  
  let cleanNote = notes
    .replace(/\[EMAIL:[^\]]+\]/gi, '')
    .replace(/\[TABLE:[^\]]+\]/gi, '')
    .replace(/\[DELIVERY\] Address:[^|]+/gi, '')
    .replace(/Selected Area:[^|]+/gi, '')
    .replace(/Distance:[^|]+/gi, '')
    .replace(/Delivery charge:[^|]+/gi, '')
    .replace(/\[DELIVERY_FEE:[^\]]+\]/gi, '')
    .replace(/\[(?:DISCOUNT_PCT|DISCOUNT):[^\]]+\]/gi, '')
    .replace(/\[DISCOUNT_AMT:[^\]]+\]/gi, '')
    .replace(/\[CGST:[^\]]+\]/gi, '')
    .replace(/\[SGST:[^\]]+\]/gi, '')
    .replace(/\[SELF PICKUP\]/gi, '')
    .replace(/\[PAYMENT:[^\]]+\]/gi, '')
    .replace(/\[PAYMENT_STATUS:[^\]]+\]/gi, '')
    .replace(/\|/g, '')
    .replace(/\s+/g, ' ')
    .trim();
    
  result.customNote = cleanNote;
  return result;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDateShort(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtMoney(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

function formatDailyOrderNumber(order, allOrders = orders) {
  if (!order && order !== 0) return '01';

  // If order is a primitive number or string
  if (typeof order === 'number' || typeof order === 'string') {
    const num = parseInt(order, 10);
    if (!isNaN(num)) {
      return num < 10 && num > 0 ? `0${num}` : `${num}`;
    }
    return String(order);
  }

  // If order object has created_at, find its daily sequence index within that specific day (1-based: 01, 02, 03...)
  if (order.created_at && Array.isArray(allOrders) && allOrders.length > 0) {
    const orderDate = new Date(order.created_at).toISOString().slice(0, 10);
    const dayOrders = allOrders
      .filter(o => o.created_at && new Date(o.created_at).toISOString().slice(0, 10) === orderDate)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    const idx = dayOrders.findIndex(o => o.id === order.id);
    if (idx !== -1) {
      const dailySeq = idx + 1;
      return dailySeq < 10 ? `0${dailySeq}` : `${dailySeq}`;
    }
  }

  // Fallback to order.order_number formatted
  const rawNum = parseInt(order.order_number, 10);
  if (!isNaN(rawNum) && rawNum > 0) {
    return rawNum < 10 ? `0${rawNum}` : `${rawNum}`;
  }

  return '01';
}

function getTodayDailyOrderNumber(allOrders = orders) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayOrders = (allOrders || []).filter(o => {
    if (!o.created_at) return false;
    const d = new Date(o.created_at).toISOString().slice(0, 10);
    return d === todayStr;
  });
  return todayOrders.length + 1;
}

function statusPill(status, isTable = false) {
  const cls = status === 'pending' ? 'new' : status;
  let label = STATUS_LABEL[status] || status;
  if (isTable) {
    if (status === 'ready') label = 'Served';
    else if (status === 'delivered') label = 'Completed';
    else if (status === 'preparing') label = 'Preparing';
    else if (status === 'pending') label = 'Pending';
  }
  return `<span class="adm-pill ${cls}">${label}</span>`;
}

function paymentStatusPill(status) {
  const s = String(status || 'unpaid').toLowerCase();
  if (s === 'paid' || s === 'completed') {
    return `<span class="adm-pill completed" style="text-transform: uppercase;">PAID</span>`;
  }
  return `<span class="adm-pill cancelled" style="text-transform: uppercase;">UNPAID</span>`;
}

function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function getHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function destroyChart(key) {
  if (charts[key]) {
    charts[key].destroy();
    delete charts[key];
  }
}

function getItemsForOrder(orderId) {
  return orderItems.filter(i => i.order_id === orderId);
}

function getGlobalSearch() {
  return ($('global-search')?.value || '').toLowerCase().trim();
}

// ── Auth gate (dashboard only) ──────────────────────────

function redirectToLogin() {
  window.location.replace(getAdminLoginUrl(window.location.pathname + window.location.search));
}

async function checkAdminAccess() {
  const { data, error } = await insforge.database
    .from('admin_users')
    .select('user_id')
    .eq('user_id', currentUser.id)
    .maybeSingle();
  return !error && !!data;
}

async function loadData() {
  const [ordersRes, itemsRes, bookingsRes, notifsRes, placesRes] = await Promise.all([
    insforge.database.from('orders').select('*').order('created_at', { ascending: false }),
    insforge.database.from('order_items').select('*'),
    insforge.database.from('bookings').select('*').order('created_at', { ascending: false }),
    insforge.database.from('notifications').select('*').order('created_at', { ascending: false }).limit(50),
    insforge.database.from('delivery_areas').select('*').order('name', { ascending: true }),
  ]);
  
  if (ordersRes.error) throw ordersRes.error;
  if (itemsRes.error) throw itemsRes.error;
  if (bookingsRes.error) throw bookingsRes.error;
  if (notifsRes.error) throw notifsRes.error;

  const newOrders = ordersRes.data || [];
  const newBookings = bookingsRes.data || [];
  const fetchedNotifs = notifsRes.data || [];

  const isFirstLoad = knownNotificationIds.size === 0;
  let newUnreadDetected = false;

  // Process notifications in chronological order (oldest first) so they arrive correctly
  const reversedNotifs = [...fetchedNotifs].reverse();
  reversedNotifs.forEach(n => {
    if (!knownNotificationIds.has(n.id)) {
      knownNotificationIds.add(n.id);
      
      // If it's a new unread notification (and not the very first load of the dashboard)
      if (!isFirstLoad && !n.is_read) {
        newUnreadDetected = true;
        
        // Show dynamic toast depending on the type
        if (n.type === 'order') {
          showDashboardToast(
            `🍽️ New Order Received!`,
            n.description,
            'success',
            n.item_id
          );
          
          // Automatically print delivery orders
          try {
            const order = newOrders.find(o => o.id === n.item_id);
            if (order) {
              const meta = parseNotesMetadata(order.notes, order);
              if (meta.type === 'delivery') {
                console.log(`[QZ] Auto-printing delivery order #${order.order_number}`);
                printOrderReceipt(order);
              }
            }
          } catch (printErr) {
            console.error('[QZ] Auto-print failed:', printErr);
          }
        } else if (n.type === 'booking') {
          showDashboardToast(
            `📅 New Booking Enquiry!`,
            n.description,
            'info'
          );
        } else if (n.type === 'order_status') {
          showDashboardToast(
            `🍽️ Order Status Updated!`,
            n.description,
            'success',
            n.item_id
          );
        }
      }
    }
  });

  if (newUnreadDetected) {
    playNotificationChime();
  }

  activeNotifications = fetchedNotifs;
  renderNotifications();

  orders = newOrders;
  orderItems = itemsRes.data || [];
  bookings = newBookings;
  adminPlaces = (placesRes && placesRes.data) || [];
  $('last-updated').textContent = `Updated ${new Date().toLocaleTimeString('en-IN')}`;

  await autoAcceptTableOrders();
}

async function autoAcceptTableOrders() {
  if (!Array.isArray(orders)) return;
  const tableOrdersToComplete = orders.filter(order => {
    if (order.status === 'delivered' || order.status === 'cancelled') return false;
    const meta = parseNotesMetadata(order.notes, order);
    return meta.type === 'table';
  });

  for (const order of tableOrdersToComplete) {
    console.log(`[Auto-Accept] Dine-in Table order #${order.order_number} auto-completing...`);
    try {
      await insforge.database.from('orders').update({ status: 'delivered' }).eq('id', order.id);
      order.status = 'delivered';
      
      const cleanPhone = order.customer_phone.replace(/\D/g, '');
      if (cleanPhone) {
        insforge.realtime.publish(`customer-notifications:${cleanPhone}`, 'notification_created', {
          id: Date.now(),
          type: 'order_status',
          title: 'Order Served/Completed',
          message: `Your table order #${order.order_number} has been completed!`,
          created_at: new Date().toISOString()
        }).catch(console.warn);
      }
      
      insforge.realtime.publish(`order-updates:${order.id}`, 'order_status_updated', {
        orderId: order.id,
        status: 'delivered'
      }).catch(console.warn);
    } catch (err) {
      console.warn(`[Auto-Accept] Failed to auto-complete table order #${order.id}:`, err);
    }
  }
}

function buildCustomerStats() {
  const map = new Map();

  function ensure(phone, name) {
    if (!map.has(phone)) {
      map.set(phone, {
        name: name || 'Customer',
        phone,
        orderCount: 0,
        bookingCount: 0,
        tableBookings: 0,
        partyBookings: 0,
        weddingBookings: 0,
        totalSpent: 0,
        lastOrder: null,
        lastBooking: null,
        lastActivity: null,
        firstVisit: null,
        items: {},
        recentBookings: [],
        ordersHistory: [],
        tier: 'new'
      });
    }
    const c = map.get(phone);
    if (name && (!c.name || c.name === 'Customer' || c.name === 'Walk-in Customer')) c.name = name;
    return c;
  }

  function touchActivity(c, date) {
    if (!date) return;
    if (!c.lastActivity || new Date(date) > new Date(c.lastActivity)) {
      c.lastActivity = date;
    }
    if (!c.firstVisit || new Date(date) < new Date(c.firstVisit)) {
      c.firstVisit = date;
    }
  }

  orders.forEach(order => {
    if (!order.customer_phone) return;
    const c = ensure(order.customer_phone, order.customer_name);
    c.orderCount += 1;
    c.totalSpent += Number(order.total_amount || 0);
    c.ordersHistory.push(order);
    const meta = parseNotesMetadata(order.notes, order);
    if (meta.email) c.email = meta.email;
    if (!c.lastOrder || new Date(order.created_at) > new Date(c.lastOrder)) {
      c.lastOrder = order.created_at;
      if (order.customer_name && order.customer_name !== 'Customer') c.name = order.customer_name;
    }
    touchActivity(c, order.created_at);
    getItemsForOrder(order.id).forEach(item => {
      if (isFoodItem(item.item_name)) {
        c.items[item.item_name] = (c.items[item.item_name] || 0) + Number(item.quantity || 1);
      }
    });
  });

  bookings.forEach(booking => {
    if (!booking.customer_phone) return;
    const c = ensure(booking.customer_phone, booking.customer_name);
    c.bookingCount += 1;
    const meta = parseNotesMetadata(booking.notes);
    if (meta.email) c.email = meta.email;
    if (booking.type === 'table') c.tableBookings += 1;
    if (booking.type === 'party') c.partyBookings += 1;
    if (booking.type === 'wedding') c.weddingBookings += 1;
    if (!c.lastBooking || new Date(booking.created_at) > new Date(c.lastBooking)) {
      c.lastBooking = booking.created_at;
      if (booking.customer_name && booking.customer_name !== 'Customer') c.name = booking.customer_name;
    }
    touchActivity(c, booking.created_at);
    c.recentBookings.push(booking);
  });

  return [...map.values()]
    .map(c => {
      c.recentBookings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      c.ordersHistory.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const totalVisits = c.orderCount + c.bookingCount;
      c.totalVisits = totalVisits;
      if (totalVisits >= 3 || c.totalSpent >= 2000) {
        c.tier = 'vip';
      } else if (totalVisits === 2 || c.totalSpent >= 1000) {
        c.tier = 'frequent';
      } else {
        c.tier = 'new';
      }
      return c;
    })
    .sort((a, b) => {
      const aDate = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
      const bDate = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
      return bDate - aDate;
    });
}

function isFoodItem(itemName) {
  if (!itemName) return false;
  const lowerName = itemName.toLowerCase();
  return !(
    lowerName.includes('gst') ||
    lowerName.includes('tax') ||
    lowerName.includes('delivery') ||
    lowerName.includes('discount') ||
    lowerName.includes('off') ||
    lowerName.includes('coupon') ||
    lowerName.includes('charge') ||
    lowerName.includes('packaging')
  );
}

function getTopItems(limit = 8) {
  const counts = {};
  orderItems.forEach(item => {
    if (isFoodItem(item.item_name)) {
      counts[item.item_name] = (counts[item.item_name] || 0) + item.quantity;
    }
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function getOrdersByDayOfWeek() {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  orders.forEach(o => { counts[new Date(o.created_at).getDay()] += 1; });
  return counts;
}

function getRevenueByMonth() {
  const rev = new Array(12).fill(0);
  orders.filter(o => o.status !== 'cancelled').forEach(o => {
    rev[new Date(o.created_at).getMonth()] += Number(o.total_amount);
  });
  return rev;
}

function getBookingsByDayOfWeek() {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  bookings.forEach(b => {
    const d = b.booking_date || b.created_at;
    if (d) counts[new Date(d).getDay()] += 1;
  });
  return counts;
}

// ── Dashboard ───────────────────────────────────────────

function renderStats() {
  const pending = orders.filter(o => o.status === 'pending').length;
  const delivered = orders.filter(o => o.status === 'delivered').length;
  const revenue = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total_amount), 0);

  // New payment stats calculations
  const paidCount = orders.filter(o => o.payment_status === 'paid').length;
  const unpaidCount = orders.filter(o => o.payment_status === 'unpaid' || !o.payment_status).length;
  
  const todayDate = new Date();
  const todayStr = todayDate.toDateString();
  const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === todayStr);

  const todayGrossRev = todayOrders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const todayPaidRev = todayOrders.filter(o => o.payment_status === 'paid' && o.status !== 'cancelled').reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const todayPendingRev = todayOrders.filter(o => (o.payment_status === 'unpaid' || !o.payment_status) && o.status !== 'cancelled').reduce((s, o) => s + Number(o.total_amount || 0), 0);

  const todayDineIn = todayOrders.filter(o => {
    const meta = parseNotesMetadata(o.notes, o);
    return meta.type === 'table' || o.order_type === 'table';
  }).length;
  const todayOnline = todayOrders.length - todayDineIn;

  // Active Hold Orders (in kitchen / table)
  const heldOrders = orders.filter(o => o.status === 'hold');
  const heldTotal = heldOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0);

  // Digital vs Cash today
  let todayDigital = 0;
  let todayCash = 0;
  todayOrders.filter(o => o.payment_status === 'paid').forEach(o => {
    const meta = parseNotesMetadata(o.notes, o);
    const mode = (meta.paymentMode || o.payment_mode || meta.payment || '').toLowerCase();
    if (mode.includes('upi') || mode.includes('card') || mode.includes('online')) {
      todayDigital += Number(o.total_amount || 0);
    } else {
      todayCash += Number(o.total_amount || 0);
    }
  });

  // Hero Cards Rendering
  if ($('dash-hero-today-sales')) $('dash-hero-today-sales').textContent = fmtMoney(todayGrossRev);
  if ($('dash-hero-today-sales-sub')) $('dash-hero-today-sales-sub').textContent = `₹${todayPaidRev.toFixed(2)} Paid · ₹${todayPendingRev.toFixed(2)} Pending`;
  
  if ($('dash-hero-today-orders')) $('dash-hero-today-orders').textContent = `${todayOrders.length} Orders`;
  if ($('dash-hero-today-orders-sub')) $('dash-hero-today-orders-sub').textContent = `${todayDineIn} Dine-in · ${todayOnline} Online/Takeaway`;

  if ($('dash-hero-hold-orders')) $('dash-hero-hold-orders').textContent = `${heldOrders.length} KOTs`;
  if ($('dash-hero-hold-orders-sub')) $('dash-hero-hold-orders-sub').textContent = `₹${heldTotal.toFixed(2)} pending settlement`;

  if ($('dash-hero-digital-cash')) $('dash-hero-digital-cash').textContent = `₹${todayDigital.toFixed(2)} UPI/Card`;
  if ($('dash-hero-digital-cash-sub')) $('dash-hero-digital-cash-sub').textContent = `₹${todayCash.toFixed(2)} Cash received`;

  // Standard 8 stats
  const pendingPayments = orders
    .filter(o => o.payment_status === 'unpaid' || !o.payment_status)
    .reduce((s, o) => s + Number(o.total_amount), 0);

  const collectedRev = orders
    .filter(o => o.payment_status === 'paid' && o.status !== 'cancelled')
    .reduce((s, o) => s + Number(o.total_amount), 0);

  const outstandingRev = orders
    .filter(o => (o.payment_status === 'unpaid' || !o.payment_status) && o.status !== 'cancelled')
    .reduce((s, o) => s + Number(o.total_amount), 0);

  if ($('stat-total-orders')) $('stat-total-orders').textContent = orders.length;
  if ($('stat-revenue')) $('stat-revenue').textContent = fmtMoney(revenue);
  if ($('stat-paid-orders')) $('stat-paid-orders').textContent = paidCount;
  if ($('stat-unpaid-orders')) $('stat-unpaid-orders').textContent = unpaidCount;
  if ($('stat-today-payments')) $('stat-today-payments').textContent = fmtMoney(todayPaidRev);
  if ($('stat-pending-payments')) $('stat-pending-payments').textContent = fmtMoney(pendingPayments);
  if ($('stat-collected-revenue')) $('stat-collected-revenue').textContent = fmtMoney(collectedRev);
  if ($('stat-outstanding-revenue')) $('stat-outstanding-revenue').textContent = fmtMoney(outstandingRev);

  // Calculate GST stats (5% included in subtotal: 2.5% CGST + 2.5% SGST)
  let totalGst = 0;
  let paidGst = 0;
  let pendingGst = 0;

  orders.filter(o => o.status !== 'cancelled').forEach(o => {
    const meta = parseNotesMetadata(o.notes, o);
    const deliveryCharge = meta.charge ? parseFloat(meta.charge.replace(/[^\d.]/g, '')) || 0 : 0;
    const totalAmt = parseFloat(o.total_amount) || 0;
    const subtotal = Math.max(0, totalAmt - deliveryCharge) / 1.05;
    const gst = subtotal * 0.05;

    totalGst += gst;
    if (o.payment_status === 'paid') {
      paidGst += gst;
    } else {
      pendingGst += gst;
    }
  });

  const cgst = totalGst / 2;
  const sgst = totalGst / 2;

  if ($('stat-gst-total')) $('stat-gst-total').textContent = fmtMoney(totalGst);
  if ($('stat-gst-cgst')) $('stat-gst-cgst').textContent = fmtMoney(cgst);
  if ($('stat-gst-sgst')) $('stat-gst-sgst').textContent = fmtMoney(sgst);
  if ($('stat-gst-paid')) $('stat-gst-paid').textContent = fmtMoney(paidGst);
  if ($('stat-gst-pending')) $('stat-gst-pending').textContent = fmtMoney(pendingGst);

  // Populate dynamic month options in GST filing selector
  renderGSTMonthlySelect();

  // Sidebar badges
  const orderBadge = $('pending-orders-badge');
  if (pending > 0) { orderBadge.textContent = pending; show(orderBadge); }
  else hide(orderBadge);

  const bookBadge = $('pending-bookings-badge');
  const pendingBook = bookings.filter(b => b.status === 'pending').length;
  if (pendingBook > 0) { bookBadge.textContent = pendingBook; show(bookBadge); }
  else hide(bookBadge);
}

function renderGSTMonthlySelect() {
  const select = $('dash-gst-month-select');
  if (!select) return;

  const monthMap = new Map();
  orders.forEach(o => {
    if (o.created_at) {
      const d = new Date(o.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      monthMap.set(key, label);
    }
  });

  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  if (!monthMap.has(currentKey)) {
    monthMap.set(currentKey, now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }));
  }

  const sortedMonths = Array.from(monthMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));

  const prevVal = select.value;
  select.innerHTML = `
    <option value="current">Current Month (${monthMap.get(currentKey) || 'This Month'})</option>
    <option value="all">All Months Combined</option>
    <optgroup label="Select Specific Month">
      ${sortedMonths.map(([k, label]) => `<option value="${k}">${label}</option>`).join('')}
    </optgroup>
  `;

  if (prevVal && select.querySelector(`option[value="${prevVal}"]`)) {
    select.value = prevVal;
  }
}

function exportMonthlyGSTFilingCSV() {
  const select = $('dash-gst-month-select');
  const mode = select?.value || 'current';
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  let targetOrders = orders.filter(o => o.status !== 'cancelled');
  let filenameMonth = 'All_Months';

  if (mode === 'current') {
    targetOrders = targetOrders.filter(o => {
      const d = new Date(o.created_at);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return k === currentMonthKey;
    });
    filenameMonth = currentMonthKey;
  } else if (mode !== 'all') {
    targetOrders = targetOrders.filter(o => {
      const d = new Date(o.created_at);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return k === mode;
    });
    filenameMonth = mode;
  }

  if (targetOrders.length === 0) {
    showAdminToast('No orders found for the selected GST filing period.', 'error');
    return;
  }

  const s = typeof getBillSettings === 'function' ? getBillSettings() : { restaurantName: 'LIMRA RESTAURANT', gstin: '' };
  const restaurantName = s.restaurantName || 'LIMRA RESTAURANT';
  const gstin = s.gstin || 'NOT SPECIFIED';

  const headers = [
    'Invoice / Order #',
    'Invoice Date',
    'Customer Name',
    'Customer Phone',
    'Order Type',
    'Payment Mode',
    'Payment Status',
    'SAC Code',
    'Taxable Value (INR)',
    'CGST Rate (%)',
    'CGST Amount (INR)',
    'SGST Rate (%)',
    'SGST Amount (INR)',
    'Total GST (INR)',
    'Invoice Total (INR)',
    'Restaurant Name',
    'Restaurant GSTIN'
  ];

  let sumTaxable = 0;
  let sumCGST = 0;
  let sumSGST = 0;
  let sumGST = 0;
  let sumTotal = 0;

  const rows = targetOrders.map(o => {
    const meta = parseNotesMetadata(o.notes, o);
    const deliveryCharge = meta.charge ? parseFloat(meta.charge.replace(/[^\d.]/g, '')) || 0 : 0;
    const totalAmt = parseFloat(o.total_amount) || 0;
    const taxable = Math.max(0, totalAmt - deliveryCharge) / 1.05;
    const cgstAmt = taxable * 0.025;
    const sgstAmt = taxable * 0.025;
    const gstAmt = cgstAmt + sgstAmt;

    sumTaxable += taxable;
    sumCGST += cgstAmt;
    sumSGST += sgstAmt;
    sumGST += gstAmt;
    sumTotal += totalAmt;

    const dateStr = new Date(o.created_at).toLocaleDateString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });

    const orderType = meta.type === 'table' ? `Dine-In (Table ${meta.tableNumber || o.table_number || '—'})` : (meta.type === 'delivery' ? 'Online Delivery' : 'Pickup / Takeaway');
    const paymentMode = (meta.paymentMode || o.payment_mode || meta.payment || (o.payment_status === 'paid' ? 'UPI/Online' : 'Cash/Pending')).toUpperCase();

    return [
      `"${o.order_number || o.id}"`,
      `"${dateStr}"`,
      `"${(o.customer_name || 'Walk-in Customer').replace(/"/g, '""')}"`,
      `"${o.customer_phone || ''}"`,
      `"${orderType}"`,
      `"${paymentMode}"`,
      `"${(o.payment_status || 'unpaid').toUpperCase()}"`,
      `"996331"`,
      `"${taxable.toFixed(2)}"`,
      `"2.50%"`,
      `"${cgstAmt.toFixed(2)}"`,
      `"2.50%"`,
      `"${sgstAmt.toFixed(2)}"`,
      `"${gstAmt.toFixed(2)}"`,
      `"${totalAmt.toFixed(2)}"`,
      `"${restaurantName}"`,
      `"${gstin}"`
    ];
  });

  // Add Summary Total Row
  rows.push([
    '"TOTALS"',
    '""',
    `"${targetOrders.length} Invoices"`,
    '""',
    '""',
    '""',
    '""',
    '""',
    `"${sumTaxable.toFixed(2)}"`,
    '""',
    `"${sumCGST.toFixed(2)}"`,
    '""',
    `"${sumSGST.toFixed(2)}"`,
    `"${sumGST.toFixed(2)}"`,
    `"${sumTotal.toFixed(2)}"`,
    `"${restaurantName}"`,
    `"${gstin}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `LIMRA_Restaurant_Monthly_GST_Filing_${filenameMonth}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showAdminToast(`Monthly GST Filing CSV for ${filenameMonth} downloaded! 📥`, 'success');
}

function exportTodaySummaryCSV() {
  const todayStr = new Date().toDateString();
  const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === todayStr);

  if (todayOrders.length === 0) {
    showAdminToast('No orders recorded today yet to export.', 'error');
    return;
  }

  const headers = ['Order #', 'Date & Time', 'Customer Name', 'Customer Phone', 'Type', 'Table #', 'Status', 'Payment Status', 'Total Amount (INR)'];
  const rows = todayOrders.map(o => {
    const meta = parseNotesMetadata(o.notes, o);
    return [
      `"${o.order_number || o.id}"`,
      `"${new Date(o.created_at).toLocaleString('en-IN')}"`,
      `"${(o.customer_name || 'Walk-in').replace(/"/g, '""')}"`,
      `"${o.customer_phone || ''}"`,
      `"${meta.type || o.order_type || 'table'}"`,
      `"${meta.tableNumber || o.table_number || ''}"`,
      `"${o.status}"`,
      `"${o.payment_status}"`,
      `"${Number(o.total_amount || 0).toFixed(2)}"`
    ];
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.setAttribute('download', `LIMRA_Today_Orders_Summary_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showAdminToast('Today orders exported to CSV! 📥', 'success');
}

function initDashboardQuickListeners() {
  $('dash-quick-pos-btn')?.addEventListener('click', () => {
    switchPanel('order-detail');
    setTimeout(() => {
      $('billing-new-btn')?.click();
    }, 100);
  });

  $('dash-quick-tables-btn')?.addEventListener('click', () => {
    window.open('/table/qr-admin.html', '_blank');
  });

  $('dash-quick-sync-btn')?.addEventListener('click', () => {
    refreshDashboard(true);
    showAdminToast('Data refreshed and synchronized! 🔄', 'success');
  });

  $('dash-quick-export-today-btn')?.addEventListener('click', exportTodaySummaryCSV);

  $('dash-export-gst-csv-btn')?.addEventListener('click', exportMonthlyGSTFilingCSV);
}

function renderDonuts() {
  const total = orders.length || 1;
  const delivered = orders.filter(o => o.status === 'delivered').length;
  const pending = orders.filter(o => o.status === 'pending').length;
  const revenue = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total_amount), 0);
  const maxRev = Math.max(revenue, 1);

  const items = [
    { label: 'Total Order', pct: Math.round((orders.length / Math.max(total, 1)) * 100) || 0, color: '#ff5b5b', bg: 'conic-gradient(#ff5b5b 0% 81%, #fdecea 81% 100%)' },
    { label: 'Pending', pct: Math.round((pending / total) * 100), color: '#00b074', bg: `conic-gradient(#00b074 0% ${Math.round((pending / total) * 100)}%, #e6f7f1 ${Math.round((pending / total) * 100)}% 100%)` },
    { label: 'Delivered', pct: Math.round((delivered / total) * 100), color: '#2d9cdb', bg: `conic-gradient(#2d9cdb 0% ${Math.round((delivered / total) * 100)}%, #e8f4fd ${Math.round((delivered / total) * 100)}% 100%)` },
  ];

  if (orders.length === 0) {
    $('donut-stats').innerHTML = '<p class="adm-empty w-full">No order data yet</p>';
    return;
  }

  $('donut-stats').innerHTML = items.map(it => `
    <div class="adm-donut-item">
      <div class="adm-donut-ring" style="background:${it.bg}; color:${it.color}">${it.pct}%</div>
      <p class="adm-donut-label">${it.label}</p>
    </div>
  `).join('');
}

function renderCharts() {
  const chartDefaults = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
  };

  destroyChart('ordersWeek');
  charts.ordersWeek = new Chart($('chart-orders-week'), {
    type: 'line',
    data: {
      labels: DAYS,
      datasets: [{
        data: getOrdersByDayOfWeek(),
        borderColor: '#2d9cdb',
        backgroundColor: 'rgba(45, 156, 219, 0.15)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#2d9cdb',
      }],
    },
    options: { ...chartDefaults, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } }, x: { grid: { display: false } } } },
  });

  destroyChart('revenue');
  charts.revenue = new Chart($('chart-revenue'), {
    type: 'line',
    data: {
      labels: MONTHS,
      datasets: [{
        data: getRevenueByMonth(),
        borderColor: '#00b074',
        backgroundColor: 'rgba(0, 176, 116, 0.1)',
        fill: true,
        tension: 0.4,
      }],
    },
    options: { ...chartDefaults, scales: { y: { beginAtZero: true } } },
  });

  destroyChart('bookings');
  charts.bookings = new Chart($('chart-bookings'), {
    type: 'bar',
    data: {
      labels: DAYS,
      datasets: [{
        data: getBookingsByDayOfWeek(),
        backgroundColor: ['#00b074', '#2d9cdb', '#f2994a', '#9b59b6', '#ff5b5b', '#00b074', '#2d9cdb'],
        borderRadius: 8,
      }],
    },
    options: { ...chartDefaults, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
  });
}

const categoryColors = {
  soup: '#ff5b5b',
  'veg-starters': '#2d9cdb',
  'nonveg-starters': '#f2994a',
  'tandoor-kabab': '#9b59b6',
  bread: '#00b074',
  biryani: '#ffc107',
  'veg-curry': '#e83e8c',
  'nonveg-curry': '#fd7e14',
  'veg-rice': '#20c997',
  'nonveg-rice': '#17a2b8',
  'chinese-veg': '#6f42c1',
  'chinese-nonveg': '#dc3545',
  noodles: '#28a745',
  thali: '#6c757d',
  desserts: '#ff85a2',
  salads: '#b5e2fa',
  'momos-chaat': '#edafb8',
  juices: '#38b000',
  lassi: '#ffc6ff',
  milkshakes: '#bdb2ff',
  mocktails: '#9bf6ff',
  beverages: '#a0c4ff'
};

function getCategorySalesData() {
  const counts = {};
  Object.keys(categoryLabels).forEach(cat => {
    counts[cat] = 0;
  });
  orderItems.forEach(item => {
    const order = orders.find(o => o.id === item.order_id);
    if (order && order.status !== 'cancelled') {
      const menu = menuItems.find(m => m.name === item.item_name);
      if (menu && menu.category) {
        counts[menu.category] = (counts[menu.category] || 0) + item.quantity;
      }
    }
  });
  return counts;
}

// ════════════════════════════════════════════════════════
// 📈 ORDERS REPORT & AUDIT ENGINE
// ════════════════════════════════════════════════════════

let ordersReportDateFilter = 'all';
let ordersReportCustomStart = null;
let ordersReportCustomEnd = null;
let ordersReportTypeFilter = 'all';
let ordersReportModeFilter = 'all';
let ordersReportStatusFilter = 'all';
let ordersReportSearch = '';
let ordersSalesTrendChartInstance = null;
let ordersPaySplitChartInstance = null;

function computeOrdersReportData() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  let list = orders.slice();

  // 1. Date Filtering
  if (ordersReportDateFilter === 'today') {
    list = list.filter(o => new Date(o.created_at).getTime() >= todayStart);
  } else if (ordersReportDateFilter === 'yesterday') {
    const yestStart = todayStart - 86400000;
    list = list.filter(o => {
      const t = new Date(o.created_at).getTime();
      return t >= yestStart && t < todayStart;
    });
  } else if (ordersReportDateFilter === 'week') {
    const weekStart = todayStart - (6 * 86400000);
    list = list.filter(o => new Date(o.created_at).getTime() >= weekStart);
  } else if (ordersReportDateFilter === 'month') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    list = list.filter(o => new Date(o.created_at).getTime() >= monthStart);
  } else if (ordersReportDateFilter === 'custom' && ordersReportCustomStart) {
    const cStart = new Date(ordersReportCustomStart).getTime();
    const cEnd = ordersReportCustomEnd ? (new Date(ordersReportCustomEnd).getTime() + 86400000) : (cStart + 86400000);
    list = list.filter(o => {
      const t = new Date(o.created_at).getTime();
      return t >= cStart && t < cEnd;
    });
  }

  // 2. Order Type Filter
  if (ordersReportTypeFilter !== 'all') {
    list = list.filter(o => {
      const parsed = parseNotesMetadata(o.notes, o);
      return parsed.type === ordersReportTypeFilter || o.order_type === ordersReportTypeFilter;
    });
  }

  // 3. Payment Mode Filter
  if (ordersReportModeFilter !== 'all') {
    list = list.filter(o => {
      const parsed = parseNotesMetadata(o.notes, o);
      const mode = (parsed.paymentMode || o.payment_mode || 'cash').toLowerCase();
      return mode === ordersReportModeFilter;
    });
  }

  // 4. Status Filter
  if (ordersReportStatusFilter !== 'all') {
    if (ordersReportStatusFilter === 'delivered') {
      list = list.filter(o => o.status === 'delivered' || o.payment_status === 'paid');
    } else {
      list = list.filter(o => o.status === ordersReportStatusFilter);
    }
  }

  // 5. Search Filter
  if (ordersReportSearch) {
    const q = ordersReportSearch.toLowerCase().trim();
    list = list.filter(o => {
      const parsed = parseNotesMetadata(o.notes, o);
      return (
        String(o.order_number || '').includes(q) ||
        (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
        (o.customer_phone && o.customer_phone.includes(q)) ||
        String(parsed.tableNumber || o.table_number || '').toLowerCase().includes(q)
      );
    });
  }

  // Sort newest first
  list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // 6. Aggregate KPI Metrics
  const activeOrders = list.filter(o => o.status !== 'cancelled');
  const grossRev = activeOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const totalOrdersCount = list.length;

  let tableOrdersCount = 0;
  let deliveryOrdersCount = 0;
  let upiRev = 0;
  let cashRev = 0;
  let cardRev = 0;
  let payLaterRev = 0;

  activeOrders.forEach(o => {
    const parsed = parseNotesMetadata(o.notes, o);
    const type = parsed.type || o.order_type || 'table';
    if (type === 'table') tableOrdersCount++;
    else if (type === 'delivery') deliveryOrdersCount++;

    const mode = (parsed.paymentMode || o.payment_mode || 'cash').toLowerCase();
    const amt = Number(o.total_amount || 0);
    if (mode === 'upi') upiRev += amt;
    else if (mode === 'cash') cashRev += amt;
    else if (mode === 'card') cardRev += amt;
    else payLaterRev += amt;
  });

  const s = getBillSettings();
  const taxCollected = grossRev * (s.cgstRate + s.sgstRate) / (100 + s.cgstRate + s.sgstRate);
  const aov = activeOrders.length > 0 ? (grossRev / activeOrders.length) : 0;

  return {
    list,
    activeOrders,
    grossRev,
    totalOrdersCount,
    tableOrdersCount,
    deliveryOrdersCount,
    upiRev,
    cashRev,
    cardRev,
    payLaterRev,
    taxCollected,
    aov
  };
}

function renderOrdersReportCharts(activeOrders) {
  // Chart 1: Sales Revenue Trend
  const canvasTrend = $('chart-orders-sales-trend');
  if (canvasTrend) {
    let labels = [];
    let data = [];

    if (ordersReportDateFilter === 'today' || ordersReportDateFilter === 'yesterday') {
      labels = ['8 AM', '10 AM', '12 PM', '2 PM', '4 PM', '6 PM', '8 PM', '10 PM', '12 AM'];
      const buckets = new Array(labels.length).fill(0);
      activeOrders.forEach(o => {
        const hour = new Date(o.created_at).getHours();
        const idx = Math.min(labels.length - 1, Math.max(0, Math.floor((hour - 6) / 2)));
        buckets[idx] += Number(o.total_amount || 0);
      });
      data = buckets;
    } else if (ordersReportDateFilter === 'week') {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const now = new Date();
      labels = [];
      data = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        labels.push(days[d.getDay()]);
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        const dayEnd = dayStart + 86400000;
        const daySum = activeOrders
          .filter(o => {
            const t = new Date(o.created_at).getTime();
            return t >= dayStart && t < dayEnd;
          })
          .reduce((s, o) => s + Number(o.total_amount || 0), 0);
        data.push(daySum);
      }
    } else {
      labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      data = MONTHS.map((_, i) => activeOrders.filter(o => new Date(o.created_at).getMonth() === i).reduce((s, o) => s + Number(o.total_amount || 0), 0));
    }

    if (ordersSalesTrendChartInstance) {
      ordersSalesTrendChartInstance.destroy();
    }

    ordersSalesTrendChartInstance = new Chart(canvasTrend, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Sales Revenue',
          data,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16,185,129,0.08)',
          tension: 0.35,
          fill: true,
          pointRadius: 4,
          pointBackgroundColor: '#10b981'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` Revenue: ₹${Number(ctx.raw || 0).toFixed(2)}`
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 10 }, callback: (v) => `₹${v}` } }
        }
      }
    });
  }

  // Chart 2: Payment Mode Split
  const canvasPay = $('chart-orders-payment-split');
  if (canvasPay) {
    let upi = 0, cash = 0, card = 0, payLater = 0;
    activeOrders.forEach(o => {
      const parsed = parseNotesMetadata(o.notes, o);
      const mode = (parsed.paymentMode || o.payment_mode || 'cash').toLowerCase();
      const amt = Number(o.total_amount || 0);
      if (mode === 'upi') upi += amt;
      else if (mode === 'card') card += amt;
      else if (mode === 'pay_later') payLater += amt;
      else cash += amt;
    });

    const labels = ['📱 UPI', '💵 Cash', '💳 Card', '⏳ Pay Later'];
    const data = [upi, cash, card, payLater];
    const colors = ['#6366f1', '#10b981', '#06b6d4', '#f59e0b'];

    const hasData = data.some(v => v > 0);

    if (ordersPaySplitChartInstance) {
      ordersPaySplitChartInstance.destroy();
    }

    ordersPaySplitChartInstance = new Chart(canvasPay, {
      type: 'doughnut',
      data: {
        labels: hasData ? labels : ['No Data'],
        datasets: [{
          data: hasData ? data : [1],
          backgroundColor: hasData ? colors : ['#e2e8f0'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ₹${Number(ctx.raw || 0).toFixed(2)}`
            }
          }
        },
        cutout: '65%'
      }
    });
  }
}

function renderOrdersReport() {
  const {
    list,
    activeOrders,
    grossRev,
    totalOrdersCount,
    tableOrdersCount,
    deliveryOrdersCount,
    upiRev,
    cashRev,
    taxCollected,
    aov
  } = computeOrdersReportData();

  // 1. KPI Cards
  if ($('ord-kpi-gross-rev')) $('ord-kpi-gross-rev').textContent = `₹${grossRev.toFixed(2)}`;
  if ($('ord-kpi-orders-count')) $('ord-kpi-orders-count').textContent = `${activeOrders.length} Settled Orders`;

  if ($('ord-kpi-total-orders')) $('ord-kpi-total-orders').textContent = `${totalOrdersCount} Orders`;
  if ($('ord-kpi-table-delivery-split')) $('ord-kpi-table-delivery-split').textContent = `${tableOrdersCount} Table · ${deliveryOrdersCount} Delivery`;

  if ($('ord-kpi-upi-cash')) $('ord-kpi-upi-cash').textContent = `₹${upiRev.toFixed(0)} / ₹${cashRev.toFixed(0)}`;
  const totalPay = upiRev + cashRev;
  const upiRatio = totalPay > 0 ? ((upiRev / totalPay) * 100).toFixed(0) : '0';
  const cashRatio = totalPay > 0 ? ((cashRev / totalPay) * 100).toFixed(0) : '0';
  if ($('ord-kpi-upi-cash-ratio')) $('ord-kpi-upi-cash-ratio').textContent = `UPI: ${upiRatio}% · Cash: ${cashRatio}%`;

  if ($('ord-kpi-tax-amt')) $('ord-kpi-tax-amt').textContent = `₹${taxCollected.toFixed(2)}`;
  if ($('ord-kpi-aov')) $('ord-kpi-aov').textContent = `₹${aov.toFixed(2)}`;

  // 2. Charts
  renderOrdersReportCharts(activeOrders);

  // 3. Summary Bar
  if ($('orders-report-count')) $('orders-report-count').textContent = `${list.length} ${list.length === 1 ? 'order' : 'orders'}`;
  if ($('orders-report-amount')) $('orders-report-amount').textContent = `₹${grossRev.toFixed(2)}`;
  if ($('orders-report-tax-amt')) $('orders-report-tax-amt').textContent = `₹${taxCollected.toFixed(2)}`;

  // 4. Data Table
  const tbody = $('orders-report-table-body');
  if (!tbody) return;

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:2.5rem;color:var(--adm-muted);">No orders match your selected filters.</td></tr>';
    return;
  }

  const s = getBillSettings();
  tbody.innerHTML = list.map(o => {
    const items = getItemsForOrder(o.id);
    const parsed = parseNotesMetadata(o.notes, o);
    const tableNum = parsed.tableNumber || o.table_number || '';
    const isTable = parsed.type === 'table';
    const typeLabel = isTable
      ? `<span style="background:#eef2ff;color:#4f46e5;padding:.15rem .5rem;border-radius:999px;font-weight:700;font-size:.75rem;">🪑 Table ${tableNum || '—'}</span>`
      : (parsed.type === 'delivery' ? '<span style="background:#eff6ff;color:#1d4ed8;padding:.15rem .5rem;border-radius:999px;font-weight:600;font-size:.75rem;">🚗 Delivery</span>' : '<span style="background:#fef3c7;color:#b45309;padding:.15rem .5rem;border-radius:999px;font-weight:600;font-size:.75rem;">🥡 Pickup</span>');

    const itemsSummary = items.length
      ? items.slice(0, 2).map(i => `${i.quantity}× ${escapeHtml(i.item_name)}`).join(', ') + (items.length > 2 ? ` +${items.length - 2} more` : '')
      : '<span style="color:var(--adm-muted);">No items recorded</span>';

    const isPaid = o.payment_status === 'paid';
    const isCancelled = o.status === 'cancelled';
    const payModeStr = parsed.paymentMode || o.payment_mode || 'Cash/UPI';
    const payBadge = isPaid
      ? `<span style="background:#f0fdf4;color:#166534;font-size:.72rem;font-weight:700;padding:.1rem .4rem;border-radius:4px;border:1px solid #bbf7d0;">Paid · ${escapeHtml(payModeStr)}</span>`
      : (isCancelled ? '<span style="background:#fee2e2;color:#b91c1c;font-size:.72rem;font-weight:700;padding:.1rem .4rem;border-radius:4px;">Cancelled</span>' : '<span style="background:#fef2f2;color:#991b1b;font-size:.72rem;font-weight:700;padding:.1rem .4rem;border-radius:4px;border:1px solid #fecaca;">Unpaid</span>');

    const ordTax = (Number(o.total_amount || 0) * (s.cgstRate + s.sgstRate) / (100 + s.cgstRate + s.sgstRate));
    const d = new Date(o.created_at);
    const dateStr = d.toLocaleDateString('en-IN', { day:'2-digit', month:'short' }) + ', ' + d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });

    return `
      <tr>
        <td>
          <strong style="color:#111827;font-size:.88rem;">#${o.order_number || o.id.slice(0, 8)}</strong>
        </td>
        <td>
          <div style="font-weight:700;color:#111827;font-size:.85rem;">${escapeHtml(o.customer_name || 'Walk-in')}</div>
          <div style="font-size:.75rem;color:var(--adm-muted);">${escapeHtml(o.customer_phone || '—')}</div>
        </td>
        <td>${typeLabel}</td>
        <td style="max-width:200px;font-size:.8rem;color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${items.map(i=>`${i.quantity}x ${i.item_name}`).join(', ')}">
          ${itemsSummary}
        </td>
        <td>${payBadge}</td>
        <td style="text-align:right;font-size:.82rem;color:var(--adm-muted);">₹${ordTax.toFixed(2)}</td>
        <td style="text-align:right;">
          <strong style="font-size:.9rem;color:${isCancelled ? '#9ca3af' : '#059669'};">₹${Number(o.total_amount || 0).toFixed(2)}</strong>
        </td>
        <td style="font-size:.78rem;color:var(--adm-muted);">${dateStr}</td>
        <td style="text-align:right;">
          <button type="button" class="adm-btn adm-btn-outline adm-btn-sm ord-rep-print-btn" data-id="${o.id}" style="font-size:.75rem;padding:.25rem .55rem;" title="Print bill receipt">
            🧾 Bill
          </button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.ord-rep-print-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const order = orders.find(o => String(o.id) === String(btn.dataset.id));
      if (!order) return;
      await printOrderReceiptWithTax(order);
    });
  });
}

// Alias for backwards compatibility
function renderAnalytics() {
  renderOrdersReport();
}

function exportOrdersReportCSV() {
  const { list } = computeOrdersReportData();
  if (!list.length) {
    showAdminToast('No orders data to export.', 'error');
    return;
  }

  const s = getBillSettings();
  const headers = ['Order Number', 'Date & Time', 'Customer Name', 'Phone', 'Order Type', 'Table', 'Payment Mode', 'Status', 'Payment Status', 'Items', 'Tax (INR)', 'Total Amount (INR)'];
  const rows = list.map(o => {
    const items = getItemsForOrder(o.id);
    const parsed = parseNotesMetadata(o.notes, o);
    const itemsStr = items.map(i => `${i.quantity}x ${i.item_name}`).join('; ');
    const ordTax = (Number(o.total_amount || 0) * (s.cgstRate + s.sgstRate) / (100 + s.cgstRate + s.sgstRate));
    return [
      `"${o.order_number || ''}"`,
      `"${new Date(o.created_at).toLocaleString('en-IN')}"`,
      `"${(o.customer_name || 'Walk-in').replace(/"/g, '""')}"`,
      `"${o.customer_phone || ''}"`,
      `"${parsed.type || o.order_type || 'table'}"`,
      `"${parsed.tableNumber || o.table_number || ''}"`,
      `"${parsed.paymentMode || o.payment_mode || 'Cash/UPI'}"`,
      `"${o.status}"`,
      `"${o.payment_status}"`,
      `"${itemsStr.replace(/"/g, '""')}"`,
      `"${ordTax.toFixed(2)}"`,
      `"${Number(o.total_amount || 0).toFixed(2)}"`
    ];
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 10);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `LIMRA_Orders_Sales_Report_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showAdminToast('Orders sales report exported to Excel CSV! 📥', 'success');
}

function initOrdersReportListeners() {
  // Date Preset Buttons
  $('orders-report-date-presets')?.querySelectorAll('.pos-cat-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      $('orders-report-date-presets').querySelectorAll('.pos-cat-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      ordersReportDateFilter = btn.dataset.range;
      const customWrap = $('orders-report-custom-date-wrap');
      if (customWrap) customWrap.style.display = ordersReportDateFilter === 'custom' ? 'flex' : 'none';
      if (ordersReportDateFilter !== 'custom') renderOrdersReport();
    });
  });

  // Custom Date Apply
  $('orders-report-apply-custom-date')?.addEventListener('click', () => {
    ordersReportCustomStart = $('orders-report-start-date')?.value || null;
    ordersReportCustomEnd = $('orders-report-end-date')?.value || null;
    renderOrdersReport();
  });

  // Filters & Search
  $('orders-report-type-filter')?.addEventListener('change', (e) => {
    ordersReportTypeFilter = e.target.value;
    renderOrdersReport();
  });

  $('orders-report-mode-filter')?.addEventListener('change', (e) => {
    ordersReportModeFilter = e.target.value;
    renderOrdersReport();
  });

  $('orders-report-status-filter')?.addEventListener('change', (e) => {
    ordersReportStatusFilter = e.target.value;
    renderOrdersReport();
  });

  $('orders-report-search')?.addEventListener('input', (e) => {
    ordersReportSearch = e.target.value;
    renderOrdersReport();
  });

  $('orders-report-export-btn')?.addEventListener('click', exportOrdersReportCSV);
}

// ── Dashboard Date Search & Summary ──────────────────────────

let activeDashDatePreset = 'today';

function getLocalDateString(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDashDateRange() {
  const customDateVal = $('dash-date-input')?.value;
  if (customDateVal) {
    const formatted = new Date(customDateVal + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    return {
      type: 'single',
      dateStr: customDateVal,
      label: `Selected Date: ${formatted}`
    };
  }

  const now = new Date();
  const todayStr = getLocalDateString(now);

  if (activeDashDatePreset === 'today') {
    const formatted = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    return { type: 'single', dateStr: todayStr, label: `Summary for Today (${formatted})` };
  }

  if (activeDashDatePreset === 'yesterday') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const yStr = getLocalDateString(y);
    const formatted = y.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    return { type: 'single', dateStr: yStr, label: `Summary for Yesterday (${formatted})` };
  }

  if (activeDashDatePreset === 'week') {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    const startFmt = start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const endFmt = end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    return { type: 'range', start, end, label: `Summary for Last 7 Days (${startFmt} – ${endFmt})` };
  }

  if (activeDashDatePreset === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    const monthFmt = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    return { type: 'range', start, end, label: `Summary for ${monthFmt}` };
  }

  return { type: 'all', label: 'Summary for All Time' };
}

function renderDashboardDateFilter() {
  const range = getDashDateRange();
  let filtered = [];

  if (range.type === 'single') {
    filtered = orders.filter(o => getLocalDateString(o.created_at) === range.dateStr);
  } else if (range.type === 'range') {
    filtered = orders.filter(o => {
      const d = new Date(o.created_at);
      return d >= range.start && d <= range.end;
    });
  } else {
    filtered = [...orders];
  }

  const validOrders = filtered.filter(o => o.status !== 'cancelled');
  const totalCount = filtered.length;
  const totalAmount = validOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const paidAmount = validOrders.filter(o => o.payment_status === 'paid').reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const unpaidAmount = validOrders.filter(o => o.payment_status === 'unpaid' || !o.payment_status).reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const onlineCount = filtered.filter(o => o.order_type !== 'table').length;
  const tableCount = filtered.filter(o => o.order_type === 'table').length;

  if ($('dash-date-summary-label')) $('dash-date-summary-label').textContent = range.label;
  if ($('dash-date-order-count')) $('dash-date-order-count').textContent = `${totalCount} order${totalCount === 1 ? '' : 's'}`;
  if ($('dash-date-order-amount')) $('dash-date-order-amount').textContent = fmtMoney(totalAmount);
  if ($('dash-date-paid-amount')) $('dash-date-paid-amount').textContent = fmtMoney(paidAmount);
  if ($('dash-date-unpaid-amount')) $('dash-date-unpaid-amount').textContent = fmtMoney(unpaidAmount);
  if ($('dash-date-type-breakdown')) $('dash-date-type-breakdown').textContent = `${onlineCount} Online · ${tableCount} Table`;

  // Render preview table rows
  const tbody = $('dash-date-orders-table-body');
  if (tbody) {
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="adm-empty">No orders found for this date selection</td></tr>`;
    } else {
      const previewPage = filtered.slice(0, 15);
      tbody.innerHTML = previewPage.map(order => {
        const parsedMeta = parseNotesMetadata(order.notes, order);
        let typeText = '🥡 Pickup';
        if (parsedMeta.type === 'delivery') {
          typeText = '🚗 Delivery';
        } else if (parsedMeta.type === 'table') {
          typeText = `🍽️ Table ${parsedMeta.tableNumber}`;
        }
        const timeStr = new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        const dateStr = fmtDateShort(order.created_at);

        return `
          <tr class="dash-date-order-row" data-order-id="${order.id}" style="cursor: pointer;">
            <td><strong>#${order.order_number}</strong></td>
            <td><strong>${escapeHtml(order.customer_name)}</strong> <br/><span class="adm-info-muted" style="font-size: 11px;">${order.customer_phone}</span></td>
            <td><span class="adm-badge" style="font-size: 11px;">${typeText}</span></td>
            <td><strong style="color: var(--adm-green);">${fmtMoney(order.total_amount)}</strong></td>
            <td>${statusPill(order.status, parsedMeta.type === 'table')}</td>
            <td>${paymentStatusPill(order.payment_status || 'unpaid')}</td>
            <td>${dateStr} <br/><span class="adm-info-muted" style="font-size: 11px;">${timeStr}</span></td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.dash-date-order-row').forEach(row => {
        row.addEventListener('click', () => {
          const id = row.dataset.orderId;
          if (id) openOrderDetail(id);
        });
      });
    }
  }
}

function renderOverview() {
  renderStats();
  renderDonuts();
  renderCharts();
  renderDashboardDateFilter();
  try {
    initDashboardMap();
    renderDashboardMapMarkers();
  } catch (err) {
    console.warn('Dashboard map rendering failed:', err);
  }
}

function initDashboardMap() {
  const mapContainer = $('dashboard-deliveries-map');
  if (!mapContainer || dashboardMap) return;

  try {
    const limraCoords = [21.8603074, 87.4793798];
    dashboardMap = L.map('dashboard-deliveries-map', {
      zoomControl: true,
      scrollWheelZoom: true
    }).setView(limraCoords, 13);

    // Layer control
    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(dashboardMap);

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri'
    });

    L.control.layers({
      "Street Map": streetLayer,
      "Satellite": satelliteLayer
    }, null, { position: 'topright' }).addTo(dashboardMap);

    // Add restaurant marker (Gold)
    const restaurantIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });
    L.marker(limraCoords, { icon: restaurantIcon }).addTo(dashboardMap).bindPopup('<b>LIMRA Restaurant (Kitchen)</b>');

    dashboardMarkersGroup = L.layerGroup().addTo(dashboardMap);
    
    // Expose window action for popup View Details buttons
    window.adminOpenOrder = (orderId) => {
      openOrderDetail(orderId);
    };

    // Attach filter button listeners
    const allBtn = $('map-filter-all');
    const pendingBtn = $('map-filter-pending');
    const prepBtn = $('map-filter-preparing');

    const setMapFilter = (filter) => {
      activeMapFilter = filter;
      [allBtn, pendingBtn, prepBtn].forEach(btn => {
        if (btn) {
          btn.classList.remove('active');
          btn.style.background = '#f5f7fa';
          btn.style.color = 'var(--adm-text)';
        }
      });
      const activeBtn = filter === 'all' ? allBtn : (filter === 'pending' ? pendingBtn : prepBtn);
      if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.style.background = 'var(--adm-green)';
        activeBtn.style.color = '#fff';
      }
      renderDashboardMapMarkers();
    };

    allBtn?.addEventListener('click', () => setMapFilter('all'));
    pendingBtn?.addEventListener('click', () => setMapFilter('pending'));
    prepBtn?.addEventListener('click', () => setMapFilter('preparing'));

  } catch (err) {
    console.error('Error initializing dashboard map:', err);
  }
}

function renderDashboardMapMarkers() {
  if (!dashboardMap || !dashboardMarkersGroup) return;

  dashboardMarkersGroup.clearLayers();

  const limraCoords = [21.8603074, 87.4793798];
  const bounds = [limraCoords];

  // Filter orders matching activeMapFilter & has coordinates
  const activeOrders = orders.filter(o => {
    const meta = parseNotesMetadata(o.notes, o);
    if (meta.type !== 'delivery') return false;
    if (o.latitude === null || o.longitude === null) return false;

    if (activeMapFilter === 'all') {
      return ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status);
    } else if (activeMapFilter === 'pending') {
      return o.status === 'pending';
    } else if (activeMapFilter === 'preparing') {
      return ['confirmed', 'preparing', 'ready'].includes(o.status);
    }
    return false;
  });

  activeOrders.forEach(order => {
    const lat = parseFloat(order.latitude);
    const lng = parseFloat(order.longitude);
    const orderCoords = [lat, lng];
    bounds.push(orderCoords);

    const icon = getMarkerIconForStatus(order.status);
    const marker = L.marker(orderCoords, { icon });

    const popupContent = `
      <div style="font-family: 'Inter', sans-serif; font-size: 12px; line-height: 1.4; min-width: 160px; padding: 4px;">
        <h4 style="margin: 0 0 6px 0; font-weight: 700; color: var(--adm-text);">Order #${order.order_number}</h4>
        <p style="margin: 0 0 3px 0;"><b>Customer:</b> ${escapeHtml(order.customer_name)}</p>
        <p style="margin: 0 0 3px 0;"><b>Status:</b> ${statusPill(order.status)}</p>
        <p style="margin: 0 0 3px 0;"><b>Amount:</b> ${fmtMoney(order.total_amount)}</p>
        <p style="margin: 0 0 8px 0;"><b>Phone:</b> <a href="tel:${order.customer_phone}">${order.customer_phone}</a></p>
        <button class="adm-btn adm-btn-primary adm-btn-sm" style="width: 100%; font-size: 10px; padding: 4px 6px; border-radius: 6px; cursor: pointer; text-align: center; display: block;" onclick="window.adminOpenOrder('${order.id}')">View Details</button>
      </div>
    `;

    marker.bindPopup(popupContent);
    dashboardMarkersGroup.addLayer(marker);
  });

  // Fit bounds if we have delivery points
  if (bounds.length > 1) {
    try {
      dashboardMap.fitBounds(L.latLngBounds(bounds), { padding: [50, 50] });
    } catch (e) {
      console.warn('Map fitBounds failed:', e);
    }
  } else {
    dashboardMap.setView(limraCoords, 13);
  }
}

function getMarkerIconForStatus(status) {
  let color = 'blue';
  if (status === 'pending') color = 'orange';
  else if (status === 'confirmed') color = 'yellow';
  else if (status === 'preparing') color = 'blue';
  else if (status === 'ready') color = 'violet';
  else if (status === 'delivered') color = 'green';
  else if (status === 'cancelled') color = 'red';

  return L.icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
}

// ── Orders table ────────────────────────────────────────

function getFilteredOrders() {
  const statusFilter = $('orders-status-filter')?.value || 'all';
  const paymentFilter = $('orders-payment-filter')?.value || 'all';
  const dateFilter = $('orders-date-filter')?.value || '';
  const search = ($('orders-search')?.value || getGlobalSearch()).toLowerCase().trim();
  let filtered = orders.filter(o => o.status !== 'hold'); // exclude held KOTs from Order List
  
  if (statusFilter !== 'all') filtered = filtered.filter(o => o.status === statusFilter);
  
  if (paymentFilter === 'paid') {
    filtered = filtered.filter(o => o.payment_status === 'paid');
  } else if (paymentFilter === 'unpaid') {
    filtered = filtered.filter(o => o.payment_status === 'unpaid' || !o.payment_status);
  } else if (paymentFilter === 'today_paid') {
    const todayStr = new Date().toDateString();
    filtered = filtered.filter(o => o.payment_status === 'paid' && new Date(o.created_at).toDateString() === todayStr);
  } else if (paymentFilter === 'today_unpaid') {
    const todayStr = new Date().toDateString();
    filtered = filtered.filter(o => (o.payment_status === 'unpaid' || !o.payment_status) && new Date(o.created_at).toDateString() === todayStr);
  }

  if (dateFilter) {
    filtered = filtered.filter(o => getLocalDateString(o.created_at) === dateFilter);
  }

  if (activeOrderTypeFilter === 'online') {
    filtered = filtered.filter(o => {
      const meta = parseNotesMetadata(o.notes, o);
      return meta.type === 'delivery' || (!meta.type && o.order_type !== 'table');
    });
  } else if (activeOrderTypeFilter === 'table') {
    filtered = filtered.filter(o => {
      const meta = parseNotesMetadata(o.notes, o);
      return meta.type === 'table' || o.order_type === 'table';
    });
  } else if (activeOrderTypeFilter === 'pickup') {
    filtered = filtered.filter(o => {
      const meta = parseNotesMetadata(o.notes, o);
      return meta.type === 'pickup' || o.order_type === 'pickup';
    });
  }
  
  if (search) {
    filtered = filtered.filter(o => {
      const items = getItemsForOrder(o.id);
      const itemsText = items.map(i => i.item_name).join(' ').toLowerCase();
      return (
        (o.customer_name && o.customer_name.toLowerCase().includes(search)) ||
        (o.customer_phone && o.customer_phone.includes(search)) ||
        String(o.order_number).includes(search) ||
        itemsText.includes(search) ||
        getLocalDateString(o.created_at).includes(search) ||
        new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).toLowerCase().includes(search)
      );
    });
  }
  return filtered;
}

function renderOrdersTable() {
  // Update 4 KPI Stat Cards
  const totalReceived = orders.length;
  let onlineCount = 0;
  let tableCount = 0;
  let activeInKitchenCount = 0;

  orders.forEach(o => {
    const meta = parseNotesMetadata(o.notes, o);
    const isTable = meta.type === 'table' || o.order_type === 'table';
    if (isTable) {
      tableCount++;
    } else {
      onlineCount++;
    }

    if (['pending', 'confirmed', 'preparing', 'ready', 'hold'].includes(o.status)) {
      activeInKitchenCount++;
    }
  });

  if ($('orders-kpi-total')) $('orders-kpi-total').textContent = `${totalReceived} Orders`;
  if ($('orders-kpi-online')) $('orders-kpi-online').textContent = `${onlineCount} Deliveries`;
  if ($('orders-kpi-table')) $('orders-kpi-table').textContent = `${tableCount} Table Orders`;
  if ($('orders-kpi-active')) $('orders-kpi-active').textContent = `${activeInKitchenCount} In-Kitchen`;

  const filtered = getFilteredOrders();

  // Update Orders Summary Bar
  const summaryCountEl = $('orders-summary-count');
  const summaryAmountEl = $('orders-summary-amount');
  const activeDateBadge = $('orders-date-active-label');
  
  const totalAmount = filtered
    .filter(o => o.status !== 'cancelled')
    .reduce((s, o) => s + Number(o.total_amount || 0), 0);

  if (summaryCountEl) summaryCountEl.textContent = `${filtered.length} ${filtered.length === 1 ? 'order' : 'orders'}`;
  if (summaryAmountEl) summaryAmountEl.textContent = fmtMoney(totalAmount);

  const dateVal = $('orders-date-filter')?.value || '';
  if (activeDateBadge) {
    if (dateVal) {
      const formattedDate = new Date(dateVal + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      activeDateBadge.textContent = `📅 ${formattedDate}`;
      show(activeDateBadge);
    } else {
      hide(activeDateBadge);
    }
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / ORDERS_PER_PAGE));
  if (ordersPage > totalPages) ordersPage = totalPages;
  const start = (ordersPage - 1) * ORDERS_PER_PAGE;
  const page = filtered.slice(start, start + ORDERS_PER_PAGE);

  const tbody = $('orders-table-body');
  if (page.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="adm-empty" style="text-align:center;padding:2.5rem;color:var(--adm-muted);">No orders match your filter criteria</td></tr>`;
  } else {
    tbody.innerHTML = page.map(order => {
      const parsedMeta = parseNotesMetadata(order.notes, order);
      const isTable = parsedMeta.type === 'table' || order.order_type === 'table';
      const items = getItemsForOrder(order.id);
      
      let typeBadge = '<span style="background:#e0f2fe;color:#0284c7;font-size:0.72rem;font-weight:700;padding:.15rem .45rem;border-radius:6px;">🚗 Online Delivery</span>';
      if (isTable) {
        typeBadge = `<span style="background:#fef3c7;color:#b45309;font-size:0.72rem;font-weight:700;padding:.15rem .45rem;border-radius:6px;">🪑 Table ${parsedMeta.tableNumber || order.table_number || '—'}</span>`;
      } else if (parsedMeta.type === 'pickup' || order.order_type === 'pickup') {
        typeBadge = '<span style="background:#f3e8ff;color:#7e22ce;font-size:0.72rem;font-weight:700;padding:.15rem .45rem;border-radius:6px;">🥡 Pickup</span>';
      }

      const itemsSummary = items.length > 0
        ? items.slice(0, 2).map(i => `${i.quantity}x ${i.item_name}`).join(', ') + (items.length > 2 ? ` +${items.length - 2} more` : '')
        : 'Dishes in order';

      return `
        <tr data-order-id="${order.id}">
          <td style="padding-left:1.25rem;">
            <strong style="font-size:.95rem;color:#1e293b;">#${formatDailyOrderNumber(order)}</strong>
            <div style="margin-top:2px;">${typeBadge}</div>
          </td>
          <td>
            <div style="font-weight:700;color:#1e293b;">${escapeHtml(order.customer_name || 'Customer')}</div>
            <a href="tel:${order.customer_phone}" style="color:var(--adm-muted);font-size:0.78rem;text-decoration:none;">${order.customer_phone || '—'}</a>
          </td>
          <td>
            <div style="font-size:0.8rem;color:#334155;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(items.map(i => `${i.quantity}x ${i.item_name}`).join(', '))}">
              🍽️ ${escapeHtml(itemsSummary)}
            </div>
            <div style="font-size:0.72rem;color:var(--adm-muted);">${items.length} item(s)</div>
          </td>
          <td>
            <strong style="font-size:1rem;color:#1e293b;">${fmtMoney(order.total_amount)}</strong>
          </td>
          <td>${statusPill(order.status, isTable)}</td>
          <td>${paymentStatusPill(order.payment_status || 'unpaid')}</td>
          <td style="font-size:0.8rem;color:var(--adm-muted);">${fmtDateShort(order.created_at)}</td>
          <td style="text-align:right;padding-right:1.25rem;">
            <div style="display:inline-flex;gap:0.35rem;align-items:center;justify-content:flex-end;">
              <!-- 🧾 CREATE BILL ACTION BUTTON -->
              <button type="button" class="adm-btn adm-btn-primary adm-btn-sm btn-create-bill-from-order" data-order-id="${order.id}" style="background:#6366f1;border-color:#6366f1;display:inline-flex;align-items:center;gap:3px;font-weight:700;padding:.3rem .6rem;font-size:0.75rem;" title="Load order items into POS Billing">
                🧾 Create Bill
              </button>
              <button type="button" class="adm-btn adm-btn-outline adm-btn-sm view-order-btn" data-order-id="${order.id}" style="padding:.3rem .55rem;font-size:0.75rem;">
                👁️ View
              </button>
              ${(order.payment_status || 'unpaid') === 'unpaid' ? `<button type="button" class="adm-btn adm-btn-outline adm-btn-sm inline-mark-paid-btn" data-order-id="${order.id}" style="padding:.3rem .55rem;font-size:0.75rem;border-color:var(--adm-green);color:var(--adm-green);" title="Mark as Paid">✓ Paid</button>` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // 1. Wire up Create Bill buttons
  tbody.querySelectorAll('.btn-create-bill-from-order').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const orderId = btn.dataset.orderId;
      createBillForOrder(orderId);
    });
  });

  // 2. Wire up Mark Paid buttons
  tbody.querySelectorAll('.inline-mark-paid-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const orderId = btn.dataset.orderId;
      if (confirm('Are you sure you want to mark this order as paid?')) {
        updateOrderPaymentStatus(orderId, 'paid');
      }
    });
  });

  // 3. Wire up View Order buttons and row clicks
  tbody.querySelectorAll('.view-order-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.orderId;
      if (id) openOrderDetail(id);
    });
  });

  tbody.querySelectorAll('tr[data-order-id]').forEach(row => {
    row.addEventListener('click', () => {
      const id = row.dataset.orderId;
      if (id) openOrderDetail(id);
    });
  });

  const pag = $('orders-pagination');
  if (pag) {
    pag.innerHTML = Array.from({ length: totalPages }, (_, i) =>
      `<button class="adm-page-btn ${i + 1 === ordersPage ? 'active' : ''}" data-page="${i + 1}">${i + 1}</button>`
    ).join('');
    pag.querySelectorAll('.adm-page-btn').forEach(btn => {
      btn.addEventListener('click', () => { ordersPage = Number(btn.dataset.page); renderOrdersTable(); });
    });
  }
}

function createBillForOrder(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (!order) {
    showAdminToast('Order not found.', 'error');
    return;
  }

  const items = getItemsForOrder(order.id);
  const parsedMeta = parseNotesMetadata(order.notes, order);
  const isTable = parsedMeta.type === 'table' || order.order_type === 'table';
  const orderType = isTable ? 'table' : (parsedMeta.type === 'delivery' ? 'delivery' : 'pickup');

  // Switch to Billing panel
  switchPanel('order-detail');

  // Allow panel mount then open POS builder
  setTimeout(() => {
    const posEl = $('billing-pos');
    const totalSection = $('billing-total-bills-section');
    const detailEl = $('billing-detail-view');

    if (posEl) posEl.style.display = 'block';
    if (totalSection) totalSection.style.display = 'none';
    if (detailEl) detailEl.style.display = 'none';

    // Populate Customer info
    if ($('pos-customer-name')) $('pos-customer-name').value = order.customer_name || 'Customer';
    if ($('pos-customer-phone')) $('pos-customer-phone').value = order.customer_phone || '';

    // Set Order Type
    posOrderType = orderType;
    document.querySelectorAll('.pos-type-btn').forEach(b => {
      const isSelected = b.dataset.type === orderType;
      b.classList.toggle('active', isSelected);
      b.classList.toggle('adm-btn-primary', isSelected);
      b.classList.toggle('adm-btn-outline', !isSelected);
    });

    const tableField = $('pos-table-field');
    const deliveryField = $('pos-delivery-field');
    if (tableField) tableField.style.display = orderType === 'table' ? 'block' : 'none';
    if (deliveryField) deliveryField.style.display = orderType === 'delivery' ? 'block' : 'none';

    if (orderType === 'table' && $('pos-table-number')) {
      $('pos-table-number').value = parsedMeta.tableNumber || order.table_number || '';
    }
    if (orderType === 'delivery') {
      const rawAddr = parsedMeta.address || order.address || '';
      const matchedPlace = adminPlaces.find(p => p.name && rawAddr.toLowerCase().includes(p.name.toLowerCase()));
      if (matchedPlace) {
        selectPosPlace(matchedPlace);
      }
      if ($('pos-delivery-address')) {
        $('pos-delivery-address').value = rawAddr;
      }
      if (parsedMeta.deliveryFee && $('pos-delivery-fee')) {
        $('pos-delivery-fee').value = parsedMeta.deliveryFee;
      }
    }

    if ($('pos-notes')) {
      $('pos-notes').value = order.notes ? `[Ref #${order.order_number}] ${parsedMeta.notes || ''}`.trim() : '';
    }

    // Load items into POS Cart
    if (items && items.length > 0) {
      posCart = items.map(i => ({
        id: i.menu_item_id || null,
        name: i.item_name || i.name,
        price: parseFloat(i.unit_price || i.price || (i.line_total / (i.quantity || 1)) || 0),
        qty: parseInt(i.quantity || i.qty || 1)
      }));
    } else {
      posCart = [{
        id: null,
        name: `Order #${formatDailyOrderNumber(order)} (${isTable ? 'Table Order' : 'Website Order'})`,
        price: parseFloat(order.total_amount || 0),
        qty: 1
      }];
    }

    updatePosCartUI();
    renderCategoryPills();
    renderFoodGrid();

    showAdminToast(`Loaded Order #${formatDailyOrderNumber(order)} into POS Billing with ${posCart.length} item(s)! 🧾`, 'success');
  }, 120);
}

function exportOrdersListCSV() {
  const filtered = getFilteredOrders();
  if (filtered.length === 0) {
    showAdminToast('No orders to export.', 'error');
    return;
  }

  const headers = ['Order #', 'Date & Time', 'Customer Name', 'Customer Phone', 'Channel / Type', 'Table #', 'Status', 'Payment Status', 'Items Ordered', 'Total Amount (INR)'];
  const rows = filtered.map(o => {
    const meta = parseNotesMetadata(o.notes, o);
    const items = getItemsForOrder(o.id);
    const itemsStr = items.map(i => `${i.quantity}x ${i.item_name}`).join('; ');
    const isTable = meta.type === 'table' || o.order_type === 'table';
    const channel = isTable ? 'Dine-In Table' : (meta.type === 'delivery' ? 'Online Delivery' : 'Pickup');

    return [
      `"${formatDailyOrderNumber(o)}"`,
      `"${new Date(o.created_at).toLocaleString('en-IN')}"`,
      `"${(o.customer_name || 'Walk-in').replace(/"/g, '""')}"`,
      `"${o.customer_phone || ''}"`,
      `"${channel}"`,
      `"${meta.tableNumber || o.table_number || ''}"`,
      `"${o.status}"`,
      `"${o.payment_status || 'unpaid'}"`,
      `"${itemsStr.replace(/"/g, '""')}"`,
      `"${Number(o.total_amount || 0).toFixed(2)}"`
    ];
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.setAttribute('download', `LIMRA_Orders_List_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showAdminToast('Orders exported to CSV! 📥', 'success');
}

async function updateOrderStatus(orderId, newStatus) {
  const { error } = await insforge.database.from('orders').update({ status: newStatus }).eq('id', orderId);
  if (error) { alert('Failed to update: ' + error.message); return false; }
  const order = orders.find(o => o.id === orderId);
  if (order) {
    order.status = newStatus;
    
    // Send Email Notification on Confirmation or Cancellation
    const meta = parseNotesMetadata(order.notes, order);
    if (meta.email) {
      try {
        if (newStatus === 'confirmed') {
          const emailHtml = generateOrderConfirmedHtml(order);
          await sendEmailNotification(meta.email, `✅ Order #${order.order_number} Confirmed - LIMRA Restaurant`, emailHtml);
        } else if (newStatus === 'cancelled') {
          const emailHtml = generateOrderCancelledHtml(order);
          await sendEmailNotification(meta.email, `❌ Order #${order.order_number} Cancelled - LIMRA Restaurant`, emailHtml);
        }
      } catch (emailErr) {
        console.warn('[Admin] Background email status notification failed:', emailErr);
      }
    }

    // Broadcast real-time order status update to client channel
    try {
      const cleanPhone = String(order.customer_phone).replace(/\D/g, '').slice(-10);
      if (cleanPhone.length >= 10) {
        let title = 'Order Update';
        let message = `Your order #${order.order_number} status is now ${newStatus}.`;
        let notifType = `order_${newStatus}`;
        
        switch (newStatus) {
          case 'confirmed':
            title = 'Order Confirmed';
            message = `Your order #${order.order_number} has been confirmed and is now being prepared.`;
            notifType = 'order_confirmed';
            break;
          case 'preparing':
            title = 'Order Preparing';
            message = `Your order #${order.order_number} is being prepared in the kitchen.`;
            notifType = 'order_preparing';
            break;
          case 'ready':
            title = 'Out For Delivery';
            message = `Your order #${order.order_number} is ready and out for delivery.`;
            notifType = 'out_for_delivery';
            break;
          case 'delivered':
            title = 'Order Delivered';
            message = `Your order #${order.order_number} has been delivered. Enjoy your meal!`;
            notifType = 'delivered';
            break;
          case 'cancelled':
            title = 'Order Rejected';
            message = `Your order #${order.order_number} has been cancelled.`;
            notifType = 'order_rejected';
            break;
        }

        await insforge.realtime.publish(`customer-notifications:${cleanPhone}`, 'notification_created', {
          title,
          message,
          order_id: orderId,
          type: notifType,
          created_at: new Date().toISOString()
        });
        console.log(`[Admin] Realtime status update broadcasted to customer channel: customer-notifications:${cleanPhone}`);

        // Also publish to specific order tracking channel
        try {
          await insforge.realtime.publish(`order-updates:${orderId}`, 'order_status_updated', {
            order_id: orderId,
            status: newStatus
          });
          console.log(`[Admin] Realtime status update broadcasted to order channel: order-updates:${orderId}`);
        } catch (orderRtErr) {
          console.warn('[Admin] Realtime order channel broadcast failed:', orderRtErr);
        }
      }
    } catch (rtErr) {
      console.warn('[Admin] Realtime status update broadcast failed:', rtErr);
    }
  }
  renderOverview();
  renderOrdersTable();
  renderOrderDetailPicker();
  if (selectedOrderId === orderId) renderOrderDetail(orderId);
  return true;
}

async function updateOrderPaymentStatus(orderId, newStatus) {
  try {
    const result = await PaymentService.updatePaymentStatus(orderId, newStatus);
    showAdminToast('Payment status updated successfully.', 'success');

    const order = orders.find(o => o.id === orderId);
    if (order) {
      order.payment_status = newStatus;
      try {
        await PaymentService.sendPaymentNotification(order.customer_phone, order);
      } catch (err) {
        console.warn('[Admin] Realtime payment notification broadcast failed:', err);
      }
    }

    renderOverview();
    renderOrdersTable();
    renderOrderDetailPicker();
    if (selectedOrderId === orderId) renderOrderDetail(orderId);
    return true;
  } catch (err) {
    console.error('Failed to update payment status:', err);
    showAdminToast('Unable to update payment status. Please try again.', 'error');
    return false;
  }
}

async function loadAndRenderPaymentHistory(orderId) {
  const container = document.getElementById('detail-payment-history-container');
  if (!container) return;
  try {
    const historyList = await PaymentService.getPaymentHistory(orderId);
    if (!historyList || historyList.length === 0) {
      container.innerHTML = '<p class="text-xs text-slate-400 italic">No payment history events recorded.</p>';
      return;
    }
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        ${historyList.map(h => `
          <div style="padding: 0.65rem; border-radius: 8px; border: 1px solid var(--adm-border); background: #fafbfc; font-size: 0.75rem;">
            <div style="display: flex; justify-content: space-between; font-weight: 600; margin-bottom: 0.25rem;">
              <span style="color: ${h.new_status === 'paid' ? 'var(--adm-green)' : '#ff5b5b'}">
                ${h.previous_status.toUpperCase()} → ${h.new_status.toUpperCase()}
              </span>
              <span style="color: var(--adm-muted); font-weight: normal; font-size: 0.7rem;">${fmtDate(h.created_at)}</span>
            </div>
            <p style="margin: 0 0 0.25rem 0; color: var(--adm-text); font-weight: 500;">${escapeHtml(h.notes || 'No description provided.')}</p>
            <div style="font-size: 0.675rem; color: var(--adm-muted);">Operator: ${escapeHtml(h.changed_by)}</div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    console.error('Failed to load payment history:', err);
    container.innerHTML = '<p class="text-xs text-red-500 italic">Failed to load payment logs.</p>';
  }
}

function openOrderDetail(orderId) {
  selectedOrderId = orderId;
  renderOrderDetailPicker();
  switchPanel('order-detail');
  renderOrderDetail(orderId);
}

function renderOrderDetailPicker() {
  const picker = $('order-detail-picker');
  if (!picker) return;
  const current = selectedOrderId || picker.value;
  picker.innerHTML = [
    '<option value="">Select an order to view details…</option>',
    ...orders.map(o =>
      `<option value="${o.id}" ${o.id === current ? 'selected' : ''}>#${formatDailyOrderNumber(o)} — ${escapeHtml(o.customer_name)} — ${fmtMoney(o.total_amount)} — ${STATUS_LABEL[o.status] || o.status}</option>`
    ),
  ].join('');
}

async function renderOrderDetail(orderId) {
  const id = orderId || $('order-detail-picker')?.value;
  const order = orders.find(o => o.id === id);
  const content = $('order-detail-content');
  const statusSelect = $('order-detail-status');
  const picker = $('order-detail-picker');

  if (picker && id) picker.value = id;

  if (!order) {
    $('order-detail-title').textContent = 'Order Detail';
    $('order-detail-sub').textContent = orders.length
      ? `${orders.length} orders — pick one to view full details`
      : 'No orders yet';
    content.innerHTML = '<div class="adm-card adm-empty">Choose an order from the dropdown above or open one from Order List</div>';
    hide(statusSelect);
    return;
  }

  selectedOrderId = order.id;
  $('order-detail-title').textContent = `Order #${formatDailyOrderNumber(order)}`;
  $('order-detail-sub').textContent = `Placed ${fmtDate(order.created_at)}`;
  const isTable = order.order_type === 'table' || (order.notes && order.notes.includes('[TABLE:'));
  const DINEIN_STATUS_LABEL = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    preparing: 'Preparing',
    ready: 'Served',
    delivered: 'Completed',
    cancelled: 'Cancelled'
  };
  const labelsToUse = isTable ? DINEIN_STATUS_LABEL : STATUS_LABEL;
  statusSelect.innerHTML = ORDER_STATUSES.map(s =>
    `<option value="${s}" ${s === order.status ? 'selected' : ''}>${labelsToUse[s] || s}</option>`
  ).join('');
  statusSelect.onchange = () => updateOrderStatus(order.id, statusSelect.value);

  const items = getItemsForOrder(order.id);
  const itemsSubtotal = items.reduce((s, i) => s + Number(i.line_total), 0);
  const steps = [
    { label: 'Order Created', done: true, time: order.created_at },
    { label: 'Confirmed', done: ['confirmed', 'preparing', 'ready', 'delivered'].includes(order.status), time: null },
    { label: 'Preparing', done: ['preparing', 'ready', 'delivered'].includes(order.status), time: null },
    { label: 'Ready / Out for delivery', done: ['ready', 'delivered'].includes(order.status), time: null },
    { label: 'Delivered', done: order.status === 'delivered', time: order.status === 'delivered' ? order.updated_at : null },
    { label: 'Cancelled', done: order.status === 'cancelled', time: order.status === 'cancelled' ? order.updated_at : null },
  ].filter(s => s.label !== 'Cancelled' || order.status === 'cancelled');

  const itemsHtml = items.length === 0
    ? '<tr><td colspan="4" class="adm-empty">No line items recorded for this order</td></tr>'
    : items.map(i => `
        <tr style="cursor:default">
          <td>${escapeHtml(i.item_name)}${i.menu_item_id ? `<br><span class="adm-info-muted">Menu ID: ${i.menu_item_id}</span>` : ''}</td>
          <td>${i.quantity}</td>
          <td>${fmtMoney(i.unit_price)}</td>
          <td>${fmtMoney(i.line_total)}</td>
        </tr>
      `).join('');

  const parsedMeta = parseNotesMetadata(order.notes, order);

  let promoMsg = '';
  try {
    const { data: promoList } = await insforge.database
      .from('coupons')
      .select('*')
      .eq('active', true)
      .eq('is_auto_send', true)
      .limit(1);
      
    if (promoList && promoList.length > 0) {
      const promo = promoList[0];
      const expDate = new Date(promo.expiry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      promoMsg = ` Use Coupon code: ${promo.code} to get ${promo.discount_pct}% OFF on your next visit! Valid until ${expDate}.`;
    }
  } catch (err) {
    console.error('Failed to load auto-send promo coupon in admin:', err);
  }

  const digits = order.customer_phone.replace(/\D/g, '');
  const formattedPhone = digits.length === 10 ? '91' : '';
  const whatsappPhone = formattedPhone + digits;
  const statusText = STATUS_LABEL[order.status] || order.status;
  const promoSuffix = promoMsg || '';
  const whatsappMsg = `Hi ${order.customer_name}, your LIMRA order #${order.order_number} has been received! Current status: ${statusText}. We are preparing it with care and will contact you as soon as possible. Thank you for choosing LIMRA!${promoSuffix}`;
  const whatsappLink = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(whatsappMsg)}`;

  const emailSubject = `LIMRA Restaurant - Order #${order.order_number} Confirmation`;
  const emailBody = `Hi ${order.customer_name},\n\nThank you for your order! Your order #${order.order_number} for ${fmtMoney(order.total_amount)} has been successfully booked.\n\nWe will contact you as soon as possible to arrange delivery/pickup.\n\nWarm regards,\nLIMRA Restaurant Team`;
  const emailLink = parsedMeta.email ? `mailto:${parsedMeta.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}` : '#';

  content.innerHTML = `
    <div class="adm-detail-grid">
      <div class="adm-detail-col">
        <div class="adm-card">
          <div class="adm-customer-card">
            <div class="adm-customer-avatar">${initials(order.customer_name)}</div>
            <div>
              <p class="adm-customer-name">${escapeHtml(order.customer_name)}</p>
              <span class="adm-pill confirmed">${parsedMeta.type === 'delivery' ? '🚗 Delivery' : (parsedMeta.type === 'table' ? `🍽️ Table ${parsedMeta.tableNumber}` : '🥡 Pickup')}</span>
              <p class="adm-customer-phone"><a href="tel:${order.customer_phone}">${escapeHtml(order.customer_phone)}</a></p>
              ${parsedMeta.email ? `<span class="adm-email-badge">${escapeHtml(parsedMeta.email)}</span>` : ''}
            </div>
          </div>
        </div>

        <div class="adm-card">
          <h3 class="adm-card-title">Order Information</h3>
          <div class="adm-info-grid">
            <div class="adm-info-item"><label>Order Number</label><p>#${order.order_number}</p></div>
            <div class="adm-info-item"><label>Status</label><p>${statusPill(order.status, parsedMeta.type === 'table')}</p></div>
            <div class="adm-info-item"><label>Total Amount</label><p style="color:var(--adm-green)">${fmtMoney(order.total_amount)}</p></div>
            <div class="adm-info-item"><label>Payment Method</label><p class="font-semibold text-slate-800">${parsedMeta.payment ? parsedMeta.payment.toUpperCase() : (parsedMeta.type === 'table' ? 'Pay at Restaurant' : 'COD')}</p></div>
            <div class="adm-info-item"><label>Payment Status</label><p>${paymentStatusPill(order.payment_status || 'unpaid')}</p></div>
            <div class="adm-info-item"><label>Items Count</label><p>${items.length} item(s) · ${items.reduce((s, i) => s + i.quantity, 0)} qty</p></div>
            <div class="adm-info-item"><label>Placed At</label><p>${fmtDate(order.created_at)}</p></div>
            <div class="adm-info-item"><label>Last Updated</label><p>${fmtDate(order.updated_at)}</p></div>
            <div class="adm-info-item" style="grid-column:1/-1"><label>Order ID</label><p class="adm-info-muted">${order.id}</p></div>
          </div>
          ${parsedMeta.customNote ? `
            <div class="adm-detail-section">
              <p class="adm-detail-section-title">Customer Instructions</p>
              <div class="adm-note-box">${escapeHtml(parsedMeta.customNote)}</div>
            </div>
          ` : ''}
        </div>

        ${parsedMeta.type === 'table' ? `
          <div class="adm-card" style="border: 2px solid var(--adm-green); background: rgba(0, 176, 116, 0.02);">
            <div class="flex items-center justify-between mb-3" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
              <h3 class="adm-card-title" style="margin:0; color:var(--adm-green)">🪑 Dine-in Table Info</h3>
              <span class="adm-pill confirmed">Table ${parsedMeta.tableNumber}</span>
            </div>
            <div class="adm-info-grid">
              <div class="adm-info-item"><label>Table Number</label><p class="text-sm font-bold">Table ${parsedMeta.tableNumber}</p></div>
              <div class="adm-info-item"><label>Zone / Section</label><p class="text-sm font-bold capitalize">${order.table_zone || 'Indoor'}</p></div>
              <div class="adm-info-item"><label>Order Type</label><p class="text-sm font-semibold">Dine-In Self-Order</p></div>
            </div>
          </div>
        ` : ''}

        ${parsedMeta.type === 'delivery' ? `
          <div class="adm-card">
            <div class="flex items-center justify-between mb-3" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
              <h3 class="adm-card-title" style="margin:0;">🚗 Delivery Location & Logistics</h3>
              <span id="detail-verified-badge" class="adm-pill ${order.location_verified ? 'delivered' : 'pending'}">
                ${order.location_verified ? '✓ Pin Verified' : '⚠️ Unverified Pin'}
              </span>
            </div>
            
            <div class="adm-info-grid" style="margin-bottom: 1rem;">
              <div class="adm-info-item" style="grid-column: 1/-1">
                <label>Delivery Address</label>
                <p class="text-sm font-semibold">${escapeHtml(parsedMeta.address || 'Not specified')}</p>
                ${parsedMeta.area ? `<p class="text-xs text-slate-500 mt-1">📍 Selected Area: <strong>${escapeHtml(parsedMeta.area)}</strong></p>` : ''}
              </div>
              <div class="adm-info-item" style="grid-column: 1/-1">
                <label>Landmark</label>
                <p id="detail-landmark">${escapeHtml(order.landmark || '—')}</p>
              </div>
              <div class="adm-info-item" style="grid-column: 1/-1">
                <label>Delivery Notes / Instructions</label>
                <p id="detail-notes" style="font-weight: normal; color: var(--adm-muted); background: #f8faf9; padding: 0.5rem; border-radius: 8px; font-size: 0.825rem; margin-top: 0.25rem;">
                  ${escapeHtml(order.delivery_notes || 'No delivery notes')}
                </p>
              </div>
              <div class="adm-info-item">
                <label>Calculated Distance</label>
                <p id="detail-distance">${escapeHtml(parsedMeta.distance || '—')}</p>
              </div>
              <div class="adm-info-item">
                <label>Delivery Charge</label>
                <p>${escapeHtml(parsedMeta.charge || '—')}</p>
              </div>
              <div class="adm-info-item">
                <label>Travel ETA</label>
                <p id="detail-eta">—</p>
              </div>
              <div class="adm-info-item" style="grid-column: 1/-1">
                <label>Coordinates</label>
                <p id="detail-coords" class="font-mono text-xs select-all" style="font-family: monospace; font-size: 0.75rem; color: var(--adm-muted);">
                  ${order.latitude !== null && order.longitude !== null ? `${order.latitude}, ${order.longitude}` : 'Calculating...'}
                </p>
              </div>
            </div>
            
            <div class="adm-detail-map-card">
              <div class="adm-detail-map-wrap" style="height: 250px;">
                <div id="order-detail-map" class="adm-detail-map"></div>
              </div>
            </div>

            <!-- Logistics Action Row -->
            <div style="margin-top: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem;">
              <a href="#" target="_blank" class="adm-btn adm-btn-primary text-center" id="detail-nav-btn" style="text-decoration: none; text-align: center; display: block; font-weight: 700; width: 100%;">
                🗺️ Start Navigation (Google Maps)
              </a>
              
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem;">
                <button type="button" class="adm-comm-btn whatsapp" id="detail-share-wa-btn">
                  💬 Share WhatsApp
                </button>
                <button type="button" class="adm-comm-btn email" id="detail-share-sms-btn">
                  📱 Send SMS
                </button>
              </div>
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem;">
                <button type="button" class="adm-comm-btn call" id="detail-copy-details-btn" style="background:#eef0f4; color:var(--adm-text);">
                  📋 Copy Address
                </button>
                <button type="button" class="adm-comm-btn call" id="detail-share-sys-btn" style="background:#eef0f4; color:var(--adm-text);">
                  🔗 Share Route
                </button>
              </div>
            </div>
          </div>
        ` : ''}

        <div class="adm-card">
          <h3 class="adm-card-title">Order Timeline</h3>
          <div class="adm-timeline">
            ${steps.map(s => `
              <div class="adm-timeline-item ${s.done ? 'done' : 'pending'}">
                <p class="adm-timeline-label">${s.label}</p>
                ${s.time ? `<p class="adm-timeline-time">${fmtDate(s.time)}</p>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="adm-detail-col">
        <div class="adm-card adm-table-wrap">
          <div class="adm-card-head">
            <h3 class="adm-card-title">Items Ordered (${items.length})</h3>
          </div>
          <table class="adm-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Line Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
              <tr style="cursor:default;background:#f8faf9">
                <td colspan="3" class="adm-table-total-label">Items Subtotal</td>
                <td><strong>${fmtMoney(itemsSubtotal)}</strong></td>
              </tr>
              <tr style="cursor:default;background:#e6f7f1">
                <td colspan="3" class="adm-table-total-label">Grand Total</td>
                <td><strong class="adm-grand-total">${fmtMoney(order.total_amount)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="adm-card">
          <h3 class="adm-card-title">Quick Actions</h3>
          <div class="adm-action-row" style="flex-wrap:wrap;gap:.45rem;">
            <!-- 🧾 1-Click Load into POS Billing -->
            <button type="button" class="adm-btn adm-btn-primary adm-btn-sm btn-detail-create-pos-bill" style="background:#6366f1;border-color:#6366f1;font-weight:700;display:inline-flex;align-items:center;gap:.35rem;">
              <span>🧾</span> Load &amp; Create POS Bill
            </button>
            ${parsedMeta.type === 'table' ? `
              ${(order.payment_status || 'unpaid') === 'unpaid' 
                ? `<button type="button" class="adm-btn adm-btn-success adm-btn-sm mark-paid-btn">💵 Mark As Paid</button>` 
                : `<button type="button" class="adm-btn adm-btn-outline adm-btn-sm mark-unpaid-btn" style="border-color:#ff5b5b; color:#ff5b5b; padding:0.4rem 0.8rem; font-weight:600; cursor:pointer;">↩ Mark Unpaid</button>`
              }
            ` : `
              ${order.status === 'pending' ? `<button type="button" class="adm-btn adm-btn-primary adm-btn-sm accept-order">✓ Accept Order</button>` : ''}
              ${order.status === 'confirmed' ? `<button type="button" class="adm-btn adm-btn-primary adm-btn-sm prep-order">👨‍🍳 Start Preparing</button>` : ''}
              ${order.status === 'preparing' ? `<button type="button" class="adm-btn adm-btn-primary adm-btn-sm ready-order">✓ Mark Ready</button>` : ''}
              ${order.status === 'ready' ? `<button type="button" class="adm-btn adm-btn-primary adm-btn-sm deliver-order">✓ Mark Delivered</button>` : ''}
              ${order.status !== 'cancelled' && order.status !== 'delivered' ? `<button type="button" class="adm-btn adm-btn-danger adm-btn-sm cancel-order">✕ Cancel</button>` : ''}
              ${(order.payment_status || 'unpaid') === 'unpaid' ? `<button type="button" class="adm-btn adm-btn-success adm-btn-sm mark-paid-btn">💵 Mark As Paid</button>` : ''}
            `}
          </div>

          <h3 class="adm-card-title" style="margin-top: 1.5rem; margin-bottom: 0.75rem;">Customer Shortcuts</h3>
          <div class="adm-comm-grid">
            <a href="${whatsappLink}" target="_blank" class="adm-comm-btn whatsapp">
              💬 WhatsApp
            </a>
            <a href="${parsedMeta.email ? emailLink : '#'}" class="adm-comm-btn email ${!parsedMeta.email ? 'adm-comm-disabled' : ''}" id="comm-email-btn">
              ✉️ Email
            </a>
            <a href="tel:${order.customer_phone}" class="adm-comm-btn call">
              📞 Call
            </a>
          </div>
        </div>

        <div class="adm-card mt-6">
          <h3 class="adm-card-title">💳 Payment Audit Log</h3>
          <div id="detail-payment-history-container">
            <div class="adm-spinner adm-spinner-sm" style="margin: 1rem auto;" aria-hidden="true"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  content.querySelector('.btn-detail-create-pos-bill')?.addEventListener('click', () => createBillForOrder(order.id));
  content.querySelector('.accept-order')?.addEventListener('click', () => updateOrderStatus(order.id, 'confirmed'));
  content.querySelector('.prep-order')?.addEventListener('click', () => updateOrderStatus(order.id, 'preparing'));
  content.querySelector('.ready-order')?.addEventListener('click', () => updateOrderStatus(order.id, 'ready'));
  content.querySelector('.deliver-order')?.addEventListener('click', () => updateOrderStatus(order.id, 'delivered'));
  content.querySelector('.cancel-order')?.addEventListener('click', () => {
    if (confirm('Cancel this order?')) updateOrderStatus(order.id, 'cancelled');
  });
  content.querySelector('.mark-paid-btn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to mark this order as paid?')) {
      updateOrderPaymentStatus(order.id, 'paid');
    }
  });
  content.querySelector('.mark-unpaid-btn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to mark this order as unpaid?')) {
      updateOrderPaymentStatus(order.id, 'unpaid');
    }
  });

  content.querySelector('#comm-email-btn')?.addEventListener('click', (e) => {
    if (!parsedMeta.email) {
      e.preventDefault();
      alert('No email address provided by this customer.');
    }
  });

  // Load payment history asynchronously
  loadAndRenderPaymentHistory(order.id);

  // Map cleanup and initialization
  if (window.orderDetailMap) {
    try {
      window.orderDetailMap.remove();
    } catch (e) {
      console.warn('Error removing map:', e);
    }
    window.orderDetailMap = null;
  }

  if (parsedMeta.type === 'delivery') {
    const mapContainer = document.getElementById('order-detail-map');
    if (mapContainer) {
      try {
        const limraCoords = [21.8603074, 87.4793798];
        const map = L.map('order-detail-map', {
          zoomControl: true,
          scrollWheelZoom: false
        }).setView(limraCoords, 14);
        window.orderDetailMap = map;
        
        const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri'
        });

        L.control.layers({
          "Street Map": streetLayer,
          "Satellite": satelliteLayer
        }, null, { position: 'topright' }).addTo(map);
        
        // Add restaurant marker (Gold)
        const restaurantIcon = L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        });
        L.marker(limraCoords, { icon: restaurantIcon }).addTo(map).bindPopup('<b>LIMRA Restaurant</b>');

        // Resolve coordinates
        const dbLat = order.latitude !== null ? parseFloat(order.latitude) : null;
        const dbLng = order.longitude !== null ? parseFloat(order.longitude) : null;

        const setupMapAndLogistics = (latVal, lngVal, isGeo = false) => {
          if (window.orderDetailMap !== map) return;

          const clientCoords = [latVal, lngVal];
          const clientIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          });

          const clientMarker = L.marker(clientCoords, { icon: clientIcon }).addTo(map);
          clientMarker.bindPopup(`<b>Delivery Location</b><br>${escapeHtml(parsedMeta.address)}`).openPopup();

          L.polyline([limraCoords, clientCoords], {
            color: '#00b074',
            dashArray: '5, 10',
            weight: 3,
            opacity: 0.8
          }).addTo(map);

          const bounds = L.latLngBounds([limraCoords, clientCoords]);
          map.fitBounds(bounds, { padding: [40, 40] });

          // Calculate logistics distance and ETA
          const dist = getHaversineDistance(limraCoords[0], limraCoords[1], latVal, lngVal);
          const eta = Math.ceil(dist * 2); // 30 km/h is 2 mins/km
          const etaText = dist < 0.5 ? 'Under 2 mins' : `${eta} mins`;

          // Update UI elements
          const distEl = document.getElementById('detail-distance');
          const etaEl = document.getElementById('detail-eta');
          const coordsEl = document.getElementById('detail-coords');
          const navBtn = document.getElementById('detail-nav-btn');

          if (distEl) distEl.textContent = `${dist.toFixed(2)} km`;
          if (etaEl) etaEl.textContent = etaText;
          if (coordsEl) coordsEl.textContent = `${latVal.toFixed(6)}, ${lngVal.toFixed(6)}`;
          if (navBtn) {
            navBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${latVal},${lngVal}`;
          }

          // Dynamic sharing text bindings
          const shareMsg = `*LIMRA Delivery Route Details*\n` +
            `*Order*: #${order.order_number}\n` +
            `*Customer*: ${order.customer_name}\n` +
            `*Phone*: ${order.customer_phone}\n` +
            `*Address*: ${parsedMeta.address}\n` +
            `*Landmark*: ${order.landmark || 'N/A'}\n` +
            `*Notes*: ${order.delivery_notes || 'None'}\n` +
            `*Location link*: https://maps.google.com/?q=${latVal},${lngVal}`;

          const shareSms = `LIMRA Order #${order.order_number} Delivery: ${parsedMeta.address}. Landmark: ${order.landmark || 'N/A'}. Location: https://maps.google.com/?q=${latVal},${lngVal}`;

          document.getElementById('detail-share-wa-btn')?.addEventListener('click', () => {
            window.open(`https://wa.me/?text=${encodeURIComponent(shareMsg)}`, '_blank');
          });

          document.getElementById('detail-share-sms-btn')?.addEventListener('click', () => {
            window.open(`sms:?body=${encodeURIComponent(shareSms)}`, '_blank');
          });

          document.getElementById('detail-copy-details-btn')?.addEventListener('click', () => {
            navigator.clipboard.writeText(shareMsg).then(() => {
              alert('Delivery address details copied to clipboard!');
            });
          });

          document.getElementById('detail-share-sys-btn')?.addEventListener('click', () => {
            if (navigator.share) {
              navigator.share({
                title: `LIMRA Delivery Route Details #${order.order_number}`,
                text: `Customer: ${order.customer_name}\nPhone: ${order.customer_phone}\nAddress: ${parsedMeta.address}`,
                url: `https://maps.google.com/?q=${latVal},${lngVal}`
              }).catch(e => console.warn('Share aborted:', e));
            } else {
              alert('Web Share API not supported on this device/browser.');
            }
          });
        };

        if (dbLat !== null && dbLng !== null) {
          setupMapAndLogistics(dbLat, dbLng);
        } else {
          // Fallback geocoding via Nominatim
          const addrStr = parsedMeta.address;
          if (addrStr) {
            fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(addrStr)}`)
              .then(res => res.json())
              .then(data => {
                if (data && data.length > 0 && window.orderDetailMap === map) {
                  const lat = parseFloat(data[0].lat);
                  const lon = parseFloat(data[0].lon);
                  setupMapAndLogistics(lat, lon, true);
                } else {
                  console.warn('Nominatim returned no coordinates in admin detail fallback');
                  map.setView(limraCoords, 14);
                  document.getElementById('detail-coords').textContent = 'Coordinates not found';
                }
              })
              .catch(err => {
                console.warn('Nominatim geocode failed in admin detail fallback:', err);
                map.setView(limraCoords, 14);
              });
          } else {
            map.setView(limraCoords, 14);
          }
        }
      } catch (err) {
        console.warn('Map initialization failed in admin detail:', err);
      }
    }
  }
}

// ════════════════════════════════════════════════════════
// 👥 REGULAR CUSTOMERS & LOYALTY HUB
// ════════════════════════════════════════════════════════

let customerTierFilter = 'all';
let customerActivityFilter = 'all';
let customerSort = 'spend_desc';

function computeCustomerHubData() {
  const allCustomers = buildCustomerStats();
  const now = new Date().getTime();

  // KPI calculations across full database
  const totalGuests = allCustomers.length;
  const vipCount = allCustomers.filter(c => c.tier === 'vip').length;
  const totalLTV = allCustomers.reduce((s, c) => s + (c.totalSpent || 0), 0);
  const repeatGuests = allCustomers.filter(c => (c.orderCount + c.bookingCount) >= 2).length;
  const repeatRate = totalGuests > 0 ? ((repeatGuests / totalGuests) * 100).toFixed(1) : '0';

  let list = allCustomers.slice();

  // 1. Tier Filter
  if (customerTierFilter !== 'all') {
    list = list.filter(c => c.tier === customerTierFilter);
  }

  // 2. Activity Filter
  if (customerActivityFilter === 'month') {
    const monthAgo = now - (30 * 86400000);
    list = list.filter(c => c.lastActivity && new Date(c.lastActivity).getTime() >= monthAgo);
  } else if (customerActivityFilter === 'week') {
    const weekAgo = now - (7 * 86400000);
    list = list.filter(c => c.lastActivity && new Date(c.lastActivity).getTime() >= weekAgo);
  } else if (customerActivityFilter === 'inactive') {
    const monthAgo = now - (30 * 86400000);
    list = list.filter(c => !c.lastActivity || new Date(c.lastActivity).getTime() < monthAgo);
  }

  // 3. Search Query
  const search = ($('customers-search')?.value || '').toLowerCase().trim();
  if (search) {
    list = list.filter(c =>
      (c.name && c.name.toLowerCase().includes(search)) ||
      (c.phone && c.phone.includes(search))
    );
  }

  // 4. Sorting
  if (customerSort === 'spend_desc') {
    list.sort((a, b) => b.totalSpent - a.totalSpent);
  } else if (customerSort === 'visits_desc') {
    list.sort((a, b) => (b.orderCount + b.bookingCount) - (a.orderCount + a.bookingCount));
  } else if (customerSort === 'recent_desc') {
    list.sort((a, b) => {
      const aDate = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
      const bDate = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
      return bDate - aDate;
    });
  } else if (customerSort === 'name_asc') {
    list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  return {
    list,
    totalGuests,
    vipCount,
    totalLTV,
    repeatRate
  };
}

function renderCustomers() {
  const {
    list,
    totalGuests,
    vipCount,
    totalLTV,
    repeatRate
  } = computeCustomerHubData();

  // 1. Update KPI Cards
  if ($('cust-kpi-total-guests')) $('cust-kpi-total-guests').textContent = `${totalGuests}`;
  if ($('cust-kpi-vip-count')) $('cust-kpi-vip-count').textContent = `${vipCount}`;
  if ($('cust-kpi-total-ltv')) $('cust-kpi-total-ltv').textContent = `₹${totalLTV.toFixed(2)}`;
  if ($('cust-kpi-repeat-rate')) $('cust-kpi-repeat-rate').textContent = `${repeatRate}%`;

  // 2. Update Summary Bar
  const filteredSpend = list.reduce((s, c) => s + (c.totalSpent || 0), 0);
  if ($('customers-count-label')) $('customers-count-label').textContent = `${list.length} ${list.length === 1 ? 'guest' : 'guests'}`;
  if ($('customers-total-spend-label')) $('customers-total-spend-label').textContent = `₹${filteredSpend.toFixed(2)}`;

  // 3. Render Customer Cards Grid
  const el = $('customers-list');
  if (!el) return;

  if (list.length === 0) {
    el.innerHTML = '<div class="adm-card adm-empty" style="grid-column: 1 / -1;padding:2.5rem;text-align:center;">No customers match your selected tier or search filters.</div>';
    return;
  }

  el.innerHTML = list.map(c => {
    const topItems = Object.entries(c.items).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const tierBadge = c.tier === 'vip'
      ? '<span style="background:#fef3c7;color:#b45309;font-size:.72rem;font-weight:800;padding:.15rem .5rem;border-radius:999px;border:1px solid #fde68a;">👑 VIP PATRON</span>'
      : (c.tier === 'frequent' ? '<span style="background:#e0e7ff;color:#4338ca;font-size:.72rem;font-weight:700;padding:.15rem .5rem;border-radius:999px;border:1px solid #c7d2fe;">🥈 FREQUENT GUEST</span>' : '<span style="background:#f0fdf4;color:#166534;font-size:.72rem;font-weight:600;padding:.15rem .5rem;border-radius:999px;border:1px solid #bbf7d0;">🌱 NEW GUEST</span>');

    const totalVisits = c.orderCount + c.bookingCount;
    const cleanPhone = (c.phone || '').replace(/\D/g, '');
    const waLink = cleanPhone ? `https://wa.me/91${cleanPhone.slice(-10)}` : '#';

    return `
      <div class="adm-card" style="display:flex;flex-direction:column;gap:.75rem;padding:1.15rem;border-radius:14px;border:1px solid var(--adm-border);background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.03);">
        
        <!-- Header: Avatar, Name, Tier -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem;">
          <div style="display:flex;align-items:center;gap:.75rem;">
            <div class="adm-customer-avatar" style="width:42px;height:42px;font-size:1.1rem;background:#eef2ff;color:#4f46e5;font-weight:800;">
              ${initials(c.name)}
            </div>
            <div>
              <div style="font-weight:800;color:#111827;font-size:.92rem;">${escapeHtml(c.name)}</div>
              <a href="tel:${c.phone}" style="font-size:.78rem;color:#6366f1;text-decoration:none;font-weight:600;">📱 ${escapeHtml(c.phone)}</a>
            </div>
          </div>
          <div>${tierBadge}</div>
        </div>

        <!-- Metrics Row -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;background:#f8fafc;padding:.6rem .8rem;border-radius:10px;border:1px solid #f1f5f9;font-size:.8rem;">
          <div>
            <span style="color:var(--adm-muted);display:block;font-size:.7rem;">Lifetime Spend</span>
            <strong style="color:#059669;font-size:.92rem;">₹${Number(c.totalSpent || 0).toFixed(2)}</strong>
          </div>
          <div>
            <span style="color:var(--adm-muted);display:block;font-size:.7rem;">Total Visits</span>
            <strong style="color:#111827;font-size:.92rem;">${totalVisits} visits</strong> (${c.orderCount} ord)
          </div>
        </div>

        <!-- Favorite Dishes Chips -->
        ${topItems.length > 0 ? `
          <div style="font-size:.75rem;">
            <span style="color:var(--adm-muted);font-weight:600;display:block;margin-bottom:3px;">Favorite Dishes:</span>
            <div style="display:flex;gap:.3rem;flex-wrap:wrap;">
              ${topItems.map(([name, qty]) => `
                <span style="background:#f1f5f9;color:#334155;padding:.15rem .45rem;border-radius:6px;font-size:.72rem;font-weight:500;">
                  ${escapeHtml(name)} <strong style="color:#6366f1;">(${qty})</strong>
                </span>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Footer / Time & Actions -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:auto;padding-top:.5rem;border-top:1px solid var(--adm-border);font-size:.75rem;">
          <span style="color:var(--adm-muted);">
            ⏱️ ${c.lastActivity ? timeSince(c.lastActivity) : 'No activity'}
          </span>
          <div style="display:flex;gap:.35rem;align-items:center;">
            <button type="button" class="adm-btn adm-btn-outline adm-btn-sm cust-history-btn" data-phone="${c.phone}" style="font-size:.72rem;padding:.2rem .5rem;" title="View complete order history">
              👁️ History
            </button>
            ${cleanPhone ? `
              <a href="${waLink}" target="_blank" class="adm-btn adm-btn-outline adm-btn-sm" style="font-size:.72rem;padding:.2rem .45rem;color:#16a34a;border-color:#bbf7d0;" title="Send WhatsApp message">
                💬 WA
              </a>
              <a href="tel:${c.phone}" class="adm-btn adm-btn-outline adm-btn-sm" style="font-size:.72rem;padding:.2rem .45rem;color:#4f46e5;border-color:#c7d2fe;" title="Call customer">
                📞
              </a>
            ` : ''}
          </div>
        </div>

      </div>
    `;
  }).join('');

  // Wire history button clicks
  el.querySelectorAll('.cust-history-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      openCustomerHistoryModal(btn.dataset.phone);
    });
  });
}

function openCustomerHistoryModal(phone) {
  const allCustomers = buildCustomerStats();
  const c = allCustomers.find(x => x.phone === phone);
  if (!c) {
    showAdminToast('Customer profile not found.', 'error');
    return;
  }

  // Header & Avatar
  if ($('cust-modal-avatar')) $('cust-modal-avatar').textContent = initials(c.name);
  if ($('cust-modal-title-name')) $('cust-modal-title-name').textContent = c.name;
  if ($('cust-modal-phone-link')) {
    $('cust-modal-phone-link').textContent = c.phone;
    $('cust-modal-phone-link').href = `tel:${c.phone}`;
  }
  if ($('cust-modal-lifetime-spend')) $('cust-modal-lifetime-spend').textContent = `₹${Number(c.totalSpent || 0).toFixed(2)}`;
  if ($('cust-modal-total-visits')) $('cust-modal-total-visits').textContent = `${c.orderCount + c.bookingCount}`;

  // Tier Badge
  const tierBadge = $('cust-modal-tier-badge');
  if (tierBadge) {
    if (c.tier === 'vip') {
      tierBadge.textContent = '👑 VIP Patron';
      tierBadge.style.background = '#fef3c7';
      tierBadge.style.color = '#b45309';
    } else if (c.tier === 'frequent') {
      tierBadge.textContent = '🥈 Frequent Guest';
      tierBadge.style.background = '#e0e7ff';
      tierBadge.style.color = '#4338ca';
    } else {
      tierBadge.textContent = '🌱 New Guest';
      tierBadge.style.background = '#f0fdf4';
      tierBadge.style.color = '#166534';
    }
  }

  // Favorite Items
  const favWrap = $('cust-modal-fav-items');
  if (favWrap) {
    const topItems = Object.entries(c.items).sort((a, b) => b[1] - a[1]);
    if (topItems.length === 0) {
      favWrap.innerHTML = '<span style="color:var(--adm-muted);font-size:.8rem;">No dishes recorded yet.</span>';
    } else {
      favWrap.innerHTML = topItems.map(([name, qty]) => `
        <span style="background:#eef2ff;color:#3730a3;padding:.2rem .6rem;border-radius:6px;font-size:.78rem;font-weight:600;">
          ${escapeHtml(name)} <strong style="color:#6366f1;">(${qty} ordered)</strong>
        </span>
      `).join('');
    }
  }

  // Orders Ledger Table
  const tbody = $('cust-modal-orders-tbody');
  if (tbody) {
    if (!c.ordersHistory || c.ordersHistory.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--adm-muted);">No order transactions found for this customer.</td></tr>';
    } else {
      tbody.innerHTML = c.ordersHistory.map(o => {
        const items = getItemsForOrder(o.id);
        const parsed = parseNotesMetadata(o.notes, o);
        const tableNum = parsed.tableNumber || o.table_number || '';
        const typeStr = parsed.type === 'table' ? `🪑 Table ${tableNum || '—'}` : (parsed.type === 'delivery' ? '🚗 Delivery' : '🥡 Pickup');
        const itemsSummary = items.length
          ? items.map(i => `${i.quantity}× ${escapeHtml(i.item_name)}`).join(', ')
          : '—';
        const d = new Date(o.created_at);
        const dateStr = d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) + ', ' + d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
        const payStr = o.payment_status === 'paid' ? `<span style="color:#166534;font-weight:700;">Paid (${parsed.paymentMode || o.payment_mode || 'Cash'})</span>` : '<span style="color:#dc2626;">Unpaid</span>';

        return `
          <tr>
            <td><strong>#${o.order_number || o.id.slice(0, 8)}</strong></td>
            <td style="font-size:.8rem;color:var(--adm-muted);">${dateStr}</td>
            <td><span style="font-weight:600;font-size:.8rem;">${typeStr}</span></td>
            <td style="font-size:.8rem;max-width:260px;">${itemsSummary}</td>
            <td style="font-size:.78rem;">${payStr}</td>
            <td style="text-align:right;"><strong style="color:#059669;">₹${Number(o.total_amount || 0).toFixed(2)}</strong></td>
          </tr>
        `;
      }).join('');
    }
  }

  // Show Modal
  const modal = $('adm-customer-history-modal');
  if (modal) modal.style.display = 'flex';
}

function closeCustomerHistoryModal() {
  const modal = $('adm-customer-history-modal');
  if (modal) modal.style.display = 'none';
}

function exportCustomersCSV() {
  const { list } = computeCustomerHubData();
  if (!list.length) {
    showAdminToast('No customer records to export.', 'error');
    return;
  }

  const headers = ['Customer Name', 'Phone Number', 'Email', 'Loyalty Tier', 'Total Visits', 'Orders Count', 'Bookings Count', 'Total Lifetime Spend (INR)', 'Favorite Dishes', 'Last Activity Date'];
  const rows = list.map(c => {
    const topDishes = Object.entries(c.items).sort((a, b) => b[1] - a[1]).map(([n, q]) => `${n} (${q}x)`).join('; ');
    return [
      `"${(c.name || 'Customer').replace(/"/g, '""')}"`,
      `"${c.phone || ''}"`,
      `"${c.email || ''}"`,
      `"${c.tier.toUpperCase()}"`,
      `"${c.orderCount + c.bookingCount}"`,
      `"${c.orderCount}"`,
      `"${c.bookingCount}"`,
      `"${Number(c.totalSpent || 0).toFixed(2)}"`,
      `"${topDishes.replace(/"/g, '""')}"`,
      `"${c.lastActivity ? new Date(c.lastActivity).toLocaleString('en-IN') : ''}"`
    ];
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 10);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `LIMRA_Customers_Loyalty_Report_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showAdminToast('Customer loyalty report exported to CSV! 📥', 'success');
}

function initCustomersListeners() {
  // Tier pill buttons
  $('customers-tier-presets')?.querySelectorAll('.pos-cat-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      $('customers-tier-presets').querySelectorAll('.pos-cat-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      customerTierFilter = btn.dataset.tier;
      renderCustomers();
    });
  });

  // Dropdowns & Search
  $('customers-activity-filter')?.addEventListener('change', (e) => {
    customerActivityFilter = e.target.value;
    renderCustomers();
  });

  $('customers-sort-filter')?.addEventListener('change', (e) => {
    customerSort = e.target.value;
    renderCustomers();
  });

  $('customers-search')?.addEventListener('input', () => {
    renderCustomers();
  });

  $('customers-export-btn')?.addEventListener('click', exportCustomersCSV);

  // Modal close handlers
  $('cust-modal-close-btn')?.addEventListener('click', closeCustomerHistoryModal);
  $('adm-customer-history-modal')?.addEventListener('click', (e) => {
    if (e.target === $('adm-customer-history-modal')) closeCustomerHistoryModal();
  });
}

// ── Customer Analysis ────────────────────────────────────

// ── Hold Orders ──────────────────────────────────────────

function getHeldOrders() {
  return orders
    .filter(o => o.status === 'hold')
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); // oldest first
}

function timeSince(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function renderHoldOrdersPanel() {
  const held = getHeldOrders();
  const search = ($('hold-orders-search')?.value || '').toLowerCase().trim();

  const filtered = search
    ? held.filter(o =>
        (o.customer_name && o.customer_name.toLowerCase().includes(search)) ||
        (o.customer_phone && o.customer_phone.includes(search)) ||
        String(o.order_number).includes(search) ||
        String(o.table_number || '').includes(search)
      )
    : held;

  const totalValue = held.reduce((s, o) => s + Number(o.total_amount || 0), 0);
  $('hold-stat-count').textContent = held.length;
  $('hold-stat-value').textContent = fmtMoney(totalValue);
  $('hold-stat-oldest').textContent = held.length ? timeSince(held[0].created_at) : '—';

  const container = $('hold-orders-container');
  if (!container) return;

  if (filtered.length === 0) {
    container.innerHTML = `<div class="adm-card adm-empty">${held.length === 0 ? 'No orders on hold right now' : 'No held orders match your search'}</div>`;
    return;
  }

  container.innerHTML = filtered.map(order => {
    const items = getItemsForOrder(order.id);
    const parsedMeta = parseNotesMetadata(order.notes, order);
    const tableNum = parsedMeta.tableNumber || order.table_number || '';
    const typeLabel = parsedMeta.type === 'table'
      ? `🪑 Table ${tableNum || '—'}`
      : (parsedMeta.type === 'delivery' ? '🚗 Delivery' : '🥡 Pickup');

    const itemsHtml = items.map(i => `<li style="display:flex;justify-content:space-between;padding:2px 0;"><span>${i.quantity}× ${escapeHtml(i.item_name)}</span><span style="color:var(--adm-muted);font-size:.8rem;font-weight:600;">₹${Number(i.line_total).toFixed(2)}</span></li>`).join('');

    const cgstRate = parseFloat(localStorage.getItem('qz-bill-cgst-rate') || '2.5');
    const sgstRate = parseFloat(localStorage.getItem('qz-bill-sgst-rate') || '2.5');
    const subtotal = items.reduce((s, i) => s + Number(i.line_total), 0);
    const cgst = subtotal * cgstRate / 100;
    const sgst = subtotal * sgstRate / 100;

    return `
      <div class="adm-hold-card" data-order-id="${order.id}">
        <div class="adm-hold-card-head">
          <div style="flex:1;">
            <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;">
              <p class="adm-hold-card-title">#${formatDailyOrderNumber(order)} · ${escapeHtml(order.customer_name || 'Walk-in')}</p>
              ${tableNum ? `<span style="background:#eef2ff;color:#6366f1;font-size:.7rem;font-weight:700;padding:.15rem .55rem;border-radius:999px;">Table ${tableNum}</span>` : ''}
            </div>
            <div style="font-size:.75rem;color:var(--adm-muted);margin-top:2px;">${escapeHtml(order.customer_phone || '—')}</div>
            <span class="adm-pill" style="background:#fff3e6;color:#f2994a;margin-top:.25rem;display:inline-block;">${typeLabel}</span>
          </div>
          <span class="adm-hold-time">⏱ ${timeSince(order.created_at)}</span>
        </div>

        <ul class="adm-hold-items" style="list-style:none;padding:0;margin:.5rem 0;max-height:160px;overflow-y:auto;">${itemsHtml}</ul>

        <!-- Tax summary -->
        <div style="border-top:1px dashed var(--adm-border);padding-top:.5rem;margin-top:.25rem;font-size:.78rem;color:var(--adm-muted);">
          <div style="display:flex;justify-content:space-between;"><span>Subtotal</span><span>₹${subtotal.toFixed(2)}</span></div>
          <div style="display:flex;justify-content:space-between;"><span>CGST ${cgstRate}% + SGST ${sgstRate}%</span><span>₹${(cgst + sgst).toFixed(2)}</span></div>
          <div style="display:flex;justify-content:space-between;font-weight:800;color:var(--adm-text);margin-top:.25rem;font-size:.85rem;"><span>Current Total</span><span style="color:#6366f1;">₹${Number(order.total_amount).toFixed(2)}</span></div>
        </div>

        <div class="adm-hold-card-footer" style="margin-top:.75rem;">
          <strong class="adm-hold-amount">₹${Number(order.total_amount).toFixed(2)}</strong>
          <div class="adm-hold-actions" style="flex-wrap:wrap;gap:.4rem;">
            <button type="button" class="adm-btn adm-btn-outline adm-btn-sm hold-add-items-btn" data-order-id="${order.id}" style="background:#eef2ff;color:#4f46e5;border-color:#c7d2fe;font-weight:700;">✏️ Add Items</button>
            <button type="button" class="adm-btn adm-btn-outline adm-btn-sm hold-print-kot-btn" data-order-id="${order.id}" style="background:#fff3e0;border-color:#f59e0b;color:#b45309;">🖨️ Repr. KOT</button>
            <button type="button" class="adm-btn adm-btn-primary adm-btn-sm hold-final-bill-btn" data-order-id="${order.id}" style="background:#10b981;border-color:#10b981;font-weight:700;">🧾 Final Bill</button>
            <button type="button" class="adm-btn adm-btn-outline adm-btn-sm hold-cancel-btn" data-order-id="${order.id}" style="border-color:#ff5b5b;color:#ff5b5b;">✕ Cancel</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Wire up all buttons
  container.querySelectorAll('.hold-add-items-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      openHoldAddItemsModal(btn.dataset.orderId);
    });
  });

  container.querySelectorAll('.hold-print-kot-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const order = orders.find(o => o.id === btn.dataset.orderId);
      if (!order) return;
      const items = getItemsForOrder(order.id);
      await printKOT(order, items);
    });
  });

  container.querySelectorAll('.hold-final-bill-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const orderId = btn.dataset.orderId;
      const order = orders.find(o => o.id === orderId);
      if (!order) return;
      if (!confirm(`Print final bill for Order #${order.order_number} and mark as completed / closed?`)) return;
      await printOrderReceiptWithTax(order);
      try {
        const { error } = await insforge.database.from('orders').update({ status: 'delivered', payment_status: 'paid' }).eq('id', orderId);
        if (error) throw error;
        const o = orders.find(x => x.id === orderId);
        if (o) { o.status = 'delivered'; o.payment_status = 'paid'; }
        showAdminToast(`Order #${order.order_number} billed, settled & closed! ✅`, 'success');
        renderOverview();
        renderHoldOrdersPanel();
        renderClosedOrdersPanel();
        renderBillingQuickCards();
        renderBillingTotalBills();
      } catch(err) { showAdminToast('Failed to update order: ' + err.message, 'error'); }
    });
  });

  container.querySelectorAll('.hold-cancel-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Cancel this held order? This cannot be undone.')) return;
      const orderId = btn.dataset.orderId;
      try {
        const { error } = await insforge.database.from('orders').update({ status: 'cancelled' }).eq('id', orderId);
        if (error) throw error;
        const o = orders.find(x => x.id === orderId);
        if (o) o.status = 'cancelled';
        showAdminToast('Held order cancelled.', 'success');
        renderOverview();
        renderHoldOrdersPanel();
        renderBillingQuickCards();
        renderBillingTotalBills();
      } catch (err) {
        showAdminToast('Failed to cancel: ' + err.message, 'error');
      }
    });
  });
}

async function loadHoldOrderToPos(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (!order) {
    showAdminToast('Held order not found.', 'error');
    return;
  }
  const items = getItemsForOrder(orderId);

  try {
    window.dispatchEvent(new CustomEvent('limra:resume-hold-order', {
      detail: { order, items }
    }));
    showAdminToast(`Order #${order.order_number} sent to POS.`, 'success');
  } catch (err) {
    showAdminToast('Failed to resume order: ' + err.message, 'error');
  }
}

function renderPosHoldOrdersChips(containerEl) {
  if (!containerEl) return;
  const held = getHeldOrders();

  if (held.length === 0) {
    containerEl.innerHTML = '';
    return;
  }

  containerEl.innerHTML = held.map(o => `
    <button type="button" class="adm-hold-chip" data-order-id="${o.id}">
      🕒 #${o.order_number} <span class="adm-hold-chip-time">${timeSince(o.created_at)}</span>
    </button>
  `).join('');

  containerEl.querySelectorAll('.adm-hold-chip').forEach(chip => {
    chip.addEventListener('click', () => loadHoldOrderToPos(chip.dataset.orderId));
  });
}

// ════════════════════════════════════════════════════════
// 📊 ITEMS REPORT & SALES PERFORMANCE ENGINE
// ════════════════════════════════════════════════════════

let itemReportDateFilter = 'all';
let itemReportCustomStart = null;
let itemReportCustomEnd = null;
let itemReportCategoryFilter = 'all';
let itemReportTypeFilter = 'all';
let itemReportSort = 'revenue_desc';
let itemReportSearch = '';
let itemTopSellersChartInstance = null;
let itemCategorySplitChartInstance = null;

function computeItemSalesReport() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  let eligibleOrders = orders.filter(o => o.status !== 'cancelled');

  if (itemReportDateFilter === 'today') {
    eligibleOrders = eligibleOrders.filter(o => new Date(o.created_at).getTime() >= todayStart);
  } else if (itemReportDateFilter === 'yesterday') {
    const yestStart = todayStart - 86400000;
    eligibleOrders = eligibleOrders.filter(o => {
      const t = new Date(o.created_at).getTime();
      return t >= yestStart && t < todayStart;
    });
  } else if (itemReportDateFilter === 'week') {
    const weekStart = todayStart - (6 * 86400000);
    eligibleOrders = eligibleOrders.filter(o => new Date(o.created_at).getTime() >= weekStart);
  } else if (itemReportDateFilter === 'month') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    eligibleOrders = eligibleOrders.filter(o => new Date(o.created_at).getTime() >= monthStart);
  } else if (itemReportDateFilter === 'custom' && itemReportCustomStart) {
    const cStart = new Date(itemReportCustomStart).getTime();
    const cEnd = itemReportCustomEnd ? (new Date(itemReportCustomEnd).getTime() + 86400000) : (cStart + 86400000);
    eligibleOrders = eligibleOrders.filter(o => {
      const t = new Date(o.created_at).getTime();
      return t >= cStart && t < cEnd;
    });
  }

  // Filter by Order Type
  if (itemReportTypeFilter !== 'all') {
    eligibleOrders = eligibleOrders.filter(o => {
      const parsed = parseNotesMetadata(o.notes, o);
      return parsed.type === itemReportTypeFilter || o.order_type === itemReportTypeFilter;
    });
  }

  const eligibleOrderIds = new Set(eligibleOrders.map(o => String(o.id)));

  // Map of items
  const itemMap = new Map();

  // Initialize with menu items catalog
  menuItems.forEach(m => {
    itemMap.set(m.name.toLowerCase().trim(), {
      id: m.id,
      name: m.name,
      category: m.category || 'other',
      price: Number(m.price || 0),
      image: m.image || categoryImages[m.category] || '/images/food_starters.png',
      qtySold: 0,
      totalRevenue: 0,
      orderCount: 0
    });
  });

  // Aggregate items from eligible orders
  orderItems.forEach(oi => {
    if (!eligibleOrderIds.has(String(oi.order_id))) return;
    const key = (oi.item_name || '').toLowerCase().trim();
    if (!key) return;

    let entry = itemMap.get(key);
    if (!entry) {
      const foundMenu = menuItems.find(m => m.name.toLowerCase().includes(key) || key.includes(m.name.toLowerCase()));
      const category = foundMenu ? foundMenu.category : 'other';
      const image = foundMenu ? (foundMenu.image || categoryImages[category]) : '/images/food_starters.png';
      entry = {
        id: oi.menu_item_id || null,
        name: oi.item_name,
        category,
        price: Number(oi.unit_price || 0),
        image,
        qtySold: 0,
        totalRevenue: 0,
        orderCount: 0
      };
      itemMap.set(key, entry);
    }

    const qty = Number(oi.quantity || 1);
    const unitPrice = Number(oi.unit_price || (oi.line_total ? oi.line_total / qty : entry.price));
    const lineTot = Number(oi.line_total || (unitPrice * qty));

    entry.qtySold += qty;
    entry.totalRevenue += lineTot;
    entry.orderCount += 1;
    if (unitPrice > 0) entry.price = unitPrice;
  });

  let allItems = Array.from(itemMap.values());

  // Sold dishes
  const soldItems = allItems.filter(i => i.qtySold > 0);
  const totalQtySold = soldItems.reduce((s, i) => s + i.qtySold, 0);
  const totalItemRev = soldItems.reduce((s, i) => s + i.totalRevenue, 0);
  const activeVarieties = soldItems.length;

  let bestSellingDish = null;
  if (soldItems.length > 0) {
    bestSellingDish = soldItems.slice().sort((a, b) => b.totalRevenue - a.totalRevenue)[0];
  }

  // Category filter
  if (itemReportCategoryFilter !== 'all') {
    allItems = allItems.filter(i => i.category === itemReportCategoryFilter);
  }

  // Search filter
  if (itemReportSearch) {
    const q = itemReportSearch.toLowerCase().trim();
    allItems = allItems.filter(i =>
      i.name.toLowerCase().includes(q) ||
      (categoryLabels[i.category] || i.category).toLowerCase().includes(q)
    );
  }

  // Sorting
  if (itemReportSort === 'revenue_desc') {
    allItems.sort((a, b) => b.totalRevenue - a.totalRevenue || b.qtySold - a.qtySold);
  } else if (itemReportSort === 'qty_desc') {
    allItems.sort((a, b) => b.qtySold - a.qtySold || b.totalRevenue - a.totalRevenue);
  } else if (itemReportSort === 'qty_asc') {
    allItems.sort((a, b) => a.qtySold - b.qtySold || a.totalRevenue - b.totalRevenue);
  } else if (itemReportSort === 'price_desc') {
    allItems.sort((a, b) => b.price - a.price);
  } else if (itemReportSort === 'name_asc') {
    allItems.sort((a, b) => a.name.localeCompare(b.name));
  }

  return {
    allItems,
    soldItems,
    totalQtySold,
    totalItemRev,
    activeVarieties,
    bestSellingDish
  };
}

function populateItemReportCategories() {
  const sel = $('item-report-category-filter');
  if (!sel || sel.children.length > 1) return;
  const cats = Array.from(new Set(menuItems.map(m => m.category).filter(Boolean)));
  sel.innerHTML = '<option value="all">🍽️ All Categories</option>' +
    cats.map(cat => {
      const emoji = categoryEmojis[cat] || '🍽️';
      const label = categoryLabels[cat] || cat;
      return `<option value="${cat}">${emoji} ${label}</option>`;
    }).join('');
}

function renderItemReportCharts(soldItems) {
  // Chart 1: Top 10 Best Sellers
  const canvasTop = $('chart-item-top-sellers');
  if (canvasTop) {
    const top10 = soldItems.slice().sort((a, b) => b.qtySold - a.qtySold).slice(0, 10);
    const labels = top10.map(i => i.name.length > 18 ? i.name.slice(0, 16) + '…' : i.name);
    const data = top10.map(i => i.qtySold);

    if (itemTopSellersChartInstance) {
      itemTopSellersChartInstance.destroy();
    }

    itemTopSellersChartInstance = new Chart(canvasTop, {
      type: 'bar',
      data: {
        labels: labels.length ? labels : ['No Sales Yet'],
        datasets: [{
          label: 'Units Sold',
          data: data.length ? data : [0],
          backgroundColor: '#6366f1',
          borderRadius: 6,
          maxBarThickness: 24
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.raw} units sold`
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { stepSize: 1, font: { size: 10 } } }
        }
      }
    });
  }

  // Chart 2: Category Revenue Split
  const canvasCat = $('chart-item-category-split');
  if (canvasCat) {
    const catMap = new Map();
    soldItems.forEach(i => {
      const cat = i.category || 'other';
      const label = categoryLabels[cat] || cat;
      catMap.set(label, (catMap.get(label) || 0) + i.totalRevenue);
    });

    const labels = Array.from(catMap.keys());
    const data = Array.from(catMap.values());
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#06b6d4', '#ec4899', '#8b5cf6', '#3b82f6', '#14b8a6', '#f97316'];

    if (itemCategorySplitChartInstance) {
      itemCategorySplitChartInstance.destroy();
    }

    itemCategorySplitChartInstance = new Chart(canvasCat, {
      type: 'doughnut',
      data: {
        labels: labels.length ? labels : ['No Sales Yet'],
        datasets: [{
          data: data.length ? data : [1],
          backgroundColor: data.length ? colors.slice(0, labels.length) : ['#e2e8f0'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ₹${Number(ctx.raw || 0).toFixed(0)}`
            }
          }
        },
        cutout: '65%'
      }
    });
  }
}

function renderItemsReport() {
  populateItemReportCategories();
  const { allItems, soldItems, totalQtySold, totalItemRev, activeVarieties, bestSellingDish } = computeItemSalesReport();

  // 1. KPI Cards
  if ($('item-kpi-total-qty')) $('item-kpi-total-qty').textContent = `${totalQtySold} qty`;
  if ($('item-kpi-total-rev')) $('item-kpi-total-rev').textContent = `₹${totalItemRev.toFixed(2)}`;
  
  if ($('item-kpi-top-dish')) {
    $('item-kpi-top-dish').textContent = bestSellingDish ? bestSellingDish.name : '—';
    $('item-kpi-top-dish').title = bestSellingDish ? bestSellingDish.name : '';
  }
  if ($('item-kpi-top-dish-meta')) {
    $('item-kpi-top-dish-meta').textContent = bestSellingDish
      ? `${bestSellingDish.qtySold} sold (₹${bestSellingDish.totalRevenue.toFixed(0)})`
      : '0 sold (₹0)';
  }

  if ($('item-kpi-varieties')) $('item-kpi-varieties').textContent = `${activeVarieties} Varieties`;

  // 2. Charts
  renderItemReportCharts(soldItems);

  // 3. Summary Bar
  if ($('item-report-count')) $('item-report-count').textContent = `${allItems.length} ${allItems.length === 1 ? 'dish' : 'dishes'}`;
  const totalUnitsFiltered = allItems.reduce((s, i) => s + i.qtySold, 0);
  const totalRevFiltered = allItems.reduce((s, i) => s + i.totalRevenue, 0);
  if ($('item-report-units')) $('item-report-units').textContent = `${totalUnitsFiltered} qty`;
  if ($('item-report-amount')) $('item-report-amount').textContent = `₹${totalRevFiltered.toFixed(2)}`;

  // 4. Data Table
  const tbody = $('item-report-table-body');
  if (!tbody) return;

  if (!allItems.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2.5rem;color:var(--adm-muted);">No dishes match your selected filter criteria.</td></tr>';
    return;
  }

  tbody.innerHTML = allItems.map(item => {
    const share = totalItemRev > 0 ? ((item.totalRevenue / totalItemRev) * 100) : 0;
    const catLabel = (categoryEmojis[item.category] || '🍽️') + ' ' + (categoryLabels[item.category] || item.category);

    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:.75rem;">
            <img src="${item.image}" alt="${escapeHtml(item.name)}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;background:#f1f5f9;" onerror="this.src='/images/food_starters.png'" loading="lazy" />
            <div>
              <strong style="font-size:.88rem;color:#111827;">${escapeHtml(item.name)}</strong>
              <div style="font-size:.72rem;color:var(--adm-muted);">Ordered in ${item.orderCount} bills</div>
            </div>
          </div>
        </td>
        <td>
          <span style="font-size:.75rem;font-weight:600;color:#4f46e5;background:#eef2ff;padding:.2rem .55rem;border-radius:999px;">${catLabel}</span>
        </td>
        <td style="text-align:right;font-weight:600;font-size:.85rem;">₹${item.price.toFixed(2)}</td>
        <td style="text-align:center;">
          <span style="font-size:.9rem;font-weight:800;color:${item.qtySold > 0 ? '#111827' : '#9ca3af'};">${item.qtySold}</span>
        </td>
        <td style="text-align:right;">
          <strong style="font-size:.9rem;color:${item.totalRevenue > 0 ? '#059669' : '#9ca3af'};">₹${item.totalRevenue.toFixed(2)}</strong>
        </td>
        <td>
          <div style="display:flex;align-items:center;gap:.5rem;">
            <div style="flex:1;height:7px;background:#e2e8f0;border-radius:999px;overflow:hidden;">
              <div style="width:${Math.min(100, Math.max(0, share))}%;height:100%;background:#10b981;border-radius:999px;"></div>
            </div>
            <span style="font-size:.72rem;font-weight:700;color:#374151;min-width:38px;text-align:right;">${share.toFixed(1)}%</span>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Alias for backwards compatibility
function renderCustomerAnalysis() {
  renderItemsReport();
}

function exportItemsReportCSV() {
  const { allItems, totalItemRev } = computeItemSalesReport();
  if (!allItems.length) {
    showAdminToast('No item data to export.', 'error');
    return;
  }

  const headers = ['Dish Name', 'Category', 'Unit Price (INR)', 'Units Sold', 'Total Revenue (INR)', 'Revenue Contribution (%)'];
  const rows = allItems.map(i => {
    const share = totalItemRev > 0 ? ((i.totalRevenue / totalItemRev) * 100).toFixed(1) : '0.0';
    const catLabel = categoryLabels[i.category] || i.category;
    return [
      `"${i.name.replace(/"/g, '""')}"`,
      `"${catLabel.replace(/"/g, '""')}"`,
      `"${i.price.toFixed(2)}"`,
      `"${i.qtySold}"`,
      `"${i.totalRevenue.toFixed(2)}"`,
      `"${share}%"`
    ];
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 10);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `LIMRA_Items_Sales_Report_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showAdminToast('Items sales report exported to Excel CSV! 📥', 'success');
}

function initItemsReportListeners() {
  // Date Preset Buttons
  $('item-report-date-presets')?.querySelectorAll('.pos-cat-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      $('item-report-date-presets').querySelectorAll('.pos-cat-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      itemReportDateFilter = btn.dataset.range;
      const customWrap = $('item-report-custom-date-wrap');
      if (customWrap) customWrap.style.display = itemReportDateFilter === 'custom' ? 'flex' : 'none';
      if (itemReportDateFilter !== 'custom') renderItemsReport();
    });
  });

  // Custom Date Apply
  $('item-report-apply-custom-date')?.addEventListener('click', () => {
    itemReportCustomStart = $('item-report-start-date')?.value || null;
    itemReportCustomEnd = $('item-report-end-date')?.value || null;
    renderItemsReport();
  });

  // Filters & Search
  $('item-report-category-filter')?.addEventListener('change', (e) => {
    itemReportCategoryFilter = e.target.value;
    renderItemsReport();
  });

  $('item-report-type-filter')?.addEventListener('change', (e) => {
    itemReportTypeFilter = e.target.value;
    renderItemsReport();
  });

  $('item-report-sort-filter')?.addEventListener('change', (e) => {
    itemReportSort = e.target.value;
    renderItemsReport();
  });

  $('item-report-search')?.addEventListener('input', (e) => {
    itemReportSearch = e.target.value;
    renderItemsReport();
  });

  $('items-report-export-btn')?.addEventListener('click', exportItemsReportCSV);
}

// ── Bookings ────────────────────────────────────────────

function renderBookingCalendar() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  $('calendar-title').textContent = `${now.toLocaleString('en-IN', { month: 'long' })} ${year} — Schedule`;

  let html = DAYS.map(d => `<div class="adm-cal-head">${d}</div>`).join('');
  for (let i = 0; i < firstDay; i++) html += '<div class="adm-cal-day"></div>';

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayBookings = bookings.filter(b => (b.booking_date || '').startsWith(dateStr));
    const isToday = day === now.getDate();
    html += `<div class="adm-cal-day${isToday ? ' today' : ''}">
      <div class="adm-cal-num">${day}</div>
      ${dayBookings.slice(0, 3).map(b => `
        <div class="adm-cal-event ${b.type}" title="${b.customer_name}">${b.customer_name.split(' ')[0]} · ${b.type}</div>
      `).join('')}
      ${dayBookings.length > 3 ? `<div class="adm-cal-event">+${dayBookings.length - 3} more</div>` : ''}
    </div>`;
  }

  $('booking-calendar').innerHTML = `<div class="adm-calendar">${html}</div>`;
}

function renderBookingsList() {
  const typeFilter = $('bookings-type-filter')?.value || 'all';
  const statusFilter = $('bookings-status-filter')?.value || 'all';
  let filtered = [...bookings];
  if (typeFilter !== 'all') filtered = filtered.filter(b => b.type === typeFilter);
  if (statusFilter !== 'all') filtered = filtered.filter(b => b.status === statusFilter);

  const el = $('bookings-list');
  if (filtered.length === 0) {
    el.innerHTML = '<div class="adm-card adm-empty">No bookings found</div>';
    return;
  }

  el.innerHTML = filtered.map(b => {
    const meta = parseNotesMetadata(b.notes || b.message);
    const statusOptions = BOOKING_STATUSES.map(s =>
      `<option value="${s}" ${s === b.status ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`
    ).join('');
    const typeLabel = { table: '🪑 Table', party: '🎉 Party', wedding: '💍 Wedding' }[b.type] || b.type;

    const digits = b.customer_phone.replace(/\D/g, '');
    const formattedPhone = digits.length === 10 ? '91' : '';
    const whatsappPhone = formattedPhone + digits;
    const bookingStatusText = STATUS_LABEL[b.status] || b.status;
    const whatsappMsg = `Hi ${b.customer_name}, your LIMRA booking #${b.booking_number} for ${typeLabel} is currently ${bookingStatusText}. We look forward to hosting you!`;
    const whatsappLink = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(whatsappMsg)}`;

    const emailSubject = `LIMRA Restaurant - Booking #${b.booking_number} Confirmation`;
    const emailBody = `Hi ${b.customer_name},\n\nThank you for booking with LIMRA! Your ${typeLabel} booking #${b.booking_number} is currently ${bookingStatusText}.\n\nDate: ${b.booking_date || '—'}\nTime: ${b.booking_time || '—'}\nGuests: ${b.guests || '—'}\n\nWe look forward to welcoming you!\n\nWarm regards,\nLIMRA Restaurant Team`;
    const emailLink = meta.email ? `mailto:${meta.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}` : '#';

    return `
      <div class="adm-card">
        <div class="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <p class="font-bold">Booking #${b.booking_number} · ${typeLabel}</p>
            <p class="text-sm" style="color:var(--adm-muted)">${b.customer_name} · ${b.customer_phone}</p>
            ${meta.email ? `<span class="adm-email-badge" style="margin-bottom:0.35rem">${escapeHtml(meta.email)}</span>` : ''}
            <p class="text-sm">${b.booking_date || '—'} ${b.booking_time || ''} · ${b.guests || '?'} guests</p>
          </div>
          <div class="flex items-center gap-2">
            ${statusPill(b.status)}
            <select class="adm-select adm-btn-sm booking-status-select" data-booking-id="${b.id}">${statusOptions}</select>
          </div>
        </div>
        ${b.seat_label ? `<p class="text-sm">Seat: <strong>${b.seat_label}</strong> · ${b.preference || ''}</p>` : ''}
        ${b.message ? `<p class="text-sm mt-2 p-2 rounded-lg" style="background:#f8faf9">${b.message}</p>` : ''}
        
        <div class="adm-comm-grid" style="margin-top:0.75rem; max-width: 320px;">
          <a href="${whatsappLink}" target="_blank" class="adm-comm-btn whatsapp">
            💬 WhatsApp
          </a>
          <a href="${meta.email ? emailLink : '#'}" class="adm-comm-btn email ${!meta.email ? 'adm-comm-disabled' : ''}" id="booking-email-${b.id}">
            ✉️ Email
          </a>
          <a href="tel:${b.customer_phone}" class="adm-comm-btn call">
            📞 Call
          </a>
        </div>
      </div>
    `;
  }).join('');

  filtered.forEach(b => {
    const meta = parseNotesMetadata(b.notes || b.message);
    if (!meta.email) {
      el.querySelector(`#booking-email-${b.id}`)?.addEventListener('click', (e) => {
        e.preventDefault();
        alert('No email address provided by this customer.');
      });
    }
  });

  el.querySelectorAll('.booking-status-select').forEach(select => {
    select.addEventListener('change', async e => {
      const id = e.target.dataset.bookingId;
      const { error } = await insforge.database.from('bookings').update({ status: e.target.value }).eq('id', id);
      if (error) { alert('Failed: ' + error.message); return; }
      const b = bookings.find(x => x.id === id);
      if (b) b.status = e.target.value;
      renderOverview();
      renderBookingCalendar();
    });
  });
}

// ── Foods ───────────────────────────────────────────────

// ════════════════════════════════════════════════════════
// 🍽️ FOOD MENU MANAGEMENT ENGINE
// ════════════════════════════════════════════════════════

let activeMenuOverrides = [];
let foodMenuCategoryFilter = 'all';
let foodMenuAvailabilityFilter = 'all';
let foodMenuSort = 'default';
let foodMenuSearch = '';
let customCreatedFoods = [];

function getCombinedFoodItems() {
  const combined = [...menuItems, ...customCreatedFoods];
  return combined.map(item => {
    const override = activeMenuOverrides.find(o => String(o.id) === String(item.id));
    if (override) {
      return {
        ...item,
        price: override.price !== null && override.price !== undefined ? parseFloat(override.price) : item.price,
        mrp: override.mrp !== null && override.mrp !== undefined ? parseFloat(override.mrp) : item.mrp,
        available: override.available !== undefined ? override.available : true,
        featured: override.featured !== undefined ? override.featured : false,
        image: override.image || item.image,
        description: override.description !== undefined ? override.description : (item.description || '')
      };
    }
    return {
      ...item,
      available: true,
      featured: false,
      description: item.description || ''
    };
  });
}

function initFoodsFilters() {
  const bar = $('foods-category-pills');
  if (!bar) return;

  const allItems = getCombinedFoodItems();
  const totalCount = allItems.length;

  const cats = [
    { key: 'all', label: '🍽️ All Dishes', count: totalCount },
    ...Object.entries(categoryLabels).map(([key, label]) => {
      const emoji = categoryEmojis[key] || '🍲';
      const count = allItems.filter(m => m.category === key).length;
      return { key, label: `${emoji} ${label}`, count };
    })
  ];

  bar.innerHTML = cats.map(c => `
    <button type="button" class="pos-cat-pill ${foodMenuCategoryFilter === c.key ? 'active' : ''}" data-cat="${c.key}">
      ${c.label} (${c.count})
    </button>
  `).join('');

  bar.querySelectorAll('.pos-cat-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      bar.querySelectorAll('.pos-cat-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      foodMenuCategoryFilter = btn.dataset.cat;
      renderFoods();
    });
  });
}

async function loadAndRenderFoods() {
  try {
    const grid = $('foods-grid');
    if (grid) grid.innerHTML = '<div class="adm-empty col-span-full" style="padding:2.5rem;text-align:center;">Loading menu items & inventory...</div>';
    activeMenuOverrides = await getMenuOverrides();
    try {
      const savedCustom = localStorage.getItem('limra_custom_foods');
      if (savedCustom) customCreatedFoods = JSON.parse(savedCustom);
    } catch {}
  } catch (e) {
    console.error("Failed to load menu overrides:", e);
  }
  initFoodsFilters();
  renderFoods();
}

function renderFoods() {
  let allItems = getCombinedFoodItems();

  // 1. Executive KPI Metrics across full menu
  const totalDishes = allItems.length;
  const inStockCount = allItems.filter(i => i.available !== false).length;
  const outOfStockCount = allItems.filter(i => i.available === false).length;
  const featuredCount = allItems.filter(i => i.featured === true).length;
  const uniqueCategories = new Set(allItems.map(i => i.category)).size;

  if ($('food-kpi-total')) $('food-kpi-total').textContent = `${totalDishes}`;
  if ($('food-kpi-instock')) $('food-kpi-instock').textContent = `${inStockCount}`;
  if ($('food-kpi-outstock')) $('food-kpi-outstock').textContent = `${outOfStockCount}`;
  if ($('food-kpi-featured')) $('food-kpi-featured').textContent = `${featuredCount}`;
  if ($('food-kpi-categories')) $('food-kpi-categories').textContent = `${uniqueCategories}`;

  // 2. Filter by Category
  let items = allItems.slice();
  if (foodMenuCategoryFilter !== 'all') {
    items = items.filter(m => m.category === foodMenuCategoryFilter);
  }

  // 3. Filter by Availability
  if (foodMenuAvailabilityFilter === 'instock') {
    items = items.filter(m => m.available !== false);
  } else if (foodMenuAvailabilityFilter === 'outstock') {
    items = items.filter(m => m.available === false);
  } else if (foodMenuAvailabilityFilter === 'featured') {
    items = items.filter(m => m.featured === true);
  }

  // 4. Filter by Search
  const search = ($('foods-search')?.value || foodMenuSearch || '').toLowerCase().trim();
  if (search) {
    items = items.filter(m =>
      m.name.toLowerCase().includes(search) ||
      (categoryLabels[m.category] || m.category).toLowerCase().includes(search) ||
      (m.description && m.description.toLowerCase().includes(search))
    );
  }

  // 5. Sorting
  if (foodMenuSort === 'price_desc') {
    items.sort((a, b) => b.price - a.price);
  } else if (foodMenuSort === 'price_asc') {
    items.sort((a, b) => a.price - b.price);
  } else if (foodMenuSort === 'name_asc') {
    items.sort((a, b) => a.name.localeCompare(b.name));
  } else if (foodMenuSort === 'featured_first') {
    items.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
  }

  // 6. Summary Bar
  if ($('foods-count-label')) $('foods-count-label').textContent = `${items.length} ${items.length === 1 ? 'dish' : 'dishes'}`;
  const catLabel = foodMenuCategoryFilter === 'all' ? 'All Categories' : (categoryLabels[foodMenuCategoryFilter] || foodMenuCategoryFilter);
  if ($('foods-active-cat-label')) $('foods-active-cat-label').textContent = catLabel;

  // 7. Render Food Grid Cards
  const grid = $('foods-grid');
  if (!grid) return;

  if (items.length === 0) {
    grid.innerHTML = '<div class="adm-card adm-empty" style="grid-column: 1 / -1;padding:2.5rem;text-align:center;">No menu dishes match your search or filter.</div>';
    return;
  }

  grid.innerHTML = items.map(item => {
    const img = item.image || categoryImages[item.category];
    const isAvailable = item.available !== false;
    const isFeatured = item.featured === true;
    const catName = categoryLabels[item.category] || item.category;
    const dietIcon = item.is_veg || item.diet === 'veg' ? '🟢 Veg' : '🍗 Non-Veg';

    return `
      <div class="adm-card adm-food-card ${isAvailable ? '' : 'adm-food-card-disabled'}" data-item-id="${item.id}" style="display:flex;flex-direction:column;padding:0;overflow:hidden;border-radius:14px;border:1px solid var(--adm-border);background:#fff;transition:box-shadow .2s;box-shadow:0 1px 3px rgba(0,0,0,.04);">
        
        <!-- Image & Badges -->
        <div style="position:relative;width:100%;height:150px;background:#f1f5f9;overflow:hidden;">
          ${img
            ? `<img src="${img}" alt="${escapeHtml(item.name)}" style="width:100%;height:100%;object-fit:cover;" onerror="this.src='/images/food_starters.png'" />`
            : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:3.5rem;">${item.emoji || '🍽️'}</div>`}
          
          <div style="position:absolute;top:8px;left:8px;display:flex;gap:4px;flex-wrap:wrap;">
            <span style="background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);color:#fff;font-size:.7rem;font-weight:700;padding:.15rem .45rem;border-radius:6px;">
              ${dietIcon}
            </span>
            ${isFeatured ? '<span style="background:#f59e0b;color:#fff;font-size:.7rem;font-weight:800;padding:.15rem .45rem;border-radius:6px;">⭐ Special</span>' : ''}
          </div>

          <div style="position:absolute;top:8px;right:8px;">
            <span style="background:${isAvailable ? '#10b981' : '#ef4444'};color:#fff;font-size:.7rem;font-weight:800;padding:.15rem .5rem;border-radius:6px;">
              ${isAvailable ? 'In Stock' : 'Out of Stock'}
            </span>
          </div>
        </div>

        <!-- Info Body -->
        <div style="padding:1rem;display:flex;flex-direction:column;gap:.4rem;flex:1;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem;">
            <strong style="font-size:.95rem;color:#111827;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
              ${escapeHtml(item.name)}
            </strong>
          </div>
          
          <span style="font-size:.75rem;color:var(--adm-muted);font-weight:600;">
            ${escapeHtml(catName)}
          </span>

          <div style="display:flex;align-items:baseline;gap:.5rem;margin-top:2px;">
            <strong style="font-size:1.15rem;color:#059669;font-weight:800;">₹${Number(item.price).toFixed(2)}</strong>
            ${item.mrp ? `<span style="font-size:.82rem;color:#9ca3af;text-decoration:line-through;">₹${Number(item.mrp).toFixed(2)}</span>` : ''}
          </div>

          ${item.description ? `<p style="font-size:.78rem;color:#6b7280;margin:0;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(item.description)}</p>` : ''}
          
          <!-- Controls Footer -->
          <div style="margin-top:auto;padding-top:.75rem;border-top:1px solid #f1f5f9;display:flex;flex-direction:column;gap:.5rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <label class="adm-toggle-label" style="font-size:.75rem;">
                <input type="checkbox" class="adm-toggle-available" ${isAvailable ? 'checked' : ''} />
                <span class="adm-toggle-slider"></span>
                <span class="adm-toggle-text">${isAvailable ? 'In Stock' : 'Out of Stock'}</span>
              </label>

              <label class="adm-toggle-label" style="font-size:.75rem;">
                <input type="checkbox" class="adm-toggle-featured" ${isFeatured ? 'checked' : ''} />
                <span class="adm-toggle-slider"></span>
                <span class="adm-toggle-text">⭐ Special</span>
              </label>
            </div>

            <button type="button" class="adm-btn adm-btn-outline adm-btn-sm adm-food-btn-edit" style="width:100%;font-size:.78rem;padding:.3rem;justify-content:center;">
              ✏️ Edit Price &amp; Details
            </button>
          </div>

        </div>

      </div>
    `;
  }).join('');

  setupFoodControlListeners();
}

function setupFoodControlListeners() {
  const grid = $('foods-grid');
  if (!grid) return;

  // 1. Availability Toggle
  grid.querySelectorAll('.adm-toggle-available').forEach(cb => {
    cb.addEventListener('change', async () => {
      const card = cb.closest('.adm-food-card');
      const itemId = card.dataset.itemId;
      const isChecked = cb.checked;
      
      if (isChecked) card.classList.remove('adm-food-card-disabled');
      else card.classList.add('adm-food-card-disabled');

      try {
        let override = activeMenuOverrides.find(o => String(o.id) === String(itemId));
        if (!override) {
          const all = getCombinedFoodItems();
          const staticItem = all.find(m => String(m.id) === String(itemId));
          override = {
            id: itemId,
            price: staticItem.price,
            mrp: staticItem.mrp || null,
            available: isChecked,
            featured: staticItem.featured || false
          };
          activeMenuOverrides.push(override);
        } else {
          override.available = isChecked;
        }

        await saveMenuOverride(override);
        showAdminToast(`Item availability updated: ${isChecked ? 'In Stock ✅' : 'Out of Stock 🚫'}`, 'success');
        renderFoods();
      } catch (err) {
        showAdminToast('Failed to update availability: ' + err.message, 'error');
        cb.checked = !isChecked;
      }
    });
  });

  // 2. Featured / Special Toggle
  grid.querySelectorAll('.adm-toggle-featured').forEach(cb => {
    cb.addEventListener('change', async () => {
      const card = cb.closest('.adm-food-card');
      const itemId = card.dataset.itemId;
      const isChecked = cb.checked;

      try {
        let override = activeMenuOverrides.find(o => String(o.id) === String(itemId));
        if (!override) {
          const all = getCombinedFoodItems();
          const staticItem = all.find(m => String(m.id) === String(itemId));
          override = {
            id: itemId,
            price: staticItem.price,
            mrp: staticItem.mrp || null,
            available: staticItem.available !== false,
            featured: isChecked
          };
          activeMenuOverrides.push(override);
        } else {
          override.featured = isChecked;
        }

        await saveMenuOverride(override);
        showAdminToast(`Item featured status updated: ${isChecked ? '⭐ Special' : 'Standard'}`, 'success');
        renderFoods();
      } catch (err) {
        showAdminToast('Failed to update featured status: ' + err.message, 'error');
        cb.checked = !isChecked;
      }
    });
  });

  // 3. Edit Button
  grid.querySelectorAll('.adm-food-btn-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.adm-food-card');
      const itemId = card.dataset.itemId;
      
      const all = getCombinedFoodItems();
      const item = all.find(m => String(m.id) === String(itemId));
      if (!item) return;

      $('edit-modal-item-id').value = item.id;
      $('edit-modal-item-name').textContent = `✏️ Edit Dish: ${item.name}`;
      $('edit-modal-item-price').value = item.price;
      $('edit-modal-item-mrp').value = item.mrp || '';
      $('edit-modal-item-image').value = item.image || '';
      $('edit-modal-item-desc').value = item.description || '';
      $('edit-modal-available').checked = item.available !== false;
      $('edit-modal-featured').checked = item.featured === true;

      $('adm-edit-modal').classList.add('active');
    });
  });
}

function setupEditModalListeners() {
  const modal = $('adm-edit-modal');
  const form = $('adm-edit-form');
  const cancelBtn = $('edit-modal-cancel');
  if (!modal || !form) return;

  cancelBtn.addEventListener('click', () => {
    modal.classList.remove('active');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const itemId = $('edit-modal-item-id').value;
    const newPrice = parseFloat($('edit-modal-item-price').value);
    const newMrpVal = $('edit-modal-item-mrp').value;
    const newMrp = newMrpVal ? parseFloat(newMrpVal) : null;
    const newImage = $('edit-modal-item-image').value.trim();
    const newDesc = $('edit-modal-item-desc').value.trim();
    const newAvail = $('edit-modal-available').checked;
    const newFeat = $('edit-modal-featured').checked;

    if (isNaN(newPrice) || newPrice <= 0) {
      showAdminToast('Please enter a valid price.', 'error');
      return;
    }

    const saveBtn = form.querySelector('button[type="submit"]');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      let override = activeMenuOverrides.find(o => String(o.id) === String(itemId));
      if (!override) {
        override = {
          id: itemId,
          price: newPrice,
          mrp: newMrp,
          image: newImage || null,
          description: newDesc,
          available: newAvail,
          featured: newFeat
        };
        activeMenuOverrides.push(override);
      } else {
        override.price = newPrice;
        override.mrp = newMrp;
        override.image = newImage || null;
        override.description = newDesc;
        override.available = newAvail;
        override.featured = newFeat;
      }

      await saveMenuOverride(override);
      showAdminToast('Dish details updated successfully! ✅', 'success');
      modal.classList.remove('active');
      renderFoods();
    } catch (err) {
      showAdminToast('Failed to save changes: ' + err.message, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Changes';
    }
  });
}

function setupAddDishModalListeners() {
  const modal = $('adm-add-dish-modal');
  const form = $('adm-add-dish-form');
  const openBtn = $('foods-add-new-btn');
  const closeBtn = $('add-dish-close-btn');
  const cancelBtn = $('add-dish-cancel-btn');

  openBtn?.addEventListener('click', () => {
    if (form) form.reset();
    if (modal) modal.style.display = 'flex';
  });

  const closeModal = () => {
    if (modal) modal.style.display = 'none';
  };

  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('add-dish-name').value.trim();
    const category = $('add-dish-category').value;
    const diet = $('add-dish-diet').value;
    const price = parseFloat($('add-dish-price').value);
    const mrpVal = $('add-dish-mrp').value;
    const mrp = mrpVal ? parseFloat(mrpVal) : null;
    const image = $('add-dish-image').value.trim();
    const desc = $('add-dish-desc').value.trim();

    if (!name || isNaN(price) || price <= 0) {
      showAdminToast('Please fill all required fields.', 'error');
      return;
    }

    const newDish = {
      id: `custom_${Date.now()}`,
      name,
      category,
      diet,
      is_veg: diet === 'veg',
      price,
      mrp,
      image: image || null,
      description: desc,
      available: true,
      featured: false
    };

    customCreatedFoods.push(newDish);
    try {
      localStorage.setItem('limra_custom_foods', JSON.stringify(customCreatedFoods));
    } catch {}

    showAdminToast(`New dish "${name}" added to menu! 🍽️`, 'success');
    closeModal();
    initFoodsFilters();
    renderFoods();
  });
}

function exportFoodsMenuCSV() {
  const all = getCombinedFoodItems();
  if (!all.length) {
    showAdminToast('No food dishes to export.', 'error');
    return;
  }

  const headers = ['Dish ID', 'Dish Name', 'Category', 'Diet Type', 'Selling Price (INR)', 'MRP (INR)', 'Stock Status', 'Chef Special / Featured', 'Description'];
  const rows = all.map(item => [
    `"${item.id}"`,
    `"${item.name.replace(/"/g, '""')}"`,
    `"${categoryLabels[item.category] || item.category}"`,
    `"${item.is_veg || item.diet === 'veg' ? 'Veg' : 'Non-Veg'}"`,
    `"${Number(item.price).toFixed(2)}"`,
    `"${item.mrp ? Number(item.mrp).toFixed(2) : ''}"`,
    `"${item.available !== false ? 'In Stock' : 'Out of Stock'}"`,
    `"${item.featured ? 'Yes' : 'No'}"`,
    `"${(item.description || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 10);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `LIMRA_Menu_Dishes_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showAdminToast('Menu catalogue exported to CSV! 📥', 'success');
}

function initFoodsToolbarListeners() {
  $('foods-availability-filter')?.addEventListener('change', (e) => {
    foodMenuAvailabilityFilter = e.target.value;
    renderFoods();
  });

  $('foods-sort-filter')?.addEventListener('change', (e) => {
    foodMenuSort = e.target.value;
    renderFoods();
  });

  $('foods-search')?.addEventListener('input', (e) => {
    foodMenuSearch = e.target.value;
    renderFoods();
  });

  $('foods-export-btn')?.addEventListener('click', exportFoodsMenuCSV);
  setupAddDishModalListeners();
}

// ── Navigation ──────────────────────────────────────────

const PANEL_TITLES = {
  dashboard: 'Dashboard',
  orders: 'Order List',
  'hold-orders': 'Hold Orders',
  'order-detail': 'Order Detail',
  customers: 'Customer',
  'customer-analysis': 'Customer Analysis',
  analytics: 'Analytics',
  bookings: 'Bookings',
  foods: 'Foods',
  coupons: 'Coupons',
  combos: 'Combos',
  places: 'Places & Charges',
};

function switchPanel(panelId) {
  document.querySelectorAll('.adm-panel').forEach(p => p.classList.remove('active'));
  document.querySelector(`#panel-${panelId}`)?.classList.add('active');
  document.querySelectorAll('.adm-nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`.adm-nav-item[data-panel="${panelId}"]`)?.classList.add('active');

  // Editor Zone submenu auto-expand
  const subPanels = ['coupons', 'combos', 'places'];
  const editorZoneTrigger = $('editor-zone-trigger');
  const editorZoneItems = $('editor-zone-items');
  if (subPanels.includes(panelId)) {
    if (editorZoneItems) editorZoneItems.style.display = 'flex';
    if (editorZoneTrigger) {
      editorZoneTrigger.classList.add('active');
      editorZoneTrigger.classList.add('expanded');
    }
  } else {
    if (editorZoneTrigger) {
      editorZoneTrigger.classList.remove('active');
    }
  }

  if (panelId === 'customer-analysis') renderCustomerAnalysis();
  if (panelId === 'analytics') renderAnalytics();
  if (panelId === 'foods') { initFoodsFilters(); loadAndRenderFoods(); }
  if (panelId === 'bookings') renderBookingCalendar();
  if (panelId === 'coupons') { loadAndRenderCoupons(); }
  if (panelId === 'combos') { loadAndRenderCombos(); }
  if (panelId === 'places') { loadAndRenderPlaces(); }
  if (panelId === 'hold-orders') renderHoldOrdersPanel();
  if (panelId === 'closed-orders') renderClosedOrdersPanel();
  if (panelId === 'settings') initSettingsPanel();
  if (panelId === 'printer') {
    switchPanel('settings');
    switchSettingsSubtab('printer');
    return;
  }
  if (panelId === 'profile') {
    switchPanel('settings');
    switchSettingsSubtab('profile');
    return;
  }
  if (panelId === 'order-detail') {
    renderOrderDetailPicker();
    initBillingPanel();
    renderBillingQuickCards();
    renderBillingTotalBills();
  }
  if (panelId === 'dashboard') {
    if (dashboardMap) {
      setTimeout(() => {
        dashboardMap.invalidateSize();
      }, 100);
    }
  }

  if (window.innerWidth < 1024) {
    $('sidebar').classList.remove('open');
    hide($('sidebar-overlay'));
  }
}


// ── Closed Orders & Audit Panel ─────────────────────────────────────────────
let closedDateFilter = 'all';
let closedCustomStart = null;
let closedCustomEnd = null;
let closedEditingOrderId = null;
let closedEditingCart = [];
let closedEditingDeletedItemIds = [];

function renderClosedOrdersPanel() {
  const tbody = $('closed-orders-table-body');
  if (!tbody) return;

  // 1. Calculate Executive KPI Metrics
  const allClosed = orders.filter(o => o.status === 'delivered' || o.status === 'cancelled' || o.payment_status === 'paid');
  const deliveredOrders = allClosed.filter(o => o.status === 'delivered' || o.payment_status === 'paid');
  const cancelledOrders = allClosed.filter(o => o.status === 'cancelled');

  const totalClosedRev = deliveredOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const totalClosedCount = deliveredOrders.length;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayOrders = deliveredOrders.filter(o => new Date(o.created_at).getTime() >= todayStart);
  const todayClosedRev = todayOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const todayClosedCount = todayOrders.length;

  const cancelledLoss = cancelledOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const aov = totalClosedCount > 0 ? (totalClosedRev / totalClosedCount) : 0;

  if ($('closed-kpi-total-rev')) $('closed-kpi-total-rev').textContent = `₹${totalClosedRev.toFixed(2)}`;
  if ($('closed-kpi-total-count')) $('closed-kpi-total-count').textContent = `${totalClosedCount} Settled Bills`;
  if ($('closed-kpi-today-rev')) $('closed-kpi-today-rev').textContent = `₹${todayClosedRev.toFixed(2)}`;
  if ($('closed-kpi-today-count')) $('closed-kpi-today-count').textContent = `${todayClosedCount} Bills Today`;
  if ($('closed-kpi-delivered-ratio')) $('closed-kpi-delivered-ratio').textContent = `${deliveredOrders.length} / ${cancelledOrders.length}`;
  if ($('closed-kpi-cancel-loss')) $('closed-kpi-cancel-loss').textContent = `Cancelled: ₹${cancelledLoss.toFixed(2)}`;
  if ($('closed-kpi-aov')) $('closed-kpi-aov').textContent = `₹${aov.toFixed(2)}`;

  // 2. Filter Table List
  let list = allClosed.slice();

  // Date Filtering
  if (closedDateFilter === 'today') {
    list = list.filter(o => new Date(o.created_at).getTime() >= todayStart);
  } else if (closedDateFilter === 'yesterday') {
    const yestStart = todayStart - 86400000;
    list = list.filter(o => {
      const t = new Date(o.created_at).getTime();
      return t >= yestStart && t < todayStart;
    });
  } else if (closedDateFilter === 'week') {
    const weekStart = todayStart - (6 * 86400000);
    list = list.filter(o => new Date(o.created_at).getTime() >= weekStart);
  } else if (closedDateFilter === 'month') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    list = list.filter(o => new Date(o.created_at).getTime() >= monthStart);
  } else if (closedDateFilter === 'custom' && closedCustomStart) {
    const cStart = new Date(closedCustomStart).getTime();
    const cEnd = closedCustomEnd ? (new Date(closedCustomEnd).getTime() + 86400000) : (cStart + 86400000);
    list = list.filter(o => {
      const t = new Date(o.created_at).getTime();
      return t >= cStart && t < cEnd;
    });
  }

  // Type Filter
  const typeFilter = $('closed-orders-type-filter')?.value || 'all';
  if (typeFilter !== 'all') {
    list = list.filter(o => {
      const parsed = parseNotesMetadata(o.notes, o);
      return parsed.type === typeFilter || o.order_type === typeFilter;
    });
  }

  // Status Filter
  const statusFilter = $('closed-orders-status-filter')?.value || 'all';
  if (statusFilter !== 'all') {
    if (statusFilter === 'delivered') {
      list = list.filter(o => o.status === 'delivered' || o.payment_status === 'paid');
    } else {
      list = list.filter(o => o.status === statusFilter);
    }
  }

  // Search Filter
  const search = ($('closed-orders-search')?.value || '').toLowerCase().trim();
  if (search) {
    list = list.filter(o => {
      const parsed = parseNotesMetadata(o.notes, o);
      return (
        String(o.order_number || '').includes(search) ||
        (o.customer_name && o.customer_name.toLowerCase().includes(search)) ||
        (o.customer_phone && o.customer_phone.includes(search)) ||
        String(parsed.tableNumber || o.table_number || '').toLowerCase().includes(search)
      );
    });
  }

  // Sort newest first
  list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // Update Summary Bar
  const sumAmount = list.reduce((s, o) => s + (o.status !== 'cancelled' ? Number(o.total_amount || 0) : 0), 0);
  const s = getBillSettings();
  const sumTax = sumAmount * (s.cgstRate + s.sgstRate) / (100 + s.cgstRate + s.sgstRate);

  if ($('closed-orders-count')) $('closed-orders-count').textContent = `${list.length} ${list.length === 1 ? 'order' : 'orders'}`;
  if ($('closed-orders-amount')) $('closed-orders-amount').textContent = `₹${sumAmount.toFixed(2)}`;
  if ($('closed-orders-tax-amt')) $('closed-orders-tax-amt').textContent = `₹${sumTax.toFixed(2)}`;

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:2.5rem;color:var(--adm-muted);">No closed orders match your selected filters.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(o => {
    const items = getItemsForOrder(o.id);
    const parsed = parseNotesMetadata(o.notes, o);
    const tableNum = parsed.tableNumber || o.table_number || '';
    const isTable = parsed.type === 'table';
    const typeLabel = isTable
      ? `<span style="background:#eef2ff;color:#4f46e5;padding:.15rem .5rem;border-radius:999px;font-weight:700;font-size:.75rem;">🪑 Table ${tableNum || '—'}</span>`
      : (parsed.type === 'delivery' ? '<span style="background:#eff6ff;color:#1d4ed8;padding:.15rem .5rem;border-radius:999px;font-weight:600;font-size:.75rem;">🚗 Delivery</span>' : '<span style="background:#fef3c7;color:#b45309;padding:.15rem .5rem;border-radius:999px;font-weight:600;font-size:.75rem;">🥡 Pickup</span>');

    const itemsSummary = items.length
      ? items.slice(0, 2).map(i => `${i.quantity}× ${escapeHtml(i.item_name)}`).join(', ') + (items.length > 2 ? ` +${items.length - 2} more` : '')
      : '<span style="color:var(--adm-muted);">No items recorded</span>';

    const isPaid = o.payment_status === 'paid';
    const isCancelled = o.status === 'cancelled';
    const statusPill = isCancelled
      ? '<span class="adm-pill cancelled" style="background:#fee2e2;color:#b91c1c;font-weight:700;">✕ Cancelled</span>'
      : '<span class="adm-pill delivered" style="background:#dcfce7;color:#15803d;font-weight:700;">✓ Settled</span>';

    const payPill = isPaid
      ? `<span style="background:#f0fdf4;color:#166534;font-size:.72rem;font-weight:700;padding:.1rem .4rem;border-radius:4px;border:1px solid #bbf7d0;">Paid · ${escapeHtml(parsed.paymentMode || o.payment_mode || 'Cash/UPI')}</span>`
      : '<span style="background:#fef2f2;color:#991b1b;font-size:.72rem;font-weight:700;padding:.1rem .4rem;border-radius:4px;border:1px solid #fecaca;">Unpaid</span>';

    const d = new Date(o.created_at);
    const dateStr = d.toLocaleDateString('en-IN', { day:'2-digit', month:'short' }) + ', ' + d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });

    return `
      <tr>
        <td>
          <strong style="color:#111827;font-size:.88rem;">#${formatDailyOrderNumber(o)}</strong>
        </td>
        <td>
          <div style="font-weight:700;color:#111827;font-size:.85rem;">${escapeHtml(o.customer_name || 'Walk-in')}</div>
          <div style="font-size:.75rem;color:var(--adm-muted);">${escapeHtml(o.customer_phone || '—')}</div>
        </td>
        <td>${typeLabel}</td>
        <td style="max-width:220px;font-size:.8rem;color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${items.map(i=>`${i.quantity}x ${i.item_name}`).join(', ')}">
          ${itemsSummary}
        </td>
        <td>
          <strong style="font-size:.9rem;color:${isCancelled ? '#9ca3af' : '#059669'};">₹${Number(o.total_amount || 0).toFixed(2)}</strong>
        </td>
        <td>${statusPill}</td>
        <td>${payPill}</td>
        <td style="font-size:.78rem;color:var(--adm-muted);">${dateStr}</td>
        <td style="text-align:right;">
          <div style="display:flex;gap:.35rem;justify-content:flex-end;align-items:center;">
            <button type="button" class="adm-btn adm-btn-outline adm-btn-sm closed-edit-btn" data-id="${o.id}" style="font-size:.75rem;padding:.25rem .55rem;background:#eef2ff;color:#4f46e5;border-color:#c7d2fe;font-weight:700;" title="Edit and correct this order">
              ✏️ Edit
            </button>
            <button type="button" class="adm-btn adm-btn-outline adm-btn-sm closed-bill-btn" data-id="${o.id}" style="font-size:.75rem;padding:.25rem .55rem;" title="Reprint final tax receipt">
              🧾 Bill
            </button>
            <button type="button" class="adm-btn adm-btn-outline adm-btn-sm closed-kot-btn" data-id="${o.id}" style="font-size:.75rem;padding:.25rem .55rem;background:#fff3e0;border-color:#f59e0b;color:#b45309;" title="Reprint kitchen ticket">
              🗒️ KOT
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Row Action Listeners
  tbody.querySelectorAll('.closed-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openClosedOrderEditModal(btn.dataset.id));
  });

  tbody.querySelectorAll('.closed-bill-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const order = orders.find(o => String(o.id) === String(btn.dataset.id));
      if (!order) return;
      await printOrderReceiptWithTax(order);
    });
  });

  tbody.querySelectorAll('.closed-kot-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const order = orders.find(o => String(o.id) === String(btn.dataset.id));
      if (!order) return;
      const items = getItemsForOrder(order.id);
      await printKOT(order, items);
    });
  });
}

function openClosedOrderEditModal(orderId) {
  const order = orders.find(o => String(o.id) === String(orderId));
  if (!order) return;
  closedEditingOrderId = orderId;
  closedEditingDeletedItemIds = [];

  const parsed = parseNotesMetadata(order.notes, order);
  const tableNum = parsed.tableNumber || order.table_number || '';
  const typeText = parsed.type === 'table' ? `🪑 Table ${tableNum || '—'}` : (parsed.type === 'delivery' ? '🚗 Delivery' : '🥡 Pickup');

  if ($('closed-edit-title')) $('closed-edit-title').innerHTML = `<span>✏️ Edit &amp; Correct Closed Order #${order.order_number}</span>`;
  if ($('closed-edit-cust-name')) $('closed-edit-cust-name').textContent = order.customer_name || 'Walk-in';
  if ($('closed-edit-cust-phone')) $('closed-edit-cust-phone').textContent = order.customer_phone || '—';
  if ($('closed-edit-type')) $('closed-edit-type').textContent = typeText;
  if ($('closed-edit-date')) $('closed-edit-date').textContent = new Date(order.created_at).toLocaleString('en-IN');

  // Load existing items
  const items = getItemsForOrder(order.id);
  closedEditingCart = items.map(i => ({
    order_item_id: i.id,
    id: i.menu_item_id || null,
    name: i.item_name,
    price: Number(i.unit_price || (i.quantity > 0 ? (i.line_total / i.quantity) : 0)),
    qty: Number(i.quantity || 1),
    line_total: Number(i.line_total || 0)
  }));

  // Populate Add Item Select
  const sel = $('closed-edit-add-select');
  if (sel) {
    sel.innerHTML = '<option value="">— Select a dish to add —</option>' +
      menuItems.map(f => `<option value="${f.id}" data-price="${f.price}">${escapeHtml(f.name)} (₹${Number(f.price).toFixed(0)})</option>`).join('');
    
    sel.onchange = () => {
      const opt = sel.options[sel.selectedIndex];
      if (opt && opt.dataset.price && $('closed-edit-add-price')) {
        $('closed-edit-add-price').value = opt.dataset.price;
      }
    };
  }

  renderClosedEditItems();

  const modal = $('adm-closed-order-edit-modal');
  if (modal) {
    modal.classList.add('open');
    modal.style.display = 'flex';
  }
}

function closeClosedOrderEditModal() {
  const modal = $('adm-closed-order-edit-modal');
  if (modal) {
    modal.classList.remove('open');
    modal.style.display = 'none';
  }
  closedEditingOrderId = null;
  closedEditingCart = [];
  closedEditingDeletedItemIds = [];
}

function renderClosedEditItems() {
  const tbody = $('closed-edit-items-tbody');
  if (!tbody) return;

  if (!closedEditingCart.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:1.5rem;color:var(--adm-muted);">No items in this order. Use the form above to add dishes.</td></tr>';
  } else {
    tbody.innerHTML = closedEditingCart.map((item, idx) => `
      <tr>
        <td><strong style="color:#111827;">${escapeHtml(item.name)}</strong></td>
        <td style="text-align:center;">₹${item.price.toFixed(2)}</td>
        <td style="text-align:center;">
          <div style="display:inline-flex;align-items:center;gap:.25rem;">
            <button type="button" onclick="closedEditChangeQty(${idx},-1)" style="width:24px;height:24px;border:1px solid var(--adm-border);border-radius:4px;background:#f9fafb;cursor:pointer;font-weight:bold;">−</button>
            <span style="min-width:24px;text-align:center;font-weight:800;">${item.qty}</span>
            <button type="button" onclick="closedEditChangeQty(${idx},1)" style="width:24px;height:24px;border:1px solid var(--adm-border);border-radius:4px;background:#f9fafb;cursor:pointer;font-weight:bold;">+</button>
          </div>
        </td>
        <td style="text-align:right;font-weight:800;color:#111827;">₹${(item.price * item.qty).toFixed(2)}</td>
        <td style="text-align:center;">
          <button type="button" onclick="closedEditRemoveItem(${idx})" style="width:24px;height:24px;border:1px solid #fca5a5;border-radius:4px;background:#fef2f2;cursor:pointer;color:#ef4444;font-weight:bold;" title="Delete item">✕</button>
        </td>
      </tr>
    `).join('');
  }

  // Recalculate Totals
  const s = getBillSettings();
  const subtotal = closedEditingCart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const tax = subtotal * (s.cgstRate + s.sgstRate) / 100;
  const grandTotal = subtotal + tax;

  if ($('closed-edit-subtotal')) $('closed-edit-subtotal').textContent = `₹${subtotal.toFixed(2)}`;
  if ($('closed-edit-tax')) $('closed-edit-tax').textContent = `₹${tax.toFixed(2)}`;
  if ($('closed-edit-grand-total')) $('closed-edit-grand-total').textContent = `₹${grandTotal.toFixed(2)}`;
}

window.closedEditChangeQty = function(idx, delta) {
  closedEditingCart[idx].qty = Math.max(1, closedEditingCart[idx].qty + delta);
  closedEditingCart[idx].line_total = closedEditingCart[idx].price * closedEditingCart[idx].qty;
  renderClosedEditItems();
};

window.closedEditRemoveItem = function(idx) {
  const item = closedEditingCart[idx];
  if (item && item.order_item_id && !String(item.order_item_id).startsWith('temp-')) {
    closedEditingDeletedItemIds.push(item.order_item_id);
  }
  closedEditingCart.splice(idx, 1);
  renderClosedEditItems();
};

async function saveClosedOrderCorrections(orderId, shouldReprint = false) {
  const order = orders.find(o => String(o.id) === String(orderId));
  if (!order) return;
  if (!closedEditingCart.length) {
    showAdminToast('Order must contain at least one item.', 'error');
    return;
  }

  try {
    // 1. Delete removed order items from DB
    if (closedEditingDeletedItemIds.length > 0) {
      for (const delId of closedEditingDeletedItemIds) {
        await insforge.database.from('order_items').delete().eq('id', delId);
      }
    }

    // 2. Upsert / Insert items
    for (const item of closedEditingCart) {
      if (item.order_item_id && !String(item.order_item_id).startsWith('temp-')) {
        // Update existing item
        await insforge.database.from('order_items').update({
          quantity: item.qty,
          unit_price: item.price,
          line_total: item.price * item.qty
        }).eq('id', item.order_item_id);
      } else {
        // Insert newly added item
        const { data: newRow } = await insforge.database.from('order_items').insert([{
          order_id: orderId,
          item_name: item.name,
          quantity: item.qty,
          unit_price: item.price,
          line_total: item.price * item.qty,
          menu_item_id: item.id || null
        }]).select();
        if (newRow && newRow[0]) {
          item.order_item_id = newRow[0].id;
        }
      }
    }

    // 3. Recalculate order total
    const s = getBillSettings();
    const subtotal = closedEditingCart.reduce((sum, i) => sum + i.price * i.qty, 0);
    const tax = subtotal * (s.cgstRate + s.sgstRate) / 100;
    const newGrandTotal = subtotal + tax;

    await insforge.database.from('orders').update({
      total_amount: newGrandTotal
    }).eq('id', orderId);

    // 4. Update in-memory arrays
    order.total_amount = newGrandTotal;
    // Replace items in orderItems
    const otherItems = orderItems.filter(i => String(i.order_id) !== String(orderId));
    const freshOrderItems = closedEditingCart.map(i => ({
      id: i.order_item_id || `temp-edit-${Date.now()}`,
      order_id: orderId,
      item_name: i.name,
      quantity: i.qty,
      unit_price: i.price,
      line_total: i.price * i.qty,
      menu_item_id: i.id || null
    }));
    orderItems.length = 0;
    orderItems.push(...otherItems, ...freshOrderItems);

    showAdminToast(`Order #${order.order_number} corrected and updated successfully! ✅`, 'success');

    if (shouldReprint) {
      await printOrderReceiptWithTax(order);
    }

    closeClosedOrderEditModal();
    renderClosedOrdersPanel();
    renderBillingQuickCards();
    renderBillingTotalBills();
    renderOverview();
  } catch(err) {
    showAdminToast('Failed to save order corrections: ' + err.message, 'error');
  }
}

function exportClosedOrdersCSV() {
  const allClosed = orders.filter(o => o.status === 'delivered' || o.status === 'cancelled' || o.payment_status === 'paid');
  if (!allClosed.length) {
    showAdminToast('No closed orders available to export.', 'error');
    return;
  }

  const headers = ['Order Number', 'Date', 'Customer Name', 'Phone', 'Order Type', 'Table', 'Status', 'Payment Status', 'Payment Mode', 'Items', 'Total Amount'];
  const rows = allClosed.map(o => {
    const items = getItemsForOrder(o.id);
    const parsed = parseNotesMetadata(o.notes, o);
    const itemsStr = items.map(i => `${i.quantity}x ${i.item_name}`).join('; ');
    return [
      `"${formatDailyOrderNumber(o)}"`,
      `"${new Date(o.created_at).toLocaleString('en-IN')}"`,
      `"${(o.customer_name || 'Walk-in').replace(/"/g, '""')}"`,
      `"${o.customer_phone || ''}"`,
      `"${parsed.type || o.order_type || 'table'}"`,
      `"${parsed.tableNumber || o.table_number || ''}"`,
      `"${o.status}"`,
      `"${o.payment_status}"`,
      `"${parsed.paymentMode || o.payment_mode || 'Cash/UPI'}"`,
      `"${itemsStr.replace(/"/g, '""')}"`,
      `"${Number(o.total_amount || 0).toFixed(2)}"`
    ];
  });

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `LIMRA_Closed_Orders_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showAdminToast('Closed orders report exported to CSV! 📥', 'success');
}

function initClosedOrdersListeners() {
  // Date Preset Buttons
  $('closed-date-presets')?.querySelectorAll('.pos-cat-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      $('closed-date-presets').querySelectorAll('.pos-cat-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      closedDateFilter = btn.dataset.range;
      const customWrap = $('closed-custom-date-wrap');
      if (customWrap) customWrap.style.display = closedDateFilter === 'custom' ? 'flex' : 'none';
      if (closedDateFilter !== 'custom') renderClosedOrdersPanel();
    });
  });

  // Custom Date Apply
  $('closed-apply-custom-date')?.addEventListener('click', () => {
    closedCustomStart = $('closed-start-date')?.value || null;
    closedCustomEnd = $('closed-end-date')?.value || null;
    renderClosedOrdersPanel();
  });

  // Type & Status Dropdowns & Search
  $('closed-orders-type-filter')?.addEventListener('change', renderClosedOrdersPanel);
  $('closed-orders-status-filter')?.addEventListener('change', renderClosedOrdersPanel);
  $('closed-orders-search')?.addEventListener('input', renderClosedOrdersPanel);
  $('closed-orders-export-btn')?.addEventListener('click', exportClosedOrdersCSV);

  // Closed Order Edit Modal Listeners
  const editModal = $('adm-closed-order-edit-modal');
  if (editModal) {
    editModal.addEventListener('click', (e) => {
      if (e.target === editModal) closeClosedOrderEditModal();
    });
  }
  $('closed-edit-close-btn')?.addEventListener('click', closeClosedOrderEditModal);

  // Add Item to Closed Order
  $('closed-edit-add-btn')?.addEventListener('click', () => {
    const sel = $('closed-edit-add-select');
    const dishId = sel?.value;
    const dish = menuItems.find(m => String(m.id) === String(dishId));
    if (!dish) {
      showAdminToast('Please select a dish to add.', 'error');
      return;
    }
    const price = parseFloat($('closed-edit-add-price')?.value) || Number(dish.price || 0);
    const qty = parseInt($('closed-edit-add-qty')?.value) || 1;

    const existing = closedEditingCart.find(i => (dishId && String(i.id) === String(dishId)) || i.name.toLowerCase() === dish.name.toLowerCase());
    if (existing) {
      existing.qty += qty;
      existing.line_total = existing.price * existing.qty;
    } else {
      closedEditingCart.push({
        order_item_id: null,
        id: dish.id,
        name: dish.name,
        price,
        qty,
        line_total: price * qty
      });
    }

    if (sel) sel.value = '';
    if ($('closed-edit-add-price')) $('closed-edit-add-price').value = '';
    if ($('closed-edit-add-qty')) $('closed-edit-add-qty').value = '1';

    renderClosedEditItems();
    showAdminToast(`Added "${dish.name}" to correction cart.`, 'success');
  });

  // Save Buttons
  $('closed-edit-save-btn')?.addEventListener('click', async () => {
    if (!closedEditingOrderId) return;
    await saveClosedOrderCorrections(closedEditingOrderId, false);
  });

  $('closed-edit-reprint-btn')?.addEventListener('click', async () => {
    if (!closedEditingOrderId) return;
    await saveClosedOrderCorrections(closedEditingOrderId, true);
  });
}

function renderAll() {
  renderOverview();
  renderOrdersTable();
  renderOrderDetailPicker();
  renderHoldOrdersPanel();
  renderClosedOrdersPanel();
  renderCustomers();
  renderCustomerAnalysis();
  renderBookingCalendar();
  renderBookingsList();
  initFoodsFilters();
  renderFoods();
  if (selectedOrderId) renderOrderDetail(selectedOrderId);
}

async function refreshDashboard(isManual = false) {
  const syncIndicator = $('sync-indicator');
  if (syncIndicator) {
    show(syncIndicator);
    syncIndicator.textContent = 'Syncing...';
    syncIndicator.style.background = 'rgba(242,153,74,0.12)';
    syncIndicator.style.color = '#f2994a';
  }
  
  try {
    await loadData();
    renderAll();
    
    if (syncIndicator) {
      syncIndicator.textContent = 'Synced';
      syncIndicator.style.background = 'rgba(0,176,116,0.12)';
      syncIndicator.style.color = 'var(--adm-green)';
      setTimeout(() => {
        if (syncIndicator.textContent === 'Synced') {
          hide(syncIndicator);
        }
      }, 3000);
    }
  } catch (err) {
    console.error('Auto sync error:', err);
    if (syncIndicator) {
      syncIndicator.textContent = 'Sync Failed';
      syncIndicator.style.background = 'rgba(255,91,91,0.12)';
      syncIndicator.style.color = '#ff5b5b';
    }
    if (isManual) {
      alert('Failed to load data. Please check your network connection or admin permissions.');
    }
  }
}

// ── Auth flow ───────────────────────────────────────────

function cleanAuthParams() {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has('insforge_code') || url.searchParams.has('insforge_status')) {
      url.searchParams.delete('insforge_code');
      url.searchParams.delete('insforge_status');
      url.searchParams.delete('insforge_type');
      url.searchParams.delete('insforge_error');
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  } catch (e) {
    console.warn('Failed to clean auth URL params:', e);
  }
}

async function initAuth() {
  const { data } = await insforge.auth.getCurrentUser();
  cleanAuthParams();
  if (!data?.user) {
    redirectToLogin();
    return;
  }
  currentUser = data.user;
  await handleAuthenticated();
}

async function handleAuthenticated() {
  const email = currentUser.email || 'Admin';
  $('admin-email').textContent = email;
  const name = email.split('@')[0];
  $('admin-greeting').textContent = `Hello, ${name.charAt(0).toUpperCase() + name.slice(1)}`;
  $('admin-avatar').textContent = name.charAt(0).toUpperCase();

  const isAdmin = await checkAdminAccess();
  hide($('auth-loading'));
  if (!isAdmin) {
    show($('unauthorized-screen'));
    return;
  }

  show($('dashboard'));
  if (window.innerWidth >= 1024) $('sidebar').classList.remove('open');
  await refreshDashboard();
}

function initDashboardAuth() {
  $('logout-btn').addEventListener('click', async () => {
    await insforge.auth.signOut();
    redirectToLogin();
  });
  $('unauth-logout-btn').addEventListener('click', async () => {
    await insforge.auth.signOut();
    redirectToLogin();
  });
}

function initDashboardUI() {
  document.querySelectorAll('.adm-nav-item[data-panel]').forEach(btn => {
    btn.addEventListener('click', () => switchPanel(btn.dataset.panel));
  });

  const editorZoneTrigger = $('editor-zone-trigger');
  const editorZoneItems = $('editor-zone-items');
  if (editorZoneTrigger && editorZoneItems) {
    editorZoneTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isExpanded = editorZoneItems.style.display === 'flex';
      if (isExpanded) {
        editorZoneItems.style.display = 'none';
        editorZoneTrigger.classList.remove('expanded');
      } else {
        editorZoneItems.style.display = 'flex';
        editorZoneTrigger.classList.add('expanded');
      }
    });
  }

  $('refresh-btn').addEventListener('click', () => {
    warmUpAudio();
    refreshDashboard(true);
  });

  // Notification center click listeners
  const notifBtn = $('notification-btn');
  const notifDropdown = $('notification-dropdown');
  const clearNotifBtn = $('clear-notifications-btn');
  
  if (notifBtn && notifDropdown) {
    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = notifDropdown.classList.contains('adm-hidden');
      if (isHidden) {
        show(notifDropdown);
        renderNotifications(); // Refresh count when opening
      } else {
        hide(notifDropdown);
      }
    });
    
    document.addEventListener('click', (e) => {
      if (!notifDropdown.classList.contains('adm-hidden') &&
          !notifDropdown.contains(e.target) &&
          e.target !== notifBtn &&
          !notifBtn.contains(e.target)) {
        hide(notifDropdown);
      }
    });
  }
  
  if (clearNotifBtn) {
    clearNotifBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await insforge.database.from('notifications').update({ is_read: true }).eq('is_read', false);
        activeNotifications.forEach(n => n.is_read = true);
        renderNotifications();
        setTimeout(() => hide(notifDropdown), 300);
        refreshDashboard(false);
      } catch (err) {
        console.warn('Failed to clear notifications:', err);
      }
    });
  }

  // Warm up AudioContext on any user gesture so chime works
  document.addEventListener('click', warmUpAudio, { once: true });
  document.addEventListener('keydown', warmUpAudio, { once: true });

  $('orders-status-filter')?.addEventListener('change', () => { ordersPage = 1; renderOrdersTable(); });
  $('orders-payment-filter')?.addEventListener('change', () => { ordersPage = 1; renderOrdersTable(); });
  $('orders-date-filter')?.addEventListener('change', () => { ordersPage = 1; renderOrdersTable(); });

  // Dashboard Date Search Listeners
  const dashPresets = document.querySelectorAll('#dash-date-presets .dash-preset-btn');
  dashPresets.forEach(btn => {
    btn.addEventListener('click', () => {
      dashPresets.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeDashDatePreset = btn.dataset.preset;
      const input = $('dash-date-input');
      if (input) input.value = '';
      renderDashboardDateFilter();
    });
  });

  $('dash-date-input')?.addEventListener('change', () => {
    dashPresets.forEach(b => b.classList.remove('active'));
    activeDashDatePreset = null;
    renderDashboardDateFilter();
  });

  $('dash-date-clear')?.addEventListener('click', () => {
    dashPresets.forEach(b => b.classList.remove('active'));
    const todayBtn = document.querySelector('#dash-date-presets .dash-preset-btn[data-preset="today"]');
    if (todayBtn) todayBtn.classList.add('active');
    activeDashDatePreset = 'today';
    const input = $('dash-date-input');
    if (input) input.value = '';
    renderDashboardDateFilter();
  });
  
  const typePills = document.querySelectorAll('#order-type-pills button');
  typePills.forEach(pill => {
    pill.addEventListener('click', () => {
      typePills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      activeOrderTypeFilter = pill.dataset.type;
      ordersPage = 1;
      renderOrdersTable();
    });
  });

  $('orders-export-csv-btn')?.addEventListener('click', exportOrdersListCSV);
  $('orders-search')?.addEventListener('input', () => { ordersPage = 1; renderOrdersTable(); });
  $('hold-orders-search')?.addEventListener('input', renderHoldOrdersPanel);
  $('customers-search')?.addEventListener('input', renderCustomers);
  $('analysis-search')?.addEventListener('input', renderCustomerAnalysis);
  $('analysis-date-filter')?.addEventListener('change', renderCustomerAnalysis);
  $('analysis-date-clear')?.addEventListener('click', () => {
    const input = $('analysis-date-filter');
    if (input) input.value = '';
    renderCustomerAnalysis();
  });
  $('export-customer-analysis-btn')?.addEventListener('click', exportCustomerAnalysisToExcel);
  $('bookings-type-filter')?.addEventListener('change', () => { renderBookingsList(); renderBookingCalendar(); });
  $('bookings-status-filter')?.addEventListener('change', renderBookingsList);
  $('foods-category-filter')?.addEventListener('change', renderFoods);
  $('foods-search')?.addEventListener('input', renderFoods);
  $('order-detail-back')?.addEventListener('click', () => switchPanel('orders'));
  $('order-detail-picker')?.addEventListener('change', e => {
    const id = e.target.value;
    if (id) {
      selectedOrderId = id;
      renderOrderDetail(id);
      // Sync billing panel: show detail, hide POS creator
      const posEl = $('billing-pos');
      const detailEl = $('billing-detail-view');
      if (posEl) posEl.style.display = 'none';
      if (detailEl) detailEl.style.display = 'block';
      show($('billing-print-btn'));
      show($('billing-print-kot-btn'));
      const bp = $('billing-order-picker');
      if (bp) bp.value = id;
    } else {
      selectedOrderId = null;
      renderOrderDetail(null);
    }
  });

  $('global-search')?.addEventListener('input', () => {
    const q = getGlobalSearch();
    if (q) switchPanel('orders');
    renderOrdersTable();
    renderCustomers();
    renderCustomerAnalysis();
  });

  $('sidebar-toggle').addEventListener('click', () => {
    const isOpen = $('sidebar').classList.toggle('open');
    if (!isOpen) {
      hide($('sidebar-overlay'));
    } else {
      show($('sidebar-overlay'));
    }
  });
  $('sidebar-overlay').addEventListener('click', () => {
    $('sidebar').classList.remove('open');
    hide($('sidebar-overlay'));
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth >= 1024) {
      $('sidebar').classList.remove('open');
      hide($('sidebar-overlay'));
    }
  });

  // Printer status badge click listener
  $('printer-status')?.addEventListener('click', () => {
    selectQZPrinter();
  });

  // Manual Print button click listener
  $('print-receipt-btn')?.addEventListener('click', () => {
    const id = selectedOrderId || $('order-detail-picker')?.value;
    const order = orders.find(o => o.id === id);
    if (order) {
      printOrderReceipt(order);
    } else {
      showAdminToast('Please select an order to print.', 'error');
    }
  });

  // Connect to QZ Tray
  initQZTray();

  // Auto-refresh every 10 seconds for near real-time notifications
  setInterval(() => refreshDashboard(false), 10000);

  // Setup modal listeners for menu editor, coupon manager, and combo manager
  setupEditModalListeners();
  setupCouponModalListeners();
  setupComboModalListeners();
  setupPlaceModalListeners();
  setupCouponShareModalListeners();
  initHoldModalListeners();
  initClosedOrdersListeners();
  initItemsReportListeners();
  initOrdersReportListeners();
  initCustomersListeners();
  initFoodsToolbarListeners();
  initCombosListeners();
  initCouponsListeners();
  initDashboardQuickListeners();
}

initDashboardAuth();
initDashboardUI();
initAuth();

// ═══════════════════════════════════════
// QZ TRAY PRINTING INTEGRATION
// ═══════════════════════════════════════
let qzConnected = false;
let activePrinter = null;

function updatePrinterStatusBadge(status, message) {
  const badge = $('printer-status');
  if (!badge) return;
  
  if (status === 'connected') {
    badge.textContent = `🖨️ Printer: ${message}`;
    badge.style.background = 'rgba(0, 176, 116, 0.12)';
    badge.style.color = 'var(--adm-green)';
  } else if (status === 'connecting') {
    badge.textContent = '🔄 Connecting...';
    badge.style.background = 'rgba(242, 153, 74, 0.12)';
    badge.style.color = '#f2994a';
  } else {
    badge.textContent = '🔌 Printer Off';
    badge.style.background = 'rgba(255, 91, 91, 0.12)';
    badge.style.color = '#ff5b5b';
  }
}

async function initQZTray() {
  if (typeof qz === 'undefined') {
    console.warn('[QZ] qz-tray SDK is not loaded.');
    updatePrinterStatusBadge('disconnected');
    return;
  }
  
  updatePrinterStatusBadge('connecting');
  
  try {
    // Check if already connected
    if (qz.websocket.isActive()) {
      qzConnected = true;
    } else {
      await qz.websocket.connect();
      qzConnected = true;
    }
    
    console.log('[QZ] Connected to QZ Tray local WebSocket.');
    
    // Retrieve default printer from localStorage or system
    let printerName = localStorage.getItem('qz-printer-name');
    if (!printerName) {
      try {
        printerName = await qz.printers.getDefault();
        if (printerName) {
          localStorage.setItem('qz-printer-name', printerName);
        }
      } catch (err) {
        console.warn('[QZ] Could not fetch default system printer:', err);
      }
    }
    
    if (printerName) {
      activePrinter = printerName;
      updatePrinterStatusBadge('connected', printerName);
    } else {
      updatePrinterStatusBadge('connected', 'None Selected');
    }
  } catch (err) {
    console.warn('[QZ] Connection to QZ Tray failed:', err);
    qzConnected = false;
    updatePrinterStatusBadge('disconnected');
  }
}

async function selectQZPrinter() {
  if (typeof qz === 'undefined') {
    alert('QZ Tray SDK is not loaded. Make sure the dashboard script loaded properly.');
    return;
  }
  
  if (!qzConnected) {
    // Try to connect first
    await initQZTray();
    if (!qzConnected) {
      alert('Could not connect to QZ Tray. Please ensure that QZ Tray is running on your computer (typically at wss://localhost:8182).');
      return;
    }
  }
  
  try {
    const printers = await qz.printers.find();
    if (!printers || printers.length === 0) {
      alert('No printers found on your system.');
      return;
    }
    
    // Simple prompt for printer selection
    const savedPrinter = localStorage.getItem('qz-printer-name') || '';
    const printerPromptText = `Enter the exact name of your Thermal Receipt Printer from the list below:\n\n${printers.join('\n')}`;
    const selected = prompt(printerPromptText, savedPrinter);
    
    if (selected !== null) {
      const trimmed = selected.trim();
      if (trimmed) {
        localStorage.setItem('qz-printer-name', trimmed);
        activePrinter = trimmed;
        updatePrinterStatusBadge('connected', trimmed);
        showAdminToast(`Active printer set to: ${trimmed}`, 'success');
      } else {
        localStorage.removeItem('qz-printer-name');
        activePrinter = null;
        updatePrinterStatusBadge('connected', 'None Selected');
      }
    }
  } catch (err) {
    console.error('[QZ] Error listing printers:', err);
    alert('Failed to retrieve system printers: ' + err.message);
  }
}

function generateReceiptHtml(order) {
  const items = getItemsForOrder(order.id);
  const itemsSubtotal = items.reduce((s, i) => s + Number(i.line_total), 0);
  const parsedMeta = parseNotesMetadata(order.notes, order);
  
  // Format items rows
  const itemRowsHtml = items.map(item => {
    return `
      <tr>
        <td style="padding: 5px 0; font-family: monospace; font-size: 12px; color: #000; text-align: left; vertical-align: top;">
          ${escapeHtml(item.item_name)}
        </td>
        <td style="padding: 5px 0; font-family: monospace; font-size: 12px; color: #000; text-align: center; vertical-align: top;">
          ${item.quantity}
        </td>
        <td style="padding: 5px 0; font-family: monospace; font-size: 12px; color: #000; text-align: right; vertical-align: top;">
          ₹${Number(item.unit_price).toFixed(2)}
        </td>
        <td style="padding: 5px 0; font-family: monospace; font-size: 12px; color: #000; text-align: right; vertical-align: top;">
          ₹${Number(item.line_total).toFixed(2)}
        </td>
      </tr>
    `;
  }).join('');

  const formattedDate = new Date(order.created_at).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  
  const paymentMethod = parsedMeta.payment ? parsedMeta.payment.toUpperCase() : (parsedMeta.type === 'table' ? 'PAY AT RESTAURANT' : 'COD');
  const paymentStatus = (order.payment_status || 'unpaid').toUpperCase();
  
  let deliverySectionHtml = '';
  if (parsedMeta.type === 'delivery') {
    deliverySectionHtml = `
      <div style="border-top: 1px dashed #000; padding: 8px 0; font-family: monospace; font-size: 11px; line-height: 1.4; color: #000;">
        <div style="font-weight: bold; margin-bottom: 2px;">DELIVERY ADDRESS:</div>
        <div>${escapeHtml(parsedMeta.address || 'No address specified')}</div>
        ${parsedMeta.area ? `<div>Selected Area: ${escapeHtml(parsedMeta.area)}</div>` : ''}
        ${order.landmark ? `<div>Landmark: ${escapeHtml(order.landmark)}</div>` : ''}
        ${order.delivery_notes ? `<div style="margin-top: 3px; font-style: italic;">Note: ${escapeHtml(order.delivery_notes)}</div>` : ''}
      </div>
    `;
  } else if (parsedMeta.type === 'table') {
    deliverySectionHtml = `
      <div style="border-top: 1px dashed #000; padding: 8px 0; font-family: monospace; font-size: 12px; line-height: 1.4; color: #000; text-align: center; font-weight: bold;">
        🪑 DINE-IN TABLE: Table ${parsedMeta.tableNumber} (${order.table_zone || 'Indoor'})
      </div>
    `;
  }

  const customNoteSection = parsedMeta.customNote ? `
    <div style="border-top: 1px dashed #000; padding: 6px 0; font-family: monospace; font-size: 11px; line-height: 1.4; color: #000;">
      <span style="font-weight: bold;">Instructions:</span> ${escapeHtml(parsedMeta.customNote)}
    </div>
  ` : '';

  return `
    <div style="width: 280px; font-family: monospace; font-size: 12px; color: #000; background: #fff; padding: 0; margin: 0 auto; box-sizing: border-box;">
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 12px;">
        <h2 style="margin: 0; font-size: 18px; font-weight: bold; letter-spacing: 1px;">LIMRA RESTAURANT</h2>
        <div style="font-size: 11px; margin-top: 2px;">Vasant Kunj, New Delhi</div>
        <div style="font-size: 11px;">Phone: +91 99999 88888</div>
        <div style="font-size: 13px; font-weight: bold; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 5px 0; margin-top: 8px; text-transform: uppercase;">
          ${parsedMeta.type === 'delivery' ? '🚗 DELIVERY BILL' : (parsedMeta.type === 'table' ? '🍽️ DINE-IN BILL' : '🥡 PICKUP BILL')}
        </div>
      </div>
      
      <!-- Order details -->
      <div style="margin-bottom: 8px; font-family: monospace; font-size: 11px; line-height: 1.3; color: #000;">
        <div><strong>Order No:</strong> #${formatDailyOrderNumber(order)}</div>
        <div><strong>Date:</strong> ${formattedDate}</div>
        <div><strong>Customer:</strong> ${escapeHtml(order.customer_name)}</div>
        <div><strong>Phone:</strong> ${escapeHtml(order.customer_phone)}</div>
      </div>
      
      <!-- Items table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px; border-bottom: 1px dashed #000;">
        <thead>
          <tr style="border-bottom: 1px dashed #000;">
            <th style="padding-bottom: 5px; font-family: monospace; font-size: 11px; color: #000; text-align: left;">Item</th>
            <th style="padding-bottom: 5px; font-family: monospace; font-size: 11px; color: #000; text-align: center; width: 30px;">Qty</th>
            <th style="padding-bottom: 5px; font-family: monospace; font-size: 11px; color: #000; text-align: right; width: 60px;">Price</th>
            <th style="padding-bottom: 5px; font-family: monospace; font-size: 11px; color: #000; text-align: right; width: 65px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemRowsHtml}
        </tbody>
      </table>
      
      <!-- Financial summary -->
      <div style="font-family: monospace; font-size: 12px; line-height: 1.4; color: #000; margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between;">
          <span>Items Subtotal:</span>
          <span>₹${Number(itemsSubtotal).toFixed(2)}</span>
        </div>
        ${parsedMeta.type === 'delivery' && parsedMeta.charge ? `
        <div style="display: flex; justify-content: space-between;">
          <span>Delivery Charge:</span>
          <span>₹${Number(parsedMeta.charge.replace(/[^0-9.]/g, '') || 0).toFixed(2)}</span>
        </div>` : ''}
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; border-top: 1px dashed #000; padding-top: 4px; margin-top: 4px;">
          <span>NET AMOUNT:</span>
          <span>₹${Number(order.total_amount).toFixed(2)}</span>
        </div>
      </div>
      
      <!-- Payment status -->
      <div style="border-top: 1px dashed #000; padding: 6px 0; font-family: monospace; font-size: 11px; line-height: 1.3; color: #000;">
        <div><strong>Payment Mode:</strong> ${paymentMethod}</div>
        <div><strong>Payment Status:</strong> ${paymentStatus}</div>
      </div>
      
      <!-- Custom notes -->
      ${customNoteSection}
      
      <!-- Delivery logistics -->
      ${deliverySectionHtml}
      
      <!-- Footer -->
      <div style="text-align: center; border-top: 1px dashed #000; padding-top: 8px; margin-top: 12px; font-family: monospace; font-size: 11px; color: #000;">
        <div style="font-weight: bold;">THANK YOU FOR YOUR PATRONAGE!</div>
        <div style="margin-top: 3px;">LIMRA RESTAURANT</div>
        <div style="font-size: 9px; color: #555; margin-top: 5px;">Printed automatically via QZ Tray</div>
      </div>
    </div>
  `;
}

async function printOrderReceipt(order) {
  if (!order) {
    showAdminToast('No order selected to print.', 'error');
    return;
  }
  await printOrderReceiptWithTax(order);
}

// ── Coupons Management ──────────────────────────────────
// ════════════════════════════════════════════════════════
// 🏷️ COUPONS & PROMO CODES MANAGEMENT ENGINE
// ════════════════════════════════════════════════════════

let adminCoupons = [];
let couponStatusFilter = 'all';
let couponSort = 'default';
let couponSearch = '';
let editingCouponCode = null;

async function loadAndRenderCoupons() {
  try {
    const tbody = $('coupons-table-body');
    const grid = $('coupons-grid');
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--adm-muted);">Loading promo codes...</td></tr>';
    if (grid) grid.innerHTML = '<div class="adm-card adm-empty" style="grid-column:1/-1;padding:2.5rem;text-align:center;">Loading promo codes...</div>';
    
    adminCoupons = await getCoupons();
    renderCouponsTable();
  } catch (err) {
    console.error('Failed to load coupons:', err);
    showAdminToast('Failed to load coupons: ' + err.message, 'error');
  }
}

function computeCouponsHubData() {
  const now = new Date();
  
  // Total active coupons
  const activeCoupons = adminCoupons.filter(c => c.active && new Date(c.expiry_date) >= now && (c.used_count || 0) < (c.max_uses || 999999)).length;
  
  // Total redemptions
  const totalRedemptions = adminCoupons.reduce((sum, c) => sum + (parseInt(c.used_count, 10) || 0), 0);
  
  // Estimate or calculate discount given from actual past orders where coupon was applied
  let discountGiven = 0;
  if (Array.isArray(orders)) {
    orders.forEach(o => {
      if (o.notes && o.notes.includes('COUPON:')) {
        const match = o.notes.match(/DISCOUNT:\s*₹?([0-9.]+)/i);
        if (match) discountGiven += parseFloat(match[1]);
      }
    });
  }
  // Fallback estimation if orders don't have discount lines
  if (discountGiven === 0 && totalRedemptions > 0) {
    discountGiven = adminCoupons.reduce((sum, c) => {
      const avgSaved = (c.min_bill || 200) * ((c.discount_pct || 10) / 100);
      return sum + ((c.used_count || 0) * avgSaved);
    }, 0);
  }

  // Top performing promo code
  let topCoupon = null;
  let maxUses = 0;
  adminCoupons.forEach(c => {
    const uses = parseInt(c.used_count, 10) || 0;
    if (uses > maxUses) {
      maxUses = uses;
      topCoupon = c.code;
    }
  });

  let list = adminCoupons.slice();

  // 1. Status Filter
  if (couponStatusFilter === 'active') {
    list = list.filter(c => c.active && new Date(c.expiry_date) >= now && (c.used_count || 0) < (c.max_uses || 999999));
  } else if (couponStatusFilter === 'expired') {
    list = list.filter(c => !c.active || new Date(c.expiry_date) < now || (c.used_count || 0) >= (c.max_uses || 999999));
  } else if (couponStatusFilter === 'autosend') {
    list = list.filter(c => c.is_auto_send);
  }

  // 2. Search Query
  const search = ($('coupons-search')?.value || couponSearch || '').toLowerCase().trim();
  if (search) {
    list = list.filter(c =>
      (c.code || '').toLowerCase().includes(search) ||
      String(c.discount_pct || '').includes(search) ||
      String(c.min_bill || '').includes(search)
    );
  }

  // 3. Sorting
  if (couponSort === 'pct_desc') {
    list.sort((a, b) => (b.discount_pct || 0) - (a.discount_pct || 0));
  } else if (couponSort === 'uses_desc') {
    list.sort((a, b) => (b.used_count || 0) - (a.used_count || 0));
  } else if (couponSort === 'min_desc') {
    list.sort((a, b) => (b.min_bill || 0) - (a.min_bill || 0));
  } else if (couponSort === 'expiry_asc') {
    list.sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));
  } else if (couponSort === 'code_asc') {
    list.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  }

  return {
    list,
    activeCoupons,
    totalRedemptions,
    discountGiven,
    topPromoCode: topCoupon || (adminCoupons[0]?.code || '—')
  };
}

function renderCouponsTable() {
  const {
    list,
    activeCoupons,
    totalRedemptions,
    discountGiven,
    topPromoCode
  } = computeCouponsHubData();

  // 1. KPI Stat Cards
  if ($('coupon-kpi-active')) $('coupon-kpi-active').textContent = `${activeCoupons} Active`;
  if ($('coupon-kpi-redeemed')) $('coupon-kpi-redeemed').textContent = `${totalRedemptions} Uses`;
  if ($('coupon-kpi-discount-given')) $('coupon-kpi-discount-given').textContent = `₹${discountGiven.toFixed(2)}`;
  if ($('coupon-kpi-top-code')) $('coupon-kpi-top-code').textContent = topPromoCode;

  // 2. Summary Bar
  const totalPotentialUses = list.reduce((s, c) => s + (parseInt(c.max_uses, 10) || 0), 0);
  if ($('coupons-count-label')) $('coupons-count-label').textContent = `${list.length} ${list.length === 1 ? 'coupon' : 'coupons'}`;
  if ($('coupons-total-uses-label')) $('coupons-total-uses-label').textContent = `${totalPotentialUses} max uses`;

  const now = new Date();

  // 3. Render Cards Grid
  const grid = $('coupons-grid');
  if (grid) {
    if (list.length === 0) {
      grid.innerHTML = '<div class="adm-card adm-empty" style="grid-column: 1 / -1;padding:2.5rem;text-align:center;">No promo coupons match your search or filter.</div>';
    } else {
      grid.innerHTML = list.map(c => {
        const expDate = new Date(c.expiry_date);
        const isExpired = expDate < now;
        const isDepleted = (c.used_count || 0) >= (c.max_uses || 999999);
        const isLive = c.active && !isExpired && !isDepleted;
        
        // Days remaining
        const diffDays = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));
        const expiryLabel = isExpired ? 'Expired' : (diffDays <= 1 ? 'Expires today' : `Expires in ${diffDays} days`);
        const used = c.used_count || 0;
        const max = c.max_uses || 100;
        const usagePct = Math.min(100, Math.round((used / max) * 100));

        return `
          <div class="adm-card ${isLive ? '' : 'adm-food-card-disabled'}" data-code="${c.code}" style="display:flex;flex-direction:column;padding:1.1rem;border-radius:14px;border:1px solid var(--adm-border);background:#fff;position:relative;gap:.75rem;box-shadow:0 1px 3px rgba(0,0,0,.04);">
            
            <!-- Code Banner & Copy Button -->
            <div style="display:flex;justify-content:space-between;align-items:center;padding:.6rem .75rem;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:8px;">
              <div style="display:flex;align-items:center;gap:.5rem;">
                <span style="font-size:1.1rem;">🏷️</span>
                <strong style="font-family:monospace;font-size:1.15rem;letter-spacing:1px;color:#1e293b;">${c.code}</strong>
              </div>
              <button type="button" class="btn-copy-coupon-code" data-code="${c.code}" style="background:#e0e7ff;color:#4338ca;border:none;border-radius:6px;font-size:.72rem;font-weight:700;padding:.25rem .55rem;cursor:pointer;" title="Copy Code">
                📋 Copy
              </button>
            </div>

            <!-- Discount & Status Badges -->
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="background:#dcfce7;color:#15803d;font-size:.9rem;font-weight:800;padding:.2rem .6rem;border-radius:6px;">
                ${c.discount_pct}% OFF
              </span>
              <span style="background:${isLive ? '#f0fdf4' : '#fee2e2'};color:${isLive ? '#166534' : '#b91c1c'};font-size:.72rem;font-weight:700;padding:.15rem .45rem;border-radius:999px;">
                ${isLive ? '● Live' : (isExpired ? '✕ Expired' : '✕ Paused')}
              </span>
            </div>

            <!-- Requirements & Usage -->
            <div style="font-size:.8rem;color:#475569;display:flex;flex-direction:column;gap:.35rem;">
              <div style="display:flex;justify-content:space-between;">
                <span style="color:var(--adm-muted);">Min Order:</span>
                <strong>₹${Number(c.min_bill || 0).toFixed(2)}</strong>
              </div>
              <div style="display:flex;justify-content:space-between;">
                <span style="color:var(--adm-muted);">Redemptions:</span>
                <strong>${used} / ${max} (${usagePct}%)</strong>
              </div>
              <div style="width:100%;height:5px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin-top:2px;">
                <div style="width:${usagePct}%;height:100%;background:${usagePct >= 90 ? '#ef4444' : '#6366f1'};"></div>
              </div>
              <div style="display:flex;justify-content:space-between;margin-top:2px;">
                <span style="color:var(--adm-muted);">Validity:</span>
                <span style="color:${isExpired ? '#dc2626' : '#64748b'};font-weight:600;">${expiryLabel}</span>
              </div>
            </div>

            <!-- Controls & Action Buttons -->
            <div style="margin-top:auto;padding-top:.75rem;border-top:1px solid #f1f5f9;display:flex;flex-direction:column;gap:.55rem;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <label class="adm-toggle-label" style="font-size:.75rem;">
                  <input type="checkbox" class="coupon-toggle-active" data-code="${c.code}" ${c.active ? 'checked' : ''} />
                  <span class="adm-toggle-slider"></span>
                  <span class="adm-toggle-text">${c.active ? 'Active' : 'Inactive'}</span>
                </label>

                <label class="adm-toggle-label" style="font-size:.75rem;">
                  <input type="checkbox" class="coupon-toggle-auto-send" data-code="${c.code}" ${c.is_auto_send ? 'checked' : ''} />
                  <span class="adm-toggle-slider"></span>
                  <span class="adm-toggle-text">${c.is_auto_send ? '📢 Auto-Promo' : 'Auto-Off'}</span>
                </label>
              </div>

              <div style="display:flex;gap:.35rem;justify-content:flex-end;">
                <button type="button" class="adm-btn adm-btn-outline adm-btn-sm btn-share-coupon" data-code="${c.code}" data-pct="${c.discount_pct}" data-min="${c.min_bill}" data-expiry="${new Date(c.expiry_date).toLocaleDateString('en-IN')}" style="background:#f0fdf4;border-color:#bbf7d0;color:#15803d;font-size:.75rem;padding:.25rem .55rem;">
                  🔗 Share
                </button>
                <button type="button" class="adm-btn adm-btn-outline adm-btn-sm btn-edit-coupon" data-code="${c.code}" style="font-size:.75rem;padding:.25rem .55rem;">
                  ✏️ Edit
                </button>
                <button type="button" class="adm-btn adm-btn-outline adm-btn-sm btn-delete-coupon" data-code="${c.code}" style="font-size:.75rem;padding:.25rem .55rem;color:#ef4444;border-color:#fecaca;">
                  🗑️
                </button>
              </div>
            </div>

          </div>
        `;
      }).join('');
    }
  }

  // 4. Render Table View
  const tbody = $('coupons-table-body');
  if (tbody) {
    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--adm-muted);">No coupons found. Click "+ Create Coupon" to add a new promo.</td></tr>';
    } else {
      tbody.innerHTML = list.map(c => {
        const expDate = new Date(c.expiry_date);
        const isExpired = expDate < now;
        const expiryStr = expDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        const statusText = c.active && !isExpired ? 'Active' : (isExpired ? 'Expired' : 'Inactive');
        
        return `
          <tr>
            <td class="font-bold text-slate-900" style="padding:1rem;">
              <span style="font-family:monospace;background:#f1f5f9;padding:.2rem .5rem;border-radius:6px;font-size:.9rem;letter-spacing:1px;">${c.code}</span>
            </td>
            <td class="font-semibold text-emerald-600">${c.discount_pct}% OFF</td>
            <td>₹${parseFloat(c.min_bill || 0).toFixed(2)}</td>
            <td>${c.used_count || 0} / ${c.max_uses || 100} uses</td>
            <td class="${isExpired ? 'text-red-500 font-medium' : ''}">${expiryStr}</td>
            <td>
              <label class="adm-toggle-label">
                <input type="checkbox" class="coupon-toggle-auto-send" data-code="${c.code}" ${c.is_auto_send ? 'checked' : ''} />
                <span class="adm-toggle-slider"></span>
                <span class="adm-toggle-text text-xs" style="font-weight:bold;color:${c.is_auto_send ? 'var(--adm-green)' : 'var(--adm-muted)'}">
                  ${c.is_auto_send ? '★ Active Promo' : 'Off'}
                </span>
              </label>
            </td>
            <td>
              <span style="background:${c.active && !isExpired ? 'rgba(0,176,116,0.1)' : 'rgba(255,91,91,0.1)'};color:${c.active && !isExpired ? 'var(--adm-green)' : '#ff5b5b'};padding:4px 8px;border-radius:12px;font-size:0.75rem;font-weight:700;">
                ${statusText}
              </span>
            </td>
            <td style="text-align:right;">
              <div style="display:inline-flex;gap:0.35rem;">
                <button class="adm-btn adm-btn-outline adm-btn-sm btn-share-coupon" data-code="${c.code}" data-pct="${c.discount_pct}" data-min="${c.min_bill}" data-expiry="${expiryStr}" style="padding:0.25rem 0.5rem;font-size:0.75rem;background:rgba(0,176,116,0.08);color:var(--adm-green);border-color:rgba(0,176,116,0.2);">🔗 Share</button>
                <button class="adm-btn adm-btn-outline adm-btn-sm btn-edit-coupon" data-code="${c.code}" style="padding:0.25rem 0.5rem;font-size:0.75rem;">✏️ Edit</button>
                <button class="adm-btn adm-btn-outline adm-btn-sm btn-delete-coupon" data-code="${c.code}" style="padding:0.25rem 0.5rem;color:#ef4444;border-color:#fecaca;">🗑️</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  setupCouponEventListeners();
}

function setupCouponEventListeners() {
  // 1. Copy Coupon Code
  document.querySelectorAll('.btn-copy-coupon-code').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.dataset.code;
      navigator.clipboard.writeText(code);
      btn.textContent = '✓ Copied!';
      setTimeout(() => { btn.textContent = '📋 Copy'; }, 2000);
      showAdminToast(`Coupon code ${code} copied to clipboard! 📋`, 'info');
    });
  });

  // 2. Active Toggle
  document.querySelectorAll('.coupon-toggle-active').forEach(cb => {
    cb.addEventListener('change', async () => {
      const code = cb.dataset.code;
      const isChecked = cb.checked;
      try {
        const coupon = adminCoupons.find(c => c.code === code);
        if (coupon) {
          coupon.active = isChecked;
          await saveCoupon(coupon);
          showAdminToast(`Coupon ${code} status updated: ${isChecked ? 'Active ✅' : 'Inactive 🚫'}`, 'success');
          loadAndRenderCoupons();
        }
      } catch (err) {
        showAdminToast('Failed to update coupon: ' + err.message, 'error');
        cb.checked = !isChecked;
      }
    });
  });

  // 3. Auto-send Toggle
  document.querySelectorAll('.coupon-toggle-auto-send').forEach(cb => {
    cb.addEventListener('change', async () => {
      const code = cb.dataset.code;
      const isChecked = cb.checked;
      try {
        const coupon = adminCoupons.find(c => c.code === code);
        if (coupon) {
          coupon.is_auto_send = isChecked;
          await saveCoupon(coupon);
          showAdminToast(`WhatsApp auto-promo ${isChecked ? 'enabled ★' : 'disabled'} for ${code}`, 'success');
          loadAndRenderCoupons();
        }
      } catch (err) {
        showAdminToast('Failed to set auto-send: ' + err.message, 'error');
        cb.checked = !isChecked;
      }
    });
  });

  // 4. Share Button
  document.querySelectorAll('.btn-share-coupon').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.dataset.code;
      const pct = btn.dataset.pct;
      const min = btn.dataset.min;
      const expiry = btn.dataset.expiry;
      
      $('share-coupon-code').value = code;
      $('share-coupon-pct').value = pct;
      $('share-coupon-min').value = min;
      $('share-coupon-expiry').value = expiry;
      $('share-customer-name').value = '';
      $('share-customer-phone').value = '';
      
      updateShareMessage();
      $('adm-coupon-share-modal').classList.add('active');
    });
  });

  // 5. Edit Button
  document.querySelectorAll('.btn-edit-coupon').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.dataset.code;
      const coupon = adminCoupons.find(c => c.code === code);
      if (coupon) {
        editingCouponCode = code;
        $('coupon-modal-title').textContent = `✏️ Edit Coupon: ${code}`;
        $('coupon-modal-code').value = coupon.code;
        $('coupon-modal-code').disabled = true;
        $('coupon-modal-pct').value = coupon.discount_pct;
        $('coupon-modal-min').value = coupon.min_bill;
        $('coupon-modal-max').value = coupon.max_uses;
        
        const expDate = new Date(coupon.expiry_date);
        const yyyy = expDate.getFullYear();
        const mm = String(expDate.getMonth() + 1).padStart(2, '0');
        const dd = String(expDate.getDate()).padStart(2, '0');
        $('coupon-modal-expiry').value = `${yyyy}-${mm}-${dd}`;
        $('coupon-modal-auto-send').checked = coupon.is_auto_send;
        
        $('adm-coupon-modal').classList.add('active');
      }
    });
  });

  // 6. Delete Button
  document.querySelectorAll('.btn-delete-coupon').forEach(btn => {
    btn.addEventListener('click', async () => {
      const code = btn.dataset.code;
      if (!confirm(`Are you sure you want to delete coupon code "${code}"? This cannot be undone.`)) return;

      try {
        await deleteCoupon(code);
        showAdminToast(`Coupon ${code} deleted successfully.`, 'success');
        loadAndRenderCoupons();
      } catch (err) {
        showAdminToast('Failed to delete coupon: ' + err.message, 'error');
      }
    });
  });
}

function exportCouponsCSV() {
  const { list } = computeCouponsHubData();
  if (!list.length) {
    showAdminToast('No coupons to export.', 'error');
    return;
  }

  const headers = ['Coupon Code', 'Discount (%)', 'Min Bill (INR)', 'Used Count', 'Max Uses', 'Expiry Date', 'WhatsApp Auto-Send', 'Status'];
  const rows = list.map(c => [
    `"${c.code || ''}"`,
    `"${c.discount_pct || 0}"`,
    `"${Number(c.min_bill || 0).toFixed(2)}"`,
    `"${c.used_count || 0}"`,
    `"${c.max_uses || 100}"`,
    `"${new Date(c.expiry_date).toLocaleDateString('en-IN')}"`,
    `"${c.is_auto_send ? 'Yes' : 'No'}"`,
    `"${c.active ? 'Active' : 'Inactive'}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 10);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `LIMRA_Coupons_Promo_Codes_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showAdminToast('Coupons exported to CSV! 📥', 'success');
}

function initCouponsListeners() {
  // Status pill buttons
  $('coupons-status-presets')?.querySelectorAll('.pos-cat-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      $('coupons-status-presets').querySelectorAll('.pos-cat-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      couponStatusFilter = btn.dataset.status;
      renderCouponsTable();
    });
  });

  // Sort & Search
  $('coupons-sort-filter')?.addEventListener('change', (e) => {
    couponSort = e.target.value;
    renderCouponsTable();
  });

  $('coupons-search')?.addEventListener('input', (e) => {
    couponSearch = e.target.value;
    renderCouponsTable();
  });

  $('coupons-export-btn')?.addEventListener('click', exportCouponsCSV);
}

function setupCouponModalListeners() {
  const modal = $('adm-coupon-modal');
  const form = $('adm-coupon-form');
  const cancelBtn = $('coupon-modal-cancel');
  const createBtn = $('btn-create-coupon');
  
  if (!modal || !form || !cancelBtn) return;
  
  createBtn?.addEventListener('click', () => {
    editingCouponCode = null;
    $('coupon-modal-title').textContent = 'Create Coupon';
    $('coupon-modal-code').value = '';
    $('coupon-modal-code').disabled = false;
    $('coupon-modal-pct').value = '10';
    $('coupon-modal-min').value = '0';
    $('coupon-modal-max').value = '100';
    $('coupon-modal-expiry').value = '';
    $('coupon-modal-auto-send').checked = false;
    
    modal.classList.add('active');
  });
  
  cancelBtn.addEventListener('click', () => {
    modal.classList.remove('active');
  });
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = $('coupon-modal-code').value.trim().toUpperCase();
    const pct = parseInt($('coupon-modal-pct').value, 10);
    const minBill = parseFloat($('coupon-modal-min').value) || 0;
    const maxUses = parseInt($('coupon-modal-max').value, 10) || 100;
    const expiry = $('coupon-modal-expiry').value;
    const autoSend = $('coupon-modal-auto-send').checked;
    
    if (!code) {
      alert('Please enter a coupon code');
      return;
    }
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      alert('Please enter a valid percentage (1-100)');
      return;
    }
    if (!expiry) {
      alert('Please select an expiry date');
      return;
    }
    
    const saveBtn = form.querySelector('button[type="submit"]');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    
    try {
      const coupon = {
        code,
        discount_pct: pct,
        min_bill: minBill,
        max_uses: maxUses,
        expiry_date: new Date(expiry).toISOString(),
        is_auto_send: autoSend,
        active: true
      };
      
      await saveCoupon(coupon);
      modal.classList.remove('active');
      loadAndRenderCoupons();
    } catch (err) {
      alert('Failed to save coupon: ' + err.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Coupon';
    }
  });
}

// ── Combos Management ───────────────────────────────────
// ════════════════════════════════════════════════════════
// 🍿 COMBOS & MEAL DEALS MANAGEMENT ENGINE
// ════════════════════════════════════════════════════════

let adminCombos = [];
let comboStatusFilter = 'all';
let comboSort = 'default';
let comboSearch = '';

async function loadAndRenderCombos() {
  try {
    const tbody = $('combos-table-body');
    const grid = $('combos-grid');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--adm-muted);">Loading combo packages...</td></tr>';
    if (grid) grid.innerHTML = '<div class="adm-card adm-empty" style="grid-column:1/-1;padding:2.5rem;text-align:center;">Loading combo meal deals...</div>';
    
    adminCombos = await getCombos();
    renderCombosTable();
  } catch (err) {
    console.error('Failed to load combos:', err);
    showAdminToast('Failed to load combo packages: ' + err.message, 'error');
  }
}

function computeCombosHubData() {
  const totalCombos = adminCombos.length;
  const activeCombos = adminCombos.filter(c => c.available !== false).length;
  const avgPrice = totalCombos > 0 ? (adminCombos.reduce((s, c) => s + Number(c.price || 0), 0) / totalCombos) : 0;
  
  // Calculate average savings percentage
  let totalSavingsPct = 0;
  let savingsCount = 0;
  adminCombos.forEach(c => {
    const mrp = Number(c.mrp || 0);
    const price = Number(c.price || 0);
    if (mrp > price && mrp > 0) {
      totalSavingsPct += ((mrp - price) / mrp) * 100;
      savingsCount++;
    }
  });
  const avgSavings = savingsCount > 0 ? (totalSavingsPct / savingsCount).toFixed(0) : '0';

  let list = adminCombos.slice();

  // 1. Status Filter
  if (comboStatusFilter === 'active') {
    list = list.filter(c => c.available !== false);
  } else if (comboStatusFilter === 'inactive') {
    list = list.filter(c => c.available === false);
  }

  // 2. Search Query
  const search = ($('combos-search')?.value || comboSearch || '').toLowerCase().trim();
  if (search) {
    list = list.filter(c => {
      const name = (c.name || '').toLowerCase();
      const desc = (c.description || '').toLowerCase();
      const itemsStr = Array.isArray(c.items) ? c.items.map(i => i.name || '').join(' ').toLowerCase() : '';
      return name.includes(search) || desc.includes(search) || itemsStr.includes(search);
    });
  }

  // 3. Sorting
  if (comboSort === 'price_desc') {
    list.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
  } else if (comboSort === 'price_asc') {
    list.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
  } else if (comboSort === 'savings_desc') {
    list.sort((a, b) => {
      const savA = (Number(a.mrp || 0) > Number(a.price || 0)) ? ((Number(a.mrp) - Number(a.price)) / Number(a.mrp)) : 0;
      const savB = (Number(b.mrp || 0) > Number(b.price || 0)) ? ((Number(b.mrp) - Number(b.price)) / Number(b.mrp)) : 0;
      return savB - savA;
    });
  } else if (comboSort === 'name_asc') {
    list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  return {
    list,
    totalCombos,
    activeCombos,
    avgPrice,
    avgSavings
  };
}

function renderCombosTable() {
  const {
    list,
    totalCombos,
    activeCombos,
    avgPrice,
    avgSavings
  } = computeCombosHubData();

  // 1. KPI Stat Cards
  if ($('combo-kpi-total')) $('combo-kpi-total').textContent = `${totalCombos} Deals`;
  if ($('combo-kpi-active')) $('combo-kpi-active').textContent = `${activeCombos} Active`;
  if ($('combo-kpi-avg-price')) $('combo-kpi-avg-price').textContent = `₹${avgPrice.toFixed(2)}`;
  if ($('combo-kpi-avg-savings')) $('combo-kpi-avg-savings').textContent = `${avgSavings}% OFF`;

  // 2. Summary Bar
  const totalValue = list.reduce((s, c) => s + Number(c.price || 0), 0);
  if ($('combos-count-label')) $('combos-count-label').textContent = `${list.length} ${list.length === 1 ? 'package' : 'packages'}`;
  if ($('combos-total-val-label')) $('combos-total-val-label').textContent = `₹${totalValue.toFixed(2)}`;

  // 3. Render Cards Grid
  const grid = $('combos-grid');
  if (grid) {
    if (list.length === 0) {
      grid.innerHTML = '<div class="adm-card adm-empty" style="grid-column: 1 / -1;padding:2.5rem;text-align:center;">No combo packages match your search or filter.</div>';
    } else {
      grid.innerHTML = list.map(c => {
        const isAvailable = c.available !== false;
        const mrp = Number(c.mrp || 0);
        const price = Number(c.price || 0);
        const hasDiscount = mrp > price;
        const discountPct = hasDiscount ? Math.round(((mrp - price) / mrp) * 100) : 0;
        const items = Array.isArray(c.items) ? c.items : [];

        return `
          <div class="adm-card ${isAvailable ? '' : 'adm-food-card-disabled'}" data-combo-id="${c.id}" style="display:flex;flex-direction:column;padding:0;overflow:hidden;border-radius:14px;border:1px solid var(--adm-border);background:#fff;transition:box-shadow .2s;box-shadow:0 1px 3px rgba(0,0,0,.04);">
            
            <!-- Banner / Image Preview -->
            <div style="position:relative;width:100%;height:150px;background:#f1f5f9;overflow:hidden;">
              ${c.image_url
                ? `<img src="${c.image_url}" alt="${escapeHtml(c.name)}" style="width:100%;height:100%;object-fit:cover;" onerror="this.src='/images/food_biryani.png'" />`
                : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:3.5rem;">🍿</div>`}
              
              <div style="position:absolute;top:8px;left:8px;display:flex;gap:4px;">
                ${hasDiscount ? `<span style="background:#dc2626;color:#fff;font-size:.72rem;font-weight:800;padding:.15rem .5rem;border-radius:6px;">SAVE ${discountPct}% OFF</span>` : ''}
              </div>

              <div style="position:absolute;top:8px;right:8px;">
                <span style="background:${isAvailable ? '#10b981' : '#ef4444'};color:#fff;font-size:.7rem;font-weight:800;padding:.15rem .5rem;border-radius:6px;">
                  ${isAvailable ? 'In Stock' : 'Paused'}
                </span>
              </div>
            </div>

            <!-- Body Info -->
            <div style="padding:1rem;display:flex;flex-direction:column;gap:.45rem;flex:1;">
              <strong style="font-size:1rem;color:#111827;line-height:1.3;">${escapeHtml(c.name)}</strong>
              ${c.description ? `<p style="font-size:.8rem;color:#6b7280;margin:0;line-height:1.4;">${escapeHtml(c.description)}</p>` : ''}
              
              <!-- Included Items Chips -->
              <div style="margin-top:2px;">
                <span style="font-size:.72rem;color:var(--adm-muted);font-weight:600;display:block;margin-bottom:3px;">Included Dishes:</span>
                <div style="display:flex;gap:.3rem;flex-wrap:wrap;">
                  ${items.map(it => `
                    <span style="background:#f1f5f9;color:#334155;padding:.15rem .45rem;border-radius:6px;font-size:.72rem;font-weight:600;">
                      ${it.qty > 1 ? `<strong style="color:#6366f1;">${it.qty}×</strong> ` : ''}${escapeHtml(it.name)}
                    </span>
                  `).join('')}
                </div>
              </div>

              <!-- Price & Savings -->
              <div style="display:flex;align-items:baseline;gap:.5rem;margin-top:auto;padding-top:.5rem;">
                <strong style="font-size:1.2rem;color:#059669;font-weight:800;">₹${price.toFixed(2)}</strong>
                ${hasDiscount ? `<span style="font-size:.85rem;color:#9ca3af;text-decoration:line-through;">₹${mrp.toFixed(2)}</span>` : ''}
              </div>

              <!-- Action Controls -->
              <div style="margin-top:6px;padding-top:.6rem;border-top:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;gap:.5rem;">
                <label class="adm-toggle-label" style="font-size:.75rem;">
                  <input type="checkbox" class="combo-card-toggle-avail" data-id="${c.id}" ${isAvailable ? 'checked' : ''} />
                  <span class="adm-toggle-slider"></span>
                  <span class="adm-toggle-text">${isAvailable ? 'Available' : 'Paused'}</span>
                </label>

                <div style="display:flex;gap:.35rem;">
                  <button type="button" class="adm-btn adm-btn-outline adm-btn-sm btn-edit-combo" data-id="${c.id}" style="font-size:.72rem;padding:.2rem .45rem;" title="Edit Combo">
                    ✏️ Edit
                  </button>
                  <button type="button" class="adm-btn adm-btn-outline adm-btn-sm btn-delete-combo" data-id="${c.id}" style="font-size:.72rem;padding:.2rem .45rem;color:#ef4444;border-color:#fecaca;" title="Delete Combo">
                    🗑️
                  </button>
                </div>
              </div>

            </div>

          </div>
        `;
      }).join('');
    }
  }

  // 4. Render Table View
  const tbody = $('combos-table-body');
  if (tbody) {
    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--adm-muted);">No combos found. Click "+ Create Combo Pack" to create your first meal bundle.</td></tr>';
    } else {
      tbody.innerHTML = list.map(c => {
        const itemsListStr = Array.isArray(c.items)
          ? c.items.map(it => `${it.qty || 1}× ${it.name}`).join(', ')
          : 'No items';
        const isAvailable = c.available !== false;
        const mrp = Number(c.mrp || 0);
        const price = Number(c.price || 0);
        const hasDiscount = mrp > price;
        const discountPct = hasDiscount ? Math.round(((mrp - price) / mrp) * 100) : 0;
        
        return `
          <tr>
            <td>
              <div style="display:flex;align-items:center;gap:0.75rem;">
                ${c.image_url ? `<img src="${c.image_url}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;border:1px solid var(--adm-border);" onerror="this.src='/images/food_biryani.png'" />` : '<div style="width:40px;height:40px;border-radius:8px;background:#eef2ff;display:flex;align-items:center;justify-content:center;font-size:1.2rem;">🍿</div>'}
                <div>
                  <strong style="color:#111827;font-size:.88rem;">${escapeHtml(c.name)}</strong>
                </div>
              </div>
            </td>
            <td style="max-width:200px;font-size:.8rem;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${escapeHtml(c.description || '—')}
            </td>
            <td style="font-size:.8rem;color:#374151;max-width:240px;">
              ${escapeHtml(itemsListStr)}
            </td>
            <td>
              <strong style="color:#059669;font-size:.9rem;">₹${price.toFixed(2)}</strong>
              ${hasDiscount ? `<span style="text-decoration:line-through;color:#9ca3af;font-size:.78rem;margin-left:4px;">₹${mrp.toFixed(2)}</span> <span style="background:#fee2e2;color:#b91c1c;font-size:.7rem;font-weight:700;padding:.1rem .35rem;border-radius:4px;">${discountPct}% off</span>` : ''}
            </td>
            <td>
              <span style="background:${isAvailable ? '#f0fdf4' : '#fee2e2'};color:${isAvailable ? '#166534' : '#b91c1c'};font-size:.75rem;font-weight:700;padding:.15rem .45rem;border-radius:999px;">
                ${isAvailable ? '✓ Active' : '✕ Paused'}
              </span>
            </td>
            <td style="text-align:right;">
              <div style="display:inline-flex;gap:4px;">
                <button type="button" class="adm-btn adm-btn-outline adm-btn-sm btn-edit-combo" data-id="${c.id}" style="font-size:.75rem;padding:.2rem .45rem;">
                  ✏️ Edit
                </button>
                <button type="button" class="adm-btn adm-btn-outline adm-btn-sm btn-delete-combo" data-id="${c.id}" style="font-size:.75rem;padding:.2rem .45rem;color:#ef4444;border-color:#fecaca;">
                  🗑️
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  setupComboEventListeners();
}

function setupComboEventListeners() {
  // Toggle availability in card / table
  document.querySelectorAll('.combo-card-toggle-avail').forEach(cb => {
    cb.addEventListener('change', async () => {
      const id = cb.dataset.id;
      const isChecked = cb.checked;
      try {
        const combo = adminCombos.find(c => String(c.id) === String(id));
        if (combo) {
          combo.available = isChecked;
          await saveCombo(combo);
          showAdminToast(`Combo availability updated: ${isChecked ? 'In Stock ✅' : 'Paused 🚫'}`, 'success');
          loadAndRenderCombos();
        }
      } catch (err) {
        showAdminToast('Failed to update combo: ' + err.message, 'error');
        cb.checked = !isChecked;
      }
    });
  });

  // Edit Button
  document.querySelectorAll('.btn-edit-combo').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const combo = adminCombos.find(c => String(c.id) === String(id));
      if (combo) {
        $('combo-modal-title').textContent = `✏️ Edit Combo: ${combo.name}`;
        $('combo-modal-id').value = combo.id;
        $('combo-modal-name').value = combo.name;
        $('combo-modal-desc').value = combo.description || '';
        $('combo-modal-price').value = combo.price;
        $('combo-modal-mrp').value = combo.mrp || '';
        
        $('combo-modal-img-url').value = combo.image_url || '';
        const preview = $('combo-modal-img-preview');
        const placeholder = $('combo-modal-img-placeholder');
        if (combo.image_url) {
          preview.src = combo.image_url;
          preview.style.display = 'block';
          placeholder.style.display = 'none';
        } else {
          preview.src = '';
          preview.style.display = 'none';
          placeholder.style.display = 'block';
        }
        $('combo-modal-file').value = '';
        $('combo-modal-upload-status').textContent = 'No file selected';
        
        populateComboItemsChecklist(combo.items);
        $('adm-combo-modal').classList.add('active');
      }
    });
  });

  // Delete Button
  document.querySelectorAll('.btn-delete-combo').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const combo = adminCombos.find(c => String(c.id) === String(id));
      if (!combo) return;
      if (!confirm(`Are you sure you want to delete combo "${combo.name}"? This cannot be undone.`)) return;

      try {
        await deleteCombo(id);
        showAdminToast('Combo deleted successfully.', 'success');
        loadAndRenderCombos();
      } catch (err) {
        showAdminToast('Failed to delete combo: ' + err.message, 'error');
      }
    });
  });
}

function exportCombosCSV() {
  const { list } = computeCombosHubData();
  if (!list.length) {
    showAdminToast('No combo deals to export.', 'error');
    return;
  }

  const headers = ['Combo ID', 'Combo Name', 'Description', 'Selling Price (INR)', 'MRP (INR)', 'Savings %', 'Included Dishes', 'Stock Status'];
  const rows = list.map(c => {
    const itemsStr = Array.isArray(c.items) ? c.items.map(i => `${i.qty || 1}x ${i.name}`).join('; ') : '';
    const mrp = Number(c.mrp || 0);
    const price = Number(c.price || 0);
    const savPct = (mrp > price && mrp > 0) ? Math.round(((mrp - price) / mrp) * 100) + '%' : '0%';

    return [
      `"${c.id || ''}"`,
      `"${(c.name || '').replace(/"/g, '""')}"`,
      `"${(c.description || '').replace(/"/g, '""')}"`,
      `"${price.toFixed(2)}"`,
      `"${mrp ? mrp.toFixed(2) : ''}"`,
      `"${savPct}"`,
      `"${itemsStr.replace(/"/g, '""')}"`,
      `"${c.available !== false ? 'In Stock' : 'Paused'}"`
    ];
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 10);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `LIMRA_Combos_Deals_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showAdminToast('Combos catalogue exported to CSV! 📥', 'success');
}

function initCombosListeners() {
  // Status pill buttons
  $('combos-status-presets')?.querySelectorAll('.pos-cat-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      $('combos-status-presets').querySelectorAll('.pos-cat-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      comboStatusFilter = btn.dataset.status;
      renderCombosTable();
    });
  });

  // Sort & Search
  $('combos-sort-filter')?.addEventListener('change', (e) => {
    comboSort = e.target.value;
    renderCombosTable();
  });

  $('combos-search')?.addEventListener('input', (e) => {
    comboSearch = e.target.value;
    renderCombosTable();
  });

  $('combos-export-btn')?.addEventListener('click', exportCombosCSV);
}

function populateComboItemsChecklist(selectedItems = []) {
  const container = $('combo-items-checklist');
  if (!container) return;
  
  const searchInput = $('combo-items-search');
  if (searchInput) searchInput.value = '';
  
  container.innerHTML = menuItems.map(item => {
    const matched = selectedItems.find(s => s.id === item.id);
    const isChecked = !!matched;
    const qty = matched ? (matched.qty || 1) : 1;
    
    return `
      <div class="combo-item-row" data-name="${item.name.toLowerCase()}" data-category="${item.category.toLowerCase()}" style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;padding:0.25rem 0;border-bottom:1px solid rgba(255,255,255,0.03)">
        <div style="display:flex;align-items:center;gap:0.5rem;flex:1">
          <input type="checkbox" class="combo-item-checkbox" id="chk-combo-item-${item.id}" data-id="${item.id}" data-name="${item.name}" ${isChecked ? 'checked' : ''} style="cursor:pointer;width:14px;height:14px" />
          <label for="chk-combo-item-${item.id}" style="cursor:pointer;font-size:0.8rem;color:var(--adm-text)" class="select-none">
            ${item.name} <span style="color:var(--adm-muted)">(${item.category})</span>
          </label>
        </div>
        <div style="display:flex;align-items:center;gap:0.35rem">
          <span style="font-size:0.75rem;color:var(--adm-muted)">Qty:</span>
          <input type="number" class="combo-item-qty" data-id="${item.id}" min="1" max="99" value="${qty}" style="width:45px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#fff;border-radius:4px;padding:2px 4px;font-size:0.75rem;text-align:center" />
        </div>
      </div>
    `;
  }).join('');
}

function setupComboModalListeners() {
  const modal = $('adm-combo-modal');
  const form = $('adm-combo-form');
  const cancelBtn = $('combo-modal-cancel');
  const createBtn = $('btn-create-combo');
  
  if (!modal || !form || !cancelBtn) return;
  
  // Search items filter
  const itemSearch = $('combo-items-search');
  if (itemSearch) {
    itemSearch.addEventListener('input', () => {
      const query = itemSearch.value.toLowerCase().trim();
      const container = $('combo-items-checklist');
      if (container) {
        container.querySelectorAll('.combo-item-row').forEach(row => {
          const name = row.dataset.name || '';
          const category = row.dataset.category || '';
          if (name.includes(query) || category.includes(query)) {
            row.style.display = 'flex';
          } else {
            row.style.display = 'none';
          }
        });
      }
    });
  }
  
  // 1. Image upload elements
  const fileInput = $('combo-modal-file');
  const uploadBtn = $('combo-modal-upload-btn');
  const statusSpan = $('combo-modal-upload-status');
  const urlInput = $('combo-modal-img-url');
  const previewImg = $('combo-modal-img-preview');
  const placeholderImg = $('combo-modal-img-placeholder');

  // Trigger file selection on click
  uploadBtn?.addEventListener('click', () => {
    fileInput?.click();
  });

  // Handle file upload to InsForge public combos storage bucket
  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    statusSpan.textContent = 'Uploading...';
    if (uploadBtn) uploadBtn.disabled = true;

    try {
      const { data, error } = await insforge.storage.from('combos').uploadAuto(file);
      if (error) throw error;

      statusSpan.textContent = 'Uploaded successfully!';
      if (urlInput) {
        urlInput.value = data.url;
        // Trigger preview update
        if (previewImg && placeholderImg) {
          previewImg.src = data.url;
          previewImg.style.display = 'block';
          placeholderImg.style.display = 'none';
        }
      }
    } catch (err) {
      statusSpan.textContent = 'Upload failed!';
      alert('Failed to upload image: ' + err.message);
    } finally {
      if (uploadBtn) uploadBtn.disabled = false;
    }
  });

  // Handle manual URL changes for preview updates
  urlInput?.addEventListener('input', (e) => {
    const url = e.target.value.trim();
    if (previewImg && placeholderImg) {
      if (url) {
        previewImg.src = url;
        previewImg.style.display = 'block';
        placeholderImg.style.display = 'none';
      } else {
        previewImg.src = '';
        previewImg.style.display = 'none';
        placeholderImg.style.display = 'block';
      }
    }
  });

  createBtn?.addEventListener('click', () => {
    $('combo-modal-title').textContent = 'Create Combo Pack';
    $('combo-modal-id').value = '';
    $('combo-modal-name').value = '';
    $('combo-modal-desc').value = '';
    $('combo-modal-price').value = '';
    $('combo-modal-mrp').value = '';
    
    if (urlInput) urlInput.value = '';
    if (previewImg && placeholderImg) {
      previewImg.src = '';
      previewImg.style.display = 'none';
      placeholderImg.style.display = 'block';
    }
    if (fileInput) fileInput.value = '';
    if (statusSpan) statusSpan.textContent = 'No file selected';

    populateComboItemsChecklist([]);
    modal.classList.add('active');
  });
  
  cancelBtn.addEventListener('click', () => {
    modal.classList.remove('active');
  });
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const idVal = $('combo-modal-id').value;
    const id = idVal ? parseInt(idVal, 10) : null;
    const name = $('combo-modal-name').value.trim();
    const desc = $('combo-modal-desc').value.trim();
    const price = parseFloat($('combo-modal-price').value);
    const mrpVal = $('combo-modal-mrp').value ? parseFloat($('combo-modal-mrp').value) : null;
    const imageUrl = urlInput ? urlInput.value.trim() : '';
    
    if (!name) {
      alert('Please enter a combo name');
      return;
    }
    if (isNaN(price) || price <= 0) {
      alert('Please enter a valid price');
      return;
    }
    
    const selectedItems = [];
    const checkboxes = form.querySelectorAll('.combo-item-checkbox:checked');
    
    checkboxes.forEach(cb => {
      const itemId = parseInt(cb.dataset.id, 10);
      const itemName = cb.dataset.name;
      const qtyInput = form.querySelector(`.combo-item-qty[data-id="${itemId}"]`);
      const qty = qtyInput ? (parseInt(qtyInput.value, 10) || 1) : 1;
      
      selectedItems.push({
        id: itemId,
        name: itemName,
        qty: qty
      });
    });
    
    if (selectedItems.length === 0) {
      alert('Please select at least one menu item to build the combo');
      return;
    }
    
    const saveBtn = form.querySelector('button[type="submit"]');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    
    try {
      const combo = {
        name,
        description: desc,
        price,
        mrp: mrpVal,
        items: selectedItems,
        available: true,
        image_url: imageUrl || null
      };
      
      if (id) combo.id = id;
      
      await saveCombo(combo);
      modal.classList.remove('active');
      loadAndRenderCombos();
    } catch (err) {
      alert('Failed to save combo: ' + err.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Combo';
    }
  });
}

// ── Places & Charges Management ───────────────────────────

async function loadAndRenderPlaces() {
  try {
    const res = await insforge.database.from('delivery_areas').select('*').order('name', { ascending: true });
    if (res.error) throw res.error;
    adminPlaces = res.data || [];
    renderPlacesTable();
    if (typeof renderPosPlaceChips === 'function') renderPosPlaceChips();
  } catch (err) {
    console.error('Failed to load places:', err);
    showAdminToast('Failed to load delivery places.', 'error');
  }
}

function renderPlacesTable() {
  const tbody = $('places-table-body');
  if (!tbody) return;
  
  const searchQuery = ($('places-search')?.value || '').toLowerCase().trim();
  const filtered = adminPlaces.filter(p => p.name.toLowerCase().includes(searchQuery));
  
  const countSpan = $('places-count');
  if (countSpan) countSpan.textContent = adminPlaces.length;
  
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="adm-empty">No places found</td></tr>`;
    return;
  }
  
  tbody.innerHTML = filtered.map(p => {
    return `
      <tr data-place-id="${p.id}">
        <td><strong style="color:var(--adm-text)">${escapeHtml(p.name)}</strong></td>
        <td style="text-align:right; font-weight:600">₹${Number(p.charge)}</td>
        <td style="text-align:center;">
          <div style="display:flex; gap:0.5rem; justify-content:center;">
            <button class="adm-btn adm-btn-primary adm-btn-sm edit-place-btn" data-id="${p.id}">Edit</button>
            <button class="adm-btn adm-btn-danger adm-btn-sm delete-place-btn" data-id="${p.id}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
  
  // Bind actions
  tbody.querySelectorAll('.edit-place-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id, 10);
      const place = adminPlaces.find(p => p.id === id);
      if (place) {
        openPlaceModal(place);
      }
    });
  });
  
  tbody.querySelectorAll('.delete-place-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.id, 10);
      const place = adminPlaces.find(p => p.id === id);
      if (place && confirm(`Are you sure you want to delete place "${place.name}"?`)) {
        try {
          const res = await insforge.database.from('delivery_areas').delete().eq('id', id);
          if (res.error) throw res.error;
          showAdminToast('Place deleted successfully.', 'success');
          loadAndRenderPlaces();
        } catch (err) {
          alert('Failed to delete place: ' + err.message);
        }
      }
    });
  });
}

function openPlaceModal(place = null) {
  const modal = $('adm-place-modal');
  const title = $('place-modal-title');
  const idInput = $('place-modal-id');
  const nameInput = $('place-modal-name');
  const chargeInput = $('place-modal-charge');
  
  if (!modal) return;
  
  if (place) {
    title.textContent = 'Edit Place';
    idInput.value = place.id;
    nameInput.value = place.name;
    chargeInput.value = place.charge;
  } else {
    title.textContent = 'Add New Place';
    idInput.value = '';
    nameInput.value = '';
    chargeInput.value = '';
  }
  
  modal.classList.add('active');
}

function setupPlaceModalListeners() {
  const modal = $('adm-place-modal');
  const form = $('adm-place-form');
  const cancelBtn = $('place-modal-cancel');
  const searchInput = $('places-search');
  
  $('btn-create-place')?.addEventListener('click', () => openPlaceModal());
  
  cancelBtn?.addEventListener('click', () => {
    modal.classList.remove('active');
  });
  
  searchInput?.addEventListener('input', () => {
    renderPlacesTable();
  });
  
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const idVal = $('place-modal-id').value;
    const id = idVal ? parseInt(idVal, 10) : null;
    const name = $('place-modal-name').value.trim();
    const charge = parseFloat($('place-modal-charge').value);
    
    if (!name) {
      alert('Please enter a place name');
      return;
    }
    if (isNaN(charge) || charge < 0) {
      alert('Please enter a valid delivery fee');
      return;
    }
    
    const saveBtn = form.querySelector('button[type="submit"]');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    
    try {
      const payload = { name, charge };
      let res;
      if (id) {
        res = await insforge.database.from('delivery_areas').update(payload).eq('id', id);
      } else {
        res = await insforge.database.from('delivery_areas').insert([payload]);
      }
      
      if (res.error) throw res.error;
      showAdminToast('Place saved successfully.', 'success');
      modal.classList.remove('active');
      loadAndRenderPlaces();
    } catch (err) {
      alert('Failed to save place: ' + err.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Place';
    }
  });
}

// ── Coupon Share Composer Modal ─────────────────────────

function updateShareMessage() {
  const name = $('share-customer-name')?.value.trim() || 'Valued Customer';
  const code = $('share-coupon-code')?.value || '';
  const pct = $('share-coupon-pct')?.value || '';
  const min = $('share-coupon-min')?.value || '0';
  const expiry = $('share-coupon-expiry')?.value || '';
  
  const msg = `Hi *${name}*,\n\nHere is a special coupon for you: *${code}*\n\nGet ${pct}% OFF on your next order at Limra Restaurant! (Min bill: ₹${Number(min).toFixed(0)}, Exp: ${expiry}).\n\nOrder now: https://limraresturent.in/`;
  
  const desc = $('share-coupon-desc');
  if (desc) desc.value = msg;
}

function setupCouponShareModalListeners() {
  const modal = $('adm-coupon-share-modal');
  const cancelBtn = $('share-modal-cancel');
  const nameInput = $('share-customer-name');
  const whatsappBtn = $('btn-share-whatsapp');
  const copyBtn = $('btn-share-copy');
  
  if (!modal) return;
  
  cancelBtn?.addEventListener('click', () => {
    modal.classList.remove('active');
  });
  
  nameInput?.addEventListener('input', updateShareMessage);
  
  copyBtn?.addEventListener('click', () => {
    const msg = $('share-coupon-desc')?.value || '';
    
    // Robust copy to clipboard helper supporting mobile in-app browsers
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(msg).then(() => {
        showAdminToast('Promo message copied to clipboard!', 'success');
      }).catch(err => {
        fallbackCopy(msg);
      });
    } else {
      fallbackCopy(msg);
    }
  });

  function fallbackCopy(text) {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      textArea.remove();
      if (successful) {
        showAdminToast('Promo message copied to clipboard!', 'success');
      } else {
        alert('Could not copy text. Please select the text box contents manually.');
      }
    } catch (e) {
      alert('Failed to copy message: ' + e.message);
    }
  }
  
  whatsappBtn?.addEventListener('click', () => {
    const msg = $('share-coupon-desc')?.value || '';
    const rawPhone = $('share-customer-phone')?.value.trim() || '';
    
    let cleanPhone = rawPhone.replace(/\D/g, '');
    
    let waLink;
    if (cleanPhone) {
      waLink = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`;
    } else {
      waLink = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    }
    
    window.open(waLink, '_blank');
  });
}

// ════════════════════════════════════════════════════════
// PRINTER & KOT STUDIO (TVS RP3200 Plus & ESC/POS Engine)
// ════════════════════════════════════════════════════════

let printerSettings = {
  id: 'default',
  printer_model: 'TVS RP3200 Plus',
  active_printer_name: localStorage.getItem('qz-printer-name') || 'TVS RP3200 Plus',
  connection_mode: localStorage.getItem('printer-connection-mode') || 'driver',
  
  // Sizing & Dimensions (mm)
  kot_paper_width: parseFloat(localStorage.getItem('qz-paper-size-kot') || '80'),
  kot_printable_width: 72,
  kot_top_margin: 0,
  kot_bottom_feed: 3,
  kot_font_size: 'large',
  kot_auto_cut: 'partial',
  kot_item_separator: 'dashed',
  
  bill_paper_width: parseFloat(localStorage.getItem('qz-paper-size-bill') || '80'),
  bill_printable_width: 72,
  bill_top_margin: 0,
  bill_bottom_feed: 4,
  bill_auto_cut: 'full',
  
  // Branding & Taxes
  bill_show_logo: localStorage.getItem('qz-bill-show-logo') !== 'false',
  bill_logo_url: localStorage.getItem('qz-bill-logo-url') || '/images/logo.png',
  restaurant_name: localStorage.getItem('qz-bill-restaurant-name') || 'LIMRA RESTAURANT',
  restaurant_address: localStorage.getItem('qz-bill-address') || 'Main Road, Near Bus Stand, Egra',
  restaurant_phone: localStorage.getItem('qz-bill-phone') || '+91 99999 88888',
  restaurant_gstin: localStorage.getItem('qz-bill-gstin') || '',
  restaurant_fssai: localStorage.getItem('qz-bill-fssai') || '',
  cgst_rate: parseFloat(localStorage.getItem('qz-bill-cgst-rate') || '2.5'),
  sgst_rate: parseFloat(localStorage.getItem('qz-bill-sgst-rate') || '2.5'),
  bill_upi_id: localStorage.getItem('qz-bill-upi-id') || '',
  bill_upi_payee_name: localStorage.getItem('qz-bill-upi-payee-name') || 'LIMRA RESTAURANT',
  bill_footer_message: localStorage.getItem('qz-bill-footer-msg') || 'Thank you for dining with us! Please visit again.',
  
  // KOT Field Toggles
  kot_show_table: true,
  kot_show_order_type: true,
  kot_show_customer: true,
  kot_show_timestamp: true,
  kot_show_item_notes: true,
  kot_highlight_qty: true,
  kot_show_category: false,
};

let samplePreviewItems = [
  { id: '1', name: 'Chicken Biryani (Special)', qty: 2, price: 180, category: 'Biryani & Rice', notes: 'Extra spicy, with Raita' },
  { id: '2', name: 'Butter Tandoori Roti', qty: 4, price: 25, category: 'Tandoori Roti', notes: 'Hot & soft' },
  { id: '3', name: 'Campa White 500ml', qty: 2, price: 20, category: 'Cold Drinks', notes: 'Chilled' },
];

let activeStudioTab = 'kot'; // 'kot', 'bill', 'items'
let activePreviewMode = 'kot'; // 'kot' or 'bill'
let printerPanelMounted = false;

// QR Code Cache for instant preview renders
const _qrCache = new Map();
async function generateUpiQrDataUrl(upiId, payeeName, amount, billNo) {
  if (!upiId || !upiId.trim()) return '';
  const cleanUpi = upiId.trim();
  const cleanName = encodeURIComponent(payeeName || 'LIMRA RESTAURANT');
  const cleanAmount = Number(amount || 0).toFixed(2);
  const upiUrl = `upi://pay?pa=${cleanUpi}&pn=${cleanName}&am=${cleanAmount}&cu=INR&tn=Bill_${billNo || '101'}`;
  
  if (_qrCache.has(upiUrl)) return _qrCache.get(upiUrl);

  try {
    const dataUrl = await QRCode.toDataURL(upiUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 140,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
    _qrCache.set(upiUrl, dataUrl);
    return dataUrl;
  } catch (err) {
    console.error('Failed to generate UPI QR code:', err);
    return '';
  }
}

function printViaNativeDriver(receiptHtml, widthMm = 80) {
  return new Promise((resolve) => {
    let frame = document.getElementById('thermal-native-print-frame');
    if (!frame) {
      frame = document.createElement('iframe');
      frame.id = 'thermal-native-print-frame';
      frame.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;';
      document.body.appendChild(frame);
    }

    const isA4 = String(widthMm) === 'A4';
    const paperWidthCss = isA4 ? '210mm' : `${widthMm || 80}mm`;
    const printableWidthCss = isA4 ? '190mm' : `${Math.max(48, (widthMm || 80) - 8)}mm`;

    const docHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Receipt Print</title>
        <style>
          @page {
            size: ${paperWidthCss} auto;
            margin: 0;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          html, body {
            margin: 0;
            padding: 0;
            width: ${paperWidthCss};
            background: #fff;
            color: #000;
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
            line-height: 1.35;
          }
          .thermal-print-wrapper {
            width: ${printableWidthCss};
            margin: 0 auto;
            padding: 2mm 0;
          }
        </style>
      </head>
      <body>
        <div class="thermal-print-wrapper">
          ${receiptHtml}
        </div>
      </body>
      </html>
    `;

    const doc = frame.contentWindow.document;
    doc.open();
    doc.write(docHtml);
    doc.close();

    setTimeout(() => {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
        resolve(true);
      } catch (err) {
        console.error('[Native Driver Print] Error:', err);
        window.print();
        resolve(true);
      }
    }, 150);
  });
}

function updatePrinterPanelStatus() {
  const badge = document.getElementById('printer-studio-status-badge');
  const msgEl = document.getElementById('printer-panel-status-msg');
  const qzWrap = document.getElementById('qz-controls-wrap');
  if (!badge) return;

  const mode = printerSettings.connection_mode || 'driver';
  if (qzWrap) qzWrap.style.display = mode === 'qz_tray' ? 'inline-flex' : 'none';

  if (mode === 'driver') {
    badge.textContent = '🟢 Native Driver Active';
    badge.style.background = '#ecfdf5';
    badge.style.color = '#059669';
    badge.style.borderColor = '#a7f3d0';
    if (msgEl) msgEl.textContent = 'Direct Windows Driver Spooler · 80mm Roll · Maximum Sharpness & Silent Kiosk Mode';
  } else {
    const isConn = (typeof qz !== 'undefined') && qz.websocket.isActive() && qzConnected;
    if (isConn) {
      badge.textContent = `🟢 QZ Tray Connected (${activePrinter || 'TVS RP3200 Plus'})`;
      badge.style.background = '#ecfdf5';
      badge.style.color = '#059669';
      badge.style.borderColor = '#a7f3d0';
      if (msgEl) msgEl.textContent = `Active Printer: ${activePrinter} · Connected via QZ Tray WebSocket`;
    } else {
      badge.textContent = '🔌 QZ Tray Disconnected';
      badge.style.background = '#fef2f2';
      badge.style.color = '#ef4444';
      badge.style.borderColor = '#fca5a5';
      if (msgEl) msgEl.textContent = 'QZ Tray not running on PC. Launch QZ Tray or switch to Native Driver.';
    }
  }
}

async function loadPrinterSettingsFromDB() {
  try {
    const { data } = await insforge.database.from('printer_settings').select('*').eq('id', 'default').maybeSingle();
    if (data) {
      printerSettings = { ...printerSettings, ...data };
      syncPrinterSettingsToUI();
      await renderThermalLivePreview();
    }
  } catch (err) {
    console.warn('[Printer] Load from DB error (using cache):', err);
  }
}

function syncPrinterSettingsToUI() {
  // Connection Mode
  const modeSel = document.getElementById('printer-connection-mode');
  if (modeSel) modeSel.value = printerSettings.connection_mode || 'driver';

  // Sizing & Sizing inputs
  const kotCustom = document.getElementById('kot-custom-width');
  if (kotCustom) kotCustom.value = printerSettings.kot_paper_width || 80;
  const kotCut = document.getElementById('kot-auto-cut');
  if (kotCut) kotCut.value = printerSettings.kot_auto_cut || 'partial';
  const kotFeed = document.getElementById('kot-bottom-feed');
  if (kotFeed) kotFeed.value = printerSettings.kot_bottom_feed || 3;
  const kotFont = document.getElementById('kot-font-size');
  if (kotFont) kotFont.value = printerSettings.kot_font_size || 'large';
  const kotSep = document.getElementById('kot-item-separator');
  if (kotSep) kotSep.value = printerSettings.kot_item_separator || 'dashed';

  // KOT Toggles
  const chkTable = document.getElementById('kot-toggle-table');
  if (chkTable) chkTable.checked = printerSettings.kot_show_table ?? true;
  const chkType = document.getElementById('kot-toggle-order-type');
  if (chkType) chkType.checked = printerSettings.kot_show_order_type ?? true;
  const chkCust = document.getElementById('kot-toggle-customer');
  if (chkCust) chkCust.checked = printerSettings.kot_show_customer ?? true;
  const chkTime = document.getElementById('kot-toggle-time');
  if (chkTime) chkTime.checked = printerSettings.kot_show_timestamp ?? true;
  const chkNotes = document.getElementById('kot-toggle-notes');
  if (chkNotes) chkNotes.checked = printerSettings.kot_show_item_notes ?? true;
  const chkQty = document.getElementById('kot-toggle-highlight-qty');
  if (chkQty) chkQty.checked = printerSettings.kot_highlight_qty ?? true;
  const chkCat = document.getElementById('kot-toggle-category');
  if (chkCat) chkCat.checked = printerSettings.kot_show_category ?? false;

  // Bill Sizing & Branding
  const billCustom = document.getElementById('bill-custom-width');
  if (billCustom) billCustom.value = printerSettings.bill_paper_width || 80;
  const billCut = document.getElementById('bill-auto-cut');
  if (billCut) billCut.value = printerSettings.bill_auto_cut || 'full';
  const billFeed = document.getElementById('bill-bottom-feed');
  if (billFeed) billFeed.value = printerSettings.bill_bottom_feed || 4;

  const chkLogo = document.getElementById('bill-show-logo');
  if (chkLogo) chkLogo.checked = printerSettings.bill_show_logo ?? true;
  const logoUrlInp = document.getElementById('bill-logo-url');
  if (logoUrlInp) logoUrlInp.value = printerSettings.bill_logo_url || '/images/logo.png';

  const bName = document.getElementById('bill-restaurant-name');
  if (bName) bName.value = printerSettings.restaurant_name || 'LIMRA RESTAURANT';
  const bPhone = document.getElementById('bill-phone');
  if (bPhone) bPhone.value = printerSettings.restaurant_phone || '+91 99999 88888';
  const bAddr = document.getElementById('bill-address');
  if (bAddr) bAddr.value = printerSettings.restaurant_address || 'Main Road, Near Bus Stand, Egra';
  const bGstin = document.getElementById('bill-gstin');
  if (bGstin) bGstin.value = printerSettings.restaurant_gstin || '';
  const bFssai = document.getElementById('bill-fssai');
  if (bFssai) bFssai.value = printerSettings.restaurant_fssai || '';
  const bCgst = document.getElementById('bill-cgst-rate');
  if (bCgst) bCgst.value = printerSettings.cgst_rate ?? 2.5;
  const bSgst = document.getElementById('bill-sgst-rate');
  if (bSgst) bSgst.value = printerSettings.sgst_rate ?? 2.5;
  const bUpi = document.getElementById('bill-upi-id');
  if (bUpi) bUpi.value = printerSettings.bill_upi_id || '';
  const bUpiName = document.getElementById('bill-upi-payee-name');
  if (bUpiName) bUpiName.value = printerSettings.bill_upi_payee_name || 'LIMRA RESTAURANT';
  const bFooter = document.getElementById('bill-footer-msg');
  if (bFooter) bFooter.value = printerSettings.bill_footer_message || 'Thank you for dining with us! Please visit again.';

  updatePresetButtonsUI();
  updatePrinterPanelStatus();
}

function readPrinterSettingsFromUI() {
  printerSettings.connection_mode = document.getElementById('printer-connection-mode')?.value || 'driver';
  printerSettings.kot_paper_width = parseFloat(document.getElementById('kot-custom-width')?.value || '80');
  printerSettings.kot_auto_cut = document.getElementById('kot-auto-cut')?.value || 'partial';
  printerSettings.kot_bottom_feed = parseInt(document.getElementById('kot-bottom-feed')?.value || '3');
  printerSettings.kot_font_size = document.getElementById('kot-font-size')?.value || 'large';
  printerSettings.kot_item_separator = document.getElementById('kot-item-separator')?.value || 'dashed';

  printerSettings.kot_show_table = document.getElementById('kot-toggle-table')?.checked ?? true;
  printerSettings.kot_show_order_type = document.getElementById('kot-toggle-order-type')?.checked ?? true;
  printerSettings.kot_show_customer = document.getElementById('kot-toggle-customer')?.checked ?? true;
  printerSettings.kot_show_timestamp = document.getElementById('kot-toggle-time')?.checked ?? true;
  printerSettings.kot_show_item_notes = document.getElementById('kot-toggle-notes')?.checked ?? true;
  printerSettings.kot_highlight_qty = document.getElementById('kot-toggle-highlight-qty')?.checked ?? true;
  printerSettings.kot_show_category = document.getElementById('kot-toggle-category')?.checked ?? false;

  const billWVal = document.getElementById('bill-custom-width')?.value;
  printerSettings.bill_paper_width = billWVal === 'A4' ? 'A4' : parseFloat(billWVal || '80');
  printerSettings.bill_auto_cut = document.getElementById('bill-auto-cut')?.value || 'full';
  printerSettings.bill_bottom_feed = parseInt(document.getElementById('bill-bottom-feed')?.value || '4');

  printerSettings.bill_show_logo = document.getElementById('bill-show-logo')?.checked ?? true;
  printerSettings.bill_logo_url = document.getElementById('bill-logo-url')?.value?.trim() || '/images/logo.png';
  printerSettings.restaurant_name = document.getElementById('bill-restaurant-name')?.value?.trim() || 'LIMRA RESTAURANT';
  printerSettings.restaurant_phone = document.getElementById('bill-phone')?.value?.trim() || '';
  printerSettings.restaurant_address = document.getElementById('bill-address')?.value?.trim() || '';
  printerSettings.restaurant_gstin = document.getElementById('bill-gstin')?.value?.trim() || '';
  printerSettings.restaurant_fssai = document.getElementById('bill-fssai')?.value?.trim() || '';
  printerSettings.cgst_rate = parseFloat(document.getElementById('bill-cgst-rate')?.value || '2.5');
  printerSettings.sgst_rate = parseFloat(document.getElementById('bill-sgst-rate')?.value || '2.5');
  printerSettings.bill_upi_id = document.getElementById('bill-upi-id')?.value?.trim() || '';
  printerSettings.bill_upi_payee_name = document.getElementById('bill-upi-payee-name')?.value?.trim() || 'LIMRA RESTAURANT';
  printerSettings.bill_footer_message = document.getElementById('bill-footer-msg')?.value?.trim() || 'Thank you for dining with us! Please visit again.';
}

async function savePrinterSettingsToDB() {
  readPrinterSettingsFromUI();

  // Save to localStorage
  localStorage.setItem('printer-connection-mode', printerSettings.connection_mode || 'driver');
  localStorage.setItem('qz-printer-name', printerSettings.active_printer_name || '');
  localStorage.setItem('qz-paper-size-kot', String(printerSettings.kot_paper_width || '80'));
  localStorage.setItem('qz-paper-size-bill', String(printerSettings.bill_paper_width || '80'));
  localStorage.setItem('qz-bill-show-logo', String(printerSettings.bill_show_logo));
  localStorage.setItem('qz-bill-logo-url', printerSettings.bill_logo_url);
  localStorage.setItem('qz-bill-restaurant-name', printerSettings.restaurant_name);
  localStorage.setItem('qz-bill-address', printerSettings.restaurant_address);
  localStorage.setItem('qz-bill-phone', printerSettings.restaurant_phone);
  localStorage.setItem('qz-bill-gstin', printerSettings.restaurant_gstin);
  localStorage.setItem('qz-bill-fssai', printerSettings.restaurant_fssai);
  localStorage.setItem('qz-bill-cgst-rate', String(printerSettings.cgst_rate));
  localStorage.setItem('qz-bill-sgst-rate', String(printerSettings.sgst_rate));
  localStorage.setItem('qz-bill-upi-id', printerSettings.bill_upi_id);
  localStorage.setItem('qz-bill-upi-payee-name', printerSettings.bill_upi_payee_name);
  localStorage.setItem('qz-bill-footer-msg', printerSettings.bill_footer_message);

  await renderThermalLivePreview();

  try {
    await insforge.database.from('printer_settings').upsert([{
      ...printerSettings,
      id: 'default',
      updated_at: new Date().toISOString()
    }]);
    showAdminToast('Printer & KOT settings saved to database! 💾', 'success');
  } catch (err) {
    console.error('[Printer] Save to DB error:', err);
    showAdminToast('Settings saved locally. (DB warning: ' + err.message + ')', 'warning');
  }
}

function updatePresetButtonsUI() {
  document.querySelectorAll('.kot-w-preset').forEach(btn => {
    const isSel = String(btn.dataset.width) === String(printerSettings.kot_paper_width);
    btn.className = isSel ? 'kot-w-preset adm-btn adm-btn-primary adm-btn-sm' : 'kot-w-preset adm-btn adm-btn-outline adm-btn-sm';
  });

  document.querySelectorAll('.bill-w-preset').forEach(btn => {
    const isSel = String(btn.dataset.width) === String(printerSettings.bill_paper_width);
    btn.className = isSel ? 'bill-w-preset adm-btn adm-btn-primary adm-btn-sm' : 'bill-w-preset adm-btn adm-btn-outline adm-btn-sm';
  });
}

function getSeparatorLineHtml(style) {
  if (style === 'solid') return '<div style="border-top:1px solid #000;margin:6px 0;"></div>';
  if (style === 'double') return '<div style="border-top:3px double #000;margin:6px 0;"></div>';
  if (style === 'stars') return '<div style="text-align:center;letter-spacing:3px;font-size:10px;margin:5px 0;">* * * * * * * * * *</div>';
  return '<div style="border-top:1px dashed #000;margin:6px 0;"></div>';
}

async function renderThermalLivePreview() {
  const canvas = document.getElementById('thermal-preview-canvas');
  const badge = document.getElementById('preview-dim-badge');
  if (!canvas) return;

  const isKot = activePreviewMode === 'kot';
  const widthMm = isKot ? (printerSettings.kot_paper_width || 80) : (printerSettings.bill_paper_width || 80);
  const isA4 = String(widthMm) === 'A4';
  const widthPx = isA4 ? 380 : Math.max(180, Math.min(380, Math.round(widthMm * 3.54)));

  canvas.style.width = `${widthPx}px`;
  if (badge) badge.textContent = `${isA4 ? 'A4' : widthMm + 'mm'} (${widthPx}px)`;

  const mockOrder = {
    order_number: 108,
    customer_name: 'Imran Khan',
    customer_phone: '+91 98765 43210',
    order_type: 'table',
    table_number: '04',
    created_at: new Date().toISOString(),
    payment_status: 'paid',
    notes: '[TABLE: 04] [PAYMENT: UPI] [DISCOUNT_PCT: 10%] [DISCOUNT_AMT: 50.00] Please serve hot',
    total_amount: 471.5
  };

  if (isKot) {
    canvas.innerHTML = generateKOTPreviewHtml(mockOrder, samplePreviewItems);
  } else {
    canvas.innerHTML = await generateBillPreviewHtml(mockOrder, samplePreviewItems);
  }
}

function generateKOTPreviewHtml(order, items) {
  const p = printerSettings;
  const sep = getSeparatorLineHtml(p.kot_item_separator);
  const fontSize = p.kot_font_size === 'xlarge' ? '16px' : (p.kot_font_size === 'medium' ? '12px' : '14px');
  const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const itemsHtml = items.map(i => `
    <div style="padding:4px 0;border-bottom:1px dashed #e2e8f0;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <span style="font-weight:700;font-size:${fontSize};">${escapeHtml(i.name)}</span>
        <span style="font-weight:900;font-size:${fontSize};${p.kot_highlight_qty ? 'background:#000;color:#fff;padding:0 5px;border-radius:2px;' : ''}">x${i.qty}</span>
      </div>
      ${p.kot_show_item_notes && i.notes ? `<div style="font-size:10px;font-style:italic;color:#444;margin-top:2px;">↳ Note: ${escapeHtml(i.notes)}</div>` : ''}
    </div>
  `).join('');

  const feedSpaces = '<br/>'.repeat(Math.max(1, p.kot_bottom_feed || 3));

  return `
    <div style="text-align:center;padding-bottom:4px;">
      <div style="font-size:15px;font-weight:900;letter-spacing:1px;">** KOT - KITCHEN ORDER **</div>
      <div style="font-size:10px;margin-top:2px;">TVS RP3200 Plus ESC/POS Ticket</div>
    </div>
    ${sep}
    <div style="font-size:11px;line-height:1.5;">
      <div style="display:flex;justify-content:space-between;">
        <span><strong>Order #:</strong> ${formatDailyOrderNumber(order)}</span>
        ${p.kot_show_timestamp ? `<span><strong>Time:</strong> ${timeStr}</span>` : ''}
      </div>
      ${p.kot_show_table ? `<div style="margin-top:3px;font-size:13px;font-weight:900;background:#f1f5f9;padding:2px 4px;border:1px solid #cbd5e1;border-radius:3px;">🪑 TABLE: ${order.table_number || '01'}</div>` : ''}
      ${p.kot_show_order_type ? `<div><strong>Type:</strong> ${order.order_type.toUpperCase()}</div>` : ''}
      ${p.kot_show_customer ? `<div><strong>Customer:</strong> ${escapeHtml(order.customer_name)}</div>` : ''}
    </div>
    ${sep}
    <div>${itemsHtml}</div>
    ${sep}
    <div style="text-align:center;font-size:10px;font-weight:bold;margin-top:4px;">— CHEF COPY —</div>
    ${feedSpaces}
    <div style="border-top:1px dashed #94a3b8;margin-top:8px;padding-top:4px;font-size:9px;color:#64748b;text-align:center;">
      ✂ - - - - ${p.kot_auto_cut === 'full' ? 'Full Cut' : (p.kot_auto_cut === 'none' ? 'Manual Tear' : 'Partial Cut')} - - - - ✂
    </div>
  `;
}

async function generateBillPreviewHtml(order, items) {
  const p = printerSettings;
  const sep = '<div style="border-top:1px dashed #000;margin:6px 0;"></div>';
  
  // Filter out any non-food items
  const foodItems = items.filter(i => !/delivery|discount|tax|fee/i.test(i.item_name || i.name || ''));
  const subtotal = foodItems.reduce((s, i) => s + (i.price * i.qty), 0);
  
  // Sample 10% discount for preview demonstration if items match mock
  const discountPct = 10;
  const discountAmt = subtotal * (discountPct / 100);
  const taxable = Math.max(0, subtotal - discountAmt);
  const cgst = taxable * (p.cgst_rate || 2.5) / 100;
  const sgst = taxable * (p.sgst_rate || 2.5) / 100;
  const grandTotal = taxable + cgst + sgst;
  const timeStr = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });

  const rows = foodItems.map(i => `
    <tr>
      <td style="padding:3px 2px;font-size:11px;font-weight:600;">${escapeHtml(i.name || i.item_name)}</td>
      <td style="padding:3px 2px;font-size:11px;text-align:center;">${i.qty || i.quantity}</td>
      <td style="padding:3px 2px;font-size:11px;text-align:right;">₹${Number(i.price || i.unit_price).toFixed(2)}</td>
      <td style="padding:3px 2px;font-size:11px;text-align:right;font-weight:700;">₹${Number((i.price || i.unit_price)*(i.qty || i.quantity)).toFixed(2)}</td>
    </tr>
  `).join('');

  const feedSpaces = '<br/>'.repeat(Math.max(1, p.bill_bottom_feed || 4));

  // Dynamic QR Code data URL with exact pre-filled grand total
  const qrDataUrl = p.bill_upi_id ? await generateUpiQrDataUrl(p.bill_upi_id, p.bill_upi_payee_name || p.restaurant_name, grandTotal, formatDailyOrderNumber(order)) : '';

  return `
    <div style="text-align:center;">
      ${p.bill_show_logo && p.bill_logo_url ? `
        <div style="margin-bottom:6px;text-align:center;">
          <img src="${p.bill_logo_url}" alt="Logo" style="max-height:48px;max-width:140px;margin:0 auto;display:block;filter:grayscale(100%) contrast(180%);" />
        </div>
      ` : ''}
      <div style="font-size:16px;font-weight:900;letter-spacing:1px;">${escapeHtml(p.restaurant_name)}</div>
      ${p.restaurant_address ? `<div style="font-size:10px;margin-top:2px;">${escapeHtml(p.restaurant_address)}</div>` : ''}
      ${p.restaurant_phone ? `<div style="font-size:10px;">Tel: ${escapeHtml(p.restaurant_phone)}</div>` : ''}
      ${p.restaurant_gstin ? `<div style="font-size:10px;">GSTIN: ${escapeHtml(p.restaurant_gstin)}</div>` : ''}
      ${p.restaurant_fssai ? `<div style="font-size:10px;">FSSAI Lic: ${escapeHtml(p.restaurant_fssai)}</div>` : ''}
      <div style="font-size:12px;font-weight:bold;margin-top:6px;padding:3px 0;border-top:1px solid #000;border-bottom:1px solid #000;">
        TAX INVOICE — TABLE ${order.table_number || '01'}
      </div>
    </div>

    <div style="font-size:10px;line-height:1.5;margin-top:6px;">
      <div><strong>Bill #:</strong> ${formatDailyOrderNumber(order)} | <strong>Date:</strong> ${timeStr}</div>
      <div><strong>Customer:</strong> ${escapeHtml(order.customer_name)} (${order.customer_phone})</div>
    </div>

    ${sep}
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="border-bottom:1px solid #000;">
          <th style="text-align:left;font-size:10px;padding:2px;">Item</th>
          <th style="text-align:center;font-size:10px;padding:2px;width:25px;">Qty</th>
          <th style="text-align:right;font-size:10px;padding:2px;width:45px;">Rate</th>
          <th style="text-align:right;font-size:10px;padding:2px;width:55px;">Amt</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    ${sep}

    <div style="font-size:11px;line-height:1.6;">
      <div style="display:flex;justify-content:space-between;"><span>Items Subtotal:</span><span>₹${subtotal.toFixed(2)}</span></div>
      ${discountAmt > 0 ? `
        <div style="display:flex;justify-content:space-between;color:#000;"><span>Discount (${discountPct}%):</span><span>-₹${discountAmt.toFixed(2)}</span></div>
        <div style="display:flex;justify-content:space-between;"><span>Net Taxable:</span><span>₹${taxable.toFixed(2)}</span></div>
      ` : ''}
      <div style="display:flex;justify-content:space-between;"><span>CGST @${p.cgst_rate}%:</span><span>₹${cgst.toFixed(2)}</span></div>
      <div style="display:flex;justify-content:space-between;"><span>SGST @${p.sgst_rate}%:</span><span>₹${sgst.toFixed(2)}</span></div>
      <div style="display:flex;justify-content:space-between;font-weight:900;font-size:14px;border-top:1px solid #000;margin-top:4px;padding-top:4px;">
        <span>GRAND TOTAL:</span><span>₹${grandTotal.toFixed(2)}</span>
      </div>
    </div>

    ${p.bill_upi_id ? `
      ${sep}
      <div style="text-align:center;padding:4px 0;">
        <div style="font-size:11px;font-weight:900;letter-spacing:.5px;">📱 SCAN &amp; PAY VIA UPI</div>
        <div style="font-size:9px;margin:2px 0 4px 0;">Exact Amount: <strong>₹${grandTotal.toFixed(2)}</strong> (Auto-Filled)</div>
        ${qrDataUrl ? `<img src="${qrDataUrl}" alt="UPI QR" style="width:125px;height:125px;margin:2px auto;display:block;image-rendering:pixelated;" />` : ''}
        <div style="font-size:9px;color:#333;margin-top:2px;">UPI ID: <strong>${escapeHtml(p.bill_upi_id)}</strong></div>
        <div style="font-size:8px;color:#555;margin-top:1px;">PhonePe · Google Pay · Paytm · BHIM</div>
      </div>
    ` : ''}

    ${sep}
    <div style="text-align:center;font-size:10px;line-height:1.4;">
      <div style="font-weight:bold;">${escapeHtml(p.bill_footer_message)}</div>
      <div style="font-size:9px;color:#444;margin-top:2px;">${escapeHtml(p.restaurant_name)}</div>
    </div>

    ${feedSpaces}
    <div style="border-top:1px dashed #94a3b8;margin-top:8px;padding-top:4px;font-size:9px;color:#64748b;text-align:center;">
      ✂ - - - - ${p.bill_auto_cut === 'full' ? 'Full Cut' : 'Partial Cut'} - - - - ✂
    </div>
  `;
}

function renderSampleItemsEditor() {
  const listEl = document.getElementById('sample-items-list');
  if (!listEl) return;

  listEl.innerHTML = samplePreviewItems.map((item, idx) => `
    <div style="display:flex;align-items:center;gap:.5rem;padding:.4rem;background:#f8fafc;border:1px solid var(--adm-border);border-radius:8px;">
      <input type="text" class="adm-input" value="${escapeHtml(item.name)}" style="flex:2;font-size:.8rem;padding:.25rem .5rem;" onchange="samplePreviewItems[${idx}].name=this.value;renderThermalLivePreview();" />
      <input type="number" class="adm-input" value="${item.qty}" min="1" style="width:50px;font-size:.8rem;padding:.25rem .3rem;" onchange="samplePreviewItems[${idx}].qty=parseInt(this.value)||1;renderThermalLivePreview();" />
      <input type="number" class="adm-input" value="${item.price}" min="0" step="1" style="width:65px;font-size:.8rem;padding:.25rem .3rem;" onchange="samplePreviewItems[${idx}].price=parseFloat(this.value)||0;renderThermalLivePreview();" />
      <button onclick="samplePreviewItems.splice(${idx},1);renderSampleItemsEditor();renderThermalLivePreview();" style="color:#ef4444;background:none;border:none;cursor:pointer;font-size:1rem;">✕</button>
    </div>
  `).join('');
}

async function initPrinterPanel() {
  const container = document.getElementById('settings-subtab-printer');
  if (container && !document.getElementById('panel-printer')) {
    const tpl = document.getElementById('panel-printer-content');
    if (tpl) {
      container.appendChild(tpl.content.cloneNode(true));
      const p = document.getElementById('panel-printer');
      if (p) p.classList.add('active');
    }
  } else if (!container && !document.getElementById('panel-printer')) {
    const admc = document.getElementById('adm-content');
    const tpl = document.getElementById('panel-printer-content');
    if (tpl && admc) admc.appendChild(tpl.content.cloneNode(true));
  }
  const prn = document.getElementById('panel-printer');
  if (prn) prn.classList.add('active');

  updatePrinterPanelStatus();
  await loadPrinterSettingsFromDB();
  syncPrinterSettingsToUI();
  renderSampleItemsEditor();
  await renderThermalLivePreview();

  if (printerPanelMounted) return;
  printerPanelMounted = true;

  // Print Mode Switcher (Driver vs QZ Tray)
  document.getElementById('printer-connection-mode')?.addEventListener('change', (e) => {
    printerSettings.connection_mode = e.target.value;
    localStorage.setItem('printer-connection-mode', printerSettings.connection_mode);
    updatePrinterPanelStatus();
    showAdminToast(`Print mode switched to: ${printerSettings.connection_mode === 'driver' ? 'Windows TVS Driver (Direct)' : 'QZ Tray'}`, 'info');
  });

  // QZ Tray Connection Button
  document.getElementById('printer-connect-btn')?.addEventListener('click', async () => {
    showAdminToast('Connecting to QZ Tray…', 'info');
    await initQZTray();
    updatePrinterPanelStatus();
    if (qzConnected) {
      showAdminToast('QZ Tray connected! Detecting TVS RP3200 Plus… ✅', 'success');
      document.getElementById('printer-select-btn')?.click();
    } else {
      showAdminToast('Could not connect to QZ Tray. Please ensure QZ Tray is running.', 'error');
    }
  });

  // Printer Detection Dropdown
  document.getElementById('printer-select-btn')?.addEventListener('click', async () => {
    if (!qzConnected) {
      await initQZTray();
      if (!qzConnected) { showAdminToast('Please launch and connect QZ Tray first.', 'error'); return; }
    }
    try {
      const printers = await qz.printers.find();
      const listSel = document.getElementById('printer-list-select');
      if (!listSel) return;
      listSel.innerHTML = printers.map(p => `<option value="${p}" ${p === activePrinter || p.includes('TVS') || p.includes('3200') || p.includes('POS') ? 'selected' : ''}>${p}</option>`).join('');
      if (listSel.value) {
        activePrinter = listSel.value;
        printerSettings.active_printer_name = listSel.value;
        localStorage.setItem('qz-printer-name', activePrinter);
        updatePrinterStatusBadge('connected', activePrinter);
        updatePrinterPanelStatus();
      }
      showAdminToast(`Found ${printers.length} printer(s) ✅`, 'success');
    } catch(e) {
      showAdminToast('Failed to list printers: ' + e.message, 'error');
    }
  });

  document.getElementById('printer-list-select')?.addEventListener('change', (e) => {
    activePrinter = e.target.value;
    printerSettings.active_printer_name = activePrinter;
    localStorage.setItem('qz-printer-name', activePrinter);
    updatePrinterStatusBadge('connected', activePrinter);
    updatePrinterPanelStatus();
  });

  // Editor Tabs
  const tabKot = document.getElementById('tab-btn-kot');
  const tabBill = document.getElementById('tab-btn-bill');
  const tabItems = document.getElementById('tab-btn-items');
  const secKot = document.getElementById('editor-section-kot');
  const secBill = document.getElementById('editor-section-bill');
  const secItems = document.getElementById('editor-section-items');

  tabKot?.addEventListener('click', () => {
    activeStudioTab = 'kot';
    tabKot.className = 'adm-btn adm-btn-primary adm-btn-sm';
    tabBill.className = 'adm-btn adm-btn-outline adm-btn-sm';
    tabItems.className = 'adm-btn adm-btn-outline adm-btn-sm';
    secKot.style.display = 'block';
    secBill.style.display = 'none';
    secItems.style.display = 'none';
    document.getElementById('btn-preview-mode-kot')?.click();
  });

  tabBill?.addEventListener('click', () => {
    activeStudioTab = 'bill';
    tabBill.className = 'adm-btn adm-btn-primary adm-btn-sm';
    tabKot.className = 'adm-btn adm-btn-outline adm-btn-sm';
    tabItems.className = 'adm-btn adm-btn-outline adm-btn-sm';
    secBill.style.display = 'block';
    secKot.style.display = 'none';
    secItems.style.display = 'none';
    document.getElementById('btn-preview-mode-bill')?.click();
  });

  tabItems?.addEventListener('click', () => {
    activeStudioTab = 'items';
    tabItems.className = 'adm-btn adm-btn-primary adm-btn-sm';
    tabKot.className = 'adm-btn adm-btn-outline adm-btn-sm';
    tabBill.className = 'adm-btn adm-btn-outline adm-btn-sm';
    secItems.style.display = 'block';
    secKot.style.display = 'none';
    secBill.style.display = 'none';
  });

  // Preview Switcher
  const btnPrevKot = document.getElementById('btn-preview-mode-kot');
  const btnPrevBill = document.getElementById('btn-preview-mode-bill');

  btnPrevKot?.addEventListener('click', async () => {
    activePreviewMode = 'kot';
    btnPrevKot.className = 'adm-btn adm-btn-primary adm-btn-sm';
    btnPrevBill.className = 'adm-btn adm-btn-outline adm-btn-sm';
    await renderThermalLivePreview();
  });

  btnPrevBill?.addEventListener('click', async () => {
    activePreviewMode = 'bill';
    btnPrevBill.className = 'adm-btn adm-btn-primary adm-btn-sm';
    btnPrevKot.className = 'adm-btn adm-btn-outline adm-btn-sm';
    await renderThermalLivePreview();
  });

  // KOT Preset Buttons
  document.querySelectorAll('.kot-w-preset').forEach(btn => {
    btn.addEventListener('click', async () => {
      printerSettings.kot_paper_width = parseFloat(btn.dataset.width);
      const customInp = document.getElementById('kot-custom-width');
      if (customInp) customInp.value = btn.dataset.width;
      updatePresetButtonsUI();
      await renderThermalLivePreview();
    });
  });

  // Bill Preset Buttons
  document.querySelectorAll('.bill-w-preset').forEach(btn => {
    btn.addEventListener('click', async () => {
      printerSettings.bill_paper_width = btn.dataset.width === 'A4' ? 'A4' : parseFloat(btn.dataset.width);
      const customInp = document.getElementById('bill-custom-width');
      if (customInp) customInp.value = btn.dataset.width;
      updatePresetButtonsUI();
      await renderThermalLivePreview();
    });
  });

  // Live input change listeners for instant canvas update
  const bindLiveInput = (id, callback) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', async () => { callback(); await renderThermalLivePreview(); });
    el.addEventListener('change', async () => { callback(); await renderThermalLivePreview(); });
  };

  bindLiveInput('kot-custom-width', () => { printerSettings.kot_paper_width = parseFloat(document.getElementById('kot-custom-width').value || '80'); updatePresetButtonsUI(); });
  bindLiveInput('kot-auto-cut', () => { printerSettings.kot_auto_cut = document.getElementById('kot-auto-cut').value; });
  bindLiveInput('kot-bottom-feed', () => { printerSettings.kot_bottom_feed = parseInt(document.getElementById('kot-bottom-feed').value || '3'); });
  bindLiveInput('kot-font-size', () => { printerSettings.kot_font_size = document.getElementById('kot-font-size').value; });
  bindLiveInput('kot-item-separator', () => { printerSettings.kot_item_separator = document.getElementById('kot-item-separator').value; });

  bindLiveInput('kot-toggle-table', () => { printerSettings.kot_show_table = document.getElementById('kot-toggle-table').checked; });
  bindLiveInput('kot-toggle-order-type', () => { printerSettings.kot_show_order_type = document.getElementById('kot-toggle-order-type').checked; });
  bindLiveInput('kot-toggle-customer', () => { printerSettings.kot_show_customer = document.getElementById('kot-toggle-customer').checked; });
  bindLiveInput('kot-toggle-time', () => { printerSettings.kot_show_timestamp = document.getElementById('kot-toggle-time').checked; });
  bindLiveInput('kot-toggle-notes', () => { printerSettings.kot_show_item_notes = document.getElementById('kot-toggle-notes').checked; });
  bindLiveInput('kot-toggle-highlight-qty', () => { printerSettings.kot_highlight_qty = document.getElementById('kot-toggle-highlight-qty').checked; });
  bindLiveInput('kot-toggle-category', () => { printerSettings.kot_show_category = document.getElementById('kot-toggle-category').checked; });

  bindLiveInput('bill-custom-width', () => { printerSettings.bill_paper_width = document.getElementById('bill-custom-width').value; updatePresetButtonsUI(); });
  bindLiveInput('bill-auto-cut', () => { printerSettings.bill_auto_cut = document.getElementById('bill-auto-cut').value; });
  bindLiveInput('bill-bottom-feed', () => { printerSettings.bill_bottom_feed = parseInt(document.getElementById('bill-bottom-feed').value || '4'); });
  bindLiveInput('bill-show-logo', () => { printerSettings.bill_show_logo = document.getElementById('bill-show-logo').checked; });
  bindLiveInput('bill-logo-url', () => { printerSettings.bill_logo_url = document.getElementById('bill-logo-url').value; });
  bindLiveInput('bill-restaurant-name', () => { printerSettings.restaurant_name = document.getElementById('bill-restaurant-name').value; });
  bindLiveInput('bill-phone', () => { printerSettings.restaurant_phone = document.getElementById('bill-phone').value; });
  bindLiveInput('bill-address', () => { printerSettings.restaurant_address = document.getElementById('bill-address').value; });
  bindLiveInput('bill-gstin', () => { printerSettings.restaurant_gstin = document.getElementById('bill-gstin').value; });
  bindLiveInput('bill-fssai', () => { printerSettings.restaurant_fssai = document.getElementById('bill-fssai').value; });
  bindLiveInput('bill-cgst-rate', () => { printerSettings.cgst_rate = parseFloat(document.getElementById('bill-cgst-rate').value || '2.5'); });
  bindLiveInput('bill-sgst-rate', () => { printerSettings.sgst_rate = parseFloat(document.getElementById('bill-sgst-rate').value || '2.5'); });
  bindLiveInput('bill-upi-id', () => { printerSettings.bill_upi_id = document.getElementById('bill-upi-id').value; });
  bindLiveInput('bill-upi-payee-name', () => { printerSettings.bill_upi_payee_name = document.getElementById('bill-upi-payee-name').value; });
  bindLiveInput('bill-footer-msg', () => { printerSettings.bill_footer_message = document.getElementById('bill-footer-msg').value; });

  // Add Sample Item Button
  document.getElementById('btn-add-sample-item')?.addEventListener('click', async () => {
    samplePreviewItems.push({
      id: String(Date.now()),
      name: 'New Menu Item',
      qty: 1,
      price: 100,
      category: 'Food',
      notes: ''
    });
    renderSampleItemsEditor();
    await renderThermalLivePreview();
  });

  // Save to Database Button
  document.getElementById('printer-save-db-btn')?.addEventListener('click', savePrinterSettingsToDB);

  // Test Print Hardware Button
  document.getElementById('printer-test-hardware-btn')?.addEventListener('click', async () => {
    const ps = printerSettings.bill_paper_width || 80;
    const html = `<div style="text-align:center;padding:4px 0;"><div style="font-size:16px;font-weight:900;">${escapeHtml(printerSettings.restaurant_name)}</div><div style="font-size:10px;margin-top:2px;">TVS RP3200 Plus Driver Test</div><div style="border-top:1px dashed #000;margin:6px 0;"></div><div style="font-size:11px;text-align:left;line-height:1.5;"><div>Method: <strong>${printerSettings.connection_mode === 'driver' ? 'Windows TVS Driver (Direct)' : 'QZ Tray'}</strong></div><div>Paper Roll: <strong>${ps} mm</strong></div><div>Date: <strong>${new Date().toLocaleString('en-IN')}</strong></div></div><div style="border-top:1px dashed #000;margin:6px 0;"></div><div style="font-weight:bold;">Printer Connected & Calibrated! ✅</div><br/><br/></div>`;

    if (printerSettings.connection_mode === 'qz_tray' && qzConnected && activePrinter) {
      try {
        const wPx = ps === 'A4' ? 595 : Math.round(parseInt(ps) * 2.835);
        const doc = `<div style="width:${wPx}px;font-family:monospace;font-size:12px;color:#000;padding:0 8px;margin:0 auto;">${html}</div>`;
        await qz.print(qz.configs.create(activePrinter), [{ type: 'pixel', format: 'html', flavor: 'plain', data: doc }]);
        showAdminToast('Test print sent via QZ Tray! ✅', 'success');
        return;
      } catch(e) { console.warn('QZ print failed, trying driver print:', e); }
    }

    // Default: Native Driver
    await printViaNativeDriver(html, ps);
    showAdminToast('Test receipt sent to TVS RP3200 Plus Driver! ✅', 'success');
  });

  // Print Active Sample (KOT or Bill)
  document.getElementById('btn-print-sample-active')?.addEventListener('click', async () => {
    const isKot = activePreviewMode === 'kot';
    const widthMm = isKot ? (printerSettings.kot_paper_width || 80) : (printerSettings.bill_paper_width || 80);
    const canvas = document.getElementById('thermal-preview-canvas');
    const innerHtml = canvas ? canvas.innerHTML : '';

    if (printerSettings.connection_mode === 'qz_tray' && qzConnected && activePrinter) {
      try {
        const wPx = widthMm === 'A4' ? 595 : Math.round(parseInt(widthMm) * 2.835);
        const printDoc = `<div style="width:${wPx}px;font-family:monospace;font-size:12px;color:#000;padding:0 6px;margin:0 auto;">${innerHtml}</div>`;
        await qz.print(qz.configs.create(activePrinter), [{ type: 'pixel', format: 'html', flavor: 'plain', data: printDoc }]);
        showAdminToast(`Sample ${isKot ? 'KOT' : 'Bill'} sent via QZ Tray! 🖨️`, 'success');
        return;
      } catch(e) { console.warn('QZ print failed, trying driver print:', e); }
    }

    // Default: Native Driver
    await printViaNativeDriver(innerHtml, widthMm);
    showAdminToast(`Sample ${isKot ? 'KOT' : 'Bill'} sent to TVS RP3200 Plus Driver! 🖨️`, 'success');
  });

  // Copy Preview HTML
  document.getElementById('btn-copy-preview-html')?.addEventListener('click', () => {
    const canvas = document.getElementById('thermal-preview-canvas');
    if (canvas && navigator.clipboard) {
      navigator.clipboard.writeText(canvas.innerHTML);
      showAdminToast('Copied preview HTML to clipboard! 📋', 'success');
    }
  });
}


// ════════════════════════════════════════════════════════
// GOOGLE PROFILE MANAGER PANEL
// ════════════════════════════════════════════════════════
let profilePanelMounted = false;

function getGoogleBusinessProfile() {
  try {
    const raw = localStorage.getItem('limra_google_business_profile');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {
    name: 'LIMRA RESTAURANT',
    category: 'Mughlai & Biryani Restaurant',
    reviewUrl: 'https://g.page/r/limra-restaurant/review',
    mapsUrl: 'https://maps.google.com/?q=LIMRA+Restaurant',
    hours: '11:00 AM – 11:30 PM (Daily)',
    phone: '+91 99999 88888',
    address: 'Main Road, Near Bus Stand, Egra, West Bengal',
    rating: '4.8',
    reviewsCount: '348',
    viewsCount: '12.4k',
    status: 'Verified ✓'
  };
}

function renderGoogleBusinessProfileUI() {
  const profile = getGoogleBusinessProfile();
  
  if ($('gprofile-kpi-rating')) $('gprofile-kpi-rating').textContent = `${profile.rating} ⭐`;
  if ($('gprofile-kpi-reviews')) $('gprofile-kpi-reviews').textContent = `${profile.reviewsCount} Reviews`;
  if ($('gprofile-kpi-views')) $('gprofile-kpi-views').textContent = `${profile.viewsCount} Views/mo`;
  if ($('gprofile-kpi-status')) $('gprofile-kpi-status').textContent = profile.status || 'Verified ✓';

  if ($('gbiz-name')) $('gbiz-name').value = profile.name || 'LIMRA RESTAURANT';
  if ($('gbiz-category')) $('gbiz-category').value = profile.category || 'Mughlai & Biryani Restaurant';
  if ($('gbiz-review-url')) $('gbiz-review-url').value = profile.reviewUrl || 'https://g.page/r/limra-restaurant/review';
  if ($('gbiz-maps-url')) $('gbiz-maps-url').value = profile.mapsUrl || 'https://maps.google.com/?q=LIMRA+Restaurant';
  if ($('gbiz-hours')) $('gbiz-hours').value = profile.hours || '11:00 AM – 11:30 PM (Daily)';
  if ($('gbiz-phone')) $('gbiz-phone').value = profile.phone || '+91 99999 88888';
  if ($('gbiz-address')) $('gbiz-address').value = profile.address || 'Main Road, Near Bus Stand, Egra, West Bengal';
}

function renderProfileInfo(user) {
  if (!user) return;
  const meta = user.user_metadata || {};
  const appMeta = user.app_metadata || {};
  const savedPhoto = localStorage.getItem('admin-profile-photo') || '';
  const photoUrl = savedPhoto || meta.avatar_url || meta.picture || meta.photo_url || '';
  const imgEl  = document.getElementById('profile-avatar-img');
  const initEl = document.getElementById('profile-avatar-initials');
  if (imgEl && initEl) {
    if (photoUrl) { imgEl.src = photoUrl; imgEl.style.display = 'block'; initEl.style.display = 'none'; }
    else { imgEl.style.display = 'none'; initEl.style.display = 'block'; initEl.textContent = (meta.full_name || user.email || 'A').charAt(0).toUpperCase(); }
  }
  const savedName = localStorage.getItem('admin-display-name') || '';
  const displayName = savedName || meta.full_name || meta.name || (user.email||'').split('@')[0] || 'Admin';
  ['profile-display-name'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = displayName; });
  const emailEl = document.getElementById('profile-email-display');
  if (emailEl) emailEl.textContent = user.email || '—';
  const nameInp = document.getElementById('profile-name-input'); if (nameInp) nameInp.value = displayName;
  const emailInp= document.getElementById('profile-email-input'); if (emailInp) emailInp.value = user.email || '';
  const photoInp= document.getElementById('profile-photo-input'); if (photoInp) photoInp.value = photoUrl;
  const provLabel = document.getElementById('profile-provider-label');
  const provList = appMeta.providers || (appMeta.provider ? [appMeta.provider] : ['email']);
  if (provLabel) provLabel.textContent = provList.includes('google') ? 'Google Authenticated' : provList.join(', ');
  const grid = document.getElementById('profile-info-grid');
  if (grid) {
    const row = (l,v) => `<div style="display:flex;justify-content:space-between;gap:1rem;"><span style="font-size:0.78rem;color:var(--adm-muted);font-weight:600;">${l}</span><span style="font-size:0.82rem;font-weight:700;word-break:break-all;">${v||'—'}</span></div><hr style="border:none;border-top:1px solid var(--adm-border);margin:.2rem 0;">`;
    grid.innerHTML = [
      row('User ID', (user.id||'').slice(0,18)+'…'),
      row('Email', user.email),
      row('Signed Up', user.created_at ? new Date(user.created_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—'),
      row('Last Login', user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '—'),
      row('Auth Provider', provList.join(', ')),
      row('Role', user.role || 'authenticated'),
    ].join('');
  }
}

async function initProfilePanel() {
  const container = document.getElementById('settings-subtab-profile');
  if (container && !document.getElementById('panel-profile')) {
    const tpl = document.getElementById('panel-profile-content');
    if (tpl) {
      container.appendChild(tpl.content.cloneNode(true));
      const p = document.getElementById('panel-profile');
      if (p) p.classList.add('active');
    }
  } else if (!container && !document.getElementById('panel-profile')) {
    const admc = document.getElementById('adm-content');
    const tpl = document.getElementById('panel-profile-content');
    if (tpl && admc) admc.appendChild(tpl.content.cloneNode(true));
  }
  const prof = document.getElementById('panel-profile');
  if (prof) prof.classList.add('active');

  // Render Google Business Profile info
  renderGoogleBusinessProfileUI();

  try { const { data } = await insforge.auth.getCurrentUser(); if (data?.user) renderProfileInfo(data.user); } catch(e) {}
  if (profilePanelMounted) return;
  profilePanelMounted = true;

  // 1. Save Business Profile Listing
  document.getElementById('gprofile-save-biz-btn')?.addEventListener('click', () => {
    const updated = {
      name: document.getElementById('gbiz-name')?.value?.trim() || 'LIMRA RESTAURANT',
      category: document.getElementById('gbiz-category')?.value?.trim() || 'Mughlai & Biryani Restaurant',
      reviewUrl: document.getElementById('gbiz-review-url')?.value?.trim() || 'https://g.page/r/limra-restaurant/review',
      mapsUrl: document.getElementById('gbiz-maps-url')?.value?.trim() || 'https://maps.google.com/?q=LIMRA+Restaurant',
      hours: document.getElementById('gbiz-hours')?.value?.trim() || '11:00 AM – 11:30 PM (Daily)',
      phone: document.getElementById('gbiz-phone')?.value?.trim() || '+91 99999 88888',
      address: document.getElementById('gbiz-address')?.value?.trim() || 'Main Road, Near Bus Stand, Egra, West Bengal',
      rating: '4.8',
      reviewsCount: '348',
      viewsCount: '12.4k',
      status: 'Verified ✓'
    };
    localStorage.setItem('limra_google_business_profile', JSON.stringify(updated));
    renderGoogleBusinessProfileUI();
    showAdminToast('Google Business Profile details saved! ✅', 'success');
  });

  // 2. Copy Review Link
  document.getElementById('gbiz-copy-review-link')?.addEventListener('click', () => {
    const url = document.getElementById('gbiz-review-url')?.value?.trim() || 'https://g.page/r/limra-restaurant/review';
    navigator.clipboard.writeText(url);
    showAdminToast('Google Review link copied to clipboard! 📋', 'info');
  });

  // 3. View on Google Maps
  document.getElementById('gprofile-open-maps-btn')?.addEventListener('click', () => {
    const url = document.getElementById('gbiz-maps-url')?.value?.trim() || 'https://maps.google.com/?q=LIMRA+Restaurant';
    window.open(url, '_blank');
  });

  // 4. Boost Google Reviews via WhatsApp
  document.getElementById('gprofile-boost-reviews-btn')?.addEventListener('click', () => {
    const profile = getGoogleBusinessProfile();
    const message = encodeURIComponent(
      `Hello! Thank you for dining with us at ${profile.name}! 🍽️\n\nWe would truly appreciate 10 seconds of your time to share your experience with a 5-star rating on Google Maps:\n⭐ ${profile.reviewUrl}\n\nThank you for your support!`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  });

  // 5. Copy Smart AI Replies
  document.querySelectorAll('.btn-copy-review-reply').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.name || 'Valued Guest';
      const profile = getGoogleBusinessProfile();
      const replyText = `Dear ${name}, thank you so much for the 5-star rating and kind feedback! We are thrilled that you had a wonderful dining experience at ${profile.name}. We look forward to welcoming you back soon! 🍽️✨`;
      navigator.clipboard.writeText(replyText);
      btn.textContent = '✓ Copied Reply!';
      setTimeout(() => { btn.textContent = '📋 Copy Smart Reply'; }, 2000);
      showAdminToast(`Smart reply for ${name} copied to clipboard! 📋`, 'info');
    });
  });

  // 6. Admin Profile Name Save
  document.getElementById('profile-name-save')?.addEventListener('click', () => {
    const v = document.getElementById('profile-name-input')?.value?.trim();
    if (!v) return;
    localStorage.setItem('admin-display-name', v);
    ['admin-greeting'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = `Hello, ${v}`; });
    showAdminToast('Display name saved locally! ✅', 'success');
  });

  // 7. Admin Profile Photo Save
  document.getElementById('profile-photo-save')?.addEventListener('click', () => {
    const v = document.getElementById('profile-photo-input')?.value?.trim();
    localStorage.setItem('admin-profile-photo', v);
    const imgEl = document.getElementById('profile-avatar-img');
    const initEl = document.getElementById('profile-avatar-initials');
    if (imgEl && initEl) {
      if (v) { imgEl.src = v; imgEl.style.display = 'block'; initEl.style.display = 'none'; }
      else { imgEl.style.display = 'none'; initEl.style.display = 'block'; }
    }
    showAdminToast('Profile photo updated! ✅', 'success');
  });

  // 8. Refresh Session
  document.getElementById('profile-refresh-btn')?.addEventListener('click', async () => {
    try {
      const { data } = await insforge.auth.getCurrentUser();
      if (data?.user) {
        renderProfileInfo(data.user);
        renderGoogleBusinessProfileUI();
        showAdminToast('Profile refreshed ✅', 'success');
      }
    } catch(e) {
      showAdminToast('Could not refresh: ' + e.message, 'error');
    }
  });
}
// ════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════
// POS BILLING PANEL & TOTAL BILLS OVERVIEW
// ════════════════════════════════════════════════════════

let posCart = []; // [{ id, name, price, qty }]
let posOrderType = 'table';
let posBillingMounted = false;
let allFoodsCache = [];
let posActiveCat = "all";
let posSelectedPlace = null; // { id, name, charge }

function renderPosPlaceChips() {
  const container = $('pos-quick-places-pills');
  if (!container) return;
  if (!adminPlaces || adminPlaces.length === 0) {
    container.innerHTML = '<span style="font-size:.72rem;color:var(--adm-muted);">No saved places found in database</span>';
    return;
  }
  container.innerHTML = adminPlaces.slice(0, 12).map(p => {
    const charge = parseFloat(p.charge || p.delivery_charge || p.delivery_fee || 0);
    const isSelected = posSelectedPlace && posSelectedPlace.name.toLowerCase() === p.name.toLowerCase();
    return `
      <button type="button" class="adm-btn adm-btn-outline adm-btn-sm pos-place-chip-btn ${isSelected ? 'active' : ''}" data-name="${escapeHtml(p.name)}" data-charge="${charge}" style="font-size:.75rem;padding:.2rem .5rem;border-radius:999px;cursor:pointer;${isSelected ? 'background:#e0e7ff;border-color:#6366f1;color:#4338ca;font-weight:700;' : ''}">
        📍 ${escapeHtml(p.name)} <span style="color:${isSelected ? '#4338ca' : '#059669'};font-weight:700;">(₹${charge})</span>
      </button>
    `;
  }).join('');

  container.querySelectorAll('.pos-place-chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.name;
      const charge = parseFloat(btn.dataset.charge || '0');
      selectPosPlace({ name, charge });
    });
  });
}

function selectPosPlace(place) {
  if (!place) return;
  posSelectedPlace = place;
  const searchInp = $('pos-place-search');
  const chip = $('pos-selected-place-chip');
  const chipText = $('pos-selected-place-text');
  const feeInp = $('pos-delivery-fee');
  const suggs = $('pos-place-suggestions');

  if (searchInp) {
    searchInp.value = place.name;
    searchInp.classList.remove('pos-input-invalid');
  }
  if (chip && chipText) {
    chipText.innerHTML = `📍 <strong>${escapeHtml(place.name)}</strong> — Delivery Charge: <strong>₹${Number(place.charge).toFixed(0)}</strong>`;
    chip.style.display = 'flex';
  }
  if (feeInp) {
    feeInp.value = place.charge;
  }
  if (suggs) suggs.style.display = 'none';

  renderPosPlaceChips();
  updatePosCartUI();
}

function clearPosSelectedPlace() {
  posSelectedPlace = null;
  const searchInp = $('pos-place-search');
  const chip = $('pos-selected-place-chip');
  const feeInp = $('pos-delivery-fee');
  const suggs = $('pos-place-suggestions');

  if (searchInp) searchInp.value = '';
  if (chip) chip.style.display = 'none';
  if (feeInp) feeInp.value = '0';
  if (suggs) suggs.style.display = 'none';

  renderPosPlaceChips();
  updatePosCartUI();
}

function initPosPlaceSearch() {
  const searchInp = $('pos-place-search');
  const suggs = $('pos-place-suggestions');
  const clearBtn = $('pos-clear-place-btn');

  if (searchInp && suggs) {
    searchInp.addEventListener('input', () => {
      const q = searchInp.value.toLowerCase().trim();
      if (!q) {
        suggs.style.display = 'none';
        return;
      }
      const matches = adminPlaces.filter(p => p.name && p.name.toLowerCase().includes(q));
      if (!matches.length) {
        suggs.innerHTML = `
          <div style="padding:.6rem .75rem;font-size:.8rem;color:var(--adm-muted);">
            No registered place found matching "<strong>${escapeHtml(q)}</strong>".
            <div style="margin-top:4px;font-size:.75rem;color:#6366f1;">(You can still type custom landmark/address below)</div>
          </div>
        `;
        suggs.style.display = 'block';
        return;
      }

      suggs.innerHTML = matches.map(p => {
        const charge = parseFloat(p.charge || p.delivery_charge || p.delivery_fee || 0);
        return `
          <div class="pos-place-sugg-item" data-name="${escapeHtml(p.name)}" data-charge="${charge}" style="padding:.55rem .75rem;cursor:pointer;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;transition:background .15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">
            <div>
              <span style="font-weight:700;font-size:.85rem;color:#1e293b;">📍 ${escapeHtml(p.name)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:.4rem;">
              <span style="font-size:.78rem;font-weight:700;color:#059669;background:#ecfdf5;padding:.1rem .4rem;border-radius:4px;">₹${charge} fee</span>
              <span style="font-size:.75rem;color:#6366f1;font-weight:600;">Select ➔</span>
            </div>
          </div>
        `;
      }).join('');
      suggs.style.display = 'block';

      suggs.querySelectorAll('.pos-place-sugg-item').forEach(item => {
        item.addEventListener('click', () => {
          const name = item.dataset.name;
          const charge = parseFloat(item.dataset.charge || '0');
          selectPosPlace({ name, charge });
        });
      });
    });

    // Close suggestions on outside click
    document.addEventListener('click', (e) => {
      if (!searchInp.contains(e.target) && !suggs.contains(e.target)) {
        suggs.style.display = 'none';
      }
    });
  }

  clearBtn?.addEventListener('click', clearPosSelectedPlace);
}

function getBillSettings() {
  return {
    restaurantName: localStorage.getItem('qz-bill-restaurant-name') || 'LIMRA RESTAURANT',
    address: localStorage.getItem('qz-bill-address') || 'Main Road, Near Bus Stand, Egra',
    phone: localStorage.getItem('qz-bill-phone') || '+91 99999 88888',
    gstin: localStorage.getItem('qz-bill-gstin') || '',
    cgstRate: parseFloat(localStorage.getItem('qz-bill-cgst-rate') || '2.5'),
    sgstRate: parseFloat(localStorage.getItem('qz-bill-sgst-rate') || '2.5'),
    billPaperSize: parseInt(localStorage.getItem('qz-paper-size-bill') || localStorage.getItem('qz-paper-size') || '80'),
    kotPaperSize: parseInt(localStorage.getItem('qz-paper-size-kot') || '80'),
  };
}

function getPosCartTotals() {
  const s = getBillSettings();
  const subtotal = posCart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const discountPct = parseFloat($('pos-discount-pct')?.value || '0') || 0;
  const discountAmt = subtotal * (discountPct / 100);
  const taxable = Math.max(0, subtotal - discountAmt);
  const cgst = taxable * (s.cgstRate / 100);
  const sgst = taxable * (s.sgstRate / 100);
  const deliveryFee = posOrderType === 'delivery' ? (parseFloat($('pos-delivery-fee')?.value || '0') || 0) : 0;
  const grand = taxable + cgst + sgst + deliveryFee;
  return { 
    subtotal, 
    discountPct, 
    discountAmt, 
    taxable, 
    cgst, 
    sgst, 
    deliveryFee, 
    grand, 
    cgstRate: s.cgstRate, 
    sgstRate: s.sgstRate 
  };
}

function updatePosCartUI() {
  const cartEl = $('pos-cart-items');
  if (!cartEl) return;

  if (posCart.length === 0) {
    cartEl.innerHTML = '<p style="color:var(--adm-muted);font-size:.85rem;text-align:center;padding:1rem;">No items added yet</p>';
  } else {
    cartEl.innerHTML = posCart.map((item, idx) => `
      <div style="display:flex;align-items:center;gap:.5rem;padding:.45rem 0;border-bottom:1px solid var(--adm-border);">
        <div style="flex:1;">
          <div style="font-size:.85rem;font-weight:700;color:#111827;line-height:1.2;">${escapeHtml(item.name)}</div>
          <div style="font-size:.75rem;color:var(--adm-muted);margin-top:2px;">₹${item.price.toFixed(2)} each</div>
        </div>
        <div style="display:flex;align-items:center;gap:.25rem;">
          <button type="button" onclick="posChangeQty(${idx},-1)" style="width:24px;height:24px;border:1px solid var(--adm-border);border-radius:6px;background:#f9fafb;cursor:pointer;font-size:.85rem;display:flex;align-items:center;justify-content:center;font-weight:bold;">−</button>
          <span style="min-width:22px;text-align:center;font-weight:800;font-size:.85rem;">${item.qty}</span>
          <button type="button" onclick="posChangeQty(${idx},1)" style="width:24px;height:24px;border:1px solid var(--adm-border);border-radius:6px;background:#f9fafb;cursor:pointer;font-size:.85rem;display:flex;align-items:center;justify-content:center;font-weight:bold;">+</button>
          <button type="button" onclick="posRemoveItem(${idx})" style="width:24px;height:24px;border:1px solid #fca5a5;border-radius:6px;background:#fef2f2;cursor:pointer;color:#ef4444;font-size:.8rem;display:flex;align-items:center;justify-content:center;" title="Remove">✕</button>
        </div>
        <span style="min-width:60px;text-align:right;font-weight:800;font-size:.88rem;color:#111827;">₹${(item.price*item.qty).toFixed(2)}</span>
      </div>
    `).join('');
  }

  const t = getPosCartTotals();
  if ($('pos-subtotal')) $('pos-subtotal').textContent = `₹${t.subtotal.toFixed(2)}`;
  if ($('pos-discount-pct-label')) $('pos-discount-pct-label').textContent = t.discountPct;
  if ($('pos-discount-show')) $('pos-discount-show').textContent = `-₹${t.discountAmt.toFixed(2)}`;
  if ($('pos-discount-calc-preview')) $('pos-discount-calc-preview').textContent = t.discountPct > 0 ? `-₹${t.discountAmt.toFixed(2)} (${t.discountPct}%)` : '-₹0.00';
  
  const discRow = $('pos-discount-row');
  if (discRow) discRow.style.display = t.discountAmt > 0 ? 'flex' : 'none';

  const taxRow = $('pos-taxable-row');
  if (taxRow) {
    taxRow.style.display = t.discountAmt > 0 ? 'flex' : 'none';
    if ($('pos-taxable-amt')) $('pos-taxable-amt').textContent = `₹${t.taxable.toFixed(2)}`;
  }

  if ($('pos-cgst-rate-label')) $('pos-cgst-rate-label').textContent = t.cgstRate;
  if ($('pos-sgst-rate-label')) $('pos-sgst-rate-label').textContent = t.sgstRate;
  if ($('pos-cgst-amt')) $('pos-cgst-amt').textContent = `₹${t.cgst.toFixed(2)}`;
  if ($('pos-sgst-amt')) $('pos-sgst-amt').textContent = `₹${t.sgst.toFixed(2)}`;
  
  const delFeeWrap = $('pos-delivery-fee-wrap');
  if (delFeeWrap) delFeeWrap.style.display = posOrderType === 'delivery' ? 'block' : 'none';
  const delRow = $('pos-delivery-charge-row');
  if (delRow) {
    delRow.style.display = (posOrderType === 'delivery' && t.deliveryFee > 0) ? 'flex' : 'none';
    if ($('pos-delivery-charge-show')) $('pos-delivery-charge-show').textContent = `₹${t.deliveryFee.toFixed(2)}`;
  }

  if ($('pos-grand-total')) $('pos-grand-total').textContent = `₹${t.grand.toFixed(2)}`;

  // Re-render food grid to update in-cart badges
  renderFoodGrid($('pos-food-search')?.value);
}

window.posChangeQty = function(idx, delta) {
  posCart[idx].qty = Math.max(1, posCart[idx].qty + delta);
  updatePosCartUI();
};
window.posRemoveItem = function(idx) {
  posCart.splice(idx, 1);
  updatePosCartUI();
};

function loadFoodsCache() {
  allFoodsCache = menuItems;
  return menuItems;
}

function addItemToPosCart(food) {
  const existing = posCart.find(i => (food.id && i.id === food.id) || i.name.toLowerCase() === food.name.toLowerCase());
  if (existing) {
    existing.qty++;
  } else {
    posCart.push({ id: food.id || null, name: food.name, price: food.price, qty: 1 });
  }
  updatePosCartUI();
  showAdminToast(`Added "${food.name}" to cart 🛒`, 'success');
}

// ── Strict Validation & Order Saving ───────────────────────────
async function buildOrderFromPos(action) {
  if (posCart.length === 0) {
    showAdminToast('Please add at least one food item to the cart.', 'error');
    return null;
  }

  // 1. Mandatory Customer Name Validation
  const nameInp = $('pos-customer-name');
  const name = nameInp?.value?.trim() || '';
  if (!name) {
    nameInp?.classList.add('pos-input-invalid');
    nameInp?.focus();
    showAdminToast('Customer Name is mandatory. Please enter customer name.', 'error');
    return null;
  } else {
    nameInp?.classList.remove('pos-input-invalid');
  }

  // 2. Mandatory Mobile Number Validation (min 10 digits)
  const phoneInp = $('pos-customer-phone');
  const phone = phoneInp?.value?.trim() || '';
  const digitsOnly = phone.replace(/[^0-9]/g, '');
  if (!phone || digitsOnly.length < 10) {
    phoneInp?.classList.add('pos-input-invalid');
    phoneInp?.focus();
    showAdminToast('A valid 10-digit mobile number is mandatory.', 'error');
    return null;
  } else {
    phoneInp?.classList.remove('pos-input-invalid');
  }

  // 3. Conditional Mandatory Table Number for Dine-in
  const tableInp = $('pos-table-number');
  const tableNum = tableInp?.value?.trim() || '';
  if (posOrderType === 'table' && !tableNum) {
    tableInp?.classList.add('pos-input-invalid');
    tableInp?.focus();
    showAdminToast('Dining Table Number is mandatory for Dine-in orders.', 'error');
    return null;
  } else if (tableInp) {
    tableInp.classList.remove('pos-input-invalid');
  }

  // 4. Conditional Mandatory Place / Address for Delivery
  const placeSearchInp = $('pos-place-search');
  const addressInp = $('pos-delivery-address');
  const selectedPlaceName = posSelectedPlace ? posSelectedPlace.name : (placeSearchInp?.value?.trim() || '');
  const specificAddr = addressInp?.value?.trim() || '';
  const fullDeliveryAddress = selectedPlaceName && specificAddr ? `${selectedPlaceName} - ${specificAddr}` : (selectedPlaceName || specificAddr);

  if (posOrderType === 'delivery' && !fullDeliveryAddress) {
    if (placeSearchInp) placeSearchInp.classList.add('pos-input-invalid');
    if (addressInp) addressInp.classList.add('pos-input-invalid');
    placeSearchInp?.focus();
    showAdminToast('Please search & select a delivery place or enter delivery address.', 'error');
    return null;
  } else {
    placeSearchInp?.classList.remove('pos-input-invalid');
    addressInp?.classList.remove('pos-input-invalid');
  }

  const payMode = $('pos-payment-mode')?.value || 'cash';
  const notes = $('pos-notes')?.value?.trim() || '';
  const t = getPosCartTotals();

  let notesStr = '';
  if (posOrderType === 'table') notesStr = `[TABLE: ${tableNum}]`;
  else if (posOrderType === 'delivery') notesStr = `[DELIVERY] Place: ${selectedPlaceName || 'N/A'} | Address: ${fullDeliveryAddress} | Delivery charge: ₹${t.deliveryFee.toFixed(2)} [DELIVERY_FEE: ${t.deliveryFee}]`;
  else notesStr = '[SELF PICKUP]';

  if (t.discountPct > 0) {
    notesStr += ` [DISCOUNT_PCT: ${t.discountPct}%] [DISCOUNT_AMT: ${t.discountAmt.toFixed(2)}]`;
  }
  notesStr += ` [PAYMENT: ${payMode}] [CGST: ${t.cgstRate}%] [SGST: ${t.sgstRate}%]`;
  if (notes) notesStr += ` ${notes}`;

  const nextDailyNum = getTodayDailyOrderNumber();
  const orderData = {
    order_number: nextDailyNum,
    customer_name: name,
    customer_phone: phone,
    order_type: posOrderType,
    table_number: posOrderType === 'table' ? (parseInt(String(tableNum).replace(/\D/g, ''), 10) || null) : null,
    total_amount: t.grand,
    status: action === 'hold' ? 'hold' : (action === 'bill' ? 'delivered' : 'confirmed'),
    payment_status: payMode === 'pay_later' ? 'unpaid' : (action === 'hold' ? 'unpaid' : 'paid'),
    notes: notesStr,
  };

  try {
    const { data: orderRes, error: orderErr } = await insforge.database.from('orders').insert([orderData]).select().single();
    if (orderErr) throw orderErr;
    const newOrder = orderRes;

    // Save only food items (NO discount or delivery items in order_items)
    const itemRows = posCart.map(i => ({
      order_id: newOrder.id,
      item_name: i.name,
      quantity: i.qty,
      unit_price: i.price,
      line_total: i.price * i.qty,
      menu_item_id: i.id || null,
    }));
    const { error: itemsErr } = await insforge.database.from('order_items').insert(itemRows);
    if (itemsErr) throw itemsErr;

    orders.unshift(newOrder);
    orderItems.push(...itemRows.map((r, idx) => ({ ...r, id: `temp-${idx}` })));

    // Refresh UI
    renderBillingQuickCards();
    renderBillingTotalBills();
    renderHoldOrdersPanel();
    renderOverview();

    return { order: newOrder, items: posCart.map(i => ({ item_name: i.name, quantity: i.qty, unit_price: i.price, line_total: i.price * i.qty })) };
  } catch(e) {
    showAdminToast('Failed to save order: ' + e.message, 'error');
    return null;
  }
}

async function generateKOTHtml(order, items, isNewItemsOnly = false) {
  const p = printerSettings;
  const kotWidth = p.kot_paper_width || 80;
  const wPx = kotWidth === 'A4' ? 595 : Math.round(parseInt(kotWidth) * 2.835);
  const parsedMeta = parseNotesMetadata(order.notes, order);
  const tableInfo = parsedMeta.tableNumber || order.table_number || '';
  const formattedTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  const fontSize = p.kot_font_size === 'xlarge' ? '16px' : (p.kot_font_size === 'medium' ? '12px' : '14px');
  const sep = getSeparatorLineHtml(p.kot_item_separator);

  const itemsHtml = items.map(i => `
    <div style="padding:4px 0;border-bottom:1px dashed #000;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <span style="font-weight:700;font-size:${fontSize};">${escapeHtml(i.item_name || i.name)}</span>
        <span style="font-weight:900;font-size:${fontSize};${p.kot_highlight_qty ? 'border:1px solid #000;padding:0 4px;' : ''}">x${i.quantity || i.qty}</span>
      </div>
      ${p.kot_show_item_notes && (i.notes || parsedMeta.notes) ? `<div style="font-size:10px;font-style:italic;margin-top:2px;">↳ Note: ${escapeHtml(i.notes || parsedMeta.notes)}</div>` : ''}
    </div>
  `).join('');

  const feedSpaces = '<br/>'.repeat(Math.max(1, p.kot_bottom_feed || 3));

  return `<div style="width:${wPx}px;font-family:monospace;font-size:12px;color:#000;padding:0 6px;margin:0 auto;">
    <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:8px;">
      <div style="font-size:15px;font-weight:900;letter-spacing:1px;">** KOT - KITCHEN ORDER **</div>
      <div style="font-size:11px;font-weight:bold;">${isNewItemsOnly ? '(ADDITIONAL ITEMS)' : 'TVS RP3200 PLUS ESC/POS'}</div>
    </div>
    <div style="font-size:11px;line-height:1.5;margin-bottom:6px;">
      <div style="display:flex;justify-content:space-between;">
        <span><strong>Order #:</strong> ${formatDailyOrderNumber(order)}</span>
        ${p.kot_show_timestamp ? `<span><strong>Time:</strong> ${formattedTime}</span>` : ''}
      </div>
      ${p.kot_show_table && tableInfo ? `<div style="margin-top:3px;font-size:13px;font-weight:900;border:1px solid #000;padding:2px 4px;text-align:center;">🪑 TABLE: ${tableInfo}</div>` : ''}
      ${p.kot_show_order_type ? `<div><strong>Type:</strong> ${parsedMeta.type === 'table' ? (tableInfo ? `Table ${tableInfo}` : 'Dine-in') : (parsedMeta.type === 'delivery' ? 'DELIVERY' : 'PICKUP')}</div>` : ''}
      ${p.kot_show_customer ? `<div><strong>Customer:</strong> ${escapeHtml(order.customer_name || 'Walk-in')}</div>` : ''}
    </div>
    ${sep}
    <div>${itemsHtml}</div>
    ${sep}
    <div style="text-align:center;font-size:11px;font-weight:bold;margin-top:6px;">— KITCHEN COPY —</div>
    ${feedSpaces}
  </div>`;
}

async function printKOT(order, items, isNewOnly = false) {
  const p = printerSettings;
  const html = await generateKOTHtml(order, items, isNewOnly);

  if (p.connection_mode === 'qz_tray') {
    if (typeof qz !== 'undefined' && qzConnected && activePrinter) {
      try {
        const config = qz.configs.create(activePrinter);
        await qz.print(config, [{ type: 'pixel', format: 'html', flavor: 'plain', data: html }]);
        showAdminToast('KOT sent via QZ Tray! 🖨️', 'success');
        return;
      } catch(e) { console.warn('QZ Tray print failed, falling back to Native Driver:', e); }
    }
  }

  // Default: Native Driver (Direct Windows Spooler / Silent Kiosk)
  await printViaNativeDriver(html, p.kot_paper_width || 80);
  showAdminToast('KOT sent to TVS RP3200 Plus Driver! 🖨️', 'success');
}

async function generateBillWithTaxHtml(order, itemsList) {
  const p = printerSettings;
  const wPx = p.bill_paper_width === 'A4' ? 595 : Math.round(parseInt(p.bill_paper_width || 80) * 2.835);
  const parsedMeta = parseNotesMetadata(order.notes, order);
  const allItems = itemsList || getItemsForOrder(order.id);
  
  // Strictly filter items to food & drinks only
  const items = allItems.filter(i => !/delivery|discount|tax|fee/i.test(i.item_name || i.name || ''));
  const subtotal = items.reduce((sum, i) => sum + Number(i.line_total || (i.price * i.qty) || 0), 0);
  
  // Parse discount, taxes, and delivery charges from metadata or calculate
  const discountPct = parsedMeta.discountPct || 0;
  const discountAmt = parsedMeta.discountAmt || (subtotal * (discountPct / 100));
  const taxable = Math.max(0, subtotal - discountAmt);
  const cgstRate = parsedMeta.cgstRate ?? (p.cgst_rate || 2.5);
  const sgstRate = parsedMeta.sgstRate ?? (p.sgst_rate || 2.5);
  const cgst = taxable * (cgstRate / 100);
  const sgst = taxable * (sgstRate / 100);
  const deliveryFee = parsedMeta.deliveryFee || (parsedMeta.type === 'delivery' ? 50 : 0);
  const grandTotal = Number(order.total_amount) || (taxable + cgst + sgst + deliveryFee);
  
  const formattedDate = new Date(order.created_at || Date.now()).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
  const payMode = parsedMeta.payment ? parsedMeta.payment.toUpperCase() : 'CASH';
  const tableInfo = parsedMeta.tableNumber || order.table_number || '';
  
  const itemRowsHtml = items.map(i => `
    <tr>
      <td style="padding:4px 2px;font-size:11px;font-weight:600;">${escapeHtml(i.item_name || i.name)}</td>
      <td style="padding:4px 2px;font-size:11px;text-align:center;">${i.quantity || i.qty}</td>
      <td style="padding:4px 2px;font-size:11px;text-align:right;">₹${Number(i.unit_price || i.price || 0).toFixed(2)}</td>
      <td style="padding:4px 2px;font-size:11px;text-align:right;font-weight:700;">₹${Number(i.line_total || ((i.price || i.unit_price) * (i.qty || i.quantity)) || 0).toFixed(2)}</td>
    </tr>
  `).join('');
  
  const feedSpaces = '<br/>'.repeat(Math.max(1, p.bill_bottom_feed || 4));

  // Dynamic QR Code data URL with exact pre-filled grand total
  const qrDataUrl = p.bill_upi_id ? await generateUpiQrDataUrl(p.bill_upi_id, p.bill_upi_payee_name || p.restaurant_name, grandTotal, formatDailyOrderNumber(order)) : '';

  return `
    <div style="width:${wPx}px;font-family:monospace;font-size:12px;color:#000;padding:0 8px;margin:0 auto;">
      <div style="text-align:center;margin-bottom:10px;">
        ${p.bill_show_logo && p.bill_logo_url ? `
          <div style="margin-bottom:6px;text-align:center;">
            <img src="${p.bill_logo_url}" alt="Logo" style="max-height:48px;max-width:140px;margin:0 auto;display:block;filter:grayscale(100%) contrast(180%);" />
          </div>
        ` : ''}
        <div style="font-size:17px;font-weight:bold;letter-spacing:1px;">${escapeHtml(p.restaurant_name)}</div>
        ${p.restaurant_address ? `<div style="font-size:10px;margin-top:2px;">${escapeHtml(p.restaurant_address)}</div>` : ''}
        ${p.restaurant_phone ? `<div style="font-size:10px;">Tel: ${escapeHtml(p.restaurant_phone)}</div>` : ''}
        ${p.restaurant_gstin ? `<div style="font-size:10px;">GSTIN: ${escapeHtml(p.restaurant_gstin)}</div>` : ''}
        ${p.restaurant_fssai ? `<div style="font-size:10px;">FSSAI Lic: ${escapeHtml(p.restaurant_fssai)}</div>` : ''}
        <div style="font-size:12px;font-weight:bold;border-top:1px dashed #000;border-bottom:1px dashed #000;padding:4px 0;margin-top:6px;">
          ${parsedMeta.type === 'delivery' ? 'TAX INVOICE — DELIVERY' : tableInfo ? `TAX INVOICE — TABLE ${tableInfo}` : 'TAX INVOICE — PICKUP'}
        </div>
      </div>
      
      <div style="font-size:10px;line-height:1.5;margin-bottom:8px;">
        <div><strong>Bill No:</strong> #${formatDailyOrderNumber(order)}</div>
        <div><strong>Date:</strong> ${formattedDate}</div>
        <div><strong>Customer:</strong> ${escapeHtml(order.customer_name || 'Walk-in')}</div>
        <div><strong>Phone:</strong> ${escapeHtml(order.customer_phone || '—')}</div>
      </div>
      
      <table style="width:100%;border-collapse:collapse;border-top:1px dashed #000;border-bottom:1px dashed #000;margin-bottom:6px;">
        <thead>
          <tr style="border-bottom:1px dashed #000;">
            <th style="font-size:10px;padding:3px 2px;text-align:left;">Item</th>
            <th style="font-size:10px;padding:3px 2px;text-align:center;width:25px;">Qty</th>
            <th style="font-size:10px;padding:3px 2px;text-align:right;width:55px;">Rate</th>
            <th style="font-size:10px;padding:3px 2px;text-align:right;width:60px;">Amt</th>
          </tr>
        </thead>
        <tbody>${itemRowsHtml}</tbody>
      </table>
      
      <div style="font-size:11px;line-height:1.6;">
        <div style="display:flex;justify-content:space-between;"><span>Items Subtotal:</span><span>₹${subtotal.toFixed(2)}</span></div>
        ${discountAmt > 0 ? `
          <div style="display:flex;justify-content:space-between;"><span>Discount (${discountPct}%):</span><span>-₹${discountAmt.toFixed(2)}</span></div>
          <div style="display:flex;justify-content:space-between;"><span>Net Taxable:</span><span>₹${taxable.toFixed(2)}</span></div>
        ` : ''}
        <div style="display:flex;justify-content:space-between;"><span>CGST @${cgstRate}%:</span><span>₹${cgst.toFixed(2)}</span></div>
        <div style="display:flex;justify-content:space-between;"><span>SGST @${sgstRate}%:</span><span>₹${sgst.toFixed(2)}</span></div>
        ${deliveryFee > 0 ? `
          <div style="display:flex;justify-content:space-between;"><span>Delivery Charge:</span><span>₹${deliveryFee.toFixed(2)}</span></div>
        ` : ''}
        <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:13px;border-top:1px dashed #000;margin-top:3px;padding-top:3px;">
          <span>GRAND TOTAL:</span><span>₹${grandTotal.toFixed(2)}</span>
        </div>
      </div>
      
      <div style="border-top:1px dashed #000;margin-top:6px;padding-top:6px;font-size:10px;">
        <div><strong>Payment:</strong> ${payMode}</div>
        <div><strong>Status:</strong> ${(order.payment_status || 'unpaid').toUpperCase()}</div>
      </div>
      
      ${p.bill_upi_id ? `
        <div style="border-top:1px dashed #000;margin-top:6px;padding-top:6px;text-align:center;">
          <div style="font-size:11px;font-weight:900;letter-spacing:.5px;">📱 SCAN &amp; PAY VIA UPI</div>
          <div style="font-size:9px;margin:2px 0 4px 0;">Exact Amount: <strong>₹${grandTotal.toFixed(2)}</strong> (Auto-Filled)</div>
          ${qrDataUrl ? `<img src="${qrDataUrl}" alt="UPI QR" style="width:125px;height:125px;margin:2px auto;display:block;image-rendering:pixelated;" />` : ''}
          <div style="font-size:9px;color:#333;margin-top:2px;">UPI ID: <strong>${escapeHtml(p.bill_upi_id)}</strong></div>
          <div style="font-size:8px;color:#555;margin-top:1px;">PhonePe · Google Pay · Paytm · BHIM</div>
        </div>
      ` : ''}
      
      <div style="text-align:center;border-top:1px dashed #000;padding-top:6px;margin-top:8px;font-size:10px;">
        <div style="font-weight:bold;">${escapeHtml(p.bill_footer_message)}</div>
        <div style="margin-top:2px;">${escapeHtml(p.restaurant_name)}</div>
      </div>
      ${feedSpaces}
    </div>
  `;
}

async function printOrderReceiptWithTax(order, itemsList) {
  const p = printerSettings;
  const html = await generateBillWithTaxHtml(order, itemsList);

  if (p.connection_mode === 'qz_tray') {
    if (typeof qz !== 'undefined' && qzConnected && activePrinter) {
      try {
        const config = qz.configs.create(activePrinter);
        await qz.print(config, [{ type: 'pixel', format: 'html', flavor: 'plain', data: html }]);
        showAdminToast(`Bill for #${order.order_number} sent via QZ Tray! ✅`, 'success');
        return;
      } catch(e) { console.warn('QZ Tray print failed, falling back to Native Driver:', e); }
    }
  }

  // Default: Native Driver (Direct Windows Spooler / Silent Kiosk)
  await printViaNativeDriver(html, p.bill_paper_width || 80);
  showAdminToast(`Bill for #${order.order_number} sent to TVS RP3200 Plus Driver! ✅`, 'success');
}


// ════════════════════════════════════════════════════════
// HOLD ORDERS VISUAL ADD-ITEMS MODAL
// ════════════════════════════════════════════════════════

let holdModalCart = []; // [{ id, name, price, qty }]
let holdModalActiveOrderId = null;
let holdModalActiveCat = 'all';

function openHoldAddItemsModal(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (!order) return;
  holdModalActiveOrderId = orderId;
  holdModalCart = [];
  holdModalActiveCat = 'all';

  const parsedMeta = parseNotesMetadata(order.notes, order);
  const tableNum = parsedMeta.tableNumber || order.table_number || '';
  const titleEl = $('hold-modal-title');
  const subEl = $('hold-modal-sub');
  if (titleEl) {
    titleEl.innerHTML = `<span>🍽️ Add Dishes to ${tableNum ? `Table ${tableNum}` : `Order #${order.order_number}`}</span>`;
  }
  if (subEl) {
    subEl.textContent = `Customer: ${order.customer_name || 'Walk-in'} (${order.customer_phone || '—'}) · Running Total: ₹${Number(order.total_amount || 0).toFixed(2)}`;
  }

  if ($('hold-modal-curr-total')) {
    $('hold-modal-curr-total').textContent = `₹${Number(order.total_amount || 0).toFixed(2)}`;
  }
  if ($('hold-modal-search')) $('hold-modal-search').value = '';

  renderHoldModalCategories();
  renderHoldModalFoodGrid();
  updateHoldModalCartUI();

  const modal = $('adm-hold-add-modal');
  if (modal) {
    modal.classList.add('open');
    modal.style.display = 'flex';
    setTimeout(() => $('hold-modal-search')?.focus(), 150);
  }
}
window.openHoldAddItemsModal = openHoldAddItemsModal;

function closeHoldAddItemsModal() {
  const modal = $('adm-hold-add-modal');
  if (modal) {
    modal.classList.remove('open');
    modal.style.display = 'none';
  }
  holdModalActiveOrderId = null;
  holdModalCart = [];
}
window.closeHoldAddItemsModal = closeHoldAddItemsModal;

function renderHoldModalCategories() {
  const pillBar = $('hold-modal-categories');
  if (!pillBar) return;
  const cats = ['all', ...new Set(menuItems.map(f => f.category).filter(Boolean))];
  pillBar.innerHTML = cats.map(cat => {
    const lbl = cat === 'all' ? '🍽️ All Items' : ((categoryEmojis[cat] || '') + ' ' + (categoryLabels[cat] || cat));
    const cls = cat === holdModalActiveCat ? 'pos-cat-pill active' : 'pos-cat-pill';
    return `<button type="button" class="${cls}" data-cat="${cat}">${lbl}</button>`;
  }).join('');

  pillBar.querySelectorAll('.pos-cat-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      holdModalActiveCat = pill.dataset.cat;
      renderHoldModalCategories();
      renderHoldModalFoodGrid($('hold-modal-search')?.value);
    });
  });
}

function renderHoldModalFoodGrid(filterText) {
  const grid = $('hold-modal-food-grid');
  if (!grid) return;
  const q = (filterText || '').toLowerCase().trim();
  const source = menuItems;
  const filtered = source.filter(f =>
    (holdModalActiveCat === 'all' || f.category === holdModalActiveCat) &&
    (!q || (f.name && f.name.toLowerCase().includes(q)) || (f.category && f.category.toLowerCase().includes(q)))
  );

  const countEl = $('hold-modal-items-count');
  if (countEl) countEl.textContent = `${filtered.length} Dishes`;

  if (!filtered.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--adm-muted);font-size:.82rem;padding:2rem 0;">No dishes found matching your search.</div>';
    return;
  }

  grid.innerHTML = filtered.map(f => {
    const imgUrl = f.image || categoryImages[f.category] || '/images/food_starters.png';
    const cartItem = holdModalCart.find(i => (f.id && String(i.id) === String(f.id)) || (i.name && f.name && i.name.toLowerCase() === f.name.toLowerCase()));
    const cartQty = cartItem ? cartItem.qty : 0;

    return `
      <button type="button" class="pos-food-tile-img" data-id="${f.id}" data-name="${escapeHtml(f.name)}" data-price="${f.price}">
        <div class="pos-tile-img-box">
          <img src="${imgUrl}" alt="${escapeHtml(f.name)}" onerror="this.src='/images/food_starters.png'" loading="lazy" />
          ${cartQty > 0 ? `<span class="pos-tile-badge">${cartQty} in cart</span>` : ''}
        </div>
        <div class="pos-tile-body">
          <span class="pos-tile-title" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
          <div class="pos-tile-foot">
            <span class="pos-tile-price-tag">₹${Number(f.price).toFixed(0)}</span>
            <span class="pos-tile-add-btn">+</span>
          </div>
        </div>
      </button>
    `;
  }).join('');

  grid.querySelectorAll('.pos-food-tile-img').forEach(tile => {
    tile.addEventListener('click', () => {
      const id = tile.dataset.id;
      const name = tile.dataset.name;
      const price = parseFloat(tile.dataset.price);
      const existing = holdModalCart.find(i => (id && String(i.id) === String(id)) || (i.name && name && i.name.toLowerCase() === name.toLowerCase()));
      if (existing) {
        existing.qty++;
      } else {
        holdModalCart.push({ id: id || null, name, price, qty: 1 });
      }
      updateHoldModalCartUI();
      showAdminToast(`Added "${name}" 🛒`, 'success');
    });
  });
}

function updateHoldModalCartUI() {
  const cartEl = $('hold-modal-cart-items');
  if (!cartEl) return;

  if (holdModalCart.length === 0) {
    cartEl.innerHTML = '<p style="color:var(--adm-muted);font-size:.82rem;text-align:center;padding:1.5rem 0;">No dishes selected yet.<br/><span style="font-size:.75rem;">Click dishes on the left to add.</span></p>';
  } else {
    cartEl.innerHTML = holdModalCart.map((item, idx) => `
      <div style="display:flex;align-items:center;gap:.4rem;padding:.4rem 0;border-bottom:1px solid var(--adm-border);">
        <div style="flex:1;">
          <div style="font-size:.82rem;font-weight:700;color:#111827;line-height:1.2;">${escapeHtml(item.name)}</div>
          <div style="font-size:.72rem;color:var(--adm-muted);margin-top:2px;">₹${item.price.toFixed(2)} each</div>
        </div>
        <div style="display:flex;align-items:center;gap:.2rem;">
          <button type="button" onclick="holdModalChangeQty(${idx},-1)" style="width:22px;height:22px;border:1px solid var(--adm-border);border-radius:4px;background:#f9fafb;cursor:pointer;font-size:.8rem;display:flex;align-items:center;justify-content:center;font-weight:bold;">−</button>
          <span style="min-width:18px;text-align:center;font-weight:800;font-size:.82rem;">${item.qty}</span>
          <button type="button" onclick="holdModalChangeQty(${idx},1)" style="width:22px;height:22px;border:1px solid var(--adm-border);border-radius:4px;background:#f9fafb;cursor:pointer;font-size:.8rem;display:flex;align-items:center;justify-content:center;font-weight:bold;">+</button>
          <button type="button" onclick="holdModalRemoveItem(${idx})" style="width:22px;height:22px;border:1px solid #fca5a5;border-radius:4px;background:#fef2f2;cursor:pointer;color:#ef4444;font-size:.75rem;display:flex;align-items:center;justify-content:center;" title="Remove">✕</button>
        </div>
        <span style="min-width:50px;text-align:right;font-weight:800;font-size:.82rem;color:#111827;">₹${(item.price*item.qty).toFixed(2)}</span>
      </div>
    `).join('');
  }

  const s = getBillSettings();
  const newSubtotal = holdModalCart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const newTax = newSubtotal * (s.cgstRate + s.sgstRate) / 100;
  const order = orders.find(o => o.id === holdModalActiveOrderId);
  const currentTotal = Number(order?.total_amount || 0);
  const updatedTotal = currentTotal + newSubtotal + newTax;

  if ($('hold-modal-new-subtotal')) $('hold-modal-new-subtotal').textContent = `₹${newSubtotal.toFixed(2)}`;
  if ($('hold-modal-new-tax')) $('hold-modal-new-tax').textContent = `₹${newTax.toFixed(2)}`;
  if ($('hold-modal-updated-total')) $('hold-modal-updated-total').textContent = `₹${updatedTotal.toFixed(2)}`;

  renderHoldModalFoodGrid($('hold-modal-search')?.value);
}

window.holdModalChangeQty = function(idx, delta) {
  holdModalCart[idx].qty = Math.max(1, holdModalCart[idx].qty + delta);
  updateHoldModalCartUI();
};
window.holdModalRemoveItem = function(idx) {
  holdModalCart.splice(idx, 1);
  updateHoldModalCartUI();
};

async function saveHoldOrderNewItems(orderId, newItems) {
  const order = orders.find(o => o.id === orderId);
  if (!order || !newItems.length) return;
  try {
    const rows = newItems.map(i => ({
      order_id: orderId,
      item_name: i.item_name || i.name,
      quantity: i.qty,
      unit_price: i.price,
      line_total: i.price * i.qty,
      menu_item_id: i.id || null
    }));
    const { error } = await insforge.database.from('order_items').insert(rows);
    if (error) throw error;

    const addedSubtotal = newItems.reduce((s, i) => s + i.price * i.qty, 0);
    const s = getBillSettings();
    const extraTax = addedSubtotal * (s.cgstRate + s.sgstRate) / 100;
    const newTotal = Number(order.total_amount) + addedSubtotal + extraTax;
    const { error: updateErr } = await insforge.database.from('orders').update({ total_amount: newTotal }).eq('id', orderId);
    if (updateErr) throw updateErr;

    orderItems.push(...rows.map((r, i) => ({ ...r, id: `temp-hold-${Date.now()}-${i}`, order_id: orderId })));
    order.total_amount = newTotal;

    showAdminToast(`Added ${newItems.length} dish(es) to Order #${order.order_number} ✅`, 'success');
    renderHoldOrdersPanel();
    renderBillingQuickCards();
    renderBillingTotalBills();
  } catch(e) { showAdminToast('Failed to save items: ' + e.message, 'error'); }
}

function initHoldModalListeners() {
  const modal = $('adm-hold-add-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeHoldAddItemsModal();
    });
  }

  $('hold-modal-close-btn')?.addEventListener('click', closeHoldAddItemsModal);
  $('hold-modal-clear-cart-btn')?.addEventListener('click', () => {
    if (!holdModalCart.length) return;
    holdModalCart = [];
    updateHoldModalCartUI();
  });
  $('hold-modal-search')?.addEventListener('input', function() {
    renderHoldModalFoodGrid(this.value);
  });

  // KOT & Save New Dishes
  $('hold-modal-kot-btn')?.addEventListener('click', async () => {
    if (!holdModalActiveOrderId) return;
    if (!holdModalCart.length) {
      showAdminToast('Please select at least one dish to add.', 'error');
      return;
    }
    const order = orders.find(o => o.id === holdModalActiveOrderId);
    if (!order) return;
    const itemsToSave = [...holdModalCart];
    // 1. Print incremental KOT for ONLY new dishes
    await printKOT(order, itemsToSave, true);
    // 2. Persist to DB and update running order total
    await saveHoldOrderNewItems(order.id, itemsToSave);
    closeHoldAddItemsModal();
  });

  // Save Only (No Kitchen Ticket)
  $('hold-modal-save-btn')?.addEventListener('click', async () => {
    if (!holdModalActiveOrderId) return;
    if (!holdModalCart.length) {
      showAdminToast('Please select at least one dish to add.', 'error');
      return;
    }
    const itemsToSave = [...holdModalCart];
    await saveHoldOrderNewItems(holdModalActiveOrderId, itemsToSave);
    closeHoldAddItemsModal();
  });
}

// ── Quick Cards & Total Bills Table Renderers ────────────────────
function renderBillingQuickCards() {
  const held = getHeldOrders();
  const holdCount = held.length;
  const holdTotal = held.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

  const closed = orders.filter(o => o.status === 'delivered' || o.payment_status === 'paid');
  const closedCount = closed.length;
  const closedTotal = closed.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

  if ($('billing-hold-count')) $('billing-hold-count').textContent = `${holdCount} ${holdCount === 1 ? 'Order' : 'Orders'}`;
  if ($('billing-hold-total')) $('billing-hold-total').textContent = `(₹${holdTotal.toFixed(2)})`;

  if ($('billing-close-count')) $('billing-close-count').textContent = `${closedCount} ${closedCount === 1 ? 'Bill' : 'Bills'}`;
  if ($('billing-close-total')) $('billing-close-total').textContent = `(₹${closedTotal.toFixed(2)})`;

  // Update metrics
  const totalBills = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const dineInCount = orders.filter(o => o.order_type === 'table' || (o.notes && o.notes.includes('[TABLE:'))).length;
  const deliveryCount = orders.filter(o => o.order_type === 'delivery' || (o.notes && o.notes.includes('[DELIVERY]'))).length;

  if ($('billing-metric-total-count')) $('billing-metric-total-count').textContent = totalBills;
  if ($('billing-metric-total-revenue')) $('billing-metric-total-revenue').textContent = `₹${totalRevenue.toFixed(2)}`;
  if ($('billing-metric-dinein-count')) $('billing-metric-dinein-count').textContent = dineInCount;
  if ($('billing-metric-delivery-count')) $('billing-metric-delivery-count').textContent = deliveryCount;
}

function renderBillingTotalBills() {
  const tbody = $('billing-bills-tbody');
  if (!tbody) return;

  const search = ($('billing-table-search')?.value || '').toLowerCase().trim();
  const typeFilter = $('billing-table-type-filter')?.value || 'all';

  let list = orders.slice();

  if (typeFilter !== 'all') {
    list = list.filter(o => {
      const parsedMeta = parseNotesMetadata(o.notes, o);
      return parsedMeta.type === typeFilter || o.order_type === typeFilter;
    });
  }

  if (search) {
    list = list.filter(o =>
      String(o.order_number).includes(search) ||
      (o.customer_name && o.customer_name.toLowerCase().includes(search)) ||
      (o.customer_phone && o.customer_phone.includes(search)) ||
      String(o.table_number || '').toLowerCase().includes(search)
    );
  }

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--adm-muted);">No bills found matching your criteria.</td></tr>';
    return;
  }

  tbody.innerHTML = list.slice(0, 50).map(o => {
    const parsedMeta = parseNotesMetadata(o.notes, o);
    const tableInfo = parsedMeta.tableNumber || o.table_number || '';
    const typeLabel = parsedMeta.type === 'table' ? (tableInfo ? `🪑 Table ${tableInfo}` : '🪑 Dine-in') : (parsedMeta.type === 'delivery' ? '🚗 Delivery' : '🥡 Pickup');
    const timeStr = o.created_at ? new Date(o.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';
    const isPaid = o.payment_status === 'paid';
    const isHold = o.status === 'hold';

    const statusBadge = isHold
      ? '<span style="background:#fef3c7;color:#b45309;font-size:.72rem;font-weight:700;padding:.2rem .55rem;border-radius:999px;">⏳ On Hold</span>'
      : (isPaid
        ? '<span style="background:#ecfdf5;color:#059669;font-size:.72rem;font-weight:700;padding:.2rem .55rem;border-radius:999px;">✓ Settled</span>'
        : '<span style="background:#fef2f2;color:#ef4444;font-size:.72rem;font-weight:700;padding:.2rem .55rem;border-radius:999px;">Pending</span>');

    const actionsHtml = isHold
      ? `
        <button type="button" class="adm-btn adm-btn-outline adm-btn-sm billing-row-add-items-btn" data-id="${o.id}" style="background:#eef2ff;color:#4f46e5;border-color:#c7d2fe;" title="Add Items to Table">✏️ Add</button>
        <button type="button" class="adm-btn adm-btn-primary adm-btn-sm billing-row-settle-btn" data-id="${o.id}" style="background:#10b981;border-color:#10b981;" title="Print Final Bill & Settle / Close">🧾 Final Bill</button>
        <button type="button" class="adm-btn adm-btn-outline adm-btn-sm billing-row-kot-btn" data-id="${o.id}" style="background:#fff3e0;border-color:#f59e0b;color:#b45309;" title="Reprint KOT">🗒️ KOT</button>
      `
      : `
        <button type="button" class="adm-btn adm-btn-outline adm-btn-sm billing-row-view-btn" data-id="${o.id}" title="View Order Details">👁️ View</button>
        <button type="button" class="adm-btn adm-btn-outline adm-btn-sm billing-row-print-btn" data-id="${o.id}" title="Reprint Bill">🖨️ Bill</button>
        <button type="button" class="adm-btn adm-btn-outline adm-btn-sm billing-row-kot-btn" data-id="${o.id}" style="background:#fff3e0;border-color:#f59e0b;color:#b45309;" title="Reprint KOT">🗒️ KOT</button>
      `;

    return `
      <tr style="border-bottom:1px solid var(--adm-border);transition:background .15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">
        <td style="padding:.75rem;font-weight:800;color:#111827;">#${formatDailyOrderNumber(o)}</td>
        <td style="padding:.75rem;font-size:.8rem;color:var(--adm-muted);">${timeStr}</td>
        <td style="padding:.75rem;">
          <div style="font-weight:700;font-size:.85rem;color:#111827;">${escapeHtml(o.customer_name || 'Walk-in')}</div>
          <div style="font-size:.75rem;color:var(--adm-muted);">${escapeHtml(o.customer_phone || '—')}</div>
        </td>
        <td style="padding:.75rem;">
          <span style="background:#f1f5f9;color:#334155;font-size:.75rem;font-weight:700;padding:.15rem .5rem;border-radius:6px;">${typeLabel}</span>
        </td>
        <td style="padding:.75rem;text-align:right;font-weight:800;color:#059669;font-size:.9rem;">₹${Number(o.total_amount || 0).toFixed(2)}</td>
        <td style="padding:.75rem;text-align:center;">${statusBadge}</td>
        <td style="padding:.75rem;text-align:right;">
          <div style="display:flex;gap:.35rem;justify-content:flex-end;flex-wrap:wrap;">
            ${actionsHtml}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Wire row actions
  tbody.querySelectorAll('.billing-row-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const orderId = btn.dataset.id;
      if (!orderId) return;
      selectedOrderId = orderId;
      if ($('billing-pos')) $('billing-pos').style.display = 'none';
      if ($('billing-total-section')) $('billing-total-section').style.display = 'none';
      if ($('billing-detail-view')) $('billing-detail-view').style.display = 'block';
      if ($('billing-order-picker')) $('billing-order-picker').value = orderId;
      renderOrderDetail(orderId);
    });
  });

  tbody.querySelectorAll('.billing-row-settle-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const orderId = btn.dataset.id;
      const order = orders.find(o => o.id === orderId);
      if (!order) return;
      if (!confirm(`Print final bill for Order #${formatDailyOrderNumber(order)} and mark as completed / closed?`)) return;
      await printOrderReceiptWithTax(order);
      try {
        const { error } = await insforge.database.from('orders').update({ status: 'delivered', payment_status: 'paid' }).eq('id', orderId);
        if (error) throw error;
        const o = orders.find(x => x.id === orderId);
        if (o) { o.status = 'delivered'; o.payment_status = 'paid'; }
        showAdminToast(`Order #${formatDailyOrderNumber(order)} billed, settled & closed! ✅`, 'success');
        renderOverview();
        renderHoldOrdersPanel();
        renderClosedOrdersPanel();
        renderBillingQuickCards();
        renderBillingTotalBills();
      } catch(err) { showAdminToast('Failed to update order: ' + err.message, 'error'); }
    });
  });

  tbody.querySelectorAll('.billing-row-add-items-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const orderId = btn.dataset.id;
      switchPanel('hold-orders');
      setTimeout(() => {
        const card = document.querySelector(`.adm-hold-card[data-order-id="${orderId}"]`);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const addBtn = card.querySelector('.hold-add-items-btn');
          if (addBtn) addBtn.click();
        }
      }, 150);
    });
  });

  tbody.querySelectorAll('.billing-row-print-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const order = orders.find(o => o.id === btn.dataset.id);
      if (!order) return;
      await printOrderReceiptWithTax(order);
    });
  });

  tbody.querySelectorAll('.billing-row-kot-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const order = orders.find(o => o.id === btn.dataset.id);
      if (!order) return;
      const items = getItemsForOrder(order.id);
      await printKOT(order, items);
    });
  });
}

// ── Visual Food Grid with Pictures ──────────────────────────────
function renderFoodGrid(filterText) {
  const grid = $('pos-food-grid');
  if (!grid) return;

  const q = (filterText || '').toLowerCase().trim();
  const source = menuItems;
  const filtered = source.filter(f =>
    (posActiveCat === 'all' || f.category === posActiveCat) &&
    (!q || f.name.toLowerCase().includes(q))
  );

  if (!filtered.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--adm-muted);font-size:.82rem;padding:2rem 0;">No dishes found matching your search.</div>';
    return;
  }

  grid.innerHTML = filtered.map(f => {
    const imgUrl = f.image || categoryImages[f.category] || '/images/food_starters.png';
    const cartItem = posCart.find(i => (f.id && i.id === f.id) || i.name.toLowerCase() === f.name.toLowerCase());
    const cartQty = cartItem ? cartItem.qty : 0;

    return `
      <button type="button" class="pos-food-tile-img" data-id="${f.id}" data-name="${escapeHtml(f.name)}" data-price="${f.price}">
        <div class="pos-tile-img-box">
          <img src="${imgUrl}" alt="${escapeHtml(f.name)}" onerror="this.src='/images/food_starters.png'" loading="lazy" />
          ${cartQty > 0 ? `<span class="pos-tile-badge">${cartQty} in cart</span>` : ''}
        </div>
        <div class="pos-tile-body">
          <span class="pos-tile-title" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
          <div class="pos-tile-foot">
            <span class="pos-tile-price-tag">₹${Number(f.price).toFixed(0)}</span>
            <span class="pos-tile-add-btn">+</span>
          </div>
        </div>
      </button>
    `;
  }).join('');

  grid.querySelectorAll('.pos-food-tile-img').forEach(tile => {
    tile.addEventListener('click', () => {
      addItemToPosCart({
        id: tile.dataset.id,
        name: tile.dataset.name,
        price: parseFloat(tile.dataset.price)
      });
    });
  });
}

function renderCategoryPills() {
  const pillBar = $('pos-category-pills');
  if (!pillBar) return;

  const cats = ['all', ...new Set(menuItems.map(f => f.category).filter(Boolean))];
  pillBar.innerHTML = cats.map(cat => {
    const lbl = cat === 'all' ? '🍽️ All Dishes' : ((categoryEmojis[cat] || '') + ' ' + (categoryLabels[cat] || cat));
    const cls = cat === posActiveCat ? 'pos-cat-pill active' : 'pos-cat-pill';
    return `<button type="button" class="${cls}" data-cat="${cat}">${lbl}</button>`;
  }).join('');

  pillBar.querySelectorAll('.pos-cat-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      posActiveCat = pill.dataset.cat;
      renderCategoryPills();
      renderFoodGrid($('pos-food-search')?.value);
    });
  });
}

// ── Panel Initialization ─────────────────────────────────────────
async function initBillingPanel() {
  loadFoodsCache();

  // Populate existing order picker
  const picker = $('billing-order-picker');
  if (picker) {
    picker.innerHTML = '<option value="">— View existing order —</option>' +
      orders.slice(0, 50).map(o => `<option value="${o.id}">#${formatDailyOrderNumber(o)} ${escapeHtml(o.customer_name)} ${fmtMoney(o.total_amount)}</option>`).join('');
  }

  // Render cards and bills table
  renderBillingQuickCards();
  renderBillingTotalBills();
  renderPosPlaceChips();
  initPosPlaceSearch();

  if (posBillingMounted) return;
  posBillingMounted = true;

  // 1. TOP QUICK NAVIGATION CARDS
  $('billing-hold-card')?.addEventListener('click', () => {
    switchPanel('hold-orders');
  });

  $('billing-close-card')?.addEventListener('click', () => {
    switchPanel('closed-orders');
  });

  // 2. New Bill & Close POS Buttons
  const posEl = $('billing-pos');
  const totalSection = $('billing-total-section');
  const detailEl = $('billing-detail-view');
  const newBtn = $('billing-new-btn');
  const closePosBtn = $('pos-close-btn');

  newBtn?.addEventListener('click', () => {
    posCart = [];
    posActiveCat = 'all';
    clearPosSelectedPlace();
    if (posEl) posEl.style.display = 'block';
    if (totalSection) totalSection.style.display = 'none';
    if (detailEl) detailEl.style.display = 'none';
    if (picker) picker.value = '';

    // Clear inputs and remove any invalid red highlights
    ['pos-customer-name','pos-customer-phone','pos-table-number','pos-notes','pos-discount-pct','pos-delivery-fee','pos-food-search','pos-place-search'].forEach(id => {
      const el = $(id);
      if (el) {
        el.value = '';
        el.classList.remove('pos-input-invalid');
      }
    });
    if ($('pos-delivery-address')) {
      $('pos-delivery-address').value = '';
      $('pos-delivery-address').classList.remove('pos-input-invalid');
    }

    renderPosPlaceChips();
    updatePosCartUI();
    renderCategoryPills();
    renderFoodGrid();

    // Auto-focus customer name
    setTimeout(() => { $('pos-customer-name')?.focus(); }, 100);
  });

  closePosBtn?.addEventListener('click', () => {
    if (posEl) posEl.style.display = 'none';
    if (totalSection) totalSection.style.display = 'block';
    if (detailEl) detailEl.style.display = 'none';
    renderBillingQuickCards();
    renderBillingTotalBills();
  });

  // 3. Detail View Back Button
  $('billing-detail-back-btn')?.addEventListener('click', () => {
    if (detailEl) detailEl.style.display = 'none';
    if (posEl) posEl.style.display = 'none';
    if (totalSection) totalSection.style.display = 'block';
    if (picker) picker.value = '';
    renderBillingQuickCards();
    renderBillingTotalBills();
  });

  // 4. Order Picker Dropdown Change
  picker?.addEventListener('change', () => {
    const id = picker.value;
    if (id) {
      if (posEl) posEl.style.display = 'none';
      if (totalSection) totalSection.style.display = 'none';
      if (detailEl) detailEl.style.display = 'block';
      selectedOrderId = id;
      renderOrderDetail(id);
      show($('billing-print-btn'));
      show($('billing-print-kot-btn'));
    } else {
      if (detailEl) detailEl.style.display = 'none';
      if (totalSection) totalSection.style.display = 'block';
    }
  });

  // 5. Quick Table Selection Buttons
  document.querySelectorAll('.pos-quick-table-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tInp = $('pos-table-number');
      if (tInp) {
        tInp.value = `Table ${btn.dataset.tbl}`;
        tInp.classList.remove('pos-input-invalid');
      }
    });
  });

  // 6. Order Type Selector Buttons
  document.querySelectorAll('.pos-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      posOrderType = btn.dataset.type;
      document.querySelectorAll('.pos-type-btn').forEach(b => {
        b.className = 'pos-type-btn adm-btn ' + (b === btn ? 'adm-btn-primary' : 'adm-btn-outline');
      });
      if ($('pos-table-field')) $('pos-table-field').style.display = posOrderType === 'table' ? 'block' : 'none';
      if ($('pos-delivery-field')) $('pos-delivery-field').style.display = posOrderType === 'delivery' ? 'block' : 'none';
      updatePosCartUI();
    });
  });

  // 7. Cart Clear Button
  $('pos-cart-clear-btn')?.addEventListener('click', () => {
    if (posCart.length === 0) return;
    if (confirm('Clear all items from current cart?')) {
      posCart = [];
      updatePosCartUI();
    }
  });

  // 8. Custom Food Manual Add
  $('pos-food-manual-btn')?.addEventListener('click', () => {
    const r = $('pos-manual-row');
    if (r) r.style.display = r.style.display === 'none' ? 'block' : 'none';
  });

  $('pos-manual-add')?.addEventListener('click', () => {
    const name = $('pos-manual-name')?.value?.trim();
    const price = parseFloat($('pos-manual-price')?.value || '0');
    const qty = parseInt($('pos-manual-qty')?.value || '1');
    if (!name || price <= 0) {
      showAdminToast('Please enter a valid item name and price.', 'error');
      return;
    }
    const existing = posCart.find(i => i.name.toLowerCase() === name.toLowerCase());
    if (existing) existing.qty += qty;
    else posCart.push({ id: null, name, price, qty });
    updatePosCartUI();
    if ($('pos-manual-name')) $('pos-manual-name').value = '';
    if ($('pos-manual-price')) $('pos-manual-price').value = '';
    if ($('pos-manual-qty')) $('pos-manual-qty').value = '1';
    showAdminToast(`Added custom item "${name}" ✅`, 'success');
  });

  // 9. Live Search in Menu Grid & Total Bills Table
  $('pos-food-search')?.addEventListener('input', function() { renderFoodGrid(this.value); });
  $('billing-table-search')?.addEventListener('input', renderBillingTotalBills);
  $('billing-table-type-filter')?.addEventListener('change', renderBillingTotalBills);
  $('billing-table-refresh-btn')?.addEventListener('click', () => {
    renderBillingQuickCards();
    renderBillingTotalBills();
    showAdminToast('Bills refreshed ✅', 'info');
  });

  // 10. Discount & Delivery fee input listeners
  $('pos-discount-pct')?.addEventListener('input', updatePosCartUI);
  $('pos-delivery-fee')?.addEventListener('input', updatePosCartUI);

  // 11. POS Action Handlers
  $('pos-kot-hold-btn')?.addEventListener('click', async () => {
    const result = await buildOrderFromPos('hold');
    if (!result) return;
    await printKOT(result.order, result.items);
    showAdminToast(`Order #${result.order.order_number} held & KOT printed! 🖨️`, 'success');
    posCart = [];
    if (posEl) posEl.style.display = 'none';
    if (totalSection) totalSection.style.display = 'block';
    renderBillingQuickCards();
    renderBillingTotalBills();
  });

  $('pos-kot-bill-btn')?.addEventListener('click', async () => {
    const result = await buildOrderFromPos('bill');
    if (!result) return;
    await printKOT(result.order, result.items);
    await printOrderReceiptWithTax(result.order, result.items);
    showAdminToast(`Order #${result.order.order_number} completed, KOT & Final Bill printed! ✅`, 'success');
    posCart = [];
    if (posEl) posEl.style.display = 'none';
    if (totalSection) totalSection.style.display = 'block';
    renderBillingQuickCards();
    renderBillingTotalBills();
  });

  $('pos-save-only-btn')?.addEventListener('click', async () => {
    const result = await buildOrderFromPos('save');
    if (!result) return;
    showAdminToast(`Order #${result.order.order_number} saved! ✅`, 'success');
    posCart = [];
    if (posEl) posEl.style.display = 'none';
    if (totalSection) totalSection.style.display = 'block';
    renderBillingQuickCards();
    renderBillingTotalBills();
  });

  // Print buttons in detail view
  $('billing-print-btn')?.addEventListener('click', async () => {
    const order = orders.find(o => o.id === selectedOrderId);
    if (!order) return;
    await printOrderReceiptWithTax(order);
  });

  $('billing-print-kot-btn')?.addEventListener('click', async () => {
    const order = orders.find(o => o.id === selectedOrderId);
    if (!order) return;
    const items = getItemsForOrder(order.id);
    await printKOT(order, items);
  });
}

function updatePosTotals() { updatePosCartUI(); }

// ════════════════════════════════════════════════════════
// SETTINGS HUB, STAFF MANAGER & WHATSAPP MANAGER
// ════════════════════════════════════════════════════════

let settingsSubtab = 'staff';
let settingsMounted = false;
let staffEditingId = null;

function initSettingsPanel() {
  if (!settingsMounted) {
    settingsMounted = true;
    setupSettingsNavListeners();
    setupStaffManagerListeners();
    setupWhatsAppManagerListeners();
  }

  // Populate printer and profile panes inside settings if empty
  const printerContainer = $('settings-subtab-printer');
  if (printerContainer && !printerContainer.querySelector('#panel-printer')) {
    const tpl = document.getElementById('panel-printer-content');
    if (tpl) {
      printerContainer.appendChild(tpl.content.cloneNode(true));
      const p = document.getElementById('panel-printer');
      if (p) p.classList.add('active');
    }
  }

  const profileContainer = $('settings-subtab-profile');
  if (profileContainer && !profileContainer.querySelector('#panel-profile')) {
    const tpl = document.getElementById('panel-profile-content');
    if (tpl) {
      profileContainer.appendChild(tpl.content.cloneNode(true));
      const p = document.getElementById('panel-profile');
      if (p) p.classList.add('active');
    }
  }

  switchSettingsSubtab(settingsSubtab || 'staff');
}

function setupSettingsNavListeners() {
  document.querySelectorAll('#settings-nav-tabs .settings-nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetSubtab = btn.dataset.subtab;
      switchSettingsSubtab(targetSubtab);
    });
  });
}

function switchSettingsSubtab(tabName) {
  settingsSubtab = tabName;
  document.querySelectorAll('#settings-nav-tabs .settings-nav-tab').forEach(btn => {
    const isActive = btn.dataset.subtab === tabName;
    btn.classList.toggle('active', isActive);
  });

  document.querySelectorAll('.settings-subtab-pane').forEach(pane => {
    pane.style.display = pane.id === `settings-subtab-${tabName}` ? 'block' : 'none';
  });

  if (tabName === 'staff') renderStaffList();
  if (tabName === 'whatsapp') renderWhatsAppManagerUI();
  if (tabName === 'printer') initPrinterPanel();
  if (tabName === 'profile') initProfilePanel();
}

// ────────────────────────────────────────────────────────
// 👥 STAFF MANAGER ENGINE
// ────────────────────────────────────────────────────────
const DEFAULT_STAFF_MEMBERS = [
  { id: 'st-1', name: 'Salim Khan', role: 'Store Manager', phone: '+91 99887 76655', email: 'salim@limra.com', shift: '10:00 AM - 08:00 PM', status: 'on_duty', notes: 'Master admin & operations' },
  { id: 'st-2', name: 'Rahul Sharma', role: 'Head Chef / Kitchen', phone: '+91 98765 43210', email: 'rahul@limra.com', shift: '11:00 AM - 11:00 PM', status: 'on_duty', notes: 'Main kitchen & Tandoor in-charge' },
  { id: 'st-3', name: 'Imran Ansari', role: 'Service Captain', phone: '+91 98123 45678', email: 'imran@limra.com', shift: '12:00 PM - 11:30 PM', status: 'on_duty', notes: 'Dining hall & QR tables manager' },
  { id: 'st-4', name: 'Danish Ali', role: 'Delivery Rider', phone: '+91 97234 56789', email: 'danish@limra.com', shift: '01:00 PM - 11:00 PM', status: 'on_duty', notes: 'Vehicle DL-3S-8821' },
  { id: 'st-5', name: 'Afzal Qureshi', role: 'POS Cashier', phone: '+91 96345 67890', email: 'afzal@limra.com', shift: '10:00 AM - 07:00 PM', status: 'off_duty', notes: 'Counter billing & settlements' }
];

function getStaffList() {
  try {
    const raw = localStorage.getItem('limra_staff_members');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return DEFAULT_STAFF_MEMBERS;
}

function saveStaffList(list) {
  localStorage.setItem('limra_staff_members', JSON.stringify(list));
  renderStaffList();
}

function renderStaffList() {
  const staff = getStaffList();
  const roleFilter = $('staff-role-filter')?.value || 'all';
  const statusFilter = $('staff-status-filter')?.value || 'all';
  const search = ($('staff-search')?.value || '').toLowerCase().trim();

  // 1. Calculate KPIs
  const totalCount = staff.length;
  const onDutyCount = staff.filter(s => s.status === 'on_duty').length;
  const kitchenCount = staff.filter(s => s.role.toLowerCase().includes('chef') || s.role.toLowerCase().includes('kitchen')).length;
  const riderCount = staff.filter(s => s.role.toLowerCase().includes('rider') || s.role.toLowerCase().includes('delivery')).length;

  if ($('staff-kpi-total')) $('staff-kpi-total').textContent = `${totalCount} Staff`;
  if ($('staff-kpi-onduty')) $('staff-kpi-onduty').textContent = `${onDutyCount} Active`;
  if ($('staff-kpi-kitchen')) $('staff-kpi-kitchen').textContent = `${kitchenCount} Chef${kitchenCount === 1 ? '' : 's'}`;
  if ($('staff-kpi-riders')) $('staff-kpi-riders').textContent = `${riderCount} Rider${riderCount === 1 ? '' : 's'}`;

  // 2. Filter Staff
  let filtered = staff;
  if (roleFilter !== 'all') {
    filtered = filtered.filter(s => s.role === roleFilter);
  }
  if (statusFilter !== 'all') {
    filtered = filtered.filter(s => s.status === statusFilter);
  }
  if (search) {
    filtered = filtered.filter(s =>
      s.name.toLowerCase().includes(search) ||
      s.phone.includes(search) ||
      s.role.toLowerCase().includes(search) ||
      (s.email && s.email.toLowerCase().includes(search))
    );
  }

  // 3. Render Cards Grid
  const cardsGrid = $('staff-cards-grid');
  if (cardsGrid) {
    if (filtered.length === 0) {
      cardsGrid.innerHTML = `<div class="adm-card adm-empty" style="grid-column:1/-1;text-align:center;padding:2.5rem;">No staff members match the selected filter.</div>`;
    } else {
      cardsGrid.innerHTML = filtered.map(s => {
        const isOnDuty = s.status === 'on_duty';
        const digits = s.phone.replace(/\D/g, '');
        const waLink = `https://wa.me/${digits.length === 10 ? '91' + digits : digits}`;
        
        let roleBg = '#eef2ff';
        let roleColor = '#6366f1';
        if (s.role.includes('Manager')) { roleBg = '#fef3c7'; roleColor = '#b45309'; }
        if (s.role.includes('Chef') || s.role.includes('Kitchen')) { roleBg = '#ffedd5'; roleColor = '#c2410c'; }
        if (s.role.includes('Rider')) { roleBg = '#ecfeff'; roleColor = '#0891b2'; }

        return `
          <div class="adm-card" style="border:1px solid var(--adm-border);box-shadow:0 1px 3px rgba(0,0,0,.04);padding:1.25rem;display:flex;flex-direction:column;justify-content:space-between;gap:1rem;">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem;">
                <div style="display:flex;align-items:center;gap:.75rem;">
                  <div style="width:46px;height:46px;border-radius:12px;background:${roleBg};color:${roleColor};font-weight:800;font-size:1.1rem;display:flex;align-items:center;justify-content:center;">
                    ${initials(s.name)}
                  </div>
                  <div>
                    <h3 style="margin:0;font-size:1rem;font-weight:800;color:#1e293b;">${escapeHtml(s.name)}</h3>
                    <span style="background:${roleBg};color:${roleColor};font-size:.72rem;font-weight:700;padding:.15rem .5rem;border-radius:6px;display:inline-block;margin-top:.2rem;">
                      ${escapeHtml(s.role)}
                    </span>
                  </div>
                </div>
                <div>
                  <button type="button" class="btn-toggle-staff-status adm-btn adm-btn-sm" data-id="${s.id}" style="background:${isOnDuty ? '#ecfdf5' : '#f1f5f9'};color:${isOnDuty ? '#059669' : '#64748b'};border:1px solid ${isOnDuty ? '#a7f3d0' : '#cbd5e1'};font-size:.72rem;font-weight:700;padding:.2rem .55rem;border-radius:999px;cursor:pointer;">
                    ${isOnDuty ? '🟢 On-Duty' : '⚪ Off-Duty'}
                  </button>
                </div>
              </div>

              <div style="margin-top:1rem;display:flex;flex-direction:column;gap:.35rem;font-size:.82rem;color:var(--adm-muted);">
                <div style="display:flex;align-items:center;gap:.4rem;">
                  <span>📞</span> <a href="tel:${s.phone}" style="color:#1e293b;font-weight:600;text-decoration:none;">${s.phone}</a>
                </div>
                ${s.email ? `<div style="display:flex;align-items:center;gap:.4rem;"><span>✉️</span> <span>${escapeHtml(s.email)}</span></div>` : ''}
                <div style="display:flex;align-items:center;gap:.4rem;">
                  <span>⏱️</span> <span>Shift: <strong>${escapeHtml(s.shift || 'Flexible')}</strong></span>
                </div>
                ${s.notes ? `<div style="display:flex;align-items:center;gap:.4rem;font-size:.75rem;color:#64748b;margin-top:.2rem;"><span>📝</span> <span>${escapeHtml(s.notes)}</span></div>` : ''}
              </div>
            </div>

            <!-- Card Actions -->
            <div style="display:flex;gap:.4rem;border-top:1px dashed var(--adm-border);padding-top:.85rem;align-items:center;">
              <a href="tel:${s.phone}" class="adm-btn adm-btn-outline adm-btn-sm" style="flex:1;text-align:center;text-decoration:none;font-weight:600;font-size:.75rem;padding:.35rem .4rem;">
                📞 Call
              </a>
              <a href="${waLink}" target="_blank" class="adm-btn adm-btn-outline adm-btn-sm" style="flex:1;text-align:center;text-decoration:none;font-weight:600;font-size:.75rem;padding:.35rem .4rem;color:#15803d;border-color:#bbf7d0;background:#f0fdf4;">
                💬 WhatsApp
              </a>
              <button type="button" class="btn-edit-staff adm-btn adm-btn-outline adm-btn-sm" data-id="${s.id}" style="padding:.35rem .55rem;" title="Edit Staff Member">
                ✏️
              </button>
              <button type="button" class="btn-delete-staff adm-btn adm-btn-outline adm-btn-sm" data-id="${s.id}" style="padding:.35rem .55rem;color:#ef4444;border-color:#fecaca;" title="Delete Staff Member">
                🗑️
              </button>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // 4. Render Table
  const tbody = $('staff-table-body');
  if (tbody) {
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="adm-empty" style="text-align:center;padding:2rem;color:var(--adm-muted);">No staff members found.</td></tr>`;
    } else {
      tbody.innerHTML = filtered.map(s => {
        const isOnDuty = s.status === 'on_duty';
        const digits = s.phone.replace(/\D/g, '');
        const waLink = `https://wa.me/${digits.length === 10 ? '91' + digits : digits}`;

        return `
          <tr>
            <td style="padding-left:1.25rem;">
              <div style="display:flex;align-items:center;gap:.65rem;">
                <div style="width:36px;height:36px;border-radius:10px;background:#eef2ff;color:#6366f1;font-weight:800;font-size:.9rem;display:flex;align-items:center;justify-content:center;">
                  ${initials(s.name)}
                </div>
                <div>
                  <strong style="color:#1e293b;">${escapeHtml(s.name)}</strong>
                  ${s.email ? `<div style="font-size:.72rem;color:var(--adm-muted);">${escapeHtml(s.email)}</div>` : ''}
                </div>
              </div>
            </td>
            <td><span style="font-weight:600;font-size:.85rem;color:#334155;">${escapeHtml(s.role)}</span></td>
            <td><a href="tel:${s.phone}" style="color:var(--adm-green);font-weight:600;text-decoration:none;">${s.phone}</a></td>
            <td style="font-size:.8rem;color:var(--adm-muted);">${escapeHtml(s.shift || 'Flexible')}</td>
            <td>
              <button type="button" class="btn-toggle-staff-status adm-btn adm-btn-sm" data-id="${s.id}" style="background:${isOnDuty ? '#ecfdf5' : '#f1f5f9'};color:${isOnDuty ? '#059669' : '#64748b'};border:1px solid ${isOnDuty ? '#a7f3d0' : '#cbd5e1'};font-size:.72rem;font-weight:700;padding:.2rem .55rem;border-radius:999px;">
                ${isOnDuty ? '🟢 On-Duty' : '⚪ Off-Duty'}
              </button>
            </td>
            <td style="text-align:right;padding-right:1.25rem;">
              <div style="display:inline-flex;gap:.35rem;align-items:center;justify-content:flex-end;">
                <a href="${waLink}" target="_blank" class="adm-btn adm-btn-outline adm-btn-sm" style="padding:.25rem .5rem;color:#15803d;border-color:#bbf7d0;background:#f0fdf4;" title="Chat on WhatsApp">💬</a>
                <button type="button" class="btn-edit-staff adm-btn adm-btn-outline adm-btn-sm" data-id="${s.id}" style="padding:.25rem .5rem;" title="Edit Staff">✏️</button>
                <button type="button" class="btn-delete-staff adm-btn adm-btn-outline adm-btn-sm" data-id="${s.id}" style="padding:.25rem .5rem;color:#ef4444;border-color:#fecaca;" title="Delete Staff">🗑️</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // 5. Attach Action Listeners
  document.querySelectorAll('.btn-toggle-staff-status').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const all = getStaffList();
      const target = all.find(x => x.id === id);
      if (target) {
        target.status = target.status === 'on_duty' ? 'off_duty' : 'on_duty';
        saveStaffList(all);
        showAdminToast(`${target.name} status updated to ${target.status === 'on_duty' ? 'On-Duty' : 'Off-Duty'}!`, 'info');
      }
    });
  });

  document.querySelectorAll('.btn-edit-staff').forEach(btn => {
    btn.addEventListener('click', () => {
      openStaffModal(btn.dataset.id);
    });
  });

  document.querySelectorAll('.btn-delete-staff').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const all = getStaffList();
      const target = all.find(x => x.id === id);
      if (target && confirm(`Delete staff member ${target.name}?`)) {
        const next = all.filter(x => x.id !== id);
        saveStaffList(next);
        showAdminToast(`Staff member ${target.name} deleted.`, 'success');
      }
    });
  });
}

function openStaffModal(id = null) {
  staffEditingId = id;
  const modal = $('adm-staff-modal');
  if (!modal) return;

  const title = $('staff-modal-title');
  const nameInput = $('staff-modal-name');
  const roleSelect = $('staff-modal-role');
  const statusSelect = $('staff-modal-status');
  const phoneInput = $('staff-modal-phone');
  const emailInput = $('staff-modal-email');
  const shiftInput = $('staff-modal-shift');
  const notesInput = $('staff-modal-notes');

  if (id) {
    const all = getStaffList();
    const s = all.find(x => x.id === id);
    if (s) {
      if (title) title.textContent = '✏️ Edit Staff Member';
      if (nameInput) nameInput.value = s.name || '';
      if (roleSelect) roleSelect.value = s.role || 'Store Manager';
      if (statusSelect) statusSelect.value = s.status || 'on_duty';
      if (phoneInput) phoneInput.value = s.phone || '';
      if (emailInput) emailInput.value = s.email || '';
      if (shiftInput) shiftInput.value = s.shift || '';
      if (notesInput) notesInput.value = s.notes || '';
    }
  } else {
    if (title) title.textContent = '➕ Add Staff Member';
    if (nameInput) nameInput.value = '';
    if (roleSelect) roleSelect.value = 'Store Manager';
    if (statusSelect) statusSelect.value = 'on_duty';
    if (phoneInput) phoneInput.value = '';
    if (emailInput) emailInput.value = '';
    if (shiftInput) shiftInput.value = '10:00 AM - 08:00 PM';
    if (notesInput) notesInput.value = '';
  }

  modal.classList.add('active');
}

function closeStaffModal() {
  const modal = $('adm-staff-modal');
  if (modal) modal.classList.remove('active');
  staffEditingId = null;
}

function setupStaffManagerListeners() {
  $('staff-role-filter')?.addEventListener('change', renderStaffList);
  $('staff-status-filter')?.addEventListener('change', renderStaffList);
  $('staff-search')?.addEventListener('input', renderStaffList);
  $('staff-add-btn')?.addEventListener('click', () => openStaffModal());
  $('staff-modal-close')?.addEventListener('click', closeStaffModal);
  $('staff-modal-cancel')?.addEventListener('click', closeStaffModal);

  $('adm-staff-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('staff-modal-name')?.value?.trim();
    const role = $('staff-modal-role')?.value;
    const status = $('staff-modal-status')?.value || 'on_duty';
    const phone = $('staff-modal-phone')?.value?.trim();
    const email = $('staff-modal-email')?.value?.trim();
    const shift = $('staff-modal-shift')?.value?.trim();
    const notes = $('staff-modal-notes')?.value?.trim();

    if (!name || !phone) {
      showAdminToast('Please provide both Staff Name and Phone Number.', 'error');
      return;
    }

    const all = getStaffList();
    if (staffEditingId) {
      const idx = all.findIndex(x => x.id === staffEditingId);
      if (idx !== -1) {
        all[idx] = { ...all[idx], name, role, status, phone, email, shift, notes };
        showAdminToast(`Staff member "${name}" updated! ✅`, 'success');
      }
    } else {
      const newStaff = {
        id: 'st-' + Date.now(),
        name,
        role,
        status,
        phone,
        email,
        shift,
        notes
      };
      all.push(newStaff);
      showAdminToast(`Staff member "${name}" registered! ✅`, 'success');
    }

    saveStaffList(all);
    closeStaffModal();
  });

  $('staff-export-csv-btn')?.addEventListener('click', exportStaffListCSV);
}

function exportStaffListCSV() {
  const staff = getStaffList();
  if (staff.length === 0) {
    showAdminToast('No staff members to export.', 'error');
    return;
  }

  const headers = ['Staff ID', 'Full Name', 'Role / Designation', 'Status', 'Phone Number', 'Email', 'Shift Hours', 'Operational Notes'];
  const rows = staff.map(s => [
    `"${s.id}"`,
    `"${s.name.replace(/"/g, '""')}"`,
    `"${s.role}"`,
    `"${s.status === 'on_duty' ? 'On-Duty' : 'Off-Duty'}"`,
    `"${s.phone}"`,
    `"${s.email || ''}"`,
    `"${s.shift || ''}"`,
    `"${(s.notes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `LIMRA_Staff_Directory_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showAdminToast('Staff list exported to CSV! 📥', 'success');
}

// ────────────────────────────────────────────────────────
// 💬 WHATSAPP MANAGER ENGINE
// ────────────────────────────────────────────────────────
const WA_TEMPLATES = {
  confirm: 'Hi {customer_name}! Your order #{order_number} at LIMRA Restaurant has been confirmed and is being freshly prepared with care. Total: {amount}. Thank you for choosing us!',
  delivery: 'Hi {customer_name}! Great news! Your order #{order_number} is out for delivery. Our rider is on the way. Expected ETA: 15-20 mins. Enjoy your meal!',
  review: 'Hi {customer_name}! Thank you for dining with LIMRA Restaurant! If you loved our food and service, please share a quick 5-star Google Review here: https://g.page/r/limra-restaurant/review. We appreciate your support!',
  coupon: 'Special treat for you! Use promo code WELCOME10 at LIMRA Restaurant to get 10% OFF on your next order. Order live at https://limra.restaurant. See you soon!',
  table: 'Hi {customer_name}! Your table reservation at LIMRA Restaurant has been confirmed. We look forward to hosting you! Table info: Table {table_number}.',
  custom: 'Hi {customer_name}! Greetings from LIMRA Restaurant. How may we assist you today?'
};

function getWhatsAppSettings() {
  try {
    const raw = localStorage.getItem('limra_whatsapp_settings');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {
    businessPhone: '+91 99999 88888',
    businessName: 'LIMRA RESTAURANT',
    autoOrderConfirm: true,
    autoOutForDelivery: true,
    autoTableBill: true,
    autoReviewBooster: true,
    autoPromoCoupons: true
  };
}

function renderWhatsAppManagerUI() {
  const s = getWhatsAppSettings();
  if ($('wa-biz-phone')) $('wa-biz-phone').value = s.businessPhone || '+91 99999 88888';
  if ($('wa-biz-name')) $('wa-biz-name').value = s.businessName || 'LIMRA RESTAURANT';
  if ($('wa-auto-confirm')) $('wa-auto-confirm').checked = s.autoOrderConfirm !== false;
  if ($('wa-auto-delivery')) $('wa-auto-delivery').checked = s.autoOutForDelivery !== false;
  if ($('wa-auto-table')) $('wa-auto-table').checked = s.autoTableBill !== false;
  if ($('wa-auto-review')) $('wa-auto-review').checked = s.autoReviewBooster !== false;
  if ($('wa-auto-promo')) $('wa-auto-promo').checked = s.autoPromoCoupons !== false;

  updateWhatsAppTemplatePreview();
}

function updateWhatsAppTemplatePreview() {
  const picker = $('wa-direct-template-select');
  const textarea = $('wa-direct-msg');
  if (!picker || !textarea) return;

  const key = picker.value || 'confirm';
  let tpl = WA_TEMPLATES[key] || WA_TEMPLATES.confirm;
  tpl = tpl
    .replace('{customer_name}', 'Valued Guest')
    .replace('{order_number}', '101')
    .replace('{amount}', '₹650.00')
    .replace('{table_number}', '5');

  textarea.value = tpl;
}

function setupWhatsAppManagerListeners() {
  $('wa-direct-template-select')?.addEventListener('change', updateWhatsAppTemplatePreview);

  $('wa-save-settings-btn')?.addEventListener('click', () => {
    const updated = {
      businessPhone: $('wa-biz-phone')?.value?.trim() || '+91 99999 88888',
      businessName: $('wa-biz-name')?.value?.trim() || 'LIMRA RESTAURANT',
      autoOrderConfirm: $('wa-auto-confirm')?.checked ?? true,
      autoOutForDelivery: $('wa-auto-delivery')?.checked ?? true,
      autoTableBill: $('wa-auto-table')?.checked ?? true,
      autoReviewBooster: $('wa-auto-review')?.checked ?? true,
      autoPromoCoupons: $('wa-auto-promo')?.checked ?? true
    };
    localStorage.setItem('limra_whatsapp_settings', JSON.stringify(updated));
    showAdminToast('WhatsApp Business automation settings saved! 💬', 'success');
  });

  $('wa-send-direct-btn')?.addEventListener('click', () => {
    const phone = ($('wa-direct-phone')?.value || '').trim();
    const msg = ($('wa-direct-msg')?.value || '').trim();

    if (!phone) {
      showAdminToast('Please enter a customer phone number.', 'error');
      return;
    }
    if (!msg) {
      showAdminToast('Message cannot be empty.', 'error');
      return;
    }

    const clean = phone.replace(/\D/g, '');
    const finalPhone = clean.length === 10 ? '91' + clean : clean;
    const url = `https://wa.me/${finalPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
    showAdminToast('Opening WhatsApp Chat... 💬', 'info');
  });

  $('wa-copy-direct-btn')?.addEventListener('click', () => {
    const msg = ($('wa-direct-msg')?.value || '').trim();
    if (msg) {
      navigator.clipboard.writeText(msg);
      showAdminToast('Message copied to clipboard! 📋', 'success');
    }
  });
}


