/**
 * @file LGFX_ST7789_GMT130.h
 * @brief Zero-tear DMA Hardware Display Driver for ESP32-C3 Super Mini + ST7789 (GMT130 V1.0)
 * 
 * CRITICAL HARDWARE DIRECTIVES:
 * 1. Pin 7 on GMT130 V1.0 is BLK (Backlight), NOT CS! 
 *    Chip Select (CS) is hardwired to GND on the module PCB. Therefore, pin_cs MUST be -1.
 * 2. ST7789 IPS panels mandate Color Inversion (0x21 INVON). Invert is set to true.
 * 3. ESP32-C3 Super Mini native USB CDC uses GPIO 18 (D-) & GPIO 19 (D+).
 *    We strictly avoid GPIO 18/19 for SPI.
 */

#pragma once

#define LGFX_USE_V1
#include <LovyanGFX.hpp>

class LGFX_ST7789_GMT130 : public lgfx::LGFX_Device {
  lgfx::Panel_ST7789  _panel_instance;
  lgfx::Bus_SPI       _bus_instance;
  lgfx::Light_PWM     _light_instance;

public:
  LGFX_ST7789_GMT130(void) {
    { // Configure SPI Bus
      auto cfg = _bus_instance.config();

      cfg.spi_host   = SPI2_HOST;     // ESP32-C3 FSPI
      cfg.spi_mode   = 0;             // SPI Mode 0 (CPOL=0, CPHA=0)
      cfg.freq_write = 40000000;      // 40MHz stable write clock (up to 80MHz supported)
      cfg.freq_read  = 16000000;      // 16MHz read clock
      cfg.spi_3wire  = true;          // GMT130 is write-only / 3-wire (no MISO)
      cfg.use_dma    = true;          // Enable hardware DMA channel (essential for anti-tearing)
      
      cfg.pin_sclk = 4;               // GMT130 SCL / CLK (GPIO 4)
      cfg.pin_mosi = 6;               // GMT130 SDA / DIN (GPIO 6)
      cfg.pin_miso = -1;              // No MISO line on 7-pin GMT130
      cfg.pin_dc   = 2;               // GMT130 DC (Data/Command - GPIO 2)

      _bus_instance.config(cfg);
      _panel_instance.setBus(&_bus_instance);
    }

    { // Configure ST7789 240x240 Panel
      auto cfg = _panel_instance.config();

      cfg.pin_cs           = -1;      // CRITICAL: GMT130 has NO CS pin (grounded on PCB)!
      cfg.pin_rst          = 1;       // GMT130 RES (Reset - GPIO 1)
      cfg.pin_busy         = -1;

      cfg.panel_width      = 240;
      cfg.panel_height     = 240;
      cfg.memory_width     = 240;
      cfg.memory_height    = 320;     // ST7789 internal controller RAM is 320 lines
      cfg.offset_x         = 0;
      cfg.offset_y         = 0;
      cfg.offset_rotation  = 0;

      cfg.dummy_read_pixel = 8;
      cfg.dummy_read_bits  = 1;
      cfg.readable         = false;
      cfg.invert           = true;    // CRITICAL: ST7789 IPS requires 0x21 INVON
      cfg.rgb_order        = false;   // RGB order
      cfg.dlen_16bit       = false;
      cfg.bus_shared       = false;

      _panel_instance.config(cfg);
    }

    { // Configure Backlight PWM (Pin 7 / BLK on GMT130)
      auto cfg = _light_instance.config();

      cfg.pin_bl      = 3;            // GMT130 BLK Pin (GPIO 3)
      cfg.invert      = false;        // Active HIGH
      cfg.freq        = 1200;         // 1.2 kHz flicker-free PWM
      cfg.pwm_channel = 0;

      _light_instance.config(cfg);
      _panel_instance.setLight(&_light_instance);
    }

    setPanel(&_panel_instance);
  }
};
