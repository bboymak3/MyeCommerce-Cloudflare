# MyeCommerce - Archivo de Versiones

Cada subida aqui corresponde a una version estable lista para produccion.

| Archivo | Version | Fecha | Cambios Principales |
|---------|---------|-------|---------------------|
| MyeCommerce-v2.9.25.zip | v2.9.25 | 2026-08-08 | **Modulo Producto completo**: SENIAT IVA (exento/reducido 8%/general 16%), margen automatico desde costo, captura foto con camara, trazabilidad (ubicacion/vencimiento/lote), combos, puntos fidelidad, QR/barcode scanner, alertas stock visual. Upload imagenes producto. |
| MyeCommerce-v2.9.24.zip | v2.9.24 | 2026-08-07 | Alertas stock sin emoji garbled + campo minStock editable en productos. |
| MyeCommerce-v2.9.23.zip | v2.9.23 | 2026-08-07 | **[CRITICO]** Corregido error "effusd is not defined" en Cierre de Caja. Bug de scope de variables movido dentro del IIFE. Proteccion en loadClosings contra respuestas no-array. |
| MyeCommerce-v2.9.22.zip | v2.9.22 | 2026-08-07 | Mejoras en desglose de cierres: separacion visual por canal de ingreso (Efectivo Bs, Efectivo $, Bs Electronicos, Divisas Digitales). Colores por grupo. |
| MyeCommerce-v2.9.21.zip | v2.9.21 | 2026-08-07 | Metodos Zelle, USDT, Cashea, Efectivo USD. Breakdown JSON en cierres. Desglose por grupos. Ticket con desglose por canal. |
| MyeCommerce-v2.9.20.zip | v2.9.20 | 2026-08-06 | Separacion Efectivo Bs/USD en cierres. Ticket mejorado con desglose. Eliminado "Tarjeta" -> "Punto de Venta". |

## Notas de Instalacion

1. Descargar el ZIP de la version deseada
2. Descomprimir en una carpeta sin espacios (ej: C:\MyeCommercePOS)
3. Ejecutar INSTALAR.bat como Administrador
4. Ejecutar CREAR-ADMIN.bat para crear usuario
5. Ejecutar INICIAR-MYECCOMMERCE.bat para iniciar

Para actualizar desde una version anterior:
1. Respaldar BD con RESPALDAR-BD.bat
2. Reemplazar todos los archivos
3. Ejecutar INSTALAR.bat (migra la BD automaticamente)
