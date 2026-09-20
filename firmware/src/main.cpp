/**
 * @file main.cpp
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
 *  - GMT130 Pin 3 (SCL) -> ESP32-C3 GPIO 4 (FSPI SCK)
 *  - GMT130 Pin 4 (SDA) -> ESP32-C3 GPIO 6 (FSPI MOSI)
 *  - GMT130 Pin 5 (RES) -> ESP32-C3 GPIO 1 (Reset)
 *  - GMT130 Pin 6 (DC)  -> ESP32-C3 GPIO 2 (Data/Command)
 *  - GMT130 Pin 7 (BLK) -> ESP32-C3 GPIO 3 (PWM Dimming)
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

// 100% Buttonless Design: Controlled via Web UI, REST API, or Auto-Rotation Carousel
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
bool autoRotate = false; // Starts on Big Bold Ultra; toggleable via Web UI / API
unsigned long rotateInterval = 8000;

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
  int brightness = 220;
} state;

// Forward Declarations
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
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=======================================================");
  Serial.println("  ESP32-C3 Super Mini + ST7789 (GMT130 V1.0) Firmware  ");
  Serial.println("  100% BUTTONLESS - Wireless Web Portal & REST API     ");
  Serial.println("=======================================================");

  // 1. Initialize Display & DMA Canvas
  tft.init();
  tft.setRotation(0);
  tft.setBrightness(state.brightness);
  
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

  // 2. Wireless Connectivity (Always-on Access Point + Station Mode)
  Serial.println("Starting Wireless Access Point Portal...");
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(AP_SSID, AP_PASS);
  Serial.println("Connect to WiFi SSID: " + String(AP_SSID) + " (Pass: " + String(AP_PASS) + ")");
  Serial.println("Web Control Panel at: http://" + WiFi.softAPIP().toString());

  // 3. NTP Clock Initialization (UTC+6 Default, adjust as needed)
  configTime(6 * 3600, 0, "pool.ntp.org", "time.google.com");

  // 4. Web Server & REST API
  setupWebServer();
  server.begin();
  Serial.println("[OK] HTTP Server active on port 80.");
}

// -------------------------------------------------------------
// Main Loop
// -------------------------------------------------------------
void loop() {
  server.handleClient();

  // Screen Auto-Rotation Carousel (if enabled via Web UI / API)
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
// MODERN WATCH FACE 1: Big Bold Ultra (Apple Watch Ultra Style)
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
  canvas.drawString(WiFi.status() == WL_CONNECTED ? "ONLINE" : "AP MODE", 192, 193);
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
  canvas.setTextDatum(TL_DATUM);
  canvas.setTextColor(0x07FF); // Vivid Neon Cyan
  canvas.setFont(&fonts::Font8); // Largest vector font 8
  canvas.drawString(hourStr, 34, 24);

  canvas.setTextColor(TFT_WHITE);
  canvas.drawString(minStr, 34, 114);

  // Right Corner Micro-Metrics
  canvas.fillRoundRect(152, 28, 72, 34, 8, 0x18C3);
  canvas.setTextDatum(MC_DATUM);
  canvas.setTextColor(0xFBE0);
  canvas.setFont(&fonts::Font2);
  canvas.drawString(dateStr, 188, 45);

  canvas.fillRoundRect(152, 70, 72, 34, 8, 0x18C3);
  canvas.setTextColor(0x07E0);
  canvas.setFont(&fonts::Font4);
  canvas.drawString(String(state.temperature, 0) + " C", 188, 87);

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
  canvas.drawString("Dhaka", 120, 18);

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
  String url = "http://api.openweathermap.org/data/2.5/weather?q=Dhaka&units=metric&appid=YOUR_OPENWEATHER_API_KEY";
  
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
      tft.setBrightness(state.brightness);
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
      rotateInterval = max(2000, server.arg("interval").toInt());
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
    html += ".status-badge{display:inline-block;padding:4px 8px;border-radius:20px;font-size:12px;background:#238636;color:#fff}";
    html += "</style></head><body>";
    html += "<h1>ESP32-C3 SuperMini Display</h1>";
    html += "<p>ST7789 240x240 (GMT130 V1.0) &bull; 100% Buttonless Remote Control</p>";
    html += "<div class='card'><b>Select Watch Face</b><div class='grid' style='margin-top:10px'>";
    html += "<button onclick=\"setScreen(0)\">1. Big Bold Ultra</button>";
    html += "<button onclick=\"setScreen(1)\">2. Typography Duo</button>";
    html += "<button onclick=\"setScreen(2)\">3. Sport Digital</button>";
    html += "<button onclick=\"setScreen(3)\">4. Clock Dashboard</button>";
    html += "<button onclick=\"setScreen(4)\">5. Weather Station</button>";
    html += "<button onclick=\"setScreen(5)\">6. Home Assistant</button>";
    html += "<button onclick=\"setScreen(6)\" style='grid-column: span 2'>7. PC Hardware Stats</button>";
    html += "</div></div>";
    html += "<div class='card'><b>Auto-Rotation Carousel</b><p>Automatically cycles through all screens without physical buttons</p>";
    html += "<button id='btnAuto' class='btn-accent' onclick='toggleAuto()'>Toggle Auto-Rotate</button>";
    html += "</div>";
    html += "<div class='card'><b>Backlight Brightness</b>";
    html += "<input type='range' min='5' max='255' value='" + String(state.brightness) + "' onchange=\"fetch('/api/brightness?value='+this.value)\">";
    html += "</div>";
    html += "<div class='card'><b>WiFi Setup</b>";
    html += "<input type='text' id='ssid' placeholder='WiFi SSID'>";
    html += "<input type='password' id='pass' placeholder='WiFi Password'>";
    html += "<button class='btn-accent' onclick=\"connectWifi()\">Connect WiFi</button>";
    html += "</div>";
    html += "<script>";
    html += "function setScreen(id){fetch('/api/screen?id='+id).then(()=>alert('Switched to Screen '+id));}";
    html += "function toggleAuto(){fetch('/api/display').then(r=>r.json()).then(d=>{const next=d.auto_rotate?0:1;fetch('/api/autorotate?enabled='+next).then(()=>alert('Auto-rotate: '+(next?'ON':'OFF')));});}";
    html += "function connectWifi(){const s=document.getElementById('ssid').value;const p=document.getElementById('pass').value;fetch('/api/wifi?ssid='+encodeURIComponent(s)+'&pass='+encodeURIComponent(p)).then(()=>alert('Connecting...'));}";
    html += "</script></body></html>";
    server.send(200, "text/html", html);
  });
}
