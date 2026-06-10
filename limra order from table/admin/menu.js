// ================================================================
// LIMRA RMS — Menu Management Logic
// admin/menu.js
// ================================================================
import { db } from '../src/lib/insforge.js'
import { initAdminLayout, showToast } from './admin-layout.js'

// Initialize Admin Layout UI
initAdminLayout()

// ── State ──────────────────────────────────────────────────────────
let categories = []
let items = []
let activeCategoryId = 'all'
let selectedFile = null

// ── Bootstrapping ──────────────────────────────────────────────────
async function initMenuPage() {
  await fetchCategories()
  await fetchItems()
  setupEventListeners()
}

// ── Fetch Categories & Items ───────────────────────────────────────
async function fetchCategories() {
  try {
    const { data, error } = await db
      .from('menu_categories')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error) throw error
    categories = data
    renderCategories()
    populateCategoryDropdown()
  } catch (err) {
    console.error('Error fetching categories', err)
    showToast('Failed to load categories', 'error')
  }
}

async function fetchItems() {
  const grid = document.getElementById('items-grid')
  grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:3rem;"><div class="spinner" style="margin: 0 auto 1rem;"></div><p>Loading items…</p></div>`

  try {
    const { data, error } = await db
      .from('menu_items')
      .select('*, menu_categories(name)')
      .order('name', { ascending: true })

    if (error) throw error
    items = data
    renderItems()
  } catch (err) {
    console.error('Error fetching items', err)
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:3rem; color:var(--text-muted);">Failed to load menu items.</div>`
  }
}

// ── Render Category Panel ──────────────────────────────────────────
function renderCategories() {
  const container = document.getElementById('categories-list')
  if (!container) return

  const allActive = activeCategoryId === 'all' ? 'active' : ''
  const allRow = `
    <div class="category-item ${allActive}" data-id="all">
      <span>🍽️ All Items</span>
      <span style="font-size:0.75rem; color:var(--text-muted);">${items.length}</span>
    </div>
  `

  const listHTML = categories.map(cat => {
    const count = items.filter(i => i.category_id === cat.id).length
    const isActive = activeCategoryId === cat.id ? 'active' : ''
    return `
      <div class="category-item ${isActive}" data-id="${cat.id}">
        <span>📁 ${cat.name}</span>
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <span style="font-size:0.75rem; color:var(--text-muted);">${count}</span>
          <div class="category-actions">
            <button class="cat-btn edit-cat" data-id="${cat.id}" title="Edit">✏️</button>
            <button class="cat-btn delete-cat" data-id="${cat.id}" title="Delete">🗑️</button>
          </div>
        </div>
      </div>
    `
  }).join('')

  container.innerHTML = allRow + listHTML

  // Add click listeners to items
  container.querySelectorAll('.category-item').forEach(el => {
    el.addEventListener('click', (e) => {
      // Don't filter if action button clicked
      if (e.target.classList.contains('cat-btn')) return
      
      container.querySelectorAll('.category-item').forEach(x => x.classList.remove('active'))
      el.classList.add('active')
      activeCategoryId = el.dataset.id
      
      const titleEl = document.getElementById('active-category-title')
      if (titleEl) {
        if (activeCategoryId === 'all') {
          titleEl.textContent = 'All Items'
        } else {
          const cat = categories.find(c => c.id === activeCategoryId)
          titleEl.textContent = cat ? cat.name : 'Category Items'
        }
      }
      renderItems()
    })
  })

  // Edit/delete listeners
  container.querySelectorAll('.edit-cat').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = categories.find(c => c.id === btn.dataset.id)
      if (cat) openCategoryModal(cat)
    })
  })

  container.querySelectorAll('.delete-cat').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Are you sure you want to delete this category? All items inside will be deleted.')) {
        handleDeleteCategory(btn.dataset.id)
      }
    })
  })
}

// ── Render Items Grid ──────────────────────────────────────────────
function renderItems() {
  const grid = document.getElementById('items-grid')
  if (!grid) return

  let filtered = items
  if (activeCategoryId !== 'all') {
    filtered = items.filter(i => i.category_id === activeCategoryId)
  }

  if (filtered.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:3rem; color:var(--text-muted);">No items in this category.</div>`
    return
  }

  grid.innerHTML = filtered.map(item => {
    const isAvailable = item.is_available ? 'checked' : ''
    const featuredStar = item.is_featured ? '⭐' : ''
    
    return `
      <div class="item-card" data-id="${item.id}">
        ${item.image_url ? 
          `<img src="${item.image_url}" class="item-card-img" alt="${item.name}" />` : 
          `<div class="item-card-placeholder">🍱</div>`
        }
        <div class="item-card-body">
          <div class="item-card-title">${featuredStar} ${item.name}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${item.menu_categories?.name || 'Unassigned'} • ${item.preparation_time} min</div>
          <p style="font-size:0.75rem; color:var(--text-secondary); line-height:1.3; margin-top:0.25rem;">
            ${item.description || 'No description provided.'}
          </p>
          <div class="item-card-price">₹${parseFloat(item.price).toFixed(2)}</div>
          
          <div class="item-card-footer">
            <div style="display:flex; align-items:center; gap:0.4rem; font-size:0.75rem; color:var(--text-muted)">
              <span>Available:</span>
              <label class="switch">
                <input type="checkbox" class="toggle-availability" data-id="${item.id}" ${isAvailable} />
                <span class="slider"></span>
              </label>
            </div>
            <div style="display:flex; gap:0.4rem;">
              <button class="btn btn-outline btn-sm edit-item" data-id="${item.id}" style="padding:0.25rem 0.5rem; font-size:0.75rem;">✏️ Edit</button>
              <button class="btn btn-outline btn-sm delete-item" data-id="${item.id}" style="padding:0.25rem 0.5rem; font-size:0.75rem; color:#ef4444; border-color:rgba(239,68,68,0.15)">🗑️ Delete</button>
            </div>
          </div>
        </div>
      </div>
    `
  }).join('')

  // Bind change/click events
  grid.querySelectorAll('.toggle-availability').forEach(cb => {
    cb.addEventListener('change', () => {
      handleToggleAvailability(cb.dataset.id, cb.checked)
    })
  })

  grid.querySelectorAll('.edit-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = items.find(i => i.id === btn.dataset.id)
      if (item) openItemModal(item)
    })
  })

  grid.querySelectorAll('.delete-item').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Are you sure you want to delete this menu item?')) {
        handleDeleteItem(btn.dataset.id)
      }
    })
  })
}

function populateCategoryDropdown() {
  const dropdown = document.getElementById('item-category')
  if (!dropdown) return
  dropdown.innerHTML = categories.map(cat => `
    <option value="${cat.id}">${cat.name}</option>
  `).join('')
}

// ── CRUD Category Actions ──────────────────────────────────────────
async function handleCategorySubmit(e) {
  e.preventDefault()
  const id = document.getElementById('cat-id').value
  const name = document.getElementById('cat-name').value.trim()
  const sort_order = parseInt(document.getElementById('cat-sort').value, 10) || 0

  try {
    if (id) {
      // Update
      const { error } = await db
        .from('menu_categories')
        .update({ name, sort_order })
        .eq('id', id)

      if (error) throw error
      showToast('Category updated', 'success')
    } else {
      // Insert
      const { error } = await db
        .from('menu_categories')
        .insert([{ name, sort_order }])

      if (error) throw error
      showToast('Category added', 'success')
    }

    closeCategoryModal()
    await fetchCategories()
  } catch (err) {
    console.error('Error saving category', err)
    showToast('Failed to save category', 'error')
  }
}

async function handleDeleteCategory(id) {
  try {
    const { error } = await db
      .from('menu_categories')
      .delete()
      .eq('id', id)

    if (error) throw error
    showToast('Category deleted', 'success')
    
    if (activeCategoryId === id) activeCategoryId = 'all'
    await fetchCategories()
    await fetchItems()
  } catch (err) {
    console.error('Error deleting category', err)
    showToast('Failed to delete category', 'error')
  }
}

// ── CRUD Item Actions ──────────────────────────────────────────────
async function handleItemSubmit(e) {
  e.preventDefault()
  const id = document.getElementById('item-id').value
  const category_id = document.getElementById('item-category').value
  const name = document.getElementById('item-name').value.trim()
  const description = document.getElementById('item-desc').value.trim() || null
  const price = parseFloat(document.getElementById('item-price').value) || 0
  const preparation_time = parseInt(document.getElementById('item-prep').value, 10) || 15
  const is_featured = document.getElementById('item-featured').checked

  const submitBtn = document.getElementById('btn-submit-item')
  submitBtn.disabled = true
  submitBtn.textContent = 'Saving…'

  try {
    let image_url = null
    let image_key = null

    // Handle image upload if selected
    if (selectedFile) {
      const fileExt = selectedFile.name.split('.').pop()
      const fileName = `item-${Date.now()}.${fileExt}`
      
      const { data, error: uploadErr } = await db.storage
        .from('menu-images')
        .upload(fileName, selectedFile)

      if (uploadErr) throw uploadErr

      image_key = data.path
      const { data: urlData } = db.storage.from('menu-images').getPublicUrl(image_key)
      image_url = urlData.publicUrl
    }

    const itemPayload = {
      category_id,
      name,
      description,
      price,
      preparation_time,
      is_featured
    }

    if (image_url) {
      itemPayload.image_url = image_url
      itemPayload.image_key = image_key
    }

    if (id) {
      // Update
      const { error } = await db
        .from('menu_items')
        .update(itemPayload)
        .eq('id', id)

      if (error) throw error
      showToast('Menu item updated', 'success')
    } else {
      // Insert
      const { error } = await db
        .from('menu_items')
        .insert([itemPayload])

      if (error) throw error
      showToast('Menu item added', 'success')
    }

    closeItemModal()
    await fetchItems()
    renderCategories() // refresh item counts
  } catch (err) {
    console.error('Error saving menu item', err)
    showToast('Failed to save menu item', 'error')
  } finally {
    submitBtn.disabled = false
    submitBtn.textContent = 'Save Item'
  }
}

async function handleDeleteItem(id) {
  try {
    const { error } = await db
      .from('menu_items')
      .delete()
      .eq('id', id)

    if (error) throw error
    showToast('Menu item deleted', 'success')
    await fetchItems()
    renderCategories() // refresh counts
  } catch (err) {
    console.error('Error deleting item', err)
    showToast('Failed to delete item', 'error')
  }
}

async function handleToggleAvailability(id, is_available) {
  try {
    const { error } = await db
      .from('menu_items')
      .update({ is_available })
      .eq('id', id)

    if (error) throw error
    showToast('Availability status updated', 'success')
    
    // update local state
    const idx = items.findIndex(i => i.id === id)
    if (idx !== -1) items[idx].is_available = is_available
  } catch (err) {
    console.error('Error toggling availability', err)
    showToast('Failed to update status', 'error')
  }
}

// ── Modals Controls ────────────────────────────────────────────────
function openCategoryModal(cat = null) {
  const modal = document.getElementById('modal-category')
  const title = document.getElementById('category-modal-title')
  
  if (cat) {
    title.textContent = 'Edit Category'
    document.getElementById('cat-id').value = cat.id
    document.getElementById('cat-name').value = cat.name
    document.getElementById('cat-sort').value = cat.sort_order
  } else {
    title.textContent = 'Add Category'
    document.getElementById('cat-id').value = ''
    document.getElementById('form-category').reset()
  }

  modal.classList.add('visible')
}

function closeCategoryModal() {
  document.getElementById('modal-category').classList.remove('visible')
}

function openItemModal(item = null) {
  const modal = document.getElementById('modal-item')
  const title = document.getElementById('item-modal-title')
  const preview = document.getElementById('item-img-preview')
  selectedFile = null

  if (item) {
    title.textContent = 'Edit Menu Item'
    document.getElementById('item-id').value = item.id
    document.getElementById('item-category').value = item.category_id
    document.getElementById('item-name').value = item.name
    document.getElementById('item-desc').value = item.description || ''
    document.getElementById('item-price').value = item.price
    document.getElementById('item-prep').value = item.preparation_time
    document.getElementById('item-featured').checked = item.is_featured
    
    if (item.image_url) {
      preview.innerHTML = `<img src="${item.image_url}" alt="Preview" />`
    } else {
      preview.innerHTML = `<span style="color:var(--text-muted);font-size:0.75rem;">No Image Uploaded</span>`
    }
  } else {
    title.textContent = 'Add Menu Item'
    document.getElementById('item-id').value = ''
    document.getElementById('form-item').reset()
    preview.innerHTML = `<span style="color:var(--text-muted);font-size:0.75rem;">No Image Uploaded</span>`
  }

  modal.classList.add('visible')
}

function closeItemModal() {
  document.getElementById('modal-item').classList.remove('visible')
}

// ── Event Listeners ────────────────────────────────────────────────
function setupEventListeners() {
  // Category modal
  document.getElementById('btn-add-category')?.addEventListener('click', () => openCategoryModal())
  document.getElementById('category-modal-close')?.addEventListener('click', closeCategoryModal)
  document.getElementById('btn-cancel-cat')?.addEventListener('click', closeCategoryModal)
  document.getElementById('form-category')?.addEventListener('submit', handleCategorySubmit)

  // Item modal
  document.getElementById('btn-add-item')?.addEventListener('click', () => openItemModal())
  document.getElementById('item-modal-close')?.addEventListener('click', closeItemModal)
  document.getElementById('btn-cancel-item')?.addEventListener('click', closeItemModal)
  document.getElementById('form-item')?.addEventListener('submit', handleItemSubmit)

  // Image input change handler
  const fileInput = document.getElementById('item-image-file')
  const preview = document.getElementById('item-img-preview')
  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0]
    if (file) {
      selectedFile = file
      const reader = new FileReader()
      reader.onload = (event) => {
        preview.innerHTML = `<img src="${event.target.result}" alt="Preview" />`
      }
      reader.readAsDataURL(file)
    }
  })
}

// Boot
initMenuPage()
