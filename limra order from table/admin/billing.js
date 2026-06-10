// ================================================================
// LIMRA RMS — Billing Page
// ================================================================
import { createClient } from '@insforge/sdk'
import { initAdminLayout, showToast, playAlert } from './admin-layout.js'

const db = createClient(import.meta.env.VITE_INSFORGE_URL, import.meta.env.VITE_INSFORGE_KEY)

// ── Auth guard & init ──────────────────────────────────────────────
initAdminLayout()

// ── State ─────────────────────────────────────────────────────────
let orders        = []
let gstRate       = 0.05   // 5% default, loaded from settings
let realtimeSub   = null

// ── Fetch GST rate from settings ──────────────────────────────────
async function loadGstRate() {
  try {
    const { data } = await db.from('restaurant_settings').select('gst_rate').single()
    if (data?.gst_rate != null) gstRate = parseFloat(data.gst_rate) / 100
  } catch (_) {
    // Use default 5%
  }
}

// ── Load all pending/served orders ────────────────────────────────
async function loadOrders() {
  const list = document.getElementById('billing-list')
  list.innerHTML = `<div class="loading-state"><div class="spinner spinner-lg" style="margin:0 auto 1rem;"></div><p>Loading pending bills…</p></div>`

  try {
    const { data, error } = await db
      .from('orders')
      .select(`
        id, order_number, table_id, status, payment_status, bill_requested, created_at,
        tables ( table_number, area ),
        order_items (
          id, quantity, unit_price, notes,
          menu_items ( name )
        )
      `)
      .in('payment_status', ['unpaid', 'pending'])
      .in('status', ['served', 'preparing', 'ordering', 'completed'])
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })

    if (error) throw error
    orders = (data || []).filter(o => o.payment_status !== 'paid')
    renderOrders()
    updateStats()
  } catch (err) {
    console.error('loadOrders:', err)
    list.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><h3>Failed to load orders</h3><p>${err.message}</p></div>`
    showToast('Failed to load billing data: ' + err.message, 'error')
  }
}

// ── Calculate order totals ─────────────────────────────────────────
function calcOrder(order) {
  const items    = order.order_items || []
  const subtotal = items.reduce((s, i) => s + (parseFloat(i.unit_price) * i.quantity), 0)
  const gst      = subtotal * gstRate
  const grand    = subtotal + gst
  return { subtotal, gst, grand, itemCount: items.length }
}

// ── Render order cards ─────────────────────────────────────────────
function renderOrders() {
  const list = document.getElementById('billing-list')

  if (!orders.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="icon">✅</div>
        <h3>All Clear!</h3>
        <p>No pending bills at the moment. All orders are settled.</p>
      </div>`
    return
  }

  list.innerHTML = orders.map(order => {
    const { subtotal, gst, grand, itemCount } = calcOrder(order)
    const tbl   = order.tables
    const items = order.order_items || []
    const billReq = order.bill_requested

    const methodsHTML = ['Cash','UPI','PhonePe','Google Pay','Paytm','Razorpay','Card'].map(m => `
      <label class="pay-method-label" id="method-label-${order.id}-${m.replace(/\s/g,'_')}">
        <input type="radio" name="pay_method_${order.id}" value="${m}" onchange="selectPayMethod('${order.id}','${m}')" ${m === 'Cash' ? 'checked' : ''} />
        ${m}
      </label>`).join('')

    const itemsHTML = items.slice(0, 4).map(i => `
      <div class="billing-item-row">
        <span class="billing-item-name">${i.menu_items?.name || 'Item'}</span>
        <span class="billing-item-qty">×${i.quantity}</span>
        <span class="billing-item-price">₹${(parseFloat(i.unit_price) * i.quantity).toFixed(2)}</span>
      </div>`).join('')

    const moreItems = items.length > 4 ? `<div class="billing-item-row" style="color:var(--text-muted);font-style:italic;">+${items.length - 4} more items…</div>` : ''

    return `
    <div class="billing-card ${billReq ? 'bill-requested' : ''}" id="bill-card-${order.id}">
      <div class="billing-card-header">
        <div class="billing-meta">
          <span class="billing-order-num">#${order.order_number || order.id.slice(-6).toUpperCase()}</span>
          <span class="billing-table-tag">🪑 Table ${tbl?.table_number || '?'}</span>
          ${tbl?.area ? `<span class="billing-table-tag">📍 ${tbl.area}</span>` : ''}
          <span class="badge badge-gray">${itemCount} items</span>
          ${billReq ? '<span class="bill-requested-badge">🔔 Bill Requested</span>' : ''}
        </div>
        <div style="display:flex;gap:0.5rem;">
          <button class="btn btn-outline btn-sm" onclick="openInvoice('${order.id}')">🧾 Invoice</button>
        </div>
      </div>
      <div class="billing-card-body">
        <div class="billing-items-list">${itemsHTML}${moreItems}</div>
        <div class="billing-amounts">
          <div class="amount-box">
            <div class="label">Subtotal</div>
            <div class="value">₹${subtotal.toFixed(2)}</div>
          </div>
          <div class="amount-box">
            <div class="label">GST (${(gstRate*100).toFixed(0)}%)</div>
            <div class="value">₹${gst.toFixed(2)}</div>
          </div>
          <div class="amount-box grand">
            <div class="label">Grand Total</div>
            <div class="value">₹${grand.toFixed(2)}</div>
          </div>
        </div>
        <div style="margin-bottom:0.75rem;">
          <div class="form-label">Payment Method</div>
          <div class="payment-methods">${methodsHTML}</div>
        </div>
        <div class="billing-actions">
          <button class="btn btn-gold" onclick="processPayment('${order.id}')">
            💳 Collect Payment — ₹${grand.toFixed(2)}
          </button>
          <button class="btn btn-outline btn-sm" onclick="openInvoice('${order.id}')">🧾 Invoice</button>
        </div>
      </div>
    </div>`
  }).join('')

  // Pre-select Cash method visually
  orders.forEach(o => selectPayMethod(o.id, 'Cash'))
}

// ── Select payment method visual ──────────────────────────────────
window.selectPayMethod = function(orderId, method) {
  ['Cash','UPI','PhonePe','Google Pay','Paytm','Razorpay','Card'].forEach(m => {
    const label = document.getElementById(`method-label-${orderId}-${m.replace(/\s/g,'_')}`)
    if (label) label.classList.toggle('selected', m === method)
  })
}

// ── Process payment ────────────────────────────────────────────────
window.processPayment = async function(orderId) {
  const order = orders.find(o => o.id === orderId)
  if (!order) return

  const { subtotal, gst, grand } = calcOrder(order)
  const radios = document.querySelectorAll(`input[name="pay_method_${orderId}"]`)
  let method = 'Cash'
  radios.forEach(r => { if (r.checked) method = r.value })

  const btn = document.querySelector(`#bill-card-${orderId} .btn-gold`)
  if (btn) { btn.disabled = true; btn.textContent = 'Processing…' }

  try {
    // 1. Insert payment record
    const { error: payErr } = await db.from('payments').insert([{
      order_id:       orderId,
      amount:         grand,
      subtotal:       subtotal,
      gst_amount:     gst,
      gst_rate:       gstRate,
      payment_method: method.toLowerCase().replace(/\s/g, '_'),
      status:         'completed',
      paid_at:        new Date().toISOString(),
    }])
    if (payErr) throw payErr

    // 2. Update order status
    const { error: orderErr } = await db
      .from('orders')
      .update({ payment_status: 'paid', status: 'completed' })
      .eq('id', orderId)
    if (orderErr) throw orderErr

    // 3. Update table status to available
    if (order.table_id) {
      await db.from('tables').update({ status: 'available' }).eq('id', order.table_id)
    }

    showToast(`✅ Payment of ₹${grand.toFixed(2)} collected via ${method}`, 'success')
    playAlert('bill')

    // Remove card with animation
    const card = document.getElementById(`bill-card-${orderId}`)
    if (card) {
      card.style.transition = 'opacity 0.4s ease, transform 0.4s ease'
      card.style.opacity = '0'
      card.style.transform = 'scale(0.95)'
      setTimeout(() => {
        orders = orders.filter(o => o.id !== orderId)
        renderOrders()
        updateStats()
      }, 400)
    }
  } catch (err) {
    console.error('processPayment:', err)
    showToast('Payment failed: ' + err.message, 'error')
    if (btn) { btn.disabled = false; btn.textContent = `💳 Collect Payment` }
  }
}

// ── Update stats ───────────────────────────────────────────────────
async function updateStats() {
  document.getElementById('stat-pending').textContent = orders.length
  document.getElementById('stat-bill-req').textContent = orders.filter(o => o.bill_requested).length

  // Today's collection
  try {
    const today = new Date()
    today.setHours(0,0,0,0)
    const { data } = await db
      .from('payments')
      .select('amount')
      .gte('paid_at', today.toISOString())
      .eq('status', 'completed')

    const total = (data || []).reduce((s, p) => s + parseFloat(p.amount), 0)
    const gstTotal = total - (total / (1 + gstRate))
    document.getElementById('stat-today').textContent = '₹' + total.toFixed(0)
    document.getElementById('stat-gst').textContent   = '₹' + gstTotal.toFixed(0)
  } catch (_) {}
}

// ── Generate invoice HTML ──────────────────────────────────────────
function generateInvoiceHTML(order) {
  const { subtotal, gst, grand } = calcOrder(order)
  const tbl = order.tables
  const items = order.order_items || []
  const now = new Date().toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', hour12:true })
  const orderNum = order.order_number || order.id.slice(-6).toUpperCase()

  const itemRows = items.map(i => `
    <tr>
      <td style="padding:0.3rem 0;border-bottom:1px solid #eee;">${i.menu_items?.name || 'Item'}</td>
      <td style="padding:0.3rem 0;border-bottom:1px solid #eee;text-align:center;">${i.quantity}</td>
      <td style="padding:0.3rem 0;border-bottom:1px solid #eee;text-align:right;">₹${parseFloat(i.unit_price).toFixed(2)}</td>
      <td style="padding:0.3rem 0;border-bottom:1px solid #eee;text-align:right;">₹${(parseFloat(i.unit_price)*i.quantity).toFixed(2)}</td>
    </tr>`).join('')

  return `
    <div style="text-align:center;margin-bottom:1rem;">
      <div style="font-family:Georgia,serif;font-size:1.8rem;font-weight:800;letter-spacing:0.1em;color:#c8860a;">LIMRA</div>
      <div style="font-size:0.75rem;color:#888;margin-top:0.2rem;">Multi-Cuisine Restaurant</div>
      <div style="font-size:0.7rem;color:#999;">📞 +91 98765 43210 &nbsp;|&nbsp; ✉️ info@limraresturent.in</div>
    </div>
    <hr style="border:none;border-top:2px dashed #ddd;margin:0.75rem 0;"/>
    <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:0.5rem;">
      <div><strong>Invoice #:</strong> ${orderNum}</div>
      <div><strong>Date:</strong> ${now}</div>
    </div>
    <div style="font-size:0.8rem;margin-bottom:0.75rem;">
      <strong>Table:</strong> ${tbl?.table_number || '?'}
      ${tbl?.area ? ` &nbsp;|&nbsp; <strong>Area:</strong> ${tbl.area}` : ''}
    </div>
    <hr style="border:none;border-top:1px dashed #ddd;margin:0.75rem 0;"/>
    <table style="width:100%;font-size:0.8rem;border-collapse:collapse;">
      <thead>
        <tr style="color:#888;border-bottom:2px solid #ddd;">
          <th style="text-align:left;padding:0.3rem 0;">Item</th>
          <th style="text-align:center;padding:0.3rem 0;">Qty</th>
          <th style="text-align:right;padding:0.3rem 0;">Rate</th>
          <th style="text-align:right;padding:0.3rem 0;">Amount</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
    <hr style="border:none;border-top:1px dashed #ddd;margin:0.75rem 0;"/>
    <div style="font-size:0.85rem;">
      <div style="display:flex;justify-content:space-between;margin:0.25rem 0;"><span>Subtotal</span><span>₹${subtotal.toFixed(2)}</span></div>
      <div style="display:flex;justify-content:space-between;margin:0.25rem 0;color:#888;"><span>GST (${(gstRate*100).toFixed(0)}%)</span><span>₹${gst.toFixed(2)}</span></div>
      <hr style="border:none;border-top:2px solid #111;margin:0.5rem 0;"/>
      <div style="display:flex;justify-content:space-between;font-weight:800;font-size:1rem;"><span>GRAND TOTAL</span><span>₹${grand.toFixed(2)}</span></div>
    </div>
    <hr style="border:none;border-top:1px dashed #ddd;margin:0.75rem 0;"/>
    <div style="text-align:center;font-size:0.7rem;color:#999;">
      Thank you for dining at LIMRA!<br/>Visit again 🍽️
    </div>`
}

// ── Open invoice modal ─────────────────────────────────────────────
window.openInvoice = function(orderId) {
  const order = orders.find(o => o.id === orderId)
  if (!order) return

  const area = document.getElementById('invoice-print-area')
  area.innerHTML = generateInvoiceHTML(order)

  const { grand } = calcOrder(order)
  const orderNum = order.order_number || order.id.slice(-6).toUpperCase()

  // WhatsApp share
  document.getElementById('whatsapp-btn').onclick = () => {
    const txt = `🍽️ LIMRA Restaurant\nTable: ${order.tables?.table_number}\nOrder #${orderNum}\nTotal: ₹${grand.toFixed(2)}\nThank you for dining with us!`
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, '_blank')
  }

  document.getElementById('invoice-modal').classList.remove('hidden')
}

// ── Realtime: bill_requests ────────────────────────────────────────
function subscribeRealtime() {
  realtimeSub = db
    .channel('billing-realtime')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: 'bill_requested=eq.true' }, payload => {
      playAlert('bill')
      const alert = document.getElementById('bill-request-alert')
      if (alert) {
        alert.classList.remove('hidden')
        setTimeout(() => alert.classList.add('hidden'), 8000)
      }
      showToast('🔔 Bill requested at Table!', 'warning')
      loadOrders()
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => loadOrders())
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => loadOrders())
    .subscribe()
}

// ── Logout ─────────────────────────────────────────────────────────
document.getElementById('logout-btn').addEventListener('click', () => {
  sessionStorage.clear()
  window.location.href = '/admin/index.html'
})

// ── Init ───────────────────────────────────────────────────────────
;(async () => {
  await loadGstRate()
  await loadOrders()
  subscribeRealtime()
})()
