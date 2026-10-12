<div align="center">

# ASRPRO Studio

**Tu voz. Tus comandos. Tu ASRPRO-01.**

Configura, compila, carga y enseña comandos de voz. Todo en un entorno local.

[English](README.md) · [**Español**](README.es.md)

![Placa](https://img.shields.io/badge/Placa-ASRPRO--01-087f8c)
![Plataforma](https://img.shields.io/badge/Plataforma-Windows_x64-2563eb)
![Idiomas](https://img.shields.io/badge/Interfaz-EN_%2F_ES-16a34a)
![Licencia](https://img.shields.io/badge/Codigo_propio-MIT-52525b)

[Descargar para Windows](https://github.com/adriviciano/ASRPRO-Studio/releases/latest) · [Inicio rápido](#inicio-rápido) · [Desarrollo](#desarrollo)

</div>

---

> **Herramientas externas.** El ejecutable y este repositorio no incluyen Tianwen Block, su SDK, modelos ni compilador. Studio los localiza en tu PC u ofrece el instalador oficial. MIT solo cubre nuestro codigo. Consulta [Avisos de terceros](THIRD-PARTY-NOTICES.md).

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

### Un Ejecutable, Herramientas Externas

`ASRPRO-Studio.exe` incluye la aplicación y Node.js, pero
no incluye el instalador Tianwen Block ni el SDK del fabricante. Detecta una
instalación compatible junto al ejecutable o en ubicaciones habituales. Si no
la encuentra, permite seleccionar una carpeta o autorizar la descarga del
instalador oficial de 816 MB. Tú revisas la licencia y los permisos de Windows.
La versión verificada es 2025-1a0907; se rechazan descargas distintas mediante SHA-256.
Studio prepara su propia copia del SDK sin modificar la instalación original.
Requiere Windows x64, .NET Framework 4.5+, navegador y controlador USB CH340.
El asistente de inicio y descarga siempre está en inglés; la aplicación conserva inglés/español. El primer inicio extrae la aplicación en `%LOCALAPPDATA%\ASRPRO`; los siguientes la reutilizan.

1. Descarga `ASRPRO-Studio.exe` desde la [última release](https://github.com/adriviciano/ASRPRO-Studio/releases/latest).
2. Ábrelo desde una carpeta con permisos de escritura; no necesita carpetas junto al exe.
3. Deja que detecte Tianwen, selecciona su carpeta o autoriza su descarga e instalación interactiva.
4. Conecta la ASRPRO-01 con un cable USB de datos y sigue las etapas.

Mantén abierto el lanzador mientras usas Studio. Cerrarlo detiene su servidor local.

| Requisito | Detalles |
| :--- | :--- |
| Sistema | Windows x64 |
| Lanzador | .NET Framework 4.5 o posterior |
| USB | Controlador CH340 y cable USB de datos |
| Carpeta | Corta y con permisos de escritura; las rutas largas pueden hacer fallar el compilador oficial |
| Entorno de ejecución | Node.js incluido; no hace falta instalarlo |

### Avisos de Seguridad de Windows

El ejecutable **no está firmado digitalmente**. SmartScreen puede mostrar «Windows protegió su PC» o un aviso de editor desconocido por falta de reputación. Eso por si solo no significa que haya detectado malware. Descarga solo desde este repositorio y compara SHA-256 con las notas de la release. Si Defender detecta una amenaza concreta, no la des por inofensiva ni desactives la protección: detente e informa de la detección exacta.

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

El uso previsto pasa por el ejecutable, también cuando lo compilas tu. Generar Studio **no requiere** Tianwen ni su SDK. Compilar después el firmware si necesita las herramientas externas; el lanzador gestiona su preparación.

Utiliza una versión de Node.js compatible con las dependencias. El paquete portátil incluye **Node.js 24.15.0**.

```powershell
npm ci
npm test
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-exe.ps1
```

Compila en Windows x64 con Node.js 24.15.0, npm y .NET Framework 4.5+ (con compilador C#). El resultado es `releases/ASRPRO-Studio.exe`; ábrelo para preparar las herramientas externas. Se instalan dependencias de producción en una carpeta aislada y se incluye Node.js con su licencia. Nunca se copia `vendor`, comandos personales ni respaldos. Usa `-OutputDirectory C:\ASRPRO-build` para otra carpeta; no se sobrescriben ejecutables existentes.

Solo para desarrollar, `npm run dev` abre [http://127.0.0.1:5187/](http://127.0.0.1:5187/). El servidor solo escucha en localhost. `/` abre el modo guiado, `/avanzado` el avanzado y `/guiado` es un alias del guiado.

| Carpeta | Contenido |
| :--- | :--- |
| `src/app` | Interfaz Angular 17, servicios y traducciones |
| `server` | API local, integración del compilador y programador serie |
| `firmware` | Firmware personalizado ASRPRO |
| `esp32` | Ejemplos de monitor serie y controlador |
| `scripts` | Lanzador Windows, empaquetado y comprobaciones |

Las instalaciones nuevas usan [voice-commands.example.json](voice-commands.example.json). Al guardar se crea `voice-commands.json`, excluido de Git. La configuración local existente se conserva.

### Comprobar y Empaquetar

Las dependencias actuales tienen avisos de seguridad de npm, incluidos avisos de gravedad alta en producción. Esta versión no es una auditoría de seguridad; las actualizaciones y su compatibilidad necesitan revisión aparte. Mantén el servicio local y no lo expongas a la red.

```powershell
npm test
npm run check
npm run build
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-exe.ps1
```

El empaquetado no requiere SDK. Las pruebas de firmware necesitan artefactos locales y se omiten si faltan. Ejecuta `releases\ASRPRO-Studio.exe --self-test` para probar el arranque con Tianwen compatible instalado, sin abrir el instalador ni cargar la placa. La instalación completa en un PC sin Tianwen aún no se ha probado. El servidor de desarrollo no ejecuta el asistente: sus funciones de firmware requieren SDK local en `vendor/asrpro`.

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

Las herramientas externas conservan sus condiciones y no estan cubiertas por MIT. Excluir sus archivos no equivale a una auditoría legal completa de dependencias o integración con el SDK. Atribuir al autor no sustituye su autorización.
