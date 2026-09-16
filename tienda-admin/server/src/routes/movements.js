import { Router } from 'express';
import PDFDocument from 'pdfkit';
import { pool } from '../db.js';
import { toCsv, sendCsv } from '../csv.js';
import { broadcast } from '../events.js';

export const movementsRouter = Router();

function formatClp(n) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(n || 0);
}

function serializeMovement(row) {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    type: row.type,
    quantity: row.quantity,
    stockAfter: row.stock_after,
    note: row.note,
    createdAt: row.created_at,
    saleId: row.sale_id,
    refundId: row.refund_id,
    refunded: Boolean(row.refunded),
  };
}

const MOVEMENTS_QUERY = `
  SELECT movements.*, products.name AS product_name,
    EXISTS (SELECT 1 FROM movements r WHERE r.refunded_from_id = movements.id) AS refunded
  FROM movements
  JOIN products ON products.id = movements.product_id
`;

movementsRouter.get('/', async (req, res) => {
  const { productId, type, limit } = req.query;
  const clauses = ['movements.business_id = $1'];
  const params = [req.businessId];

  if (productId) {
    params.push(productId);
    clauses.push(`movements.product_id = $${params.length}`);
  }
  if (type) {
    params.push(type);
    clauses.push(`movements.type = $${params.length}`);
  }

  let query = `${MOVEMENTS_QUERY} WHERE ${clauses.join(' AND ')} ORDER BY movements.created_at DESC, movements.id DESC`;
  if (limit) query += ` LIMIT ${Math.min(Number(limit) || 50, 500)}`;

  const { rows } = await pool.query(query, params);
  res.json(rows.map(serializeMovement));
});

movementsRouter.get('/export.csv', async (req, res) => {
  const { rows } = await pool.query(
    `${MOVEMENTS_QUERY} WHERE movements.business_id = $1 ORDER BY movements.created_at DESC, movements.id DESC`,
    [req.businessId]
  );
  const csv = toCsv(rows, [
    { label: 'Fecha', value: (r) => r.created_at },
    { label: 'Producto', value: (r) => r.product_name },
    { label: 'Tipo', value: (r) => r.type },
    { label: 'Cantidad', value: (r) => r.quantity },
    { label: 'Stock resultante', value: (r) => r.stock_after },
    { label: 'Precio unitario', value: (r) => r.unit_price },
    { label: 'Costo unitario', value: (r) => r.unit_cost },
    { label: 'Nota', value: (r) => r.note },
  ]);
  sendCsv(res, 'movimientos.csv', csv);
});

// Exportada para que routes/sales.js y routes/purchaseOrders.js registren
// cada línea del carrito/orden como el mismo movimiento de siempre,
// etiquetado con el saleId o purchaseOrderId correspondiente.
// unitPriceOverride: precio ya resuelto (con descuentos de Caja aplicados,
// si los hay) que reemplaza el precio de catálogo del producto — así queda
// congelado en el movimiento y los reportes de IVA/ganancia (que leen
// unit_price de movements) reflejan el descuento sin ningún cambio.
export async function registerMovement(
  client,
  businessId,
  productId,
  type,
  quantity,
  note,
  {
    saleId = null,
    purchaseOrderId = null,
    unitPriceOverride = null,
    refundId = null,
    refundedFromId = null,
  } = {}
) {
  const { rows: productRows } = await client.query(
    'SELECT * FROM products WHERE business_id = $1 AND id = $2 FOR UPDATE',
    [businessId, productId]
  );
  const product = productRows[0];
  if (!product) {
    const err = new Error('Producto no encontrado');
    err.status = 404;
    throw err;
  }

  let newStock;
  if (type === 'entrada') newStock = product.stock + quantity;
  else if (type === 'salida') newStock = product.stock - quantity;
  else newStock = quantity; // ajuste: fija el stock al valor indicado

  if (newStock < 0) {
    const err = new Error(`No hay suficiente stock de "${product.name}" para esta salida`);
    err.status = 400;
    throw err;
  }

  await client.query('UPDATE products SET stock = $1, updated_at = now() WHERE id = $2', [
    newStock,
    productId,
  ]);

  const unitPrice = unitPriceOverride !== null ? unitPriceOverride : product.price;

  const { rows } = await client.query(
    `INSERT INTO movements (business_id, product_id, type, quantity, stock_after, note, unit_price, unit_cost, sale_id, purchase_order_id, refund_id, refunded_from_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id`,
    [
      businessId,
      productId,
      type,
      quantity,
      newStock,
      note || null,
      unitPrice,
      product.cost,
      saleId,
      purchaseOrderId,
      refundId,
      refundedFromId,
    ]
  );

  const { rows: joined } = await client.query(`${MOVEMENTS_QUERY} WHERE movements.id = $1`, [
    rows[0].id,
  ]);
  return joined[0];
}

movementsRouter.post('/', async (req, res) => {
  const { productId, type, quantity, note } = req.body ?? {};

  if (!productId || !type || quantity === undefined) {
    return res.status(400).json({ error: 'Faltan datos: producto, tipo y cantidad' });
  }
  if (!['entrada', 'salida', 'ajuste'].includes(type)) {
    return res.status(400).json({ error: 'Tipo de movimiento inválido' });
  }
  const qty = Number(quantity);
  if (Number.isNaN(qty) || qty < 0) {
    return res.status(400).json({ error: 'La cantidad debe ser un número válido' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const row = await registerMovement(client, req.businessId, productId, type, qty, note);
    await client.query('COMMIT');

    const movement = serializeMovement(row);
    broadcast(
      'movement',
      { productName: movement.productName, type: movement.type, quantity: movement.quantity },
      req.headers['x-client-id'],
      req.businessId
    );
    res.status(201).json(movement);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(err.status || 500).json({ error: err.message || 'Error interno' });
  } finally {
    client.release();
  }
});

// El PDF se arma al momento a partir del movimiento ya guardado: no hace
// falta una tabla de facturas propia porque el precio/costo vigentes ya
// quedaron congelados en la fila del movimiento en el momento de la venta.
movementsRouter.get('/:id/invoice.pdf', async (req, res) => {
  const { rows } = await pool.query(`${MOVEMENTS_QUERY} WHERE movements.business_id = $1 AND movements.id = $2`, [
    req.businessId,
    req.params.id,
  ]);
  const movement = rows[0];
  if (!movement) return res.status(404).json({ error: 'Movimiento no encontrado' });

  const { rows: businessRows } = await pool.query('SELECT name FROM businesses WHERE id = $1', [
    req.businessId,
  ]);
  const businessName = businessRows[0]?.name || 'Mostrador';
  const total = movement.quantity * movement.unit_price;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="recibo-${movement.id}.pdf"`);

  const doc = new PDFDocument({ size: 'A5', margin: 40 });
  doc.pipe(res);

  doc.fontSize(18).text(businessName, { align: 'center' });
  doc.moveDown(0.2);
  doc.fontSize(10).fillColor('#666').text('Recibo de venta', { align: 'center' });
  doc.moveDown();

  doc.fillColor('#000').fontSize(10);
  doc.text(`Recibo N°: ${movement.id}`);
  doc.text(`Fecha: ${new Date(movement.created_at).toLocaleString('es-CL')}`);
  doc.moveDown();

  doc.fontSize(12).text(movement.product_name);
  doc.fontSize(10).fillColor('#444');
  doc.text(`Cantidad: ${movement.quantity}`);
  doc.text(`Precio unitario: ${formatClp(movement.unit_price)}`);
  doc.moveDown();

  doc.fillColor('#000').fontSize(13).text(`Total: ${formatClp(total)}`, { align: 'right' });

  if (movement.note) {
    doc.moveDown();
    doc.fontSize(9).fillColor('#666').text(`Nota: ${movement.note}`);
  }

  doc.moveDown(2);
  doc
    .fontSize(8)
    .fillColor('#999')
    .text('Recibo generado por Mostrador — no válido como documento tributario.', {
      align: 'center',
    });

  doc.end();
});
