# MyeCommerce POS — Documentacion del Proyecto

> **Ultima actualizacion:** 2026-08-07
> **Version actual:** 2.9.20
> **Propietario:** csglider
> **Repo:** https://github.com/csglider/MyeCommerce-v2.9.20 (PRIVADO)

---

## 1. Que es MyeCommerce

Sistema Punto de Venta (POS) on-premise para Venezuela.
Corre 100% local sin internet (despues de instalado), con base de datos SQLite.
Desarrollado en **Next.js 15 + Prisma 5 + Tailwind CSS + React 19**.

---

## 2. Version Actual — v2.9.20

### Cambios vs v2.9.19:

| # | Cambio | Detalle |
|---|--------|---------|
| 1 | Eliminado | **Tarjeta (Debito/Credito)** — era redundante con Punto de Venta |
| 2 | Mantenido | **Punto de Venta** — se queda como metodo de Bs Electronicos |
| 3 | Ticket | Mas espacio entre columnas CANT, P.UNI, TOTAL |
| 4 | Efectivo | Desglose separado: Efectivo Fisico (Bs) y Efectivo Fisico (USD) |
| 5 | Agrupacion | 4 grupos en cierres e informes (ver abajo) |
| 6 | Zelle/USDT | Referencias incluidas en informes, separadas de Pago Movil/Transferencia |

### Metodos de Pago Actuales:

| Metodo | Key | Grupo | Requiere Referencia |
|--------|-----|-------|---------------------|
| Efectivo (Bs) | `efectivo` | Efectivo Fisico (Bs) | No |
| Efectivo ($) | `efectivo-usd` | Efectivo Fisico ($) | No |
| Punto de Venta | `punto-de-venta` | Bs Electronicos | Si |
| Transferencia | `transferencia` | Bs Electronicos | Si |
| Pago Movil | `pago-movil` | Bs Electronicos | Si |
| Zelle ($) | `zelle` | Divisas Digitales | Si |
| USDT ($) | `usdt` | Divisas Digitales | Si |
| Cashea | `cashea` | Excluido del breakdown | No |
| Credito | `credito` | Excluido del breakdown | No |
| Mixto | `mixto` | Se desglosa por sub-metodo | Varia |
| Cheque | `cheque` | Excluido del breakdown | No |

### Estructura de Grupos en Cierres e Informes:

```
🟢 Efectivo Fisico (Bs)
   └── efectivo (Bs) → subtotal en Bs y USD

🟢 Efectivo Fisico ($)
   └── efectivo-usd ($) → subtotal en Bs y USD

🔵 Bs Electronicos
   ├── Punto de Venta → total Bs + USD
   ├── Transferencia → total Bs + USD
   └── Pago Movil → total Bs + USD

🟣 Divisas Digitales
   ├── Zelle ($$) → total Bs + USD
   └── USDT ($$) → total Bs + USD
```

- Todos los subtotales se calculan en Bs y USD equivalente segun tasa del dia.
- **Cashea y Credito** van aparte (no se mezclan con estos grupos).
- **Mixto** se desglosa: cada sub-metodo va a su grupo correspondiente.

---

## 3. Estructura del Repositorio

```
MyeCommerce-v2.9.20/
├── zip/                          ← ARCHIVOS ZIP DE CADA VERSION
│   ├── VERSIONES.md             ← Tabla de versiones con cambios
│   └── MyeCommerce-v2.9.20.zip  ← ZIP descargable de esta version
│
├── src/
│   ├── app/
│   │   ├── page.tsx              ← Pantalla principal
│   │   ├── layout.tsx            ← Layout global
│   │   ├── globals.css           ← Estilos
│   │   └── api/
│   │       ├── sales/route.ts              ← API de ventas
│   │       ├── cash-closing/route.ts       ← Cierres de caja (calcGroups, breakdown)
│   │       ├── reports/route.ts            ← Informes
│   │       ├── credit/route.ts             ← Credito
│   │       ├── products/route.ts           ← CRUD productos
│   │       ├── categories/route.ts        ← CRUD categorias
│   │       ├── clients/route.ts           ← CRUD clientes
│   │       ├── users/route.ts             ← CRUD usuarios
│   │       ├── roles/route.ts              ← Configuracion de roles
│   │       ├── settings/route.ts           ← Configuracion general
│   │       ├── dashboard/route.ts         ← Dashboard
│   │       ├── backup/route.ts             ← Respaldo BD
│   │       ├── license/route.ts           ← Licencia
│   │       ├── suppliers/route.ts         ← Proveedores
│   │       ├── purchases/route.ts         ← Compras
│   │       ├── devolutions/route.ts       ← Devoluciones
│   │       └── auth/route.ts               ← Login
│   │
│   ├── components/
│   │   ├── pos-tab.tsx             ← Punto de Venta (metodos de pago, carrito, pagos mixtos)
│   │   ├── credit-tab.tsx          ← Credito (abonos, pagos)
│   │   ├── reports-tab.tsx         ← Informes (graficos, desglose por grupos)
│   │   ├── cash-closing-tab.tsx    ← Cierres de caja
│   │   ├── products-tab.tsx        ← Productos
│   │   ├── clients-tab.tsx         ← Clientes
│   │   ├── dashboard-tab.tsx       ← Dashboard principal
│   │   ├── config-tab.tsx          ← Configuracion
│   │   ├── users-tab.tsx           ← Usuarios y roles
│   │   ├── backup-tab.tsx          ← Respaldo/Restore
│   │   ├── suppliers-tab.tsx       ← Proveedores
│   │   ├── purchases-tab.tsx       ← Compras
│   │   ├── devolutions-tab.tsx     ← Devoluciones
│   │   ├── license-tab.tsx         ← Licencia
│   │   ├── barcode-print.tsx       ← Impresion codigos de barras
│   │   ├── login-screen.tsx        ← Pantalla login
│   │   ├── app-nav.tsx             ← Barra navegacion
│   │   ├── error-boundary.tsx      ← Captura errores
│   │   └── ui/                     ← Componentes base (button, card, input, etc.)
│   │
│   ├── lib/
│   │   ├── ticket-printer.ts       ← Motor de tickets (ESC/POS + HTML fallback)
│   │   ├── escpos-buffer.ts        ← Generador de buffers ESC/POS
│   │   ├── db.ts                   ← Conexion Prisma/SQLite
│   │   ├── auth.ts                 ← Autenticacion
│   │   ├── license.ts              ← Logica de licencia
│   │   ├── machine-id.ts           ← ID unico de maquina
│   │   ├── auto-backup.ts          ← Respaldo automatico
│   │   └── utils.ts                ← Utilidades generales
│   │
│   └── types/
│       └── modules.d.ts
│
├── prisma/
│   ├── schema.prisma               ← Modelo de BD (SQLite)
│   └── migrations/
│
├── printer-agent/                  ← Agente de impresion termica (puerto 9100)
│   ├── agent.js
│   └── INICIAR-AGENTE-OCULTO.vbs
│
├── caddy/                          ← Proxy inverso para dominio local
│   ├── Caddyfile
│   └── INICIAR-CADDY-OCULTO.vbs
│
├── public/                         ← Archivos estaticos (iconos, PWA)
├── scripts/                        ← Utilidades (generate-key.js)
├── package.json                    ← v2.9.20
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── LEAME-PROYECTO.md              ← ESTE ARCHIVO
├── LEEME.txt                      ← Guia de instalacion para el cliente
├── INSTALAR.bat                   ← Instalador rapido
├── INSTALAR-LIMPIO.vbs            ← Instalador completo con UI
├── INICIAR-TODO.bat               ← Iniciar con ventanas visibles
├── INICIAR-TODO-OCULTO.vbs        ← Iniciar sin ventanas
├── INICIAR-MYECCOMMERCE.bat       ← Inicio rapido
├── INICIAR-MYECCOMMERCE-OCULTO.vbs
├── DETENER-TODO.bat               ← Detener servicios
├── RESPALDAR-BD.bat               ← Respaldo BD
├── CREAR-ADMIN.bat                 ← Crear usuario admin
├── GENERAR-LICENCIA.bat           ← Generar licencia
├── generar-licencia.js            ← Logica de generacion de licencias
└── PROGRESS.hta                    ← UI de progreso del instalador
```

---

## 4. Base de Datos (Prisma Schema)

**Motor:** SQLite (`prisma/dev.db`)
**ORM:** Prisma 5.22

### Modelos principales:

| Modelo | Funcion |
|--------|---------|
| `Product` | Productos (precio, costo, stock, mayoreo, peso) |
| `Category` | Categorias de productos |
| `Client` | Clientes (natural/juridico, credito) |
| `Sale` | Ventas (pago simple o mixto, referencia, vendedor) |
| `SaleItem` | Items de cada venta |
| `CashClosing` | Cierres de caja (breakdownJson + columnas legacy) |
| `Settings` | Configuracion global (tasa, tienda, ticket) |
| `User` | Usuarios con roles y permisos |
| `RoleConfig` | Definicion de roles y permisos |
| `Supplier` | Proveedores |
| `Purchase` | Compras a proveedores |
| `PurchaseItem` | Items de cada compra |
| `CreditPayment` | Pagos/abonos a credito |
| `Devolution` | Devoluciones |
| `License` | Licencia del sistema |

### Campos clave de Sale:

- `paymentMethod`: metodo principal (efectivo, transferencia, punto-de-venta, zelle, etc.)
- `mixedPaymentJson`: JSON con sub-pagos cuando es "mixto"
- `referenceNumber`: referencia del pago (transferencia, pago movil, zelle, usdt, punto de venta)
- `total`: total en USD
- `totalBs`: total en Bolivares
- `exchangeRate`: tasa BCV al momento de la venta

### Campos clave de CashClosing:

- `breakdownJson`: JSON con desglose por metodo `{efectivo: {usd, bs, count}, transferencia: {...}, ...}`
- Columnas legacy: `cashUsd`, `cashBs`, `transferUsd`, `transferBs`, `mobileUsd`, `mobileBs`, `zelleUsd`, `zelleBs`, `usdtUsd`, `usdtBs`
- `rebuildLegacyBreakdown()`: reconstruye el breakdown desde columnas legacy (compatibilidad)
- `saveToLegacyColumns()`: guarda valores en columnas legacy (compatibilidad)

---

## 5. Arquitectura de Pagos

### Pago Simple:
Un solo metodo → `paymentMethod` = "efectivo", "transferencia", "zelle", etc.

### Pago Mixto:
`paymentMethod` = "mixto" → `mixedPaymentJson` contiene array de sub-pagos:
```json
[
  {"method": "efectivo", "amountBs": 50.00, "amountUsd": 1.37},
  {"method": "zelle", "amountBs": 130.00, "amountUsd": 3.56, "reference": "zelle-ref-123"}
]
```

### Breakdown en Cierres:
`calcGroups()` lee `breakdownJson` y calcula 4 grupos:
1. `efectivoFisico` → Bs (efectivo+efectivo-bs) y USD (efectivo-usd)
2. `bsElectronicos` → punto-de-venta + transferencia + pago-movil
3. `divisasDigitales` → zelle + usdt
4. Cashea y Credito van aparte

---

## 6. Ticket (Impresion)

### Motor dual:
1. **ESC/POS via Agente Local** (puerto 9100) — preferido, imprime directo a termica
2. **HTML fallback** (window.print) — si agente no disponible

### Etiquetas de metodos en ticket:
Las definidas en `TICKET_PAYMENT_LABELS` (ticket-printer.ts) y `PAYMENT_LABELS` (escpos-buffer.ts).

### Columnas del ticket:
`CANT` | `P.UNI` | `TOTAL` — con espacio aumentado en v2.9.20

### Anchos de papel soportados:
55mm, 57mm, 58mm (32 chars), 80mm (48 chars)

---

## 7. Historial de Versiones

| Version | Fecha | Resumen |
|---------|-------|---------|
| v2.9.20 | 2026-08-07 | Zelle/USDT, desglose efectivo Bs+USD separado, agrupacion 4 grupos, ticket mejorado, eliminada Tarjeta |
| v2.9.19 | 2026-07 | Base con campos Zelle/USDT en schema, breakdownJson inicial |

> Ver `zip/VERSIONES.md` para mas detalle de cada version.

---

## 8. Stack Tecnico

| Capa | Tecnologia | Version |
|------|-----------|---------|
| Frontend | Next.js (App Router) | 15.3.3 |
| React | React | 19.0.0 |
| Lenguaje | TypeScript | 5.7.0 |
| Estilos | Tailwind CSS | 3.4.19 |
| UI | Componentes custom (shadcn-style) | — |
| Charts | Recharts | 2.15.0 |
| Estado | Zustand | 5.0.2 |
| Backend | Next.js API Routes | — |
| Base de Datos | SQLite via Prisma | 5.22.0 |
| Impresion | ESC/POS via Node.js agent | — |
| Proxy | Caddy (HTTPS local) | — |

---

## 9. Instalacion

### Desde ZIP (limpia):
1. Descomprimir ZIP de `zip/`
2. Ejecutar `INSTALAR-LIMPIO.vbs` como Administrador
3. Acceder: https://myecommerce.ve o http://localhost:3000
4. Credenciales: admin / admin

### Actualizar desde version anterior:
1. Respaldar BD con `RESPALDAR-BD.bat`
2. Reemplazar archivos (menos `prisma/dev.db`)
3. Ejecutar: `npx prisma db push` + `npm install` + `npx prisma generate` + `npm run build`
4. Reiniciar servicios

---

## 10. Notas Importantes

- **NO eliminar `prisma/dev.db`** al actualizar — ahi estan todos los datos.
- **NO mezclar versiones** de archivos sueltos — usar siempre el ZIP completo de `zip/`.
- **Tarjeta (Debito/Credito)** fue eliminada en v2.9.20. Si aparece en datos antiguos, el sistema la ignora en breakdowns nuevos.
- **Punto de Venta** SI esta activo y es un metodo de Bs Electronicos.
- Los cierres de caja guardan `breakdownJson` (nuevo) Y las columnas legacy (compatibilidad con cierres viejos).
- `rebuildLegacyBreakdown()` reconstruye el JSON desde las columnas viejas al abrir cierres antiguos.
