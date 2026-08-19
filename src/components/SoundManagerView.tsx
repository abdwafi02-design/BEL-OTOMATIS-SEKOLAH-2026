import {
  FileAudio,
  Mic,
  Music,
  Play,
  Plus,
  Radio,
  Sliders,
  Square,
  Trash2,
  UploadCloud,
  Volume2,
} from 'lucide-react';
import React, { useRef, useState } from 'react';
import { BUILTIN_SOUNDS } from '../data/defaultData';
import { audioEngine } from '../services/audioEngine';
import { deleteAudioFile, saveAudioFile } from '../services/db';
import { CustomSound, SchoolSettings } from '../types';

interface SoundManagerViewProps {
  customSounds: CustomSound[];
  onUpdateCustomSounds: (sounds: CustomSound[]) => void;
  settings: SchoolSettings;
  onUpdateSettings: (settings: SchoolSettings) => void;
}

export const SoundManagerView: React.FC<SoundManagerViewProps> = ({
  customSounds,
  onUpdateCustomSounds,
  settings,
  onUpdateSettings,
}) => {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [ttsTestText, setTtsTestText] = useState('Perhatian, saatnya jam pelajaran pertama dimulai.');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePlaySound = async (soundId: string, duration?: number) => {
    setPlayingId(soundId);
    try {
      await audioEngine.playSound(
        soundId,
        settings.volume,
        duration || settings.soundDuration || 6,
        undefined,
        settings.ttsVoiceRate
      );
    } finally {
      setTimeout(() => {
        setPlayingId(null);
      }, (duration || settings.soundDuration || 5) * 1000);
    }
  };

  const handleStopAll = () => {
    audioEngine.stopAll();
    setPlayingId(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.type.includes('audio')) {
      alert('Mohon pilih file audio yang valid (MP3, WAV, OGG, atau AAC).');
      return;
    }

    setUploading(true);
    try {
      const customId = `custom-${Date.now()}`;
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      await saveAudioFile(customId, baseName, file);

      const newCustomSound: CustomSound = {
        id: customId,
        name: baseName,
        type: 'custom',
        fileName: file.name,
        fileType: file.type,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      };

      onUpdateCustomSounds([...customSounds, newCustomSound]);
    } catch (err) {
      console.error('Failed to upload custom audio:', err);
      alert('Gagal menyimpan file audio ke memori browser.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteCustomSound = async (id: string) => {
    if (confirm('Hapus file audio kustom ini?')) {
      await deleteAudioFile(id);
      onUpdateCustomSounds(customSounds.filter((s) => s.id !== id));
    }
  };

  const handleTestTts = () => {
    audioEngine.speakAnnouncement(ttsTestText, settings.ttsVoiceRate, 0);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
            <Music className="w-6 h-6 text-blue-400" />
            Manajemen Suara Bel & Audio
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Daftar nada lonceng Web Audio API bawaan dan upload file MP3/WAV kustom untuk bel sekolah.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {playingId && (
            <button
              onClick={handleStopAll}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-rose-600/20 active:scale-95"
            >
              <Square className="w-4 h-4" />
              <span>Hentikan Suara</span>
            </button>
          )}

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="audio/*"
            className="hidden"
          />
          <button
            id="btn-upload-audio-file"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-blue-600/20 active:scale-95 cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            <span>{uploading ? 'Mengunggah...' : 'Upload File MP3 / WAV'}</span>
          </button>
        </div>
      </div>

      {/* Audio Volume & Duration Control Bench */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
              <Sliders className="w-4 h-4 text-blue-400" /> Volume Master Bel:
            </label>
            <span className="font-mono text-sm font-extrabold text-blue-400">
              {Math.round(settings.volume * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={settings.volume}
            onChange={(e) => onUpdateSettings({ ...settings, volume: parseFloat(e.target.value) })}
            className="w-full h-2.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-[11px] text-slate-500 mt-1">
            <span>10% (Pelan)</span>
            <span>50%</span>
            <span>100% (Maksimal Speaker)</span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
              <Volume2 className="w-4 h-4 text-amber-400" /> Durasi Standar Bel:
            </label>
            <span className="font-mono text-sm font-extrabold text-amber-400">
              {settings.soundDuration} Detik
            </span>
          </div>
          <input
            type="range"
            min="2"
            max="20"
            step="1"
            value={settings.soundDuration}
            onChange={(e) => onUpdateSettings({ ...settings, soundDuration: parseInt(e.target.value) })}
            className="w-full h-2.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
          <div className="flex justify-between text-[11px] text-slate-500 mt-1">
            <span>2 Detik (Singkat)</span>
            <span>10 Detik</span>
            <span>20 Detik (Lama)</span>
          </div>
        </div>
      </div>

      {/* Built-in Sounds Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Radio className="w-5 h-5 text-blue-400" />
              Suara Nada Bawaan (Web Audio API Synthesizer)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              100% Berjalan Offline tanpa perlu unduh file MP3, jernih dan harmonis.
            </p>
          </div>
          <span className="text-xs text-slate-400 font-semibold">
            {BUILTIN_SOUNDS.length} Pilihan Nada
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {BUILTIN_SOUNDS.map((s) => {
            const isThisPlaying = playingId === s.id;
            return (
              <div
                key={s.id}
                className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                  isThisPlaying
                    ? 'bg-blue-600/20 border-blue-500/60 shadow-lg shadow-blue-500/10'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-white">{s.name}</span>
                    {settings.defaultSoundId === s.id && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">{s.description}</p>
                </div>

                <button
                  id={`play-sound-${s.id}`}
                  onClick={() => handlePlaySound(s.id, s.defaultDuration)}
                  className={`p-3 rounded-xl transition-all cursor-pointer ${
                    isThisPlaying
                      ? 'bg-amber-500 text-slate-950 animate-pulse'
                      : 'bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white'
                  }`}
                  title="Putar Suara"
                >
                  <Play className="w-4 h-4 fill-current" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom Uploaded Sounds Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileAudio className="w-5 h-5 text-purple-400" />
              Suara Kustom Tersimpan (IndexedDB Offline)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              File MP3/WAV yang diunggah tersimpan secara permanen di database browser lokal Anda.
            </p>
          </div>
          <span className="text-xs text-slate-400">
            Total: <strong className="text-white">{customSounds.length}</strong> file
          </span>
        </div>

        {customSounds.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm border-2 border-dashed border-slate-800 rounded-2xl p-6">
            <UploadCloud className="w-10 h-10 mx-auto mb-2 text-slate-600" />
            <p className="font-semibold text-slate-300">Belum ada file suara kustom yang diunggah.</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Anda dapat mengunggah file rekaman bel sekolah sendiri (format .mp3 atau .wav).
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {customSounds.map((c) => {
              const isThisPlaying = playingId === c.id;
              return (
                <div
                  key={c.id}
                  className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 flex items-center justify-between gap-3 text-white"
                >
                  <div>
                    <div className="text-sm font-bold truncate max-w-[200px]">{c.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {c.fileName} • {(c.size / (1024 * 1024)).toFixed(2)} MB
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePlaySound(c.id, settings.soundDuration)}
                      className={`p-2.5 rounded-xl transition-all ${
                        isThisPlaying
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white'
                      }`}
                    >
                      <Play className="w-4 h-4 fill-current" />
                    </button>
                    <button
                      onClick={() => handleDeleteCustomSound(c.id)}
                      className="p-2.5 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Voice Synthesis (TTS) Tester */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="border-b border-slate-800 pb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Mic className="w-5 h-5 text-emerald-400" />
            Fitur Pengumuman Suara Otomatis (TTS Bahasa Indonesia)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Sistem dapat membacakan narasi suara Bahasa Indonesia secara otomatis mendampingi nada lonceng bel.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Uji Coba Kalimat Narasi Suara:
            </label>
            <input
              type="text"
              value={ttsTestText}
              onChange={(e) => setTtsTestText(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
              placeholder="Ketik kalimat pengumuman suara..."
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={handleTestTts}
              className="w-full px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 active:scale-95"
            >
              <Mic className="w-4 h-4" />
              <span>Dengar Suara Narasi</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
