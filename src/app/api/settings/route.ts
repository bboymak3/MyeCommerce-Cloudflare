import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    let settings = await db.settings.findFirst();
    if (!settings) {
      settings = await db.settings.create({
        data: {
          storeName: 'Mi Tienda',
          storeAddress: '',
          storePhone: '',
          storeRif: '',
          bcvRate: 36.50,
          taxRate: 0,
          currency: 'USD',
          allowZeroStock: false,
          enableDiscount: false,
          maxDiscountPct: 20,
          ticketFontSize: 8,
          ticketFontFamily: 'monospace',
          ticketHeaderMsg: '',
          ticketFooterMsg: 'Gracias por su compra!',
          ticketShowPhone: true,
          ticketShowSeller: true,
          ticketShowExchange: true,
          ticketCurrencyMode: "dual",
          ticketShowSlogan: false,
          ticketBold: true,
          ticketPaperWidth: '58mm',
          ticketMarginLeft: 0,
          ticketMarginRight: 0,
          ticketUseAgent: true,
          ticketAgentUrl: 'http://localhost:9100',
          storeLogo: '',
          businessType: 'general',
          taxMode: 'included',
          themeMode: 'light',
          euroUsdtRate: 0,
          promoActive: true,
          promoLabel: 'PRECIO EXCLUSIVO',
          promoOldPrice: 280,
          promoCurrentPrice: 180,
          promoExpiryDate: '',
        },
      });
    }
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener configuracion' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    let settings = await db.settings.findFirst();

    const bcvRate = parseFloat(body.bcvRate);
    if (isNaN(bcvRate) || bcvRate <= 0) {
      return NextResponse.json({ error: 'La tasa de cambio debe ser un numero mayor a cero' }, { status: 400 });
    }
    if (!body.storeName?.trim()) {
      return NextResponse.json({ error: 'El nombre de la tienda es requerido' }, { status: 400 });
    }
    const maxDiscountPct = parseInt(body.maxDiscountPct);
    const clampedDiscount = isNaN(maxDiscountPct) ? 20 : Math.min(100, Math.max(0, maxDiscountPct));

    const updateData: any = {
      storeName: body.storeName.trim(),
      storeAddress: body.storeAddress || '',
      storePhone: body.storePhone || '',
      storeRif: body.storeRif || '',
      bcvRate,
      taxRate: Math.max(0, parseFloat(body.taxRate || 0)),
      currency: body.currency || 'USD',
      allowZeroStock: body.allowZeroStock === true,
      enableDiscount: body.enableDiscount === true,
      maxDiscountPct: clampedDiscount,
      theme: body.theme || 'blue',
      ticketFontSize: parseInt(body.ticketFontSize) || 8,
      ticketFontFamily: body.ticketFontFamily || 'monospace',
      ticketHeaderMsg: body.ticketHeaderMsg || '',
      ticketFooterMsg: body.ticketFooterMsg || 'Gracias por su compra!',
      ticketShowPhone: body.ticketShowPhone === true,
      ticketShowSeller: body.ticketShowSeller === true,
      ticketShowExchange: body.ticketShowExchange === true,
      ticketCurrencyMode: body.ticketCurrencyMode || "dual",
      ticketShowSlogan: body.ticketShowSlogan === true,
      ticketShowCashReceived: body.ticketShowCashReceived === true,
      ticketShowLogo: body.ticketShowLogo === true,
      ticketBold: body.ticketBold === true,
      ticketPaperWidth: body.ticketPaperWidth || '58mm',
      ticketMarginLeft: parseFloat(body.ticketMarginLeft) || 0,
      ticketMarginRight: parseFloat(body.ticketMarginRight) || 0,
      ticketUseAgent: body.ticketUseAgent === true,
      ticketAgentUrl: body.ticketAgentUrl || 'http://localhost:9100',
      storeLogo: body.storeLogo || '',
      businessType: body.businessType || 'general',
      taxMode: body.taxMode || 'included',
      themeMode: body.themeMode || 'light',
      euroUsdtRate: Math.max(0, parseFloat(body.euroUsdtRate || 0)),
      promoActive: body.promoActive !== false,
      promoLabel: body.promoLabel || 'PRECIO EXCLUSIVO',
      promoOldPrice: parseFloat(body.promoOldPrice) || 280,
      promoCurrentPrice: parseFloat(body.promoCurrentPrice) || 180,
      promoExpiryDate: body.promoExpiryDate || '',
    };

    if (settings) {
      settings = await db.settings.update({
        where: { id: settings.id },
        data: updateData,
      });
    } else {
      settings = await db.settings.create({ data: updateData });
    }
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: 'Error al guardar configuracion' }, { status: 500 });
  }
}
