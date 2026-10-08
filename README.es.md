<div align="center">

# ASRPRO Studio

**Tu voz. Tus comandos. Tu ASRPRO-01.**

Configura, compila, carga y enseña comandos de voz. Todo en un entorno local.

[English](README.md) · [**Español**](README.es.md)

![Placa](https://img.shields.io/badge/Placa-ASRPRO--01-087f8c)
![Plataforma](https://img.shields.io/badge/Plataforma-Windows_x64-2563eb)
![Idiomas](https://img.shields.io/badge/Interfaz-EN_%2F_ES-16a34a)
![Licencia](https://img.shields.io/badge/Codigo_propio-MIT-52525b)

[Descargar para Windows](https://github.com/adriviciano/ASRPRO-Studio/releases/tag/v0.1.0-private) · [Inicio rápido](#inicio-rápido) · [Desarrollo](#desarrollo)

</div>

---

> **Paquete privado para uso personal.** Incluye herramientas del fabricante cuyo permiso de redistribución pública no se ha confirmado. MIT corresponde a nuestro código, no al SDK. Consulta los [avisos de terceros](THIRD-PARTY-NOTICES.md).

## Del USB a la Voz

| Etapa | Qué ocurre |
| :--- | :--- |
| **0 · Conectar** | Selecciona el puerto serie USB de la placa. |
| **1 · Definir** | Introduce los nombres de los comandos y sus mensajes UART. |
| **2 · Compilar** | Genera el firmware para la configuración guardada. |
| **3 · Cargar** | Súbelo y espera la verificación y la confirmación de la placa. |
| **4 · Grabar** | Di cada frase ante el micrófono de la placa y repítela cuando se indique. |

Pulsa las etapas para retroceder o avanzar cuando se cumplan sus requisitos. Sin una placa conectada solo aparece el paso 0. Si la placa confirma que tiene los mismos comandos, puedes ir directamente a grabar.

**Escribir una frase no se la enseña a la placa.** Grábala usando el micrófono de la ASRPRO-01, no el del ordenador.

## Inicio Rápido

1. Descarga `ASRPRO-Studio-Windows-x64.zip` desde la [release privada](https://github.com/adriviciano/ASRPRO-Studio/releases/tag/v0.1.0-private). Necesitas acceso al repositorio.
2. Extrae **todo el ZIP** en una carpeta corta con permisos de escritura, como `C:\ASRPRO-Studio`.
3. Conecta la ASRPRO-01 con un cable USB de datos.
4. Abre `ASRPRO-Studio.exe` y sigue las etapas en el navegador.

Mantén abierta la ventana del lanzador mientras usas la aplicación. Al cerrarla se detiene el servidor local. No separes el ejecutable de las carpetas `app` y `runtime`.

| Requisito | Detalles |
| :--- | :--- |
| Sistema | Windows x64 |
| Lanzador | .NET Framework 4.5 o posterior |
| USB | Controlador CH340 y cable USB de datos |
| Carpeta | Corta y con permisos de escritura; las rutas largas pueden hacer fallar el compilador oficial |
| Entorno de ejecución | Node.js incluido; no hace falta instalarlo |

El ejecutable no está firmado y Windows puede mostrar una advertencia. No necesitas abrir Tianwen Block ni su interfaz china.

> **Antes de cargar:** subir firmware borra las frases aprendidas. La aplicación pide confirmación y guarda un respaldo en `app/output/backups`. No desconectes USB durante la carga. El paquete no contiene grabaciones personales ni respaldos de la placa.

## Pensado para la ASRPRO-01

- Modo guiado predeterminado y entorno avanzado en `/avanzado`.
- Entre **1 y 10 comandos**, con frases y mensajes personalizables.
- Frase de activación opcional.
- Indicaciones de grabación: escuchando, repetir, aprendida y reintentar.
- Importación y exportación de proyectos y actividad de reconocimiento.
- Verificación del firmware mediante CRC y lectura posterior.
- Español e inglés. Inglés por defecto, salvo que el idioma principal del sistema/navegador sea español; puedes cambiarlo durante la sesión.
- El aprendizaje y reconocimiento se ejecutan en la placa. La aplicación no sube las grabaciones del micrófono a un servicio en la nube.

<details>
<summary><strong>Ver la placa compatible</strong></summary>

<p align="center">
<img src="public/board.jpeg" alt="Placa ASRPRO-01 con conector USB-C y micrófono integrado" width="280">
</p>

Probado con la ASRPRO-01 de la fotografía. No se garantiza compatibilidad con otras placas o revisiones.

</details>

## Conecta Tu Proyecto

Los comandos salen por UART a **115200 baudios, con lógica de 3,3 V**.

| Pin ASRPRO-01 | Función |
| :--- | :--- |
| `PB5` | TX: salida de comandos |
| `PB6` | RX: comunicación de entrada |
| `GND` | Masa común con el receptor |

Para un monitor ESP32 que solo recibe: **PB5 → GPIO27**, **GND → GND**. Utiliza el [ejemplo de monitor serie](esp32/monitor-voz/monitor-voz.ino). El [ejemplo de controlador](esp32/control-voz/README.md) procesa órdenes concretas.

El reconocimiento puede emitir el mensaje configurado y `CMD:<id>`. El controlador receptor decide qué acción ejecutar. ASRPRO Studio no está asociado a un aparato específico.

## Desarrollo

El código está en este repositorio. Las herramientas del fabricante se guardan por separado en la release privada, no en el historial Git. Coloca el SDK correspondiente en `vendor/asrpro`.

Utiliza una versión de Node.js compatible con las dependencias. El paquete portátil incluye **Node.js 24.15.0**.

```powershell
npm ci
npm run dev
```

Abre [http://127.0.0.1:5187/](http://127.0.0.1:5187/). El servidor solo escucha en localhost. `/` abre el modo guiado, `/avanzado` el avanzado y `/guiado` es un alias del guiado.

| Carpeta | Contenido |
| :--- | :--- |
| `src/app` | Interfaz Angular 17, servicios y traducciones |
| `server` | API local, integración del compilador y programador serie |
| `firmware` | Firmware personalizado ASRPRO |
| `esp32` | Ejemplos de monitor serie y controlador |
| `scripts` | Lanzador Windows, empaquetado y comprobaciones |

Las instalaciones nuevas usan [voice-commands.example.json](voice-commands.example.json). Al guardar se crea `voice-commands.json`, excluido de Git. La configuración local existente se conserva.

### Comprobar y Empaquetar

```powershell
npm test
npm run check
npm run build
powershell -ExecutionPolicy Bypass -File scripts/build-portable.ps1
```

El empaquetado requiere el SDK oficial y una carpeta de salida limpia. Las pruebas de integración del firmware necesitan artefactos de compilación local; se omiten si no existen. [test-portable.ps1](scripts/test-portable.ps1) comprueba el arranque, la interfaz, la consulta USB y la compilación **sin cargar nada en la placa**.

## Solución de Problemas

| Síntoma | Primera comprobación |
| :--- | :--- |
| No aparece el puerto | Cable de datos, controlador CH340, otra aplicación usando el puerto |
| No encuentra cabeceras al compilar | Extraer en una ruta más corta y mantener juntas las carpetas |
| No reconoce tras cargar | Volver a grabar; la carga borra las plantillas aprendidas |
| Rechaza una frase | Esperar la escucha y repetir con claridad, tono y distancia similares |
| La grabación está bloqueada | Conectar y comprobar que el firmware coincide con los comandos guardados |

## Licencia y Créditos

Nuestro código utiliza [MIT](LICENSE). Node.js, las dependencias JavaScript, el compilador RISC-V, el SDK ASRPRO, los modelos y el agente de programación conservan sus licencias y avisos.

Proyecto independiente, no una aplicación oficial del fabricante. La compilación y la carga usan sus herramientas, pero no requieren ejecutar el programa gráfico original.

**Mantén el paquete con terceros privado hasta revisar los permisos de redistribución.** Atribuir al autor no sustituye su autorización.
