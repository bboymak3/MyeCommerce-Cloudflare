# Agente Local de Impresion ESC/POS — MyeCommerce POS v2.9.15

## Que es?

Este agente es un pequeño servidor que se ejecuta en la PC donde esta conectada la impresora termica. Recibe los datos de impresion desde el navegador de MyeCommerce POS y los envia directamente a la impresora via USB o puerto COM.

## Por que se necesita?

Los navegadores web no pueden acceder directamente a los puertos USB de la computadora. El agente sirve como "puente" entre el navegador y la impresora termica.

## Instalacion

### Requisitos
- **Node.js** v18 o superior ([descargar aqui](https://nodejs.org))
- Impresora termica conectada via USB

### Pasos

1. Abra una terminal/consola en la PC donde esta la impresora

2. Navegue a la carpeta `printer-agent` del proyecto:
   ```
   cd printer-agent
   ```

3. Instale las dependencias:
   ```
   npm install
   ```

   > **Nota:** Si `serialport` falla al instalar, necesita herramientas de compilacion:
   > - **Windows:** Instale [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
   > - **Linux:** `sudo apt install build-essential`
   > - **macOS:** `xcode-select --install`

4. Inicie el agente:
   ```
   node agent.js
   ```

5. Verifique que aparece:
   ```
   [OK] Impresora termica detectada: COM3 (POS-58)
   Servidor listo en http://0.0.0.0:9100
   ```

## Configuracion en MyeCommerce POS

1. En **Configuracion > Ticket de Impresion**:
   - Active **"Usar agente de impresion local"**
   - La direccion por defecto es `http://localhost:9100`
   - Haga clic en **"Probar conexion"** para verificar

2. El sistema detectara automaticamente la impresora conectada

## Endpoints del Agente

| Metodo | URL | Descripcion |
|--------|-----|-------------|
| GET | `/status` | Verifica si el agente esta activo |
| GET | `/ports` | Lista puertos USB/COM disponibles |
| POST | `/detect` | Detecta impresora termica automaticamente |
| POST | `/print` | Recibe buffer ESC/POS y lo imprime |

## Solucion de Problemas

### El agente no detecta la impresora
- Verifique que la impresora este encendida y conectada via USB
- Ejecute `node agent.js` y revise los puertos listados
- Puede especificar el puerto manualmente si la deteccion falla

### Error al instalar serialport
- Necesita herramientas de compilacion C++ (ver arriba)
- Alternativa: sin serialport, el agente guardara los archivos en `printer-agent/spool/`

### La impresion no sale
- Verifique que el agente este corriendo (`http://localhost:9100/status`)
- Revise la consola del agente para mensajes de error
- Asegurese de que ningun otro programa este usando la impresora

## Ejecutar como servicio (Windows)

Para que el agente inicie automaticamente con Windows:

1. Presione `Win+R`, escriba `shell:startup`
2. Cree un acceso directo que apunte a:
   ```
   cmd /k "cd /d RUTA_A_LA_CARPETA && node agent.js"
   ```

## Ejecutar como servicio (Linux)

Cree un archivo `/etc/systemd/system/myecommerce-printer.service`:
```ini
[Unit]
Description=MyeCommerce Printer Agent
After=network.target

[Service]
Type=simple
User=USUARIO
WorkingDirectory=/RUTA_A_LA_CARPETA/printer-agent
ExecStart=/usr/bin/node agent.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Luego:
```bash
sudo systemctl daemon-reload
sudo systemctl enable myecommerce-printer
sudo systemctl start myecommerce-printer
```
