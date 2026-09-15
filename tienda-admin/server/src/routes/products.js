import { Router } from 'express';
import { pool } from '../db.js';
import { toCsv, sendCsv } from '../csv.js';
import { broadcast } from '../events.js';
import { requireOwner } from '../auth.js';

export const productsRouter = Router();

function serializeProduct(row) {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    category: row.category,
    price: row.price,
    cost: row.cost,
    stock: row.stock,
    minStock: row.min_stock,
    unit: row.unit,
    description: row.description,
    imageUrl: row.image_url,
    taxCategory: row.tax_category,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lowStock: row.stock <= row.min_stock,
  };
}

const VALID_TAX_CATEGORIES = ['general', 'alcohol_mas_20', 'alcohol_hasta_20', 'bebida_azucarada', 'exento'];

const PRODUCT_EXPORT_COLUMNS = [
  { label: 'Nombre', value: (r) => r.name },
  { label: 'SKU', value: (r) => r.sku },
  { label: 'Categoría', value: (r) => r.category },
  { label: 'Precio', value: (r) => r.price },
  { label: 'Costo', value: (r) => r.cost },
  { label: 'Stock', value: (r) => r.stock },
  { label: 'Stock mínimo', value: (r) => r.min_stock },
  { label: 'Unidad', value: (r) => r.unit },
  { label: 'Descripción', value: (r) => r.description },
  { label: 'Categoría de impuesto', value: (r) => r.tax_category },
];

productsRouter.get('/', async (req, res) => {
  const { search, category } = req.query;
  const clauses = ['business_id = $1'];
  const params = [req.businessId];

  if (search) {
    const term = `%${search}%`;
    params.push(term, term);
    clauses.push(`(name ILIKE $${params.length - 1} OR sku ILIKE $${params.length})`);
  }
  if (category) {
    params.push(category);
    clauses.push(`category = $${params.length}`);
  }

  const { rows } = await pool.query(
    `SELECT * FROM products WHERE ${clauses.join(' AND ')} ORDER BY name ASC`,
    params
  );
  res.json(rows.map(serializeProduct));
});

productsRouter.get('/categories', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT DISTINCT category FROM products WHERE business_id = $1 ORDER BY category ASC',
    [req.businessId]
  );
  res.json(rows.map((r) => r.category));
});

// Búsqueda exacta por SKU: la usa el lector de código de barras, que escanea
// el código completo de una vez (a diferencia de la búsqueda por texto, que
// es parcial).
productsRouter.get('/lookup', async (req, res) => {
  const code = String(req.query.code || '').trim();
  if (!code) return res.status(400).json({ error: 'Falta el código' });

  const { rows } = await pool.query(
    'SELECT * FROM products WHERE business_id = $1 AND LOWER(sku) = LOWER($2)',
    [req.businessId, code]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Ningún producto tiene ese código' });
  res.json(serializeProduct(rows[0]));
});

productsRouter.get('/export.csv', requireOwner, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM products WHERE business_id = $1 ORDER BY name ASC',
    [req.businessId]
  );
  sendCsv(res, 'productos.csv', toCsv(rows, PRODUCT_EXPORT_COLUMNS));
});

productsRouter.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM products WHERE business_id = $1 AND id = $2', [
    req.businessId,
    req.params.id,
  ]);
  if (!rows[0]) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(serializeProduct(rows[0]));
});

productsRouter.post('/', requireOwner, async (req, res) => {
  const { name, sku, category, price, cost, stock, minStock, unit, description, imageUrl, taxCategory } =
    req.body ?? {};

  if (!name || String(name).trim() === '') {
    return res.status(400).json({ error: 'El nombre del producto es obligatorio' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO products
        (business_id, name, sku, category, price, cost, stock, min_stock, unit, description, image_url, tax_category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        req.businessId,
        name.trim(),
        sku || null,
        category || 'General',
        Number(price) || 0,
        Number(cost) || 0,
        Number(stock) || 0,
        Number(minStock) || 0,
        unit || 'unidad',
        description || null,
        imageUrl || null,
        VALID_TAX_CATEGORIES.includes(taxCategory) ? taxCategory : 'general',
      ]
    );

    const product = serializeProduct(rows[0]);
    broadcast(
      'product',
      { action: 'created', name: product.name },
      req.headers['x-client-id'],
      req.businessId
    );
    res.status(201).json(product);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un producto con ese SKU' });
    }
    throw err;
  }
});

productsRouter.put('/:id', requireOwner, async (req, res) => {
  const { rows: existingRows } = await pool.query(
    'SELECT * FROM products WHERE business_id = $1 AND id = $2',
    [req.businessId, req.params.id]
  );
  const existing = existingRows[0];
  if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });

  const { name, sku, category, price, cost, stock, minStock, unit, description, imageUrl, taxCategory } =
    req.body ?? {};

  try {
    const { rows } = await pool.query(
      `UPDATE products SET
        name = $1, sku = $2, category = $3, price = $4, cost = $5,
        stock = $6, min_stock = $7, unit = $8, description = $9, image_url = $10,
        tax_category = $11, updated_at = now()
       WHERE business_id = $12 AND id = $13
       RETURNING *`,
      [
        name?.trim() || existing.name,
        sku ?? existing.sku,
        category ?? existing.category,
        price !== undefined ? Number(price) : existing.price,
        cost !== undefined ? Number(cost) : existing.cost,
        stock !== undefined ? Number(stock) : existing.stock,
        minStock !== undefined ? Number(minStock) : existing.min_stock,
        unit ?? existing.unit,
        description ?? existing.description,
        imageUrl ?? existing.image_url,
        VALID_TAX_CATEGORIES.includes(taxCategory) ? taxCategory : existing.tax_category,
        req.businessId,
        req.params.id,
      ]
    );

    const product = serializeProduct(rows[0]);
    broadcast(
      'product',
      { action: 'updated', name: product.name },
      req.headers['x-client-id'],
      req.businessId
    );
    res.json(product);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un producto con ese SKU' });
    }
    throw err;
  }
});

productsRouter.delete('/:id', requireOwner, async (req, res) => {
  const { rows } = await pool.query(
    'DELETE FROM products WHERE business_id = $1 AND id = $2 RETURNING name',
    [req.businessId, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Producto no encontrado' });
  broadcast('product', { action: 'deleted', name: rows[0].name }, req.headers['x-client-id'], req.businessId);
  res.json({ ok: true });
});
