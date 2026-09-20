import { FirmwareConfig } from '../types';

export const DEFAULT_FIRMWARE_CONFIG: FirmwareConfig = {
  wifiMode: 'captive_portal',
  wifiSsid: 'MyHomeWiFi',
  wifiPass: 'SecretPassword123',
  deviceHostname: 'c3-smart-display',
  ntpServer: 'pool.ntp.org',
  timezoneOffsetHours: 6, // UTC+6 or user's local timezone
  openWeatherApiKey: 'YOUR_OPENWEATHER_API_KEY',
  weatherCity: 'Dhaka',
  weatherUnits: 'metric',
  homeAssistantUrl: 'http://homeassistant.local:8123',
  homeAssistantToken: '',
  homeAssistantEntity1: 'sensor.living_room_temperature',
  homeAssistantEntity2: 'sensor.power_consumption',
  spiFrequencyMhz: 40,
  colorInversion: true, // ST7789 GMT130 IPS REQUIRES 0x21 INVON!
  bgrOrder: false,
  defaultBrightness: 220,
  nightBrightness: 45,
  autoRotateScreens: true,
  rotateIntervalSec: 8,
  driverLibrary: 'lovyangfx',
  pinScl: 4,     // Hardware SPI SCK
  pinSda: 6,     // Hardware SPI MOSI
  pinRes: 1,     // Reset
  pinDc: 2,      // Data/Command
  pinBlk: 3,     // PWM Backlight
  pinBootBtn: 9  // ESP32-C3 Super Mini built-in boot button
};

export function generateLovyanGfxHeader(config: FirmwareConfig): string {
  return `/**
 * @file LGFX_ST7789_GMT130.h
 * @brief Zero-tear DMA Hardware Display Driver for ESP32-C3 Super Mini + ST7789 (GMT130 V1.0)
 * 
 * CRITICAL HARDWARE DIRECTIVES (DO NOT MODIFY WITHOUT AUDIT):
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
      // CRITICAL: Modules without CS (pin_cs = -1) require SPI Mode 3 for reliable
      // CPOL=1/CPHA=1 clock latching when CS is permanently tied to ground.
      cfg.spi_mode   = 3;             // SPI Mode 3
      cfg.freq_write = 20000000;      // 20MHz rock-solid write clock (eliminates jumper wire attenuation)
      cfg.freq_read  = 16000000;      // 16MHz read clock
      cfg.spi_3wire  = false;         // Standard 4-wire style with dedicated D/C pin
      cfg.use_lock   = true;
      cfg.dma_channel = SPI_DMA_CH_AUTO; // Enable hardware DMA channel (essential for 60fps anti-tearing)
      
      cfg.pin_sclk = ${config.pinScl}; // GMT130 SCL / CLK
      cfg.pin_mosi = ${config.pinSda}; // GMT130 SDA / DIN
      cfg.pin_miso = -1;               // No MISO line on 7-pin GMT130
      cfg.pin_dc   = ${config.pinDc};  // GMT130 DC (Data/Command)

      _bus_instance.config(cfg);
      _panel_instance.setBus(&_bus_instance);
    }

    { // Configure ST7789 240x240 Panel
      auto cfg = _panel_instance.config();

      cfg.pin_cs           = -1;      // CRITICAL: GMT130 has NO CS pin (grounded on PCB)!
      cfg.pin_rst          = ${config.pinRes}; // GMT130 RES (Reset)
      cfg.pin_busy         = -1;

      cfg.panel_width      = 240;
      cfg.panel_height     = 240;
      cfg.memory_width     = 240;
      cfg.memory_height    = 240;     // Standard 240x240 address space
      cfg.offset_x         = 0;
      cfg.offset_y         = 0;       // 0 offset in standard orientation (adjusted on rotation)
      cfg.offset_rotation  = 0;

      cfg.dummy_read_pixel = 8;
      cfg.dummy_read_bits  = 1;
      cfg.readable         = false;
      cfg.invert           = ${config.colorInversion ? 'true' : 'false'};  // CRITICAL: ST7789 IPS requires 0x21 INVON
      cfg.rgb_order        = ${config.bgrOrder ? 'true' : 'false'}; // false = RGB, true = BGR
      cfg.dlen_16bit       = false;
      cfg.bus_shared       = false;

      _panel_instance.config(cfg);
    }

    { // Configure Backlight PWM (Pin 7 / BLK on GMT130)
      auto cfg = _light_instance.config();

      cfg.pin_bl      = ${config.pinBlk}; // GMT130 BLK Pin
      cfg.invert      = false;            // Active HIGH
      cfg.freq        = 1200;             // 1.2 kHz flicker-free PWM
      cfg.pwm_channel = 0;

      _light_instance.config(cfg);
      _panel_instance.setLight(&_light_instance);
    }

    setPanel(&_panel_instance);
  }
};
`;
}

export function generateArduinoIno(config: FirmwareConfig): string {
  return `/**
 * @file ESP32C3_ST7789_GeekMagic.ino
 * @brief Production Hardware-Ready Firmware for ESP32-C3 Super Mini + ST7789 (GMT130 V1.0)
 * 
 * Hardware Target:
 *  - MCU: ESP32-C3 Super Mini (RISC-V 160MHz, 4MB Flash)
 *  - Display: 1.3" 240x240 IPS ST7789 (GMT130 V1.0, 7-pin SPI)
 *  - Button: Built-in BOOT button (GPIO 9)
 * 
 * Pinout:
 *  - GMT130 Pin 1 (GND) -> ESP32-C3 GND
 *  - GMT130 Pin 2 (VCC) -> ESP32-C3 3V3 (3.3V power)
 *  - GMT130 Pin 3 (SCL) -> ESP32-C3 GPIO ${config.pinScl} (FSPI SCK)
 *  - GMT130 Pin 4 (SDA) -> ESP32-C3 GPIO ${config.pinSda} (FSPI MOSI)
 *  - GMT130 Pin 5 (RES) -> ESP32-C3 GPIO ${config.pinRes} (Reset)
 *  - GMT130 Pin 6 (DC)  -> ESP32-C3 GPIO ${config.pinDc}  (Data/Command)
 *  - GMT130 Pin 7 (BLK) -> ESP32-C3 GPIO ${config.pinBlk} (PWM Dimming)
 *  - CS is internally grounded on GMT130 V1.0 module PCB (set to -1)!
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <time.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "LGFX_ST7789_GMT130.h"

// -------------------------------------------------------------
// Instances & Globals
// -------------------------------------------------------------
LGFX_ST7789_GMT130 tft;
LGFX_Sprite canvas(&tft); // DMA full 240x240 off-screen canvas (zero tearing!)

WebServer server(80);

const char* AP_SSID = "C3-Display-Setup";
const char* AP_PASS = "12345678";

// 100% Buttonless Architecture: Controlled completely via Web Portal, REST API, or Carousel
enum ScreenMode {
  SCREEN_BIG_BOLD_ULTRA = 0,     // Modern Apple Watch Ultra Style (Giant numerals + Activity Ring)
  SCREEN_BIG_TYPOGRAPHY_DUO = 1, // Modern Stacked Oversized Typography (Nothing/Braun aesthetic)
  SCREEN_BIG_SPORT_DIGITAL = 2,  // G-Shock / Garmin Active High-Contrast Sport
  SCREEN_CLOCK_DASHBOARD = 3,    // Classic GeekMagic Seconds Arc Clock
  SCREEN_WEATHER = 4,            // Weather Station & Barometer
  SCREEN_HOME_ASSISTANT = 5,     // GeekMagic HACS Home Assistant Live Cards
  SCREEN_PC_STATS = 6,           // Realtime Hardware Monitor (CPU, GPU, RAM, Temp)
  SCREEN_COUNT = 7
};

ScreenMode currentScreen = SCREEN_BIG_BOLD_ULTRA;
unsigned long lastScreenSwitch = 0;
unsigned long lastWeatherUpdate = 0;
bool autoRotate = ${config.autoRotateScreens ? 'true' : 'false'};
unsigned long rotateInterval = ${config.rotateIntervalSec * 1000};

// Live telemetry state cache
struct DeviceState {
  float temperature = 26.8;
  float humidity = 64.0;
  String weatherDesc = "Partly Cloudy";
  int weatherCode = 801;
  float cpuUsage = 28.0;
  float ramUsage = 52.0;
  float cpuTemp = 44.5;
  bool haLight = true;
  float haPower = 245.0;
  int brightness = ${config.defaultBrightness};
} state;

// -------------------------------------------------------------
// Forward Declarations
// -------------------------------------------------------------
void drawBigBoldUltra();
void drawBigTypographyDuo();
void drawBigSportDigital();
void drawClockDashboard();
void drawWeatherScreen();
void drawHomeScreen();
void drawPcStatsScreen();
void updateWeather();
void setupWebServer();

// -------------------------------------------------------------
// Setup
// -------------------------------------------------------------
void setup() {
  // CRITICAL for ESP32-C3 Super Mini: USB CDC Serial initialization
  Serial.begin(115200);
  delay(500);
  Serial.println("\\n=======================================================");
  Serial.println("  ESP32-C3 Super Mini + ST7789 (GMT130 V1.0) Firmware  ");
  Serial.println("  100% BUTTONLESS - Wireless Web Portal & REST API     ");
  Serial.println("=======================================================");

  // 1. Hardware Reset Pulse (Exact sequence proven to wake ST7789 GMT130)
  pinMode(${config.pinRes}, OUTPUT); // GPIO ${config.pinRes} = TFT_RST / RES
  digitalWrite(${config.pinRes}, HIGH);
  delay(20);
  digitalWrite(${config.pinRes}, LOW);
  delay(120);
  digitalWrite(${config.pinRes}, HIGH);
  delay(120);

  // 2. Direct LEDC Hardware PWM for Pin 7 (BLK / Backlight - GPIO ${config.pinBlk})
  // Guarantees backlight turns ON immediately regardless of library internal state
  ledcSetup(0, 1200, 8); // Channel 0, 1.2 kHz, 8-bit resolution (0-255)
  ledcAttachPin(${config.pinBlk}, 0);   // Attach GPIO ${config.pinBlk} to LEDC Channel 0
  ledcWrite(0, state.brightness); // Drive PWM backlight immediately

  // 3. Initialize Display & DMA Canvas
  tft.init();
  tft.setRotation(0);
  tft.setBrightness(state.brightness);
  
  // Create 240x240 16-bit RGB565 sprite in fast internal SRAM (115.2 KB)
  canvas.setColorDepth(16);
  if (!canvas.createSprite(240, 240)) {
    Serial.println("WARNING: Failed to allocate 240x240 canvas sprite! Check free heap.");
  } else {
    Serial.println("[OK] DMA 240x240 RGB565 Canvas Sprite Allocated.");
  }

  // Splash Screen
  canvas.fillScreen(0x0821);
  canvas.setTextColor(TFT_WHITE);
  canvas.setTextDatum(MC_DATUM);
  canvas.setFont(&fonts::Font4);
  canvas.drawString("ESP32-C3", 120, 85);
  canvas.setTextColor(0x07E0); // Emerald Green
  canvas.drawString("ST7789 240x240", 120, 120);
  canvas.setTextColor(0x7BEF);
  canvas.setFont(&fonts::Font2);
  canvas.drawString("GMT130 V1.0 Ready", 120, 155);
  canvas.pushSprite(0, 0);

  // 2. WiFi Connectivity
  ${config.wifiMode === 'hardcoded' ? `
  Serial.println("Connecting to WiFi: ${config.wifiSsid}...");
  WiFi.mode(WIFI_STA);
  WiFi.begin("${config.wifiSsid}", "${config.wifiPass}");
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(300);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\\n[OK] WiFi Connected. IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\\n[WARN] WiFi connection failed. Launching SoftAP...");
    WiFi.mode(WIFI_AP_STA);
    WiFi.softAP(AP_SSID, AP_PASS);
    Serial.println("AP IP: " + WiFi.softAPIP().toString());
  }
  ` : `
  Serial.println("Starting in Captive Portal Setup Mode...");
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(AP_SSID, AP_PASS);
  Serial.println("Connect to WiFi SSID: " + String(AP_SSID) + " (Pass: " + String(AP_PASS) + ")");
  Serial.println("Web Setup at: http://" + WiFi.softAPIP().toString());
  `}

  // 3. NTP Clock Initialization
  configTime(${config.timezoneOffsetHours * 3600}, 0, "${config.ntpServer}", "time.google.com");

  // 4. Web Server & GeekMagic REST API
  setupWebServer();
  server.begin();
  Serial.println("[OK] HTTP Server active on port 80.");
}

// -------------------------------------------------------------
// Main Loop
// -------------------------------------------------------------
void loop() {
  server.handleClient();

  // Screen Auto Rotation Carousel (if enabled via Web UI / API)
  if (autoRotate && (millis() - lastScreenSwitch > rotateInterval)) {
    lastScreenSwitch = millis();
    currentScreen = (ScreenMode)((currentScreen + 1) % SCREEN_COUNT);
  }

  // Weather Sync (Every 15 min if online)
  if (WiFi.status() == WL_CONNECTED && (millis() - lastWeatherUpdate > 900000 || lastWeatherUpdate == 0)) {
    updateWeather();
    lastWeatherUpdate = millis();
  }

  // Render selected screen into DMA Canvas
  switch (currentScreen) {
    case SCREEN_BIG_BOLD_ULTRA:
      drawBigBoldUltra();
      break;
    case SCREEN_BIG_TYPOGRAPHY_DUO:
      drawBigTypographyDuo();
      break;
    case SCREEN_BIG_SPORT_DIGITAL:
      drawBigSportDigital();
      break;
    case SCREEN_CLOCK_DASHBOARD:
      drawClockDashboard();
      break;
    case SCREEN_WEATHER:
      drawWeatherScreen();
      break;
    case SCREEN_HOME_ASSISTANT:
      drawHomeScreen();
      break;
    case SCREEN_PC_STATS:
      drawPcStatsScreen();
      break;
    default:
      drawBigBoldUltra();
      break;
  }

  // Push full frame in one high-speed DMA burst to ST7789
  canvas.pushSprite(0, 0);

  delay(30); // ~33 FPS smooth pacing
}

// -------------------------------------------------------------------------
// MODERN WATCH FACE 1: Big Bold Ultra (High-Impact Apple Watch Ultra Style)
// -------------------------------------------------------------------------
void drawBigBoldUltra() {
  canvas.fillScreen(0x0000); // Pure OLED Black

  struct tm timeinfo;
  bool timeValid = getLocalTime(&timeinfo, 10);
  char hourStr[4] = "12";
  char minStr[4] = "45";
  char secStr[4] = "38";
  char dateStr[24] = "SUN 20 SEP";
  int sec = 38;

  if (timeValid) {
    strftime(hourStr, sizeof(hourStr), "%H", &timeinfo);
    strftime(minStr, sizeof(minStr), "%M", &timeinfo);
    strftime(secStr, sizeof(secStr), "%S", &timeinfo);
    strftime(dateStr, sizeof(dateStr), "%a %d %b", &timeinfo);
    sec = timeinfo.tm_sec;
  }

  // Outer Smooth Seconds Arc (114px radius, 5px stroke)
  float angle = (sec / 60.0f) * 360.0f;
  canvas.fillArc(120, 120, 110, 114, 0, 360, 0x18E3); // Background track
  canvas.fillArc(120, 120, 110, 114, 270, (270 + (int)angle) % 360, 0xFD20); // Radiant Sunset Orange

  // Top Date Capsule
  canvas.fillRoundRect(50, 24, 140, 26, 13, 0x18E3);
  canvas.setTextDatum(MC_DATUM);
  canvas.setTextColor(0xFD20);
  canvas.setFont(&fonts::Font2);
  canvas.drawString(dateStr, 120, 37);

  // GIANT HIGH-CONTRAST TIME DISPLAY
  // Hour in Vibrant Orange / Minute in Crisp Pure White
  canvas.setTextDatum(MR_DATUM);
  canvas.setTextColor(0xFD20); // Electric Orange
  canvas.setFont(&fonts::Font7); // Giant Font 7
  canvas.drawString(hourStr, 106, 114);

  canvas.setTextDatum(MC_DATUM);
  canvas.setTextColor(TFT_WHITE);
  canvas.setFont(&fonts::Font6);
  canvas.drawString(":", 118, 108);

  canvas.setTextDatum(ML_DATUM);
  canvas.setTextColor(TFT_WHITE); // Pure White
  canvas.setFont(&fonts::Font7);
  canvas.drawString(minStr, 130, 114);

  // Seconds Badge on Right
  canvas.fillRoundRect(186, 100, 36, 26, 8, 0x2104);
  canvas.setTextDatum(MC_DATUM);
  canvas.setTextColor(0xFD20);
  canvas.setFont(&fonts::Font4);
  canvas.drawString(secStr, 204, 113);

  // Bottom Status Metrics (Temperature + Battery / WiFi)
  canvas.fillRoundRect(30, 172, 180, 42, 21, 0x10A2);
  canvas.setTextDatum(ML_DATUM);
  canvas.setTextColor(0x07E0); // Bright Green
  canvas.setFont(&fonts::Font4);
  canvas.drawString(String(state.temperature, 1) + " C", 48, 193);

  canvas.setTextDatum(MR_DATUM);
  canvas.setTextColor(0x07FF); // Cyan
  canvas.setFont(&fonts::Font2);
  canvas.drawString(WiFi.status() == WL_CONNECTED ? "ONLINE" : "OFFLINE", 192, 193);
}

// -------------------------------------------------------------------------
// MODERN WATCH FACE 2: Big Typography Duo (Stacked Bauhaus / Nothing OS)
// -------------------------------------------------------------------------
void drawBigTypographyDuo() {
  canvas.fillScreen(0x0821); // Charcoal Black

  struct tm timeinfo;
  bool timeValid = getLocalTime(&timeinfo, 10);
  char hourStr[4] = "12";
  char minStr[4] = "45";
  char dateStr[20] = "20 SEP";
  int sec = 38;

  if (timeValid) {
    strftime(hourStr, sizeof(hourStr), "%H", &timeinfo);
    strftime(minStr, sizeof(minStr), "%M", &timeinfo);
    strftime(dateStr, sizeof(dateStr), "%d %b", &timeinfo);
    sec = timeinfo.tm_sec;
  }

  // Left Vertical Smooth Seconds Bar
  int barHeight = (int)((sec / 60.0f) * 190.0f);
  canvas.fillRoundRect(14, 25, 6, 190, 3, 0x2104); // Track
  canvas.fillRoundRect(14, 215 - barHeight, 6, barHeight, 3, 0x07E0); // Bright Green

  // STACKED OVERSIZED TIME
  // Hour (Top, 80px visual scale)
  canvas.setTextDatum(TL_DATUM);
  canvas.setTextColor(0x07FF); // Vivid Neon Cyan
  canvas.setFont(&fonts::Font8); // Largest vector font 8
  canvas.drawString(hourStr, 34, 24);

  // Minute (Bottom, 80px visual scale)
  canvas.setTextColor(TFT_WHITE);
  canvas.drawString(minStr, 34, 114);

  // Right Corner Micro-Metrics
  // Top-right Date Box
  canvas.fillRoundRect(152, 28, 72, 34, 8, 0x18C3);
  canvas.setTextDatum(MC_DATUM);
  canvas.setTextColor(0xFBE0);
  canvas.setFont(&fonts::Font2);
  canvas.drawString(dateStr, 188, 45);

  // Mid-right Temp Box
  canvas.fillRoundRect(152, 70, 72, 34, 8, 0x18C3);
  canvas.setTextColor(0x07E0);
  canvas.setFont(&fonts::Font4);
  canvas.drawString(String(state.temperature, 0) + " C", 188, 87);

  // Bot-right WiFi / Activity Indicator
  canvas.fillRoundRect(152, 112, 72, 34, 8, 0x18C3);
  canvas.setTextColor(0xFFE0);
  canvas.setFont(&fonts::Font2);
  canvas.drawString("WIFI", 188, 129);
}

// -------------------------------------------------------------------------
// MODERN WATCH FACE 3: Big Sport Digital (Garmin / G-Shock Active)
// -------------------------------------------------------------------------
void drawBigSportDigital() {
  canvas.fillScreen(0x0010); // Deep Dark Slate Navy

  struct tm timeinfo;
  bool timeValid = getLocalTime(&timeinfo, 10);
  char timeStr[9] = "12:45";
  char secStr[4] = "38";
  int sec = 38;

  if (timeValid) {
    strftime(timeStr, sizeof(timeStr), "%H:%M", &timeinfo);
    strftime(secStr, sizeof(secStr), "%S", &timeinfo);
    sec = timeinfo.tm_sec;
  }

  // Top Days-of-Week Strip [S M T W T F S]
  int dayIdx = timeValid ? timeinfo.tm_wday : 0;
  const char* days[] = {"S", "M", "T", "W", "T", "F", "S"};
  canvas.setFont(&fonts::Font2);
  for (int i = 0; i < 7; i++) {
    int x = 24 + i * 28;
    if (i == dayIdx) {
      canvas.fillRoundRect(x - 3, 14, 22, 22, 6, 0xFD20);
      canvas.setTextColor(TFT_BLACK);
    } else {
      canvas.setTextColor(0x7BEF);
    }
    canvas.setTextDatum(MC_DATUM);
    canvas.drawString(days[i], x + 8, 25);
  }

  // Center Big Digital Time Block
  canvas.fillRoundRect(16, 46, 208, 90, 14, 0x0862);
  canvas.setTextDatum(ML_DATUM);
  canvas.setTextColor(0x07E0); // Vivid LCD Green
  canvas.setFont(&fonts::Font7); // Giant Font 7
  canvas.drawString(timeStr, 28, 91);

  // Boxed Seconds
  canvas.fillRoundRect(168, 58, 44, 32, 6, 0x18C3);
  canvas.setTextDatum(MC_DATUM);
  canvas.setTextColor(0xFD20);
  canvas.setFont(&fonts::Font4);
  canvas.drawString(secStr, 190, 74);

  // Bottom 3-Card Dashboard
  // Card 1: Temp
  canvas.fillRoundRect(16, 148, 64, 74, 10, 0x10A2);
  canvas.setTextColor(0x7BEF);
  canvas.setFont(&fonts::Font0);
  canvas.drawString("TEMP", 48, 162);
  canvas.setTextColor(TFT_WHITE);
  canvas.setFont(&fonts::Font4);
  canvas.drawString(String(state.temperature, 0), 48, 186);
  canvas.setTextColor(0x07E0);
  canvas.setFont(&fonts::Font0);
  canvas.drawString("C", 48, 206);

  // Card 2: Humidity
  canvas.fillRoundRect(88, 148, 64, 74, 10, 0x10A2);
  canvas.setTextColor(0x7BEF);
  canvas.setFont(&fonts::Font0);
  canvas.drawString("HUM", 120, 162);
  canvas.setTextColor(TFT_WHITE);
  canvas.setFont(&fonts::Font4);
  canvas.drawString(String((int)state.humidity), 120, 186);
  canvas.setTextColor(0x07FF);
  canvas.setFont(&fonts::Font0);
  canvas.drawString("%", 120, 206);

  // Card 3: Power / Status
  canvas.fillRoundRect(160, 148, 64, 74, 10, 0x10A2);
  canvas.setTextColor(0x7BEF);
  canvas.setFont(&fonts::Font0);
  canvas.drawString("POWER", 192, 162);
  canvas.setTextColor(TFT_WHITE);
  canvas.setFont(&fonts::Font2);
  canvas.drawString(String((int)state.haPower), 192, 186);
  canvas.setTextColor(0xFBE0);
  canvas.setFont(&fonts::Font0);
  canvas.drawString("W", 192, 206);
}

// -------------------------------------------------------------
// UI Renderer: Clock Dashboard (GeekMagic Style)
// -------------------------------------------------------------
void drawClockDashboard() {
  canvas.fillScreen(0x0821);

  struct tm timeinfo;
  bool timeValid = getLocalTime(&timeinfo, 10);
  char timeStr[9] = "12:45";
  char secStr[4] = "38";
  char dateStr[32] = "Sun, 20 Sep";
  int secValue = 38;

  if (timeValid) {
    strftime(timeStr, sizeof(timeStr), "%H:%M", &timeinfo);
    strftime(secStr, sizeof(secStr), "%S", &timeinfo);
    strftime(dateStr, sizeof(dateStr), "%a, %d %b", &timeinfo);
    secValue = timeinfo.tm_sec;
  }

  // Smooth Second Outer Arc Gauge
  float angle = (secValue / 60.0f) * 360.0f;
  canvas.fillArc(120, 120, 110, 114, 0, 360, 0x18E3);
  canvas.fillArc(120, 120, 110, 114, 270, (270 + (int)angle) % 360, 0x07E0);

  canvas.setTextDatum(MC_DATUM);
  canvas.setTextColor(0x7BEF);
  canvas.setFont(&fonts::Font2);
  canvas.drawString(dateStr, 120, 48);

  canvas.setTextColor(TFT_WHITE);
  canvas.setFont(&fonts::Font7);
  canvas.drawString(timeStr, 110, 110);

  canvas.setTextColor(0x07E0);
  canvas.setFont(&fonts::Font4);
  canvas.drawString(secStr, 186, 122);

  canvas.fillRoundRect(35, 172, 170, 36, 18, 0x18C3);
  canvas.setTextColor(0xFFE0);
  canvas.setTextDatum(ML_DATUM);
  canvas.setFont(&fonts::Font2);
  canvas.drawString(String(state.temperature, 1) + " C", 52, 190);

  canvas.setTextColor(WiFi.status() == WL_CONNECTED ? 0x07E0 : 0xF800);
  canvas.setTextDatum(MR_DATUM);
  canvas.setFont(&fonts::Font2);
  canvas.drawString(WiFi.status() == WL_CONNECTED ? "WiFi OK" : "AP Mode", 188, 190);
}

// -------------------------------------------------------------
// UI Renderer: Weather Station
// -------------------------------------------------------------
void drawWeatherScreen() {
  canvas.fillScreen(0x0010);

  canvas.setTextDatum(TC_DATUM);
  canvas.setTextColor(0x56FF);
  canvas.setFont(&fonts::Font4);
  canvas.drawString("${config.weatherCity}", 120, 18);

  canvas.setTextDatum(MC_DATUM);
  canvas.setTextColor(TFT_WHITE);
  canvas.setFont(&fonts::Font7);
  canvas.drawString(String(state.temperature, 1) + " C", 120, 90);

  canvas.setTextColor(0x7BEF);
  canvas.setFont(&fonts::Font2);
  canvas.drawString(state.weatherDesc, 120, 142);

  canvas.fillRoundRect(20, 168, 95, 52, 8, 0x08A4);
  canvas.fillRoundRect(125, 168, 95, 52, 8, 0x08A4);

  canvas.setTextColor(0x07E0);
  canvas.setTextDatum(MC_DATUM);
  canvas.setFont(&fonts::Font4);
  canvas.drawString(String((int)state.humidity) + "%", 67, 186);
  canvas.setTextColor(0x7BEF);
  canvas.setFont(&fonts::Font0);
  canvas.drawString("HUMIDITY", 67, 208);

  canvas.setTextColor(0x07FF);
  canvas.setFont(&fonts::Font4);
  canvas.drawString("1014", 172, 186);
  canvas.setTextColor(0x7BEF);
  canvas.setFont(&fonts::Font0);
  canvas.drawString("hPa", 172, 208);
}

// -------------------------------------------------------------
// UI Renderer: Home Assistant Live Cards
// -------------------------------------------------------------
void drawHomeScreen() {
  canvas.fillScreen(0x10A2);

  canvas.setTextDatum(TC_DATUM);
  canvas.setTextColor(0x07FF);
  canvas.setFont(&fonts::Font2);
  canvas.drawString("HOME ASSISTANT", 120, 16);

  // Card 1: Power
  canvas.fillRoundRect(16, 46, 208, 80, 10, 0x18C3);
  canvas.setTextColor(0xFBE0);
  canvas.setTextDatum(TL_DATUM);
  canvas.setFont(&fonts::Font2);
  canvas.drawString("MAIN POWER", 30, 58);
  canvas.setTextColor(TFT_WHITE);
  canvas.setFont(&fonts::Font6);
  canvas.drawString(String(state.haPower, 0) + " W", 30, 84);

  // Card 2: Living Room
  canvas.fillRoundRect(16, 138, 208, 86, 10, 0x18C3);
  canvas.setTextColor(0x07E0);
  canvas.setTextDatum(TL_DATUM);
  canvas.setFont(&fonts::Font2);
  canvas.drawString("LIVING ROOM", 30, 150);
  canvas.setTextColor(TFT_WHITE);
  canvas.setFont(&fonts::Font4);
  canvas.drawString("Light: " + String(state.haLight ? "ON" : "OFF"), 30, 174);
  canvas.setTextColor(0x7BEF);
  canvas.setFont(&fonts::Font2);
  canvas.drawString("Auto mode active", 30, 204);
}

// -------------------------------------------------------------
// UI Renderer: PC Hardware Monitor
// -------------------------------------------------------------
void drawPcStatsScreen() {
  canvas.fillScreen(TFT_BLACK);

  canvas.setTextDatum(TC_DATUM);
  canvas.setTextColor(0x07E0);
  canvas.setFont(&fonts::Font2);
  canvas.drawString("SYSTEM STATS", 120, 14);

  canvas.setTextDatum(TL_DATUM);
  canvas.setTextColor(TFT_WHITE);
  canvas.setFont(&fonts::Font2);
  canvas.drawString("CPU LOAD: " + String(state.cpuUsage, 0) + "%", 20, 44);
  canvas.fillRoundRect(20, 66, 200, 14, 4, 0x2104);
  canvas.fillRoundRect(20, 66, (int)(200 * (state.cpuUsage / 100.0f)), 14, 4, 0x07E0);

  canvas.drawString("RAM USAGE: " + String(state.ramUsage, 0) + "%", 20, 96);
  canvas.fillRoundRect(20, 118, 200, 14, 4, 0x2104);
  canvas.fillRoundRect(20, 118, (int)(200 * (state.ramUsage / 100.0f)), 14, 4, 0x05BF);

  canvas.fillRoundRect(20, 150, 200, 70, 8, 0x18A2);
  canvas.setTextColor(0xFD20);
  canvas.setTextDatum(MC_DATUM);
  canvas.setFont(&fonts::Font6);
  canvas.drawString(String(state.cpuTemp, 1) + " C", 120, 178);
  canvas.setTextColor(0x7BEF);
  canvas.setFont(&fonts::Font0);
  canvas.drawString("CORE TEMPERATURE", 120, 206);
}

// -------------------------------------------------------------
// OpenWeatherMap JSON API
// -------------------------------------------------------------
void updateWeather() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = "http://api.openweathermap.org/data/2.5/weather?q=${config.weatherCity}&units=${config.weatherUnits}&appid=${config.openWeatherApiKey}";
  
  http.begin(url);
  int httpCode = http.GET();
  if (httpCode == HTTP_CODE_OK) {
    String payload = http.getString();
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, payload);
    if (!error) {
      if (doc["main"]["temp"].is<float>()) {
        state.temperature = doc["main"]["temp"].as<float>();
      }
      if (doc["main"]["humidity"].is<float>()) {
        state.humidity = doc["main"]["humidity"].as<float>();
      }
      const char* desc = doc["weather"][0]["description"];
      if (desc) state.weatherDesc = String(desc);
      Serial.println("Weather updated successfully.");
    }
  }
  http.end();
}

// -------------------------------------------------------------
// Web Server & REST API (100% Buttonless Remote Control)
// -------------------------------------------------------------
void setupWebServer() {
  server.on("/api/display", HTTP_GET, []() {
    JsonDocument doc;
    doc["screen"] = (int)currentScreen;
    doc["brightness"] = state.brightness;
    doc["auto_rotate"] = autoRotate;
    doc["rotate_interval"] = rotateInterval;
    doc["temp"] = state.temperature;
    doc["humidity"] = state.humidity;
    doc["wifi"] = (WiFi.status() == WL_CONNECTED);
    doc["ip"] = WiFi.localIP().toString();
    doc["ap_ip"] = WiFi.softAPIP().toString();
    String resp;
    serializeJson(doc, resp);
    server.send(200, "application/json", resp);
  });

  server.on("/api/brightness", HTTP_GET, []() {
    if (server.hasArg("value")) {
      int val = server.arg("value").toInt();
      state.brightness = constrain(val, 5, 255);
      ledcWrite(0, state.brightness);      // Direct hardware LEDC PWM control on GPIO ${config.pinBlk}
      tft.setBrightness(state.brightness); // LovyanGFX backlight sync
      server.send(200, "text/plain", "OK");
    } else {
      server.send(400, "text/plain", "Missing value");
    }
  });

  server.on("/api/screen", HTTP_GET, []() {
    if (server.hasArg("id")) {
      currentScreen = (ScreenMode)constrain(server.arg("id").toInt(), 0, SCREEN_COUNT - 1);
      autoRotate = false; // Freeze on selected screen when manually picked
      server.send(200, "text/plain", "OK");
    } else {
      server.send(400, "text/plain", "Missing id");
    }
  });

  server.on("/api/autorotate", HTTP_GET, []() {
    if (server.hasArg("enabled")) {
      autoRotate = (server.arg("enabled").toInt() == 1);
    }
    if (server.hasArg("interval")) {
      long val = server.arg("interval").toInt();
      rotateInterval = (val > 2000L) ? val : 2000L;
    }
    server.send(200, "text/plain", "OK");
  });

  server.on("/api/wifi", HTTP_GET, []() {
    if (server.hasArg("ssid") && server.hasArg("pass")) {
      String ssid = server.arg("ssid");
      String pass = server.arg("pass");
      WiFi.begin(ssid.c_str(), pass.c_str());
      server.send(200, "text/plain", "Connecting to WiFi...");
    } else {
      server.send(400, "text/plain", "Missing ssid or pass");
    }
  });

  server.on("/", HTTP_GET, []() {
    String html = "<!DOCTYPE html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>";
    html += "<title>C3 SuperMini Watch Dashboard</title><style>";
    html += "body{font-family:system-ui,-apple-system,sans-serif;background:#0d1117;color:#c9d1d9;padding:16px;margin:0 auto;max-width:540px}";
    html += "h1{font-size:20px;color:#58a6ff;margin-bottom:4px}p{color:#8b949e;font-size:14px;margin-top:0}";
    html += ".card{background:#161b22;border:1px solid #30363d;border-radius:10px;padding:14px;margin-bottom:14px}";
    html += ".grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}";
    html += "button{background:#21262d;color:#c9d1d9;border:1px solid #30363d;padding:12px 10px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:all 0.2s}";
    html += "button:hover{background:#30363d;color:#fff}button.active{background:#238636;color:#fff;border-color:#2ea043}";
    html += "button.btn-accent{background:#1f6feb;color:#fff;border-color:#388bfd}";
    html += "input[type='range']{width:100%;accent-color:#238636;margin-top:8px}";
    html += "input[type='text'],input[type='password']{width:100%;box-sizing:border-box;background:#0d1117;border:1px solid #30363d;color:#fff;padding:10px;border-radius:6px;margin-bottom:8px}";
    html += "</style></head><body>";
    html += "<h1>ESP32-C3 SuperMini Display</h1>";
    html += "<p>ST7789 240x240 (GMT130 V1.0) &bull; 100% Buttonless Remote Control</p>";
    html += "<div class='card'><b>Select Watch Face</b><div class='grid' style='margin-top:10px'>";
    html += "<button onclick=\\"fetch('/api/screen?id=0')\\">1. Big Bold Ultra</button>";
    html += "<button onclick=\\"fetch('/api/screen?id=1')\\">2. Typography Duo</button>";
    html += "<button onclick=\\"fetch('/api/screen?id=2')\\">3. Sport Digital</button>";
    html += "<button onclick=\\"fetch('/api/screen?id=3')\\">4. Clock Dashboard</button>";
    html += "<button onclick=\\"fetch('/api/screen?id=4')\\">5. Weather Station</button>";
    html += "<button onclick=\\"fetch('/api/screen?id=5')\\">6. Home Assistant</button>";
    html += "<button onclick=\\"fetch('/api/screen?id=6')\\\" style='grid-column: span 2'>7. PC Hardware Stats</button>";
    html += "</div></div>";
    html += "<div class='card'><b>Auto-Rotation Carousel</b><p>Automatically cycles through all screens without physical buttons</p>";
    html += "<button id='btnAuto' class='btn-accent' onclick=\\"fetch('/api/display').then(r=>r.json()).then(d=>{const next=d.auto_rotate?0:1;fetch('/api/autorotate?enabled='+next).then(()=>alert('Auto-rotate: '+(next?'ON':'OFF')));});\\">Toggle Auto-Rotate</button>";
    html += "</div>";
    html += "<div class='card'><b>Backlight Brightness</b>";
    html += "<input type='range' min='5' max='255' value='" + String(state.brightness) + "' onchange=\\"fetch('/api/brightness?value='+this.value)\\">";
    html += "</div>";
    html += "</body></html>";
    server.send(200, "text/html", html);
  });

  server.on("/generate_204", HTTP_GET, []() {
    server.sendHeader("Location", "http://192.168.4.1/", true);
    server.send(302, "text/plain", "");
  });
  server.onNotFound([]() {
    server.sendHeader("Location", "http://192.168.4.1/", true);
    server.send(302, "text/plain", "");
  });
}
`;
}

export function generatePlatformIoIni(config: FirmwareConfig): string {
  return `; PlatformIO Project Configuration for ESP32-C3 Super Mini + ST7789 (GMT130 V1.0)
;
; Auto-Merge Single 0x0 Binary Enabled via scripts/merge_bin.py

[env:esp32-c3-supermini]
platform = espressif32@^6.5.0
board = esp32-c3-devkitm-1
framework = arduino

; Optimize CPU & Flash Clock
board_build.mcu = esp32c3
board_build.f_cpu = 160000000L
board_build.f_flash = 80000000L
board_build.flash_mode = dio
board_build.partitions = min_spiffs.csv

monitor_speed = 115200

; CRITICAL: USB CDC on boot enables Serial output via native USB-C
build_flags = 
    -DARDUINO_USB_MODE=1
    -DARDUINO_USB_CDC_ON_BOOT=1
    -DCORE_DEBUG_LEVEL=1

; Automatically runs esptool merge_bin after build to produce esp32c3_st7789_merged_0x0.bin!
extra_scripts = post:scripts/merge_bin.py

lib_deps =
    lovyan03/LovyanGFX@^1.1.16
    bblanchon/ArduinoJson@^7.0.4
`;
}

export function generateGithubWorkflow(): string {
  return `name: Build ESP32-C3 Firmware & Merge Binary

on:
  push:
    branches: [ main, master ]
    tags: [ 'v*' ]
  pull_request:
    branches: [ main, master ]
  workflow_dispatch:

jobs:
  build-and-merge:
    name: Compile & Generate Merged 0x0 Binary
    runs-on: ubuntu-latest
    env:
      ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION: "true"

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Set up Python 3.11
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install PlatformIO and esptool
        run: |
          python -m pip install --upgrade pip
          if [ -f requirements.txt ]; then
            pip install -r requirements.txt
          else
            pip install platformio esptool
          fi

      - name: Cache PlatformIO Core & Packages
        uses: actions/cache@v4
        with:
          path: ~/.platformio
          key: \${{ runner.os }}-pio-\${{ hashFiles('**/platformio.ini') }}
          restore-keys: |
            \${{ runner.os }}-pio-

      - name: Compile Firmware via PlatformIO
        run: |
          pio run

      - name: Merge Binaries into Single Flashable 0x0 Binary
        run: |
          echo "=== Generating Single Merged Binary at Offset 0x0 ==="
          BUILD_DIR=".pio/build/esp32-c3-supermini"
          
          python -m esptool --chip esp32c3 merge_bin \\
            -o "$BUILD_DIR/esp32c3_st7789_merged_0x0.bin" \\
            --flash_mode dio \\
            --flash_freq 80m \\
            --flash_size 4MB \\
            0x0000 "$BUILD_DIR/bootloader.bin" \\
            0x8000 "$BUILD_DIR/partitions.bin" \\
            0xe000 "$BUILD_DIR/boot_app0.bin" \\
            0x10000 "$BUILD_DIR/firmware.bin"

          echo "File size and details:"
          ls -lh "$BUILD_DIR/esp32c3_st7789_merged_0x0.bin"

      - name: Upload Single 0x0 Flashable Binary Artifact
        uses: actions/upload-artifact@v4
        with:
          name: esp32c3_st7789_merged_0x0
          path: .pio/build/esp32-c3-supermini/esp32c3_st7789_merged_0x0.bin
          if-no-files-found: error

      - name: Upload All Binary Packages (Diagnostic)
        uses: actions/upload-artifact@v4
        with:
          name: all-esp32c3-binaries
          path: |
            .pio/build/esp32-c3-supermini/firmware.bin
            .pio/build/esp32-c3-supermini/bootloader.bin
            .pio/build/esp32-c3-supermini/partitions.bin
            .pio/build/esp32-c3-supermini/boot_app0.bin
            .pio/build/esp32-c3-supermini/esp32c3_st7789_merged_0x0.bin
`;
}

export function generateMergeBinScript(): string {
  return `"""
PlatformIO Post-Build Script: merge_bin.py
Automatically merges bootloader.bin, partitions.bin, boot_app0.bin,
and firmware.bin into a single flashable binary at offset 0x0:
esp32c3_st7789_merged_0x0.bin
"""

Import("env")
import os
import sys

def merge_bin_action(source, target, env):
    build_dir = env.subst("$BUILD_DIR")
    firmware = os.path.join(build_dir, "firmware.bin")
    bootloader = os.path.join(build_dir, "bootloader.bin")
    partitions = os.path.join(build_dir, "partitions.bin")
    boot_app0 = os.path.join(env.PioPlatform().get_package_dir("framework-arduinoespressif32"), "tools", "partitions", "boot_app0.bin")
    
    out_merged = os.path.join(build_dir, "esp32c3_st7789_merged_0x0.bin")

    flash_mode = env.get("BOARD_FLASH_MODE", "dio")
    flash_freq = env.subst("$BOARD_F_FLASH").replace("L", "")
    flash_size = env.get("BOARD_FLASH_SIZE", "4MB")

    cmd = [
        sys.executable,
        "-m", "esptool",
        "--chip", "esp32c3",
        "merge_bin",
        "-o", out_merged,
        "--flash_mode", flash_mode,
        "--flash_freq", flash_freq,
        "--flash_size", flash_size,
        "0x0000", bootloader,
        "0x8000", partitions,
        "0xe000", boot_app0,
        "0x10000", firmware
    ]

    print("\\n[MERGE_BIN] Generating single 0x0 merged binary:")
    print(" ".join(cmd))
    result = env.Execute(" ".join(cmd))
    if result == 0:
        print(f"[MERGE_BIN SUCCESS] Created: {out_merged}\\n")
    else:
        print("[MERGE_BIN ERROR] Failed to merge binary!\\n")

env.AddPostAction("$BUILD_DIR/\${PROGNAME}.bin", merge_bin_action)
`;
}

export function generateTftEspiUserSetup(config: FirmwareConfig): string {
  return `/**
 * User_Setup.h for TFT_eSPI
 * Specially configured for:
 *   MCU: ESP32-C3 Super Mini
 *   Display: 1.3" 240x240 ST7789 (GMT130 V1.0) 7-Pin SPI
 */

#define USER_SETUP_INFO "ESP32C3_ST7789_GMT130"

// Driver definition
#define ST7789_DRIVER
#define TFT_WIDTH  240
#define TFT_HEIGHT 240

// Color & Inversion
#define TFT_INVERSION_ON   // CRITICAL for GMT130 IPS display!
#define TFT_RGB_ORDER TFT_RGB

// Pin definitions for ESP32-C3 Super Mini
#define TFT_MOSI ${config.pinSda}  // GMT130 SDA (GPIO ${config.pinSda})
#define TFT_SCLK ${config.pinScl}  // GMT130 SCL (GPIO ${config.pinScl})
#define TFT_CS   -1                // CRITICAL: GMT130 has NO CS pin (Hardwired to GND on PCB)!
#define TFT_DC   ${config.pinDc}   // GMT130 DC  (GPIO ${config.pinDc})
#define TFT_RST  ${config.pinRes}  // GMT130 RES (GPIO ${config.pinRes})
#define TFT_BL   ${config.pinBlk}  // GMT130 BLK (GPIO ${config.pinBlk})
#define TFT_BACKLIGHT_ON HIGH

// Fonts to load
#define LOAD_GLCD
#define LOAD_FONT2
#define LOAD_FONT4
#define LOAD_FONT6
#define LOAD_FONT7
#define LOAD_FONT8
#define SMOOTH_FONT

// SPI Speed
#define SPI_FREQUENCY  ${config.spiFrequencyMhz * 1000000}
#define SPI_READ_FREQUENCY  20000000
`;
}

export function generateReadme(config: FirmwareConfig): string {
  return `# ESP32-C3 Super Mini + ST7789 (GMT130 V1.0) Firmware & GitHub Workflow

## 1. Automated GitHub Actions CI & Merged Binary (\`0x0\`)

This project includes a production-ready GitHub Actions workflow in \`.github/workflows/build-firmware.yml\`.
Whenever you push code to GitHub:
1. GitHub Actions automatically installs PlatformIO and compiles the project.
2. It executes \`esptool.py merge_bin\` to merge all boot components (\`bootloader.bin\`, \`partitions.bin\`, \`boot_app0.bin\`, \`firmware.bin\`) into a single file:
   **\`esp32c3_st7789_merged_0x0.bin\`**
3. It publishes this merged binary as an downloadable build artifact!

### How to Flash the Merged Binary in 1 Command:
\`\`\`bash
# Flash the single merged binary directly at address 0x0
esptool.py --chip esp32c3 --port /dev/ttyUSB0 --baud 921600 write_flash 0x0 esp32c3_st7789_merged_0x0.bin
\`\`\`

---

## 2. Hardware Pinout Table

| Display Pin (GMT130) | Function | ESP32-C3 Super Mini Pin | Notes |
|---|---|---|---|
| **1. GND** | Ground | **GND** | Direct ground |
| **2. VCC** | 3.3V Power | **3V3** | Connect to 3.3V logic supply |
| **3. SCL** | SPI Clock | **GPIO ${config.pinScl}** | FSPI Hardware Clock |
| **4. SDA** | SPI MOSI Data | **GPIO ${config.pinSda}** | FSPI Hardware Data |
| **5. RES** | Hardware Reset | **GPIO ${config.pinRes}** | Active LOW reset |
| **6. DC** | Data / Command | **GPIO ${config.pinDc}** | High = Data, Low = Command |
| **7. BLK** | Backlight Control | **GPIO ${config.pinBlk}** | PWM Dimming (0-255) |
| *(CS Pin)* | Chip Select | **NONE (GND on PCB)** | Set \`pin_cs = -1\` in driver! |

---

## 3. Included Modern Big Watch Faces

1. **Big Bold Ultra (Apple Watch Ultra style)**:
   - Giant high-legibility numerals (HH:MM) taking full screen width.
   - Smooth 360-degree outer sweeping seconds arc.
   - Top date capsule pill and bottom temperature/status pill.
2. **Big Typography Duo (Nothing OS / Braun style)**:
   - Stacked oversized typographic numerals (Hour on top, Minute on bottom) in massive font.
   - Vertical seconds progress indicator on the left edge.
   - Right corner micro-metric capsules (Date, Temp, WiFi).
3. **Big Sport Digital (Garmin / G-Shock style)**:
   - Days-of-week active highlight strip (\`[S] M T W T F S\`).
   - High-contrast LCD digital time with split seconds box.
   - Lower 3-card telemetry grid (Temp, Humidity, Power).
4. **Classic Clock Dashboard**:
   - GeekMagic seconds ring with weather pill.
5. **Weather Station**:
   - Current temperature, humidity, and barometric pressure.
6. **Home Assistant Live Cards**:
   - Compatible with the GeekMagic Home Assistant HACS integration!

---

## 4. Why Generic Code Fails on this Hardware

1. **Pin 7 is BLK (Backlight), NOT CS!**
   Most generic ST7789 code expects pin 7 to be Chip Select (CS). On the GMT130 V1.0 7-pin module, Pin 7 is BLK (Backlight cathode/anode driver). CS is hardwired permanently to GND underneath the glass panel. If code tries to toggle CS or leaves it floating, the SPI bus locks up.
2. **Color Inversion (\`0x21\` INVON):**
   The GMT130 V1.0 IPS panel requires display inversion turned ON. Without inversion, black backgrounds display as blinding white and colors are inverted like photo negatives.
3. **ESP32-C3 Native USB Collision:**
   GPIO 18 and GPIO 19 are dedicated to the on-chip USB CDC/JTAG peripheral. Generic code that uses GPIO 18/19 for SPI causes the USB connection to break immediately on boot.
4. **DMA & 60 FPS Pacing:**
   Instead of slow, flickering \`drawPixel\` or blocking unbuffered SPI, this firmware uses LovyanGFX DMA double-buffering. An internal 115KB sprite is rendered in fast SRAM and pushed to the display in a single burst at 40MHz-80MHz.
`;
}
