#include "asr.h"
extern "C" { void *__dso_handle = 0; }
#include "setup.h"
#include "CString/HardwareSerial.h"
extern "C" {
#include "cwsl_manage.h"
#include "cwsl_template_manager.h"
void studio_learn(int slot);
void studio_record(void);
void studio_stop(void);
int studio_learning_active(void);
void studio_event(const char *name, int value);
}
#include "studio-project.h"

uint32_t snid;
static bool initialized = false;
static void emit_command(uint32_t id) {
    const char *message = studio_message(id);
    if (!message) return;
    static uint32_t last_id = 0;
    static TickType_t last_tick = 0;
    TickType_t now = xTaskGetTickCount();
    if (id == last_id && now - last_tick < pdMS_TO_TICKS(300)) return;
    last_id = id; last_tick = now;
    Serial.println(message); studio_event("CMD", id - 10301);
}
extern "C" void studio_recognized_word(const char *word, int confidence) {
    if (!initialized || studio_learning_active() || !word) return;
    if (strncmp(word, "CI-WI-", 6) != 0) return;
    const char *cursor = word + 6;
    unsigned long fields[4];
    for (int i = 0; i < 4; ++i) {
        if (*cursor < '0' || *cursor > '9') return;
        char *end = NULL;
        fields[i] = strtoul(cursor, &end, 10);
        if (fields[i] > 65535 || *end != (i == 3 ? '\0' : '-')) return;
        cursor = end + (i == 3 ? 0 : 1);
    }
    uint32_t id = fields[0];
    if (fields[1] != 0 || fields[2] != 0
        || confidence < (id == 10300 ? 37 : 35)) return;
    uint8_t indices[32];
    int count = cwsl_tm_get_words_index(indices, 32, (uint16_t)-1, ALL_WORD);
    bool learned = false;
    for (int i = 0; i < count; ++i) {
        if (cwsl_tm_get_tpl_cmd_id_by_index(indices[i]) == id) learned = true;
    }
    if (!learned) return;
    // El motor entrega etiquetas CI-WI; las convertimos al protocolo del proyecto.
    if (id == 10300) studio_event("WAKE", 0);
    else emit_command(id);
}
extern "C" void studio_asr_debug(const char *word, int confidence, int frames) {
    if (!initialized) return;
    char line[192];
    snprintf(line, sizeof(line), "[DEBUG-%s] ASR score=%d frames=%d word=%.100s\n", studio_learning_active() ? "learn" : "recognition", confidence, frames, word ? word : "");
    Serial.print(line);
}
extern "C" void studio_event(const char *name, int value) {
    if (!initialized) return;
    char line[64]; snprintf(line, sizeof(line), "%s:%d\n", name, value); Serial.print(line);
}
static void status(const char *nonce) {
    Serial.print("STUDIO:1:" STUDIO_HASH ":"); Serial.println(nonce);
    uint8_t indices[32]; int count = cwsl_tm_get_words_index(indices, 32, (uint16_t)-1, ALL_WORD);
    Serial.print("TEMPLATES:");
    for (int i = 0; i < count; ++i) {
        int id = cwsl_tm_get_tpl_cmd_id_by_index(indices[i]);
        if (i) Serial.print(","); Serial.print(id == 10300 ? 0 : id - 10301);
    }
    Serial.println();
}
static void command(const char *line) {
    if (strncmp(line, "HELLO:", 6) == 0) status(line + 6);
    else if (strncmp(line, "LEARN:", 6) == 0) {
        int slot = atoi(line + 6);
        if (slot == 0 || studio_has_slot(slot)) studio_learn(slot);
        else studio_event("ERROR", 2);
    } else if (strcmp(line, "RECORD") == 0) studio_record();
    else if (strcmp(line, "STOP") == 0) studio_stop();
}
void ASR_CODE(void) {
    studio_event("[DEBUG-recognition] DISPATCH", snid);
    emit_command(snid);
    set_state_enter_wakeup(60000);
}
static void start_serial(void) {
    dpmu_set_io_reuse(PB5, SECOND_FUNCTION); dpmu_set_io_reuse(PB6, SECOND_FUNCTION);
    dpmu_set_io_pull(PB6, DPMU_IO_PULL_UP); Serial.begin(115200); initialized = true;
}
void setup(void) {}
void hardware_init(void) {
    start_serial();
    vol_set(0); set_state_enter_wakeup(60000);
    char buffer[96]; unsigned length = 0; unsigned ticks = 0;
    for (;;) {
        while (Serial.available()) {
            int value = Serial.read();
            if (value == '\n') { buffer[length] = 0; command(buffer); length = 0; }
            else if (value != '\r' && length < sizeof(buffer) - 1) buffer[length++] = value;
        }
        if (++ticks >= 2000) { ticks = 0; set_state_enter_wakeup(60000); }
        vTaskDelay(pdMS_TO_TICKS(10));
    }
}
