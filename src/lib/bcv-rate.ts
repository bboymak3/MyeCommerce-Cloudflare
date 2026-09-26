// Tasa oficial USD del BCV, publicada por https://github.com/Abrahanq/bcv-price
// (JSON publico, sin clave, actualizado por GitHub Actions). Se consulta solo
// desde el servidor, nunca desde el navegador.
const BCV_JSON_URL = 'https://raw.githubusercontent.com/Abrahanq/bcv-price/main/prices.json';

export interface BcvRateResult {
  usd: number;
  fecha: string;
}

/**
 * Obtiene la ultima tasa USD publicada. Lanza si no se pudo obtener un numero
 * valido; el llamador decide que hacer (nunca se aplica una tasa en 0 o NaN).
 */
export async function fetchBcvRate(): Promise<BcvRateResult> {
  const res = await fetch(BCV_JSON_URL, {
    headers: { 'User-Agent': 'MyeCommerce-POS' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`bcv-price respondio ${res.status}`);
  const data = await res.json() as { precios?: Array<{ fecha: string; usd: number; eur?: number }> };
  const precios = data.precios;
  if (!Array.isArray(precios) || precios.length === 0) throw new Error('bcv-price: respuesta sin precios');
  // La ultima cotizacion es la de fecha mas reciente, no necesariamente la ultima del arreglo
  const latest = [...precios].sort((a, b) => (a.fecha > b.fecha ? -1 : 1))[0];
  const usd = Number(latest.usd);
  if (!isFinite(usd) || usd <= 0) throw new Error('bcv-price: tasa USD invalida');
  return { usd, fecha: latest.fecha };
}
