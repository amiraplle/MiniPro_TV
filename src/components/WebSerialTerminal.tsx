import { useState, useEffect, useRef } from 'react';
import { Terminal, Usb, Play, RefreshCw, Send, CheckCircle2, AlertCircle, Wifi, Sliders } from 'lucide-react';

export default function WebSerialTerminal() {
  const [isConnected, setIsConnected] = useState(false);
  const [baudRate, setBaudRate] = useState(115200);
  const [inputCmd, setInputCmd] = useState('');
  const [logs, setLogs] = useState<string[]>([
    '[INIT] ESP32-C3 Super Mini Web Serial Monitor Ready.',
    '[INFO] Baud rate: 115200 (Default for ESP32-C3 native USB CDC).',
    '[HINT] Connect your C3 Super Mini via USB-C to inspect real-time boot logs or test display commands.'
  ]);
  const [isSupported, setIsSupported] = useState(true);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  // Serial port references
  const portRef = useRef<any>(null);
  const readerRef = useRef<any>(null);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && !('serial' in navigator)) {
      setIsSupported(false);
    }
  }, []);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev.slice(-150), msg]);
  };

  const connectSerial = async () => {
    if (!('serial' in navigator)) {
      addLog('[ERROR] Web Serial API is not supported in this browser. Use Chrome or Edge.');
      return;
    }

    try {
      addLog('[SERIAL] Requesting USB Port for ESP32-C3 Super Mini...');
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate });
      portRef.current = port;
      setIsConnected(true);
      addLog(`[CONNECTED] Serial port opened at ${baudRate} baud.`);

      readLoop(port);
    } catch (err: any) {
      addLog(`[ERROR] Connection failed: ${err.message || err}`);
    }
  };

  const disconnectSerial = async () => {
    try {
      if (readerRef.current) {
        await readerRef.current.cancel();
      }
      if (portRef.current) {
        await portRef.current.close();
      }
      setIsConnected(false);
      portRef.current = null;
      readerRef.current = null;
      addLog('[DISCONNECTED] Serial port closed.');
    } catch (err: any) {
      addLog(`[ERROR] Disconnect error: ${err.message || err}`);
    }
  };

  const readLoop = async (port: any) => {
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();
    readerRef.current = reader;

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          const lines = value.split('\n');
          lines.forEach((l: string) => {
            if (l.trim().length > 0) {
              addLog(`[ESP32] ${l.trim()}`);
            }
          });
        }
      }
    } catch (error) {
      addLog(`[READ ERROR] ${error}`);
    } finally {
      reader.releaseLock();
    }
  };

  const sendCommand = async (cmd: string) => {
    if (!cmd.trim()) return;
    addLog(`[TX] > ${cmd}`);

    if (isConnected && portRef.current) {
      try {
        const textEncoder = new TextEncoder();
        const writer = portRef.current.writable.getWriter();
        await writer.write(textEncoder.encode(cmd + '\n'));
        writer.releaseLock();
      } catch (err: any) {
        addLog(`[TX ERROR] ${err.message || err}`);
      }
    } else {
      // Simulate virtual response when not physically connected
      setTimeout(() => {
        if (cmd.startsWith('BRIGHTNESS:')) {
          addLog(`[ESP32-SIM] PWM duty updated: ${cmd.split(':')[1]}/255 (1.2kHz LEDC channel 0)`);
        } else if (cmd === 'SCREEN:NEXT') {
          addLog('[ESP32-SIM] Screen mode cycled: SCREEN_WEATHER');
        } else if (cmd === 'WIFI:STATUS') {
          addLog('[ESP32-SIM] WiFi: Connected to "MyHomeWiFi", IP: 192.168.1.142, RSSI: -58dBm');
        } else if (cmd === 'MEM:CHECK') {
          addLog('[ESP32-SIM] Heap Total: 400 KB, Free: 284.2 KB, Largest Block: 245 KB, DMA Canvas: 115 KB');
        } else {
          addLog(`[ESP32-SIM] Command acknowledged: "${cmd}"`);
        }
      }, 150);
    }
    setInputCmd('');
  };

  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-emerald-400" />
            Web Serial Console & Live Hardware Diagnostics
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Connect your ESP32-C3 Super Mini via USB-C to inspect real-time logs and control the ST7789 display.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg text-xs text-slate-300">
            <span>Baud:</span>
            <select
              value={baudRate}
              onChange={e => setBaudRate(Number(e.target.value))}
              disabled={isConnected}
              className="bg-transparent text-emerald-400 font-mono font-bold focus:outline-none"
            >
              <option value={115200}>115200</option>
              <option value={921600}>921600</option>
              <option value={460800}>460800</option>
            </select>
          </div>

          <button
            onClick={isConnected ? disconnectSerial : connectSerial}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              isConnected
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/30'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30'
            }`}
          >
            <Usb className="w-4 h-4" />
            <span>{isConnected ? 'Disconnect USB' : 'Connect ESP32-C3'}</span>
          </button>
        </div>
      </div>

      {/* Browser Support Notice */}
      {!isSupported && (
        <div className="mb-4 p-3 rounded-xl bg-amber-950/40 border border-amber-800 text-xs text-amber-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            Web Serial is only supported on Chromium browsers (Google Chrome, Microsoft Edge, Opera). Virtual simulation mode is active.
          </span>
        </div>
      )}

      {/* Quick Test Command Buttons */}
      <div className="mb-4">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
          Quick Diagnostic Command Triggers
        </span>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Cycle Screen', cmd: 'SCREEN:NEXT', icon: RefreshCw },
            { label: 'Set Brightness 100%', cmd: 'BRIGHTNESS:255', icon: Sliders },
            { label: 'Set Brightness 25%', cmd: 'BRIGHTNESS:64', icon: Sliders },
            { label: 'WiFi Status', cmd: 'WIFI:STATUS', icon: Wifi },
            { label: 'SRAM / DMA Check', cmd: 'MEM:CHECK', icon: CheckCircle2 },
          ].map(b => {
            const Icon = b.icon;
            return (
              <button
                key={b.cmd}
                onClick={() => sendCommand(b.cmd)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-all font-mono"
              >
                <Icon className="w-3.5 h-3.5 text-indigo-400" />
                <span>{b.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Terminal Log Box */}
      <div className="rounded-xl overflow-hidden border border-slate-800 bg-black/90 font-mono text-xs">
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-slate-400">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
            <span>Serial Console (115200 8-N-1)</span>
          </div>
          <button
            onClick={() => setLogs([])}
            className="text-[11px] text-slate-500 hover:text-slate-300"
          >
            Clear Log
          </button>
        </div>

        <div 
          ref={logContainerRef}
          className="p-4 h-64 overflow-y-auto space-y-1 text-slate-300 select-text"
        >
          {logs.map((log, i) => (
            <div 
              key={i} 
              className={`leading-relaxed ${
                log.includes('[ERROR]') 
                  ? 'text-rose-400' 
                  : log.includes('[CONNECTED]') 
                  ? 'text-emerald-400 font-bold'
                  : log.includes('[TX]')
                  ? 'text-cyan-400'
                  : log.includes('[ESP32]')
                  ? 'text-amber-200'
                  : 'text-slate-400'
              }`}
            >
              {log}
            </div>
          ))}
        </div>

        {/* Input Bar */}
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            sendCommand(inputCmd);
          }}
          className="flex items-center border-t border-slate-800 bg-slate-950 px-3 py-2"
        >
          <span className="text-slate-500 mr-2 font-bold">&gt;</span>
          <input
            type="text"
            value={inputCmd}
            onChange={e => setInputCmd(e.target.value)}
            placeholder="Type serial command (e.g. BRIGHTNESS:200, SCREEN:NEXT) and press Enter..."
            className="flex-1 bg-transparent text-slate-200 focus:outline-none placeholder-slate-600 text-xs"
          />
          <button
            type="submit"
            className="p-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition-all ml-2"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
