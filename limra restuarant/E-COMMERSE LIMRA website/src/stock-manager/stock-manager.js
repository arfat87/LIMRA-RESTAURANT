import '../style.css';
import './stock-manager.css';

// Helper for safe number conversion (prevents NaN / undefined crashes)
function safeNum(val, fallback = 0) {
  if (val === null || val === undefined) return fallback;
  const num = parseFloat(val);
  return isNaN(num) ? fallback : num;
}

// Helper for safe currency formatting (formatted with 2 decimal places e.g., 0.00)
function safeMoney(val) {
  const num = safeNum(val, 0);
  return num.toFixed(2);
}

// Strictly 7 Stock Categories for LIMRA Restaurant Raw Materials & Supplies:
// 1. bhusimal (Bhusimal & Spices)
// 2. dairy items (Dairy Items)
// 3. cold drink (Cold Drinks)
// 4. veg (Fresh Vegetables)
// 5. ice creame (Ice Cream)
// 6. carry bag (Packaging & Carry Bags)
// 7. washins (Cleaning & Washings)
const INITIAL_STOCK_ITEMS = [
  // 1. Bhusimal & Spices
  { id: 'stk-101', name: 'Basmati Biryani Rice (Special Grade)', category: 'Bhusimal & Spices', godown: 'Main Godown', stockQty: 100, qty: 100, unit: 'kg', minStockThreshold: 30, min: 30, salePrice: 150.00, purchasePrice: 110.00, cost: 110.00, supplier: 'Royal Rice Traders (9876543212)', transactions: [] },
  { id: 'stk-102', name: 'Staff Rice / স্টাফ রাইস', category: 'Bhusimal & Spices', godown: 'Main Godown', stockQty: 50, qty: 50, unit: 'kg', minStockThreshold: 20, min: 20, salePrice: 85.00, purchasePrice: 65.00, cost: 65.00, supplier: 'Bengal Grain Wholesalers', transactions: [] },
  { id: 'stk-103', name: 'Palm Oil / পাম অয়েল', category: 'Bhusimal & Spices', godown: 'Main Godown', stockQty: 30, qty: 30, unit: 'L', minStockThreshold: 10, min: 10, salePrice: 150.00, purchasePrice: 120.00, cost: 120.00, supplier: 'Fortune Oils', transactions: [] },
  { id: 'stk-104', name: 'Refined Soyabean Oil', category: 'Bhusimal & Spices', godown: 'Main Godown', stockQty: 40, qty: 40, unit: 'L', minStockThreshold: 15, min: 15, salePrice: 175.00, purchasePrice: 145.00, cost: 145.00, supplier: 'Fortune Oils', transactions: [] },
  { id: 'stk-105', name: 'Mustard Oil / মাস্টার অয়েল', category: 'Bhusimal & Spices', godown: 'Main Godown', stockQty: 25, qty: 25, unit: 'L', minStockThreshold: 10, min: 10, salePrice: 195.00, purchasePrice: 160.00, cost: 160.00, supplier: 'Engine Brand Oils', transactions: [] },
  { id: 'stk-106', name: 'Maida / মাইদা', category: 'Bhusimal & Spices', godown: 'Main Godown', stockQty: 40, qty: 40, unit: 'kg', minStockThreshold: 15, min: 15, salePrice: 50.00, purchasePrice: 38.00, cost: 38.00, supplier: 'Ganesh Flour Mills', transactions: [] },
  { id: 'stk-107', name: 'Atta / আটা', category: 'Bhusimal & Spices', godown: 'Main Godown', stockQty: 60, qty: 60, unit: 'kg', minStockThreshold: 20, min: 20, salePrice: 55.00, purchasePrice: 42.00, cost: 42.00, supplier: 'Aashirvaad Atta Supplier', transactions: [] },
  { id: 'stk-108', name: 'Chowmein / চাউমিন (Noodles)', category: 'Bhusimal & Spices', godown: 'Kitchen Store', stockQty: 30, qty: 30, unit: 'packet', minStockThreshold: 10, min: 10, salePrice: 50.00, purchasePrice: 35.00, cost: 35.00, supplier: 'Metro Food Distributors', transactions: [] },
  { id: 'stk-109', name: 'Tomato Ketchup / টমেটো সস', category: 'Bhusimal & Spices', godown: 'Kitchen Store', stockQty: 15, qty: 15, unit: 'L', minStockThreshold: 5, min: 5, salePrice: 130.00, purchasePrice: 95.00, cost: 95.00, supplier: 'Kissan Distributors', transactions: [] },
  { id: 'stk-110', name: 'Chilli Sauce / চিলি সস', category: 'Bhusimal & Spices', godown: 'Kitchen Store', stockQty: 12, qty: 12, unit: 'Btl', minStockThreshold: 4, min: 4, salePrice: 110.00, purchasePrice: 85.00, cost: 85.00, supplier: 'Ching\'s Secret Supplies', transactions: [] },
  { id: 'stk-111', name: 'Soy Sauce / সয়া সস', category: 'Bhusimal & Spices', godown: 'Kitchen Store', stockQty: 10, qty: 10, unit: 'Btl', minStockThreshold: 3, min: 3, salePrice: 120.00, purchasePrice: 90.00, cost: 90.00, supplier: 'Ching\'s Secret Supplies', transactions: [] },
  { id: 'stk-112', name: 'Vinegar / ভিনেগার', category: 'Bhusimal & Spices', godown: 'Kitchen Store', stockQty: 8, qty: 8, unit: 'Btl', minStockThreshold: 3, min: 3, salePrice: 85.00, purchasePrice: 60.00, cost: 60.00, supplier: 'Metro Food Distributors', transactions: [] },
  { id: 'stk-113', name: 'Corn Flour / কর্ন ফ্লাওয়ার', category: 'Bhusimal & Spices', godown: 'Kitchen Store', stockQty: 10, qty: 10, unit: 'kg', minStockThreshold: 4, min: 4, salePrice: 95.00, purchasePrice: 70.00, cost: 70.00, supplier: 'Weikfield Distributors', transactions: [] },
  { id: 'stk-114', name: 'Kasuri Methi / কস্তুরী মেথী', category: 'Bhusimal & Spices', godown: 'Kitchen Store', stockQty: 15, qty: 15, unit: 'packet', minStockThreshold: 5, min: 5, salePrice: 65.00, purchasePrice: 45.00, cost: 45.00, supplier: 'MDH Spices', transactions: [] },
  { id: 'stk-115', name: 'Chaat Masala / চাট মশলা', category: 'Bhusimal & Spices', godown: 'Kitchen Store', stockQty: 10, qty: 10, unit: 'packet', minStockThreshold: 3, min: 3, salePrice: 85.00, purchasePrice: 65.00, cost: 65.00, supplier: 'Everest Spices', transactions: [] },
  { id: 'stk-116', name: 'Kashmiri Red Chilli Powder', category: 'Bhusimal & Spices', godown: 'Kitchen Store', stockQty: 5, qty: 5, unit: 'kg', minStockThreshold: 2, min: 2, salePrice: 480.00, purchasePrice: 380.00, cost: 380.00, supplier: 'Everest Spices', transactions: [] },
  { id: 'stk-117', name: 'Ajinomoto / টেস্ট লবন', category: 'Bhusimal & Spices', godown: 'Kitchen Store', stockQty: 4, qty: 4, unit: 'kg', minStockThreshold: 2, min: 2, salePrice: 180.00, purchasePrice: 140.00, cost: 140.00, supplier: 'Metro Food Distributors', transactions: [] },
  { id: 'stk-118', name: 'Chilli Powder / লঙ্কা গুঁড়ো', category: 'Bhusimal & Spices', godown: 'Kitchen Store', stockQty: 8, qty: 8, unit: 'kg', minStockThreshold: 3, min: 3, salePrice: 320.00, purchasePrice: 260.00, cost: 260.00, supplier: 'Everest Spices', transactions: [] },
  { id: 'stk-119', name: 'Turmeric Powder (Haldi) / হলুদ', category: 'Bhusimal & Spices', godown: 'Kitchen Store', stockQty: 10, qty: 10, unit: 'kg', minStockThreshold: 3, min: 3, salePrice: 280.00, purchasePrice: 220.00, cost: 220.00, supplier: 'Everest Spices', transactions: [] },
  { id: 'stk-120', name: 'Cumin (Jeera) / জিরা', category: 'Bhusimal & Spices', godown: 'Kitchen Store', stockQty: 8, qty: 8, unit: 'kg', minStockThreshold: 3, min: 3, salePrice: 420.00, purchasePrice: 340.00, cost: 340.00, supplier: 'Spice Mart Kolkata', transactions: [] },
  { id: 'stk-129', name: 'Sugar / চিনি', category: 'Bhusimal & Spices', godown: 'Main Godown', stockQty: 50, qty: 50, unit: 'kg', minStockThreshold: 20, min: 20, salePrice: 55.00, purchasePrice: 44.00, cost: 44.00, supplier: 'Metro Sugar Depot', transactions: [] },
  { id: 'stk-132', name: 'Cashew Nuts (Kaju) / কাজু', category: 'Bhusimal & Spices', godown: 'Main Godown', stockQty: 6, qty: 6, unit: 'kg', minStockThreshold: 2, min: 2, salePrice: 950.00, purchasePrice: 750.00, cost: 750.00, supplier: 'Dry Fruit Traders', transactions: [] },
  { id: 'stk-142', name: 'Pure Desi Ghee / ঘি', category: 'Bhusimal & Spices', godown: 'Kitchen Store', stockQty: 5, qty: 5, unit: 'L', minStockThreshold: 3, min: 3, salePrice: 850.00, purchasePrice: 680.00, cost: 680.00, supplier: 'Amul Dairy Distributor', transactions: [] },
  { id: 'stk-152', name: 'Eggs / ডিম', category: 'Bhusimal & Spices', godown: 'Kitchen Store', stockQty: 150, qty: 150, unit: 'pcs', minStockThreshold: 50, min: 50, salePrice: 8.00, purchasePrice: 6.00, cost: 6.00, supplier: 'Bengal Poultry Farm', transactions: [] },

  // 2. Dairy Items
  { id: 'stk-201', name: 'Fresh Milk / দুধ', category: 'Dairy Items', godown: 'Kitchen Store', stockQty: 20, qty: 20, unit: 'L', minStockThreshold: 10, min: 10, salePrice: 75.00, purchasePrice: 66.00, cost: 66.00, supplier: 'Mother Dairy', transactions: [] },
  { id: 'stk-202', name: 'Dahi (Curd) / দই', category: 'Dairy Items', godown: 'Kitchen Store', stockQty: 15, qty: 15, unit: 'kg', minStockThreshold: 5, min: 5, salePrice: 100.00, purchasePrice: 80.00, cost: 80.00, supplier: 'Amul Dairy Distributor', transactions: [] },
  { id: 'stk-203', name: 'Amul Paneer / পনির', category: 'Dairy Items', godown: 'Kitchen Store', stockQty: 12, qty: 12, unit: 'kg', minStockThreshold: 4, min: 4, salePrice: 440.00, purchasePrice: 360.00, cost: 360.00, supplier: 'Amul Dairy Distributor', transactions: [] },
  { id: 'stk-204', name: 'Amul Butter / মাখন', category: 'Dairy Items', godown: 'Kitchen Store', stockQty: 8, qty: 8, unit: 'kg', minStockThreshold: 3, min: 3, salePrice: 620.00, purchasePrice: 540.00, cost: 540.00, supplier: 'Amul Dairy Distributor', transactions: [] },
  { id: 'stk-205', name: 'Amul Cream / ক্রিম', category: 'Dairy Items', godown: 'Kitchen Store', stockQty: 10, qty: 10, unit: 'pack', minStockThreshold: 3, min: 3, salePrice: 220.00, purchasePrice: 180.00, cost: 180.00, supplier: 'Amul Dairy Distributor', transactions: [] },
  { id: 'stk-206', name: 'Cheese / চিজ', category: 'Dairy Items', godown: 'Kitchen Store', stockQty: 6, qty: 6, unit: 'kg', minStockThreshold: 2, min: 2, salePrice: 520.00, purchasePrice: 420.00, cost: 420.00, supplier: 'Amul Dairy Distributor', transactions: [] },

  // 3. Cold Drinks
  { id: 'stk-301', name: 'Campa White (250ml)', category: 'Cold Drinks', godown: 'Storage 1', stockQty: 48, qty: 48, unit: 'pcs', minStockThreshold: 24, min: 24, salePrice: 20.00, purchasePrice: 18.00, cost: 18.00, supplier: 'Reliance Beverages', transactions: [] },
  { id: 'stk-302', name: 'Campa Black (500ml)', category: 'Cold Drinks', godown: 'Storage 1', stockQty: 36, qty: 36, unit: 'pcs', minStockThreshold: 12, min: 12, salePrice: 30.00, purchasePrice: 24.00, cost: 24.00, supplier: 'Reliance Beverages', transactions: [] },
  { id: 'stk-303', name: 'Kinley Water (1L)', category: 'Cold Drinks', godown: 'Storage 1', stockQty: 60, qty: 60, unit: 'Btl', minStockThreshold: 24, min: 24, salePrice: 20.00, purchasePrice: 14.00, cost: 14.00, supplier: 'Coca Cola Distributor (9876543218)', transactions: [] },
  { id: 'stk-304', name: 'Bisleri Water (1L)', category: 'Cold Drinks', godown: 'Storage 1', stockQty: 48, qty: 48, unit: 'Btl', minStockThreshold: 24, min: 24, salePrice: 20.00, purchasePrice: 14.00, cost: 14.00, supplier: 'Bisleri Agency Kolkata', transactions: [] },
  { id: 'stk-312', name: 'Thums Up (500ml)', category: 'Cold Drinks', godown: 'Storage 1', stockQty: 48, qty: 48, unit: 'pcs', minStockThreshold: 24, min: 24, salePrice: 45.00, purchasePrice: 38.00, cost: 38.00, supplier: 'Coca Cola Distributor', transactions: [] },
  { id: 'stk-313', name: 'Sprite (500ml)', category: 'Cold Drinks', godown: 'Storage 1', stockQty: 48, qty: 48, unit: 'pcs', minStockThreshold: 24, min: 24, salePrice: 45.00, purchasePrice: 38.00, cost: 38.00, supplier: 'Coca Cola Distributor', transactions: [] },
  { id: 'stk-314', name: 'Kinley Soda / সোডা', category: 'Cold Drinks', godown: 'Storage 1', stockQty: -4, qty: -4, unit: 'Btl', minStockThreshold: 12, min: 12, salePrice: 20.00, purchasePrice: 14.00, cost: 14.00, supplier: 'Coca Cola Distributor', transactions: [] },

  // 4. Fresh Vegetables
  { id: 'stk-401', name: 'Potato / আলু', category: 'Fresh Vegetables', godown: 'Main Godown', stockQty: 80, qty: 80, unit: 'kg', minStockThreshold: 30, min: 30, salePrice: 35.00, purchasePrice: 26.00, cost: 26.00, supplier: 'Kolkata Sabji Mandi', transactions: [] },
  { id: 'stk-402', name: 'Onion / পেঁয়াজ', category: 'Fresh Vegetables', godown: 'Main Godown', stockQty: 60, qty: 60, unit: 'kg', minStockThreshold: 25, min: 25, salePrice: 45.00, purchasePrice: 35.00, cost: 35.00, supplier: 'Kolkata Sabji Mandi', transactions: [] },
  { id: 'stk-403', name: 'Ginger / আদা', category: 'Fresh Vegetables', godown: 'Kitchen Store', stockQty: 10, qty: 10, unit: 'kg', minStockThreshold: 4, min: 4, salePrice: 210.00, purchasePrice: 160.00, cost: 160.00, supplier: 'Kolkata Sabji Mandi', transactions: [] },
  { id: 'stk-404', name: 'Garlic / রসুন', category: 'Fresh Vegetables', godown: 'Kitchen Store', stockQty: 12, qty: 12, unit: 'kg', minStockThreshold: 4, min: 4, salePrice: 270.00, purchasePrice: 210.00, cost: 210.00, supplier: 'Kolkata Sabji Mandi', transactions: [] },
  { id: 'stk-405', name: 'Capsicum / ক্যাপসিকাম', category: 'Fresh Vegetables', godown: 'Kitchen Store', stockQty: 8, qty: 8, unit: 'kg', minStockThreshold: 3, min: 3, salePrice: 120.00, purchasePrice: 90.00, cost: 90.00, supplier: 'Kolkata Sabji Mandi', transactions: [] },
  { id: 'stk-406', name: 'Carrot / গাজর', category: 'Fresh Vegetables', godown: 'Kitchen Store', stockQty: 10, qty: 10, unit: 'kg', minStockThreshold: 3, min: 3, salePrice: 60.00, purchasePrice: 40.00, cost: 40.00, supplier: 'Kolkata Sabji Mandi', transactions: [] },
  { id: 'stk-407', name: 'Green Beans / বিনস', category: 'Fresh Vegetables', godown: 'Kitchen Store', stockQty: 6, qty: 6, unit: 'kg', minStockThreshold: 2, min: 2, salePrice: 80.00, purchasePrice: 55.00, cost: 55.00, supplier: 'Kolkata Sabji Mandi', transactions: [] },
  { id: 'stk-408', name: 'Green Chilli / কাঁচা লঙ্কা', category: 'Fresh Vegetables', godown: 'Kitchen Store', stockQty: 5, qty: 5, unit: 'kg', minStockThreshold: 2, min: 2, salePrice: 110.00, purchasePrice: 80.00, cost: 80.00, supplier: 'Kolkata Sabji Mandi', transactions: [] },
  { id: 'stk-409', name: 'Fresh Tomato / টমেটো', category: 'Fresh Vegetables', godown: 'Kitchen Store', stockQty: 15, qty: 15, unit: 'kg', minStockThreshold: 5, min: 5, salePrice: 50.00, purchasePrice: 35.00, cost: 35.00, supplier: 'Kolkata Sabji Mandi', transactions: [] },

  // 5. Ice Cream
  { id: 'stk-501', name: '₹10 Rabdi Ice Cream', category: 'Ice Cream', godown: 'Storage 1', stockQty: 30, qty: 30, unit: 'pcs', minStockThreshold: 10, min: 10, salePrice: 10.00, purchasePrice: 7.00, cost: 7.00, supplier: 'Kwality Wall\'s / Amul', transactions: [] },
  { id: 'stk-502', name: '₹20 Ice Cream Cone', category: 'Ice Cream', godown: 'Storage 1', stockQty: 24, qty: 24, unit: 'pcs', minStockThreshold: 8, min: 8, salePrice: 20.00, purchasePrice: 14.00, cost: 14.00, supplier: 'Amul Ice Cream Agency', transactions: [] },
  { id: 'stk-514', name: '1L Gallon Vanilla Ice Cream', category: 'Ice Cream', godown: 'Storage 1', stockQty: 4, qty: 4, unit: 'box', minStockThreshold: 2, min: 2, salePrice: 250.00, purchasePrice: 190.00, cost: 190.00, supplier: 'Amul Ice Cream Agency', transactions: [] },

  // 6. Packaging & Carry Bags
  { id: 'stk-601', name: '1000ml Food Container', category: 'Packaging & Carry Bags', godown: 'Storage 1', stockQty: 250, qty: 250, unit: 'pcs', minStockThreshold: 100, min: 100, salePrice: 10.00, purchasePrice: 6.50, cost: 6.50, supplier: 'PackWell Solutions', transactions: [] },
  { id: 'stk-604', name: '500ml Food Container', category: 'Packaging & Carry Bags', godown: 'Storage 1', stockQty: 400, qty: 400, unit: 'pcs', minStockThreshold: 150, min: 150, salePrice: 7.00, purchasePrice: 4.20, cost: 4.20, supplier: 'PackWell Solutions', transactions: [] },
  { id: 'stk-608', name: '16x20 Carry Bag', category: 'Packaging & Carry Bags', godown: 'Storage 1', stockQty: 500, qty: 500, unit: 'pcs', minStockThreshold: 100, min: 100, salePrice: 3.50, purchasePrice: 2.10, cost: 2.10, supplier: 'PackWell Solutions', transactions: [] },

  // 7. Cleaning & Washings
  { id: 'stk-701', name: 'Vim Soap / ভিম সাবান', category: 'Cleaning & Washings', godown: 'Main Godown', stockQty: 30, qty: 30, unit: 'pcs', minStockThreshold: 10, min: 10, salePrice: 15.00, purchasePrice: 12.00, cost: 12.00, supplier: 'Hindustan Unilever Wholesale', transactions: [] },
  { id: 'stk-702', name: 'Vim Liquid Dishwash', category: 'Cleaning & Washings', godown: 'Main Godown', stockQty: 10, qty: 10, unit: 'Btl', minStockThreshold: 4, min: 4, salePrice: 145.00, purchasePrice: 115.00, cost: 115.00, supplier: 'Hindustan Unilever Wholesale', transactions: [] },
  { id: 'stk-705', name: 'Harpic Toilet Cleaner', category: 'Cleaning & Washings', godown: 'Main Godown', stockQty: 8, qty: 8, unit: 'Btl', minStockThreshold: 3, min: 3, salePrice: 130.00, purchasePrice: 100.00, cost: 100.00, supplier: 'Reckitt Benckiser Distributor', transactions: [] }
];

class StockStore {
  constructor() {
    this.items = this.loadItems();
    this.logs = this.loadLogs();
    this.activeCategory = 'all';
    this.stockLevelFilter = 'all'; // 'all' | 'instock' | 'low' | 'negative'
    this.statusFilter = 'all'; // 'all' | 'active' | 'out'
    this.selectedGodown = 'all'; // 'all' | 'Main Godown' | 'Kitchen Store' | 'Storage 1'
    this.searchQuery = '';
    this.viewMode = 'feed'; // 'feed' | 'table'
    this.activeLogFilter = 'all';
    this.asOnDate = null;
  }

  sanitizeItem(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const qty = safeNum(raw.stockQty !== undefined ? raw.stockQty : raw.qty, 0);
    const cost = safeNum(raw.purchasePrice !== undefined ? raw.purchasePrice : raw.cost, 0);
    const salePrice = safeNum(raw.salePrice !== undefined ? raw.salePrice : (cost * 1.3), 0);
    const min = safeNum(raw.minStockThreshold !== undefined ? raw.minStockThreshold : raw.min, 5);

    // Map any legacy categories to the 7 stock categories
    let cat = String(raw.category || 'Bhusimal & Spices').trim();
    if (['KABABS', 'BIRYANI', 'TANDOORI', 'TEA/COFFEE'].includes(cat)) {
      cat = 'Bhusimal & Spices';
    }

    return {
      id: String(raw.id || ('stk-' + Date.now() + Math.floor(Math.random() * 1000))),
      name: String(raw.name || 'Unnamed Item').trim(),
      category: cat,
      godown: String(raw.godown || 'Main Godown').trim(),
      stockQty: qty,
      qty: qty,
      unit: String(raw.unit || 'pcs').trim(),
      minStockThreshold: min,
      min: min,
      salePrice: salePrice,
      purchasePrice: cost,
      cost: cost,
      supplier: String(raw.supplier || '').trim(),
      transactions: Array.isArray(raw.transactions) ? raw.transactions : []
    };
  }

  loadItems() {
    try {
      const stored = localStorage.getItem('limra-stock-items-v6');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sanitized = parsed.map(i => this.sanitizeItem(i)).filter(Boolean);
          if (sanitized.length > 0) return sanitized;
        }
      }
    } catch (e) {
      console.warn('Failed to load stock items:', e);
    }
    return INITIAL_STOCK_ITEMS.map(i => this.sanitizeItem(i));
  }

  saveItems() {
    try {
      localStorage.setItem('limra-stock-items-v6', JSON.stringify(this.items));
    } catch (e) {
      console.warn('Failed to save stock items:', e);
    }
  }

  loadLogs() {
    try {
      const stored = localStorage.getItem('limra-stock-logs-v6');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load logs:', e);
    }
    return [
      {
        date: new Date().toLocaleDateString('en-GB'),
        timestamp: new Date().toISOString(),
        itemName: 'Basmati Biryani Rice',
        location: 'Main Godown',
        type: 'Purchase',
        qtyChange: '+50 kg',
        amount: 5500,
        notes: 'Bulk grain delivery'
      },
      {
        date: new Date().toLocaleDateString('en-GB'),
        timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
        itemName: 'Kinley Water (1L)',
        location: 'Storage 1',
        type: 'Sale',
        qtyChange: '-28 Btl',
        amount: 560,
        notes: 'Peak weekend sales'
      }
    ];
  }

  saveLogs() {
    try {
      localStorage.setItem('limra-stock-logs-v6', JSON.stringify(this.logs));
    } catch (e) {
      console.warn('Failed to save logs:', e);
    }
  }

  resetDemoData() {
    this.items = INITIAL_STOCK_ITEMS.map(i => this.sanitizeItem(i));
    this.saveItems();
    this.addLog('System', 'Main Godown', 'Reset Seed Data', 'All Default', 0, 'Reset stock database to master 7 stock categories');
  }

  addLog(itemName, location, type, qtyChange, amount = 0, notes = '') {
    const newLog = {
      id: 'log-' + Date.now(),
      date: new Date().toLocaleDateString('en-GB'),
      timestamp: new Date().toISOString(),
      itemName: String(itemName || 'System'),
      location: String(location || 'Main Godown'),
      type: String(type || 'Action'),
      qtyChange: String(qtyChange || '0'),
      amount: safeNum(amount, 0),
      notes: String(notes || '')
    };
    this.logs.unshift(newLog);
    if (this.logs.length > 200) this.logs.pop();
    this.saveLogs();
  }

  addItem(itemData) {
    const newItem = this.sanitizeItem({
      id: 'stk-' + Date.now(),
      name: itemData.name,
      category: itemData.category,
      godown: itemData.godown || 'Main Godown',
      stockQty: itemData.qty,
      unit: itemData.unit,
      minStockThreshold: itemData.min,
      salePrice: itemData.salePrice,
      purchasePrice: itemData.cost,
      supplier: itemData.supplier,
      transactions: [{
        date: new Date().toLocaleDateString('en-GB'),
        godown: itemData.godown || 'Main Godown',
        type: 'Add Stock',
        qty: safeNum(itemData.qty, 0),
        unit: itemData.unit,
        price: safeNum(itemData.cost, 0),
        amount: safeNum(itemData.qty, 0) * safeNum(itemData.cost, 0),
        notes: 'Registered new stock item'
      }]
    });

    this.items.push(newItem);
    this.saveItems();
    this.addLog(newItem.name, newItem.godown, 'Add Stock', `+${newItem.qty} ${newItem.unit}`, newItem.qty * newItem.cost, 'Registered new inventory item');
    showToast(`Added "${newItem.name}" to inventory`, 'success');
    return newItem;
  }

  updateItem(id, itemData) {
    const index = this.items.findIndex(i => i.id === id);
    if (index === -1) return false;
    const old = this.items[index];
    this.items[index] = this.sanitizeItem({
      ...old,
      name: itemData.name,
      category: itemData.category,
      godown: itemData.godown || old.godown,
      stockQty: itemData.qty,
      unit: itemData.unit,
      minStockThreshold: itemData.min,
      salePrice: itemData.salePrice,
      purchasePrice: itemData.cost,
      supplier: itemData.supplier
    });
    this.saveItems();
    this.addLog(this.items[index].name, this.items[index].godown, 'Manual Adjustment', `Set ${this.items[index].qty} ${this.items[index].unit}`, this.items[index].qty * this.items[index].cost, 'Updated item attributes');
    showToast(`Updated "${this.items[index].name}"`, 'info');
    return true;
  }

  deleteItem(id) {
    const item = this.items.find(i => i.id === id);
    if (!item) return false;
    this.items = this.items.filter(i => i.id !== id);
    this.saveItems();
    this.addLog(item.name, item.godown, 'Waste/Loss', `0 ${item.unit}`, 0, 'Item removed from inventory');
    showToast(`Deleted "${item.name}"`, 'warning');
    return true;
  }

  executeAdjustWorkflow(id, mode, godown, qty, unit, unitPrice, date, notes) {
    const item = this.items.find(i => i.id === id);
    if (!item) return false;

    const numQty = safeNum(qty, 0);
    const numPrice = safeNum(unitPrice, item.cost);
    const dateFormatted = date ? new Date(date).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');

    let typeLabel = 'Purchase';
    let qtyText = '';

    if (mode === 'add') {
      item.qty = safeNum((item.qty + numQty).toFixed(2));
      item.stockQty = item.qty;
      typeLabel = 'Purchase';
      qtyText = `+${numQty} ${unit}`;
    } else {
      item.qty = safeNum((item.qty - numQty).toFixed(2));
      item.stockQty = item.qty;
      typeLabel = notes.toLowerCase().includes('spoilage') || notes.toLowerCase().includes('waste') ? 'Waste/Loss' : 'Sale';
      qtyText = `-${numQty} ${unit}`;
    }

    const totalAmt = numQty * numPrice;

    item.transactions.unshift({
      date: dateFormatted,
      godown: godown || item.godown,
      type: typeLabel,
      qty: numQty,
      unit: unit || item.unit,
      price: numPrice,
      amount: totalAmt,
      notes: notes || 'Workflow adjustment'
    });

    this.saveItems();
    this.addLog(item.name, godown || item.godown, typeLabel, qtyText, totalAmt, notes || 'Adjust Stock Workflow');
    showToast(`Saved stock adjustment for "${item.name}": ${qtyText}`, 'success');
    return true;
  }

  getFilteredItems() {
    return this.items.filter(item => {
      if (!item) return false;

      // Category match
      const catMatch = this.activeCategory === 'all' || item.category === this.activeCategory;

      // Godown match
      const godownMatch = this.selectedGodown === 'all' || item.godown === this.selectedGodown;

      // Stock Level Filter (All, In Stock, Low Stock, Negative Stock)
      const isNegative = item.qty < 0;
      const isLow = !isNegative && item.qty <= item.min;
      const isInStock = item.qty > 0;

      let levelMatch = true;
      if (this.stockLevelFilter === 'instock') levelMatch = isInStock;
      if (this.stockLevelFilter === 'low') levelMatch = (isLow || isNegative);
      if (this.stockLevelFilter === 'negative') levelMatch = isNegative;

      // Status Filter (All, Active, Out of Stock)
      let statusMatch = true;
      if (this.statusFilter === 'active') statusMatch = item.qty > 0;
      if (this.statusFilter === 'out') statusMatch = item.qty === 0;

      // Search match
      const query = (this.searchQuery || '').toLowerCase().trim();
      const searchMatch = !query || 
        (item.name && item.name.toLowerCase().includes(query)) || 
        (item.category && item.category.toLowerCase().includes(query)) ||
        (item.supplier && item.supplier.toLowerCase().includes(query));

      return catMatch && godownMatch && levelMatch && statusMatch && searchMatch;
    });
  }

  getFilteredLogs() {
    if (this.activeLogFilter === 'all') return this.logs;
    return this.logs.filter(l => l.type && l.type.toLowerCase().includes(this.activeLogFilter.toLowerCase()));
  }

  getMetrics() {
    const totalItems = this.items.length;
    let lowCount = 0;
    let totalValue = 0;

    this.items.forEach(item => {
      if (!item) return;
      if (item.qty <= item.min || item.qty < 0) {
        lowCount++;
      }
      const validQty = Math.max(0, safeNum(item.qty, 0));
      totalValue += (validQty * safeNum(item.cost, 0));
    });

    return { totalItems, lowCount, totalValue };
  }

  exportToExcel() {
    const filtered = this.getFilteredItems();
    if (filtered.length === 0) return alert('No items to export.');

    if (typeof XLSX === 'undefined') {
      return alert('Excel export engine (SheetJS) is loading. Please try again.');
    }

    const data = filtered.map((i, idx) => ({
      'Sl No': idx + 1,
      'Item Name': i.name,
      'Category': i.category,
      'Godown': i.godown,
      'In Stock Qty': i.qty,
      'Unit': i.unit,
      'Min Reorder Level': i.min,
      'Sale Price (INR)': i.salePrice || 0,
      'Purchase Price (INR)': i.cost,
      'Stock Valuation (INR)': Math.max(0, i.qty) * i.cost,
      'Stock Status': i.qty < 0 ? 'Negative Stock' : (i.qty <= i.min ? 'Low Stock' : 'In Stock'),
      'Supplier Contact': i.supplier || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Summary');
    XLSX.writeFile(workbook, `LIMRA_Stock_Summary_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('Exported Stock Directory to Excel (.xlsx)', 'success');
  }

  exportToPDF() {
    const filtered = this.getFilteredItems();
    if (filtered.length === 0) return alert('No items to export.');

    if (!window.jspdf || !window.jspdf.jsPDF) {
      return alert('PDF export engine is loading. Please try again.');
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('LIMRA Restaurant — Stock & Inventory Report', 14, 18);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated on: ${new Date().toLocaleString('en-IN')} | Total Items: ${filtered.length}`, 14, 25);

    const headers = [['#', 'Item Name', 'Category', 'Godown', 'Qty', 'Unit Cost', 'Stock Value', 'Status']];
    const rows = filtered.map((i, idx) => [
      idx + 1,
      i.name,
      i.category,
      i.godown,
      `${i.qty} ${i.unit}`,
      `₹ ${safeMoney(i.cost)}`,
      `₹ ${safeMoney(Math.max(0, i.qty) * i.cost)}`,
      i.qty < 0 ? 'Negative' : (i.qty <= i.min ? 'Low Stock' : 'In Stock')
    ]);

    if (doc.autoTable) {
      doc.autoTable({
        head: headers,
        body: rows,
        startY: 30,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: [52, 211, 153] },
        styles: { fontSize: 8 }
      });
    }

    doc.save(`LIMRA_Stock_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    showToast('Exported Stock Report to PDF', 'success');
  }
}

// Instantiate Global Store
const store = new StockStore();

// Toast Notifications Function
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bgColors = {
    success: 'bg-emerald-950/90 text-emerald-200 border-emerald-700/80',
    info: 'bg-slate-900/90 text-slate-100 border-slate-700/80',
    warning: 'bg-amber-950/90 text-amber-200 border-amber-700/80',
    error: 'bg-rose-950/90 text-rose-200 border-rose-700/80'
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

// UI Render Helpers
function renderKPIs() {
  const { totalItems, lowCount, totalValue } = store.getMetrics();

  document.getElementById('kpi-total-items').textContent = totalItems;
  document.getElementById('kpi-low-items').textContent = lowCount;
  document.getElementById('kpi-total-value').textContent = '₹ ' + safeMoney(totalValue);
}

// Render Mobile-First Card Feed (`#stock-feed-container`)
function renderCardFeed() {
  const feedContainer = document.getElementById('stock-feed-container');
  const emptyState = document.getElementById('stock-empty-state');
  const badge = document.getElementById('stock-count-badge');
  const filtered = store.getFilteredItems();

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
    const itemValue = (Math.max(0, item.qty) * item.cost);

    let qtyColorClass = 'text-slate-200 font-semibold';
    if (item.qty > 0) qtyColorClass = 'text-stock-positive';
    if (isNegative) qtyColorClass = 'text-stock-negative';

    return `
      <div data-action="view-details" data-id="${item.id}" class="stock-item-feed-card ${isNegative ? 'is-negative' : ''}">
        <!-- Top Row: Item Name (Left) + Category Pill Badge (Right) -->
        <div class="flex items-start justify-between gap-2 border-b border-slate-800/60 pb-2.5">
          <div>
            <h3 class="text-sm font-extrabold text-white group-hover:text-emerald-400 transition-colors">${item.name}</h3>
            ${item.supplier ? `<p class="text-[10px] text-slate-400 mt-0.5 truncate max-w-[180px]">Supplier: ${item.supplier}</p>` : ''}
          </div>
          <span class="stock-pill-btn text-[10px] uppercase font-bold shrink-0 bg-slate-950 border-slate-800 text-slate-300">
            ${item.category}
          </span>
        </div>

        <!-- Bottom Row: Stock Value: ₹ 0.00 • Stock Qty: X.X -->
        <div class="flex items-center justify-between pt-2.5 text-xs">
          <div class="flex items-center gap-1.5">
            <span class="text-slate-400 font-medium">Stock Value:</span>
            <span class="font-extrabold text-teal-300">₹ ${safeMoney(itemValue)}</span>
          </div>

          <div class="flex items-center gap-1.5">
            <span class="text-slate-400">•</span>
            <span class="text-slate-400 font-medium">Stock Qty:</span>
            <span class="${qtyColorClass}">${item.qty} ${item.unit}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Render Alternative Table View (`#stock-table-body`)
function renderTable() {
  const tbody = document.getElementById('stock-table-body');
  if (!tbody) return;

  const filtered = store.getFilteredItems();

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
          <div class="text-sm font-bold group-hover:text-emerald-400 transition-colors">${item.name}</div>
          <p class="text-[10px] text-slate-400 mt-0.5">${item.supplier || 'No supplier'}</p>
        </td>
        <td class="text-slate-300 text-xs">
          <span class="bg-slate-950 border border-slate-800 px-2 py-0.5 rounded-lg text-[10px] font-bold text-slate-300">${item.category}</span>
        </td>
        <td class="text-slate-400 text-xs">${item.godown || 'Main Godown'}</td>
        <td class="text-center font-bold ${isNegative ? 'text-rose-400' : 'text-emerald-400'}">
          ${item.qty} ${item.unit}
        </td>
        <td class="text-right text-slate-300">₹ ${safeMoney(item.salePrice)}</td>
        <td class="text-right text-slate-400">₹ ${safeMoney(item.cost)}</td>
        <td class="text-right font-bold text-teal-300">₹ ${safeMoney(itemValue)}</td>
        <td class="text-center">${statusBadge}</td>
        <td class="text-right space-x-1 stock-no-print" onclick="event.stopPropagation()">
          <button data-action="adjust-workflow" data-id="${item.id}" class="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-xs text-teal-300 font-bold rounded-lg border border-slate-700">⚡ Adjust</button>
          <button data-action="edit" data-id="${item.id}" class="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 rounded-lg border border-slate-700">✏️</button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderLogs() {
  const tbody = document.getElementById('stock-logs-body');
  if (!tbody) return;

  const logs = store.getFilteredLogs();

  if (logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-slate-500 font-medium">No stock transaction logs matching current filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = logs.slice(0, 30).map(log => {
    const timeStr = log.date || new Date(log.timestamp).toLocaleDateString('en-GB');

    let badgeClass = 'bg-slate-950 text-slate-300 border-slate-800';
    if (log.type && (log.type.includes('Purchase') || log.type.includes('Add'))) {
      badgeClass = 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80';
    } else if (log.type && (log.type.includes('Waste') || log.type.includes('Loss'))) {
      badgeClass = 'bg-rose-950/80 text-rose-300 border-rose-800/80';
    } else if (log.type && log.type.includes('Sale')) {
      badgeClass = 'bg-amber-950/80 text-amber-300 border-amber-800/80';
    }

    return `
      <tr class="hover:bg-slate-800/20 transition-colors">
        <td class="py-2.5 px-4 text-slate-500 whitespace-nowrap font-mono text-[11px]">${timeStr}</td>
        <td class="py-2.5 px-4 font-bold text-white">${log.itemName || 'Item'}</td>
        <td class="py-2.5 px-4 text-slate-400 text-xs">${log.location || 'Main Godown'}</td>
        <td class="py-2.5 px-4">
          <span class="px-2 py-0.5 rounded-md text-[10px] font-semibold border ${badgeClass}">
            ${log.type || 'Action'}
          </span>
        </td>
        <td class="py-2.5 px-4 text-center font-mono font-extrabold ${(log.qtyChange || '').startsWith('+') ? 'text-emerald-400' : 'text-amber-300'}">
          ${log.qtyChange || '0'}
        </td>
        <td class="py-2.5 px-4 text-right font-mono font-bold text-teal-300">
          ₹ ${safeMoney(log.amount)}
        </td>
        <td class="py-2.5 px-4 text-slate-400 text-xs">${log.notes || '-'}</td>
      </tr>
    `;
  }).join('');
}

function updateFilterBadge() {
  const badge = document.getElementById('active-filter-badge');
  if (!badge) return;

  const parts = [];
  if (store.activeCategory !== 'all') parts.push(store.activeCategory);
  if (store.stockLevelFilter !== 'all') parts.push(store.stockLevelFilter);
  if (store.statusFilter !== 'all') parts.push(store.statusFilter);
  if (store.selectedGodown !== 'all') parts.push(store.selectedGodown);
  if (store.searchQuery) parts.push(`"${store.searchQuery}"`);

  badge.textContent = parts.length > 0 ? parts.join(' • ') : 'All Categories';
}

function updateUI() {
  try {
    renderKPIs();
    renderCardFeed();
    renderTable();
    renderLogs();
    updateFilterBadge();
    document.getElementById('stock-error-boundary')?.classList.add('hidden');
  } catch (err) {
    console.error('Stock Summary UI render error:', err);
    document.getElementById('stock-error-boundary')?.classList.remove('hidden');
  }
}

// ── Detailed Item View Modal Logic ──────────────────────────────
let activeDetailItemId = null;

function openItemDetails(id) {
  const item = store.items.find(i => i.id === id);
  if (!item) return;

  activeDetailItemId = id;
  const modal = document.getElementById('modal-item-details');

  document.getElementById('detail-item-name').textContent = item.name;
  document.getElementById('detail-item-supplier').textContent = item.supplier ? `Supplier: ${item.supplier}` : 'No supplier attached';
  document.getElementById('detail-item-category-badge').textContent = item.category;

  const phoneMatch = (item.supplier || '').match(/(?:\+?91)?[6-9]\d{9}/);
  const linkEl = document.getElementById('detail-supplier-link');
  if (phoneMatch && linkEl) {
    linkEl.href = `https://wa.me/91${phoneMatch[0].slice(-10)}?text=Hi,%20we%20need%20to%20restock%20${encodeURIComponent(item.name)}`;
    document.getElementById('detail-supplier-banner')?.classList.remove('hidden');
  } else {
    if (linkEl) linkEl.href = `https://www.indiamart.com/search.mp?ss=${encodeURIComponent(item.name)}`;
  }

  document.getElementById('detail-sale-price').textContent = '₹ ' + safeMoney(item.salePrice || item.cost * 1.3);
  document.getElementById('detail-purchase-price').textContent = '₹ ' + safeMoney(item.cost);
  
  const inStockEl = document.getElementById('detail-in-stock');
  inStockEl.textContent = `${item.qty} ${item.unit}`;
  if (item.qty <= 0) {
    inStockEl.className = 'text-sm font-extrabold text-rose-400 mt-1 block';
  } else {
    inStockEl.className = 'text-sm font-extrabold text-emerald-400 mt-1 block';
  }

  document.getElementById('detail-stock-value').textContent = '₹ ' + safeMoney(Math.max(0, item.qty) * item.cost);

  renderItemLedger(item);
  modal.classList.remove('hidden');
}

function renderItemLedger(item) {
  const tbody = document.getElementById('detail-ledger-body');
  const countBadge = document.getElementById('detail-tx-count');
  const txs = item.transactions || [];

  if (countBadge) countBadge.textContent = `${txs.length} records`;

  if (txs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-slate-500 font-medium">No ledger transactions recorded yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = txs.map(tx => `
    <tr class="hover:bg-slate-800/40 transition-colors">
      <td class="py-2 px-3 font-semibold text-white">
        <div>${tx.type}</div>
        <span class="text-[10px] text-slate-500 font-mono">${tx.date}</span>
      </td>
      <td class="py-2 px-3 text-slate-400 text-xs">${tx.godown || item.godown}</td>
      <td class="py-2 px-3 text-center font-mono font-bold ${tx.type === 'Sale' || tx.type === 'Waste/Loss' ? 'text-amber-300' : 'text-emerald-400'}">
        ${tx.type === 'Sale' || tx.type === 'Waste/Loss' ? '-' : '+'}${tx.qty} ${tx.unit || item.unit}
      </td>
      <td class="py-2 px-3 text-right font-mono font-bold text-teal-300">
        ₹ ${safeMoney(tx.amount || tx.qty * tx.price)}
      </td>
    </tr>
  `).join('');
}

function closeItemDetails() {
  document.getElementById('modal-item-details')?.classList.add('hidden');
}

// ── Adjust Stock Workflow Logic ─────────────────────────────────
function openAdjustWorkflow(selectedId = null) {
  const id = selectedId || activeDetailItemId || (store.items[0] ? store.items[0].id : null);
  if (!id) return alert('No stock item selected.');

  const item = store.items.find(i => i.id === id);
  if (!item) return;

  const modal = document.getElementById('modal-adjust-stock');
  document.getElementById('adjust-target-id').value = item.id;
  document.getElementById('adjust-item-display').value = item.name;
  document.getElementById('adjust-godown-select').value = item.godown || 'Main Godown';
  document.getElementById('adjust-workflow-unit').value = item.unit || 'pcs';
  document.getElementById('adjust-workflow-price').value = item.cost || 0;
  document.getElementById('adjust-workflow-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('adjust-workflow-qty').value = '';
  document.getElementById('adjust-workflow-notes').value = '';

  setAdjustMode('add');
  modal.classList.remove('hidden');
}

function setAdjustMode(mode) {
  const inputMode = document.getElementById('adjust-mode');
  const btnAdd = document.getElementById('toggle-type-add');
  const btnReduce = document.getElementById('toggle-type-reduce');

  inputMode.value = mode;
  if (mode === 'add') {
    btnAdd.className = 'erp-toggle-btn btn-add active';
    btnReduce.className = 'erp-toggle-btn btn-reduce';
  } else {
    btnAdd.className = 'erp-toggle-btn btn-add';
    btnReduce.className = 'erp-toggle-btn btn-reduce active';
  }
}

function closeAdjustWorkflow() {
  document.getElementById('modal-adjust-stock')?.classList.add('hidden');
}

// Modal Handlers (Add/Edit Item)
function openItemModal(item = null) {
  const modal = document.getElementById('modal-item');
  const title = document.getElementById('modal-item-title');
  const form = document.getElementById('form-stock-item');

  form.reset();

  if (item) {
    title.innerHTML = '<span>✏️</span> Edit Item Details';
    document.getElementById('form-item-id').value = item.id;
    document.getElementById('form-item-name').value = item.name;
    document.getElementById('form-item-category').value = item.category;
    document.getElementById('form-item-godown').value = item.godown || 'Main Godown';
    document.getElementById('form-item-unit').value = item.unit;
    document.getElementById('form-item-qty').value = item.qty;
    document.getElementById('form-item-sale-price').value = item.salePrice || (item.cost * 1.3);
    document.getElementById('form-item-cost').value = item.cost;
    document.getElementById('form-item-min').value = item.min;
    document.getElementById('form-item-supplier').value = item.supplier || '';
  } else {
    title.innerHTML = '<span>📦</span> Add New Item';
    document.getElementById('form-item-id').value = '';
  }

  modal.classList.remove('hidden');
}

function closeItemModal() {
  document.getElementById('modal-item')?.classList.add('hidden');
}

// Switch View Modes (Feed vs Table)
function setViewMode(mode) {
  store.viewMode = mode;
  const feed = document.getElementById('stock-feed-container');
  const table = document.getElementById('stock-table-container');
  const btnFeed = document.getElementById('btn-toggle-view-feed');
  const btnTable = document.getElementById('btn-toggle-view-table');

  if (mode === 'feed') {
    feed?.classList.remove('hidden');
    table?.classList.add('hidden');
    if (btnFeed) btnFeed.className = 'px-2.5 py-1 bg-slate-800 text-emerald-400 border border-slate-700 rounded-lg text-xs font-bold transition-all';
    if (btnTable) btnTable.className = 'px-2.5 py-1 bg-slate-900 text-slate-400 hover:text-white border border-slate-800 rounded-lg text-xs font-semibold transition-all';
  } else {
    feed?.classList.add('hidden');
    table?.classList.remove('hidden');
    if (btnFeed) btnFeed.className = 'px-2.5 py-1 bg-slate-900 text-slate-400 hover:text-white border border-slate-800 rounded-lg text-xs font-semibold transition-all';
    if (btnTable) btnTable.className = 'px-2.5 py-1 bg-slate-800 text-emerald-400 border border-slate-700 rounded-lg text-xs font-bold transition-all';
  }
}

// Event Listeners Initialization
document.addEventListener('DOMContentLoaded', () => {
  updateUI();

  // Repair Inventory Button
  document.getElementById('btn-repair-inventory')?.addEventListener('click', () => {
    store.resetDemoData();
    updateUI();
    showToast('Inventory database repaired and 7 stock categories restored', 'success');
  });

  // Header Exports
  document.getElementById('btn-header-pdf')?.addEventListener('click', () => store.exportToPDF());
  document.getElementById('btn-header-excel')?.addEventListener('click', () => store.exportToExcel());

  // Search Overlay Toggle (🔍 Icon)
  const searchBar = document.getElementById('search-overlay-bar');
  const searchInput = document.getElementById('stock-search');

  document.getElementById('btn-toggle-search')?.addEventListener('click', () => {
    searchBar?.classList.toggle('hidden');
    if (!searchBar?.classList.contains('hidden')) {
      searchInput?.focus();
    }
  });

  document.getElementById('btn-close-search')?.addEventListener('click', () => {
    searchBar?.classList.add('hidden');
    if (searchInput) searchInput.value = '';
    store.searchQuery = '';
    updateUI();
  });

  searchInput?.addEventListener('input', (e) => {
    store.searchQuery = e.target.value;
    updateUI();
  });

  // More Options Menu (⋮)
  const moreBtn = document.getElementById('btn-more-options');
  const moreMenu = document.getElementById('dropdown-more-menu');

  moreBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    moreMenu?.classList.toggle('hidden');
  });

  document.addEventListener('click', () => {
    moreMenu?.classList.add('hidden');
  });

  document.getElementById('menu-toggle-view')?.addEventListener('click', () => {
    setViewMode(store.viewMode === 'feed' ? 'table' : 'feed');
  });

  document.getElementById('menu-reset-defaults')?.addEventListener('click', () => {
    if (confirm('Reset stock directory back to master 7 stock categories?')) {
      store.resetDemoData();
      updateUI();
    }
  });

  document.getElementById('menu-print-page')?.addEventListener('click', () => window.print());

  // Date Filter Checkbox
  const chkAsOn = document.getElementById('chk-as-on-date');
  const dateAsOn = document.getElementById('date-as-on');
  chkAsOn?.addEventListener('change', (e) => {
    dateAsOn.disabled = !e.target.checked;
    if (e.target.checked) {
      if (!dateAsOn.value) dateAsOn.value = new Date().toISOString().slice(0, 10);
      store.asOnDate = dateAsOn.value;
    } else {
      store.asOnDate = null;
    }
    updateUI();
  });
  dateAsOn?.addEventListener('change', (e) => {
    store.asOnDate = e.target.value;
    updateUI();
  });

  // Filter Dropdown Chips (Category, Stock Level, Status)
  document.getElementById('chip-cat-select')?.addEventListener('change', (e) => {
    store.activeCategory = e.target.value;
    updateUI();
  });

  document.getElementById('chip-stock-select')?.addEventListener('change', (e) => {
    store.stockLevelFilter = e.target.value;
    updateUI();
  });

  document.getElementById('chip-status-select')?.addEventListener('change', (e) => {
    store.statusFilter = e.target.value;
    updateUI();
  });

  // Multi-Filter Funnel Drawer (`#modal-filters`)
  const funnelModal = document.getElementById('modal-filters');
  document.getElementById('btn-open-funnel')?.addEventListener('click', () => {
    document.getElementById('drawer-cat-select').value = store.activeCategory;
    document.getElementById('drawer-stock-select').value = store.stockLevelFilter;
    document.getElementById('drawer-godown-select').value = store.selectedGodown;
    funnelModal?.classList.remove('hidden');
  });

  document.getElementById('modal-filters-close')?.addEventListener('click', () => funnelModal?.classList.add('hidden'));

  document.getElementById('btn-drawer-apply')?.addEventListener('click', () => {
    store.activeCategory = document.getElementById('drawer-cat-select').value;
    store.stockLevelFilter = document.getElementById('drawer-stock-select').value;
    store.selectedGodown = document.getElementById('drawer-godown-select').value;

    document.getElementById('chip-cat-select').value = store.activeCategory;
    document.getElementById('chip-stock-select').value = store.stockLevelFilter;

    funnelModal?.classList.add('hidden');
    updateUI();
  });

  document.getElementById('btn-drawer-reset')?.addEventListener('click', () => {
    store.activeCategory = 'all';
    store.stockLevelFilter = 'all';
    store.statusFilter = 'all';
    store.selectedGodown = 'all';

    document.getElementById('chip-cat-select').value = 'all';
    document.getElementById('chip-stock-select').value = 'all';
    document.getElementById('chip-status-select').value = 'all';

    funnelModal?.classList.add('hidden');
    updateUI();
  });

  // View Switcher Buttons
  document.getElementById('btn-toggle-view-feed')?.addEventListener('click', () => setViewMode('feed'));
  document.getElementById('btn-toggle-view-table')?.addEventListener('click', () => setViewMode('table'));

  // Add Item Buttons
  document.getElementById('btn-add-item')?.addEventListener('click', () => openItemModal());
  document.getElementById('modal-item-close')?.addEventListener('click', closeItemModal);
  document.getElementById('btn-cancel-item')?.addEventListener('click', closeItemModal);

  // Form Submit Add/Edit Item
  document.getElementById('form-stock-item')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('form-item-id').value;
    const itemData = {
      name: document.getElementById('form-item-name').value,
      category: document.getElementById('form-item-category').value,
      godown: document.getElementById('form-item-godown').value,
      unit: document.getElementById('form-item-unit').value,
      qty: document.getElementById('form-item-qty').value,
      min: document.getElementById('form-item-min').value,
      salePrice: document.getElementById('form-item-sale-price').value,
      cost: document.getElementById('form-item-cost').value,
      supplier: document.getElementById('form-item-supplier').value,
    };

    if (id) {
      store.updateItem(id, itemData);
    } else {
      store.addItem(itemData);
    }
    closeItemModal();
    updateUI();
  });

  // Card Feed Click Delegation
  document.getElementById('stock-feed-container')?.addEventListener('click', (e) => {
    const card = e.target.closest('[data-action="view-details"]');
    if (card) {
      openItemDetails(card.dataset.id);
    }
  });

  // Table Row Click Delegation
  document.getElementById('stock-table-body')?.addEventListener('click', (e) => {
    const row = e.target.closest('tr');
    if (!row) return;

    const btn = e.target.closest('button');
    const action = btn ? btn.dataset.action : row.dataset.action;
    const id = btn ? btn.dataset.id : row.dataset.id;

    if (action === 'adjust-workflow') {
      openAdjustWorkflow(id);
    } else if (action === 'edit') {
      const item = store.items.find(i => i.id === id);
      if (item) openItemModal(item);
    } else if (action === 'view-details') {
      openItemDetails(id);
    }
  });

  // Item Details Modal Event Handlers
  document.getElementById('btn-details-back')?.addEventListener('click', closeItemDetails);
  document.getElementById('modal-details-close')?.addEventListener('click', closeItemDetails);
  document.getElementById('btn-details-edit')?.addEventListener('click', () => {
    if (activeDetailItemId) {
      const item = store.items.find(i => i.id === activeDetailItemId);
      closeItemDetails();
      if (item) openItemModal(item);
    }
  });
  document.getElementById('btn-details-excel')?.addEventListener('click', () => store.exportToExcel());
  document.getElementById('btn-details-adjust-stock')?.addEventListener('click', () => {
    closeItemDetails();
    openAdjustWorkflow(activeDetailItemId);
  });

  // Adjust Stock Workflow Drawer Handlers
  document.getElementById('toggle-type-add')?.addEventListener('click', () => setAdjustMode('add'));
  document.getElementById('toggle-type-reduce')?.addEventListener('click', () => setAdjustMode('reduce'));
  document.getElementById('modal-adjust-stock-close')?.addEventListener('click', closeAdjustWorkflow);
  document.getElementById('btn-cancel-adjust-workflow')?.addEventListener('click', closeAdjustWorkflow);

  document.getElementById('form-adjust-stock-workflow')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('adjust-target-id').value;
    const mode = document.getElementById('adjust-mode').value;
    const godown = document.getElementById('adjust-godown-select').value;
    const qty = document.getElementById('adjust-workflow-qty').value;
    const unit = document.getElementById('adjust-workflow-unit').value;
    const price = document.getElementById('adjust-workflow-price').value;
    const date = document.getElementById('adjust-workflow-date').value;
    const notes = document.getElementById('adjust-workflow-notes').value;

    store.executeAdjustWorkflow(id, mode, godown, qty, unit, price, date, notes);
    closeAdjustWorkflow();
    updateUI();
  });

  // Clear Logs
  document.getElementById('btn-clear-logs')?.addEventListener('click', () => {
    if (confirm('Clear all recorded stock transaction logs?')) {
      store.logs = [];
      store.saveLogs();
      renderLogs();
      showToast('Stock logs cleared', 'info');
    }
  });

  // Clear Empty State Filters
  document.getElementById('btn-empty-clear-filters')?.addEventListener('click', () => {
    store.searchQuery = '';
    store.activeCategory = 'all';
    store.stockLevelFilter = 'all';
    store.statusFilter = 'all';
    store.selectedGodown = 'all';

    document.getElementById('chip-cat-select').value = 'all';
    document.getElementById('chip-stock-select').value = 'all';
    document.getElementById('chip-status-select').value = 'all';
    updateUI();
  });

  // Language Switcher Initialization
  initLanguageSwitcher();

  // Esc key shortcut to close overlays
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchBar?.classList.add('hidden');
      funnelModal?.classList.add('hidden');
      closeItemModal();
      closeItemDetails();
      closeAdjustWorkflow();
    }
  });
});

// ═══════════════════════════════════════
// GLOBAL LANGUAGE SWITCHER SYSTEM (EN / BN / HI)
// ═══════════════════════════════════════
function initLanguageSwitcher() {
  const select = document.getElementById('global-lang-select');
  if (!select) return;

  const savedLang = localStorage.getItem('limra-lang') || 'en';
  select.value = savedLang;

  if (!document.getElementById('google-translate-script')) {
    const div = document.createElement('div');
    div.id = 'google_translate_element';
    div.style.display = 'none';
    document.body.appendChild(div);

    window.googleTranslateElementInit = function() {
      new window.google.translate.TranslateElement({
        pageLanguage: 'en',
        includedLanguages: 'en,bn,hi',
        layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
        autoDisplay: false
      }, 'google_translate_element');
    };

    const s = document.createElement('script');
    s.id = 'google-translate-script';
    s.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    document.body.appendChild(s);
  }

  select.addEventListener('change', (e) => {
    const lang = e.target.value;
    localStorage.setItem('limra-lang', lang);

    const targetCode = lang === 'en' ? '/en/en' : `/en/${lang}`;
    document.cookie = `googtrans=${targetCode}; path=/; domain=${window.location.hostname}`;
    document.cookie = `googtrans=${targetCode}; path=/`;

    const frame = document.querySelector('.goog-te-combo');
    if (frame) {
      frame.value = lang;
      frame.dispatchEvent(new Event('change'));
    } else {
      window.location.reload();
    }
  });
}

