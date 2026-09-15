import { Router } from 'express';
import { db } from '../db.js';
import { toCsv, sendCsv } from '../csv.js';

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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lowStock: row.stock <= row.min_stock,
  };
}

productsRouter.get('/', (req, res) => {
  const { search, category } = req.query;
  let query = 'SELECT * FROM products';
  const clauses = [];
  const params = [];

  if (search) {
    clauses.push('(name LIKE ? OR sku LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (category) {
    clauses.push('category = ?');
    params.push(category);
  }
  if (clauses.length) query += ' WHERE ' + clauses.join(' AND ');
  query += ' ORDER BY name ASC';

  const rows = db.prepare(query).all(...params);
  res.json(rows.map(serializeProduct));
});

productsRouter.get('/categories', (req, res) => {
  const rows = db
    .prepare('SELECT DISTINCT category FROM products ORDER BY category ASC')
    .all();
  res.json(rows.map((r) => r.category));
});

// Búsqueda exacta por SKU: la usa el lector de código de barras, que escanea
// el código completo de una vez (a diferencia de la búsqueda por texto, que
// es parcial con LIKE).
productsRouter.get('/lookup', (req, res) => {
  const code = String(req.query.code || '').trim();
  if (!code) return res.status(400).json({ error: 'Falta el código' });
  const row = db.prepare('SELECT * FROM products WHERE sku = ? COLLATE NOCASE').get(code);
  if (!row) return res.status(404).json({ error: 'Ningún producto tiene ese código' });
  res.json(serializeProduct(row));
});

productsRouter.get('/export.csv', (req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY name ASC').all();
  const csv = toCsv(rows, [
    { label: 'Nombre', value: (r) => r.name },
    { label: 'SKU', value: (r) => r.sku },
    { label: 'Categoría', value: (r) => r.category },
    { label: 'Precio', value: (r) => r.price },
    { label: 'Costo', value: (r) => r.cost },
    { label: 'Stock', value: (r) => r.stock },
    { label: 'Stock mínimo', value: (r) => r.min_stock },
    { label: 'Unidad', value: (r) => r.unit },
    { label: 'Descripción', value: (r) => r.description },
  ]);
  sendCsv(res, 'productos.csv', csv);
});

productsRouter.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(serializeProduct(row));
});

productsRouter.post('/', (req, res) => {
  const { name, sku, category, price, cost, stock, minStock, unit, description, imageUrl } =
    req.body ?? {};

  if (!name || String(name).trim() === '') {
    return res.status(400).json({ error: 'El nombre del producto es obligatorio' });
  }

  try {
    const result = db
      .prepare(
        `INSERT INTO products (name, sku, category, price, cost, stock, min_stock, unit, description, image_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        name.trim(),
        sku || null,
        category || 'General',
        Number(price) || 0,
        Number(cost) || 0,
        Number(stock) || 0,
        Number(minStock) || 0,
        unit || 'unidad',
        description || null,
        imageUrl || null
      );

    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(serializeProduct(row));
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Ya existe un producto con ese SKU' });
    }
    throw err;
  }
});

productsRouter.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });

  const { name, sku, category, price, cost, stock, minStock, unit, description, imageUrl } =
    req.body ?? {};

  try {
    db.prepare(
      `UPDATE products SET
        name = ?, sku = ?, category = ?, price = ?, cost = ?,
        stock = ?, min_stock = ?, unit = ?, description = ?, image_url = ?,
        updated_at = datetime('now')
       WHERE id = ?`
    ).run(
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
      req.params.id
    );

    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    res.json(serializeProduct(row));
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Ya existe un producto con ese SKU' });
    }
    throw err;
  }
});

productsRouter.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Producto no encontrado' });
  }
  res.json({ ok: true });
});
