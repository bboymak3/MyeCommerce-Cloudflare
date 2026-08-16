---
Task ID: 1
Agent: Main Agent
Task: Implementar arreglos para primer cliente: Precio mayorista con costo+margen, landscape tablets, logos, migración BD

Work Log:
- Leído código completo del proyecto (schema, APIs, components, hooks)
- Analizada imagen adjunta mostrando formulario de producto
- Agregados campos wholesaleCost y wholesaleMarginPercent al schema de Product
- Push schema a DB con prisma db push
- Actualizado API de productos (POST y PUT) para incluir nuevos campos
- Actualizado products-tab.tsx: interface, emptyForm, openEdit, calculos y formulario
- Implementado formulario de precio al mayor con 4 campos: costo, % ganancia, precio sugerido, cant min
- Cambiado POS layout de lg:grid-cols-5 a md:grid-cols-5 para tablets landscape
- Cambiado CartPanel de lg:col-span-3 a md:col-span-3
- Cambiado ProductPanel de lg:col-span-2 a md:col-span-2
- Mejorado store-logo API: agregado GET method para servir logos desde filesystem
- Cambiado URL de logo de /store/logo.ext a /api/store-logo para evitar cache
- Config-tab: auto-guardar logo en Settings al subir
- Creado sistema de migración de BD (src/lib/db-migration.ts)
- Migraciones se ejecutan automáticamente en instrumentation.ts al iniciar
- Tabla _migration_history para tracking
- Backup automático de BD antes de cada migración
- Primera migración v2.9.56: agregar wholesaleCost y wholesaleMarginPercent
- Versión actualizada a v2.9.56 en package.json
- Build exitoso
- ZIP generado: MyeCommerce-v2.9.20-2.9.56.zip (41MB)

Stage Summary:
- Precio al Mayor ahora usa misma lógica que Detal: Costo + % Ganancia = Precio Sugerido
- Tablets en landscape (768px+) ahora muestran carrito y productos lado a lado como PC
- Logo se sirve via API route (/api/store-logo) para evitar problemas de caché
- Logo se auto-guarda en Settings al subir
- Sistema de migración automático para futuras versiones
- ZIP de distribución generado en /download/MyeCommerce-v2.9.20-2.9.56.zip
