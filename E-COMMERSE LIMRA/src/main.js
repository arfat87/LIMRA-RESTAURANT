import './style.css';
import { saveOrder, saveBooking, getCustomerBookings } from './lib/insforge.js';
import { menuItems, categoryImages, categoryLabels, categoryEmojis, categoryTabOrder } from './data/menu.js';

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

function getDeliveryCharge() {
  if (!isDelivery) return 0;
  const km = Math.max(0, parseFloat(deliveryKm) || 0);
  return Math.round(km * DELIVERY_RATE);
}

function saveCart() {
  localStorage.setItem('limra-cart', JSON.stringify(cart));
}

function getCartSubtotal() {
  return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

function getCartTotal() {
  return getCartSubtotal() + getDeliveryCharge();
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
  const total = subtotal + delivery;

  // Badges
  document.getElementById('cart-badge').textContent = count;
  document.getElementById('cart-badge').classList.toggle('hidden', count === 0);
  const viewBadge = document.getElementById('view-cart-badge');
  if (viewBadge) viewBadge.textContent = count;

  // Footer
  document.getElementById('cart-count-text').textContent = count;
  document.getElementById('cart-subtotal').textContent = subtotal;
  document.getElementById('cart-total').textContent = total;
  document.getElementById('cart-footer').classList.toggle('hidden', count === 0);
  document.getElementById('cart-empty').classList.toggle('hidden', count > 0);

  // Delivery charge row
  const chargeRow = document.getElementById('delivery-charge-row');
  const chargeEl = document.getElementById('cart-delivery-charge');
  const kmLabel = document.getElementById('delivery-km-label');
  if (chargeRow && chargeEl && kmLabel) {
    const km = Math.max(0, parseFloat(deliveryKm) || 0);
    kmLabel.textContent = km % 1 === 0 ? km : km.toFixed(1);
    chargeEl.textContent = delivery;
    chargeRow.style.display = isDelivery ? '' : 'none';
  }

  // Items
  renderCartItems();

  // Update all add buttons
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
  const km = parseFloat(document.getElementById('order-distance')?.value) || 0;
  const delivery = getDeliveryCharge();
  const subtotal = getCartSubtotal();

  let msg = '🍽️ *Order from LIMRA Restaurant*\n\n';
  cart.forEach(item => {
    msg += `• ${item.name} x${item.qty} = ₹${item.price * item.qty}\n`;
  });
  msg += `\n*Subtotal: ₹${subtotal}*`;
  if (isDelivery) {
    msg += `\n🛵 *Delivery (${km} km × ₹10): ₹${delivery}*`;
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

function buildBookingPayload(type, data, extra = {}) {
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
    notes: data.notes || null,
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

  const btn = form.querySelector('.booking-submit-btn') || form.querySelector('button[type="submit"]');
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  try {
    const result = await saveBooking(buildBookingPayload(type, data, getExtra()));
    const ref = result?.booking_number ? `Booking #${result.booking_number}` : 'Booking';
    setBookingStatus(form, `✓ ${ref} received! We will confirm by phone soon.`);

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

  // ── Delivery type toggle ────────────────
  function initDelivery() {
    const btnDeliver = document.getElementById('delivery-type-deliver');
    const btnPickup  = document.getElementById('delivery-type-pickup');
    const addrBlock  = document.getElementById('delivery-address-block');
    const distInput  = document.getElementById('order-distance');
    if (!btnDeliver || !btnPickup) return;

    function setMode(delivery) {
      isDelivery = delivery;
      if (delivery) {
        btnDeliver.style.cssText = 'border-color:var(--color-accent); background:var(--color-accent); color:#fff';
        btnPickup.style.cssText  = 'border-color:var(--color-border); color:var(--color-text-muted); background:transparent';
        addrBlock.style.display  = '';
      } else {
        btnDeliver.style.cssText = 'border-color:var(--color-border); color:var(--color-text-muted); background:transparent';
        btnPickup.style.cssText  = 'border-color:var(--color-accent); background:var(--color-accent); color:#fff';
        addrBlock.style.display  = 'none';
        deliveryKm = 0;
      }
      updateCartUI();
    }

    btnDeliver.addEventListener('click', () => setMode(true));
    btnPickup.addEventListener('click',  () => setMode(false));

    // Live update when km changes
    distInput?.addEventListener('input', () => {
      deliveryKm = parseFloat(distInput.value) || 0;
      updateCartUI();
    });
  }
  initDelivery();

  // Place order (saved to admin dashboard)
  document.getElementById('place-order-btn').addEventListener('click', async () => {
    if (cart.length === 0) { alert('Your cart is empty! Add some items first.'); return; }
    const name    = document.getElementById('order-customer-name').value.trim();
    const phone   = document.getElementById('order-customer-phone').value.trim();
    const address = document.getElementById('order-address')?.value?.trim() || '';
    const notes   = document.getElementById('order-notes').value.trim();
    const km      = parseFloat(document.getElementById('order-distance')?.value) || 0;
    const charge  = getDeliveryCharge();

    if (!name || !phone) {
      alert('Please enter your name and phone number.');
      return;
    }
    if (isDelivery && !address) {
      alert('Please enter your delivery address.');
      return;
    }

    const deliveryNote = isDelivery
      ? `[DELIVERY] Address: ${address} | Distance: ${km} km | Delivery charge: ₹${charge}`
      : '[SELF PICKUP]';
    const combinedNotes = [deliveryNote, notes].filter(Boolean).join(' | ');

    const btn = document.getElementById('place-order-btn');
    const statusEl = document.getElementById('order-status-msg');
    btn.disabled = true;
    btn.textContent = 'Placing order...';

    try {
      const order = await saveOrder({
        customerName: name,
        customerPhone: phone,
        items: cart,
        notes: combinedNotes,
      });
      const orderLabel = order?.order_number ? `Order #${order.order_number}` : 'Your order';
      statusEl.textContent = `${orderLabel} placed! We will confirm soon.`;
      statusEl.style.color = 'var(--color-accent)';
      statusEl.classList.remove('hidden');
      clearCart();
      document.getElementById('order-customer-name').value = '';
      document.getElementById('order-customer-phone').value = '';
      if (document.getElementById('order-address')) document.getElementById('order-address').value = '';
      if (document.getElementById('order-distance')) document.getElementById('order-distance').value = '';
      document.getElementById('order-notes').value = '';
      deliveryKm = 0;
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
