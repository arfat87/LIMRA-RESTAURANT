import './style.css';
import './admin.css';
import { Chart, registerables } from 'chart.js';
import { insforge, getMenuOverrides, saveMenuOverride } from './lib/insforge.js';
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
  const [ordersRes, itemsRes, bookingsRes, notifsRes] = await Promise.all([
    insforge.database.from('orders').select('*').order('created_at', { ascending: false }),
    insforge.database.from('order_items').select('*'),
    insforge.database.from('bookings').select('*').order('created_at', { ascending: false }),
    insforge.database.from('notifications').select('*').order('created_at', { ascending: false }).limit(50),
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
  $('last-updated').textContent = `Updated ${new Date().toLocaleTimeString('en-IN')}`;
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
      c.items[item.item_name] = (c.items[item.item_name] || 0) + item.quantity;
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

function getTopItems(limit = 8) {
  const counts = {};
  orderItems.forEach(item => {
    counts[item.item_name] = (counts[item.item_name] || 0) + item.quantity;
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

function renderOverview() {
  renderStats();
  renderDonuts();
  renderCharts();
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

  if (activeOrderTypeFilter === 'online') {
    filtered = filtered.filter(o => o.order_type !== 'table');
  } else if (activeOrderTypeFilter === 'table') {
    filtered = filtered.filter(o => o.order_type === 'table');
  }
  
  if (search) {
    filtered = filtered.filter(o =>
      o.customer_name.toLowerCase().includes(search) ||
      o.customer_phone.includes(search) ||
      String(o.order_number).includes(search)
    );
  }
  return filtered;
}

function renderOrdersTable() {
  const filtered = getFilteredOrders();
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

function renderOrderDetail(orderId) {
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

  const digits = order.customer_phone.replace(/\D/g, '');
  const formattedPhone = digits.length === 10 ? '91' : '';
  const whatsappPhone = formattedPhone + digits;
  const statusText = STATUS_LABEL[order.status] || order.status;
  const whatsappMsg = `Hi ${order.customer_name}, your LIMRA order #${order.order_number} has been received! Current status: ${statusText}. We are preparing it with care and will contact you as soon as possible. Thank you for choosing LIMRA!`;
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
          <div class="adm-action-row">
            ${order.status === 'pending' ? `<button type="button" class="adm-btn adm-btn-primary adm-btn-sm accept-order">✓ Accept Order</button>` : ''}
            ${order.status === 'confirmed' ? `<button type="button" class="adm-btn adm-btn-primary adm-btn-sm prep-order">👨‍🍳 Start Preparing</button>` : ''}
            ${order.status === 'preparing' ? `<button type="button" class="adm-btn adm-btn-primary adm-btn-sm ready-order">✓ Mark Ready</button>` : ''}
            ${order.status === 'ready' ? `<button type="button" class="adm-btn adm-btn-primary adm-btn-sm deliver-order">✓ Mark Delivered</button>` : ''}
            ${order.status !== 'cancelled' && order.status !== 'delivered' ? `<button type="button" class="adm-btn adm-btn-danger adm-btn-sm cancel-order">✕ Cancel</button>` : ''}
            ${(order.payment_status || 'unpaid') === 'unpaid' ? `<button type="button" class="adm-btn adm-btn-success adm-btn-sm mark-paid-btn">💵 Mark As Paid</button>` : ''}
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
        featured: override.featured !== undefined ? override.featured : false
      };
    }
    return {
      ...item,
      available: true,
      featured: false
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

      $('edit-modal-item-id').value = itemId;
      $('edit-modal-item-name').textContent = `Edit Details: ${staticItem.name}`;
      $('edit-modal-item-price').value = currentPrice;
      $('edit-modal-item-mrp').value = currentMrp;

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
          available: true,
          featured: false
        };
        activeMenuOverrides.push(override);
      } else {
        override.price = newPrice;
        override.mrp = newMrp;
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
  analytics: 'Analytics',
  bookings: 'Bookings',
  foods: 'Foods',
};

function switchPanel(panelId) {
  document.querySelectorAll('.adm-panel').forEach(p => p.classList.remove('active'));
  document.querySelector(`#panel-${panelId}`)?.classList.add('active');
  document.querySelectorAll('.adm-nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`.adm-nav-item[data-panel="${panelId}"]`)?.classList.add('active');

  if (panelId === 'analytics') renderAnalytics();
  if (panelId === 'foods') { initFoodsFilters(); loadAndRenderFoods(); }
  if (panelId === 'bookings') renderBookingCalendar();
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

  // Setup modal listeners for menu editor
  setupEditModalListeners();
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
