import '../style.css';
import './stock-manager.css';
import { insforge } from '../lib/insforge.js';
import { INITIAL_STOCK_ITEMS } from './data/initialStockData.js';

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

// Storage Keys for fast instant local caching
const STORAGE_KEY_ITEMS = 'limra_stock_items_v3';
const STORAGE_KEY_IN = 'limra_stock_in_entries_v3';
const STORAGE_KEY_OUT = 'limra_stock_out_entries_v3';
const STORAGE_KEY_LOGS = 'limra_stock_logs_v3';

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
let isDatabaseLoading = false;

// ═════════════════════════════════════════════════════════════════════
// DATABASE STATE & OFFLINE CACHE SYNCHRONIZATION
// ═════════════════════════════════════════════════════════════════════

// 1. Initial Instant Cache Load
function loadLocalCache() {
  try {
    const rawItems = localStorage.getItem(STORAGE_KEY_ITEMS);
    if (rawItems) {
      stockItems = JSON.parse(rawItems);
    } else {
      stockItems = JSON.parse(JSON.stringify(INITIAL_STOCK_ITEMS));
    }
  } catch (e) {
    stockItems = JSON.parse(JSON.stringify(INITIAL_STOCK_ITEMS));
  }

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

  recalculateBalances();
}

function saveLocalCache() {
  try {
    localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(stockItems));
    localStorage.setItem(STORAGE_KEY_IN, JSON.stringify(stockInEntries));
    localStorage.setItem(STORAGE_KEY_OUT, JSON.stringify(stockOutEntries));
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(stockLogs));
  } catch (e) {
    console.warn('[StockManager] Save local cache failed:', e);
  }
}

// 2. Fetch Fresh Data Directly from InsForge PostgreSQL Database
async function fetchDatabaseState() {
  const statusBadge = document.getElementById('db-status-badge');
  const statusText = document.getElementById('db-status-text');

  if (statusText) statusText.textContent = 'Syncing DB...';
  if (statusBadge) statusBadge.className = 'px-2.5 py-1 bg-amber-950/80 border border-amber-700/60 text-amber-300 font-bold text-[10px] rounded-xl flex items-center gap-1.5 shadow-sm';

  isDatabaseLoading = true;

  try {
    const [itemsRes, inRes, outRes, logsRes] = await Promise.all([
      insforge.database.from('stock_items').select('*').order('sku', { ascending: true }),
      insforge.database.from('stock_in').select('*').order('created_at', { ascending: false }),
      insforge.database.from('stock_out').select('*').order('created_at', { ascending: false }),
      insforge.database.from('stock_logs').select('*').order('created_at', { ascending: false }).limit(100)
    ]);

    if (itemsRes.data && itemsRes.data.length > 0) {
      stockItems = itemsRes.data.map(item => ({
        id: item.id,
        sku: item.sku,
        name: item.name,
        category: item.category || 'Bhusimal & Spices',
        godown: item.godown || 'Main Godown',
        unit: item.unit || 'pcs',
        min: safeNum(item.min_qty, 5),
        cost: safeNum(item.cost_price, 0),
        salePrice: safeNum(item.sale_price, 0),
        supplier: item.supplier || '',
        isAvailable: item.is_available ?? true,
        storedQty: safeNum(item.qty, 0),
        updatedAt: item.updated_at
      }));
    }

    if (inRes.data) {
      stockInEntries = inRes.data.map(entry => ({
        id: entry.id,
        date: entry.date || new Date(entry.created_at || Date.now()).toLocaleDateString('en-GB'),
        sku: entry.item_sku || entry.sku || '',
        description: entry.item_name || entry.description || 'Stock IN',
        unit: entry.unit || 'pcs',
        qty: safeNum(entry.qty, 0),
        costPrice: safeNum(entry.cost_price, 0),
        supplier: entry.supplier || '',
        notes: entry.notes || '',
        createdAt: entry.created_at
      }));
    }

    if (outRes.data) {
      stockOutEntries = outRes.data.map(entry => ({
        id: entry.id,
        date: entry.date || new Date(entry.created_at || Date.now()).toLocaleDateString('en-GB'),
        sku: entry.item_sku || entry.sku || '',
        description: entry.item_name || entry.description || 'Stock OUT',
        unit: entry.unit || 'pcs',
        qty: safeNum(entry.qty, 0),
        usedBy: entry.used_by || '',
        notes: entry.notes || '',
        createdAt: entry.created_at
      }));
    }

    if (logsRes.data) {
      stockLogs = logsRes.data.map(log => ({
        id: log.id,
        date: new Date(log.created_at).toLocaleDateString('en-GB') + ' ' + new Date(log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        itemName: log.action ? log.action.split('(')[0].trim() : 'Stock Action',
        type: log.action || 'Movement',
        qtyText: log.details ? (log.details.split('|')[0] || '').trim() : '',
        notes: log.details || '',
        createdAt: log.created_at
      }));
    }

    recalculateBalances();
    saveLocalCache();

    if (statusText) statusText.textContent = 'DB Connected';
    if (statusBadge) statusBadge.className = 'px-2.5 py-1 bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 font-bold text-[10px] rounded-xl flex items-center gap-1.5 shadow-sm';

    renderAll();
  } catch (err) {
    console.error('[StockManager] Database fetch error:', err);
    if (statusText) statusText.textContent = 'Offline (Cached)';
    if (statusBadge) statusBadge.className = 'px-2.5 py-1 bg-rose-950/80 border border-rose-700/60 text-rose-300 font-bold text-[10px] rounded-xl flex items-center gap-1.5 shadow-sm';
  } finally {
    isDatabaseLoading = false;
  }
}

// ═════════════════════════════════════════════════════════════════════
// CALCULATION ENGINE: Actual Balance = Total IN - Total OUT (from DB)
// ═════════════════════════════════════════════════════════════════════
function recalculateBalances() {
  stockItems.forEach(item => {
    const matchingIn = stockInEntries.filter(e => e.sku === item.sku);
    const matchingOut = stockOutEntries.filter(e => e.sku === item.sku);

    const totalIn = matchingIn.reduce((sum, e) => sum + safeNum(e.qty), 0);
    const totalOut = matchingOut.reduce((sum, e) => sum + safeNum(e.qty), 0);

    item.totalIn = parseFloat(totalIn.toFixed(2));
    item.totalOut = parseFloat(totalOut.toFixed(2));

    // If transactions exist in DB, balance is Total IN - Total OUT.
    // Otherwise fallback to stored quantity in DB.
    if (matchingIn.length > 0 || matchingOut.length > 0) {
      item.qty = parseFloat((totalIn - totalOut).toFixed(2));
    } else {
      item.qty = safeNum(item.storedQty, 0);
    }
  });
}

async function addLogToDB(action, details) {
  const logId = 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
  const logObj = {
    id: logId,
    action,
    details,
    created_at: new Date().toISOString()
  };

  // Add locally immediately
  stockLogs.unshift({
    id: logId,
    date: new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    itemName: action.split('(')[0].trim(),
    type: action,
    qtyText: details.split('|')[0]?.trim() || '',
    notes: details,
    createdAt: logObj.created_at
  });
  if (stockLogs.length > 80) stockLogs = stockLogs.slice(0, 80);
  saveLocalCache();
  renderLogs();

  // Async sync to InsForge DB
  try {
    await insforge.database.from('stock_logs').insert([logObj]);
  } catch (err) {
    console.warn('[StockManager] Log sync to DB error:', err);
  }
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

// ═════════════════════════════════════════════════════════════════════
// DELETE STOCK IN / OUT ENTRIES WITH DATABASE PERSISTENCE
// ═════════════════════════════════════════════════════════════════════
async function deleteStockInEntry(entryId) {
  const index = stockInEntries.findIndex(e => e.id === entryId);
  if (index === -1) return;
  const entry = stockInEntries[index];

  if (!confirm(`Are you sure you want to delete this Stock IN entry?\n\nSKU: ${entry.sku}\nItem: ${entry.description}\nQty: +${entry.qty} ${entry.unit}\nDate: ${entry.date}`)) {
    return;
  }

  // Remove locally
  stockInEntries.splice(index, 1);
  recalculateBalances();
  saveLocalCache();
  renderAll();
  showToast(`Deleted Stock IN entry for "${entry.description}"`, 'info');

  // Database operations
  try {
    await insforge.database.from('stock_in').delete().eq('id', entryId);
    await addLogToDB(
      `${entry.description} (Delete Stock IN)`,
      `-${entry.qty} ${entry.unit} | Removed Stock IN entry for SKU ${entry.sku}`
    );

    // Sync updated item qty
    const targetItem = stockItems.find(i => i.sku === entry.sku);
    if (targetItem) {
      await insforge.database.from('stock_items').update({
        qty: targetItem.qty,
        updated_at: new Date().toISOString()
      }).eq('id', targetItem.id);
    }
  } catch (err) {
    console.error('[StockManager] Error deleting Stock IN from DB:', err);
    showToast('Failed to sync deletion to database.', 'error');
  }
}

async function deleteStockOutEntry(entryId) {
  const index = stockOutEntries.findIndex(e => e.id === entryId);
  if (index === -1) return;
  const entry = stockOutEntries[index];

  if (!confirm(`Are you sure you want to delete this Stock OUT entry?\n\nSKU: ${entry.sku}\nItem: ${entry.description}\nQty: -${entry.qty} ${entry.unit}\nDate: ${entry.date}`)) {
    return;
  }

  // Remove locally
  stockOutEntries.splice(index, 1);
  recalculateBalances();
  saveLocalCache();
  renderAll();
  showToast(`Deleted Stock OUT entry for "${entry.description}"`, 'info');

  // Database operations
  try {
    await insforge.database.from('stock_out').delete().eq('id', entryId);
    await addLogToDB(
      `${entry.description} (Delete Stock OUT)`,
      `+${entry.qty} ${entry.unit} | Removed Stock OUT entry for SKU ${entry.sku}`
    );

    // Sync updated item qty
    const targetItem = stockItems.find(i => i.sku === entry.sku);
    if (targetItem) {
      await insforge.database.from('stock_items').update({
        qty: targetItem.qty,
        updated_at: new Date().toISOString()
      }).eq('id', targetItem.id);
    }
  } catch (err) {
    console.error('[StockManager] Error deleting Stock OUT from DB:', err);
    showToast('Failed to sync deletion to database.', 'error');
  }
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
// RECORD STOCK IN / OUT ENTRY MODAL WORKFLOW WITH DATABASE PERSISTENCE
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
    ? 'px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg transition-all cursor-pointer'
    : 'px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-lg transition-all cursor-pointer';

  dateInput.value = new Date().toISOString().slice(0, 10);
  qtyInput.value = '';

  // Sort and populate options
  const sorted = [...stockItems].sort((a, b) => (a.sku || '').localeCompare(b.sku || ''));
  itemSelect.innerHTML = sorted.map(item => `
    <option value="${item.sku}" data-id="${item.id}" data-unit="${item.unit}" data-name="${item.name}">${item.sku} — ${item.name} (${item.category})</option>
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

async function handleInOutSubmit(e) {
  e.preventDefault();
  const mode = document.getElementById('inout-mode').value;
  const date = document.getElementById('inout-date').value;
  const itemSelect = document.getElementById('inout-item-select');
  const selectedOpt = itemSelect.options[itemSelect.selectedIndex];
  const sku = itemSelect.value;
  const description = selectedOpt.dataset.name || 'Item';
  const itemId = selectedOpt.dataset.id || '';
  const unit = selectedOpt.dataset.unit || 'pcs';
  const qty = safeNum(document.getElementById('inout-qty').value, 0);

  if (qty <= 0) {
    showToast('Please enter a valid quantity greater than 0.', 'error');
    return;
  }

  const targetItem = stockItems.find(i => i.sku === sku) || { id: itemId, cost: 0, supplier: '' };

  const entryId = (mode === 'IN' ? 'in_' : 'out_') + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
  const nowIso = new Date().toISOString();

  const entryLocal = {
    id: entryId,
    date,
    sku,
    description,
    unit,
    qty,
    createdAt: nowIso
  };

  if (mode === 'IN') {
    stockInEntries.unshift(entryLocal);
    showToast(`Recorded Stock IN: +${qty} ${unit} for "${description}"`, 'success');
  } else {
    stockOutEntries.unshift(entryLocal);
    showToast(`Recorded Stock OUT: -${qty} ${unit} for "${description}"`, 'warning');
  }

  recalculateBalances();
  saveLocalCache();
  closeInOutModal();
  renderAll();

  // Async Database Synchronization
  try {
    if (mode === 'IN') {
      await insforge.database.from('stock_in').insert([{
        id: entryId,
        date,
        item_id: targetItem.id,
        item_sku: sku,
        item_name: description,
        qty,
        unit,
        cost_price: targetItem.cost || 0,
        supplier: targetItem.supplier || '',
        notes: `Manual Stock IN entry for ${sku}`,
        created_at: nowIso
      }]);
      await addLogToDB(
        `${description} (Stock IN (+))`,
        `+${qty} ${unit} | Manual IN entry recorded for ${sku}`
      );
    } else {
      await insforge.database.from('stock_out').insert([{
        id: entryId,
        date,
        item_id: targetItem.id,
        item_sku: sku,
        item_name: description,
        qty,
        unit,
        used_by: 'Kitchen / Counter',
        notes: `Manual Stock OUT entry for ${sku}`,
        created_at: nowIso
      }]);
      await addLogToDB(
        `${description} (Stock OUT (-))`,
        `-${qty} ${unit} | Manual OUT entry recorded for ${sku}`
      );
    }

    // Update calculated qty in stock_items table
    const updatedItem = stockItems.find(i => i.sku === sku);
    if (updatedItem) {
      await insforge.database.from('stock_items').update({
        qty: updatedItem.qty,
        updated_at: nowIso
      }).eq('id', updatedItem.id);
    }
  } catch (err) {
    console.error('[StockManager] Error saving IN/OUT entry to DB:', err);
    showToast('Warning: Entry saved locally, but database sync encountered an issue.', 'warning');
  }
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
// QUICK ADJUST MODAL WITH DATABASE PERSISTENCE
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

async function handleAdjustSubmit(e) {
  e.preventDefault();
  const itemId = document.getElementById('adjust-target-id').value;
  const item = stockItems.find(i => i.id === itemId);
  if (!item) return;

  const mode = document.getElementById('adjust-mode').value; // 'add' or 'reduce'
  const qty = safeNum(document.getElementById('adjust-workflow-qty').value, 0);
  const notes = document.getElementById('adjust-workflow-notes').value || 'Workflow Adjustment';
  const godown = document.getElementById('adjust-godown-select').value;
  const date = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  if (qty <= 0) {
    showToast('Please enter a valid quantity greater than 0.', 'error');
    return;
  }

  const entryId = (mode === 'add' ? 'in_' : 'out_') + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

  const entryLocal = {
    id: entryId,
    date,
    sku: item.sku,
    description: item.name,
    unit: item.unit,
    qty,
    createdAt: nowIso
  };

  if (mode === 'add') {
    stockInEntries.unshift(entryLocal);
    showToast(`Added +${qty} ${item.unit} to "${item.name}"`, 'success');
  } else {
    stockOutEntries.unshift(entryLocal);
    showToast(`Reduced -${qty} ${item.unit} from "${item.name}"`, 'warning');
  }

  recalculateBalances();
  saveLocalCache();
  closeAdjustModal();
  renderAll();

  // Async sync to Database
  try {
    if (mode === 'add') {
      await insforge.database.from('stock_in').insert([{
        id: entryId,
        date,
        item_id: item.id,
        item_sku: item.sku,
        item_name: item.name,
        qty,
        unit: item.unit,
        cost_price: item.cost,
        supplier: item.supplier || '',
        notes,
        created_at: nowIso
      }]);
      await addLogToDB(
        `${item.name} (Stock IN (+))`,
        `+${qty} ${item.unit} | ${notes}`
      );
    } else {
      await insforge.database.from('stock_out').insert([{
        id: entryId,
        date,
        item_id: item.id,
        item_sku: item.sku,
        item_name: item.name,
        qty,
        unit: item.unit,
        used_by: godown,
        notes,
        created_at: nowIso
      }]);
      await addLogToDB(
        `${item.name} (Stock OUT (-))`,
        `-${qty} ${item.unit} | ${notes}`
      );
    }

    await insforge.database.from('stock_items').update({
      qty: item.qty,
      updated_at: nowIso
    }).eq('id', item.id);
  } catch (err) {
    console.error('[StockManager] Adjust sync to DB failed:', err);
  }
}

// ═════════════════════════════════════════════════════════════════════
// ADD / EDIT STOCK ITEM MODAL WITH DATABASE PERSISTENCE
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
  document.getElementById('form-item-qty').value = item ? (item.qty ?? '') : '';
  document.getElementById('form-item-min').value = item ? item.min : '10';
  document.getElementById('form-item-sale-price').value = item ? item.salePrice || '' : '';
  document.getElementById('form-item-cost').value = item ? item.cost : '';
  document.getElementById('form-item-supplier').value = item ? item.supplier || '' : '';

  modal.classList.remove('hidden');
}

function closeItemModal() {
  document.getElementById('modal-item')?.classList.add('hidden');
}

async function handleItemSubmit(e) {
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
  const nowIso = new Date().toISOString();

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
      item.min = min;
      item.salePrice = salePrice;
      item.cost = cost;
      item.supplier = supplier;
      showToast(`Updated item "${name}"`, 'success');

      recalculateBalances();
      saveLocalCache();
      closeItemModal();
      renderAll();

      try {
        await insforge.database.from('stock_items').update({
          name,
          sku,
          category,
          unit,
          min_qty: min,
          cost_price: cost,
          sale_price: salePrice,
          supplier,
          updated_at: nowIso
        }).eq('id', id);

        await addLogToDB(
          `${name} (Edit Item Details)`,
          `Parameters updated for SKU ${sku}`
        );
      } catch (err) {
        console.error('[StockManager] Update item in DB error:', err);
      }
    }
  } else {
    const newId = 'stk_' + Date.now();
    const newItem = {
      id: newId,
      sku,
      name,
      category,
      godown,
      unit,
      qty: baseQty,
      storedQty: baseQty,
      min,
      cost,
      salePrice,
      supplier,
      isAvailable: true,
      updatedAt: nowIso
    };
    stockItems.unshift(newItem);

    // If initial qty > 0, create initial Stock IN entry
    if (baseQty > 0) {
      const initInId = 'in_init_' + Date.now();
      const dateStr = new Date().toISOString().slice(0, 10);
      stockInEntries.unshift({
        id: initInId,
        date: dateStr,
        sku,
        description: name,
        unit,
        qty: baseQty,
        createdAt: nowIso
      });

      try {
        await insforge.database.from('stock_in').insert([{
          id: initInId,
          date: dateStr,
          item_id: newId,
          item_sku: sku,
          item_name: name,
          qty: baseQty,
          unit,
          cost_price: cost,
          supplier,
          notes: 'Opening stock balance for newly created item',
          created_at: nowIso
        }]);
      } catch (e) {
        console.warn('[StockManager] Initial Stock IN sync error:', e);
      }
    }

    showToast(`Created new item "${name}" (${sku})`, 'success');

    recalculateBalances();
    saveLocalCache();
    closeItemModal();
    renderAll();

    try {
      await insforge.database.from('stock_items').insert([{
        id: newId,
        sku,
        name,
        category,
        unit,
        qty: newItem.qty,
        min_qty: min,
        cost_price: cost,
        sale_price: salePrice,
        godown,
        supplier,
        is_available: true,
        updated_at: nowIso
      }]);

      await addLogToDB(
        `${name} (Add New Item)`,
        `Created new inventory SKU ${sku} with initial balance ${baseQty} ${unit}`
      );
    } catch (err) {
      console.error('[StockManager] Insert item in DB error:', err);
    }
  }
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
    if (confirm('Re-sync inventory directly from PostgreSQL database?')) {
      fetchDatabaseState();
      showToast('Syncing with PostgreSQL database...', 'info');
    }
  });

  document.getElementById('menu-print-page')?.addEventListener('click', () => window.print());

  // Log filter & Clear
  document.getElementById('log-filter-type')?.addEventListener('change', (e) => {
    activeLogFilter = e.target.value;
    renderLogs();
  });

  document.getElementById('btn-clear-logs')?.addEventListener('click', () => {
    if (confirm('Clear audit logs display?')) {
      stockLogs = [];
      saveLocalCache();
      renderLogs();
      showToast('Audit log view cleared', 'info');
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
    localStorage.removeItem(STORAGE_KEY_IN);
    localStorage.removeItem(STORAGE_KEY_OUT);
    localStorage.removeItem(STORAGE_KEY_LOGS);
    loadLocalCache();
    fetchDatabaseState();
    document.getElementById('stock-error-boundary')?.classList.add('hidden');
    showToast('Inventory database synchronization refreshed', 'success');
  });
}

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  try {
    loadLocalCache();
    setupEventListeners();
    renderAll();
    fetchDatabaseState();
  } catch (err) {
    console.error('Stock Manager Initialization Error:', err);
    document.getElementById('stock-error-boundary')?.classList.remove('hidden');
  }
});
