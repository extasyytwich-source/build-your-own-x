import { Router } from 'express';
import PDFDocument from 'pdfkit';
import { pool } from '../db.js';
import { broadcast } from '../events.js';
import { registerMovement } from './movements.js';
import { sendTelegramMessage } from '../telegram.js';

export const salesRouter = Router();

function formatClp(n) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(n || 0);
}

// Aparte de la respuesta al que cobró (que no necesita ver el costo/margen,
// menos todavía un cajero): un aviso al dueño con qué se vendió y cuánto
// ganó. No hace nada si el negocio no vinculó un chat de Telegram.
async function notifySaleByTelegram(businessId, lines, total, profit) {
  const { rows } = await pool.query('SELECT telegram_chat_id FROM businesses WHERE id = $1', [
    businessId,
  ]);
  const chatId = rows[0]?.telegram_chat_id;
  if (!chatId) return;

  const itemLines = lines
    .map((l) => `• ${l.quantity}x ${l.productName} — ${formatClp(l.unitPrice * l.quantity)}`)
    .join('\n');
  const text = `🛒 Nueva venta\n\n${itemLines}\n\nTotal: ${formatClp(total)}\nGanancia: ${formatClp(profit)}`;
  await sendTelegramMessage(chatId, text);
}

// Cobra varios productos de una vez (el carrito de Caja): cada línea se
// registra como la misma "salida" de siempre (mismo stock, mismo
// unit_price/unit_cost congelados), agrupadas bajo un ticket (`sales`) para
// poder emitir un solo recibo. Transaccional: si falta stock de cualquier
// línea, no se descuenta nada.
salesRouter.post('/', async (req, res) => {
  const { items, paymentMethod, amountReceived } = req.body ?? {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'El carrito está vacío' });
  }
  const method = paymentMethod === 'tarjeta' ? 'tarjeta' : 'efectivo';
  for (const item of items) {
    const qty = Number(item?.quantity);
    if (!item?.productId || !Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Cada línea del carrito necesita un producto y una cantidad válida' });
    }
  }

  const client = await pool.connect();
  let saleId, total, totalCost, lines;
  try {
    await client.query('BEGIN');
    const { rows: saleRows } = await client.query(
      `INSERT INTO sales (business_id, created_by, payment_method, amount_received, total)
       VALUES ($1, $2, $3, $4, 0) RETURNING id`,
      [req.businessId, req.userId, method, method === 'efectivo' ? Number(amountReceived) || null : null]
    );
    saleId = saleRows[0].id;

    total = 0;
    totalCost = 0;
    lines = [];
    for (const item of items) {
      const movement = await registerMovement(
        client,
        req.businessId,
        item.productId,
        'salida',
        Number(item.quantity),
        null,
        saleId
      );
      total += Number(movement.unit_price) * Number(movement.quantity);
      totalCost += Number(movement.unit_cost) * Number(movement.quantity);
      lines.push({ productName: movement.product_name, quantity: movement.quantity, unitPrice: movement.unit_price });
    }

    if (method === 'efectivo' && Number(amountReceived) < total) {
      const err = new Error('El monto recibido es menor al total de la venta');
      err.status = 400;
      throw err;
    }

    await client.query('UPDATE sales SET total = $1 WHERE id = $2', [total, saleId]);
    await client.query('COMMIT');

    broadcast('sale', { total, items: lines.length }, req.headers['x-client-id'], req.businessId);

    // El cajero no necesita ver el costo/margen en la respuesta — el aviso
    // de Telegram (solo al dueño, si vinculó un chat) sí lleva la ganancia.
    res.status(201).json({
      saleId,
      total,
      change: method === 'efectivo' ? Number(amountReceived) - total : null,
      items: lines,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(err.status || 500).json({ error: err.message || 'Error interno' });
    return;
  } finally {
    client.release();
  }

  notifySaleByTelegram(req.businessId, lines, total, total - totalCost).catch((err) => {
    console.error('Error avisando la venta por Telegram:', err.message);
  });
});

salesRouter.get('/:id/receipt.pdf', async (req, res) => {
  const { rows: saleRows } = await pool.query('SELECT * FROM sales WHERE id = $1 AND business_id = $2', [
    req.params.id,
    req.businessId,
  ]);
  const sale = saleRows[0];
  if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });

  const { rows: items } = await pool.query(
    `SELECT movements.quantity, movements.unit_price, products.name AS product_name
     FROM movements JOIN products ON products.id = movements.product_id
     WHERE movements.sale_id = $1
     ORDER BY movements.id ASC`,
    [sale.id]
  );

  const { rows: businessRows } = await pool.query('SELECT name FROM businesses WHERE id = $1', [
    req.businessId,
  ]);
  const businessName = businessRows[0]?.name || 'Mostrador';

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="venta-${sale.id}.pdf"`);

  const doc = new PDFDocument({ size: 'A5', margin: 40 });
  doc.pipe(res);

  doc.fontSize(18).text(businessName, { align: 'center' });
  doc.moveDown(0.2);
  doc.fontSize(10).fillColor('#666').text('Recibo de venta', { align: 'center' });
  doc.moveDown();

  doc.fillColor('#000').fontSize(10);
  doc.text(`Recibo N°: ${sale.id}`);
  doc.text(`Fecha: ${new Date(sale.created_at).toLocaleString('es-CL')}`);
  doc.moveDown();

  doc.fontSize(10).fillColor('#444');
  for (const item of items) {
    const subtotal = item.quantity * item.unit_price;
    doc.text(`${item.product_name}  x${item.quantity}`, { continued: true });
    doc.text(formatClp(subtotal), { align: 'right' });
  }
  doc.moveDown();

  doc.fillColor('#000').fontSize(13).text(`Total: ${formatClp(sale.total)}`, { align: 'right' });

  if (sale.payment_method === 'efectivo' && sale.amount_received) {
    doc.fontSize(9).fillColor('#666');
    doc.text(`Recibido: ${formatClp(sale.amount_received)}`, { align: 'right' });
    doc.text(`Vuelto: ${formatClp(sale.amount_received - sale.total)}`, { align: 'right' });
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
