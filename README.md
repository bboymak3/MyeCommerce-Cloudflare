# MyeCommerce POS — Cloudflare Edition

Sistema Punto de Venta (POS) para Venezuela, desplegado en **Cloudflare Pages** con
base de datos **D1** y almacenamiento de fotos en **R2**. Funciona en modo
**multi-negocio**: comparte la base D1 con el panel [nexus-one](../nexus-one), que
crea los negocios y controla su licencia (plan y fecha de corte).

## Stack

- **Next.js 15** (App Router) + **React 19**, Edge Runtime
- **Prisma 5** con `@prisma/adapter-d1` contra **Cloudflare D1** (SQLite)
- **Cloudflare R2** para fotos de productos y el logo de la tienda
- **@cloudflare/next-on-pages** para el build de Cloudflare Pages
- Tablas propias con prefijo `pos_` (las de nexus-one usan `nx_`, en la misma D1)

## Arquitectura multi-negocio

Cada fila de las tablas `pos_*` lleva `tenant_id`, el id del negocio en
nexus-one. El filtrado por negocio es automático: `src/lib/db.ts` extiende el
cliente Prisma para que todo `where`/`create` incluya `tenant_id`, así ninguna
ruta necesita filtrar a mano.

- **Esquema:** `prisma/schema.sql` (generado desde `schema.prisma`). Se aplica
  solo al arrancar (`src/lib/schema-migrate.ts`, disparado en `middleware.ts`):
  crea las tablas que falten y agrega las columnas nuevas a las que ya
  existen, sin borrar datos. No hace falta correr `wrangler d1 execute`
  a mano tras un despliegue.
- **Sesión/SSO:** `src/lib/nexus-tenant.ts` lee el estado del negocio
  (`nx_tenants`: activo/suspendido, plan, fecha de corte) desde la misma D1.
  `POST /api/nexus-sso` recibe el token de acceso que emite nexus-one y abre
  la sesión del POS ya en el negocio correcto.
- **Licencia:** si el negocio viene de nexus-one, la licencia del POS
  (`GET /api/license`) se deriva de su plan y su corte — no se activa por
  clave. Las instalaciones independientes (sin nexus-one) siguen con la
  licencia por clave, como antes.

## Tasa del dólar (BCV) — actualización automática o manual

La tasa se puede traer de
[`Abrahanq/bcv-price`](https://github.com/Abrahanq/bcv-price), un JSON público
sin clave que publica la tasa oficial del Banco Central de Venezuela
(`src/lib/bcv-rate.ts`).

- **Manual:** en Configuración, botón **"🔄 BCV"** junto al campo de tasa
  (`POST /api/exchange-rate/bcv`): consulta el repo y aplica el valor de una
  vez a ese negocio.
- **Automática diaria:** el interruptor **"Actualizar cada día
  automáticamente"** en Configuración marca `bcvAutoUpdate` en ese negocio.
  Cloudflare Pages no soporta Cron Triggers (eso es solo para Workers), así
  que la actualización diaria la dispara un GitHub Action
  (`.github/workflows/bcv-daily-update.yml`) que llama a
  `POST /api/cron/bcv-rate` una vez al día. Ese endpoint recorre **todos los
  negocios** con `bcvAutoUpdate` activo y les aplica la tasa del día; los
  demás quedan intactos.

  Para activarlo, en **Settings → Secrets and variables → Actions** de este
  repo, configura:

  | Secret | Valor |
  |---|---|
  | `POS_URL` | URL de este sitio en Cloudflare Pages, sin `/` final |
  | `CRON_SECRET` | el mismo valor puesto con `npx wrangler pages secret put CRON_SECRET` |

  `CRON_SECRET` es la única protección de esa ruta (queda pública en el
  middleware, sin sesión, porque un GitHub Action no tiene cómo iniciar
  sesión); sin ese secreto configurado en Cloudflare, la ruta rechaza toda
  petición.

## Cuentas por pagar, turnos de caja y puntos de fidelidad

- **Cuentas por Pagar:** una compra a proveedor puede marcarse "a credito"
  (con dias de plazo). El proveedor acumula `payableBalance` y en la pestana
  **Cuentas por Pagar** se ve cuanto se le debe a cada uno, cuales facturas
  estan vencidas, y se registran abonos parciales (`pos_supplier_payments`,
  espejo de `pos_credit_payments` pero para proveedores).
- **Turnos de Caja:** cada cajero abre su turno con el efectivo inicial
  (USD y Bs) antes de vender; el sistema asocia automaticamente cada venta
  al turno abierto de quien la registra. Al cerrar, compara el efectivo
  contado contra el esperado (inicial + ventas en efectivo de ese turno) y
  guarda la diferencia. Pestana **Turnos de Caja**, ruta `pos_cash_shifts`.
- **Puntos de Fidelidad:** se activa en Configuracion (`loyaltyEnabled`,
  puntos por cada $1 de descuento en `loyaltyPointsPerUsd`). Cada producto
  define cuantos puntos otorga por unidad vendida (`Product.loyaltyPoints`).
  En el punto de venta, si el cliente seleccionado tiene puntos acumulados,
  el cajero puede canjearlos como descuento adicional; la venta guarda
  `pointsEarned`/`pointsRedeemed` y el saldo del cliente se actualiza al
  confirmar.

## Secretos (Cloudflare Pages → Settings → Variables and Secrets)

Ninguno va en `wrangler.toml` ni en el código:

| Secreto | Uso |
|---|---|
| `JWT_SECRET` | Firma la sesión de los usuarios del POS |
| `NEXUS_SSO_SECRET` | Verifica los tokens de acceso que emite nexus-one (mismo valor en los dos proyectos) |
| `CRON_SECRET` | Protege `POST /api/cron/bcv-rate` |

`wrangler.toml` sí trae `LEGACY_TENANT_SLUG`, el slug en nexus-one del negocio
dueño de los datos anteriores al modo multi-negocio (`tenant_id = 'default'`).

## Desarrollo local

```bash
npm install                 # corre `prisma generate` en postinstall
npm run dev                 # Next.js normal, contra prisma/dev.db
npm run pages:build         # build real de Cloudflare Pages (next-on-pages)
npx wrangler pages dev .vercel/output/static --persist-to .wrangler/state
```

## Módulos

Punto de venta (con divisa dual USD/Bs), ventas en espera, presupuestos, notas
de entrega, productos (con fotos, categorías, marcas, combos/kits, precio
mayorista), inventario y kardex, clientes y cuentas por cobrar, proveedores y
compras, gastos, devoluciones, cierre de caja, informes, catálogo público,
usuarios y roles, respaldo, licencia.

## Otra documentación en este repo

`LEAME-PROYECTO.md` describe el sistema de actualización on-premise (Windows,
por releases de GitHub) de una rama anterior del proyecto; no aplica a este
despliegue en Cloudflare, que se actualiza con cada push a `main`.
