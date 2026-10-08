# Monitor de voz para ESP32 DevKit

Programa para un ESP32 DevKit clasico. Recibe la salida UART del firmware de Voz Estudio y la muestra sin modificar en el monitor serie USB.

## Cableado

Desconecta la alimentacion antes de poner los cables.

| ASRPRO-01 | ESP32 DevKit |
| --- | --- |
| PB5 (TX) | GPIO27 (27 o D27) |
| GND | GND |

Alimenta cada placa mediante su propio USB. Deja PB6 sin conectar: para leer los comandos no hace falta transmitir al ASRPRO. No unas los pines 5V ni 3V3 entre las placas, y no conectes 5V a un GPIO del ESP32.

## Carga y prueba

1. Abre monitor-voz.ino en Arduino IDE con el soporte ESP32 de Espressif instalado.
2. Selecciona tu placa ESP32 (ESP32 Dev Module para el DevKit clasico) y su puerto USB. No selecciones el puerto del ASRPRO.
3. Sube este programa solamente al ESP32.
4. Abre su monitor serie a 115200 baudios. Si no aparece el mensaje inicial, pulsa EN en el ESP32.
5. Di una frase ya aprendida ante el microfono del ASRPRO.

Para "Ventilador al maximo", el firmware actual envia:

```text
FAN_MAX
CMD:1
```

| ID | Mensaje | Accion |
| --- | --- | --- |
| 1 | FAN_MAX | Ventilador al maximo |
| 2 | FAN_MIN | Ventilador al minimo |
| 3 | FAN_OFF | Apagar ventilador |
| 4 | LIGHT_ON | Encender luz |
| 5 | LIGHT_OFF | Apagar luz |
| 6 | SPEED_UP | Mas velocidad |
| 7 | SPEED_DOWN | Menos velocidad |

Tambien se mostraran mensajes de arranque o diagnostico que envie el ASRPRO. El programa solo observa: no controla todavia el ventilador ni modifica las frases aprendidas.

Si aparece el saludo del ESP32 pero no llegan comandos, comprueba PB5, GPIO27 y la masa comun, y confirma el reconocimiento en Voz Estudio. No vuelvas a cargar el firmware del ASRPRO para esta prueba.

Referencia de la API UART: https://docs.espressif.com/projects/arduino-esp32/en/latest/api/serial.html
