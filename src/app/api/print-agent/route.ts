import { NextRequest, NextResponse } from 'next/server';

const AGENT_BASE = 'http://localhost:9100';
const AGENT_TIMEOUT = 15000; // 15s timeout para el agente

/**
 * Server-side proxy to printer-agent.
 * Avoids mixed-content errors when the app runs on https://myecommerce.ve
 * and the agent runs on http://localhost:9100.
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'status';

  let url: string;
  if (action === 'printers') {
    url = `${AGENT_BASE}/printers`;
  } else {
    url = `${AGENT_BASE}/status`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AGENT_TIMEOUT);
    const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
    clearTimeout(timeout);
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      return NextResponse.json(data);
    } catch {
      return NextResponse.json(
        { error: 'El agente no respondio JSON valido', detail: text.slice(0, 200) },
        { status: 502 }
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Agente no disponible: ' + message },
      { status: 503 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action || 'print';

    let url: string;
    let fetchOptions: RequestInit;

    if (action === 'detect') {
      url = `${AGENT_BASE}/detect`;
      fetchOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      };
    } else {
      // action === 'print'
      url = `${AGENT_BASE}/print`;
      fetchOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: body.data, printer: body.printer, port: body.port }),
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AGENT_TIMEOUT);
    const res = await fetch(url, { ...fetchOptions, signal: controller.signal });
    clearTimeout(timeout);
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      return NextResponse.json(data);
    } catch {
      return NextResponse.json(
        { error: 'El agente no respondio JSON valido', detail: text.slice(0, 200) },
        { status: 502 }
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Agente no disponible: ' + message },
      { status: 503 }
    );
  }
}
