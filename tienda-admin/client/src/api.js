const TOKEN_KEY = 'tienda_admin_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  // 'No autorizado' es lo único que devuelve el middleware de sesión
  // (requireAuth) cuando el token falta o expiró. Otros 401 (PIN
  // incorrecto al iniciar sesión o al cambiarlo) traen su propio mensaje
  // y no deben tratarse como sesión vencida.
  if (res.status === 401 && data.error === 'No autorizado') {
    setToken(null);
    const err = new Error('Sesión expirada, vuelve a ingresar el PIN');
    err.status = 401;
    throw err;
  }

  if (!res.ok) {
    const err = new Error(data.error || 'Ocurrió un error');
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  login: (pin) => request('/auth/login', { method: 'POST', body: { pin }, auth: false }),
  changePin: (currentPin, newPin) =>
    request('/auth/change-pin', { method: 'POST', body: { currentPin, newPin } }),

  getProducts: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/products${qs ? `?${qs}` : ''}`);
  },
  getCategories: () => request('/products/categories'),
  createProduct: (data) => request('/products', { method: 'POST', body: data }),
  updateProduct: (id, data) => request(`/products/${id}`, { method: 'PUT', body: data }),
  deleteProduct: (id) => request(`/products/${id}`, { method: 'DELETE' }),

  getMovements: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/movements${qs ? `?${qs}` : ''}`);
  },
  createMovement: (data) => request('/movements', { method: 'POST', body: data }),

  getStats: () => request('/stats'),

  getMonthlyReport: (month) => request(`/reports/monthly?month=${month}`),
  getMonthlyAnalysis: (month) => request(`/reports/monthly/analysis?month=${month}`),
  generateMonthlyAnalysis: (month) =>
    request('/reports/monthly/analysis', { method: 'POST', body: { month } }),

  getCashEntries: (month) => request(`/cash?month=${month}`),
  createCashEntry: (data) => request('/cash', { method: 'POST', body: data }),
  deleteCashEntry: (id) => request(`/cash/${id}`, { method: 'DELETE' }),

  getAiSettings: () => request('/settings/ai'),
  saveAiApiKey: (apiKey) => request('/settings/ai', { method: 'POST', body: { apiKey } }),
  deleteAiApiKey: () => request('/settings/ai', { method: 'DELETE' }),

  lookupProductByCode: (code) => request(`/products/lookup?code=${encodeURIComponent(code)}`),

  downloadBackup: () => downloadFile('/settings/backup', `tienda-respaldo-${todayStamp()}.db`),
  exportProductsCsv: () => downloadFile('/products/export.csv', 'productos.csv'),
  exportMovementsCsv: () => downloadFile('/movements/export.csv', 'movimientos.csv'),
  exportCashCsv: () => downloadFile('/cash/export.csv', 'caja.csv'),
  restoreBackup: async (file) => {
    const token = getToken();
    const res = await fetch('/api/settings/restore', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: file,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || 'No se pudo restaurar el respaldo');
      err.status = res.status;
      throw err;
    }
    return data;
  },
  restartApp: () => request('/settings/restart-app', { method: 'POST' }),
};

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

async function downloadFile(path, filename) {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo descargar el archivo');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
