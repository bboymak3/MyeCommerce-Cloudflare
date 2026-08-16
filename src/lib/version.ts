/**
 * Version centralizada del sistema.
 * Unico lugar donde se define la version — todos los demas archivos
 * deben importar de aqui en lugar de hardcodear el string.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

let cachedVersion: string | null = null;

export function getAppVersion(): string {
  if (cachedVersion) return cachedVersion;
  try {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
    cachedVersion = pkg.version || '0.0.0';
    return cachedVersion;
  } catch {
    return '0.0.0';
  }
}

/** Version formateada para UI: "v2.9.57" */
export function getAppVersionDisplay(): string {
  return `v${getAppVersion()}`;
}

/** Comparador de versiones semver simplificado: retorna >0 si a>b, <0 si a<b, 0 si iguales */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}
