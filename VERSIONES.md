# MyeCommerce v2.9.x - Registro de Versiones

## v2.9.40 (2026-08-12)
- **fix**: Imagenes de productos ahora visibles en POS cuadricula, miniatura al crear, y catalogo (falta campo `image` en Product interface)
- **fix**: Upload API crea directorio automaticamente si no existe (mkdir recursive)
- **feat**: Advertencia al salir de POS con carrito lleno — modal de confirmacion antes de cambiar modulo
- **feat**: Catalogo — 4 plantillas (Moderno, Elegante, Minimalista, Oscuro) + 8 colores personalizables + color picker
- **feat**: Catalogo — exportar como PDF (imprimir) o HTML descargable
- **feat**: Exportar clientes — Excel con 3 hojas (Clientes, Resumen, WhatsApp) + Contactos .vcf para telefono
- **refactor**: Store centralizado (app-store.ts) separado de page.tsx para evitar dependencia circular

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
