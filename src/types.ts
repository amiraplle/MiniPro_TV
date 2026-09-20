export type ScreenMode = 
  | 'big_bold_ultra'
  | 'big_typography_duo'
  | 'big_sport_digital'
  | 'clock_dashboard'
  | 'weather_station'
  | 'home_assistant'
  | 'pc_monitor'
  | 'candlestick'
  | 'night_standby'
  | 'retro_cyber';

export type DisplayTheme = 
  | 'cyberpunk'
  | 'watchos'
  | 'neon_amber'
  | 'aurora'
  | 'minimal_mono'
  | 'forest_emerald'
  | 'sunset_orange';

export interface PinDefinition {
  displayPin: string;
  displayFunction: string;
  esp32c3Pin: string;
  gpioNumber: number | null;
  description: string;
  warning?: string;
  color: string;
}

export interface FirmwareConfig {
  wifiMode: 'captive_portal' | 'hardcoded';
  wifiSsid: string;
  wifiPass: string;
  deviceHostname: string;
  ntpServer: string;
  timezoneOffsetHours: number;
  openWeatherApiKey: string;
  weatherCity: string;
  weatherUnits: 'metric' | 'imperial';
  homeAssistantUrl: string;
  homeAssistantToken: string;
  homeAssistantEntity1: string;
  homeAssistantEntity2: string;
  spiFrequencyMhz: 40 | 80;
  colorInversion: boolean;
  bgrOrder: boolean;
  defaultBrightness: number;
  nightBrightness: number;
  autoRotateScreens: boolean;
  rotateIntervalSec: number;
  driverLibrary: 'lovyangfx' | 'tft_espi';
  pinScl: number;
  pinSda: number;
  pinRes: number;
  pinDc: number;
  pinBlk: number;
  pinBootBtn: number;
}

export interface MockSensorData {
  time: Date;
  temp: number;
  humidity: number;
  condition: string;
  pressure: number;
  windSpeed: number;
  cpuUsage: number;
  gpuUsage: number;
  ramUsage: number;
  cpuTemp: number;
  haLightState: boolean;
  haPowerWatts: number;
  haLivingTemp: number;
  cryptoPrice: number;
  cryptoChange24h: number;
}
