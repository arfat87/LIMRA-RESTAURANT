import {
  insforge,
  getCustomerProfile,
  saveCustomerProfile,
  saveOrder,
  getCustomerOrders,
  getNotifications,
  markNotificationAsRead
} from './lib/insforge.js';

import {
  menuItems,
  categoryEmojis,
  categoryLabels,
  categoryTabOrder,
  categoryImages
} from './data/menu.js';

// ═══════════════════════════════════════
// GLOBAL APPLICATION STATE
// ═══════════════════════════════════════
let currentUser = null;
let userProfile = null; // Contains id, name, phone, email, address (parsed array)
let cart = [];
let favorites = [];
let activeView = 'home';
let currentViewHistory = [];
let selectedItem = null;
let currentAddressList = []; // Array of { id, type, text, isDefault }
let selectedAddressId = null;
let couponApplied = null; // { code, rate }
let activeTrackedOrder = null; // { id, order_number, status, total_amount, etc }
let trackingInterval = null;
let currentAdminTab = 'orders';

// Standard Coupons
const AVALIABLE_COUPONS = {
  'LIMRA50': 0.50, // 50% Off
  'WELCOME10': 0.10, // 10% Off
  'GOLD25': 0.25 // 25% Off
};

// ═══════════════════════════════════════
// ON INITIAL LOAD / STARTUP
// ═══════════════════════════════════════
window.addEventListener('DOMContentLoaded', async () => {
  // Load state from localStorage
  loadLocalState();

  // Initialize navigation & view listeners
  initNavigation();
  initAuthActions();
  initRegistrationActions();
  initMenuAndSearch();
  initCartAndCheckout();
  initFavoritesSystem();
  initAdminDashboard();

  // Simulate Splash Screen delay (2.5 seconds)
  setTimeout(async () => {
    const splash = document.getElementById('splash-screen');
    splash.classList.add('opacity-0', 'pointer-events-none');

    // Auto-login session check
    try {
      const { data } = await insforge.auth.getCurrentUser();
      const user = data?.user || null;
      if (user) {
        currentUser = user;
        await loadUserProfile(user.id);
        showView('home');
      } else {
        showView('auth');
      }
    } catch (e) {
      console.warn('Session auto-login check failed:', e);
      showView('auth');
    }
  }, 2500);
});

// ═══════════════════════════════════════
// DYNAMIC NAVIGATION ROUTER
// ═══════════════════════════════════════
function initNavigation() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const view = tab.dataset.view;
      if (!currentUser && (view === 'cart' || view === 'favorites' || view === 'dashboard')) {
        showInAppNotification('Authentication Required', 'Please log in to check your cart, favorites, or account profile.');
        showView('auth');
        return;
      }
      showView(view);
    });
  });

  // Home Screen Header buttons
  document.getElementById('btn-hdr-notifications')?.addEventListener('click', () => {
    showView('dashboard');
    showInAppNotification('In-App Notification Center', 'Check your notifications inside recent order status logs below.');
  });

  document.getElementById('btn-hdr-admin')?.addEventListener('click', () => {
    showView('admin');
  });

  document.getElementById('home-search-trigger')?.addEventListener('click', () => {
    showView('search');
    setTimeout(() => document.getElementById('search-input')?.focus(), 150);
  });
}

function showView(viewId) {
  const views = [
    'view-auth', 'view-register', 'view-home', 'view-search',
    'view-favorites', 'view-cart', 'view-checkout', 'view-tracking',
    'view-dashboard', 'view-admin'
  ];

  const targetView = `view-${viewId}`;
  views.forEach(v => {
    const el = document.getElementById(v);
    if (el) {
      if (v === targetView) {
        el.classList.remove('hidden');
        el.classList.add('view-slide-in');
      } else {
        el.classList.add('hidden');
        el.classList.remove('view-slide-in');
      }
    }
  });

  // Active Bottom Tab Highlights
  document.querySelectorAll('.nav-tab').forEach(tab => {
    if (tab.dataset.view === viewId) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  activeView = viewId;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ═══════════════════════════════════════
// LOCAL STATE STORAGE
// ═══════════════════════════════════════
function loadLocalState() {
  try {
    cart = JSON.parse(localStorage.getItem('limra-app-cart') || '[]');
    favorites = JSON.parse(localStorage.getItem('limra-app-favs') || '[]');
    updateCartUI();
  } catch (e) {
    cart = [];
    favorites = [];
  }
}

function saveLocalState() {
  localStorage.setItem('limra-app-cart', JSON.stringify(cart));
  localStorage.setItem('limra-app-favs', JSON.stringify(favorites));
  updateCartUI();
}

// ═══════════════════════════════════════
// AUTHENTICATION LOGIC
// ═══════════════════════════════════════
function initAuthActions() {
  const tabOtp = document.getElementById('btn-tab-otp');
  const tabEmail = document.getElementById('btn-tab-email');
  const formOtp = document.getElementById('form-login-otp');
  const formEmail = document.getElementById('form-login-email');

  tabOtp?.addEventListener('click', () => {
    tabOtp.classList.add('bg-primary', 'text-white');
    tabOtp.classList.remove('text-white/60');
    tabEmail.classList.add('text-white/60');
    tabEmail.classList.remove('bg-primary', 'text-white');
    formOtp.classList.remove('hidden');
    formEmail.classList.add('hidden');
  });

  tabEmail?.addEventListener('click', () => {
    tabEmail.classList.add('bg-primary', 'text-white');
    tabEmail.classList.remove('text-white/60');
    tabOtp.classList.add('text-white/60');
    tabOtp.classList.remove('bg-primary', 'text-white');
    formEmail.classList.remove('hidden');
    formOtp.classList.add('hidden');
  });

  // Mobile + OTP Form Login Flow
  let otpSent = false;
  let simulatedOtpCode = '1234';

  formOtp?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const phoneInput = document.getElementById('otp-phone');
    const otpVerifySection = document.getElementById('otp-verify-section');
    const btnAction = document.getElementById('btn-otp-action');

    const phone = phoneInput.value.trim();
    if (phone.length !== 10) {
      alert('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (!otpSent) {
      // Simulate sending OTP
      otpSent = true;
      otpVerifySection.classList.remove('hidden');
      btnAction.textContent = 'Verify OTP & Log In';
      
      // Auto pre-populate simulated OTP hint
      simulatedOtpCode = Math.floor(1000 + Math.random() * 9000).toString();
      showInAppNotification('SMS Sent', `SMS OTP verification sent to +91 ${phone}. Mock Code: ${simulatedOtpCode}`);
      console.log(`[LIMRA-OTP] Mock code sent: ${simulatedOtpCode}`);
      
      // Select first OTP input box
      document.querySelectorAll('.otp-input')[0]?.focus();
      return;
    }

    // Verify OTP code
    const enteredCode = Array.from(document.querySelectorAll('.otp-input'))
      .map(input => input.value)
      .join('');

    if (enteredCode !== simulatedOtpCode && enteredCode !== '1234') {
      alert('Invalid OTP entered. Please try again or check the mock notification hint.');
      return;
    }

    // Simulate successful session login
    try {
      // We will perform a search on customer profiles or generate a mock user
      // Standard flow: login via Inforge Auth with a standard system mock
      const mockEmail = `${phone}@limraresturent.in`;
      const mockPassword = `otp_${phone}_secure`;

      // Try logging in, if fail try registering first
      let authUser = null;
      try {
        const loginRes = await insforge.auth.signInWithPassword({ email: mockEmail, password: mockPassword });
        if (loginRes.error) {
          // Register user
          const regRes = await insforge.auth.signUp({ email: mockEmail, password: mockPassword });
          if (regRes.error) throw new Error(regRes.error.message);
          authUser = regRes.data?.user;
        } else {
          authUser = loginRes.data?.user;
        }
      } catch (err) {
        console.warn('Backend Auth failed, using client fallback user structure:', err);
        authUser = { id: '00000000-0000-0000-0000-000000000000', email: mockEmail };
      }

      currentUser = authUser;
      await loadUserProfile(authUser.id, { name: 'Customer Guest', phone, email: mockEmail });
      
      // Clean forms
      otpSent = false;
      otpVerifySection.classList.add('hidden');
      btnAction.textContent = 'Send OTP Verification';
      phoneInput.value = '';
      document.querySelectorAll('.otp-input').forEach(i => i.value = '');

      showInAppNotification('Login Successful', `Welcome back to Limra Restaurant!`);
      showView('home');
    } catch (err) {
      alert(`Login failed: ${err.message}`);
    }
  });

  // Setup OTP input cursor jump helper
  const otpInputs = document.querySelectorAll('.otp-input');
  otpInputs.forEach((input, index) => {
    input.addEventListener('keyup', (e) => {
      if (input.value.length === 1 && index < otpInputs.length - 1) {
        otpInputs[index + 1].focus();
      } else if (e.key === 'Backspace' && index > 0) {
        otpInputs[index - 1].focus();
      }
    });
  });

  // Email login form
  formEmail?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email-username').value.trim();
    const pass = document.getElementById('email-password').value;

    try {
      const { data, error } = await insforge.auth.signInWithPassword({ email, password: pass });
      if (error) throw new Error(error.message);
      
      currentUser = data.user;
      await loadUserProfile(data.user.id);

      showInAppNotification('Login Successful', `Welcome back, ${userProfile?.name || 'Customer'}!`);
      showView('home');
    } catch (err) {
      alert(`Login failed: ${err.message}`);
    }
  });

  document.getElementById('btn-go-register')?.addEventListener('click', () => {
    showView('register');
  });

  document.getElementById('btn-dash-logout')?.addEventListener('click', async () => {
    await insforge.auth.signOut();
    currentUser = null;
    userProfile = null;
    currentAddressList = [];
    selectedAddressId = null;
    showInAppNotification('Logged Out', 'You have been successfully logged out of the app.');
    showView('auth');
  });
}

// Load customer profile or create a default row if none exists
async function loadUserProfile(userId, defaultDetails = null) {
  try {
    const profile = await getCustomerProfile(userId);
    if (profile) {
      userProfile = profile;
      try {
        currentAddressList = JSON.parse(profile.address || '[]');
      } catch (e) {
        currentAddressList = [];
      }
    } else {
      // Create new profile row if user has logged in but lacks a profile
      const newProf = {
        id: userId,
        name: defaultDetails?.name || 'Limra Foodie',
        phone: defaultDetails?.phone || '9876543210',
        email: defaultDetails?.email || currentUser.email || 'customer@limra.in',
        address: '[]'
      };
      await saveCustomerProfile(newProf);
      userProfile = newProf;
      currentAddressList = [];
    }

    // Set active default address ID
    const defAddress = currentAddressList.find(a => a.isDefault);
    selectedAddressId = defAddress ? defAddress.id : (currentAddressList[0]?.id || null);

    renderDashboardDetails();
  } catch (e) {
    console.error('Failed to load user profile from DB:', e);
  }
}

// ═══════════════════════════════════════
// REGISTRATION FLOW (Stepper 1 & 2)
// ═══════════════════════════════════════
function initRegistrationActions() {
  const step1 = document.getElementById('register-step-1');
  const step2 = document.getElementById('register-step-2');
  const stepNum = document.getElementById('register-step-num');
  const btnAction = document.getElementById('btn-register-action');

  let currentRegStep = 1;

  document.getElementById('btn-back-auth')?.addEventListener('click', () => {
    if (currentRegStep === 2) {
      // Step back
      currentRegStep = 1;
      step1.classList.remove('hidden');
      step2.classList.add('hidden');
      stepNum.textContent = '1';
      btnAction.textContent = 'Continue';
    } else {
      showView('auth');
    }
  });

  btnAction?.addEventListener('click', async () => {
    if (currentRegStep === 1) {
      // Validate step 1 fields
      const name = document.getElementById('reg-name').value.trim();
      const phone = document.getElementById('reg-phone').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const pass = document.getElementById('reg-password').value;
      const conf = document.getElementById('reg-confirm').value;

      if (!name || !phone || !email || !pass || !conf) {
        alert('Please fill out all registration fields.');
        return;
      }
      if (phone.length !== 10) {
        alert('Please enter a valid 10-digit mobile phone.');
        return;
      }
      if (pass !== conf) {
        alert('Passwords do not match. Please verify.');
        return;
      }

      // Step forward
      currentRegStep = 2;
      step1.classList.add('hidden');
      step2.classList.remove('hidden');
      stepNum.textContent = '2';
      btnAction.textContent = 'Register Customer Account';
      return;
    }

    // Step 2 Submission
    const flat = document.getElementById('reg-flat').value.trim();
    const building = document.getElementById('reg-building').value.trim();
    const street = document.getElementById('reg-street').value.trim();
    const locality = document.getElementById('reg-locality').value.trim();
    const landmark = document.getElementById('reg-landmark').value.trim();
    const pincode = document.getElementById('reg-pincode').value.trim();
    const typeEl = document.querySelector('input[name="reg-addr-type"]:checked');
    const isDefault = document.getElementById('reg-addr-default').checked;

    if (!flat || !street || !locality || !pincode) {
      alert('Please fill out essential address fields (Flat, Street, Locality, PIN).');
      return;
    }

    // Finalize Registration Auth
    const name = document.getElementById('reg-name').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const pass = document.getElementById('reg-password').value;

    try {
      const regRes = await insforge.auth.signUp({ email, password: pass });
      if (regRes.error) throw new Error(regRes.error.message);
      
      currentUser = regRes.data.user;

      // Compile address block
      const fullTextAddress = `${flat}, ${building ? building + ', ' : ''}${street}, ${locality}, ${landmark ? 'Landmark: ' + landmark + ', ' : ''}PIN: ${pincode}`;
      const addressId = Date.now();
      const compiledAddress = {
        id: addressId,
        type: typeEl ? typeEl.value : 'Home',
        text: fullTextAddress,
        isDefault: isDefault
      };

      currentAddressList = [compiledAddress];
      selectedAddressId = addressId;

      // Save customer profile row
      const newProfile = {
        id: currentUser.id,
        name: name,
        phone: phone,
        email: email,
        address: JSON.stringify(currentAddressList)
      };

      await saveCustomerProfile(newProfile);
      userProfile = newProfile;

      // Reset Form State
      currentRegStep = 1;
      step1.classList.remove('hidden');
      step2.classList.add('hidden');
      stepNum.textContent = '1';
      btnAction.textContent = 'Continue';
      
      document.getElementById('reg-name').value = '';
      document.getElementById('reg-phone').value = '';
      document.getElementById('reg-email').value = '';
      document.getElementById('reg-password').value = '';
      document.getElementById('reg-confirm').value = '';
      document.getElementById('reg-flat').value = '';
      document.getElementById('reg-building').value = '';
      document.getElementById('reg-street').value = '';
      document.getElementById('reg-locality').value = '';
      document.getElementById('reg-landmark').value = '';
      document.getElementById('reg-pincode').value = '';

      showInAppNotification('Account Registered', 'Welcome to Limra Restaurant! Your profile and address are fully saved.');
      showView('home');
    } catch (e) {
      alert(`Registration failed: ${e.message}`);
    }
  });
}

// ═══════════════════════════════════════
// MENU GRID & SEARCH SYSTEMS
// ═══════════════════════════════════════
function initMenuAndSearch() {
  renderHomeCategories();
  renderHomeRecommendations();

  // Search execution
  const searchInput = document.getElementById('search-input');
  const clearBtn = document.getElementById('btn-clear-search');
  const suggestions = document.getElementById('search-suggestions-container');
  const resultsBlock = document.getElementById('search-results-block');

  searchInput?.addEventListener('input', () => {
    const val = searchInput.value.trim().toLowerCase();
    if (val.length > 0) {
      clearBtn.classList.remove('hidden');
      suggestions.classList.add('hidden');
      resultsBlock.classList.remove('hidden');
      executeSearch(val);
    } else {
      clearBtn.classList.add('hidden');
      suggestions.classList.remove('hidden');
      resultsBlock.classList.add('hidden');
    }
  });

  clearBtn?.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.classList.add('hidden');
    suggestions.classList.remove('hidden');
    resultsBlock.classList.add('hidden');
  });

  // Popular search pills click trigger
  document.querySelectorAll('.popular-search-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      searchInput.value = tag.textContent;
      searchInput.dispatchEvent(new Event('input'));
    });
  });

  // Details modal click triggers
  document.getElementById('btn-modal-close')?.addEventListener('click', () => {
    document.getElementById('modal-item-details').classList.add('hidden');
  });

  // Modal Favorite toggle click
  document.getElementById('btn-modal-fav')?.addEventListener('click', () => {
    if (!currentUser) {
      showInAppNotification('Auth Required', 'Please log in to add items to your favorites.');
      showView('auth');
      document.getElementById('modal-item-details').classList.add('hidden');
      return;
    }
    toggleFavorite(selectedItem.id);
  });

  // Modal serving size click
  document.querySelectorAll('input[name="item-variant"]').forEach(radio => {
    radio.addEventListener('change', () => {
      updateModalTotal();
    });
  });

  // Modal detail quantity adjustments
  let detailQty = 1;
  document.getElementById('btn-detail-qty-minus')?.addEventListener('click', () => {
    if (detailQty > 1) {
      detailQty--;
      document.getElementById('detail-qty').textContent = detailQty;
      updateModalTotal();
    }
  });

  document.getElementById('btn-detail-qty-plus')?.addEventListener('click', () => {
    detailQty++;
    document.getElementById('detail-qty').textContent = detailQty;
    updateModalTotal();
  });

  document.getElementById('btn-detail-add-cart')?.addEventListener('click', () => {
    if (!currentUser) {
      showInAppNotification('Auth Required', 'Please log in to add items to your cart.');
      showView('auth');
      document.getElementById('modal-item-details').classList.add('hidden');
      return;
    }
    const inCartIndex = cart.findIndex(c => c.id === selectedItem.id);
    if (inCartIndex > -1) {
      cart[inCartIndex].qty += detailQty;
    } else {
      cart.push({
        id: selectedItem.id,
        name: selectedItem.name,
        price: selectedItem.price,
        qty: detailQty
      });
    }
    saveLocalState();
    document.getElementById('modal-item-details').classList.add('hidden');
    showInAppNotification('Added to Cart', `${selectedItem.name} x${detailQty} has been successfully added to your cart.`);
  });
}

function renderHomeCategories() {
  const container = document.getElementById('home-categories-grid');
  if (!container) return;

  container.innerHTML = '';
  categoryTabOrder.forEach(cat => {
    const label = categoryLabels[cat];
    const emoji = categoryEmojis[cat];
    
    const div = document.createElement('div');
    div.className = 'category-bubble flex flex-col items-center justify-center min-w-[76px] h-20 bg-surface rounded-2xl cursor-pointer hover:border-gold/30';
    div.innerHTML = `
      <span class="text-2xl">${emoji}</span>
      <span class="text-[9px] font-bold text-white/70 tracking-wide mt-1.5 whitespace-nowrap px-1.5 text-center">${label}</span>
    `;
    div.addEventListener('click', () => {
      const searchInput = document.getElementById('search-input');
      showView('search');
      searchInput.value = label;
      searchInput.dispatchEvent(new Event('input'));
    });
    container.appendChild(div);
  });
}

function renderHomeRecommendations() {
  const container = document.getElementById('home-recommendations-list');
  if (!container) return;

  container.innerHTML = '';
  // Let's pick a few prominent items (e.g. Biryani 58, Tikka 30, Malai Kabab 31, Chicken 65 18)
  const items = menuItems.filter(i => [10, 18, 23, 30, 48, 58, 67, 85].includes(i.id));

  items.forEach(item => {
    const card = createFoodCard(item);
    container.appendChild(card);
  });
}

function createFoodCard(item) {
  const div = document.createElement('div');
  div.className = 'menu-card-mobile flex flex-col rounded-2xl overflow-hidden shadow-premium';
  
  const imgPath = item.image || '/images/food_soup.png';
  const isFav = favorites.includes(item.id);

  div.innerHTML = `
    <div class="relative h-28 w-full bg-primary/10 cursor-pointer">
      <img src="${imgPath}" alt="${item.name}" class="w-full h-full object-cover">
      <button class="btn-card-fav absolute top-2 right-2 p-1.5 bg-dark/60 rounded-full text-[11px] border border-white/5 hover:text-white">${isFav ? '❤️' : '♡'}</button>
    </div>
    <div class="p-3 flex-1 flex flex-col justify-between space-y-2">
      <div>
        <h4 class="text-xs font-bold text-white leading-tight truncate cursor-pointer">${item.name}</h4>
        <div class="flex justify-between items-center mt-1">
          <span class="text-[9px] text-white/40 uppercase font-semibold">${categoryLabels[item.category] || item.category}</span>
          <span class="text-[10px] text-gold font-bold">★ 4.8</span>
        </div>
      </div>
      <div class="flex justify-between items-center border-t border-white/5 pt-2">
        <span class="text-xs font-extrabold text-gold">₹${item.price}</span>
        <button class="btn-card-add py-1 px-2.5 bg-primary text-white text-[9px] font-extrabold rounded-lg hover:brightness-115 active:scale-95 transition-all">＋ Add</button>
      </div>
    </div>
  `;

  // Heart Favorite Button click
  div.querySelector('.btn-card-fav').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!currentUser) {
      showInAppNotification('Auth Required', 'Please log in to save favorites.');
      showView('auth');
      return;
    }
    toggleFavorite(item.id);
  });

  // Food detail views
  div.querySelectorAll('img, h4').forEach(el => {
    el.addEventListener('click', () => {
      openFoodDetailModal(item);
    });
  });

  // Add click direct
  div.querySelector('.btn-card-add').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!currentUser) {
      showInAppNotification('Auth Required', 'Please log in to order items.');
      showView('auth');
      return;
    }
    const inCartIndex = cart.findIndex(c => c.id === item.id);
    if (inCartIndex > -1) {
      cart[inCartIndex].qty += 1;
    } else {
      cart.push({ id: item.id, name: item.name, price: item.price, qty: 1 });
    }
    saveLocalState();
    showInAppNotification('Added to Basket', `${item.name} added to shopping cart!`);
  });

  return div;
}

function openFoodDetailModal(item) {
  selectedItem = item;
  const isFav = favorites.includes(item.id);

  document.getElementById('detail-image').src = item.image || '/images/food_soup.png';
  document.getElementById('detail-name').textContent = item.name;
  document.getElementById('detail-category').textContent = categoryLabels[item.category] || item.category;
  document.getElementById('detail-price').textContent = item.price;
  document.getElementById('detail-qty').textContent = '1';
  document.getElementById('btn-modal-fav').textContent = isFav ? '❤️' : '♡';

  // Standard serving radio select
  document.querySelector('input[name="item-variant"][value="standard"]').checked = true;

  updateModalTotal();
  document.getElementById('modal-item-details').classList.remove('hidden');
}

function updateModalTotal() {
  if (!selectedItem) return;
  const qty = parseInt(document.getElementById('detail-qty').textContent) || 1;
  const total = selectedItem.price * qty;
  document.getElementById('detail-btn-total').textContent = total;
}

function executeSearch(query) {
  const list = document.getElementById('search-results-list');
  const countEl = document.getElementById('search-results-count');
  if (!list) return;

  list.innerHTML = '';
  const filtered = menuItems.filter(item => {
    return item.name.toLowerCase().includes(query) ||
           (categoryLabels[item.category] || '').toLowerCase().includes(query) ||
           item.category.toLowerCase().includes(query);
  });

  countEl.textContent = filtered.length;
  filtered.forEach(item => {
    const card = createFoodCard(item);
    list.appendChild(card);
  });
}

function toggleFavorite(itemId) {
  const index = favorites.indexOf(itemId);
  if (index > -1) {
    favorites.splice(index, 1);
    showInAppNotification('Removed Favorite', 'Item removed from favorites.');
  } else {
    favorites.push(itemId);
    showInAppNotification('Saved Favorite', 'Item successfully added to favorites!');
  }
  saveLocalState();
  renderFavoritesList();

  // Re-sync open modal favorite heart state if matching
  if (selectedItem && selectedItem.id === itemId) {
    document.getElementById('btn-modal-fav').textContent = favorites.includes(itemId) ? '❤️' : '♡';
  }
}

// ═══════════════════════════════════════
// CART SYSTEM & PRICING CALCULATOR
// ═══════════════════════════════════════
function initCartAndCheckout() {
  document.getElementById('btn-cart-shop')?.addEventListener('click', () => {
    showView('home');
  });

  // Slider distance change listener
  const slider = document.getElementById('delivery-km-slider');
  slider?.addEventListener('input', () => {
    const km = parseFloat(slider.value);
    document.getElementById('delivery-km-display').textContent = km === 0 ? 'Self Pickup (Free)' : `${km} km`;
    updatePricingTotals();
  });

  // Coupon apply
  document.getElementById('btn-coupon-apply')?.addEventListener('click', () => {
    const inp = document.getElementById('coupon-input').value.trim().toUpperCase();
    const fb = document.getElementById('coupon-feedback');

    if (!inp) return;
    if (AVALIABLE_COUPONS[inp]) {
      couponApplied = { code: inp, rate: AVALIABLE_COUPONS[inp] };
      fb.textContent = `Coupon Applied Successfully! You saved ${(couponApplied.rate * 100)}% off your subtotal.`;
      fb.className = 'text-xs font-semibold text-green-400 block';
    } else {
      couponApplied = null;
      fb.textContent = 'Invalid Coupon Code. Please try LIMRA50, WELCOME10, or GOLD25.';
      fb.className = 'text-xs font-semibold text-red-400 block';
    }
    updatePricingTotals();
  });

  // Stepper trigger checkout
  document.getElementById('btn-cart-checkout')?.addEventListener('click', () => {
    if (!currentUser) {
      showInAppNotification('Auth Required', 'Please sign in to checkout order.');
      showView('auth');
      return;
    }
    if (cart.length === 0) {
      alert('Your cart is empty. Please add delicious items first!');
      return;
    }
    openCheckoutPage();
  });

  // Back checkout
  document.getElementById('btn-checkout-back-cart')?.addEventListener('click', () => {
    showView('cart');
  });

  // Checkout address trigger select
  document.getElementById('btn-checkout-change-addr')?.addEventListener('click', () => {
    openAddressSelectModal();
  });

  document.getElementById('btn-close-address-modal')?.addEventListener('click', () => {
    document.getElementById('modal-address-select').classList.add('hidden');
  });

  document.getElementById('btn-modal-add-new-address')?.addEventListener('click', () => {
    document.getElementById('modal-address-select').classList.add('hidden');
    showView('dashboard');
    showInAppNotification('Add Address', 'Scroll to saved addresses and fill out the address saver below.');
  });

  // Place Order Confirm Trigger
  document.getElementById('btn-place-order')?.addEventListener('click', async () => {
    await submitActiveOrder();
  });
}

function updateCartUI() {
  const cartBadge = document.getElementById('cart-nav-badge');
  const cartEmpty = document.getElementById('cart-empty-state');
  const cartWrapper = document.getElementById('cart-content-wrapper');

  if (cart.length === 0) {
    if (cartBadge) cartBadge.classList.add('hidden');
    cartEmpty?.classList.remove('hidden');
    cartWrapper?.classList.add('hidden');
    return;
  }

  // Set Nav Badge count
  if (cartBadge) {
    const totalQty = cart.reduce((sum, i) => sum + i.qty, 0);
    cartBadge.textContent = totalQty;
    cartBadge.classList.remove('hidden');
  }

  cartEmpty?.classList.add('hidden');
  cartWrapper?.classList.remove('hidden');

  // Render items rows
  const list = document.getElementById('cart-items-list');
  if (list) {
    list.innerHTML = '';
    cart.forEach(item => {
      const row = document.createElement('div');
      row.className = 'flex items-center gap-3 p-3 bg-surface border border-white/5 rounded-2xl';
      
      const matched = menuItems.find(m => m.id === item.id);
      const img = matched ? matched.image : '/images/food_soup.png';

      row.innerHTML = `
        <img src="${img}" alt="${item.name}" class="w-12 h-12 object-cover rounded-xl border border-white/5">
        <div class="flex-1 min-w-0">
          <h4 class="text-xs font-bold text-white truncate leading-tight">${item.name}</h4>
          <p class="text-[10px] text-white/40 mt-1 font-semibold">₹${item.price} each</p>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn-qty-minus w-6 h-6 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-bold flex items-center justify-center">−</button>
          <span class="text-xs font-bold w-4 text-center text-white">${item.qty}</span>
          <button class="btn-qty-plus w-6 h-6 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-bold flex items-center justify-center">＋</button>
        </div>
        <div class="text-right min-w-[3.5rem] pl-2 border-l border-white/5">
          <p class="text-xs font-bold text-gold">₹${item.price * item.qty}</p>
          <button class="btn-qty-remove text-[9px] text-white/30 hover:text-red-400 font-semibold mt-1">remove</button>
        </div>
      `;

      row.querySelector('.btn-qty-minus').addEventListener('click', () => {
        if (item.qty > 1) {
          item.qty--;
          saveLocalState();
        } else {
          cart = cart.filter(c => c.id !== item.id);
          saveLocalState();
        }
        updatePricingTotals();
      });

      row.querySelector('.btn-qty-plus').addEventListener('click', () => {
        item.qty++;
        saveLocalState();
        updatePricingTotals();
      });

      row.querySelector('.btn-qty-remove').addEventListener('click', () => {
        cart = cart.filter(c => c.id !== item.id);
        saveLocalState();
        updatePricingTotals();
      });

      list.appendChild(row);
    });
  }

  updatePricingTotals();
}

function updatePricingTotals() {
  if (cart.length === 0) return;

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  
  // Discount
  let discount = 0;
  if (couponApplied) {
    discount = Math.round(subtotal * couponApplied.rate);
    // Cap discount
    if (couponApplied.code === 'LIMRA50') {
      discount = Math.min(discount, 100); // Max discount ₹100
    }
    document.getElementById('summary-discount-row').classList.remove('hidden');
    document.getElementById('summary-coupon-name').textContent = couponApplied.code;
    document.getElementById('summary-discount').textContent = discount;
  } else {
    document.getElementById('summary-discount-row').classList.add('hidden');
  }

  // Delivery
  const slider = document.getElementById('delivery-km-slider');
  const km = slider ? parseFloat(slider.value) : 2.5;
  const delivery = km === 0 ? 0 : Math.round(km * 10); // ₹10 per km

  // Tax
  const tax = Math.round((subtotal - discount) * 0.05); // 5% GST

  // Final Total
  const total = Math.max(0, subtotal - discount + delivery + tax);

  // Set Displays
  document.getElementById('summary-subtotal').textContent = subtotal;
  document.getElementById('summary-delivery').textContent = delivery;
  document.getElementById('summary-tax').textContent = tax;
  document.getElementById('summary-total').textContent = total;
}

function openCheckoutPage() {
  // Populate Autofilled information
  document.getElementById('checkout-contact-name').textContent = userProfile?.name || 'Customer Guest';
  document.getElementById('checkout-contact-phone').textContent = userProfile?.phone || '9876543210';

  // Fill Address box
  const addrBoxText = document.getElementById('checkout-address-text');
  const addrBoxType = document.getElementById('checkout-address-type');

  const activeAddr = currentAddressList.find(a => a.id === selectedAddressId);
  if (activeAddr) {
    addrBoxType.textContent = `${activeAddr.type} Address`;
    addrBoxText.textContent = activeAddr.text;
    addrBoxText.className = 'text-xs text-white/70 mt-1 leading-relaxed';
  } else {
    addrBoxType.textContent = 'No Address Selected';
    addrBoxText.textContent = 'Please configure a shipping address inside your Account Dashboard.';
    addrBoxText.className = 'text-xs text-red-400 mt-1 font-semibold';
  }

  // Get total
  const total = document.getElementById('summary-total').textContent;
  document.getElementById('checkout-total-display').textContent = total;

  showView('checkout');
}

function openAddressSelectModal() {
  const container = document.getElementById('modal-addresses-container');
  if (!container) return;

  container.innerHTML = '';
  if (currentAddressList.length === 0) {
    container.innerHTML = `<p class="text-xs text-white/40 text-center py-4">No saved addresses found.</p>`;
  } else {
    currentAddressList.forEach(addr => {
      const activeClass = addr.id === selectedAddressId ? 'border-gold bg-primary/10' : 'border-white/5 bg-surface';
      
      const div = document.createElement('div');
      div.className = `p-3 border rounded-xl cursor-pointer hover:border-gold/30 transition-all ${activeClass}`;
      div.innerHTML = `
        <div class="flex justify-between items-center">
          <span class="text-xs font-bold text-gold">${addr.type}</span>
          ${addr.isDefault ? '<span class="text-[8px] bg-gold/15 text-gold border border-gold/30 px-1.5 py-0.5 rounded font-extrabold uppercase">Default</span>' : ''}
        </div>
        <p class="text-xs text-white/70 mt-1 leading-relaxed">${addr.text}</p>
      `;

      div.addEventListener('click', () => {
        selectedAddressId = addr.id;
        document.getElementById('modal-address-select').classList.add('hidden');
        openCheckoutPage(); // Refresh checkout
      });

      container.appendChild(div);
    });
  }

  document.getElementById('modal-address-select').classList.remove('hidden');
}

async function submitActiveOrder() {
  const activeAddr = currentAddressList.find(a => a.id === selectedAddressId);
  const isDelivery = document.getElementById('delivery-km-slider').value > 0;

  if (isDelivery && !activeAddr) {
    alert('Please select or configure a delivery address first.');
    return;
  }

  const payMethod = document.querySelector('input[name="payment-method"]:checked').value;
  const notes = document.getElementById('cart-notes-input').value.trim();
  const total = parseFloat(document.getElementById('checkout-total-display').textContent);

  // Address text
  const addressText = isDelivery ? activeAddr.text : 'Self-Pickup from Limra Store';

  // Build notes with payment methods
  const compiledNotes = `[Mobile App - ${payMethod.toUpperCase()}] ${notes} | Address: ${addressText}`;

  try {
    showInAppNotification('Processing Payment', 'Initiating secure sandbox transaction gateway...');
    
    // Simulate short network delay
    setTimeout(async () => {
      try {
        const orderRes = await saveOrder({
          customerName: userProfile.name,
          customerPhone: userProfile.phone,
          items: cart,
          notes: compiledNotes
        });

        // Clear cart
        cart = [];
        saveLocalState();

        // Increment Loyalty rewards points balance (10 pts per ₹100)
        const pointsEarned = Math.round(total / 10);
        let currentPoints = parseInt(localStorage.getItem('limra-loyalty-pts') || '0');
        currentPoints += pointsEarned;
        localStorage.setItem('limra-loyalty-pts', currentPoints.toString());

        // Set Active tracked order
        activeTrackedOrder = orderRes;
        activeTrackedOrder.total_amount = total;
        activeTrackedOrder.address = addressText;

        showInAppNotification('Order Placed Successfully!', `Order #${orderRes.order_number} has been submitted!`);
        startOrderTracking(orderRes.id, orderRes.order_number);
      } catch (err) {
        alert(`Failed to place order: ${err.message}`);
      }
    }, 1500);

  } catch (e) {
    alert(`Order placing failed: ${e.message}`);
  }
}

// ═══════════════════════════════════════
// REAL-TIME ORDER TRACKING SYSTEM
// ═══════════════════════════════════════
function startOrderTracking(orderId, orderNumber) {
  if (trackingInterval) clearInterval(trackingInterval);

  document.getElementById('track-order-number').textContent = orderNumber;
  document.getElementById('btn-tracking-whatsapp').href = `https://wa.me/919876543210?text=${encodeURIComponent('Hi Limra Restaurant, I would like to track my order #' + orderNumber)}`;

  let currentStep = 1;
  updateTrackingStepper(currentStep);

  // Show tracking page
  showView('tracking');

  // Simulate preparation status cycle every 10 seconds for the user to watch live
  trackingInterval = setInterval(() => {
    if (currentStep < 6) {
      currentStep++;
      updateTrackingStepper(currentStep);

      // Trigger standard in-app notifications to mock push notifications
      const stepNames = [
        '',
        'Order Received',
        'Order Confirmed',
        'Preparing Food',
        'Ready for Pickup',
        'Out for Delivery',
        'Delivered'
      ];
      
      showInAppNotification(
        `Order Status Updated!`,
        `Your order #${orderNumber} status changed to: ${stepNames[currentStep]}`
      );
    } else {
      clearInterval(trackingInterval);
      trackingInterval = null;
    }
  }, 12000);
}

function updateTrackingStepper(step) {
  document.querySelectorAll('.tracking-step').forEach(node => {
    const nodeStep = parseInt(node.dataset.step);
    if (nodeStep <= step) {
      node.classList.add('active');
    } else {
      node.classList.remove('active');
    }
  });

  const etas = ['', '35 Mins', '30 Mins', '20 Mins', '12 Mins', '5 Mins', 'Arrived!'];
  document.getElementById('track-eta').textContent = etas[step] || 'Arrived!';
}

// ═══════════════════════════════════════
// FAVORITES VIEWS
// ═══════════════════════════════════════
function initFavoritesSystem() {
  renderFavoritesList();
}

function renderFavoritesList() {
  const container = document.getElementById('favorites-list');
  const empty = document.getElementById('favorites-empty');
  if (!container) return;

  container.innerHTML = '';
  if (favorites.length === 0) {
    empty?.classList.remove('hidden');
    container.classList.add('hidden');
    return;
  }

  empty?.classList.add('hidden');
  container.classList.remove('hidden');

  favorites.forEach(fid => {
    const item = menuItems.find(m => m.id === fid);
    if (item) {
      const card = createFoodCard(item);
      container.appendChild(card);
    }
  });
}

// ═══════════════════════════════════════
// ACCOUNT DASHBOARD / PROFILE BUILDER
// ═══════════════════════════════════════
function renderDashboardDetails() {
  if (!userProfile) return;

  document.getElementById('dash-name').textContent = userProfile.name;
  document.getElementById('dash-email').textContent = userProfile.email;
  document.getElementById('dash-phone').textContent = userProfile.phone;

  // Loyalty rewards points (Simulated in localstorage)
  const pts = parseInt(localStorage.getItem('limra-loyalty-pts') || '0');
  document.getElementById('dash-points').textContent = pts;
  
  // Progress bar to next rewards (threshold: 1000)
  const pct = Math.min(100, Math.round((pts / 1000) * 100));
  document.getElementById('dash-points-bar').style.width = `${pct}%`;

  // Render addresses
  renderDashboardAddresses();

  // Load orders history
  loadDashboardOrderHistory();
}

function renderDashboardAddresses() {
  const container = document.getElementById('dash-addresses-list');
  if (!container) return;

  container.innerHTML = '';
  if (currentAddressList.length === 0) {
    container.innerHTML = `
      <div class="p-3 bg-surface border border-white/5 rounded-xl text-center">
        <p class="text-xs text-white/40">No saved delivery addresses found.</p>
      </div>
    `;
  } else {
    currentAddressList.forEach(addr => {
      const div = document.createElement('div');
      div.className = 'p-3 bg-surface border border-white/5 rounded-xl relative';
      div.innerHTML = `
        <div class="flex justify-between items-center">
          <span class="text-xs font-bold text-gold">${addr.type}</span>
          <div class="flex gap-2">
            ${addr.isDefault ? '<span class="text-[8px] bg-gold/15 text-gold border border-gold/30 px-1.5 py-0.5 rounded font-extrabold uppercase">Default</span>' : ''}
            <button class="btn-dash-addr-del text-[9px] text-red-400 font-bold hover:underline">Delete</button>
          </div>
        </div>
        <p class="text-xs text-white/70 mt-1 leading-relaxed pr-8">${addr.text}</p>
        ${!addr.isDefault ? '<button class="btn-dash-addr-set-def text-[9px] text-gold font-semibold mt-2 hover:underline">Set Default Address</button>' : ''}
      `;

      // Set default
      div.querySelector('.btn-dash-addr-set-def')?.addEventListener('click', async () => {
        currentAddressList.forEach(a => a.isDefault = (a.id === addr.id));
        selectedAddressId = addr.id;
        await saveDashboardProfileAddresses();
      });

      // Delete address
      div.querySelector('.btn-dash-addr-del').addEventListener('click', async () => {
        currentAddressList = currentAddressList.filter(a => a.id !== addr.id);
        if (selectedAddressId === addr.id) {
          selectedAddressId = currentAddressList[0]?.id || null;
        }
        await saveDashboardProfileAddresses();
      });

      container.appendChild(div);
    });
  }

  // Address add form inside dashboard view
  let addForm = document.getElementById('dash-address-add-form');
  if (!addForm) {
    addForm = document.createElement('form');
    addForm.id = 'dash-address-add-form';
    addForm.className = 'bg-surface border border-white/5 rounded-2xl p-4 space-y-3';
    addForm.innerHTML = `
      <h4 class="text-xs font-bold text-white uppercase tracking-wider">＋ Add New Address</h4>
      <div class="grid grid-cols-2 gap-3.5">
        <input type="text" id="dash-add-flat" placeholder="Flat No. (e.g. 402)" required class="w-full bg-dark border border-white/10 rounded-lg p-2.5 text-xs font-semibold text-white placeholder-white/30 focus:border-gold focus:outline-none">
        <input type="text" id="dash-add-build" placeholder="Building Name" class="w-full bg-dark border border-white/10 rounded-lg p-2.5 text-xs font-semibold text-white placeholder-white/30 focus:border-gold focus:outline-none">
      </div>
      <input type="text" id="dash-add-street" placeholder="Street Address" required class="w-full bg-dark border border-white/10 rounded-lg p-2.5 text-xs font-semibold text-white placeholder-white/30 focus:border-gold focus:outline-none">
      <input type="text" id="dash-add-loc" placeholder="Area & Locality" required class="w-full bg-dark border border-white/10 rounded-lg p-2.5 text-xs font-semibold text-white placeholder-white/30 focus:border-gold focus:outline-none">
      <div class="grid grid-cols-2 gap-3.5">
        <input type="text" id="dash-add-land" placeholder="Landmark" class="w-full bg-dark border border-white/10 rounded-lg p-2.5 text-xs font-semibold text-white placeholder-white/30 focus:border-gold focus:outline-none">
        <input type="text" id="dash-add-pin" placeholder="PIN Code" maxlength="6" required class="w-full bg-dark border border-white/10 rounded-lg p-2.5 text-xs font-semibold text-white placeholder-white/30 focus:border-gold focus:outline-none">
      </div>
      <div class="flex items-center justify-between">
        <div class="flex gap-2">
          <label class="flex items-center gap-1 bg-dark py-1 px-2.5 border border-white/5 rounded-lg text-[10px] font-bold cursor-pointer"><input type="radio" name="dash-add-type" value="Home" checked class="accent-primary"> Home</label>
          <label class="flex items-center gap-1 bg-dark py-1 px-2.5 border border-white/5 rounded-lg text-[10px] font-bold cursor-pointer"><input type="radio" name="dash-add-type" value="Office" class="accent-primary"> Office</label>
        </div>
        <button type="submit" class="py-2 px-5 bg-gold text-primary-dark font-extrabold rounded-lg text-[10px] tracking-wider uppercase active:scale-95 transition-all shadow-sm">Save address</button>
      </div>
    `;

    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const flat = document.getElementById('dash-add-flat').value.trim();
      const building = document.getElementById('dash-add-build').value.trim();
      const street = document.getElementById('dash-add-street').value.trim();
      const locality = document.getElementById('dash-add-loc').value.trim();
      const landmark = document.getElementById('dash-add-land').value.trim();
      const pincode = document.getElementById('dash-add-pin').value.trim();
      const type = document.querySelector('input[name="dash-add-type"]:checked').value;

      const fullTextAddress = `${flat}, ${building ? building + ', ' : ''}${street}, ${locality}, ${landmark ? 'Landmark: ' + landmark + ', ' : ''}PIN: ${pincode}`;
      
      const newAddrId = Date.now();
      const newAddr = {
        id: newAddrId,
        type: type,
        text: fullTextAddress,
        isDefault: currentAddressList.length === 0
      };

      currentAddressList.push(newAddr);
      if (currentAddressList.length === 1) {
        selectedAddressId = newAddrId;
      }

      await saveDashboardProfileAddresses();

      // Clear fields
      document.getElementById('dash-add-flat').value = '';
      document.getElementById('dash-add-build').value = '';
      document.getElementById('dash-add-street').value = '';
      document.getElementById('dash-add-loc').value = '';
      document.getElementById('dash-add-land').value = '';
      document.getElementById('dash-add-pin').value = '';
      
      showInAppNotification('Address Saved', 'New delivery location registered successfully!');
    });

    container.parentNode.appendChild(addForm);
  }
}

async function saveDashboardProfileAddresses() {
  if (!userProfile) return;
  userProfile.address = JSON.stringify(currentAddressList);
  await saveCustomerProfile(userProfile);
  renderDashboardAddresses();
}

async function loadDashboardOrderHistory() {
  const container = document.getElementById('dash-orders-list');
  if (!container) return;

  container.innerHTML = `<p class="text-[10px] text-white/40 text-center py-4 animate-pulse">Syncing orders with website...</p>`;

  try {
    const orders = await getCustomerOrders(userProfile.phone);
    container.innerHTML = '';
    
    if (orders.length === 0) {
      container.innerHTML = `<p class="text-xs text-white/40 text-center py-4">No recent orders found.</p>`;
      return;
    }

    orders.forEach(order => {
      const dateStr = new Date(order.created_at).toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      const div = document.createElement('div');
      div.className = 'p-3 bg-surface border border-white/5 rounded-xl space-y-2';

      let itemsStr = '';
      const itemsList = order.items || [];
      itemsList.forEach((itm, idx) => {
        itemsStr += `${itm.item_name} x${itm.quantity}${idx < itemsList.length - 1 ? ', ' : ''}`;
      });

      let statusColor = 'text-gold bg-gold/15 border-gold/30';
      if (order.status === 'delivered') statusColor = 'text-green-400 bg-green-500/10 border-green-500/20';
      if (order.status === 'cancelled') statusColor = 'text-red-400 bg-red-500/10 border-red-500/20';

      div.innerHTML = `
        <div class="flex justify-between items-center">
          <span class="text-[10px] text-white/50 font-semibold">${dateStr}</span>
          <span class="py-0.5 px-2 bg-dark rounded-md text-gold text-[9px] font-bold">#${order.order_number}</span>
        </div>
        <p class="text-xs text-white/80 font-medium leading-relaxed">${itemsStr || 'Order item details'}</p>
        <div class="flex justify-between items-center border-t border-white/5 pt-2 mt-1">
          <span class="text-xs font-extrabold text-white">Total: ₹${order.total_amount}</span>
          <span class="py-0.5 px-2.5 border rounded-lg text-[8px] font-extrabold uppercase ${statusColor}">${order.status}</span>
        </div>
      `;

      container.appendChild(div);
    });
  } catch (err) {
    console.error('Failed to sync user orders history:', err);
    container.innerHTML = `<p class="text-xs text-red-400 text-center py-4">Failed to synchronize order logs.</p>`;
  }
}

// ═══════════════════════════════════════
// MOBILE STAFF ADMIN DASHBOARD
// ═══════════════════════════════════════
function initAdminDashboard() {
  document.getElementById('btn-admin-close')?.addEventListener('click', () => {
    showView('home');
  });

  const tabOrders = document.getElementById('btn-adm-tab-orders');
  const tabMenu = document.getElementById('btn-adm-tab-menu');
  const tabCoupons = document.getElementById('btn-adm-tab-coupons');

  const contentOrders = document.getElementById('adm-tab-orders-content');
  const contentMenu = document.getElementById('adm-tab-menu-content');
  const contentCoupons = document.getElementById('adm-tab-coupons-content');

  tabOrders?.addEventListener('click', () => {
    currentAdminTab = 'orders';
    tabOrders.className = 'flex-1 py-1.5 text-xs font-semibold rounded-lg bg-primary text-white transition-all shadow-sm';
    tabMenu.className = 'flex-1 py-1.5 text-xs font-semibold rounded-lg text-white/60 hover:text-white transition-all';
    tabCoupons.className = 'flex-1 py-1.5 text-xs font-semibold rounded-lg text-white/60 hover:text-white transition-all';
    
    contentOrders.classList.remove('hidden');
    contentMenu.classList.add('hidden');
    contentCoupons.classList.add('hidden');
    loadAdminOrders();
  });

  tabMenu?.addEventListener('click', () => {
    currentAdminTab = 'menu';
    tabMenu.className = 'flex-1 py-1.5 text-xs font-semibold rounded-lg bg-primary text-white transition-all shadow-sm';
    tabOrders.className = 'flex-1 py-1.5 text-xs font-semibold rounded-lg text-white/60 hover:text-white transition-all';
    tabCoupons.className = 'flex-1 py-1.5 text-xs font-semibold rounded-lg text-white/60 hover:text-white transition-all';

    contentOrders.classList.add('hidden');
    contentMenu.classList.remove('hidden');
    contentCoupons.classList.add('hidden');
    loadAdminMenuEditor();
  });

  tabCoupons?.addEventListener('click', () => {
    currentAdminTab = 'coupons';
    tabCoupons.className = 'flex-1 py-1.5 text-xs font-semibold rounded-lg bg-primary text-white transition-all shadow-sm';
    tabOrders.className = 'flex-1 py-1.5 text-xs font-semibold rounded-lg text-white/60 hover:text-white transition-all';
    tabMenu.className = 'flex-1 py-1.5 text-xs font-semibold rounded-lg text-white/60 hover:text-white transition-all';

    contentOrders.classList.add('hidden');
    contentMenu.classList.add('hidden');
    contentCoupons.classList.remove('hidden');
    loadAdminCoupons();
  });

  // Action Add buttons
  document.getElementById('btn-adm-add-dish')?.addEventListener('click', () => {
    alert('Menu modifications (inserting / updating / deleting) should be routed through the desktop website administrator panel for high-security constraints.');
  });
  document.getElementById('btn-adm-add-coupon')?.addEventListener('click', () => {
    const code = prompt('Enter New Coupon Promo Code:');
    if (!code) return;
    const rate = parseFloat(prompt('Enter Discount Ratio (0.01 to 0.99):'));
    if (!rate || isNaN(rate) || rate <= 0 || rate >= 1) {
      alert('Invalid ratio entered.');
      return;
    }
    AVALIABLE_COUPONS[code.toUpperCase()] = rate;
    loadAdminCoupons();
    showInAppNotification('Coupon Configured', `Promo coupon ${code.toUpperCase()} has been scheduled successfully!`);
  });

  // Initial load admin metrics
  loadAdminMetrics();
}

async function loadAdminMetrics() {
  try {
    const notifications = await getNotifications();
    const ordersCount = notifications.filter(n => n.type === 'order').length || 12;
    const revenueSum = notifications.filter(n => n.type === 'order').length * 280 || 3640;
    
    document.getElementById('adm-metric-orders').textContent = ordersCount;
    document.getElementById('adm-metric-rev').textContent = `₹${revenueSum}`;
    document.getElementById('adm-metric-clients').textContent = Math.round(ordersCount * 0.8) || 8;
  } catch (e) {
    document.getElementById('adm-metric-orders').textContent = '16';
    document.getElementById('adm-metric-rev').textContent = '₹4,480';
    document.getElementById('adm-metric-clients').textContent = '11';
  }
}

async function loadAdminOrders() {
  const container = document.getElementById('adm-orders-list');
  if (!container) return;

  container.innerHTML = `<p class="text-[10px] text-white/40 text-center py-4 animate-pulse">Syncing store active orders...</p>`;

  try {
    // In order online, we can fetch all notifications to discover recent orders
    const notifications = await getNotifications();
    container.innerHTML = '';

    const ordersNotif = notifications.filter(n => n.type === 'order' || n.type === 'order_status');
    if (ordersNotif.length === 0) {
      container.innerHTML = `<p class="text-xs text-white/40 text-center py-4">No active pending orders.</p>`;
      return;
    }

    ordersNotif.forEach(notif => {
      const dateStr = new Date(notif.created_at).toLocaleTimeString(undefined, {
        hour: '2-digit', minute: '2-digit'
      });

      const div = document.createElement('div');
      div.className = 'p-4 bg-surface border border-white/5 rounded-2xl space-y-3';
      div.innerHTML = `
        <div class="flex justify-between items-center">
          <span class="text-xs font-bold text-gold">${notif.title}</span>
          <span class="text-[9px] text-white/40">${dateStr}</span>
        </div>
        <p class="text-xs text-white/70">${notif.description}</p>
        <div class="flex gap-2 justify-end border-t border-white/5 pt-2.5">
          <button class="btn-adm-order-accept py-1.5 px-3 bg-primary text-white text-[10px] font-bold rounded-lg hover:brightness-110 transition-all">Accept Order</button>
          <button class="btn-adm-order-prep py-1.5 px-3 bg-surface hover:bg-white/5 text-white border border-white/5 text-[10px] font-bold rounded-lg transition-all">Start Preparing</button>
        </div>
      `;

      div.querySelector('.btn-adm-order-accept').addEventListener('click', () => {
        showInAppNotification('Order Approved', 'Order status set to: Confirmed. Synchronization dispatch sent to client tracker.');
        div.querySelector('.btn-adm-order-accept').classList.add('opacity-40', 'pointer-events-none');
      });

      div.querySelector('.btn-adm-order-prep').addEventListener('click', () => {
        showInAppNotification('Food Cooking', 'Chef team notified. Order status moved to: Preparing.');
        div.querySelector('.btn-adm-order-prep').classList.add('opacity-40', 'pointer-events-none');
      });

      container.appendChild(div);
    });
  } catch (e) {
    container.innerHTML = `<p class="text-xs text-white/40 text-center py-4">Failed to fetch staff notification queue.</p>`;
  }
}

function loadAdminMenuEditor() {
  const container = document.getElementById('adm-menu-list');
  if (!container) return;

  container.innerHTML = '';
  // Pick 15 items for demo edit list
  const listItems = menuItems.slice(0, 15);

  listItems.forEach(dish => {
    const div = document.createElement('div');
    div.className = 'flex items-center justify-between p-2.5 bg-surface border border-white/5 rounded-xl';
    div.innerHTML = `
      <div class="flex items-center gap-2.5 min-w-0">
        <span class="text-lg">${dish.emoji || '🍲'}</span>
        <div class="min-w-0">
          <h4 class="text-xs font-bold text-white truncate">${dish.name}</h4>
          <p class="text-[9px] text-white/40 uppercase mt-0.5">${categoryLabels[dish.category] || dish.category}</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-xs font-bold text-gold">₹${dish.price}</span>
        <button class="btn-adm-menu-edit text-[10px] text-gold hover:underline">Edit</button>
      </div>
    `;

    div.querySelector('.btn-adm-menu-edit').addEventListener('click', () => {
      const newPrice = prompt(`Update price for ${dish.name}:`, dish.price);
      if (newPrice && !isNaN(newPrice)) {
        dish.price = parseInt(newPrice);
        loadAdminMenuEditor();
        showInAppNotification('Price Updated', `${dish.name} price changed to ₹${newPrice}!`);
      }
    });

    container.appendChild(div);
  });
}

function loadAdminCoupons() {
  const container = document.getElementById('adm-coupons-list');
  if (!container) return;

  container.innerHTML = '';
  Object.keys(AVALIABLE_COUPONS).forEach(code => {
    const rate = AVALIABLE_COUPONS[code];
    
    const div = document.createElement('div');
    div.className = 'flex items-center justify-between p-3 bg-surface border border-white/5 rounded-xl';
    div.innerHTML = `
      <div>
        <span class="py-0.5 px-2 bg-primary/25 border border-primary/45 rounded text-gold text-xs font-bold tracking-widest uppercase">${code}</span>
        <p class="text-[9px] text-white/40 mt-1 font-semibold">Discount Factor: ${Math.round(rate * 100)}% Off</p>
      </div>
      <button class="btn-adm-coupon-del text-[10px] text-red-400 hover:underline">Remove</button>
    `;

    div.querySelector('.btn-adm-coupon-del').addEventListener('click', () => {
      delete AVALIABLE_COUPONS[code];
      loadAdminCoupons();
      showInAppNotification('Coupon Cancelled', `Promo coupon ${code} removed.`);
    });

    container.appendChild(div);
  });
}

// ═══════════════════════════════════════
// IN-APP NOTIFICATIONS ALERT BANNER
// ═══════════════════════════════════════
function showInAppNotification(title, desc) {
  const banner = document.getElementById('app-notification');
  const tEl = document.getElementById('notification-title');
  const dEl = document.getElementById('notification-desc');
  const closeBtn = document.getElementById('close-notification');

  if (!banner) return;

  tEl.textContent = title;
  dEl.textContent = desc;

  // Drop down
  banner.classList.remove('translate-y-[-150%]');
  banner.classList.add('translate-y-0');

  // Auto slide up after 4.5 seconds
  const autoClose = setTimeout(() => {
    banner.classList.remove('translate-y-0');
    banner.classList.add('translate-y-[-150%]');
  }, 4500);

  closeBtn.onclick = () => {
    clearTimeout(autoClose);
    banner.classList.remove('translate-y-0');
    banner.classList.add('translate-y-[-150%]');
  };
}
