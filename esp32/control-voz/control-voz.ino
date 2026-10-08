#include <Arduino.h>
#include <HardwareSerial.h>
#include <string.h>

constexpr int PIN_RX_VOZ = 27;
constexpr unsigned long BAUDIOS = 115200;
HardwareSerial voz(2);

enum class Orden : uint8_t {
  Ninguna = 0,
  Ventilador = 1,
  Luz = 2,
  Maximo = 3,
  Minimo = 4,
  Apagar = 5
};

Orden reconocerOrden(const char *mensaje) {
  if (strcmp(mensaje, "FAN") == 0) return Orden::Ventilador;
  if (strcmp(mensaje, "LIGHT") == 0) return Orden::Luz;
  if (strcmp(mensaje, "MAX") == 0) return Orden::Maximo;
  if (strcmp(mensaje, "MIN") == 0) return Orden::Minimo;
  if (strcmp(mensaje, "OFF") == 0) return Orden::Apagar;
  return Orden::Ninguna;
}

void procesarOrden(Orden orden) {
  const char *nombre = nullptr;
  switch (orden) {
    case Orden::Ventilador: nombre = "FAN (ventilador)"; break;
    case Orden::Luz: nombre = "LIGHT (luz)"; break;
    case Orden::Maximo: nombre = "MAX (maximo)"; break;
    case Orden::Minimo: nombre = "MIN (minimo)"; break;
    case Orden::Apagar: nombre = "OFF (apagar)"; break;
    default: return;
  }
  Serial.print("Orden recibida: ");
  Serial.print(nombre);
  Serial.print(" | ID: ");
  Serial.println(static_cast<uint8_t>(orden));
  // Las acciones sobre el ventilador se incorporaran aqui cuando definamos su control.
}

void recibirVoz() {
  static char linea[32];
  static size_t longitud = 0;
  static bool descartar = false;

  while (voz.available() > 0) {
    const int dato = voz.read();
    if (dato < 0) break;
    const char caracter = static_cast<char>(dato);
    if (caracter == '\n') {
      if (!descartar) {
        linea[longitud] = '\0';
        procesarOrden(reconocerOrden(linea));
      }
      longitud = 0;
      descartar = false;
    } else if (caracter != '\r' && !descartar) {
      // Una linea larga se descarta entera para no interpretar su final como una orden.
      if (caracter == '\0' || longitud >= sizeof(linea) - 1) descartar = true;
      else linea[longitud++] = caracter;
    }
  }
}

void setup() {
  Serial.begin(BAUDIOS);
  voz.begin(BAUDIOS, SERIAL_8N1, PIN_RX_VOZ, -1);
  delay(500);
  Serial.println("Control de voz listo: FAN, LIGHT, MAX, MIN, OFF.");
}

void loop() {
  recibirVoz();
}
