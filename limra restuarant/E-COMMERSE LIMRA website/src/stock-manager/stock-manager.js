import '../style.css';
import './stock-manager.css';

// Safe number & currency helpers
function safeNum(val, fallback = 0) {
  if (val === null || val === undefined) return fallback;
  const num = parseFloat(val);
  return isNaN(num) ? fallback : num;
}

function safeMoney(val) {
  const num = safeNum(val, 0);
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Storage Keys
const STORAGE_KEY_ITEMS = 'limra_stock_items_v2';
const STORAGE_KEY_IN = 'limra_stock_in_entries_v2';
const STORAGE_KEY_OUT = 'limra_stock_out_entries_v2';
const STORAGE_KEY_LOGS = 'limra_stock_logs_v2';

// 7 Master Stock Categories for LIMRA Restaurant Raw Materials & Supplies:
// 1. Bhusimal & Spices
// 2. Dairy Items
// 3. Cold Drinks
// 4. Fresh Vegetables
// 5. Ice Cream
// 6. Packaging & Carry Bags
// 7. Cleaning & Washings
const DEFAULT_ITEMS = [
  // 1. Bhusimal & Spices
  { id: 'stk_01', sku: 'J001', name: 'Basmati Biryani Rice (Special Grade)', category: 'Bhusimal & Spices', godown: 'Main Godown', unit: 'kg', baseQty: 100, qty: 100, min: 30, cost: 110, salePrice: 150, supplier: 'Royal Rice Traders (9876543212)' },
  { id: 'stk_02', sku: 'J002', name: 'Staff Rice / স্টাফ রাইস', category: 'Bhusimal & Spices', godown: 'Main Godown', unit: 'kg', baseQty: 50, qty: 50, min: 20, cost: 65, salePrice: 85, supplier: 'Bengal Grain Wholesalers' },
  { id: 'stk_03', sku: 'J003', name: 'Palm Oil / পাম অয়েল', category: 'Bhusimal & Spices', godown: 'Main Godown', unit: 'L', baseQty: 30, qty: 30, min: 10, cost: 120, salePrice: 150, supplier: 'Fortune Oils' },
  { id: 'stk_04', sku: 'J004', name: 'Refined Soyabean Oil', category: 'Bhusimal & Spices', godown: 'Main Godown', unit: 'L', baseQty: 40, qty: 40, min: 15, cost: 145, salePrice: 175, supplier: 'Fortune Oils' },
  { id: 'stk_05', sku: 'J005', name: 'Mustard Oil / মাস্টার অয়েল', category: 'Bhusimal & Spices', godown: 'Main Godown', unit: 'L', baseQty: 25, qty: 25, min: 10, cost: 160, salePrice: 195, supplier: 'Engine Brand Oils' },
  { id: 'stk_06', sku: 'J006', name: 'Maida / মাইদা', category: 'Bhusimal & Spices', godown: 'Main Godown', unit: 'kg', baseQty: 40, qty: 40, min: 15, cost: 38, salePrice: 50, supplier: 'Ganesh Flour Mills' },
  { id: 'stk_07', sku: 'J007', name: 'Atta / আটা', category: 'Bhusimal & Spices', godown: 'Main Godown', unit: 'kg', baseQty: 60, qty: 60, min: 20, cost: 42, salePrice: 55, supplier: 'Aashirvaad Atta Supplier' },
  { id: 'stk_08', sku: 'J008', name: 'Chowmein / চাউমিন (Noodles)', category: 'Bhusimal & Spices', godown: 'Kitchen Store', unit: 'packet', baseQty: 30, qty: 30, min: 10, cost: 35, salePrice: 50, supplier: 'Metro Food Distributors' },
  { id: 'stk_09', sku: 'J009', name: 'Tomato Ketchup / টমেটো সস', category: 'Bhusimal & Spices', godown: 'Kitchen Store', unit: 'L', baseQty: 15, qty: 15, min: 5, cost: 95, salePrice: 130, supplier: 'Kissan Distributors' },
  { id: 'stk_10', sku: 'J010', name: 'Chilli Sauce / চিলি সস', category: 'Bhusimal & Spices', godown: 'Kitchen Store', unit: 'Btl', baseQty: 12, qty: 12, min: 4, cost: 85, salePrice: 110, supplier: 'Ching\'s Secret Supplies' },
  { id: 'stk_11', sku: 'J011', name: 'Soy Sauce / সয়া সস', category: 'Bhusimal & Spices', godown: 'Kitchen Store', unit: 'Btl', baseQty: 10, qty: 10, min: 3, cost: 90, salePrice: 120, supplier: 'Ching\'s Secret Supplies' },
  { id: 'stk_12', sku: 'J012', name: 'Vinegar / ভিনেগার', category: 'Bhusimal & Spices', godown: 'Kitchen Store', unit: 'Btl', baseQty: 8, qty: 8, min: 3, cost: 60, salePrice: 85, supplier: 'Metro Food Distributors' },
  { id: 'stk_13', sku: 'J013', name: 'Corn Flour / কর্ন ফ্লাওয়ার', category: 'Bhusimal & Spices', godown: 'Kitchen Store', unit: 'kg', baseQty: 10, qty: 10, min: 4, cost: 70, salePrice: 95, supplier: 'Weikfield Distributors' },
  { id: 'stk_14', sku: 'J014', name: 'Kasuri Methi / কস্তুরী মেথী', category: 'Bhusimal & Spices', godown: 'Kitchen Store', unit: 'packet', baseQty: 15, qty: 15, min: 5, cost: 45, salePrice: 65, supplier: 'MDH Spices' },
  { id: 'stk_15', sku: 'J015', name: 'Chaat Masala / চাট মশলা', category: 'Bhusimal & Spices', godown: 'Kitchen Store', unit: 'packet', baseQty: 10, qty: 10, min: 3, cost: 65, salePrice: 85, supplier: 'Everest Spices' },
  { id: 'stk_16', sku: 'J016', name: 'Kashmiri Red Chilli Powder', category: 'Bhusimal & Spices', godown: 'Kitchen Store', unit: 'kg', baseQty: 5, qty: 5, min: 2, cost: 380, salePrice: 480, supplier: 'Everest Spices' },
  { id: 'stk_17', sku: 'J017', name: 'Ajinomoto / টেস্ট লবন', category: 'Bhusimal & Spices', godown: 'Kitchen Store', unit: 'kg', baseQty: 4, qty: 4, min: 2, cost: 140, salePrice: 180, supplier: 'Metro Food Distributors' },
  { id: 'stk_18', sku: 'J018', name: 'Chilli Powder / লঙ্কা গুঁড়ো', category: 'Bhusimal & Spices', godown: 'Kitchen Store', unit: 'kg', baseQty: 8, qty: 8, min: 3, cost: 260, salePrice: 320, supplier: 'Everest Spices' },
  { id: 'stk_19', sku: 'J019', name: 'Turmeric Powder (Haldi) / হলুদ', category: 'Bhusimal & Spices', godown: 'Kitchen Store', unit: 'kg', baseQty: 10, qty: 10, min: 3, cost: 220, salePrice: 280, supplier: 'Everest Spices' },
  { id: 'stk_20', sku: 'J020', name: 'Cumin (Jeera) / জিরা', category: 'Bhusimal & Spices', godown: 'Kitchen Store', unit: 'kg', baseQty: 8, qty: 8, min: 3, cost: 340, salePrice: 420, supplier: 'Spice Mart Kolkata' },
  { id: 'stk_21', sku: 'J021', name: 'Sugar / চিনি', category: 'Bhusimal & Spices', godown: 'Main Godown', unit: 'kg', baseQty: 50, qty: 50, min: 20, cost: 44, salePrice: 55, supplier: 'Metro Sugar Depot' },
  { id: 'stk_22', sku: 'J022', name: 'Cashew Nuts (Kaju) / কাজু', category: 'Bhusimal & Spices', godown: 'Main Godown', unit: 'kg', baseQty: 6, qty: 6, min: 2, cost: 750, salePrice: 950, supplier: 'Dry Fruit Traders' },
  { id: 'stk_23', sku: 'J023', name: 'Pure Desi Ghee / ঘি', category: 'Bhusimal & Spices', godown: 'Kitchen Store', unit: 'L', baseQty: 5, qty: 5, min: 3, cost: 680, salePrice: 850, supplier: 'Amul Dairy Distributor' },
  { id: 'stk_24', sku: 'J024', name: 'Eggs / ডিম', category: 'Bhusimal & Spices', godown: 'Kitchen Store', unit: 'pcs', baseQty: 150, qty: 150, min: 50, cost: 6, salePrice: 8, supplier: 'Bengal Poultry Farm' },

  // 2. Dairy Items
  { id: 'stk_25', sku: 'J025', name: 'Fresh Milk / দুধ', category: 'Dairy Items', godown: 'Kitchen Store', unit: 'L', baseQty: 20, qty: 20, min: 10, cost: 66, salePrice: 75, supplier: 'Mother Dairy' },
  { id: 'stk_26', sku: 'J026', name: 'Dahi (Curd) / দই', category: 'Dairy Items', godown: 'Kitchen Store', unit: 'kg', baseQty: 15, qty: 15, min: 5, cost: 80, salePrice: 100, supplier: 'Amul Dairy Distributor' },
  { id: 'stk_27', sku: 'J027', name: 'Amul Paneer / পনির', category: 'Dairy Items', godown: 'Kitchen Store', unit: 'kg', baseQty: 12, qty: 12, min: 4, cost: 360, salePrice: 440, supplier: 'Amul Dairy Distributor' },
  { id: 'stk_28', sku: 'J028', name: 'Amul Butter / মাখন', category: 'Dairy Items', godown: 'Kitchen Store', unit: 'kg', baseQty: 8, qty: 8, min: 3, cost: 540, salePrice: 620, supplier: 'Amul Dairy Distributor' },
  { id: 'stk_29', sku: 'J029', name: 'Amul Fresh Cream / ক্রিম', category: 'Dairy Items', godown: 'Kitchen Store', unit: 'pack', baseQty: 10, qty: 10, min: 3, cost: 180, salePrice: 220, supplier: 'Amul Dairy Distributor' },
  { id: 'stk_30', sku: 'J030', name: 'Cheese Block / চিজ', category: 'Dairy Items', godown: 'Kitchen Store', unit: 'kg', baseQty: 6, qty: 6, min: 2, cost: 420, salePrice: 520, supplier: 'Amul Dairy Distributor' },

  // 3. Cold Drinks
  { id: 'stk_31', sku: 'J031', name: 'Campa White (250ml)', category: 'Cold Drinks', godown: 'Storage 1', unit: 'pcs', baseQty: 48, qty: 48, min: 24, cost: 18, salePrice: 20, supplier: 'Reliance Beverages' },
  { id: 'stk_32', sku: 'J032', name: 'Campa Black (500ml)', category: 'Cold Drinks', godown: 'Storage 1', unit: 'pcs', baseQty: 36, qty: 36, min: 12, cost: 24, salePrice: 30, supplier: 'Reliance Beverages' },
  { id: 'stk_33', sku: 'J033', name: 'Kinley Water (1L)', category: 'Cold Drinks', godown: 'Storage 1', unit: 'Btl', baseQty: 60, qty: 60, min: 24, cost: 14, salePrice: 20, supplier: 'Coca Cola Distributor' },
  { id: 'stk_34', sku: 'J034', name: 'Bisleri Water (1L)', category: 'Cold Drinks', godown: 'Storage 1', unit: 'Btl', baseQty: 48, qty: 48, min: 24, cost: 14, salePrice: 20, supplier: 'Bisleri Agency Kolkata' },
  { id: 'stk_35', sku: 'J035', name: 'Thums Up (500ml)', category: 'Cold Drinks', godown: 'Storage 1', unit: 'pcs', baseQty: 48, qty: 48, min: 24, cost: 38, salePrice: 45, supplier: 'Coca Cola Distributor' },
  { id: 'stk_36', sku: 'J036', name: 'Sprite (500ml)', category: 'Cold Drinks', godown: 'Storage 1', unit: 'pcs', baseQty: 48, qty: 48, min: 24, cost: 38, salePrice: 45, supplier: 'Coca Cola Distributor' },
  { id: 'stk_37', sku: 'J037', name: 'Kinley Soda / সোডা', category: 'Cold Drinks', godown: 'Storage 1', unit: 'Btl', baseQty: 12, qty: 12, min: 12, cost: 14, salePrice: 20, supplier: 'Coca Cola Distributor' },

  // 4. Fresh Vegetables
  { id: 'stk_38', sku: 'J038', name: 'Potato / আলু', category: 'Fresh Vegetables', godown: 'Main Godown', unit: 'kg', baseQty: 80, qty: 80, min: 30, cost: 26, salePrice: 35, supplier: 'Kolkata Sabji Mandi' },
  { id: 'stk_39', sku: 'J039', name: 'Onion / পেঁয়াজ', category: 'Fresh Vegetables', godown: 'Main Godown', unit: 'kg', baseQty: 60, qty: 60, min: 25, cost: 35, salePrice: 45, supplier: 'Kolkata Sabji Mandi' },
  { id: 'stk_40', sku: 'J040', name: 'Ginger / আদা', category: 'Fresh Vegetables', godown: 'Kitchen Store', unit: 'kg', baseQty: 10, qty: 10, min: 4, cost: 160, salePrice: 210, supplier: 'Kolkata Sabji Mandi' },
  { id: 'stk_41', sku: 'J041', name: 'Garlic / রসুন', category: 'Fresh Vegetables', godown: 'Kitchen Store', unit: 'kg', baseQty: 12, qty: 12, min: 4, cost: 210, salePrice: 270, supplier: 'Kolkata Sabji Mandi' },
  { id: 'stk_42', sku: 'J042', name: 'Capsicum / ক্যাপসিকাম', category: 'Fresh Vegetables', godown: 'Kitchen Store', unit: 'kg', baseQty: 8, qty: 8, min: 3, cost: 90, salePrice: 120, supplier: 'Kolkata Sabji Mandi' },
  { id: 'stk_43', sku: 'J043', name: 'Carrot / গাজর', category: 'Fresh Vegetables', godown: 'Kitchen Store', unit: 'kg', baseQty: 10, qty: 10, min: 3, cost: 40, salePrice: 60, supplier: 'Kolkata Sabji Mandi' },
  { id: 'stk_44', sku: 'J044', name: 'Green Beans / বিনস', category: 'Fresh Vegetables', godown: 'Kitchen Store', unit: 'kg', baseQty: 6, qty: 6, min: 2, cost: 55, salePrice: 80, supplier: 'Kolkata Sabji Mandi' },
  { id: 'stk_45', sku: 'J045', name: 'Green Chilli / কাঁচা লঙ্কা', category: 'Fresh Vegetables', godown: 'Kitchen Store', unit: 'kg', baseQty: 5, qty: 5, min: 2, cost: 80, salePrice: 110, supplier: 'Kolkata Sabji Mandi' },
  { id: 'stk_46', sku: 'J046', name: 'Fresh Tomato / টমেটো', category: 'Fresh Vegetables', godown: 'Kitchen Store', unit: 'kg', baseQty: 15, qty: 15, min: 5, cost: 35, salePrice: 50, supplier: 'Kolkata Sabji Mandi' },

  // 5. Ice Cream
  { id: 'stk_47', sku: 'J047', name: '₹10 Rabdi Ice Cream', category: 'Ice Cream', godown: 'Storage 1', unit: 'pcs', baseQty: 30, qty: 30, min: 10, cost: 7, salePrice: 10, supplier: 'Amul Ice Cream Agency' },
  { id: 'stk_48', sku: 'J048', name: '₹20 Ice Cream Cone', category: 'Ice Cream', godown: 'Storage 1', unit: 'pcs', baseQty: 24, qty: 24, min: 8, cost: 14, salePrice: 20, supplier: 'Amul Ice Cream Agency' },
  { id: 'stk_49', sku: 'J049', name: '1L Gallon Vanilla Ice Cream', category: 'Ice Cream', godown: 'Storage 1', unit: 'box', baseQty: 4, qty: 4, min: 2, cost: 190, salePrice: 250, supplier: 'Amul Ice Cream Agency' },

  // 6. Packaging & Carry Bags
  { id: 'stk_50', sku: 'J050', name: '1000ml Food Container', category: 'Packaging & Carry Bags', godown: 'Storage 1', unit: 'pcs', baseQty: 250, qty: 250, min: 100, cost: 6.5, salePrice: 10, supplier: 'PackWell Solutions' },
  { id: 'stk_51', sku: 'J051', name: '500ml Food Container', category: 'Packaging & Carry Bags', godown: 'Storage 1', unit: 'pcs', baseQty: 400, qty: 400, min: 150, cost: 4.2, salePrice: 7, supplier: 'PackWell Solutions' },
  { id: 'stk_52', sku: 'J052', name: '16x20 Carry Bag', category: 'Packaging & Carry Bags', godown: 'Storage 1', unit: 'pcs', baseQty: 500, qty: 500, min: 100, cost: 2.1, salePrice: 3.5, supplier: 'PackWell Solutions' },

  // 7. Cleaning & Washings
  { id: 'stk_53', sku: 'J053', name: 'Vim Soap / ভিম সাবান', category: 'Cleaning & Washings', godown: 'Main Godown', unit: 'pcs', baseQty: 30, qty: 30, min: 10, cost: 12, salePrice: 15, supplier: 'Hindustan Unilever Wholesale' },
  { id: 'stk_54', sku: 'J054', name: 'Vim Liquid Dishwash', category: 'Cleaning & Washings', godown: 'Main Godown', unit: 'Btl', baseQty: 10, qty: 10, min: 4, cost: 115, salePrice: 145, supplier: 'Hindustan Unilever Wholesale' },
  { id: 'stk_55', sku: 'J055', name: 'Harpic Toilet Cleaner', category: 'Cleaning & Washings', godown: 'Main Godown', unit: 'Btl', baseQty: 8, qty: 8, min: 3, cost: 100, salePrice: 130, supplier: 'Reckitt Benckiser Distributor' }
];

// Global State
let stockItems = [];
let stockInEntries = [];
let stockOutEntries = [];
let stockLogs = [];

let activeCategory = 'all';
let activeStockLevel = 'all';
let activeStatus = 'all';
let selectedGodown = 'all';
let activeLogFilter = 'all';
let searchQuery = '';
let viewMode = 'feed'; // 'feed' or 'table'

// Load data
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ITEMS);
    if (raw) {
      stockItems = JSON.parse(raw);
    } else {
      stockItems = JSON.parse(JSON.stringify(DEFAULT_ITEMS));
    }
  } catch (e) {
    stockItems = JSON.parse(JSON.stringify(DEFAULT_ITEMS));
  }

  // Ensure every item has SKU
  stockItems.forEach((item, index) => {
    if (!item.sku) {
      item.sku = `J${String(index + 1).padStart(3, '0')}`;
    }
    if (item.baseQty === undefined) item.baseQty = item.qty || 0;
  });

  try {
    const rawIn = localStorage.getItem(STORAGE_KEY_IN);
    stockInEntries = rawIn ? JSON.parse(rawIn) : [];
  } catch (e) {
    stockInEntries = [];
  }

  try {
    const rawOut = localStorage.getItem(STORAGE_KEY_OUT);
    stockOutEntries = rawOut ? JSON.parse(rawOut) : [];
  } catch (e) {
    stockOutEntries = [];
  }

  try {
    const rawLogs = localStorage.getItem(STORAGE_KEY_LOGS);
    stockLogs = rawLogs ? JSON.parse(rawLogs) : [];
  } catch (e) {
    stockLogs = [];
  }

  // Calculate actual balances
  recalculateBalances();
  saveState();
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(stockItems));
    localStorage.setItem(STORAGE_KEY_IN, JSON.stringify(stockInEntries));
    localStorage.setItem(STORAGE_KEY_OUT, JSON.stringify(stockOutEntries));
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(stockLogs));
  } catch (e) {
    console.warn('[StockManager] Save state failed:', e);
  }
}

// ═════════════════════════════════════════════════════════════════════
// CALCULATION ENGINE: Actual Balance = Base Qty + Total IN - Total OUT
// ═════════════════════════════════════════════════════════════════════
function recalculateBalances() {
  stockItems.forEach(item => {
    const totalIn = stockInEntries
      .filter(e => e.sku === item.sku)
      .reduce((sum, e) => sum + safeNum(e.qty), 0);

    const totalOut = stockOutEntries
      .filter(e => e.sku === item.sku)
      .reduce((sum, e) => sum + safeNum(e.qty), 0);

    const base = safeNum(item.baseQty, 0);
    item.totalIn = totalIn;
    item.totalOut = totalOut;
    item.qty = parseFloat((base + totalIn - totalOut).toFixed(2));
  });
}

function addLog(itemName, location, actionType, qtyText, notes = '') {
  const log = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    date: new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    itemName,
    location: location || 'Main Godown',
    type: actionType,
    qtyText,
    notes: notes || 'Entry record'
  };
  stockLogs.unshift(log);
  if (stockLogs.length > 80) stockLogs = stockLogs.slice(0, 80);
  saveState();
  renderLogs();
}

// Toast Notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bgColors = {
    success: 'bg-emerald-950/95 text-emerald-200 border-emerald-700/80',
    info: 'bg-slate-900/95 text-slate-100 border-slate-700/80',
    warning: 'bg-amber-950/95 text-amber-200 border-amber-700/80',
    error: 'bg-rose-950/95 text-rose-200 border-rose-700/80'
  };

  const icons = {
    success: '✅',
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌'
  };

  toast.className = `stock-toast ${bgColors[type] || bgColors.info}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// Filtered Items for Directory and Balance Box
function getFilteredItems() {
  const query = (searchQuery || '').toLowerCase().trim();

  return stockItems.filter(item => {
    if (!item) return false;

    // Category match
    const catMatch = activeCategory === 'all' || item.category === activeCategory;

    // Godown match
    const godownMatch = selectedGodown === 'all' || item.godown === selectedGodown;

    // Stock Level Filter (All, In Stock, Low Stock, Negative)
    const isNegative = item.qty < 0;
    const isLow = !isNegative && item.qty <= item.min;
    const isInStock = item.qty > 0;

    let levelMatch = true;
    if (activeStockLevel === 'instock') levelMatch = isInStock;
    if (activeStockLevel === 'low') levelMatch = isLow || isNegative;
    if (activeStockLevel === 'negative') levelMatch = isNegative;

    // Status match
    let statusMatch = true;
    if (activeStatus === 'active') statusMatch = item.qty > 0;
    if (activeStatus === 'out') statusMatch = item.qty === 0;

    // Search query match
    const searchMatch = !query ||
      (item.name && item.name.toLowerCase().includes(query)) ||
      (item.sku && item.sku.toLowerCase().includes(query)) ||
      (item.category && item.category.toLowerCase().includes(query)) ||
      (item.supplier && item.supplier.toLowerCase().includes(query));

    return catMatch && godownMatch && levelMatch && statusMatch && searchMatch;
  });
}

// ═════════════════════════════════════════════════════════════════════
// SPREADSHEET TABLES: 📥 STOCK IN, 📤 STOCK OUT, and ⚖️ BALANCE
// ═════════════════════════════════════════════════════════════════════
function renderInOutBalanceTables() {
  const inBody = document.getElementById('table-in-body');
  const outBody = document.getElementById('table-out-body');
  const balanceBody = document.getElementById('table-balance-body');

  const badgeIn = document.getElementById('badge-in-count');
  const badgeOut = document.getElementById('badge-out-count');
  const badgeBalance = document.getElementById('badge-balance-count');

  const q = (searchQuery || '').toLowerCase().trim();

  const filteredIn = q
    ? stockInEntries.filter(e => (e.description && e.description.toLowerCase().includes(q)) || (e.sku && e.sku.toLowerCase().includes(q)))
    : stockInEntries;

  const filteredOut = q
    ? stockOutEntries.filter(e => (e.description && e.description.toLowerCase().includes(q)) || (e.sku && e.sku.toLowerCase().includes(q)))
    : stockOutEntries;

  const filteredItems = getFilteredItems();

  if (badgeIn) badgeIn.textContent = `${filteredIn.length} entries`;
  if (badgeOut) badgeOut.textContent = `${filteredOut.length} entries`;
  if (badgeBalance) badgeBalance.textContent = `${filteredItems.length} items`;

  // 1. Render TABLE 1: STOCK IN
  if (inBody) {
    if (filteredIn.length === 0) {
      inBody.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-slate-500 font-medium">No Stock IN entries yet. Click "+ Record IN Stock" to add.</td></tr>';
    } else {
      inBody.innerHTML = filteredIn.map(entry => `
        <tr class="hover:bg-slate-900/60 transition-colors">
          <td class="py-2 px-2 text-slate-400 font-mono whitespace-nowrap">${entry.date}</td>
          <td class="py-2 px-2 font-bold text-emerald-400 font-mono">${entry.sku}</td>
          <td class="py-2 px-2 font-semibold text-white truncate max-w-[130px] sm:max-w-none">${entry.description}</td>
          <td class="py-2 px-2 text-slate-400 text-[11px]">${entry.unit}</td>
          <td class="py-2 px-2 text-right font-black text-emerald-300">+${entry.qty}</td>
          <td class="py-2 px-1 text-center stock-no-print">
            <button class="btn-del-in text-rose-400 hover:text-rose-300 font-bold p-1 cursor-pointer transition-transform active:scale-95" data-id="${entry.id}" title="Delete wrong IN entry">🗑️</button>
          </td>
        </tr>
      `).join('');

      inBody.querySelectorAll('.btn-del-in').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteStockInEntry(btn.dataset.id);
        });
      });
    }
  }

  // 2. Render TABLE 2: STOCK OUT
  if (outBody) {
    if (filteredOut.length === 0) {
      outBody.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-slate-500 font-medium">No Stock OUT entries yet. Click "- Record OUT Stock" to add.</td></tr>';
    } else {
      outBody.innerHTML = filteredOut.map(entry => `
        <tr class="hover:bg-slate-900/60 transition-colors">
          <td class="py-2 px-2 text-slate-400 font-mono whitespace-nowrap">${entry.date}</td>
          <td class="py-2 px-2 font-bold text-amber-400 font-mono">${entry.sku}</td>
          <td class="py-2 px-2 font-semibold text-white truncate max-w-[130px] sm:max-w-none">${entry.description}</td>
          <td class="py-2 px-2 text-slate-400 text-[11px]">${entry.unit}</td>
          <td class="py-2 px-2 text-right font-black text-amber-300">-${entry.qty}</td>
          <td class="py-2 px-1 text-center stock-no-print">
            <button class="btn-del-out text-rose-400 hover:text-rose-300 font-bold p-1 cursor-pointer transition-transform active:scale-95" data-id="${entry.id}" title="Delete wrong OUT entry">🗑️</button>
          </td>
        </tr>
      `).join('');

      outBody.querySelectorAll('.btn-del-out').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteStockOutEntry(btn.dataset.id);
        });
      });
    }
  }

  // 3. Render TABLE 3: REAL-TIME BALANCE
  if (balanceBody) {
    if (filteredItems.length === 0) {
      balanceBody.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-slate-500 font-medium">No matching stock items.</td></tr>';
    } else {
      balanceBody.innerHTML = filteredItems.map(item => {
        const isNegative = item.qty < 0;
        const isLow = !isNegative && item.qty <= item.min;
        const isOut = item.qty === 0;

        let badgeClass = 'text-sky-300';
        let warningText = '';
        let rowBg = '';

        if (isNegative) {
          badgeClass = 'text-rose-400 font-black';
          warningText = ' ⚠️ Negative';
          rowBg = 'bg-rose-950/20';
        } else if (isOut) {
          badgeClass = 'text-rose-400 font-black';
          warningText = ' ⚠️ Out';
          rowBg = 'bg-rose-950/20';
        } else if (isLow) {
          badgeClass = 'text-amber-300 font-black';
          warningText = ' ⚠️ Low';
          rowBg = 'bg-amber-950/15';
        }

        return `
          <tr data-action="view-details" data-id="${item.id}" class="hover:bg-slate-900/60 transition-colors cursor-pointer ${rowBg}">
            <td class="py-2 px-2 font-bold text-sky-400 font-mono">${item.sku}</td>
            <td class="py-2 px-2 font-semibold text-white truncate max-w-[130px] sm:max-w-none">${item.name}</td>
            <td class="py-2 px-2 text-slate-400 text-[11px]">${item.unit}</td>
            <td class="py-2 px-2 text-right font-black ${badgeClass}">${item.qty}${warningText}</td>
          </tr>
        `;
      }).join('');

      balanceBody.querySelectorAll('tr[data-action="view-details"]').forEach(row => {
        row.addEventListener('click', () => openItemDetailsModal(row.dataset.id));
      });
    }
  }

  renderCriticalStockSection();
}

function deleteStockInEntry(entryId) {
  const index = stockInEntries.findIndex(e => e.id === entryId);
  if (index === -1) return;
  const entry = stockInEntries[index];

  if (!confirm(`Are you sure you want to delete this Stock IN entry?\n\nSKU: ${entry.sku}\nItem: ${entry.description}\nQty: +${entry.qty} ${entry.unit}\nDate: ${entry.date}`)) {
    return;
  }

  stockInEntries.splice(index, 1);
  recalculateBalances();
  saveState();
  addLog(entry.description, 'Main Godown', 'Delete Stock IN', `-${entry.qty} ${entry.unit}`, `Removed Stock IN entry for SKU ${entry.sku}`);
  renderAll();
  showToast(`Deleted Stock IN entry for "${entry.description}"`, 'info');
}

function deleteStockOutEntry(entryId) {
  const index = stockOutEntries.findIndex(e => e.id === entryId);
  if (index === -1) return;
  const entry = stockOutEntries[index];

  if (!confirm(`Are you sure you want to delete this Stock OUT entry?\n\nSKU: ${entry.sku}\nItem: ${entry.description}\nQty: -${entry.qty} ${entry.unit}\nDate: ${entry.date}`)) {
    return;
  }

  stockOutEntries.splice(index, 1);
  recalculateBalances();
  saveState();
  addLog(entry.description, 'Main Godown', 'Delete Stock OUT', `+${entry.qty} ${entry.unit}`, `Removed Stock OUT entry for SKU ${entry.sku}`);
  renderAll();
  showToast(`Deleted Stock OUT entry for "${entry.description}"`, 'info');
}

// ═════════════════════════════════════════════════════════════════════
// CRITICAL OUT-OF-STOCK & LOW-STOCK ALERTS MINI-CARDS
// ═════════════════════════════════════════════════════════════════════
function renderCriticalStockSection() {
  const sectionEl = document.getElementById('critical-stock-section');
  const gridEl = document.getElementById('critical-items-grid');
  const badgeEl = document.getElementById('critical-count-badge');
  if (!sectionEl || !gridEl) return;

  const criticalItems = stockItems.filter(item => item.qty <= item.min);

  if (badgeEl) badgeEl.textContent = `${criticalItems.length} critical item${criticalItems.length === 1 ? '' : 's'}`;

  if (criticalItems.length === 0) {
    sectionEl.classList.add('hidden');
    gridEl.innerHTML = '';
    return;
  }

  sectionEl.classList.remove('hidden');
  gridEl.innerHTML = criticalItems.map(item => {
    const isOut = item.qty === 0;
    const isNegative = item.qty < 0;

    let tagText = 'LOW STOCK';
    let tagColor = 'bg-amber-950 text-amber-300 border-amber-800';

    if (isNegative) {
      tagText = 'NEGATIVE';
      tagColor = 'bg-rose-950 text-rose-300 border-rose-800';
    } else if (isOut) {
      tagText = 'OUT OF STOCK';
      tagColor = 'bg-rose-950 text-rose-300 border-rose-800';
    }

    return `
      <div data-action="view-details" data-id="${item.id}" class="bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 rounded-xl p-3 space-y-2 cursor-pointer transition-all shadow-lg">
        <div class="flex items-start justify-between gap-1">
          <span class="text-[10px] font-bold font-mono text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800/80">${item.sku}</span>
          <span class="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${tagColor}">${tagText}</span>
        </div>
        <div>
          <h4 class="text-xs font-bold text-white truncate" title="${item.name}">${item.name}</h4>
          <p class="text-[10px] text-slate-400 truncate">${item.category}</p>
        </div>
        <div class="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11px]">
          <span class="text-slate-400">Balance:</span>
          <span class="font-extrabold ${item.qty <= 0 ? 'text-rose-400' : 'text-amber-300'}">${item.qty} ${item.unit}</span>
        </div>
      </div>
    `;
  }).join('');

  gridEl.querySelectorAll('div[data-action="view-details"]').forEach(card => {
    card.addEventListener('click', () => openItemDetailsModal(card.dataset.id));
  });
}

// ═════════════════════════════════════════════════════════════════════
// KPI SUMMARY CARDS
// ═════════════════════════════════════════════════════════════════════
function renderKPIs() {
  const totalItems = stockItems.length;
  let lowCount = 0;
  let totalValue = 0;

  stockItems.forEach(item => {
    if (item.qty <= item.min) lowCount++;
    const validQty = Math.max(0, safeNum(item.qty, 0));
    totalValue += (validQty * safeNum(item.cost, 0));
  });

  const totalEl = document.getElementById('kpi-total-items');
  const lowEl = document.getElementById('kpi-low-items');
  const valEl = document.getElementById('kpi-total-value');

  if (totalEl) totalEl.textContent = totalItems;
  if (lowEl) lowEl.textContent = lowCount;
  if (valEl) valEl.textContent = '₹ ' + safeMoney(totalValue);
}

// ═════════════════════════════════════════════════════════════════════
// MASTER INVENTORY DIRECTORY (Card Feed & Table Views)
// ═════════════════════════════════════════════════════════════════════
function renderCardFeed() {
  const feedContainer = document.getElementById('stock-feed-container');
  const emptyState = document.getElementById('stock-empty-state');
  const badge = document.getElementById('stock-count-badge');
  const filtered = getFilteredItems();

  if (badge) badge.textContent = `${filtered.length} item(s)`;

  if (filtered.length === 0) {
    if (feedContainer) feedContainer.innerHTML = '';
    emptyState?.classList.remove('hidden');
    return;
  }

  emptyState?.classList.add('hidden');
  if (!feedContainer) return;

  feedContainer.innerHTML = filtered.map(item => {
    const isNegative = item.qty < 0;
    const isLow = !isNegative && item.qty <= item.min;
    const itemValue = Math.max(0, item.qty) * item.cost;

    let qtyColor = 'text-emerald-400';
    if (isNegative || item.qty === 0) qtyColor = 'text-rose-400';
    else if (isLow) qtyColor = 'text-amber-300';

    return `
      <div data-action="view-details" data-id="${item.id}" class="stock-item-feed-card ${isNegative ? 'is-negative' : ''}">
        <div class="flex items-start justify-between gap-2 border-b border-slate-800/60 pb-2.5">
          <div>
            <div class="flex items-center gap-1.5">
              <span class="text-[10px] font-bold font-mono text-emerald-400 bg-emerald-950 px-1.5 py-0.2 rounded border border-emerald-800/80">${item.sku}</span>
              <h3 class="text-sm font-extrabold text-white group-hover:text-emerald-400 transition-colors">${item.name}</h3>
            </div>
            ${item.supplier ? `<p class="text-[10px] text-slate-400 mt-1 truncate max-w-[180px]">Supplier: ${item.supplier}</p>` : ''}
          </div>
          <span class="stock-pill-btn text-[10px] uppercase font-bold shrink-0 bg-slate-950 border-slate-800 text-slate-300">
            ${item.category}
          </span>
        </div>

        <div class="flex items-center justify-between pt-2.5 text-xs">
          <div class="flex items-center gap-1.5">
            <span class="text-slate-400 font-medium">Stock Value:</span>
            <span class="font-extrabold text-teal-300">₹ ${safeMoney(itemValue)}</span>
          </div>

          <div class="flex items-center gap-1.5">
            <span class="text-slate-400">•</span>
            <span class="text-slate-400 font-medium">Actual Balance:</span>
            <span class="font-black ${qtyColor}">${item.qty} ${item.unit}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  feedContainer.querySelectorAll('div[data-action="view-details"]').forEach(card => {
    card.addEventListener('click', () => openItemDetailsModal(card.dataset.id));
  });
}

function renderTable() {
  const tbody = document.getElementById('stock-table-body');
  if (!tbody) return;

  const filtered = getFilteredItems();

  tbody.innerHTML = filtered.map(item => {
    const isNegative = item.qty < 0;
    const isOut = item.qty === 0;
    const isLow = !isNegative && !isOut && item.qty <= item.min;
    
    let statusBadge = '';
    if (isNegative) {
      statusBadge = `<span class="stock-badge stock-badge-negative">Negative (${item.qty})</span>`;
    } else if (isOut) {
      statusBadge = '<span class="stock-badge stock-badge-out">Out of Stock</span>';
    } else if (isLow) {
      statusBadge = '<span class="stock-badge stock-badge-low">Low Stock</span>';
    } else {
      statusBadge = '<span class="stock-badge stock-badge-healthy">In Stock</span>';
    }

    const itemValue = (Math.max(0, item.qty) * item.cost);

    return `
      <tr data-action="view-details" data-id="${item.id}" class="stock-table-row group ${isNegative ? 'bg-rose-950/20' : ''}">
        <td class="font-semibold text-white">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold font-mono text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800/80">${item.sku}</span>
            <div class="text-sm font-bold group-hover:text-emerald-400 transition-colors">${item.name}</div>
          </div>
          <p class="text-[10px] text-slate-400 mt-0.5">${item.supplier || 'No supplier'}</p>
        </td>
        <td class="text-slate-300 text-xs">
          <span class="bg-slate-950 border border-slate-800 px-2 py-0.5 rounded-lg text-[10px] font-bold text-slate-300">${item.category}</span>
        </td>
        <td class="text-slate-400 text-xs">${item.godown || 'Main Godown'}</td>
        <td class="text-center font-black ${isNegative ? 'text-rose-400' : 'text-emerald-400'}">
          ${item.qty} ${item.unit}
        </td>
        <td class="text-right text-slate-300">₹ ${safeMoney(item.salePrice)}</td>
        <td class="text-right text-slate-400">₹ ${safeMoney(item.cost)}</td>
        <td class="text-right font-bold text-teal-300">₹ ${safeMoney(itemValue)}</td>
        <td class="text-center">${statusBadge}</td>
        <td class="text-right space-x-1 stock-no-print" onclick="event.stopPropagation()">
          <button data-action="quick-adjust" data-id="${item.id}" class="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-xs text-teal-300 font-bold rounded-lg border border-slate-700">⚡ Adjust</button>
          <button data-action="edit" data-id="${item.id}" class="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 rounded-lg border border-slate-700">✏️</button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('tr[data-action="view-details"]').forEach(row => {
    row.addEventListener('click', () => openItemDetailsModal(row.dataset.id));
  });

  tbody.querySelectorAll('button[data-action="quick-adjust"]').forEach(btn => {
    btn.addEventListener('click', () => openAdjustModal(btn.dataset.id));
  });

  tbody.querySelectorAll('button[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => openItemModal(btn.dataset.id));
  });
}

// ═════════════════════════════════════════════════════════════════════
// RECENT AUDIT LEDGER
// ═════════════════════════════════════════════════════════════════════
function renderLogs() {
  const tbody = document.getElementById('stock-logs-body');
  if (!tbody) return;

  const filtered = activeLogFilter === 'all'
    ? stockLogs
    : stockLogs.filter(l => l.type && l.type.toLowerCase().includes(activeLogFilter.toLowerCase()));

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-500 font-medium">No stock transaction logs matching filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.slice(0, 50).map(log => {
    let badgeClass = 'bg-slate-950 text-slate-300 border-slate-800';
    if (log.type && log.type.includes('IN')) {
      badgeClass = 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80';
    } else if (log.type && log.type.includes('OUT')) {
      badgeClass = 'bg-amber-950/80 text-amber-300 border-amber-800/80';
    } else if (log.type && log.type.includes('Delete')) {
      badgeClass = 'bg-rose-950/80 text-rose-300 border-rose-800/80';
    }

    return `
      <tr class="hover:bg-slate-800/20 transition-colors">
        <td class="py-2.5 px-4 text-slate-400 whitespace-nowrap font-mono text-[11px]">${log.date}</td>
        <td class="py-2.5 px-4 font-bold text-white">${log.itemName}</td>
        <td class="py-2.5 px-4">
          <span class="px-2 py-0.5 rounded-md text-[10px] font-semibold border ${badgeClass}">${log.type}</span>
        </td>
        <td class="py-2.5 px-4 text-center font-bold font-mono ${log.qtyText.startsWith('-') ? 'text-amber-400' : 'text-emerald-400'}">${log.qtyText}</td>
        <td class="py-2.5 px-4 text-slate-400 text-xs">${log.notes || '—'}</td>
      </tr>
    `;
  }).join('');
}

function renderAll() {
  renderKPIs();
  renderInOutBalanceTables();
  renderCardFeed();
  renderTable();
  renderLogs();
}

// ═════════════════════════════════════════════════════════════════════
// RECORD STOCK IN / OUT ENTRY MODAL WORKFLOW
// ═════════════════════════════════════════════════════════════════════
function openInOutModal(mode = 'IN') {
  const modal = document.getElementById('modal-inout-entry');
  const title = document.getElementById('modal-inout-title');
  const modeInput = document.getElementById('inout-mode');
  const dateInput = document.getElementById('inout-date');
  const itemSelect = document.getElementById('inout-item-select');
  const unitDisplay = document.getElementById('inout-unit-display');
  const qtyInput = document.getElementById('inout-qty');
  const submitBtn = document.getElementById('inout-submit-btn');

  if (!modal || !itemSelect) return;

  modeInput.value = mode;
  title.textContent = mode === 'IN' ? '📥 Record Stock IN Entry' : '📤 Record Stock OUT Entry';
  submitBtn.textContent = mode === 'IN' ? 'Save IN Entry' : 'Save OUT Entry';
  submitBtn.className = mode === 'IN'
    ? 'px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg transition-all'
    : 'px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-lg transition-all';

  dateInput.value = new Date().toISOString().slice(0, 10);
  qtyInput.value = '';

  // Sort and populate options
  const sorted = [...stockItems].sort((a, b) => (a.sku || '').localeCompare(b.sku || ''));
  itemSelect.innerHTML = sorted.map(item => `
    <option value="${item.sku}" data-unit="${item.unit}" data-name="${item.name}">${item.sku} — ${item.name} (${item.category})</option>
  `).join('');

  // Set unit display for currently selected item
  const selectedOpt = itemSelect.options[itemSelect.selectedIndex];
  if (selectedOpt && unitDisplay) {
    unitDisplay.value = selectedOpt.dataset.unit || 'pcs';
  }

  itemSelect.onchange = () => {
    const opt = itemSelect.options[itemSelect.selectedIndex];
    if (opt && unitDisplay) {
      unitDisplay.value = opt.dataset.unit || 'pcs';
    }
  };

  modal.classList.remove('hidden');
}

function closeInOutModal() {
  document.getElementById('modal-inout-entry')?.classList.add('hidden');
}

function handleInOutSubmit(e) {
  e.preventDefault();
  const mode = document.getElementById('inout-mode').value;
  const date = document.getElementById('inout-date').value;
  const itemSelect = document.getElementById('inout-item-select');
  const selectedOpt = itemSelect.options[itemSelect.selectedIndex];
  const sku = itemSelect.value;
  const description = selectedOpt.dataset.name || 'Item';
  const unit = selectedOpt.dataset.unit || 'pcs';
  const qty = safeNum(document.getElementById('inout-qty').value, 0);

  if (qty <= 0) {
    showToast('Please enter a valid quantity greater than 0.', 'error');
    return;
  }

  const entry = {
    id: 'entry_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    date,
    sku,
    description,
    unit,
    qty
  };

  if (mode === 'IN') {
    stockInEntries.unshift(entry);
    addLog(description, 'Main Godown', 'Stock IN', `+${qty} ${unit}`, `Manual IN record for SKU ${sku}`);
    showToast(`Recorded Stock IN: +${qty} ${unit} for "${description}"`, 'success');
  } else {
    stockOutEntries.unshift(entry);
    addLog(description, 'Main Godown', 'Stock OUT', `-${qty} ${unit}`, `Manual OUT record for SKU ${sku}`);
    showToast(`Recorded Stock OUT: -${qty} ${unit} for "${description}"`, 'warning');
  }

  recalculateBalances();
  saveState();
  closeInOutModal();
  renderAll();
}

// ═════════════════════════════════════════════════════════════════════
// ITEM DETAILS DRAWER / MODAL
// ═════════════════════════════════════════════════════════════════════
function openItemDetailsModal(itemId) {
  const item = stockItems.find(i => i.id === itemId);
  if (!item) return;

  const modal = document.getElementById('modal-item-details');
  if (!modal) return;

  document.getElementById('detail-item-sku').textContent = item.sku;
  document.getElementById('detail-item-name').textContent = item.name;
  document.getElementById('detail-item-supplier').textContent = `Supplier: ${item.supplier || 'Not specified'}`;
  document.getElementById('detail-item-category-badge').textContent = item.category;

  document.getElementById('detail-sale-price').textContent = `₹ ${safeMoney(item.salePrice)}`;
  document.getElementById('detail-purchase-price').textContent = `₹ ${safeMoney(item.cost)}`;
  document.getElementById('detail-in-stock').textContent = `${item.qty} ${item.unit}`;
  document.getElementById('detail-stock-value').textContent = `₹ ${safeMoney(Math.max(0, item.qty) * item.cost)}`;

  const whatsappLink = document.getElementById('detail-supplier-link');
  if (whatsappLink) {
    const rawNumber = (item.supplier || '').replace(/[^0-9]/g, '');
    if (rawNumber && rawNumber.length >= 10) {
      whatsappLink.href = `https://wa.me/91${rawNumber.slice(-10)}?text=Hello%20LIMRA%20Restaurant%20needs%20restock%20for%20${encodeURIComponent(item.name)}`;
      whatsappLink.style.display = 'flex';
    } else {
      whatsappLink.style.display = 'none';
    }
  }

  // Ledger body for this item
  const ledgerBody = document.getElementById('detail-ledger-body');
  const countEl = document.getElementById('detail-tx-count');

  const inRows = stockInEntries.filter(e => e.sku === item.sku).map(e => ({ ...e, type: 'IN (+)' }));
  const outRows = stockOutEntries.filter(e => e.sku === item.sku).map(e => ({ ...e, type: 'OUT (-)' }));
  const combined = [...inRows, ...outRows].sort((a, b) => b.date.localeCompare(a.date));

  if (countEl) countEl.textContent = `${combined.length} entries`;

  if (ledgerBody) {
    if (combined.length === 0) {
      ledgerBody.innerHTML = '<tr><td colspan="3" class="py-4 text-center text-slate-500">No IN or OUT ledger records for this item yet.</td></tr>';
    } else {
      ledgerBody.innerHTML = combined.map(e => `
        <tr class="hover:bg-slate-900/60">
          <td class="py-2 px-3">
            <span class="font-bold text-white">${e.type}</span>
            <span class="text-slate-500 text-[10px] ml-1.5 font-mono">${e.date}</span>
          </td>
          <td class="py-2 px-3 text-center font-bold ${e.type.includes('IN') ? 'text-emerald-400' : 'text-amber-400'}">${e.qty} ${e.unit}</td>
          <td class="py-2 px-3 text-right font-mono text-slate-300">₹ ${safeMoney(e.qty * item.cost)}</td>
        </tr>
      `).join('');
    }
  }

  document.getElementById('btn-details-adjust-stock').onclick = () => {
    closeItemDetailsModal();
    openAdjustModal(item.id);
  };

  document.getElementById('btn-details-edit').onclick = () => {
    closeItemDetailsModal();
    openItemModal(item.id);
  };

  modal.classList.remove('hidden');
}

function closeItemDetailsModal() {
  document.getElementById('modal-item-details')?.classList.add('hidden');
}

// ═════════════════════════════════════════════════════════════════════
// QUICK ADJUST MODAL
// ═════════════════════════════════════════════════════════════════════
function openAdjustModal(itemId) {
  const item = stockItems.find(i => i.id === itemId);
  if (!item) return;

  const modal = document.getElementById('modal-adjust-stock');
  if (!modal) return;

  document.getElementById('adjust-target-id').value = item.id;
  document.getElementById('adjust-item-display').value = `${item.sku} — ${item.name}`;
  document.getElementById('adjust-godown-select').value = item.godown || 'Main Godown';
  document.getElementById('adjust-workflow-unit').value = item.unit || 'pcs';
  document.getElementById('adjust-workflow-qty').value = '';
  document.getElementById('adjust-workflow-notes').value = '';
  document.getElementById('adjust-mode').value = 'add';

  const btnAdd = document.getElementById('toggle-type-add');
  const btnReduce = document.getElementById('toggle-type-reduce');
  if (btnAdd && btnReduce) {
    btnAdd.className = 'erp-toggle-btn btn-add active';
    btnReduce.className = 'erp-toggle-btn btn-reduce';
  }

  modal.classList.remove('hidden');
}

function closeAdjustModal() {
  document.getElementById('modal-adjust-stock')?.classList.add('hidden');
}

function handleAdjustSubmit(e) {
  e.preventDefault();
  const itemId = document.getElementById('adjust-target-id').value;
  const item = stockItems.find(i => i.id === itemId);
  if (!item) return;

  const mode = document.getElementById('adjust-mode').value; // 'add' or 'reduce'
  const qty = safeNum(document.getElementById('adjust-workflow-qty').value, 0);
  const notes = document.getElementById('adjust-workflow-notes').value || 'Workflow Adjustment';
  const godown = document.getElementById('adjust-godown-select').value;
  const date = new Date().toISOString().slice(0, 10);

  if (qty <= 0) {
    showToast('Please enter a valid quantity greater than 0.', 'error');
    return;
  }

  const entry = {
    id: 'entry_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    date,
    sku: item.sku,
    description: item.name,
    unit: item.unit,
    qty
  };

  if (mode === 'add') {
    stockInEntries.unshift(entry);
    addLog(item.name, godown, 'Stock IN (+)', `+${qty} ${item.unit}`, notes);
    showToast(`Added +${qty} ${item.unit} to "${item.name}"`, 'success');
  } else {
    stockOutEntries.unshift(entry);
    addLog(item.name, godown, 'Stock OUT (-)', `-${qty} ${item.unit}`, notes);
    showToast(`Reduced -${qty} ${item.unit} from "${item.name}"`, 'warning');
  }

  recalculateBalances();
  saveState();
  closeAdjustModal();
  renderAll();
}

// ═════════════════════════════════════════════════════════════════════
// ADD / EDIT STOCK ITEM MODAL
// ═════════════════════════════════════════════════════════════════════
function openItemModal(itemId = null) {
  const modal = document.getElementById('modal-item');
  const title = document.getElementById('modal-item-title');
  if (!modal) return;

  const item = itemId ? stockItems.find(i => i.id === itemId) : null;

  document.getElementById('form-item-id').value = item ? item.id : '';
  title.innerHTML = item ? '<span>✏️</span> Edit Stock Item' : '<span>📦</span> Add New Item';

  document.getElementById('form-item-name').value = item ? item.name : '';
  document.getElementById('form-item-sku').value = item ? item.sku : `J${String(stockItems.length + 1).padStart(3, '0')}`;
  document.getElementById('form-item-category').value = item ? item.category : 'Bhusimal & Spices';
  document.getElementById('form-item-godown').value = item ? item.godown : 'Main Godown';
  document.getElementById('form-item-unit').value = item ? item.unit : 'kg';
  document.getElementById('form-item-qty').value = item ? item.baseQty : '';
  document.getElementById('form-item-min').value = item ? item.min : '10';
  document.getElementById('form-item-sale-price').value = item ? item.salePrice || '' : '';
  document.getElementById('form-item-cost').value = item ? item.cost : '';
  document.getElementById('form-item-supplier').value = item ? item.supplier || '' : '';

  modal.classList.remove('hidden');
}

function closeItemModal() {
  document.getElementById('modal-item')?.classList.add('hidden');
}

function handleItemSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('form-item-id').value;
  const name = document.getElementById('form-item-name').value.trim();
  let sku = document.getElementById('form-item-sku').value.trim();
  const category = document.getElementById('form-item-category').value;
  const godown = document.getElementById('form-item-godown').value;
  const unit = document.getElementById('form-item-unit').value;
  const baseQty = safeNum(document.getElementById('form-item-qty').value, 0);
  const min = safeNum(document.getElementById('form-item-min').value, 5);
  const salePrice = safeNum(document.getElementById('form-item-sale-price').value, 0);
  const cost = safeNum(document.getElementById('form-item-cost').value, 0);
  const supplier = document.getElementById('form-item-supplier').value.trim();

  if (!sku) {
    sku = `J${String(stockItems.length + 1).padStart(3, '0')}`;
  }

  if (id) {
    const item = stockItems.find(i => i.id === id);
    if (item) {
      item.name = name;
      item.sku = sku;
      item.category = category;
      item.godown = godown;
      item.unit = unit;
      item.baseQty = baseQty;
      item.min = min;
      item.salePrice = salePrice;
      item.cost = cost;
      item.supplier = supplier;
      addLog(name, godown, 'Edit Item Details', `${baseQty} ${unit}`, 'Item parameters updated');
      showToast(`Updated item "${name}"`, 'success');
    }
  } else {
    const newItem = {
      id: 'stk_' + Date.now(),
      sku,
      name,
      category,
      godown,
      unit,
      baseQty,
      qty: baseQty,
      min,
      cost,
      salePrice,
      supplier
    };
    stockItems.unshift(newItem);
    addLog(name, godown, 'Add New Item', `${baseQty} ${unit}`, 'Created new inventory SKU');
    showToast(`Created new item "${name}" (${sku})`, 'success');
  }

  recalculateBalances();
  saveState();
  closeItemModal();
  renderAll();
}

// ═════════════════════════════════════════════════════════════════════
// EXPORT ENGINE (Excel & PDF)
// ═════════════════════════════════════════════════════════════════════
function exportToExcel() {
  if (typeof XLSX === 'undefined') {
    return alert('Excel export engine (SheetJS) is loading. Please try again.');
  }

  const data = getFilteredItems().map((i, idx) => ({
    'Sl No': idx + 1,
    'SKU Code': i.sku,
    'Item Description': i.name,
    'Category': i.category,
    'Godown Location': i.godown,
    'Unit': i.unit,
    'Total Stock IN': i.totalIn || 0,
    'Total Stock OUT': i.totalOut || 0,
    'Actual Balance Qty': i.qty,
    'Min Reorder Level': i.min,
    'Purchase Cost (INR)': i.cost,
    'Sale Price (INR)': i.salePrice || 0,
    'Stock Valuation (INR)': Math.max(0, i.qty) * i.cost,
    'Stock Status': i.qty < 0 ? 'Negative Stock' : (i.qty <= i.min ? 'Low Stock / Alert' : 'In Stock'),
    'Supplier Contact': i.supplier || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Summary');
  XLSX.writeFile(workbook, `LIMRA_Stock_Summary_${new Date().toISOString().slice(0, 10)}.xlsx`);
  showToast('Exported Stock Directory to Excel (.xlsx)', 'success');
}

function exportToPDF() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    return alert('PDF export engine is loading. Please try again.');
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');
  const filtered = getFilteredItems();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('LIMRA Restaurant — Stock & Inventory Report', 14, 18);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated on: ${new Date().toLocaleString('en-IN')} | Total Items: ${filtered.length}`, 14, 25);

  const headers = [['SKU', 'Description', 'Category', 'Unit', 'IN', 'OUT', 'Balance', 'Cost', 'Value', 'Status']];
  const rows = filtered.map(i => [
    i.sku,
    i.name,
    i.category,
    i.unit,
    i.totalIn || 0,
    i.totalOut || 0,
    i.qty,
    `₹ ${safeMoney(i.cost)}`,
    `₹ ${safeMoney(Math.max(0, i.qty) * i.cost)}`,
    i.qty < 0 ? 'Negative' : (i.qty <= i.min ? 'Low' : 'In Stock')
  ]);

  if (doc.autoTable) {
    doc.autoTable({
      head: headers,
      body: rows,
      startY: 30,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [52, 211, 153] },
      styles: { fontSize: 7 }
    });
  }

  doc.save(`LIMRA_Stock_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  showToast('Exported Stock Report to PDF', 'success');
}

// ═════════════════════════════════════════════════════════════════════
// DOM EVENT LISTENERS & INITIALIZATION
// ═════════════════════════════════════════════════════════════════════
function setupEventListeners() {
  // Record IN & OUT Buttons
  document.getElementById('btn-record-in')?.addEventListener('click', () => openInOutModal('IN'));
  document.getElementById('btn-record-out')?.addEventListener('click', () => openInOutModal('OUT'));
  document.getElementById('modal-inout-close')?.addEventListener('click', closeInOutModal);
  document.getElementById('inout-cancel-btn')?.addEventListener('click', closeInOutModal);
  document.getElementById('form-inout-entry')?.addEventListener('submit', handleInOutSubmit);

  // Add Item Button
  document.getElementById('btn-add-item')?.addEventListener('click', () => openItemModal());
  document.getElementById('modal-item-close')?.addEventListener('click', closeItemModal);
  document.getElementById('btn-cancel-item')?.addEventListener('click', closeItemModal);
  document.getElementById('form-stock-item')?.addEventListener('submit', handleItemSubmit);

  // Adjust Stock Form
  document.getElementById('modal-adjust-stock-close')?.addEventListener('click', closeAdjustModal);
  document.getElementById('btn-cancel-adjust-workflow')?.addEventListener('click', closeAdjustModal);
  document.getElementById('form-adjust-stock-workflow')?.addEventListener('submit', handleAdjustSubmit);

  // Adjust Stock Toggle Buttons (Add vs Reduce)
  document.getElementById('toggle-type-add')?.addEventListener('click', () => {
    document.getElementById('adjust-mode').value = 'add';
    document.getElementById('toggle-type-add').className = 'erp-toggle-btn btn-add active';
    document.getElementById('toggle-type-reduce').className = 'erp-toggle-btn btn-reduce';
  });

  document.getElementById('toggle-type-reduce')?.addEventListener('click', () => {
    document.getElementById('adjust-mode').value = 'reduce';
    document.getElementById('toggle-type-reduce').className = 'erp-toggle-btn btn-reduce active';
    document.getElementById('toggle-type-add').className = 'erp-toggle-btn btn-add';
  });

  // Details Modal
  document.getElementById('modal-details-close')?.addEventListener('click', closeItemDetailsModal);
  document.getElementById('btn-details-back')?.addEventListener('click', closeItemDetailsModal);

  // Exports
  document.getElementById('btn-header-excel')?.addEventListener('click', exportToExcel);
  document.getElementById('btn-header-pdf')?.addEventListener('click', exportToPDF);
  document.getElementById('btn-details-excel')?.addEventListener('click', exportToExcel);

  // Search Toggle
  const searchOverlay = document.getElementById('search-overlay-bar');
  const searchInput = document.getElementById('stock-search');

  document.getElementById('btn-toggle-search')?.addEventListener('click', () => {
    searchOverlay?.classList.toggle('hidden');
    if (!searchOverlay?.classList.contains('hidden')) {
      searchInput?.focus();
    }
  });

  document.getElementById('btn-close-search')?.addEventListener('click', () => {
    searchOverlay?.classList.add('hidden');
    searchQuery = '';
    if (searchInput) searchInput.value = '';
    renderAll();
  });

  searchInput?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderAll();
  });

  // Filter Select Chips
  document.getElementById('chip-cat-select')?.addEventListener('change', (e) => {
    activeCategory = e.target.value;
    document.getElementById('active-filter-badge').textContent = activeCategory === 'all' ? 'All Categories' : activeCategory;
    renderAll();
  });

  document.getElementById('chip-stock-select')?.addEventListener('change', (e) => {
    activeStockLevel = e.target.value;
    renderAll();
  });

  document.getElementById('chip-status-select')?.addEventListener('change', (e) => {
    activeStatus = e.target.value;
    renderAll();
  });

  // Drawer Multi-Filters
  const modalFilters = document.getElementById('modal-filters');
  document.getElementById('btn-open-funnel')?.addEventListener('click', () => modalFilters?.classList.remove('hidden'));
  document.getElementById('modal-filters-close')?.addEventListener('click', () => modalFilters?.classList.add('hidden'));
  
  document.getElementById('btn-drawer-apply')?.addEventListener('click', () => {
    activeCategory = document.getElementById('drawer-cat-select').value;
    activeStockLevel = document.getElementById('drawer-stock-select').value;
    selectedGodown = document.getElementById('drawer-godown-select').value;

    document.getElementById('chip-cat-select').value = activeCategory;
    document.getElementById('chip-stock-select').value = activeStockLevel;
    document.getElementById('active-filter-badge').textContent = activeCategory === 'all' ? 'All Categories' : activeCategory;

    modalFilters?.classList.add('hidden');
    renderAll();
  });

  document.getElementById('btn-drawer-reset')?.addEventListener('click', () => {
    activeCategory = 'all';
    activeStockLevel = 'all';
    selectedGodown = 'all';
    document.getElementById('drawer-cat-select').value = 'all';
    document.getElementById('drawer-stock-select').value = 'all';
    document.getElementById('drawer-godown-select').value = 'all';
    document.getElementById('chip-cat-select').value = 'all';
    document.getElementById('chip-stock-select').value = 'all';
    document.getElementById('active-filter-badge').textContent = 'All Categories';
    modalFilters?.classList.add('hidden');
    renderAll();
  });

  // View Switcher (Cards vs Table)
  const btnFeed = document.getElementById('btn-toggle-view-feed');
  const btnTable = document.getElementById('btn-toggle-view-table');
  const feedWrap = document.getElementById('stock-feed-container');
  const tableWrap = document.getElementById('stock-table-container');

  btnFeed?.addEventListener('click', () => {
    viewMode = 'feed';
    btnFeed.className = 'px-2.5 py-1 bg-slate-800 text-emerald-400 border border-slate-700 rounded-lg text-xs font-bold transition-all';
    btnTable.className = 'px-2.5 py-1 bg-slate-900 text-slate-400 hover:text-white border border-slate-800 rounded-lg text-xs font-semibold transition-all';
    feedWrap?.classList.remove('hidden');
    tableWrap?.classList.add('hidden');
  });

  btnTable?.addEventListener('click', () => {
    viewMode = 'table';
    btnTable.className = 'px-2.5 py-1 bg-slate-800 text-emerald-400 border border-slate-700 rounded-lg text-xs font-bold transition-all';
    btnFeed.className = 'px-2.5 py-1 bg-slate-900 text-slate-400 hover:text-white border border-slate-800 rounded-lg text-xs font-semibold transition-all';
    tableWrap?.classList.remove('hidden');
    feedWrap?.classList.add('hidden');
  });

  // More Options Menu
  const btnMore = document.getElementById('btn-more-options');
  const menuMore = document.getElementById('dropdown-more-menu');

  btnMore?.addEventListener('click', (e) => {
    e.stopPropagation();
    menuMore?.classList.toggle('hidden');
  });

  document.addEventListener('click', () => menuMore?.classList.add('hidden'));

  document.getElementById('menu-toggle-view')?.addEventListener('click', () => {
    if (viewMode === 'feed') btnTable?.click();
    else btnFeed?.click();
  });

  document.getElementById('menu-reset-defaults')?.addEventListener('click', () => {
    if (confirm('Reset inventory and clear all entries back to default state?')) {
      localStorage.removeItem(STORAGE_KEY_ITEMS);
      localStorage.removeItem(STORAGE_KEY_IN);
      localStorage.removeItem(STORAGE_KEY_OUT);
      localStorage.removeItem(STORAGE_KEY_LOGS);
      loadState();
      renderAll();
      showToast('Inventory reset to initial defaults', 'info');
    }
  });

  document.getElementById('menu-print-page')?.addEventListener('click', () => window.print());

  // Log filter & Clear
  document.getElementById('log-filter-type')?.addEventListener('change', (e) => {
    activeLogFilter = e.target.value;
    renderLogs();
  });

  document.getElementById('btn-clear-logs')?.addEventListener('click', () => {
    if (confirm('Clear audit logs history?')) {
      stockLogs = [];
      saveState();
      renderLogs();
      showToast('Audit log cleared', 'info');
    }
  });

  // Empty state button
  document.getElementById('btn-empty-clear-filters')?.addEventListener('click', () => {
    searchQuery = '';
    activeCategory = 'all';
    activeStockLevel = 'all';
    activeStatus = 'all';
    selectedGodown = 'all';
    if (searchInput) searchInput.value = '';
    document.getElementById('chip-cat-select').value = 'all';
    document.getElementById('chip-stock-select').value = 'all';
    document.getElementById('chip-status-select').value = 'all';
    renderAll();
  });

  // Repair boundary
  document.getElementById('btn-repair-inventory')?.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY_ITEMS);
    loadState();
    renderAll();
    document.getElementById('stock-error-boundary')?.classList.add('hidden');
    showToast('Inventory storage repaired & refreshed', 'success');
  });
}

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  try {
    loadState();
    setupEventListeners();
    renderAll();
  } catch (err) {
    console.error('Stock Manager Initialization Error:', err);
    document.getElementById('stock-error-boundary')?.classList.remove('hidden');
  }
});
