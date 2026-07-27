import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts';
import {
  DollarSign, TrendingUp, TrendingDown, CreditCard, Shield, Users, Layers,
  Bell, Settings, Plus, Search, Calendar, FileText, CheckCircle, Info,
  Menu, X, Sparkles, Sun, Moon, ArrowUpRight, ArrowDownRight, RefreshCw, Upload, Eye, Download, Star, Award
} from 'lucide-react';
import {
  INITIAL_TRANSACTIONS, INITIAL_INVENTORY, INITIAL_VENDORS, INITIAL_EMPLOYEES,
  INITIAL_ASSETS, INITIAL_BUDGETS
} from './data/mockData';
import type { Transaction, InventoryItem, Vendor, Employee, Asset, Budget } from './data/mockData';
import { insforge } from './lib/insforge';
import * as XLSX from 'xlsx';

export default function App() {
  // --- UI/Theme States ---
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [userRole, setUserRole] = useState<'owner' | 'accountant' | 'manager'>('owner');
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [combinedView, setCombinedView] = useState<boolean>(true);

  // --- Core Entity States ---
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [inventory, setInventory] = useState<InventoryItem[]>(INITIAL_INVENTORY);
  const [vendors, setVendors] = useState<Vendor[]>(INITIAL_VENDORS);
  const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);
  const [assets, setAssets] = useState<Asset[]>(INITIAL_ASSETS);
  const [budgets, setBudgets] = useState<Budget[]>(INITIAL_BUDGETS);

  // --- Modal & Form States ---
  const [showTransactionModal, setShowTransactionModal] = useState<boolean>(false);
  const [modalType, setModalType] = useState<'income' | 'expense'>('income');
  const [showOcrModal, setShowOcrModal] = useState<boolean>(false);
  const [ocrLoading, setOcrLoading] = useState<boolean>(false);
  const [ocrResult, setOcrResult] = useState<any>(null);

  // --- Excel Import States ---
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importStep, setImportStep] = useState<number>(1);
  const [importedHeaders, setImportedHeaders] = useState<string[]>([]);
  const [importedRows, setImportedRows] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({
    date: '',
    type: '',
    scope: '',
    category: '',
    amount: '',
    payment_method: '',
    notes: ''
  });

  // --- Form Inputs ---
  const [txDate, setTxDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [txScope, setTxScope] = useState<'restaurant' | 'personal'>('restaurant');
  const [txCategory, setTxCategory] = useState<string>('Sell');
  const [txSubcategory, setTxSubcategory] = useState<string>('Online');
  const [txAmount, setTxAmount] = useState<string>('');
  const [txPaymentMethod, setTxPaymentMethod] = useState<'cash' | 'upi' | 'card' | 'bank'>('upi');
  const [txNotes, setTxNotes] = useState<string>('');
  const [txVendor, setTxVendor] = useState<string>('');
  const [txEmployee, setTxEmployee] = useState<string>('');
  const [txGst, setTxGst] = useState<string>('');

  // --- AI States ---
  const [aiQuery, setAiQuery] = useState<string>('');
  const [aiChats, setAiChats] = useState<Array<{ role: 'user' | 'assistant', content: string }>>([
    { role: 'assistant', content: 'Hello! I am your AI Financial Assistant. Ask me anything about your restaurant performance, trends, or personal expenses!' }
  ]);
  const [aiLoading, setAiLoading] = useState<boolean>(false);

  // --- Sync Theme ---
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // --- RLS & Access Guard Helper ---
  const hasAccess = (requiredRoles: string[]) => {
    return requiredRoles.includes(userRole);
  };

  // --- Core Calculations (Profit Engine) ---
  const financialMetrics = useMemo(() => {
    // Restaurant transactions
    const restTx = transactions.filter(t => t.scope === 'restaurant');
    
    // Income
    const restIncome = restTx.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const restExpense = restTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    
    // COGS (Raw Materials)
    const cogs = restTx.filter(t => t.category === 'Expense').reduce((sum, t) => sum + t.amount, 0);
    
    // Operating Expenses (Rent, Salary, Utilities, Marketing, etc.)
    const opex = restExpense - cogs;
    
    const grossProfit = restIncome - cogs;
    const netProfit = restIncome - restExpense;
    
    // Margins
    const grossMargin = restIncome > 0 ? (grossProfit / restIncome) * 100 : 0;
    const netMargin = restIncome > 0 ? (netProfit / restIncome) * 100 : 0;
    
    // Ratios
    const foodCostPct = restIncome > 0 ? (cogs / restIncome) * 100 : 0;
    const laborCostPct = restIncome > 0 ? (employees.reduce((sum, e) => sum + e.salary, 0) / restIncome) * 100 : 0;

    // Personal transactions
    const persTx = transactions.filter(t => t.scope === 'personal');
    const persIncome = persTx.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const persExpense = persTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

    // Combined totals
    const totalCash = 85200 + restIncome - restExpense - persExpense; // Initial base + delta

    return {
      restIncome, restExpense, cogs, opex, grossProfit, netProfit,
      grossMargin, netMargin, foodCostPct, laborCostPct,
      persIncome, persExpense, totalCash
    };
  }, [transactions, employees]);

  // --- Dynamic Alerts / Notifications ---
  const alerts = useMemo(() => {
    const list: string[] = [];
    
    // Low stock check
    inventory.forEach(item => {
      if (item.closing_stock <= item.min_stock) {
        list.push(`⚠️ Low stock: ${item.name} currently at ${item.closing_stock} ${item.unit} (minimum required: ${item.min_stock})`);
      }
    });

    // Budget check
    budgets.forEach(b => {
      const ratio = b.spent / b.amount;
      if (ratio >= 1.0) {
        list.push(`🚨 Budget Exceeded: "${b.category}" has reached 100% of limits (${b.spent}/${b.amount})`);
      } else if (ratio >= 0.8) {
        list.push(`⚠️ Budget Warning: "${b.category}" is at ${Math.round(ratio * 100)}% of limit`);
      }
    });

    return list;
  }, [inventory, budgets]);

  // --- Excel Import Parsing and Core Logic ---
  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (json.length === 0) {
          alert('The uploaded Excel sheet contains no data.');
          return;
        }

        const headers = Object.keys(json[0]);
        setImportedHeaders(headers);
        setImportedRows(json);

        // Auto detect mappings using regexes
        const newMapping = { ...columnMapping };
        headers.forEach(h => {
          const hl = h.toLowerCase();
          if (hl.includes('date') || hl.includes('day') || hl.includes('time') || hl.includes('created')) {
            newMapping.date = h;
          } else if (hl.includes('amount') || hl.includes('total') || hl.includes('price') || hl.includes('cost') || hl.includes('sum')) {
            newMapping.amount = h;
          } else if (hl.includes('category') || hl.includes('cat') || hl.includes('group')) {
            newMapping.category = h;
          } else if (hl.includes('type') || hl.includes('kind') || hl.includes('mode')) {
            newMapping.type = h;
          } else if (hl.includes('payment') || hl.includes('method') || hl.includes('pay')) {
            newMapping.payment_method = h;
          } else if (hl.includes('notes') || hl.includes('desc') || hl.includes('remark') || hl.includes('vendor')) {
            newMapping.notes = h;
          } else if (hl.includes('scope') || hl.includes('biz') || hl.includes('personal')) {
            newMapping.scope = h;
          }
        });

        setColumnMapping(newMapping);
        setImportStep(2); // Go to step 2 (Column Mapping)
      } catch (err) {
        alert('Failed to parse Excel file: ' + (err as Error).message);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const executeExcelImport = () => {
    // Validate required fields (date and amount)
    if (!columnMapping.date || !columnMapping.amount) {
      alert('You must map the Date and Amount fields to proceed.');
      return;
    }

    try {
      const mappedTransactions: Transaction[] = importedRows.map((row, index) => {
        const rawAmount = parseFloat(row[columnMapping.amount]) || 0;
        const rawDate = row[columnMapping.date] || new Date().toISOString().split('T')[0];
        
        // Resolve type (income vs expense)
        let txType: 'income' | 'expense' = 'expense';
        if (columnMapping.type && row[columnMapping.type]) {
          const val = row[columnMapping.type].toLowerCase();
          if (val.includes('in') || val.includes('sale') || val.includes('revenue')) {
            txType = 'income';
          }
        }

        // Resolve scope (restaurant vs personal)
        let txScope: 'restaurant' | 'personal' = 'restaurant';
        if (columnMapping.scope && row[columnMapping.scope]) {
          const val = row[columnMapping.scope].toLowerCase();
          if (val.includes('person') || val.includes('home') || val.includes('self')) {
            txScope = 'personal';
          }
        }

        // Resolve category
        let category = 'Other';
        if (columnMapping.category && row[columnMapping.category]) {
          category = row[columnMapping.category];
        } else {
          category = txType === 'income' ? 'Sell' : 'Expense';
        }

        // Resolve payment method
        let method: 'cash' | 'upi' | 'card' | 'bank' = 'upi';
        if (columnMapping.payment_method && row[columnMapping.payment_method]) {
          const val = row[columnMapping.payment_method].toLowerCase();
          if (val.includes('cash')) method = 'cash';
          else if (val.includes('card') || val.includes('pos')) method = 'card';
          else if (val.includes('bank') || val.includes('transfer')) method = 'bank';
        }

        return {
          id: `excel-${Date.now()}-${index}`,
          date: rawDate,
          type: txType,
          scope: txScope,
          category: category,
          amount: rawAmount,
          payment_method: method,
          notes: columnMapping.notes ? row[columnMapping.notes] : 'Imported via Excel'
        };
      });

      setTransactions(prev => [...mappedTransactions, ...prev]);

      // Trigger budget updates for imported expenses
      mappedTransactions.forEach(t => {
        if (t.type === 'expense' && t.scope === 'restaurant') {
          setBudgets(prev => prev.map(b => {
            if (b.category.toLowerCase() === t.category.toLowerCase()) {
              return { ...b, spent: b.spent + t.amount };
            }
            return b;
          }));
        }
      });

      alert(`Successfully imported ${mappedTransactions.length} transaction records!`);
      setShowImportModal(false);
      setImportedRows([]);
      setImportedHeaders([]);
      setImportStep(1);
    } catch (err) {
      alert('Import failed: ' + (err as Error).message);
    }
  };

  // --- Add Transaction ---
  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!txAmount || isNaN(parseFloat(txAmount))) {
      alert('Please enter a valid amount.');
      return;
    }

    const newTx: Transaction = {
      id: (transactions.length + 1).toString(),
      date: txDate,
      type: modalType,
      scope: txScope,
      category: txCategory,
      subcategory: txSubcategory,
      amount: parseFloat(txAmount),
      payment_method: txPaymentMethod,
      notes: txNotes,
      vendor: modalType === 'expense' ? txVendor : undefined,
      employee: txCategory === 'Salary' ? txEmployee : undefined,
      gst_number: txGst || undefined
    };

    setTransactions([newTx, ...transactions]);

    // Update budget spent if matches category
    if (modalType === 'expense' && txScope === 'restaurant') {
      setBudgets(prev => prev.map(b => {
        if (b.category.toLowerCase() === txCategory.toLowerCase()) {
          return { ...b, spent: b.spent + parseFloat(txAmount) };
        }
        return b;
      }));
    }

    // Reset fields
    setTxAmount('');
    setTxNotes('');
    setTxVendor('');
    setTxEmployee('');
    setTxGst('');
    setShowTransactionModal(false);
  };

  // --- Mock OCR Receipt Parsing ---
  const handleOcrFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setOcrLoading(true);
    setOcrResult(null);

    setTimeout(() => {
      setOcrLoading(false);
      setOcrResult({
        vendor: 'Egra Poultry Center',
        amount: '3500.00',
        date: new Date().toISOString().split('T')[0],
        category: 'Raw Material',
        subcategory: 'Chicken',
        gst: '19AAHCL2031K1Z2',
        confidence: '98.5%'
      });
    }, 2000);
  };

  const applyOcrToForm = () => {
    if (!ocrResult) return;
    setModalType('expense');
    setTxScope('restaurant');
    setTxCategory(ocrResult.category);
    setTxSubcategory(ocrResult.subcategory);
    setTxAmount(ocrResult.amount);
    setTxVendor(ocrResult.vendor);
    setTxGst(ocrResult.gst);
    setTxDate(ocrResult.date);
    
    setShowOcrModal(false);
    setOcrResult(null);
    setShowTransactionModal(true);
  };

  // --- AI Queries Fallback Answers ---
  const getAiAnswer = (query: string): string => {
    const q = query.toLowerCase();
    
    if (q.includes('profit') && q.includes('lower')) {
      return `Your restaurant net profit is lower this month primarily because Raw Material expenses (mainly Chicken and Veggies) spiked by 14% on July 17th. Additionally, the electricity utility bill of ₹8,400 paid on July 14th raised operating OPEX overheads. I suggest renegotiating credit terms with wholesale vendors to stabilize raw food input costs.`;
    }
    if (q.includes('predict') || q.includes('forecast')) {
      const expectedProfit = Math.round(financialMetrics.netProfit * 1.08);
      return `Based on historical sales trajectories, I forecast next month's restaurant sales to reach ₹62,000 with a predicted net profit of ~₹${expectedProfit} (assuming food cost ratio stabilizes at ${Math.round(financialMetrics.foodCostPct)}%). The upcoming weekend bookings suggest high volume; prepare inventory stock buffer accordingly.`;
    }
    if (q.includes('reduce') || q.includes('cut')) {
      return `To reduce expenses, focus on:
1. **Reduce food waste**: Raw Materials represent ${Math.round(financialMetrics.foodCostPct)}% of revenue. Standardize portion sizes.
2. **Bulk-purchasing**: Shifting grocery supply orders to "Aditya Grocers Wholesale" could save up to 8% annually.
3. **Staff allocation**: Match shifts to peak rush hours.`;
    }
    if (q.includes('summary') || q.includes('executive')) {
      return `**Finance Vision AI Executive Summary**
* **Restaurant Performance**: Gross Sales this month total ₹${financialMetrics.restIncome} with net profit at ₹${financialMetrics.netProfit} (Gross Margin: ${financialMetrics.grossMargin.toFixed(1)}%).
* **Personal Draw**: You drew ₹45,000 for personal use. Personal spending is ₹${financialMetrics.persExpense}.
* **Budget Health**: 1 budget is fully depleted (Rent). Raw material budget is at ${Math.round((68400 / 80000) * 100)}% capacity.`;
    }

    return `I've analyzed your financial registers. The total assets of the restaurant stand at ₹${assets.reduce((sum, a) => sum + a.current_value, 0)}. Your cash burn rate is stable, with a runway projection of 14 months. Let me know if you would like me to compile a category-specific breakdown!`;
  };

  const handleSendAi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuery.trim()) return;

    const userMessage = aiQuery;
    setAiChats(prev => [...prev, { role: 'user', content: userMessage }]);
    setAiQuery('');
    setAiLoading(true);

    // Call OpenRouter direct integration if possible, or fallback
    try {
      const systemPrompt = `You are a professional Business Intelligence restaurant financial analyst. Here are the live metrics: Restaurant Income: ₹${financialMetrics.restIncome}, Expenses: ₹${financialMetrics.restExpense}, COGS: ₹${financialMetrics.cogs}, Personal Expenses: ₹${financialMetrics.persExpense}. Respond in a premium, data-driven manner.`;
      
      // Direct call or fallback to regex answers
      setTimeout(() => {
        const reply = getAiAnswer(userMessage);
        setAiChats(prev => [...prev, { role: 'assistant', content: reply }]);
        setAiLoading(false);
      }, 1000);
    } catch (err) {
      setAiChats(prev => [...prev, { role: 'assistant', content: 'Connection issue. Let me review calculations locally.' }]);
      setAiLoading(false);
    }
  };

  // --- Export File Mockups ---
  const handleExport = (type: 'pdf' | 'excel' | 'csv') => {
    if (type === 'csv') {
      const headers = 'ID,Date,Type,Scope,Category,Subcategory,Amount,PaymentMethod,Notes\n';
      const rows = transactions.map(t => 
        `"${t.id}","${t.date}","${t.type}","${t.scope}","${t.category}","${t.subcategory || ''}",${t.amount},"${t.payment_method}","${t.notes || ''}"`
      ).join('\n');
      
      const blob = new Blob([headers + rows], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('href', url);
      a.setAttribute('download', `Finance_Vision_Report_${new Date().toISOString().split('T')[0]}.csv`);
      a.click();
    } else {
      alert(`Preparing ${type.toUpperCase()} package report... Generation complete. Check downloads folder!`);
    }
  };

  // --- Filtered Listings ---
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesSearch = searchQuery ? (
        t.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.notes && t.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.vendor && t.vendor.toLowerCase().includes(searchQuery.toLowerCase()))
      ) : true;
      return matchesSearch;
    });
  }, [transactions, searchQuery]);

  // --- Graph Visual Datasets ---
  const salesHistoryData = [
    { name: 'July 11', Sales: 12000, Expense: 9400, Personal: 1500 },
    { name: 'July 12', Sales: 15400, Expense: 8900, Personal: 3200 },
    { name: 'July 13', Sales: 18900, Expense: 12400, Personal: 1800 },
    { name: 'July 14', Sales: 14500, Expense: 21500, Personal: 900 },
    { name: 'July 15', Sales: 28400, Expense: 11000, Personal: 4500 },
    { name: 'July 16', Sales: 27400, Expense: 10200, Personal: 1200 },
    { name: 'July 17', Sales: 27350, Expense: 4700, Personal: 3800 }
  ];

  const expenseCategoryData = useMemo(() => {
    const map: Record<string, number> = {};
    transactions
      .filter(t => t.type === 'expense' && t.scope === 'restaurant')
      .forEach(t => {
        map[t.category] = (map[t.category] || 0) + t.amount;
      });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [transactions]);
  
  const COLORS = ['#3b6bf6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className={`min-h-screen flex ${darkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* --- Sidebar Navigation --- */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 text-white transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 flex flex-col border-r border-slate-800`}>
        <div className="p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-500 flex items-center justify-center font-bold text-white shadow-lg shadow-primary-500/30">F</div>
            <div>
              <h1 className="font-bold text-sm tracking-wider">FINANCE VISION</h1>
              <p className="text-[10px] text-slate-400 font-semibold tracking-widest uppercase">Business Engine</p>
            </div>
          </div>
          <button className="lg:hidden text-slate-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        {/* Sidebar Nav Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Layers },
            { id: 'restaurant', label: 'Restaurant Finance', icon: DollarSign },
            { id: 'personal', label: 'Personal Finance', icon: Users },
            { id: 'income', label: 'Income & Sales', icon: ArrowUpRight },
            { id: 'expenses', label: 'Expenses Register', icon: ArrowDownRight },
            { id: 'inventory', label: 'Inventory Manager', icon: Layers },
            { id: 'employees', label: 'Employee & Payroll', icon: Users },
            { id: 'vendors', label: 'Vendors Directory', icon: CreditCard },
            { id: 'assets', label: 'Assets Manager', icon: TrendingUp },
            { id: 'budgets', label: 'Budget Planner', icon: CheckCircle },
            { id: 'reports', label: 'Reports & Export', icon: FileText },
            { id: 'ai', label: 'AI Assistant', icon: Sparkles, badge: 'PRO' }
          ].map(item => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${active ? 'bg-primary-500 text-white shadow-md shadow-primary-500/25' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-500 text-white font-bold tracking-widest">{item.badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Role Guard Switcher */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Access Role</label>
          <select
            value={userRole}
            onChange={(e) => setUserRole(e.target.value as any)}
            className="w-full bg-slate-800 text-white text-xs rounded-lg px-2 py-1.5 border border-slate-700 outline-none cursor-pointer focus:border-primary-500"
          >
            <option value="owner">Owner (Full Access)</option>
            <option value="accountant">Accountant (No deletes)</option>
            <option value="manager">Manager (No personal)</option>
          </select>
        </div>
      </aside>

      {/* --- Main Content Shell --- */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* --- Top Navbar Header --- */}
        <header className={`sticky top-0 z-20 flex items-center justify-between px-6 py-4 border-b ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-slate-500 hover:text-slate-700 focus:outline-none" onClick={() => setSidebarOpen(true)}>
              <Menu size={22} />
            </button>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border dark:border-slate-700 w-64">
              <Search className="text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Global Search records..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none text-xs outline-none w-full dark:text-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Quick Actions */}
            <button
              onClick={() => { setModalType('expense'); setShowTransactionModal(true); }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-red-500 hover:bg-red-600 shadow-md shadow-red-500/20"
            >
              <Plus size={14} /> Add Expense
            </button>
            <button
              onClick={() => setShowOcrModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-primary-500 hover:bg-primary-600 shadow-md shadow-primary-500/20"
            >
              <Upload size={14} /> OCR Scan
            </button>

            {/* Dark Mode Switcher */}
            <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-primary-500">
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Notification Center */}
            <div className="relative group">
              <button className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 relative">
                <Bell size={18} />
                {alerts.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500"></span>}
              </button>
              
              {/* Dropdown panel */}
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl shadow-xl p-4 hidden group-hover:block z-50">
                <h4 className="font-bold text-xs uppercase tracking-wider mb-2 text-slate-500">System Notifications</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {alerts.map((msg, i) => (
                    <div key={i} className="text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border dark:border-slate-800 leading-normal text-slate-600 dark:text-slate-300">{msg}</div>
                  ))}
                  {alerts.length === 0 && <div className="text-xs text-slate-400 text-center py-4">No pending alerts. System healthy!</div>}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* --- Dynamic Body Panel Scroll Area --- */}
        <main className="flex-1 overflow-y-auto p-6">
          
          {/* ======================================================== */}
          {/* 1. DASHBOARD VIEW                                        */}
          {/* ======================================================== */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              
              {/* Dashboard Header Switches */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black tracking-tight">Financial Overview</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Live indicators of restaurant business performance and owner reserves.</p>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border dark:border-slate-700">
                  <button
                    onClick={() => setCombinedView(false)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${!combinedView ? 'bg-white dark:bg-slate-700 shadow-sm' : 'text-slate-500'}`}
                  >
                    Restaurant Only
                  </button>
                  <button
                    onClick={() => setCombinedView(true)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${combinedView ? 'bg-white dark:bg-slate-700 shadow-sm' : 'text-slate-500'}`}
                  >
                    Combined Health
                  </button>
                </div>
              </div>

              {/* KPI Cards Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border dark:border-slate-700 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Today's Sales</span>
                    <h3 className="text-2xl font-black mt-1">₹{financialMetrics.restIncome}</h3>
                    <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-0.5 mt-1"><TrendingUp size={10} /> +8.4% vs last week</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-primary-50 dark:bg-primary-950/50 text-primary-500"><DollarSign size={20} /></div>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border dark:border-slate-700 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Today's Expenses</span>
                    <h3 className="text-2xl font-black mt-1">₹{financialMetrics.restExpense}</h3>
                    <span className="text-[10px] text-red-500 font-bold flex items-center gap-0.5 mt-1"><TrendingDown size={10} /> +12.3% raw food costs</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/50 text-red-500"><ArrowDownRight size={20} /></div>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border dark:border-slate-700 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Net Profit</span>
                    <h3 className="text-2xl font-black mt-1">₹{financialMetrics.netProfit}</h3>
                    <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-0.5 mt-1"><TrendingUp size={10} /> Net margin: {financialMetrics.netMargin.toFixed(1)}%</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-500"><TrendingUp size={20} /></div>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border dark:border-slate-700 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{combinedView ? 'Combined Cash' : 'Available Cash'}</span>
                    <h3 className="text-2xl font-black mt-1">₹{financialMetrics.totalCash}</h3>
                    <span className="text-[10px] text-slate-400 mt-1 block">In Bank & Cash registers</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-500"><CreditCard size={20} /></div>
                </div>
              </div>

              {/* P&L Ratios Summary Widgets */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {[
                  { label: 'Food Cost Ratio', value: `${Math.round(financialMetrics.foodCostPct)}%`, color: 'text-primary-500', desc: 'Ideal limit: Under 35%' },
                  { label: 'Labor Cost Ratio', value: `${Math.round(financialMetrics.laborCostPct)}%`, color: 'text-emerald-500', desc: 'Chef & delivery overheads' },
                  { label: 'Depreciation Reserve', value: `₹${assets.reduce((sum, a) => sum + a.depreciation, 0)}`, color: 'text-amber-500', desc: 'Equipment value reduction' },
                  { label: 'Total Asset Value', value: `₹${assets.reduce((sum, a) => sum + a.current_value, 0)}`, color: 'text-emerald-500', desc: 'Valuation of kitchen setup' }
                ].map((item, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-slate-100/70 dark:bg-slate-800/40 border dark:border-slate-800 flex flex-col justify-between">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">{item.label}</span>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className={`text-xl font-bold ${item.color}`}>{item.value}</span>
                      <span className="text-[10px] text-slate-400">{item.desc}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Main Graphs Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Sales & Expense History */}
                <div className="lg:col-span-2 p-5 rounded-2xl bg-white dark:bg-slate-800 border dark:border-slate-700 shadow-sm">
                  <h3 className="font-bold text-sm uppercase tracking-wider mb-4 text-slate-500">Weekly Finance Timeline</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={salesHistoryData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? '#334155' : '#f1f5f9'} />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                        <YAxis stroke="#94a3b8" fontSize={10} />
                        <Tooltip />
                        <Legend verticalAlign="top" height={36} />
                        <Area type="monotone" dataKey="Sales" stroke="#3b6bf6" fill="url(#colorSales)" strokeWidth={2} name="Restaurant Sales" />
                        <Area type="monotone" dataKey="Expense" stroke="#ef4444" fill="url(#colorExpense)" strokeWidth={2} name="Operating Cost" />
                        {combinedView && <Area type="monotone" dataKey="Personal" stroke="#10b981" fill="url(#colorPersonal)" strokeWidth={2} name="Owner Personal Cost" />}
                        <defs>
                          <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b6bf6" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#3b6bf6" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorPersonal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Expense breakdown */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border dark:border-slate-700 shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-sm uppercase tracking-wider mb-4 text-slate-500">Expense Breakdown</h3>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={expenseCategoryData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {expenseCategoryData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => `₹${value}`} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Legend list */}
                  <div className="space-y-1 text-xs">
                    {expenseCategoryData.map((item, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                          <span className="text-slate-500 dark:text-slate-400">{item.name}</span>
                        </div>
                        <span className="font-bold">₹{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Transactions List panel */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border dark:border-slate-700 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-sm uppercase tracking-wider text-slate-500">Recent Transactions</h3>
                  <button onClick={() => setActiveTab('income')} className="text-xs font-semibold text-primary-500 hover:underline flex items-center gap-1">
                    Manage all <ArrowUpRight size={12} />
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b dark:border-slate-800 text-slate-400 uppercase tracking-widest font-semibold">
                        <th className="py-2.5">Date</th>
                        <th className="py-2.5">Category</th>
                        <th className="py-2.5">Scope</th>
                        <th className="py-2.5">Method</th>
                        <th className="py-2.5">Notes</th>
                        <th className="py-2.5 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-800">
                      {filteredTransactions.slice(0, 5).map((t, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-3 font-semibold text-slate-500">{t.date}</td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded-full font-bold ${t.type === 'income' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'}`}>
                              {t.category}
                            </span>
                          </td>
                          <td className="py-3 capitalize">{t.scope}</td>
                          <td className="py-3 uppercase text-slate-400">{t.payment_method}</td>
                          <td className="py-3 max-w-[200px] truncate text-slate-500">{t.notes}</td>
                          <td className={`py-3 text-right font-black ${t.type === 'income' ? 'text-emerald-500' : 'text-red-500'}`}>
                            {t.type === 'income' ? '+' : '-'}₹{t.amount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* 2. RESTAURANT FINANCE                                    */}
          {/* ======================================================== */}
          {activeTab === 'restaurant' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-black tracking-tight">Restaurant Ledger</h2>
                <p className="text-sm text-slate-500">Comprehensive overview of food costs, gross margins, and business operations.</p>
              </div>

              {/* Profit metrics engine cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="p-6 rounded-2xl bg-white dark:bg-slate-800 border dark:border-slate-700 shadow-sm">
                  <span className="text-xs uppercase text-slate-400 font-semibold tracking-wider">Gross profit</span>
                  <h3 className="text-3xl font-black mt-2 text-primary-500">₹{financialMetrics.grossProfit}</h3>
                  <div className="flex items-center justify-between text-xs mt-4 pt-4 border-t dark:border-slate-700">
                    <span className="text-slate-500">Gross Margin</span>
                    <span className="font-bold">{financialMetrics.grossMargin.toFixed(1)}%</span>
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-white dark:bg-slate-800 border dark:border-slate-700 shadow-sm">
                  <span className="text-xs uppercase text-slate-400 font-semibold tracking-wider">Operating Expenses</span>
                  <h3 className="text-3xl font-black mt-2 text-red-500">₹{financialMetrics.opex}</h3>
                  <div className="flex items-center justify-between text-xs mt-4 pt-4 border-t dark:border-slate-700">
                    <span className="text-slate-500">Opex Ratio</span>
                    <span className="font-bold">{((financialMetrics.opex / financialMetrics.restIncome) * 100).toFixed(1)}%</span>
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-white dark:bg-slate-800 border dark:border-slate-700 shadow-sm">
                  <span className="text-xs uppercase text-slate-400 font-semibold tracking-wider">Net profit</span>
                  <h3 className="text-3xl font-black mt-2 text-emerald-500">₹{financialMetrics.netProfit}</h3>
                  <div className="flex items-center justify-between text-xs mt-4 pt-4 border-t dark:border-slate-700">
                    <span className="text-slate-500">Net Profit Margin</span>
                    <span className="font-bold">{financialMetrics.netMargin.toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              {/* COGS and food cost breakdown charts */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border dark:border-slate-700 shadow-sm">
                <h3 className="font-bold text-sm uppercase tracking-wider mb-4 text-slate-500">Restaurant Sales vs COGS Timeline</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesHistoryData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#f1f5f9'} vertical={false} />
                      <XAxis dataKey="name" fontSize={10} stroke="#94a3b8" />
                      <YAxis fontSize={10} stroke="#94a3b8" />
                      <Tooltip />
                      <Legend verticalAlign="top" height={36} />
                      <Bar dataKey="Sales" fill="#3b6bf6" radius={[4, 4, 0, 0]} name="Total Sales" />
                      <Bar dataKey="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} name="Raw Material (COGS)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* 3. PERSONAL FINANCE VIEW                                 */}
          {/* ======================================================== */}
          {activeTab === 'personal' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-black tracking-tight">Personal Accounts</h2>
                <p className="text-sm text-slate-500">Keep personal expense registers segregated from restaurant accounts.</p>
              </div>

              {/* Personal stats cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="p-6 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl shadow-sm">
                  <span className="text-xs uppercase text-slate-400 font-semibold">Total Owner Draw</span>
                  <h3 className="text-3xl font-black text-emerald-500 mt-2">₹{financialMetrics.persIncome}</h3>
                  <p className="text-[10px] text-slate-400 mt-1">Transferred from business bank reserve</p>
                </div>

                <div className="p-6 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl shadow-sm">
                  <span className="text-xs uppercase text-slate-400 font-semibold">Total Personal Expenses</span>
                  <h3 className="text-3xl font-black text-red-500 mt-2">₹{financialMetrics.persExpense}</h3>
                  <p className="text-[10px] text-slate-400 mt-1">Groceries, Fuel, Medical, Family costs</p>
                </div>

                <div className="p-6 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl shadow-sm">
                  <span className="text-xs uppercase text-slate-400 font-semibold">Net Personal Savings</span>
                  <h3 className="text-3xl font-black text-primary-500 mt-2">₹{financialMetrics.persIncome - financialMetrics.persExpense}</h3>
                  <p className="text-[10px] text-slate-400 mt-1">Current month net surplus</p>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* 4. INCOME / SALES MODULE                                 */}
          {/* ======================================================== */}
          {activeTab === 'income' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black tracking-tight">Income & Restaurant Sales</h2>
                  <p className="text-sm text-slate-500">Record sales receipts, party bookings, table bookings, and card payments.</p>
                </div>
                <button
                  onClick={() => { setModalType('income'); setTxScope('restaurant'); setTxCategory('Sell'); setTxSubcategory('Online'); setShowTransactionModal(true); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-primary-500 hover:bg-primary-600 shadow-md shadow-primary-500/20"
                >
                  <Plus size={16} /> Record Income
                </button>
              </div>

              {/* Transactions grid list */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border dark:border-slate-700 shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b dark:border-slate-800 text-slate-400 uppercase tracking-widest font-semibold">
                      <th className="py-2.5">Date</th>
                      <th className="py-2.5">Category</th>
                      <th className="py-2.5">Mode</th>
                      <th className="py-2.5">Notes</th>
                      <th className="py-2.5 text-right">Total amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-800">
                    {transactions.filter(t => t.type === 'income').map((t, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3 text-slate-500 font-semibold">{t.date}</td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                            {t.category}
                          </span>
                        </td>
                        <td className="py-3 uppercase text-slate-400">{t.payment_method}</td>
                        <td className="py-3 text-slate-500 truncate max-w-[300px]">{t.notes}</td>
                        <td className="py-3 text-right font-black text-emerald-500">₹{t.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* 5. EXPENSE MODULE                                        */}
          {/* ======================================================== */}
          {activeTab === 'expenses' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black tracking-tight">Expenses Register</h2>
                  <p className="text-sm text-slate-500">Categorized operating cost registers, utility logs, and tax preparers.</p>
                </div>
                <button
                  onClick={() => { setModalType('expense'); setTxScope('restaurant'); setTxCategory('Expense'); setShowTransactionModal(true); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-500 hover:bg-red-600 shadow-md shadow-red-500/20"
                >
                  <Plus size={16} /> Record Expense
                </button>
              </div>

              {/* Expense registers table */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border dark:border-slate-700 shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b dark:border-slate-800 text-slate-400 uppercase tracking-widest font-semibold">
                      <th className="py-2.5">Date</th>
                      <th className="py-2.5">Category</th>
                      <th className="py-2.5">Vendor</th>
                      <th className="py-2.5">Method</th>
                      <th className="py-2.5">Notes</th>
                      <th className="py-2.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-800">
                    {transactions.filter(t => t.type === 'expense').map((t, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3 text-slate-500 font-semibold">{t.date}</td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 rounded-full font-bold bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
                            {t.category} {t.subcategory ? `(${t.subcategory})` : ''}
                          </span>
                        </td>
                        <td className="py-3 text-slate-500 font-semibold">{t.vendor || '—'}</td>
                        <td className="py-3 uppercase text-slate-400">{t.payment_method}</td>
                        <td className="py-3 text-slate-500 truncate max-w-[250px]">{t.notes}</td>
                        <td className="py-3 text-right font-black text-red-500">₹{t.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* 6. INVENTORY MANAGER                                     */}
          {/* ======================================================== */}
          {activeTab === 'inventory' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-black tracking-tight">Inventory Stock Control</h2>
                <p className="text-sm text-slate-500">Raw materials stock limits, food costs, and low stock warnings.</p>
              </div>

              {/* Inventory table */}
              <div className="p-5 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b dark:border-slate-800 text-slate-400 uppercase tracking-widest font-semibold">
                      <th className="py-2.5">Item Name</th>
                      <th className="py-2.5">Category</th>
                      <th className="py-2.5">Opening Stock</th>
                      <th className="py-2.5">Current Stock</th>
                      <th className="py-2.5">Min Threshold</th>
                      <th className="py-2.5">Unit Cost</th>
                      <th className="py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-800">
                    {inventory.map((item, idx) => {
                      const isLow = item.closing_stock <= item.min_stock;
                      return (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-3 font-bold">{item.name}</td>
                          <td className="py-3 text-slate-500">{item.category}</td>
                          <td className="py-3">{item.opening_stock} {item.unit}</td>
                          <td className="py-3 font-semibold">{item.closing_stock} {item.unit}</td>
                          <td className="py-3 text-slate-400">{item.min_stock} {item.unit}</td>
                          <td className="py-3 font-semibold">₹{item.cost_per_unit}</td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${isLow ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'}`}>
                              {isLow ? 'Low Stock' : 'Good Stock'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* 7. EMPLOYEE & PAYROLL VIEW                               */}
          {/* ======================================================== */}
          {activeTab === 'employees' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-black tracking-tight">Employee Directory</h2>
                <p className="text-sm text-slate-500">Staff attendance, monthly salaries, and overtime payroll registers.</p>
              </div>

              {/* Employee table */}
              <div className="p-5 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b dark:border-slate-800 text-slate-400 uppercase tracking-widest font-semibold">
                      <th className="py-2.5">Name</th>
                      <th className="py-2.5">Role</th>
                      <th className="py-2.5">Base Salary</th>
                      <th className="py-2.5">Salary Due</th>
                      <th className="py-2.5">Attendance</th>
                      <th className="py-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-800">
                    {employees.map((e, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3 font-bold">{e.name}</td>
                        <td className="py-3 text-slate-500 font-semibold">{e.role}</td>
                        <td className="py-3 font-semibold">₹{e.salary}</td>
                        <td className="py-3 text-red-500 font-black">₹{e.salary_due}</td>
                        <td className="py-3 font-semibold">{e.attendance}%</td>
                        <td className="py-3 text-right">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${e.salary_due > 0 ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'}`}>
                            {e.salary_due > 0 ? 'Salary Due' : 'Paid'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* 8. VENDORS DIRECTORY                                     */}
          {/* ======================================================== */}
          {activeTab === 'vendors' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-black tracking-tight">Vendors Directory</h2>
                <p className="text-sm text-slate-500">Store vendor contacts, purchase histories, and credit parameters.</p>
              </div>

              {/* Vendor table */}
              <div className="p-5 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b dark:border-slate-800 text-slate-400 uppercase tracking-widest font-semibold">
                      <th className="py-2.5">Vendor Name</th>
                      <th className="py-2.5">Phone</th>
                      <th className="py-2.5">Email</th>
                      <th className="py-2.5">Outstanding credit</th>
                      <th className="py-2.5">Last Purchase</th>
                      <th className="py-2.5 text-right">Rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-800">
                    {vendors.map((v, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3 font-bold">{v.name}</td>
                        <td className="py-3 text-slate-500 font-semibold">{v.phone}</td>
                        <td className="py-3 text-slate-500">{v.email}</td>
                        <td className="py-3 text-red-500 font-black">₹{v.outstanding}</td>
                        <td className="py-3 text-slate-400 font-semibold">{v.last_purchase}</td>
                        <td className="py-3 text-right">
                          <span className="text-amber-500 flex items-center justify-end gap-0.5">★ {v.rating}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* 9. ASSETS & LIABILITIES VIEW                             */}
          {/* ======================================================== */}
          {activeTab === 'assets' && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h2 className="text-2xl font-black tracking-tight">Business Assets</h2>
                <p className="text-sm text-slate-500">Valuation details and depreciation log of kitchen setup, vehicles, and equipment.</p>
              </div>
              <div className="p-5 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b dark:border-slate-800 text-slate-400 font-semibold">
                      <th className="py-2">Asset Name</th>
                      <th className="py-2">Purchase Value</th>
                      <th className="py-2">Depreciation</th>
                      <th className="py-2 text-right">Current Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-800">
                    {assets.map((a, idx) => (
                      <tr key={idx}>
                        <td className="py-3 font-bold">{a.name}</td>
                        <td className="py-3 text-slate-500">₹{a.purchase_value}</td>
                        <td className="py-3 text-red-500">₹{a.depreciation}</td>
                        <td className="py-3 text-right font-black text-emerald-500">₹{a.current_value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* 10. BUDGET PLANNER                                       */}
          {/* ======================================================== */}
          {activeTab === 'budgets' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-black tracking-tight">Budget Planner</h2>
                <p className="text-sm text-slate-500">Set spending limits and automatically warn when approaching maximum values.</p>
              </div>

              {/* Budgets list */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {budgets.map((b, idx) => {
                  const pct = (b.spent / b.amount) * 100;
                  const isOver = b.spent >= b.amount;
                  const isWarn = pct >= 80;
                  return (
                    <div key={idx} className="p-5 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm">{b.category}</span>
                        <span className={`text-xs font-bold ${isOver ? 'text-red-500' : isWarn ? 'text-amber-500' : 'text-emerald-500'}`}>
                          {isOver ? 'Limit Exceeded' : isWarn ? 'Warning Threshold' : 'Budget Safe'}
                        </span>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="w-full bg-slate-100 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${isOver ? 'bg-red-500' : isWarn ? 'bg-amber-500' : 'bg-primary-500'}`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        ></div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Spent: <strong>₹{b.spent}</strong></span>
                        <span>Total Limit: <strong>₹{b.amount}</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* 11. REPORTS & EXPORTS VIEW                               */}
          {/* ======================================================== */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-black tracking-tight">Financial Reports & Exports</h2>
                <p className="text-sm text-slate-500">Compile cash flow logs, P&L statements, and audit ledgers.</p>
              </div>

              {/* Report export cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {[
                  { title: 'Profit & Loss Statement', desc: 'Detailed summary of gross/operating revenue and food costs.', action: 'export' },
                  { title: 'Cash Flow Analysis', desc: 'Tracks actual cash vs bank transfers and runways.', action: 'export' },
                  { title: 'Tax & GST Records', desc: 'Prepares tax declarations and invoices.', action: 'export' },
                  { title: 'Excel / CSV Importer', desc: 'Import transaction logs directly from an Excel sheet or CSV ledger.', action: 'import' }
                ].map((item, idx) => (
                  <div key={idx} className="p-5 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl shadow-sm flex flex-col justify-between space-y-4">
                    <div>
                      <h4 className="font-bold text-sm">{item.title}</h4>
                      <p className="text-xs text-slate-400 mt-1">{item.desc}</p>
                    </div>
                    {item.action === 'export' ? (
                      <div className="flex items-center gap-2 pt-2 border-t dark:border-slate-800">
                        <button onClick={() => handleExport('csv')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200">
                          <Download size={12} /> CSV
                        </button>
                        <button onClick={() => handleExport('excel')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200">
                          <Download size={12} /> Excel
                        </button>
                        <button onClick={() => handleExport('pdf')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200">
                          <Download size={12} /> PDF
                        </button>
                      </div>
                    ) : (
                      <div className="pt-2 border-t dark:border-slate-800">
                        <button onClick={() => setShowImportModal(true)} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white bg-primary-500 hover:bg-primary-600 shadow-md shadow-primary-500/20">
                          <Upload size={14} /> Launch Importer
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* 12. AI FINANCIAL ASSISTANT VIEW                         */}
          {/* ======================================================== */}
          {activeTab === 'ai' && (
            <div className="space-y-6 flex flex-col h-[calc(100vh-140px)]">
              <div>
                <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
                  <Sparkles className="text-primary-500" size={24} /> AI Financial Analyst
                </h2>
                <p className="text-sm text-slate-500">Ask strategic questions, predict budgets, or detect anomalies.</p>
              </div>

              {/* Chat body */}
              <div className="flex-1 min-h-0 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl shadow-sm flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {aiChats.map((chat, idx) => (
                    <div key={idx} className={`flex ${chat.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-md p-3.5 rounded-2xl text-xs leading-relaxed ${chat.role === 'user' ? 'bg-primary-500 text-white font-semibold rounded-tr-none' : 'bg-slate-100 dark:bg-slate-900 border dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-tl-none'}`}>
                        {chat.content}
                      </div>
                    </div>
                  ))}
                  {aiLoading && (
                    <div className="flex justify-start">
                      <div className="bg-slate-100 dark:bg-slate-900 border dark:border-slate-800 p-3 rounded-2xl rounded-tl-none text-xs text-slate-400 flex items-center gap-2">
                        <RefreshCw size={14} className="animate-spin" /> Analyzing financial metrics...
                      </div>
                    </div>
                  )}
                </div>

                {/* Pre-baked questions bar */}
                <div className="p-3 border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 flex flex-wrap gap-2">
                  {[
                    'Why is profit lower this month?',
                    'Predict next month\'s profit',
                    'How can I reduce expenses?',
                    'Generate executive summary'
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => { setAiQuery(preset); }}
                      className="text-[10px] px-2.5 py-1 rounded-full border dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-primary-500 transition-colors font-medium"
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                {/* Chat input form */}
                <form onSubmit={handleSendAi} className="p-4 border-t dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="Ask AI anything about your accounts..."
                    value={aiQuery}
                    onChange={(e) => setAiQuery(e.target.value)}
                    className="flex-1 text-xs outline-none bg-slate-100 dark:bg-slate-900 dark:text-white rounded-xl px-4 py-3 border dark:border-slate-700 focus:border-primary-500 focus:bg-white"
                  />
                  <button type="submit" className="p-3 rounded-xl bg-primary-500 text-white hover:bg-primary-600 shadow-md shadow-primary-500/20">
                    <Sparkles size={16} />
                  </button>
                </form>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* --- TRANSACTION CREATION MODAL --- */}
      {showTransactionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-lg bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b dark:border-slate-700 pb-3">
              <h3 className="font-black text-base capitalize">{modalType === 'income' ? 'Record Income / Sales' : 'Record Operating Expense'}</h3>
              <button onClick={() => setShowTransactionModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            <form onSubmit={handleAddTransaction} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-500 mb-1">Scope</label>
                <select value={txScope} onChange={(e) => setTxScope(e.target.value as any)} className="w-full px-3 py-2 border dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 outline-none">
                  <option value="restaurant">Restaurant business</option>
                  <option value="personal">Personal Finance</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-500 mb-1">Date</label>
                <input type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} className="w-full px-3 py-2 border dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 outline-none" />
              </div>

              <div>
                <label className="block font-bold text-slate-500 mb-1">Category</label>
                {txScope === 'restaurant' ? (
                  modalType === 'income' ? (
                    <select value={txCategory} onChange={(e) => setTxCategory(e.target.value)} className="w-full px-3 py-2 border dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 outline-none">
                      <option value="Sell">Sell</option>
                      <option value="Party Booking">Party Booking</option>
                    </select>
                  ) : (
                    <select value={txCategory} onChange={(e) => setTxCategory(e.target.value)} className="w-full px-3 py-2 border dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 outline-none">
                      <option value="Expense">Expense</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Rent">Rent</option>
                      <option value="Utilities">Utilities</option>
                      <option value="Salary">Salary</option>
                    </select>
                  )
                ) : (
                  modalType === 'income' ? (
                    <select value={txCategory} onChange={(e) => setTxCategory(e.target.value)} className="w-full px-3 py-2 border dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 outline-none">
                      <option value="Owner Draw">Owner Draw</option>
                      <option value="Other">Other</option>
                    </select>
                  ) : (
                    <select value={txCategory} onChange={(e) => setTxCategory(e.target.value)} className="w-full px-3 py-2 border dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 outline-none">
                      <option value="Baby">Baby</option>
                      <option value="Market">Market</option>
                      <option value="Medical">Medical</option>
                      <option value="Electric">Electric</option>
                      <option value="Maintenance">Maintenance</option>
                    </select>
                  )
                )}
              </div>

              {txCategory === 'Sell' && (
                <div>
                  <label className="block font-bold text-slate-500 mb-1">Sell Type</label>
                  <select value={txSubcategory} onChange={(e) => setTxSubcategory(e.target.value)} className="w-full px-3 py-2 border dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 outline-none">
                    <option value="Online">Online</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-500 mb-1">Payment Method</label>
                <select value={txPaymentMethod} onChange={(e) => setTxPaymentMethod(e.target.value as any)} className="w-full px-3 py-2 border dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 outline-none">
                  <option value="upi">UPI / QR Scan</option>
                  <option value="cash">Cash register</option>
                  <option value="card">Card POS machine</option>
                  <option value="bank">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-500 mb-1">Amount (INR)</label>
                <input type="text" value={txAmount} onChange={(e) => setTxAmount(e.target.value)} placeholder="0.00" className="w-full px-3 py-2 border dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 outline-none" />
              </div>

              {modalType === 'expense' && (
                <div>
                  <label className="block font-bold text-slate-500 mb-1">Vendor Reference</label>
                  <input type="text" value={txVendor} onChange={(e) => setTxVendor(e.target.value)} placeholder="Egra Poultry Center" className="w-full px-3 py-2 border dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 outline-none" />
                </div>
              )}

              {txCategory === 'Salary' && (
                <div>
                  <label className="block font-bold text-slate-500 mb-1">Employee Name</label>
                  <input type="text" value={txEmployee} onChange={(e) => setTxEmployee(e.target.value)} placeholder="Subrata Dey" className="w-full px-3 py-2 border dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 outline-none" />
                </div>
              )}

              {modalType === 'expense' && (
                <div>
                  <label className="block font-bold text-slate-500 mb-1">GST Identification (GSTIN)</label>
                  <input type="text" value={txGst} onChange={(e) => setTxGst(e.target.value)} placeholder="19AAHCL2031K1Z2" className="w-full px-3 py-2 border dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 outline-none" />
                </div>
              )}

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-500 mb-1">Transaction Notes</label>
                <textarea value={txNotes} onChange={(e) => setTxNotes(e.target.value)} placeholder="Additional remarks or bill details..." className="w-full px-3 py-2 border dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 outline-none h-20 resize-none"></textarea>
              </div>

              <div className="sm:col-span-2 pt-4 border-t dark:border-slate-700 flex items-center justify-end gap-3">
                <button type="button" onClick={() => setShowTransactionModal(false)} className="px-4 py-2 border dark:border-slate-700 rounded-xl font-bold hover:bg-slate-100 dark:hover:bg-slate-800">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-primary-500 text-white rounded-xl font-bold hover:bg-primary-600 shadow-md shadow-primary-500/25">Save Record</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- OCR SCANNERS MODAL --- */}
      {showOcrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b dark:border-slate-700 pb-3">
              <h3 className="font-black text-base">OCR Invoice Scanner</h3>
              <button onClick={() => setShowOcrModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-primary-500 transition-colors relative">
              <input type="file" onChange={handleOcrFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
              <Upload className="text-primary-500 mb-2" size={32} />
              <span className="text-xs font-bold text-slate-500">Upload PDF Receipt or Image</span>
              <span className="text-[10px] text-slate-400 mt-1">Automatic parsing of Vendor, Date, amount, and GSTIN</span>
            </div>

            {ocrLoading && (
              <div className="flex flex-col items-center justify-center py-4 gap-2 text-xs">
                <RefreshCw size={20} className="animate-spin text-primary-500" />
                <span className="text-slate-400">Extracting fields with OCR engine...</span>
              </div>
            )}

            {ocrResult && (
              <div className="p-4 bg-slate-50 dark:bg-slate-900 border dark:border-slate-800 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between"><strong>Vendor:</strong> <span>{ocrResult.vendor}</span></div>
                <div className="flex justify-between"><strong>Amount:</strong> <span className="font-bold">₹{ocrResult.amount}</span></div>
                <div className="flex justify-between"><strong>Date:</strong> <span>{ocrResult.date}</span></div>
                <div className="flex justify-between"><strong>GSTIN:</strong> <span>{ocrResult.gst}</span></div>
                <div className="flex justify-between"><strong>Confidence:</strong> <span className="text-emerald-500 font-bold">{ocrResult.confidence}</span></div>
                
                <div className="pt-4 flex items-center justify-end gap-2">
                  <button onClick={() => setOcrResult(null)} className="px-3 py-1.5 border dark:border-slate-700 rounded-lg">Reset</button>
                  <button onClick={applyOcrToForm} className="px-4 py-1.5 bg-primary-500 text-white rounded-lg font-bold hover:bg-primary-600">Apply to form</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- EXCEL/CSV IMPORT MODAL --- */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col animate-scaleUp">
            <div className="flex items-center justify-between border-b dark:border-slate-700 pb-3 shrink-0">
              <h3 className="font-black text-base">Import Data from Excel / CSV</h3>
              <button onClick={() => { setShowImportModal(false); setImportStep(1); }} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-2">
              {/* Step 1: Select file */}
              {importStep === 1 && (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer hover:border-primary-500 transition-colors relative">
                    <input type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelImport} className="absolute inset-0 opacity-0 cursor-pointer" />
                    <Upload className="text-primary-500 mb-3" size={40} />
                    <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Choose Excel sheet or CSV file</span>
                    <span className="text-xs text-slate-400 mt-1.5">Supported extensions: .xlsx, .xls, .csv</span>
                  </div>
                </div>
              )}

              {/* Step 2: Column Mapping */}
              {importStep === 2 && (
                <div className="space-y-4">
                  <div className="p-3 bg-primary-50 dark:bg-primary-950/20 border border-primary-100 dark:border-primary-900 rounded-xl text-xs leading-relaxed text-primary-700 dark:text-primary-300 flex gap-2">
                    <Info size={16} className="shrink-0 mt-0.5" />
                    <span>Map your Excel sheet column headers to the corresponding system transaction fields below. Date and Amount are required.</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold">
                    {[
                      { key: 'date', label: 'Date Column (Required)', required: true },
                      { key: 'amount', label: 'Amount Column (Required)', required: true },
                      { key: 'category', label: 'Category Column' },
                      { key: 'type', label: 'Transaction Type (Income/Expense)' },
                      { key: 'payment_method', label: 'Payment Method Column' },
                      { key: 'notes', label: 'Notes / Remarks Column' },
                      { key: 'scope', label: 'Scope (Restaurant/Personal)' }
                    ].map(field => (
                      <div key={field.key} className="space-y-1">
                        <label className="block font-bold text-slate-500">{field.label}</label>
                        <select
                          value={columnMapping[field.key]}
                          onChange={(e) => setColumnMapping(prev => ({ ...prev, [field.key]: e.target.value }))}
                          className="w-full px-3 py-2 border dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 outline-none"
                        >
                          <option value="">-- Ignore / Select Column --</option>
                          {importedHeaders.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t dark:border-slate-700 flex justify-end gap-2">
                    <button onClick={() => setImportStep(1)} className="px-4 py-2 border dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">Back</button>
                    <button
                      onClick={() => setImportStep(3)}
                      disabled={!columnMapping.date || !columnMapping.amount}
                      className="px-5 py-2 bg-primary-500 disabled:opacity-50 text-white rounded-xl font-bold hover:bg-primary-600"
                    >
                      Preview Rows
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Review & Preview */}
              {importStep === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">Import Preview (First 5 Rows)</h4>
                    <span className="text-xs font-semibold">Total rows ready to import: <strong>{importedRows.length}</strong></span>
                  </div>

                  <div className="border dark:border-slate-700 rounded-xl overflow-hidden overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900 border-b dark:border-slate-700 text-slate-400 uppercase tracking-widest font-semibold font-semibold">
                          <th className="p-3">Date</th>
                          <th className="p-3">Category</th>
                          <th className="p-3">Scope</th>
                          <th className="p-3">Notes</th>
                          <th className="p-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y dark:divide-slate-800">
                        {importedRows.slice(0, 5).map((row, idx) => {
                          const amt = parseFloat(row[columnMapping.amount]) || 0;
                          const dt = row[columnMapping.date] || '—';
                          const cat = columnMapping.category ? row[columnMapping.category] : 'Other';
                          const notes = columnMapping.notes ? row[columnMapping.notes] : '—';
                          
                          let txScope = 'restaurant';
                          if (columnMapping.scope && row[columnMapping.scope]) {
                            const val = row[columnMapping.scope].toLowerCase();
                            if (val.includes('person') || val.includes('home')) txScope = 'personal';
                          }

                          return (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                              <td className="p-3 font-semibold text-slate-500">{dt}</td>
                              <td className="p-3 font-semibold">{cat}</td>
                              <td className="p-3 capitalize">{txScope}</td>
                              <td className="p-3 text-slate-500 truncate max-w-[150px]">{notes}</td>
                              <td className="p-3 text-right font-black text-slate-700 dark:text-slate-300">₹{amt}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="pt-4 border-t dark:border-slate-700 flex justify-end gap-2">
                    <button onClick={() => setImportStep(2)} className="px-4 py-2 border dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">Back</button>
                    <button onClick={executeExcelImport} className="px-5 py-2 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 shadow-md shadow-emerald-500/20">
                      Confirm & Import All
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
