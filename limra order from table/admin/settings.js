// ================================================================
// LIMRA RMS — Settings & QR Generator Logic
// admin/settings.js
// ================================================================
import { db } from '../src/lib/insforge.js'
import { initAdminLayout, showToast } from './admin-layout.js'

// Initialize Admin Layout UI
initAdminLayout()

// ── Bootstrapping ──────────────────────────────────────────────────
async function initSettings() {
  loadEnvSettings()
  await fetchGstSettings()
  generateQrGrid()
  setupEventListeners()
}

// ── Load Settings from Env ─────────────────────────────────────────
function loadEnvSettings() {
  const nameEl = document.getElementById('display-name')
  const phoneEl = document.getElementById('display-phone')
  const emailEl = document.getElementById('display-email')

  if (nameEl) nameEl.value = import.meta.env.VITE_RESTAURANT_NAME || 'LIMRA Restaurant'
  if (phoneEl) phoneEl.value = import.meta.env.VITE_RESTAURANT_PHONE || '+91 97390 83418'
  if (emailEl) emailEl.value = import.meta.env.VITE_RESTAURANT_EMAIL || 'limrarestaurant99@gmail.com'
}

// ── Fetch & Save GST Tax Settings ──────────────────────────────────
async function fetchGstSettings() {
  try {
    const { data, error } = await db
      .from('restaurant_settings')
      .select('gst_rate')
      .eq('id', 1)
      .single()

    if (error && error.code !== 'PGRST116') throw error // PGRST116 is empty row

    if (data) {
      document.getElementById('gst-rate').value = data.gst_rate
    } else {
      // Default fallback
      document.getElementById('gst-rate').value = 5.00
    }
  } catch (err) {
    console.error('Error fetching settings', err)
    showToast('Failed to load GST rate setting', 'error')
  }
}

async function handleSettingsSubmit(e) {
  e.preventDefault()
  const gst_rate = parseFloat(document.getElementById('gst-rate').value)
  const saveBtn = document.getElementById('btn-save-settings')

  if (isNaN(gst_rate) || gst_rate < 0) {
    showToast('Invalid GST tax rate', 'error')
    return
  }

  saveBtn.disabled = true
  saveBtn.textContent = 'Saving…'

  try {
    // Upsert settings row
    const { error } = await db
      .from('restaurant_settings')
      .upsert({ id: 1, gst_rate })

    if (error) throw error
    showToast('Settings saved successfully', 'success')
  } catch (err) {
    console.error('Error saving settings', err)
    showToast('Failed to save settings', 'error')
  } finally {
    saveBtn.disabled = false
    saveBtn.textContent = 'Save Settings'
  }
}

// ── Generate QR Code Grid ──────────────────────────────────────────
function generateQrGrid() {
  const grid = document.getElementById('qr-grid')
  if (!grid) return

  const siteUrl = import.meta.env.VITE_SITE_URL || 'https://limraresturent.in'
  
  let gridHTML = ''
  for (let i = 1; i <= 19; i++) {
    const tableLink = `${siteUrl}/table/${i}`
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(tableLink)}`
    const isOutdoor = i >= 10
    const label = `Table ${i} (${isOutdoor ? 'Outdoor' : 'Indoor'})`

    gridHTML += `
      <div class="qr-card" data-number="${i}">
        <span class="qr-card-title">${label}</span>
        <div class="qr-img-wrap">
          <img src="${qrApiUrl}" alt="Table ${i} QR" loading="lazy" />
        </div>
        <button class="btn btn-outline btn-sm download-qr-btn" data-number="${i}" data-link="${tableLink}" style="padding:0.25rem 0.5rem; font-size:0.75rem; width:100%;">
          ⬇️ Download
        </button>
      </div>
    `
  }

  grid.innerHTML = gridHTML

  // Add click handlers for downloads
  grid.querySelectorAll('.download-qr-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tableNumber = btn.dataset.number
      const link = btn.dataset.link
      downloadQrCode(tableNumber, link)
    })
  })
}

// ── Download Individual QR Code ─────────────────────────────────────
async function downloadQrCode(tableNumber, link) {
  try {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(link)}`
    showToast(`Downloading QR for Table ${tableNumber}…`, 'info')
    
    const response = await fetch(qrUrl)
    const blob = await response.blob()
    const dlUrl = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = dlUrl
    a.download = `limra-table-${tableNumber}-qr.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(dlUrl)
  } catch (err) {
    console.error('Error downloading QR', err)
    showToast('Failed to download QR code', 'error')
  }
}

// ── Print QRs Layout ───────────────────────────────────────────────
function setupPrintLayout() {
  const printArea = document.getElementById('print-area')
  if (!printArea) return

  const siteUrl = import.meta.env.VITE_SITE_URL || 'https://limraresturent.in'
  
  let printHTML = ''
  
  // Arrange QRs in pages of 4 items each (2x2 grid per print page)
  for (let page = 0; page < 5; page++) {
    const start = page * 4 + 1
    const end = Math.min(start + 3, 19)
    
    if (start > 19) break

    printHTML += `<div class="print-qr-page">`
    for (let i = start; i <= end; i++) {
      const tableLink = `${siteUrl}/table/${i}`
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(tableLink)}`
      const isOutdoor = i >= 10
      const area = isOutdoor ? 'OUTDOOR' : 'INDOOR'

      printHTML += `
        <div class="print-qr-item">
          <div style="font-family:'Playfair Display', serif; font-size:1.4rem; font-weight:800; color:#c8860a; letter-spacing:0.05em; margin-bottom:5px;">LIMRA</div>
          <div class="print-qr-sub" style="margin-bottom:10px;">RESTAURANT</div>
          <img class="print-qr-img" src="${qrApiUrl}" alt="Table ${i}" />
          <div class="print-qr-label">TABLE ${i}</div>
          <div class="print-qr-sub">${area} AREA</div>
          <div style="font-size:0.55rem; color:#888; margin-top:5px; font-family:'Inter',sans-serif;">Scan to view menu & order food</div>
        </div>
      `
    }
    printHTML += `</div>`
  }

  printArea.innerHTML = printHTML
}

// ── Event Listeners ────────────────────────────────────────────────
function setupEventListeners() {
  document.getElementById('form-settings')?.addEventListener('submit', handleSettingsSubmit)
  
  document.getElementById('btn-print-qrs')?.addEventListener('click', () => {
    setupPrintLayout()
    // Give images a split second to load before printing
    showToast('Preparing print layout...', 'info')
    setTimeout(() => {
      window.print()
    }, 800)
  })
}

// Boot
initSettings()
