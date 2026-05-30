import './style.css';
import './admin.css';
import { Chart, registerables } from 'chart.js';
import { insforge } from './lib/insforge.js';
import { menuItems, categoryImages, categoryLabels } from './data/menu.js';
import { getAdminLoginUrl } from './lib/admin-routes.js';

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
let currentUser = null;
let selectedOrderId = null;
let ordersPage = 1;
const ORDERS_PER_PAGE = 10;
const charts = {};

// ═══════════════════════════════════════
// REAL-TIME NOTIFICATION STATE & CHIME
// ═══════════════════════════════════════
const knownOrderIds = new Set();
const knownBookingIds = new Set();

function playNotificationChime() {
  try {
    const sound = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-600.wav');
    sound.volume = 0.8;
    sound.play();
  } catch (e) {
    console.warn('Could not play audio alert:', e);
  }
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

function statusPill(status) {
  const cls = status === 'pending' ? 'new' : status;
  return `<span class="adm-pill ${cls}">${STATUS_LABEL[status] || status}</span>`;
}

function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
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
  const [ordersRes, itemsRes, bookingsRes] = await Promise.all([
    insforge.database.from('orders').select('*').order('created_at', { ascending: false }),
    insforge.database.from('order_items').select('*'),
    insforge.database.from('bookings').select('*').order('created_at', { ascending: false }),
  ]);
  if (ordersRes.error) throw ordersRes.error;
  if (itemsRes.error) throw itemsRes.error;
  if (bookingsRes.error) throw bookingsRes.error;
  orders = ordersRes.data || [];
  orderItems = itemsRes.data || [];
  bookings = bookingsRes.data || [];
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

  $('stat-total-orders').textContent = orders.length;
  $('stat-delivered').textContent = delivered;
  $('stat-pending-orders').textContent = pending;
  $('stat-revenue').textContent = fmtMoney(revenue);

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
}

function renderOverview() {
  renderStats();
  renderDonuts();
  renderCharts();
}

// ── Orders table ────────────────────────────────────────

function getFilteredOrders() {
  const statusFilter = $('orders-status-filter')?.value || 'all';
  const search = ($('orders-search')?.value || getGlobalSearch()).toLowerCase().trim();
  let filtered = [...orders];
  if (statusFilter !== 'all') filtered = filtered.filter(o => o.status === statusFilter);
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
    tbody.innerHTML = `<tr><td colspan="7" class="adm-empty">No orders found</td></tr>`;
  } else {
    tbody.innerHTML = page.map(order => `
      <tr data-order-id="${order.id}">
        <td><strong>#${order.order_number}</strong></td>
        <td>${fmtDateShort(order.created_at)}</td>
        <td>${order.customer_name}</td>
        <td><a href="tel:${order.customer_phone}" style="color:var(--adm-green)">${order.customer_phone}</a></td>
        <td><strong>${fmtMoney(order.total_amount)}</strong></td>
        <td>${statusPill(order.status)}</td>
        <td><button class="adm-btn adm-btn-primary adm-btn-sm view-order-btn" data-order-id="${order.id}">View</button></td>
      </tr>
    `).join('');
  }

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
  if (order) order.status = newStatus;
  renderOverview();
  renderOrdersTable();
  renderOrderDetailPicker();
  if (selectedOrderId === orderId) renderOrderDetail(orderId);
  return true;
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
  show(statusSelect);
  statusSelect.innerHTML = ORDER_STATUSES.map(s =>
    `<option value="${s}" ${s === order.status ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`
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

  content.innerHTML = `
    <div class="adm-detail-grid">
      <div class="adm-detail-col">
        <div class="adm-card">
          <div class="adm-customer-card">
            <div class="adm-customer-avatar">${initials(order.customer_name)}</div>
            <div>
              <p class="adm-customer-name">${escapeHtml(order.customer_name)}</p>
              <span class="adm-pill confirmed">Customer</span>
              <p class="adm-customer-phone"><a href="tel:${order.customer_phone}">${escapeHtml(order.customer_phone)}</a></p>
            </div>
          </div>
        </div>

        <div class="adm-card">
          <h3 class="adm-card-title">Order Information</h3>
          <div class="adm-info-grid">
            <div class="adm-info-item"><label>Order Number</label><p>#${order.order_number}</p></div>
            <div class="adm-info-item"><label>Status</label><p>${statusPill(order.status)}</p></div>
            <div class="adm-info-item"><label>Total Amount</label><p style="color:var(--adm-green)">${fmtMoney(order.total_amount)}</p></div>
            <div class="adm-info-item"><label>Items Count</label><p>${items.length} item(s) · ${items.reduce((s, i) => s + i.quantity, 0)} qty</p></div>
            <div class="adm-info-item"><label>Placed At</label><p>${fmtDate(order.created_at)}</p></div>
            <div class="adm-info-item"><label>Last Updated</label><p>${fmtDate(order.updated_at)}</p></div>
            <div class="adm-info-item" style="grid-column:1/-1"><label>Order ID</label><p class="adm-info-muted">${order.id}</p></div>
          </div>
          ${order.notes ? `
            <div class="adm-detail-section">
              <p class="adm-detail-section-title">Customer Note</p>
              <div class="adm-note-box">${escapeHtml(order.notes)}</div>
            </div>
          ` : ''}
        </div>

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
            <a href="tel:${order.customer_phone}" class="adm-btn adm-btn-outline adm-btn-sm">📞 Call Customer</a>
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
    const statusOptions = BOOKING_STATUSES.map(s =>
      `<option value="${s}" ${s === b.status ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`
    ).join('');
    const typeLabel = { table: '🪑 Table', party: '🎉 Party', wedding: '💍 Wedding' }[b.type] || b.type;

    return `
      <div class="adm-card">
        <div class="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <p class="font-bold">Booking #${b.booking_number} · ${typeLabel}</p>
            <p class="text-sm" style="color:var(--adm-muted)">${b.customer_name} · ${b.customer_phone}</p>
            <p class="text-sm">${b.booking_date || '—'} ${b.booking_time || ''} · ${b.guests || '?'} guests</p>
          </div>
          <div class="flex items-center gap-2">
            ${statusPill(b.status)}
            <select class="adm-select adm-btn-sm booking-status-select" data-booking-id="${b.id}">${statusOptions}</select>
          </div>
        </div>
        ${b.seat_label ? `<p class="text-sm">Seat: <strong>${b.seat_label}</strong> · ${b.preference || ''}</p>` : ''}
        ${b.message ? `<p class="text-sm mt-2 p-2 rounded-lg" style="background:#f8faf9">${b.message}</p>` : ''}
      </div>
    `;
  }).join('');

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

function renderFoods() {
  const cat = $('foods-category-filter')?.value || 'all';
  const search = ($('foods-search')?.value || '').toLowerCase().trim();
  let items = [...menuItems];
  if (cat !== 'all') items = items.filter(m => m.category === cat);
  if (search) items = items.filter(m => m.name.toLowerCase().includes(search));

  $('foods-grid').innerHTML = items.length === 0
    ? '<div class="adm-empty col-span-full">No menu items found</div>'
    : items.map(item => {
        const img = item.image || categoryImages[item.category];
        return `
          <div class="adm-food-card">
            ${img
              ? `<img src="${img}" alt="${item.name}" class="adm-food-img" />`
              : `<div class="adm-food-emoji">${item.emoji}</div>`}
            <p class="adm-food-name">${item.name}</p>
            <p class="adm-food-cat">${categoryLabels[item.category] || item.category}</p>
            <p class="adm-food-price">${fmtMoney(item.price)}${item.mrp ? ` <span style="text-decoration:line-through;color:var(--adm-muted);font-size:0.8rem">${fmtMoney(item.mrp)}</span>` : ''}</p>
          </div>
        `;
      }).join('');
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
  if (panelId === 'foods') { initFoodsFilters(); renderFoods(); }
  if (panelId === 'bookings') renderBookingCalendar();
  if (panelId === 'order-detail') {
    renderOrderDetailPicker();
    renderOrderDetail(selectedOrderId);
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

async function refreshDashboard() {
  try {
    await loadData();
    renderAll();
  } catch (err) {
    console.error(err);
    alert('Failed to load data. Check your admin access.');
  }
}

// ── Auth flow ───────────────────────────────────────────

async function initAuth() {
  const { data } = await insforge.auth.getCurrentUser();
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

  $('refresh-btn').addEventListener('click', refreshDashboard);
  $('orders-status-filter')?.addEventListener('change', () => { ordersPage = 1; renderOrdersTable(); });
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
    $('sidebar').classList.toggle('closed');
    $('sidebar-overlay').classList.toggle('hidden');
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

  setInterval(refreshDashboard, 60000);
}

document.addEventListener('DOMContentLoaded', () => {
  initDashboardAuth();
  initDashboardUI();
  initAuth();
});
