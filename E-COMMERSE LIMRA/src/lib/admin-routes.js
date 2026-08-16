export const ADMIN_LOGIN_PATH = '/admin-login.html';
export const ADMIN_DASHBOARD_PATH = '/admin.html';

export function getAdminLoginUrl(redirectTo = ADMIN_DASHBOARD_PATH) {
  const safe = redirectTo.startsWith('/') ? redirectTo : ADMIN_DASHBOARD_PATH;
  return `${ADMIN_LOGIN_PATH}?redirect=${encodeURIComponent(safe)}`;
}

export function getRedirectTarget(fallback = ADMIN_DASHBOARD_PATH) {
  const param = new URLSearchParams(window.location.search).get('redirect');
  if (!param || !param.startsWith('/') || param.startsWith('//')) return fallback;
  return param;
}

export function getAuthRedirectUrl(customPath) {
  const targetPath = customPath || window.location.pathname || '/admin-login.html';
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const origin = isLocal ? 'http://localhost:5173' : window.location.origin;
  const pathWithSlash = targetPath.startsWith('/') ? targetPath : '/' + targetPath;
  return `${origin}${pathWithSlash}`;
}
