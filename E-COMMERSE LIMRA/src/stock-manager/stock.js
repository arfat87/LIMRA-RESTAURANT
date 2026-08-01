// ═════════════════════════════════════════════════════════════════════
// LIMRA RESTAURANT — STANDALONE STOCK MANAGER ENGINE
// ═════════════════════════════════════════════════════════════════════

const STORAGE_KEY_ITEMS = 'limra_stock_inventory_items';
const STORAGE_KEY_LOGS = 'limra_stock_inventory_logs';

// Default Seed Stock Items across 7 Stock Categories
const DEFAULT_ITEMS = [
  { id: 'stk_1', name: 'Basmati Rice (Special Biryani 25kg)', category: 'Bhusimal & Spices', unit: 'kg', qty: 150, minQty: 30, costPrice: 120, supplier: 'Royal Rice Traders (9876543210)', status: 'active', isAvailable: true },
  { id: 'stk_2', name: 'Mughlai Biryani Masala Spice Mix', category: 'Bhusimal & Spices', unit: 'kg', qty: 25, minQty: 5, costPrice: 450, supplier: 'Kolkata Spice House', status: 'active', isAvailable: true },
  { id: 'stk_3', name: 'Refined Sunflower Oil (15L Tin)', category: 'Bhusimal & Spices', unit: 'L', qty: 60, minQty: 15, costPrice: 140, supplier: 'Fortune Distro Egra', status: 'active', isAvailable: true },
  { id: 'stk_4', name: 'Amul Fresh Paneer (200g Packs)', category: 'Dairy Items', unit: 'pcs', qty: 40, minQty: 10, costPrice: 85, supplier: 'Amul Dairy Egra', status: 'active', isAvailable: true },
  { id: 'stk_5', name: 'Pure Cow Milk (5L Can)', category: 'Dairy Items', unit: 'L', qty: 30, minQty: 10, costPrice: 52, supplier: 'Local Dairy Farm', status: 'active', isAvailable: true },
  { id: 'stk_6', name: 'Thums Up (750ml Bottles)', category: 'Cold Drinks', unit: 'pcs', qty: 120, minQty: 24, costPrice: 38, supplier: 'Coca-Cola Agency Egra', status: 'active', isAvailable: true },
  { id: 'stk_7', name: 'Sprite (750ml Bottles)', category: 'Cold Drinks', unit: 'pcs', qty: 90, minQty: 24, costPrice: 38, supplier: 'Coca-Cola Agency Egra', status: 'active', isAvailable: true },
  { id: 'stk_8', name: 'Fresh Red Onions (50kg Bag)', category: 'Fresh Vegetables', unit: 'kg', qty: 200, minQty: 40, costPrice: 28, supplier: 'Egra Sabji Mandi Vendor', status: 'active', isAvailable: true },
  { id: 'stk_9', name: 'Fresh Potatoes (Jyoti Special)', category: 'Fresh Vegetables', unit: 'kg', qty: 180, minQty: 50, costPrice: 22, supplier: 'Egra Sabji Mandi Vendor', status: 'active', isAvailable: true },
  { id: 'stk_10', name: 'Kulfi Ice Cream Tubs (1L)', category: 'Ice Cream', unit: 'pcs', qty: 15, minQty: 5, costPrice: 180, supplier: 'Kwality Wall\'s Egra', status: 'active', isAvailable: true },
  { id: 'stk_11', name: 'LIMRA Branded Parcel Boxes (500ml)', category: 'Packaging & Carry Bags', unit: 'pcs', qty: 450, minQty: 100, costPrice: 4.5, supplier: 'Egra Packaging Mart', status: 'active', isAvailable: true },
  { id: 'stk_12', name: 'Eco Carry Bags (Medium)', category: 'Packaging & Carry Bags', unit: 'pcs', qty: 600, minQty: 150, costPrice: 2.0, supplier: 'Egra Packaging Mart', status: 'active', isAvailable: true },
  { id: 'stk_13', name: 'Vim Dishwash Liquid (5L Can)', category: 'Cleaning & Washings', unit: 'L', qty: 12, minQty: 3, costPrice: 320, supplier: 'HUL Wholesale Dealer', status: 'active', isAvailable: true },
  { id: 'stk_14', name: 'Sanitizer Floor Cleaner (5L Can)', category: 'Cleaning & Washings', unit: 'L', qty: 8, minQty: 2, costPrice: 280, supplier: 'HUL Wholesale Dealer', status: 'active', isAvailable: true }
];

// App State
let stockItems = [];
let stockLogs = [];
let activeCategoryFilter = 'all';
let searchQuery = '';

// Load data from LocalStorage
function loadStockData() {
  try {
    const rawItems = localStorage.getItem(STORAGE_KEY_ITEMS);
    stockItems = rawItems ? JSON.parse(rawItems) : [...DEFAULT_ITEMS];
  } catch (e) {
    stockItems = [...DEFAULT_ITEMS];
  }

  try {
    const rawLogs = localStorage.getItem(STORAGE_KEY_LOGS);
    stockLogs = rawLogs ? JSON.parse(rawLogs) : [];
  } catch (e) {
    stockLogs = [];
  }

  saveItemsToStorage();
}

function saveItemsToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(stockItems));
  } catch (e) {
    console.warn('[StockManager] Failed to save items:', e);
  }
}

function saveLogsToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(stockLogs));
  } catch (e) {
    console.warn('[StockManager] Failed to save logs:', e);
  }
}

function addAuditLog(itemName, type, qty, unit, notes = '') {
  const log = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    date: new Date().toLocaleString(),
    item: itemName,
    type,
    qty: `${type.includes('Reduce') ? '-' : '+'}${qty} ${unit}`,
    notes: notes || 'Manual adjustment'
  };
  stockLogs.unshift(log);
  if (stockLogs.length > 50) stockLogs = stockLogs.slice(0, 50);
  saveLogsToStorage();
  renderLogs();
}

// UI Rendering
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
            <h3 class="font-extrabold text-sm text-white">${item.name}</h3>
            <span class="text-[10px] font-semibold text-slate-400">${item.category}</span>
          </div>
          <span class="text-xs font-bold px-2 py-0.5 rounded-full ${item.isAvailable ? (isLow ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30') : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}">
            ${item.isAvailable ? (isLow ? '⚠️ Low Stock' : '✓ In Stock') : '🔴 Out of Stock'}
          </span>
        </div>

        <div class="grid grid-cols-2 gap-2 text-xs bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/60">
          <div>
            <span class="text-[10px] text-slate-500 uppercase block font-semibold">Quantity</span>
            <span class="font-extrabold text-sm text-slate-200">${item.qty} ${item.unit}</span>
          </div>
          <div>
            <span class="text-[10px] text-slate-500 uppercase block font-semibold">Unit Cost</span>
            <span class="font-extrabold text-sm text-slate-200">₹ ${item.costPrice || 0}</span>
          </div>
        </div>

        ${item.supplier ? `<p class="text-[11px] text-slate-400 italic">Supplier: ${item.supplier}</p>` : ''}
      </div>

      <div class="flex items-center justify-between pt-2 border-t border-slate-800/80 gap-2">
        <label class="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-300">
          <input type="checkbox" class="toggle-availability-chk accent-emerald-500 w-4 h-4" data-id="${item.id}" ${item.isAvailable ? 'checked' : ''} />
          <span>${item.isAvailable ? 'Available' : 'Disabled'}</span>
        </label>

        <div class="flex items-center gap-1.5">
          <button class="btn-adjust-qty px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer" data-id="${item.id}">
            ⚡ Adjust
          </button>
          <button class="btn-edit-item px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer" data-id="${item.id}">
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
      <td class="py-2 px-3 font-bold ${log.type.includes('Add') ? 'text-emerald-400' : 'text-rose-400'}">${log.type}</td>
      <td class="py-2 px-3 text-center font-bold">${log.qty}</td>
      <td class="py-2 px-3 text-right text-slate-400">—</td>
      <td class="py-2 px-3 text-slate-400">${log.notes}</td>
    `;
    logsBody.appendChild(tr);
  });
}

// Modals
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

  modal.classList.remove('hidden');
}

function closeAddEditModal() {
  const modal = document.getElementById('modal-add-item');
  if (modal) modal.classList.add('hidden');
}

function openAdjustModal(itemId) {
  const modal = document.getElementById('modal-adjust-stock');
  const item = stockItems.find(i => i.id === itemId);
  if (!modal || !item) return;

  document.getElementById('adjust-item-id').value = item.id;
  document.getElementById('adjust-item-name').value = item.name;
  document.getElementById('adjust-qty').value = '';
  document.getElementById('adjust-notes').value = '';

  modal.classList.remove('hidden');
}

function closeAdjustModal() {
  const modal = document.getElementById('modal-adjust-stock');
  if (modal) modal.classList.add('hidden');
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
  doc.text('LIMRA Restaurant — Stock Inventory Report', 14, 15);
  doc.setFontSize(10);
  doc.text(`Generated Date: ${new Date().toLocaleString()}`, 14, 22);

  const items = getFilteredItems();
  const tableData = items.map(i => [
    i.name,
    i.category,
    `${i.qty} ${i.unit}`,
    `₹ ${i.costPrice || 0}`,
    `₹ ${(i.qty * (i.costPrice || 0)).toFixed(2)}`,
    i.isAvailable ? 'In Stock' : 'Out of Stock'
  ]);

  doc.autoTable({
    startY: 28,
    head: [['Item Name', 'Category', 'Quantity', 'Unit Cost', 'Total Value', 'Status']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129] }
  });

  doc.save(`LIMRA_Stock_Report_${Date.now()}.pdf`);
}

// Export Excel Report
function exportExcel() {
  if (!window.XLSX) {
    alert('Excel engine loading. Please try again in a moment.');
    return;
  }
  const items = getFilteredItems().map(i => ({
    'Item Name': i.name,
    'Category': i.category,
    'Quantity': i.qty,
    'Unit': i.unit,
    'Unit Cost (INR)': i.costPrice || 0,
    'Total Value (INR)': i.qty * (i.costPrice || 0),
    'Supplier': i.supplier || '',
    'Status': i.isAvailable ? 'In Stock' : 'Out of Stock'
  }));

  const worksheet = XLSX.utils.json_to_sheet(items);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Inventory');
  XLSX.writeFile(workbook, `LIMRA_Stock_Report_${Date.now()}.xlsx`);
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
  renderKPIs();
  renderGrid();
  renderLogs();

  // Search input
  const searchInput = document.getElementById('stock-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderKPIs();
      renderGrid();
    });
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

  // Modal open/close
  document.getElementById('btn-open-add-modal')?.addEventListener('click', () => openAddEditModal());
  document.getElementById('modal-add-close')?.addEventListener('click', closeAddEditModal);
  document.getElementById('form-cancel-btn')?.addEventListener('click', closeAddEditModal);

  document.getElementById('modal-adjust-close')?.addEventListener('click', closeAdjustModal);
  document.getElementById('adjust-cancel-btn')?.addEventListener('click', closeAdjustModal);

  // Form submit: Add/Edit Item
  document.getElementById('form-stock-item')?.addEventListener('submit', (e) => {
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
        showToast(`Updated ${name}`);
      }
    } else {
      const newItem = {
        id: 'stk_' + Date.now(),
        name, category, unit, qty, minQty, costPrice, supplier,
        isAvailable: true
      };
      stockItems.unshift(newItem);
      addAuditLog(name, 'Add Item', qty, unit, 'Created new stock item');
      showToast(`Added new item: ${name}`);
    }

    saveItemsToStorage();
    closeAddEditModal();
    renderKPIs();
    renderGrid();
  });

  // Form submit: Adjust Stock
  document.getElementById('form-adjust-stock')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('adjust-item-id').value;
    const type = document.getElementById('adjust-type').value;
    const adjustQty = parseFloat(document.getElementById('adjust-qty').value) || 0;
    const notes = document.getElementById('adjust-notes').value.trim();

    const item = stockItems.find(i => i.id === id);
    if (item && adjustQty > 0) {
      if (type === 'add') {
        item.qty += adjustQty;
        addAuditLog(item.name, 'Add Stock (+)', adjustQty, item.unit, notes);
      } else {
        item.qty = Math.max(0, item.qty - adjustQty);
        addAuditLog(item.name, 'Reduce Stock (-)', adjustQty, item.unit, notes);
      }
      saveItemsToStorage();
      closeAdjustModal();
      renderKPIs();
      renderGrid();
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
});
