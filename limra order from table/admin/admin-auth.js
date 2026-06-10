// ================================================================
// LIMRA RMS — Admin Authentication Module
// ================================================================
import { createClient } from '@insforge/sdk'

const db = createClient(
  import.meta.env.VITE_INSFORGE_URL,
  import.meta.env.VITE_INSFORGE_KEY
)

const ALLOWED_ROLES = ['admin', 'manager', 'kitchen', 'cashier', 'waiter']

// ── Role-based redirect ───────────────────────────────────────────
function redirectByRole(role) {
  switch (role) {
    case 'kitchen':  window.location.href = './kitchen.html';   break
    case 'cashier':  window.location.href = './billing.html';   break
    case 'waiter':   window.location.href = './orders.html';    break
    default:         window.location.href = './dashboard.html'; break
  }
}

// ── On page load: check if already signed in ─────────────────────
async function checkExistingSession() {
  const role = sessionStorage.getItem('limra_role')
  if (role && ALLOWED_ROLES.includes(role)) {
    redirectByRole(role)
    return
  }

  // Verify with InsForge
  try {
    const { data: { user } } = await db.auth.getUser()
    if (!user) return

    const { data: roles, error } = await db
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)

    if (error || !roles?.length) return

    const role = roles[0].role
    if (ALLOWED_ROLES.includes(role)) {
      sessionStorage.setItem('limra_role',    role)
      sessionStorage.setItem('limra_user_id', user.id)
      sessionStorage.setItem('limra_email',   user.email)
      redirectByRole(role)
    }
  } catch (_) {
    // Not signed in — stay on login page
  }
}

// ── Show/hide error ───────────────────────────────────────────────
function showError(msg) {
  const el = document.getElementById('login-error')
  if (!el) return
  el.textContent = msg
  el.style.display = 'flex'
}
function hideError() {
  const el = document.getElementById('login-error')
  if (el) el.style.display = 'none'
}

// ── Login form submit handler ─────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault()
  hideError()

  const email    = document.getElementById('email')?.value?.trim()
  const password = document.getElementById('password')?.value
  const btn      = document.getElementById('login-btn')
  const spinner  = document.getElementById('btn-spinner')
  const btnText  = document.getElementById('btn-text')

  if (!email || !password) {
    showError('Please enter your email and password.')
    return
  }

  // Loading state
  btn.disabled = true
  spinner?.classList.remove('hidden')
  btnText && (btnText.textContent = 'Signing in…')

  try {
    // 1. Sign in
    const { data, error: authError } = await db.auth.signInWithPassword({ email, password })
    if (authError) throw authError

    const user = data.user
    if (!user) throw new Error('Authentication failed.')

    // 2. Fetch role
    const { data: roles, error: roleError } = await db
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)

    if (roleError) throw roleError
    if (!roles?.length) throw new Error('No role assigned to this account. Contact your administrator.')

    const role = roles[0].role
    if (!ALLOWED_ROLES.includes(role)) {
      throw new Error(`Role "${role}" is not authorized for admin access.`)
    }

    // 3. Persist to sessionStorage
    sessionStorage.setItem('limra_role',    role)
    sessionStorage.setItem('limra_user_id', user.id)
    sessionStorage.setItem('limra_email',   user.email)

    // 4. Redirect
    btnText && (btnText.textContent = 'Redirecting…')
    redirectByRole(role)

  } catch (err) {
    const msg = err.message || 'Login failed. Please try again.'
    showError(msg)
    btn.disabled = false
    spinner?.classList.add('hidden')
    btnText && (btnText.textContent = 'Sign In')
  }
}

// ── Boot ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Check existing session first
  checkExistingSession()

  // Bind form
  const form = document.getElementById('login-form')
  form?.addEventListener('submit', handleLogin)

  // Password visibility toggle
  const toggleBtn = document.getElementById('toggle-password')
  const passInput = document.getElementById('password')
  toggleBtn?.addEventListener('click', () => {
    if (!passInput) return
    const isText = passInput.type === 'text'
    passInput.type = isText ? 'password' : 'text'
    toggleBtn.textContent = isText ? '👁' : '🙈'
  })
})
