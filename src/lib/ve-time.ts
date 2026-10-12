// Dias de negocio en hora de Venezuela (UTC-4 fijo, sin horario de verano).
// Cloudflare ejecuta en UTC: sin esto, "hoy" termina a las 8:00 pm de Caracas y
// las ventas de la noche caen en el cierre/reporte del dia siguiente.
// Sirve igual en el servidor y en el navegador.

const VE_OFFSET_MIN = 240;
const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Fecha 'YYYY-MM-DD' en Caracas del instante dado (por defecto, ahora). */
export function veDateKey(d: Date | string | number = new Date()): string {
  const t = new Date(d).getTime() - VE_OFFSET_MIN * 60000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Inicio (00:00 de Caracas) del dia 'YYYY-MM-DD'. Otro formato se interpreta tal cual. */
export function veDayStart(day: string): Date {
  return DAY_KEY_RE.test(day) ? new Date(`${day}T00:00:00.000-04:00`) : new Date(day);
}

/** Fin (23:59:59.999 de Caracas) del dia 'YYYY-MM-DD'. Otro formato se interpreta tal cual. */
export function veDayEnd(day: string): Date {
  return DAY_KEY_RE.test(day) ? new Date(`${day}T23:59:59.999-04:00`) : new Date(day);
}

/**
 * Ahora "de pared" en Caracas: sus getters locales (getFullYear, getDate, getDay...)
 * dan la fecha y hora de Venezuela, sea cual sea la zona del proceso.
 */
export function veWallNow(): Date {
  const now = new Date();
  return new Date(now.getTime() + (now.getTimezoneOffset() - VE_OFFSET_MIN) * 60000);
}

/** Convierte una fecha "de pared" de Caracas (armada con getters locales) al instante real. */
export function fromVeWall(d: Date): Date {
  return new Date(d.getTime() - (d.getTimezoneOffset() - VE_OFFSET_MIN) * 60000);
}
