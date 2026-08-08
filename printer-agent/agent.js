/**
 * MyeCommerce POS - Agente de Impresion ESC/POS v3.0
 *
 * IMPRESION USB EN WINDOWS SIN DEPENDENCIAS EXTERNAS.
 * Usa la API winspool.drv de Windows para enviar bytes ESC/POS crudos
 * directamente al spooler de impresion. Funciona con USB, red, COM, LPT.
 *
 * NO necesita npm install. NO necesita serialport.
 * Solo usa modulos built-in de Node.js (http, fs, path, child_process).
 *
 * Puertos: GET /status | GET /printers | POST /detect | POST /print
 *
 * v3.1: Solo winspool.drv con StartDocPrinter/EndDocPrinter.
 *       Eliminados metodos fallback (print, copy) que abrian
 *       el dialogo de impresion de Windows.
 */

var http = require('http');
var fs = require('fs');
var path = require('path');
var execSync = require('child_process').execSync;

var PORT = parseInt(process.env.PORT || '9100', 10);
var HOST = '0.0.0.0';

var lastPrintTime = null;
var printCount = 0;
var windowsPrinters = [];
var autoPrinterName = null;
var autoPrinterPort = null;
var lastError = null;

var THERMAL_KEYWORDS = [
  'POS', 'THERMAL', 'RECEIPT', 'TICKET',
  'POS-58', 'POS-80', 'TP-58', 'TP-80', 'XP-58', 'XP-80',
  'GODEX', 'ZEBRA', 'XPRINTER', 'MTP', 'MPT',
  'CHENGMING', 'SEWOO', 'BIXOLON', 'EPSON',
  '58MM', '80MM'
];

var RAWPRINT_PS1 = path.join(__dirname, 'rawprint.ps1');

var RAWPRINT_SCRIPT = [
  'param(',
  '  [string]$PrinterName = $(throw "Falta nombre de impresora"),',
  '  [string]$FilePath = $(throw "Falta ruta del archivo")',
  ')',
  '',
  '$code = @"',
  'using System;',
  'using System.Runtime.InteropServices;',
  'public class RawPrinter {',
  '  [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)]',
  '  public static extern bool OpenPrinter(string pName, out IntPtr hPrinter, IntPtr pDefault);',
  '  [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)]',
  '  public static extern bool ClosePrinter(IntPtr hPrinter);',
  '  [DllImport("winspool.drv", SetLastError=true)]',
  '  public static extern bool StartDocPrinter(IntPtr hPrinter, int Level, ref DOC_INFO_1 pDocInfo);',
  '  [DllImport("winspool.drv", SetLastError=true)]',
  '  public static extern bool EndDocPrinter(IntPtr hPrinter);',
  '  [DllImport("winspool.drv", SetLastError=true)]',
  '  public static extern bool StartPagePrinter(IntPtr hPrinter);',
  '  [DllImport("winspool.drv", SetLastError=true)]',
  '  public static extern bool EndPagePrinter(IntPtr hPrinter);',
  '  [DllImport("winspool.drv", SetLastError=true)]',
  '  public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);',
  '  [StructLayout(LayoutKind.Sequential)]',
  '  public struct DOC_INFO_1 {',
  '    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;',
  '    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;',
  '    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;',
  '  }',
  '}',
  '"@',
  '',
  'try {',
  '  Add-Type -TypeDefinition $code -Language CSharp 2>$null',
  '  $bytes = [System.IO.File]::ReadAllBytes($FilePath)',
  '  if ($bytes.Length -eq 0) { Write-Error "Archivo vacio"; exit 1 }',
  '  $hPrinter = [IntPtr]::Zero',
  '  $ok = [RawPrinter]::OpenPrinter($PrinterName, [ref]$hPrinter, [IntPtr]::Zero)',
  '  if (-not $ok) { Write-Error "No se pudo abrir la impresora: $PrinterName"; exit 2 }',
  '  $docInfo = New-Object RawPrinter+DOC_INFO_1',
  '  $docInfo.pDocName = "POS Ticket"',
  '  $docInfo.pOutputFile = $null',
  '  $docInfo.pDataType = "RAW"',
  '  $ok = [RawPrinter]::StartDocPrinter($hPrinter, 1, [ref]$docInfo)',
  '  if (-not $ok) { Write-Error "StartDoc fallo"; [RawPrinter]::ClosePrinter($hPrinter) | Out-Null; exit 4 }',
  '  [RawPrinter]::StartPagePrinter($hPrinter) | Out-Null',
  '  $written = 0',
  '  $ok = [RawPrinter]::WritePrinter($hPrinter, $bytes, $bytes.Length, [ref]$written)',
  '  [RawPrinter]::EndPagePrinter($hPrinter) | Out-Null',
  '  [RawPrinter]::EndDocPrinter($hPrinter) | Out-Null',
  '  [RawPrinter]::ClosePrinter($hPrinter) | Out-Null',
  '  if (-not $ok) { Write-Error "Error al escribir en la impresora"; exit 3 }',
  '  Write-Host "OK:$($bytes.Length)bytes"',
  '  exit 0',
  '} catch {',
  '  Write-Error "RawPrinter error: $_"',
  '  exit 99',
  '}'
].join('\r\n');

function ensureRawPrintScript() {
  fs.writeFileSync(RAWPRINT_PS1, RAWPRINT_SCRIPT, 'utf8');
}

function getWindowsPrinters() {
  try {
    var psCmd = 'powershell -NoProfile -Command "Get-WmiObject -Class Win32_Printer | Select-Object Name,PortName,PrinterStatus,Shared | ConvertTo-Json -Compress"';
    var stdout = execSync(psCmd, { encoding: 'utf8', timeout: 10000, windowsHide: true });
    var printers = JSON.parse(stdout.trim());
    if (!Array.isArray(printers)) printers = [printers];
    windowsPrinters = printers.map(function(p) {
      return { name: p.Name, port: p.PortName, status: p.PrinterStatus, shared: p.Shared };
    }).filter(function(p) {
      return p.port && (p.status === 0 || p.status === 3 || p.status === 4);
    });
    console.log('[INFO] Impresoras Windows: ' + windowsPrinters.length);
    for (var i = 0; i < windowsPrinters.length; i++) {
      console.log('  -> ' + windowsPrinters[i].name + ' (' + windowsPrinters[i].port + ', status=' + windowsPrinters[i].status + ')');
    }
    return windowsPrinters;
  } catch (e) {
    console.log('[WARN] No se pudieron listar impresoras: ' + e.message);
    return [];
  }
}

function autoDetect() {
  var printers = getWindowsPrinters();
  if (printers.length === 0) return null;
  for (var i = 0; i < printers.length; i++) {
    var info = (printers[i].name + ' ' + printers[i].port).toUpperCase();
    for (var j = 0; j < THERMAL_KEYWORDS.length; j++) {
      if (info.indexOf(THERMAL_KEYWORDS[j]) !== -1) {
        console.log('[OK] Impresora termica detectada: ' + printers[i].name + ' (' + printers[i].port + ')');
        autoPrinterName = printers[i].name;
        autoPrinterPort = printers[i].port;
        return printers[i];
      }
    }
  }
  if (printers.length === 1) {
    console.log('[OK] Unica impresora: ' + printers[0].name + ' (' + printers[0].port + ')');
    autoPrinterName = printers[0].name;
    autoPrinterPort = printers[0].port;
    return printers[0];
  }
  console.log('[INFO] No se pudo auto-detectar. Impresoras:');
  for (var k = 0; k < printers.length; k++) {
    console.log('  - ' + printers[k].name + ' (' + printers[k].port + ')');
  }
  return null;
}

function printViaWinspool(printerName, filePath) {
  ensureRawPrintScript();
  try {
    var psCmd = 'powershell -NoProfile -ExecutionPolicy Bypass -File "' +
      RAWPRINT_PS1.replace(/"/g, '\\"') +
      '" -PrinterName "' + printerName.replace(/"/g, '\\"') +
      '" -FilePath "' + filePath.replace(/"/g, '\\"') + '"';
    var stdout = execSync(psCmd, { encoding: 'utf8', timeout: 30000, windowsHide: true });
    if (stdout && stdout.indexOf('OK:') !== -1) {
      return { success: true, method: 'winspool', detail: stdout.trim() };
    }
    return { success: false, method: 'winspool', error: 'Respuesta inesperada: ' + (stdout || 'vacia') };
  } catch (e) {
    return { success: false, method: 'winspool', error: e.message };
  }
}

function printViaWindows(printerName, printerPort, buffer) {
  var spoolDir = path.join(__dirname, 'spool');
  if (!fs.existsSync(spoolDir)) fs.mkdirSync(spoolDir, { recursive: true });
  var tmpFile = path.join(spoolDir, 'ticket_' + Date.now() + '.bin');
  fs.writeFileSync(tmpFile, buffer);

  console.log('[PRINT] Impresora: ' + printerName + ' (' + printerPort + ')');
  console.log('[PRINT] Buffer: ' + buffer.length + ' bytes');
  console.log('[PRINT] Usando winspool.drv (sin dialogo)...');

  var r1 = printViaWinspool(printerName, tmpFile);
  try { fs.unlinkSync(tmpFile); } catch (e) {}

  if (r1.success) {
    console.log('[OK] Impreso via winspool (' + buffer.length + ' bytes)');
    return { method: 'winspool', printer: printerName, port: printerPort, size: buffer.length, success: true };
  }

  console.log('[ERROR] winspool.drv fallo: ' + r1.error);
  lastError = 'winspool fallo: ' + r1.error;
  return {
    method: 'none', printer: printerName, port: printerPort,
    error: lastError, size: buffer.length, success: false
  };
}

var server = http.createServer(function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Printer-Port');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'online', version: '3.1.0', port: PORT,
      method: 'windows-winspool', printers: windowsPrinters,
      autoPrinter: autoPrinterName, autoPrinterPort: autoPrinterPort,
      lastPrintTime: lastPrintTime, printCount: printCount, lastError: lastError
    }));
    return;
  }

  if (req.method === 'GET' && req.url === '/printers') {
    var printers = getWindowsPrinters();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      printers: printers, autoPrinter: autoPrinterName, autoPrinterPort: autoPrinterPort
    }));
    return;
  }

  if (req.method === 'POST' && req.url === '/detect') {
    var detected = autoDetect();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      detected: !!detected, printerName: autoPrinterName,
      printerPort: autoPrinterPort, printers: windowsPrinters
    }));
    return;
  }

  if (req.method === 'POST' && req.url === '/print') {
    var chunks = [];
    req.on('data', function(chunk) { chunks.push(chunk); });
    req.on('end', function() {
      var body = Buffer.concat(chunks);
      var buffer = null;
      var requestedPrinter = null;

      var contentType = req.headers['content-type'] || '';
      if (contentType.indexOf('application/json') !== -1) {
        try {
          var json = JSON.parse(body.toString('utf8'));
          buffer = Buffer.from(json.data, 'base64');
          requestedPrinter = json.printer || json.port || null;
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'JSON invalido' }));
          return;
        }
      } else {
        buffer = body;
        requestedPrinter = req.headers['x-printer-port'] || autoPrinterName || null;
      }

      if (!buffer || buffer.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Buffer vacio' }));
        return;
      }

      console.log('[PRINT] Recibido: ' + buffer.length + ' bytes');

      var targetName = requestedPrinter || autoPrinterName;
      var targetPort = null;

      if (targetName) {
        for (var i = 0; i < windowsPrinters.length; i++) {
          if (windowsPrinters[i].name === targetName ||
              windowsPrinters[i].name.toUpperCase().indexOf(targetName.toUpperCase()) !== -1) {
            targetName = windowsPrinters[i].name;
            targetPort = windowsPrinters[i].port;
            break;
          }
        }
        if (!targetPort && autoPrinterPort) {
          targetName = autoPrinterName;
          targetPort = autoPrinterPort;
        }
      }

      if (!targetName || !targetPort) {
        var detected = autoDetect();
        if (detected) {
          targetName = autoPrinterName;
          targetPort = autoPrinterPort;
        }
      }

      if (!targetName || !targetPort) {
        console.log('[ERROR] No hay impresora configurada');
        lastError = 'No se encontro ninguna impresora';
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'No se encontro ninguna impresora. Verifique que la impresora esta conectada y tiene driver instalado.'
        }));
        return;
      }

      try {
        var result = printViaWindows(targetName, targetPort, buffer);
        if (result.success) {
          lastPrintTime = new Date().toISOString();
          printCount++;
          lastError = null;
        } else {
          lastError = result.error;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: result.success, size: buffer.length,
          printer: targetName, port: targetPort, method: result.method,
          error: result.error || null, triedMethods: result.triedMethods || null
        }));
      } catch (e) {
        console.log('[ERROR] ' + e.message);
        lastError = e.message;
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint no encontrado' }));
});

function start() {
  console.log('');
  console.log('+---------------------------------------------------+');
  console.log('|   MyeCommerce POS - Agente de Impresion v3.1      |');
  console.log('|   Impresion USB Windows (winspool.drv directo)  |');
  console.log('+---------------------------------------------------+');
  console.log('');
  console.log('Puerto: ' + PORT);
  console.log('URL:    http://localhost:' + PORT);
  console.log('');

  ensureRawPrintScript();

  console.log('Detectando impresoras Windows...');
  var detected = autoDetect();
  if (detected) {
    console.log('Impresora configurada: ' + detected.name);
    console.log('Puerto: ' + detected.port);
  } else {
    console.log('No se detecto impresora automaticamente.');
    console.log('El agente seguira funcionando.');
    console.log('Use GET /printers para ver las disponibles.');
  }

  console.log('');
  console.log('Endpoints:');
  console.log('  GET  /status   - Estado del agente');
  console.log('  GET  /printers - Listar impresoras Windows');
  console.log('  POST /detect   - Auto-detectar impresora termica');
  console.log('  POST /print    - Imprimir buffer ESC/POS');
  console.log('');
  console.log('Esperando impresiones...');
  console.log('---');

  server.listen(PORT, HOST, function() {
    console.log('Servidor listo en http://' + HOST + ':' + PORT);
  });
}

start();
