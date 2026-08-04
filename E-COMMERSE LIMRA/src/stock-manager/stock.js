import '../style.css';
import '../admin.css';
import { insforge } from '../lib/insforge.js';

const STORAGE_KEY_ITEMS = 'limra_stock_inventory_items';
const STORAGE_KEY_LOGS = 'limra_stock_inventory_logs';
const STORAGE_KEY_IN_ENTRIES = 'limra_stock_in_entries';
const STORAGE_KEY_OUT_ENTRIES = 'limra_stock_out_entries';

// Default Master Stock Database (132 Items across 7 Categories)
const DEFAULT_ITEMS = [
  // 1. Bhusimal & Spices (bhusimal)
  { id: 'stk_1', sku: 'J001', name: 'Rice (রাইস)', category: 'Bhusimal & Spices', unit: 'kg', qty: 0, minQty: 25, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_2', sku: 'J002', name: 'Palm Oil (পাম অয়েল)', category: 'Bhusimal & Spices', unit: 'L', qty: 0, minQty: 15, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_3', sku: 'J003', name: 'Refined Oil (রেফাইন্ড অয়েল)', category: 'Bhusimal & Spices', unit: 'L', qty: 0, minQty: 15, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_4', sku: 'J004', name: 'Mustard Oil (মাস্টার অয়েল)', category: 'Bhusimal & Spices', unit: 'L', qty: 0, minQty: 15, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_5', sku: 'J005', name: 'Maida (মাইদা)', category: 'Bhusimal & Spices', unit: 'kg', qty: 0, minQty: 20, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_6', sku: 'J006', name: 'Atta (আটা)', category: 'Bhusimal & Spices', unit: 'kg', qty: 0, minQty: 20, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_7', sku: 'J007', name: 'Chowmein Noodle (চাউমিন)', category: 'Bhusimal & Spices', unit: 'packet', qty: 0, minQty: 10, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_8', sku: 'J008', name: 'Tomato Sauce (টমেটো sos)', category: 'Bhusimal & Spices', unit: 'kg', qty: 0, minQty: 5, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_9', sku: 'J009', name: 'Chili Sauce', category: 'Bhusimal & Spices', unit: 'bottle', qty: 0, minQty: 5, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_10', sku: 'J010', name: 'Soy Sauce', category: 'Bhusimal & Spices', unit: 'bottle', qty: 0, minQty: 5, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_11', sku: 'J011', name: 'Vinegar', category: 'Bhusimal & Spices', unit: 'bottle', qty: 0, minQty: 5, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_12', sku: 'J012', name: 'Corn Flour', category: 'Bhusimal & Spices', unit: 'kg', qty: 0, minQty: 5, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_13', sku: 'J013', name: 'Kasuri Methi', category: 'Bhusimal & Spices', unit: 'packet', qty: 0, minQty: 5, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_14', sku: 'J014', name: 'Chat Masala', category: 'Bhusimal & Spices', unit: 'packet', qty: 0, minQty: 5, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_15', sku: 'J015', name: 'Kashmiri Chilli Powder', category: 'Bhusimal & Spices', unit: 'kg', qty: 0, minQty: 3, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_16', sku: 'J016', name: 'Ajinomoto (Ajina)', category: 'Bhusimal & Spices', unit: 'kg', qty: 0, minQty: 2, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_17', sku: 'J017', name: 'Chilli Powder', category: 'Bhusimal & Spices', unit: 'kg', qty: 0, minQty: 5, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_18', sku: 'J018', name: 'Haldi (Turmeric Powder)', category: 'Bhusimal & Spices', unit: 'kg', qty: 0, minQty: 5, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_19', sku: 'J019', name: 'Jeera (Cumin Seeds)', category: 'Bhusimal & Spices', unit: 'kg', qty: 0, minQty: 5, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_20', sku: 'J020', name: 'Dal (Pulses)', category: 'Bhusimal & Spices', unit: 'kg', qty: 0, minQty: 10, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_21', sku: 'J021', name: 'Kabuli Chana', category: 'Bhusimal & Spices', unit: 'kg', qty: 0, minQty: 10, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_22', sku: 'J022', name: 'Mix Dal', category: 'Bhusimal & Spices', unit: 'kg', qty: 0, minQty: 10, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_23', sku: 'J023', name: 'Attar / Essence', category: 'Bhusimal & Spices', unit: 'bottle', qty: 0, minQty: 2, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_24', sku: 'J024', name: 'Red Food Color', category: 'Bhusimal & Spices', unit: 'bottle', qty: 0, minQty: 2, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_25', sku: 'J025', name: 'Yellow Food Color', category: 'Bhusimal & Spices', unit: 'bottle', qty: 0, minQty: 2, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_26', sku: 'J026', name: 'Green Food Color', category: 'Bhusimal & Spices', unit: 'bottle', qty: 0, minQty: 2, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_27', sku: 'J027', name: 'Dry Chilli', category: 'Bhusimal & Spices', unit: 'kg', qty: 0, minQty: 5, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_28', sku: 'J028', name: 'Mouri (Fennel Seeds)', category: 'Bhusimal & Spices', unit: 'kg', qty: 0, minQty: 3, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_29', sku: 'J029', name: 'Sugar', category: 'Bhusimal & Spices', unit: 'kg', qty: 0, minQty: 20, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_30', sku: 'J030', name: 'Posto (Poppy Seeds)', category: 'Bhusimal & Spices', unit: 'g', qty: 0, minQty: 500, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_31', sku: 'J031', name: 'Dalda / Vanaspati', category: 'Bhusimal & Spices', unit: 'kg', qty: 0, minQty: 5, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_32', sku: 'J032', name: 'Kaju (Cashew Nuts)', category: 'Bhusimal & Spices', unit: 'kg', qty: 0, minQty: 2, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_33', sku: 'J033', name: 'Mogoz (Melon Seeds)', category: 'Bhusimal & Spices', unit: 'kg', qty: 0, minQty: 2, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_34', sku: 'J034', name: 'Elachi (Cardamom)', category: 'Bhusimal & Spices', unit: 'g', qty: 0, minQty: 250, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_35', sku: 'J035', name: 'Long (Cloves)', category: 'Bhusimal & Spices', unit: 'g', qty: 0, minQty: 250, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_36', sku: 'J036', name: 'Jaitri (Mace)', category: 'Bhusimal & Spices', unit: 'g', qty: 0, minQty: 250, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_37', sku: 'J037', name: 'Dalchini (Cinnamon)', category: 'Bhusimal & Spices', unit: 'g', qty: 0, minQty: 250, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_38', sku: 'J038', name: 'Starful (Star Anise)', category: 'Bhusimal & Spices', unit: 'g', qty: 0, minQty: 250, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_39', sku: 'J039', name: 'Rose Petals', category: 'Bhusimal & Spices', unit: 'g', qty: 0, minQty: 100, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_40', sku: 'J040', name: 'Shahi Jeera', category: 'Bhusimal & Spices', unit: 'g', qty: 0, minQty: 250, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_41', sku: 'J041', name: 'Black Pepper (Gol Morich)', category: 'Bhusimal & Spices', unit: 'g', qty: 0, minQty: 500, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_42', sku: 'J042', name: 'Pure Ghee', category: 'Bhusimal & Spices', unit: 'kg', qty: 0, minQty: 3, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_43', sku: 'J043', name: 'Baking Powder', category: 'Bhusimal & Spices', unit: 'packet', qty: 0, minQty: 5, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_44', sku: 'J044', name: 'Mushroom', category: 'Bhusimal & Spices', unit: 'packet', qty: 0, minQty: 5, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_45', sku: 'J045', name: 'Green Peas', category: 'Bhusimal & Spices', unit: 'kg', qty: 0, minQty: 5, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_46', sku: 'J046', name: 'Papad', category: 'Bhusimal & Spices', unit: 'packet', qty: 0, minQty: 10, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_47', sku: 'J047', name: 'Kissan Tomato Sauce Pouch', category: 'Bhusimal & Spices', unit: 'packet', qty: 0, minQty: 20, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_48', sku: 'J048', name: 'Jaljeera Powder', category: 'Bhusimal & Spices', unit: 'packet', qty: 0, minQty: 10, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_49', sku: 'J049', name: 'Black Salt (Bit Nun)', category: 'Bhusimal & Spices', unit: 'kg', qty: 0, minQty: 3, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_50', sku: 'J050', name: 'Regular Salt', category: 'Bhusimal & Spices', unit: 'kg', qty: 0, minQty: 15, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_51', sku: 'J051', name: 'Dhania (Coriander Seeds)', category: 'Bhusimal & Spices', unit: 'kg', qty: 0, minQty: 5, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },
  { id: 'stk_52', sku: 'J052', name: 'Egg (ডিম)', category: 'Bhusimal & Spices', unit: 'pcs', qty: 0, minQty: 100, costPrice: 0, supplier: 'Egra Poultry', isAvailable: true },
  { id: 'stk_53', sku: 'J053', name: 'Staff Rice', category: 'Bhusimal & Spices', unit: 'kg', qty: 0, minQty: 25, costPrice: 0, supplier: 'Egra Supplier', isAvailable: true },

  // 2. Dairy Items (dairy items)
  { id: 'stk_54', sku: 'J054', name: 'Milk (দুধ)', category: 'Dairy Items', unit: 'L', qty: 0, minQty: 10, costPrice: 0, supplier: 'Local Dairy Farm', isAvailable: true },
  { id: 'stk_55', sku: 'J055', name: 'Dahi (দই / Curd)', category: 'Dairy Items', unit: 'kg', qty: 0, minQty: 5, costPrice: 0, supplier: 'Local Dairy Farm', isAvailable: true },
  { id: 'stk_56', sku: 'J056', name: 'Paneer (পনির)', category: 'Dairy Items', unit: 'kg', qty: 0, minQty: 5, costPrice: 0, supplier: 'Amul Dairy Egra', isAvailable: true },
  { id: 'stk_57', sku: 'J057', name: 'Butter', category: 'Dairy Items', unit: 'kg', qty: 0, minQty: 3, costPrice: 0, supplier: 'Amul Dairy Egra', isAvailable: true },
  { id: 'stk_58', sku: 'J058', name: 'Amul Fresh Cream', category: 'Dairy Items', unit: 'pack', qty: 0, minQty: 5, costPrice: 0, supplier: 'Amul Dairy Egra', isAvailable: true },
  { id: 'stk_59', sku: 'J059', name: 'Cheese Block / Slice', category: 'Dairy Items', unit: 'pack', qty: 0, minQty: 5, costPrice: 0, supplier: 'Amul Dairy Egra', isAvailable: true },

  // 3. Cold Drinks (cold drink)
  { id: 'stk_60', sku: 'J060', name: 'Campa White 250ml', category: 'Cold Drinks', unit: 'pcs', qty: 0, minQty: 24, costPrice: 0, supplier: 'Campa Agency', isAvailable: true },
  { id: 'stk_61', sku: 'J061', name: 'Campa Black 500ml', category: 'Cold Drinks', unit: 'pcs', qty: 0, minQty: 24, costPrice: 0, supplier: 'Campa Agency', isAvailable: true },
  { id: 'stk_62', sku: 'J062', name: 'Campa White 500ml', category: 'Cold Drinks', unit: 'pcs', qty: 0, minQty: 24, costPrice: 0, supplier: 'Campa Agency', isAvailable: true },
  { id: 'stk_63', sku: 'J063', name: 'Kinley Water 1L', category: 'Cold Drinks', unit: 'pcs', qty: 0, minQty: 24, costPrice: 0, supplier: 'Coca-Cola Agency', isAvailable: true },
  { id: 'stk_64', sku: 'J064', name: 'Bisleri Water 1L', category: 'Cold Drinks', unit: 'pcs', qty: 0, minQty: 24, costPrice: 0, supplier: 'Bisleri Agency', isAvailable: true },
  { id: 'stk_65', sku: 'J065', name: 'Local Mineral Water 1L', category: 'Cold Drinks', unit: 'pcs', qty: 0, minQty: 24, costPrice: 0, supplier: 'Local Water Agency', isAvailable: true },
  { id: 'stk_66', sku: 'J066', name: 'Kinley Water 500ml', category: 'Cold Drinks', unit: 'pcs', qty: 0, minQty: 24, costPrice: 0, supplier: 'Coca-Cola Agency', isAvailable: true },
  { id: 'stk_67', sku: 'J067', name: 'Bisleri Water 500ml', category: 'Cold Drinks', unit: 'pcs', qty: 0, minQty: 24, costPrice: 0, supplier: 'Bisleri Agency', isAvailable: true },
  { id: 'stk_68', sku: 'J068', name: 'Local Mineral Water 500ml', category: 'Cold Drinks', unit: 'pcs', qty: 0, minQty: 24, costPrice: 0, supplier: 'Local Water Agency', isAvailable: true },
  { id: 'stk_69', sku: 'J069', name: 'Kinley Soda', category: 'Cold Drinks', unit: 'pcs', qty: 0, minQty: 24, costPrice: 0, supplier: 'Coca-Cola Agency', isAvailable: true },
  { id: 'stk_70', sku: 'J070', name: 'Bisleri Soda', category: 'Cold Drinks', unit: 'pcs', qty: 0, minQty: 24, costPrice: 0, supplier: 'Bisleri Agency', isAvailable: true },
  { id: 'stk_71', sku: 'J071', name: 'Thums Up 500ml', category: 'Cold Drinks', unit: 'pcs', qty: 0, minQty: 24, costPrice: 0, supplier: 'Coca-Cola Agency', isAvailable: true },
  { id: 'stk_72', sku: 'J072', name: 'Thums Up 750ml', category: 'Cold Drinks', unit: 'pcs', qty: 0, minQty: 24, costPrice: 0, supplier: 'Coca-Cola Agency', isAvailable: true },
  { id: 'stk_73', sku: 'J073', name: 'Sprite 500ml', category: 'Cold Drinks', unit: 'pcs', qty: 0, minQty: 24, costPrice: 0, supplier: 'Coca-Cola Agency', isAvailable: true },
  { id: 'stk_74', sku: 'J074', name: 'Sprite 1L', category: 'Cold Drinks', unit: 'pcs', qty: 0, minQty: 24, costPrice: 0, supplier: 'Coca-Cola Agency', isAvailable: true },

  // 4. Fresh Vegetables (veg)
  { id: 'stk_75', sku: 'J075', name: 'Potato (আলু)', category: 'Fresh Vegetables', unit: 'kg', qty: 0, minQty: 50, costPrice: 0, supplier: 'Egra Sabji Mandi', isAvailable: true },
  { id: 'stk_76', sku: 'J076', name: 'Onion (পেঁয়াজ)', category: 'Fresh Vegetables', unit: 'kg', qty: 0, minQty: 40, costPrice: 0, supplier: 'Egra Sabji Mandi', isAvailable: true },
  { id: 'stk_77', sku: 'J077', name: 'Ginger (আদা)', category: 'Fresh Vegetables', unit: 'kg', qty: 0, minQty: 5, costPrice: 0, supplier: 'Egra Sabji Mandi', isAvailable: true },
  { id: 'stk_78', sku: 'J078', name: 'Garlic (রসুন)', category: 'Fresh Vegetables', unit: 'kg', qty: 0, minQty: 5, costPrice: 0, supplier: 'Egra Sabji Mandi', isAvailable: true },
  { id: 'stk_79', sku: 'J079', name: 'Capsicum', category: 'Fresh Vegetables', unit: 'kg', qty: 0, minQty: 5, costPrice: 0, supplier: 'Egra Sabji Mandi', isAvailable: true },
  { id: 'stk_80', sku: 'J080', name: 'Carrot', category: 'Fresh Vegetables', unit: 'kg', qty: 0, minQty: 5, costPrice: 0, supplier: 'Egra Sabji Mandi', isAvailable: true },
  { id: 'stk_81', sku: 'J081', name: 'Beans', category: 'Fresh Vegetables', unit: 'kg', qty: 0, minQty: 5, costPrice: 0, supplier: 'Egra Sabji Mandi', isAvailable: true },
  { id: 'stk_82', sku: 'J082', name: 'Green Chilli (কাঁচা লঙ্কা)', category: 'Fresh Vegetables', unit: 'kg', qty: 0, minQty: 5, costPrice: 0, supplier: 'Egra Sabji Mandi', isAvailable: true },
  { id: 'stk_83', sku: 'J083', name: 'Tomato (টমেটো)', category: 'Fresh Vegetables', unit: 'kg', qty: 0, minQty: 10, costPrice: 0, supplier: 'Egra Sabji Mandi', isAvailable: true },
  { id: 'stk_84', sku: 'J084', name: 'Cabbage (বাঁধাকপি)', category: 'Fresh Vegetables', unit: 'kg', qty: 0, minQty: 10, costPrice: 0, supplier: 'Egra Sabji Mandi', isAvailable: true },
  { id: 'stk_85', sku: 'J085', name: 'Lemon (লেবু)', category: 'Fresh Vegetables', unit: 'pcs', qty: 0, minQty: 30, costPrice: 0, supplier: 'Egra Sabji Mandi', isAvailable: true },
  { id: 'stk_86', sku: 'J086', name: 'Dhania Pata (Coriander)', category: 'Fresh Vegetables', unit: 'kg', qty: 0, minQty: 2, costPrice: 0, supplier: 'Egra Sabji Mandi', isAvailable: true },
  { id: 'stk_87', sku: 'J087', name: 'Pudina Pata (Mint)', category: 'Fresh Vegetables', unit: 'kg', qty: 0, minQty: 1, costPrice: 0, supplier: 'Egra Sabji Mandi', isAvailable: true },
  { id: 'stk_88', sku: 'J088', name: 'Cucumber (শসা)', category: 'Fresh Vegetables', unit: 'kg', qty: 0, minQty: 10, costPrice: 0, supplier: 'Egra Sabji Mandi', isAvailable: true },

  // 5. Ice Cream (ice creame)
  { id: 'stk_89', sku: 'J089', name: 'Rs 10 Rabdi', category: 'Ice Cream', unit: 'pcs', qty: 0, minQty: 20, costPrice: 0, supplier: 'Quality Walls Egra', isAvailable: true },
  { id: 'stk_90', sku: 'J090', name: 'Rs 10 Cone', category: 'Ice Cream', unit: 'pcs', qty: 0, minQty: 20, costPrice: 0, supplier: 'Quality Walls Egra', isAvailable: true },
  { id: 'stk_91', sku: 'J091', name: 'Rs 10 Bati', category: 'Ice Cream', unit: 'pcs', qty: 0, minQty: 20, costPrice: 0, supplier: 'Quality Walls Egra', isAvailable: true },
  { id: 'stk_92', sku: 'J092', name: 'Rs 20 Bati', category: 'Ice Cream', unit: 'pcs', qty: 0, minQty: 20, costPrice: 0, supplier: 'Quality Walls Egra', isAvailable: true },
  { id: 'stk_93', sku: 'J093', name: 'Rs 20 Stick', category: 'Ice Cream', unit: 'pcs', qty: 0, minQty: 20, costPrice: 0, supplier: 'Quality Walls Egra', isAvailable: true },
  { id: 'stk_94', sku: 'J094', name: 'Rs 25 Cone', category: 'Ice Cream', unit: 'pcs', qty: 0, minQty: 20, costPrice: 0, supplier: 'Quality Walls Egra', isAvailable: true },
  { id: 'stk_95', sku: 'J095', name: 'Rs 30 Cone', category: 'Ice Cream', unit: 'pcs', qty: 0, minQty: 20, costPrice: 0, supplier: 'Quality Walls Egra', isAvailable: true },
  { id: 'stk_96', sku: 'J096', name: 'Rs 40 Cone', category: 'Ice Cream', unit: 'pcs', qty: 0, minQty: 20, costPrice: 0, supplier: 'Quality Walls Egra', isAvailable: true },
  { id: 'stk_97', sku: 'J097', name: 'Rs 50 Cone', category: 'Ice Cream', unit: 'pcs', qty: 0, minQty: 20, costPrice: 0, supplier: 'Quality Walls Egra', isAvailable: true },
  { id: 'stk_98', sku: 'J098', name: 'Rs 60 Cone', category: 'Ice Cream', unit: 'pcs', qty: 0, minQty: 15, costPrice: 0, supplier: 'Quality Walls Egra', isAvailable: true },
  { id: 'stk_99', sku: 'J099', name: 'Rs 80 Stick', category: 'Ice Cream', unit: 'pcs', qty: 0, minQty: 15, costPrice: 0, supplier: 'Quality Walls Egra', isAvailable: true },
  { id: 'stk_100', sku: 'J100', name: 'Rs 100 Cone', category: 'Ice Cream', unit: 'pcs', qty: 0, minQty: 10, costPrice: 0, supplier: 'Quality Walls Egra', isAvailable: true },
  { id: 'stk_101', sku: 'J101', name: 'Family Pack Ice Cream', category: 'Ice Cream', unit: 'pcs', qty: 0, minQty: 5, costPrice: 0, supplier: 'Quality Walls Egra', isAvailable: true },
  { id: 'stk_102', sku: 'J102', name: '1L Gallon Vanilla', category: 'Ice Cream', unit: 'pcs', qty: 0, minQty: 5, costPrice: 0, supplier: 'Quality Walls Egra', isAvailable: true },
  { id: 'stk_103', sku: 'J103', name: '1L Gallon Butter Scotch', category: 'Ice Cream', unit: 'pcs', qty: 0, minQty: 5, costPrice: 0, supplier: 'Quality Walls Egra', isAvailable: true },

  // 6. Packaging & Carry Bags (carry bag)
  { id: 'stk_104', sku: 'J104', name: '1000ml Container', category: 'Packaging & Carry Bags', unit: 'pcs', qty: 0, minQty: 100, costPrice: 0, supplier: 'Plastic Vendor Egra', isAvailable: true },
  { id: 'stk_105', sku: 'J105', name: '1000ml Silver Container', category: 'Packaging & Carry Bags', unit: 'pcs', qty: 0, minQty: 100, costPrice: 0, supplier: 'Plastic Vendor Egra', isAvailable: true },
  { id: 'stk_106', sku: 'J106', name: '750ml Container', category: 'Packaging & Carry Bags', unit: 'pcs', qty: 0, minQty: 100, costPrice: 0, supplier: 'Plastic Vendor Egra', isAvailable: true },
  { id: 'stk_107', sku: 'J107', name: '500ml Container', category: 'Packaging & Carry Bags', unit: 'pcs', qty: 0, minQty: 100, costPrice: 0, supplier: 'Plastic Vendor Egra', isAvailable: true },
  { id: 'stk_108', sku: 'J108', name: 'Tissue Paper', category: 'Packaging & Carry Bags', unit: 'packet', qty: 0, minQty: 20, costPrice: 0, supplier: 'Plastic Vendor Egra', isAvailable: true },
  { id: 'stk_109', sku: 'J109', name: 'Raita Pouch', category: 'Packaging & Carry Bags', unit: 'pcs', qty: 0, minQty: 200, costPrice: 0, supplier: 'Plastic Vendor Egra', isAvailable: true },
  { id: 'stk_110', sku: 'J110', name: 'Chatni Box', category: 'Packaging & Carry Bags', unit: 'pcs', qty: 0, minQty: 200, costPrice: 0, supplier: 'Plastic Vendor Egra', isAvailable: true },
  { id: 'stk_111', sku: 'J111', name: '16x20 Carry Bag', category: 'Packaging & Carry Bags', unit: 'pcs', qty: 0, minQty: 200, costPrice: 0, supplier: 'Plastic Vendor Egra', isAvailable: true },
  { id: 'stk_112', sku: 'J112', name: '13x16 Carry Bag', category: 'Packaging & Carry Bags', unit: 'pcs', qty: 0, minQty: 200, costPrice: 0, supplier: 'Plastic Vendor Egra', isAvailable: true },
  { id: 'stk_113', sku: 'J113', name: 'Rubber Band Small (Gardar)', category: 'Packaging & Carry Bags', unit: 'packet', qty: 0, minQty: 10, costPrice: 0, supplier: 'Plastic Vendor Egra', isAvailable: true },
  { id: 'stk_114', sku: 'J114', name: 'Rubber Band Big (Gardar)', category: 'Packaging & Carry Bags', unit: 'packet', qty: 0, minQty: 10, costPrice: 0, supplier: 'Plastic Vendor Egra', isAvailable: true },
  { id: 'stk_115', sku: 'J115', name: 'Cling Wrap (Clean Tape)', category: 'Packaging & Carry Bags', unit: 'roll', qty: 0, minQty: 3, costPrice: 0, supplier: 'Plastic Vendor Egra', isAvailable: true },
  { id: 'stk_116', sku: 'J116', name: '7x9 SP Pouch', category: 'Packaging & Carry Bags', unit: 'pcs', qty: 0, minQty: 200, costPrice: 0, supplier: 'Plastic Vendor Egra', isAvailable: true },
  { id: 'stk_117', sku: 'J117', name: '9x12 SP Pouch', category: 'Packaging & Carry Bags', unit: 'pcs', qty: 0, minQty: 200, costPrice: 0, supplier: 'Plastic Vendor Egra', isAvailable: true },
  { id: 'stk_118', sku: 'J118', name: '6x8 SP Pouch', category: 'Packaging & Carry Bags', unit: 'pcs', qty: 0, minQty: 200, costPrice: 0, supplier: 'Plastic Vendor Egra', isAvailable: true },
  { id: 'stk_119', sku: 'J119', name: 'Plastic Spoon', category: 'Packaging & Carry Bags', unit: 'pcs', qty: 0, minQty: 300, costPrice: 0, supplier: 'Plastic Vendor Egra', isAvailable: true },
  { id: 'stk_120', sku: 'J120', name: 'Foil Container', category: 'Packaging & Carry Bags', unit: 'pcs', qty: 0, minQty: 100, costPrice: 0, supplier: 'Plastic Vendor Egra', isAvailable: true },
  { id: 'stk_121', sku: 'J121', name: 'Silver Roll Foil', category: 'Packaging & Carry Bags', unit: 'roll', qty: 0, minQty: 5, costPrice: 0, supplier: 'Plastic Vendor Egra', isAvailable: true },
  { id: 'stk_122', sku: 'J122', name: 'Hand Gloves', category: 'Packaging & Carry Bags', unit: 'box', qty: 0, minQty: 5, costPrice: 0, supplier: 'Plastic Vendor Egra', isAvailable: true },
  { id: 'stk_123', sku: 'J123', name: 'Chef Cap', category: 'Packaging & Carry Bags', unit: 'pcs', qty: 0, minQty: 10, costPrice: 0, supplier: 'Plastic Vendor Egra', isAvailable: true },

  // 7. Cleaning & Washings (washins)
  { id: 'stk_124', sku: 'J124', name: 'Vim Soap / Bar (Bhim Srap)', category: 'Cleaning & Washings', unit: 'pcs', qty: 0, minQty: 10, costPrice: 0, supplier: 'CleanTech Kolkata', isAvailable: true },
  { id: 'stk_125', sku: 'J125', name: 'Vim Liquid Dishwash', category: 'Cleaning & Washings', unit: 'bottle', qty: 0, minQty: 5, costPrice: 0, supplier: 'CleanTech Kolkata', isAvailable: true },
  { id: 'stk_126', sku: 'J126', name: 'Surf Excel Detergent', category: 'Cleaning & Washings', unit: 'kg', qty: 0, minQty: 10, costPrice: 0, supplier: 'CleanTech Kolkata', isAvailable: true },
  { id: 'stk_127', sku: 'J127', name: 'Hand Wash Liquid', category: 'Cleaning & Washings', unit: 'bottle', qty: 0, minQty: 5, costPrice: 0, supplier: 'CleanTech Kolkata', isAvailable: true },
  { id: 'stk_128', sku: 'J128', name: 'Harpic Toilet Cleaner', category: 'Cleaning & Washings', unit: 'bottle', qty: 0, minQty: 5, costPrice: 0, supplier: 'CleanTech Kolkata', isAvailable: true },
  { id: 'stk_129', sku: 'J129', name: 'Phenyl (Finaile)', category: 'Cleaning & Washings', unit: 'bottle', qty: 0, minQty: 5, costPrice: 0, supplier: 'CleanTech Kolkata', isAvailable: true },
  { id: 'stk_130', sku: 'J130', name: 'Bleaching Powder', category: 'Cleaning & Washings', unit: 'kg', qty: 0, minQty: 5, costPrice: 0, supplier: 'CleanTech Kolkata', isAvailable: true },
  { id: 'stk_131', sku: 'J131', name: 'Washing Powder', category: 'Cleaning & Washings', unit: 'kg', qty: 0, minQty: 10, costPrice: 0, supplier: 'CleanTech Kolkata', isAvailable: true },
  { id: 'stk_132', sku: 'J132', name: 'Floor Cleaner Liquid', category: 'Cleaning & Washings', unit: 'bottle', qty: 0, minQty: 5, costPrice: 0, supplier: 'CleanTech Kolkata', isAvailable: true }
];

// Default Seed IN & OUT Entries
const DEFAULT_IN_ENTRIES = [];
const DEFAULT_OUT_ENTRIES = [];

// App State
let stockItems = [];
let stockLogs = [];
let stockInEntries = [];
let stockOutEntries = [];
let activeCategoryFilter = 'all';
let searchQuery = '';

// DB Mappers
function mapDbToItem(row) {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    category: row.category,
    unit: row.unit,
    qty: Number(row.qty) || 0,
    minQty: Number(row.min_qty) || 0,
    costPrice: Number(row.cost_price) || 0,
    supplier: row.supplier || '',
    isAvailable: row.is_available !== false
  };
}

function mapItemToDb(item) {
  return {
    id: item.id,
    sku: item.sku,
    name: item.name,
    category: item.category,
    unit: item.unit,
    qty: Number(item.qty) || 0,
    min_qty: Number(item.minQty) || 0,
    cost_price: Number(item.costPrice) || 0,
    supplier: item.supplier || '',
    is_available: item.isAvailable !== false,
    updated_at: new Date().toISOString()
  };
}

function mapDbToInEntry(row) {
  return {
    id: row.id,
    date: row.date,
    sku: row.item_sku || '',
    description: row.item_name || '',
    qty: Number(row.qty) || 0,
    unit: row.unit || '',
    costPrice: Number(row.cost_price) || 0,
    supplier: row.supplier || '',
    notes: row.notes || '',
    createdAt: row.created_at
  };
}

function mapInEntryToDb(entry) {
  return {
    id: String(entry.id || ('in_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4))),
    date: entry.date,
    item_id: entry.itemId || entry.sku || '',
    item_sku: entry.sku || '',
    item_name: entry.description || '',
    qty: Number(entry.qty) || 0,
    unit: entry.unit || '',
    cost_price: Number(entry.costPrice) || 0,
    supplier: entry.supplier || '',
    notes: entry.notes || '',
    created_at: entry.createdAt || new Date().toISOString()
  };
}

function mapDbToOutEntry(row) {
  return {
    id: row.id,
    date: row.date,
    sku: row.item_sku || '',
    description: row.item_name || '',
    qty: Number(row.qty) || 0,
    unit: row.unit || '',
    usedBy: row.used_by || '',
    notes: row.notes || '',
    createdAt: row.created_at
  };
}

function mapOutEntryToDb(entry) {
  return {
    id: String(entry.id || ('out_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4))),
    date: entry.date,
    item_id: entry.itemId || entry.sku || '',
    item_sku: entry.sku || '',
    item_name: entry.description || '',
    qty: Number(entry.qty) || 0,
    unit: entry.unit || '',
    used_by: entry.usedBy || '',
    notes: entry.notes || '',
    created_at: entry.createdAt || new Date().toISOString()
  };
}

function mapDbToLog(row) {
  return {
    id: row.id,
    date: new Date(row.created_at || Date.now()).toLocaleString(),
    item: row.action,
    type: row.action,
    qty: '',
    notes: row.details || ''
  };
}

function mapLogToDb(log) {
  return {
    id: String(log.id || ('log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4))),
    action: `${log.item || ''} ${log.type ? '(' + log.type + ')' : ''}`,
    details: `${log.qty ? log.qty + ' | ' : ''}${log.notes || ''}`,
    created_at: new Date().toISOString()
  };
}

// Local Fallback loader in case of offline/network failure
function loadLocalFallback() {
  try {
    const rawItems = localStorage.getItem(STORAGE_KEY_ITEMS);
    let stored = rawItems ? JSON.parse(rawItems) : [];
    if (!stored || stored.length < DEFAULT_ITEMS.length) {
      stockItems = DEFAULT_ITEMS.map(def => {
        const match = stored.find(s => s.sku === def.sku || s.name === def.name);
        return match ? { ...def, qty: match.qty, minQty: match.minQty || def.minQty, costPrice: match.costPrice || def.costPrice } : def;
      });
    } else {
      stockItems = stored;
    }
  } catch (e) {
    stockItems = [...DEFAULT_ITEMS];
  }
}

// Load data from InsForge PostgreSQL (With Zero Data Loss Initial Migration)
async function loadStockData() {
  try {
    const { data: dbItems, error: itemsErr } = await insforge.database
      .from('stock_items')
      .select('*')
      .order('sku', { ascending: true });

    if (itemsErr) {
      console.warn('[StockManager] Notice fetching stock_items from InsForge:', itemsErr);
    }

    const { data: dbIn } = await insforge.database.from('stock_in_entries').select('*').order('created_at', { ascending: false });
    const { data: dbOut } = await insforge.database.from('stock_out_entries').select('*').order('created_at', { ascending: false });
    const { data: dbLogs } = await insforge.database.from('stock_logs').select('*').order('created_at', { ascending: false }).limit(50);

    // ZERO DATA LOSS MIGRATION & SEEDING LOGIC:
    if (!dbItems || dbItems.length === 0) {
      console.log('[StockManager] InsForge stock_items table is empty. Performing initial migration & seed from LocalStorage/Defaults...');
      let localStored = [];
      try {
        const rawLocal = localStorage.getItem(STORAGE_KEY_ITEMS);
        if (rawLocal) localStored = JSON.parse(rawLocal);
      } catch (e) {}

      localStored = localStored.filter(item => {
        const name = item.name || '';
        return !name.startsWith('Mouse') &&
               !name.startsWith('CPU') &&
               !name.startsWith('Desktop') &&
               !name.startsWith('Laptop') &&
               !name.startsWith('Smartwatch') &&
               !name.startsWith('Key Board') &&
               !name.startsWith('Monitor');
      });

      stockItems = DEFAULT_ITEMS.map((def, idx) => {
        const match = localStored.find(s => s.sku === def.sku || s.name === def.name || s.id === def.id);
        const sku = def.sku || `J${String(idx + 1).padStart(3, '0')}`;
        return match ? { ...def, sku, qty: Number(match.qty) || 0, minQty: Number(match.minQty) || def.minQty, costPrice: Number(match.costPrice) || def.costPrice, supplier: match.supplier || def.supplier } : { ...def, sku };
      });

      try {
        const rawIn = localStorage.getItem(STORAGE_KEY_IN_ENTRIES);
        if (rawIn) stockInEntries = JSON.parse(rawIn);
      } catch (e) {}

      try {
        const rawOut = localStorage.getItem(STORAGE_KEY_OUT_ENTRIES);
        if (rawOut) stockOutEntries = JSON.parse(rawOut);
      } catch (e) {}

      try {
        const rawLogs = localStorage.getItem(STORAGE_KEY_LOGS);
        if (rawLogs) stockLogs = JSON.parse(rawLogs);
      } catch (e) {}

      // Bulk Insert into InsForge PostgreSQL database
      try {
        const dbItemsToInsert = stockItems.map(mapItemToDb);
        await insforge.database.from('stock_items').insert(dbItemsToInsert);

        if (stockInEntries.length > 0) {
          const dbInToInsert = stockInEntries.map(mapInEntryToDb);
          await insforge.database.from('stock_in_entries').insert(dbInToInsert);
        }

        if (stockOutEntries.length > 0) {
          const dbOutToInsert = stockOutEntries.map(mapOutEntryToDb);
          await insforge.database.from('stock_out_entries').insert(dbOutToInsert);
        }

        if (stockLogs.length > 0) {
          const dbLogsToInsert = stockLogs.map(mapLogToDb);
          await insforge.database.from('stock_logs').insert(dbLogsToInsert);
        }
        console.log('[StockManager] ✅ Initial migration & seed to InsForge database completed successfully!');
      } catch (seedErr) {
        console.error('[StockManager] Error during initial InsForge seed:', seedErr);
      }
    } else {
      stockItems = dbItems.map(mapDbToItem);
      stockInEntries = (dbIn || []).map(mapDbToInEntry);
      stockOutEntries = (dbOut || []).map(mapDbToOutEntry);
      stockLogs = (dbLogs || []).map(mapDbToLog);
    }
  } catch (err) {
    console.error('[StockManager] Unexpected error loading InsForge stock data:', err);
    loadLocalFallback();
  }

  saveItemsToStorage();
  renderAllViews();
}

function renderAllViews() {
  renderInOutBalanceTables();
  renderKPIs();
  renderGrid();
  renderLogs();
}

function saveItemsToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(stockItems));
    localStorage.setItem(STORAGE_KEY_IN_ENTRIES, JSON.stringify(stockInEntries));
    localStorage.setItem(STORAGE_KEY_OUT_ENTRIES, JSON.stringify(stockOutEntries));
  } catch (e) {
    console.warn('[StockManager] Failed to save items to local mirror:', e);
  }
}

function saveLogsToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(stockLogs));
  } catch (e) {
    console.warn('[StockManager] Failed to save logs to local mirror:', e);
  }
}

// Database Persistence Helpers
async function syncItemToDb(item) {
  try {
    await insforge.database.from('stock_items').upsert([mapItemToDb(item)]);
  } catch (err) {
    console.warn('[StockManager] Failed to sync item to InsForge:', err);
  }
}

async function deleteItemFromDb(itemId) {
  try {
    await insforge.database.from('stock_items').delete().eq('id', itemId);
  } catch (err) {
    console.warn('[StockManager] Failed to delete item from InsForge:', err);
  }
}

async function syncInEntryToDb(entry) {
  try {
    await insforge.database.from('stock_in_entries').insert([mapInEntryToDb(entry)]);
  } catch (err) {
    console.warn('[StockManager] Failed to sync IN entry to InsForge:', err);
  }
}

async function syncOutEntryToDb(entry) {
  try {
    await insforge.database.from('stock_out_entries').insert([mapOutEntryToDb(entry)]);
  } catch (err) {
    console.warn('[StockManager] Failed to sync OUT entry to InsForge:', err);
  }
}

async function addAuditLog(itemName, type, qty, unit, notes = '') {
  const log = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    date: new Date().toLocaleString(),
    item: itemName,
    type,
    qty: `${type.includes('Reduce') || type.includes('OUT') ? '-' : '+'}${qty} ${unit}`,
    notes: notes || 'Manual adjustment'
  };
  stockLogs.unshift(log);
  if (stockLogs.length > 50) stockLogs = stockLogs.slice(0, 50);
  saveLogsToStorage();
  renderLogs();

  try {
    await insforge.database.from('stock_logs').insert([mapLogToDb(log)]);
  } catch (err) {
    console.warn('[StockManager] Failed to sync log to InsForge:', err);
  }
}

// ═════════════════════════════════════════════════════════════════════
// IN, OUT & BALANCE SPREADSHEET TABLES RENDERING & CALCULATION ENGINE
// ═════════════════════════════════════════════════════════════════════
function renderInOutBalanceTables() {
  const inBody = document.getElementById('table-in-body');
  const outBody = document.getElementById('table-out-body');
  const balanceBody = document.getElementById('table-balance-body');

  const badgeIn = document.getElementById('badge-in-count');
  const badgeOut = document.getElementById('badge-out-count');
  const badgeBalance = document.getElementById('badge-balance-count');

  const filteredIn = searchQuery ? stockInEntries.filter(e => e.description?.toLowerCase().includes(searchQuery.toLowerCase()) || e.sku?.toLowerCase().includes(searchQuery.toLowerCase())) : stockInEntries;
  const filteredOut = searchQuery ? stockOutEntries.filter(e => e.description?.toLowerCase().includes(searchQuery.toLowerCase()) || e.sku?.toLowerCase().includes(searchQuery.toLowerCase())) : stockOutEntries;
  const filteredItemsForBalance = getFilteredItems();

  if (badgeIn) badgeIn.textContent = `${filteredIn.length} entries`;
  if (badgeOut) badgeOut.textContent = `${filteredOut.length} entries`;
  if (badgeBalance) badgeBalance.textContent = `${filteredItemsForBalance.length} items`;

  // 1. Render IN Table (Green Theme)
  if (inBody) {
    inBody.innerHTML = '';
    if (filteredIn.length === 0) {
      inBody.innerHTML = '<tr><td colspan="6" class="py-3 px-3 text-center text-slate-500">No matching IN entries.</td></tr>';
    } else {
      filteredIn.forEach(entry => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-900/60 transition-colors';
        tr.innerHTML = `
          <td class="py-1.5 px-1.5 sm:px-2.5 text-slate-400 font-mono">${entry.date}</td>
          <td class="py-1.5 px-1.5 sm:px-2.5 font-bold text-emerald-400 font-mono">${entry.sku}</td>
          <td class="py-1.5 px-1.5 sm:px-2.5 font-semibold text-white truncate max-w-[110px] sm:max-w-none">${entry.description}</td>
          <td class="py-1.5 px-1.5 sm:px-2.5 text-slate-400">${entry.unit}</td>
          <td class="py-1.5 px-1.5 sm:px-2.5 text-right font-extrabold text-emerald-300">${entry.qty}</td>
          <td class="py-1.5 px-1 text-center"><button class="btn-delete-in text-rose-400 hover:text-rose-300 font-bold p-1 cursor-pointer transition-transform active:scale-95" data-id="${entry.id}" title="Delete wrong IN entry">🗑️</button></td>
        `;
        inBody.appendChild(tr);
      });
    }

    inBody.querySelectorAll('.btn-delete-in').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteStockInEntry(btn.dataset.id);
      });
    });
  }

  // 2. Render OUT Table (Orange/Brown Theme)
  if (outBody) {
    outBody.innerHTML = '';
    if (filteredOut.length === 0) {
      outBody.innerHTML = '<tr><td colspan="6" class="py-3 px-3 text-center text-slate-500">No matching OUT entries.</td></tr>';
    } else {
      filteredOut.forEach(entry => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-900/60 transition-colors';
        tr.innerHTML = `
          <td class="py-1.5 px-1.5 sm:px-2.5 text-slate-400 font-mono">${entry.date}</td>
          <td class="py-1.5 px-1.5 sm:px-2.5 font-bold text-amber-400 font-mono">${entry.sku}</td>
          <td class="py-1.5 px-1.5 sm:px-2.5 font-semibold text-white truncate max-w-[110px] sm:max-w-none">${entry.description}</td>
          <td class="py-1.5 px-1.5 sm:px-2.5 text-slate-400">${entry.unit}</td>
          <td class="py-1.5 px-1.5 sm:px-2.5 text-right font-extrabold text-amber-300">${entry.qty}</td>
          <td class="py-1.5 px-1 text-center"><button class="btn-delete-out text-rose-400 hover:text-rose-300 font-bold p-1 cursor-pointer transition-transform active:scale-95" data-id="${entry.id}" title="Delete wrong OUT entry">🗑️</button></td>
        `;
        outBody.appendChild(tr);
      });
    }

    outBody.querySelectorAll('.btn-delete-out').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteStockOutEntry(btn.dataset.id);
      });
    });
  }

  // 3. Calculate and Render BALANCE Table (Blue Theme)
  if (balanceBody) {
    balanceBody.innerHTML = '';
    // First calculate all quantities
    stockItems.forEach(item => {
      const totalIn = stockInEntries.filter(e => e.sku === item.sku).reduce((sum, e) => sum + (parseFloat(e.qty) || 0), 0);
      const totalOut = stockOutEntries.filter(e => e.sku === item.sku).reduce((sum, e) => sum + (parseFloat(e.qty) || 0), 0);
      item.qty = totalIn - totalOut;
      item.isAvailable = item.qty > 0;
    });

    if (filteredItemsForBalance.length === 0) {
      balanceBody.innerHTML = '<tr><td colspan="4" class="py-3 px-3 text-center text-slate-500">No matching balance items.</td></tr>';
    } else {
      filteredItemsForBalance.forEach(item => {
        const isCritical = item.qty <= item.minQty;
        const tr = document.createElement('tr');
        tr.className = `hover:bg-slate-900/60 transition-colors ${isCritical ? 'bg-rose-950/30' : (item.qty > 0 ? 'bg-slate-900/30' : '')}`;
        tr.innerHTML = `
          <td class="py-1.5 px-1.5 sm:px-2.5 font-bold ${isCritical ? 'text-rose-400' : 'text-sky-400'} font-mono">${item.sku}</td>
          <td class="py-1.5 px-1.5 sm:px-2.5 font-semibold text-white truncate max-w-[110px] sm:max-w-none">${item.name}</td>
          <td class="py-1.5 px-1.5 sm:px-2.5 text-slate-400">${item.unit}</td>
          <td class="py-1.5 px-1.5 sm:px-2.5 text-right font-black ${isCritical ? 'text-rose-400' : (item.qty > 0 ? 'text-sky-300' : 'text-slate-500')}">${item.qty} ${isCritical ? '⚠️' : ''}</td>
        `;
        balanceBody.appendChild(tr);
      });
    }
  }

  saveItemsToStorage();
  renderCriticalStockSection();
}

function deleteStockInEntry(entryId) {
  const index = stockInEntries.findIndex(e => e.id === entryId);
  if (index === -1) return;
  const entry = stockInEntries[index];

  if (!confirm(`Are you sure you want to remove this wrong Stock IN entry?\n\nSKU: ${entry.sku}\nItem: ${entry.description}\nQty: +${entry.qty} ${entry.unit}\nDate: ${entry.date}`)) {
    return;
  }

  stockInEntries.splice(index, 1);
  saveItemsToStorage();
  addAuditLog(entry.description, 'Delete wrong IN', entry.qty, entry.unit, `Deleted wrong IN entry for SKU ${entry.sku}`);
  
  renderInOutBalanceTables();
  renderGrid();
  renderKPIs();
  showToast(`🗑️ Wrong Stock IN entry deleted & balance recalculated!`);
}

function deleteStockOutEntry(entryId) {
  const index = stockOutEntries.findIndex(e => e.id === entryId);
  if (index === -1) return;
  const entry = stockOutEntries[index];

  if (!confirm(`Are you sure you want to remove this wrong Stock OUT entry?\n\nSKU: ${entry.sku}\nItem: ${entry.description}\nQty: -${entry.qty} ${entry.unit}\nDate: ${entry.date}`)) {
    return;
  }

  stockOutEntries.splice(index, 1);
  saveItemsToStorage();
  addAuditLog(entry.description, 'Delete wrong OUT', entry.qty, entry.unit, `Deleted wrong OUT entry for SKU ${entry.sku}`);

  renderInOutBalanceTables();
  renderGrid();
  renderKPIs();
  showToast(`🗑️ Wrong Stock OUT entry deleted & balance recalculated!`);
}

// Render Critical Stock Section (Actual Balance <= Minimum Balance Qty)
function renderCriticalStockSection() {
  const sectionEl = document.getElementById('critical-stock-section');
  const gridEl = document.getElementById('critical-items-grid');
  const badgeEl = document.getElementById('critical-count-badge');
  if (!sectionEl || !gridEl) return;

  const criticalItems = stockItems.filter(item => item.qty <= item.minQty);

  if (badgeEl) badgeEl.textContent = `${criticalItems.length} critical item${criticalItems.length === 1 ? '' : 's'}`;

  if (criticalItems.length === 0) {
    sectionEl.classList.add('hidden');
    gridEl.innerHTML = '';
  } else {
    sectionEl.classList.remove('hidden');
    gridEl.innerHTML = criticalItems.map(item => {
      return `
        <div class="bg-rose-950/40 border border-rose-500/50 p-3.5 rounded-2xl flex items-center justify-between gap-3 shadow-lg">
          <div class="min-w-0">
            <div class="flex items-center gap-1.5 mb-1">
              <span class="font-bold text-xs text-rose-300 font-mono">${item.sku}</span>
              <span class="text-[10px] px-2 py-0.2 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30 truncate">${item.category}</span>
            </div>
            <h4 class="font-bold text-xs text-white truncate">${item.name}</h4>
            <p class="text-[11px] text-rose-300 font-semibold mt-1">
              Actual Balance: <span class="font-black text-rose-200 text-xs">${item.qty} ${item.unit}</span> 
              <span class="text-slate-400 font-normal">(Min Required: ${item.minQty})</span>
            </p>
          </div>
          <button class="px-3 py-1.5 bg-rose-500 hover:bg-rose-400 text-slate-950 font-extrabold text-[11px] rounded-xl shadow transition-all cursor-pointer btn-quick-in shrink-0" data-sku="${item.sku}">
            ➕ Add IN
          </button>
        </div>
      `;
    }).join('');

    gridEl.querySelectorAll('.btn-quick-in').forEach(btn => {
      btn.addEventListener('click', () => {
        openInOutModal('IN', btn.dataset.sku);
      });
    });
  }
}

// UI KPI Banner Rendering
function renderKPIs() {
  const totalItemsEl = document.getElementById('kpi-total-items');
  const lowStockEl = document.getElementById('kpi-low-stock');
  const totalValueEl = document.getElementById('kpi-total-value');
  const countBadgeEl = document.getElementById('inventory-count-badge');

  const filtered = getFilteredItems();

  const totalItems = filtered.length;
  const lowStockItems = filtered.filter(i => i.qty <= i.minQty || !i.isAvailable).length;
  const totalVal = filtered.reduce((acc, i) => acc + (i.qty * (i.costPrice || 0)), 0);

  if (totalItemsEl) totalItemsEl.textContent = totalItems;
  if (lowStockEl) lowStockEl.textContent = lowStockItems;
  if (totalValueEl) totalValueEl.textContent = `₹ ${totalVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  if (countBadgeEl) countBadgeEl.textContent = `${totalItems} items`;
}

function getFilteredItems() {
  return stockItems.filter(item => {
    const matchesCat = activeCategoryFilter === 'all' || item.category === activeCategoryFilter;
    const matchesSearch = !searchQuery || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.supplier && item.supplier.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });
}

function renderGrid() {
  const gridEl = document.getElementById('stock-grid');
  if (!gridEl) return;

  const items = getFilteredItems();
  gridEl.innerHTML = '';

  if (items.length === 0) {
    gridEl.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-400">
        <div class="text-4xl mb-2">📦</div>
        <p class="font-semibold text-sm">No stock items found for this filter.</p>
      </div>
    `;
    return;
  }

  items.forEach(item => {
    const isLow = item.qty <= item.minQty;
    const card = document.createElement('div');
    card.className = `stock-glass-card p-4 flex flex-col justify-between space-y-4 border transition-all ${isLow ? 'border-rose-500/40 bg-rose-950/20' : 'border-slate-800'}`;

    card.innerHTML = `
      <div class="space-y-2">
        <div class="flex items-start justify-between gap-2">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-mono font-bold text-sky-400 px-1.5 py-0.5 rounded bg-sky-950 border border-sky-800">${item.sku}</span>
              <h3 class="font-extrabold text-sm text-white">${item.name}</h3>
            </div>
            <span class="text-[10px] font-semibold text-slate-400 mt-1 block">${item.category}</span>
          </div>
          <span class="text-xs font-bold px-2 py-0.5 rounded-full ${item.isAvailable ? (isLow ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30') : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}">
            ${item.isAvailable ? (isLow ? '⚠️ Low Stock' : '✓ In Stock') : '🔴 Out of Stock'}
          </span>
        </div>

        <div class="grid grid-cols-2 gap-2 text-xs bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/60">
          <div>
            <span class="text-[10px] text-slate-500 uppercase block font-semibold">Balance Qty</span>
            <span class="font-extrabold text-sm text-sky-300">${item.qty} ${item.unit}</span>
          </div>
          <div>
            <span class="text-[10px] text-slate-500 uppercase block font-semibold">Unit Cost</span>
            <span class="font-extrabold text-sm text-slate-200">₹ ${item.costPrice || 0}</span>
          </div>
        </div>

        ${item.supplier ? `<p class="text-[11px] text-slate-400 italic">Supplier: ${item.supplier}</p>` : ''}
      </div>

      <div class="flex items-center justify-between pt-2 border-t border-slate-800/80 gap-2 flex-wrap sm:flex-nowrap">
        <label class="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-300 py-1">
          <input type="checkbox" class="toggle-availability-chk accent-emerald-500 w-4.5 h-4.5" data-id="${item.id}" ${item.isAvailable ? 'checked' : ''} />
          <span>${item.isAvailable ? 'Available' : 'Disabled'}</span>
        </label>

        <div class="flex items-center gap-2">
          <button class="btn-adjust-qty px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer" data-id="${item.id}">
            ⚡ Adjust
          </button>
          <button class="btn-edit-item px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer" data-id="${item.id}">
            ✏️ Edit
          </button>
        </div>
      </div>
    `;

    gridEl.appendChild(card);
  });

  bindGridEvents();
}

function bindGridEvents() {
  document.querySelectorAll('.toggle-availability-chk').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const id = e.target.getAttribute('data-id');
      const item = stockItems.find(i => i.id === id);
      if (item) {
        item.isAvailable = e.target.checked;
        saveItemsToStorage();
        syncItemToDb(item);
        renderKPIs();
        renderGrid();
        showToast(`${item.name} status updated to ${item.isAvailable ? 'In Stock' : 'Out of Stock'}`);
      }
    });
  });

  document.querySelectorAll('.btn-adjust-qty').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      openAdjustModal(id);
    });
  });

  document.querySelectorAll('.btn-edit-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      openAddEditModal(id);
    });
  });
}

function renderLogs() {
  const logsBody = document.getElementById('stock-logs-body');
  if (!logsBody) return;

  logsBody.innerHTML = '';
  if (stockLogs.length === 0) {
    logsBody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-500">No stock adjustment logs yet.</td></tr>';
    return;
  }

  stockLogs.forEach(log => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="py-2 px-3 text-slate-400">${log.date}</td>
      <td class="py-2 px-3 font-semibold text-white">${log.item}</td>
      <td class="py-2 px-3 font-bold ${log.type.includes('Add') || log.type.includes('IN') ? 'text-emerald-400' : 'text-rose-400'}">${log.type}</td>
      <td class="py-2 px-3 text-center font-bold">${log.qty}</td>
      <td class="py-2 px-3 text-right text-slate-400">—</td>
      <td class="py-2 px-3 text-slate-400">${log.notes}</td>
    `;
    logsBody.appendChild(tr);
  });
}

// ═════════════════════════════════════════════════════════════════════
// RECORD IN / OUT ENTRY MODAL HANDLERS
// ═════════════════════════════════════════════════════════════════════
function openInOutModal(mode = 'IN', targetSku = null) {
  const modal = document.getElementById('modal-inout-entry');
  const title = document.getElementById('modal-inout-title');
  const modeInput = document.getElementById('inout-mode');
  const select = document.getElementById('inout-item-select');
  const dateInput = document.getElementById('inout-date');
  const qtyInput = document.getElementById('inout-qty');
  const submitBtn = document.getElementById('inout-submit-btn');

  if (!modal || !select) return;

  modeInput.value = mode;
  dateInput.value = new Date().toISOString().split('T')[0];
  qtyInput.value = '';

  if (mode === 'IN') {
    title.innerHTML = '📥 Record Stock IN Entry';
    title.className = 'text-sm font-bold text-emerald-400 flex items-center gap-2';
    submitBtn.className = 'px-5 py-2 bg-emerald-500 text-slate-950 font-bold rounded-xl shadow-lg cursor-pointer';
    submitBtn.textContent = 'Save IN Entry';
  } else {
    title.innerHTML = '📤 Record Stock OUT Entry';
    title.className = 'text-sm font-bold text-amber-400 flex items-center gap-2';
    submitBtn.className = 'px-5 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl shadow-lg cursor-pointer';
    submitBtn.textContent = 'Save OUT Entry';
  }

  // Populate Select options with SKU & Item Name
  select.innerHTML = '';
  stockItems.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.sku;
    opt.textContent = `[${item.sku}] ${item.name} (${item.unit})`;
    if (targetSku && item.sku === targetSku) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });

  if (targetSku) {
    select.value = targetSku;
  }

  // Set unit display for selected item
  const selectedItem = stockItems.find(i => i.sku === (targetSku || (stockItems[0] && stockItems[0].sku)));
  if (selectedItem) {
    document.getElementById('inout-unit-display').value = selectedItem.unit;
  }

  select.onchange = (e) => {
    const match = stockItems.find(i => i.sku === e.target.value);
    if (match) {
      document.getElementById('inout-unit-display').value = match.unit;
    }
  };

  modal.style.display = 'flex';
  modal.classList.remove('hidden');
}

function closeInOutModal() {
  const modal = document.getElementById('modal-inout-entry');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.add('hidden');
  }
}

function openAddEditModal(itemId = null) {
  const modal = document.getElementById('modal-add-item');
  const title = document.getElementById('modal-title');
  const form = document.getElementById('form-stock-item');
  if (!modal || !form) return;

  if (itemId) {
    const item = stockItems.find(i => i.id === itemId);
    if (!item) return;
    title.textContent = '✏️ Edit Stock Item';
    document.getElementById('form-item-id').value = item.id;
    document.getElementById('form-name').value = item.name;
    document.getElementById('form-category').value = item.category;
    document.getElementById('form-unit').value = item.unit;
    document.getElementById('form-qty').value = item.qty;
    document.getElementById('form-min-qty').value = item.minQty || 5;
    document.getElementById('form-price').value = item.costPrice || 0;
    document.getElementById('form-supplier').value = item.supplier || '';
  } else {
    title.textContent = '📦 Add Stock Item';
    form.reset();
    document.getElementById('form-item-id').value = '';
  }

  modal.style.display = 'flex';
  modal.classList.remove('hidden');
}

function closeAddEditModal() {
  const modal = document.getElementById('modal-add-item');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.add('hidden');
  }
}

function openAdjustModal(itemId) {
  const modal = document.getElementById('modal-adjust-stock');
  const item = stockItems.find(i => i.id === itemId);
  if (!modal || !item) return;

  document.getElementById('adjust-item-id').value = item.id;
  document.getElementById('adjust-item-name').value = item.name;
  document.getElementById('adjust-qty').value = '';
  document.getElementById('adjust-notes').value = '';

  modal.style.display = 'flex';
  modal.classList.remove('hidden');
}

function closeAdjustModal() {
  const modal = document.getElementById('modal-adjust-stock');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.add('hidden');
  }
}

// Export PDF Report
function exportPDF() {
  if (!window.jspdf) {
    alert('PDF export engine loading. Please try again in a moment.');
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text('LIMRA Restaurant — Stock Inventory & Balance Report', 14, 15);
  doc.setFontSize(10);
  doc.text(`Generated Date: ${new Date().toLocaleString()}`, 14, 22);

  const items = getFilteredItems();
  const tableData = items.map(i => [
    i.sku,
    i.name,
    i.category,
    `${i.qty} ${i.unit}`,
    `₹ ${i.costPrice || 0}`,
    `₹ ${(i.qty * (i.costPrice || 0)).toFixed(2)}`,
    i.isAvailable ? 'In Stock' : 'Out of Stock'
  ]);

  doc.autoTable({
    startY: 28,
    head: [['SKU', 'Item Name', 'Category', 'Balance Qty', 'Unit Cost', 'Total Value', 'Status']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129] }
  });

  doc.save(`LIMRA_Stock_Balance_Report_${Date.now()}.pdf`);
}

// Export Excel Report
function exportExcel() {
  if (!window.XLSX) {
    alert('Excel engine loading. Please try again in a moment.');
    return;
  }
  const items = getFilteredItems().map(i => ({
    'SKU Code': i.sku,
    'Item Name': i.name,
    'Category': i.category,
    'Balance Qty': i.qty,
    'Unit': i.unit,
    'Unit Cost (INR)': i.costPrice || 0,
    'Total Value (INR)': i.qty * (i.costPrice || 0),
    'Supplier': i.supplier || '',
    'Status': i.isAvailable ? 'In Stock' : 'Out of Stock'
  }));

  const worksheet = XLSX.utils.json_to_sheet(items);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Balance');
  XLSX.writeFile(workbook, `LIMRA_Stock_Balance_${Date.now()}.xlsx`);
}

function showToast(msg) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'bg-slate-900 border border-emerald-500/50 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xl transition-all duration-300 opacity-0 transform translate-y-2';
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.remove('opacity-0', 'translate-y-2');
  }, 10);
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Init Setup
document.addEventListener('DOMContentLoaded', () => {
  loadStockData();
  renderInOutBalanceTables();
  renderKPIs();
  renderGrid();
  renderLogs();

  // Universal Search input handlers (Header & Main Global Search)
  const headerSearch = document.getElementById('stock-search-input');
  const globalSearch = document.getElementById('global-stock-search');
  const clearBtn = document.getElementById('btn-clear-search');

  function applySearch(val) {
    searchQuery = val.trim();
    if (headerSearch && headerSearch.value !== val) headerSearch.value = val;
    if (globalSearch && globalSearch.value !== val) globalSearch.value = val;
    
    if (clearBtn) {
      if (searchQuery) {
        clearBtn.classList.remove('hidden');
      } else {
        clearBtn.classList.add('hidden');
      }
    }

    renderInOutBalanceTables();
    renderKPIs();
    renderGrid();
  }

  if (headerSearch) {
    headerSearch.addEventListener('input', (e) => applySearch(e.target.value));
  }
  if (globalSearch) {
    globalSearch.addEventListener('input', (e) => applySearch(e.target.value));
  }
  if (clearBtn) {
    clearBtn.addEventListener('click', () => applySearch(''));
  }

  // Category filter chips
  document.querySelectorAll('#category-chips-container .stock-pill-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('#category-chips-container .stock-pill-btn').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      activeCategoryFilter = e.currentTarget.getAttribute('data-category');
      
      const label = document.getElementById('active-category-label');
      if (label) label.textContent = activeCategoryFilter === 'all' ? 'All Items' : activeCategoryFilter;

      renderKPIs();
      renderGrid();
    });
  });

  // RECORD IN / RECORD OUT Buttons
  document.getElementById('btn-record-in')?.addEventListener('click', () => openInOutModal('IN'));
  document.getElementById('btn-record-out')?.addEventListener('click', () => openInOutModal('OUT'));
  document.getElementById('modal-inout-close')?.addEventListener('click', closeInOutModal);
  document.getElementById('inout-cancel-btn')?.addEventListener('click', closeInOutModal);

  // Form Submit: Record IN/OUT Entry
  document.getElementById('form-inout-entry')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mode = document.getElementById('inout-mode').value;
    const rawDate = document.getElementById('inout-date').value;
    const sku = document.getElementById('inout-item-select').value;
    const qty = parseFloat(document.getElementById('inout-qty').value) || 0;

    const item = stockItems.find(i => i.sku === sku);
    if (!item || qty <= 0) return;

    // Format date as DD-MM-YYYY
    const dateParts = rawDate.split('-');
    const formattedDate = dateParts.length === 3 ? `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}` : rawDate;

    const newEntry = {
      id: (mode === 'IN' ? 'in_' : 'out_') + Date.now(),
      date: formattedDate,
      itemId: item.id,
      sku,
      description: item.name,
      unit: item.unit,
      qty
    };

    if (mode === 'IN') {
      item.qty += qty;
      stockInEntries.unshift(newEntry);
      syncInEntryToDb(newEntry);
      syncItemToDb(item);
      addAuditLog(item.name, 'Stock IN (+)', qty, item.unit, `Manual IN entry recorded for ${sku}`);
      showToast(`Logged IN: ${qty} ${item.unit} for [${sku}] ${item.name}`);
    } else {
      item.qty = Math.max(0, item.qty - qty);
      stockOutEntries.unshift(newEntry);
      syncOutEntryToDb(newEntry);
      syncItemToDb(item);
      addAuditLog(item.name, 'Stock OUT (-)', qty, item.unit, `Manual OUT entry recorded for ${sku}`);
      showToast(`Logged OUT: ${qty} ${item.unit} for [${sku}] ${item.name}`);
    }

    saveItemsToStorage();
    renderInOutBalanceTables();
    renderKPIs();
    renderGrid();
    closeInOutModal();
  });

  // Modal open/close: Add Item
  document.getElementById('btn-open-add-modal')?.addEventListener('click', () => openAddEditModal());
  document.getElementById('modal-add-close')?.addEventListener('click', closeAddEditModal);
  document.getElementById('form-cancel-btn')?.addEventListener('click', closeAddEditModal);

  document.getElementById('modal-adjust-close')?.addEventListener('click', closeAdjustModal);
  document.getElementById('adjust-cancel-btn')?.addEventListener('click', closeAdjustModal);

  // Form submit: Add/Edit Item
  document.getElementById('form-stock-item')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('form-item-id').value;
    const name = document.getElementById('form-name').value.trim();
    const category = document.getElementById('form-category').value;
    const unit = document.getElementById('form-unit').value;
    const qty = parseFloat(document.getElementById('form-qty').value) || 0;
    const minQty = parseFloat(document.getElementById('form-min-qty').value) || 5;
    const costPrice = parseFloat(document.getElementById('form-price').value) || 0;
    const supplier = document.getElementById('form-supplier').value.trim();

    if (id) {
      const item = stockItems.find(i => i.id === id);
      if (item) {
        item.name = name;
        item.category = category;
        item.unit = unit;
        item.qty = qty;
        item.minQty = minQty;
        item.costPrice = costPrice;
        item.supplier = supplier;
        syncItemToDb(item);
        showToast(`Updated ${name}`);
      }
    } else {
      const skuCount = stockItems.length + 1;
      const nextSku = `J${String(skuCount).padStart(3, '0')}`;
      const newItem = {
        id: 'stk_' + Date.now(),
        sku: nextSku,
        name, category, unit, qty, minQty, costPrice, supplier,
        isAvailable: true
      };
      stockItems.unshift(newItem);
      syncItemToDb(newItem);

      // Add corresponding IN entry for initial stock quantity
      if (qty > 0) {
        const initIn = {
          id: 'in_' + Date.now(),
          date: new Date().toISOString().split('T')[0].split('-').reverse().join('-'),
          itemId: newItem.id,
          sku: nextSku,
          description: name,
          unit,
          qty
        };
        stockInEntries.unshift(initIn);
        syncInEntryToDb(initIn);
      }

      addAuditLog(name, 'Add Item', qty, unit, 'Created new stock item with SKU ' + nextSku);
      showToast(`Added new item: [${nextSku}] ${name}`);
    }

    saveItemsToStorage();
    renderInOutBalanceTables();
    renderKPIs();
    renderGrid();
    closeAddEditModal();
  });

  // Form submit: Adjust Stock
  document.getElementById('form-adjust-stock')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('adjust-item-id').value;
    const type = document.getElementById('adjust-type').value;
    const adjustQty = parseFloat(document.getElementById('adjust-qty').value) || 0;
    const notes = document.getElementById('adjust-notes').value.trim();

    const item = stockItems.find(i => i.id === id);
    if (item && adjustQty > 0) {
      const todayStr = new Date().toISOString().split('T')[0].split('-').reverse().join('-');
      if (type === 'add') {
        item.qty += adjustQty;
        const entry = {
          id: 'in_' + Date.now(),
          date: todayStr,
          itemId: item.id,
          sku: item.sku,
          description: item.name,
          unit: item.unit,
          qty: adjustQty
        };
        stockInEntries.unshift(entry);
        syncInEntryToDb(entry);
        syncItemToDb(item);
        addAuditLog(item.name, 'Add Stock (+)', adjustQty, item.unit, notes);
      } else {
        item.qty = Math.max(0, item.qty - adjustQty);
        const entry = {
          id: 'out_' + Date.now(),
          date: todayStr,
          itemId: item.id,
          sku: item.sku,
          description: item.name,
          unit: item.unit,
          qty: adjustQty
        };
        stockOutEntries.unshift(entry);
        syncOutEntryToDb(entry);
        syncItemToDb(item);
        addAuditLog(item.name, 'Reduce Stock (-)', adjustQty, item.unit, notes);
      }
      saveItemsToStorage();
      renderInOutBalanceTables();
      renderKPIs();
      renderGrid();
      closeAdjustModal();
      showToast(`Adjusted ${item.name} stock (${type === 'add' ? '+' : '-'}${adjustQty} ${item.unit})`);
    }
  });

  // Export buttons
  document.getElementById('btn-export-excel')?.addEventListener('click', exportExcel);
  document.getElementById('btn-export-pdf')?.addEventListener('click', exportPDF);
  document.getElementById('btn-clear-logs')?.addEventListener('click', () => {
    if (confirm('Clear all audit transaction logs?')) {
      stockLogs = [];
      saveLogsToStorage();
      renderLogs();
      showToast('Audit logs cleared');
    }
  });

  // Realtime InsForge sync
  try {
    insforge.realtime.subscribe('stock_items', () => {
      console.log('[StockManager] Realtime stock change notification received.');
      loadStockData();
    });
  } catch (err) {
    console.warn('[StockManager] Realtime subscription notice:', err);
  }
});
