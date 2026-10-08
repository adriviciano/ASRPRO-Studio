#include "cwsl_app_sample1.h"
#include "cwsl_template_manager.h"
#include "status_share.h"

extern void studio_event(const char *name, int value);
extern void set_state_enter_wakeup(uint32_t milliseconds);
static int selected = -1;
static int pending_delete = 0;
static int recording = 0;
int studio_learning_active(void) { return selected >= 0; }

int on_cwsl_init(cwsl_init_parameter_t *p) {
    p->wait_time = 0; p->sg_reg_times = 2; p->tpl_min_word_length = 2;
    p->wakeup_threshold = 37; p->cmdword_threshold = 35; p->reg_2times_flow_v2 = 0;
    return 11;
}
static void start_selected(void) {
    set_state_enter_wakeup(60000);
    cwsl_reg_word(selected == 0 ? 10300 : 10301 + selected, 0, selected == 0 ? WAKEUP_WORD : CMD_WORD);
}
void studio_learn(int slot) {
    if (slot < 0 || slot > 10 || selected >= 0) { studio_event("ERROR", 1); return; }
    selected = slot;
    uint32_t id = slot == 0 ? 10300 : 10301 + slot;
    uint8_t indices[32]; int count = cwsl_tm_get_words_index(indices, 32, 0, ALL_WORD);
    int found = 0;
    for (int i = 0; i < count; ++i) if (cwsl_tm_get_tpl_cmd_id_by_index(indices[i]) == id) found = 1;
    if (found) {
        pending_delete = 1;
        cwsl_delete_word(id, 0, slot == 0 ? WAKEUP_WORD : CMD_WORD);
    } else start_selected();
}
void studio_record(void) {
    if (selected >= 0 && !recording) {
        recording = 1;
        cwsl_reg_record_start();
        /* Este SDK no invoca on_cwsl_record_start; confirmamos la orden aceptada aqui. */
        studio_event("LISTEN", selected);
    }
}
int cwsl_app_reset(void) { recording = 0; selected = -1; pending_delete = 0; return cwsl_manage_reset(); }
void studio_stop(void) { cwsl_exit_reg_word(); cwsl_app_reset(); studio_event("STOPPED", 0); }
int on_cwsl_reg_start(uint32_t id, uint16_t group, cwsl_word_type_t type) {
    cwsl_reg_record_stop(); studio_event("READY", selected); return 0;
}
int on_cwsl_reg_abort(void) { recording = 0; selected = -1; studio_event("STOPPED", 0); return 0; }
int on_cwsl_record_start(void) { studio_event("LISTEN", selected); return 0; }
int on_cwsl_record_end(int times, cwsl_reg_result_t result) {
    studio_event("[DEBUG-learn] TAKE", times);
    recording = 0;
    /* El SDK ya cierra la toma. record_stop borraria la plantilla temporal y el contador. */
    if (result == CWSL_REG_FINISHED) {
        studio_event("LEARNED", selected); cwsl_app_reset();
    } else if (result == CWSL_RECORD_SUCCESSED) studio_event("REPEAT", selected);
    else if (result == CWSL_REG_ABORT) { selected = -1; studio_event("STOPPED", 0); }
    else {
        studio_event("RETRY", result);
        if (result == CWSL_RECORD_FAILED || result == CWSL_RECORD_FAILED_BY_DEFAULTCMD) {
            /* La bandera sola no descarta las tomas fallidas del motor. */
            cwsl_set_reg_restart_flag();
            cwsl_reg_restart();
            return 0;
        }
        studio_event("READY", selected);
    }
    return 0;
}
int on_cwsl_delete_successed(void) {
    if (pending_delete) { pending_delete = 0; start_selected(); }
    return 0;
}
int on_cwsl_rgz_successed(uint16_t id, uint32_t distance) {
    studio_event("[DEBUG-recognition] MATCH", id);
    studio_event("[DEBUG-recognition] DISTANCE", distance);
    /* El reconocimiento aprendido se entrega al flujo normal del SDK. */
    sys_msg_t message = {0}; message.msg_type = SYS_MSG_TYPE_ASR;
    message.msg_data.asr_data.asr_status = MSG_CWSL_STATUS_GOOD_RESULT;
    message.msg_data.asr_data.asr_cmd_handle = cmd_info_find_command_by_id(id);
    send_msg_to_sys_task(&message, NULL); return 0;
}
uint32_t cwsl_app_process_asr_msg(sys_msg_asr_data_t *message, cmd_handle_t *handle, uint16_t id) {
    /* El SDK necesita el resultado ASR incluso cuando no ejecutamos la accion. */
    cwsl_reg_check_other_asrcmd(id, 1);
    if (selected >= 0) {
        send_nn_end_msg_to_cwsl(NULL, 0);
        return 2;
    }
    return 0;
}
