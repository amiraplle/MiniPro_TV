import { useState } from 'react';
import { FirmwareConfig } from '../types';
import { AlertTriangle, CheckCircle2, Info, Zap, ShieldCheck } from 'lucide-react';

interface PinoutDiagramProps {
  config: FirmwareConfig;
}

export default function PinoutDiagram({ config }: PinoutDiagramProps) {
  const [selectedPin, setSelectedPin] = useState<number | null>(null);

  const pinMappings = [
    {
      pinNum: 1,
      name: 'GND',
      desc: 'System Ground (0V reference)',
      c3Target: 'GND',
      wireColor: '#71717a', // Slate
      badge: 'Power',
      details: 'Connect directly to any GND pin on the ESP32-C3 Super Mini.'
    },
    {
      pinNum: 2,
      name: 'VCC',
      desc: '3.3V Logic & Panel Supply',
      c3Target: '3V3',
      wireColor: '#ef4444', // Red
      badge: 'Power',
      details: 'Connect to 3V3 on the ESP32-C3 Super Mini. (Do NOT connect directly to 5V unless module has dedicated LDO).'
    },
    {
      pinNum: 3,
      name: 'SCL',
      desc: 'SPI Clock (SCLK / SCK)',
      c3Target: `GPIO ${config.pinScl}`,
      wireColor: '#f59e0b', // Amber
      badge: 'FSPI Clock',
      details: `Hardware SPI Clock line. Configured to run up to ${config.spiFrequencyMhz}MHz stable write clock.`
    },
    {
      pinNum: 4,
      name: 'SDA',
      desc: 'SPI Data Output (MOSI / DIN)',
      c3Target: `GPIO ${config.pinSda}`,
      wireColor: '#3b82f6', // Blue
      badge: 'FSPI MOSI',
      details: 'Hardware SPI MOSI line. Transmits pixel buffer bursts via high-speed DMA.'
    },
    {
      pinNum: 5,
      name: 'RES',
      desc: 'Hardware Reset (RST)',
      c3Target: `GPIO ${config.pinRes}`,
      wireColor: '#10b981', // Emerald
      badge: 'Control',
      details: 'Active LOW display controller hardware reset. Driven during LovyanGFX panel init sequence.'
    },
    {
      pinNum: 6,
      name: 'DC',
      desc: 'Data / Command Select (A0)',
      c3Target: `GPIO ${config.pinDc}`,
      wireColor: '#8b5cf6', // Violet
      badge: 'Control',
      details: 'HIGH = Data register, LOW = Command register. Toggled by SPI hardware engine.'
    },
    {
      pinNum: 7,
      name: 'BLK',
      desc: 'Backlight PWM Dimming (LED)',
      c3Target: `GPIO ${config.pinBlk}`,
      wireColor: '#ec4899', // Pink
      badge: 'PWM Dimming',
      details: 'PWM Backlight line (Active HIGH). Uses ESP32-C3 LEDC peripheral at 1.2 kHz for smooth flicker-free dimming (0-255).'
    }
  ];

  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6 pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            Hardware Wiring Guide: ESP32-C3 Super Mini ↔ ST7789 GMT130 V1.0
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Exact pin mapping verified to avoid USB CDC collisions and floating CS lockups.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800 self-start sm:self-auto">
          <ShieldCheck className="w-3.5 h-3.5" />
          Hardware Verified
        </span>
      </div>

      {/* Critical Hardware Note on Missing CS Pin */}
      <div className="mb-6 p-4 rounded-xl bg-amber-950/40 border border-amber-800/80 text-amber-200">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1.5">
            <p className="font-bold text-amber-300">
              Crucial Notice: Why the GMT130 V1.0 7-Pin Module has NO "CS" Pin
            </p>
            <p className="text-amber-200/90 leading-relaxed">
              On the <strong>ST7789 GMT130 V1.0</strong> 7-pin breakout, Pin 7 is labeled <strong>BLK</strong> (Backlight control), 
              <strong>NOT CS</strong>. The Chip Select (CS) line is hardwired directly to Ground (GND) on the PCB substrate.
            </p>
            <p className="text-amber-200/80 font-mono text-[11px]">
              👉 Why blind code fails: Generic ST7789 libraries expect a CS pin toggle. In our firmware, we configure 
              <code className="bg-amber-900/60 px-1.5 py-0.5 rounded text-amber-300 font-bold ml-1">pin_cs = -1</code> so the driver never halts waiting for an unconnected CS pin.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Visual Wiring Scheme */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Left: ST7789 GMT130 Pinout Column */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                1.3" ST7789 Display (GMT130 V1.0)
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                7-PIN HEADER
              </span>
            </div>

            <div className="space-y-2">
              {pinMappings.map(pin => {
                const isSelected = selectedPin === pin.pinNum;
                return (
                  <div
                    key={pin.pinNum}
                    onMouseEnter={() => setSelectedPin(pin.pinNum)}
                    onMouseLeave={() => setSelectedPin(null)}
                    onClick={() => setSelectedPin(pin.pinNum)}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800 border-indigo-500 shadow-md ring-1 ring-indigo-500'
                        : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center font-mono font-bold text-[11px] text-slate-300">
                        {pin.pinNum}
                      </span>
                      <span className="font-bold font-mono text-slate-100 text-sm">
                        {pin.name}
                      </span>
                      <span className="text-[11px] text-slate-400 hidden sm:inline">
                        ({pin.desc})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2.5 h-2.5 rounded-full shadow-sm"
                        style={{ backgroundColor: pin.wireColor }}
                      />
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                        {pin.badge}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>Hover or tap any pin to highlight its target on the C3 Super Mini.</span>
          </div>
        </div>

        {/* Right: ESP32-C3 Super Mini Target Pinout */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                ESP32-C3 Super Mini Board
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                RISC-V 160MHz
              </span>
            </div>

            <div className="space-y-2">
              {pinMappings.map(pin => {
                const isSelected = selectedPin === pin.pinNum;
                return (
                  <div
                    key={pin.pinNum}
                    onMouseEnter={() => setSelectedPin(pin.pinNum)}
                    onMouseLeave={() => setSelectedPin(null)}
                    onClick={() => setSelectedPin(pin.pinNum)}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800 border-indigo-500 shadow-md ring-1 ring-indigo-500'
                        : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: pin.wireColor }}
                      />
                      <span className="text-slate-400 text-[11px]">Connects to:</span>
                      <span className="font-bold font-mono text-emerald-400 text-sm">
                        {pin.c3Target}
                      </span>
                    </div>

                    <span className="text-[11px] text-slate-400 font-mono">
                      Wire {pin.pinNum}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reserved Pins Warning */}
          <div className="mt-4 pt-3 border-t border-slate-800 space-y-1">
            <p className="text-[11px] text-rose-400 font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Do NOT use GPIO 18 or GPIO 19!
            </p>
            <p className="text-[10px] text-slate-500 leading-normal">
              GPIO 18 (USB D-) and GPIO 19 (USB D+) are used by the Super Mini's on-chip native USB CDC controller. 
              Connecting display pins to GPIO 18/19 will disconnect your USB computer port!
            </p>
          </div>
        </div>
      </div>

      {/* Selected Pin Details Callout */}
      {selectedPin && (
        <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-800 text-xs text-indigo-200 animate-fadeIn">
          <div className="flex items-center gap-2 font-bold text-indigo-300 mb-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>
              Pin {selectedPin}: {pinMappings[selectedPin - 1].name} → {pinMappings[selectedPin - 1].c3Target}
            </span>
          </div>
          <p>{pinMappings[selectedPin - 1].details}</p>
        </div>
      )}
    </div>
  );
}
