@echo off
chcp 65001 >nul 2>&1
title MyeCommerce - Crear Usuario Admin
color 0E
echo ============================================================
echo     MyeCommerce POS - CREAR USUARIO ADMIN
echo     (Sin perder datos existentes)
echo ============================================================
echo.

cd /d "%~dp0"

:: Verificar que Node.js esta instalado
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js no esta instalado.
    echo Descarguelo de https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Verificar que la base de datos existe
if not exist "prisma\dev.db" (
    echo [ERROR] No se encontro la base de datos prisma\dev.db
    echo Asegurese de que el sistema esta instalado.
    echo.
    pause
    exit /b 1
)

:: Verificar que node_modules existe
if not exist "node_modules" (
    echo [ERROR] No se encontro node_modules.
    echo Ejecute INSTALAR.bat primero.
    echo.
    pause
    exit /b 1
)

echo [INFO] Creando usuario admin/admin en la base de datos...
echo [INFO] Esto NO eliminara ningun dato existente.
echo.

:: Ejecutar script Node.js para crear admin con SHA-256 + salt fijo
node -e "
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

async function main() {
  const prisma = new PrismaClient();
  
  try {
    // Verificar si admin ya existe
    const existing = await prisma.user.findUnique({ where: { username: 'admin' } });
    
    if (existing) {
      console.log('[AVISO] El usuario admin YA EXISTE.');
      console.log('[AVISO] Nombre completo: ' + existing.fullName);
      console.log('[AVISO] Rol: ' + existing.role);
      console.log('[AVISO] Activo: ' + (existing.isActive ? 'Si' : 'No'));
      console.log('');
      console.log('Si no puede entrar, puede que tenga otra contrasena.');
      console.log('Use la opcion de recuperar dentro del sistema.');
      process.exit(0);
    }
    
    // Crear hash SHA-256 con salt fijo (igual que auth.ts)
    const password = 'admin';
    const salt = 'myecommerce-pos-v2.5';
    const hash = crypto.createHash('sha256').update(password + salt).digest('hex');
    
    // Crear usuario admin
    const user = await prisma.user.create({
      data: {
        username: 'admin',
        password: hash,
        fullName: 'Administrador',
        role: 'admin',
        isActive: true,
        permissions: JSON.stringify({ all: true }),
        avatar: '',
      },
    });
    
    console.log('');
    console.log('============================================================');
    console.log('  USUARIO ADMIN CREADO EXITOSAMENTE!');
    console.log('');
    console.log('  Usuario: admin');
    console.log('  Contrasena: admin');
    console.log('  Rol: Administrador');
    console.log('');
    console.log('  Ya puede iniciar sesion con admin/admin');
    console.log('  SIN perder ningun dato existente.');
    console.log('============================================================');
    console.log('');
    
  } catch (error) {
    console.error('[ERROR] Error al crear usuario:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
"

if %ERRORLEVEL% EQU 0 (
    echo [OK] Proceso completado.
    echo.
    echo Ahora puede iniciar el sistema con:
    echo   INICIAR-MYECCOMMERCE.bat
    echo.
    echo Y entrar con:
    echo   Usuario: admin
    echo   Contrasena: admin
) else (
    echo [ERROR] Fallo la creacion del usuario admin.
    echo Verifique que el sistema esta instalado correctamente.
)

echo.
pause
