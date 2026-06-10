// ================================================================
// LIMRA RMS — Orders Management Page Logic
// admin/orders.js
// ================================================================
import { db, orders, tables, realtime } from '../src/lib/insforge.js'
import { initAdminLayout, showToast, playAlert } from './admin-layout.js'

// Initialize Admin Layout UI
initAdminLayout()

// ── State ──────────────────────────────────────────────────────────
let allOrders = []
let activeOrder = null
let realtimeSub = null

// ── Bootstrapping ──────────────────────────────────────────────────
async function initOrdersPage() {
  await fetchOrders()
  setupEventListeners()
  setupRealtime()
}

// ── Fetch Orders ───────────────────────────────────────────────────
async function fetchOrders() {
  try {
    const { data, error } = await db
      .from('orders')
      .select('*, restaurant_tables(table_number, floor_areas(name)), order_items(*, menu_items(name))')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error
    allOrders = data
    renderOrdersTable()
  } catch (err) {
    console.error('Error fetching orders', err)
    showToast('Failed to load orders', 'error')
  }
}

// ── Render Table ───────────────────────────────────────────────────
function renderOrdersTable() {
  const tbody = document.getElementById('orders-list-tbody')
  const countLabel = document.getElementById('orders-count-label')
  if (!tbody) return

  // Apply filters
  const searchQuery = document.getElementById('order-search').value.toLowerCase().trim()
  const statusFilter = document.getElementById('filter-status').value
  const areaFilter = document.getElementById('filter-area').value

  let filtered = allOrders

  // 1. Search filter
  if (searchQuery) {
    filtered = filtered.filter(o => 
      o.order_number.toLowerCase().includes(searchQuery) ||
      (o.restaurant_tables?.table_number && String(o.restaurant_tables.table_number).includes(searchQuery))
    )
  }

  // 2. Status filter
  if (statusFilter !== 'all') {
    filtered = filtered.filter(o => o.status === statusFilter)
  }

  // 3. Area filter
  if (areaFilter !== 'all') {
    filtered = filtered.filter(o => String(o.restaurant_tables?.area_id) === areaFilter)
  }

  // Update label
  if (countLabel) {
    countLabel.textContent = `Showing ${filtered.length} of ${allOrders.length} orders`
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--text-muted)">No matching orders found.</td></tr>`
    return
  }

  tbody.innerHTML = filtered.map(o => {
    const tableNum = o.restaurant_tables?.table_number || '—'
    const areaName = o.restaurant_tables?.floor_areas?.name || '—'
    
    const amount = parseFloat(o.grand_total).toFixed(2)
    const timeStr = new Date(o.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    const dateStr = new Date(o.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    
    const statusClass = o.status === 'pending' ? 'orders-status-pending'
                      : o.status === 'accepted' ? 'orders-status-new'
                      : o.status === 'preparing' ? 'orders-status-prep'
                      : o.status === 'served' ? 'orders-status-served'
                      : 'orders-status-done'
                      
    const payStatusClass = o.payment_status === 'paid' ? 'status-badge-inline accepted' : 'status-badge-inline pending'

    return `
      <tr class="clickable-row" data-id="${o.id}" style="cursor:pointer;">
        <td><span style="font-weight:700;color:var(--gold)">${o.order_number}</span></td>
        <td>Table ${tableNum}</td>
        <td>${areaName}</td>
        <td>₹${amount}</td>
        <td><span class="${statusClass}" style="font-weight:600;">${o.status.toUpperCase()}</span></td>
        <td><span class="${payStatusClass}">${o.payment_status.toUpperCase()}</span></td>
        <td>${dateStr} ${timeStr}</td>
        <td style="text-align:right">
          <button class="btn btn-outline btn-sm view-details-btn" data-id="${o.id}">Details</button>
        </td>
      </tr>
    `
  }).join('')

  // Bind click event to rows and detail buttons
  tbody.querySelectorAll('tr').forEach(row => {
    row.addEventListener('click', (e) => {
      // Avoid dual triggering if details button clicked
      if (e.target.classList.contains('view-details-btn')) return
      
      const order = allOrders.find(o => o.id === row.dataset.id)
      if (order) openOrderDetails(order)
    })
  })

  tbody.querySelectorAll('.view-details-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const order = allOrders.find(o => o.id === btn.dataset.id)
      if (order) openOrderDetails(order)
    })
  })
}

// ── Open Order Details Modal ──────────────────────────────────────
function openOrderDetails(order) {
  activeOrder = order
  
  document.getElementById('details-modal-title').textContent = `Order ${order.order_number}`
  
  const tableNum = order.restaurant_tables?.table_number || '—'
  const areaName = order.restaurant_tables?.floor_areas?.name || ''
  document.getElementById('details-table-label').textContent = `Table ${tableNum} (${areaName})`
  
  const placedTime = new Date(order.created_at).toLocaleString('en-IN')
  document.getElementById('details-time-label').textContent = placedTime

  const payLabel = document.getElementById('details-pay-label')
  payLabel.textContent = order.payment_status.toUpperCase()
  payLabel.className = order.payment_status === 'paid' ? 'status-badge-inline accepted' : 'status-badge-inline pending'

  const statusLabel = document.getElementById('details-status-label')
  statusLabel.textContent = order.status.toUpperCase()
  statusLabel.className = `status-badge-inline ${order.status}`

  // Notes/Instructions
  const notesBox = document.getElementById('details-notes-box')
  if (order.notes) {
    notesBox.style.display = 'block'
    document.getElementById('details-notes-content').textContent = order.notes
  } else {
    notesBox.style.display = 'none'
  }

  // Items list
  const list = document.getElementById('details-items-list')
  const items = order.order_items || []
  list.innerHTML = items.map(item => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem 0; border-bottom:1px solid var(--border);">
      <div>
        <p style="font-size:0.875rem; color:var(--text-primary); font-weight:600;">${item.menu_items?.name || 'Item'}</p>
        ${item.special_instruction ? `<p style="font-size:0.75rem; color:var(--gold); font-style:italic;">📝 ${item.special_instruction}</p>` : ''}
      </div>
      <div style="text-align:right;">
        <span style="font-size:0.75rem; color:var(--text-muted); margin-right:0.5rem;">x${item.quantity}</span>
        <span style="font-size:0.875rem; font-weight:700; color:var(--text-primary);">₹${parseFloat(item.total_price).toFixed(2)}</span>
      </div>
    </div>
  `).join('')

  // Totals
  document.getElementById('details-subtotal').textContent = `₹${parseFloat(order.subtotal).toFixed(2)}`
  document.getElementById('details-tax').textContent = `₹${parseFloat(order.tax).toFixed(2)}`
  document.getElementById('details-total').textContent = `₹${parseFloat(order.grand_total).toFixed(2)}`

  // Highlight active status button in detail modal
  document.querySelectorAll('.modal-body .status-btn').forEach(btn => {
    btn.classList.remove('active')
    if (btn.dataset.status === order.status) {
      btn.classList.add('active')
    }
  })

  // Open modal
  document.getElementById('modal-order-details').classList.add('visible')
}

function closeOrderDetails() {
  document.getElementById('modal-order-details').classList.remove('visible')
}

// ── Update Order Status ────────────────────────────────────────────
async function handleStatusChange(status) {
  if (!activeOrder) return

  try {
    const oldStatus = activeOrder.status
    const updated = await orders.updateStatus(activeOrder.id, status)
    
    // If complete or cancelled, release the table status back to available
    if (status === 'completed' || status === 'cancelled') {
      await tables.updateStatus(activeOrder.table_id, 'available')
    }

    // Refresh state locally
    const idx = allOrders.findIndex(o => o.id === activeOrder.id)
    if (idx !== -1) {
      allOrders[idx].status = status
    }

    activeOrder = allOrders[idx]
    
    renderOrdersTable()
    openOrderDetails(activeOrder)
    showToast(`Order status updated to: ${status.toUpperCase()}`, 'success')
  } catch (err) {
    console.error('Error updating status', err)
    showToast('Failed to update status', 'error')
  }
}

// ── Realtime Setup ──────────────────────────────────────────────────
function setupRealtime() {
  if (realtimeSub) {
    realtime.remove(realtimeSub)
  }

  realtimeSub = realtime.onOrders((payload) => {
    // Reload full list to ensure associations are preserved
    fetchOrders()
    
    // Play sound alert on new inserts
    if (payload.eventType === 'INSERT') {
      playAlert()
      showToast('New order received!', 'success')
    }
  })
}

// ── Event Listeners ────────────────────────────────────────────────
function setupEventListeners() {
  // Filters
  document.getElementById('order-search')?.addEventListener('input', renderOrdersTable)
  document.getElementById('filter-status')?.addEventListener('change', renderOrdersTable)
  document.getElementById('filter-area')?.addEventListener('change', renderOrdersTable)

  // Modal close
  document.getElementById('details-modal-close')?.addEventListener('click', closeOrderDetails)
  document.getElementById('details-modal-close-btn')?.addEventListener('click', closeOrderDetails)

  // Billing redirect button
  document.getElementById('details-btn-billing')?.addEventListener('click', () => {
    if (activeOrder) {
      window.location.href = `./billing.html?order=${activeOrder.id}`
    }
  })

  // Status trigger buttons in details modal
  document.querySelectorAll('.modal-body .status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      handleStatusChange(btn.dataset.status)
    })
  })
}

// Clean up
window.addEventListener('beforeunload', () => {
  if (realtimeSub) realtime.remove(realtimeSub)
})

// Boot
initOrdersPage()
