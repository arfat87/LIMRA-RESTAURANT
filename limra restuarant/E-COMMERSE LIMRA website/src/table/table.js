import { insforge, saveOrder, getMenuOverrides } from '../lib/insforge.js';
import { menuItems, categoryTabOrder, categoryLabels, categoryEmojis } from '../data/menu.js';

const $ = selector => {
  if (typeof selector === 'string' && selector.startsWith('#')) {
    return document.getElementById(selector.slice(1));
  }
  return document.getElementById(selector);
};
const show = el => { if (el) el.classList.remove('hidden'); };
const hide = el => { if (el) el.classList.add('hidden'); };

function loadTableCart() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = localStorage.getItem('limra-table-cart');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(c => {
      const item = menuItems.find(i => i.id === c.item.id);
      return item ? { item, quantity: c.quantity } : null;
    }).filter(Boolean);
  } catch (e) {
    console.warn('[TableCart] Hydration failed:', e);
    return [];
  }
}

let cart = loadTableCart(); // Hydrate dine-in cart from localStorage
let currentTable = null;

// ====================================================
// INITIALIZATION
// ====================================================
async function init() {
  const params = new URLSearchParams(window.location.search);
  const tParam = params.get('t') || params.get('table');

  if (tParam && /^\d+$/.test(tParam)) {
    const tableNum = parseInt(tParam, 10);
    if (tableNum >= 1 && tableNum <= 19) {
      currentTable = tableNum;
      show($('#customer-view'));
      hide($('#owner-view'));
      hide($('#error-view'));
      await initCustomerView();
      return;
    }
  }

  // If any query parameters were provided but we didn't validate above
  if (params.has('t') || params.has('table')) {
    hide($('#customer-view'));
    hide($('#owner-view'));
    show($('#error-view'));
  } else {
    show($('#owner-view'));
    hide($('#customer-view'));
    hide($('#error-view'));
    initOwnerView();
  }

  // Offline/Online network status listeners
  function initNetworkListener() {
    const statusDiv = document.createElement('div');
    statusDiv.id = 'network-status-toast';
    statusDiv.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      background: #1f2937;
      color: #f3f4f6;
      padding: 12px 24px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.1);
      display: flex;
      align-items: center;
      gap: 8px;
      z-index: 9999;
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), background 0.3s ease;
    `;
    document.body.appendChild(statusDiv);

    function updateNetworkStatus() {
      if (navigator.onLine) {
        statusDiv.style.background = '#10b981'; // Green
        statusDiv.innerHTML = '⚡ <span>Back online!</span>';
        setTimeout(() => {
          statusDiv.style.transform = 'translateX(-50%) translateY(100px)';
        }, 2000);
      } else {
        statusDiv.style.background = '#ef4444'; // Red
        statusDiv.innerHTML = '<span class="animate-spin mr-1">⏳</span> <span>Connection lost. Reconnecting...</span>';
        statusDiv.style.transform = 'translateX(-50%) translateY(0)';
      }
    }

    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);

    if (!navigator.onLine) {
      updateNetworkStatus();
    }
  }
  initNetworkListener();
}

// ====================================================
// CUSTOMER ORDERING VIEW LOGIC
// ====================================================
let selectedCategory = 'biryani';

async function loadMenuOverridesAndApply() {
  try {
    const overrides = await getMenuOverrides();
    // Apply overrides to static menuItems
    menuItems.forEach(item => {
      const override = overrides.find(o => o.id === item.id);
      if (override) {
        if (override.price !== null && override.price !== undefined) item.price = parseFloat(override.price);
        if (override.mrp !== null && override.mrp !== undefined) item.mrp = parseFloat(override.mrp);
        if (override.available !== undefined) item.available = override.available;
        if (override.featured !== undefined) item.featured = override.featured;
      } else {
        item.available = true;
        item.featured = false;
      }
    });
  } catch (err) {
    console.error('Failed to load menu overrides:', err);
  }
}

async function initCustomerView() {
  const zone = currentTable <= 9 ? 'indoor' : 'outdoor';
  const zoneLabel = zone === 'indoor' ? '🪑 Indoor' : '🌿 Outdoor';
  $('#customer-table-number-label').textContent = `Serving Table ${currentTable} (${zoneLabel})`;
  $('#checkout-table-display').textContent = currentTable;
  if ($('checkout-zone-display')) $('checkout-zone-display').textContent = zoneLabel;
  
  // Load dynamic menu overrides first
  await loadMenuOverridesAndApply();

  // Render Categories chips
  renderCategoryChips();
  
  // Render Menu
  renderMenu();
  
  // Setup Search
  $('#food-search-input').addEventListener('input', () => {
    renderMenu();
  });

  // Setup Checkout modals & drawers
  setupCartUI();
}

function renderCategoryChips() {
  const container = $('#categories-scroll-container');
  if (!container) return;

  const specialsChipHtml = `
    <button class="category-chip px-5 py-2.5 rounded-full text-xs font-semibold border border-white/5 bg-slate-900/60 text-slate-300 hover:border-white/10 ${selectedCategory === 'featured' ? 'active' : ''}" data-category="featured">
      ⭐ Today's Specials
    </button>
  `;

  const allChipHtml = `
    <button class="category-chip px-5 py-2.5 rounded-full text-xs font-semibold border border-white/5 bg-slate-900/60 text-slate-300 hover:border-white/10 ${selectedCategory === 'all' ? 'active' : ''}" data-category="all">
      🍽️ All Items
    </button>
  `;

  const chipsHtml = categoryTabOrder.map(cat => {
    const label = categoryLabels[cat] || cat;
    const emoji = categoryEmojis[cat] || '🍛';
    const isActive = selectedCategory === cat;
    return `
      <button class="category-chip px-5 py-2.5 rounded-full text-xs font-semibold border border-white/5 bg-slate-900/60 text-slate-300 hover:border-white/10 ${isActive ? 'active' : ''}" data-category="${cat}">
        ${emoji} ${label}
      </button>
    `;
  }).join('');

  container.innerHTML = specialsChipHtml + allChipHtml + chipsHtml;

  // Add click listeners
  container.querySelectorAll('.category-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.category-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedCategory = btn.dataset.category;
      
      const label = btn.textContent.trim();
      $('#menu-category-title').textContent = label;
      renderMenu();
    });
  });
}

function renderMenu() {
  const grid = $('#food-cards-grid');
  const searchVal = $('#food-search-input').value.toLowerCase().trim();

  // Filter items
  const filtered = menuItems.filter(item => {
    const matchesCategory = 
      selectedCategory === 'all' || 
      (selectedCategory === 'featured' ? item.featured === true : item.category === selectedCategory);
    const matchesSearch = !searchVal || item.name.toLowerCase().includes(searchVal);
    return matchesCategory && matchesSearch;
  });

  $('#menu-count-badge').textContent = `${filtered.length} item${filtered.length === 1 ? '' : 's'}`;

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-400 space-y-2">
        <p class="text-3xl">🍲</p>
        <p class="text-sm font-semibold">No food items match your search</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(item => {
    const cartItem = cart.find(c => c.item.id === item.id);
    const qty = cartItem ? cartItem.quantity : 0;
    const itemImage = item.image || '/images/food_biryani.png';
    const emojiStr = item.emoji || '🍛';
    const isAvailable = item.available !== false;

    return `
      <div class="glass-card food-card p-4 flex flex-col justify-between space-y-4 ${isAvailable ? '' : 'opacity-55 grayscale-[20%]'}" data-item-id="${item.id}">
        <div class="flex gap-3">
          <div class="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-white/5 bg-neutral-800 animate-pulse flex items-center justify-center relative">
            <img src="${itemImage}" alt="" class="w-full h-full object-cover error-fallback" onload="this.parentElement.classList.remove('animate-pulse', 'bg-neutral-800');" onerror="this.style.display='none'; this.nextElementSibling.style.display='block'; this.parentElement.classList.remove('animate-pulse', 'bg-neutral-800');">
            <span class="text-3xl hidden absolute inset-0 flex items-center justify-center" style="display:none;">${emojiStr}</span>
          </div>
          <div class="flex-1 min-w-0">
            <h4 class="font-bold text-sm text-slate-100 truncate">${item.name}</h4>
            <p class="text-xs text-slate-400 mt-1 capitalize">${categoryLabels[item.category] || item.category}</p>
            <p class="text-sm font-bold text-amber-500 mt-2">₹${item.price}</p>
          </div>
        </div>

        <div class="flex justify-between items-center pt-2">
          <span class="text-xs text-slate-400">Order Quantity</span>
          
          ${!isAvailable ? `
            <span class="text-xs font-bold text-slate-500 bg-slate-800/60 px-3 py-1.5 rounded-lg border border-white/5">Sold Out</span>
          ` : (qty === 0 ? `
            <button class="btn-add-to-cart px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition-all shadow-md shadow-amber-500/10" data-item-id="${item.id}">
              Add
            </button>
          ` : `
            <div class="flex items-center gap-2">
              <button class="btn-qty-minus w-7 h-7 rounded-md bg-white/5 hover:bg-white/10 text-white font-bold flex items-center justify-center text-sm transition-all" data-item-id="${item.id}">-</button>
              <span class="text-xs font-bold w-5 text-center">${qty}</span>
              <button class="btn-qty-plus w-7 h-7 rounded-md bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold flex items-center justify-center text-sm transition-all" data-item-id="${item.id}">+</button>
            </div>
          `)}
        </div>
      </div>
    `;
  }).join('');

  // Setup click listeners
  grid.querySelectorAll('.btn-add-to-cart, .btn-qty-plus').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.itemId, 10);
      addToCart(id);
    });
  });

  grid.querySelectorAll('.btn-qty-minus').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.itemId, 10);
      removeFromCart(id);
    });
  });
}

function addToCart(itemId) {
  const item = menuItems.find(i => i.id === itemId);
  if (!item) return;

  const cartItem = cart.find(c => c.item.id === itemId);
  if (cartItem) {
    cartItem.quantity += 1;
  } else {
    cart.push({ item, quantity: 1 });
  }

  updateCartState();
}

function removeFromCart(itemId) {
  const cartItemIndex = cart.findIndex(c => c.item.id === itemId);
  if (cartItemIndex === -1) return;

  const cartItem = cart[cartItemIndex];
  if (cartItem.quantity > 1) {
    cartItem.quantity -= 1;
  } else {
    cart.splice(cartItemIndex, 1);
  }

  updateCartState();
}

function updateCartState() {
  try {
    localStorage.setItem('limra-table-cart', JSON.stringify(cart));
  } catch (e) {
    console.warn('[TableCart] Failed to save cart:', e);
  }
  renderMenu();
  updateCartUI();
}

function updateCartUI() {
  const totalQty = cart.reduce((s, c) => s + c.quantity, 0);
  const subtotal = cart.reduce((s, c) => s + (c.item.price * c.quantity), 0);
  const gst = Math.round(subtotal * 0.05);
  const totalAmt = subtotal + gst;

  // Update Badges & Totals
  $('#cart-count-desktop').textContent = `${totalQty} item${totalQty === 1 ? '' : 's'}`;
  $('#cart-badge-mobile').textContent = totalQty;
  $('#cart-total-desktop').textContent = `₹${subtotal.toFixed(2)}`;
  $('#cart-total-mobile').textContent = `₹${subtotal.toFixed(2)}`;

  // Update modal checkout breakdown
  if ($('modal-subtotal')) $('modal-subtotal').textContent = `₹${subtotal.toFixed(2)}`;
  if ($('modal-gst')) $('modal-gst').textContent = `₹${gst.toFixed(2)}`;
  if ($('modal-total')) $('modal-total').textContent = `₹${totalAmt.toFixed(2)}`;

  // Enable/Disable Place Order Buttons
  const hasItems = totalQty > 0;
  $('#btn-checkout-desktop').disabled = !hasItems;
  $('#btn-checkout-mobile').disabled = !hasItems;

  // Render Cart Listings
  renderCartListings(subtotal);
}

function renderCartListings(totalAmt) {
  const desktopContainer = $('#cart-items-desktop-container');
  const mobileContainer = $('#cart-items-mobile-container');

  if (cart.length === 0) {
    const emptyHtml = `
      <div class="py-12 text-center text-slate-500 space-y-2 flex-1 flex flex-col justify-center items-center">
        <p class="text-4xl">🛒</p>
        <p class="text-xs font-semibold">Your tray is empty</p>
      </div>
    `;
    desktopContainer.innerHTML = emptyHtml;
    mobileContainer.innerHTML = emptyHtml;
    return;
  }

  const itemsHtml = cart.map(c => `
    <div class="p-3 rounded-xl border border-white/5 bg-slate-900/40 flex items-center justify-between gap-3">
      <div class="min-w-0 flex-1">
        <p class="font-semibold text-xs truncate text-slate-200">${c.item.name}</p>
        <p class="text-[10px] text-amber-500 font-bold mt-1">₹${c.item.price} × ${c.quantity}</p>
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <button class="btn-cart-minus w-6 h-6 rounded-md bg-white/5 hover:bg-white/10 text-white flex items-center justify-center text-xs font-bold" data-item-id="${c.item.id}">-</button>
        <span class="text-xs font-bold w-4 text-center">${c.quantity}</span>
        <button class="btn-cart-plus w-6 h-6 rounded-md bg-amber-500 hover:bg-amber-600 text-slate-950 flex items-center justify-center text-xs font-bold" data-item-id="${c.item.id}">+</button>
      </div>
    </div>
  `).join('');

  desktopContainer.innerHTML = itemsHtml;
  mobileContainer.innerHTML = itemsHtml;

  // Click listeners for cart controls
  [desktopContainer, mobileContainer].forEach(container => {
    container.querySelectorAll('.btn-cart-plus').forEach(btn => {
      btn.addEventListener('click', () => {
        addToCart(parseInt(btn.dataset.itemId, 10));
      });
    });

    container.querySelectorAll('.btn-cart-minus').forEach(btn => {
      btn.addEventListener('click', () => {
        removeFromCart(parseInt(btn.dataset.itemId, 10));
      });
    });
  });
}

function setupCartUI() {
  // Mobile drawer controls
  $('#cart-fab-btn').addEventListener('click', () => {
    show($('#cart-drawer-overlay'));
  });

  $('#cart-drawer-close').addEventListener('click', () => {
    hide($('#cart-drawer-overlay'));
  });

  $('#cart-drawer-overlay').addEventListener('click', e => {
    if (e.target === $('#cart-drawer-overlay')) hide($('#cart-drawer-overlay'));
  });

  // Checkout modal controls
  const openModal = () => {
    show($('#checkout-modal'));
  };

  const closeModal = () => {
    hide($('#checkout-modal'));
  };

  $('#btn-checkout-desktop').addEventListener('click', openModal);
  $('#btn-checkout-mobile').addEventListener('click', () => {
    hide($('#cart-drawer-overlay'));
    openModal();
  });

  $('#checkout-modal-close').addEventListener('click', closeModal);
  $('#checkout-modal').addEventListener('click', e => {
    if (e.target === $('#checkout-modal')) closeModal();
  });
  $('#checkout-form').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const name = fd.get('name').toString().trim() || 'Guest';
    const phone = fd.get('phone').toString().trim() || 'Dine-In';
    const instruction = fd.get('notes').toString().trim();

    await placeOrderAndShowSuccess(name, phone, instruction, 'cash', null);
  });

  async function placeOrderAndShowSuccess(name, phone, instruction, payment, txnRef) {
    const submitBtn = $('#btn-submit-order');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending to Kitchen...';

    try {
      const paymentNote = `[PAYMENT: ${payment}] | [PAYMENT_STATUS: ${payment === 'upi' ? 'PAID' : 'PENDING'}]`;
      const combinedNotes = [`[TABLE: ${currentTable}]`, paymentNote, instruction].filter(Boolean).join(' | ');

      const zone = currentTable <= 9 ? 'indoor' : 'outdoor';

      const subtotal = cart.reduce((s, c) => s + (c.item.price * c.quantity), 0);
      const gst = Math.round(subtotal * 0.05);

      const orderItems = cart.map(c => ({
        id: c.item.id,
        name: c.item.name,
        price: c.item.price,
        qty: c.quantity
      }));

      if (gst > 0) {
        orderItems.push({
          id: 9999,
          name: 'GST (5% Incl.)',
          price: gst,
          qty: 1
        });
      }

      const orderData = await saveOrder({
        customerName: name,
        customerPhone: phone,
        items: orderItems,
        notes: combinedNotes,
        orderType: 'table',
        tableNumber: currentTable,
        tableZone: zone,
        txnRef: txnRef
      });

      closeModal();
      cart = [];
      updateCartState();
      
      $('#success-order-number').textContent = `#${orderData.order_number}`;
      $('#success-table-number').textContent = `Table ${currentTable}`;
      $('#success-diner-name').textContent = name;

      hide($('#customer-view'));
      show($('#success-view'));
    } catch (err) {
      alert('Failed to place order: ' + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Confirm & Send to Kitchen';
    }
  }


  // Success view ordering more
  $('#btn-order-more').addEventListener('click', () => {
    hide($('#success-view'));
    show($('#customer-view'));
  });
}

// ====================================================
// OWNER/ADMIN VIEW LOGIC (QR CODE PORTAL)
// ====================================================
function initOwnerView() {
  const tableNodes = document.querySelectorAll('.layout-table-node');
  
  tableNodes.forEach(node => {
    node.addEventListener('click', () => {
      tableNodes.forEach(n => n.classList.remove('active'));
      node.classList.add('active');
      
      const id = node.dataset.tableId;
      const isIndoor = parseInt(id, 10) <= 9;
      
      renderQRCard(id, isIndoor ? 'Indoor Area' : 'Outdoor Area');
    });
  });

  // Setup QR Card Buttons
  $('#btn-copy-url').addEventListener('click', () => {
    const copyText = $('#qr-url-input');
    copyText.select();
    navigator.clipboard.writeText(copyText.value);
    
    const originalText = $('#btn-copy-url').textContent;
    $('#btn-copy-url').textContent = 'Copied!';
    setTimeout(() => {
      $('#btn-copy-url').textContent = originalText;
    }, 1500);
  });

  $('#btn-print-qr').addEventListener('click', () => {
    const w = window.open();
    const qrImg = $('#qr-code-image').src;
    const tableTitle = $('#qr-table-title').textContent;
    const subtitle = $('#qr-table-subtitle').textContent;
    const url = $('#qr-url-input').value;

    w.document.write(`
      <html>
      <head>
        <title>Print QR Label</title>
        <style>
          body {
            font-family: 'Inter', sans-serif;
            text-align: center;
            padding: 40px;
            color: #1e293b;
          }
          .label-card {
            border: 3px solid #f59e0b;
            padding: 30px;
            border-radius: 24px;
            max-width: 380px;
            margin: 0 auto;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
          }
          h1 {
            color: #d97706;
            margin: 0 0 5px 0;
            font-size: 28px;
            font-weight: 800;
          }
          p.sub {
            color: #64748b;
            margin: 0 0 20px 0;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.1em;
            font-weight: 700;
          }
          img {
            width: 250px;
            height: 250px;
            margin-bottom: 20px;
          }
          p.instructions {
            font-size: 14px;
            margin: 0 0 10px 0;
            color: #334155;
            font-weight: 600;
          }
          p.url {
            font-family: monospace;
            font-size: 10px;
            color: #64748b;
            word-break: break-all;
            margin: 0;
          }
        </style>
      </head>
      <body>
        <div class="label-card">
          <h1>LIMRA Restaurant</h1>
          <p class="sub">${tableTitle} · ${subtitle}</p>
          <img src="${qrImg}" />
          <p class="instructions">📱 Scan to View Menu & Place Order</p>
          <p class="url">${url}</p>
        </div>
        <script>
          window.onload = function() {
            window.print();
            window.close();
          }
        </script>
      </body>
      </html>
    `);
    w.document.close();
  });
}

function renderQRCard(tableId, areaLabel) {
  hide($('#qr-placeholder'));
  show($('#qr-card'));

  $('#qr-table-title').textContent = `Table ${tableId}`;
  $('#qr-table-subtitle').textContent = areaLabel;

  // Generate URL
  const destinationUrl = `${window.location.origin}/table/index.html?table=${tableId}`;
  $('#qr-url-input').value = destinationUrl;

  // Generate QR Code URL using public server
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(destinationUrl)}`;
  $('#qr-code-image').src = qrCodeUrl;

  // Setup Download Link via blob to bypass CORS download issues
  fetch(qrCodeUrl)
    .then(response => response.blob())
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob);
      const dlBtn = $('#btn-download-qr');
      dlBtn.href = blobUrl;
      dlBtn.download = `table_${tableId}_qr.png`;
    })
    .catch(err => {
      console.error('Error fetching QR code blob:', err);
      const dlBtn = $('#btn-download-qr');
      dlBtn.href = qrCodeUrl;
      dlBtn.removeAttribute('download');
    });
}

// Start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
