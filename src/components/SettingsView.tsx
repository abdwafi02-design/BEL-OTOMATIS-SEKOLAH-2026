import {
  Check,
  Download,
  Globe,
  KeyRound,
  Languages,
  Play,
  RotateCcw,
  Save,
  School,
  Shield,
  Sparkles,
  Square,
  Upload,
  Volume2,
  Zap,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { audioEngine } from '../services/audioEngine';
import {
  MULTI_LANGUAGE_PRESETS,
  ORDERED_LANGUAGES,
  SUPPORTED_LANGUAGES,
} from '../services/multiLanguageTts';
import { exportAllData, importBackupData, resetToFactoryDefaults } from '../services/storage';
import { CurrentlySpeakingLanguage, LanguageCode, SchoolSettings } from '../types';

interface SettingsViewProps {
  settings: SchoolSettings;
  onUpdateSettings: (settings: SchoolSettings) => void;
  onFactoryReset: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onFactoryReset,
}) => {
  const [form, setForm] = useState<SchoolSettings>({ ...settings });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testPresetId, setTestPresetId] = useState<string>('preset-masuk');
  const [isTestingSpeech, setIsTestingSpeech] = useState(false);
  const [speakingLanguageInfo, setSpeakingLanguageInfo] = useState<CurrentlySpeakingLanguage | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm({ ...settings });
  }, [settings]);

  useEffect(() => {
    const originalCallback = audioEngine.onSpeakingLanguageChange;
    audioEngine.onSpeakingLanguageChange = (info) => {
      setSpeakingLanguageInfo(info);
      if (!info) {
        setIsTestingSpeech(false);
      }
    };
    return () => {
      audioEngine.onSpeakingLanguageChange = originalCallback;
    };
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(form);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleToggleActiveLanguage = (langCode: LanguageCode) => {
    const currentActive = form.activeLanguages || ['id', 'en', 'ar', 'zh'];
    let updated: LanguageCode[];
    if (currentActive.includes(langCode)) {
      // Must keep at least one language
      if (currentActive.length <= 1) return;
      updated = currentActive.filter((l) => l !== langCode);
    } else {
      updated = [...currentActive, langCode];
      // Keep in standard ordered sequence
      updated.sort((a, b) => ORDERED_LANGUAGES.indexOf(a) - ORDERED_LANGUAGES.indexOf(b));
    }
    setForm({ ...form, activeLanguages: updated });
  };

  const handleTestMultiLanguageVoice = () => {
    const preset = MULTI_LANGUAGE_PRESETS.find((p) => p.id === testPresetId) || MULTI_LANGUAGE_PRESETS[0];
    setIsTestingSpeech(true);
    audioEngine.queueMultiLanguageSpeech(
      preset.phrases,
      form.ttsVoiceRate || 1.0,
      0,
      form.activeLanguages || ['id', 'en', 'ar', 'zh'],
      form.languageDelayMs ?? 500
    );
  };

  const handleStopTestSpeech = () => {
    audioEngine.stopAll();
    setIsTestingSpeech(false);
    setSpeakingLanguageInfo(null);
  };

  const handleExportBackup = () => {
    const jsonStr = exportAllData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-bel-sekolah-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      const res = importBackupData(content);
      if (res.success) {
        alert('Data backup berhasil dipulihkan!');
        window.location.reload();
      } else {
        alert(res.message);
      }
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    if (confirm('PERINGATAN: Apakah Anda yakin ingin mereset seluruh jadwal dan pengaturan ke default pabrik?')) {
      resetToFactoryDefaults();
      onFactoryReset();
      window.location.reload();
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
            <School className="w-6 h-6 text-blue-400" />
            Pengaturan Sistem & Profil Sekolah
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Konfigurasi identitas satuan pendidikan, keamanan PIN, zona waktu, dan cadangan data.
          </p>
        </div>

        <button
          type="submit"
          id="btn-save-settings"
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-blue-600/20 active:scale-95 cursor-pointer self-start sm:self-auto"
        >
          <Save className="w-4 h-4" />
          <span>{saveSuccess ? 'Tersimpan!' : 'Simpan Pengaturan'}</span>
        </button>
      </div>

      {/* Grid: School Identity & Security */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* School Identity */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <School className="w-5 h-5 text-blue-400" />
            Identitas Sekolah
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Nama Sekolah / Madrasah:
            </label>
            <input
              type="text"
              value={form.schoolName}
              onChange={(e) => setForm({ ...form, schoolName: e.target.value })}
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              NPSN (Nomor Pokok Sekolah Nasional):
            </label>
            <input
              type="text"
              value={form.schoolNPSN || ''}
              onChange={(e) => setForm({ ...form, schoolNPSN: e.target.value })}
              placeholder="Contoh: 10293847"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Alamat Sekolah:
            </label>
            <textarea
              rows={2}
              value={form.schoolAddress || ''}
              onChange={(e) => setForm({ ...form, schoolAddress: e.target.value })}
              placeholder="Jl. Pendidikan No. 1..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Security & PIN */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Shield className="w-5 h-5 text-amber-400" />
            Keamanan & Proteksi PIN Admin
          </h3>

          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
            <div>
              <div className="text-sm font-semibold text-white">Proteksi Menu dengan PIN</div>
              <p className="text-xs text-slate-400 mt-0.5">
                Kunci menu pengaturan & jadwal agar tidak diubah sembarang orang saat mode kiosk.
              </p>
            </div>
            <input
              type="checkbox"
              id="settings-pin-toggle"
              checked={form.isPinRequired}
              onChange={(e) => setForm({ ...form, isPinRequired: e.target.checked })}
              className="w-5 h-5 rounded text-blue-600 bg-slate-900 border-slate-700 cursor-pointer"
            />
          </div>

          {form.isPinRequired && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-amber-400" /> PIN Operator (4 Digit):
              </label>
              <input
                type="password"
                maxLength={6}
                value={form.adminPin}
                onChange={(e) => setForm({ ...form, adminPin: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-center tracking-widest text-lg focus:border-amber-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-500 mt-1">Default PIN: 1234</p>
            </div>
          )}

          {/* WakeLock Feature */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
            <div>
              <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-blue-400" /> Cegah Layar Mati (Screen Wake Lock)
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Mencegah Chromebook Zyrex / PC masuk mode tidur (sleep) saat aplikasi aktif.
              </p>
            </div>
            <input
              type="checkbox"
              id="settings-wakelock-toggle"
              checked={form.wakeLockEnabled}
              onChange={(e) => setForm({ ...form, wakeLockEnabled: e.target.checked })}
              className="w-5 h-5 rounded text-blue-600 bg-slate-900 border-slate-700 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Timezone & Audio Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Timezone */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Globe className="w-5 h-5 text-blue-400" />
            Zona Waktu & Jam Digital
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Zona Waktu Operasional:
            </label>
            <select
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value as any })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="Asia/Jakarta">WIB - Waktu Indonesia Barat (UTC+7)</option>
              <option value="Asia/Makassar">WITA - Waktu Indonesia Tengah (UTC+8)</option>
              <option value="Asia/Jayapura">WIT - Waktu Indonesia Timur (UTC+9)</option>
              <option value="auto">Otomatis Sesuai Waktu Perangkat</option>
            </select>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
            <div>
              <div className="text-sm font-semibold text-white">Tampilkan Detik pada Jam</div>
              <p className="text-xs text-slate-400 mt-0.5">Format jam realtime presisi (HH:MM:SS)</p>
            </div>
            <input
              type="checkbox"
              checked={form.showSeconds}
              onChange={(e) => setForm({ ...form, showSeconds: e.target.checked })}
              className="w-5 h-5 rounded text-blue-600 bg-slate-900 border-slate-700 cursor-pointer"
            />
          </div>
        </div>

        {/* Audio TTS & 4-Language Voice Configuration */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Globe className="w-5 h-5 text-emerald-400" />
            Pengumuman Narasi Suara 4 Bahasa (Multilingual TTS)
          </h3>

          {/* Master TTS Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
            <div>
              <div className="text-sm font-semibold text-white">Aktifkan Pengumuman Suara (TTS)</div>
              <p className="text-xs text-slate-400 mt-0.5">
                Membacakan pengumuman kegiatan secara otomatis setelah nada lonceng berdentang.
              </p>
            </div>
            <input
              type="checkbox"
              id="settings-tts-toggle"
              checked={form.ttsEnabled}
              onChange={(e) => setForm({ ...form, ttsEnabled: e.target.checked })}
              className="w-5 h-5 rounded text-emerald-600 bg-slate-900 border-slate-700 cursor-pointer"
            />
          </div>

          {/* Multi-Language Mode Toggle */}
          {form.ttsEnabled && (
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
              <div>
                <div className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5">
                  <Languages className="w-4 h-4" /> Mode Otomatis 4 Bahasa (ID / EN / AR / ZH)
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Membacakan pengumuman berurutan: Bahasa Indonesia, Inggris, Arab, dan Mandarin.
                </p>
              </div>
              <input
                type="checkbox"
                id="settings-multilang-toggle"
                checked={form.multiLanguageEnabled}
                onChange={(e) => setForm({ ...form, multiLanguageEnabled: e.target.checked })}
                className="w-5 h-5 rounded text-emerald-600 bg-slate-900 border-slate-700 cursor-pointer"
              />
            </div>
          )}

          {form.ttsEnabled && form.multiLanguageEnabled && (
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="text-xs font-semibold text-slate-300">
                Pilihan Bahasa Aktif yang Diucapkan Berurutan:
              </div>
              <div className="grid grid-cols-2 gap-2">
                {ORDERED_LANGUAGES.map((code) => {
                  const info = SUPPORTED_LANGUAGES[code];
                  const isChecked = (form.activeLanguages || ['id', 'en', 'ar', 'zh']).includes(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => handleToggleActiveLanguage(code)}
                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        isChecked
                          ? 'bg-blue-600/20 border-blue-500/40 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-500 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{info.flag}</span>
                        <div>
                          <div className="text-xs font-bold">{info.label}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{info.bcp47}</div>
                        </div>
                      </div>
                      <div className={`w-4 h-4 rounded flex items-center justify-center ${isChecked ? 'bg-blue-600 text-white' : 'bg-slate-800'}`}>
                        {isChecked && <Check className="w-3 h-3" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Jeda Antar Bahasa */}
              <div className="pt-2">
                <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
                  <span>Jeda Hening Antar Bahasa:</span>
                  <span className="font-mono text-blue-400">{(form.languageDelayMs ?? 500) / 1000} detik ({form.languageDelayMs ?? 500} ms)</span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="1500"
                  step="100"
                  value={form.languageDelayMs ?? 500}
                  onChange={(e) => setForm({ ...form, languageDelayMs: parseInt(e.target.value) })}
                  className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            </div>
          )}

          {form.ttsEnabled && (
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
                <span>Kecepatan Artikulasi Suara (Pitch/Rate):</span>
                <span className="font-mono text-emerald-400">{form.ttsVoiceRate}x</span>
              </div>
              <input
                type="range"
                min="0.7"
                max="1.3"
                step="0.05"
                value={form.ttsVoiceRate}
                onChange={(e) => setForm({ ...form, ttsVoiceRate: parseFloat(e.target.value) })}
                className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Interactive 4-Language Voice Simulator & Test Console */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              Simulasi & Uji Coba Pengumuman 4 Bahasa Langsung
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Uji kejernihan pelafalan suara 4 bahasa (Indonesia, Inggris, Arab, Mandarin) pada perangkat ini.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!isTestingSpeech ? (
              <button
                type="button"
                onClick={handleTestMultiLanguageVoice}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" /> Putar Tes 4 Bahasa
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStopTestSpeech}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/20 flex items-center gap-1.5 cursor-pointer"
              >
                <Square className="w-4 h-4 fill-white" /> Hentikan Suara
              </button>
            )}
          </div>
        </div>

        {/* Preset Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="text-xs font-semibold text-slate-300 sm:w-44">
            Pilih Contoh Pengumuman:
          </label>
          <select
            value={testPresetId}
            onChange={(e) => setTestPresetId(e.target.value)}
            className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:border-blue-500 focus:outline-none"
          >
            {MULTI_LANGUAGE_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} — {p.phrases.id}
              </option>
            ))}
          </select>
        </div>

        {/* Real-time Visual 4-Language Pipeline Display */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {(() => {
            const currentPreset = MULTI_LANGUAGE_PRESETS.find((p) => p.id === testPresetId) || MULTI_LANGUAGE_PRESETS[0];
            return ORDERED_LANGUAGES.map((langKey) => {
              const info = SUPPORTED_LANGUAGES[langKey];
              const isCurrentlySpeaking = speakingLanguageInfo?.lang === langKey;
              const text = currentPreset.phrases[langKey];
              const isLangActive = (form.activeLanguages || ['id', 'en', 'ar', 'zh']).includes(langKey);

              return (
                <div
                  key={langKey}
                  className={`p-4 rounded-2xl border transition-all relative overflow-hidden ${
                    isCurrentlySpeaking
                      ? 'bg-blue-600/20 border-blue-500 shadow-lg shadow-blue-500/20 scale-[1.02]'
                      : isLangActive
                      ? 'bg-slate-950 border-slate-800'
                      : 'bg-slate-950/40 border-slate-900 opacity-50'
                  }`}
                >
                  {isCurrentlySpeaking && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-emerald-400 to-amber-400 animate-pulse" />
                  )}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-lg">{info.flag}</span>
                      <span className="text-xs font-bold text-white">{info.label}</span>
                    </div>
                    {isCurrentlySpeaking && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500 text-white animate-pulse">
                        Sedang Bicara...
                      </span>
                    )}
                  </div>
                  <p
                    dir={langKey === 'ar' ? 'rtl' : 'ltr'}
                    className={`text-xs ${langKey === 'ar' ? 'text-right font-sans' : 'text-left'} ${
                      isCurrentlySpeaking ? 'text-blue-200 font-semibold' : 'text-slate-400'
                    }`}
                  >
                    &ldquo;{text}&rdquo;
                  </p>
                </div>
              );
            });
          })()}
        </div>
      </div>

      {/* Backup, Restore & Reset Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <Download className="w-5 h-5 text-blue-400" />
          Backup, Pemulihan Data (Restore) & Reset Pabrik
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={handleExportBackup}
            className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-blue-500/60 text-left transition-all space-y-1 cursor-pointer"
          >
            <div className="text-sm font-bold text-white flex items-center gap-1.5">
              <Download className="w-4 h-4 text-blue-400" /> Backup Data (JSON)
            </div>
            <p className="text-xs text-slate-400">
              Unduh seluruh file konfigurasi jadwal & hari libur untuk disimpan atau dipindahkan ke perangkat lain.
            </p>
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportBackup}
            accept=".json"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-purple-500/60 text-left transition-all space-y-1 cursor-pointer"
          >
            <div className="text-sm font-bold text-white flex items-center gap-1.5">
              <Upload className="w-4 h-4 text-purple-400" /> Restore Data (JSON)
            </div>
            <p className="text-xs text-slate-400">
              Pulihkan jadwal dan pengaturan dari file backup .json sebelumnya.
            </p>
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="p-4 rounded-2xl bg-slate-950 border border-rose-900/30 hover:border-rose-600/60 text-left transition-all space-y-1 cursor-pointer"
          >
            <div className="text-sm font-bold text-rose-400 flex items-center gap-1.5">
              <RotateCcw className="w-4 h-4" /> Reset ke Default Pabrik
            </div>
            <p className="text-xs text-slate-400">
              Kembalikan semua jadwal dan pengaturan ke konfigurasi awal bawaan aplikasi.
            </p>
          </button>
        </div>
      </div>
    </form>
  );
};
