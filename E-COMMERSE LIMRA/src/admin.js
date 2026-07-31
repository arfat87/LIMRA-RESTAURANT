import './style.css';
import './admin.css';
import { Chart, registerables } from 'chart.js';
import { insforge, getMenuOverrides, saveMenuOverride, getCoupons, saveCoupon, deleteCoupon, getCombos, saveCombo, deleteCombo } from './lib/insforge.js';
import { PaymentService } from './lib/payments.js';
import { menuItems, categoryImages, categoryLabels } from './data/menu.js';
import { getAdminLoginUrl } from './lib/admin-routes.js';
import { sendEmailNotification, generateOrderConfirmedHtml, generateOrderCancelledHtml } from './lib/email-service.js';


Chart.register(...registerables);

const ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
const BOOKING_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STATUS_LABEL = {
  pending: 'New Order',
  confirmed: 'Confirmed',
  preparing: 'On Delivery',
  ready: 'Ready',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
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

// ═══════════════════════════════════════
// REAL-TIME NOTIFICATION STATE & CHIME
// ═══════════════════════════════════════
const knownNotificationIds = new Set();
let activeNotifications = [];

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
  } catch (e) {
    console.warn('Could not play notification chime:', e);
  }
}

function updateNotificationBadge(count) {
  const dot = $('notification-dot');
  if (!dot) return;
  if (count === 0) {
    hide(dot);
    dot.textContent = '';
  } else {
    show(dot);
    dot.textContent = count > 9 ? '9+' : String(count);
  }
}

function renderNotifications() {
  const list = $('notification-items');
  const headerTitle = $('notification-header-title');
  if (!list) return;

  const unreadNotifications = activeNotifications.filter(n => !n.is_read);
  updateNotificationBadge(unreadNotifications.length);

  const count = unreadNotifications.length;
  if (headerTitle) {
    headerTitle.textContent = count > 0 ? `Notifications (${count})` : 'Notifications';
  }
  
  if (activeNotifications.length === 0) {
    list.innerHTML = '<p class="adm-dropdown-empty">🔕 No notifications yet</p>';
    return;
  }
  
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
  
  let cleanNote = notes
    .replace(/\[EMAIL:[^\]]+\]/gi, '')
    .replace(/\[TABLE:[^\]]+\]/gi, '')
    .replace(/\[DELIVERY\] Address:[^|]+/gi, '')
    .replace(/Selected Area:[^|]+/gi, '')
    .replace(/Distance:[^|]+/gi, '')
    .replace(/Delivery charge:[^|]+/gi, '')
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
        items: {},
        recentBookings: [],
      });
    }
    const c = map.get(phone);
    if (name) c.name = name;
    return c;
  }

  function touchActivity(c, date) {
    if (!date) return;
    if (!c.lastActivity || new Date(date) > new Date(c.lastActivity)) {
      c.lastActivity = date;
    }
  }

  orders.forEach(order => {
    const c = ensure(order.customer_phone, order.customer_name);
    c.orderCount += 1;
    c.totalSpent += Number(order.total_amount);
    const meta = parseNotesMetadata(order.notes, order);
    if (meta.email) c.email = meta.email;
    if (!c.lastOrder || new Date(order.created_at) > new Date(c.lastOrder)) {
      c.lastOrder = order.created_at;
      c.name = order.customer_name;
    }
    touchActivity(c, order.created_at);
    getItemsForOrder(order.id).forEach(item => {
      if (isFoodItem(item.item_name)) {
        c.items[item.item_name] = (c.items[item.item_name] || 0) + item.quantity;
      }
    });
  });

  bookings.forEach(booking => {
    const c = ensure(booking.customer_phone, booking.customer_name);
    c.bookingCount += 1;
    const meta = parseNotesMetadata(booking.notes);
    if (meta.email) c.email = meta.email;
    if (booking.type === 'table') c.tableBookings += 1;
    if (booking.type === 'party') c.partyBookings += 1;
    if (booking.type === 'wedding') c.weddingBookings += 1;
    if (!c.lastBooking || new Date(booking.created_at) > new Date(c.lastBooking)) {
      c.lastBooking = booking.created_at;
      c.name = booking.customer_name;
    }
    touchActivity(c, booking.created_at);
    c.recentBookings.push(booking);
  });

  return [...map.values()]
    .map(c => {
      c.recentBookings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
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
  
  const todayStr = new Date().toDateString();
  const todayPaidRev = orders
    .filter(o => o.payment_status === 'paid' && new Date(o.created_at).toDateString() === todayStr)
    .reduce((s, o) => s + Number(o.total_amount), 0);

  const pendingPayments = orders
    .filter(o => o.payment_status === 'unpaid' || !o.payment_status)
    .reduce((s, o) => s + Number(o.total_amount), 0);

  const collectedRev = orders
    .filter(o => o.payment_status === 'paid' && o.status !== 'cancelled')
    .reduce((s, o) => s + Number(o.total_amount), 0);

  const outstandingRev = orders
    .filter(o => (o.payment_status === 'unpaid' || !o.payment_status) && o.status !== 'cancelled')
    .reduce((s, o) => s + Number(o.total_amount), 0);

  // Render standard stats
  $('stat-total-orders').textContent = orders.length;
  $('stat-revenue').textContent = fmtMoney(revenue);

  // Render new payment stats
  const elPaid = $('stat-paid-orders');
  if (elPaid) elPaid.textContent = paidCount;

  const elUnpaid = $('stat-unpaid-orders');
  if (elUnpaid) elUnpaid.textContent = unpaidCount;

  const elTodayPayments = $('stat-today-payments');
  if (elTodayPayments) elTodayPayments.textContent = fmtMoney(todayPaidRev);

  const elPendingPayments = $('stat-pending-payments');
  if (elPendingPayments) elPendingPayments.textContent = fmtMoney(pendingPayments);

  const elCollected = $('stat-collected-revenue');
  if (elCollected) elCollected.textContent = fmtMoney(collectedRev);

  const elOutstanding = $('stat-outstanding-revenue');
  if (elOutstanding) elOutstanding.textContent = fmtMoney(outstandingRev);

  // Calculate GST stats (5% included in subtotal)
  // subtotal = (total_amount - deliveryCharge) / 1.05
  // GST = subtotal * 0.05
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

  const elGstTotal = $('stat-gst-total');
  if (elGstTotal) elGstTotal.textContent = fmtMoney(totalGst);

  const elGstPaid = $('stat-gst-paid');
  if (elGstPaid) elGstPaid.textContent = fmtMoney(paidGst);

  const elGstPending = $('stat-gst-pending');
  if (elGstPending) elGstPending.textContent = fmtMoney(pendingGst);

  // Sidebar badges
  const orderBadge = $('pending-orders-badge');
  if (pending > 0) { orderBadge.textContent = pending; show(orderBadge); }
  else hide(orderBadge);

  const bookBadge = $('pending-bookings-badge');
  const pendingBook = bookings.filter(b => b.status === 'pending').length;
  if (pendingBook > 0) { bookBadge.textContent = pendingBook; show(bookBadge); }
  else hide(bookBadge);
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

function renderAnalytics() {
  destroyChart('analyticsSales');
  charts.analyticsSales = new Chart($('chart-analytics-sales'), {
    type: 'line',
    data: {
      labels: MONTHS,
      datasets: [
        { label: 'Revenue', data: getRevenueByMonth(), borderColor: '#00b074', tension: 0.4, fill: false },
        { label: 'Orders', data: MONTHS.map((_, i) => orders.filter(o => new Date(o.created_at).getMonth() === i).length), borderColor: '#2d9cdb', tension: 0.4, fill: false },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: { y: { beginAtZero: true } },
    },
  });

  const top = getTopItems(6);
  $('top-items-list').innerHTML = top.length === 0
    ? '<p class="adm-empty">No sales data yet</p>'
    : top.map(([name, qty], i) => {
        const menu = menuItems.find(m => m.name === name);
        const img = menu ? (menu.image || categoryImages[menu.category]) : null;
        return `
          <div class="flex items-center gap-3 p-3 rounded-xl" style="background:#f8faf9">
            <span class="font-bold text-sm w-6" style="color:var(--adm-green)">#${i + 1}</span>
            ${img ? `<img src="${img}" alt="" class="w-10 h-10 rounded-lg object-cover" />` : `<span class="text-2xl">${menu?.emoji || '🍽️'}</span>`}
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-sm truncate">${name}</p>
              <p class="text-xs" style="color:var(--adm-muted)">${qty} orders</p>
            </div>
          </div>`;
      }).join('');

  const trending = getTopItems(5);
  destroyChart('trending');
  charts.trending = new Chart($('chart-trending'), {
    type: 'bar',
    data: {
      labels: trending.map(([n]) => n.length > 18 ? n.slice(0, 18) + '…' : n),
      datasets: [{ data: trending.map(([, q]) => q), backgroundColor: '#00b074', borderRadius: 8 }],
    },
    options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } } },
  });

  // Food Category Distribution Chart
  destroyChart('categorySales');
  const catSales = getCategorySalesData();
  const activeCats = Object.entries(catSales).filter(([, qty]) => qty > 0);
  
  let labels, data, colors;
  if (activeCats.length === 0) {
    const fallbackData = {
      biryani: 15,
      'tandoor-kabab': 12,
      bread: 9,
      'nonveg-curry': 6,
      soup: 4
    };
    labels = Object.keys(fallbackData).map(cat => categoryLabels[cat] || cat);
    data = Object.values(fallbackData);
    colors = Object.keys(fallbackData).map(cat => categoryColors[cat] || '#8b95a5');
  } else {
    labels = activeCats.map(([cat]) => categoryLabels[cat] || cat);
    data = activeCats.map(([, qty]) => qty);
    colors = activeCats.map(([cat]) => categoryColors[cat] || '#8b95a5');
  }
  
  charts.categorySales = new Chart($('chart-category-sales'), {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors,
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { boxWidth: 12, font: { size: 10 } }
        }
      },
      cutout: '60%'
    }
  });
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
  let filtered = [...orders];
  
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
    filtered = filtered.filter(o => o.order_type !== 'table');
  } else if (activeOrderTypeFilter === 'table') {
    filtered = filtered.filter(o => o.order_type === 'table');
  }
  
  if (search) {
    filtered = filtered.filter(o =>
      (o.customer_name && o.customer_name.toLowerCase().includes(search)) ||
      (o.customer_phone && o.customer_phone.includes(search)) ||
      String(o.order_number).includes(search) ||
      getLocalDateString(o.created_at).includes(search) ||
      new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).toLowerCase().includes(search)
    );
  }
  return filtered;
}

function renderOrdersTable() {
  const filtered = getFilteredOrders();

  // Update Orders Summary Bar
  const summaryCountEl = $('orders-summary-count');
  const summaryAmountEl = $('orders-summary-amount');
  const activeDateBadge = $('orders-date-active-label');
  
  const totalAmount = filtered
    .filter(o => o.status !== 'cancelled')
    .reduce((s, o) => s + Number(o.total_amount || 0), 0);

  if (summaryCountEl) summaryCountEl.textContent = `${filtered.length} order${filtered.length === 1 ? '' : 's'}`;
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
    tbody.innerHTML = `<tr><td colspan="8" class="adm-empty">No orders found</td></tr>`;
  } else {
    tbody.innerHTML = page.map(order => {
      const parsedMeta = parseNotesMetadata(order.notes, order);
      let typeText = '🥡 Pickup';
      if (parsedMeta.type === 'delivery') {
        typeText = '🚗 Delivery';
      } else if (parsedMeta.type === 'table') {
        typeText = `🍽️ Table ${parsedMeta.tableNumber}`;
      }
      return `
        <tr data-order-id="${order.id}">
          <td><strong>#${order.order_number}</strong></td>
          <td>
            ${escapeHtml(order.customer_name)}
            <div class="adm-info-muted" style="margin-top: 2px; font-size: 11px;">
              ${typeText}
            </div>
          </td>
          <td><a href="tel:${order.customer_phone}" style="color:var(--adm-green)">${order.customer_phone}</a></td>
          <td><strong>${fmtMoney(order.total_amount)}</strong></td>
          <td>${statusPill(order.status, parsedMeta.type === 'table')}</td>
          <td>${paymentStatusPill(order.payment_status || 'unpaid')}</td>
          <td>${fmtDateShort(order.created_at)}</td>
          <td>
            <div style="display:flex; gap:0.5rem; align-items:center;">
              <button class="adm-btn adm-btn-primary adm-btn-sm view-order-btn" data-order-id="${order.id}">View</button>
              ${(order.payment_status || 'unpaid') === 'unpaid' ? `<button class="adm-btn adm-btn-outline adm-btn-sm inline-mark-paid-btn" data-order-id="${order.id}" style="padding:0.4rem 0.6rem; font-size:0.75rem; border-color:var(--adm-green); color:var(--adm-green)">✓ Mark Paid</button>` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  tbody.querySelectorAll('.inline-mark-paid-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const orderId = btn.dataset.orderId;
      if (confirm('Are you sure you want to mark this order as paid?')) {
        updateOrderPaymentStatus(orderId, 'paid');
      }
    });
  });

  tbody.querySelectorAll('tr[data-order-id], .view-order-btn').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      const id = el.dataset.orderId || el.closest('tr')?.dataset.orderId;
      if (id) openOrderDetail(id);
    });
  });

  const pag = $('orders-pagination');
  pag.innerHTML = Array.from({ length: totalPages }, (_, i) =>
    `<button class="adm-page-btn ${i + 1 === ordersPage ? 'active' : ''}" data-page="${i + 1}">${i + 1}</button>`
  ).join('');
  pag.querySelectorAll('.adm-page-btn').forEach(btn => {
    btn.addEventListener('click', () => { ordersPage = Number(btn.dataset.page); renderOrdersTable(); });
  });
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
      `<option value="${o.id}" ${o.id === current ? 'selected' : ''}>#${o.order_number} — ${escapeHtml(o.customer_name)} — ${fmtMoney(o.total_amount)} — ${STATUS_LABEL[o.status] || o.status}</option>`
    ),
  ].join('');
}

// ── Detailed WhatsApp Order Message Builder ─────────────────────

function buildDetailedWhatsAppOrderMessage(order, items = [], parsedMeta = {}, promoMsg = '') {
  const statusText = STATUS_LABEL[order.status] || order.status;
  const dateFmt = new Date(order.created_at).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  let typeText = '🥡 Self Pickup';
  if (parsedMeta.type === 'delivery') {
    typeText = '🛵 Home Delivery';
  } else if (parsedMeta.type === 'table') {
    typeText = `🍽️ Table #${parsedMeta.tableNumber || ''}`;
  }

  let msg = `🍽️ *LIMRA RESTAURANT — ORDER DETAILS* 🍽️\n\n`;
  msg += `Hi *${order.customer_name || 'Valued Customer'}*, thank you for ordering with LIMRA Restaurant!\n\n`;
  msg += `📋 *Order ID*: #${order.order_number}\n`;
  msg += `📌 *Status*: ${statusText}\n`;
  msg += `🛵 *Order Type*: ${typeText}\n`;
  msg += `📅 *Date & Time*: ${dateFmt}\n`;
  msg += `📱 *Phone*: ${order.customer_phone || 'N/A'}\n`;

  if (parsedMeta.address) {
    msg += `📍 *Delivery Address*: ${parsedMeta.address}\n`;
  }
  if (order.landmark) {
    msg += `🏷️ *Landmark*: ${order.landmark}\n`;
  }
  if (order.delivery_notes) {
    msg += `📝 *Instructions*: ${order.delivery_notes}\n`;
  }

  msg += `\n----------------------------------------\n`;
  msg += `🍽️ *ITEMS ORDERED:* \n`;

  if (!items || items.length === 0) {
    msg += `• Food Items Package\n`;
  } else {
    items.forEach(item => {
      const qty = item.quantity || 1;
      const price = Number(item.unit_price || 0);
      const lineTotal = Number(item.line_total || (price * qty));
      msg += `• ${item.item_name} x ${qty} — ₹${lineTotal.toFixed(2)}\n`;
    });
  }

  msg += `----------------------------------------\n\n`;

  const itemsSubtotal = items.reduce((sum, i) => sum + Number(i.line_total || (i.unit_price * i.quantity)), 0);
  if (itemsSubtotal > 0 && Math.abs(itemsSubtotal - Number(order.total_amount)) > 0.01) {
    msg += `💵 *Items Subtotal*: ₹${itemsSubtotal.toFixed(2)}\n`;
  }

  if (parsedMeta.charge && parsedMeta.charge !== '—' && parsedMeta.charge !== 'Free') {
    msg += `🚚 *Delivery Charge*: ${parsedMeta.charge}\n`;
  }

  msg += `💰 *GRAND TOTAL*: ₹${Number(order.total_amount).toFixed(2)}\n`;
  msg += `💳 *Payment Status*: ${(order.payment_status || 'unpaid').toUpperCase()}\n`;

  if (promoMsg && promoMsg.trim()) {
    msg += `\n🎁 *Special Offer*: ${promoMsg.trim()}\n`;
  }

  msg += `\n⭐ *Enjoyed your meal? Please leave us a 5-star Google Review:* \nhttps://www.google.com/search?q=LIMRA+RESTAURANT+Reviews&si=APenkKm7iecQ4G6P-TsbSMFKIQtv3EFIqRAFw-i8uEbk55Z-_6dIxfmNBwW99EmmQi8qL9XUXBIGdTaYGGEV6j9GaIbMMJLZYHcwcGdpMDluPybR3SZOzvBqx0gc8Uh6gAtJQdgYpnaRRIWykrEWWbdLZoniWAXnEg%3D%3D\n`;
  msg += `\n📍 *Locate us on Google Maps:* \nhttps://www.google.com/maps/place/LIMRA+RESTAURANT/@21.8603074,87.4768049,859m/data=!3m2!1e3!4b1!4m6!3m5!1s0x3a1d2b2614f3c155:0xdf9ca79af511eaca!8m2!3d21.8603074!4d87.4793798!16s%2Fg%2F11wwq23wgv?entry=ttu\n`;

  msg += `\nThank you for choosing LIMRA Restaurant! 🙏\nQuestions or changes? Call us at 097390 83418`;

  return msg;
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
  $('order-detail-title').textContent = `Order #${order.order_number}`;
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

  const digits = order.customer_phone ? order.customer_phone.replace(/\D/g, '') : '';
  const whatsappPhone = digits ? (digits.length === 10 ? '91' + digits : digits) : '';
  const statusText = STATUS_LABEL[order.status] || order.status;
  const detailedWhatsappMsg = buildDetailedWhatsAppOrderMessage(order, items, parsedMeta, promoMsg);
  const whatsappLink = whatsappPhone 
    ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(detailedWhatsappMsg)}`
    : `https://wa.me/?text=${encodeURIComponent(detailedWhatsappMsg)}`;

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
          <div class="adm-action-row">
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

          // Dynamic sharing text bindings with full itemized breakdown
          let fullShareMsg = detailedWhatsappMsg;
          if (latVal && lngVal) {
            fullShareMsg += `\n\n🗺️ *Location Route Pin*: https://maps.google.com/?q=${latVal},${lngVal}`;
          }

          const shareSms = `LIMRA Order #${order.order_number} (${fmtMoney(order.total_amount)}). Status: ${statusText}. Items: ${items.map(i => `${i.item_name} x${i.quantity}`).join(', ')}. Delivery: ${parsedMeta.address || 'Pickup'}`;

          document.getElementById('detail-share-wa-btn')?.addEventListener('click', () => {
            const targetUrl = whatsappPhone 
              ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(fullShareMsg)}` 
              : `https://wa.me/?text=${encodeURIComponent(fullShareMsg)}`;
            window.open(targetUrl, '_blank');
          });

          document.getElementById('detail-share-sms-btn')?.addEventListener('click', () => {
            const smsUrl = whatsappPhone ? `sms:${whatsappPhone}?body=${encodeURIComponent(shareSms)}` : `sms:?body=${encodeURIComponent(shareSms)}`;
            window.open(smsUrl, '_blank');
          });

          document.getElementById('detail-copy-details-btn')?.addEventListener('click', () => {
            navigator.clipboard.writeText(fullShareMsg).then(() => {
              showAdminToast('Complete order & item details copied to clipboard!', 'success');
            }).catch(() => {
              fallbackCopy(fullShareMsg);
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

// ── Customers ───────────────────────────────────────────

function renderCustomers() {
  const search = ($('customers-search')?.value || getGlobalSearch()).toLowerCase().trim();
  let customers = buildCustomerStats();
  if (search) {
    customers = customers.filter(c =>
      c.name.toLowerCase().includes(search) || c.phone.includes(search)
    );
  }

  const el = $('customers-list');
  if (customers.length === 0) {
    el.innerHTML = '<div class="adm-card adm-empty col-span-full">No customer data yet</div>';
    return;
  }

  el.innerHTML = customers.map(c => {
    const topItems = Object.entries(c.items).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const typeLabel = { table: '🪑 Table', party: '🎉 Party', wedding: '💍 Wedding' };
    const recentBookingRows = c.recentBookings.slice(0, 4).map(b => `
      <div class="adm-booking-row">
        <span>${typeLabel[b.type] || b.type} #${b.booking_number}</span>
        <span>${b.booking_date || fmtDateShort(b.created_at)} · ${b.guests || '?'} guests</span>
        ${statusPill(b.status)}
      </div>
    `).join('');

    return `
      <div class="adm-card adm-customer-detail-card">
        <div class="adm-customer-card-header">
          <div class="adm-customer-card adm-customer-card--inline">
            <div class="adm-customer-avatar">${initials(c.name)}</div>
            <div>
              <p class="adm-customer-name">${escapeHtml(c.name)}</p>
              <p class="adm-customer-role">Customer</p>
              <a href="tel:${c.phone}" class="adm-customer-phone">${escapeHtml(c.phone)}</a>
              ${c.email ? `<span class="adm-email-badge" style="margin-top:0.25rem">${escapeHtml(c.email)}</span>` : ''}
            </div>
          </div>
          ${c.orderCount > 0 ? `
            <div class="adm-customer-spent">
              <span>Total Spent</span>
              <strong>${fmtMoney(c.totalSpent)}</strong>
            </div>
          ` : `
            <div class="adm-customer-spent adm-customer-spent--bookings">
              <span>Bookings</span>
              <strong>${c.bookingCount}</strong>
            </div>
          `}
        </div>

        <div class="adm-stat-row">
          <div class="adm-stat-mini"><span>Orders</span><strong>${c.orderCount}</strong></div>
          <div class="adm-stat-mini"><span>Bookings</span><strong>${c.bookingCount}</strong></div>
          <div class="adm-stat-mini"><span>Table</span><strong>${c.tableBookings}</strong></div>
          <div class="adm-stat-mini"><span>Party</span><strong>${c.partyBookings}</strong></div>
        </div>
        ${c.weddingBookings > 0 ? `<p class="adm-wedding-count">💍 Wedding enquiries: <strong>${c.weddingBookings}</strong></p>` : ''}

        ${c.orderCount > 0 ? `
          <div class="adm-stat-row adm-stat-row--2">
            <div class="adm-stat-mini"><span>Avg Order</span><strong>${fmtMoney(c.totalSpent / c.orderCount)}</strong></div>
            <div class="adm-stat-mini"><span>Last Order</span><strong>${fmtDateShort(c.lastOrder)}</strong></div>
          </div>
        ` : ''}

        ${topItems.length > 0 ? `
          <p class="adm-detail-section-title">Most Ordered</p>
          <div class="adm-item-list">
            ${topItems.map(([name, qty]) => `
              <div class="adm-item-row">
                <span>${escapeHtml(name)}</span>
                <strong>${qty}×</strong>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${c.recentBookings.length > 0 ? `
          <p class="adm-detail-section-title">Bookings (Table / Party / Wedding)</p>
          <div class="adm-booking-list">${recentBookingRows}</div>
        ` : ''}
      </div>
    `;
  }).join('');
}

// ── Customer Analysis ────────────────────────────────────

function buildCustomerAnalysis() {
  const map = new Map();

  orders.forEach(order => {
    const phone = order.customer_phone;
    if (!phone) return;

    if (!map.has(phone)) {
      map.set(phone, {
        name: order.customer_name || 'Customer',
        phone: phone,
        totalSpent: 0,
        orderCount: 0,
        ordersList: []
      });
    }

    const c = map.get(phone);
    c.orderCount += 1;
    c.totalSpent += Number(order.total_amount);

    if (order.customer_name && (!c.name || c.name === 'Customer')) {
      c.name = order.customer_name;
    }

    const items = orderItems.filter(item => item.order_id === order.id && isFoodItem(item.item_name));
    const itemsList = items.map(it => `${it.item_name} (x${it.quantity || 1})`).join(', ');

    c.ordersList.push({
      id: order.id,
      date: new Date(order.created_at),
      amount: Number(order.total_amount),
      food: itemsList || 'No items listed'
    });
  });

  const list = [...map.values()];
  list.forEach(c => {
    c.ordersList.sort((a, b) => b.date - a.date);
  });

  return list.sort((a, b) => b.totalSpent - a.totalSpent);
}

function getFilteredCustomerAnalysis() {
  const search = ($('analysis-search')?.value || '').toLowerCase().trim();
  const dateFilter = $('analysis-date-filter')?.value || '';
  let customers = buildCustomerAnalysis();

  if (dateFilter) {
    customers = customers.map(c => {
      const matchingOrders = c.ordersList.filter(o => getLocalDateString(o.date) === dateFilter);
      if (matchingOrders.length === 0) return null;
      const totalSpent = matchingOrders.reduce((sum, o) => sum + o.amount, 0);
      return {
        ...c,
        totalSpent,
        orderCount: matchingOrders.length,
        ordersList: matchingOrders
      };
    }).filter(Boolean);
  }

  if (search) {
    customers = customers.filter(c =>
      c.name.toLowerCase().includes(search) ||
      c.phone.includes(search) ||
      c.ordersList.some(o =>
        getLocalDateString(o.date).includes(search) ||
        o.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).toLowerCase().includes(search)
      )
    );
  }

  return customers;
}

function exportCustomerAnalysisToExcel() {
  const customers = getFilteredCustomerAnalysis();
  if (customers.length === 0) {
    showAdminToast('No customer analysis records to export.', 'info');
    return;
  }

  const headers = ['Customer Name', 'Phone Number', 'Total Spent (INR)', 'Total Orders', 'Last Order Date', 'Order History & Details'];
  
  const csvRows = [];
  csvRows.push(headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','));

  customers.forEach(c => {
    const lastOrderDate = c.ordersList.length > 0 ? getLocalDateString(c.ordersList[0].date) : 'N/A';
    const historyDetails = c.ordersList.map(o => {
      const dateStr = o.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      return `[${dateStr} | ₹${o.amount.toFixed(2)} | ${o.food}]`;
    }).join('; ');

    const row = [
      c.name,
      c.phone,
      c.totalSpent.toFixed(2),
      c.orderCount,
      lastOrderDate,
      historyDetails
    ];

    const escapedRow = row.map(val => {
      const str = String(val !== undefined && val !== null ? val : '');
      return `"${str.replace(/"/g, '""')}"`;
    }).join(',');

    csvRows.push(escapedRow);
  });

  // UTF-8 BOM byte order mark for Excel compatibility
  const csvContent = '\uFEFF' + csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const dateStr = getLocalDateString(new Date());
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `LIMRA_Customer_Analysis_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showAdminToast(`Exported ${customers.length} customer records to Excel.`, 'success');
}

function renderCustomerAnalysis() {
  const customers = getFilteredCustomerAnalysis();
  const tbody = $('analysis-table-body');
  if (!tbody) return;

  if (customers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-slate-400">No customer analysis data found.</td></tr>';
    return;
  }

  tbody.innerHTML = customers.map(c => {
    const ordersHtml = c.ordersList.map(o => `
      <div style="border-bottom:1px solid rgba(255,255,255,0.05); padding:0.4rem 0; font-size:0.75rem;">
        <div style="display:flex; justify-content:space-between; font-weight:bold; color:var(--adm-text);">
          <span>📅 ${o.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          <span style="color:var(--adm-green); margin-left: auto;">₹${o.amount.toFixed(2)}</span>
        </div>
        <div style="color:var(--adm-muted); margin-top:2px;">🍔 ${escapeHtml(o.food)}</div>
      </div>
    `).join('');

    return `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
        <td class="font-bold text-slate-900" style="padding:1rem; vertical-align: top;">${escapeHtml(c.name)}</td>
        <td class="text-sm font-mono" style="padding:1rem; vertical-align: top;">${escapeHtml(c.phone)}</td>
        <td class="font-semibold text-emerald-600" style="padding:1rem; text-align:right; vertical-align: top;">₹${c.totalSpent.toFixed(2)}</td>
        <td style="padding:1rem; text-align:center; font-weight:bold; vertical-align: top;">${c.orderCount}</td>
        <td style="padding: 0.5rem 1rem; vertical-align: top;">
          <div style="max-height:180px; overflow-y:auto; padding-right:0.5rem;">
            ${ordersHtml}
          </div>
        </td>
      </tr>
    `;
  }).join('');
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

let activeMenuOverrides = [];

function initFoodsFilters() {
  const sel = $('foods-category-filter');
  if (sel.options.length > 1) return;
  Object.entries(categoryLabels).forEach(([key, label]) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = label;
    sel.appendChild(opt);
  });
  $('foods-count').textContent = menuItems.length;
}

async function loadAndRenderFoods() {
  try {
    $('foods-grid').innerHTML = '<div class="adm-empty col-span-full">Loading menu controls...</div>';
    activeMenuOverrides = await getMenuOverrides();
  } catch (e) {
    console.error("Failed to load menu overrides:", e);
  }
  renderFoods();
}

function renderFoods() {
  const cat = $('foods-category-filter')?.value || 'all';
  const search = ($('foods-search')?.value || '').toLowerCase().trim();
  
  let items = menuItems.map(item => {
    const override = activeMenuOverrides.find(o => o.id === item.id);
    if (override) {
      return {
        ...item,
        price: override.price !== null && override.price !== undefined ? parseFloat(override.price) : item.price,
        mrp: override.mrp !== null && override.mrp !== undefined ? parseFloat(override.mrp) : item.mrp,
        available: override.available !== undefined ? override.available : true,
        featured: override.featured !== undefined ? override.featured : false,
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

  if (cat !== 'all') items = items.filter(m => m.category === cat);
  if (search) items = items.filter(m => m.name.toLowerCase().includes(search));

  $('foods-grid').innerHTML = items.length === 0
    ? '<div class="adm-empty col-span-full">No menu items found</div>'
    : items.map(item => {
        const img = item.image || categoryImages[item.category];
        const isAvailable = item.available !== false;
        const isFeatured = item.featured === true;
        return `
          <div class="adm-food-card ${isAvailable ? '' : 'adm-food-card-disabled'}" data-item-id="${item.id}">
            ${img
              ? `<img src="${img}" alt="${item.name}" class="adm-food-img" />`
              : `<div class="adm-food-emoji">${item.emoji}</div>`}
            <div class="adm-food-info">
              <p class="adm-food-name">${item.name}</p>
              <p class="adm-food-cat">${categoryLabels[item.category] || item.category}</p>
              <p class="adm-food-price">
                ${fmtMoney(item.price)}
                ${item.mrp ? `<span class="adm-food-mrp">${fmtMoney(item.mrp)}</span>` : ''}
              </p>
            </div>
            
            <div class="adm-food-controls">
              <!-- Availability Toggle -->
              <label class="adm-toggle-label">
                <input type="checkbox" class="adm-toggle-available" ${isAvailable ? 'checked' : ''} />
                <span class="adm-toggle-slider"></span>
                <span class="adm-toggle-text">Available</span>
              </label>

              <!-- Featured Toggle -->
              <label class="adm-toggle-label">
                <input type="checkbox" class="adm-toggle-featured" ${isFeatured ? 'checked' : ''} />
                <span class="adm-toggle-slider"></span>
                <span class="adm-toggle-text">Special / Featured</span>
              </label>
              
              <!-- Edit Button -->
              <button class="adm-food-btn-edit">
                ✏️ Edit Price
              </button>
            </div>
          </div>
        `;
      }).join('');

  setupFoodControlListeners();
}

function setupFoodControlListeners() {
  const grid = $('foods-grid');
  if (!grid) return;

  grid.querySelectorAll('.adm-toggle-available').forEach(cb => {
    cb.addEventListener('change', async () => {
      const card = cb.closest('.adm-food-card');
      const itemId = parseInt(card.dataset.itemId, 10);
      const isChecked = cb.checked;
      
      if (isChecked) {
        card.classList.remove('adm-food-card-disabled');
      } else {
        card.classList.add('adm-food-card-disabled');
      }

      try {
        let override = activeMenuOverrides.find(o => o.id === itemId);
        if (!override) {
          const staticItem = menuItems.find(m => m.id === itemId);
          override = {
            id: itemId,
            price: staticItem.price,
            mrp: staticItem.mrp || null,
            available: isChecked,
            featured: false
          };
          activeMenuOverrides.push(override);
        } else {
          override.available = isChecked;
        }

        await saveMenuOverride(override);
      } catch (err) {
        alert('Failed to update availability: ' + err.message);
        cb.checked = !isChecked;
        if (isChecked) card.classList.add('adm-food-card-disabled');
        else card.classList.remove('adm-food-card-disabled');
      }
    });
  });

  grid.querySelectorAll('.adm-toggle-featured').forEach(cb => {
    cb.addEventListener('change', async () => {
      const card = cb.closest('.adm-food-card');
      const itemId = parseInt(card.dataset.itemId, 10);
      const isChecked = cb.checked;

      try {
        let override = activeMenuOverrides.find(o => o.id === itemId);
        if (!override) {
          const staticItem = menuItems.find(m => m.id === itemId);
          override = {
            id: itemId,
            price: staticItem.price,
            mrp: staticItem.mrp || null,
            available: true,
            featured: isChecked
          };
          activeMenuOverrides.push(override);
        } else {
          override.featured = isChecked;
        }

        await saveMenuOverride(override);
      } catch (err) {
        alert('Failed to update featured status: ' + err.message);
        cb.checked = !isChecked;
      }
    });
  });

  grid.querySelectorAll('.adm-food-btn-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.adm-food-card');
      const itemId = parseInt(card.dataset.itemId, 10);
      
      const staticItem = menuItems.find(m => m.id === itemId);
      const override = activeMenuOverrides.find(o => o.id === itemId);

      const currentPrice = override && override.price !== null && override.price !== undefined ? override.price : staticItem.price;
      const currentMrp = override && override.mrp !== null && override.mrp !== undefined ? override.mrp : (staticItem.mrp || '');
      const currentDesc = override && override.description !== undefined ? override.description : (staticItem.description || '');

      $('edit-modal-item-id').value = itemId;
      $('edit-modal-item-name').textContent = `Edit Details: ${staticItem.name}`;
      $('edit-modal-item-price').value = currentPrice;
      $('edit-modal-item-mrp').value = currentMrp;
      $('edit-modal-item-desc').value = currentDesc;

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
    const itemId = parseInt($('edit-modal-item-id').value, 10);
    const newPrice = parseFloat($('edit-modal-item-price').value);
    const newMrpVal = $('edit-modal-item-mrp').value;
    const newMrp = newMrpVal ? parseFloat(newMrpVal) : null;
    const newDesc = $('edit-modal-item-desc').value.trim();

    if (isNaN(newPrice) || newPrice <= 0) {
      alert('Please enter a valid price');
      return;
    }

    const saveBtn = form.querySelector('button[type="submit"]');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      let override = activeMenuOverrides.find(o => o.id === itemId);
      if (!override) {
        override = {
          id: itemId,
          price: newPrice,
          mrp: newMrp,
          description: newDesc,
          available: true,
          featured: false
        };
        activeMenuOverrides.push(override);
      } else {
        override.price = newPrice;
        override.mrp = newMrp;
        override.description = newDesc;
      }

      await saveMenuOverride(override);
      modal.classList.remove('active');
      renderFoods();
    } catch (err) {
      alert('Failed to save changes: ' + err.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Changes';
    }
  });
}

// ── Navigation ──────────────────────────────────────────

const PANEL_TITLES = {
  dashboard: 'Dashboard',
  orders: 'Order List',
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
  if (panelId === 'order-detail') {
    renderOrderDetailPicker();
    renderOrderDetail(selectedOrderId);
  }
  if (panelId === 'dashboard') {
    if (dashboardMap) {
      setTimeout(() => {
        dashboardMap.invalidateSize();
      }, 100);
    }
  }

  if (window.innerWidth < 1024) {
    $('sidebar').classList.add('closed');
    hide($('sidebar-overlay'));
  }
}

function renderAll() {
  renderOverview();
  renderOrdersTable();
  renderOrderDetailPicker();
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
  if (window.innerWidth >= 1024) $('sidebar').classList.remove('closed');
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
  
  const typePills = document.querySelectorAll('#order-type-pills .adm-pill');
  typePills.forEach(pill => {
    pill.addEventListener('click', () => {
      typePills.forEach(p => {
        p.classList.remove('active');
        p.style.background = '#f5f7fa';
        p.style.color = 'var(--adm-text)';
      });
      pill.classList.add('active');
      pill.style.background = 'var(--adm-green)';
      pill.style.color = '#fff';
      activeOrderTypeFilter = pill.dataset.type;
      ordersPage = 1;
      renderOrdersTable();
    });
  });

  $('orders-search')?.addEventListener('input', () => { ordersPage = 1; renderOrdersTable(); });
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
    const isClosed = $('sidebar').classList.toggle('closed');
    if (isClosed) {
      hide($('sidebar-overlay'));
    } else {
      show($('sidebar-overlay'));
    }
  });
  $('sidebar-overlay').addEventListener('click', () => {
    $('sidebar').classList.add('closed');
    hide($('sidebar-overlay'));
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth >= 1024) {
      $('sidebar').classList.remove('closed');
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
        <div><strong>Order No:</strong> #${order.order_number}</div>
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
  
  if (typeof qz === 'undefined') {
    showAdminToast('QZ Tray SDK is not loaded in this browser.', 'error');
    return;
  }
  
  if (!qzConnected || !qz.websocket.isActive()) {
    // Try reconnecting
    await initQZTray();
    if (!qzConnected) {
      showAdminToast('Printer is offline. Ensure QZ Tray is running and click the printer badge to connect.', 'error');
      return;
    }
  }
  
  if (!activePrinter) {
    showAdminToast('No printer selected. Click the printer badge in the header to select one.', 'error');
    await selectQZPrinter();
    if (!activePrinter) return;
  }
  
  try {
    const config = qz.configs.create(activePrinter);
    const receiptHtml = generateReceiptHtml(order);
    
    const printData = [{
      type: 'pixel',
      format: 'html',
      flavor: 'plain',
      data: receiptHtml
    }];
    
    await qz.print(config, printData);
    showAdminToast(`Receipt for Order #${order.order_number} sent to printer.`, 'success');
  } catch (err) {
    console.error('[QZ] Printing error:', err);
    showAdminToast('Printing failed: ' + err.message, 'error');
  }
}

// ── Coupons Management ──────────────────────────────────
let adminCoupons = [];
let editingCouponCode = null;

async function loadAndRenderCoupons() {
  try {
    $('coupons-table-body').innerHTML = '<tr><td colspan="8" class="text-center py-4 text-slate-400">Loading coupons...</td></tr>';
    adminCoupons = await getCoupons();
    renderCouponsTable();
  } catch (err) {
    console.error('Failed to load coupons:', err);
    $('coupons-table-body').innerHTML = `<tr><td colspan="8" class="text-center py-4 text-red-500">Error: ${err.message}</td></tr>`;
  }
}

function renderCouponsTable() {
  $('coupons-count').textContent = adminCoupons.length;
  
  if (adminCoupons.length === 0) {
    $('coupons-table-body').innerHTML = '<tr><td colspan="8" class="text-center py-4 text-slate-400">No coupons found. Click Create Coupon to add one.</td></tr>';
    return;
  }
  
  $('coupons-table-body').innerHTML = adminCoupons.map(c => {
    const isExpired = new Date(c.expiry_date) < new Date();
    const expiryStr = new Date(c.expiry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const statusText = c.active && !isExpired ? 'Active' : (isExpired ? 'Expired' : 'Inactive');
    const statusClass = c.active && !isExpired ? 'adm-badge-success' : 'adm-badge-danger';
    
    return `
      <tr>
        <td class="font-bold text-slate-900" style="padding:1rem">${c.code}</td>
        <td class="font-semibold text-emerald-600">${c.discount_pct}% OFF</td>
        <td>₹${parseFloat(c.min_bill).toFixed(2)}</td>
        <td>${c.used_count} / ${c.max_uses} uses</td>
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
        <td><span class="adm-badge ${c.active && !isExpired ? '' : 'inactive'}" style="background:${c.active && !isExpired ? 'rgba(0,176,116,0.1)' : 'rgba(255,91,91,0.1)'};color:${c.active && !isExpired ? 'var(--adm-green)' : '#ff5b5b'};padding:4px 8px;border-radius:12px;font-size:0.75rem;font-weight:700">${statusText}</span></td>
        <td>
          <div style="display:flex;gap:0.5rem">
            <button class="btn-secondary text-xs btn-share-coupon" data-code="${c.code}" data-pct="${c.discount_pct}" data-min="${c.min_bill}" data-expiry="${expiryStr}" style="padding:0.35rem 0.65rem;font-size:0.75rem;background:rgba(0,176,116,0.08);color:var(--adm-green);border:1px solid rgba(0,176,116,0.15);border-radius:6px;cursor:pointer;font-weight:600">🔗 Share</button>
            <button class="btn-secondary text-xs btn-edit-coupon" data-code="${c.code}" style="padding:0.35rem 0.65rem;font-size:0.75rem">✏️ Edit</button>
            <button class="btn-danger text-xs btn-delete-coupon" data-code="${c.code}" style="padding:0.35rem 0.65rem;background:#fdecea;color:#ff5b5b;border:none;border-radius:6px;font-size:0.75rem;font-weight:600;cursor:pointer">🗑️ Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
  
  setupCouponEventListeners();
}

function setupCouponEventListeners() {
  const body = $('coupons-table-body');
  if (!body) return;
  
  body.querySelectorAll('.coupon-toggle-auto-send').forEach(cb => {
    cb.addEventListener('change', async () => {
      const code = cb.dataset.code;
      const isChecked = cb.checked;
      
      try {
        const coupon = adminCoupons.find(c => c.code === code);
        if (coupon) {
          coupon.is_auto_send = isChecked;
          await saveCoupon(coupon);
          loadAndRenderCoupons();
        }
      } catch (err) {
        alert('Failed to set auto-send: ' + err.message);
        cb.checked = !isChecked;
      }
    });
  });
  
  body.querySelectorAll('.btn-share-coupon').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.dataset.code;
      const pct = btn.dataset.pct;
      const min = btn.dataset.min;
      const expiry = btn.dataset.expiry;
      
      // Populate hidden fields in share modal
      $('share-coupon-code').value = code;
      $('share-coupon-pct').value = pct;
      $('share-coupon-min').value = min;
      $('share-coupon-expiry').value = expiry;
      
      // Clear inputs
      $('share-customer-name').value = '';
      $('share-customer-phone').value = '';
      
      // Set default message
      updateShareMessage();
      
      // Open modal
      $('adm-coupon-share-modal').classList.add('active');
    });
  });
  
  body.querySelectorAll('.btn-edit-coupon').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.dataset.code;
      const coupon = adminCoupons.find(c => c.code === code);
      if (coupon) {
        editingCouponCode = code;
        $('coupon-modal-title').textContent = 'Edit Coupon';
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
  
  body.querySelectorAll('.btn-delete-coupon').forEach(btn => {
    btn.addEventListener('click', async () => {
      const code = btn.dataset.code;
      if (confirm(`Are you sure you want to delete coupon: ${code}?`)) {
        try {
          await deleteCoupon(code);
          loadAndRenderCoupons();
        } catch (err) {
          alert('Failed to delete coupon: ' + err.message);
        }
      }
    });
  });
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
let adminCombos = [];

async function loadAndRenderCombos() {
  try {
    $('combos-table-body').innerHTML = '<tr><td colspan="6" class="text-center py-4 text-slate-400">Loading combos...</td></tr>';
    adminCombos = await getCombos();
    renderCombosTable();
  } catch (err) {
    console.error('Failed to load combos:', err);
    $('combos-table-body').innerHTML = `<tr><td colspan="6" class="text-center py-4 text-red-500">Error: ${err.message}</td></tr>`;
  }
}

function renderCombosTable() {
  $('combos-count').textContent = adminCombos.length;
  
  if (adminCombos.length === 0) {
    $('combos-table-body').innerHTML = '<tr><td colspan="6" class="text-center py-4 text-slate-400">No combos found. Click Create Combo Pack to add one.</td></tr>';
    return;
  }
  
  $('combos-table-body').innerHTML = adminCombos.map(c => {
    const itemsListStr = Array.isArray(c.items)
      ? c.items.map(it => `${it.name} (x${it.qty || 1})`).join(', ')
      : 'No items';
      
    const statusText = c.available ? 'Available' : 'Unavailable';
    const hasDiscount = c.mrp && parseFloat(c.mrp) > parseFloat(c.price);
    const priceDisplay = hasDiscount
      ? `₹${parseFloat(c.price).toFixed(2)} <span style="text-decoration:line-through;font-size:0.8em;color:var(--adm-muted);margin-left:0.25rem">₹${parseFloat(c.mrp).toFixed(2)}</span>`
      : `₹${parseFloat(c.price).toFixed(2)}`;
    
    return `
      <tr>
        <td class="font-bold text-slate-900" style="padding:1rem">
          <div style="display:flex; align-items:center; gap:0.75rem">
            ${c.image_url ? `<img src="${c.image_url}" style="width:40px; height:40px; border-radius:6px; object-fit:cover; border:1px solid rgba(255,255,255,0.08)" />` : `<div style="width:40px; height:40px; border-radius:6px; background:rgba(0,0,0,0.15); display:flex; align-items:center; justify-content:center; border:1px solid rgba(255,255,255,0.05); font-size:1.2rem">🍿</div>`}
            <span>${c.name}</span>
          </div>
        </td>
        <td class="text-xs text-slate-500" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.description || 'N/A'}</td>
        <td class="text-xs font-mono text-slate-400">${itemsListStr}</td>
        <td class="font-semibold text-emerald-600">${priceDisplay}</td>
        <td>
          <label class="adm-toggle-label">
            <input type="checkbox" class="combo-toggle-availability" data-id="${c.id}" ${c.available ? 'checked' : ''} />
            <span class="adm-toggle-slider"></span>
            <span class="adm-toggle-text text-xs" style="font-weight:bold;color:${c.available ? 'var(--adm-green)' : 'var(--adm-muted)'}">
              ${statusText}
            </span>
          </label>
        </td>
        <td>
          <div style="display:flex;gap:0.5rem">
            <button class="btn-secondary text-xs btn-edit-combo" data-id="${c.id}" style="padding:0.35rem 0.65rem;font-size:0.75rem">✏️ Edit</button>
            <button class="btn-danger text-xs btn-delete-combo" data-id="${c.id}" style="padding:0.35rem 0.65rem;background:#fdecea;color:#ff5b5b;border:none;border-radius:6px;font-size:0.75rem;font-weight:600;cursor:pointer">🗑️ Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
  
  setupComboEventListeners();
}

function setupComboEventListeners() {
  const body = $('combos-table-body');
  if (!body) return;
  
  body.querySelectorAll('.combo-toggle-availability').forEach(cb => {
    cb.addEventListener('change', async () => {
      const id = parseInt(cb.dataset.id, 10);
      const isChecked = cb.checked;
      
      try {
        const combo = adminCombos.find(c => c.id === id);
        if (combo) {
          combo.available = isChecked;
          await saveCombo(combo);
          loadAndRenderCombos();
        }
      } catch (err) {
        alert('Failed to update availability: ' + err.message);
        cb.checked = !isChecked;
      }
    });
  });
  
  body.querySelectorAll('.btn-edit-combo').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id, 10);
      const combo = adminCombos.find(c => c.id === id);
      if (combo) {
        $('combo-modal-title').textContent = 'Edit Combo Pack';
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
  
  body.querySelectorAll('.btn-delete-combo').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.id, 10);
      if (confirm('Are you sure you want to delete this combo?')) {
        try {
          await deleteCombo(id);
          loadAndRenderCombos();
        } catch (err) {
          alert('Failed to delete combo: ' + err.message);
        }
      }
    });
  });
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
