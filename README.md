<div align="center">

# ASRPRO Studio

**Your voice. Your commands. Your ASRPRO-01.**

Configure, compile, flash and teach voice commands. One local workspace.

[**English**](README.md) · [Español](README.es.md)

![Board](https://img.shields.io/badge/Board-ASRPRO--01-087f8c)
![Platform](https://img.shields.io/badge/Platform-Windows_x64-2563eb)
![Languages](https://img.shields.io/badge/Interface-EN_%2F_ES-16a34a)
![License](https://img.shields.io/badge/Own_code-MIT-52525b)

[Download for Windows](https://github.com/adriviciano/ASRPRO-Studio/releases/tag/v0.1.0-private) · [Quick Start](#quick-start) · [Development](#development)

</div>

---

> **Private personal-use package.** The archive includes manufacturer tools whose permission for public redistribution has not been established. MIT applies to our own code, not to the SDK. See [Third-Party Notices](THIRD-PARTY-NOTICES.md).

## From USB to Voice

| Step | What happens |
| :--- | :--- |
| **0 · Connect** | Select your board's USB serial port. |
| **1 · Define** | Set command names and UART output messages. |
| **2 · Compile** | Generate firmware for the saved configuration. |
| **3 · Flash** | Upload and wait for verification and board confirmation. |
| **4 · Teach** | Say each phrase into the board's microphone, then repeat when prompted. |

Click a step to return or advance when its requirements are met. With no connected board, only step 0 is shown. If the board confirms matching commands, you can go straight to recording.

**Typing a phrase does not teach it to the board.** Record through the ASRPRO-01 microphone, not the computer microphone.

## Quick Start

1. Download `ASRPRO-Studio-Windows-x64.zip` from the [private release](https://github.com/adriviciano/ASRPRO-Studio/releases/tag/v0.1.0-private). Repository access is required.
2. Extract **the entire ZIP** to a short, writable folder, such as `C:\ASRPRO-Studio`.
3. Connect the ASRPRO-01 with a USB data cable.
4. Run `ASRPRO-Studio.exe` and follow the guided steps in your browser.

Keep the launcher open while using the application. Closing it stops the local server. Keep the executable beside the `app` and `runtime` folders.

| Requirement | Details |
| :--- | :--- |
| System | Windows x64 |
| Launcher | .NET Framework 4.5 or later |
| USB | CH340 driver and a USB data cable |
| Folder | Short and writable; long paths can break the manufacturer compiler |
| Runtime | Node.js included; no separate installation needed |

The launcher is unsigned; Windows may display a warning. You do not need to open Tianwen Block or its Chinese interface.

> **Before flashing:** uploading firmware erases learned phrases. The app asks for confirmation and saves a backup under `app/output/backups`. Do not disconnect USB during flashing. The package does not include personal recordings or board backups.

## Built for the ASRPRO-01

- Guided setup by default, with an advanced workspace at `/avanzado`.
- **1 to 10 commands**, customizable phrases and output messages.
- Optional activation phrase.
- Recording feedback: listening, repeat, learned and retry.
- Project import/export and recognition activity.
- Firmware checks using CRC and read-back verification.
- English and Spanish. English by default unless the primary system/browser language is Spanish; switch language during the session.
- Learning and recognition run on the board. The application does not upload microphone recordings to a cloud service.

<details>
<summary><strong>View the supported board</strong></summary>

<p align="center">
<img src="public/board.jpeg" alt="ASRPRO-01 board with USB-C connector and onboard microphone" width="280">
</p>

Tested with the pictured ASRPRO-01. Other boards and revisions are not guaranteed.

</details>

## Connect Your Project

Command output uses UART at **115200 baud, 3.3 V logic**.

| ASRPRO-01 pin | Role |
| :--- | :--- |
| `PB5` | TX: command output |
| `PB6` | RX: incoming communication |
| `GND` | Common ground with the receiver |

For a receive-only ESP32 monitor: **PB5 → GPIO27**, **GND → GND**. Use the [serial monitor example](esp32/monitor-voz/monitor-voz.ino). The [controller example](esp32/control-voz/README.md) processes specific commands.

Recognition can emit your configured message and `CMD:<id>`. The receiving controller decides what action to perform. ASRPRO Studio is not tied to any particular appliance.

## Development

The source is in this repository. Manufacturer tools are stored separately in the private release, not in Git history. Place the matching SDK at `vendor/asrpro`.

Use a Node.js version compatible with the dependencies. The portable package uses **Node.js 24.15.0**.

```powershell
npm ci
npm run dev
```

Open [http://127.0.0.1:5187/](http://127.0.0.1:5187/). The server binds only to localhost. `/` is guided mode, `/avanzado` is advanced mode, and `/guiado` is a guided-mode alias.

| Folder | Contents |
| :--- | :--- |
| `src/app` | Angular 17 interface, services and translations |
| `server` | Local API, compiler integration and serial programmer |
| `firmware` | Custom ASRPRO firmware |
| `esp32` | Serial monitor and controller examples |
| `scripts` | Windows launcher, packaging and release checks |

New installations use [voice-commands.example.json](voice-commands.example.json). Saving creates `voice-commands.json`, excluded from Git. Existing local configurations are preserved.

### Check and Package

```powershell
npm test
npm run check
npm run build
powershell -ExecutionPolicy Bypass -File scripts/build-portable.ps1
```

Packaging requires the official SDK and a clean output folder. Firmware-layout integration tests need local compilation artifacts; they are skipped when absent. [test-portable.ps1](scripts/test-portable.ps1) checks startup, the frontend, USB enumeration and compilation **without flashing a board**.

## Troubleshooting

| Symptom | First check |
| :--- | :--- |
| No serial port | Data cable, CH340 driver, another app holding the port |
| Compiler cannot find headers | Extract to a shorter path; keep package folders together |
| No recognition after flashing | Record again; flashing clears learned templates |
| Phrase rejected | Wait for the listening prompt; repeat clearly with similar tone and distance |
| Recording step locked | Connect and verify that board firmware matches the saved commands |

## License and Credits

Our source code is [MIT](LICENSE). Node.js, JavaScript dependencies, the RISC-V compiler, ASRPRO SDK, models and programming agent retain their own licenses and notices.

An independent project, not an official manufacturer application. Compilation and flashing use manufacturer tools, but do not require running the original graphical program.

**Keep the bundled archive private until redistribution rights have been reviewed.** Attribution does not replace permission.
