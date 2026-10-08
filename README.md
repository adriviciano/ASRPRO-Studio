# ASRPRO Studio

Estado: codigo fuente funcional con dependencias externas del fabricante.
No necesita ejecutar la interfaz china, pero compilar y cargar firmware requiere
el SDK, modelos y agente de programacion oficiales. La copia portatil privada
incluye estos archivos para uso personal, conservando sus avisos originales.
No son MIT ni se ha confirmado permiso para redistribuirlos publicamente.

## Windows portatil (copia privada)

Descargar el ZIP de Releases, extraerlo completo en una carpeta con permisos de
escritura y abrir `ASRPRO-Studio.exe`. Se abre la interfaz en el navegador.
Mantener abierta la ventana del lanzador; cerrarla detiene el servidor local.
No requiere instalar Node ni ejecutar Tianwen Block. Windows debe disponer
de .NET Framework 4.5 o posterior y del controlador USB CH340 de la placa.
El ejecutable no esta firmado; Windows puede mostrar una advertencia.
No mover el exe fuera de su carpeta: necesita `app` y `runtime` junto a el.
El paquete no incluye grabaciones ni respaldos de la placa.

Reconstruir con `scripts/build-portable.ps1`, despues de `npm ci`, con el SDK
local en `vendor/asrpro`. Los binarios y el SDK se guardan como descarga de
Release privada, no en el historial Git.

Entorno local en ingles y espanol para programar placas ASRPRO-01 por USB.
La interfaz usa ingles por defecto y espanol si el idioma principal del sistema
(expuesto por el navegador) es espanol. El selector permite cambiarlo durante la sesion.
Esto no modifica el idioma de las frases aprendidas ni los mensajes UART.
Define comandos personalizados, compila y carga firmware, aprende frases
con la voz del usuario y comprueba el reconocimiento. No depende de un aparato.

## Iniciar

Instalar dependencias con `npm ci` y ejecutar `npm run dev`.
Abrir http://127.0.0.1:5187/ para el modo guiado predeterminado.
El modo avanzado esta en `/avanzado`; `/guiado` sigue funcionando.
El servidor solo escucha en localhost. El audio no se envia a servicios externos.
Las herramientas de compilacion actuales son para Windows.
Instalar por separado el SDK del fabricante en `vendor/asrpro`.
No se distribuye con el codigo.

## Flujo

0. Conectar la placa seleccionando su puerto USB.
1. Introducir los nombres y mensajes de los comandos (entre 1 y 10).
2. Compilar el firmware.
3. Cargarlo y esperar la confirmacion de la placa.
4. Grabar cada frase ante el microfono y repetirla cuando se solicite.

Las etapas son clicables. Si la placa confirma los mismos comandos,
se puede acceder directamente a grabar sin volver a cargar firmware.
La carga borra las frases aprendidas; requiere aceptacion y guarda un respaldo
en `output/backups`. No desconectar el USB durante la carga.
Escribir el nombre de una frase no la ensena al modulo: hay que grabarla.
La activacion es una frase personalizada opcional; la escucha permanece activa.

## Configuracion

Una instalacion nueva utiliza `voice-commands.example.json`, un ejemplo generico.
Al guardar se crea `voice-commands.json`, configuracion local excluida de Git.
Las configuraciones locales existentes se conservan.
Los mensajes personalizados y los identificadores `CMD:<id>` salen por UART
a 115200 baudios: PB5 TX, PB6 RX, niveles de 3.3 V y masa comun.
Las acciones externas corresponden al dispositivo que recibe estos mensajes.

## Comprobaciones

`npm test`, `npm run check`, `npm run build`.
Las pruebas de empaquetado requieren una compilacion local y verifican ambos
nucleos, tabla de comandos y posicion de los modelos.
El programador comprueba CRC y lectura completa antes de confirmar la carga.

## Publicacion

No incluir SDK, ejecutables del fabricante, respaldos ni configuracion personal.
El codigo propio utiliza la licencia MIT (ver LICENSE). Las dependencias y el
SDK conservan sus licencias; revisar sus condiciones antes de distribuirlos.
Proyecto independiente del fabricante:
no presupone permiso para redistribuir sus herramientas.
