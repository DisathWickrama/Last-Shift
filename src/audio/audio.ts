// Sound, all of it generated in code with the Web Audio API. No audio files.
//
// Web Audio works like a modular synthesiser: you create "nodes" (oscillators
// that make a tone, noise sources, filters, volume controls) and plug them into
// each other, ending at the speakers:
//
//   oscillator ─► filter ─► gain (volume) ─► master gain ─► speakers
//
// There are two kinds of sound here:
//   BEDS    long-running layers that are always plugged in, whose volume the
//           game turns up and down: tube buzz, fridge hum, wind, the drift
//           drone, radio static, the radio song.
//   STINGS  short one-off sounds built on demand and thrown away: the door
//           bell, a knock, a voice blip per letter of dialogue.
//
// Browsers refuse to make sound until the player has clicked or pressed a key,
// so nothing is created until start() is called from the title screen's click.

import type { Who } from '../core/content';
import { clamp } from '../core/rng';

export type Sting = 'hover' | 'boom' | 'rise' | 'chime' | 'bell' | 'click' | 'static' | 'knock' | 'break' | 'gore' | 'thud' | 'photo' | 'tick' | 'glass' | 'tear';

export interface AudioState {
  /** 0..1 drift of the visitor at the counter. Drives the drone. */
  drift: number;
  /** 0..1 how bright the tubes are right now. The buzz cuts out when they do. */
  light: number;
  /** 'title' is wind only; 'night' is everything. */
  scene: 'title' | 'night' | 'end';
  /** Which night's score to play (1, 2 or 3). */
  score?: number;
  /** 0..1: something close by is breathing. */
  breath?: number;
}

/**
 * The score: one recipe per night. Each night has a slow three-note pad that
 * moves between a few chords, high bell tones at random, and (later) a
 * heartbeat and a metallic scrape. The notes are semitones above `root`.
 * Night 1 is open and sad; Night 2 leans on a tritone; Night 3 is a cluster
 * of notes a semitone apart, which the ear hears as "wrong".
 */
interface Score {
  root: number; // Hz
  chords: number[][]; // three notes each
  hold: number; // seconds per chord
  pad: number; // pad volume
  bells: number[]; // notes the bell may play
  bellGap: [number, number]; // seconds between bells
  pulse: number; // seconds between heartbeats (0 = none)
  scrape: number; // average seconds between scrapes (0 = none)
  songDetune: number; // cents: how flat Wren's song plays
  songSlip: number; // chance that a note of the song comes out wrong
}

const SCORES: Record<number, Score> = {
  1: { root: 55, chords: [[12, 19, 24], [12, 19, 22], [10, 17, 24]], hold: 14, pad: 0.014, bells: [0, 3, 7, 10, 12], bellGap: [7, 15], pulse: 0, scrape: 0, songDetune: -45, songSlip: 0 },
  2: { root: 51.9, chords: [[12, 18, 24], [13, 18, 25], [12, 19, 23]], hold: 10, pad: 0.022, bells: [0, 1, 6, 7], bellGap: [8, 16], pulse: 8, scrape: 50, songDetune: -75, songSlip: 0.12 },
  3: { root: 49, chords: [[12, 13, 18], [11, 13, 19], [12, 14, 18]], hold: 7, pad: 0.03, bells: [0, 1, 6, 11], bellGap: [5, 10], pulse: 3.4, scrape: 24, songDetune: -110, songSlip: 0.3 },
};

// The radio song: a slow waltz. Each bar is [bass note, two chord notes, melody note],
// as semitones above the A below middle C. Played through a "radio" filter, a little flat.
const SONG: [number, number, number, number][] = [
  [3, 10, 15, 22], [3, 10, 15, 19], [0, 7, 12, 19], [0, 7, 12, 15],
  [-4, 8, 12, 15], [-4, 8, 12, 17], [-2, 5, 10, 14], [-2, 5, 10, 17],
];
const BEAT = 0.82; // seconds per beat: slow

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  /** Two sub-mixes under the master, so music and effects have their own volume sliders. */
  private music!: GainNode;
  private sfx!: GainNode;
  private volumes = { master: 0.9, music: 0.8, sfx: 0.9 };
  private noise!: AudioBuffer;
  // beds
  private buzz!: GainNode;
  private hum!: GainNode;
  private wind!: GainNode;
  private windFilter!: BiquadFilterNode;
  private drone!: GainNode;
  private droneHigh!: GainNode;
  private staticBed!: GainNode;
  private songBus!: GainNode;
  private songDetune = -45; // cents: "half a turn flat"
  private songSlip = 0;
  // score
  private pad: OscillatorNode[] = [];
  private padGain!: GainNode;
  private breathGain!: GainNode;
  private chordIn = 0;
  private chord = 0;
  private bellIn = 6;
  private pulseIn = 4;
  private scrapeIn = 20;
  private clock = 0;
  // state
  private muted = false;
  private songOn = false;
  private nextBeat = 0;
  private beat = 0;
  private windIn = 0;
  private truckIn = 30;
  private lastLight = 1;

  /** Create the audio graph. Must be called from a click or key press. Safe to call again. */
  start(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return; // a browser with no Web Audio: the game simply stays silent
    const ctx = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volumes.master;
    this.master.connect(ctx.destination);
    this.music = ctx.createGain();
    this.music.gain.value = this.volumes.music;
    this.music.connect(this.master);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = this.volumes.sfx;
    this.sfx.connect(this.master);

    // Two seconds of white noise, reused by everything that hisses, rumbles or blows.
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    // --- fluoro buzz: mains hum at 100 Hz plus a thin fizz of its overtones ---
    this.buzz = this.bed(0);
    const fizz = ctx.createBiquadFilter();
    fizz.type = 'bandpass';
    fizz.frequency.value = 2900;
    fizz.Q.value = 0.9;
    fizz.connect(this.buzz);
    this.osc('sawtooth', 100, 0.5).connect(fizz);
    this.osc('square', 200, 0.25).connect(fizz);
    this.osc('sine', 100, 0.18).connect(this.buzz);

    // --- fridge hum: a low, slightly rough chord ---
    this.hum = this.bed(0);
    this.osc('sine', 50, 0.6).connect(this.hum);
    this.osc('sine', 99.3, 0.25).connect(this.hum);
    this.osc('triangle', 148, 0.06).connect(this.hum);

    // --- wind: noise through a band-pass filter that wanders ---
    this.wind = this.bed(0);
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 420;
    this.windFilter.Q.value = 0.7;
    this.windFilter.connect(this.wind);
    this.noiseSource().connect(this.windFilter);

    // --- drift drone: two low tones a few hertz apart, which "beat" against each other ---
    this.drone = this.bed(0);
    this.osc('sine', 49, 0.7).connect(this.drone);
    this.osc('sine', 52.4, 0.7).connect(this.drone);
    this.osc('triangle', 98.6, 0.12).connect(this.drone);
    // ...and a thin, sour high pair that only arrives when drift is high
    this.droneHigh = this.bed(0);
    this.osc('sine', 1244, 0.5).connect(this.droneHigh);
    this.osc('sine', 1318, 0.5).connect(this.droneHigh);

    // --- radio: static, and a bus for the song with a small-speaker filter ---
    this.staticBed = this.bed(0);
    const crackle = ctx.createBiquadFilter();
    crackle.type = 'bandpass';
    crackle.frequency.value = 1900;
    crackle.Q.value = 0.6;
    crackle.connect(this.staticBed);
    this.noiseSource().connect(crackle);

    // --- the score's pad: three sawtooth waves, heavily filtered so only a dark hum is left ---
    this.padGain = this.bed(0);
    const dark = ctx.createBiquadFilter();
    dark.type = 'lowpass';
    dark.frequency.value = 360;
    dark.Q.value = 0.6;
    dark.connect(this.padGain);
    // The pad is music, not an effect: move it to the music sub-mix.
    this.padGain.disconnect();
    this.padGain.connect(this.music);
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 110 * (i + 1);
      o.detune.value = (i - 1) * 7; // slightly out of tune with each other, so the pad shimmers
      o.connect(dark);
      o.start();
      this.pad.push(o);
    }

    // --- breathing: band-passed noise, swelled in and out by update() ---
    this.breathGain = this.bed(0);
    const throat = ctx.createBiquadFilter();
    throat.type = 'bandpass';
    throat.frequency.value = 640;
    throat.Q.value = 1.4;
    throat.connect(this.breathGain);
    this.noiseSource().connect(throat);

    this.songBus = ctx.createGain();
    this.songBus.gain.value = 0;
    const speaker = ctx.createBiquadFilter();
    speaker.type = 'bandpass';
    speaker.frequency.value = 1100;
    speaker.Q.value = 0.8;
    this.songBus.connect(speaker);
    speaker.connect(this.music);
  }

  // --- building blocks --------------------------------------------------------

  /** A volume control plugged into the master output. */
  private bed(volume: number): GainNode {
    const g = this.ctx!.createGain();
    g.gain.value = volume;
    g.connect(this.sfx);
    return g;
  }

  /** A tone that runs forever, with its own fixed volume. */
  private osc(type: OscillatorType, freq: number, volume: number): GainNode {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = volume;
    o.connect(g);
    o.start();
    return g;
  }

  private noiseSource(): AudioBufferSourceNode {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.start();
    return src;
  }

  /** Glide a volume towards a value. Gliding avoids the click you get from jumping. */
  private glide(node: GainNode, value: number, seconds = 0.3): void {
    node.gain.setTargetAtTime(value, this.ctx!.currentTime, seconds / 3);
  }

  /** One short tone that fades out and removes itself. The basis of most stings. */
  private ping(type: OscillatorType, freq: number, volume: number, seconds: number, at = 0, endFreq = freq, out: AudioNode = this.sfx): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (endFreq !== freq) o.frequency.exponentialRampToValueAtTime(endFreq, t + seconds);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + seconds + 0.05);
  }

  /** One short burst of filtered noise. */
  private hiss(filter: BiquadFilterType, freq: number, volume: number, seconds: number, at = 0, endFreq = freq): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, t);
    if (endFreq !== freq) f.frequency.exponentialRampToValueAtTime(endFreq, t + seconds);
    const g = ctx.createGain();
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfx);
    src.start(t, Math.random());
    src.stop(t + seconds + 0.05);
  }

  // --- what the game calls ----------------------------------------------------

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx) this.glide(this.master, muted ? 0 : this.volumes.master, 0.1);
  }

  /** Set the three volume sliders (each 0..1). Safe to call before start(). */
  setVolumes(master: number, music: number, sfx: number): void {
    this.volumes = { master, music, sfx };
    if (!this.ctx) return;
    this.glide(this.master, master, 0.1);
    this.glide(this.music, music, 0.1);
    this.glide(this.sfx, sfx, 0.1);
  }

  /** Called every logic step: steer the beds from the state of the game. */
  update(dt: number, s: AudioState): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const night = s.scene === 'night';

    // The tubes buzz while they are lit, and tick when they cut out.
    this.glide(this.buzz, night ? 0.022 * s.light : 0, 0.03);
    if (night && s.light < 0.6 && this.lastLight >= 0.6) this.sting('tick');
    this.lastLight = s.light;
    this.glide(this.hum, night ? 0.05 : 0, 1);

    // The drone swells with drift: felt before it is heard.
    const d = clamp(s.drift, 0, 1);
    this.glide(this.drone, night ? 0.02 + 0.2 * d * d : 0.03, 0.8);
    this.glide(this.droneHigh, night ? 0.012 * Math.max(0, d - 0.45) * 2 : 0, 0.8);

    // Wind: every few seconds pick a new strength and pitch to drift towards.
    this.windIn -= dt;
    if (this.windIn <= 0) {
      this.windIn = 2.5 + Math.random() * 4;
      const strength = s.scene === 'night' ? 0.03 + Math.random() * 0.05 : 0.07 + Math.random() * 0.07;
      this.wind.gain.setTargetAtTime(strength, ctx.currentTime, 1.5);
      this.windFilter.frequency.setTargetAtTime(280 + Math.random() * 500, ctx.currentTime, 2);
    }

    // Now and then, a truck somewhere down the pass.
    this.truckIn -= dt;
    if (this.truckIn <= 0) {
      this.truckIn = 50 + Math.random() * 60;
      if (night) this.truck();
    }

    // --- the score ---
    this.clock += dt;
    const sc = SCORES[s.score ?? 1] ?? SCORES[1];
    this.songDetune = sc.songDetune;
    this.songSlip = sc.songSlip;
    this.glide(this.padGain, night ? sc.pad : s.scene === 'end' ? 0.012 : 0, 2.5);
    this.chordIn -= dt;
    if (this.chordIn <= 0) {
      // Slide the three pad notes to the next chord over a couple of seconds.
      this.chordIn = sc.hold;
      const notes = sc.chords[this.chord++ % sc.chords.length];
      this.pad.forEach((o, i) => o.frequency.setTargetAtTime(sc.root * Math.pow(2, notes[i] / 12), ctx.currentTime, 1.6));
    }
    if (night) {
      this.bellIn -= dt;
      if (this.bellIn <= 0) {
        this.bellIn = sc.bellGap[0] + Math.random() * (sc.bellGap[1] - sc.bellGap[0]);
        const note = sc.bells[Math.floor(Math.random() * sc.bells.length)];
        const hz = sc.root * 8 * Math.pow(2, note / 12);
        this.ping('sine', hz, 0.028, 4, 0, hz, this.music);
        this.ping('sine', hz * 2.01, 0.008, 2.5, 0, hz * 2.01, this.music); // a faint, slightly sour overtone
      }
      if (sc.pulse > 0) {
        this.pulseIn -= dt * (1 + d * 1.5); // the heartbeat quickens with drift
        if (this.pulseIn <= 0) {
          this.pulseIn = sc.pulse;
          this.ping('sine', 52, 0.2, 0.22, 0, 36);
          this.ping('sine', 46, 0.14, 0.24, 0.26, 32);
        }
      }
      if (sc.scrape > 0) {
        this.scrapeIn -= dt;
        if (this.scrapeIn <= 0) {
          this.scrapeIn = sc.scrape * (0.5 + Math.random());
          this.hiss('bandpass', 420, 0.03, 2.8, 0, 2600); // something metal dragged a long way off
        }
      }
    }
    // Breathing: in for about two seconds, out for about two.
    const breath = clamp(s.breath ?? 0, 0, 1);
    const swell = Math.pow(Math.max(0, Math.sin(this.clock * 1.5)), 2);
    this.glide(this.breathGain, night ? 0.07 * breath * swell : 0, 0.12);

    // The song: schedule notes a little ahead of time so the rhythm stays even.
    if (this.songOn) {
      while (this.nextBeat < ctx.currentTime + 0.25) {
        this.songBeat(this.nextBeat - ctx.currentTime);
        this.nextBeat += BEAT;
        this.beat++;
      }
    }
  }

  private truck(): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(62, t);
    o.frequency.linearRampToValueAtTime(48, t + 9); // the pitch falls as it passes
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 160;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 9);
    o.connect(f);
    f.connect(g);
    g.connect(this.sfx);
    o.start(t);
    o.stop(t + 9.2);
  }

  private songBeat(at: number): void {
    const bar = SONG[Math.floor(this.beat / 3) % SONG.length];
    const inBar = this.beat % 3;
    // On later nights the song plays flatter, and now and then a note comes out a semitone wrong.
    const slip = () => (Math.random() < this.songSlip ? (Math.random() < 0.5 ? -1 : 1) : 0);
    const hz = (semi: number) => 220 * Math.pow(2, (semi + slip() + this.songDetune / 100) / 12);
    // "Wow": old tape drags and recovers, so every note is bent a little differently.
    const wow = 1 + 0.012 * Math.sin(this.beat * 0.9);
    if (inBar === 0) {
      this.ping('triangle', hz(bar[0]) * wow, 0.5, BEAT * 2.6, at, hz(bar[0]) * wow * 0.996, this.songBus);
      this.ping('sine', hz(bar[3]) * wow, 0.4, BEAT * 2.8, at, hz(bar[3]) * wow * 1.004, this.songBus);
    } else {
      this.ping('sine', hz(bar[inBar]) * wow, 0.22, BEAT * 1.2, at, hz(bar[inBar]) * wow, this.songBus);
    }
  }

  /** Start or stop the radio song. */
  song(on: boolean): void {
    this.songOn = on;
    if (!this.ctx) return;
    if (on) {
      this.nextBeat = this.ctx.currentTime + 0.1;
      this.beat = 0;
    }
    this.glide(this.songBus, on ? 0.5 : 0, on ? 1.5 : 2.5);
    this.glide(this.staticBed, on ? 0.006 : 0, 1);
  }

  /** Radio static while a broadcast is coming through. */
  radio(on: boolean): void {
    if (!this.ctx) return;
    if (on) this.sting('static');
    this.glide(this.staticBed, on ? 0.02 : this.songOn ? 0.006 : 0, 0.2);
  }

  /**
   * Footsteps crossing the shop floor: towards the counter (getting louder) or
   * away from it (getting quieter).
   */
  steps(approaching: boolean, count = 5, gap = 0.44): void {
    if (!this.ctx) return;
    for (let i = 0; i < count; i++) {
      const near = approaching ? (i + 1) / count : 1 - i / count;
      this.ping('sine', 96 + (i % 2) * 9, 0.05 + 0.11 * near, 0.09, i * gap, 58);
      this.hiss('lowpass', 900, 0.02 + 0.05 * near, 0.05, i * gap);
    }
  }

  /** One blip of "speech". Each speaker has their own pitch; the radio hisses instead. */
  voice(who: Who, pitch = 0): void {
    if (!this.ctx) return;
    const wobble = 1 + (Math.random() - 0.5) * 0.12;
    switch (who) {
      case 'wren':
        this.ping('triangle', 330 * wobble, 0.05, 0.07);
        break;
      case 'you':
        this.ping('sine', 196 * wobble, 0.035, 0.06);
        break;
      case 'radio':
        this.hiss('bandpass', 1500 + Math.random() * 900, 0.05, 0.05);
        break;
      case 'narration':
        break; // narration is silent: it is in your head
      default:
        this.ping('square', (150 + pitch * 110) * wobble, 0.022, 0.055);
    }
  }

  sting(name: Sting): void {
    if (!this.ctx) return;
    switch (name) {
      case 'hover': // the pointer moving onto a button: barely there
        this.ping('sine', 880, 0.008, 0.03);
        break;
      case 'boom': // a revelation: one low hit with a long tail
        this.ping('sine', 58, 0.5, 2.6, 0, 27);
        this.hiss('lowpass', 240, 0.25, 1.2);
        break;
      case 'rise': // dread arriving: a cluster of notes sliding upwards
        this.ping('sawtooth', 98, 0.05, 3, 0, 196);
        this.ping('sawtooth', 104, 0.05, 3, 0, 220);
        this.ping('sine', 1244, 0.02, 3, 0, 1480);
        break;
      case 'chime': // the electronic door chime: two falling notes
        this.ping('triangle', 1319, 0.07, 0.5);
        this.ping('triangle', 1047, 0.07, 0.8, 0.28);
        break;
      case 'bell': // the bell over the door
        this.ping('sine', 1568, 0.11, 1.4);
        this.ping('sine', 2349, 0.06, 0.9);
        this.ping('triangle', 784, 0.04, 0.5);
        break;
      case 'click':
        this.ping('square', 520, 0.02, 0.035);
        break;
      case 'glass': // knuckles on the shop window: sharper than the storeroom door
        for (let i = 0; i < 3; i++) {
          this.ping('sine', 410, 0.16, 0.09, i * 0.5, 300);
          this.hiss('highpass', 1800, 0.07, 0.04, i * 0.5);
        }
        break;
      case 'tear': // the picture tearing
        this.hiss('bandpass', 3200, 0.05, 0.12, 0, 900);
        break;
      case 'tick': // a tube cutting out
        this.hiss('highpass', 5000, 0.03, 0.03);
        break;
      case 'static':
        this.hiss('bandpass', 900, 0.09, 0.45, 0, 3200);
        break;
      case 'knock': // three knocks from somewhere solid
        for (let i = 0; i < 3; i++) {
          this.ping('sine', 92, 0.32, 0.22, i * 0.42, 54);
          this.hiss('lowpass', 420, 0.16, 0.08, i * 0.42);
        }
        break;
      case 'thud':
        this.ping('sine', 70, 0.3, 0.35, 0, 38);
        this.hiss('lowpass', 300, 0.12, 0.12);
        break;
      case 'photo': // card turned over, a pin pushed in
        this.hiss('highpass', 2600, 0.06, 0.09);
        this.ping('square', 1900, 0.015, 0.03, 0.14);
        break;
      case 'break': // the mask slipping: a sour cluster falling in pitch
        this.ping('sawtooth', 220, 0.09, 1.6, 0, 61);
        this.ping('sawtooth', 233, 0.09, 1.6, 0, 58);
        this.ping('square', 466, 0.03, 1.2, 0, 104);
        this.hiss('bandpass', 2400, 0.12, 1.3, 0, 300);
        break;
      case 'gore': // something wet, behind a door
        this.hiss('lowpass', 1400, 0.25, 0.7, 0, 180);
        this.hiss('bandpass', 700, 0.14, 0.25, 0.18);
        this.ping('sine', 60, 0.3, 0.6, 0.05, 34);
        break;
    }
  }
}
