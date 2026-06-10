// ================================================================
// LIMRA RMS — Admin Dashboard Logic
// admin/dashboard.js
// ================================================================
import { db, tables, orders, realtime } from '../src/lib/insforge.js'
import { initAdminLayout, showToast, playAlert, getRole, getUserEmail } from './admin-layout.js'

// Initialize admin layout (auth check, sidebar, clock, active nav)
initAdminLayout()

// ── State ──────────────────────────────────────────────────────────
let dashboardTables = []
let dashboardOrders = []
let activeAlerts = []
let realtimeSubscriptions = []

// ── Audio Alert Debounce ───────────────────────────────────────────
let lastAlertTime = 0
function triggerAlertSound() {
  const now = Date.now()
  if (now - lastAlertTime > 2000) { // 2s debounce
    playAlert()
    lastAlertTime = now
  }
}

// ── Page Load Bootstrapping ────────────────────────────────────────
async function initDashboard() {
  // Update user info in topbar
  const email = getUserEmail()
  const role = getRole()
  const avatarInitials = document.getElementById('user-avatar-initials')
  const roleDisplay = document.getElementById('user-role-display')
  const roleChip = document.getElementById('sidebar-role-chip')

  if (email && avatarInitials) {
    avatarInitials.textContent = email.charAt(0).toUpperCase()
  }
  if (role && roleDisplay) {
    roleDisplay.textContent = role.toUpperCase()
  }
  if (role && roleChip) {
    roleChip.textContent = `Logged in as: ${role.toUpperCase()}`
  }

  // Initial data fetch
  await fetchStats()
  await fetchRecentOrders()
  await fetchTables()
  await fetchAlerts()
  renderStatusBreakdown()

  // Setup realtime listeners
  setupRealtime()

  // Clear Alerts handler
  document.getElementById('clear-alerts-btn')?.addEventListener('click', () => {
    activeAlerts = []
    renderAlerts()
    showToast('Alerts display cleared locally', 'info')
  })
}

// ── Fetch & Render Stats ───────────────────────────────────────────
async function fetchStats() {
  try {
    // 1. Get Tables Status
    const tablesList = await tables.getAll()
    dashboardTables = tablesList
    
    const activeTablesCount = tablesList.filter(t => t.status !== 'available' && t.status !== 'closed').length
    const activeTablesEl = document.getElementById('stat-active-tables')
    if (activeTablesEl) activeTablesEl.textContent = activeTablesCount

    // 2. Get Open Orders (status is not completed or cancelled)
    const { data: openOrders, error: orderErr } = await db
      .from('orders')
      .select('id, grand_total, status, payment_status')
      .not('status', 'in', '("completed","cancelled")')
    
    if (orderErr) throw orderErr
    
    const openOrdersEl = document.getElementById('stat-open-orders')
    if (openOrdersEl) openOrdersEl.textContent = openOrders.length

    // 3. Get Pending Bills (payment_status != paid)
    const pendingBillsCount = openOrders.filter(o => o.payment_status === 'unpaid').length
    const pendingBillsEl = document.getElementById('stat-pending-bills')
    if (pendingBillsEl) pendingBillsEl.textContent = pendingBillsCount

    // 4. Calculate today's revenue (payment_status = paid and created_at >= today)
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    
    const { data: todayOrders, error: revErr } = await db
      .from('orders')
      .select('grand_total')
      .eq('payment_status', 'paid')
      .gte('created_at', todayStart.toISOString())

    if (revErr) throw revErr

    const todayRevenue = todayOrders.reduce((sum, o) => sum + parseFloat(o.grand_total || 0), 0)
    const revenueEl = document.getElementById('stat-revenue')
    if (revenueEl) revenueEl.textContent = `₹${todayRevenue.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  } catch (err) {
    console.error('Error fetching dashboard stats', err)
    showToast('Error reloading stats', 'error')
  }
}

// ── Fetch & Render Recent Orders ───────────────────────────────────
async function fetchRecentOrders() {
  const tbody = document.getElementById('orders-tbody')
  if (!tbody) return

  try {
    const { data: recent, error } = await db
      .from('orders')
      .select('id, order_number, table_id, grand_total, status, created_at, tables(table_number, floor_areas(name))')
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) throw error
    dashboardOrders = recent

    if (!recent || recent.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted)">No orders found.</td></tr>`
      return
    }

    tbody.innerHTML = recent.map(o => {
      const orderTime = new Date(o.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      const statusClass = o.status === 'pending' ? 'orders-status-pending'
                        : o.status === 'accepted' ? 'orders-status-new'
                        : o.status === 'preparing' ? 'orders-status-prep'
                        : o.status === 'served' ? 'orders-status-served'
                        : 'orders-status-done'
      
      const tNum = o.tables?.table_number || '—'
      const areaName = o.tables?.floor_areas?.name || ''
      const tableLabel = `T${tNum} (${areaName})`

      return `
        <tr>
          <td><span style="font-weight:700;color:var(--gold)">${o.order_number}</span></td>
          <td>${tableLabel}</td>
          <td><span style="font-size:0.75rem">Order View</span></td>
          <td>₹${parseFloat(o.grand_total).toFixed(2)}</td>
          <td><span class="${statusClass}">${o.status.toUpperCase()}</span></td>
          <td>${orderTime}</td>
        </tr>
      `
    }).join('')

  } catch (err) {
    console.error('Error fetching recent orders', err)
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted)">Failed to load orders.</td></tr>`
  }
}

// ── Fetch & Render Tables Map ──────────────────────────────────────
async function fetchTables() {
  const mapGrid = document.getElementById('floor-map-grid')
  if (!mapGrid) return

  try {
    const tablesList = await tables.getAll()
    dashboardTables = tablesList

    mapGrid.innerHTML = tablesList.map(t => {
      const statusClass = t.status // available, occupied, ordering, preparing, served, billing_requested, closed
      return `
        <div class="floor-table-mini ${statusClass}" title="Table ${t.table_number} (${t.floor_areas?.name || 'Indoor'}) - Status: ${t.status}" data-number="${t.table_number}">
          <span class="table-num-mini">${t.table_number}</span>
          <span class="table-dot-mini"></span>
        </div>
      `
    }).join('')

    // Add click listeners to navigate to floor map tables detail
    mapGrid.querySelectorAll('.floor-table-mini').forEach(el => {
      el.addEventListener('click', () => {
        window.location.href = `./tables.html?table=${el.dataset.number}`
      })
    })

  } catch (err) {
    console.error('Error loading tables grid', err)
  }
}

// ── Fetch & Render Alerts Feed ─────────────────────────────────────
async function fetchAlerts() {
  try {
    // 1. Fetch Waiter Calls
    const { data: calls, error: callErr } = await db
      .from('waiter_calls')
      .select('id, table_id, status, created_at, tables(table_number, floor_areas(name))')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10)

    if (callErr) throw callErr

    // 2. Fetch Bill Requests
    const { data: bills, error: billErr } = await db
      .from('bill_requests')
      .select('id, table_id, status, created_at, tables(table_number, floor_areas(name))')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10)

    if (billErr) throw billErr

    // Combine and format
    const alertsCombined = []
    
    if (calls) {
      calls.forEach(c => {
        alertsCombined.push({
          id: c.id,
          type: 'waiter',
          message: `Table ${c.tables?.table_number || ''} (${c.tables?.floor_areas?.name || ''}) requested a waiter!`,
          time: new Date(c.created_at)
        })
      })
    }

    if (bills) {
      bills.forEach(b => {
        alertsCombined.push({
          id: b.id,
          type: 'bill',
          message: `Table ${b.tables?.table_number || ''} (${b.tables?.floor_areas?.name || ''}) requested their BILL!`,
          time: new Date(b.created_at)
        })
      })
    }

    // Sort by newest first
    alertsCombined.sort((a, b) => b.time - a.time)
    activeAlerts = alertsCombined

    renderAlerts()

  } catch (err) {
    console.error('Error loading alerts', err)
  }
}

function renderAlerts() {
  const feed = document.getElementById('alerts-feed')
  const empty = document.getElementById('alerts-empty')
  const badge = document.getElementById('notif-badge')
  if (!feed) return

  // Update badge count
  if (badge) {
    if (activeAlerts.length > 0) {
      badge.textContent = activeAlerts.length
      badge.classList.remove('hidden')
    } else {
      badge.classList.add('hidden')
    }
  }

  if (activeAlerts.length === 0) {
    feed.innerHTML = ''
    empty?.classList.remove('hidden')
    return
  }

  empty?.classList.add('hidden')

  feed.innerHTML = activeAlerts.map(a => {
    const timeStr = a.time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    const icon = a.type === 'waiter' ? '🔔' : a.type === 'bill' ? '🧾' : '📢'
    const itemClass = a.type

    return `
      <div class="alert-item ${itemClass}">
        <div class="alert-icon">${icon}</div>
        <div class="alert-body">
          <div class="alert-title">${a.message}</div>
          <div class="alert-time">${timeStr}</div>
        </div>
      </div>
    `
  }).join('')
}

function renderStatusBreakdown() {
  const container = document.getElementById('status-breakdown')
  if (!container) return

  // Count order status types
  const counts = { pending: 0, accepted: 0, preparing: 0, ready: 0, served: 0 }
  dashboardOrders.forEach(o => {
    if (counts[o.status] !== undefined) counts[o.status]++
  })

  const total = Object.values(counts).reduce((s, c) => s + c, 0) || 1

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:0.75rem;">
      ${Object.entries(counts).map(([status, count]) => {
        const pct = Math.round((count / total) * 100)
        const color = status === 'pending' ? 'var(--status-ordering)'
                    : status === 'accepted' ? 'var(--status-available)'
                    : status === 'preparing' ? 'var(--status-preparing)'
                    : status === 'ready' ? '#10b981'
                    : 'var(--status-served)'
        
        return `
          <div>
            <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:0.25rem;">
              <span style="text-transform:capitalize;font-weight:600;">${status}</span>
              <span style="color:var(--text-secondary)">${count} (${pct}%)</span>
            </div>
            <div style="width:100%;height:6px;background:var(--dark-4);border-radius:3px;overflow:hidden;">
              <div style="width:${pct}%;height:100%;background:${color};border-radius:3px;"></div>
            </div>
          </div>
        `
      }).join('')}
    </div>
  `
}

// ── Realtime Setup ──────────────────────────────────────────────────
function setupRealtime() {
  // Clear any existing subscriptions
  realtimeSubscriptions.forEach(sub => realtime.remove(sub))
  realtimeSubscriptions = []

  // 1. Subscribe to orders table updates
  const orderSub = realtime.onOrders((payload) => {
    fetchStats()
    fetchRecentOrders().then(() => renderStatusBreakdown())
    
    // Play alert sound if new order inserted
    if (payload.eventType === 'INSERT') {
      showToast('New customer order placed!', 'success')
      triggerAlertSound()
    }
  })
  realtimeSubscriptions.push(orderSub)

  // 2. Subscribe to table status updates
  const tableSub = realtime.onTables(() => {
    fetchStats()
    fetchTables()
  })
  realtimeSubscriptions.push(tableSub)

  // 3. Subscribe to waiter calls (insert)
  const waiterSub = realtime.onWaiterCalls((payload) => {
    fetchAlerts()
    showToast(`Table call: Waiter requested!`, 'info')
    triggerAlertSound()
  })
  realtimeSubscriptions.push(waiterSub)

  // 4. Subscribe to bill requests (insert)
  const billSub = realtime.onBillRequests((payload) => {
    fetchAlerts()
    showToast(`Table call: Bill requested!`, 'error')
    triggerAlertSound()
  })
  realtimeSubscriptions.push(billSub)
}

// ── Unload ─────────────────────────────────────────────────────────
window.addEventListener('beforeunload', () => {
  realtimeSubscriptions.forEach(sub => realtime.remove(sub))
})

// Boot
initDashboard()
