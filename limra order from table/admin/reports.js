// ================================================================
// LIMRA RMS — Reports Page
// ================================================================
import { createClient } from '@insforge/sdk'

const db = createClient(
  import.meta.env.VITE_INSFORGE_URL,
  import.meta.env.VITE_INSFORGE_KEY
)

// ── Set default date to today ──────────────────────────────────
const dateInput = document.getElementById('report-date')
dateInput.value = new Date().toISOString().split('T')[0]

// ── Load reports ───────────────────────────────────────────────
async function loadReport() {
  const date = dateInput.value
  const start = date + 'T00:00:00.000Z'
  const end   = date + 'T23:59:59.999Z'

  try {
    // Day's paid orders
    const { data: dayOrders } = await db
      .from('orders')
      .select('grand_total, subtotal, tax, area_id, table_id, created_at')
      .eq('payment_status', 'paid')
      .gte('created_at', start)
      .lte('created_at', end)

    const revenue  = dayOrders.reduce((s, o) => s + parseFloat(o.grand_total), 0)
    const indoor   = dayOrders.filter(o => o.area_id === 1).reduce((s, o) => s + parseFloat(o.grand_total), 0)
    const outdoor  = dayOrders.filter(o => o.area_id === 2).reduce((s, o) => s + parseFloat(o.grand_total), 0)

    document.getElementById('rep-revenue').textContent = '₹' + revenue.toFixed(0)
    document.getElementById('rep-orders').textContent  = dayOrders.length
    document.getElementById('rep-indoor').textContent  = '₹' + indoor.toFixed(0)
    document.getElementById('rep-outdoor').textContent = '₹' + outdoor.toFixed(0)

    // Top selling items (all time)
    await loadTopItems()

    // 7-day revenue chart
    await load7DayChart()

    // Table performance
    await loadTablePerf()

    // Ratings
    await loadRatings()

  } catch (err) {
    console.error('Report error:', err)
  }
}

// ── Top items ──────────────────────────────────────────────────
async function loadTopItems() {
  const { data } = await db
    .from('order_items')
    .select('quantity, menu_items(name)')
    .order('quantity', { ascending: false })
    .limit(200)

  const grouped = {}
  if (data) {
    data.forEach(row => {
      const name = row.menu_items?.name || 'Unknown'
      grouped[name] = (grouped[name] || 0) + row.quantity
    })
  }

  const sorted = Object.entries(grouped).sort((a,b) => b[1]-a[1]).slice(0, 8)
  const max = sorted[0]?.[1] || 1
  const el = document.getElementById('top-items-list')
  el.innerHTML = sorted.length ? sorted.map(([name, qty], i) => `
    <div style="display:flex; align-items:center; gap:0.75rem;">
      <span style="font-size:0.7rem; color:var(--text-muted); width:1.25rem; text-align:right;">${i+1}</span>
      <div style="flex:1;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.2rem;">
          <span style="font-size:0.8rem; color:var(--text-primary); font-weight:500;">${name}</span>
          <span style="font-size:0.75rem; color:var(--gold); font-weight:700;">${qty} sold</span>
        </div>
        <div style="height:4px; background:var(--dark-4); border-radius:9999px; overflow:hidden;">
          <div style="height:100%; width:${(qty/max*100).toFixed(0)}%; background:linear-gradient(90deg,var(--gold),var(--gold-dark)); border-radius:9999px; transition:width 0.5s ease;"></div>
        </div>
      </div>
    </div>
  `).join('') : '<p style="color:var(--text-muted); font-size:0.85rem; text-align:center;">No data</p>'
}

// ── 7-day chart ────────────────────────────────────────────────
async function load7DayChart() {
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().split('T')[0])
  }

  const { data: allOrders } = await db
    .from('orders')
    .select('grand_total, created_at')
    .eq('payment_status', 'paid')
    .gte('created_at', days[0] + 'T00:00:00Z')

  const byDay = {}
  days.forEach(d => byDay[d] = 0)
  if (allOrders) {
    allOrders.forEach(o => {
      const d = o.created_at.split('T')[0]
      if (byDay[d] !== undefined) byDay[d] += parseFloat(o.grand_total)
    })
  }

  const values = days.map(d => byDay[d])
  const maxVal = Math.max(...values, 1)
  const chart = document.getElementById('revenue-chart')
  const labels = document.getElementById('revenue-chart-labels')

  chart.innerHTML = values.map((v, i) => `
    <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:0.25rem; height:100%; justify-content:flex-end;">
      <span style="font-size:0.6rem; color:var(--gold);">${v > 0 ? '₹'+Math.round(v) : ''}</span>
      <div style="width:100%; border-radius:4px 4px 0 0; background:linear-gradient(180deg,var(--gold),var(--gold-dark)); height:${Math.max(4,(v/maxVal*100)).toFixed(0)}%; transition:height 0.5s ease; min-height:4px;"></div>
    </div>
  `).join('')

  labels.innerHTML = days.map(d => `<div style="flex:1; text-align:center;">${d.slice(5)}</div>`).join('')
}

// ── Table performance ──────────────────────────────────────────
async function loadTablePerf() {
  const { data } = await db
    .from('orders')
    .select('grand_total, table_id, restaurant_tables(table_number, floor_areas(name))')
    .eq('payment_status', 'paid')
    .limit(500)

  const grouped = {}
  if (data) {
    data.forEach(o => {
      const tNum = o.restaurant_tables?.table_number
      const area = o.restaurant_tables?.floor_areas?.name || ''
      if (!tNum) return
      const key = tNum
      if (!grouped[key]) grouped[key] = { num: tNum, area, total: 0, count: 0 }
      grouped[key].total += parseFloat(o.grand_total)
      grouped[key].count++
    })
  }

  const sorted = Object.values(grouped).sort((a,b) => b.total - a.total)
  const el = document.getElementById('table-perf-list')
  el.innerHTML = sorted.length ? sorted.map(t => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem 0; border-bottom:1px solid var(--border);">
      <div>
        <span style="font-size:0.85rem; color:var(--text-primary); font-weight:600;">Table ${t.num}</span>
        <span style="font-size:0.7rem; color:var(--text-muted); margin-left:0.5rem;">${t.area}</span>
      </div>
      <div style="text-align:right;">
        <p style="font-size:0.85rem; color:var(--gold); font-weight:700;">₹${Math.round(t.total)}</p>
        <p style="font-size:0.7rem; color:var(--text-muted);">${t.count} orders</p>
      </div>
    </div>
  `).join('') : '<p style="color:var(--text-muted); font-size:0.85rem; text-align:center;">No data</p>'
}

// ── Ratings ────────────────────────────────────────────────────
async function loadRatings() {
  const { data } = await db
    .from('customer_feedback')
    .select('rating, feedback, created_at')
    .order('created_at', { ascending: false })
    .limit(20)

  const el = document.getElementById('ratings-list')
  if (!data?.length) { el.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem; text-align:center;">No ratings yet</p>'; return; }

  el.innerHTML = data.map(r => `
    <div style="padding:0.75rem; background:var(--dark-3); border-radius:var(--r-md); border:1px solid var(--border);">
      <div style="display:flex; justify-content:space-between; margin-bottom:0.35rem;">
        <div>${'⭐'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div>
        <span style="font-size:0.7rem; color:var(--text-muted);">${new Date(r.created_at).toLocaleDateString('en-IN')}</span>
      </div>
      ${r.feedback ? `<p style="font-size:0.8rem; color:var(--text-secondary); font-style:italic;">"${r.feedback}"</p>` : ''}
    </div>
  `).join('')
}

// ── Auth guard ─────────────────────────────────────────────────
async function init() {
  const { data: { user } } = await db.auth.getUser()
  if (!user) { location.href = './index.html'; return; }

  document.getElementById('load-report-btn').addEventListener('click', loadReport)
  loadReport()

  // Sidebar
  if (window.initAdminLayout) window.initAdminLayout('reports')
}

init()
