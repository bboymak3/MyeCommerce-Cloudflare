import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { headers } from 'next/headers';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || 'all';
    const brand = searchParams.get('brand') || 'all';
    const format = searchParams.get('format') || 'html'; // html or pdf
    const template = searchParams.get('template') || 'modern'; // modern, elegant, minimal, dark, magazine, neon, classic, gradient
    const accentColor = searchParams.get('color') || ''; // custom hex color override
    const hideUnavailable = searchParams.get('hideUnavailable') === 'true';
    const categoriesParam = searchParams.get('categories') || ''; // comma-separated for multi-category
    const hidePriceUsd = searchParams.get('hidePriceUsd') === 'true';
    const hidePriceBs = searchParams.get('hidePriceBs') === 'true';
    const selectedFont = searchParams.get('font') || 'Inter';
    const viewMode = searchParams.get('view') || 'grid'; // grid, list, compact, large
    const cardSize = searchParams.get('cardSize') || 'medium'; // small, medium, large
    const hideDescription = searchParams.get('hideDescription') === 'true';
    const hideStock = searchParams.get('hideStock') === 'true';
    const hideBrand = searchParams.get('hideBrand') === 'true';
    const bgStyle = searchParams.get('bgStyle') || 'solid';
    const bgColor1 = searchParams.get('bgColor1') || '';
    const bgColor2 = searchParams.get('bgColor2') || '';
    const coverLogo = searchParams.get('coverLogo') || '';

    // Cargar configuracion de la tienda
    const settings = await db.settings.findFirst();
    const storeName = settings?.storeName || 'Mi Tienda';
    const storeAddress = settings?.storeAddress || '';
    const storePhone = settings?.storePhone || '';
    const storeRif = settings?.storeRif || '';
    const bcvRate = settings?.bcvRate || 36.5;
    const currency = settings?.currency || 'USD';
    const storeLogo = settings?.storeLogo || '';
    const theme = settings?.theme || 'blue';

    // Detectar origin para URLs absolutas de imagenes (funciona en nueva ventana y PDF)
    let baseUrl = '';
    try {
      const headersList = headers();
      const referer = headersList.get('referer') || headersList.get('host') || '';
      if (referer.includes('://')) {
        const url = new URL(referer);
        baseUrl = url.origin;
      } else if (referer) {
        baseUrl = req.nextUrl.protocol + '//' + referer;
      } else {
        baseUrl = req.nextUrl.protocol + '//' + req.nextUrl.host;
      }
    } catch { baseUrl = ''; }

    // Funcion para convertir URLs relativas de imagenes a absolutas
    const toAbsoluteUrl = (imgUrl: string) => {
      if (!imgUrl) return imgUrl;
      if (imgUrl.startsWith('http://') || imgUrl.startsWith('https://') || imgUrl.startsWith('data:')) return imgUrl;
      return baseUrl + imgUrl;
    };

    // Generar QR para WhatsApp
    const waMessage = encodeURIComponent(`Hola ${storeName}! Me gustaria informacion sobre sus productos.`);
    const waNumber = storePhone.replace(/[^0-9]/g, '');
    const waUrl = waNumber ? `https://wa.me/${waNumber}?text=${waMessage}` : '';
    let qrDataUrl = '';
    if (waUrl) {
      qrDataUrl = await QRCode.toDataURL(waUrl, { width: 200, margin: 1, errorCorrectionLevel: 'M' });
    }

    // Cargar productos activos
    const whereClause: any = { active: true };
    if (categoriesParam) {
      const catIds = categoriesParam.split(',').filter(Boolean);
      if (catIds.length > 0) whereClause.categoryId = { in: catIds };
    } else if (category !== 'all') {
      whereClause.categoryId = category;
    }
    if (brand !== 'all') {
      whereClause.brandId = brand;
    }
    if (hideUnavailable) {
      whereClause.stock = { gt: 0 };
      whereClause.noStock = false;
    }

    const products = await db.product.findMany({
      where: whereClause,
      include: { category: { select: { name: true, icon: true, color: true } }, brand: { select: { name: true } } },
      orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
    });

    // Cargar categorias
    const categories = await db.category.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });

    // Colores del tema
    const themeColors: Record<string, { primary: string; secondary: string; accent: string; bg: string }> = {
      blue: { primary: '#2563eb', secondary: '#1e40af', accent: '#3b82f6', bg: '#f0f5ff' },
      green: { primary: '#059669', secondary: '#047857', accent: '#10b981', bg: '#f0fdf4' },
      purple: { primary: '#7c3aed', secondary: '#6d28d9', accent: '#8b5cf6', bg: '#faf5ff' },
      red: { primary: '#dc2626', secondary: '#b91c1c', accent: '#ef4444', bg: '#fef2f2' },
      orange: { primary: '#ea580c', secondary: '#c2410c', accent: '#f97316', bg: '#fff7ed' },
      dark: { primary: '#6366f1', secondary: '#4f46e5', accent: '#818cf8', bg: '#0f172a' },
      pink: { primary: '#db2777', secondary: '#be185d', accent: '#ec4899', bg: '#fdf2f8' },
      teal: { primary: '#0d9488', secondary: '#0f766e', accent: '#14b8a6', bg: '#f0fdfa' },
      amber: { primary: '#d97706', secondary: '#b45309', accent: '#f59e0b', bg: '#fffbeb' },
    };

    // Template-based color selection
    const templateThemes: Record<string, string> = {
      modern: theme,
      elegant: 'purple',
      minimal: 'teal',
      dark: 'dark',
      magazine: 'pink',
      neon: 'green',
      classic: 'orange',
      gradient: 'blue',
    };
    const effectiveTheme = templateThemes[template] || theme;
    let colors = themeColors[effectiveTheme] || themeColors.blue;

    // Custom color override
    if (accentColor && /^#[0-9a-fA-F]{6}$/.test(accentColor)) {
      colors = { primary: accentColor, secondary: accentColor, accent: accentColor + '80', bg: accentColor + '08' };
    }

    // Agrupar productos por categoria
    const grouped = new Map<string, typeof products>();
    products.forEach(p => {
      const catName = p.category?.name || 'Sin Categoria';
      if (!grouped.has(catName)) grouped.set(catName, []);
      grouped.get(catName)!.push(p);
    });

    const isDark = theme === 'dark';
    const textColor = isDark ? '#e2e8f0' : '#1e293b';
    const subTextColor = isDark ? '#94a3b8' : '#64748b';
    const cardBg = isDark ? '#1e293b' : '#ffffff';
    const pageBg = isDark ? '#0f172a' : colors.bg;

    // Background style generation
    const c1 = bgColor1 || colors.primary;
    const c2 = bgColor2 || colors.secondary;
    let bgStyleCSS = '';
    let bgExtraCSS = '';
    switch (bgStyle) {
      case 'gradient':
        bgStyleCSS = `background:linear-gradient(135deg,${c1},${c2});`;
        bgExtraCSS = `.content{background:transparent;}.cover{background:transparent;border-radius:0;}`;
        break;
      case 'radial':
        bgStyleCSS = `background:radial-gradient(circle at 30% 20%,${c1}40,${c2}20 50%,${pageBg} 80%);`;
        break;
      case 'pattern':
        bgStyleCSS = `background-color:${pageBg};background-image:repeating-linear-gradient(45deg,${c1}08 0px,${c1}08 10px,${c2}05 10px,${c2}05 20px);`;
        break;
      case 'geometric':
        bgStyleCSS = `background-color:${pageBg};background-image:linear-gradient(${c1}10 1px,transparent 1px),linear-gradient(90deg,${c1}10 1px,transparent 1px),linear-gradient(${c2}08 1px,transparent 1px),linear-gradient(90deg,${c2}08 1px,transparent 1px);background-size:100px 100px,100px 100px,20px 20px,20px 20px;background-position:0 0,0 0,10px 10px,10px 10px;`;
        break;
      case 'waves':
        bgStyleCSS = `background-color:${pageBg};background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 320'%3E%3Cpath fill='${encodeURIComponent(c1)}15' d='M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,112C672,96,768,96,864,112C960,128,1056,160,1152,165.3C1248,171,1344,149,1392,138.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z'%3E%3C/path%3E%3C/svg%3E");background-repeat:no-repeat;background-position:bottom;background-size:cover;`;
        break;
      default: // solid
        bgStyleCSS = `background-color:${pageBg};`;
    }

    // Logo for cover - use coverLogo if provided, otherwise storeLogo
    const effectiveLogo = coverLogo || storeLogo;

    const now = new Date();
    const dateStr = now.toLocaleDateString('es-VE', { year: 'numeric', month: 'long', day: 'numeric' });

    // Generar HTML del catalogo
    let productsHtml = '';
    for (const [catName, catProducts] of grouped) {
      const cat = catProducts[0]?.category;
      const catIcon = cat?.icon || '';
      const catColor = cat?.color || colors.primary;
      productsHtml += `
        <div style="margin-bottom:40px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding-bottom:8px;border-bottom:2px solid ${catColor}20;">
            <span style="font-size:20px;">${catIcon || '📦'}</span>
            <h2 style="font-size:18px;font-weight:700;color:${catColor};margin:0;">${catName}</h2>
            <span style="font-size:11px;color:${subTextColor};margin-left:auto;">${catProducts.length} productos</span>
          </div>
          <div style="display:${viewMode === 'list' ? 'flex' : 'grid'};${viewMode !== 'list' ? `grid-template-columns:repeat(auto-fill,minmax(${cardSize === 'small' ? '150px' : cardSize === 'large' ? '260px' : '200px'},1fr));` : ''}gap:${viewMode === 'list' ? '12px' : '12px'};${viewMode === 'list' ? 'flex-direction:column;' : ''}">
            ${catProducts.map(p => `
              <div style="background:${cardBg};border-radius:12px;border:1px solid ${isDark ? '#334155' : '#e2e8f0'};overflow:hidden;transition:transform 0.2s,box-shadow 0.2s;${viewMode === 'list' ? 'display:flex;gap:16px;padding:16px;align-items:center;' : ''}">
                ${p.image ? `
                  <div style="${viewMode === 'list' ? 'width:100px;height:100px;min-width:100px;' : 'width:100%;height:' + (cardSize === 'small' ? '100px' : cardSize === 'large' ? '200px' : '140px') + ';'}overflow:hidden;background:${isDark ? '#334155' : '#f1f5f9'};display:flex;align-items:center;justify-content:center;${viewMode === 'list' ? 'border-radius:10px;' : ''}">
                    <img src="${toAbsoluteUrl(p.image)}" alt="${p.name}" style="max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;" onerror="this.style.display='none';this.parentElement.innerHTML='<span style=\\'font-size:40px;\\'>${p.icon || '📦'}</span>'" />
                  </div>
                ` : `
                  <div style="${viewMode === 'list' ? 'width:80px;height:80px;min-width:80px;border-radius:10px;' : 'width:100%;height:' + (cardSize === 'small' ? '70px' : cardSize === 'large' ? '120px' : '100px') + ';'}background:${isDark ? '#1e293b' : '#f8fafc'};display:flex;align-items:center;justify-content:center;">
                    <span style="font-size:40px;">${p.icon || '📦'}</span>
                  </div>
                `}
                <div style="padding:10px 12px;">
                  <p style="font-size:12px;font-weight:600;color:${textColor};margin:0 0 4px 0;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name}</p>
                  ${!hideBrand && p.brand ? `<span style="display:inline-block;font-size:9px;padding:1px 6px;border-radius:10px;background:${colors.primary}12;color:${colors.primary};font-weight:600;margin-bottom:4px;">${p.brand.name}</span>` : ''}
                  ${!hideDescription && p.description ? `<p style="font-size:10px;color:${subTextColor};margin:0 0 6px 0;line-height:1.2;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${p.description}</p>` : ''}
                  <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                      ${!hidePriceUsd ? `<p style="font-size:16px;font-weight:800;color:${colors.primary};margin:0;">${currency} ${p.price.toFixed(2)}${p.vendePorPeso && p.unidadPeso ? '/' + p.unidadPeso : ''}</p>` : ''}
                      ${!hidePriceBs ? `<p style="font-size:10px;color:${subTextColor};margin:2px 0 0 0;">Bs ${(p.price * bcvRate).toFixed(2)}</p>` : ''}
                    </div>
                    ${!hideStock ? (!p.noStock && p.stock > 0 ? `<span style="font-size:9px;padding:2px 8px;border-radius:20px;background:${p.stock <= (p.minStock || 5) ? '#fef3c7' : '#dcfce7'};color:${p.stock <= (p.minStock || 5) ? '#92400e' : '#166534'};font-weight:600;">${p.stock} disp.</span>` : `<span style="font-size:9px;padding:2px 8px;border-radius:20px;background:#fee2e2;color:#991b1b;font-weight:600;">Agotado</span>`) : ''}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Catalogo - ${storeName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(selectedFont)}:wght@300;400;500;600;700;800;900&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'${selectedFont}',system-ui,sans-serif; ${bgStyleCSS} color:${textColor}; }
    ${bgExtraCSS}
    .catalog-container { max-width:900px; margin:0 auto; }
    .cover { background:linear-gradient(135deg,${colors.primary},${colors.secondary}); color:white; padding:50px 40px; border-radius:0 0 30px 30px; text-align:center; position:relative; overflow:hidden; }
    .cover::before { content:''; position:absolute; top:-50%; left:-50%; width:200%; height:200%; background:radial-gradient(circle at 30% 50%,${colors.accent}40,transparent 50%),radial-gradient(circle at 70% 80%,${colors.primary}30,transparent 40%); }
    .cover * { position:relative; z-index:1; }
    .cover-logo { width:120px; height:120px; border-radius:20px; background:rgba(255,255,255,0.2); backdrop-filter:blur(10px); margin:0 auto 20px; display:flex; align-items:center; justify-content:center; border:2px solid rgba(255,255,255,0.3); padding:10px; }
    .cover-logo img { max-width:100%; max-height:100%; object-fit:contain; }
    .store-name { font-size:32px; font-weight:900; letter-spacing:-0.5px; margin-bottom:8px; text-shadow:0 2px 10px rgba(0,0,0,0.2); }
    .store-info { font-size:13px; opacity:0.9; line-height:1.8; }
    .store-info span { display:inline-flex; align-items:center; gap:4px; margin:0 8px; }
    .content { padding:30px 30px 60px; }
    .header-bar { display:flex; justify-content:space-between; align-items:center; padding:15px 30px; }
    .header-bar h1 { font-size:14px; font-weight:700; color:${colors.primary}; }
    .header-bar span { font-size:11px; color:${subTextColor}; }
    .qr-section { text-align:center; margin-top:40px; padding:30px; background:${cardBg}; border-radius:16px; border:1px solid ${isDark ? '#334155' : '#e2e8f0'}; }
    .qr-section p { font-size:12px; color:${subTextColor}; margin-bottom:12px; }
    .qr-section img { margin:0 auto; border-radius:12px; border:4px solid white; box-shadow:0 4px 20px rgba(0,0,0,0.1); }
    .footer { text-align:center; padding:20px; font-size:10px; color:${subTextColor}; }
    .badge-cat { display:inline-block; font-size:10px; padding:2px 8px; border-radius:20px; background:${colors.primary}15; color:${colors.primary}; font-weight:600; }
    @media print {
      body { background:white !important; ${bgStyle !== 'solid' ? `background-image:none !important;background-color:white !important;` : ''} }
      .cover { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .content { padding:20px; }
      .cover, .qr-section, .card { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    }
  </style>
</head>
<body>
  <div class="catalog-container">
    <!-- PORTADA -->
    <div class="cover">
      ${effectiveLogo ? `<div class="cover-logo"><img src="${toAbsoluteUrl(effectiveLogo)}" alt="${storeName}" onerror="this.parentElement.innerHTML='<span style=\\'font-size:36px;\\'>🏪</span>'" /></div>` : `<div class="cover-logo"><span style="font-size:36px;">🏪</span></div>`}
      <h1 class="store-name">${storeName}</h1>
      <div class="store-info">
        ${storeAddress ? `<span>📍 ${storeAddress}</span>` : ''}
        ${storePhone ? `<span>📞 ${storePhone}</span>` : ''}
        ${storeRif ? `<span>🏢 ${storeRif}</span>` : ''}
      </div>
      <div style="margin-top:20px;">
        <span style="display:inline-block;padding:6px 20px;background:rgba(255,255,255,0.2);backdrop-filter:blur(10px);border-radius:20px;font-size:12px;font-weight:600;border:1px solid rgba(255,255,255,0.3);">
          Catalogo de Productos
        </span>
      </div>
    </div>

    <!-- BARRA INFERIOR PORTADA -->
    <div class="header-bar">
      <h1>Productos Disponibles</h1>
      <span>${products.length} productos &middot; ${categories.length} categorias &middot; ${dateStr}</span>
    </div>

    <!-- PRODUCTOS -->
    <div class="content">
      ${productsHtml}
    </div>

    <!-- QR WHATSAPP -->
    ${qrDataUrl ? `
    <div style="padding:0 30px;">
      <div class="qr-section">
        <p style="font-size:14px;font-weight:600;color:${textColor};">Escanea para pedir por WhatsApp</p>
        <p>Haz tu pedido directamente desde tu celular</p>
        <img src="${qrDataUrl}" alt="QR WhatsApp" width="150" height="150" />
        <p style="margin-top:12px;font-size:11px;color:${subTextColor};">${waUrl}</p>
      </div>
    </div>
    ` : ''}

    <!-- PIE DE PAGINA -->
    <div class="footer">
      <p>${storeName} &middot; ${storeRif} &middot; Generado el ${dateStr}</p>
      <p style="margin-top:4px;">Catalogo generado por MyeCommerce POS v2.9.56</p>
    </div>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    console.error('Catalog generation error:', error);
    return NextResponse.json({ error: 'Error al generar catalogo: ' + (error.message || '') }, { status: 500 });
  }
}
