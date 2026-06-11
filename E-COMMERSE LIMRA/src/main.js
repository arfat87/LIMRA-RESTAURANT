import './style.css';
import { insforge, saveOrder, saveBooking, getCustomerBookings, getCustomerOrders } from './lib/insforge.js';
import { menuItems, categoryImages, categoryLabels, categoryEmojis, categoryTabOrder } from './data/menu.js';
import { sendEmailNotification, generateOrderPlacedHtml } from './lib/email-service.js';
import { NotificationService } from './lib/notifications.js';


// ═══════════════════════════════════════
// ANTIGRAVITY REACTIVE STORE SYSTEM
// ═══════════════════════════════════════
class AntigravityStore {
  constructor(initialState = {}, storageKey = null) {
    this._state = initialState;
    this._listeners = [];
    this._storageKey = storageKey;

    if (this._storageKey) {
      try {
        const persisted = localStorage.getItem(this._storageKey);
        if (persisted) {
          const parsed = JSON.parse(persisted);
          this._state = { ...this._state, ...parsed };
        }
      } catch (err) {
        console.warn('[Antigravity] Hydration failed:', err);
      }
    }
  }

  get state() {
    return this._state;
  }

  set state(newState) {
    this._state = newState;
    if (this._storageKey) {
      try {
        localStorage.setItem(this._storageKey, JSON.stringify(this._state));
      } catch (err) {
        console.warn('[Antigravity] LocalStorage mirror failed:', err);
      }
    }
    this._listeners.forEach(listener => listener(this._state));
  }

  subscribe(listener) {
    this._listeners.push(listener);
    return () => {
      this._listeners = this._listeners.filter(l => l !== listener);
    };
  }
}

// ═══════════════════════════════════════
// CART STATE & ANTIGRAVITY STORE SYNC
// ═══════════════════════════════════════
function loadCartFromStorage() {
  try {
    const raw = JSON.parse(localStorage.getItem('limra-cart') || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.map(item => ({
      id: Number(item.id),
      name: String(item.name || ''),
      price: Number(item.price) || 0,
      qty: Math.max(1, Number(item.qty) || 1),
    })).filter(item => item.id && item.name);
  } catch {
    return [];
  }
}

const antigravityCartStore = new AntigravityStore({
  items: loadCartFromStorage()
}, 'limra-cart-state');

let cart = antigravityCartStore.state.items;

antigravityCartStore.subscribe((state) => {
  cart = state.items;
  localStorage.setItem('limra-cart', JSON.stringify(cart));
});

let currentMenuCategory = 'all';

// Global Location Badge helper (defined at top level for scope availability)
function updateLocationBadge(verified) {
  const badge = document.getElementById('order-location-badge');
  if (!badge) return;
  if (verified) {
    badge.textContent = '🟢 Location Verified';
    badge.className = 'text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1';
  } else {
    badge.textContent = '🔴 Location Unverified';
    badge.className = 'text-[10px] font-bold text-red-500 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full flex items-center gap-1';
  }
}

// ═══════════════════════════════════════
// DELIVERY STATE
// ═══════════════════════════════════════
const DELIVERY_RATE = 10; // ₹ per km
let isDelivery = true;    // true = delivery, false = self pickup
let deliveryKm = 0;       // km entered by customer
let deliveryMap = null;
let deliveryMarker = null;
let selectedDeliveryArea = ""; // selected place name
const AREA_DELIVERY_CHARGES = {
  'jerthan': 20,
  'kudi': 40,
  'egra': 100,
  'qiya': 20,
  'alangiri': 40,
  'dobandhi': 50,
  'mohanpur': 80,
  'kasba gola': 80,
  'rajnagar': 100,
  'atla': 150,
  'boita': 50
};
let streetLayer = null;
let satelliteLayer = null;
let currentMapLayer = 'street';
let mapSelectedLat = null;
let mapSelectedLng = null;
let mapSelectedAddress = '';

function getDeliveryCharge() {
  if (!isDelivery) return 0;
  if (selectedDeliveryArea && selectedDeliveryArea !== 'custom') {
    return AREA_DELIVERY_CHARGES[selectedDeliveryArea] || 0;
  }
  const km = Math.max(0, parseFloat(deliveryKm) || 0);
  return Math.round(km * DELIVERY_RATE);
}

function getTaxesAmount() {
  return Math.round(getCartSubtotal() * 0.05); // 5% GST
}

function saveCart() {
  localStorage.setItem('limra-cart', JSON.stringify(cart));
}

function getCartSubtotal() {
  return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

function getCartTotal() {
  return getCartSubtotal() + getDeliveryCharge() + getTaxesAmount();
}

// Micro-interactions & spring animations
function animateBadgePop() {
  const badge = document.getElementById('cart-badge');
  if (!badge) return;
  badge.classList.remove('animate-badge-pop');
  void badge.offsetWidth; // trigger reflow
  badge.classList.add('animate-badge-pop');
}

function getCartCount() {
  return cart.reduce((sum, item) => sum + item.qty, 0);
}

function addToCart(id) {
  const item = menuItems.find(m => m.id === id);
  if (!item) return;
  
  const currentItems = [...antigravityCartStore.state.items];
  const existing = currentItems.find(c => c.id === id);
  if (existing) {
    existing.qty += 1;
  } else {
    currentItems.push({ id: item.id, name: item.name, price: item.price, qty: 1 });
  }
  antigravityCartStore.state = { items: currentItems };
  updateCartUI();
  animateBadgePop();

  // Trigger targeted menu card and button spring bounce micro-interaction
  const btn = document.querySelector(`.add-btn[data-id="${id}"]`);
  if (btn) {
    btn.classList.remove('animate-btn-spring');
    void btn.offsetWidth; // trigger reflow
    btn.classList.add('animate-btn-spring');
    btn.addEventListener('animationend', () => {
      btn.classList.remove('animate-btn-spring');
    }, { once: true });

    const card = btn.closest('.menu-card');
    if (card) {
      card.classList.remove('animate-card-spring');
      void card.offsetWidth; // trigger reflow
      card.classList.add('animate-card-spring');
      card.addEventListener('animationend', () => {
        card.classList.remove('animate-card-spring');
      }, { once: true });
    }
  }
}

function removeFromCart(id) {
  const currentItems = antigravityCartStore.state.items.filter(c => c.id !== id);
  antigravityCartStore.state = { items: currentItems };
  updateCartUI();
  animateBadgePop();
}

function updateQty(id, delta) {
  const currentItems = [...antigravityCartStore.state.items];
  const item = currentItems.find(c => c.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    removeFromCart(id);
    return;
  }
  antigravityCartStore.state = { items: currentItems };
  updateCartUI();
  animateBadgePop();
}

function clearCart() {
  antigravityCartStore.state = { items: [] };
  updateCartUI();
  animateBadgePop();
}

function updateCartUI() {
  const count = getCartCount();
  const subtotal = getCartSubtotal();
  const delivery = getDeliveryCharge();
  const taxes = getTaxesAmount();
  const total = subtotal + delivery + taxes;

  // Badges
  const badge = document.getElementById('cart-badge');
  if (badge) {
    badge.textContent = count;
    badge.classList.toggle('hidden', count === 0);
  }
  const viewBadge = document.getElementById('view-cart-badge');
  if (viewBadge) viewBadge.textContent = count;

  const viewCartBtn = document.getElementById('view-cart-btn');
  if (viewCartBtn) {
    viewCartBtn.classList.toggle('hidden', count === 0);
  }

  // Footer & Empty state
  const step1Footer = document.getElementById('checkout-step-1-footer');
  if (step1Footer) {
    step1Footer.classList.toggle('hidden', count === 0);
    const countText = document.getElementById('cart-count-text-1');
    if (countText) countText.textContent = count;
    const subtotalText = document.getElementById('cart-subtotal-1');
    if (subtotalText) subtotalText.textContent = subtotal;
  }
  
  const cartEmpty = document.getElementById('cart-empty');
  if (cartEmpty) {
    cartEmpty.classList.toggle('hidden', count > 0);
  }

  // Step 3 Breakdown
  const sub3 = document.getElementById('cart-subtotal-3');
  if (sub3) sub3.textContent = subtotal;
  const del3 = document.getElementById('cart-delivery-charge-3');
  if (del3) del3.textContent = delivery;
  const tax3 = document.getElementById('cart-taxes-3');
  if (tax3) tax3.textContent = taxes;
  const tot3 = document.getElementById('cart-total-3');
  if (tot3) tot3.textContent = total;
  
  const delRow3 = document.getElementById('delivery-charge-row-3');
  if (delRow3) {
    delRow3.style.display = isDelivery ? '' : 'none';
  }

  // Step 5 Confirmation Breakdown
  const confSub = document.getElementById('confirm-subtotal');
  if (confSub) confSub.textContent = subtotal;
  const confDel = document.getElementById('confirm-delivery-charge');
  if (confDel) confDel.textContent = delivery;
  const confTax = document.getElementById('confirm-taxes');
  if (confTax) confTax.textContent = taxes;
  const confTot = document.getElementById('confirm-total');
  if (confTot) confTot.textContent = total;
  
  const confDelRow = document.getElementById('confirm-delivery-charge-row');
  if (confDelRow) {
    confDelRow.style.display = isDelivery ? '' : 'none';
  }

  // Items list
  renderCartItems();

  // Update all add buttons on menu grid
  document.querySelectorAll('.add-btn').forEach(btn => {
    const id = parseInt(btn.dataset.id);
    const inCart = cart.find(c => c.id === id);
    if (inCart) {
      btn.textContent = `✓ In Cart (${inCart.qty})`;
      btn.classList.add('added');
    } else {
      btn.textContent = '+ Add to Cart';
      btn.classList.remove('added');
    }
  });
}

function renderCartItems() {
  const container = document.getElementById('cart-items');
  // Clear existing item rows
  const existingRows = container.querySelectorAll('.cart-row');
  existingRows.forEach(r => r.remove());

  cart.forEach(item => {
    const row = document.createElement('div');
    row.className = 'cart-row rounded-xl p-3 flex items-center gap-3';
    row.style.cssText = 'background:var(--color-off-white); border:1px solid var(--color-border)';
    row.innerHTML = `
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium truncate" style="color:var(--color-text-primary)">${item.name}</p>
        <p class="text-xs" style="color:var(--color-text-muted)">₹${item.price} each</p>
      </div>
      <div class="flex items-center gap-2">
        <button class="qty-btn" data-id="${item.id}" data-delta="-1">−</button>
        <span class="text-sm font-semibold w-5 text-center" style="color:var(--color-text-primary)">${item.qty}</span>
        <button class="qty-btn" data-id="${item.id}" data-delta="1">+</button>
      </div>
      <div class="text-right min-w-[3rem]">
        <p class="text-sm font-semibold" style="color:var(--color-accent)">₹${item.price * item.qty}</p>
        <button class="remove-btn text-xs transition-colors" style="color:var(--color-text-muted)" data-id="${item.id}">remove</button>
      </div>
    `;
    container.appendChild(row);
  });

  // Event listeners for qty buttons
  container.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      updateQty(parseInt(btn.dataset.id), parseInt(btn.dataset.delta));
    });
  });
  container.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      removeFromCart(parseInt(btn.dataset.id));
    });
  });
}

function animateBadge() {
  const badge = document.getElementById('cart-badge');
  badge.classList.remove('scale-125');
  void badge.offsetWidth;
  badge.classList.add('scale-125');
  setTimeout(() => badge.classList.remove('scale-125'), 200);
}

// Build WhatsApp order message
function buildOrderMessage() {
  if (cart.length === 0) return '';
  const address = document.getElementById('order-address')?.value?.trim() || '';
  const delivery = getDeliveryCharge();
  const subtotal = getCartSubtotal();

  let msg = '🍽️ *Order from LIMRA Restaurant*\n\n';
  cart.forEach(item => {
    msg += `• ${item.name} x${item.qty} = ₹${item.price * item.qty}\n`;
  });
  msg += `\n*Subtotal: ₹${subtotal}*`;
  if (isDelivery) {
    if (selectedDeliveryArea && selectedDeliveryArea !== 'custom') {
      const areaLabel = selectedDeliveryArea.charAt(0).toUpperCase() + selectedDeliveryArea.slice(1);
      msg += `\n🛵 *Delivery Charge: ₹${delivery}* (Area: ${areaLabel})`;
    } else {
      msg += `\n🛵 *Delivery Charge: ₹${delivery}*`;
    }
    msg += `\n*Grand Total: ₹${subtotal + delivery}*`;
    if (address) msg += `\n\n📍 *Deliver to:* ${address}`;
  } else {
    msg += `\n*Total: ₹${subtotal}* (Self Pickup — Free)`;
  }
  msg += '\n\nPlease confirm my order. Thank you! 🙏';
  return encodeURIComponent(msg);
}

// ═══════════════════════════════════════
// RENDER MENU CARDS
// ═══════════════════════════════════════
function createMenuCard(item) {
  const imgSrc = item.image || categoryImages[item.category] || '/images/food_biryani.png';
  const card = document.createElement('article');
  card.className = 'menu-card flex flex-col';
  card.dataset.category = item.category;
  card.setAttribute('role', 'listitem');

  const discountBadge = item.discount
    ? `<span class="discount-badge">${item.discount}% OFF</span>`
    : '';
  const mrpLine = item.mrp
    ? `<span style="color:var(--color-text-muted); font-size:.7rem; text-decoration:line-through; margin-left:.25rem">₹${item.mrp}</span>`
    : '';

  card.innerHTML = `
    <div class="relative overflow-hidden aspect-[4/3] bg-neutral-100 animate-pulse" style="border-radius:12px 12px 0 0">
      <img src="${imgSrc}" alt="${item.name} — LIMRA Restaurant Egra menu" class="card-img w-full h-full object-cover" loading="lazy" width="400" height="300" onload="this.parentElement.classList.remove('animate-pulse', 'bg-neutral-100')" />
      ${discountBadge}
    </div>
    <div class="flex flex-col gap-2 p-3 flex-1">
      <div class="flex items-start gap-2">
        <span class="text-lg leading-none mt-0.5">${item.emoji}</span>
        <h3 class="text-sm font-semibold leading-snug flex-1" style="color:var(--color-text-primary)">${item.name}</h3>
      </div>
      <div class="flex items-center justify-between mt-auto">
        <div class="flex items-baseline">
          <span class="font-bold text-base" style="color:var(--color-accent)">₹${item.price}</span>
          ${mrpLine}
        </div>
        <button class="add-btn" data-id="${item.id}">+ Add</button>
      </div>
    </div>
  `;

  card.querySelector('.add-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    addToCart(item.id);
  });

  return card;
}

function renderMenuGrid(containerId, category = 'all', searchQuery = '') {
  const grid = document.getElementById(containerId);
  if (!grid) return;

  grid.innerHTML = '';
  grid.classList.add('visible');
  grid.setAttribute('aria-busy', 'true');

  let filtered = category === 'all'
    ? menuItems
    : menuItems.filter(m => m.category === category);

  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(item => 
      (item.name || '').toLowerCase().includes(q) || 
      (item.category || '').toLowerCase().includes(q)
    );
  }

  // Sort menu items by price in descending order (High to Lower)
  filtered = [...filtered].sort((a, b) => {
    const parsePrice = (val) => {
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
        const clean = val.replace(/[₹\s,]/g, '');
        const num = parseInt(clean, 10);
        return isNaN(num) ? 0 : num;
      }
      return 0;
    };
    return parsePrice(b.price) - parsePrice(a.price);
  });

  if (filtered.length === 0) {
    grid.innerHTML = '<p class="col-span-full text-center py-12 text-sm" style="color:var(--color-text-muted)">No dishes in this category.</p>';
    grid.setAttribute('aria-busy', 'false');
    return;
  }

  filtered.forEach((item, index) => {
    const card = createMenuCard(item);
    card.classList.add('reveal');
    card.style.transitionDelay = `${Math.min(index * 35, 350)}ms`;
    grid.appendChild(card);
  });

  grid.setAttribute('aria-busy', 'false');
  observeRevealElements(grid);
  updateCartUI();
}

// ═══════════════════════════════════════
// MENU & ORDER FILTER TABS
// ═══════════════════════════════════════
function syncTabActiveState(activeCategory) {
  document.querySelectorAll('.tab-btn').forEach(t => {
    const isActive = t.dataset.category === activeCategory;
    t.classList.toggle('active', isActive);
    t.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function buildCategoryTabButtons() {
  const tabsHtml = [
    '<button type="button" class="tab-btn active" data-category="all">All</button>',
    ...categoryTabOrder.map(cat => {
      const emoji = categoryEmojis[cat] || '';
      const label = categoryLabels[cat] || cat;
      return `<button type="button" class="tab-btn" data-category="${cat}">${emoji} ${label}</button>`;
    }),
  ].join('');

  document.querySelectorAll('[data-tab-bar]').forEach(bar => {
    bar.innerHTML = tabsHtml;
  });
}

function initMenuTabs() {
  buildCategoryTabButtons();
  document.querySelectorAll('.tab-btn').forEach(tab => {
    tab.setAttribute('aria-pressed', tab.classList.contains('active') ? 'true' : 'false');
    tab.addEventListener('click', () => {
      const cat = tab.dataset.category;
      currentMenuCategory = cat;
      syncTabActiveState(cat);
      
      const foodSearchInput = document.getElementById('food-search-input');
      const query = foodSearchInput ? foodSearchInput.value : '';
      
      renderMenuGrid('menu-grid', cat, query);
      renderMenuGrid('order-grid', cat, query);
    });
  });
}

// ═══════════════════════════════════════
// CART DRAWER
// ═══════════════════════════════════════
function openCart() {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-overlay');
  drawer.classList.remove('closed');
  drawer.classList.add('open');
  overlay.classList.remove('hidden');
  setTimeout(() => overlay.classList.add('opacity-100'), 10);
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-overlay');
  drawer.classList.add('closed');
  drawer.classList.remove('open');
  overlay.classList.remove('opacity-100');
  setTimeout(() => overlay.classList.add('hidden'), 350);
  document.body.style.overflow = '';
}

// ═══════════════════════════════════════
// BOOKING TABS
// ═══════════════════════════════════════
function initBookingTabs() {
  const tabs = document.querySelectorAll('.booking-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => {
        t.classList.remove('active', 'bg-brand-gold', 'text-brand-dark');
        t.classList.add('text-brand-muted');
      });
      tab.classList.add('active', 'bg-brand-gold', 'text-brand-dark');
      tab.classList.remove('text-brand-muted');
      // Hide all panels
      document.querySelectorAll('.booking-panel').forEach(p => p.classList.add('hidden'));
      // Show selected
      document.getElementById(`tab-${tab.dataset.tab}`).classList.remove('hidden');
    });
  });
}

// ═══════════════════════════════════════
// BOOKING FORMS → DATABASE (admin dashboard)
// ═══════════════════════════════════════
const WA_NUMBER = '919739083418';

function submitToWhatsApp(message) {
  const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}

// ═══════════════════════════════════════
// SUCCESS CONFIRMATION MODAL LOGIC
// ═══════════════════════════════════════
function showSuccessModal({ title, message, waUrl, emailUrl }) {
  const modal = document.getElementById('success-notification-modal');
  const content = document.getElementById('success-modal-content');
  const titleEl = document.getElementById('success-modal-title');
  const msgEl = document.getElementById('success-modal-msg');
  const waBtn = document.getElementById('success-modal-wa-btn');
  const emailBtn = document.getElementById('success-modal-email-btn');
  const closeBtn = document.getElementById('success-modal-close-btn');

  if (!modal || !content) return;

  titleEl.textContent = title;
  msgEl.textContent = message;

  // Clone buttons to clear old event listeners
  const newWaBtn = waBtn.cloneNode(true);
  const newEmailBtn = emailBtn.cloneNode(true);
  const newCloseBtn = closeBtn.cloneNode(true);

  waBtn.parentNode.replaceChild(newWaBtn, waBtn);
  emailBtn.parentNode.replaceChild(newEmailBtn, emailBtn);
  closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);

  newWaBtn.addEventListener('click', () => {
    window.open(waUrl, '_blank');
  });

  newEmailBtn.addEventListener('click', () => {
    window.open(emailUrl, '_blank');
  });

  const closeModal = () => {
    modal.classList.add('opacity-0', 'pointer-events-none');
    content.classList.remove('scale-100');
    content.classList.add('scale-95');
  };

  newCloseBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Show modal
  modal.classList.remove('opacity-0', 'pointer-events-none');
  content.classList.remove('scale-95');
  content.classList.add('scale-100');
}

function buildBookingPayload(type, data, extra = {}) {
  const email = data.email?.trim() || '';
  const emailNote = email ? `[EMAIL: ${email}]` : '';
  const bookingNotes = [data.notes || '', emailNote].filter(Boolean).join(' | ');
  
  return {
    type,
    customer_name: String(data.name || '').trim(),
    customer_phone: String(data.phone || '').trim(),
    booking_date: data.date || null,
    booking_time: data.time || null,
    guests: data.guests ? parseInt(data.guests, 10) : null,
    preference: data.preference || null,
    seat_label: extra.seat || null,
    event_type: data.event || null,
    budget: data.budget || null,
    catering: data.catering || null,
    venue: data.venue || null,
    message: data.message || null,
    notes: bookingNotes || null,
    status: 'pending',
  };
}

function setBookingStatus(form, message, isError = false) {
  const el = form.querySelector('.booking-status-msg');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
  el.style.color = isError ? 'var(--color-red-badge)' : 'var(--color-accent)';
  el.style.background = isError ? '#fdecea' : 'var(--color-accent-bg)';
}

function clearBookingStatus(form) {
  const el = form.querySelector('.booking-status-msg');
  if (el) el.classList.add('hidden');
}

async function handleBookingSubmit(form, type, getExtra = () => ({})) {
  clearBookingStatus(form);

  const data = Object.fromEntries(new FormData(form));
  if (!data.name?.trim() || !data.phone?.trim()) {
    setBookingStatus(form, 'Please enter your name and phone number.', true);
    return;
  }
  
  const email = data.email?.trim() || '';
  if (email && !email.includes('@')) {
    setBookingStatus(form, 'Please enter a valid email address.', true);
    return;
  }

  const btn = form.querySelector('.booking-submit-btn') || form.querySelector('button[type="submit"]');
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  try {
    const result = await saveBooking(buildBookingPayload(type, data, getExtra()));
    const ref = result?.booking_number ? `Booking #${result.booking_number}` : 'Booking';
    setBookingStatus(form, `✓ ${ref} received! We will confirm by phone soon.`);

    const extra = getExtra();
    const guests = data.guests || '';
    const date = data.date || '';
    const time = data.time || '';

    // WA Confirmation Link
    const waMsg = `Hello! My booking enquiry is placed successfully at SK Arif (Limra Restaurant).\n\n*Booking Details:*\n• Name: ${data.name}\n• Phone: ${data.phone}\n• Email: ${email}\n• Type: ${BOOKING_TYPE_LABELS[type] || type}\n• Date: ${date || '—'}\n• Time: ${time || '—'}\n• Guests: ${guests || '—'}${extra.seat ? `\n• Selected Table: ${extra.seat}` : ''}\n\nMy reservation is booked. Please confirm my booking and contact me as soon as possible! Thank you! 🙏`;
    const waUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(waMsg)}`;

    // Email (mailto) Link
    const emailSubject = `Booking Confirmed successfully! - SK Arif (${ref})`;
    const emailBody = `Dear Restaurant Management,\n\nI have successfully submitted a booking enquiry on your website.\n\nBooking Details:\n---------------------------------------------\nReference: ${ref}\nName: ${data.name}\nPhone: ${data.phone}\nEmail: ${email}\nType: ${BOOKING_TYPE_LABELS[type] || type}\nDate: ${date || '—'}\nTime: ${time || '—'}\nGuests: ${guests || '—'}${extra.seat ? `\nSelected Table: ${extra.seat}` : ''}\n---------------------------------------------\n\nMy reservation is booked. Please contact me as soon as possible to confirm.\n\nBest regards,\n${data.name}`;
    const emailUrl = `mailto:limrarestaurant99@gmail.com?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

    // Show Success Modal
    showSuccessModal({
      title: `${ref} Booked Successfully!`,
      message: `Your booking has been successfully recorded. Please click below to send yourself confirmation on WhatsApp or Email!`,
      waUrl,
      emailUrl
    });

    form.reset();
    if (type === 'table') {
      document.getElementById('seat-selected-msg')?.classList.add('hidden');
      const label = document.getElementById('seat-selected-label');
      if (label) label.textContent = '';
    }

    setTimeout(() => clearBookingStatus(form), 8000);
  } catch (err) {
    console.error('Booking error:', err);
    const detail = err?.message || 'Please try again or call 097390 83418.';
    setBookingStatus(form, `Booking failed: ${detail}`, true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

const BOOKING_TYPE_LABELS = {
  table: '🪑 Table',
  party: '🎉 Party',
  wedding: '💍 Wedding',
};

const BOOKING_STATUS_LABELS = {
  pending: 'Pending confirmation',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function initCustomerBookingLookup() {
  const form = document.getElementById('check-booking-form');
  const resultEl = document.getElementById('customer-bookings-result');
  if (!form || !resultEl) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = new FormData(form).get('phone')?.toString().trim();
    if (!phone) return;

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Searching...';
    resultEl.classList.remove('hidden');
    resultEl.innerHTML = '<p class="text-sm" style="color:var(--color-text-muted)">Loading...</p>';

    try {
      const list = await getCustomerBookings(phone);
      if (!list.length) {
        resultEl.innerHTML = '<p class="text-sm p-3 rounded-xl" style="background:var(--color-surface); color:var(--color-text-muted)">No bookings found for this number. Submit a new booking above.</p>';
        return;
      }

      resultEl.innerHTML = list.map(b => `
        <div class="p-4 rounded-xl border" style="background:var(--color-white); border-color:var(--color-border)">
          <div class="flex flex-wrap justify-between gap-2 mb-2">
            <span class="font-semibold text-sm">Booking #${b.booking_number}</span>
            <span class="text-xs font-bold px-2 py-1 rounded-full" style="background:var(--color-accent-bg); color:var(--color-accent)">${BOOKING_STATUS_LABELS[b.status] || b.status}</span>
          </div>
          <p class="text-sm" style="color:var(--color-text-secondary)">${BOOKING_TYPE_LABELS[b.type] || b.type} · ${b.customer_name}</p>
          <p class="text-xs mt-1" style="color:var(--color-text-muted)">
            ${b.booking_date ? `Date: ${b.booking_date}` : ''}${b.booking_time ? ` · ${b.booking_time}` : ''}${b.guests ? ` · ${b.guests} guests` : ''}${b.seat_label ? ` · Seat ${b.seat_label}` : ''}
          </p>
        </div>
      `).join('');
    } catch (err) {
      console.error(err);
      resultEl.innerHTML = `<p class="text-sm" style="color:var(--color-red-badge)">${err.message || 'Could not load bookings.'}</p>`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Check bookings';
    }
  });
}

function initBookingForms() {
  const tableForm = document.getElementById('table-booking-form');
  tableForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const seat = document.getElementById('seat-selected-label')?.textContent || '';
    handleBookingSubmit(tableForm, 'table', () => ({
      seat: seat && seat !== 'Not selected' ? seat : null,
    }));
  });

  const partyForm = document.getElementById('party-booking-form');
  partyForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleBookingSubmit(partyForm, 'party');
  });

  const weddingForm = document.getElementById('wedding-booking-form');
  weddingForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleBookingSubmit(weddingForm, 'wedding');
  });
}

// ═══════════════════════════════════════
// TABLE SEAT SELECTION
// ═══════════════════════════════════════
function initSeatSelection() {
  const seats = document.querySelectorAll('.seat');
  let selectedSeat = null;

  seats.forEach(seat => {
    seat.addEventListener('click', () => {
      if (selectedSeat) {
        selectedSeat.classList.remove('ring-2', 'ring-brand-gold', 'scale-110', 'brightness-125');
      }
      if (selectedSeat === seat) {
        selectedSeat = null;
        document.getElementById('seat-selected-msg').classList.add('hidden');
        return;
      }
      selectedSeat = seat;
      seat.classList.add('ring-2', 'ring-brand-gold', 'scale-110');

      const label = seat.dataset.seat;
      const type = label.startsWith('O') ? 'Outdoor' : 'Indoor';
      document.getElementById('seat-selected-label').textContent = `Table ${label} (${type})`;
      document.getElementById('seat-selected-msg').classList.remove('hidden');

      // Update form preference
      const prefSelect = document.querySelector('#table-booking-form select[name="preference"]');
      if (prefSelect) {
        prefSelect.value = type === 'Outdoor' ? 'Outdoor' : 'Indoor';
      }
    });
  });
}

// ═══════════════════════════════════════
// GALLERY FILTER + LIGHTBOX
// ═══════════════════════════════════════
function initGallery() {
  const filters = document.querySelectorAll('.gal-filter');
  const items = document.querySelectorAll('.gallery-item');

  filters.forEach(filter => {
    filter.addEventListener('click', () => {
      filters.forEach(f => f.classList.remove('active'));
      filter.classList.add('active');

      const cat = filter.dataset.filter;
      items.forEach(item => {
        if (cat === 'all' || item.dataset.category === cat) {
          item.style.display = '';
          setTimeout(() => item.style.opacity = '1', 10);
        } else {
          item.style.opacity = '0';
          setTimeout(() => item.style.display = 'none', 300);
        }
      });
    });
  });

  // Lightbox
  const lightbox = document.getElementById('lightbox');
  const lbImg = document.getElementById('lb-img');
  const lbLabel = document.getElementById('lb-label');
  let galleryItems = Array.from(items);
  let currentIdx = 0;

  function openLightbox(idx) {
    currentIdx = idx;
    const item = galleryItems[idx];
    lbImg.src = item.dataset.src;
    lbLabel.textContent = item.dataset.label;
    lightbox.classList.remove('hidden');
    setTimeout(() => lightbox.classList.add('opacity-100'), 10);
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.remove('opacity-100');
    setTimeout(() => lightbox.classList.add('hidden'), 300);
    document.body.style.overflow = '';
  }

  function showPrev() {
    const visibleItems = galleryItems.filter(i => i.style.display !== 'none');
    const visIdx = visibleItems.indexOf(galleryItems[currentIdx]);
    const prev = visibleItems[(visIdx - 1 + visibleItems.length) % visibleItems.length];
    currentIdx = galleryItems.indexOf(prev);
    lbImg.src = prev.dataset.src;
    lbLabel.textContent = prev.dataset.label;
  }

  function showNext() {
    const visibleItems = galleryItems.filter(i => i.style.display !== 'none');
    const visIdx = visibleItems.indexOf(galleryItems[currentIdx]);
    const next = visibleItems[(visIdx + 1) % visibleItems.length];
    currentIdx = galleryItems.indexOf(next);
    lbImg.src = next.dataset.src;
    lbLabel.textContent = next.dataset.label;
  }

  items.forEach((item, idx) => {
    item.addEventListener('click', () => openLightbox(idx));
  });

  document.getElementById('lb-close').addEventListener('click', closeLightbox);
  document.getElementById('lb-prev').addEventListener('click', showPrev);
  document.getElementById('lb-next').addEventListener('click', showNext);
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });

  document.addEventListener('keydown', (e) => {
    if (lightbox.classList.contains('hidden')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') showPrev();
    if (e.key === 'ArrowRight') showNext();
  });
}

// ═══════════════════════════════════════
// SCROLL ANIMATIONS
// ═══════════════════════════════════════
let revealObserver = null;

function initScrollAnimations() {
  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

  observeRevealElements(document);
}

function observeRevealElements(root) {
  if (!revealObserver || !root) return;
  root.querySelectorAll('.reveal, .reveal-l, .reveal-r').forEach(el => {
    if (el.classList.contains('menu-product-grid')) return;
    if (el.dataset.revealObserved) return;
    el.dataset.revealObserved = '1';
    if (isElementInViewport(el)) {
      el.classList.add('visible');
      return;
    }
    revealObserver.observe(el);
  });
}

function isElementInViewport(el) {
  const rect = el.getBoundingClientRect();
  return rect.top < window.innerHeight && rect.bottom > 0;
}

// ═══════════════════════════════════════
// STICKY HEADER
// ═══════════════════════════════════════
function initHeader() {
  const header = document.getElementById('site-header');
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = ['home', 'about', 'menu', 'order', 'booking', 'gallery', 'visit'];

  window.addEventListener('scroll', () => {
    // Scroll effect
    if (window.scrollY > 50) {
      header.classList.add('header-scrolled');
    } else {
      header.classList.remove('header-scrolled');
    }

    // Active nav
    let current = 'home';
    sections.forEach(id => {
      const section = document.getElementById(id);
      if (section && window.scrollY >= section.offsetTop - 120) {
        current = id;
      }
    });
    navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${current}`) {
        link.classList.add('active');
      }
    });

    // Back to top
    const btt = document.getElementById('back-to-top');
    if (window.scrollY > 400) {
      btt.classList.remove('opacity-0', 'pointer-events-none');
      btt.classList.add('opacity-100');
    } else {
      btt.classList.add('opacity-0', 'pointer-events-none');
      btt.classList.remove('opacity-100');
    }
  });
}

// ═══════════════════════════════════════
// MOBILE NAV
// ═══════════════════════════════════════
function initMobileNav() {
  const btn = document.getElementById('hamburger-btn');
  const nav = document.getElementById('mobile-nav');
  let open = false;

  btn.addEventListener('click', () => {
    open = !open;
    nav.classList.toggle('hidden', !open);
    const b1 = document.getElementById('hb1');
    const b2 = document.getElementById('hb2');
    const b3 = document.getElementById('hb3');
    if (open) {
      b1.style.transform = 'rotate(45deg) translate(4px, 5px)';
      b2.style.opacity = '0';
      b3.style.transform = 'rotate(-45deg) translate(4px, -5px)';
    } else {
      b1.style.transform = ''; b2.style.opacity = '1'; b3.style.transform = '';
    }
  });

  document.querySelectorAll('.mobile-nav-link').forEach(link => {
    link.addEventListener('click', () => {
      open = false;
      nav.classList.add('hidden');
      const b1 = document.getElementById('hb1');
      const b2 = document.getElementById('hb2');
      const b3 = document.getElementById('hb3');
      b1.style.transform = ''; b2.style.opacity = '1'; b3.style.transform = '';
    });
  });
}

// ═══════════════════════════════════════
// SMOOTH SCROLL FOR ANCHOR LINKS
// ═══════════════════════════════════════
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

// ═══════════════════════════════════════
// BACK TO TOP
// ═══════════════════════════════════════
function initBackToTop() {
  document.getElementById('back-to-top').addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ═══════════════════════════════════════
// INIT
// ═══════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  initScrollAnimations();

  renderMenuGrid('menu-grid', 'all');
  renderMenuGrid('order-grid', 'all');

  // Food Search
  const foodSearchInput = document.getElementById('food-search-input');
  const clearFoodSearchBtn = document.getElementById('btn-clear-food-search');
  if (foodSearchInput) {
    foodSearchInput.addEventListener('input', () => {
      const query = foodSearchInput.value;
      if (clearFoodSearchBtn) {
        if (query) clearFoodSearchBtn.classList.remove('hidden');
        else clearFoodSearchBtn.classList.add('hidden');
      }
      renderMenuGrid('menu-grid', currentMenuCategory, query);
      renderMenuGrid('order-grid', currentMenuCategory, query);
    });
  }
  if (clearFoodSearchBtn && foodSearchInput) {
    clearFoodSearchBtn.addEventListener('click', () => {
      foodSearchInput.value = '';
      clearFoodSearchBtn.classList.add('hidden');
      renderMenuGrid('menu-grid', currentMenuCategory, '');
      renderMenuGrid('order-grid', currentMenuCategory, '');
    });
  }

  updateCartUI();

  // Cart drawer
  document.getElementById('cart-toggle-btn').addEventListener('click', openCart);
  document.getElementById('cart-close-btn').addEventListener('click', closeCart);
  document.getElementById('cart-overlay').addEventListener('click', closeCart);
  document.getElementById('cart-clear-btn').addEventListener('click', clearCart);
  document.getElementById('view-cart-btn').addEventListener('click', openCart);
  document.getElementById('cart-browse-btn')?.addEventListener('click', closeCart);

  // ── Leaflet Delivery Map & Distance Logic (Modal-based) ────────────────
  function haversineDistance(lat1, lon1, lat2, lon2) {
    const toRad = x => (x * Math.PI) / 180;
    const R = 6371; // km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function openMapModal() {
    const modal = document.getElementById('delivery-map-modal');
    const content = document.getElementById('delivery-map-modal-content');
    if (!modal || !content) return;
    modal.classList.remove('opacity-0', 'pointer-events-none');
    content.classList.remove('scale-95');
    content.classList.add('scale-100');
    initDeliveryMap();
  }

  function closeMapModal() {
    const modal = document.getElementById('delivery-map-modal');
    const content = document.getElementById('delivery-map-modal-content');
    if (!modal || !content) return;
    modal.classList.add('opacity-0', 'pointer-events-none');
    content.classList.remove('scale-100');
    content.classList.add('scale-95');
  }

  function initDeliveryMap() {
    if (!isDelivery) return;
    const mapContainer = document.getElementById('delivery-map');
    if (!mapContainer) return;

    if (typeof L === 'undefined') {
      setTimeout(initDeliveryMap, 300);
      return;
    }

    const limraCoords = [21.8603074, 87.4793798];

    if (!deliveryMap) {
      deliveryMap = L.map('delivery-map').setView(limraCoords, 14);
      
      streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      }).addTo(deliveryMap);

      satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
      });

      const restaurantIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });

      L.marker(limraCoords, { icon: restaurantIcon }).addTo(deliveryMap)
        .bindPopup('<b>LIMRA Restaurant</b><br>Egra, Purba Medinipur')
        .openPopup();

      deliveryMap.on('click', async (e) => {
        await updatePinnedLocation(e.latlng);
      });

      // UI Overlays - Layer Switcher
      const layerBtn = document.getElementById('map-layer-toggle-btn');
      if (layerBtn) {
        layerBtn.addEventListener('click', () => {
          if (currentMapLayer === 'street') {
            deliveryMap.removeLayer(streetLayer);
            satelliteLayer.addTo(deliveryMap);
            currentMapLayer = 'satellite';
            layerBtn.innerHTML = '🗺️';
          } else {
            deliveryMap.removeLayer(satelliteLayer);
            streetLayer.addTo(deliveryMap);
            currentMapLayer = 'street';
            layerBtn.innerHTML = '🛰️';
          }
        });
      }

      // UI Overlays - Locate Self
      const locateSelfBtn = document.getElementById('map-locate-self-btn');
      if (locateSelfBtn) {
        locateSelfBtn.addEventListener('click', () => {
          const statusEl = document.getElementById('distance-calc-status');
          if (statusEl) {
            statusEl.innerHTML = `⌛ Detecting your current GPS location...`;
            statusEl.style.color = '#e2b13c';
          }

          if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser.');
            if (statusEl) statusEl.innerHTML = `❌ Geolocation not supported`;
            return;
          }

          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const latlng = { lat: position.coords.latitude, lng: position.coords.longitude };
              deliveryMap.setView(latlng, 16);
              await updatePinnedLocation(latlng);
            },
            (error) => {
              console.warn('GPS detection failed:', error);
              alert('Could not detect your current location. Please check your browser permissions or manually tap the map to pin.');
              if (statusEl) {
                statusEl.innerHTML = `❌ Detection failed`;
                statusEl.style.color = '#ef4444';
              }
            },
            { enableHighAccuracy: true, timeout: 8000 }
          );
        });
      }

      // Search Autocomplete
      const searchInput = document.getElementById('map-search-input');
      const suggestionsBox = document.getElementById('map-search-suggestions');
      const clearSearchBtn = document.getElementById('map-clear-search-btn');

      if (searchInput && suggestionsBox) {
        searchInput.addEventListener('input', () => {
          const val = searchInput.value.trim();
          if (clearSearchBtn) {
            if (val) clearSearchBtn.classList.remove('hidden');
            else clearSearchBtn.classList.add('hidden');
          }

          if (searchTimeout) clearTimeout(searchTimeout);
          if (!val) {
            suggestionsBox.innerHTML = '';
            suggestionsBox.classList.add('hidden');
            return;
          }

          searchTimeout = setTimeout(async () => {
            try {
              // Focus query around Egra area by adding context to search if local
              const query = val.toLowerCase().includes('egra') ? val : `${val}, Egra, Purba Medinipur`;
              const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`);
              const data = await res.json();
              
              if (data && data.length > 0) {
                suggestionsBox.innerHTML = data.map(item => `
                  <div class="px-3 py-2 text-xs hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 suggestion-item" 
                       data-lat="${item.lat}" data-lng="${item.lon}" data-name="${escapeHtml(item.display_name)}">
                    📍 ${escapeHtml(item.display_name)}
                  </div>
                `).join('');
                
                suggestionsBox.classList.remove('hidden');

                // Attach click listeners
                suggestionsBox.querySelectorAll('.suggestion-item').forEach(el => {
                  el.addEventListener('click', async () => {
                    const lat = parseFloat(el.getAttribute('data-lat'));
                    const lng = parseFloat(el.getAttribute('data-lng'));
                    const name = el.getAttribute('data-name');
                    
                    searchInput.value = name;
                    suggestionsBox.classList.add('hidden');
                    
                    const latlng = { lat, lng };
                    deliveryMap.setView(latlng, 16);
                    await updatePinnedLocation(latlng);
                  });
                });
              } else {
                suggestionsBox.innerHTML = `<div class="px-3 py-2.5 text-xs text-slate-400 italic text-center">No locations found. Try manual pinning.</div>`;
                suggestionsBox.classList.remove('hidden');
              }
            } catch (err) {
              console.warn('Search geocode autocomplete failed:', err);
            }
          }, 300);
        });

        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
          if (!e.target.closest('#map-search-input') && !e.target.closest('#map-search-suggestions')) {
            suggestionsBox.classList.add('hidden');
          }
        });
      }

      if (clearSearchBtn && searchInput) {
        clearSearchBtn.addEventListener('click', () => {
          searchInput.value = '';
          clearSearchBtn.classList.add('hidden');
          suggestionsBox.innerHTML = '';
          suggestionsBox.classList.add('hidden');
        });
      }
    }

    // Prefill modal inputs if already confirmed
    const existingLat = parseFloat(document.getElementById('order-latitude')?.value);
    const existingLng = parseFloat(document.getElementById('order-longitude')?.value);
    const existingLandmark = document.getElementById('order-landmark')?.value;
    const existingNotes = document.getElementById('order-delivery-notes')?.value;

    if (existingLandmark) {
      document.getElementById('map-selected-landmark').value = existingLandmark;
    }
    if (existingNotes) {
      document.getElementById('map-selected-notes').value = existingNotes;
    }

    setTimeout(() => {
      if (deliveryMap) {
        deliveryMap.invalidateSize();
        if (existingLat && existingLng) {
          const latlng = { lat: existingLat, lng: existingLng };
          deliveryMap.setView(latlng, 16);
          updatePinnedLocation(latlng);
        } else {
          deliveryMap.setView(limraCoords, 14);
        }
      }
    }, 150);
  }

  async function updatePinnedLocation(latlng) {
    const limraCoords = [21.8603074, 87.4793798];
    const clientIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    if (!deliveryMarker) {
      deliveryMarker = L.marker(latlng, { icon: clientIcon, draggable: true }).addTo(deliveryMap);
      deliveryMarker.on('dragend', async () => {
        await updatePinnedLocation(deliveryMarker.getLatLng());
      });
    } else {
      deliveryMarker.setLatLng(latlng);
    }

    // Save selected coords in temporary state
    mapSelectedLat = latlng.lat;
    mapSelectedLng = latlng.lng;

    document.getElementById('map-selected-lat').textContent = latlng.lat.toFixed(6);
    document.getElementById('map-selected-lng').textContent = latlng.lng.toFixed(6);

    const dist = haversineDistance(limraCoords[0], limraCoords[1], latlng.lat, latlng.lng);
    deliveryKm = Math.min(50, Math.max(0.1, dist));

    const distInput = document.getElementById('order-distance');
    if (distInput) {
      distInput.value = deliveryKm.toFixed(1);
    }

    const statusEl = document.getElementById('distance-calc-status');
    if (statusEl) {
      statusEl.innerHTML = `⌛ Reverse geocoding location details...`;
      statusEl.style.color = '#e2b13c';
    }

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}`);
      const data = await res.json();
      if (data && data.display_name) {
        mapSelectedAddress = data.display_name;
        document.getElementById('map-selected-address').textContent = data.display_name;

        // Parse address subcomponents
        const addr = data.address || {};
        const area = addr.suburb || addr.neighbourhood || addr.village || addr.road || '—';
        const city = addr.city || addr.town || addr.village || addr.county || '—';
        const state = addr.state || '—';
        const zip = addr.postcode || '—';

        document.getElementById('map-selected-area').textContent = area;
        document.getElementById('map-selected-city').textContent = city;
        document.getElementById('map-selected-state').textContent = state;
        document.getElementById('map-selected-zip').textContent = zip;

        if (statusEl) {
          statusEl.innerHTML = `🟢 Location pinned successfully (Distance: ${deliveryKm.toFixed(1)} km)`;
          statusEl.style.color = '#10b981';
        }
      }
    } catch (e) {
      console.warn('Reverse geocode failed:', e);
      if (statusEl) {
        statusEl.innerHTML = `⚠️ Geocoding failed, coordinates saved.`;
        statusEl.style.color = '#f59e0b';
      }
    }
  }

  async function locateAddress() {
    const addressVal = document.getElementById('order-address')?.value?.trim();
    openMapModal();
    if (!addressVal) return;

    // Prefill the search box inside the map and trigger search
    setTimeout(() => {
      const searchInput = document.getElementById('map-search-input');
      if (searchInput) {
        searchInput.value = addressVal;
        searchInput.dispatchEvent(new Event('input'));
      }
    }, 300);
  }

  // ── Delivery type toggle ────────────────
  function initDelivery() {
    const btnDeliver = document.getElementById('delivery-type-deliver');
    const btnPickup  = document.getElementById('delivery-type-pickup');
    const addrBlock  = document.getElementById('delivery-address-block');
    const openMapBtn = document.getElementById('open-map-btn');
    const closeMapBtn = document.getElementById('close-map-modal-btn');
    const confirmMapBtn = document.getElementById('confirm-map-location-btn');
    const mapModal = document.getElementById('delivery-map-modal');

    if (!btnDeliver || !btnPickup) return;

    btnDeliver.addEventListener('click', () => setDeliveryMode(true));
    btnPickup.addEventListener('click',  () => setDeliveryMode(false));

    if (openMapBtn) openMapBtn.addEventListener('click', openMapModal);
    if (closeMapBtn) closeMapBtn.addEventListener('click', closeMapModal);
    
    if (confirmMapBtn) {
      confirmMapBtn.addEventListener('click', () => {
        if (!mapSelectedLat || !mapSelectedLng) {
          alert('Please pin a location on the map first.');
          return;
        }

        // Write values to checkout inputs
        const addressInput = document.getElementById('order-address');
        if (addressInput && mapSelectedAddress) {
          addressInput.value = mapSelectedAddress;
          geocodeResolvedAddress = mapSelectedAddress;
        }

        const latInput = document.getElementById('order-latitude');
        if (latInput) latInput.value = mapSelectedLat;

        const lngInput = document.getElementById('order-longitude');
        if (lngInput) lngInput.value = mapSelectedLng;

        const landmarkInput = document.getElementById('order-landmark');
        const modalLandmark = document.getElementById('map-selected-landmark');
        if (landmarkInput && modalLandmark) {
          landmarkInput.value = modalLandmark.value.trim();
        }

        const notesInput = document.getElementById('order-delivery-notes');
        const modalNotes = document.getElementById('map-selected-notes');
        if (notesInput && modalNotes) {
          notesInput.value = modalNotes.value.trim();
        }

        const verifiedInput = document.getElementById('order-location-verified');
        if (verifiedInput) {
          verifiedInput.value = 'true';
        }

        updateLocationBadge(true);
        updateCartUI();
        closeMapModal();
      });
    }

    if (mapModal) {
      mapModal.addEventListener('click', (e) => {
        if (e.target === mapModal) closeMapModal();
      });
    }

    const locateBtn = document.getElementById('locate-address-btn');
    if (locateBtn) {
      locateBtn.addEventListener('click', locateAddress);
    }

    const areaSelect = document.getElementById('order-delivery-area');
    if (areaSelect) {
      areaSelect.addEventListener('change', () => {
        selectedDeliveryArea = areaSelect.value;
        const addressInput = document.getElementById('order-address');
        
        if (selectedDeliveryArea && selectedDeliveryArea !== 'custom') {
          // If a specific area is chosen, auto-verify the location and prefill address
          updateLocationBadge(true);
          
          const areaLabel = areaSelect.options[areaSelect.selectedIndex].text.split(' (')[0];
          
          // Prefill or append the area to the address if not already mentioned
          if (addressInput) {
            const currentAddr = addressInput.value.trim();
            if (!currentAddr) {
              addressInput.value = areaLabel;
            } else if (!currentAddr.toLowerCase().includes(areaLabel.toLowerCase())) {
              addressInput.value = `${currentAddr}, ${areaLabel}`;
            }
          }
        } else {
          // If custom or empty is chosen
          updateLocationBadge(false);
        }
        updateCartUI();
      });
    }
  }

  function setDeliveryMode(delivery) {
    const btnDeliver = document.getElementById('delivery-type-deliver');
    const btnPickup  = document.getElementById('delivery-type-pickup');
    const addrBlock  = document.getElementById('delivery-address-block');
    
    isDelivery = delivery;
    if (delivery) {
      if (btnDeliver) btnDeliver.style.cssText = 'border-color:var(--color-accent); background:var(--color-accent); color:#fff';
      if (btnPickup) btnPickup.style.cssText  = 'border-color:var(--color-border); color:var(--color-text-muted); background:transparent';
      if (addrBlock) addrBlock.style.display  = '';
    } else {
      if (btnDeliver) btnDeliver.style.cssText = 'border-color:var(--color-border); color:var(--color-text-muted); background:transparent';
      if (btnPickup) btnPickup.style.cssText  = 'border-color:var(--color-accent); background:var(--color-accent); color:#fff';
      if (addrBlock) addrBlock.style.display  = 'none';
      deliveryKm = 0;
      const distInput = document.getElementById('order-distance');
      if (distInput) distInput.value = "0";
    }
    updateCartUI();
  }

  // ── Stepper Logic & Navigation ────────────────
  let currentStep = 1;
  let geocodeResolvedAddress = "";

  function showStep(stepNum) {
    currentStep = stepNum;
    for (let i = 1; i <= 5; i++) {
      const el = document.getElementById(`checkout-step-${i}`);
      if (el) {
        if (i === stepNum) el.classList.remove('hidden');
        else el.classList.add('hidden');
      }
      
      const lbl = document.getElementById(`step-lbl-${i}`);
      if (lbl) {
        if (i === stepNum) {
          lbl.className = 'step-lbl active text-accent font-bold';
        } else if (i < stepNum) {
          lbl.className = 'step-lbl text-slate-800 font-semibold';
        } else {
          lbl.className = 'step-lbl text-slate-400';
        }
      }
    }
    
    if (stepNum === 3) {
      triggerAddressGeocoding();
    }
    if (stepNum === 5) {
      updateConfirmStepDetails();
    }
  }

  function validateStep2() {
    const name = document.getElementById('order-customer-name')?.value?.trim();
    const phone = document.getElementById('order-customer-phone')?.value?.trim();
    const email = document.getElementById('order-customer-email')?.value?.trim();
    const address = document.getElementById('order-address')?.value?.trim();

    if (!name) {
      alert('Please enter your name.');
      return false;
    }
    if (!phone || phone.length < 10) {
      alert('Please enter a valid 10-digit phone number.');
      return false;
    }
    if (email && !email.includes('@')) {
      alert('Please enter a valid email address.');
      return false;
    }
    if (isDelivery && !address) {
      alert('Please enter your delivery address.');
      return false;
    }
    return true;
  }

  async function triggerAddressGeocoding() {
    const loader = document.getElementById('delivery-calc-loading');
    const successBox = document.getElementById('delivery-calc-success');
    const failedBox = document.getElementById('delivery-calc-failed');
    const resolvedAddressLabel = document.getElementById('delivery-resolved-address');
    const resolvedKmLabel = document.getElementById('delivery-resolved-km');
    const distLabel = document.getElementById('delivery-dist-label');
    const kmUnit = document.getElementById('delivery-resolved-km-unit');

    if (!isDelivery) {
      if (loader) loader.classList.add('hidden');
      if (successBox) successBox.classList.remove('hidden');
      if (failedBox) failedBox.classList.add('hidden');
      if (resolvedAddressLabel) resolvedAddressLabel.textContent = "Self Pickup (Free)";
      if (resolvedKmLabel) resolvedKmLabel.textContent = "0.0";
      if (distLabel) distLabel.textContent = "Distance from Limra:";
      if (kmUnit) kmUnit.style.display = "";
      return;
    }

    if (selectedDeliveryArea && selectedDeliveryArea !== 'custom') {
      if (loader) loader.classList.add('hidden');
      if (successBox) successBox.classList.remove('hidden');
      if (failedBox) failedBox.classList.add('hidden');
      
      const areaSelect = document.getElementById('order-delivery-area');
      const areaLabel = areaSelect ? areaSelect.options[areaSelect.selectedIndex].text.split(' (')[0] : selectedDeliveryArea;
      
      const detailedAddress = document.getElementById('order-address')?.value?.trim() || "";
      if (resolvedAddressLabel) {
        resolvedAddressLabel.textContent = detailedAddress ? `${detailedAddress} (${areaLabel})` : areaLabel;
      }
      
      if (distLabel) distLabel.textContent = "Rate Type:";
      if (resolvedKmLabel) resolvedKmLabel.textContent = "Fixed Area Rate";
      if (kmUnit) kmUnit.style.display = "none";
      
      updateCartUI();
      return;
    }

    // Reset labels back to custom
    if (distLabel) distLabel.textContent = "Distance from Limra:";
    if (kmUnit) kmUnit.style.display = "";

    const addressVal = document.getElementById('order-address')?.value?.trim();
    if (!addressVal) {
      if (loader) loader.classList.add('hidden');
      if (successBox) successBox.classList.add('hidden');
      if (failedBox) failedBox.classList.remove('hidden');
      return;
    }

    // If already geocoded via map pin or previous manual entry
    if (deliveryKm > 0 && geocodeResolvedAddress === addressVal) {
      if (loader) loader.classList.add('hidden');
      if (successBox) successBox.classList.remove('hidden');
      if (failedBox) failedBox.classList.add('hidden');
      if (resolvedAddressLabel) resolvedAddressLabel.textContent = addressVal;
      if (resolvedKmLabel) resolvedKmLabel.textContent = deliveryKm.toFixed(1);
      return;
    }

    // Otherwise geocode manual text
    if (loader) loader.classList.remove('hidden');
    if (successBox) successBox.classList.add('hidden');
    if (failedBox) failedBox.classList.add('hidden');

    try {
      const query = `${addressVal}, Egra, Purba Medinipur, West Bengal, India`;
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`);
      const data = await res.json();

      let latlng = null;
      if (data && data.length > 0) {
        latlng = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      } else {
        const fallbackRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(addressVal)}`);
        const fallbackData = await fallbackRes.json();
        if (fallbackData && fallbackData.length > 0) {
          latlng = { lat: parseFloat(fallbackData[0].lat), lng: parseFloat(fallbackData[0].lon) };
        }
      }

      if (latlng) {
        const limraCoords = [21.8603074, 87.4793798];
        const dist = haversineDistance(limraCoords[0], limraCoords[1], latlng.lat, latlng.lng);
        deliveryKm = Math.min(50, Math.max(0.1, dist));
        
        const distInput = document.getElementById('order-distance');
        if (distInput) distInput.value = deliveryKm.toFixed(1);
        geocodeResolvedAddress = addressVal;

        if (resolvedAddressLabel) resolvedAddressLabel.textContent = addressVal;
        if (resolvedKmLabel) resolvedKmLabel.textContent = deliveryKm.toFixed(1);
        if (loader) loader.classList.add('hidden');
        if (successBox) successBox.classList.remove('hidden');

        if (deliveryMap) {
          deliveryMap.setView([latlng.lat, latlng.lng], 15);
          if (!deliveryMarker) {
            const clientIcon = L.icon({
              iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
              shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
              shadowSize: [41, 41]
            });
            deliveryMarker = L.marker(latlng, { icon: clientIcon, draggable: true }).addTo(deliveryMap);
            deliveryMarker.on('dragend', async () => {
              await updatePinnedLocation(deliveryMarker.getLatLng());
            });
          } else {
            deliveryMarker.setLatLng(latlng);
          }
        }
      } else {
        throw new Error("Nominatim returned empty results");
      }
    } catch (e) {
      console.warn("Manual address geocoding failed, using local fallback flat-fee:", e);
      deliveryKm = 3.0; // standard flat distance
      const distInput = document.getElementById('order-distance');
      if (distInput) distInput.value = "3.0";
      geocodeResolvedAddress = addressVal;

      if (resolvedAddressLabel) resolvedAddressLabel.textContent = addressVal + " (Manual)";
      if (resolvedKmLabel) resolvedKmLabel.textContent = "3.0 (Fallback)";
      if (loader) loader.classList.add('hidden');
      if (failedBox) failedBox.classList.remove('hidden');
    }
    
    updateCartUI();
  }

  function getSelectedPaymentMethod() {
    const radios = document.getElementsByName('payment_method');
    for (let r of radios) {
      if (r.checked) {
        if (r.value === 'cod') return 'Cash on Delivery (COD)';
        if (r.value === 'upi') return 'UPI / WhatsApp Pay';
        if (r.value === 'card') return 'Card on Delivery';
      }
    }
    return 'Cash on Delivery (COD)';
  }

  function updateConfirmStepDetails() {
    const name = document.getElementById('order-customer-name')?.value?.trim() || "";
    const phone = document.getElementById('order-customer-phone')?.value?.trim() || "";
    const email = document.getElementById('order-customer-email')?.value?.trim() || "";
    const address = document.getElementById('order-address')?.value?.trim() || "";
    const payment = getSelectedPaymentMethod();

    const confName = document.getElementById('confirm-name');
    if (confName) confName.textContent = name;
    
    const confPhone = document.getElementById('confirm-phone');
    if (confPhone) confPhone.textContent = phone;
    
    const confEmail = document.getElementById('confirm-email');
    if (confEmail) confEmail.textContent = email;
    
    const confAddress = document.getElementById('confirm-address');
    if (confAddress) {
      confAddress.textContent = isDelivery ? address : 'Self Pickup at Restaurant';
    }
    
    const confDelType = document.getElementById('confirm-delivery-type');
    if (confDelType) {
      confDelType.textContent = isDelivery ? '🛵 Delivery' : '🥡 Self Pickup';
    }
    
    const confPay = document.getElementById('confirm-payment-mode');
    if (confPay) confPay.textContent = payment;
  }

  function initStepperNavigation() {
    // Step 1 buttons
    document.getElementById('step-1-next')?.addEventListener('click', () => {
      if (cart.length === 0) {
        alert('Your cart is empty! Add some dishes first.');
        return;
      }
      showStep(2);
    });

    // Step 2 buttons
    document.getElementById('step-2-back')?.addEventListener('click', () => showStep(1));
    document.getElementById('step-2-next')?.addEventListener('click', () => {
      if (validateStep2()) {
        showStep(3);
      }
    });

    // Step 3 buttons
    document.getElementById('step-3-back')?.addEventListener('click', () => showStep(2));
    document.getElementById('step-3-next')?.addEventListener('click', () => showStep(4));

    // Step 4 buttons
    document.getElementById('step-4-back')?.addEventListener('click', () => showStep(3));
    document.getElementById('step-4-next')?.addEventListener('click', () => showStep(5));

    // Step 5 buttons
    document.getElementById('step-5-back')?.addEventListener('click', () => showStep(4));

    // Trigger geocoding when address focus is lost
    document.getElementById('order-address')?.addEventListener('focusout', () => {
      if (isDelivery) {
        triggerAddressGeocoding();
      }
    });
  }

  function initSavedAddressLoading() {
    const savedBtn = document.getElementById('load-saved-details-btn');
    if (!savedBtn) return;
    
    const raw = localStorage.getItem('limra-customer-details');
    if (raw) {
      savedBtn.classList.remove('hidden');
      savedBtn.addEventListener('click', () => {
        try {
          const details = JSON.parse(raw);
          if (details.name) document.getElementById('order-customer-name').value = details.name;
          if (details.phone) document.getElementById('order-customer-phone').value = details.phone;
          if (details.email) document.getElementById('order-customer-email').value = details.email;
          if (details.address) document.getElementById('order-address').value = details.address;
          if (details.isDelivery !== undefined) {
            setDeliveryMode(details.isDelivery);
          }
          if (details.selectedDeliveryArea !== undefined) {
            selectedDeliveryArea = details.selectedDeliveryArea;
            const areaSelect = document.getElementById('order-delivery-area');
            if (areaSelect) {
              areaSelect.value = selectedDeliveryArea;
            }
          }
          if (details.distance !== undefined) {
            deliveryKm = details.distance;
            const distInput = document.getElementById('order-distance');
            if (distInput) distInput.value = details.distance.toFixed(1);
          }
          updateCartUI();
          alert('Saved details loaded successfully!');
        } catch (e) {
          console.warn('Failed to load saved details:', e);
        }
      });
    }
  }

  initDelivery();
  initStepperNavigation();

  // ── Antigravity UPI Verification & Order Tracking Stores ──────────────────
  const upiVerificationStore = new AntigravityStore({
    isVerifying: false,
    status: 'idle', // 'idle' | 'verifying' | 'success' | 'pending' | 'failed'
    message: ''
  });

  const orderTrackingStore = new AntigravityStore({
    activeOrderId: null,
    orderNumber: '',
    status: 'pending',
    isTracking: false
  });

  let orderRealtimeChannel = null;
  let orderTrackingPollId = null;

  async function subscribeToOrderUpdates(orderId, orderNumber) {
    // Gracefully handle null or placeholder IDs to prevent websocket failures
    if (!orderId || orderId === '#N/A' || orderId === 'null' || orderId === 'undefined') {
      console.warn('[RealtimeTracking] Invalid tracking reference ID:', orderId);
      orderTrackingStore.state = {
        activeOrderId: null,
        orderNumber: orderNumber || 'N/A',
        isTracking: false,
        status: 'pending'
      };
      return;
    }

    if (orderRealtimeChannel) {
      try {
        await insforge.realtime.unsubscribe(`order-updates:${orderRealtimeChannel}`);
      } catch (e) {}
      orderRealtimeChannel = null;
    }

    orderRealtimeChannel = orderId;
    const channelName = `order-updates:${orderId}`;

    orderTrackingStore.state = {
      activeOrderId: orderId,
      orderNumber: orderNumber,
      isTracking: true,
      status: 'pending'
    };

    try {
      await insforge.realtime.connect();
      const subRes = await insforge.realtime.subscribe(channelName);
      if (!subRes.error) {
        console.log(`[RealtimeTracking] Subscribed to order updates: ${channelName}`);
        
        insforge.realtime.on('order_status_updated', (payload) => {
          if (payload.order_id === orderId) {
            console.log(`[RealtimeTracking] Status transition:`, payload.status);
            orderTrackingStore.state = {
              ...orderTrackingStore.state,
              status: payload.status
            };

            if (payload.status === 'delivered' || payload.status === 'cancelled') {
              setTimeout(() => {
                unsubscribeFromOrderUpdates();
              }, 45000);
            }
          }
        });
      } else {
        throw new Error(subRes.error.message || 'Subscription failed');
      }
    } catch (err) {
      console.warn('[RealtimeTracking] WebSocket updates unavailable. Falling back to active HTTP polling:', err);
      startOrderTrackingPolling(orderId);
    }
  }

  function startOrderTrackingPolling(orderId) {
    if (orderTrackingPollId) clearInterval(orderTrackingPollId);
    orderTrackingPollId = setInterval(async () => {
      try {
        const { data, error } = await insforge.database.from('orders').select('status').eq('id', orderId).maybeSingle();
        if (!error && data) {
          orderTrackingStore.state = {
            ...orderTrackingStore.state,
            status: data.status
          };
          if (data.status === 'delivered' || data.status === 'cancelled') {
            unsubscribeFromOrderUpdates();
          }
        }
      } catch (e) {
        console.warn('[RealtimeTracking] Poller error:', e);
      }
    }, 10000); // Poll every 10 seconds
  }

  function unsubscribeFromOrderUpdates() {
    if (orderRealtimeChannel) {
      const channelName = `order-updates:${orderRealtimeChannel}`;
      try {
        insforge.realtime.unsubscribe(channelName);
      } catch (e) {}
      console.log(`[RealtimeTracking] Cleaned up event stream: ${channelName}`);
      orderRealtimeChannel = null;
    }
    if (orderTrackingPollId) {
      clearInterval(orderTrackingPollId);
      orderTrackingPollId = null;
    }
    orderTrackingStore.state = {
      ...orderTrackingStore.state,
      isTracking: false
    };
  }

  window.subscribeToOrderUpdates = subscribeToOrderUpdates;

  // Subscribe reactive UIs
  upiVerificationStore.subscribe((state) => {
    const statusOverlay = document.getElementById('upi-status-overlay');
    const overlayLoader = document.getElementById('upi-overlay-loader');
    const overlaySuccess = document.getElementById('upi-overlay-success');
    const overlayPending = document.getElementById('upi-overlay-pending');
    const overlayFailed = document.getElementById('upi-overlay-failed');

    if (!statusOverlay) return;

    if (state.isVerifying) {
      statusOverlay.classList.remove('pointer-events-none', 'opacity-0');
    } else if (state.status === 'idle') {
      statusOverlay.classList.add('pointer-events-none', 'opacity-0');
    }

    if (overlayLoader) overlayLoader.classList.toggle('hidden', state.status !== 'verifying');
    if (overlaySuccess) overlaySuccess.classList.toggle('hidden', state.status !== 'success');
    if (overlayPending) overlayPending.classList.toggle('hidden', state.status !== 'pending');
    if (overlayFailed) overlayFailed.classList.toggle('hidden', state.status !== 'failed');

    if (state.status === 'failed') {
      const failedMsgEl = document.getElementById('upi-failed-message');
      if (failedMsgEl) failedMsgEl.textContent = state.message || 'Payment verification failed.';
    }
  });

  orderTrackingStore.subscribe((state) => {
    const modal = document.getElementById('order-tracking-modal');
    const numberEl = document.getElementById('track-order-number');
    const statusTextEl = document.getElementById('track-status-text');
    
    if (!modal) return;

    if (state.isTracking) {
      modal.classList.remove('pointer-events-none', 'opacity-0');
      modal.querySelector('#order-tracking-content').classList.remove('scale-95');
      modal.querySelector('#order-tracking-content').classList.add('scale-100');
    } else {
      modal.classList.add('pointer-events-none', 'opacity-0');
      modal.querySelector('#order-tracking-content').classList.add('scale-95');
      modal.querySelector('#order-tracking-content').classList.remove('scale-100');
      return;
    }

    if (numberEl) numberEl.textContent = `#${state.orderNumber}`;

    const statusHierarchy = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'];
    let currentStatus = (state.status || 'pending').toLowerCase().replace(/_/g, ' ').trim();
    if (currentStatus === 'placed' || currentStatus === 'pending') {
      currentStatus = 'pending';
    } else if (currentStatus === 'confirmed') {
      currentStatus = 'confirmed';
    } else if (currentStatus === 'preparing') {
      currentStatus = 'preparing';
    } else if (currentStatus === 'out for delivery' || currentStatus === 'out_for_delivery' || currentStatus === 'ready') {
      currentStatus = 'out_for_delivery';
    } else if (currentStatus === 'delivered') {
      currentStatus = 'delivered';
    } else if (currentStatus === 'cancelled' || currentStatus === 'rejected') {
      currentStatus = 'cancelled';
    }
    
    const currentIndex = statusHierarchy.indexOf(currentStatus);

    statusHierarchy.forEach((status, idx) => {
      const stepEl = document.getElementById(`track-step-${status}`);
      if (!stepEl) return;
      
      const circle = stepEl.querySelector('.step-circle');
      const title = stepEl.querySelector('.step-title');

      if (!circle || !title) return;

      if (currentStatus === 'cancelled') {
        circle.className = 'absolute -left-7 w-7 h-7 rounded-full flex items-center justify-center border-2 border-red-500 bg-red-50 text-red-600 text-xs font-bold step-circle transition-all duration-300';
        title.className = 'text-xs font-bold text-red-500 step-title transition-colors duration-300';
      } else if (idx < currentIndex) {
        circle.className = 'absolute -left-7 w-7 h-7 rounded-full flex items-center justify-center border-2 border-emerald-500 bg-emerald-500 text-white text-xs font-bold step-circle transition-all duration-300';
        title.className = 'text-xs font-bold text-emerald-600 step-title transition-colors duration-300';
      } else if (idx === currentIndex) {
        circle.className = 'absolute -left-7 w-7 h-7 rounded-full flex items-center justify-center border-2 border-emerald-500 bg-emerald-50 text-emerald-600 text-xs font-bold step-circle animate-pulse transition-all duration-300';
        title.className = 'text-xs font-bold text-emerald-600 step-title transition-colors duration-300';
      } else {
        circle.className = 'absolute -left-7 w-7 h-7 rounded-full flex items-center justify-center border-2 border-slate-200 bg-white text-slate-400 text-xs font-bold step-circle transition-all duration-300';
        title.className = 'text-xs font-bold text-slate-400 step-title transition-colors duration-300';
      }
    });

    const progressLine = document.getElementById('track-progress-line');
    if (progressLine) {
      if (currentStatus === 'cancelled') {
        progressLine.style.background = '#fecaca'; // light red
      } else {
        const percent = currentIndex >= 0 ? (currentIndex / 4) * 100 : 0;
        progressLine.style.background = `linear-gradient(to bottom, #10b981 ${percent}%, #e2e8f0 ${percent}%)`;
        progressLine.style.transition = 'background 0.5s ease';
      }
    }

    if (statusTextEl) {
      switch (currentStatus) {
        case 'pending':
          statusTextEl.textContent = 'Your order is placed. Waiting for confirmation...';
          break;
        case 'confirmed':
          statusTextEl.textContent = 'Order confirmed! We will start preparing it shortly.';
          break;
        case 'preparing':
          statusTextEl.textContent = 'Chefs are preparing your dishes in the kitchen.';
          break;
        case 'ready':
          statusTextEl.textContent = 'Order is ready and out for delivery! Please stand by.';
          break;
        case 'delivered':
          statusTextEl.textContent = 'Order delivered successfully! Bon appétit!';
          break;
        case 'cancelled':
          statusTextEl.textContent = 'Order cancelled or rejected by restaurant.';
          break;
        default:
          statusTextEl.textContent = `Current status: ${state.status}`;
      }
    }
  });

  // UTR Countdown timer & verification
  let countdownInterval = null;
  function startPendingCountdown(utr, grandTotal) {
    let count = 10;
    const countEl = document.getElementById('upi-pending-countdown');
    if (countEl) countEl.textContent = count;

    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(async () => {
      count--;
      if (countEl) countEl.textContent = count;

      if (count <= 0) {
        clearInterval(countdownInterval);
        await executeUpiVerification(utr, grandTotal);
      }
    }, 1000);
  }

  async function executeUpiVerification(utr, grandTotal) {
    upiVerificationStore.state = {
      isVerifying: true,
      status: 'verifying',
      message: ''
    };

    try {
      const res = await insforge.database.rpc('verify_upi_payment', {
        p_amount: grandTotal,
        p_payee: '7501299357@ybl',
        p_utr_or_txn: utr
      });

      if (res.error) throw new Error(res.error.message || 'Verification failed');

      const data = res.data;
      if (data.status === 'success') {
        upiVerificationStore.state = {
          isVerifying: true,
          status: 'success',
          message: ''
        };
        
        await new Promise(r => setTimeout(r, 1500));
        
        upiVerificationStore.state = {
          isVerifying: false,
          status: 'idle',
          message: ''
        };

        const modal = document.getElementById('upi-payment-modal');
        modal.classList.add('pointer-events-none', 'opacity-0');
        modal.querySelector('#upi-modal-content').classList.add('scale-95');

        await saveAndCompleteOrder(utr);
      } else if (data.status === 'pending') {
        upiVerificationStore.state = {
          isVerifying: true,
          status: 'pending',
          message: data.message
        };
        startPendingCountdown(utr, grandTotal);
      } else {
        upiVerificationStore.state = {
          isVerifying: true,
          status: 'failed',
          message: data.message || 'Payment verification failed.'
        };
      }
    } catch (err) {
      upiVerificationStore.state = {
        isVerifying: true,
        status: 'failed',
        message: err.message || 'Network error verifying payment.'
      };
    }
  }

  // Setup failed payment retry UI binding
  document.getElementById('upi-failed-retry-btn').addEventListener('click', () => {
    upiVerificationStore.state = { isVerifying: false, status: 'idle', message: '' };
  });

  // Setup close tracking modal binding
  document.getElementById('track-close-btn').addEventListener('click', () => {
    unsubscribeFromOrderUpdates();
  });

  // Backdrop click listener to close order tracking modal and clean up streams
  document.getElementById('order-tracking-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('order-tracking-modal')) {
      unsubscribeFromOrderUpdates();
    }
  });

  // Place order (saved to admin dashboard)
  document.getElementById('place-order-btn').addEventListener('click', async () => {
    if (cart.length === 0) { alert('Your cart is empty! Add some items first.'); return; }
    const name    = document.getElementById('order-customer-name').value.trim();
    const phone   = document.getElementById('order-customer-phone').value.trim();
    const email   = document.getElementById('order-customer-email').value.trim();
    const address = document.getElementById('order-address')?.value?.trim() || '';
    const notes   = document.getElementById('order-notes').value.trim();
    const km      = parseFloat(document.getElementById('order-distance')?.value) || 0;
    const charge  = getDeliveryCharge();
    const taxes   = getTaxesAmount();
    const payment = getSelectedPaymentMethod();

    const lat     = parseFloat(document.getElementById('order-latitude')?.value) || null;
    const lng     = parseFloat(document.getElementById('order-longitude')?.value) || null;
    const landmark = document.getElementById('order-landmark')?.value?.trim() || null;
    const deliveryNotes = document.getElementById('order-delivery-notes')?.value?.trim() || null;
    const locationVerified = document.getElementById('order-location-verified')?.value === 'true';

    if (!name) {
      alert('Please enter your full name.');
      return;
    }

    // Strict Phone Number validation (exactly 10-digit format, digits only, starting with 6-9)
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      alert('Please enter a valid 10-digit phone number (digits only, e.g. 9876543210).');
      return;
    }

    if (email && !email.includes('@')) {
      alert('Please enter a valid email address.');
      return;
    }
    
    // Bounds check and sanitize coordinates for delivery to prevent layout or map injection errors
    let validatedLat = null;
    let validatedLng = null;
    if (isDelivery) {
      if (!address) {
        alert('Please enter your delivery address.');
        return;
      }
      if (lat !== null && !isNaN(lat) && lng !== null && !isNaN(lng)) {
        if (lat < 21.0 || lat > 23.0 || lng < 86.5 || lng > 88.5) {
          alert('Invalid delivery coordinates. Pinned location must be within Egra region (Lat: 21.0 - 23.0, Lng: 86.5 - 88.5).');
          return;
        }
        validatedLat = parseFloat(lat.toFixed(6));
        validatedLng = parseFloat(lng.toFixed(6));
      }
    }

    const deliveryNote = isDelivery
      ? `[DELIVERY] Address: ${address} | Selected Area: ${selectedDeliveryArea ? (selectedDeliveryArea.charAt(0).toUpperCase() + selectedDeliveryArea.slice(1)) : 'Custom'} | Distance: ${km.toFixed(1)} km | Delivery charge: ₹${charge}`
      : '[SELF PICKUP]';
    const emailNote = email ? `[EMAIL: ${email}]` : '';
    const paymentNote = `[PAYMENT: ${payment}] | [PAYMENT_STATUS: ${payment === 'upi' ? 'COMPLETED' : 'PENDING'}]`;
    const combinedNotes = [deliveryNote, emailNote, paymentNote, notes].filter(Boolean).join(' | ');

    const btn = document.getElementById('place-order-btn');
    const statusEl = document.getElementById('order-status-msg');
    btn.disabled = true;
    btn.innerHTML = `
      <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg> Placing order...
    `;

    // Store cart before clearing it for the success notifications!
    const cartSnapshot = JSON.parse(JSON.stringify(cart));
    const subtotal = getCartSubtotal();

    const saveAndCompleteOrder = async (utrVal = null) => {
      try {
        const order = await saveOrder({
          customerName: name,
          customerPhone: phone,
          items: cartSnapshot,
          notes: combinedNotes,
          latitude: validatedLat,
          longitude: validatedLng,
          landmark: landmark,
          deliveryNotes: deliveryNotes,
          locationVerified: locationVerified,
          txnRef: utrVal
        });
        const orderLabel = order?.order_number ? `Order #${order.order_number}` : 'Your order';
        statusEl.textContent = `${orderLabel} placed! We will confirm soon.`;
        statusEl.style.color = 'var(--color-accent)';
        statusEl.classList.remove('hidden');

        // Save customer details to localStorage for future orders
        const savedDetails = {
          name,
          phone,
          email,
          address,
          isDelivery,
          distance: km,
          selectedDeliveryArea
        };
        localStorage.setItem('limra-customer-details', JSON.stringify(savedDetails));
        initSavedAddressLoading(); // Refresh loading state
        
        // Activate notifications listening immediately for checkout phone
        startNotificationListening();

        // Send Automatic HTML Email Receipt to Customer
        if (email) {
          try {
            const orderItemsMap = cartSnapshot.map(item => ({
              item_name: item.name,
              quantity: item.qty,
              unit_price: item.price,
              line_total: item.price * item.qty
            }));
            const emailHtml = generateOrderPlacedHtml(order, orderItemsMap);
            await sendEmailNotification(email, `🛒 Order #${order.order_number} Received - LIMRA Restaurant`, emailHtml);
          } catch (emailErr) {
            console.warn('[Checkout] Background automatic email notification failed:', emailErr);
          }
        }

        // WhatsApp Confirmation Link
        let waMsg = `Hello! My order is placed successfully at SK Arif (Limra Restaurant).\n\n*Order Details:*\n• Name: ${name}\n• Phone: ${phone}\n• Email: ${email || 'None'}\n`;
        let orderItemsText = '';
        cartSnapshot.forEach(item => {
          orderItemsText += `• ${item.name} x${item.qty} = ₹${item.price * item.qty}\n`;
        });
        orderItemsText += `\n*Subtotal: ₹${subtotal}*`;
        if (isDelivery) {
          if (selectedDeliveryArea && selectedDeliveryArea !== 'custom') {
            const areaLabel = selectedDeliveryArea.charAt(0).toUpperCase() + selectedDeliveryArea.slice(1);
            orderItemsText += `\n🛵 *Delivery Charge: ₹${charge}* (Area: ${areaLabel})`;
          } else {
            orderItemsText += `\n*Delivery Charge: ₹${charge}*`;
          }
          orderItemsText += `\n*Taxes (5% GST Incl.): ₹${taxes}*`;
          orderItemsText += `\n*Grand Total: ₹${subtotal + charge + taxes}*`;
          if (address) orderItemsText += `\n📍 *Deliver to:* ${address}`;
        } else {
          orderItemsText += `\n*Taxes (5% GST Incl.): ₹${taxes}*`;
          orderItemsText += `\n*Total: ₹${subtotal + taxes}* (Self Pickup — Free)`;
        }
        orderItemsText += `\n💳 *Payment Mode:* ${payment}`;
        waMsg += orderItemsText + `\n\nMy order is successfully booked. Please confirm my order and contact me as soon as possible! Thank you! 🙏`;
        const waUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(waMsg)}`;

        // Email (mailto) Link
        const emailSubject = `Order Confirmed successfully! - SK Arif (${orderLabel})`;
        let emailBody = `Dear Restaurant Management,\n\nI have successfully placed an order on your website.\n\nOrder Details:\n---------------------------------------------\nReference: ${orderLabel}\nName: ${name}\nPhone: ${phone}\nEmail: ${email || 'None'}\n`;
        if (isDelivery) {
          emailBody += `Delivery Address: ${address}\n`;
          emailBody += `Delivery Charge: Rs ${charge}\n`;
        } else {
          emailBody += `Delivery Option: Self Pickup (Free)\n`;
        }
        emailBody += `Payment Mode: ${payment}\n`;
        emailBody += `\nOrder Summary:\n`;
        cartSnapshot.forEach(item => {
          emailBody += `• ${item.name} x${item.qty} = Rs ${item.price * item.qty}\n`;
        });
        emailBody += `\nSubtotal: Rs ${subtotal}\nTaxes (5% GST Incl.): Rs ${taxes}\nGrand Total: Rs ${isDelivery ? (subtotal + charge + taxes) : (subtotal + taxes)}\n---------------------------------------------\n\nMy order is successfully booked. Please contact me as soon as possible to confirm and deliver.\n\nBest regards,\n${name}`;
        const emailUrl = `mailto:limrarestaurant99@gmail.com?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

        // Show Success Modal
        showSuccessModal({
          title: `${orderLabel} Placed Successfully!`,
          message: `Your order has been successfully recorded in our system. Please click below to send yourself confirmation on WhatsApp or Email!`,
          waUrl,
          emailUrl
        });

        // Trigger active tracking view
        subscribeToOrderUpdates(order.id, order.order_number);

        clearCart();
        document.getElementById('order-customer-name').value = '';
        document.getElementById('order-customer-phone').value = '';
        document.getElementById('order-customer-email').value = '';
        if (document.getElementById('order-address')) document.getElementById('order-address').value = '';
        if (document.getElementById('order-distance')) document.getElementById('order-distance').value = '';
        const areaSelect = document.getElementById('order-delivery-area');
        if (areaSelect) areaSelect.value = '';
        selectedDeliveryArea = '';
        document.getElementById('order-notes').value = '';
        deliveryKm = 0;
        showStep(1); // Reset to step 1
        setTimeout(() => statusEl.classList.add('hidden'), 5000);
      } catch (err) {
        console.error('Order error:', err);
        const detail = err?.message || 'Please try again or use WhatsApp.';
        statusEl.textContent = `Order failed: ${detail}`;
        statusEl.style.color = 'var(--color-red-badge)';
        statusEl.classList.remove('hidden');
      } finally {
        btn.disabled = false;
        btn.innerHTML = `<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg> Place Order`;
      }
    };

    if (payment === 'upi') {
      const modal = document.getElementById('upi-payment-modal');
      const amountEl = document.getElementById('upi-modal-amount');
      const qrImg = document.getElementById('upi-qr-image');
      const qrLoader = document.getElementById('upi-qr-loader');
      const confirmBtn = document.getElementById('upi-confirm-btn');
      const cancelBtn = document.getElementById('upi-cancel-btn');
      const copyBtn = document.getElementById('copy-upi-btn');
      const statusOverlay = document.getElementById('upi-status-overlay');
      const overlayLoader = document.getElementById('upi-overlay-loader');
      const overlaySuccess = document.getElementById('upi-overlay-success');
      const successTotal = document.getElementById('upi-success-total');

      const grandTotal = isDelivery ? (subtotal + charge + taxes) : (subtotal + taxes);
      amountEl.textContent = `₹${grandTotal.toFixed(2)}`;
      successTotal.textContent = grandTotal.toFixed(2);

      // Generate dynamic standard UPI pay URI with deep linking keys
      const payeeAddress = '7501299357@ybl';
      const payeeName = 'LIMRA Restaurant';
      const upiUri = `upi://pay?pa=${payeeAddress}&pn=${encodeURIComponent(payeeName)}&am=${grandTotal.toFixed(2)}&cu=INR&tn=LimraOrder`;

      // Render the QR code via dynamic qr server api
      qrLoader.classList.remove('hidden');
      qrImg.onload = () => qrLoader.classList.add('hidden');
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiUri)}`;

      // Present the custom UPI Modal UI
      modal.classList.remove('pointer-events-none', 'opacity-0');
      modal.querySelector('#upi-modal-content').classList.remove('scale-95');

      // Setup clipboard copying
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(payeeAddress).then(() => {
          const originalSvg = copyBtn.innerHTML;
          copyBtn.innerHTML = `<svg class="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`;
          setTimeout(() => { copyBtn.innerHTML = originalSvg; }, 1800);
        });
      };

      // Cancel button action
      cancelBtn.onclick = () => {
        modal.classList.add('pointer-events-none', 'opacity-0');
        modal.querySelector('#upi-modal-content').classList.add('scale-95');
        // Reset Place Order button state
        btn.disabled = false;
        btn.innerHTML = `<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg> Place Order`;
      };

      // Confirm Paid action
      confirmBtn.onclick = async () => {
        // Retrieve and validate UTR
        const utr = document.getElementById('upi-utr-input').value.trim();
        if (!/^\d{12}$/.test(utr)) {
          alert('Please enter a valid 12-digit numeric UPI Ref / UTR number.');
          return;
        }
        await executeUpiVerification(utr, grandTotal);
      };

      return; // prevent immediate COD execution
    }

    // Direct Cash/Card execution
    await saveAndCompleteOrder();
  });

  // Optional WhatsApp copy
  document.getElementById('order-whatsapp-btn').addEventListener('click', () => {
    if (cart.length === 0) { alert('Your cart is empty! Add some items first.'); return; }
    const name  = document.getElementById('order-customer-name').value.trim();
    const phone = document.getElementById('order-customer-phone').value.trim();
    let msg = decodeURIComponent(buildOrderMessage());
    if (name) msg = `Name: ${name}\nPhone: ${phone}\n\n` + msg;
    const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  });

  // Init all modules
  initMenuTabs();
  initBookingTabs();
  initBookingForms();
  initCustomerBookingLookup();
  initSeatSelection();
  initGallery();
  initHeader();
  initMobileNav();
  initSmoothScroll();
  initBackToTop();
  initSavedAddressLoading();
  initAuthPanel();
  initCustomerNotifications();

  // Sync Party Booking Budget Range Slider dynamically
  const slider = document.getElementById('party-budget-slider');
  const valSpan = document.getElementById('party-budget-val');
  const hiddenInput = document.getElementById('party-budget-hidden');
  if (slider && valSpan && hiddenInput) {
    const updateBudget = () => {
      const val = parseInt(slider.value);
      valSpan.textContent = val.toLocaleString('en-IN');
      hiddenInput.value = `₹${val.toLocaleString('en-IN')}`;
    };
    slider.addEventListener('input', updateBudget);
    updateBudget();
  }

  // Set min date for booking forms
  const today = new Date().toISOString().split('T')[0];
  document.querySelectorAll('input[type="date"]').forEach(input => {
    input.min = today;
  });
});
// ═══════════════════════════════════════
// MENU BOARD PHOTO LIGHTBOX
// ═══════════════════════════════════════
window.openMenuPhoto = function(src) {
  const lb = document.getElementById('menu-lightbox');
  const img = document.getElementById('menu-lightbox-img');
  if (!lb || !img) return;
  img.src = src;
  lb.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
};

window.closeMenuPhoto = function() {
  const lb = document.getElementById('menu-lightbox');
  if (!lb) return;
  lb.classList.add('hidden');
  document.body.style.overflow = '';
};

window.closeMenuLightbox = function(e) {
  if (e.target === document.getElementById('menu-lightbox')) window.closeMenuPhoto();
};

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') window.closeMenuPhoto();
});

// ═══════════════════════════════════════
// CUSTOMER AUTH & SAVED PROFILE MANAGEMENT
// ═══════════════════════════════════════
let currentUser = null;
let userProfile = null;

async function initAuthPanel() {
  const userBtn = document.getElementById('user-profile-btn');
  const mobileLink = document.getElementById('mobile-profile-link');
  const closeBtn = document.getElementById('auth-close-btn');
  const overlay = document.getElementById('auth-overlay');
  const drawer = document.getElementById('auth-drawer');

  if (!drawer) return;

  const openDrawer = () => {
    drawer.classList.remove('closed');
    drawer.classList.add('open');
    overlay.classList.remove('hidden');
    setTimeout(() => overlay.classList.remove('opacity-0'), 50);
  };

  const closeDrawer = () => {
    drawer.classList.remove('open');
    drawer.classList.add('closed');
    overlay.classList.add('opacity-0');
    setTimeout(() => overlay.classList.add('hidden'), 300);
  };

  userBtn?.addEventListener('click', openDrawer);
  mobileLink?.addEventListener('click', (e) => {
    e.preventDefault();
    openDrawer();
  });
  closeBtn?.addEventListener('click', closeDrawer);
  overlay?.addEventListener('click', closeDrawer);

  // Tab Switcher
  const tabSignin = document.getElementById('tab-signin-btn');
  const tabSignup = document.getElementById('tab-signup-btn');
  const formSignin = document.getElementById('form-signin');
  const formSignup = document.getElementById('form-signup');

  const signinIdentifierInput = document.getElementById('signin-identifier');
  const signinPasswordGroup = document.getElementById('signin-password-group');
  const signinPasswordInput = document.getElementById('signin-password');
  const btnGotoForgot = document.getElementById('btn-goto-forgot');

  const signupIdentifierInput = document.getElementById('signup-identifier');
  const signupPasswordGroup = document.getElementById('signup-password-group');
  const signupPasswordInput = document.getElementById('signup-password');

  function resetSignupFormStep() {
    if (formSignup) formSignup.reset();
    signupPasswordGroup?.classList.remove('hidden');
    signupPasswordInput?.setAttribute('required', '');
    signupIdentifierInput?.dispatchEvent(new Event('input'));
  }

  signinIdentifierInput?.addEventListener('input', () => {
    const val = signinIdentifierInput.value.trim();
    const detected = detectInputType(val);
    if (detected && detected.type === 'phone') {
      signinPasswordGroup?.classList.add('hidden');
      signinPasswordInput?.removeAttribute('required');
      btnGotoForgot?.classList.add('hidden');
    } else {
      signinPasswordGroup?.classList.remove('hidden');
      signinPasswordInput?.setAttribute('required', '');
      btnGotoForgot?.classList.remove('hidden');
    }
  });

  signupIdentifierInput?.addEventListener('input', () => {
    const val = signupIdentifierInput.value.trim();
    const detected = detectInputType(val);
    if (detected && detected.type === 'phone') {
      signupPasswordGroup?.classList.add('hidden');
      signupPasswordInput?.removeAttribute('required');
    } else {
      signupPasswordGroup?.classList.remove('hidden');
      signupPasswordInput?.setAttribute('required', '');
    }
  });

  tabSignin?.addEventListener('click', () => {
    tabSignin.className = 'flex-1 py-2 text-xs font-semibold rounded-lg transition-all text-slate-800 bg-white shadow-sm';
    tabSignup.className = 'flex-1 py-2 text-xs font-semibold rounded-lg transition-all text-slate-500';
    formSignin.classList.remove('hidden');
    formSignup.classList.add('hidden');
    resetSignupFormStep();
  });

  tabSignup?.addEventListener('click', () => {
    tabSignup.className = 'flex-1 py-2 text-xs font-semibold rounded-lg transition-all text-slate-800 bg-white shadow-sm';
    tabSignin.className = 'flex-1 py-2 text-xs font-semibold rounded-lg transition-all text-slate-500';
    formSignup.classList.remove('hidden');
    formSignin.classList.add('hidden');
    resetSignupFormStep();
  });

  // Signup method toggle (Email vs Phone)
  let signupIdentifier = '';
  let signupPassword = '';
  let signupMethod = ''; // 'email' or 'phone'
  let signupOtpCode = '';

  let forgotIdentifier = '';
  let forgotMethod = '';
  let forgotOtpCode = '';

  function showAuthView(viewName) {
    formSignin.classList.add('hidden');
    formSignup.classList.add('hidden');
    document.getElementById('auth-verification-view')?.classList.add('hidden');
    document.getElementById('auth-forgot-view')?.classList.add('hidden');
    document.getElementById('auth-error-msg')?.classList.add('hidden');

    if (viewName === 'signin') {
      formSignin.classList.remove('hidden');
      tabSignin.className = 'flex-1 py-2 text-xs font-semibold rounded-lg transition-all text-slate-800 bg-white shadow-sm';
      tabSignup.className = 'flex-1 py-2 text-xs font-semibold rounded-lg transition-all text-slate-500';
    } else if (viewName === 'signup') {
      formSignup.classList.remove('hidden');
      tabSignup.className = 'flex-1 py-2 text-xs font-semibold rounded-lg transition-all text-slate-800 bg-white shadow-sm';
      tabSignin.className = 'flex-1 py-2 text-xs font-semibold rounded-lg transition-all text-slate-500';
    } else if (viewName === 'verification') {
      document.getElementById('auth-verification-view')?.classList.remove('hidden');
    } else if (viewName === 'forgot') {
      document.getElementById('auth-forgot-view')?.classList.remove('hidden');
    }
  }

  // Override top tabs click handlers
  tabSignin?.addEventListener('click', () => {
    showAuthView('signin');
  });

  tabSignup?.addEventListener('click', () => {
    showAuthView('signup');
  });

  // Password Show/Hide toggles
  const btnSigninTogglePassword = document.getElementById('btn-signin-toggle-password');
  btnSigninTogglePassword?.addEventListener('click', () => {
    const isPass = signinPasswordInput.type === 'password';
    signinPasswordInput.type = isPass ? 'text' : 'password';
    btnSigninTogglePassword.textContent = isPass ? 'Hide' : 'Show';
  });

  const btnSignupTogglePassword = document.getElementById('btn-signup-toggle-password');
  btnSignupTogglePassword?.addEventListener('click', () => {
    const isPass = signupPasswordInput.type === 'password';
    signupPasswordInput.type = isPass ? 'text' : 'password';
    btnSignupTogglePassword.textContent = isPass ? 'Hide' : 'Show';
  });

  const forgotNewPasswordInput = document.getElementById('forgot-new-password');
  const btnForgotTogglePassword = document.getElementById('btn-forgot-toggle-password');
  btnForgotTogglePassword?.addEventListener('click', () => {
    const isPass = forgotNewPasswordInput.type === 'password';
    forgotNewPasswordInput.type = isPass ? 'text' : 'password';
    btnForgotTogglePassword.textContent = isPass ? 'Hide' : 'Show';
  });

  // Navigation handlers between auth sub-views
  document.getElementById('btn-goto-forgot')?.addEventListener('click', () => {
    showAuthView('forgot');
    document.getElementById('form-forgot-step1').classList.remove('hidden');
    document.getElementById('form-forgot-step2').classList.add('hidden');
  });

  document.getElementById('btn-back-to-login')?.addEventListener('click', () => {
    showAuthView('signin');
  });

  document.getElementById('btn-back-to-signup')?.addEventListener('click', () => {
    showAuthView('signup');
  });

  // Input Type Detection helper
  function detectInputType(val) {
    const trimmed = val.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(trimmed)) {
      return { type: 'email', value: trimmed };
    }
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 15) {
      const cleanPhone = digits.slice(-10);
      return { type: 'phone', value: cleanPhone };
    }
    return null;
  }

  // Display Errors helper
  const errorMsg = document.getElementById('auth-error-msg');
  const displayError = (msg) => {
    if (errorMsg) {
      errorMsg.textContent = msg;
      errorMsg.classList.remove('hidden');
      setTimeout(() => errorMsg.classList.add('hidden'), 6000);
    } else {
      alert(msg);
    }
  };

  // 1. Sign Up Handler
  document.getElementById('form-signup')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rawVal = document.getElementById('signup-identifier').value.trim();

    const detected = detectInputType(rawVal);
    if (!detected) {
      alert('Please enter a valid email address or 10-digit mobile number.');
      return;
    }

    signupMethod = detected.type;
    signupIdentifier = detected.value;

    if (signupMethod === 'phone') {
      signupPassword = signupIdentifier;
    } else {
      signupPassword = document.getElementById('signup-password').value;
      if (signupPassword.length < 8) {
        alert('Password must be at least 8 characters long.');
        return;
      }
    }

    const submitBtn = document.getElementById('btn-signup-action');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';

    if (signupMethod === 'email') {
      try {
        const { data, error } = await insforge.auth.signUp({
          email: signupIdentifier,
          password: signupPassword,
          name: 'Customer'
        });

        if (error) {
          if (error.message && error.message.toLowerCase().includes('already exists')) {
            throw new Error('An account with this email or phone number already exists.');
          }
          throw error;
        }

        document.getElementById('verification-msg').textContent = 'We have sent a verification code to your email address.';
        showAuthView('verification');
        document.getElementById('verification-otp').focus();
      } catch (err) {
        displayError(err.message || 'Signup failed.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Register Account ➔';
      }
    } else {
      try {
        const { data: code, error } = await insforge.database.rpc('send_phone_signup_code', {
          p_phone: signupIdentifier
        });

        if (error) {
          if (error.message && error.message.toLowerCase().includes('already exists')) {
            throw new Error('An account with this email or phone number already exists.');
          }
          throw error;
        }

        signupOtpCode = code;
        console.log(`[LIMRA-SMS-Mock] Verification code for ${signupIdentifier}: ${signupOtpCode}`);

        alert(`💬 SMS Message • +91 ${signupIdentifier}\n\n[LIMRA Restaurant] Your verification OTP code is ${signupOtpCode}. This code expires in 5 minutes.`);

        document.getElementById('verification-msg').textContent = 'We have sent a verification code to your mobile number.';
        showAuthView('verification');
        document.getElementById('verification-otp').focus();
      } catch (err) {
        displayError(err.message || 'Signup failed.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Register Account ➔';
      }
    }
  });

  // 2. OTP Verification Handler
  document.getElementById('form-verify')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const enteredOtp = document.getElementById('verification-otp').value.trim();
    if (enteredOtp.length !== 6) {
      alert('Please enter a 6-digit verification code.');
      return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Verifying...';

    if (signupMethod === 'email') {
      try {
        const { data, error } = await insforge.auth.verifyEmail({
          email: signupIdentifier,
          otp: enteredOtp
        });

        if (error) {
          if (error.message && error.message.toLowerCase().includes('expired')) {
            throw new Error('Verification code expired. Please request a new code.');
          } else {
            throw new Error('Incorrect verification code.');
          }
        }

        const { data: existingProfile } = await insforge.database
          .from('customer_profiles')
          .select('id')
          .eq('id', data.user.id);

        if (!existingProfile || existingProfile.length === 0) {
          const profileData = {
            id: data.user.id,
            name: 'Customer',
            phone: '',
            email: signupIdentifier,
            email_verified: true,
            address: ''
          };
          await insforge.database.from('customer_profiles').insert([profileData]);
        }

        alert('Registration Successful\n\nYou are now registered and signed in.');
        await checkAuthStatus();
        closeDrawer();
      } catch (err) {
        alert(err.message || 'Verification failed.');
      } finally {
        submitBtn.disabled = false;
      }
    } else {
      if (enteredOtp !== signupOtpCode) {
        alert('Incorrect verification code.');
        submitBtn.disabled = false;
        return;
      }

      const mockEmail = `${signupIdentifier}@limraresturent.in`;
      const mockPassword = signupPassword;

      try {
        const regRes = await insforge.auth.signUp({
          email: mockEmail,
          password: mockPassword,
          name: 'Customer'
        });
        if (regRes.error) throw regRes.error;

        const loginRes = await insforge.auth.signInWithPassword({
          email: mockEmail,
          password: mockPassword
        });
        if (loginRes.error) throw loginRes.error;

        const { data: existingProfile } = await insforge.database
          .from('customer_profiles')
          .select('id')
          .eq('id', loginRes.data.user.id);

        if (!existingProfile || existingProfile.length === 0) {
          const profileData = {
            id: loginRes.data.user.id,
            name: 'Customer',
            phone: signupIdentifier,
            email: null,
            phone_verified: true,
            address: ''
          };
          await insforge.database.from('customer_profiles').insert([profileData]);
        }

        // Clean up temporary phone verification row
        try {
          await insforge.database.query("DELETE FROM public.phone_verifications WHERE phone = $1", [signupIdentifier]);
        } catch (e) {}

        alert('Registration Successful\n\nYou are now registered and signed in.');
        await checkAuthStatus();
        closeDrawer();
      } catch (err) {
        alert('Registration failed: ' + (err.message || err));
      } finally {
        submitBtn.disabled = false;
      }
    }
  });

  // 3. Resend OTP Handler
  document.getElementById('btn-resend-otp')?.addEventListener('click', async () => {
    const resendBtn = document.getElementById('btn-resend-otp');
    resendBtn.disabled = true;
    resendBtn.textContent = 'Sending...';

    if (signupMethod === 'email') {
      try {
        await insforge.auth.resendVerificationEmail({
          email: signupIdentifier,
          redirectTo: window.location.origin
        });
        alert('A new verification code has been sent to your email address.');
      } catch (err) {
        alert(err.message || 'Resend failed.');
      } finally {
        resendBtn.disabled = false;
        resendBtn.textContent = 'Resend Code';
      }
    } else {
      try {
        const { data: code, error } = await insforge.database.rpc('send_phone_signup_code', {
          p_phone: signupIdentifier
        });
        if (error) throw error;

        signupOtpCode = code;
        alert(`💬 SMS Message • +91 ${signupIdentifier}\n\n[LIMRA Restaurant] Your verification OTP code is ${signupOtpCode}. This code expires in 5 minutes.`);
      } catch (err) {
        alert(err.message || 'Resend failed.');
      } finally {
        resendBtn.disabled = false;
        resendBtn.textContent = 'Resend Code';
      }
    }
  });

  // 4. Forgot Password - Send Code Handler
  document.getElementById('form-forgot-step1')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rawVal = document.getElementById('forgot-identifier').value.trim();

    const detected = detectInputType(rawVal);
    if (!detected) {
      alert('Please enter a valid email address or 10-digit mobile number.');
      return;
    }

    forgotMethod = detected.type;
    forgotIdentifier = detected.value;

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    if (forgotMethod === 'email') {
      try {
        const { error } = await insforge.auth.sendResetPasswordEmail({
          email: forgotIdentifier,
          redirectTo: window.location.origin
        });
        if (error) throw error;

        document.getElementById('forgot-step2-msg').textContent = 'We have sent a verification code to your email address.';
        document.getElementById('form-forgot-step1').classList.add('hidden');
        document.getElementById('form-forgot-step2').classList.remove('hidden');
        document.getElementById('forgot-otp').focus();
      } catch (err) {
        alert(err.message || 'Failed to send reset code.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Reset Code';
      }
    } else {
      try {
        const { data: code, error } = await insforge.database.rpc('send_phone_reset_code', {
          p_phone: forgotIdentifier
        });
        if (error) {
          if (error.message && error.message.toLowerCase().includes('does not exist')) {
            throw new Error('Account with this phone number does not exist.');
          }
          throw error;
        }

        forgotOtpCode = code;
        alert(`💬 SMS Message • +91 ${forgotIdentifier}\n\n[LIMRA Restaurant] Your password reset verification OTP is ${forgotOtpCode}. Expires in 5 minutes.`);

        document.getElementById('forgot-step2-msg').textContent = 'We have sent a verification code to your mobile number.';
        document.getElementById('form-forgot-step1').classList.add('hidden');
        document.getElementById('form-forgot-step2').classList.remove('hidden');
        document.getElementById('forgot-otp').focus();
      } catch (err) {
        alert(err.message || 'Failed to send reset code.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Reset Code';
      }
    }
  });

  // 5. Forgot Password - Verify and Update Handler
  document.getElementById('form-forgot-step2')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const enteredOtp = document.getElementById('forgot-otp').value.trim();
    const newPassword = document.getElementById('forgot-new-password').value;

    if (enteredOtp.length !== 6) {
      alert('Please enter a 6-digit verification code.');
      return;
    }
    if (newPassword.length < 8) {
      alert('Password must be at least 8 characters long.');
      return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Resetting...';

    if (forgotMethod === 'email') {
      try {
        const exRes = await insforge.auth.exchangeResetPasswordToken({
          email: forgotIdentifier,
          code: enteredOtp
        });
        if (exRes.error) {
          if (exRes.error.message && exRes.error.message.toLowerCase().includes('expired')) {
            throw new Error('Verification code expired. Please request a new code.');
          } else {
            throw new Error('Incorrect verification code.');
          }
        }

        const token = exRes.data.token;

        const resetRes = await insforge.auth.resetPassword({
          newPassword: newPassword,
          otp: token
        });
        if (resetRes.error) throw resetRes.error;

        alert('Password updated successfully.');
        await checkAuthStatus();
        closeDrawer();
      } catch (err) {
        alert(err.message || 'Password reset failed.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Reset Password & Sign In';
      }
    } else {
      try {
        const { data: success, error } = await insforge.database.rpc('verify_phone_reset_password', {
          p_phone: forgotIdentifier,
          p_code: enteredOtp,
          p_new_password: newPassword
        });

        if (error) {
          if (error.message && error.message.toLowerCase().includes('expired')) {
            throw new Error('Verification code expired. Please request a new code.');
          } else {
            throw new Error('Incorrect verification code.');
          }
        }

        alert('Password updated successfully.');

        const mockEmail = `${forgotIdentifier}@limraresturent.in`;
        await insforge.auth.signInWithPassword({
          email: mockEmail,
          password: newPassword
        });

        await checkAuthStatus();
        closeDrawer();
      } catch (err) {
        alert(err.message || 'Password reset failed.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Reset Password & Sign In';
      }
    }
  });

  // 6. Sign In Handler
  document.getElementById('form-signin')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rawVal = document.getElementById('signin-identifier').value.trim();

    const detected = detectInputType(rawVal);
    if (!detected) {
      alert('Please enter a valid email address or 10-digit mobile number.');
      return;
    }

    const password = detected.type === 'phone' ? detected.value : document.getElementById('signin-password').value;
    if (!password) {
      alert('Password is required.');
      return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';

    let email = detected.value;
    if (detected.type === 'phone') {
      email = `${detected.value}@limraresturent.in`;
    }

    try {
      const { data, error } = await insforge.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message && (error.message.toLowerCase().includes('invalid') || error.message.toLowerCase().includes('incorrect'))) {
          throw new Error('Incorrect password.');
        }
        throw error;
      }
      
      await checkAuthStatus();
      alert('Welcome to LIMRA Restaurant! You are now signed in.');
      closeDrawer();
    } catch (err) {
      displayError(err.message || 'Login failed. Please verify email/password.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In ➔';
    }
  });

  // 3. Google OAuth Handler
  document.getElementById('oauth-google-btn')?.addEventListener('click', async () => {
    try {
      await insforge.auth.signInWithOAuth({
        provider: 'google',
        redirectTo: window.location.origin
      });
    } catch (err) {
      displayError(err.message || 'Google Auth redirection failed.');
    }
  });

  // 4. Log Out Handler
  document.getElementById('auth-logout-btn')?.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to sign out?')) return;
    await insforge.auth.signOut();
    currentUser = null;
    userProfile = null;
    
    // Clear notifications subscriptions and state
    if (realtimeSubscribedPhone) {
      try {
        insforge.realtime.unsubscribe(`customer-notifications:${realtimeSubscribedPhone}`);
      } catch (err) {}
      realtimeSubscribedPhone = null;
    }
    if (pollingIntervalId) {
      clearInterval(pollingIntervalId);
      pollingIntervalId = null;
    }
    // Reset notification header elements
    const badgeEl = document.getElementById('customer-notif-badge');
    const countEl = document.getElementById('customer-notif-count');
    const listEl = document.getElementById('customer-notif-items');
    if (badgeEl) badgeEl.classList.add('hidden');
    if (countEl) countEl.textContent = '';
    if (listEl) listEl.innerHTML = `<p class="p-6 text-center text-xs text-slate-400 italic">No notifications yet</p>`;
    
    renderAuthUI();
    
    // Clear checkout inputs
    document.getElementById('order-customer-name').value = '';
    document.getElementById('order-customer-phone').value = '';
    document.getElementById('order-customer-email').value = '';
    if (document.getElementById('order-address')) {
      document.getElementById('order-address').value = '';
    }
    updateCartUI();
    
    alert('Signed out successfully.');
    closeDrawer();
  });

  // 5. Save Profile details
  document.getElementById('form-profile-details')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const phone = document.getElementById('profile-phone').value.trim();
    const address = document.getElementById('profile-address').value.trim();

    if (!phone || !address) {
      alert('Please fill out both phone and address fields.');
      return;
    }

    const saveBtn = document.getElementById('profile-save-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving details...';

    try {
      const profileUpdate = {
        id: currentUser.id,
        name: currentUser.name || userProfile?.name || 'Guest Client',
        phone,
        address,
        email: (currentUser.email && currentUser.email.endsWith('@limraresturent.in')) ? null : (currentUser.email || null),
        latitude: mapSelectedLat || userProfile?.latitude || null,
        longitude: mapSelectedLng || userProfile?.longitude || null,
        landmark: document.getElementById('order-landmark')?.value || userProfile?.landmark || null,
        delivery_notes: document.getElementById('order-delivery-notes')?.value || userProfile?.delivery_notes || null,
        location_verified: (document.getElementById('order-location-verified')?.value === 'true') || userProfile?.location_verified || false
      };

      const { error } = await insforge.database
        .from('customer_profiles')
        .upsert([profileUpdate]);

      if (error) throw error;

      userProfile = profileUpdate;
      
      // Auto-prefill the Checkout details
      document.getElementById('order-customer-name').value = userProfile.name;
      document.getElementById('order-customer-phone').value = userProfile.phone;
      document.getElementById('order-customer-email').value = userProfile.email;
      if (document.getElementById('order-address')) {
        document.getElementById('order-address').value = userProfile.address;
      }
      updateCartUI();

      alert('Permanent contact details and address saved successfully!');
      await loadUserHistory();
    } catch (err) {
      alert('Failed to save profile: ' + (err.message || err));
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Profile Details';
    }
  });

  // Initialize checks
  await checkAuthStatus();
}

async function checkAuthStatus() {
  try {
    const { data } = await insforge.auth.getCurrentUser();
    const user = data?.user || null;
    currentUser = user;
    
    if (user) {
      const { data: profiles, error } = await insforge.database
        .from('customer_profiles')
        .select('*')
        .eq('id', user.id);
        
      if (!error && profiles && profiles.length > 0) {
        userProfile = profiles[0];
        if (userProfile.email && userProfile.email.endsWith('@limraresturent.in')) {
          userProfile.email = null;
        }
      } else {
        const isMockEmail = user.email && user.email.endsWith('@limraresturent.in');
        userProfile = {
          id: user.id,
          name: user.name || 'Guest Client',
          phone: isMockEmail ? user.email.split('@')[0] : '',
          address: '',
          email: isMockEmail ? null : user.email
        };
      }
      
      // Auto-fill checkout fields immediately
      if (userProfile.name) document.getElementById('order-customer-name').value = userProfile.name;
      if (userProfile.phone) document.getElementById('order-customer-phone').value = userProfile.phone;
      if (userProfile.email) {
        document.getElementById('order-customer-email').value = userProfile.email;
      } else {
        document.getElementById('order-customer-email').value = '';
      }
      if (userProfile.address && document.getElementById('order-address')) {
        document.getElementById('order-address').value = userProfile.address;
      }
      if (userProfile.landmark && document.getElementById('order-landmark')) {
        document.getElementById('order-landmark').value = userProfile.landmark;
      }
      if (userProfile.delivery_notes && document.getElementById('order-delivery-notes')) {
        document.getElementById('order-delivery-notes').value = userProfile.delivery_notes;
      }
      if (userProfile.latitude && document.getElementById('order-latitude')) {
        document.getElementById('order-latitude').value = userProfile.latitude;
        mapSelectedLat = parseFloat(userProfile.latitude);
      }
      if (userProfile.longitude && document.getElementById('order-longitude')) {
        document.getElementById('order-longitude').value = userProfile.longitude;
        mapSelectedLng = parseFloat(userProfile.longitude);
      }
      if (userProfile.location_verified !== undefined && document.getElementById('order-location-verified')) {
        document.getElementById('order-location-verified').value = userProfile.location_verified ? 'true' : 'false';
        updateLocationBadge(userProfile.location_verified);
      }
      updateCartUI();

      // Load past orders
      await loadUserHistory();
    }
    
    renderAuthUI();
    // Start notifications listener for logged-in user or active guest
    startNotificationListening();
  } catch (err) {
    console.warn('Auth check failed:', err);
  }
}

function renderAuthUI() {
  const loggedOutView = document.getElementById('auth-logged-out-view');
  const loggedInView = document.getElementById('auth-logged-in-view');
  const loggedInDot = document.getElementById('user-logged-in-dot');

  if (currentUser) {
    loggedOutView?.classList.add('hidden');
    loggedInView?.classList.remove('hidden');
    loggedInDot?.classList.remove('hidden');

    const displayName = document.getElementById('profile-display-name');
    const displayEmail = document.getElementById('profile-display-email');
    const profilePhone = document.getElementById('profile-phone');
    const profileAddress = document.getElementById('profile-address');

    if (displayName) displayName.textContent = currentUser.name || userProfile?.name || 'Guest Client';
    if (displayEmail) {
      if (currentUser.email && currentUser.email.endsWith('@limraresturent.in')) {
        displayEmail.textContent = userProfile?.phone || currentUser.email.split('@')[0];
      } else {
        displayEmail.textContent = currentUser.email;
      }
    }
    if (profilePhone) profilePhone.value = userProfile?.phone || '';
    if (profileAddress) profileAddress.value = userProfile?.address || '';
  } else {
    loggedOutView?.classList.remove('hidden');
    loggedInView?.classList.add('hidden');
    loggedInDot?.classList.add('hidden');
  }
}

async function loadUserHistory() {
  const listEl = document.getElementById('profile-orders-list');
  if (!listEl) return;

  try {
    const phone = userProfile?.phone || '';
    if (!phone) {
      listEl.innerHTML = `<p class="text-xs text-slate-400 italic text-center">Save your phone number above to sync your order logs!</p>`;
      return;
    }

    const orders = await getCustomerOrders(phone);
    
    if (orders.length === 0) {
      listEl.innerHTML = `<p class="text-xs text-slate-400 italic text-center">No orders placed under this phone number yet.</p>`;
    } else {
      listEl.innerHTML = orders.slice(0, 5).map(o => {
        let badgeColor = 'bg-amber-50 text-amber-600 border-amber-200';
        if (o.status === 'delivered') badgeColor = 'bg-emerald-50 text-emerald-600 border-emerald-200';
        if (o.status === 'cancelled') badgeColor = 'bg-red-50 text-red-600 border-red-200';

        // Payment status badge
        const isPaid = (o.payment_status === 'paid');
        const payBadgeColor = isPaid 
          ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
          : 'bg-red-50 text-red-600 border-red-200';
        const payBadgeText = isPaid ? 'PAID' : 'UNPAID';

        let itemsSummary = o.items ? o.items.map(i => `${i.quantity}x ${i.item_name}`).join(', ') : '1x Dinner Special';

        return `
          <div class="order-log-card cursor-pointer hover:bg-slate-50 hover:border-slate-300 transition-all rounded-xl border p-3 text-[11px] space-y-1 bg-white" 
               data-order-id="${o.id}" 
               data-order-number="${o.order_number}" 
               style="border-color:var(--color-border)">
            <div class="flex justify-between items-center font-bold">
              <span class="text-slate-800 flex items-center gap-1">
                Order #${o.order_number}
                <span class="text-[9px] text-slate-400 font-normal hover:text-slate-600 flex items-center gap-0.5">
                  🔍 Track
                </span>
              </span>
              <div class="flex items-center gap-1.5">
                <span class="status-badge ${payBadgeColor} border px-2 py-0.5 rounded-full text-[9px]">${payBadgeText}</span>
                <span class="status-badge ${badgeColor} border px-2 py-0.5 rounded-full text-[9px]">${o.status}</span>
              </div>
            </div>
            <p class="text-slate-500 font-semibold truncate">${itemsSummary}</p>
            <div class="flex justify-between items-center text-slate-400 text-[10px] pt-1">
              <span>Total: ₹${Number(o.total_amount).toLocaleString('en-IN')}</span>
              <span>${new Date(o.created_at).toLocaleDateString('en-IN')}</span>
            </div>
          </div>
        `;
      }).join('');

      // Attach click listeners to cards
      const cards = listEl.querySelectorAll('.order-log-card');
      cards.forEach(card => {
        card.addEventListener('click', () => {
          const orderId = card.getAttribute('data-order-id');
          const orderNumber = card.getAttribute('data-order-number');
          if (orderId && orderNumber && typeof window.subscribeToOrderUpdates === 'function') {
            window.subscribeToOrderUpdates(orderId, orderNumber);
          } else {
            console.warn('subscribeToOrderUpdates is not available or missing attributes');
          }
        });
      });
    }
  } catch (err) {
    console.warn('Failed to load user history:', err);
    listEl.innerHTML = `<p class="text-xs text-slate-400 italic text-center">Could not load history details.</p>`;
  }
}

// ==========================================
// CUSTOMER NOTIFICATIONS SYSTEM
// ==========================================
let customerNotifAudioCtx = null;
let realtimeSubscribedPhone = null;
let pollingIntervalId = null;

function getCustomerAudioCtx() {
  if (!customerNotifAudioCtx) {
    customerNotifAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (customerNotifAudioCtx && customerNotifAudioCtx.state === 'suspended') {
    customerNotifAudioCtx.resume();
  }
  return customerNotifAudioCtx;
}

function playCustomerNotificationChime() {
  try {
    const ctx = getCustomerAudioCtx();
    if (!ctx) return;
    
    const playTone = (freq, startTime, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    
    const now = ctx.currentTime;
    playTone(880, now, 0.25);         // A5
    playTone(1109.73, now + 0.08, 0.45); // C#6
  } catch (err) {
    console.warn('Audio chime playback failed:', err);
  }
}

// Show a floating premium screen toast for notifications
function showCustomerNotificationToast(title, message) {
  const container = document.getElementById('customer-toast-container') || initCustomerToastContainer();
  const toast = document.createElement('div');
  toast.className = 'flex items-start gap-3 p-4 rounded-2xl shadow-xl border translate-y-2 opacity-0 transition-all duration-300 pointer-events-auto max-w-sm w-full';
  toast.style.cssText = 'background: rgba(255,255,255,0.95); backdrop-filter: blur(10px); border-color: var(--color-border); box-shadow: 0 10px 30px rgba(0,0,0,0.08); margin-left: auto;';
  
  // Custom colors based on notification type/status
  const accentColor = 'var(--color-accent)';
  
  toast.innerHTML = `
    <div class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm" style="background: rgba(0, 176, 116, 0.1); color: ${accentColor}">
      🔔
    </div>
    <div class="flex-1 space-y-0.5">
      <h4 class="text-xs font-bold text-slate-800">${title}</h4>
      <p class="text-[11px] text-slate-500 font-semibold leading-normal">${message}</p>
    </div>
    <button class="text-slate-400 hover:text-slate-600 transition-colors text-lg font-normal leading-none">&times;</button>
  `;
  
  toast.querySelector('button').addEventListener('click', () => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  });
  
  container.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => {
    toast.classList.remove('opacity-0', 'translate-y-2');
  }, 50);
  
  // Auto dismiss after 6 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }
  }, 6000);
}

function initCustomerToastContainer() {
  let container = document.getElementById('customer-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'customer-toast-container';
    container.className = 'fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none w-full max-w-sm px-4 md:px-0';
    document.body.appendChild(container);
  }
  return container;
}

// Render dynamic notifications dropdown list
let customerNotifications = [];

async function refreshCustomerNotifications(phone) {
  try {
    const listEl = document.getElementById('customer-notif-items');
    const badgeEl = document.getElementById('customer-notif-badge');
    const countEl = document.getElementById('customer-notif-count');
    if (!listEl) return;
    
    const notifs = await NotificationService.getUserNotifications(phone);
    customerNotifications = notifs;
    
    const unreadCount = notifs.filter(n => !n.is_read).length;
    
    // Update Badge
    if (badgeEl) {
      if (unreadCount > 0) {
        badgeEl.textContent = unreadCount;
        badgeEl.classList.remove('hidden');
      } else {
        badgeEl.classList.add('hidden');
      }
    }
    
    if (countEl) {
      countEl.textContent = unreadCount > 0 ? `(${unreadCount})` : '';
    }
    
    if (notifs.length === 0) {
      listEl.innerHTML = `<p class="p-6 text-center text-xs text-slate-400 italic">No notifications yet</p>`;
      return;
    }
    
    listEl.innerHTML = notifs.map(n => {
      const isUnread = !n.is_read;
      const bgStyle = isUnread ? 'background: #f8fafc;' : 'background: #ffffff;';
      const indicator = isUnread ? `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 absolute top-4 right-4"></span>` : '';
      
      let typeIcon = '🔔';
      let iconBg = 'rgba(100, 116, 139, 0.1)';
      let iconColor = '#64748b';
      
      switch (n.type) {
        case 'order_confirmed':
          typeIcon = '✅';
          iconBg = 'rgba(16, 185, 129, 0.1)';
          iconColor = '#10b981';
          break;
        case 'order_preparing':
          typeIcon = '🍳';
          iconBg = 'rgba(245, 158, 11, 0.1)';
          iconColor = '#f59e0b';
          break;
        case 'out_for_delivery':
          typeIcon = '🛵';
          iconBg = 'rgba(59, 130, 246, 0.1)';
          iconColor = '#3b82f6';
          break;
        case 'delivered':
          typeIcon = '🎁';
          iconBg = 'rgba(16, 185, 129, 0.1)';
          iconColor = '#10b981';
          break;
        case 'order_rejected':
          typeIcon = '❌';
          iconBg = 'rgba(239, 68, 68, 0.1)';
          iconColor = '#ef4444';
          break;
      }
      
      const timeStr = formatNotifTime(n.created_at);
      
      return `
        <div class="p-4 flex gap-3 relative cursor-pointer hover:bg-slate-50 transition-colors" data-notif-id="${n.id}" style="${bgStyle}">
          <div class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm" style="background: ${iconBg}; color: ${iconColor};">
            ${typeIcon}
          </div>
          <div class="flex-1 pr-4 space-y-0.5">
            <h4 class="text-xs font-bold text-slate-800 leading-snug">${n.title}</h4>
            <p class="text-[11px] text-slate-500 font-semibold leading-normal">${n.message || n.description}</p>
            <span class="text-[9px] text-slate-400 block pt-1 font-semibold">${timeStr}</span>
          </div>
          ${indicator}
        </div>
      `;
    }).join('');
    
    // Bind click events on notification items
    listEl.querySelectorAll('[data-notif-id]').forEach(el => {
      el.addEventListener('click', async (e) => {
        const id = el.dataset.notifId;
        const match = customerNotifications.find(x => x.id === id);
        if (match && !match.is_read) {
          try {
            const phone = getActiveCustomerPhone();
            if (phone) {
              await NotificationService.markAsRead(id, phone);
              await refreshCustomerNotifications(phone);
            }
          } catch (err) {
            console.warn('Failed to mark read:', err);
          }
        }
      });
    });
    
  } catch (err) {
    console.warn('Failed to refresh customer notifications:', err);
  }
}

function formatNotifTime(timestamp) {
  try {
    const diffMs = new Date() - new Date(timestamp);
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return new Date(timestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  } catch (e) {
    return 'Just now';
  }
}

async function initCustomerNotifications() {
  const bellBtn = document.getElementById('customer-notif-btn');
  const dropdown = document.getElementById('customer-notif-dropdown');
  const wrapper = document.getElementById('customer-notif-wrapper');
  const markAllBtn = document.getElementById('customer-notif-mark-all');
  const clearReadBtn = document.getElementById('customer-notif-view-history');
  
  if (!bellBtn || !dropdown) return;
  
  // Warm up audio on first click
  bellBtn.addEventListener('click', () => {
    getCustomerAudioCtx();
  });

  // Toggle dropdown
  bellBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = dropdown.classList.contains('hidden');
    if (isHidden) {
      dropdown.classList.remove('hidden');
      setTimeout(() => {
        dropdown.classList.remove('opacity-0', 'scale-95');
      }, 10);
      
      // Fetch latest notifications when opening
      const phone = getActiveCustomerPhone();
      if (phone) refreshCustomerNotifications(phone);
    } else {
      dropdown.classList.add('opacity-0', 'scale-95');
      setTimeout(() => dropdown.classList.add('hidden'), 200);
    }
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (wrapper && !wrapper.contains(e.target)) {
      dropdown.classList.add('opacity-0', 'scale-95');
      setTimeout(() => dropdown.classList.add('hidden'), 200);
    }
  });

  // Mark all read action
  markAllBtn?.addEventListener('click', async (e) => {
    e.stopPropagation();
    const phone = getActiveCustomerPhone();
    if (!phone) return;
    try {
      await NotificationService.markAllAsRead(phone);
      await refreshCustomerNotifications(phone);
    } catch (err) {
      console.warn('Failed to mark all read:', err);
    }
  });

  // Clear read notifications action
  clearReadBtn?.addEventListener('click', async (e) => {
    e.stopPropagation();
    const phone = getActiveCustomerPhone();
    if (!phone) return;
    try {
      if (!confirm('Are you sure you want to dismiss all read notifications?')) return;
      await NotificationService.markAllAsRead(phone);
      await refreshCustomerNotifications(phone);
    } catch (err) {
       console.warn('Failed to dismiss read notifications:', err);
    }
  });
  
  // Start Listening based on resolved customer profile or details
  startNotificationListening();
}

function getActiveCustomerPhone() {
  // 1. Check logged in profile
  if (userProfile && userProfile.phone) {
    return userProfile.phone.trim();
  }
  // 2. Check guest local storage details
  try {
    const raw = localStorage.getItem('limra-customer-details');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.phone) return parsed.phone.trim();
    }
  } catch (e) {}
  
  return null;
}

async function startNotificationListening() {
  const phone = getActiveCustomerPhone();
  if (!phone) {
    console.log('[NotificationCenter] No phone number identified. Waiting for checkout or login...');
    return;
  }
  
  const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
  if (cleanPhone.length < 10) return;
  
  // Avoid duplicate sockets for same phone
  if (realtimeSubscribedPhone === cleanPhone) return;
  
  // Unsubscribe old if different
  if (realtimeSubscribedPhone) {
    try {
      insforge.realtime.unsubscribe(`customer-notifications:${realtimeSubscribedPhone}`);
    } catch (err) {}
  }
  
  realtimeSubscribedPhone = cleanPhone;
  console.log(`[NotificationCenter] Initializing listeners for clean phone number: +91 ${cleanPhone}`);
  
  // Fetch initial notifications
  await refreshCustomerNotifications(phone);
  
  // Subscribe to Realtime Pub/Sub channel
  try {
    const channelName = `customer-notifications:${cleanPhone}`;
    insforge.realtime.on('connect', () => {
      console.log(`[NotificationCenter] Realtime WebSocket connected!`);
    });
    
    insforge.realtime.on('connect_error', (err) => {
      console.warn(`[NotificationCenter] Realtime connection error:`, err);
      startPollingFallback(phone);
    });

    insforge.realtime.on('disconnect', () => {
      console.log(`[NotificationCenter] Realtime disconnected.`);
      startPollingFallback(phone);
    });

    await insforge.realtime.connect();
    const subRes = await insforge.realtime.subscribe(channelName);
    
    if (subRes.error) {
      console.warn(`[NotificationCenter] Subscription failed:`, subRes.error);
      startPollingFallback(phone);
    } else {
      console.log(`[NotificationCenter] Subscribed successfully to channel: ${channelName}`);
      
      // Stop polling fallback if socket is active
      if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
        pollingIntervalId = null;
      }
      
      // Listen to notification_created event
      insforge.realtime.on('notification_created', (payload) => {
        console.log(`[NotificationCenter] Received realtime notification:`, payload);
        playCustomerNotificationChime();
        showCustomerNotificationToast(payload.title, payload.message);
        refreshCustomerNotifications(phone);
        loadUserHistory();
      });
    }
  } catch (err) {
    console.warn(`[NotificationCenter] Realtime initialization failed:`, err);
    startPollingFallback(phone);
  }
}

function startPollingFallback(phone) {
  if (pollingIntervalId) return; // Already polling
  
  console.log(`[NotificationCenter] Falling back to polling interval (20 seconds)...`);
  pollingIntervalId = setInterval(async () => {
    const activePhone = getActiveCustomerPhone();
    if (!activePhone) {
      clearInterval(pollingIntervalId);
      pollingIntervalId = null;
      return;
    }
    
    try {
      const count = await NotificationService.getUnreadCount(activePhone);
      const currentUnread = customerNotifications.filter(n => !n.is_read).length;
      
      // If server unread count differs from local, refresh list and alert
      if (count !== currentUnread) {
        console.log(`[NotificationCenter] Poller detected count mismatch (${count} vs ${currentUnread}). Refreshing...`);
        const oldNotifs = [...customerNotifications];
        await refreshCustomerNotifications(activePhone);
        
        // Find newly added unread notification
        const newNotifs = customerNotifications.filter(n => !n.is_read && !oldNotifs.some(o => o.id === n.id));
        if (newNotifs.length > 0) {
          playCustomerNotificationChime();
          newNotifs.forEach(n => {
            showCustomerNotificationToast(n.title, n.message || n.description);
          });
        }
      }
    } catch (e) {
      console.warn('[NotificationCenter] Polling error:', e);
    }
  }, 20000);
}
