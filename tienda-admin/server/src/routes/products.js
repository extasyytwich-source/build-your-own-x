import { Router } from 'express';
import PDFDocument from 'pdfkit';
import bwipjs from 'bwip-js';
import { pool } from '../db.js';
import { toCsv, sendCsv } from '../csv.js';
import { broadcast } from '../events.js';
import { requireOwner } from '../auth.js';
import { resolveDefaultLocationId } from './movements.js';

export const productsRouter = Router();

function formatClp(n) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(n || 0);
}

async function renderBarcodePng(text) {
  return bwipjs.toBuffer({
    bcid: 'code128',
    text,
    scale: 3,
    height: 10,
    includetext: false,
    backgroundcolor: 'FFFFFF',
  });
}

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

// Hoja de etiquetas para imprimir y pegar en la tienda: nombre, precio y
// código de barras (a partir del SKU) de cada producto/variante elegido,
// repetido tantas veces como copias se pidan. Sin SKU no hay barras que
// generar — se avisa en la etiqueta en vez de bloquear toda la hoja.
productsRouter.get('/labels.pdf', requireOwner, async (req, res) => {
  const ids = String(req.query.ids || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length === 0) return res.status(400).json({ error: 'Selecciona al menos un producto' });

  const copies = Math.min(Math.max(Number(req.query.copies) || 1, 1), 50);

  const { rows } = await pool.query('SELECT * FROM products WHERE business_id = $1 AND id = ANY($2)', [
    req.businessId,
    ids,
  ]);
  if (rows.length === 0) return res.status(404).json({ error: 'No se encontraron productos' });

  const byId = new Map(rows.map((r) => [String(r.id), r]));
  const items = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (!row) continue;
    for (let i = 0; i < copies; i++) items.push(row);
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="etiquetas.pdf"');

  const doc = new PDFDocument({ size: 'A4', margin: 20 });
  doc.pipe(res);

  const cols = 3;
  const rowsPerPage = 8;
  const labelWidth = (doc.page.width - 40) / cols;
  const labelHeight = (doc.page.height - 40) / rowsPerPage;
  const perPage = cols * rowsPerPage;

  for (let i = 0; i < items.length; i++) {
    const product = items[i];
    const posInPage = i % perPage;
    if (i > 0 && posInPage === 0) doc.addPage();

    const col = posInPage % cols;
    const row = Math.floor(posInPage / cols);
    const x = 20 + col * labelWidth;
    const y = 20 + row * labelHeight;

    doc.rect(x, y, labelWidth, labelHeight).strokeColor('#ddd').lineWidth(0.5).stroke();

    doc
      .fillColor('#000')
      .fontSize(9)
      .text(product.name, x + 6, y + 6, { width: labelWidth - 12, height: 22, ellipsis: true });
    doc.fontSize(10).text(formatClp(product.price), x + 6, y + 24, { width: labelWidth - 12 });

    if (product.sku) {
      try {
        const png = await renderBarcodePng(product.sku);
        doc.image(png, x + 6, y + 42, { width: labelWidth - 12, height: labelHeight - 50 });
      } catch {
        doc.fontSize(7).fillColor('#999').text(`SKU: ${product.sku}`, x + 6, y + 45);
      }
    } else {
      doc
        .fontSize(7)
        .fillColor('#999')
        .text('Sin SKU — sin código de barras', x + 6, y + 45, { width: labelWidth - 12 });
    }
  }

  doc.end();
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

// Desglose por sucursal — lo usa el selector de ubicación al registrar un
// movimiento manual, para mostrar cuánto hay exactamente donde se va a
// ajustar (no el agregado de products.stock).
productsRouter.get('/:id/stock', async (req, res) => {
  const { rows: productRows } = await pool.query(
    'SELECT id FROM products WHERE business_id = $1 AND id = $2',
    [req.businessId, req.params.id]
  );
  if (!productRows[0]) return res.status(404).json({ error: 'Producto no encontrado' });

  const { rows } = await pool.query(
    `SELECT locations.id AS location_id, locations.name AS location_name,
       COALESCE(product_stock.stock, 0) AS stock
     FROM locations
     LEFT JOIN product_stock ON product_stock.location_id = locations.id AND product_stock.product_id = $2
     WHERE locations.business_id = $1
     ORDER BY locations.is_default DESC, locations.name ASC`,
    [req.businessId, req.params.id]
  );
  res.json(rows.map((r) => ({ locationId: r.location_id, locationName: r.location_name, stock: r.stock })));
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

    const defaultLocationId = await resolveDefaultLocationId(pool, req.businessId);
    await pool.query(
      'INSERT INTO product_stock (product_id, location_id, stock, min_stock) VALUES ($1, $2, $3, $4)',
      [rows[0].id, defaultLocationId, rows[0].stock, rows[0].min_stock]
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

    const defaultLocationId = await resolveDefaultLocationId(pool, req.businessId);
    await pool.query(
      'INSERT INTO product_stock (product_id, location_id, stock, min_stock) VALUES ($1, $2, $3, $4)',
      [rows[0].id, defaultLocationId, rows[0].stock, rows[0].min_stock]
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

  // El stock ya no se edita a mano acá — con varias ubicaciones no habría
  // forma de saber a cuál aplicarle un número suelto. Solo "Registrar
  // movimiento" (con su propia ubicación) puede cambiarlo.
  const newMinStock = minStock !== undefined ? Number(minStock) : existing.min_stock;

  try {
    const { rows } = await pool.query(
      `UPDATE products SET
        name = $1, sku = $2, category = $3, price = $4, cost = $5,
        min_stock = $6, unit = $7, description = $8, image_url = $9,
        tax_category = $10, variant_name = $11, updated_at = now()
       WHERE business_id = $12 AND id = $13
       RETURNING *`,
      [
        newName,
        sku ?? existing.sku,
        category ?? existing.category,
        price !== undefined ? Number(price) : existing.price,
        cost !== undefined ? Number(cost) : existing.cost,
        newMinStock,
        unit ?? existing.unit,
        description ?? existing.description,
        imageUrl ?? existing.image_url,
        VALID_TAX_CATEGORIES.includes(taxCategory) ? taxCategory : existing.tax_category,
        newVariantName,
        req.businessId,
        req.params.id,
      ]
    );

    if (newMinStock !== existing.min_stock) {
      await pool.query('UPDATE product_stock SET min_stock = $1 WHERE product_id = $2', [
        newMinStock,
        req.params.id,
      ]);
    }

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
