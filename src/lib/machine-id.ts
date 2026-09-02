// Machine ID generator - Edge Runtime compatible
// On Cloudflare, real hardware fingerprinting is not possible.

export function getMachineId(): string {
  return 'cloudflare-edge-runtime';
}

/**
 * Get a machine ID based on request headers (for Cloudflare).
 */
export function getMachineIdFromRequest(request: Request): string {
  const ua = request.headers.get('user-agent') || 'unknown';
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const encoder = new TextEncoder();
  const data = encoder.encode(`${ip}:${ua}`);
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash) + data[i];
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0') + '-cloudflare';
}
