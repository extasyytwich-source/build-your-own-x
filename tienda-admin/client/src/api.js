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

  if (res.status === 401) {
    setToken(null);
    const err = new Error('Sesión expirada, vuelve a ingresar el PIN');
    err.status = 401;
    throw err;
  }

  const data = await res.json().catch(() => ({}));
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
};
