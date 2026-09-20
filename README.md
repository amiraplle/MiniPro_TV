# ESP32-C3 Super Mini + ST7789 (GMT130 V1.0) 240x240 Firmware

Production-ready firmware and modern watch faces for the **ESP32-C3 Super Mini** paired with the **1.3" ST7789 (GMT130 V1.0) 7-Pin SPI IPS display**.

---

## ⚡ Automated GitHub Actions Compilation & Single `0x0` Merged Binary

This repository includes a preconfigured GitHub Actions CI workflow in [`.github/workflows/build-firmware.yml`](.github/workflows/build-firmware.yml).

Whenever you push to this repository:
1. GitHub automatically spins up an environment with PlatformIO.
2. It compiles the C++ firmware using hardware SPI with direct DMA memory streaming.
3. It bundles `bootloader.bin`, `partitions.bin`, and `firmware.bin` into a **single, flashable binary**:
   `esp32c3_st7789_merged_0x0.bin`
4. It attaches this merged binary as a downloadable build artifact under the GitHub Action Run!

### Flashing in 1 Command:
```bash
# Flash the single merged binary directly at offset 0x0
esptool.py --chip esp32c3 --port /dev/ttyUSB0 --baud 921600 write_flash 0x0 esp32c3_st7789_merged_0x0.bin
```

---

## 🔌 7-Pin Wiring Diagram (GMT130 V1.0 to ESP32-C3 Super Mini)

| GMT130 Display Pin | Label | ESP32-C3 Super Mini Pin | Description |
|---|---|---|---|
| **Pin 1** | **GND** | **GND** | Power Ground |
| **Pin 2** | **VCC** | **3V3** | 3.3V Power Supply |
| **Pin 3** | **SCL** | **GPIO 4** | Hardware FSPI Clock (`SCK`) |
| **Pin 4** | **SDA** | **GPIO 6** | Hardware FSPI MOSI (`DIN`) |
| **Pin 5** | **RES** | **GPIO 1** | Display Hardware Reset (`RST`) |
| **Pin 6** | **DC** | **GPIO 2** | Data / Command Selection |
| **Pin 7** | **BLK** | **GPIO 3** | Backlight Control (PWM Dimming) |
| *(Internal PCB)* | *CS* | *GND on PCB* | Hardwired to GND (Set `pin_cs = -1`) |

---

## ⚠️ Critical Hardware Directives (Why Generic Code Fails)

1. **Pin 7 is Backlight (`BLK`), NOT Chip Select (`CS`):**
   The GMT130 V1.0 module routes Chip Select (`CS`) directly to ground on its internal copper trace. If code configures Pin 7 as CS or toggles it during SPI transactions, the backlight flickers or powers off and SPI stalls.
2. **Color Inversion (`0x21` INVON):**
   The ST7789 IPS glass uses inverted color polarizers. Without `invert = true`, black displays as white and colors look like photo negatives.
3. **USB CDC Peripheral Protection:**
   The ESP32-C3 Super Mini uses **GPIO 18 (`D-`)** and **GPIO 19 (`D+`)** for native USB CDC. We strictly use GPIO 4/6 to ensure the serial port never drops.

---

## ⏱️ Modern Big Watch Faces Included

- **Big Bold Ultra**: Apple Watch Ultra inspired giant high-contrast numerals (`HH:MM`) taking up the entire 240px width, surrounded by a 360-degree sweeping seconds arc and quick-glance status capsules.
- **Big Typography Duo**: Stacked oversized typography (Hours on top, Minutes on bottom) in high-contrast Bauhaus style with a left-edge smooth vertical seconds gauge.
- **Big Sport Digital**: Garmin/G-Shock style high-contrast digital display with day-of-week active highlight strip (`[S] M T W T F S`), dedicated boxed seconds, and a 3-card telemetry dashboard.
- **GeekMagic Classic Dashboard**: Smooth circular seconds arc with NTP time synchronization.
- **Weather Station**: OpenWeatherMap API live reporting.
- **Home Assistant Live Cards**: Compatible with HACS GeekMagic integration.

---

## 🛠️ Local Compilation (Optional)

If you wish to compile locally instead of using GitHub Actions:
```bash
# Install PlatformIO
pip install platformio

# Compile firmware and auto-generate esp32c3_st7789_merged_0x0.bin
pio run

# Flash directly to connected ESP32-C3 Super Mini
pio run --target upload
```
