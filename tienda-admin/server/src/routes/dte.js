import { Router } from 'express';
import PDFDocument from 'pdfkit';
import { pool } from '../db.js';
import { parseCaf, DOCUMENT_TYPE_LABELS } from '../dte.js';
import { computeTax } from '../tax.js';

export const dteRouter = Router();

function formatClp(n) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(n || 0);
}

function serializeSettings(row) {
  if (!row) {
    return { rut: '', businessName: '', giro: '', address: '', environment: 'certificacion' };
  }
  return {
    rut: row.rut || '',
    businessName: row.business_name || '',
    giro: row.giro || '',
    address: row.address || '',
    environment: row.environment,
  };
}

function serializeCaf(row) {
  return {
    id: row.id,
    documentType: row.document_type,
    documentTypeLabel: DOCUMENT_TYPE_LABELS[row.document_type],
    folioFrom: row.folio_from,
    folioTo: row.folio_to,
    nextFolio: row.next_folio,
    foliosLeft: row.folio_to - row.next_folio + 1,
    authorizedAt: row.authorized_at,
    uploadedAt: row.uploaded_at,
  };
}

dteRouter.get('/settings', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM dte_settings WHERE business_id = $1', [req.businessId]);
  res.json(serializeSettings(rows[0]));
});

dteRouter.put('/settings', async (req, res) => {
  const { rut, businessName, giro, address, environment } = req.body ?? {};
  const env = environment === 'produccion' ? 'produccion' : 'certificacion';

  const { rows } = await pool.query(
    `INSERT INTO dte_settings (business_id, rut, business_name, giro, address, environment, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (business_id) DO UPDATE SET
       rut = $2, business_name = $3, giro = $4, address = $5, environment = $6, updated_at = now()
     RETURNING *`,
    [req.businessId, rut || null, businessName || null, giro || null, address || null, env]
  );
  res.json(serializeSettings(rows[0]));
});

dteRouter.get('/cafs', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM dte_cafs WHERE business_id = $1 ORDER BY uploaded_at DESC',
    [req.businessId]
  );
  res.json(rows.map(serializeCaf));
});

// Sube un CAF (el XML que entrega el SII autorizando un rango de folios).
// No valida la firma del SII dentro del archivo — no hace falta para
// llevar la cuenta de folios locales, solo para timbrar de verdad.
dteRouter.post('/cafs', async (req, res) => {
  const { xml } = req.body ?? {};
  if (!xml || typeof xml !== 'string') {
    return res.status(400).json({ error: 'Falta el contenido del archivo CAF' });
  }

  let parsed;
  try {
    parsed = parseCaf(xml);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }

  const { rows } = await pool.query(
    `INSERT INTO dte_cafs (business_id, document_type, folio_from, folio_to, next_folio, authorized_at, raw_xml)
     VALUES ($1, $2, $3, $4, $3, $5, $6)
     RETURNING *`,
    [req.businessId, parsed.documentType, parsed.folioFrom, parsed.folioTo, parsed.authorizedAt, xml]
  );
  res.status(201).json(serializeCaf(rows[0]));
});

dteRouter.delete('/cafs/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM dte_cafs WHERE business_id = $1 AND id = $2 RETURNING id', [
      req.businessId,
      req.params.id,
    ]);
    if (!rows[0]) return res.status(404).json({ error: 'CAF no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({ error: 'No se puede eliminar: ya se generaron documentos con este CAF' });
    }
    throw err;
  }
});

// Genera el borrador de una boleta/factura para una venta: toma el próximo
// folio libre del CAF correspondiente. Queda como "borrador" — no es un
// documento tributario válido hasta completar la firma con el certificado
// digital del negocio (ver nota en Ajustes).
dteRouter.post('/documents', async (req, res) => {
  const { saleId, documentType } = req.body ?? {};
  const docType = Number(documentType) === 33 ? 33 : 39;
  if (!saleId) return res.status(400).json({ error: 'Falta la venta' });

  const { rows: saleRows } = await pool.query('SELECT * FROM sales WHERE business_id = $1 AND id = $2', [
    req.businessId,
    saleId,
  ]);
  const sale = saleRows[0];
  if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: cafRows } = await client.query(
      `SELECT * FROM dte_cafs WHERE business_id = $1 AND document_type = $2 AND next_folio <= folio_to
       ORDER BY uploaded_at ASC LIMIT 1 FOR UPDATE`,
      [req.businessId, docType]
    );
    const caf = cafRows[0];
    if (!caf) {
      const err = new Error(
        `No hay folios disponibles para ${DOCUMENT_TYPE_LABELS[docType]} — sube un CAF en Ajustes`
      );
      err.status = 400;
      throw err;
    }

    const folio = caf.next_folio;
    await client.query('UPDATE dte_cafs SET next_folio = next_folio + 1 WHERE id = $1', [caf.id]);

    const { rows: docRows } = await client.query(
      `INSERT INTO dte_documents (business_id, sale_id, document_type, folio, caf_id, total)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.businessId, saleId, docType, folio, caf.id, sale.total]
    );

    await client.query('COMMIT');
    res.status(201).json({
      id: docRows[0].id,
      documentType: docType,
      documentTypeLabel: DOCUMENT_TYPE_LABELS[docType],
      folio,
      status: 'borrador',
      total: sale.total,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(err.status || 500).json({ error: err.message || 'Error interno' });
  } finally {
    client.release();
  }
});

dteRouter.get('/documents', async (req, res) => {
  const { saleId } = req.query;
  const clauses = ['business_id = $1'];
  const params = [req.businessId];
  if (saleId) {
    params.push(saleId);
    clauses.push(`sale_id = $${params.length}`);
  }
  const { rows } = await pool.query(
    `SELECT * FROM dte_documents WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC`,
    params
  );
  res.json(
    rows.map((r) => ({
      id: r.id,
      saleId: r.sale_id,
      documentType: r.document_type,
      documentTypeLabel: DOCUMENT_TYPE_LABELS[r.document_type],
      folio: r.folio,
      status: r.status,
      total: r.total,
      createdAt: r.created_at,
    }))
  );
});

dteRouter.get('/documents/:id/pdf', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM dte_documents WHERE business_id = $1 AND id = $2', [
    req.businessId,
    req.params.id,
  ]);
  const doc = rows[0];
  if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });

  const { rows: settingsRows } = await pool.query('SELECT * FROM dte_settings WHERE business_id = $1', [
    req.businessId,
  ]);
  const settings = settingsRows[0];

  const { rows: businessRows } = await pool.query('SELECT name FROM businesses WHERE id = $1', [req.businessId]);
  const businessName = settings?.business_name || businessRows[0]?.name || 'Mostrador';

  const { rows: items } = await pool.query(
    `SELECT movements.quantity, movements.unit_price, products.name AS product_name, products.tax_category
     FROM movements JOIN products ON products.id = movements.product_id
     WHERE movements.sale_id = $1 ORDER BY movements.id ASC`,
    [doc.sale_id]
  );

  const totals = items.reduce(
    (acc, item) => {
      const { neto, iva, adicional } = computeTax(item.quantity * item.unit_price, item.tax_category);
      acc.neto += neto;
      acc.iva += iva;
      acc.adicional += adicional;
      return acc;
    },
    { neto: 0, iva: 0, adicional: 0 }
  );

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="dte-borrador-${doc.folio}.pdf"`);

  const pdf = new PDFDocument({ size: 'A5', margin: 40 });
  pdf.pipe(res);

  pdf
    .fontSize(9)
    .fillColor('#b45309')
    .rect(40, 40, pdf.page.width - 80, 20)
    .fill('#fef3c7');
  pdf
    .fillColor('#b45309')
    .fontSize(9)
    .text('BORRADOR — no es un documento tributario electrónico válido ante el SII', 44, 46, {
      width: pdf.page.width - 88,
    });
  pdf.moveDown(2);

  pdf.fillColor('#000').fontSize(16).text(businessName, { align: 'center' });
  if (settings?.rut) {
    pdf.fontSize(9).fillColor('#666').text(`RUT: ${settings.rut}`, { align: 'center' });
  }
  if (settings?.giro) {
    pdf.fontSize(9).fillColor('#666').text(settings.giro, { align: 'center' });
  }
  if (settings?.address) {
    pdf.fontSize(9).fillColor('#666').text(settings.address, { align: 'center' });
  }
  pdf.moveDown();

  pdf.fillColor('#000').fontSize(12).text(DOCUMENT_TYPE_LABELS[doc.document_type], { align: 'center' });
  pdf.fontSize(10).text(`Folio N° ${doc.folio}`, { align: 'center' });
  pdf.moveDown();

  pdf.fontSize(9).fillColor('#444');
  pdf.text(`Fecha: ${new Date(doc.created_at).toLocaleString('es-CL')}`);
  pdf.moveDown();

  for (const item of items) {
    const lineTotal = item.quantity * item.unit_price;
    pdf.text(`${item.product_name}  x${item.quantity}`, { continued: true });
    pdf.text(formatClp(lineTotal), { align: 'right' });
  }
  pdf.moveDown();

  pdf.fontSize(8).fillColor('#666');
  pdf.text(`Neto: ${formatClp(totals.neto)}`, { align: 'right' });
  pdf.text(`IVA: ${formatClp(totals.iva)}`, { align: 'right' });
  if (totals.adicional > 0) {
    pdf.text(`Impuesto adicional: ${formatClp(totals.adicional)}`, { align: 'right' });
  }
  pdf.moveDown(0.3);
  pdf.fillColor('#000').fontSize(13).text(`Total: ${formatClp(doc.total)}`, { align: 'right' });

  pdf.moveDown(2);
  pdf
    .fontSize(7)
    .fillColor('#999')
    .text(
      'Este borrador no incluye timbre electrónico (TED) ni firma digital — para emitir documentos válidos ante el SII, carga el certificado digital del negocio.',
      { align: 'center' }
    );

  pdf.end();
});
