// ================================================================
// LIMRA RMS — Order Status Tracker Page
// ================================================================
import { createClient } from '@insforge/sdk'

const db = createClient(
  import.meta.env.VITE_INSFORGE_URL,
  import.meta.env.VITE_INSFORGE_KEY
)

// ── Get order ID from URL ──────────────────────────────────────
const params = new URLSearchParams(location.search)
const orderId = params.get('id') || params.get('order')

// ── DOM refs ───────────────────────────────────────────────────
const loading      = document.getElementById('status-loading')
const errorEl      = document.getElementById('status-error')
const infoCard     = document.getElementById('order-info-card')
const trackerCard  = document.getElementById('status-tracker-card')
const itemsCard    = document.getElementById('order-items-card')
const orderNumEl   = document.getElementById('order-num-display')
const orderTableEl = document.getElementById('order-table-display')
const orderTimeEl  = document.getElementById('order-time-display')
const statusBadge  = document.getElementById('order-status-badge')
const statusMsg    = document.getElementById('status-msg')
const itemsList    = document.getElementById('order-items-list')
const osSubtotal   = document.getElementById('os-subtotal')
const osTax        = document.getElementById('os-tax')
const osTotal      = document.getElementById('os-total')

// ── Status config ──────────────────────────────────────────────
const STATUS_ORDER = ['pending','accepted','preparing','ready','served','completed']
const STATUS_MSG = {
  pending:   '⏳ Your order has been received! Our team will confirm shortly.',
  accepted:  '✅ Order confirmed! Our chefs are about to start preparing your food.',
  preparing: '🍳 Your food is being prepared fresh right now. Won\'t be long!',
  ready:     '🔔 Your food is ready! A waiter will bring it to you shortly.',
  served:    '🍽️ Your food has been served. Enjoy your meal!',
  completed: '✨ Thank you for dining with us! We hope you enjoyed your meal.'
}
const STATUS_BADGE_CLASS = {
  pending:   'badge-yellow',
  accepted:  'badge-gold',
  preparing: 'badge-orange',
  ready:     'badge-green',
  served:    'badge-blue',
  completed: 'badge-gray'
}

// ── Update status UI ───────────────────────────────────────────
function updateStatusUI(status) {
  const steps = document.querySelectorAll('.status-step')
  const currentIdx = STATUS_ORDER.indexOf(status)

  steps.forEach((step, i) => {
    const stepStatus = step.dataset.step
    const stepIdx = STATUS_ORDER.indexOf(stepStatus)
    step.classList.remove('done', 'active')
    if (stepIdx < currentIdx) step.classList.add('done')
    else if (stepIdx === currentIdx) step.classList.add('active')
  })

  // Update badge
  const badgeClass = STATUS_BADGE_CLASS[status] || 'badge-yellow'
  statusBadge.className = `badge ${badgeClass}`
  statusBadge.textContent = status.charAt(0).toUpperCase() + status.slice(1)

  // Update message
  statusMsg.textContent = STATUS_MSG[status] || ''
}

// ── Render order items ─────────────────────────────────────────
function renderItems(order) {
  const items = order.order_items || []
  itemsList.innerHTML = items.map(item => `
    <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; padding:0.625rem 0; border-bottom:1px solid var(--border);">
      <div style="flex:1;">
        <p style="font-size:0.9rem; color:var(--text-primary); font-weight:500;">${item.menu_items?.name || 'Item'}</p>
        ${item.special_instruction ? `<p style="font-size:0.7rem; color:var(--gold); margin-top:0.15rem; font-style:italic;">📝 ${item.special_instruction}</p>` : ''}
      </div>
      <div style="text-align:right; flex-shrink:0;">
        <p style="font-size:0.8rem; color:var(--text-muted);">x${item.quantity}</p>
        <p style="font-size:0.875rem; font-weight:700; color:var(--text-primary);">₹${item.total_price}</p>
      </div>
    </div>
  `).join('')

  osSubtotal.textContent = `₹${order.subtotal}`
  osTax.textContent = `₹${parseFloat(order.tax).toFixed(2)}`
  osTotal.textContent = `₹${order.grand_total}`
}

// ── Show order ─────────────────────────────────────────────────
function showOrder(order) {
  loading.classList.add('hidden')
  infoCard.classList.remove('hidden')
  trackerCard.classList.remove('hidden')
  itemsCard.classList.remove('hidden')

  orderNumEl.textContent = order.order_number
  const tableNum = order.restaurant_tables?.table_number || '—'
  const areaName = order.restaurant_tables?.floor_areas?.name || ''
  orderTableEl.textContent = `Table ${tableNum}${areaName ? ' — ' + areaName : ''}`

  const createdAt = new Date(order.created_at)
  orderTimeEl.textContent = createdAt.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })

  updateStatusUI(order.status)
  renderItems(order)
}

// ── Load order ─────────────────────────────────────────────────
async function loadOrder() {
  if (!orderId) {
    loading.classList.add('hidden')
    errorEl.classList.remove('hidden')
    return
  }

  try {
    const { data, error } = await db
      .from('orders')
      .select('*, restaurant_tables(table_number, floor_areas(name)), order_items(*, menu_items(name))')
      .eq('id', orderId)
      .single()

    if (error || !data) throw error || new Error('Not found')
    showOrder(data)
    subscribeToStatus(orderId)
  } catch (err) {
    console.error(err)
    loading.classList.add('hidden')
    errorEl.classList.remove('hidden')
  }
}

// ── Realtime subscription ──────────────────────────────────────
function subscribeToStatus(id) {
  db.realtime
    .channel(`order-status-${id}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'orders',
      filter: `id=eq.${id}`
    }, (payload) => {
      updateStatusUI(payload.new.status)
      // Show toast on status change
      const msg = STATUS_MSG[payload.new.status]
      if (msg) showToast(msg, 'info')
    })
    .subscribe()
}

// ── Toast ──────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container')
  const toast = document.createElement('div')
  toast.className = `toast toast-${type}`
  toast.innerHTML = `<span>${msg}</span>`
  container.appendChild(toast)
  setTimeout(() => toast.remove(), 5000)
}

// ── Init ───────────────────────────────────────────────────────
loadOrder()
