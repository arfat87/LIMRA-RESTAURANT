// ================================================================
// LIMRA RMS — Floor Map & Table Management Page JS
// admin/tables.js
// ================================================================
import { db, tables, orders, realtime } from '../src/lib/insforge.js'
import { initAdminLayout, showToast, playAlert } from './admin-layout.js'

// Initialize Admin Layout UI
initAdminLayout()

// ── State ──────────────────────────────────────────────────────────
let allTablesList = []
let selectedTable = null
let selectedTableOrder = null
let activeTab = 'indoor' // indoor or outdoor
let realtimeSub = null

// ── Graphical Coordinates ──────────────────────────────────────────
// Indoor layout
// Top Row: [4] [5]
// Middle:  [3] [6] [9]
// Lower:   [2] [7] [8]
// Bottom:  [1]
const INDOOR_COORDS = {
  4: { x: '35%', y: '18%' },
  5: { x: '65%', y: '18%' },
  3: { x: '20%', y: '43%' },
  6: { x: '50%', y: '43%' },
  9: { x: '80%', y: '43%' },
  2: { x: '20%', y: '68%' },
  7: { x: '50%', y: '68%' },
  8: { x: '80%', y: '68%' },
  1: { x: '50%', y: '88%' }
}

// Outdoor layout
// Top:         [12]
// Left Col:  [11][10][16]
// Right Col: [13][14][15]
// Bottom:    [17][18][19]
const OUTDOOR_COORDS = {
  12: { x: '50%', y: '15%' },
  11: { x: '20%', y: '38%' },
  10: { x: '20%', y: '58%' },
  16: { x: '20%', y: '78%' },
  13: { x: '80%', y: '38%' },
  14: { x: '80%', y: '58%' },
  15: { x: '80%', y: '78%' },
  17: { x: '22%', y: '92%' },
  18: { x: '50%', y: '92%' },
  19: { x: '78%', y: '92%' }
}

// ── Bootstrapping ──────────────────────────────────────────────────
async function initTablesPage() {
  await loadTables()
  renderMaps()
  setupEventListeners()
  setupRealtime()

  // Check if a table is pre-selected from URL (e.g. ?table=3)
  const params = new URLSearchParams(window.location.search)
  const tableNum = parseInt(params.get('table'), 10)
  if (!isNaN(tableNum)) {
    const tableObj = allTablesList.find(t => t.table_number === tableNum)
    if (tableObj) {
      // Switch tab if outdoor
      if (tableNum >= 10) {
        switchTab('outdoor')
      }
      selectTable(tableObj)
    }
  }
}

// ── Load Tables from Database ──────────────────────────────────────
async function loadTables() {
  try {
    const data = await tables.getAll()
    allTablesList = data
  } catch (err) {
    console.error('Error fetching tables', err)
    showToast('Failed to load tables', 'error')
  }
}

// ── Render Maps ────────────────────────────────────────────────────
function renderMaps() {
  const canvasIndoor = document.getElementById('canvas-indoor')
  const canvasOutdoor = document.getElementById('canvas-outdoor')
  
  if (!canvasIndoor || !canvasOutdoor) return

  // Filter out table DOM elements first (keeping door markers)
  canvasIndoor.querySelectorAll('.floor-table-node').forEach(el => el.remove())
  canvasOutdoor.querySelectorAll('.floor-table-node').forEach(el => el.remove())

  allTablesList.forEach(t => {
    const isIndoor = t.table_number <= 9
    const coords = isIndoor ? INDOOR_COORDS[t.table_number] : OUTDOOR_COORDS[t.table_number]
    
    if (!coords) return

    const tableNode = document.createElement('div')
    tableNode.className = `floor-table-node ${t.status} ${selectedTable?.id === t.id ? 'selected' : ''}`
    tableNode.style.left = coords.x
    tableNode.style.top = coords.y
    tableNode.innerHTML = `
      <span>T${t.table_number}</span>
      <span class="table-cap">Cap: ${t.capacity}</span>
    `
    tableNode.dataset.id = t.id
    
    tableNode.addEventListener('click', () => selectTable(t))

    if (isIndoor) {
      canvasIndoor.appendChild(tableNode)
    } else {
      canvasOutdoor.appendChild(tableNode)
    }
  })
}

// ── Select Table & Render Details ──────────────────────────────────
async function selectTable(table) {
  selectedTable = table
  
  // Highlight in map UI
  document.querySelectorAll('.floor-table-node').forEach(node => {
    node.classList.remove('selected')
    if (node.dataset.id === table.id) {
      node.classList.add('selected')
    }
  })

  // Show details panel
  document.getElementById('panel-empty-state').classList.add('hidden')
  document.getElementById('panel-content').classList.remove('hidden')

  // Set titles
  document.getElementById('detail-table-title').textContent = `Table ${table.table_number}`
  document.getElementById('detail-area-subtitle').textContent = `${table.floor_areas?.name || 'Indoor'} Area • Capacity: ${table.capacity} Persons`
  
  // Set status badge in panel
  const statusPill = document.getElementById('detail-status-pill')
  statusPill.className = `status-pill ${table.status}`
  statusPill.textContent = table.status.replace('_', ' ').toUpperCase()

  // Select active status button in controller
  document.querySelectorAll('.status-btn').forEach(btn => {
    btn.classList.remove('active')
    if (btn.dataset.status === table.status) {
      btn.classList.add('active')
    }
  })

  // Fetch active order for this table
  await fetchTableOrder(table.id)
}

async function fetchTableOrder(tableId) {
  const orderBox = document.getElementById('detail-order-box')
  const orderNumDisplay = document.getElementById('detail-order-number')
  const itemsList = document.getElementById('detail-order-items-list')
  const totalDisplay = document.getElementById('detail-order-total')
  const viewInvoiceBtn = document.getElementById('btn-view-invoice')

  try {
    // Get active orders for this table (not completed/cancelled)
    const activeOrders = await orders.getByTable(tableId)
    
    if (activeOrders && activeOrders.length > 0) {
      const active = activeOrders[0] // get newest active order
      selectedTableOrder = active

      orderBox.style.display = 'block'
      orderNumDisplay.textContent = active.order_number
      totalDisplay.textContent = `₹${parseFloat(active.grand_total).toFixed(2)}`
      
      const items = active.order_items || []
      itemsList.innerHTML = items.map(item => `
        <div class="summary-item-row">
          <span>${item.menu_items?.name || 'Item'} <strong style="color:var(--gold)">x${item.quantity}</strong></span>
          <span>₹${parseFloat(item.total_price).toFixed(2)}</span>
        </div>
      `).join('')

      if (viewInvoiceBtn) {
        viewInvoiceBtn.style.display = 'block'
        viewInvoiceBtn.onclick = () => {
          window.location.href = `./billing.html?order=${active.id}`
        }
      }
    } else {
      selectedTableOrder = null
      orderBox.style.display = 'none'
      if (viewInvoiceBtn) viewInvoiceBtn.style.display = 'none'
    }

  } catch (err) {
    console.error('Error loading table orders', err)
    orderBox.style.display = 'none'
  }
}

// ── Update Table Status ────────────────────────────────────────────
async function handleStatusChange(newStatus) {
  if (!selectedTable) return

  try {
    const oldStatus = selectedTable.status
    const updatedTable = await tables.updateStatus(selectedTable.id, newStatus)
    
    // Update local state and redraw maps
    selectedTable = updatedTable
    
    const idx = allTablesList.findIndex(t => t.id === selectedTable.id)
    if (idx !== -1) {
      allTablesList[idx] = updatedTable
    }

    renderMaps()
    selectTable(updatedTable)

    showToast(`Table ${selectedTable.table_number} status updated to: ${newStatus.toUpperCase()}`, 'success')

    // If table status was changed to available, clear active orders session details
    if (newStatus === 'available' && selectedTableOrder) {
      // Ask user to resolve payment
      if (selectedTableOrder.payment_status !== 'paid') {
        showToast('Reminder: Order is still unpaid. Please process payment in Billing.', 'info')
      }
    }

  } catch (err) {
    console.error('Error updating table status', err)
    showToast('Failed to update table status', 'error')
  }
}

// ── Switch Tabs ────────────────────────────────────────────────────
function switchTab(area) {
  activeTab = area
  
  const tabIndoor = document.getElementById('tab-indoor')
  const tabOutdoor = document.getElementById('tab-outdoor')
  const paneIndoor = document.getElementById('indoor-pane')
  const paneOutdoor = document.getElementById('outdoor-pane')

  if (area === 'indoor') {
    tabIndoor.classList.add('active')
    tabOutdoor.classList.remove('active')
    paneIndoor.style.display = 'flex'
    paneOutdoor.style.display = 'none'
  } else {
    tabIndoor.classList.remove('active')
    tabOutdoor.classList.add('active')
    paneIndoor.style.display = 'none'
    paneOutdoor.style.display = 'flex'
  }
}

// ── Event Listeners ────────────────────────────────────────────────
function setupEventListeners() {
  // Tabs
  document.getElementById('tab-indoor')?.addEventListener('click', () => switchTab('indoor'))
  document.getElementById('tab-outdoor')?.addEventListener('click', () => switchTab('outdoor'))

  // Status buttons
  document.querySelectorAll('.status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const status = btn.dataset.status
      handleStatusChange(status)
    })
  })

  // Call waiter trigger button in detail panel
  document.getElementById('btn-call-waiter')?.addEventListener('click', async () => {
    if (!selectedTable) return
    try {
      await db.from('waiter_calls').insert([{ table_id: selectedTable.id, status: 'pending' }])
      showToast(`Requested waiter call alert for Table ${selectedTable.table_number}`, 'success')
    } catch (err) {
      showToast('Error requesting waiter call', 'error')
    }
  })
}

// ── Realtime Setup ──────────────────────────────────────────────────
function setupRealtime() {
  if (realtimeSub) {
    realtime.remove(realtimeSub)
  }

  // Listen for table updates
  realtimeSub = realtime.onTables(async (payload) => {
    const updated = payload.new
    
    // Find item and update locally
    const idx = allTablesList.findIndex(t => t.id === updated.id)
    if (idx !== -1) {
      allTablesList[idx].status = updated.status
      renderMaps()
      
      // If the currently selected table was updated elsewhere, refresh panel details
      if (selectedTable && selectedTable.id === updated.id) {
        selectedTable.status = updated.status
        selectTable(allTablesList[idx])
      }

      // If status changed to bill_requested or ordering, play sound notification
      if (updated.status === 'billing_requested') {
        showToast(`Table ${updated.table_number} requested their bill!`, 'error')
        playAlert()
      } else if (updated.status === 'ordering') {
        showToast(`Table ${updated.table_number} is placing an order`, 'info')
      }
    }
  })
}

// Clean up realtime
window.addEventListener('beforeunload', () => {
  if (realtimeSub) realtime.remove(realtimeSub)
})

// Boot
initTablesPage()
