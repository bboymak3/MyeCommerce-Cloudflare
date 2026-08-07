// Generador de Fingerprint de Máquina
// Identifica de forma única cada computadora
// Funciona 100% offline - No necesita internet

import { execSync } from 'child_process';
import { hostname, platform, arch, cpus, totalmem, userInfo } from 'os';
import { createHash } from 'crypto';

let cachedMachineId: string | null = null;

/**
 * Genera un ID único basado en características del hardware.
 * Este ID es consistente entre reinicios pero cambia si se
 * reemplaza componentes principales (disco, CPU, motherboard).
 */
export function getMachineId(): string {
  if (cachedMachineId) return cachedMachineId;

  try {
    const components: string[] = [];

    // 1. Hostname de la máquina
    components.push(hostname());

    // 2. Plataforma y arquitectura
    components.push(platform());
    components.push(arch());

    // 3. Información del procesador
    try {
      const cpuInfo = cpus()[0]?.model || 'unknown-cpu';
      components.push(cpuInfo.replace(/\s+/g, ' ').trim());
    } catch {
      components.push('unknown-cpu');
    }

    // 4. Número de núcleos
    components.push(String(cpus().length));

    // 5. Memoria total (en GB, redondeado)
    const totalMemGB = Math.round(totalmem() / (1024 * 1024 * 1024));
    components.push(`${totalMemGB}GB`);

    // 6. En Windows: obtener serie del volumen del disco C:
    // En Linux/Mac: obtener UUID del filesystem raíz
    try {
      const diskId = getDiskSerial();
      if (diskId) components.push(diskId);
    } catch {
      components.push('unknown-disk');
    }

    // 7. Dirección MAC de la primera interfaz de red
    try {
      const mac = getMacAddress();
      if (mac) components.push(mac);
    } catch {
      components.push('unknown-mac');
    }

    // 8. Nombre del usuario del sistema
    try {
      const info = userInfo();
      components.push(info.username);
    } catch {
      components.push('unknown-user');
    }

    // Generar hash SHA-256 de todos los componentes
    const raw = components.join('|||');
    const hash = createHash('sha256').update(raw).digest('hex');

    // Formatear como MCH-XXXXXXXX-XXXXXXXX
    cachedMachineId = `MCH-${hash.substring(0, 8).toUpperCase()}-${hash.substring(8, 16).toUpperCase()}`;
    return cachedMachineId;
  } catch (error) {
    // Fallback: generar un ID basado en lo que se pueda obtener
    const fallback = createHash('sha256')
      .update(`${hostname()}-${platform()}-${Date.now()}`)
      .digest('hex');
    cachedMachineId = `MCH-${fallback.substring(0, 8).toUpperCase()}-${fallback.substring(8, 16).toUpperCase()}`;
    return cachedMachineId;
  }
}

/**
 * Obtiene el número de serie del disco principal
 */
function getDiskSerial(): string {
  try {
    if (platform() === 'win32') {
      // Windows: Serial del volumen C:
      const output = execSync('vol C:', { encoding: 'utf-8', timeout: 3000 });
      const match = output.match(/Serial Number is\s+([A-F0-9-]+)/i);
      return match ? match[1].replace(/-/g, '').toUpperCase() : '';
    } else if (platform() === 'linux') {
      // Linux: UUID del filesystem raíz
      const output = execSync('blkid -o value -s UUID / 2>/dev/null || lsblk -no UUID / 2>/dev/null', { encoding: 'utf-8', timeout: 3000 });
      return output.trim().substring(0, 16) || '';
    } else {
      // macOS: UUID del disco
      const output = execSync('diskutil info / | grep Volume UUID', { encoding: 'utf-8', timeout: 3000 });
      const match = output.match(/([A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12})/i);
      return match ? match[1].replace(/-/g, '').toUpperCase().substring(0, 16) : '';
    }
  } catch {
    return '';
  }
}

/**
 * Obtiene la dirección MAC de la primera interfaz de red activa
 */
function getMacAddress(): string {
  try {
    if (platform() === 'win32') {
      const output = execSync('getmac /fo csv /nh', { encoding: 'utf-8', timeout: 3000 });
      const match = output.match(/"([A-F0-9-]{17})"/i);
      return match ? match[1].replace(/-/g, '').toUpperCase() : '';
    } else if (platform() === 'linux') {
      const output = execSync("cat /sys/class/net/*/address 2>/dev/null | grep -v '00:00:00:00:00:00' | head -1", { encoding: 'utf-8', timeout: 3000 });
      return output.trim().replace(/:/g, '').toUpperCase() || '';
    } else {
      const output = execSync("ifconfig en0 2>/dev/null | grep ether | awk '{print $2}'", { encoding: 'utf-8', timeout: 3000 });
      return output.trim().replace(/:/g, '').toUpperCase() || '';
    }
  } catch {
    return '';
  }
}

/**
 * Genera un Machine ID de prueba (para el generador de claves)
 */
export function generateTestMachineId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'MCH-';
  for (let i = 0; i < 8; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  result += '-';
  for (let i = 0; i < 8; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}
