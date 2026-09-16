import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCaf, DOCUMENT_TYPE_LABELS } from '../../src/dte.js';

const VALID_CAF = `
<AUTORIZACION>
  <CAF version="1.0">
    <DA>
      <RE>76.123.456-7</RE>
      <RS>Almacen de Prueba SpA</RS>
      <TD>39</TD>
      <RNG><D>1</D><H>50</H></RNG>
      <FA>2026-01-01</FA>
    </DA>
    <FRMA algoritmo="SHA1withRSA">fake-signature</FRMA>
  </CAF>
</AUTORIZACION>`;

test('parseCaf lee rut, tipo de documento y rango de folios de un CAF válido', () => {
  const parsed = parseCaf(VALID_CAF);
  assert.equal(parsed.rut, '76.123.456-7');
  assert.equal(parsed.businessName, 'Almacen de Prueba SpA');
  assert.equal(parsed.documentType, 39);
  assert.equal(parsed.folioFrom, 1);
  assert.equal(parsed.folioTo, 50);
  assert.equal(parsed.authorizedAt, '2026-01-01');
});

test('parseCaf rechaza un XML sin las etiquetas mínimas', () => {
  assert.throws(() => parseCaf('<AUTORIZACION><CAF><DA></DA></CAF></AUTORIZACION>'), /formato de un CAF válido/);
});

test('parseCaf solo acepta boleta (39) o factura (33) electrónica', () => {
  const facturaCaf = VALID_CAF.replace('<TD>39</TD>', '<TD>33</TD>');
  assert.equal(parseCaf(facturaCaf).documentType, 33);

  const invalidTypeCaf = VALID_CAF.replace('<TD>39</TD>', '<TD>52</TD>');
  assert.throws(() => parseCaf(invalidTypeCaf), /boleta \(39\) o factura \(33\)/);
});

test('DOCUMENT_TYPE_LABELS tiene una etiqueta legible para cada tipo soportado', () => {
  assert.equal(DOCUMENT_TYPE_LABELS[39], 'Boleta electrónica');
  assert.equal(DOCUMENT_TYPE_LABELS[33], 'Factura electrónica');
});
