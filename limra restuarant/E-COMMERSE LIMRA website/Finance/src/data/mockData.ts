export interface Transaction {
  id: string;
  date: string;
  type: 'income' | 'expense';
  scope: 'restaurant' | 'personal';
  category: string;
  subcategory?: string;
  amount: number;
  payment_method: 'cash' | 'upi' | 'card' | 'bank';
  notes?: string;
  vendor?: string;
  employee?: string;
  gst_number?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  opening_stock: number;
  closing_stock: number;
  min_stock: number;
  unit: string;
  cost_per_unit: number;
  expiry_date?: string;
}

export interface Vendor {
  id: string;
  name: string;
  phone: string;
  email: string;
  outstanding: number;
  last_purchase: string;
  rating: number;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  salary: number;
  salary_due: number;
  attendance: number; // percentage this month
}

export interface Asset {
  id: string;
  name: string;
  purchase_value: number;
  current_value: number;
  depreciation: number;
}


export interface Budget {
  id: string;
  category: string;
  amount: number;
  spent: number;
}

export const INITIAL_TRANSACTIONS: Transaction[] = [
  // Restaurant Sales (Online/Cash Sell)
  { id: '1', date: '2026-07-17', type: 'income', scope: 'restaurant', category: 'Sell', subcategory: 'Online', amount: 18450, payment_method: 'upi', notes: 'Daily online sales aggregate' },
  { id: '2', date: '2026-07-17', type: 'income', scope: 'restaurant', category: 'Sell', subcategory: 'Cash', amount: 8900, payment_method: 'cash', notes: 'Cash drawer drop' },
  { id: '3', date: '2026-07-16', type: 'income', scope: 'restaurant', category: 'Sell', subcategory: 'Online', amount: 21200, payment_method: 'upi', notes: 'Dinner rush UPI total' },
  { id: '4', date: '2026-07-16', type: 'income', scope: 'restaurant', category: 'Sell', subcategory: 'Online', amount: 6200, payment_method: 'card', notes: 'POS card transactions' },
  { id: '5', date: '2026-07-15', type: 'income', scope: 'restaurant', category: 'Sell', subcategory: 'Online', amount: 15000, payment_method: 'bank', notes: 'Advance for weekend birthday party' },
  
  // Restaurant Expenses (Expense/Maintenance/Rent/Utilities)
  { id: '6', date: '2026-07-17', type: 'expense', scope: 'restaurant', category: 'Expense', subcategory: 'Chicken', amount: 3500, payment_method: 'cash', notes: 'Fresh poultry delivery', vendor: 'Egra Poultry Center' },
  { id: '7', date: '2026-07-16', type: 'expense', scope: 'restaurant', category: 'Expense', subcategory: 'Vegetables', amount: 1200, payment_method: 'cash', notes: 'Morning market supplies', vendor: 'Local Farm Fresh' },
  { id: '8', date: '2026-07-15', type: 'expense', scope: 'restaurant', category: 'Rent', amount: 25000, payment_method: 'bank', notes: 'Restaurant rent payment' },
  { id: '9', date: '2026-07-14', type: 'expense', scope: 'restaurant', category: 'Utilities', subcategory: 'Electric', amount: 8400, payment_method: 'bank', notes: 'Electricity bill' },
  { id: '10', date: '2026-07-13', type: 'expense', scope: 'restaurant', category: 'Maintenance', amount: 4500, payment_method: 'upi', notes: 'Kitchen chimney service' },
  
  // Personal Income
  { id: '11', date: '2026-07-01', type: 'income', scope: 'personal', category: 'Owner Draw', amount: 45000, payment_method: 'bank', notes: 'Monthly salary draw' },
  { id: '12', date: '2026-07-10', type: 'income', scope: 'personal', category: 'Other', amount: 2500, payment_method: 'bank', notes: 'Mutual fund dividend payout' },

  // Personal Expenses (Baby/Market/Medical/Electric/Maintenance)
  { id: '13', date: '2026-07-17', type: 'expense', scope: 'personal', category: 'Market', amount: 3800, payment_method: 'upi', notes: 'Family weekly grocer run' },
  { id: '14', date: '2026-07-15', type: 'expense', scope: 'personal', category: 'Medical', amount: 750, payment_method: 'cash', notes: 'Pharmacy prescription' },
  { id: '15', date: '2026-07-12', type: 'expense', scope: 'personal', category: 'Baby', amount: 2200, payment_method: 'card', notes: 'Baby diapers and milk formula' },
  { id: '16', date: '2026-07-10', type: 'expense', scope: 'personal', category: 'Electric', amount: 1800, payment_method: 'upi', notes: 'Home electric bill' },
  { id: '17', date: '2026-07-08', type: 'expense', scope: 'personal', category: 'Maintenance', amount: 3000, payment_method: 'cash', notes: 'AC repairing charge' }
];

export const INITIAL_INVENTORY: InventoryItem[] = [
  { id: '1', name: 'Premium Rice', category: 'Grains', opening_stock: 120, closing_stock: 85, min_stock: 30, unit: 'kg', cost_per_unit: 55 },
  { id: '2', name: 'Fresh Chicken', category: 'Meat', opening_stock: 45, closing_stock: 12, min_stock: 15, unit: 'kg', cost_per_unit: 180 },
  { id: '3', name: 'Refined Oil', category: 'Liquids', opening_stock: 80, closing_stock: 65, min_stock: 20, unit: 'liters', cost_per_unit: 140 },
  { id: '4', name: 'Fresh Fish', category: 'Meat', opening_stock: 25, closing_stock: 8, min_stock: 10, unit: 'kg', cost_per_unit: 260 },
  { id: '5', name: 'Takeaway Boxes', category: 'Packaging', opening_stock: 500, closing_stock: 420, min_stock: 100, unit: 'pcs', cost_per_unit: 4.50 }
];

export const INITIAL_VENDORS: Vendor[] = [
  { id: '1', name: 'Egra Poultry Center', phone: '9845012345', email: 'poultry@egra.com', outstanding: 12500, last_purchase: '2026-07-17', rating: 4.8 },
  { id: '2', name: 'Local Farm Fresh', phone: '9739023456', email: 'veggies@egra.com', outstanding: 0, last_purchase: '2026-07-16', rating: 4.5 },
  { id: '3', name: 'Aditya Grocers Wholesale', phone: '9645034567', email: 'wholesale@aditya.com', outstanding: 34000, last_purchase: '2026-07-12', rating: 4.2 }
];

export const INITIAL_EMPLOYEES: Employee[] = [
  { id: '1', name: 'Subrata Dey', role: 'Head Chef', salary: 28000, salary_due: 0, attendance: 95 },
  { id: '2', name: 'Mintu Bag', role: 'Kitchen Helper', salary: 14000, salary_due: 0, attendance: 90 },
  { id: '3', name: 'Prasenjit Das', role: 'Delivery Boy', salary: 12000, salary_due: 4500, attendance: 88 }
];

export const INITIAL_ASSETS: Asset[] = [
  { id: '1', name: 'Kitchen Chimney & Exhaust', purchase_value: 45000, current_value: 38000, depreciation: 7000 },
  { id: '2', name: 'Commercial Refrigerator', purchase_value: 35000, current_value: 29000, depreciation: 6000 },
  { id: '3', name: 'Delivery Bike', purchase_value: 85000, current_value: 70000, depreciation: 15000 }
];


export const INITIAL_BUDGETS: Budget[] = [
  { id: '1', category: 'Expense', amount: 80000, spent: 68400 },
  { id: '2', category: 'Rent', amount: 25000, spent: 25000 },
  { id: '3', category: 'Maintenance', amount: 15000, spent: 12500 },
  { id: '4', category: 'Utilities', amount: 20000, spent: 16800 }
];
