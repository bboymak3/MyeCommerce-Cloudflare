# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

POS (punto de venta) para Venezuela en **Cloudflare Pages** (Next.js 15 App Router + React 19, Edge Runtime) con **D1** (Prisma 5 + `@prisma/adapter-d1`) y **R2** para fotos. Es multi-negocio: comparte la D1 `ok_db` con el panel **nexus-one** (repo `bboymak3/nexus-one`), que crea los negocios, sus usuarios y su suscripción. Tablas propias con prefijo `pos_`; las de nexus-one usan `nx_`.

Todo el código, los comentarios y los mensajes al usuario están en español. Producción: `https://myecommerce-pos-7g0.pages.dev`; cada push a `main` despliega solo.

`LEAME-PROYECTO.md`, `ESTADO-PROYECTO.txt`, `LEEME.txt`, `VERSIONES.md`, los `.bat`/`.vbs`, `caddy/`, `printer-agent/` y las rutas `/api/update`, `/api/check-version`, `/api/download-version`, `/api/local-ip`, `/api/logs` son de la versión on-premise para Windows y **no aplican** a este despliegue.

## Comandos

```bash
npm install                 # corre prisma generate (postinstall)
npx tsc --noEmit            # typecheck. Hay ~259 errores previos en componentes de UI
                            # (res.json() tipado unknown); el build los ignora
                            # (ignoreBuildErrors). Fijarse solo en que no aparezcan nuevos.
npm run build:cf            # build real de Cloudflare (@cloudflare/next-on-pages) -> .vercel/output/static
npx wrangler pages dev .vercel/output/static --port 8788 --persist-to <dir> \
  --binding JWT_SECRET=x NEXUS_SSO_SECRET=y CRON_SECRET=z     # correr local con D1/R2 simulados
```

- No hay suite de tests ni linter. Se valida levantando el build con `wrangler pages dev` y llamando a la API (`Authorization: Bearer <token>`).
- `npm run dev` (next dev) no tiene bindings de D1/R2: las rutas API fallan. Para probar con datos, usar `build:cf` + `wrangler pages dev`.
- Para probar el flujo completo con nexus-one: levantar los dos con el mismo `--persist-to` (comparten la D1 local) y el mismo `NEXUS_SSO_SECRET`. Si se levantan dos `wrangler pages dev` a la vez, darle al segundo `--inspector-port` distinto. nexus-one exige `MYECOMMERCE_URL` https; para pruebas locales se puede poner uno ficticio y llamar a `/api/nexus-sso?token=...` del POS directamente.
- El esquema de nexus-one (`nx_*`) se carga en la D1 local con `npx wrangler d1 execute ok_db --local --persist-to <dir> --file=../nexus-one/prisma/schema.sql`.
- `/api/verificacion` (solo admin) corre los chequeos del despliegue: secretos, R2, esquema, escritura atómica, hora de Venezuela y cuadre de saldos. Con `?format=json` devuelve JSON.

## Arquitectura

### Multi-negocio (tenant)
- `src/middleware.ts` corre en todo `/api/*`: aplica la migración automática del esquema, verifica el JWT (`src/lib/session.ts`, jose) y fija las cabeceras de confianza `x-user-id`, `x-user-role`, `x-username` y `x-tenant-id` (borra las que mande el cliente). Bloquea con 403 la API si el negocio está suspendido o vencido en nexus-one, salvo `/api/license`. `PUBLIC_ROUTES` y `ADMIN_ROUTES` se definen ahí.
- **Limite de CPU (plan Free de Workers: 10 ms por request).** Si se pasa seguido, Cloudflare corta la request con el error 1102 y una pagina HTML (en pantalla: "Unexpected token '<'"), al azar y solo en produccion. Por eso `createDbFromEnv` reutiliza un PrismaClient por isolate (crearlo cuesta decenas de ms) y pasa sus operaciones por una cola: Prisma agrupa consultas simultaneas y, entre requests distintas, Workers cancela esas promesas. Cada consulta Prisma cuesta ~3 ms de CPU: en rutas muy usadas usar SQL directo en un solo `D1.batch` y cargar solo lo necesario (el dashboard trae hoy y ayer; la semana con `?week=1`). Ya leen con SQL directo: dashboard, la carga inicial de la app (productos, categorias, marcas, configuracion, cliente final, alertas de stock, creditos vencidos), registrar venta, compras, notas de entrega, gastos y tipos de gasto, devoluciones, abonos de clientes (/api/credit) y pagos a proveedores (/api/supplier-payments). Helpers en `src/lib/d1-read.ts` (`selectRows`, `selectRow`, `loadProductsWithLastMove`) y `fromDbRow` de `d1-batch.ts`, que devuelve booleanos y fechas con el formato de Prisma para que la pantalla no note el cambio.
- Las rutas obtienen el cliente con `createDbFromEnv(env, getTenantId(req.headers))` (`src/lib/db.ts`). Es un Prisma extendido que agrega `tenant_id` a todo `where` y a todo `create`, incluidas las creaciones anidadas. **Las rutas nunca filtran `tenant_id` a mano.** El SQL directo (`env.DB.prepare`) no tiene ese aislamiento: hay que filtrar por `tenant_id` explícitamente.
- `tenant_id = 'default'` son los datos previos al modo multi-negocio y pertenecen al negocio `LEGACY_TENANT_SLUG` de `wrangler.toml`.
- Licencia y estado: `src/lib/nexus-tenant.ts` lee `nx_tenants` (status, plan y `subscription_expires_at`) con caché de 30 s. Los planes `business`/`premium` equivalen a la licencia "profesional"; `basic` a "básica". Sin nexus-one se usa la licencia por clave (`src/lib/license.ts`).
- SSO: nexus-one firma un JWT de 5 min con `NEXUS_SSO_SECRET` (iss `nexus-one`, aud `myecommerce-pos`) → `GET /api/nexus-sso?token=` crea o sincroniza el usuario `pos_users` y redirige a `/#sso=<token de sesión>`.
- Login local (`/api/auth`): solo usuario y clave. El negocio sale de la cookie `tenant_id` o se busca el usuario en todos los negocios.

### Escrituras: siempre en lote atómico
El adaptador D1 de Prisma **ignora `$transaction`**: cada operación va por separado. Toda escritura de varias filas (venta, compra, devolución, abono, nota de entrega, ajuste masivo) usa `D1Batch` (`src/lib/d1-batch.ts`), que ejecuta `D1Database.batch()`: se aplica todo o se deshace todo.
- Patrón de ruta: **lecturas con Prisma primero** → construir el lote (`insert`, `update` con `{ increment }`/`{ decrement }`, `raw`, `delete`) → `commit()` → releer con Prisma para la respuesta.
- `D1Batch` siempre agrega el `tenant_id`, valida las columnas contra el esquema y completa `id` y las fechas "ahora" (`createdAt`, `updatedAt`, `date` con default). `raw()` exige `"tenant_id" = ?` en el SQL y agrega el tenant como último parámetro.
- Saldos, stock y montos se actualizan con aritmética en SQL (`stock - ?`, `MAX(0, saldo - ?)`), nunca escribiendo un valor leído antes: así operaciones simultáneas no se pisan.
- El número de factura (8 dígitos, único por `(tenant_id, invoiceNumber)`) lo calcula D1 dentro del lote con `sqlExpr(...)`. No calcularlo leyendo la última venta: con ventas simultáneas se repite.
- Formato que Prisma espera en D1: fechas como texto ISO con `+00:00` (`toDbDate`) y booleanos como 1/0. Las comparaciones de fechas son de texto: una fecha escrita con `CURRENT_TIMESTAMP` ("2026-01-01 10:00:00") rompe los filtros.

### Hora de Venezuela
Cloudflare ejecuta en UTC; el negocio opera en Caracas (UTC-4 fijo). Todo límite de día ("hoy", rangos `startDate`/`endDate`, cierres, reportes, dashboard) usa `src/lib/ve-time.ts`: `veDateKey()`, `veDayStart(día)`, `veDayEnd(día)`, y `veWallNow()`/`fromVeWall()` para cálculos con getters locales. No usar `new Date().toISOString().slice(0, 10)`, `setHours(0,0,0,0)` ni `fecha + 'T23:59:59'`: cortan el día a las 8 pm de Caracas. En el servidor, `toLocale*String` lleva `timeZone: 'America/Caracas'`.

### Esquema y migraciones
- Fuente: `prisma/schema.prisma`. De ahí sale `prisma/schema.sql` (`npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`, con `CREATE TABLE IF NOT EXISTS`) y `src/lib/schema-sql.generated.ts` (los mismos statements como arrays de TS). No hay script en el repo que genere este último: al cambiar el esquema hay que actualizar los tres archivos de forma coherente.
- `src/lib/schema-migrate.ts` (lo dispara el middleware una vez por isolate) crea las tablas faltantes, agrega las columnas faltantes y deja los índices UNIQUE por negocio. Nunca borra datos y no hace falta correr `wrangler d1 execute` tras desplegar. Toda columna nueva necesita `DEFAULT` (o ser opcional) para poder agregarse a tablas con datos.
- Todo modelo lleva `tenant_id String @default("default")` + `@@index([tenant_id])`; los `@@unique` incluyen `tenant_id`.

### Frontend
SPA en `src/app/page.tsx`: pestañas por módulo (`src/components/*-tab.tsx`) con permisos por rol y plan. El POS está en `src/components/pos/`. Las llamadas a la API pasan por `authFetch` (`src/lib/auth-fetch.ts`), que toma el token de `localStorage`. Estado global en `src/lib/app-store.ts` (zustand). Divisa dual USD/Bs con la tasa BCV de `pos_settings`.

### Tasa BCV
`src/lib/bcv-rate.ts` consulta el JSON público de `Abrahanq/bcv-price`. La actualización diaria la dispara `.github/workflows/bcv-daily-update.yml` (Pages no tiene cron) con `POST /api/cron/bcv-rate` y la cabecera `x-cron-secret`. Esa ruta es pública en el middleware y la protege solo `CRON_SECRET`.

## Configuración
- `wrangler.toml`: bindings `DB` (D1 `ok_db`, compartida con nexus-one) y `R2_PHOTOS`, y la variable `LEGACY_TENANT_SLUG`. Con `wrangler.toml` presente, Cloudflare ignora las variables normales del panel: las variables van en el toml y los secretos con `npx wrangler pages secret put <NOMBRE> --project-name=myecommerce-pos`.
- Secretos: `JWT_SECRET` (sesión), `NEXUS_SSO_SECRET` (mismo valor que en nexus-one) y `CRON_SECRET`.
- `next.config.js` expone `CF_PAGES_COMMIT_SHA` como `process.env.BUILD_COMMIT` y deja vacíos los módulos de Node (`fs`, `crypto`, ...) que no existen en Edge. Toda ruta lleva `export const runtime = 'edge'`.
