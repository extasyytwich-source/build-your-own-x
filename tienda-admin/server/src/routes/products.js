import { Router } from 'express';
import { pool } from '../db.js';
import { toCsv, sendCsv } from '../csv.js';
import { broadcast } from '../events.js';
import { requireOwner } from '../auth.js';

export const productsRouter = Router();

function serializeProduct(row, variantRows = null) {
  const product = {
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
    parentProductId: row.parent_product_id,
    variantName: row.variant_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lowStock: row.stock <= row.min_stock,
  };

  // Un producto "padre" con variantes no tiene stock propio: se muestra el
  // total sumado de sus variantes, y queda "bajo" si cualquiera lo está.
  if (variantRows) {
    product.variants = variantRows.map((v) => serializeProduct(v));
    product.stock = product.variants.reduce((sum, v) => sum + Number(v.stock), 0);
    product.lowStock = product.variants.some((v) => v.lowStock);
  }

  return product;
}

// Filas realmente vendibles/con stock propio: productos independientes y
// cada variante — nunca la fila "padre" que solo agrupa variantes.
const SELLABLE_CLAUSE =
  'NOT EXISTS (SELECT 1 FROM products children WHERE children.parent_product_id = products.id)';

async function fetchVariants(productIds) {
  if (productIds.length === 0) return {};
  const { rows } = await pool.query(
    'SELECT * FROM products WHERE parent_product_id = ANY($1) ORDER BY variant_name ASC',
    [productIds]
  );
  const byParent = {};
  for (const row of rows) {
    (byParent[row.parent_product_id] ??= []).push(row);
  }
  return byParent;
}

const VALID_TAX_CATEGORIES = ['general', 'alcohol_mas_20', 'alcohol_hasta_20', 'bebida_azucarada', 'exento'];

const PRODUCT_EXPORT_COLUMNS = [
  { label: 'Nombre', value: (r) => r.name },
  { label: 'Variante', value: (r) => r.variant_name },
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
  const { search, category, sellable } = req.query;
  const params = [req.businessId];

  if (sellable) {
    const clauses = ['business_id = $1'];
    // Usado por Caja (buscar para el carrito) y el escáner: cada fila es
    // algo que realmente se puede vender/tiene stock propio.
    clauses.push(SELLABLE_CLAUSE);
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
    return res.json(rows.map((r) => serializeProduct(r)));
  }

  // Vista de administración (Productos): solo los productos de primer nivel,
  // con sus variantes (si tiene) anidadas — la búsqueda también encuentra un
  // producto por el nombre/SKU de alguna de sus variantes.
  const clauses = ['products.business_id = $1', 'products.parent_product_id IS NULL'];
  let joinClause = '';
  if (search) {
    const term = `%${search}%`;
    params.push(term);
    joinClause = 'LEFT JOIN products v ON v.parent_product_id = products.id';
    clauses.push(
      `(products.name ILIKE $${params.length} OR products.sku ILIKE $${params.length} OR v.name ILIKE $${params.length} OR v.sku ILIKE $${params.length} OR v.variant_name ILIKE $${params.length})`
    );
  }
  if (category) {
    params.push(category);
    clauses.push(`products.category = $${params.length}`);
  }

  const { rows } = await pool.query(
    `SELECT DISTINCT products.* FROM products ${joinClause} WHERE ${clauses.join(' AND ')} ORDER BY products.name ASC`,
    params
  );
  const variantsByParent = await fetchVariants(rows.map((r) => r.id));
  res.json(rows.map((r) => serializeProduct(r, variantsByParent[r.id] || null)));
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
    `SELECT * FROM products WHERE business_id = $1 AND LOWER(sku) = LOWER($2) AND ${SELLABLE_CLAUSE}`,
    [req.businessId, code]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Ningún producto tiene ese código' });
  res.json(serializeProduct(rows[0]));
});

productsRouter.get('/export.csv', requireOwner, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM products WHERE business_id = $1 AND ${SELLABLE_CLAUSE} ORDER BY name ASC`,
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
  if (rows[0].parent_product_id === null) {
    const variantsByParent = await fetchVariants([rows[0].id]);
    return res.json(serializeProduct(rows[0], variantsByParent[rows[0].id] || null));
  }
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

// Variante nueva (ej. "Talla M / Azul") de un producto ya existente. Es una
// fila más de products, con su propio SKU/precio/stock — hereda del padre
// lo que no se le indique (categoría, impuesto, foto, unidad, descripción)
// para no tener que repetirlo, pero puede pisarlo si se manda distinto.
productsRouter.post('/:id/variants', requireOwner, async (req, res) => {
  const { rows: parentRows } = await pool.query(
    'SELECT * FROM products WHERE business_id = $1 AND id = $2',
    [req.businessId, req.params.id]
  );
  const parent = parentRows[0];
  if (!parent) return res.status(404).json({ error: 'Producto no encontrado' });
  if (parent.parent_product_id !== null) {
    return res.status(400).json({ error: 'Una variante no puede tener sus propias variantes' });
  }

  const { variantName, sku, price, cost, stock, minStock } = req.body ?? {};
  if (!variantName || String(variantName).trim() === '') {
    return res.status(400).json({ error: 'El nombre de la variante es obligatorio (ej. Talla M / Azul)' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO products
        (business_id, name, sku, category, price, cost, stock, min_stock, unit, description, image_url, tax_category, parent_product_id, variant_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        req.businessId,
        `${parent.name} (${variantName.trim()})`,
        sku || null,
        parent.category,
        price !== undefined && price !== '' ? Number(price) : parent.price,
        cost !== undefined && cost !== '' ? Number(cost) : parent.cost,
        Number(stock) || 0,
        minStock !== undefined && minStock !== '' ? Number(minStock) : parent.min_stock,
        parent.unit,
        parent.description,
        parent.image_url,
        parent.tax_category,
        parent.id,
        variantName.trim(),
      ]
    );

    const variant = serializeProduct(rows[0]);
    broadcast(
      'product',
      { action: 'created', name: variant.name },
      req.headers['x-client-id'],
      req.businessId
    );
    res.status(201).json(variant);
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

  const { name, sku, category, price, cost, stock, minStock, unit, description, imageUrl, taxCategory, variantName } =
    req.body ?? {};

  const isVariant = existing.parent_product_id !== null;
  let newName = name?.trim() || existing.name;
  let newVariantName = existing.variant_name;

  if (isVariant) {
    // El nombre de una variante es siempre "<producto padre> (<variante>)" —
    // se recalcula a partir del nombre vigente del padre, no se edita suelto.
    if (variantName !== undefined && String(variantName).trim() !== '') {
      newVariantName = variantName.trim();
    }
    const { rows: parentRows } = await pool.query('SELECT name FROM products WHERE id = $1', [
      existing.parent_product_id,
    ]);
    newName = `${parentRows[0].name} (${newVariantName})`;
  }

  try {
    const { rows } = await pool.query(
      `UPDATE products SET
        name = $1, sku = $2, category = $3, price = $4, cost = $5,
        stock = $6, min_stock = $7, unit = $8, description = $9, image_url = $10,
        tax_category = $11, variant_name = $12, updated_at = now()
       WHERE business_id = $13 AND id = $14
       RETURNING *`,
      [
        newName,
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
        newVariantName,
        req.businessId,
        req.params.id,
      ]
    );

    // Si se renombró un producto con variantes, sus nombres (que incluyen el
    // del padre) quedan desactualizados — se re-sincronizan de una vez.
    if (!isVariant && rows[0].name !== existing.name) {
      await pool.query(
        `UPDATE products SET name = $1 || ' (' || variant_name || ')', updated_at = now()
         WHERE parent_product_id = $2`,
        [rows[0].name, rows[0].id]
      );
    }

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
