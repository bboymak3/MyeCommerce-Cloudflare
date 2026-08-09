# MyeCommerce - Archivo de Versiones

Cada subida aqui corresponde a una version estable lista para produccion.

| Archivo | Version | Fecha | Cambios Principales |
|---------|---------|-------|---------------------|
| MyeCommerce-v2.9.31.zip | v2.9.31 | 2026-08-09 | **Ticket IVA**: Muestra IVA cuando taxRate > 0, indicando si esta incluido o sumado. **Iconos negocio**: 32 tipos (16 nuevos: moto, computacion, celulares, electricidad, gasolina, verduleria, polleria, pescaderia, fruteria, jugueria, panchos, pizza, repuestos, transporte, boutique, joyeria). Cuadricula compacta 8 columnas. **ESC/POS**: elimina texto tipo negocio, solo nombre tienda. **USD por $**: Cambiadas referencias USD por simbolo $ en ticket. |
| MyeCommerce-v2.9.30.zip | v2.9.30 | 2026-08-09 | **Formulario producto rediseñado**: Toggle "Por Unidades" vs "Por Bulto" al agregar inventario. Modo Bulto: ingresa bultos comprados, uds por bulto, costo bulto, margen% y el sistema calcula automaticamente costo por unidad, precio venta por unidad y stock total. Boton verde para aplicar valores calculados. Precio mayorista separado (tasa euro BCV). Formulario ahora 5 bloques. |
| MyeCommerce-v2.9.29.zip | v2.9.29 | 2026-08-09 | **IVA valor manual dinamico**: El usuario coloca el porcentaje actual de IVA en Configuracion y el sistema recalcula automaticamente. Se eliminaron porcentajes fijos (8%, 16%) del select de producto. TaxBadge muestra porcentaje dinamico. **Compra por bulto**: Toggle unidad/bulto en modulo de compras, campos costo bulto, unidades por bulto, margen%, calculo automatico precio venta por unidad. Nota IVA en configuracion actualizada. |
| MyeCommerce-v2.9.27.zip | v2.9.27 | 2026-08-08 | **Ticket**: ID movido al final (antes de 'Gracias por su compra'). **Logo del negocio**: 16 tipos de negocio con iconos (panaderia, carniceria, farmacia, etc). Upload de logo personalizado (PNG/JPG, max 512KB). Logo/emoji se imprime centrado en ticket HTML y ESC/POS. |
| MyeCommerce-v2.9.26.zip | v2.9.26 | 2026-08-08 | **REWRITE COMPLETO Modulo Producto**: Dialogo ancho con 6 bloques colapsables. SENIAT IVA (exento/reducido/general). Margen automatico costo+margen%=precio en caliente. Multi-empaque (bulto/caja). Foto con camara celular (capture=environment). QR/barcode scanner camara. Codigo barras secundario. Trazabilidad (vencimiento/lote/ubicacion). Combos/Kits con subtabla CRUD ingredientes. Puntos fidelidad. Modelo ComboItem en schema. |
| MyeCommerce-v2.9.25.zip | v2.9.25 | 2026-08-08 | **Modulo Producto**: SENIAT IVA, margen auto, foto camara, trazabilidad, combos, puntos fidelidad, QR scanner, upload imagenes. |
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

## v2.9.31 - 2026-08-09
- Venta por peso: badge visual (kg/g/lb) en tabla de productos
- Grid de iconos de negocio mas compacta (gap-0.5, grid-cols-10)
- 48 tipos de negocio disponibles (antes 32)
- Nuevos: Abarrotes, Dulceria, Fotografia, Heladeria, Imprenta, Libreria, Loteria, Lubricentro, Market, Muebles, Musica, Nutricion, Peluqueria, Regalos, Smartphone, Tacos, Tintoreria, Videojuegos
