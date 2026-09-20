import { useState } from 'react';
import { FirmwareConfig } from '../types';
import { 
  generateLovyanGfxHeader, 
  generateArduinoIno, 
  generatePlatformIoIni, 
  generateTftEspiUserSetup, 
  generateReadme,
  generateGithubWorkflow,
  generateMergeBinScript
} from '../data/firmwareTemplates';
import JSZip from 'jszip';
import { 
  Download, 
  Copy, 
  Check, 
  Code2, 
  FileCode, 
  Settings2, 
  Terminal, 
  GitBranch,
  Layers,
  Cpu,
  Zap,
  ShieldCheck
} from 'lucide-react';

interface FirmwareGeneratorProps {
  config: FirmwareConfig;
  onConfigChange: (newConfig: Partial<FirmwareConfig>) => void;
}

type TabType = 'workflow' | 'merge_script' | 'platformio' | 'ino' | 'lgfx' | 'tft_espi' | 'readme';

export default function FirmwareGenerator({ config, onConfigChange }: FirmwareGeneratorProps) {
  const [activeTab, setActiveTab] = useState<TabType>('workflow');
  const [copied, setCopied] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  // Generate code dynamically based on current live config
  const workflowCode = generateGithubWorkflow();
  const mergeScriptCode = generateMergeBinScript();
  const inoCode = generateArduinoIno(config);
  const lgfxCode = generateLovyanGfxHeader(config);
  const platformIoCode = generatePlatformIoIni(config);
  const tftEspiCode = generateTftEspiUserSetup(config);
  const readmeCode = generateReadme(config);

  const getCurrentCode = () => {
    switch (activeTab) {
      case 'workflow': return workflowCode;
      case 'merge_script': return mergeScriptCode;
      case 'platformio': return platformIoCode;
      case 'ino': return inoCode;
      case 'lgfx': return lgfxCode;
      case 'tft_espi': return tftEspiCode;
      case 'readme': return readmeCode;
    }
  };

  const getFilename = () => {
    switch (activeTab) {
      case 'workflow': return '.github/workflows/build-firmware.yml';
      case 'merge_script': return 'scripts/merge_bin.py';
      case 'platformio': return 'platformio.ini';
      case 'ino': return 'ESP32C3_ST7789_GeekMagic.ino (or src/main.cpp)';
      case 'lgfx': return 'include/LGFX_ST7789_GMT130.h';
      case 'tft_espi': return 'User_Setup.h';
      case 'readme': return 'README.md';
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getCurrentCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadZip = async () => {
    try {
      setIsZipping(true);
      const zip = new JSZip();

      // 1. GitHub Actions CI Directory
      const githubFolder = zip.folder('.github');
      const workflowsFolder = githubFolder?.folder('workflows');
      workflowsFolder?.file('build-firmware.yml', workflowCode);

      // 2. Python Scripts for Auto-Merge 0x0 Binary
      const scriptsFolder = zip.folder('scripts');
      scriptsFolder?.file('merge_bin.py', mergeScriptCode);

      // 3. PlatformIO Project Structure
      zip.file('platformio.ini', platformIoCode);
      zip.file('requirements.txt', 'platformio>=6.1.16\nesptool>=4.8.1\n');
      const srcFolder = zip.folder('src');
      srcFolder?.file('main.cpp', inoCode);
      const includeFolder = zip.folder('include');
      includeFolder?.file('LGFX_ST7789_GMT130.h', lgfxCode);

      // 4. Arduino IDE Standalone Project Folder
      const arduinoFolder = zip.folder('ESP32C3_ST7789_GeekMagic');
      arduinoFolder?.file('ESP32C3_ST7789_GeekMagic.ino', inoCode);
      arduinoFolder?.file('LGFX_ST7789_GMT130.h', lgfxCode);

      // 5. TFT_eSPI Alternative Config
      const tftFolder = zip.folder('TFT_eSPI_Alternative');
      tftFolder?.file('User_Setup.h', tftEspiCode);

      // 6. Complete Documentation & Flashing Guide
      zip.file('README.md', readmeCode);

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ESP32C3_SuperMini_ST7789_GitHub_Ready.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to create zip', err);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-emerald-400" />
            GitHub CI & Production Hardware Firmware Exporter
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Preconfigured GitHub Actions workflow that compiles in the cloud and outputs a fresh, single flashable <code className="text-amber-400 bg-slate-900 px-1 py-0.5 rounded font-mono">esp32c3_st7789_merged_0x0.bin</code>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-all"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-bold">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Current File</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownloadZip}
            disabled={isZipping}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 transition-all disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isZipping ? 'Packaging...' : 'Download Full GitHub Repo (ZIP)'}</span>
          </button>
        </div>
      </div>

      {/* GitHub Workflow & Merged Binary Architecture Banner */}
      <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-indigo-950/40 border border-emerald-800/40">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mt-0.5">
            <Zap className="w-4 h-4" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-100">
                Fresh Single Merged Binary Architecture (<code className="text-amber-300 font-mono text-xs">merged_0x0.bin</code>)
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-900/60 border border-emerald-700 text-emerald-300 font-mono">
                Offset 0x0000
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Normally, flashing an ESP32 requires 4 separate files at specific offsets (<code className="text-slate-300">0x0</code> bootloader, <code className="text-slate-300">0x8000</code> partitions, <code className="text-slate-300">0xe000</code> boot_app0, <code className="text-slate-300">0x10000</code> firmware).
              Our GitHub Action and local PlatformIO post-script use <code className="text-amber-400 font-mono">esptool.py merge_bin</code> to automatically bundle everything into one continuous 4MB image ready to flash in <strong>a single command</strong>:
            </p>
            <div className="mt-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between font-mono text-xs text-emerald-400">
              <span className="overflow-x-auto select-all">
                esptool.py --chip esp32c3 write_flash 0x0 esp32c3_st7789_merged_0x0.bin
              </span>
              <span className="text-[10px] text-slate-500 ml-2 whitespace-nowrap">Single 1-Step Flash</span>
            </div>
          </div>
        </div>
      </div>

      {/* Firmware Parameter Customizer */}
      <div className="mb-6 p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
          <Settings2 className="w-3.5 h-3.5 text-indigo-400" />
          <span>Quick Firmware Parameter Configurator</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {/* WiFi Mode */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">WiFi Connection Mode</label>
            <select
              value={config.wifiMode}
              onChange={e => onConfigChange({ wifiMode: e.target.value as 'captive_portal' | 'hardcoded' })}
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-sans"
            >
              <option value="captive_portal">Captive Portal (SoftAP Setup)</option>
              <option value="hardcoded">Hardcoded Credentials</option>
            </select>
          </div>

          {/* City */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Weather City Name</label>
            <input
              type="text"
              value={config.weatherCity}
              onChange={e => onConfigChange({ weatherCity: e.target.value })}
              placeholder="e.g. Dhaka, London"
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          {/* Timezone UTC offset */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Timezone UTC Offset (Hours)</label>
            <input
              type="number"
              value={config.timezoneOffsetHours}
              onChange={e => onConfigChange({ timezoneOffsetHours: Number(e.target.value) })}
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          {/* SPI Clock */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">SPI Frequency</label>
            <select
              value={config.spiFrequencyMhz}
              onChange={e => onConfigChange({ spiFrequencyMhz: Number(e.target.value) as 40 | 80 })}
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
            >
              <option value={40}>40 MHz (Recommended / Stable)</option>
              <option value={80}>80 MHz (Turbo DMA / High Speed)</option>
            </select>
          </div>
        </div>

        {config.wifiMode === 'hardcoded' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-800 text-xs">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">WiFi SSID</label>
              <input
                type="text"
                value={config.wifiSsid}
                onChange={e => onConfigChange({ wifiSsid: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-slate-200 font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">WiFi Password</label>
              <input
                type="password"
                value={config.wifiPass}
                onChange={e => onConfigChange({ wifiPass: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-slate-200 font-mono"
              />
            </div>
          </div>
        )}
      </div>

      {/* File Tabs */}
      <div className="flex items-center gap-1.5 mb-2 overflow-x-auto border-b border-slate-800 pb-2">
        {[
          { id: 'workflow', name: '.github/workflows/build-firmware.yml', tag: 'GitHub Actions CI', highlight: true },
          { id: 'merge_script', name: 'scripts/merge_bin.py', tag: 'Auto 0x0 Merge' },
          { id: 'platformio', name: 'platformio.ini', tag: 'PlatformIO' },
          { id: 'ino', name: 'ESP32C3_ST7789_GeekMagic.ino', tag: '3 Big Watch Faces' },
          { id: 'lgfx', name: 'LGFX_ST7789_GMT130.h', tag: 'LovyanGFX Driver' },
          { id: 'tft_espi', name: 'User_Setup.h', tag: 'TFT_eSPI Alt' },
          { id: 'readme', name: 'README.md', tag: 'Flashing Guide' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as TabType)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap transition-all ${
              activeTab === t.id
                ? 'bg-slate-800 border border-slate-700 text-emerald-300 font-semibold shadow'
                : t.highlight
                ? 'text-amber-300 hover:bg-slate-900 border border-amber-900/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>{t.name}</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700 text-slate-400">
              {t.tag}
            </span>
          </button>
        ))}
      </div>

      {/* Code Viewer Container */}
      <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-[#090d16]">
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900/80 border-b border-slate-800 text-xs font-mono text-slate-400">
          <span className="text-emerald-400 font-semibold">{getFilename()}</span>
          <span className="text-[11px] text-slate-500">
            {getCurrentCode().split('\n').length} lines
          </span>
        </div>

        <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto max-h-[500px] leading-relaxed select-text">
          <code>{getCurrentCode()}</code>
        </pre>
      </div>
    </div>
  );
}
