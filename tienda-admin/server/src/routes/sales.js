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
async function notifySaleByTelegram(businessId, lines, total, profit, discount = 0) {
  const { rows } = await pool.query('SELECT telegram_chat_id FROM businesses WHERE id = $1', [
    businessId,
  ]);
  const chatId = rows[0]?.telegram_chat_id;
  if (!chatId) return;

  const itemLines = lines
    .map((l) => `• ${l.quantity}x ${l.productName} — ${formatClp(l.unitPrice * l.quantity)}`)
    .join('\n');
  const discountLine = discount > 0 ? `\nDescuento: -${formatClp(discount)}` : '';
  const text = `🛒 Nueva venta\n\n${itemLines}${discountLine}\n\nTotal: ${formatClp(total)}\nGanancia: ${formatClp(profit)}`;
  await sendTelegramMessage(chatId, text);
}

const DISCOUNT_TYPES = ['percent', 'fixed'];

function isValidDiscount(discount) {
  if (discount === undefined || discount === null) return true;
  return (
    typeof discount === 'object' &&
    DISCOUNT_TYPES.includes(discount.type) &&
    Number.isFinite(Number(discount.value)) &&
    Number(discount.value) >= 0
  );
}

// Convierte un descuento (% o monto fijo) en un monto en pesos, sin dejar
// que se pase del total que está descontando ni que quede negativo.
function resolveDiscountAmount(baseAmount, discount) {
  if (!discount || !Number(discount.value)) return 0;
  const value = Number(discount.value);
  const amount = discount.type === 'percent' ? baseAmount * (value / 100) : value;
  return Math.min(Math.max(amount, 0), baseAmount);
}

// Cobra varios productos de una vez (el carrito de Caja): cada línea se
// registra como la misma "salida" de siempre (mismo stock, mismo
// unit_cost congelado), agrupadas bajo un ticket (`sales`) para poder
// emitir un solo recibo. Transaccional: si falta stock de cualquier línea,
// no se descuenta nada.
//
// Descuentos: cada línea puede traer su propio descuento (% o monto fijo),
// y además puede haber un descuento sobre el total del carrito. El de línea
// se aplica primero; el del total se reparte proporcionalmente entre las
// líneas ya descontadas, así el unit_price que queda congelado en cada
// movimiento es el precio neto realmente cobrado — sin eso, los reportes de
// IVA/ganancia (que leen unit_price de movements) no necesitan tocarse.
salesRouter.post('/', async (req, res) => {
  const { items, paymentMethod, amountReceived, discount, locationId } = req.body ?? {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'El carrito está vacío' });
  }
  const method = paymentMethod === 'tarjeta' ? 'tarjeta' : 'efectivo';
  if (!isValidDiscount(discount)) {
    return res.status(400).json({ error: 'Descuento inválido' });
  }
  for (const item of items) {
    const qty = Number(item?.quantity);
    if (!item?.productId || !Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Cada línea del carrito necesita un producto y una cantidad válida' });
    }
    if (!isValidDiscount(item.discount)) {
      return res.status(400).json({ error: 'Descuento inválido' });
    }
  }

  const client = await pool.connect();
  let saleId, total, totalCost, totalDiscount, lines;
  try {
    await client.query('BEGIN');
    const { rows: saleRows } = await client.query(
      `INSERT INTO sales (business_id, created_by, payment_method, amount_received, total)
       VALUES ($1, $2, $3, $4, 0) RETURNING id`,
      [req.businessId, req.userId, method, method === 'efectivo' ? Number(amountReceived) || null : null]
    );
    saleId = saleRows[0].id;

    const { rows: productRows } = await client.query(
      'SELECT id, price FROM products WHERE business_id = $1 AND id = ANY($2)',
      [req.businessId, items.map((i) => i.productId)]
    );
    const priceById = new Map(productRows.map((p) => [p.id, Number(p.price)]));

    // 1) descuento de línea: precio neto por unidad de cada producto.
    const lineUnitPrices = items.map((item) => {
      const qty = Number(item.quantity);
      const basePrice = priceById.get(item.productId) ?? 0;
      const lineDiscount = resolveDiscountAmount(basePrice * qty, item.discount);
      return (basePrice * qty - lineDiscount) / qty;
    });
    const subtotal = items.reduce((sum, item, i) => sum + lineUnitPrices[i] * Number(item.quantity), 0);

    // 2) descuento del total: se reparte proporcionalmente para que el
    // precio neto de cada producto (y su impuesto) quede correcto.
    totalDiscount = resolveDiscountAmount(subtotal, discount);
    const shareLeft = subtotal > 0 ? 1 - totalDiscount / subtotal : 1;

    total = 0;
    totalCost = 0;
    lines = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const finalUnitPrice = lineUnitPrices[i] * shareLeft;
      const movement = await registerMovement(
        client,
        req.businessId,
        item.productId,
        'salida',
        Number(item.quantity),
        null,
        { saleId, unitPriceOverride: finalUnitPrice, locationId }
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

    await client.query('UPDATE sales SET total = $1, discount_amount = $2 WHERE id = $3', [
      total,
      totalDiscount,
      saleId,
    ]);
    await client.query('COMMIT');

    broadcast('sale', { total, items: lines.length }, req.headers['x-client-id'], req.businessId);

    // El cajero no necesita ver el costo/margen en la respuesta — el aviso
    // de Telegram (solo al dueño, si vinculó un chat) sí lleva la ganancia.
    res.status(201).json({
      saleId,
      total,
      discount: totalDiscount,
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

  notifySaleByTelegram(req.businessId, lines, total, total - totalCost, totalDiscount).catch((err) => {
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
  let itemsTotal = 0;
  for (const item of items) {
    const lineTotal = item.quantity * item.unit_price;
    itemsTotal += lineTotal;
    doc.text(`${item.product_name}  x${item.quantity}`, { continued: true });
    doc.text(formatClp(lineTotal), { align: 'right' });
  }
  doc.moveDown();

  if (Number(sale.discount_amount) > 0) {
    doc.fontSize(10).fillColor('#666');
    doc.text(`Subtotal: ${formatClp(itemsTotal + Number(sale.discount_amount))}`, { align: 'right' });
    doc.text(`Descuento: -${formatClp(sale.discount_amount)}`, { align: 'right' });
    doc.moveDown(0.3);
  }

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
