import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTax, TAX_CATEGORIES, isAlcoholCategory } from '../../src/tax.js';

test('computeTax: categoría general solo cobra el 19% de IVA', () => {
  const { neto, iva, adicional, total } = computeTax(1190, 'general');
  assert.equal(total, 1190);
  assert.ok(Math.abs(neto - 1000) < 0.01);
  assert.ok(Math.abs(iva - 190) < 0.01);
  assert.equal(adicional, 0);
});

test('computeTax: bebida azucarada suma IVA + 18% adicional', () => {
  const { neto, iva, adicional } = computeTax(1370, 'bebida_azucarada');
  // factor = 1 + 0.19 + 0.18 = 1.37 -> neto = 1000
  assert.ok(Math.abs(neto - 1000) < 0.01);
  assert.ok(Math.abs(iva - 190) < 0.01);
  assert.ok(Math.abs(adicional - 180) < 0.01);
});

test('computeTax: exento no cobra nada', () => {
  const { neto, iva, adicional, total } = computeTax(1000, 'exento');
  assert.equal(neto, 1000);
  assert.equal(iva, 0);
  assert.equal(adicional, 0);
  assert.equal(total, 1000);
});

test('computeTax: categoría desconocida cae a "general" por seguridad', () => {
  const result = computeTax(1190, 'no-existe');
  const expected = computeTax(1190, 'general');
  assert.deepEqual(result, expected);
});

test('isAlcoholCategory distingue las dos categorías de alcohol del resto', () => {
  assert.equal(isAlcoholCategory('alcohol_mas_20'), true);
  assert.equal(isAlcoholCategory('alcohol_hasta_20'), true);
  assert.equal(isAlcoholCategory('bebida_azucarada'), false);
  assert.equal(isAlcoholCategory('general'), false);
});

test('TAX_CATEGORIES cubre las 5 categorías que ofrece el formulario de producto', () => {
  assert.deepEqual(
    Object.keys(TAX_CATEGORIES).sort(),
    ['alcohol_hasta_20', 'alcohol_mas_20', 'bebida_azucarada', 'exento', 'general'].sort()
  );
});
