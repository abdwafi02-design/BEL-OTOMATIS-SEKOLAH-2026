/**
 * High-Precision Audio Engine for Bel Sekolah Otomatis.
 * Uses Web Audio API for harmonic multi-oscillator synthesis (Westminster chimes, ding-dong, electric bells)
 * and plays custom uploaded audio files from IndexedDB or ArrayBuffer.
 */

import { CurrentlySpeakingLanguage, LanguageCode, MultiLanguageText } from '../types';
import { getAudioFile } from './db';
import { getSpeechVoiceForLanguage, ORDERED_LANGUAGES, SUPPORTED_LANGUAGES } from './multiLanguageTts';

class SchoolAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isUnlocked: boolean = false;
  private currentActiveSource: AudioBufferSourceNode | OscillatorNode | null = null;
  private customAudioCache: Map<string, AudioBuffer> = new Map();
  private isSpeechCancelled: boolean = false;
  private speechTimeoutId: any = null;

  // Real-time listener for which language is being spoken currently (for UI banners / overlays)
  public onSpeakingLanguageChange: ((info: CurrentlySpeakingLanguage | null) => void) | null = null;

  constructor() {
    // Lazy initialized on first user gesture
  }

  public initContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.9, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().then(() => {
        this.isUnlocked = true;
      });
    } else {
      this.isUnlocked = true;
    }
    return this.ctx;
  }

  public async unlock(): Promise<boolean> {
    try {
      const ctx = this.initContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      // Play a short silent buffer to satisfy mobile browser autoplay lock
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      this.isUnlocked = true;
      return true;
    } catch (e) {
      console.warn('AudioContext unlock failed:', e);
      return false;
    }
  }

  public getUnlockedStatus(): boolean {
    return this.isUnlocked && !!this.ctx && this.ctx.state === 'running';
  }

  public isContextRunning(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  public async resume(): Promise<void> {
    const ctx = this.initContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    this.isUnlocked = true;
  }

  public setMasterVolume(volume: number) {
    const clamped = Math.max(0, Math.min(1, volume));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(clamped, this.ctx.currentTime);
    }
  }

  public stopAll() {
    this.isSpeechCancelled = true;
    if (this.speechTimeoutId) {
      clearTimeout(this.speechTimeoutId);
      this.speechTimeoutId = null;
    }
    if (this.currentActiveSource) {
      try {
        this.currentActiveSource.stop();
      } catch {
        // ignore if already stopped
      }
      this.currentActiveSource = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (this.onSpeakingLanguageChange) {
      this.onSpeakingLanguageChange(null);
    }
  }

  /**
   * Main play entry point for any sound ID (builtin or custom) with 4-Language Speech Synthesis support
   */
  public async playSound(
    soundId: string,
    volume: number = 0.9,
    durationSec?: number,
    speechPhrases?: MultiLanguageText | string,
    ttsVoiceRate: number = 1.0,
    activeLanguages: LanguageCode[] = ['id', 'en', 'ar', 'zh'],
    languageDelayMs: number = 500
  ): Promise<void> {
    this.isSpeechCancelled = false;
    const ctx = this.initContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    this.setMasterVolume(volume);

    // Normalize speechPhrases into MultiLanguageText
    const multiLang: MultiLanguageText | undefined = 
      typeof speechPhrases === 'string'
        ? { id: speechPhrases }
        : speechPhrases;

    // If it's a custom sound from IndexedDB
    if (soundId.startsWith('custom-') || soundId.includes('custom_')) {
      const played = await this.playCustomSound(soundId, volume, durationSec);
      if (played && multiLang && 'speechSynthesis' in window) {
        this.queueMultiLanguageSpeech(multiLang, ttsVoiceRate, (durationSec || 5) * 1000, activeLanguages, languageDelayMs);
      }
      return;
    }

    // Built-in Synthesized Sounds
    switch (soundId) {
      case 'westminster-4':
        await this.playWestminster(4, volume);
        break;
      case 'westminster-8':
        await this.playWestminster(8, volume);
        break;
      case 'westminster-16':
        await this.playWestminster(16, volume);
        break;
      case 'chime-2-tone':
        await this.playTwoToneChime(volume);
        break;
      case 'chime-3-tone':
        await this.playThreeToneChime(volume);
        break;
      case 'school-electric':
        await this.playElectricSchoolBell(durationSec || 4, volume);
        break;
      case 'modern-electronic':
        await this.playModernElectronic(volume);
        break;
      case 'short-beep':
        await this.playShortBeep(volume);
        break;
      case 'marimba-peace':
        await this.playMarimbaChime(volume);
        break;
      case 'warning-siren':
        await this.playWarningSiren(durationSec || 6, volume);
        break;
      default:
        await this.playWestminster(4, volume);
        break;
    }

    // Trigger multi-language announcements after chime
    if (multiLang && Object.values(multiLang).some((t) => t && t.trim().length > 0)) {
      const delayMs = soundId.includes('16') ? 7000 : soundId.includes('8') ? 4500 : 2500;
      this.queueMultiLanguageSpeech(multiLang, ttsVoiceRate, delayMs, activeLanguages, languageDelayMs);
    }
  }

  /**
   * Queue and sequentially speak multi-language announcements
   */
  public queueMultiLanguageSpeech(
    multiLang: MultiLanguageText,
    rate: number = 1.0,
    initialDelayMs: number = 0,
    activeLanguages: LanguageCode[] = ['id', 'en', 'ar', 'zh'],
    languageDelayMs: number = 500
  ) {
    if (!('speechSynthesis' in window)) return;
    this.isSpeechCancelled = false;

    if (this.speechTimeoutId) {
      clearTimeout(this.speechTimeoutId);
    }

    this.speechTimeoutId = setTimeout(async () => {
      if (this.isSpeechCancelled) return;

      const langsToPlay: Array<{ code: LanguageCode; text: string }> = [];
      const order = activeLanguages && activeLanguages.length > 0 ? activeLanguages : ORDERED_LANGUAGES;

      for (const code of order) {
        const text = multiLang[code];
        if (text && text.trim().length > 0) {
          langsToPlay.push({ code, text: text.trim() });
        }
      }

      if (langsToPlay.length === 0) return;

      for (let i = 0; i < langsToPlay.length; i++) {
        if (this.isSpeechCancelled) break;
        const item = langsToPlay[i];
        const langInfo = SUPPORTED_LANGUAGES[item.code];

        // Update listener with current speaking language
        if (this.onSpeakingLanguageChange) {
          this.onSpeakingLanguageChange({
            code: item.code,
            lang: item.code,
            name: langInfo.name,
            flag: langInfo.flag,
            text: item.text,
          });
        }

        await this.speakUtterancePromise(item.text, item.code, rate);

        if (this.isSpeechCancelled) break;

        // Inter-language pause
        if (i < langsToPlay.length - 1 && languageDelayMs > 0) {
          await new Promise((res) => setTimeout(res, languageDelayMs));
        }
      }

      if (this.onSpeakingLanguageChange) {
        this.onSpeakingLanguageChange(null);
      }
    }, initialDelayMs);
  }

  /**
   * Speak a single utterance with Promise resolution when finished
   */
  private speakUtterancePromise(text: string, langCode: LanguageCode, rate: number = 1.0): Promise<void> {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window) || this.isSpeechCancelled || !text) {
        resolve();
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const info = SUPPORTED_LANGUAGES[langCode];

      utterance.rate = rate;
      utterance.pitch = 1.0;
      utterance.lang = info ? info.bcp47 : 'id-ID';

      const voice = getSpeechVoiceForLanguage(langCode);
      if (voice) {
        utterance.voice = voice;
      }

      let isFinished = false;
      const finish = () => {
        if (!isFinished) {
          isFinished = true;
          resolve();
        }
      };

      utterance.onend = finish;
      utterance.onerror = finish;

      // Fallback safety timeout in case utterance doesn't fire onend (e.g. background tab)
      const approxDuration = Math.max(2500, Math.ceil((text.length / 12) * 1000 * (1 / rate)));
      setTimeout(finish, approxDuration + 1500);

      window.speechSynthesis.speak(utterance);
    });
  }

  /**
   * Speak announcement for a single language (for testing / manual triggers)
   */
  public async speakSingleLanguage(text: string, langCode: LanguageCode, rate: number = 1.0): Promise<void> {
    if (!('speechSynthesis' in window) || !text) return;
    this.isSpeechCancelled = false;
    const langInfo = SUPPORTED_LANGUAGES[langCode];

    if (this.onSpeakingLanguageChange) {
      this.onSpeakingLanguageChange({
        code: langCode,
        lang: langCode,
        name: langInfo ? langInfo.name : 'Suara',
        flag: langInfo ? langInfo.flag : '🔊',
        text,
      });
    }

    await this.speakUtterancePromise(text, langCode, rate);

    if (this.onSpeakingLanguageChange) {
      this.onSpeakingLanguageChange(null);
    }
  }

  /**
   * Legacy single-language helper
   */
  public speakAnnouncement(text: string, rate: number = 1.0, delayMs: number = 0) {
    setTimeout(() => {
      this.speakSingleLanguage(text, 'id', rate);
    }, delayMs);
  }

  /**
   * Realistic Bell Resonator note (Tube Bell / Carillon harmonic model)
   */
  private playBellNote(freq: number, startTime: number, duration: number = 2.5, gainFactor: number = 1.0) {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;

    // Overtones for bell chime (fundamental, tierce, quint, octave, nominal)
    const partials = [
      { ratio: 0.5, gain: 0.4 },  // Hum tone
      { ratio: 1.0, gain: 1.0 },  // Prime / Fundamental
      { ratio: 1.2, gain: 0.6 },  // Tierce (minor 3rd)
      { ratio: 1.5, gain: 0.4 },  // Quint (5th)
      { ratio: 2.0, gain: 0.5 },  // Nominal
      { ratio: 2.76, gain: 0.2 }, // Superquint
      { ratio: 4.07, gain: 0.15 },// Octave nominal
    ];

    const noteGain = ctx.createGain();
    noteGain.gain.setValueAtTime(0, startTime);
    noteGain.gain.linearRampToValueAtTime(0.5 * gainFactor, startTime + 0.008); // Sharp hammer strike
    noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration); // Long resonant decay
    noteGain.connect(this.masterGain);

    partials.forEach((partial) => {
      const osc = ctx.createOscillator();
      const pGain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * partial.ratio, startTime);

      pGain.gain.setValueAtTime(partial.gain, startTime);
      pGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration * (1 / (partial.ratio * 0.8 + 0.2)));

      osc.connect(pGain);
      pGain.connect(noteGain);

      osc.start(startTime);
      osc.stop(startTime + duration);
    });
  }

  /**
   * Westminster Quarters (Big Ben Melody)
   * Notes: G#4 (415Hz), F#4 (370Hz), E4 (330Hz), B3 (247Hz)
   */
  private async playWestminster(quarters: 4 | 8 | 16, volume: number): Promise<void> {
    const ctx = this.initContext();
    const now = ctx.currentTime + 0.05;

    // Standard Westminster pitches
    const E4 = 329.63;
    const Gs4 = 415.30;
    const Fs4 = 369.99;
    const B3 = 246.94;
    const LowE3 = 164.81;

    // Phrase 1 (4 notes)
    const phrase1 = [
      { f: Gs4, d: 0.7 }, { f: Fs4, d: 0.7 }, { f: E4, d: 0.7 }, { f: B3, d: 1.2 }
    ];
    // Phrase 2 (4 notes)
    const phrase2 = [
      { f: E4, d: 0.7 }, { f: Gs4, d: 0.7 }, { f: Fs4, d: 0.7 }, { f: B3, d: 1.2 }
    ];
    // Phrase 3 (4 notes)
    const phrase3 = [
      { f: E4, d: 0.7 }, { f: Fs4, d: 0.7 }, { f: Gs4, d: 0.7 }, { f: E4, d: 1.2 }
    ];
    // Phrase 4 (4 notes)
    const phrase4 = [
      { f: Gs4, d: 0.7 }, { f: E4, d: 0.7 }, { f: Fs4, d: 0.7 }, { f: B3, d: 1.4 }
    ];

    let sequence: Array<{ f: number; d: number }> = [];
    if (quarters === 4) {
      sequence = [...phrase1];
    } else if (quarters === 8) {
      sequence = [...phrase1, ...phrase2];
    } else {
      sequence = [...phrase1, ...phrase2, ...phrase3, ...phrase4];
    }

    let timeCursor = now;
    sequence.forEach((note) => {
      this.playBellNote(note.f, timeCursor, 3.2, 0.85);
      timeCursor += note.d * 0.95;
    });

    // If 16 notes, add hour toll (Low E3)
    if (quarters === 16) {
      timeCursor += 0.4;
      this.playBellNote(LowE3, timeCursor, 4.5, 1.2);
    }
  }

  /**
   * 2-Tone Resonant Chime (Ding - Dong)
   */
  private async playTwoToneChime(volume: number): Promise<void> {
    const ctx = this.initContext();
    const now = ctx.currentTime + 0.05;
    // High A5 (880Hz) to F5 (698Hz)
    this.playBellNote(880, now, 3.0, 0.9);
    this.playBellNote(698.46, now + 0.8, 3.5, 0.95);
  }

  /**
   * 3-Tone Triad Chime (C5 - E5 - G5 - C6)
   */
  private async playThreeToneChime(volume: number): Promise<void> {
    const ctx = this.initContext();
    const now = ctx.currentTime + 0.05;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      this.playBellNote(freq, now + idx * 0.45, 2.8, 0.85);
    });
  }

  /**
   * Traditional Electric School Bell (Vibrating metallic hammer mechanism)
   */
  private async playElectricSchoolBell(durationSec: number, volume: number): Promise<void> {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;
    const now = ctx.currentTime + 0.05;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.85, now + 0.05);
    gain.gain.setValueAtTime(0.85, now + durationSec - 0.1);
    gain.gain.linearRampToValueAtTime(0.0001, now + durationSec);
    gain.connect(this.masterGain);

    // Dual metallic frequencies
    const f1 = 820; // Dome resonance
    const f2 = 1240; // Secondary ring

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(f1, now);
    osc2.frequency.setValueAtTime(f2, now);

    // Rapid hammer tremolo modulation (approx 24-28 strikes per second)
    const tremolo = ctx.createOscillator();
    const tremoloGain = ctx.createGain();
    tremolo.type = 'square';
    tremolo.frequency.setValueAtTime(26, now);

    tremoloGain.gain.setValueAtTime(0.6, now);
    tremolo.connect(tremoloGain.gain);

    osc1.connect(gain);
    osc2.connect(gain);

    osc1.start(now);
    osc2.start(now);
    tremolo.start(now);

    osc1.stop(now + durationSec + 0.1);
    osc2.stop(now + durationSec + 0.1);
    tremolo.stop(now + durationSec + 0.1);
  }

  /**
   * Modern Electronic Synthesizer Chime
   */
  private async playModernElectronic(volume: number): Promise<void> {
    const ctx = this.initContext();
    const now = ctx.currentTime + 0.05;
    const notes = [
      { f: 587.33, t: 0 },    // D5
      { f: 739.99, t: 0.25 }, // F#5
      { f: 880.00, t: 0.50 }, // A5
      { f: 1174.66, t: 0.75 },// D6
    ];

    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.f, now + n.t);

      g.gain.setValueAtTime(0, now + n.t);
      g.gain.linearRampToValueAtTime(0.7, now + n.t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + n.t + 2.0);

      osc.connect(g);
      g.connect(this.masterGain!);

      osc.start(now + n.t);
      osc.stop(now + n.t + 2.0);
    });
  }

  /**
   * Short Notification Beep
   */
  private async playShortBeep(volume: number): Promise<void> {
    const ctx = this.initContext();
    const now = ctx.currentTime + 0.05;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1046.5, now + 0.15);

    g.gain.setValueAtTime(0.6, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    osc.connect(g);
    g.connect(this.masterGain!);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  /**
   * Marimba pleasant harmonic chords
   */
  private async playMarimbaChime(volume: number): Promise<void> {
    const ctx = this.initContext();
    const now = ctx.currentTime + 0.05;
    const chords = [
      { f: 392.00, t: 0 },    // G4
      { f: 493.88, t: 0.2 },  // B4
      { f: 587.33, t: 0.4 },  // D5
      { f: 783.99, t: 0.6 },  // G5
    ];

    chords.forEach((c) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(c.f, now + c.t);

      g.gain.setValueAtTime(0, now + c.t);
      g.gain.linearRampToValueAtTime(0.75, now + c.t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, now + c.t + 1.8);

      osc.connect(g);
      g.connect(this.masterGain!);

      osc.start(now + c.t);
      osc.stop(now + c.t + 1.8);
    });
  }

  /**
   * Warning Siren / Alarm
   */
  private async playWarningSiren(durationSec: number, volume: number): Promise<void> {
    const ctx = this.initContext();
    const now = ctx.currentTime + 0.05;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();

    osc.type = 'sawtooth';
    // Frequency warble 500Hz to 1200Hz back and forth
    for (let t = 0; t < durationSec; t += 1.0) {
      osc.frequency.setValueAtTime(500, now + t);
      osc.frequency.linearRampToValueAtTime(1100, now + t + 0.5);
      osc.frequency.linearRampToValueAtTime(500, now + t + 1.0);
    }

    g.gain.setValueAtTime(0.7, now);
    g.gain.setValueAtTime(0.7, now + durationSec - 0.2);
    g.gain.linearRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(g);
    g.connect(this.masterGain!);

    osc.start(now);
    osc.stop(now + durationSec);
  }

  /**
   * Custom Audio File Playback from IndexedDB
   */
  private async playCustomSound(customId: string, volume: number, durationSec?: number): Promise<boolean> {
    try {
      const ctx = this.initContext();
      let audioBuffer = this.customAudioCache.get(customId);

      if (!audioBuffer) {
        const record = await getAudioFile(customId);
        if (!record) {
          console.warn(`Custom audio ${customId} not found in IndexedDB, falling back to Westminster`);
          await this.playWestminster(8, volume);
          return false;
        }

        const arrayBuffer = await record.blob.arrayBuffer();
        audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        this.customAudioCache.set(customId, audioBuffer);
      }

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(volume, ctx.currentTime);

      if (durationSec && durationSec > 0 && durationSec < audioBuffer.duration) {
        gainNode.gain.setValueAtTime(volume, ctx.currentTime + durationSec - 0.5);
        gainNode.gain.linearRampToValueAtTime(0.001, ctx.currentTime + durationSec);
      }

      source.connect(gainNode);
      gainNode.connect(this.masterGain!);

      this.currentActiveSource = source;
      source.start(0);

      if (durationSec && durationSec > 0 && durationSec < audioBuffer.duration) {
        source.stop(ctx.currentTime + durationSec);
      }

      return true;
    } catch (err) {
      console.error('Error playing custom audio file:', err);
      await this.playWestminster(8, volume);
      return false;
    }
  }
}

export const audioEngine = new SchoolAudioEngine();
