import './style.css';

// ═══════════════════════════════════════
// MENU DATA
// ═══════════════════════════════════════
const menuItems = [
  // SOUP
  { id: 1, name: 'Chicken Manchow Soup', price: 60, category: 'soup', emoji: '🍲' },
  { id: 2, name: 'Hot & Sour Chicken Soup', price: 60, category: 'soup', emoji: '🍲' },
  { id: 3, name: 'Hot & Sour Veg Soup', price: 45, category: 'soup', emoji: '🍲' },
  { id: 4, name: 'Veg Manchow Soup', price: 50, category: 'soup', emoji: '🍲' },
  // STARTERS
  { id: 5, name: 'Chicken 65', price: 100, category: 'starters', emoji: '🍗' },
  { id: 6, name: 'Chicken Lollypop (5pc)', price: 150, category: 'starters', emoji: '🍗' },
  { id: 7, name: 'Crispy Veg', price: 100, category: 'starters', emoji: '🥦' },
  { id: 8, name: 'Crispy Chicken', price: 150, category: 'starters', emoji: '🍗' },
  { id: 9, name: 'Dragon Chicken', price: 150, category: 'starters', emoji: '🔥' },
  { id: 10, name: 'Gobi 65', price: 60, category: 'starters', emoji: '🥦' },
  { id: 11, name: 'Green Salad', price: 40, category: 'starters', emoji: '🥗' },
  { id: 12, name: 'Masala Papad', price: 30, category: 'starters', emoji: '🫓' },
  { id: 13, name: 'Paneer 65', price: 90, category: 'starters', emoji: '🧀' },
  // KABABS
  { id: 14, name: 'Chicken Tikka', price: 120, mrp: 140, discount: 15, category: 'kababs', emoji: '🔥' },
  { id: 15, name: 'Haryali Tikka (6pc)', price: 140, mrp: 150, discount: 7, category: 'kababs', emoji: '🔥' },
  { id: 16, name: 'Kalmi Kabab', price: 140, mrp: 150, discount: 7, category: 'kababs', emoji: '🔥' },
  { id: 17, name: 'Malai Tikka (6pc)', price: 150, mrp: 160, discount: 7, category: 'kababs', emoji: '🔥' },
  { id: 18, name: 'Sikhari Kabab', price: 140, mrp: 150, discount: 7, category: 'kababs', emoji: '🔥' },
  { id: 19, name: 'Tangdi Kabab (3pc)', price: 160, mrp: 180, discount: 12, category: 'kababs', emoji: '🔥' },
  // TANDOORI
  { id: 20, name: 'Tandoori Chicken Full', price: 380, category: 'tandoori', emoji: '🍗' },
  { id: 21, name: 'Tandoori Chicken Half', price: 200, category: 'tandoori', emoji: '🍗' },
  { id: 22, name: 'Quarter Tandoori', price: 100, mrp: 120, discount: 17, category: 'tandoori', emoji: '🍗' },
  { id: 23, name: 'Afgani Chicken Full', price: 400, mrp: 420, discount: 5, category: 'tandoori', emoji: '🍗' },
  { id: 24, name: 'Afgani Chicken Half', price: 200, mrp: 220, discount: 10, category: 'tandoori', emoji: '🍗' },
  // NON-VEG GRAVY
  { id: 25, name: 'Butter Chicken Masala', price: 160, category: 'nonveg-gravy', emoji: '🍛' },
  { id: 26, name: 'Chicken Curry', price: 120, category: 'nonveg-gravy', emoji: '🍛' },
  { id: 27, name: 'Chicken Do-Pyaza', price: 140, category: 'nonveg-gravy', emoji: '🍛' },
  { id: 28, name: 'Chicken Hydrabadi', price: 180, category: 'nonveg-gravy', emoji: '🍛' },
  { id: 29, name: 'Chicken Kosa', price: 120, category: 'nonveg-gravy', emoji: '🍛' },
  { id: 30, name: 'Chicken Masala', price: 120, category: 'nonveg-gravy', emoji: '🍛' },
  { id: 31, name: 'Chicken Tikka Masala', price: 150, category: 'nonveg-gravy', emoji: '🍛' },
  { id: 32, name: 'Egg Curry', price: 70, category: 'nonveg-gravy', emoji: '🥚' },
  { id: 33, name: 'Garlic Chicken', price: 130, category: 'nonveg-gravy', emoji: '🍛' },
  { id: 34, name: 'Handi Chicken', price: 140, category: 'nonveg-gravy', emoji: '🍛' },
  { id: 35, name: 'Kadai Chicken', price: 140, category: 'nonveg-gravy', emoji: '🍛' },
  { id: 36, name: 'Moghlai Chicken', price: 190, category: 'nonveg-gravy', emoji: '🍛' },
  { id: 37, name: 'Paper Chicken', price: 140, category: 'nonveg-gravy', emoji: '🍛' },
  { id: 38, name: 'Salt & Pepper Chicken', price: 140, category: 'nonveg-gravy', emoji: '🍛' },
  // VEG GRAVY / DAL
  { id: 39, name: 'Chana Masala', price: 90, category: 'veg-gravy', emoji: '🥘' },
  { id: 40, name: 'Dal Egg Tadka', price: 90, category: 'veg-gravy', emoji: '🥘' },
  { id: 41, name: 'Dal Tadka', price: 80, category: 'veg-gravy', emoji: '🥘' },
  { id: 42, name: 'Dal Butter Fry', price: 80, category: 'veg-gravy', emoji: '🥘' },
  { id: 43, name: 'Dal Fry', price: 70, category: 'veg-gravy', emoji: '🥘' },
  { id: 44, name: 'Kadai Veg', price: 130, category: 'veg-gravy', emoji: '🥘' },
  { id: 45, name: 'Mix Veg Masala', price: 120, category: 'veg-gravy', emoji: '🥘' },
  // PANEER
  { id: 46, name: 'Kadai Paneer', price: 130, category: 'paneer', emoji: '🧀' },
  { id: 47, name: 'Muttor Paneer', price: 130, category: 'paneer', emoji: '🧀' },
  { id: 48, name: 'Paneer Butter Masala', price: 140, category: 'paneer', emoji: '🧀' },
  { id: 49, name: 'Paneer Chilly', price: 120, category: 'paneer', emoji: '🧀' },
  // CHINESE
  { id: 50, name: 'Chicken Manchurian', price: 120, category: 'chinese', emoji: '🍜' },
  { id: 51, name: 'Chilly Chicken', price: 110, category: 'chinese', emoji: '🍜' },
  // BIRYANI
  { id: 52, name: 'Chicken Biryani', price: 120, category: 'biryani', emoji: '🍚' },
  { id: 53, name: 'Egg Biryani', price: 100, category: 'biryani', emoji: '🍚' },
  { id: 54, name: 'Aloo Biryani', price: 90, category: 'biryani', emoji: '🍚' },
  // RICE
  { id: 55, name: 'Chicken Fried Rice', price: 100, category: 'rice', emoji: '🍳' },
  { id: 56, name: 'Chicken Schezwan Rice', price: 110, category: 'rice', emoji: '🍳' },
  { id: 57, name: 'Egg Fried Rice', price: 90, category: 'rice', emoji: '🍳' },
  { id: 58, name: 'Egg Schezwan Rice', price: 100, category: 'rice', emoji: '🍳' },
  { id: 59, name: 'Mix Fried Rice', price: 140, category: 'rice', emoji: '🍳' },
  { id: 60, name: 'Veg Fried Rice', price: 80, category: 'rice', emoji: '🍳' },
  { id: 61, name: 'Veg Schezwan Rice', price: 90, category: 'rice', emoji: '🍳' },
  { id: 62, name: 'Ghee Rice', price: 110, category: 'rice', emoji: '🍳' },
  { id: 63, name: 'Jeera Rice', price: 90, category: 'rice', emoji: '🍳' },
  { id: 64, name: 'Khuska Rice', price: 80, category: 'rice', emoji: '🍳' },
  // NOODLES
  { id: 65, name: 'Chicken Noodles', price: 100, category: 'noodles', emoji: '🍝' },
  { id: 66, name: 'Chicken Schezwan Noodles', price: 110, category: 'noodles', emoji: '🍝' },
  { id: 67, name: 'Egg Noodles', price: 90, category: 'noodles', emoji: '🍝' },
  { id: 68, name: 'Egg Schezwan Noodles', price: 100, category: 'noodles', emoji: '🍝' },
  { id: 69, name: 'Mix Noodles', price: 140, category: 'noodles', emoji: '🍝' },
  { id: 70, name: 'Veg Noodles', price: 80, category: 'noodles', emoji: '🍝' },
  { id: 71, name: 'Veg Schezwan Noodles', price: 90, category: 'noodles', emoji: '🍝' },
  // BREAD
  { id: 72, name: 'Tandoori Roti', price: 15, category: 'bread', emoji: '🫓' },
  { id: 73, name: 'Butter Naan', price: 25, category: 'bread', emoji: '🫓' },
  { id: 74, name: 'Butter Roti', price: 20, mrp: 25, discount: 20, category: 'bread', emoji: '🫓' },
  { id: 75, name: 'Cheese Garlic Naan', price: 60, mrp: 70, discount: 15, category: 'bread', emoji: '🫓' },
  { id: 76, name: 'Cheese Naan', price: 50, mrp: 60, discount: 17, category: 'bread', emoji: '🫓' },
  { id: 77, name: 'Garlic Naan', price: 40, mrp: 50, discount: 20, category: 'bread', emoji: '🫓' },
  { id: 78, name: 'Kulcha', price: 25, mrp: 30, discount: 17, category: 'bread', emoji: '🫓' },
  { id: 79, name: 'Masala Kulcha', price: 40, mrp: 50, discount: 20, category: 'bread', emoji: '🫓' },
  { id: 80, name: 'Parotha', price: 25, category: 'bread', emoji: '🫓' },
  { id: 81, name: 'Aloo Parotha', price: 30, category: 'bread', emoji: '🫓' },
  { id: 82, name: 'Tandoori Parota', price: 20, mrp: 25, discount: 20, category: 'bread', emoji: '🫓' },
  // BEVERAGES
  { id: 83, name: 'Black Tea', price: 20, category: 'beverages', emoji: '☕' },
  { id: 84, name: 'Ginger Tea', price: 20, category: 'beverages', emoji: '☕' },
  { id: 85, name: 'Lemon Tea', price: 20, category: 'beverages', emoji: '☕' },
  { id: 86, name: 'Milk Tea', price: 20, category: 'beverages', emoji: '☕' },
  // OTHERS
  { id: 87, name: 'Ice Cream', price: 40, category: 'others', emoji: '🧊' },
  { id: 88, name: 'Water (Bottle)', price: 20, category: 'others', emoji: '💧' },
];

// ═══════════════════════════════════════
// CART STATE
// ═══════════════════════════════════════
let cart = JSON.parse(localStorage.getItem('limra-cart') || '[]');

function saveCart() {
  localStorage.setItem('limra-cart', JSON.stringify(cart));
}

function getCartTotal() {
  return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
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
  const total = getCartTotal();

  // Badges
  document.getElementById('cart-badge').textContent = count;
  document.getElementById('cart-badge').classList.toggle('hidden', count === 0);
  const viewBadge = document.getElementById('view-cart-badge');
  if (viewBadge) viewBadge.textContent = count;

  // Footer
  document.getElementById('cart-count-text').textContent = count;
  document.getElementById('cart-subtotal').textContent = total;
  document.getElementById('cart-total').textContent = total;
  document.getElementById('cart-footer').classList.toggle('hidden', count === 0);
  document.getElementById('cart-empty').classList.toggle('hidden', count > 0);

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
    row.className = 'cart-row bg-brand-dark/50 rounded-xl p-3 flex items-center gap-3';
    row.innerHTML = `
      <div class="flex-1 min-w-0">
        <p class="text-brand-cream text-sm font-medium truncate">${item.name}</p>
        <p class="text-brand-gold text-xs">₹${item.price} each</p>
      </div>
      <div class="flex items-center gap-2">
        <button class="qty-btn w-7 h-7 rounded-lg bg-brand-card border border-brand-border text-brand-cream text-sm hover:bg-brand-gold/20 transition-colors flex items-center justify-center" data-id="${item.id}" data-delta="-1">−</button>
        <span class="text-brand-cream font-semibold text-sm w-5 text-center">${item.qty}</span>
        <button class="qty-btn w-7 h-7 rounded-lg bg-brand-card border border-brand-border text-brand-cream text-sm hover:bg-brand-gold/20 transition-colors flex items-center justify-center" data-id="${item.id}" data-delta="1">+</button>
      </div>
      <div class="text-right min-w-[3rem]">
        <p class="text-brand-gold text-sm font-semibold">₹${item.price * item.qty}</p>
        <button class="text-brand-muted hover:text-brand-maroon text-xs transition-colors remove-btn" data-id="${item.id}">remove</button>
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
  let msg = '🍽️ *Order from LIMRA Restaurant*\n\n';
  cart.forEach(item => {
    msg += `• ${item.name} x${item.qty} = ₹${item.price * item.qty}\n`;
  });
  msg += `\n*Total: ₹${getCartTotal()}*\n\n`;
  msg += 'Please confirm my order. Thank you! 🙏';
  return encodeURIComponent(msg);
}

// ═══════════════════════════════════════
// RENDER MENU CARDS
// ═══════════════════════════════════════
function createMenuCard(item, isOrderSection = false) {
  const card = document.createElement('div');
  card.className = `menu-card bg-brand-card border border-brand-border rounded-2xl p-4 flex flex-col gap-3 menu-item`;
  card.dataset.category = item.category;

  const discountBadge = item.discount
    ? `<span class="absolute top-2 right-2 bg-brand-maroon text-white text-[10px] font-bold px-2 py-0.5 rounded-full">${item.discount}% OFF</span>`
    : '';
  const mrpLine = item.mrp
    ? `<span class="text-brand-muted text-xs line-through ml-1">₹${item.mrp}</span>`
    : '';

  card.innerHTML = `
    <div class="relative">
      <div class="w-12 h-12 rounded-xl bg-brand-gold/10 flex items-center justify-center text-2xl mb-2">${item.emoji}</div>
      ${discountBadge}
    </div>
    <div class="flex-1">
      <h3 class="text-brand-cream font-medium text-sm leading-snug">${item.name}</h3>
    </div>
    <div class="flex items-center justify-between mt-auto">
      <div class="flex items-baseline gap-1">
        <span class="text-brand-gold font-bold text-base">₹${item.price}</span>
        ${mrpLine}
      </div>
      <button class="add-btn px-3 py-1.5 rounded-xl bg-brand-gold/10 border border-brand-border text-brand-gold text-xs font-semibold hover:bg-brand-gold hover:text-brand-dark transition-all duration-200" data-id="${item.id}">
        + Add to Cart
      </button>
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
  grid.innerHTML = '';
  const filtered = category === 'all' ? menuItems : menuItems.filter(m => m.category === category);
  filtered.forEach(item => {
    grid.appendChild(createMenuCard(item));
  });
  updateCartUI();
}

// ═══════════════════════════════════════
// MENU & ORDER FILTER TABS
// ═══════════════════════════════════════
function initMenuTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => {
        t.classList.remove('active', 'bg-brand-gold', 'text-brand-dark');
        t.classList.add('text-brand-muted');
      });
      tab.classList.add('active', 'bg-brand-gold', 'text-brand-dark');
      tab.classList.remove('text-brand-muted');
      const cat = tab.dataset.category;
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
// BOOKING FORMS → WHATSAPP
// ═══════════════════════════════════════
const WA_NUMBER = '919739083418';

function submitToWhatsApp(message) {
  const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}

function initBookingForms() {
  // Table booking
  const tableForm = document.getElementById('table-booking-form');
  tableForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(tableForm));
    const seat = document.getElementById('seat-selected-label')?.textContent || 'Not selected';
    const msg = `🪑 *Table Booking — LIMRA Restaurant*\n\n` +
      `Name: ${data.name}\nPhone: ${data.phone}\nDate: ${data.date}\nTime: ${data.time}\nGuests: ${data.guests}\nPreference: ${data.preference}\nSeat Selected: ${seat}\nNotes: ${data.notes || 'None'}\n\nPlease confirm my table booking. Thank you!`;
    submitToWhatsApp(msg);
  });

  // Party booking
  const partyForm = document.getElementById('party-booking-form');
  partyForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(partyForm));
    const msg = `🎉 *Party Booking — LIMRA Restaurant*\n\n` +
      `Name: ${data.name}\nPhone: ${data.phone}\nEvent: ${data.event}\nDate: ${data.date}\nGuests: ${data.guests}\nBudget: ${data.budget}\nMessage: ${data.message || 'None'}\n\nPlease confirm my party booking. Thank you!`;
    submitToWhatsApp(msg);
  });

  // Wedding booking
  const weddingForm = document.getElementById('wedding-booking-form');
  weddingForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(weddingForm));
    const msg = `💍 *Wedding Booking Enquiry — LIMRA Restaurant*\n\n` +
      `Name: ${data.name}\nPhone: ${data.phone}\nEvent Date: ${data.date}\nGuests: ${data.guests}\nCatering: ${data.catering}\nVenue: ${data.venue}\nMessage: ${data.message || 'None'}\n\nPlease share your wedding packages. Thank you!`;
    submitToWhatsApp(msg);
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
  const filters = document.querySelectorAll('.gallery-filter');
  const items = document.querySelectorAll('.gallery-item');

  filters.forEach(filter => {
    filter.addEventListener('click', () => {
      filters.forEach(f => {
        f.classList.remove('active', 'bg-brand-gold', 'text-brand-dark');
        f.classList.add('text-brand-muted');
      });
      filter.classList.add('active', 'bg-brand-gold', 'text-brand-dark');
      filter.classList.remove('text-brand-muted');

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
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(el => {
    observer.observe(el);
  });
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
    // Animate bars
    const b1 = document.getElementById('ham-bar1');
    const b2 = document.getElementById('ham-bar2');
    const b3 = document.getElementById('ham-bar3');
    if (open) {
      b1.style.transform = 'rotate(45deg) translate(5px, 6px)';
      b2.style.opacity = '0';
      b3.style.transform = 'rotate(-45deg) translate(5px, -6px)';
    } else {
      b1.style.transform = '';
      b2.style.opacity = '1';
      b3.style.transform = '';
    }
  });

  // Close on mobile nav link click
  document.querySelectorAll('.mobile-nav-link').forEach(link => {
    link.addEventListener('click', () => {
      open = false;
      nav.classList.add('hidden');
      document.getElementById('ham-bar1').style.transform = '';
      document.getElementById('ham-bar2').style.opacity = '1';
      document.getElementById('ham-bar3').style.transform = '';
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
  // Render menus
  renderMenuGrid('menu-grid');
  renderMenuGrid('order-grid');
  updateCartUI();

  // Cart drawer
  document.getElementById('cart-toggle-btn').addEventListener('click', openCart);
  document.getElementById('cart-close-btn').addEventListener('click', closeCart);
  document.getElementById('cart-overlay').addEventListener('click', closeCart);
  document.getElementById('cart-clear-btn').addEventListener('click', clearCart);
  document.getElementById('view-cart-btn').addEventListener('click', openCart);
  document.getElementById('cart-browse-btn')?.addEventListener('click', closeCart);

  // WhatsApp order
  document.getElementById('order-whatsapp-btn').addEventListener('click', () => {
    if (cart.length === 0) { alert('Your cart is empty! Add some items first.'); return; }
    const url = `https://wa.me/${WA_NUMBER}?text=${buildOrderMessage()}`;
    window.open(url, '_blank');
  });

  // Init all modules
  initMenuTabs();
  initBookingTabs();
  initBookingForms();
  initSeatSelection();
  initGallery();
  initScrollAnimations();
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
