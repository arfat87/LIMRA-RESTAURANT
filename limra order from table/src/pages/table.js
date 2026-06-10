// ================================================================
// LIMRA RMS — Customer Table Ordering Page JS Module
// src/pages/table.js
// ================================================================
import { db, menu, tables, orders, alerts, realtime } from '../lib/insforge.js'

// ── State Management ───────────────────────────────────────────────
let currentTable = null
let menuCategories = []
let menuItems = []
let activeCategory = 'all'
let cart = []
let activeOrder = null
let statusSubscription = null

// ── Toast Notifications ────────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container')
  if (!container) return

  const toast = document.createElement('div')
  toast.className = `toast toast-${type}`
  toast.style.cssText = `
    background: var(--dark-2);
    border: 1px solid ${type === 'error' ? '#ef4444' : type === 'success' ? '#22c55e' : 'var(--gold-border)'};
    color: var(--text-primary);
    padding: 0.85rem 1.25rem;
    border-radius: var(--r-md);
    font-size: 0.875rem;
    font-weight: 500;
    box-shadow: var(--shadow-md);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
    animation: slideIn 0.3s ease both;
  `
  
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : '🔔'
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`
  container.appendChild(toast)

  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease both'
    setTimeout(() => toast.remove(), 300)
  }, 4000)
}

// ── Table Detection & Initialization ───────────────────────────────
function detectTableNumber() {
  // Try to read from URL path like /table/3
  const pathParts = window.location.pathname.split('/')
  const tableIdx = pathParts.indexOf('table')
  if (tableIdx !== -1 && pathParts[tableIdx + 1]) {
    const num = parseInt(pathParts[tableIdx + 1], 10)
    if (!isNaN(num)) return num
  }
  
  // Try query param table=3 or id=3
  const params = new URLSearchParams(window.location.search)
  const queryNum = parseInt(params.get('table') || params.get('id'), 10)
  if (!isNaN(queryNum)) return queryNum

  // Try reading from sessionStorage
  try {
    const saved = sessionStorage.getItem('limra_table')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed && parsed.table_number) return parsed.table_number
    }
  } catch (e) {
    console.error('Error reading saved table', e)
  }

  return null
}

async function initTableSession() {
  const tableNumber = detectTableNumber()
  if (!tableNumber) {
    showErrorState('Table QR code is required. Please scan the QR code on your table.')
    return
  }

  try {
    // Fetch table details
    const table = await tables.getByNumber(tableNumber)
    if (!table) {
      showErrorState(`Table number ${tableNumber} is not active or does not exist.`)
      return
    }

    currentTable = table
    sessionStorage.setItem('limra_table', JSON.stringify(table))

    // Update UI elements with table number
    const badgeText = document.getElementById('table-badge-text')
    if (badgeText) {
      badgeText.textContent = `Table ${table.table_number} — ${table.floor_areas?.name || 'Indoor'}`
    }

    // Hide loader, show app
    document.getElementById('page-loader').classList.add('hidden')
    document.getElementById('main-app').style.display = 'block'

    // Load active order session if there's any
    const savedOrder = sessionStorage.getItem('limra_active_order')
    if (savedOrder) {
      try {
        const orderData = JSON.parse(savedOrder)
        // Fetch fresh order details from database
        const freshOrder = await orders.getById(orderData.id)
        if (freshOrder && ['pending', 'accepted', 'preparing', 'ready', 'served'].includes(freshOrder.status)) {
          showOrderStatus(freshOrder)
        } else {
          sessionStorage.removeItem('limra_active_order')
        }
      } catch (e) {
        console.error('Error restoring active order', e)
      }
    }

    // Load menu data
    await loadMenu()

    // Restore cart
    loadCartFromSession()

  } catch (error) {
    console.error('Error initializing table session', error)
    showErrorState('Failed to connect to the restaurant backend. Please reload.')
  }
}

function showErrorState(message) {
  document.getElementById('page-loader').classList.add('hidden')
  const errState = document.getElementById('error-state')
  errState.classList.add('visible')
  const msgEl = errState.querySelector('.error-state-msg')
  if (msgEl) msgEl.textContent = message
}

// ── Menu Loading & Rendering ───────────────────────────────────────
async function loadMenu() {
  try {
    // Fetch categories and items
    const [categories, items] = await Promise.all([
      menu.getCategories(),
      menu.getItems()
    ])

    menuCategories = categories
    menuItems = items

    renderCategoryChips()
    renderMenuGrid()
    renderFeaturedSection()

  } catch (error) {
    console.error('Error loading menu', error)
    showToast('Failed to load menu items. Please refresh.', 'error')
  }
}

function renderCategoryChips() {
  const categoryRow = document.getElementById('category-row')
  if (!categoryRow) return

  const allChip = `
    <button class="category-chip ${activeCategory === 'all' ? 'active' : ''}" data-category="all">
      🍽️ All Items
    </button>
  `

  const chipsHTML = menuCategories.map(cat => `
    <button class="category-chip ${activeCategory === cat.id ? 'active' : ''}" data-category="${cat.id}">
      ${getCategoryEmoji(cat.name)} ${cat.name}
    </button>
  `).join('')

  categoryRow.innerHTML = allChip + chipsHTML

  // Add click listeners
  categoryRow.querySelectorAll('.category-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      categoryRow.querySelectorAll('.category-chip').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      activeCategory = btn.dataset.category
      renderMenuGrid()
    })
  })
}

function getCategoryEmoji(name) {
  const lower = name.toLowerCase()
  if (lower.includes('biryani')) return '🍚'
  if (lower.includes('tandoori')) return '🍗'
  if (lower.includes('kabab') || lower.includes('kebab')) return '🍢'
  if (lower.includes('starter')) return '🍤'
  if (lower.includes('gravy') || lower.includes('curry')) return '🍲'
  if (lower.includes('chinese')) return '🍜'
  if (lower.includes('bread') || lower.includes('naan') || lower.includes('roti')) return '🫓'
  if (lower.includes('rice')) return '🍚'
  if (lower.includes('beverage') || lower.includes('drink') || lower.includes('juice')) return '🥤'
  if (lower.includes('dessert') || lower.includes('sweet')) return '🍧'
  return '🍽️'
}

function renderMenuGrid() {
  const grid = document.getElementById('menu-grid')
  const empty = document.getElementById('menu-empty')
  const countEl = document.getElementById('menu-count')
  if (!grid) return

  // Filter items by category and search query
  const query = document.getElementById('search-input')?.value.toLowerCase().trim() || ''

  let filtered = menuItems
  if (activeCategory !== 'all') {
    filtered = filtered.filter(item => item.category_id === activeCategory)
  }
  if (query) {
    filtered = filtered.filter(item => 
      item.name.toLowerCase().includes(query) || 
      (item.description && item.description.toLowerCase().includes(query))
    )
  }

  // Update count label
  if (countEl) {
    countEl.textContent = `${filtered.length} items`
  }

  if (filtered.length === 0) {
    grid.innerHTML = ''
    empty?.classList.remove('hidden')
    return
  }

  empty?.classList.add('hidden')

  grid.innerHTML = filtered.map(item => {
    const cartItem = cart.find(c => c.id === item.id)
    const qty = cartItem ? cartItem.qty : 0

    // Check if non-veg
    const isNonVeg = !item.description?.toLowerCase().includes('pure veg') && 
                      !item.name?.toLowerCase().includes('veg ') &&
                      (item.category_id === menuCategories.find(c => c.name.toLowerCase().includes('biryani'))?.id || 
                       item.category_id === menuCategories.find(c => c.name.toLowerCase().includes('tandoori'))?.id ||
                       item.category_id === menuCategories.find(c => c.name.toLowerCase().includes('kabab'))?.id)

    return `
      <div class="menu-item-card ${isNonVeg ? 'nonveg-item' : 'veg-item'}" data-id="${item.id}">
        ${item.image_url ? 
          `<img src="${item.image_url}" class="menu-item-img" alt="${item.name}" loading="lazy" />` : 
          `<div class="menu-item-img-placeholder">${getCategoryEmoji(item.menu_categories?.name || '')}</div>`
        }
        <div class="menu-item-body">
          <div class="menu-item-name-row" style="display:flex; align-items:center; gap:0.35rem;">
            <span class="veg-dot ${isNonVeg ? 'nonveg' : 'veg'}"></span>
            <span class="menu-item-name">${item.name}</span>
          </div>
          <p class="menu-item-desc">${item.description || 'Freshly prepared delicious item.'}</p>
          <div class="menu-item-footer">
            <span class="menu-item-price">₹${parseFloat(item.price).toFixed(2)}</span>
            
            <div class="card-action-area">
              ${qty > 0 ? `
                <div class="card-qty-ctrl">
                  <button class="card-qty-btn decrease-qty" data-id="${item.id}">-</button>
                  <span class="card-qty-num">${qty}</span>
                  <button class="card-qty-btn increase-qty" data-id="${item.id}">+</button>
                </div>
              ` : `
                <button class="add-to-cart-btn add-new-btn" data-id="${item.id}" aria-label="Add to cart">+</button>
              `}
            </div>
          </div>
        </div>
      </div>
    `
  }).join('')

  // Add click handlers for menu buttons
  grid.querySelectorAll('.add-new-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      addToCart(btn.dataset.id)
      // Play bounce animation
      btn.classList.add('bounce')
      setTimeout(() => btn.classList.remove('bounce'), 350)
    })
  })

  grid.querySelectorAll('.increase-qty').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      addToCart(btn.dataset.id)
    })
  })

  grid.querySelectorAll('.decrease-qty').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      decreaseCartQty(btn.dataset.id)
    })
  })
}

function renderFeaturedSection() {
  const row = document.getElementById('featured-row')
  const section = document.getElementById('featured-section')
  if (!row || !section) return

  const featured = menuItems.filter(item => item.is_featured)

  if (featured.length === 0) {
    section.style.display = 'none'
    return
  }

  section.style.display = 'block'

  row.innerHTML = featured.map(item => {
    const isNonVeg = !item.description?.toLowerCase().includes('pure veg') && 
                      !item.name?.toLowerCase().includes('veg ')

    return `
      <div class="featured-card" data-id="${item.id}">
        <span class="featured-badge">Chef Choice</span>
        ${item.image_url ? 
          `<img src="${item.image_url}" class="featured-img" alt="${item.name}" />` : 
          `<div class="featured-img-placeholder">${getCategoryEmoji(item.menu_categories?.name || '')}</div>`
        }
        <div class="featured-body">
          <div class="featured-name" style="display:flex; align-items:center; gap:0.25rem;">
            <span class="veg-dot ${isNonVeg ? 'nonveg' : 'veg'}"></span>
            <span>${item.name}</span>
          </div>
          <div class="featured-price">₹${parseFloat(item.price).toFixed(2)}</div>
        </div>
        <button class="featured-add" data-id="${item.id}">+</button>
      </div>
    `
  }).join('')

  row.querySelectorAll('.featured-add').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      addToCart(btn.dataset.id)
      btn.classList.add('bounce')
      setTimeout(() => btn.classList.remove('bounce'), 350)
    })
  })

  row.querySelectorAll('.featured-card').forEach(card => {
    card.addEventListener('click', () => {
      addToCart(card.dataset.id)
    })
  })
}

// ── Cart Logic ─────────────────────────────────────────────────────
function addToCart(itemId) {
  const menuItem = menuItems.find(item => item.id === itemId)
  if (!menuItem) return

  const existing = cart.find(c => c.id === itemId)
  if (existing) {
    existing.qty++
  } else {
    // Prompt for note or special instruction
    const note = prompt(`Any special instructions for ${menuItem.name}? (e.g. Less spicy, extra sauce - optional):`)
    cart.push({
      id: menuItem.id,
      name: menuItem.name,
      price: parseFloat(menuItem.price),
      qty: 1,
      note: note ? note.trim() : null
    })
  }

  saveCartToSession()
  renderMenuGrid()
  renderFeaturedSection()
  updateCartUI()
}

function decreaseCartQty(itemId) {
  const existing = cart.find(c => c.id === itemId)
  if (!existing) return

  existing.qty--
  if (existing.qty <= 0) {
    cart = cart.filter(c => c.id !== itemId)
  }

  saveCartToSession()
  renderMenuGrid()
  renderFeaturedSection()
  updateCartUI()
}

function saveCartToSession() {
  sessionStorage.setItem('limra_cart', JSON.stringify(cart))
}

function loadCartFromSession() {
  const saved = sessionStorage.getItem('limra_cart')
  if (saved) {
    try {
      cart = JSON.parse(saved)
      updateCartUI()
    } catch (e) {
      console.error('Error loading cart from session', e)
    }
  }
}

function updateCartUI() {
  const totalItems = cart.reduce((total, item) => total + item.qty, 0)
  const subtotal = cart.reduce((total, item) => total + (item.price * item.qty), 0)
  const tax = subtotal * 0.05 // 5% GST
  const grandTotal = subtotal + tax

  // Update FAB badge and visibility
  const fab = document.getElementById('cart-fab')
  const fabCount = document.getElementById('fab-count')
  if (fab && fabCount) {
    fabCount.textContent = totalItems
    if (totalItems > 0) {
      fab.classList.add('visible')
    } else {
      fab.classList.remove('visible')
      closeCartDrawer()
    }
  }

  // Update Drawer Badges & Totals
  const countBadge = document.getElementById('cart-count-badge')
  if (countBadge) countBadge.textContent = `${totalItems} ${totalItems === 1 ? 'item' : 'items'}`

  const subtotalEl = document.getElementById('cart-subtotal')
  if (subtotalEl) subtotalEl.textContent = `₹${subtotal.toFixed(2)}`

  const gstEl = document.getElementById('cart-gst')
  if (gstEl) gstEl.textContent = `₹${tax.toFixed(2)}`

  const grandTotalEl = document.getElementById('cart-grand-total')
  if (grandTotalEl) grandTotalEl.textContent = `₹${grandTotal.toFixed(2)}`

  // Render items in list
  const list = document.getElementById('cart-items-list')
  if (list) {
    if (cart.length === 0) {
      list.innerHTML = `<div class="empty-state"><p class="empty-state-title">Your cart is empty</p><p class="empty-state-sub">Browse menu and add items to order</p></div>`
    } else {
      list.innerHTML = cart.map(item => `
        <div class="cart-item-row">
          <div class="cart-item-emoji">${getCategoryEmoji(menuItems.find(mi => mi.id === item.id)?.menu_categories?.name || '')}</div>
          <div class="cart-item-info">
            <p class="cart-item-name">${item.name}</p>
            ${item.note ? `<p class="cart-item-note">📝 ${item.note}</p>` : ''}
          </div>
          <div class="card-qty-ctrl" style="margin-right: 0.5rem;">
            <button class="card-qty-btn decrease-qty" data-id="${item.id}">-</button>
            <span class="card-qty-num">${item.qty}</span>
            <button class="card-qty-btn increase-qty" data-id="${item.id}">+</button>
          </div>
          <div class="cart-item-price">₹${(item.price * item.qty).toFixed(2)}</div>
        </div>
      `).join('')

      // Bind listeners inside cart drawer list
      list.querySelectorAll('.increase-qty').forEach(btn => {
        btn.addEventListener('click', () => addToCart(btn.dataset.id))
      })
      list.querySelectorAll('.decrease-qty').forEach(btn => {
        btn.addEventListener('click', () => decreaseCartQty(btn.dataset.id))
      })
    }
  }

  // Enable/disable Place Order button
  const orderBtn = document.getElementById('place-order-btn')
  if (orderBtn) {
    orderBtn.disabled = cart.length === 0
  }
}

// ── Drawer Open/Close ──────────────────────────────────────────────
function openCartDrawer() {
  const drawer = document.getElementById('cart-drawer')
  const overlay = document.getElementById('cart-overlay')
  if (drawer && overlay) {
    drawer.classList.add('open')
    overlay.classList.add('visible')
    document.body.style.overflow = 'hidden' // lock scroll
  }
}

function closeCartDrawer() {
  const drawer = document.getElementById('cart-drawer')
  const overlay = document.getElementById('cart-overlay')
  if (drawer && overlay) {
    drawer.classList.remove('open')
    overlay.classList.remove('visible')
    document.body.style.overflow = '' // release scroll
  }
}

// ── Order Operations ───────────────────────────────────────────────
async function handlePlaceOrder() {
  if (cart.length === 0 || !currentTable) return

  const notes = document.getElementById('order-notes')?.value.trim() || null
  const placeOrderBtn = document.getElementById('place-order-btn')

  try {
    placeOrderBtn.disabled = true
    placeOrderBtn.textContent = 'Submitting order…'

    const orderData = {
      tableId: currentTable.id,
      areaId: currentTable.area_id,
      items: cart,
      notes: notes
    }

    const order = await orders.placeOrder(orderData)
    
    // Success: Clear cart & save order session
    cart = []
    saveCartToSession()
    sessionStorage.setItem('limra_active_order', JSON.stringify(order))
    
    // Clear notes field
    const notesArea = document.getElementById('order-notes')
    if (notesArea) notesArea.value = ''

    updateCartUI()
    renderMenuGrid()
    renderFeaturedSection()
    closeCartDrawer()

    // Show order tracker
    showOrderStatus(order)
    showToast('Your order has been placed successfully!', 'success')

  } catch (error) {
    console.error('Error placing order', error)
    showToast('Failed to place order. Please try again.', 'error')
    placeOrderBtn.disabled = false
    placeOrderBtn.textContent = 'Place Order'
  }
}

// ── Live Status Tracking ───────────────────────────────────────────
function showOrderStatus(order) {
  activeOrder = order
  const modal = document.getElementById('order-status-modal')
  const numDisplay = document.getElementById('status-order-num')
  
  if (modal && numDisplay) {
    numDisplay.textContent = order.order_number || '#---'
    modal.classList.add('visible')
    
    updateStatusSteps(order.status)
    subscribeToOrderStatus(order.id)
  }
}

function updateStatusSteps(status) {
  const trackerSteps = ['pending', 'accepted', 'preparing', 'ready', 'served']
  const currentIdx = trackerSteps.indexOf(status)
  
  const stepElements = document.querySelectorAll('.modal-status-step')
  const statusMsg = document.getElementById('status-modal-message')
  const statusIcon = document.getElementById('status-modal-icon')

  stepElements.forEach((stepEl, idx) => {
    stepEl.classList.remove('done', 'active')
    if (idx < currentIdx) {
      stepEl.classList.add('done')
    } else if (idx === currentIdx) {
      stepEl.classList.add('active')
    }
  })

  // Update status messages
  switch (status) {
    case 'pending':
      if (statusIcon) statusIcon.textContent = '⏳'
      if (statusMsg) statusMsg.textContent = 'Your order is pending verification by our waitstaff.'
      break
    case 'accepted':
      if (statusIcon) statusIcon.textContent = '✅'
      if (statusMsg) statusMsg.textContent = 'Your order was accepted! The chef is queuing it up.'
      break
    case 'preparing':
      if (statusIcon) statusIcon.textContent = '👨‍🍳'
      if (statusMsg) statusMsg.textContent = 'Chef is preparing your hot meal. Get ready!'
      break
    case 'ready':
      if (statusIcon) statusIcon.textContent = '🍽️'
      if (statusMsg) statusMsg.textContent = 'Your food is ready! The waiter is on their way to serve you.'
      break
    case 'served':
      if (statusIcon) statusIcon.textContent = '🎉'
      if (statusMsg) statusMsg.textContent = 'Served! Enjoy your meal at LIMRA Restaurant.'
      break
    default:
      if (statusIcon) statusIcon.textContent = '✨'
      if (statusMsg) statusMsg.textContent = 'Order in progress.'
  }
}

function subscribeToOrderStatus(orderId) {
  if (statusSubscription) {
    realtime.remove(statusSubscription)
  }

  statusSubscription = realtime.onOrderStatus(orderId, (payload) => {
    const freshOrder = payload.new
    if (freshOrder) {
      activeOrder = freshOrder
      updateStatusSteps(freshOrder.status)
      showToast(`Order status updated to: ${freshOrder.status.toUpperCase()}`, 'info')
      
      // If completed or cancelled, remove from session & close tracker after a delay
      if (freshOrder.status === 'completed' || freshOrder.status === 'cancelled') {
        sessionStorage.removeItem('limra_active_order')
        setTimeout(() => {
          document.getElementById('order-status-modal')?.classList.remove('visible')
        }, 5000)
      }
    }
  })
}

// ── Call Waiter & Request Bill ─────────────────────────────────────
async function handleCallWaiter() {
  if (!currentTable) return
  
  const btn = document.getElementById('call-waiter-btn')
  const modalBtn = document.getElementById('status-call-waiter-btn')

  try {
    if (btn) btn.disabled = true
    if (modalBtn) modalBtn.disabled = true

    await alerts.callWaiter(currentTable.id)
    showToast('Waiter has been called. They will arrive shortly.', 'success')

  } catch (error) {
    console.error('Error calling waiter', error)
    showToast('Failed to call waiter. Please try again.', 'error')
  } finally {
    setTimeout(() => {
      if (btn) btn.disabled = false
      if (modalBtn) modalBtn.disabled = false
    }, 15000) // 15s debounce
  }
}

async function handleRequestBill() {
  if (!currentTable) return

  const btn = document.getElementById('request-bill-btn')
  const modalBtn = document.getElementById('status-request-bill-btn')

  try {
    if (btn) btn.disabled = true
    if (modalBtn) modalBtn.disabled = true

    // Fetch active order if not set
    let orderId = activeOrder?.id
    if (!orderId) {
      // Find active order for this table from DB
      const { data } = await db
        .from('orders')
        .select('id')
        .eq('table_id', currentTable.id)
        .not('status', 'in', '("completed","cancelled")')
        .order('created_at', { ascending: false })
        .limit(1)

      if (data && data.length > 0) {
        orderId = data[0].id
      }
    }

    if (!orderId) {
      showToast('You do not have any active orders to request a bill for.', 'error')
      if (btn) btn.disabled = false
      if (modalBtn) modalBtn.disabled = false
      return
    }

    await alerts.requestBill(currentTable.id, orderId)
    showToast('Bill request submitted! Cashier is preparing your receipt.', 'success')

  } catch (error) {
    console.error('Error requesting bill', error)
    showToast('Failed to request bill. Please call waiter instead.', 'error')
    if (btn) btn.disabled = false
    if (modalBtn) modalBtn.disabled = false
  }
}

// ── Event Listeners & Bootstrapping ────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // 1. Session Setup
  initTableSession()

  // 2. Search handlers
  const searchInput = document.getElementById('search-input')
  const clearBtn = document.getElementById('search-clear-btn')

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const val = searchInput.value.trim()
      if (val) {
        clearBtn?.classList.add('visible')
      } else {
        clearBtn?.classList.remove('visible')
      }
      renderMenuGrid()
    })
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = ''
        clearBtn.classList.remove('visible')
        renderMenuGrid()
      }
    })
  }

  // 3. Cart Drawer open/close
  document.getElementById('cart-fab')?.addEventListener('click', openCartDrawer)
  document.getElementById('cart-close-btn')?.addEventListener('click', closeCartDrawer)
  document.getElementById('cart-overlay')?.addEventListener('click', closeCartDrawer)

  // 4. Cart actions
  document.getElementById('place-order-btn')?.addEventListener('click', handlePlaceOrder)
  document.getElementById('call-waiter-btn')?.addEventListener('click', handleCallWaiter)
  document.getElementById('request-bill-btn')?.addEventListener('click', handleRequestBill)

  // 5. Modal actions
  document.getElementById('status-call-waiter-btn')?.addEventListener('click', handleCallWaiter)
  document.getElementById('status-request-bill-btn')?.addEventListener('click', handleRequestBill)
  document.getElementById('status-close-btn')?.addEventListener('click', () => {
    document.getElementById('order-status-modal')?.classList.remove('visible')
  })
})
