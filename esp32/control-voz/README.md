# Base del proyecto ESP32

Para ESP32 DevKit clasico. Abre control-voz.ino en Arduino IDE y subelo solo al ESP32. Monitor serie: 115200 baudios.

Mantiene el cableado comprobado: ASRPRO PB5 -> ESP32 GPIO27; GND -> GND. Ambas placas se alimentan por sus respectivos USB. No conectar PB6 ni unir las alimentaciones.

| Mensaje exacto | ID | Orden |
| --- | --- | --- |
| FAN | 1 | Ventilador |
| LIGHT | 2 | Luz |
| MAX | 3 | Maximo |
| MIN | 4 | Minimo |
| OFF | 5 | Apagar |

Cada mensaje se muestra una vez como "Orden recibida: MAX (maximo) | ID: 3". Se ignoran las lineas CMD, WAKE, STUDIO, TEMPLATES y DEBUG, asi como mensajes desconocidos. No se filtran ordenes iguales consecutivas: decir la misma palabra otra vez genera otra recepcion.

Todavia no transmite por radio ni controla salidas. No se ha decidido si FAN/LIGHT seleccionan un dispositivo o alternan su estado, ni a que dispositivo se aplica OFF. El punto para integrar esas acciones es procesarOrden().

No hace falta modificar, recompilar ni cargar el ASRPRO: conserva sus cinco frases y su firmware actuales.
