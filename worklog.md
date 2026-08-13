---
Task ID: 1
Agent: Super Z (Main)
Task: Fix 6 bugs criticos reportados por el usuario - v2.9.44

Work Log:
- Analizadas 7 capturas de pantalla del usuario con VLM
- Clonado repositorio y leidos todos los archivos criticos
- Diagnosticados 6 bugs con causa raiz:

BUG 1: API /api/products/upload ELIMINADA en v2.9.43
- Causa: commit 586f0d6 elimino el archivo por error
- Fix: Restaurada desde git history (commit b219551)

BUG 2: Exportar clientes - error Prisma
- Causa: whereClause.active = true pero schema usa isActive
- Fix: Cambiado a whereClause.isActive = true

BUG 3: ShortcutsBar no renderizada en POS
- Causa: Componente importado en pos-tab.tsx pero nunca renderizado
- Fix: Agregada al cart-panel.tsx (dentro del CardContent)

BUG 4: Marcas/Categorias no funcionan
- Causa RAIZ: Tabla Brand NUNCA fue migrada a la BD
- La unica migracion (20260811133522) NO incluye Brand
- Fix: Creada migracion SQL completa + cambiado INICIAR-MYECCOMMERCE.bat
  para ejecutar prisma db push SIEMPRE (no solo si dev.db no existe)

BUG 5: Mejorados mensajes de error en APIs brands/categories

BUG 6: Catalogo imagenes - ya estaba fixeado en v2.9.43 (object-fit:contain)

Stage Summary:
- Build pasa limpio (next build)
- Commit: 6df5469 v2.9.44
- Push: exitoso a origin/main
- Tag: v2.9.44 creado y pusheado
- 7 archivos modificados, 318 lineas agregadas, 88 eliminadas
