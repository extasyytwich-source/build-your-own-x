export function currentMonthStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Clave del día en UTC (sin manejo de zona horaria, igual que ya hace
// `movementsToday` en stats.js comparando contra `now()::date`).
export function todayDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

// Clave de semana ISO-8601 (lunes a domingo, semana 1 = la que contiene el
// primer jueves del año). Sirve para que el scheduler solo genere un
// reporte semanal por negocio por semana calendario, sin tener que llevar
// la cuenta de "cuántos días pasaron desde el último".
export function isoWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7; // lunes=1 ... domingo=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // mover al jueves de esta semana
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
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
