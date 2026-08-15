# MyeCommerce v2.9.x - Registro de Versiones

## v2.9.49 (2026-08-15)
- **fix**: Caddy movil independiente — Caddyfile-mobile separado del dominio para :8443
- **fix**: ERR_SSL_PROTOCOL_ERROR — Caddy dominio y movil ahora son procesos independientes
- **fix**: Si Caddy dominio falla (puerto 80/443 en uso), el movil sigue funcionando
- **feat**: Deteccion de IP local automatica guardada en caddy/local-ip.txt
- **feat**: Log de Caddy movil en caddy/caddy-mobile.log para depuracion
- **feat**: Log de Caddy dominio en caddy/caddy-domain.log para depuracion

## v2.9.48 (2026-08-14)
- **feat**: Header 2 filas — nombre tienda + datos fiscales en fila superior, navegacion en fila inferior
- **feat**: Catalogo logo personalizado — upload logo desde configuracion de catalogo
- **feat**: Fondos decorativos para catalogo — paletas de colores y gradientes seleccionables

## v2.9.47.4 (2026-08-14)
- **fix**: Instalador — fix instalador para version actualizada
- **fix**: npm install — separar postinstall, agregar reintentos para evitar fallos
- **chore**: Version package.json actualizada a v2.9.47.4 (correlativo)

## v2.9.47.3 (2026-08-14)
- **feat**: 5 nuevas funcionalidades:
  - Paginacion en Productos y Clientes (25/pagina)
  - Exportar reportes a Excel/PDF (xlsx + jspdf + autotable)
  - Scanner USB/Bluetooth wedge (deteccion rapida de teclas + Enter en POS)
  - Alertas de vencimiento de productos (expirado, <15 dias, <30 dias)
  - Estadisticas por cliente (Top Compradores, Clientes Mas Frecuentes)

## v2.9.47.2 (2026-08-14)
- **feat**: ZIP exportado con todas las mejoras

## v2.9.47.1 (2026-08-14)
- **fix**: POS "Button is not defined" — import faltante en pos-tab
- **feat**: Catalog config avanzada — fuentes, vistas, colores, plantillas
- **feat**: Installer version actualizada

## v2.9.47 (2026-08-13)
- **feat**: Base limpia desde v2.9.46-clean-install
- **fix**: Categorias — fix creacion y duplicados
- **feat**: Confirmacion vaciar carrito — dialog antes de limpiar
- **feat**: Caddy movil — acceso HTTPS :8443 para camara del telefono

## v2.9.46 (2026-08-13)
- **fix**: Category creation, duplicate menus, QR HTTPS, license banner, header layout

## v2.9.43 (2026-08-12)
- **fix**: POS critico + marcas + clientes export + catalogo imagenes

## v2.9.42 (2026-08-12)
- **feat**: POS refactorizado en 18 subcomponentes modulares

## v2.9.41 (2026-08-12)
- **feat**: Campo Marca (Brand) en productos — modelo Prisma Brand, API /api/brands CRUD, selector en formulario de producto
- **feat**: POS — filtro por marca ademas de categoria, dos selectores independientes
- **feat**: Catalogo — filtro por marca, 8 plantillas (modern, elegant, minimal, dark, magazine, neon, classic, gradient), marca visible en tarjeta de producto
- **fix**: Categorias duplicadas — case-insensitive al crear (ARRANQUE = arranque), evita duplicados
- **fix**: Marcas case-insensitive — HP = hp, misma logica que categorias
- **fix**: Imagenes de productos — nueva API /api/product-images para servir imagenes de forma confiable, upload retorna URL via API en lugar de path estatico
- **feat**: API /api/product-images — endpoint GET que sirve imagenes desde filesystem con MIME correcto y cache

## v2.9.40 (2026-08-12)
- **fix**: Compras — campo cantidad editable en linea (antes solo se mostraba como texto, no se podia cambiar)
- **feat**: Edicion de stock con Kardex — al modificar stock desde formulario de producto, aparece dialogo de ajuste de inventario solicitando motivo obligatorio, registra movimiento en Kardex (ajuste_entrada/ajuste_salida) con nombre de usuario, fecha, razon y variacion
- **feat**: API /api/inventory-adjustments — nuevo endpoint POST para registrar ajustes manuales de inventario en kardex con log
- **fix**: Margen de ganancia sin limite — cambiada formula de margen a markup (costo * (1 + %/100)), permite 100%, 200% o cualquier porcentaje. Antes la formula dividia por cero al llegar a 100%
- **fix**: Imagenes de productos ahora visibles en POS cuadricula, miniatura al crear, y catalogo
- **fix**: Upload API crea directorio automaticamente si no existe (mkdir recursive)
- **feat**: Advertencia al salir de POS con carrito lleno — modal de confirmacion antes de cambiar modulo
- **feat**: Catalogo — 4 plantillas + 8 colores personalizables + color picker + exportar PDF/HTML
- **feat**: Exportar clientes — Excel con 3 hojas + Contactos .vcf para telefono

## v2.9.39 (2026-08-12)
- **fix**: Pausar Venta (F9) DEFINITIVO — mapeo correcto id→productId, name→productName, price→unitPrice
- **fix**: API held-sales — validacion de productId, filtra items invalidos, error legible para el usuario
- **feat**: Sistema de log de errores — /api/logs (lectura, limpieza), logger.ts centralizado
- **feat**: POS cuadricula con imagenes reales — grid 2-4 columnas con foto de producto + fallback icono
- **feat**: Catalogo de productos — portada elegante con datos tienda, precios $/Bs, QR WhatsApp
- **feat**: Modulo Catalogo — generar/ver/descargar catalogo HTML con filtro por categoria

## v2.9.38 (2026-08-12)
- **fix**: Pausar Venta — race condition eliminada (espera respuesta async antes de mostrar toast)
- **fix**: Importar Excel — authFetch ya no sobreescribe Content-Type cuando body es FormData
- **fix**: Imagenes de productos — creada API /api/products/upload (JPG/PNG/GIF/WebP/SVG hasta 5MB)
- **fix**: Menú — modulos nuevos (Kardex, Ventas en Espera, Presupuestos, Notas de Entrega, Gastos) visibles para todos los roles
- **fix**: Espaciado del menú — tabs mas grandes con mejor separacion (py-2, gap-1.5, min-h-36px)
- **fix**: Menu lateral — espacio entre items aumentado (space-y-1)

## v2.9.37.1 (2026-08-12)
- **fix**: Actualización de lockfile (bun.lock) + permisos de archivos

## v2.9.37 (2026-08-12)
- **feat**: Integración POS ↔ Ventas en Espera ↔ Presupuestos
  - POS: Botón "Pausar Venta" guarda factura en espera (HeldSale)
  - POS: Botón "Cargar Venta en Espera" recupera factura en POS
  - Presupuestos: "Convertir a Venta" carga contenido al POS
  - Presupuestos: Selector de clientes desde base de datos (clientes registrados)
- **feat**: Kardex automático en todas las operaciones
  - Ventas registran salida en Kardex
  - Compras registran entrada en Kardex
  - Ventas en Espera/Kardex tracking
- **feat**: API de Kardex con Price Promedio Ponderado
- **feat**: API de Ventas en Espera (HeldSale CRUD)
- **feat**: API de Presupuestos (Quote CRUD)

## v2.9.35 (2026-08-11)
- **feat**: Módulo de Gastos completo
  - CRUD de gastos con categorías personalizables
  - Filtros por fecha, categoría, método de pago
  - Cálculo automático en Bs (tasa BCV)
- **feat**: Reporte Utilidad/Pérdida (Estado de Resultados)
  - Ventas Netas - Costo Ventas - Gastos = Utilidad Neta
  - Desglose por categoría de gastos
  - Desglose por método de pago
  - Barras visuales por categoría
- **feat**: Categorías de Gastos (CRUD, desactiva si tiene gastos asociados)
- **feat**: 4 nuevos módulos (modelos + componentes base):
  - Kardex (InventoryMovement)
  - Ventas en Espera (HeldSale/HeldSaleItem)
  - Presupuestos (Quote/QuoteItem)
  - Notas de Entrega (DeliveryNote/DeliveryNoteItem)

## v2.9.34 (2026-08-10)
- **feat**: API Authentication & Authorization - JWT middleware
- **feat**: IVA desglosado en ticket - precio base sin IVA + Subtotal + IVA + Total
- **fix**: Corregir bucle de sesión expirada - loadData solo con token válido

## v2.9.33 (2026-08-09)
- **feat**: Ticket SIN referencias - solo método de pago
- **feat**: Punto de venta sin referencia

## v2.9.32 (2026-08-08)
- **fix**: Correcciones ticket - Ref en pago mixto, IVA en Bs, default gravado, punto-de-venta referencia

## v2.9.31 (2026-08-07)
- **feat**: Venta por peso (kg/g/lb) - Badge visual
- **feat**: Grid iconos compacta + 48 tipos de negocio
- **fix**: IVA en ticket + iconos compactos variados + USD por $
