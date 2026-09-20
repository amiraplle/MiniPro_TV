import { useState, useEffect, useRef } from 'react';
import { ScreenMode, DisplayTheme, MockSensorData } from '../types';
import { 
  Sun, 
  Wifi, 
  RotateCw, 
  Moon, 
  Cpu, 
  Activity, 
  Eye, 
  Sparkles,
  RefreshCw,
  Sliders,
  Watch,
  Layers,
  Zap
} from 'lucide-react';

interface DisplaySimulatorProps {
  currentScreen: ScreenMode;
  onScreenChange: (screen: ScreenMode) => void;
  brightness: number;
  onBrightnessChange: (val: number) => void;
  colorInversion: boolean;
  onToggleInversion: () => void;
  theme: DisplayTheme;
  onThemeChange: (theme: DisplayTheme) => void;
}

export default function DisplaySimulator({
  currentScreen,
  onScreenChange,
  brightness,
  onBrightnessChange,
  colorInversion,
  onToggleInversion,
  theme,
  onThemeChange
}: DisplaySimulatorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [showBezel, setShowBezel] = useState(true);
  const [showGlassReflection, setShowGlassReflection] = useState(true);
  const [isButtonPressed, setIsButtonPressed] = useState(false);
  const buttonTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [buttonMessage, setButtonMessage] = useState<string | null>(null);

  // Live real-time clock and simulated sensors
  const [sensorData, setSensorData] = useState<MockSensorData>({
    time: new Date(),
    temp: 26.8,
    humidity: 64,
    condition: 'Partly Cloudy',
    pressure: 1013,
    windSpeed: 14,
    cpuUsage: 28,
    gpuUsage: 45,
    ramUsage: 54,
    cpuTemp: 44.5,
    haLightState: true,
    haPowerWatts: 245,
    haLivingTemp: 24.2,
    cryptoPrice: 64820,
    cryptoChange24h: 3.4
  });

  // Clock tick & gentle telemetry oscillation
  useEffect(() => {
    const interval = setInterval(() => {
      setSensorData(prev => ({
        ...prev,
        time: new Date(),
        cpuUsage: Math.min(95, Math.max(12, prev.cpuUsage + (Math.random() * 8 - 4))),
        gpuUsage: Math.min(98, Math.max(20, prev.gpuUsage + (Math.random() * 10 - 5))),
        cpuTemp: Math.min(85, Math.max(38, prev.cpuTemp + (Math.random() * 0.8 - 0.4))),
        haPowerWatts: Math.max(50, prev.haPowerWatts + Math.round(Math.random() * 16 - 8)),
        temp: +(prev.temp + (Math.random() * 0.1 - 0.05)).toFixed(1)
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Theme palettes
  const getThemeColors = () => {
    switch (theme) {
      case 'cyberpunk':
        return { bg: '#080811', primary: '#00ffcc', accent: '#ff0055', secondary: '#ffd000', cardBg: '#121226', textMuted: '#71719e' };
      case 'watchos':
        return { bg: '#000000', primary: '#30d158', accent: '#0a84ff', secondary: '#ffd60a', cardBg: '#1c1c1e', textMuted: '#8e8e93' };
      case 'neon_amber':
        return { bg: '#0d0700', primary: '#ffaa00', accent: '#ff6600', secondary: '#ffe58f', cardBg: '#211200', textMuted: '#9e6d38' };
      case 'aurora':
        return { bg: '#041019', primary: '#5efc82', accent: '#00d2ff', secondary: '#a685e2', cardBg: '#092131', textMuted: '#688c9f' };
      case 'minimal_mono':
        return { bg: '#000000', primary: '#ffffff', accent: '#cccccc', secondary: '#999999', cardBg: '#181818', textMuted: '#666666' };
      case 'forest_emerald':
        return { bg: '#041209', primary: '#2bf874', accent: '#72ffb2', secondary: '#c1ff72', cardBg: '#0b2614', textMuted: '#4a825b' };
      case 'sunset_orange':
      default:
        return { bg: '#100508', primary: '#ff5e36', accent: '#ff9500', secondary: '#ff2a6d', cardBg: '#240f16', textMuted: '#a56272' };
    }
  };

  // Render to 240x240 pixel canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const colors = getThemeColors();
    const W = 240;
    const H = 240;

    ctx.save();
    ctx.clearRect(0, 0, W, H);

    // 1. Background
    ctx.fillStyle = currentScreen === 'night_standby' ? '#000000' : colors.bg;
    ctx.fillRect(0, 0, W, H);

    // 2. Render Screen Specific UI
    if (currentScreen === 'big_bold_ultra') {
      renderBigBoldUltra(ctx, colors);
    } else if (currentScreen === 'big_typography_duo') {
      renderBigTypographyDuo(ctx, colors);
    } else if (currentScreen === 'big_sport_digital') {
      renderBigSportDigital(ctx, colors);
    } else if (currentScreen === 'clock_dashboard') {
      renderClock(ctx, colors);
    } else if (currentScreen === 'weather_station') {
      renderWeather(ctx, colors);
    } else if (currentScreen === 'home_assistant') {
      renderHomeAssistant(ctx, colors);
    } else if (currentScreen === 'pc_monitor') {
      renderPcMonitor(ctx, colors);
    } else if (currentScreen === 'candlestick') {
      renderCandlestick(ctx, colors);
    } else if (currentScreen === 'night_standby') {
      renderNightStandby(ctx);
    } else if (currentScreen === 'retro_cyber') {
      renderRetroCyber(ctx, colors);
    }

    // 3. Color Inversion Demonstration Simulation
    // If colorInversion is FALSE on ST7789 IPS, the picture looks inverted (negative white wash)
    if (!colorInversion) {
      const imgData = ctx.getImageData(0, 0, W, H);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 255 - data[i];         // R
        data[i + 1] = 255 - data[i + 1]; // G
        data[i + 2] = 255 - data[i + 2]; // B
      }
      ctx.putImageData(imgData, 0, 0);

      // Add a warning watermark
      ctx.fillStyle = 'rgba(255, 0, 0, 0.85)';
      ctx.fillRect(10, 8, 220, 30);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('INVON FALSE (INVERTED)', 120, 26);
    }

    ctx.restore();
  }, [currentScreen, theme, sensorData, colorInversion]);

  // Modern Big Watch Face 1: Big Bold Ultra (Apple Watch Ultra Inspired)
  const renderBigBoldUltra = (ctx: CanvasRenderingContext2D, colors: ReturnType<typeof getThemeColors>) => {
    const time = sensorData.time;
    const hours = String(time.getHours()).padStart(2, '0');
    const minutes = String(time.getMinutes()).padStart(2, '0');
    const seconds = time.getSeconds();
    const millis = time.getMilliseconds();
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const dateStr = `${dayNames[time.getDay()]} ${time.getDate()} ${monthNames[time.getMonth()]}`;

    // Outer Smooth Sweep Seconds Arc
    const smoothSec = seconds + millis / 1000;
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (smoothSec / 60) * 2 * Math.PI;

    ctx.beginPath();
    ctx.arc(120, 120, 114, 0, 2 * Math.PI);
    ctx.strokeStyle = colors.cardBg;
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(120, 120, 114, startAngle, endAngle);
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Top Pill: Date & Day
    ctx.fillStyle = colors.cardBg;
    roundRect(ctx, 45, 20, 150, 26, 13);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = colors.primary;
    ctx.font = '700 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(dateStr, 120, 37);

    // GIANT HIGH-CONTRAST TIME DISPLAY
    // Hour: Primary Vibrant Accent
    ctx.fillStyle = colors.primary;
    ctx.font = '800 64px "JetBrains Mono", "SF Pro Display", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(hours, 106, 116);

    // Colon
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(':', 119, 110);

    // Minute: Crisp White
    ctx.textAlign = 'left';
    ctx.fillText(minutes, 132, 116);

    // Boxed Seconds Badge on the right
    ctx.fillStyle = colors.cardBg;
    roundRect(ctx, 186, 96, 36, 26, 8);
    ctx.fill();
    ctx.fillStyle = colors.accent;
    ctx.font = '700 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(seconds).padStart(2, '0'), 204, 113);

    // Bottom Telemetry Pill
    ctx.fillStyle = colors.cardBg;
    roundRect(ctx, 28, 168, 184, 42, 21);
    ctx.fill();

    ctx.fillStyle = colors.secondary;
    ctx.font = '700 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${sensorData.temp.toFixed(1)}°C`, 48, 194);

    ctx.fillStyle = colors.primary;
    ctx.textAlign = 'right';
    ctx.fillText('WiFi Online', 194, 194);
  };

  // Modern Big Watch Face 2: Big Typography Duo (Nothing OS / Stacked Giant Numerals)
  const renderBigTypographyDuo = (ctx: CanvasRenderingContext2D, colors: ReturnType<typeof getThemeColors>) => {
    const time = sensorData.time;
    const hours = String(time.getHours()).padStart(2, '0');
    const minutes = String(time.getMinutes()).padStart(2, '0');
    const seconds = time.getSeconds();
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const dateStr = `${time.getDate()} ${monthNames[time.getMonth()]}`;

    // Left Vertical Seconds Bar
    const barH = (seconds / 60) * 190;
    ctx.fillStyle = colors.cardBg;
    roundRect(ctx, 14, 25, 6, 190, 3);
    ctx.fill();

    ctx.fillStyle = colors.primary;
    roundRect(ctx, 14, 215 - barH, 6, barH, 3);
    ctx.fill();

    // Stacked Giant Hours (Top)
    ctx.fillStyle = colors.primary;
    ctx.font = '900 78px "JetBrains Mono", "SF Pro Display", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(hours, 32, 94);

    // Stacked Giant Minutes (Bottom)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(minutes, 32, 186);

    // Right-side Modern Floating Badges
    // 1. Date Capsule
    ctx.fillStyle = colors.cardBg;
    roundRect(ctx, 150, 30, 74, 34, 10);
    ctx.fill();
    ctx.fillStyle = colors.accent;
    ctx.font = '700 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(dateStr, 187, 51);

    // 2. Temp Capsule
    ctx.fillStyle = colors.cardBg;
    roundRect(ctx, 150, 72, 74, 34, 10);
    ctx.fill();
    ctx.fillStyle = colors.secondary;
    ctx.font = '700 14px monospace';
    ctx.fillText(`${sensorData.temp.toFixed(0)}°C`, 187, 94);

    // 3. Status Capsule
    ctx.fillStyle = colors.cardBg;
    roundRect(ctx, 150, 114, 74, 34, 10);
    ctx.fill();
    ctx.fillStyle = colors.primary;
    ctx.font = '700 10px monospace';
    ctx.fillText('SYNC OK', 187, 135);
  };

  // Modern Big Watch Face 3: Big Sport Digital (Garmin / G-Shock Style Active)
  const renderBigSportDigital = (ctx: CanvasRenderingContext2D, colors: ReturnType<typeof getThemeColors>) => {
    const time = sensorData.time;
    const hours = String(time.getHours()).padStart(2, '0');
    const minutes = String(time.getMinutes()).padStart(2, '0');
    const seconds = String(time.getSeconds()).padStart(2, '0');

    // Day of Week Header Matrix [S M T W T F S]
    const dayIdx = time.getDay();
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    for (let i = 0; i < 7; i++) {
      const x = 24 + i * 28;
      if (i === dayIdx) {
        ctx.fillStyle = colors.accent;
        roundRect(ctx, x - 3, 14, 22, 22, 6);
        ctx.fill();
        ctx.fillStyle = '#000000';
      } else {
        ctx.fillStyle = colors.textMuted;
      }
      ctx.font = '700 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(days[i], x + 8, 29);
    }

    // Main Big Digital Time Frame
    ctx.fillStyle = colors.cardBg;
    roundRect(ctx, 16, 46, 208, 88, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = colors.primary;
    ctx.font = '700 52px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${hours}:${minutes}`, 28, 110);

    // Boxed Split Seconds
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(ctx, 168, 58, 44, 32, 6);
    ctx.fill();
    ctx.fillStyle = colors.accent;
    ctx.font = '700 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(seconds, 190, 80);

    // Lower 3-Box Telemetry Cards
    const boxW = 64;
    const boxH = 74;

    // Box 1: Temp
    ctx.fillStyle = colors.cardBg;
    roundRect(ctx, 16, 148, boxW, boxH, 10);
    ctx.fill();
    ctx.fillStyle = colors.textMuted;
    ctx.font = '600 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TEMP', 48, 165);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 18px monospace';
    ctx.fillText(`${sensorData.temp.toFixed(0)}°`, 48, 192);
    ctx.fillStyle = colors.primary;
    ctx.font = '10px sans-serif';
    ctx.fillText('C', 48, 210);

    // Box 2: Humidity
    ctx.fillStyle = colors.cardBg;
    roundRect(ctx, 88, 148, boxW, boxH, 10);
    ctx.fill();
    ctx.fillStyle = colors.textMuted;
    ctx.font = '600 9px sans-serif';
    ctx.fillText('HUM', 120, 165);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 18px monospace';
    ctx.fillText(`${sensorData.humidity}`, 120, 192);
    ctx.fillStyle = colors.secondary;
    ctx.font = '10px sans-serif';
    ctx.fillText('%', 120, 210);

    // Box 3: Power
    ctx.fillStyle = colors.cardBg;
    roundRect(ctx, 160, 148, boxW, boxH, 10);
    ctx.fill();
    ctx.fillStyle = colors.textMuted;
    ctx.font = '600 9px sans-serif';
    ctx.fillText('POWER', 192, 165);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 16px monospace';
    ctx.fillText(`${sensorData.haPowerWatts}`, 192, 192);
    ctx.fillStyle = colors.accent;
    ctx.font = '10px sans-serif';
    ctx.fillText('W', 192, 210);
  };

  // Screen 1: GeekMagic / WatchOS Style Clock Dashboard
  const renderClock = (ctx: CanvasRenderingContext2D, colors: ReturnType<typeof getThemeColors>) => {
    const time = sensorData.time;
    const hours = String(time.getHours()).padStart(2, '0');
    const minutes = String(time.getMinutes()).padStart(2, '0');
    const seconds = time.getSeconds();
    const millis = time.getMilliseconds();
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const dateStr = `${dayNames[time.getDay()]} ${time.getDate()} ${monthNames[time.getMonth()]}`;

    // Outer Smooth Seconds Arc (114px radius)
    const smoothSec = seconds + millis / 1000;
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (smoothSec / 60) * 2 * Math.PI;

    // Track
    ctx.beginPath();
    ctx.arc(120, 120, 112, 0, 2 * Math.PI);
    ctx.strokeStyle = colors.cardBg;
    ctx.lineWidth = 6;
    ctx.stroke();

    // Progress Arc
    ctx.beginPath();
    ctx.arc(120, 120, 112, startAngle, endAngle);
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Top Status Header (Date & WiFi icon)
    ctx.fillStyle = colors.textMuted;
    ctx.font = '600 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(dateStr, 120, 44);

    // WiFi & Battery dots
    ctx.fillStyle = colors.primary;
    ctx.beginPath();
    ctx.arc(42, 40, 3.5, 0, 2 * Math.PI);
    ctx.fill();

    ctx.fillStyle = colors.secondary;
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('98%', 198, 43);

    // Big Crisp Time: HH:MM
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 58px "JetBrains Mono", "SF Pro Display", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${hours}:${minutes}`, 108, 122);

    // Small Seconds Indicator
    ctx.fillStyle = colors.primary;
    ctx.font = '700 20px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(String(seconds).padStart(2, '0'), 182, 122);

    // Bottom Stats Pill Card
    ctx.fillStyle = colors.cardBg;
    roundRect(ctx, 32, 168, 176, 40, 20);
    ctx.fill();

    // Pill border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Temp left
    ctx.fillStyle = colors.secondary;
    ctx.font = '700 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${sensorData.temp.toFixed(1)}°C`, 52, 192);

    // Humidity right
    ctx.fillStyle = colors.accent;
    ctx.textAlign = 'right';
    ctx.fillText(`${sensorData.humidity}% RH`, 188, 192);
  };

  // Screen 2: Weather Station
  const renderWeather = (ctx: CanvasRenderingContext2D, colors: ReturnType<typeof getThemeColors>) => {
    // City
    ctx.fillStyle = colors.accent;
    ctx.font = '700 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DHAKA • WEATHER', 120, 32);

    // Temperature
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 48px sans-serif';
    ctx.fillText(`${sensorData.temp.toFixed(1)}°`, 120, 88);

    // Condition
    ctx.fillStyle = colors.textMuted;
    ctx.font = '500 13px sans-serif';
    ctx.fillText('Partly Cloudy • Wind 14 km/h', 120, 114);

    // 2-Column Sensor Cards
    // Left: Humidity
    ctx.fillStyle = colors.cardBg;
    roundRect(ctx, 22, 134, 94, 52, 12);
    ctx.fill();

    ctx.fillStyle = colors.primary;
    ctx.font = '700 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${sensorData.humidity}%`, 69, 160);
    ctx.fillStyle = colors.textMuted;
    ctx.font = '600 9px sans-serif';
    ctx.fillText('HUMIDITY', 69, 175);

    // Right: Pressure
    ctx.fillStyle = colors.cardBg;
    roundRect(ctx, 124, 134, 94, 52, 12);
    ctx.fill();

    ctx.fillStyle = colors.secondary;
    ctx.font = '700 18px monospace';
    ctx.fillText(`${sensorData.pressure}`, 171, 160);
    ctx.fillStyle = colors.textMuted;
    ctx.font = '600 9px sans-serif';
    ctx.fillText('HPA BARO', 171, 175);

    // Bottom Forecast Pill
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    roundRect(ctx, 22, 196, 196, 28, 14);
    ctx.fill();

    ctx.fillStyle = colors.textMuted;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Tomorrow: 28°C / 21°C  Rain 20%', 120, 214);
  };

  // Screen 3: Home Assistant Widget Dashboard (Compatible with GeekMagic HACS!)
  const renderHomeAssistant = (ctx: CanvasRenderingContext2D, colors: ReturnType<typeof getThemeColors>) => {
    // Top Bar
    ctx.fillStyle = colors.primary;
    ctx.font = '700 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HOME ASSISTANT • LIVE', 120, 28);

    // Card 1: Main Power Consumption
    ctx.fillStyle = colors.cardBg;
    roundRect(ctx, 18, 42, 204, 76, 12);
    ctx.fill();

    ctx.fillStyle = colors.secondary;
    ctx.font = '600 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('TOTAL HOME POWER', 32, 62);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 32px monospace';
    ctx.fillText(`${sensorData.haPowerWatts} W`, 32, 98);

    ctx.fillStyle = colors.primary;
    ctx.font = '600 11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('• REALTIME', 206, 62);

    // Card 2: Living Room Lights & HVAC
    ctx.fillStyle = colors.cardBg;
    roundRect(ctx, 18, 128, 204, 94, 12);
    ctx.fill();

    ctx.fillStyle = colors.accent;
    ctx.font = '600 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('LIVING ROOM', 32, 148);

    // State Row
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 15px sans-serif';
    ctx.fillText('Ceiling Light: ON', 32, 172);

    ctx.fillStyle = colors.textMuted;
    ctx.font = '12px sans-serif';
    ctx.fillText(`Target: 24.0°C (Current: ${sensorData.haLivingTemp}°C)`, 32, 194);

    // Quick toggle switch representation
    ctx.fillStyle = colors.primary;
    roundRect(ctx, 168, 160, 38, 20, 10);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(196, 170, 7, 0, 2 * Math.PI);
    ctx.fill();
  };

  // Screen 4: PC Hardware Monitor (AIDA64 / LibreHardwareMonitor style)
  const renderPcMonitor = (ctx: CanvasRenderingContext2D, colors: ReturnType<typeof getThemeColors>) => {
    ctx.fillStyle = colors.primary;
    ctx.font = '700 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HARDWARE TELEMETRY', 120, 24);

    // CPU Section
    renderBar(ctx, 20, 40, 200, 12, sensorData.cpuUsage, colors.primary, 'CPU LOAD', `${Math.round(sensorData.cpuUsage)}%`, colors);

    // GPU Section
    renderBar(ctx, 20, 78, 200, 12, sensorData.gpuUsage, colors.accent, 'GPU LOAD', `${Math.round(sensorData.gpuUsage)}%`, colors);

    // RAM Section
    renderBar(ctx, 20, 116, 200, 12, sensorData.ramUsage, colors.secondary, 'RAM USAGE', `${Math.round(sensorData.ramUsage)}%`, colors);

    // Bottom CPU Temp Big Pill
    ctx.fillStyle = colors.cardBg;
    roundRect(ctx, 20, 154, 200, 68, 12);
    ctx.fill();

    ctx.fillStyle = '#ff6b6b';
    ctx.font = '700 30px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${sensorData.cpuTemp.toFixed(1)} °C`, 120, 188);

    ctx.fillStyle = colors.textMuted;
    ctx.font = '600 10px sans-serif';
    ctx.fillText('CPU PACKAGE TEMPERATURE', 120, 208);
  };

  // Screen 5: Candlestick Crypto / Stock Chart
  const renderCandlestick = (ctx: CanvasRenderingContext2D, colors: ReturnType<typeof getThemeColors>) => {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('BTC / USDT', 22, 28);

    ctx.fillStyle = '#00e676';
    ctx.font = '700 11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('+3.45%', 218, 28);

    ctx.fillStyle = '#00e676';
    ctx.font = '700 24px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`$${sensorData.cryptoPrice.toLocaleString()}`, 22, 58);

    // Candlesticks Simulation
    const candles = [
      { o: 62400, h: 63100, l: 62100, c: 62900 },
      { o: 62900, h: 63400, l: 62700, c: 63200 },
      { o: 63200, h: 63300, l: 62600, c: 62800 },
      { o: 62800, h: 63600, l: 62750, c: 63500 },
      { o: 63500, h: 64200, l: 63300, c: 64100 },
      { o: 64100, h: 64400, l: 63900, c: 64250 },
      { o: 64250, h: 65100, l: 64100, c: 64820 },
    ];

    const minP = 62000;
    const maxP = 65500;
    const chartY = 80;
    const chartH = 110;
    const candleW = 16;
    const step = 28;

    candles.forEach((c, idx) => {
      const x = 32 + idx * step;
      const isGreen = c.c >= c.o;
      const col = isGreen ? '#00e676' : '#ff5252';

      const yHigh = chartY + chartH - ((c.h - minP) / (maxP - minP)) * chartH;
      const yLow = chartY + chartH - ((c.l - minP) / (maxP - minP)) * chartH;
      const yOpen = chartY + chartH - ((c.o - minP) / (maxP - minP)) * chartH;
      const yClose = chartY + chartH - ((c.c - minP) / (maxP - minP)) * chartH;

      // Wick
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + candleW / 2, yHigh);
      ctx.lineTo(x + candleW / 2, yLow);
      ctx.stroke();

      // Body
      ctx.fillStyle = col;
      const bodyTop = Math.min(yOpen, yClose);
      const bodyH = Math.max(3, Math.abs(yClose - yOpen));
      ctx.fillRect(x, bodyTop, candleW, bodyH);
    });

    // Timeframe tag
    ctx.fillStyle = colors.textMuted;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('1H Interval • 240x240 High DPI Mode', 120, 218);
  };

  // Screen 6: Night Standby Clock (Low Brightness, Red Shifted)
  const renderNightStandby = (ctx: CanvasRenderingContext2D) => {
    const time = sensorData.time;
    const hours = String(time.getHours()).padStart(2, '0');
    const minutes = String(time.getMinutes()).padStart(2, '0');

    // Deep Blood Red Night Shift to preserve melatonin / dark room eyes
    ctx.fillStyle = '#ff2222';
    ctx.font = '700 64px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${hours}:${minutes}`, 120, 130);

    ctx.fillStyle = '#881111';
    ctx.font = '600 13px sans-serif';
    ctx.fillText('NIGHT STANDBY • 18% PWM', 120, 165);
  };

  // Screen 7: Retro Cyberpunk Terminal
  const renderRetroCyber = (ctx: CanvasRenderingContext2D, colors: ReturnType<typeof getThemeColors>) => {
    // Grid Lines
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= 240; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 240);
      ctx.stroke();
    }
    for (let y = 0; y <= 240; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(240, y);
      ctx.stroke();
    }

    ctx.fillStyle = colors.primary;
    ctx.font = '700 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('> ESP32-C3 SYS:OK', 20, 32);
    ctx.fillText('> ST7789 240x240', 20, 50);

    ctx.fillStyle = colors.accent;
    ctx.font = '700 42px monospace';
    ctx.textAlign = 'center';
    const time = sensorData.time;
    ctx.fillText(`${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`, 120, 115);

    // Memory status
    ctx.fillStyle = colors.secondary;
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('HEAP FREE: 284 KB', 20, 155);
    ctx.fillText('SPI CLOCK: 40 MHz', 20, 175);
    ctx.fillText('DMA CHAN : 1 (Active)', 20, 195);
    ctx.fillText('INVON    : TRUE (0x21)', 20, 215);
  };

  // Utility to render bar
  const renderBar = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    pct: number,
    fillColor: string,
    label: string,
    valStr: string,
    colors: ReturnType<typeof getThemeColors>
  ) => {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '600 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, x, y - 5);

    ctx.fillStyle = fillColor;
    ctx.textAlign = 'right';
    ctx.fillText(valStr, x + w, y - 5);

    // Track
    ctx.fillStyle = colors.cardBg;
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fill();

    // Fill
    const fillW = Math.max(h, (pct / 100) * w);
    ctx.fillStyle = fillColor;
    roundRect(ctx, x, y, fillW, h, h / 2);
    ctx.fill();
  };

  // Helper for round rect
  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Handle BOOT button press simulation
  const handleButtonDown = () => {
    setIsButtonPressed(true);
    buttonTimerRef.current = setTimeout(() => {
      setButtonMessage('SoftAP Setup Mode Triggered! (192.168.4.1)');
      setTimeout(() => setButtonMessage(null), 3000);
    }, 2500);
  };

  const handleButtonUp = () => {
    setIsButtonPressed(false);
    if (buttonTimerRef.current) {
      clearTimeout(buttonTimerRef.current);
      buttonTimerRef.current = null;
    }
    // Cycle screen on short release
    const screens: ScreenMode[] = [
      'big_bold_ultra',
      'big_typography_duo',
      'big_sport_digital',
      'clock_dashboard',
      'weather_station',
      'home_assistant',
      'pc_monitor',
      'candlestick',
      'night_standby',
      'retro_cyber'
    ];
    const nextIdx = (screens.indexOf(currentScreen) + 1) % screens.length;
    onScreenChange(screens[nextIdx]);
  };

  return (
    <div className="flex flex-col items-center bg-slate-950/80 border border-slate-800/80 rounded-2xl p-6 shadow-2xl backdrop-blur-md">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="font-bold text-slate-100 text-sm tracking-wide uppercase">
            ST7789 240×240 IPS Live Simulator
          </h3>
          <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono">
            GMT130 V1.0
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGlassReflection(!showGlassReflection)}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
              showGlassReflection 
                ? 'bg-cyan-950/60 border-cyan-800 text-cyan-300' 
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            Glass Reflection
          </button>
          <button
            onClick={() => setShowBezel(!showBezel)}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
              showBezel 
                ? 'bg-indigo-950/60 border-indigo-800 text-indigo-300' 
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            Housing Case
          </button>
        </div>
      </div>

      {/* Screen Frame Container */}
      <div className="relative flex flex-col items-center justify-center my-2">
        {/* Outer Desktop Device Shell (GeekMagic SmallTV / SuperMini Gadget Shell) */}
        <div 
          className={`relative transition-all duration-300 ${
            showBezel 
              ? 'p-6 rounded-3xl bg-gradient-to-b from-slate-800 via-slate-900 to-black shadow-[0_20px_50px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.2)] border-2 border-slate-700/60'
              : 'p-1 rounded-lg bg-slate-900 border border-slate-800'
          }`}
        >
          {/* Acrylic / Bezel Label */}
          {showBezel && (
            <div className="absolute top-2.5 left-0 right-0 flex justify-between px-6 text-[9px] font-mono text-slate-500 uppercase tracking-widest pointer-events-none">
              <span>ESP32-C3</span>
              <span>ST7789 IPS</span>
            </div>
          )}

          {/* Screen Glass Container */}
          <div 
            className="relative overflow-hidden rounded-xl bg-black shadow-inner border border-slate-800"
            style={{ 
              width: '240px', 
              height: '240px',
              opacity: Math.max(0.12, brightness / 255)
            }}
          >
            {/* HTML5 Canvas */}
            <canvas
              ref={canvasRef}
              width={240}
              height={240}
              className="w-full h-full block image-rendering-pixelated"
            />

            {/* Specular IPS Glass Reflection Overlay */}
            {showGlassReflection && (
              <div 
                className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-transparent via-white/5 to-white/10"
                style={{
                  clipPath: 'polygon(0 0, 100% 0, 60% 100%, 0% 100%)'
                }}
              />
            )}
          </div>

          {/* Bottom Physical SuperMini BOOT Button Simulator */}
          {showBezel && (
            <div className="mt-4 flex flex-col items-center">
              <button
                onMouseDown={handleButtonDown}
                onMouseUp={handleButtonUp}
                onTouchStart={handleButtonDown}
                onTouchEnd={handleButtonUp}
                className={`group flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-mono border transition-all ${
                  isButtonPressed
                    ? 'bg-amber-500 text-black border-amber-400 scale-95 shadow-[0_0_15px_rgba(245,158,11,0.6)]'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-600 shadow-md'
                }`}
                title="Short click: Cycle Screen. Hold 3s: Trigger AP Web Setup"
              >
                <div className={`w-2 h-2 rounded-full ${isButtonPressed ? 'bg-black' : 'bg-amber-400'}`} />
                <span>GPIO 9 (BOOT BTN)</span>
              </button>
              <span className="text-[10px] text-slate-500 mt-1">Click to cycle screen • Hold 3s for AP setup</span>
            </div>
          )}
        </div>

        {/* Button Action Feedback Banner */}
        {buttonMessage && (
          <div className="absolute top-2 z-30 bg-amber-500 text-black font-bold text-xs px-4 py-2 rounded-full shadow-lg animate-bounce">
            {buttonMessage}
          </div>
        )}
      </div>

      {/* Screen Mode & Control Tabs */}
      <div className="w-full mt-5 space-y-4">
        {/* Screen selector pills */}
        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
            Simulated Screen Modes
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { id: 'big_bold_ultra', label: 'Big Ultra Watch', icon: Watch, highlight: true },
              { id: 'big_typography_duo', label: 'Big Typo Duo', icon: Layers, highlight: true },
              { id: 'big_sport_digital', label: 'Big Sport LCD', icon: Zap, highlight: true },
              { id: 'clock_dashboard', label: 'Clock Arc', icon: RefreshCw },
              { id: 'weather_station', label: 'Weather', icon: Sun },
              { id: 'home_assistant', label: 'Home Assistant', icon: Wifi },
              { id: 'pc_monitor', label: 'PC Stats', icon: Cpu },
              { id: 'candlestick', label: 'Crypto/Stocks', icon: Activity },
              { id: 'night_standby', label: 'Night Standby', icon: Moon },
              { id: 'retro_cyber', label: 'Retro Cyber', icon: Sparkles },
            ].map(item => {
              const Icon = item.icon;
              const isActive = currentScreen === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onScreenChange(item.id as ScreenMode)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium border transition-all ${
                    isActive
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30 font-bold'
                      : item.highlight
                      ? 'bg-amber-950/30 border-amber-800/60 text-amber-300 hover:bg-amber-900/40'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Display Hardware Settings: Brightness & Color Inversion */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
          {/* Backlight PWM (Pin 7 / BLK) */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="text-slate-300 font-medium flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                Backlight PWM (Pin 7 / BLK)
              </span>
              <span className="font-mono text-amber-400 font-bold">
                {Math.round((brightness / 255) * 100)}% ({brightness}/255)
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={255}
              value={brightness}
              onChange={e => onBrightnessChange(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
          </div>

          {/* Inversion Test (Crucial for ST7789) */}
          <div className="flex flex-col justify-center">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-cyan-400" />
                ST7789 Color Inversion (0x21)
              </span>
              <button
                onClick={onToggleInversion}
                className={`text-xs font-mono font-bold px-2.5 py-1 rounded-md border transition-all ${
                  colorInversion
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                    : 'bg-rose-950 text-rose-300 border-rose-800 animate-pulse'
                }`}
              >
                {colorInversion ? 'INVON (Correct)' : 'INVOFF (Glitch)'}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {colorInversion 
                ? '✓ Normal IPS colors. Blacks are true black.' 
                : '⚠ Colors inverted! Negative washed-out photo effect.'}
            </p>
          </div>
        </div>

        {/* Color Themes */}
        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
            Color Palette Theme
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'cyberpunk', name: 'Cyberpunk Neon', dot: '#00ffcc' },
              { id: 'watchos', name: 'Apple WatchOS', dot: '#30d158' },
              { id: 'sunset_orange', name: 'Sunset Amber', dot: '#ff5e36' },
              { id: 'aurora', name: 'Nordic Aurora', dot: '#00d2ff' },
              { id: 'forest_emerald', name: 'Forest Emerald', dot: '#2bf874' },
              { id: 'minimal_mono', name: 'Minimalist Mono', dot: '#ffffff' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => onThemeChange(t.id as DisplayTheme)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all ${
                  theme === t.id
                    ? 'bg-slate-800 border-slate-600 text-white font-semibold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.dot }} />
                <span>{t.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
