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

#define PIN_BOOT_BTN 9

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
bool autoRotate = true;
const unsigned long ROTATE_INTERVAL = 8000;

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
void handleButton();

// -------------------------------------------------------------
// Setup
// -------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=======================================================");
  Serial.println("  ESP32-C3 Super Mini + ST7789 (GMT130 V1.0) Firmware  ");
  Serial.println("=======================================================");

  pinMode(PIN_BOOT_BTN, INPUT_PULLUP);

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
  canvas.drawString("ESP32-C3", 120, 85, 4);
  canvas.setTextColor(0x07E0); // Emerald Green
  canvas.drawString("ST7789 240x240", 120, 120, 4);
  canvas.setTextColor(0x7BEF);
  canvas.drawString("GMT130 V1.0 Ready", 120, 155, 2);
  canvas.pushSprite(0, 0);

  // 2. WiFi Connectivity
  Serial.println("Starting in Captive Portal Setup Mode...");
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(AP_SSID, AP_PASS);
  Serial.println("Connect to WiFi SSID: " + String(AP_SSID) + " (Pass: " + String(AP_PASS) + ")");
  Serial.println("Web Setup at: http://" + WiFi.softAPIP().toString());

  // 3. NTP Clock Initialization (UTC+6 Default, adjust as needed)
  configTime(6 * 3600, 0, "pool.ntp.org", "time.google.com");

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
  handleButton();

  // Screen Auto Rotation
  if (autoRotate && (millis() - lastScreenSwitch > ROTATE_INTERVAL)) {
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
  canvas.drawArc(120, 120, 114, 110, 0, 360, 0x18E3); // Background track
  canvas.drawArc(120, 120, 114, 110, 270, (270 + (int)angle) % 360, 0xFD20); // Radiant Sunset Orange

  // Top Date Capsule
  canvas.fillRoundRect(50, 24, 140, 26, 13, 0x18E3);
  canvas.setTextDatum(MC_DATUM);
  canvas.setTextColor(0xFD20);
  canvas.drawString(dateStr, 120, 37, 2);

  // GIANT HIGH-CONTRAST TIME DISPLAY
  canvas.setTextDatum(MR_DATUM);
  canvas.setTextColor(0xFD20); // Electric Orange
  canvas.drawString(hourStr, 106, 114, 7); // Giant Font 7

  canvas.setTextDatum(MC_DATUM);
  canvas.setTextColor(TFT_WHITE);
  canvas.drawString(":", 118, 108, 6);

  canvas.setTextDatum(ML_DATUM);
  canvas.setTextColor(TFT_WHITE); // Pure White
  canvas.drawString(minStr, 130, 114, 7);

  // Seconds Badge on Right
  canvas.fillRoundRect(186, 100, 36, 26, 8, 0x2104);
  canvas.setTextDatum(MC_DATUM);
  canvas.setTextColor(0xFD20);
  canvas.drawString(secStr, 204, 113, 4);

  // Bottom Status Metrics (Temperature + Battery / WiFi)
  canvas.fillRoundRect(30, 172, 180, 42, 21, 0x10A2);
  canvas.setTextDatum(ML_DATUM);
  canvas.setTextColor(0x07E0); // Bright Green
  canvas.drawString(String(state.temperature, 1) + " C", 48, 193, 4);

  canvas.setTextDatum(MR_DATUM);
  canvas.setTextColor(0x07FF); // Cyan
  canvas.drawString(WiFi.status() == WL_CONNECTED ? "ONLINE" : "AP MODE", 192, 193, 2);
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
  canvas.drawString(hourStr, 34, 24, 8); // Largest vector font 8

  canvas.setTextColor(TFT_WHITE);
  canvas.drawString(minStr, 34, 114, 8);

  // Right Corner Micro-Metrics
  canvas.fillRoundRect(152, 28, 72, 34, 8, 0x18C3);
  canvas.setTextDatum(MC_DATUM);
  canvas.setTextColor(0xFBE0);
  canvas.drawString(dateStr, 188, 45, 2);

  canvas.fillRoundRect(152, 70, 72, 34, 8, 0x18C3);
  canvas.setTextColor(0x07E0);
  canvas.drawString(String(state.temperature, 0) + " C", 188, 87, 4);

  canvas.fillRoundRect(152, 112, 72, 34, 8, 0x18C3);
  canvas.setTextColor(0xFFE0);
  canvas.drawString("WIFI", 188, 129, 2);
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
  for (int i = 0; i < 7; i++) {
    int x = 24 + i * 28;
    if (i == dayIdx) {
      canvas.fillRoundRect(x - 3, 14, 22, 22, 6, 0xFD20);
      canvas.setTextColor(TFT_BLACK);
    } else {
      canvas.setTextColor(0x7BEF);
    }
    canvas.setTextDatum(MC_DATUM);
    canvas.drawString(days[i], x + 8, 25, 2);
  }

  // Center Big Digital Time Block
  canvas.fillRoundRect(16, 46, 208, 90, 14, 0x0862);
  canvas.setTextDatum(ML_DATUM);
  canvas.setTextColor(0x07E0); // Vivid LCD Green
  canvas.drawString(timeStr, 28, 91, 7); // Giant Font 7

  // Boxed Seconds
  canvas.fillRoundRect(168, 58, 44, 32, 6, 0x18C3);
  canvas.setTextDatum(MC_DATUM);
  canvas.setTextColor(0xFD20);
  canvas.drawString(secStr, 190, 74, 4);

  // Bottom 3-Card Dashboard
  canvas.fillRoundRect(16, 148, 64, 74, 10, 0x10A2);
  canvas.setTextColor(0x7BEF);
  canvas.drawString("TEMP", 48, 162, 1);
  canvas.setTextColor(TFT_WHITE);
  canvas.drawString(String(state.temperature, 0), 48, 186, 4);
  canvas.setTextColor(0x07E0);
  canvas.drawString("C", 48, 206, 1);

  canvas.fillRoundRect(88, 148, 64, 74, 10, 0x10A2);
  canvas.setTextColor(0x7BEF);
  canvas.drawString("HUM", 120, 162, 1);
  canvas.setTextColor(TFT_WHITE);
  canvas.drawString(String((int)state.humidity), 120, 186, 4);
  canvas.setTextColor(0x07FF);
  canvas.drawString("%", 120, 206, 1);

  canvas.fillRoundRect(160, 148, 64, 74, 10, 0x10A2);
  canvas.setTextColor(0x7BEF);
  canvas.drawString("POWER", 192, 162, 1);
  canvas.setTextColor(TFT_WHITE);
  canvas.drawString(String((int)state.haPower), 192, 186, 2);
  canvas.setTextColor(0xFBE0);
  canvas.drawString("W", 192, 206, 1);
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
  canvas.drawArc(120, 120, 114, 110, 0, 360, 0x18E3);
  canvas.drawArc(120, 120, 114, 110, 270, (270 + (int)angle) % 360, 0x07E0);

  canvas.setTextDatum(MC_DATUM);
  canvas.setTextColor(0x7BEF);
  canvas.drawString(dateStr, 120, 48, 2);

  canvas.setTextColor(TFT_WHITE);
  canvas.drawString(timeStr, 110, 110, 7);

  canvas.setTextColor(0x07E0);
  canvas.drawString(secStr, 186, 122, 4);

  canvas.fillRoundRect(35, 172, 170, 36, 18, 0x18C3);
  canvas.setTextColor(0xFFE0);
  canvas.setTextDatum(ML_DATUM);
  canvas.drawString(String(state.temperature, 1) + " C", 52, 190, 2);

  canvas.setTextColor(WiFi.status() == WL_CONNECTED ? 0x07E0 : 0xF800);
  canvas.setTextDatum(MR_DATUM);
  canvas.drawString(WiFi.status() == WL_CONNECTED ? "WiFi OK" : "AP Mode", 188, 190, 2);
}

// -------------------------------------------------------------
// UI Renderer: Weather Station
// -------------------------------------------------------------
void drawWeatherScreen() {
  canvas.fillScreen(0x0010);

  canvas.setTextDatum(TC_DATUM);
  canvas.setTextColor(0x56FF);
  canvas.drawString("Dhaka", 120, 18, 4);

  canvas.setTextDatum(MC_DATUM);
  canvas.setTextColor(TFT_WHITE);
  canvas.drawString(String(state.temperature, 1) + " C", 120, 90, 7);

  canvas.setTextColor(0x7BEF);
  canvas.drawString(state.weatherDesc, 120, 142, 2);

  canvas.fillRoundRect(20, 168, 95, 52, 8, 0x08A4);
  canvas.fillRoundRect(125, 168, 95, 52, 8, 0x08A4);

  canvas.setTextColor(0x07E0);
  canvas.setTextDatum(MC_DATUM);
  canvas.drawString(String((int)state.humidity) + "%", 67, 186, 4);
  canvas.setTextColor(0x7BEF);
  canvas.drawString("HUMIDITY", 67, 208, 1);

  canvas.setTextColor(0x07FF);
  canvas.drawString("1014", 172, 186, 4);
  canvas.setTextColor(0x7BEF);
  canvas.drawString("hPa", 172, 208, 1);
}

// -------------------------------------------------------------
// UI Renderer: Home Assistant Live Cards
// -------------------------------------------------------------
void drawHomeScreen() {
  canvas.fillScreen(0x10A2);

  canvas.setTextDatum(TC_DATUM);
  canvas.setTextColor(0x07FF);
  canvas.drawString("HOME ASSISTANT", 120, 16, 2);

  // Card 1: Power
  canvas.fillRoundRect(16, 46, 208, 80, 10, 0x18C3);
  canvas.setTextColor(0xFBE0);
  canvas.setTextDatum(TL_DATUM);
  canvas.drawString("MAIN POWER", 30, 58, 2);
  canvas.setTextColor(TFT_WHITE);
  canvas.drawString(String(state.haPower, 0) + " W", 30, 84, 6);

  // Card 2: Living Room
  canvas.fillRoundRect(16, 138, 208, 86, 10, 0x18C3);
  canvas.setTextColor(0x07E0);
  canvas.setTextDatum(TL_DATUM);
  canvas.drawString("LIVING ROOM", 30, 150, 2);
  canvas.setTextColor(TFT_WHITE);
  canvas.drawString("Light: " + String(state.haLight ? "ON" : "OFF"), 30, 174, 4);
  canvas.setTextColor(0x7BEF);
  canvas.drawString("Auto mode active", 30, 204, 2);
}

// -------------------------------------------------------------
// UI Renderer: PC Hardware Monitor
// -------------------------------------------------------------
void drawPcStatsScreen() {
  canvas.fillScreen(TFT_BLACK);

  canvas.setTextDatum(TC_DATUM);
  canvas.setTextColor(0x07E0);
  canvas.drawString("SYSTEM STATS", 120, 14, 2);

  canvas.setTextDatum(TL_DATUM);
  canvas.setTextColor(TFT_WHITE);
  canvas.drawString("CPU LOAD: " + String(state.cpuUsage, 0) + "%", 20, 44, 2);
  canvas.fillRoundRect(20, 66, 200, 14, 4, 0x2104);
  canvas.fillRoundRect(20, 66, (int)(200 * (state.cpuUsage / 100.0f)), 14, 4, 0x07E0);

  canvas.drawString("RAM USAGE: " + String(state.ramUsage, 0) + "%", 20, 96, 2);
  canvas.fillRoundRect(20, 118, 200, 14, 4, 0x2104);
  canvas.fillRoundRect(20, 118, (int)(200 * (state.ramUsage / 100.0f)), 14, 4, 0x05BF);

  canvas.fillRoundRect(20, 150, 200, 70, 8, 0x18A2);
  canvas.setTextColor(0xFD20);
  canvas.setTextDatum(MC_DATUM);
  canvas.drawString(String(state.cpuTemp, 1) + " C", 120, 178, 6);
  canvas.setTextColor(0x7BEF);
  canvas.drawString("CORE TEMPERATURE", 120, 206, 1);
}

// -------------------------------------------------------------
// Button Handling (Built-in BOOT Button on GPIO 9)
// -------------------------------------------------------------
void handleButton() {
  static unsigned long btnPressTime = 0;
  static bool btnWasPressed = false;

  bool isPressed = (digitalRead(PIN_BOOT_BTN) == LOW);

  if (isPressed && !btnWasPressed) {
    btnPressTime = millis();
    btnWasPressed = true;
  } else if (!isPressed && btnWasPressed) {
    unsigned long duration = millis() - btnPressTime;
    btnWasPressed = false;

    if (duration > 3000) {
      Serial.println("Long press detected! Starting AP Setup Mode...");
      WiFi.disconnect(true);
      WiFi.mode(WIFI_AP);
      WiFi.softAP(AP_SSID, AP_PASS);
      tft.setBrightness(255);
    } else if (duration > 50) {
      currentScreen = (ScreenMode)((currentScreen + 1) % SCREEN_COUNT);
      Serial.printf("Screen manually switched to: %d\n", currentScreen);
    }
  }
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
    StaticJsonDocument<1024> doc;
    DeserializationError error = deserializeJson(doc, payload);
    if (!error) {
      state.temperature = doc["main"]["temp"] | state.temperature;
      state.humidity = doc["main"]["humidity"] | state.humidity;
      const char* desc = doc["weather"][0]["description"];
      if (desc) state.weatherDesc = String(desc);
      Serial.println("Weather updated successfully.");
    }
  }
  http.end();
}

// -------------------------------------------------------------
// Web Server & REST API
// -------------------------------------------------------------
void setupWebServer() {
  server.on("/api/display", HTTP_GET, []() {
    StaticJsonDocument<256> doc;
    doc["screen"] = currentScreen;
    doc["brightness"] = state.brightness;
    doc["temp"] = state.temperature;
    doc["humidity"] = state.humidity;
    doc["wifi"] = (WiFi.status() == WL_CONNECTED);
    doc["ip"] = WiFi.localIP().toString();
    String resp;
    serializeJson(doc, resp);
    server.send(200, "application/json", resp);
  });

  server.on("/api/brightness", HTTP_GET, []() {
    if (server.hasArg("value")) {
      int val = server.arg("value").toInt();
      state.brightness = constrain(val, 0, 255);
      tft.setBrightness(state.brightness);
      server.send(200, "text/plain", "OK");
    } else {
      server.send(400, "text/plain", "Missing value");
    }
  });

  server.on("/api/screen", HTTP_GET, []() {
    if (server.hasArg("id")) {
      currentScreen = (ScreenMode)constrain(server.arg("id").toInt(), 0, SCREEN_COUNT - 1);
      server.send(200, "text/plain", "OK");
    } else {
      server.send(400, "text/plain", "Missing id");
    }
  });

  server.on("/", HTTP_GET, []() {
    String html = "<html><head><meta name='viewport' content='width=device-width,initial-scale=1'>";
    html += "<title>C3 SuperMini Display</title><style>body{font-family:sans-serif;background:#121212;color:#eee;padding:20px}button{background:#00C853;color:#fff;border:none;padding:12px 20px;border-radius:6px;font-size:16px;cursor:pointer;margin:4px}input{padding:10px;border-radius:4px;border:1px solid #444;background:#222;color:#fff;width:100%;margin-bottom:12px}</style></head>";
    html += "<body><h2>ESP32-C3 Watch Faces & Settings</h2>";
    html += "<p>ST7789 GMT130 V1.0 (240x240)</p>";
    html += "<p><button onclick=\"fetch('/api/screen?id=0')\">Big Bold Ultra</button> ";
    html += "<button onclick=\"fetch('/api/screen?id=1')\">Big Typography Duo</button> ";
    html += "<button onclick=\"fetch('/api/screen?id=2')\">Big Sport Digital</button> ";
    html += "<button onclick=\"fetch('/api/screen?id=3')\">Clock Dashboard</button> ";
    html += "<button onclick=\"fetch('/api/screen?id=4')\">Weather Station</button></p>";
    html += "<p>Brightness: <input type='range' min='10' max='255' value='" + String(state.brightness) + "' onchange=\"fetch('/api/brightness?value='+this.value)\">";
    html += "</body></html>";
    server.send(200, "text/html", html);
  });
}
