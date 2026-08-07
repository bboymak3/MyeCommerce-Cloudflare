import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { validateLicenseKey, getLicenseFeatures, getLicenseLimits, getPlanInfo, type LicenseInfo } from '@/lib/license';
import { getMachineId } from '@/lib/machine-id';

// Obtener estado actual de la licencia
export async function GET(req: NextRequest) {
  try {
    const currentMachineId = getMachineId();
    let license = await db.license.findFirst();

    if (!license) {
      // No auto-crear trial — el sistema requiere una clave del administrador
      return NextResponse.json({
        isValid: false,
        licenseType: "trial" as const,
        machineId: currentMachineId,
        licenseKey: "",
        activatedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
        daysRemaining: 0,
        isExpired: true,
        maxProducts: 0,
        maxDailySales: 0,
        maxUsers: 1,
        ownerName: "",
        ownerEmail: "",
        ownerPhone: "",
        ownerRif: "",
        features: {
          pos: false, products: false, categories: false, cashClosing: false,
          devolutions: false, basicReports: false, advancedReports: false,
          salesCharts: false, autoBackup: false, exportImport: false,
          noWatermark: false, unlimitedProducts: false, unlimitedSales: false,
          multipleUsers: false, inventoryAlerts: false, printInvoice: false,
          productDiscount: false, saleNotes: false, priceHistory: false,
          frequentCustomers: false, allowZeroStockConfig: false,
        },
        maxActivations: 0,
        activationCount: 0,
        previousMachines: [] as string[],
        isSameMachine: true,
        machineMismatch: false,
        mismatchReason: "",
        blockedReason: "",
        needsActivation: true,
      });
    }

    // TAMPER DETECTION: re-validar la clave almacenada contra manipulacion de BD
    if (license.licenseType !== 'trial' && license.licenseKey && license.licenseKey !== 'TRIAL-AUTO') {
      const keyCheck = validateLicenseKey(license.licenseKey, '', process.env.LICENSE_SECRET);
      if (!keyCheck.valid) {
        const features = getLicenseFeatures(license.licenseType);
        return NextResponse.json({
          isValid: false,
          licenseType: license.licenseType as "trial" | "basica" | "profesional",
          machineId: currentMachineId,
          licenseKey: license.licenseKey,
          activatedAt: license.activatedAt.toISOString(),
          expiresAt: license.expiresAt.toISOString(),
          daysRemaining: 0,
          isExpired: true,
          maxProducts: 0,
          maxDailySales: 0,
          maxUsers: 1,
          ownerName: license.ownerName || "",
          ownerEmail: license.ownerEmail || "",
          ownerPhone: license.ownerPhone || "",
          ownerRif: license.ownerRif || "",
          features,
          maxActivations: license.maxActivations,
          activationCount: license.activationCount,
          previousMachines: [] as string[],
          isSameMachine: false,
          machineMismatch: true,
          mismatchReason: "Licencia manipulada o corrupta",
          blockedReason: "La clave de licencia no pasa la verificacion. Contacte al administrador.",
        });
      }
    }

    const isExpired = new Date(license.expiresAt) < new Date();
    const daysRemaining = Math.max(
      0,
      Math.ceil((new Date(license.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    );

    const features = getLicenseFeatures(license.licenseType);
    const limits = getLicenseLimits(license.licenseType);

    // NIVEL 1: Verificar que la maquina actual coincide
    const isSameMachine = license.machineId === currentMachineId;
    const machineMismatch = !isSameMachine && license.licenseType !== 'trial';

    let isValid = license.isActive && !isExpired && isSameMachine;
    let mismatchReason = '';

    // Solo bloquear si hay un blockedReason explícito O si se agotaron activaciones
    const activationsRemaining = license.maxActivations - license.activationCount;
    const hasActivationsLeft = activationsRemaining > 0;

    if (machineMismatch) {
      if (!hasActivationsLeft && license.blockedReason) {
        // Sin activaciones restantes Y con motivo de bloqueo → bloqueada de verdad
        isValid = false;
        mismatchReason = license.blockedReason;
      } else if (!hasActivationsLeft) {
        // Sin activaciones restantes pero sin bloqueo explícito → advertir pero no bloquear API
        isValid = false;
        mismatchReason = `Maximo de activaciones alcanzado (${license.maxActivations}). Contacte al administrador.`;
      } else {
        // Hay activaciones restantes → no bloquear, solo advertir para reactivar
        isValid = false;
        mismatchReason = '';
      }
    }

    // Parsear historial de maquinas
    let previousMachinesList: string[] = [];
    try {
      previousMachinesList = license.previousMachines ? JSON.parse(license.previousMachines) : [];
    } catch {
      previousMachinesList = [];
    }

    const info: LicenseInfo = {
      isValid,
      licenseType: license.licenseType as "trial" | "basica" | "profesional",
      machineId: currentMachineId,
      licenseKey: license.licenseKey,
      activatedAt: license.activatedAt.toISOString(),
      expiresAt: license.expiresAt.toISOString(),
      daysRemaining,
      isExpired,
      maxProducts: limits.maxProducts,
      maxDailySales: limits.maxDailySales,
      maxUsers: limits.maxUsers,
      ownerName: license.ownerName,
      ownerEmail: license.ownerEmail,
      ownerPhone: license.ownerPhone,
      ownerRif: license.ownerRif,
      features,
      maxActivations: license.maxActivations,
      activationCount: license.activationCount,
      previousMachines: previousMachinesList,
      isSameMachine,
      machineMismatch,
      mismatchReason,
      blockedReason: license.blockedReason,
    };

    return NextResponse.json(info);
  } catch (error) {
    console.error('License GET error:', error);
    return NextResponse.json(
      {
        isValid: false,
        licenseType: "trial" as const,
        machineId: "UNKNOWN",
        licenseKey: "",
        activatedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
        daysRemaining: 0,
        isExpired: true,
        maxProducts: 0,
        maxDailySales: 0,
        maxUsers: 1,
        ownerName: "",
        ownerEmail: "",
        ownerPhone: "",
        ownerRif: "",
        features: {
          pos: false,
          products: false,
          categories: false,
          cashClosing: false,
          devolutions: false,
          basicReports: false,
          advancedReports: false,
          salesCharts: false,
          autoBackup: false,
          exportImport: false,
          noWatermark: false,
          unlimitedProducts: false,
          unlimitedSales: false,
          multipleUsers: false,
          inventoryAlerts: false,
          printInvoice: false,
          productDiscount: false,
          saleNotes: false,
          priceHistory: false,
          frequentCustomers: false,
          allowZeroStockConfig: false,
        },
        maxActivations: 0,
        activationCount: 0,
        previousMachines: [],
        isSameMachine: false,
        machineMismatch: true,
        mismatchReason: "Error al obtener licencia",
        blockedReason: "",
        error: "Error al obtener licencia",
      },
      { status: 500 }
    );
  }
}

// Activar una licencia con clave
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { licenseKey, ownerName, ownerEmail, ownerPhone, ownerRif } = body;

    if (!licenseKey || !licenseKey.trim()) {
      return NextResponse.json({ error: "Clave de licencia requerida" }, { status: 400 });
    }

    const currentMachineId = getMachineId();
    const validation = validateLicenseKey(licenseKey, currentMachineId);

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error || "Clave invalida" }, { status: 400 });
    }

    const cleanKey = licenseKey.trim().toUpperCase();

    let license = await db.license.findFirst();
    const planInfo = getPlanInfo(validation.licenseType);
    const isNewKey = license && license.licenseKey !== cleanKey;

    if (license && !isNewKey) {
      // CASO 1: Ya tiene licencia registrada y es la MISMA clave

      // 1a. MISMA maquina -> renovar/actualizar
      if (license.machineId === currentMachineId) {
        license = await db.license.update({
          where: { id: license.id },
          data: {
            licenseKey: licenseKey.trim().toUpperCase(),
            licenseType: validation.licenseType,
            activatedAt: validation.activatedAt || new Date(),
            expiresAt: validation.expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            maxProducts: planInfo.maxProducts,
            maxDailySales: planInfo.maxDailySales,
            maxUsers: planInfo.maxUsers,
            maxActivations: planInfo.maxActivations,
            isActive: true,
            blockedReason: '',
            ownerName: ownerName || license.ownerName,
            ownerEmail: ownerEmail || license.ownerEmail,
            ownerPhone: ownerPhone || license.ownerPhone,
            ownerRif: ownerRif || license.ownerRif,
            notes: `Licencia renovada/actualizada en misma maquina - ${new Date().toLocaleString('es-VE')}`,
          },
        });

        return NextResponse.json({
          success: true,
          message: `Licencia ${validation.licenseType.toUpperCase()} actualizada exitosamente`,
          action: 'renewed',
          machineId: currentMachineId,
          license: {
            licenseType: validation.licenseType,
            expiresAt: license.expiresAt.toISOString(),
            daysRemaining: Math.ceil((new Date(license.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
            features: getLicenseFeatures(validation.licenseType),
          },
        });
      }

      // 1b. MAQUINA DIFERENTE -> Verificar activaciones (Nivel 2)
      if (license.machineId !== currentMachineId) {
        let previousMachinesList: any[] = [];
        try {
          previousMachinesList = license.previousMachines ? JSON.parse(license.previousMachines) : [];
        } catch {
          previousMachinesList = [];
        }

        const wasPreviouslyUsed = previousMachinesList.some(
          (m: any) => typeof m === 'string' ? m === currentMachineId : m.machineId === currentMachineId
        );

        if (wasPreviouslyUsed) {
          const oldMachine = { machineId: license.machineId, lastSeen: new Date().toISOString() };
          if (!previousMachinesList.some((m: any) => typeof m === 'string' ? false : m.machineId === oldMachine.machineId)) {
            previousMachinesList.push(oldMachine);
          }

          license = await db.license.update({
            where: { id: license.id },
            data: {
              machineId: currentMachineId,
              licenseKey: licenseKey.trim().toUpperCase(),
              licenseType: validation.licenseType,
              activatedAt: new Date(),
              expiresAt: validation.expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              maxProducts: planInfo.maxProducts,
              maxDailySales: planInfo.maxDailySales,
              maxUsers: planInfo.maxUsers,
              maxActivations: planInfo.maxActivations,
              isActive: true,
              activationCount: license.activationCount + 1,
              previousMachines: JSON.stringify(previousMachinesList),
              blockedReason: '',
              ownerName: ownerName || license.ownerName,
              ownerEmail: ownerEmail || license.ownerEmail,
              ownerPhone: ownerPhone || license.ownerPhone,
              ownerRif: ownerRif || license.ownerRif,
              notes: `Reactivacion en maquina previamente registrada - ${new Date().toLocaleString('es-VE')}`,
            },
          });

          return NextResponse.json({
            success: true,
            message: `Licencia ${validation.licenseType.toUpperCase()} reactivada exitosamente`,
            action: 'reactivated',
            machineId: currentMachineId,
            license: {
              licenseType: validation.licenseType,
              expiresAt: license.expiresAt.toISOString(),
              daysRemaining: Math.ceil((new Date(license.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
              features: getLicenseFeatures(validation.licenseType),
            },
          });
        }

        // Maquina NUEVA -> verificar max activaciones
        if (license.activationCount >= license.maxActivations) {
          return NextResponse.json({
            error: `LICENCIA BLOQUEADA: Esta clave ya fue activada en ${license.activationCount} equipos diferentes.`,
            code: 'MAX_ACTIVATIONS_EXCEEDED',
            message: `Ha excedido el maximo de ${license.maxActivations} activaciones permitidas. Contacte al administrador para solicitar una nueva licencia.`,
          }, { status: 403 });
        }

        const oldMachine = { machineId: license.machineId, lastSeen: new Date().toISOString() };
        previousMachinesList.push(oldMachine);

        license = await db.license.update({
          where: { id: license.id },
          data: {
            machineId: currentMachineId,
            licenseKey: licenseKey.trim().toUpperCase(),
            licenseType: validation.licenseType,
            activatedAt: new Date(),
            expiresAt: validation.expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            maxProducts: planInfo.maxProducts,
            maxDailySales: planInfo.maxDailySales,
            maxUsers: planInfo.maxUsers,
            maxActivations: planInfo.maxActivations,
            isActive: true,
            activationCount: license.activationCount + 1,
            previousMachines: JSON.stringify(previousMachinesList),
            blockedReason: '',
            ownerName: ownerName || license.ownerName,
            ownerEmail: ownerEmail || license.ownerEmail,
            ownerPhone: ownerPhone || license.ownerPhone,
            ownerRif: ownerRif || license.ownerRif,
            notes: `Activacion #${license.activationCount + 1} en nueva maquina (anterior: ${license.machineId}) - ${new Date().toLocaleString('es-VE')}`,
          },
        });

        return NextResponse.json({
          success: true,
          message: `Licencia ${validation.licenseType.toUpperCase()} activada en nuevo equipo. Quedan ${license.maxActivations - license.activationCount} activaciones.`,
          action: 'new_machine',
          machineId: currentMachineId,
          activationsRemaining: license.maxActivations - license.activationCount,
          license: {
            licenseType: validation.licenseType,
            expiresAt: license.expiresAt.toISOString(),
            daysRemaining: Math.ceil((new Date(license.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
            features: getLicenseFeatures(validation.licenseType),
          },
        });
      }
    }

    // CASO 2: Primera activacion O clave NUEVA diferente
    // (si hay un registro con clave distinta, se elimina y se crea fresco)
    if (isNewKey) {
      await db.license.delete({ where: { id: license.id } });
    }
    license = await db.license.create({
      data: {
        machineId: currentMachineId,
        licenseKey: cleanKey,
        licenseType: validation.licenseType,
        activatedAt: validation.activatedAt || new Date(),
        expiresAt: validation.expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        maxProducts: planInfo.maxProducts,
        maxDailySales: planInfo.maxDailySales,
        maxUsers: planInfo.maxUsers,
        maxActivations: planInfo.maxActivations,
        isActive: true,
        activationCount: 1,
        previousMachines: '',
        blockedReason: '',
        ownerName: ownerName || '',
        ownerEmail: ownerEmail || '',
        ownerPhone: ownerPhone || '',
        ownerRif: ownerRif || '',
        notes: isNewKey
          ? `Nueva licencia reemplaza anterior - maquina ${currentMachineId} - ${new Date().toLocaleString('es-VE')}`
          : `Primera activacion en maquina ${currentMachineId} - ${new Date().toLocaleString('es-VE')}`,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Licencia ${validation.licenseType.toUpperCase()} activada exitosamente`,
      action: 'first_activation',
      machineId: currentMachineId,
      license: {
        licenseType: validation.licenseType,
        expiresAt: license.expiresAt.toISOString(),
        daysRemaining: Math.ceil((new Date(license.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        features: getLicenseFeatures(validation.licenseType),
      },
    });
  } catch (error) {
    console.error("License activation error:", error);
    return NextResponse.json({ error: "Error al activar licencia" }, { status: 500 });
  }
}
