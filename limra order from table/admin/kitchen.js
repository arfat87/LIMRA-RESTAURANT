// ================================================================
// LIMRA RMS — Kitchen Display System
// admin/kitchen.js
// ================================================================

import { createClient } from '@insforge/sdk'
import { initAdminLayout, showToast, playAlert } from './admin-layout.js'

// ── InsForge client ────────────────────────────────────────────────
const db = createClient(
  import.meta.env.VITE_INSFORGE_URL,
  import.meta.env.VITE_INSFORGE_KEY
)

// ── State ──────────────────────────────────────────────────────────
let orders = []        // active orders array
let audioEnabled = true
let activeFilter = 'all'
let realtimeSub = null
let timerInterval = null

// ── Web Audio API beep ─────────────────────────────────────────────
let audioCtx = null

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  return audioCtx
}

/**
 * Play a beep using Web Audio API.
 * @param {number} freq   Hz (default 880)
 * @param {number} dur    seconds (default 0.3)
 * @param {string} type   oscillator type (default 'triangle')
 */
function beep(freq = 880, dur = 0.3, type = 'triangle') {
  if (!audioEnabled) return
  try {
    const ctx  = getAudioCtx()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = type
    osc.frequency.setValueAtTime(freq, ctx.currentTime)
    gain.gain.setValueAtTime(0.35, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + dur + 0.05)
  } catch (e) {
    console.warn('beep:', e.message)
  }
}

function playNewOrderSound() {
  beep(880, 0.12, 'triangle')
  setTimeout(() => beep(1100, 0.12, 'triangle'), 150)
  setTimeout(() => beep(1320, 0.18, 'triangle'), 300)
}

function playReadySound() {
  beep(660, 0.1, 'sine')
  setTimeout(() => beep(880, 0.1, 'sine'), 120)
  setTimeout(() => beep(1100, 0.2, 'sine'), 240)
}

// ── Time helpers ───────────────────────────────────────────────────
function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  const m = Math.floor(diff / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m ago`
}

function minutesElapsed(dateStr) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
}

// ── Status helpers ─────────────────────────────────────────────────
const STATUS_CHIP = {
  pending:   { label: 'Pending',   color: '#c8860a', bg: 'rgba(200,134,10,0.15)'   },
  accepted:  { label: 'Accepted',  color: '#eab308', bg: 'rgba(234,179,8,0.15)'    },
  preparing: { label: 'Preparing', color: '#f97316', bg: 'rgba(249,115,22,0.15)'   },
  ready:     { label: 'Ready ✓',  color: '#22c55e', bg: 'rgba(34,197,94,0.15)'     },
  served:    { label: 'Served',    color: '#3b82f6', bg: 'rgba(59,130,246,0.15)'   },
}

function statusChipHTML(status) {
  const s = STATUS_CHIP[status] || STATUS_CHIP.pending
  return `<span class="kitchen-status-chip" style="background:${s.bg};color:${s.color};border:1px solid ${s.color}40;">${s.label}</span>`
}

function cardClass(status, createdAt) {
  const urgent = minutesElapsed(createdAt) > 15
  let cls = `kitchen-card status-${status}`
  if (urgent && status !== 'served') cls += ' status-urgent'
  return cls
}

// ── Render a single order card ─────────────────────────────────────
function renderCard(order) {
  const items = order.order_items || []
  const isUrgent = minutesElapsed(order.created_at) > 15
  const area = order.restaurant_tables?.floor_area || 'indoor'
  const areaLabel = area === 'outdoor' ? '🌿 Outdoor' : '🏠 Indoor'
  const areaClass = area === 'outdoor' ? 'area-outdoor' : 'area-indoor'
  const specialNote = order.special_instructions || ''

  const itemsHTML = items.map(item => {
    const note = item.special_note || item.notes || ''
    return `
      <div class="kitchen-item">
        <div class="kitchen-item-info">
          <div class="kitchen-item-name">${escHtml(item.menu_items?.name || item.item_name || 'Item')}</div>
          ${note ? `<div class="kitchen-item-note">⚠️ ${escHtml(note)}</div>` : ''}
        </div>
        <div class="kitchen-item-qty">×${item.quantity}</div>
      </div>
    `
  }).join('')

  const buttonsHTML = buildActionButtons(order.id, order.status)

  const timerClass = isUrgent ? 'kitchen-timer urgent' : 'kitchen-timer'
  const timerText = timeAgo(order.created_at)

  return `
    <div class="${cardClass(order.status, order.created_at)}"
         id="kitchen-card-${order.id}"
         data-order-id="${order.id}"
         data-created-at="${order.created_at}"
         data-status="${order.status}">

      <div class="kitchen-card-header">
        <div class="kitchen-meta">
          <div class="kitchen-order-num">#${order.order_number || order.id.slice(-6).toUpperCase()}</div>
          <div class="kitchen-table-info">Table ${order.restaurant_tables?.table_number || order.table_number || '?'}</div>
          <div class="kitchen-area-badge ${areaClass}">${areaLabel}</div>
        </div>

        <div class="kitchen-header-right-meta">
          ${statusChipHTML(order.status)}
          <div class="${timerClass}" id="timer-${order.id}">${timerText}</div>
          ${isUrgent ? '<div style="font-size:0.65rem;color:#ef4444;font-weight:700;">⏰ URGENT</div>' : ''}
        </div>
      </div>

      <div class="kitchen-items">
        ${itemsHTML || '<div style="color:var(--text-muted);font-size:0.85rem;padding:0.5rem 0;">No items</div>'}
      </div>

      ${specialNote ? `
        <div class="kitchen-special-note">
          <span class="kitchen-special-label">Special Instructions</span>
          ${escHtml(specialNote)}
        </div>
      ` : ''}

      <div class="kitchen-actions">
        ${buttonsHTML}
      </div>
    </div>
  `
}

function buildActionButtons(orderId, currentStatus) {
  const actions = [
    { status: 'accepted',  label: '✅ Accept',     cls: 'btn-accept'    },
    { status: 'preparing', label: '🔥 Preparing',  cls: 'btn-preparing' },
    { status: 'ready',     label: '✓ Ready',       cls: 'btn-ready'     },
    { status: 'served',    label: '🍽️ Served',    cls: 'btn-served'    },
  ]

  return actions.map(a => {
    const isCurrent = a.status === currentStatus
    return `
      <button class="kitchen-btn ${a.cls}${isCurrent ? ' current-status' : ''}"
              ${isCurrent ? 'disabled' : ''}
              onclick="window.kitchenUpdateStatus('${orderId}', '${a.status}')">
        ${a.label}
      </button>
    `
  }).join('')
}

// ── Escape HTML ───────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Render grid ────────────────────────────────────────────────────
function renderGrid() {
  const grid    = document.getElementById('kitchen-grid')
  const empty   = document.getElementById('kitchen-empty')
  const loading = document.getElementById('kitchen-loading')

  loading.style.display = 'none'

  const filtered = activeFilter === 'all'
    ? orders
    : orders.filter(o => o.status === activeFilter)

  // Sort oldest first (most urgent first)
  const sorted = [...filtered].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  )

  updateBadges(orders.length)

  if (sorted.length === 0) {
    grid.style.display = 'none'
    empty.style.display = 'flex'
    return
  }

  grid.style.display = 'grid'
  empty.style.display = 'none'
  grid.innerHTML = sorted.map(renderCard).join('')
}

function updateBadges(count) {
  const badge   = document.getElementById('order-count-badge')
  const sidebar = document.getElementById('sidebar-order-count')
  if (badge)   badge.textContent = count
  if (sidebar) sidebar.textContent = count
}

// ── Update status ──────────────────────────────────────────────────
window.kitchenUpdateStatus = async function(orderId, newStatus) {
  const btn = document.querySelector(`[data-order-id="${orderId}"] .kitchen-btn.btn-${newStatus.replace('_','-')}`)
  if (btn) { btn.disabled = true; btn.textContent = '…' }

  try {
    const { error } = await db
      .from('orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', orderId)

    if (error) throw error

    // Local state update
    const idx = orders.findIndex(o => o.id === orderId)
    if (idx !== -1) orders[idx].status = newStatus

    if (newStatus === 'ready') playReadySound()
    if (newStatus === 'served') {
      // Remove from active orders
      orders = orders.filter(o => o.id !== orderId)
    }

    renderGrid()
    showToast(`Order updated to ${newStatus}`, 'success')
  } catch (err) {
    console.error('updateStatus:', err)
    showToast('Failed to update order status', 'error')
    if (btn) { btn.disabled = false }
    renderGrid()
  }
}

// ── Fetch initial orders ───────────────────────────────────────────
async function fetchOrders() {
  try {
    const { data, error } = await db
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        special_instructions,
        created_at,
        updated_at,
        table_id,
        restaurant_tables (
          id,
          table_number,
          floor_area
        ),
        order_items (
          id,
          quantity,
          special_note,
          notes,
          menu_items (
            id,
            name
          )
        )
      `)
      .in('status', ['pending', 'accepted', 'preparing', 'ready'])
      .order('created_at', { ascending: true })

    if (error) throw error

    orders = data || []
    renderGrid()
  } catch (err) {
    console.error('fetchOrders:', err)
    showToast('Failed to load kitchen orders', 'error')
    document.getElementById('kitchen-loading').style.display = 'none'
    document.getElementById('kitchen-empty').style.display = 'flex'
  }
}

// ── Realtime subscription ──────────────────────────────────────────
async function subscribeRealtime() {
  realtimeSub = db
    .channel('kitchen-orders')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders',
      },
      async (payload) => {
        const { eventType, new: newRow, old: oldRow } = payload

        if (eventType === 'INSERT') {
          // Only care about orders relevant to kitchen
          if (['pending', 'accepted', 'preparing', 'ready'].includes(newRow.status)) {
            // Fetch full order with joins
            try {
              const { data } = await db
                .from('orders')
                .select(`
                  id, order_number, status, special_instructions,
                  created_at, updated_at, table_id,
                  restaurant_tables ( id, table_number, floor_area ),
                  order_items (
                    id, quantity, special_note, notes,
                    menu_items ( id, name )
                  )
                `)
                .eq('id', newRow.id)
                .single()

              if (data) {
                orders.unshift(data)
                // Re-sort
                orders.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
                renderGrid()
                playNewOrderSound()
                showToast(`🆕 New order #${data.order_number || data.id.slice(-6).toUpperCase()} arrived!`, 'info', 6000)

                // Flash new card
                const card = document.getElementById(`kitchen-card-${data.id}`)
                if (card) {
                  card.style.transform = 'scale(1.02)'
                  setTimeout(() => { card.style.transform = '' }, 600)
                }
              }
            } catch (e) {
              console.warn('realtime insert fetch:', e)
            }
          }
        } else if (eventType === 'UPDATE') {
          const idx = orders.findIndex(o => o.id === newRow.id)
          if (newRow.status === 'served' || newRow.status === 'cancelled') {
            // Remove from active list
            orders = orders.filter(o => o.id !== newRow.id)
          } else if (idx !== -1) {
            orders[idx].status = newRow.status
          } else if (['pending', 'accepted', 'preparing', 'ready'].includes(newRow.status)) {
            // Newly became relevant — fetch full
            try {
              const { data } = await db
                .from('orders')
                .select(`
                  id, order_number, status, special_instructions,
                  created_at, updated_at, table_id,
                  restaurant_tables ( id, table_number, floor_area ),
                  order_items (
                    id, quantity, special_note, notes,
                    menu_items ( id, name )
                  )
                `)
                .eq('id', newRow.id)
                .single()
              if (data) orders.push(data)
            } catch (e) {}
          }
          renderGrid()
        } else if (eventType === 'DELETE') {
          orders = orders.filter(o => o.id !== oldRow.id)
          renderGrid()
        }
      }
    )
    .subscribe()
}

// ── Timer update every 30s ─────────────────────────────────────────
function startTimerUpdater() {
  timerInterval = setInterval(() => {
    orders.forEach(order => {
      const timerEl = document.getElementById(`timer-${order.id}`)
      const cardEl  = document.getElementById(`kitchen-card-${order.id}`)
      if (timerEl) timerEl.textContent = timeAgo(order.created_at)
      if (cardEl) {
        const isUrgent = minutesElapsed(order.created_at) > 15
        const timerCls = timerEl?.className || 'kitchen-timer'
        if (isUrgent && !timerCls.includes('urgent')) {
          timerEl.className = 'kitchen-timer urgent'
          cardEl.classList.add('status-urgent')
        }
      }
    })
  }, 30000)
}

// ── Audio toggle ───────────────────────────────────────────────────
function initAudioToggle() {
  const btn   = document.getElementById('audio-toggle-btn')
  const icon  = document.getElementById('audio-icon')
  const label = document.getElementById('audio-label')
  if (!btn) return

  btn.addEventListener('click', () => {
    audioEnabled = !audioEnabled
    if (audioEnabled) {
      btn.classList.add('audio-on')
      icon.textContent  = '🔔'
      label.textContent = 'Audio On'
      // Resume context if suspended
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume()
    } else {
      btn.classList.remove('audio-on')
      icon.textContent  = '🔕'
      label.textContent = 'Audio Off'
    }
  })

  // First user interaction unlocks AudioContext
  document.addEventListener('click', () => {
    if (!audioCtx) return
    if (audioCtx.state === 'suspended') audioCtx.resume()
  }, { once: true })
}

// ── Filter chips ───────────────────────────────────────────────────
function initFilters() {
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'))
      chip.classList.add('active')
      activeFilter = chip.dataset.filter || 'all'
      renderGrid()
    })
  })
}

// ── Init ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Auth guard + sidebar/clock
  initAdminLayout()

  initAudioToggle()
  initFilters()

  await fetchOrders()
  await subscribeRealtime()
  startTimerUpdater()
})
