---
Task ID: 1
Agent: Main Agent
Task: Fix all ticket config toggles, migration system, catalog logo, and product image upload

Work Log:
- Analyzed image uploaded by user showing ticket configuration toggles
- Traced full data flow: config-tab.tsx → API settings → page.tsx → pos-tab.tsx → ticket-printer.ts
- Found critical bug: ticketShowCashReceived and ticketShowLogo were defined in DB schema and config UI but NOT saved in API PUT, NOT in Settings interface, NOT passed as props to PosTab
- Found all boolean toggles used `!== false` pattern which defaults to true for undefined values
- Fixed API route (settings/route.ts): Added ticketShowCashReceived and ticketShowLogo to updateData, changed all toggles to `=== true` pattern
- Fixed page.tsx: Added fields to Settings interface, default state, and PosTab props
- Fixed pos/types.ts: Added ticketShowCashReceived and ticketShowLogo to PosTabProps
- Fixed pos-tab.tsx: Destructured new props, included in ticketSettings object and dependency array
- Fixed ticket-printer.ts: Added destructuring, changed `!== false` to `=== true` checks
- Fixed escpos-buffer.ts: Changed `!== false` to `=== true` checks
- Created src/lib/version.ts: Centralized version management from package.json
- Created src/instrumentation.ts: Next.js startup hook to auto-run migrations and auto-backup
- Enhanced src/lib/db-migration.ts: Complete rewrite with better versioning, applied versions tracking, detailed return values
- Updated src/lib/auto-backup.ts: Added all missing tables (brands, heldSales, quotes, deliveryNotes, inventoryMovements, comboItems, expenseCategories, expenses), uses centralized version
- Updated src/app/api/backup/route.ts: Full backup/restore now covers ALL 21 tables
- Updated src/app/api/backup/stats/route.ts: Uses centralized version
- Updated scripts/build-clean-zip.sh: Reads version from package.json dynamically
- Fixed catalog logo: Changed container from 100px to 120px, used max-width/max-height instead of width/height, removed overflow:hidden
- Fixed product image upload: Added client-side compression for photos >500KB (resizes to 1200px, JPEG quality 0.8), improved server-side error handling
- Updated next.config.js: Added experimental serverActions body size limit
- Updated package.json version to 2.9.58

Stage Summary:
- All ticket toggles now properly save to DB and propagate to printer engine
- Migration system runs automatically at startup via instrumentation.ts
- Backup system covers all 21 database tables
- Version centralized in src/lib/version.ts
- Catalog logo adapts properly without being cut off
- Product image upload compresses large phone photos before uploading
