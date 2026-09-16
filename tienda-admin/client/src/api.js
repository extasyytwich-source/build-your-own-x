// Identifica esta pestaña/dispositivo frente a las demás conectadas al mismo
// panel (la caja, el teléfono, etc.), para que las actualizaciones en tiempo
// real no le muestren a cada quien un aviso de su propia acción.
export const CLIENT_ID =
  (typeof crypto !== 'undefined' && crypto.randomUUID?.()) || Math.random().toString(36).slice(2);

// La sesión vive en una cookie httpOnly que pone el servidor — este cliente
// nunca la lee ni la guarda (por diseño: así un XSS no podría robarla leyendo
// localStorage). "credentials: include" es lo que hace que el navegador la
// mande sola en cada pedido.
async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json', 'X-Client-Id': CLIENT_ID };

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  // 'No autorizado' es lo único que devuelve el middleware de sesión
  // (requireAuth) cuando la cookie falta o expiró. Otros 401 (contraseña
  // incorrecta al iniciar sesión o al cambiarla) traen su propio mensaje y
  // no deben tratarse como sesión vencida.
  if (res.status === 401 && data.error === 'No autorizado') {
    const err = new Error('Sesión expirada, vuelve a iniciar sesión');
    err.status = 401;
    throw err;
  }

  // 402: requireActiveSubscription bloqueó el pedido porque la suscripción
  // no está activa. No es un error de sesión, así que se deja pasar el
  // error normal (con status 402) para que la pantalla de suscripción lo
  // pueda distinguir.

  if (!res.ok) {
    const err = new Error(data.error || 'Ocurrió un error');
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  signup: (businessName, email, password) =>
    request('/auth/signup', { method: 'POST', body: { businessName, email, password } }),
  login: (identifier, password) => request('/auth/login', { method: 'POST', body: { identifier, password } }),
  loginWithGoogle: (credential, businessName) =>
    request('/auth/google', { method: 'POST', body: { credential, businessName } }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  getMe: () => request('/auth/me'),
  changePassword: (currentPassword, newPassword) =>
    request('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } }),

  getBillingStatus: () => request('/billing/status'),
  subscribe: () => request('/billing/subscribe', { method: 'POST' }),
  cancelSubscription: () => request('/billing/cancel', { method: 'POST' }),

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

  createSale: (data) => request('/sales', { method: 'POST', body: data }),
  viewSaleReceipt: (saleId) => openFile(`/sales/${saleId}/receipt.pdf`),

  getEmployees: () => request('/employees'),
  createEmployee: (data) => request('/employees', { method: 'POST', body: data }),
  deleteEmployee: (id) => request(`/employees/${id}`, { method: 'DELETE' }),

  getTelegramStatus: () => request('/telegram'),
  connectTelegram: () => request('/telegram/connect', { method: 'POST' }),
  disconnectTelegram: () => request('/telegram/disconnect', { method: 'POST' }),

  downloadBackup: () => downloadFile('/settings/backup', `mostrador-respaldo-${todayStamp()}.json`),
  exportProductsCsv: () => downloadFile('/products/export.csv', 'productos.csv'),
  exportMovementsCsv: () => downloadFile('/movements/export.csv', 'movimientos.csv'),
  exportCashCsv: () => downloadFile('/cash/export.csv', 'caja.csv'),
  restoreBackup: async (file) => {
    const text = await file.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('El archivo no es un respaldo válido (.json)');
    }
    return request('/settings/restore', { method: 'POST', body: parsed });
  },

  viewInvoice: (movementId) => openFile(`/movements/${movementId}/invoice.pdf`),
};

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

async function fetchAsBlob(path) {
  const res = await fetch(`/api${path}`, { credentials: 'include' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo descargar el archivo');
  }
  return res.blob();
}

async function downloadFile(path, filename) {
  const blob = await fetchAsBlob(path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Para ver un PDF en una pestaña nueva en vez de descargarlo directo.
async function openFile(path) {
  const blob = await fetchAsBlob(path);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
