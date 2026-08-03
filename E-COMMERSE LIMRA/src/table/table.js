import { insforge, saveOrder, getMenuOverrides, validateCouponCode, redeemCoupon, getCombos } from '../lib/insforge.js';
import { menuItems, categoryTabOrder, categoryLabels, categoryEmojis } from '../data/menu.js';
import { t, getLanguage, setLanguage, translateCategory } from '../data/i18n.js';

const GOOGLE_REVIEW_URL = 'https://www.google.com/search?q=LIMRA+RESTAURANT+Reviews&si=APenkKm7iecQ4G6P-TsbSMFKIQtv3EFIqRAFw-i8uEbk55Z-_6dIxfmNBwW99EmmQi8qL9XUXBIGdTaYGGEV6j9GaIbMMJLZYHcwcGdpMDluPybR3SZOzvBqx0gc8Uh6gAtJQdgYpnaRRIWykrEWWbdLZoniWAXnEg%3D%3D';

// ═══════════════════════════════════════
// DINE-IN TABLE LANGUAGE ENGINE
// ═══════════════════════════════════════
let selectedTableModalLang = 'en';

function initTableLanguageSystem() {
  const savedLang = localStorage.getItem('limra_lang');

  const btnEn = $('#lang-btn-en');
  const btnBn = $('#lang-btn-bn');
  const confirmBtn = $('#lang-confirm-btn');
  const closeBtn = $('#lang-modal-close');
  const modal = $('#lang-modal');
  const tableLangBtn = $('#table-lang-btn');

  function updateModalBtnStyles(lang) {
    selectedTableModalLang = lang;
    if (btnEn && btnBn) {
      if (lang === 'en') {
        btnEn.className = 'group flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-amber-500 bg-amber-500/10 transition-all cursor-pointer shadow-sm';
        btnBn.className = 'group flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-white/10 hover:border-amber-500 hover:bg-amber-500/10 transition-all cursor-pointer shadow-sm';
      } else {
        btnBn.className = 'group flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-amber-500 bg-amber-500/10 transition-all cursor-pointer shadow-sm';
        btnEn.className = 'group flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-white/10 hover:border-amber-500 hover:bg-amber-500/10 transition-all cursor-pointer shadow-sm';
      }
    }
  }

  btnEn?.addEventListener('click', () => updateModalBtnStyles('en'));
  btnBn?.addEventListener('click', () => updateModalBtnStyles('bn'));

  confirmBtn?.addEventListener('click', () => {
    setLanguage(selectedTableModalLang);
    hideLanguageModal();
    applyTableLanguage(selectedTableModalLang);
  });

  closeBtn?.addEventListener('click', () => {
    hideLanguageModal();
  });

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) hideLanguageModal();
  });

  const openModalHandler = (e) => {
    if (e) e.preventDefault();
    updateModalBtnStyles(getLanguage());
    showLanguageModal();
  };

  tableLangBtn?.addEventListener('click', openModalHandler);

  const initialLang = savedLang || 'en';
  applyTableLanguage(initialLang);
  openModalHandler();
}

function showLanguageModal() {
  const modal = $('#lang-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    if (modal.children[0]) modal.children[0].classList.remove('scale-95');
  }, 50);
}
window.showLanguageModal = showLanguageModal;

function hideLanguageModal() {
  const modal = $('#lang-modal');
  if (!modal) return;
  modal.classList.add('opacity-0');
  if (modal.children[0]) modal.children[0].classList.add('scale-95');
  setTimeout(() => {
    modal.classList.add('hidden');
  }, 300);
}

function applyTableLanguage(lang) {
  const current = setLanguage(lang);
  const tableLangLabel = $('#table-lang-label');
  if (tableLangLabel) {
    tableLangLabel.textContent = current === 'bn' ? 'বাংলা' : 'EN';
  }

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = t(key, el.textContent);
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) {
      el.placeholder = t(key, el.placeholder);
    }
  });

  if (typeof renderCategoryChips === 'function') {
    renderCategoryChips();
  }
  if (typeof renderMenu === 'function') {
    renderMenu();
  }
}


const $ = selector => {
  if (typeof selector === 'string' && selector.startsWith('#')) {
    return document.getElementById(selector.slice(1));
  }
  return document.getElementById(selector);
};
const show = el => { if (el) el.classList.remove('hidden'); };
const hide = el => { if (el) el.classList.add('hidden'); };

// ═══════════════════════════════════════
// GUEST TABLE ORDERS & MULTI-ROUND SESSION ENGINE
// ═══════════════════════════════════════
function getTableSessionKey(tableNum) {
  return `limra_table_session_table_${tableNum}`;
}

function getTableSession(tableNum) {
  try {
    const raw = localStorage.getItem(getTableSessionKey(tableNum));
    if (!raw) return { rounds: [], createdAt: Date.now() };
    const parsed = JSON.parse(raw);
    const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
    if (parsed.createdAt && (Date.now() - parsed.createdAt > SIX_HOURS_MS)) {
      localStorage.removeItem(getTableSessionKey(tableNum));
      return { rounds: [], createdAt: Date.now() };
    }
    return parsed;
  } catch (e) {
    return { rounds: [], createdAt: Date.now() };
  }
}

function saveTableSession(tableNum, sessionData) {
  try {
    localStorage.setItem(getTableSessionKey(tableNum), JSON.stringify(sessionData));
  } catch (e) {
    console.warn('[TableSession] Failed to save session:', e);
  }
}

function addOrderRoundToTableSession(tableNum, orderNumber, items, totalAmt, name) {
  const session = getTableSession(tableNum);
  const roundNum = session.rounds.length + 1;
  const roundData = {
    roundNumber: roundNum,
    orderNumber: orderNumber,
    placedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    items: items, // [{ name, qty, price }]
    totalAmount: totalAmt,
    customerName: name,
    status: 'Sent to Kitchen'
  };
  session.rounds.push(roundData);
  saveTableSession(tableNum, session);
  updateGuestOrdersBadge(tableNum);
  return roundNum;
}

function updateGuestOrdersBadge(tableNum = currentTable) {
  const badge = $('#guest-orders-badge');
  if (!badge) return;
  const session = getTableSession(tableNum);
  const totalItemCount = session.rounds.reduce((acc, r) => acc + r.items.reduce((sum, i) => sum + i.qty, 0), 0);
  badge.textContent = totalItemCount;
}

function renderTableActiveOrdersModal() {
  const modal = $('#modal-table-orders');
  const container = $('#guest-table-orders-container');
  const tableLabel = $('#guest-order-table-label');
  const totalLabel = $('#guest-table-running-total');

  if (!modal || !container) return;

  const session = getTableSession(currentTable);
  if (tableLabel) tableLabel.textContent = `Table #${currentTable} • ${session.rounds.length > 0 ? `${session.rounds.length} Order Rounds Placed` : 'Active Dining Session'}`;

  container.innerHTML = '';

  if (session.rounds.length === 0) {
    container.innerHTML = `
      <div class="py-12 text-center text-slate-400">
        <div class="text-4xl mb-2">🍽️</div>
        <p class="font-bold text-sm text-slate-200">No active orders for Table #${currentTable} yet.</p>
        <p class="text-xs text-slate-400 mt-1">Select your favorite dishes from the menu to place Round #1!</p>
      </div>
    `;
    if (totalLabel) totalLabel.textContent = '₹0.00';
  } else {
    let grandTotal = 0;
    session.rounds.forEach(round => {
      grandTotal += round.totalAmount;
      const roundCard = document.createElement('div');
      roundCard.className = 'glass-card p-4 space-y-2.5 border border-white/10 bg-slate-900/60 rounded-2xl';
      
      const itemsListHtml = round.items.map(it => `
        <div class="flex justify-between items-center text-xs">
          <span class="font-medium text-slate-200">${it.name} <span class="text-amber-400 font-bold">×${it.qty}</span></span>
          <span class="font-bold text-slate-300">₹${(it.price * it.qty).toFixed(2)}</span>
        </div>
      `).join('');

      roundCard.innerHTML = `
        <div class="flex items-center justify-between border-b border-white/10 pb-2">
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-extrabold text-[11px] border border-amber-500/30">
              Round #${round.roundNumber}
            </span>
            <span class="text-[11px] font-semibold text-slate-400">#${round.orderNumber} • ${round.placedAt}</span>
          </div>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            🍳 ${round.status}
          </span>
        </div>
        <div class="space-y-1.5 py-1">
          ${itemsListHtml}
        </div>
        <div class="flex justify-between items-center pt-2 border-t border-white/5 text-xs font-bold">
          <span class="text-slate-400">Round Subtotal</span>
          <span class="text-amber-400 font-extrabold">₹${round.totalAmount.toFixed(2)}</span>
        </div>
      `;
      container.appendChild(roundCard);
    });

    if (totalLabel) totalLabel.textContent = `₹${grandTotal.toFixed(2)}`;
  }

  modal.style.display = 'flex';
  modal.classList.remove('hidden');
}

function closeTableActiveOrdersModal() {
  const modal = $('#modal-table-orders');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.add('hidden');
  }
}

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
let appliedCoupon = null;

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
let selectedCategory = 'featured';
let activeCombos = [];

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
  initTableLanguageSystem();
  const zone = currentTable <= 9 ? 'indoor' : 'outdoor';
  const zoneLabel = zone === 'indoor' ? '🪑 Indoor' : '🌿 Outdoor';
  if ($('customer-table-number-label')) $('customer-table-number-label').textContent = `Serving Table ${currentTable} (${zoneLabel})`;
  if ($('checkout-table-display')) $('checkout-table-display').textContent = currentTable;
  if ($('checkout-zone-display')) $('checkout-zone-display').textContent = zoneLabel;
  
  // Load dynamic menu overrides first
  await loadMenuOverridesAndApply();

  // Load combos from database
  try {
    activeCombos = await getCombos();
  } catch (err) {
    console.error('Failed to load combos on customer view:', err);
  }

  // Render Categories chips
  renderCategoryChips();
  
  // Render Menu
  renderMenu();
  
  // Setup Search
  $('#food-search-input').addEventListener('input', () => {
    renderMenu();
  });

  // Setup Cart UI & Product Detail Drawer controls
  setupCartUI();
  setupTableDetailDrawer();

  // Verify backend active orders for currentTable — if settled/delivered, auto-clear local session
  try {
    const { data: dbOrders } = await insforge.database
      .from('orders')
      .select('id, status, notes')
      .neq('status', 'delivered')
      .neq('status', 'cancelled');

    const activeTableOrders = (dbOrders || []).filter(o => {
      const notes = o.notes || '';
      const tableMatch = notes.match(/\[TABLE:\s*(\d+)\]/);
      return tableMatch && parseInt(tableMatch[1], 10) === currentTable;
    });

    if (activeTableOrders.length === 0) {
      console.log(`[TableSession] Table #${currentTable} has no active backend orders. Clearing stale local session.`);
      localStorage.removeItem(getTableSessionKey(currentTable));
    }
  } catch (checkErr) {
    console.warn('[TableSession] Failed to validate backend table session:', checkErr);
  }

  // Update badge for guest table session
  updateGuestOrdersBadge(currentTable);

  // Bind Guest Table Orders Modal Events
  $('#btn-open-guest-orders')?.addEventListener('click', renderTableActiveOrdersModal);
  $('#modal-table-orders-close')?.addEventListener('click', closeTableActiveOrdersModal);
  $('#btn-add-more-food')?.addEventListener('click', closeTableActiveOrdersModal);
  $('#btn-request-table-bill')?.addEventListener('click', async () => {
    const session = getTableSession(currentTable);
    const totalAmt = session.rounds.reduce((acc, r) => acc + r.totalAmount, 0);

    try {
      await insforge.database.from('notifications').insert([{
        title: `🛎️ Table #${currentTable} Bill Requested!`,
        description: `Final bill requested for Table #${currentTable} (${session.rounds.length} rounds). Total: ₹${totalAmt.toFixed(2)}`,
        type: 'table_bill_request',
        item_id: `table_${currentTable}`,
        is_read: false
      }]);
    } catch (err) {
      console.warn('[TableBillRequest] Failed to insert notification:', err);
    }

    alert(`🛎️ Service Request Sent!\nA waiter will bring the final bill (₹${totalAmt.toFixed(2)}) for Table #${currentTable} shortly.`);
    closeTableActiveOrdersModal();
  });

  // Subscribe to realtime table session clearance broadcast from Admin
  try {
    insforge.realtime.subscribe(`table-notifications:${currentTable}`, (payload) => {
      if (payload && payload.event === 'table_session_settled') {
        localStorage.removeItem(getTableSessionKey(currentTable));
        updateGuestOrdersBadge(currentTable);
        closeTableActiveOrdersModal();
        alert(`✨ Thank you for dining at LIMRA Restaurant!\nTable #${currentTable} bill has been settled.`);
      }
    });
  } catch (realtimeErr) {
    console.warn('[TableRealtime] Failed to subscribe to settlement channel:', realtimeErr);
  }
}

function renderCategoryChips() {
  const container = $('#categories-scroll-container');
  if (!container) return;

  const currentLang = getLanguage();
  const specialsLabel = currentLang === 'bn' ? 'আজকের স্পেশাল' : "Today's Specials";
  const allLabel = currentLang === 'bn' ? 'সব খাবার' : 'All Items';

  const specialsChipHtml = `
    <button class="category-chip px-5 py-2.5 rounded-full text-xs font-semibold border border-white/5 bg-slate-900/60 text-slate-300 hover:border-white/10 ${selectedCategory === 'featured' ? 'active' : ''}" data-category="featured">
      ⭐ ${specialsLabel}
    </button>
  `;

  const allChipHtml = `
    <button class="category-chip px-5 py-2.5 rounded-full text-xs font-semibold border border-white/5 bg-slate-900/60 text-slate-300 hover:border-white/10 ${selectedCategory === 'all' ? 'active' : ''}" data-category="all">
      🍽️ ${allLabel}
    </button>
  `;

  const chipsHtml = categoryTabOrder.map(cat => {
    const label = categoryLabels[cat] || cat;
    const transLabel = currentLang === 'bn' ? translateCategory(cat) : label;
    const emoji = categoryEmojis[cat] || '🍛';
    const isActive = selectedCategory === cat;
    return `
      <button class="category-chip px-5 py-2.5 rounded-full text-xs font-semibold border border-white/5 bg-slate-900/60 text-slate-300 hover:border-white/10 ${isActive ? 'active' : ''}" data-category="${cat}">
        ${emoji} ${transLabel}
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

  // Filter combos if Today's Specials or All category is active
  const filteredCombos = activeCombos.filter(combo => {
    if (selectedCategory !== 'all' && selectedCategory !== 'featured') return false;
    const matchesSearch = !searchVal || combo.name.toLowerCase().includes(searchVal);
    return combo.available !== false && matchesSearch;
  });

  const totalCount = filtered.length + filteredCombos.length;
  $('#menu-count-badge').textContent = `${totalCount} item${totalCount === 1 ? '' : 's'}`;

  if (totalCount === 0) {
    if (selectedCategory === 'featured') {
      grid.innerHTML = `
        <div class="col-span-full py-16 text-center text-slate-400 space-y-4">
          <p class="text-5xl">🍱</p>
          <div class="space-y-1">
            <p class="text-sm font-bold text-slate-200">No active Specials or Combo Deals today</p>
            <p class="text-xs text-slate-400">Click the "🍽️ All Items" tab above to view our complete menu!</p>
          </div>
        </div>
      `;
    } else {
      grid.innerHTML = `
        <div class="col-span-full py-12 text-center text-slate-400 space-y-2">
          <p class="text-3xl">🍲</p>
          <p class="text-sm font-semibold">No food items match your search</p>
        </div>
      `;
    }
    return;
  }

  // Render combo cards
  const combosHtml = filteredCombos.map(combo => {
    const cartItem = cart.find(c => c.item.id === `combo-${combo.id}`);
    const qty = cartItem ? cartItem.quantity : 0;
    const itemsListStr = Array.isArray(combo.items)
      ? combo.items.map(it => `${it.name} (x${it.qty || 1})`).join(' + ')
      : 'No items';

    const hasDiscount = combo.mrp && parseFloat(combo.mrp) > parseFloat(combo.price);

    return `
      <div class="glass-card food-card p-4 flex flex-col justify-between space-y-4 border border-amber-500/30 bg-slate-900/80 shadow-lg" data-item-id="combo-${combo.id}">
        <div class="flex gap-3.5">
          <div class="w-20 h-20 rounded-2xl overflow-hidden shrink-0 border border-amber-500/30 bg-amber-500/10 flex items-center justify-center relative shadow-inner">
            <span class="text-3xl">🍱</span>
            <span class="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-amber-500 text-slate-950 font-black text-[9px]">COMBO</span>
          </div>
          <div class="flex-1 min-w-0 text-left">
            <h4 class="font-extrabold text-sm sm:text-base text-slate-100 truncate">${combo.name}</h4>
            <p class="text-[11px] text-slate-400 mt-1 font-semibold leading-relaxed" style="max-height: 2.4rem; overflow: hidden;">Includes: ${itemsListStr}</p>
            <p class="text-base sm:text-lg font-black text-amber-400 mt-2 flex items-center gap-1.5">
              ₹${combo.price}
              ${hasDiscount ? `<span class="text-xs font-normal text-slate-500 line-through">₹${combo.mrp}</span>` : ''}
            </p>
          </div>
        </div>

        <div class="flex justify-between items-center pt-2 border-t border-white/10">
          <div class="flex items-center gap-2.5">
            ${qty > 0 ? `
              <button class="w-10 h-10 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-700/80 active:scale-95 text-rose-300 flex items-center justify-center font-black text-lg btn-cart-minus cursor-pointer" data-item-id="combo-${combo.id}">-</button>
              <span class="w-7 text-center font-black text-base text-amber-400">${qty}</span>
              <button class="w-10 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 flex items-center justify-center font-black text-lg btn-cart-plus cursor-pointer" data-item-id="combo-${combo.id}">+</button>
            ` : `
              <button class="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs btn-cart-add cursor-pointer shadow-md flex items-center gap-1.5">
                <span>➕</span> <span data-i18n="add_to_cart">Add to Order</span>
              </button>
            `}
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Render normal items (2-Column Mobile Tag Layout)
  const itemsHtml = filtered.map(item => {
    const cartItem = cart.find(c => c.item.id === item.id);
    const qty = cartItem ? cartItem.quantity : 0;
    const itemImage = item.image || '/images/food_biryani.png';
    const emojiStr = item.emoji || '🍛';
    const skuCode = item.sku || item.code || `SKU-${item.id}`;
    const isAvailable = item.available !== false;

    return `
      <div class="glass-card food-card p-2.5 sm:p-4 flex flex-col justify-between space-y-2.5 sm:space-y-3 border border-white/10 bg-slate-900/90 shadow-lg transition-transform active:scale-[0.98] ${isAvailable ? '' : 'opacity-55 grayscale-[20%]'}" data-item-id="${item.id}">
        <!-- Top Image Banner -->
        <div class="w-full h-28 sm:h-36 rounded-xl overflow-hidden shrink-0 border border-white/10 bg-neutral-800 animate-pulse flex items-center justify-center relative shadow-inner">
          <img src="${itemImage}" alt="" class="w-full h-full object-cover error-fallback" onload="this.parentElement.classList.remove('animate-pulse', 'bg-neutral-800');" onerror="this.style.display='none'; this.nextElementSibling.style.display='block'; this.parentElement.classList.remove('animate-pulse', 'bg-neutral-800');">
          <span class="text-3xl absolute inset-0 flex items-center justify-center" style="display:none;">${emojiStr}</span>
          <span class="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-slate-950/85 text-[10px] sm:text-xs backdrop-blur-sm shadow">${emojiStr}</span>
          <span class="absolute top-1 right-1 px-1.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30 text-[9px] font-mono font-extrabold text-amber-400 backdrop-blur-sm">${skuCode}</span>
        </div>

        <!-- Details -->
        <div class="text-left space-y-1">
          <h4 class="font-extrabold text-xs sm:text-base text-slate-100 line-clamp-2 leading-snug">${item.name}</h4>
          <p class="text-[10px] sm:text-xs text-slate-400 capitalize font-semibold truncate">${categoryLabels[item.category] || item.category}</p>
          <p class="text-sm sm:text-lg font-black text-amber-400 pt-0.5">₹${item.price}</p>
        </div>

        <!-- Action Button -->
        <div class="pt-1.5 border-t border-white/10 flex justify-center">
          ${isAvailable ? `
            <div class="w-full">
              ${qty > 0 ? `
                <div class="flex items-center justify-between w-full bg-slate-950/80 p-1 rounded-xl border border-white/10">
                  <button class="w-8 h-8 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-700/80 active:scale-95 text-rose-300 flex items-center justify-center font-black text-sm btn-cart-minus cursor-pointer" data-item-id="${item.id}">-</button>
                  <span class="font-black text-xs sm:text-sm text-amber-400">${qty}</span>
                  <button class="w-8 h-8 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 flex items-center justify-center font-black text-sm btn-cart-plus cursor-pointer" data-item-id="${item.id}">+</button>
                </div>
              ` : `
                <button class="w-full py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-[11px] sm:text-xs btn-cart-add cursor-pointer shadow-md flex items-center justify-center gap-1" data-item-id="${item.id}">
                  <span>➕</span> <span data-i18n="add_to_cart">Add</span>
                </button>
              `}
            </div>
          ` : `
            <span class="w-full py-1.5 text-center rounded-xl bg-rose-500/15 text-rose-400 font-extrabold text-[10px] uppercase tracking-wider border border-rose-500/30">Sold Out</span>
          `}
        </div>
      </div>
    `;
  }).join('');

  grid.innerHTML = combosHtml + itemsHtml;

  // Add click handlers
  grid.querySelectorAll('.btn-cart-add, .btn-cart-plus').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const target = e.currentTarget;
      const idVal = target.dataset.itemId || target.getAttribute('data-item-id');
      if (!idVal) return;
      const id = idVal.startsWith('combo-') ? idVal : parseInt(idVal, 10);
      addToCart(id);
    });
  });

  grid.querySelectorAll('.btn-cart-minus').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const target = e.currentTarget;
      const idVal = target.dataset.itemId || target.getAttribute('data-item-id');
      if (!idVal) return;
      const id = idVal.startsWith('combo-') ? idVal : parseInt(idVal, 10);
      removeFromCart(id);
    });
  });

  // Attach card-level clicks to open the detail drawer
  grid.querySelectorAll('.food-card').forEach(card => {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      const idVal = card.dataset.itemId;
      if (idVal.startsWith('combo-')) return; // skip combo detail popup
      const id = parseInt(idVal, 10);
      openTableDetailDrawer(id);
    });
  });
}

function addToCart(itemId) {
  let item = null;
  if (typeof itemId === 'string' && itemId.startsWith('combo-')) {
    const comboId = parseInt(itemId.replace('combo-', ''), 10);
    const combo = activeCombos.find(c => c.id === comboId);
    if (combo) {
      const itemsListStr = Array.isArray(combo.items)
        ? combo.items.map(it => `${it.name} (x${it.qty || 1})`).join(' + ')
        : 'No items';
      item = {
        id: itemId,
        name: combo.name,
        price: parseFloat(combo.price),
        category: 'specials',
        description: `Included: ${itemsListStr}`,
        isCombo: true
      };
    }
  } else {
    item = menuItems.find(i => i.id === itemId);
  }
  
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

  if (appliedCoupon && subtotal < parseFloat(appliedCoupon.min_bill)) {
    appliedCoupon = null;
    const feedback = $('#table-coupon-feedback');
    if (feedback) {
      feedback.textContent = `✗ Coupon cleared: Minimum bill of ₹${parseFloat(appliedCoupon.min_bill).toFixed(2)} required.`;
      feedback.style.color = '#ff5b5b';
      show(feedback);
    }
  }

  const discountAmt = appliedCoupon ? Math.round(subtotal * (appliedCoupon.discount_pct / 100)) : 0;
  const gst = Math.round((subtotal - discountAmt) * 0.05);
  const totalAmt = subtotal - discountAmt + gst;

  // Update Badges & Totals
  $('#cart-count-desktop').textContent = `${totalQty} item${totalQty === 1 ? '' : 's'}`;
  $('#cart-badge-mobile').textContent = totalQty;
  $('#cart-total-desktop').textContent = `₹${subtotal.toFixed(2)}`;
  $('#cart-total-mobile').textContent = `₹${subtotal.toFixed(2)}`;

  // Update modal checkout breakdown
  if ($('modal-subtotal')) $('modal-subtotal').textContent = `₹${subtotal.toFixed(2)}`;
  
  if ($('modal-discount-row')) {
    if (appliedCoupon) {
      $('modal-discount').textContent = `-₹${discountAmt.toFixed(2)}`;
      show($('modal-discount-row'));
    } else {
      hide($('modal-discount-row'));
    }
  }
  
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
      <div class="min-w-0 flex-1 text-left">
        <p class="font-semibold text-xs truncate text-slate-200">${c.item.name}</p>
        ${c.item.description ? `<p class="text-[9px] text-slate-400 mt-0.5 font-semibold truncate">${c.item.description}</p>` : ''}
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
        const idVal = btn.dataset.itemId;
        const id = idVal.startsWith('combo-') ? idVal : parseInt(idVal, 10);
        addToCart(id);
      });
    });

    container.querySelectorAll('.btn-cart-minus').forEach(btn => {
      btn.addEventListener('click', () => {
        const idVal = btn.dataset.itemId;
        const id = idVal.startsWith('combo-') ? idVal : parseInt(idVal, 10);
        removeFromCart(id);
      });
    });
  });
}

function setupCartUI() {
  setupTableDetailDrawer();
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

  // Coupon Validation logic
  $('#btn-apply-coupon')?.addEventListener('click', async () => {
    const input = $('#table-coupon-input');
    const feedback = $('#table-coupon-feedback');
    const phoneInput = document.querySelector('#checkout-form input[name="phone"]');
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const code = input.value.trim().toUpperCase();
    
    if (!code) {
      feedback.textContent = 'Please enter a coupon code';
      feedback.style.color = '#ff5b5b';
      feedback.classList.remove('hidden');
      return;
    }
    
    feedback.textContent = 'Validating...';
    feedback.style.color = '#cbd5e1';
    feedback.classList.remove('hidden');
    
    const subtotal = cart.reduce((s, c) => s + (c.item.price * c.quantity), 0);
    
    try {
      const coupon = await validateCouponCode(code, subtotal, phone);
      appliedCoupon = coupon;
      feedback.textContent = `✓ Code applied! Saved ${coupon.discount_pct}% on subtotal.`;
      feedback.style.color = '#10b981';
      updateCartUI();
    } catch (err) {
      appliedCoupon = null;
      feedback.textContent = `✗ ${err.message}`;
      feedback.style.color = '#ff5b5b';
      updateCartUI();
    }
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
      const subtotal = cart.reduce((s, c) => s + (c.item.price * c.quantity), 0);
      const discountAmt = appliedCoupon ? Math.round(subtotal * (appliedCoupon.discount_pct / 100)) : 0;
      const gst = Math.round((subtotal - discountAmt) * 0.05);

      const session = getTableSession(currentTable);
      const nextRoundNum = session.rounds.length + 1;
      const roundNote = `[ROUND: ${nextRoundNum}]`;

      const couponNote = appliedCoupon ? `[COUPON: ${appliedCoupon.code} (${appliedCoupon.discount_pct}% OFF)]` : '';
      const paymentNote = `[PAYMENT: ${payment}] | [PAYMENT_STATUS: ${payment === 'upi' ? 'PAID' : 'PENDING'}]`;
      const combinedNotes = [`[TABLE: ${currentTable}]`, roundNote, paymentNote, couponNote, instruction].filter(Boolean).join(' | ');

      const zone = currentTable <= 9 ? 'indoor' : 'outdoor';

      const orderItems = cart.map(c => ({
        id: c.item.id,
        sku: c.item.sku || c.item.code || `SKU-${c.item.id}`,
        code: c.item.sku || c.item.code || `SKU-${c.item.id}`,
        name: c.item.isCombo ? `🍱 [COMBO] ${c.item.name} (${c.item.description})` : c.item.name,
        price: c.item.price,
        qty: c.quantity
      }));

      if (discountAmt > 0) {
        orderItems.push({
          id: 9998,
          name: `Discount (${appliedCoupon.code})`,
          price: -discountAmt,
          qty: 1
        });
      }

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

      // Save round data to local table session
      addOrderRoundToTableSession(
        currentTable,
        orderData.order_number,
        cart.map(c => ({ name: c.item.name, qty: c.quantity, price: c.item.price })),
        subtotal - discountAmt + gst,
        name
      );

      if (appliedCoupon) {
        try {
          await redeemCoupon(appliedCoupon.code, phone, orderData.id);
        } catch (err) {
          console.error('Failed to redeem coupon:', err);
        }
      }

      try {
        const { data: promoList } = await insforge.database
          .from('coupons')
          .select('*')
          .eq('active', true)
          .eq('is_auto_send', true)
          .limit(1);
          
        if (promoList && promoList.length > 0) {
          const promo = promoList[0];
          const expDate = new Date(promo.expiry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
          $('#success-promo-code').textContent = promo.code;
          $('#success-promo-pct').textContent = `${promo.discount_pct}%`;
          $('#success-promo-expiry').textContent = expDate;
          show($('#success-promo-box'));
        } else {
          hide($('#success-promo-box'));
        }
      } catch (err) {
        console.error('Failed to load auto-send promo coupon:', err);
        hide($('#success-promo-box'));
      }

      closeModal();
      cart = [];
      appliedCoupon = null;
      const input = $('#table-coupon-input');
      if (input) input.value = '';
      const feedback = $('#table-coupon-feedback');
      if (feedback) hide(feedback);
      
      updateCartState();
      
      $('#success-order-number').textContent = `#${orderData.order_number}`;
      $('#success-table-number').textContent = `Table ${currentTable}`;
      $('#success-diner-name').textContent = name;

      hide($('#customer-view'));
      show($('#success-view'));
      triggerGoogleReviewPrompt();
    } catch (err) {
      alert('Failed to place order: ' + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Confirm & Send to Kitchen';
    }
  }

  function triggerGoogleReviewPrompt() {
    if (sessionStorage.getItem('google_review_prompted') === 'true') return;
    
    setTimeout(() => {
      const modal = $('#google-review-modal');
      const submitBtn = $('#btn-submit-google-review');
      const closeBtn = $('#btn-close-google-review');
      
      if (!modal || !submitBtn || !closeBtn) return;
      
      submitBtn.href = GOOGLE_REVIEW_URL;
      
      const dismiss = () => {
        hide(modal);
        sessionStorage.setItem('google_review_prompted', 'true');
      };
      
      submitBtn.onclick = dismiss;
      closeBtn.onclick = dismiss;
      
      show(modal);
    }, 1000); // 1 Second delay
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

// ═══════════════════════════════════════
// PRODUCT DETAILS & RECOMMENDATIONS DRAWER
// ═══════════════════════════════════════

// Fetch dynamic recommendations for a menu item inside Dine-In
function getTableRecommendations(item) {
  if (!item) return [];

  const nameLower = (item.name || '').toLowerCase();
  const category = item.category || '';

  let recommendedCategories = [];
  
  // Rule 1: If they select Naan or Breads -> recommend Gravies/Curries
  if (category === 'bread' || nameLower.includes('naan') || nameLower.includes('roti') || nameLower.includes('kulcha')) {
    recommendedCategories = ['veg-curry', 'nonveg-curry'];
  }
  // Rule 2: If they select Biryani -> suggest Cold Drinks/Beverages
  else if (category === 'biryani' || nameLower.includes('biryani') || nameLower.includes('khuska')) {
    recommendedCategories = ['beverages', 'lassi', 'milkshakes', 'mocktails'];
  }
  // Rule 3: If they select Chicken/Mutton dishes -> suggest Roti or Rice
  else if (
    category === 'nonveg-curry' || 
    category === 'nonveg-starters' || 
    category === 'tandoor-kabab' || 
    category === 'chinese-nonveg' ||
    nameLower.includes('chicken') || 
    nameLower.includes('mutton') || 
    nameLower.includes('fish') || 
    nameLower.includes('prawns') || 
    nameLower.includes('tikka') || 
    nameLower.includes('kabab')
  ) {
    recommendedCategories = ['bread', 'veg-rice', 'nonveg-rice'];
  }
  // Fallback: suggest popular Desserts, Momos/Chaat or Mocktails
  else {
    recommendedCategories = ['desserts', 'momos-chaat', 'mocktails'];
  }

  // Filter recommendations matching the target categories (excluding the current item itself)
  let list = menuItems.filter(m => m.id !== item.id && recommendedCategories.includes(m.category) && m.available !== false);

  // Shuffle list and return up to 2 items for display
  return list.sort(() => 0.5 - Math.random()).slice(0, 2);
}

// Open Dine-In Product Detail Drawer
function openTableDetailDrawer(itemId) {
  const item = menuItems.find(m => m.id === itemId);
  if (!item) return;

  const overlay = $('#table-detail-overlay');
  const drawer = $('#table-detail-drawer');
  if (!overlay || !drawer) return;

  // Set standard info
  const skuEl = $('#table-drawer-sku');
  if (skuEl) skuEl.textContent = item.sku || item.code || `SKU-${item.id}`;
  $('#table-drawer-name').textContent = item.name;
  $('#table-drawer-category').textContent = categoryLabels[item.category] || item.category;
  $('#table-drawer-price').textContent = `₹${item.price}`;
  $('#table-drawer-desc').textContent = item.description || `Fresh and authentic ${item.name} prepared with traditional spices and methods at LIMRA Restaurant Egra.`;
  $('#table-drawer-image').src = item.image || '/images/food_biryani.png';

  // Render actions (+ / - / Add)
  updateTableDrawerActions(item);

  // Render recommendations pairing
  const recGrid = $('#table-drawer-recommendations-grid');
  const recSection = $('#table-drawer-recommendations-section');
  const recommendations = getTableRecommendations(item);

  if (recGrid && recSection) {
    if (recommendations.length > 0) {
      recGrid.innerHTML = '';
      recommendations.forEach(rec => {
        const recCard = document.createElement('div');
        recCard.className = 'flex items-center gap-3 p-3 bg-white/5 border border-white/5 rounded-2xl hover:border-amber-500/30 transition-colors cursor-pointer';
        
        const recImg = rec.image || '/images/food_biryani.png';
        const recEmoji = rec.emoji || '🍲';
        
        recCard.innerHTML = `
          <div class="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-white/5 bg-neutral-800 flex items-center justify-center relative">
            <img src="${recImg}" alt="${rec.name}" class="w-full h-full object-cover error-fallback" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
            <span class="text-xl absolute inset-0 flex items-center justify-center" style="display:none;">${recEmoji}</span>
          </div>
          <div class="flex-1 min-w-0 text-left">
            <h5 class="text-xs font-bold text-slate-100 truncate">${rec.name}</h5>
            <span class="text-[10px] font-black text-amber-400">₹${rec.price}</span>
          </div>
          <button class="rec-add-btn shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-amber-500 hover:bg-amber-600 active:scale-90 text-slate-950 font-bold text-sm shadow-md shadow-amber-500/10 transition-all">
            +
          </button>
        `;

        // Allow opening the recommendation item detail if clicked (excluding add button)
        recCard.addEventListener('click', (e) => {
          if (!e.target.closest('.rec-add-btn')) {
            openTableDetailDrawer(rec.id);
          }
        });

        // Bind add button click
        recCard.querySelector('.rec-add-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          addToCart(rec.id);
          
          // Re-render current drawer item's action (in case they added the same item that's currently in focus)
          updateTableDrawerActions(item);

          // Checked micro-interaction
          const btn = e.currentTarget;
          btn.textContent = '✓';
          btn.classList.replace('bg-amber-500', 'bg-slate-700');
          btn.classList.replace('text-slate-950', 'text-amber-500');
          setTimeout(() => {
            btn.textContent = '+';
            btn.classList.replace('bg-slate-700', 'bg-amber-500');
            btn.classList.replace('text-amber-500', 'text-slate-950');
          }, 1200);
        });

        recGrid.appendChild(recCard);
      });
      show(recSection);
    } else {
      hide(recSection);
    }
  }

  // Show drawer and overlay
  show(overlay);
  show(drawer);
  void drawer.offsetWidth; // trigger reflow
  overlay.classList.remove('opacity-0');
  drawer.classList.add('open');
}

// Render dynamic quantity controller for drawer
function updateTableDrawerActions(item) {
  const container = $('#table-drawer-actions-container');
  if (!container) return;

  const cartItem = cart.find(c => c.item.id === item.id);
  const qty = cartItem ? cartItem.quantity : 0;

  if (qty > 0) {
    container.innerHTML = `
      <button class="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-sm active:scale-95 transition-transform btn-drawer-minus">-</button>
      <span class="w-6 text-center font-bold text-slate-100 text-sm">${qty}</span>
      <button class="w-9 h-9 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 flex items-center justify-center font-bold text-sm active:scale-95 transition-transform btn-drawer-plus">+</button>
    `;

    container.querySelector('.btn-drawer-plus').addEventListener('click', () => {
      addToCart(item.id);
      updateTableDrawerActions(item);
    });

    container.querySelector('.btn-drawer-minus').addEventListener('click', () => {
      removeFromCart(item.id);
      updateTableDrawerActions(item);
    });
  } else {
    container.innerHTML = `
      <button class="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold text-xs transition-transform btn-drawer-add">
        Add to Order
      </button>
    `;

    container.querySelector('.btn-drawer-add').addEventListener('click', () => {
      addToCart(item.id);
      updateTableDrawerActions(item);
    });
  }
}

// Close Dine-In Product Detail Drawer
function closeTableDetailDrawer() {
  const overlay = $('#table-detail-overlay');
  const drawer = $('#table-detail-drawer');
  if (!overlay || !drawer) return;

  overlay.classList.add('opacity-0');
  drawer.classList.remove('open');

  setTimeout(() => {
    hide(overlay);
    hide(drawer);
  }, 350);
}

// Bind Drawer Event Listeners
function setupTableDetailDrawer() {
  const overlay = $('#table-detail-overlay');
  const closeBtn = $('#table-drawer-close');

  if (closeBtn) closeBtn.addEventListener('click', closeTableDetailDrawer);
  if (overlay) {
    overlay.addEventListener('click', closeTableDetailDrawer);
  }
  document.addEventListener('keydown', (e) => {
    const drawer = $('#table-detail-drawer');
    if (drawer && !drawer.classList.contains('hidden') && e.key === 'Escape') {
      closeTableDetailDrawer();
    }
  });
}

// Start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
