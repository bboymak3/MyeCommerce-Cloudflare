import { NextResponse } from "next/server";
import os from "os";

/**
 * GET /api/local-ip
 *
 * Returns the LAN IP of this machine so the POS can build a QR code
 * that lets a phone open the POS on the same Wi-Fi network.
 *
 * Also returns the HTTPS domain URL (https://myecommerce.ve) which is
 * required for camera/barcode scanner access on mobile browsers.
 *
 * The response shape is:
 *   {
 *     url:       "http://192.168.x.x:3000",
 *     secureUrl: "https://myecommerce.ve",
 *     ip:        "192.168.x.x",
 *     port:      3000,
 *     hostname:  "...",
 *     domain:    "myecommerce.ve"
 *   }
 */
export async function GET() {
  const port = Number(process.env.PORT) || 3000;
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

  const url = `http://${bestIp}:${port}`;
  const domain = "myecommerce.ve";
  const secureUrl = `https://${domain}`;

  return NextResponse.json({
    url,
    secureUrl,
    ip: bestIp,
    port,
    hostname: os.hostname(),
    domain,
  });
}
