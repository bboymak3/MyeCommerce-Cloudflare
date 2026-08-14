import { NextResponse } from "next/server";
import os from "os";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * GET /api/local-ip
 *
 * Returns the LAN IP and URLs for POS mobile access via QR.
 *
 * - url:       HTTP fallback (camera won't work on phones)
 * - secureUrl: HTTPS URL via Caddy :8443 (camera WORKS on phones)
 * - domainUrl: HTTPS via domain (only works on PC or if phone has DNS)
 *
 * Phone MUST use secureUrl (https://IP:8443) for camera access.
 * Browsers require Secure Context (HTTPS) for getUserMedia.
 */
export async function GET() {
  const port = Number(process.env.PORT) || 3000;
  const caddyPort = 8443;
  const ifaces = os.networkInterfaces();
  let bestIp = "";

  const candidates: string[] = [];

  for (const name of Object.keys(ifaces)) {
    const list = ifaces[name];
    if (!list) continue;
    for (const iface of list) {
      if (iface.family !== "IPv4") continue;
      if (iface.internal) continue;
      candidates.push(iface.address);
    }
  }

  // Preference: 192.168.x.x > 10.x > 172.16-31.x > anything else
  const prefer = (ip: string): number => {
    if (ip.startsWith("192.168.")) return 3;
    if (ip.startsWith("10.")) return 2;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 1;
    return 0;
  };

  candidates.sort((a, b) => prefer(b) - prefer(a));
  bestIp = candidates[0] || "127.0.0.1";

  // Try to read IP from Caddy startup script (more reliable on Windows)
  try {
    const ipFile = join(process.cwd(), 'caddy', 'local-ip.txt');
    if (existsSync(ipFile)) {
      const savedIp = readFileSync(ipFile, 'utf-8').trim();
      if (savedIp && savedIp !== "127.0.0.1") {
        bestIp = savedIp;
      }
    }
  } catch { /* ignore */ }

  const url = `http://${bestIp}:${port}`;
  // HTTPS via Caddy port 8443 - THIS is what phones need for camera
  const secureUrl = `https://${bestIp}:${caddyPort}`;
  const domain = "myecommerce.ve";
  const domainUrl = `https://${domain}`;

  return NextResponse.json({
    url,
    secureUrl,
    domainUrl,
    ip: bestIp,
    port,
    caddyPort,
    hostname: os.hostname(),
    domain,
  });
}
