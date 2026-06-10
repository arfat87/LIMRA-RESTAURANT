// ================================================================
// LIMRA RMS — Shared Admin Layout Utilities
// ================================================================

// ── Role helpers ──────────────────────────────────────────────────
/** Returns the current user's role from sessionStorage */
export function getRole() {
  return sessionStorage.getItem('limra_role') || null
}

export function getUserId() {
  return sessionStorage.getItem('limra_user_id') || null
}

export function getUserEmail() {
  return sessionStorage.getItem('limra_email') || null
}

/** Allowed roles for any admin page */
const ALLOWED_ROLES = ['admin', 'manager', 'kitchen', 'cashier', 'waiter']

/** Roles allowed per page (filename → roles) */
const PAGE_ROLES = {
  'dashboard.html':  ['admin', 'manager'],
  'kitchen.html':    ['admin', 'manager', 'kitchen'],
  'billing.html':    ['admin', 'manager', 'cashier'],
  'orders.html':     ['admin', 'manager', 'waiter'],
  'tables.html':     ['admin', 'manager', 'waiter'],
  'menu.html':       ['admin', 'manager'],
  'reports.html':    ['admin', 'manager'],
  'settings.html':   ['admin', 'manager'],
}

/**
 * Auth guard — call at the top of each admin page's JS.
 * Redirects to login if no valid role is stored.
 */
export function authGuard() {
  const role = getRole()
  if (!role || !ALLOWED_ROLES.includes(role)) {
    window.location.href = '/admin/index.html'
    return false
  }
  // Page-level guard
  const page = window.location.pathname.split('/').pop()
  const allowed = PAGE_ROLES[page]
  if (allowed && !allowed.includes(role)) {
    // Redirect to appropriate landing page
    const dest = role === 'kitchen' ? 'kitchen.html'
               : role === 'cashier' ? 'billing.html'
               : role === 'waiter'  ? 'orders.html'
               : 'dashboard.html'
    window.location.href = dest
    return false
  }
  return true
}

// ── Toast Notifications ───────────────────────────────────────────
let toastContainer = null

function ensureToastContainer() {
  if (toastContainer) return toastContainer
  toastContainer = document.getElementById('toast-container')
  if (!toastContainer) {
    toastContainer = document.createElement('div')
    toastContainer.id = 'toast-container'
    document.body.appendChild(toastContainer)
  }
  return toastContainer
}

const TOAST_ICONS = {
  success: '✅',
  error:   '❌',
  info:    '🔔',
  warning: '⚠️',
}

/**
 * Show a toast notification.
 * @param {string} msg   - Message text
 * @param {'success'|'error'|'info'|'warning'} type
 * @param {number} duration - ms before auto-dismiss (default 4000)
 */
export function showToast(msg, type = 'info', duration = 4000) {
  const container = ensureToastContainer()
  const toast = document.createElement('div')
  toast.className = `toast toast-${type}`
  toast.innerHTML = `
    <span style="font-size:1.1rem;flex-shrink:0">${TOAST_ICONS[type] || '🔔'}</span>
    <span style="flex:1;color:var(--text-primary);line-height:1.4">${msg}</span>
    <button onclick="this.closest('.toast').remove()" style="background:none;border:none;color:var(--text-muted);font-size:1rem;cursor:pointer;flex-shrink:0;padding:0 0 0 0.5rem">&times;</button>
  `
  container.appendChild(toast)
  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease'
    toast.style.opacity    = '0'
    toast.style.transform  = 'translateX(100%)'
    setTimeout(() => toast.remove(), 300)
  }, duration)
}

// ── Audio Alert (Web Audio API) ───────────────────────────────────
let audioCtx = null

/**
 * Play a notification beep using the Web Audio API.
 * @param {'order'|'waiter'|'bill'} type
 */
export function playAlert(type = 'order') {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const ctx = audioCtx

    const patterns = {
      order:  [{ freq: 880, dur: 0.12, delay: 0 }, { freq: 1100, dur: 0.12, delay: 0.15 }, { freq: 1320, dur: 0.18, delay: 0.30 }],
      waiter: [{ freq: 660, dur: 0.15, delay: 0 }, { freq: 660, dur: 0.15, delay: 0.2  }],
      bill:   [{ freq: 440, dur: 0.1,  delay: 0 }, { freq: 550, dur: 0.1,  delay: 0.12 }, { freq: 440, dur: 0.1, delay: 0.24 }],
    }

    const notes = patterns[type] || patterns.order
    const now   = ctx.currentTime

    notes.forEach(({ freq, dur, delay }) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type      = 'sine'
      osc.frequency.setValueAtTime(freq, now + delay)
      gain.gain.setValueAtTime(0.35, now + delay)
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + dur)
      osc.start(now + delay)
      osc.stop(now + delay + dur + 0.05)
    })
  } catch (e) {
    // Audio not available or blocked — fail silently
    console.warn('playAlert:', e.message)
  }
}

// ── Sidebar toggle ────────────────────────────────────────────────
function initSidebar() {
  const sidebar   = document.getElementById('admin-sidebar')
  const hamburger = document.getElementById('hamburger-btn')
  const overlay   = document.getElementById('sidebar-overlay')

  if (!sidebar) return

  function openSidebar() {
    sidebar.classList.add('open')
    if (overlay) overlay.classList.add('visible')
    document.body.style.overflow = 'hidden'
  }
  function closeSidebar() {
    sidebar.classList.remove('open')
    if (overlay) overlay.classList.remove('visible')
    document.body.style.overflow = ''
  }

  hamburger?.addEventListener('click', () => {
    sidebar.classList.contains('open') ? closeSidebar() : openSidebar()
  })
  overlay?.addEventListener('click', closeSidebar)

  // Close on nav click on mobile
  sidebar.querySelectorAll('.sidebar-nav-link').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 1024) closeSidebar()
    })
  })
}

// ── Active nav link ───────────────────────────────────────────────
function initActiveNav() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html'
  document.querySelectorAll('.sidebar-nav-link[data-page]').forEach(link => {
    if (link.dataset.page === currentPage) {
      link.classList.add('active')
    }
  })
}

// ── Live clock ────────────────────────────────────────────────────
function initClock() {
  const el = document.getElementById('live-clock')
  if (!el) return

  function tick() {
    const now = new Date()
    el.textContent = now.toLocaleTimeString('en-IN', {
      hour:   '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  }
  tick()
  setInterval(tick, 1000)
}

// ── initAdminLayout ───────────────────────────────────────────────
/**
 * Call once per admin page after DOM is ready.
 * Sets up sidebar, active nav, and live clock.
 */
export function initAdminLayout() {
  authGuard()
  initSidebar()
  initActiveNav()
  initClock()

  // Inject sidebar overlay if missing
  if (!document.getElementById('sidebar-overlay')) {
    const overlay = document.createElement('div')
    overlay.id = 'sidebar-overlay'
    overlay.style.cssText = `
      display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);
      z-index:49;backdrop-filter:blur(2px);transition:opacity 0.25s ease;
    `
    overlay.addEventListener('click', () => {
      document.getElementById('admin-sidebar')?.classList.remove('open')
      overlay.classList.remove('visible')
      document.body.style.overflow = ''
    })
    document.body.appendChild(overlay)
  }

  // Toggle overlay display via class
  const style = document.createElement('style')
  style.textContent = `
    #sidebar-overlay { display:none; }
    #sidebar-overlay.visible { display:block; }
  `
  document.head.appendChild(style)

  // Ensure toast container exists
  ensureToastContainer()
}
