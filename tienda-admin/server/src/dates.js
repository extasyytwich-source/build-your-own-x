export function currentMonthStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// created_at/entry_date se guardan como texto ISO ('YYYY-MM-DD ...'), así que
// comparar como string contra el inicio/fin del mes funciona sin parsear fechas.
export function monthRange(month) {
  const match = /^(\d{4})-(\d{2})$/.exec(month || '');
  if (!match) {
    const err = new Error('Formato de mes inválido, usa YYYY-MM');
    err.status = 400;
    throw err;
  }
  const year = Number(match[1]);
  const mon = Number(match[2]);
  const start = `${month}-01`;
  const nextYear = mon === 12 ? year + 1 : year;
  const nextMonth = mon === 12 ? 1 : mon + 1;
  const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
  return { start, end };
}
