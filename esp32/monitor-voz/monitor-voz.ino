#include <Arduino.h>
#include <HardwareSerial.h>

constexpr int PIN_RX_VOZ = 27;
constexpr unsigned long BAUDIOS = 115200;

HardwareSerial voz(2);

void setup() {
  Serial.begin(BAUDIOS);
  voz.begin(BAUDIOS, SERIAL_8N1, PIN_RX_VOZ, -1);
  delay(500);

  Serial.println();
  Serial.println("Monitor de voz listo.");
  Serial.println("ASRPRO PB5 -> ESP32 GPIO27; GND -> GND.");
}

void loop() {
  // Muestra los mensajes originales sin enviar nada a la placa de voz.
  while (voz.available() > 0) {
    const int dato = voz.read();
    if (dato >= 0) {
      Serial.write(static_cast<uint8_t>(dato));
    }
  }
}
