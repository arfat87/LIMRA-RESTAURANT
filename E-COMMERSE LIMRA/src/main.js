import './style.css';
import { saveOrder, saveBooking, getCustomerBookings } from './lib/insforge.js';
import { menuItems, categoryImages, categoryLabels, categoryEmojis, categoryTabOrder } from './data/menu.js';
import { sendEmailNotification, generateOrderPlacedHtml } from './lib/email-service.js';


// ═══════════════════════════════════════
// CART STATE
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

let cart = loadCartFromStorage();

// ═══════════════════════════════════════
// DELIVERY STATE
// ═══════════════════════════════════════
const DELIVERY_RATE = 10; // ₹ per km
let isDelivery = true;    // true = delivery, false = self pickup
let deliveryKm = 0;       // km entered by customer
let deliveryMap = null;
let deliveryMarker = null;

function getDeliveryCharge() {
  if (!isDelivery) return 0;
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

function getCartCount() {
  return cart.reduce((sum, item) => sum + item.qty, 0);
}

function addToCart(id) {
  const item = menuItems.find(m => m.id === id);
  if (!item) return;
  const existing = cart.find(c => c.id === id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id: item.id, name: item.name, price: item.price, qty: 1 });
  }
  saveCart();
  updateCartUI();
  animateBadge();
}

function removeFromCart(id) {
  cart = cart.filter(c => c.id !== id);
  saveCart();
  updateCartUI();
}

function updateQty(id, delta) {
  const item = cart.find(c => c.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    removeFromCart(id);
    return;
  }
  saveCart();
  updateCartUI();
}

function clearCart() {
  cart = [];
  saveCart();
  updateCartUI();
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
    msg += `\n🛵 *Delivery Charge: ₹${delivery}*`;
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
    <div class="relative overflow-hidden" style="border-radius:12px 12px 0 0">
      <img src="${imgSrc}" alt="${item.name} — LIMRA Restaurant Egra menu" class="card-img" loading="lazy" width="400" height="300" />
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

function renderMenuGrid(containerId, category = 'all') {
  const grid = document.getElementById(containerId);
  if (!grid) return;

  grid.innerHTML = '';
  grid.classList.add('visible');
  grid.setAttribute('aria-busy', 'true');

  const filtered = category === 'all'
    ? menuItems
    : menuItems.filter(m => m.category === category);

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
      syncTabActiveState(cat);
      renderMenuGrid('menu-grid', cat);
      renderMenuGrid('order-grid', cat);
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
  if (!email || !email.includes('@')) {
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
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      }).addTo(deliveryMap);

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
    }

    setTimeout(() => {
      if (deliveryMap) deliveryMap.invalidateSize();
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

    const dist = haversineDistance(limraCoords[0], limraCoords[1], latlng.lat, latlng.lng);
    deliveryKm = Math.min(50, Math.max(0.1, dist));

    const distInput = document.getElementById('order-distance');
    if (distInput) {
      distInput.value = deliveryKm.toFixed(1);
    }

    const statusEl = document.getElementById('distance-calc-status');
    if (statusEl) {
      statusEl.innerHTML = `📍 Pinned: Delivery location pinned successfully!`;
      statusEl.style.color = '#00b074';
    }

    geocodeResolvedAddress = document.getElementById('order-address')?.value?.trim() || "";
    updateCartUI();

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}`);
      const data = await res.json();
      if (data && data.display_name) {
        const addrText = document.getElementById('order-address');
        if (addrText) {
          addrText.value = data.display_name;
          geocodeResolvedAddress = data.display_name;
        }
      }
    } catch (e) {
      console.warn('Reverse geocode failed:', e);
    }
  }

  async function locateAddress() {
    const addressVal = document.getElementById('order-address')?.value?.trim();
    if (!addressVal) {
      alert('Please enter your address in the textarea first, then click Locate.');
      return;
    }

    const btn = document.getElementById('locate-address-btn');
    if (!btn) return;
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '⌛ ...';

    try {
      const query = `${addressVal}, Egra, Purba Medinipur, West Bengal, India`;
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`);
      const data = await res.json();

      if (data && data.length > 0) {
         const latlng = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
         openMapModal();
         setTimeout(() => {
           if (deliveryMap) {
             deliveryMap.setView([latlng.lat, latlng.lng], 15);
             updatePinnedLocation(latlng);
           }
         }, 200);
      } else {
         const resFallback = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(addressVal)}`);
         const dataFallback = await resFallback.json();
         if (dataFallback && dataFallback.length > 0) {
           const latlng = { lat: parseFloat(dataFallback[0].lat), lng: parseFloat(dataFallback[0].lon) };
           openMapModal();
           setTimeout(() => {
             if (deliveryMap) {
               deliveryMap.setView([latlng.lat, latlng.lng], 15);
               updatePinnedLocation(latlng);
             }
           }, 200);
         } else {
           alert('Could not locate address on the map. Please manually click/tap directly on the map to pin your location.');
         }
      }
    } catch (e) {
      console.warn('Geocode search failed:', e);
      alert('Locating failed due to network rate-limiting. Please click/tap directly on the map to pin your location.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
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
    if (confirmMapBtn) confirmMapBtn.addEventListener('click', closeMapModal);
    if (mapModal) {
      mapModal.addEventListener('click', (e) => {
        if (e.target === mapModal) closeMapModal();
      });
    }

    const locateBtn = document.getElementById('locate-address-btn');
    if (locateBtn) {
      locateBtn.addEventListener('click', locateAddress);
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
    if (!email || !email.includes('@')) {
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

    if (!isDelivery) {
      if (loader) loader.classList.add('hidden');
      if (successBox) successBox.classList.remove('hidden');
      if (failedBox) failedBox.classList.add('hidden');
      if (resolvedAddressLabel) resolvedAddressLabel.textContent = "Self Pickup (Free)";
      if (resolvedKmLabel) resolvedKmLabel.textContent = "0.0";
      return;
    }

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

    if (!name || !phone) {
      alert('Please enter your name and phone number.');
      return;
    }
    if (!email || !email.includes('@')) {
      alert('Please enter a valid email address.');
      return;
    }
    if (isDelivery && !address) {
      alert('Please enter your delivery address.');
      return;
    }

    const deliveryNote = isDelivery
      ? `[DELIVERY] Address: ${address} | Distance: ${km.toFixed(1)} km | Delivery charge: ₹${charge}`
      : '[SELF PICKUP]';
    const emailNote = `[EMAIL: ${email}]`;
    const paymentNote = `[PAYMENT: ${payment}] | [PAYMENT_STATUS: ${payment === 'upi' ? 'COMPLETED' : 'PENDING'}]`;
    const combinedNotes = [deliveryNote, emailNote, paymentNote, notes].filter(Boolean).join(' | ');

    const btn = document.getElementById('place-order-btn');
    const statusEl = document.getElementById('order-status-msg');
    btn.disabled = true;
    btn.textContent = 'Placing order...';

    // Store cart before clearing it for the success notifications!
    const cartSnapshot = JSON.parse(JSON.stringify(cart));
    const subtotal = getCartSubtotal();

    const saveAndCompleteOrder = async () => {
      try {
        const order = await saveOrder({
          customerName: name,
          customerPhone: phone,
          items: cartSnapshot,
          notes: combinedNotes,
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
          distance: km
        };
        localStorage.setItem('limra-customer-details', JSON.stringify(savedDetails));
        initSavedAddressLoading(); // Refresh loading state

        // Send Automatic HTML Email Receipt to Customer
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

        // WhatsApp Confirmation Link
        let waMsg = `Hello! My order is placed successfully at SK Arif (Limra Restaurant).\n\n*Order Details:*\n• Name: ${name}\n• Phone: ${phone}\n• Email: ${email}\n`;
        let orderItemsText = '';
        cartSnapshot.forEach(item => {
          orderItemsText += `• ${item.name} x${item.qty} = ₹${item.price * item.qty}\n`;
        });
        orderItemsText += `\n*Subtotal: ₹${subtotal}*`;
        if (isDelivery) {
          orderItemsText += `\n🛵 *Delivery Charge: ₹${charge}*`;
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
        let emailBody = `Dear Restaurant Management,\n\nI have successfully placed an order on your website.\n\nOrder Details:\n---------------------------------------------\nReference: ${orderLabel}\nName: ${name}\nPhone: ${phone}\nEmail: ${email}\n`;
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

        clearCart();
        document.getElementById('order-customer-name').value = '';
        document.getElementById('order-customer-phone').value = '';
        document.getElementById('order-customer-email').value = '';
        if (document.getElementById('order-address')) document.getElementById('order-address').value = '';
        if (document.getElementById('order-distance')) document.getElementById('order-distance').value = '';
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
        // Show simulated banking verifications
        statusOverlay.classList.remove('pointer-events-none', 'opacity-0');
        overlayLoader.classList.remove('hidden');
        overlaySuccess.classList.add('hidden');

        // Delay 2s to simulate real transaction checking
        await new Promise(r => setTimeout(r, 2000));

        // Switch to complete payment screen
        overlayLoader.classList.add('hidden');
        overlaySuccess.classList.remove('hidden');

        // Let user see success overlay for 1.5s then complete order placement
        await new Promise(r => setTimeout(r, 1500));

        // Close UPI Modal and overlays
        modal.classList.add('pointer-events-none', 'opacity-0');
        modal.querySelector('#upi-modal-content').classList.add('scale-95');
        statusOverlay.classList.add('pointer-events-none', 'opacity-0');

        // Place and complete the order in DB
        await saveAndCompleteOrder();
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
