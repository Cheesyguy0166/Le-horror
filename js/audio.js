'use strict';
// Marrow House - procedural audio. Nothing is sampled; every sound is synthesized.
(function (MH) {
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.volume = 0.85;
      this.loops = [];
      this.ambNodes = null;
      this.ambType = null;
      this.fear = 0;
      this.nextBeat = 0;
      this.nextAmbEvent = 0;
      this.listener = [0, 0, 0];
    }

    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = (this.ctx = new AC());
      this.master = ctx.createGain();
      this.master.gain.value = this.volume;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2;
      this.master.connect(comp); comp.connect(ctx.destination);
      this.sfx = this._gain(1, this.master);
      this.amb = this._gain(0.9, this.master);
      this.music = this._gain(0.8, this.master);
      this.verb = ctx.createConvolver();
      this.wet = this._gain(0.25);
      this.wet.connect(this.verb);
      this.verbOut = this._gain(0.9, this.master);
      this.verb.connect(this.verbOut);
      this.setReverb(1.6);
      const sr = ctx.sampleRate;
      this.noiseBuf = ctx.createBuffer(1, sr * 2, sr);
      const nd = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      this.brownBuf = ctx.createBuffer(1, sr * 4, sr);
      const bd = this.brownBuf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < bd.length; i++) {
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        bd[i] = last * 3.5;
      }
      this.distCurve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) {
        const x = (i / 1023) * 2 - 1;
        this.distCurve[i] = Math.tanh(x * 4);
      }
      this.chase = this._buildChase();
    }

    get t() { return this.ctx ? this.ctx.currentTime : 0; }

    setVolume(v) {
      this.volume = v;
      if (this.master) this.master.gain.setTargetAtTime(v, this.t, 0.05);
    }

    setReverb(seconds, wet) {
      if (!this.ctx) return;
      const ctx = this.ctx, sr = ctx.sampleRate, len = Math.floor(sr * seconds);
      const buf = ctx.createBuffer(2, len, sr);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
      }
      this.verb.buffer = buf;
      if (wet != null) this.wet.gain.setTargetAtTime(wet, this.t, 0.3);
    }

    _gain(v, dest) {
      const g = this.ctx.createGain();
      g.gain.value = v;
      if (dest) g.connect(dest);
      return g;
    }

    setListener(x, y, z, fx, fy, fz) {
      this.listener = [x, y, z];
      if (!this.ctx) return;
      const L = this.ctx.listener;
      if (L.positionX) {
        const t = this.t;
        L.positionX.setValueAtTime(x, t); L.positionY.setValueAtTime(y, t); L.positionZ.setValueAtTime(z, t);
        L.forwardX.setValueAtTime(fx, t); L.forwardY.setValueAtTime(fy, t); L.forwardZ.setValueAtTime(fz, t);
        L.upX.setValueAtTime(0, t); L.upY.setValueAtTime(1, t); L.upZ.setValueAtTime(0, t);
      } else {
        L.setPosition(x, y, z);
        L.setOrientation(fx, fy, fz, 0, 1, 0);
      }
    }

    // output node: positioned (panner) or flat
    _out(pos, wetAmt) {
      const ctx = this.ctx;
      let node;
      if (pos) {
        const p = ctx.createPanner();
        p.panningModel = 'HRTF';
        p.distanceModel = 'inverse';
        p.refDistance = 1.2;
        p.maxDistance = 60;
        p.rolloffFactor = 1.3;
        if (p.positionX) {
          p.positionX.value = pos[0]; p.positionY.value = pos[1] == null ? 1 : pos[1]; p.positionZ.value = pos[2];
        } else p.setPosition(pos[0], pos[1] == null ? 1 : pos[1], pos[2]);
        node = p;
      } else node = ctx.createGain();
      node.connect(this.sfx);
      const send = this._gain(wetAmt == null ? 1 : wetAmt, this.wet);
      node.connect(send);
      return node;
    }

    // generic oscillator one-shot
    tone(o) {
      if (!this.ctx) return;
      const ctx = this.ctx, t = this.t + (o.at || 0);
      const osc = ctx.createOscillator();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.f, t);
      if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t + (o.glide || o.dur));
      if (o.detune) osc.detune.value = o.detune;
      const g = ctx.createGain();
      const a = o.a || 0.005, dur = o.dur || 0.2, peak = Math.max(0.0002, o.gain == null ? 0.2 : o.gain);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let src = osc;
      if (o.filter) {
        const f = ctx.createBiquadFilter();
        f.type = o.filter; f.frequency.value = o.ff || 1000; f.Q.value = o.q || 1;
        src.connect(f); src = f;
      }
      src.connect(g);
      g.connect(o.dest || this._out(o.pos, o.wet));
      osc.start(t); osc.stop(t + dur + 0.05);
      return osc;
    }

    // filtered noise one-shot
    noise(o) {
      if (!this.ctx) return;
      const ctx = this.ctx, t = this.t + (o.at || 0);
      const src = ctx.createBufferSource();
      src.buffer = o.brown ? this.brownBuf : this.noiseBuf;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = o.type || 'bandpass';
      f.frequency.setValueAtTime(o.f || 1000, t);
      if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + (o.dur || 0.2));
      f.Q.value = o.q || 1;
      const g = ctx.createGain();
      const a = o.a || 0.005, dur = o.dur || 0.2, peak = Math.max(0.0002, o.gain == null ? 0.2 : o.gain);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g);
      g.connect(o.dest || this._out(o.pos, o.wet));
      src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
    }

    // ---------------- player ----------------
    step(surface, vol) {
      if (!this.ctx) return;
      const v = vol == null ? 1 : vol;
      const p = [this.listener[0], 0.1, this.listener[2]];
      switch (surface) {
        case 'snow':
          this.noise({ f: 2200, q: 0.8, dur: 0.18, a: 0.03, gain: 0.16 * v, pos: p, wet: 0.2 });
          for (let i = 0; i < 3; i++) this.noise({ type: 'highpass', f: 3500, dur: 0.02, gain: 0.05 * v, at: 0.02 + i * 0.03, pos: p, wet: 0.1 });
          break;
        case 'dirt':
          this.noise({ type: 'lowpass', f: 700, dur: 0.13, gain: 0.25 * v, pos: p });
          break;
        case 'tile':
          this.noise({ f: 1800, q: 2, dur: 0.05, gain: 0.18 * v, pos: p });
          this.tone({ f: 190, f2: 150, dur: 0.05, gain: 0.08 * v, pos: p });
          break;
        case 'carpet':
          this.noise({ type: 'lowpass', f: 350, dur: 0.1, gain: 0.16 * v, pos: p });
          break;
        default: // wood
          this.noise({ f: 450, q: 1.2, dur: 0.09, gain: 0.22 * v, pos: p });
          this.tone({ f: 95, f2: 55, dur: 0.1, gain: 0.18 * v, pos: p });
          if (Math.random() < 0.12) this.creak(p, 0.06 * v);
      }
    }
    creak(pos, gain) {
      if (!this.ctx) return;
      const ctx = this.ctx, t = this.t, dur = 0.4 + Math.random() * 0.7;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      const base = 90 + Math.random() * 120;
      osc.frequency.setValueAtTime(base, t);
      for (let i = 1; i < 12; i++) osc.frequency.setValueAtTime(base * (0.85 + Math.random() * 0.4), t + (i / 12) * dur);
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 700 + Math.random() * 600; f.Q.value = 9;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain || 0.1, t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(f); f.connect(g); g.connect(this._out(pos, 1));
      osc.start(t); osc.stop(t + dur + 0.05);
    }
    whistle() {
      if (!this.ctx) return;
      const ctx = this.ctx, t = this.t;
      const seg = (at, f1, f2, f3, dur) => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(f1, t + at);
        o.frequency.linearRampToValueAtTime(f2, t + at + dur * 0.5);
        o.frequency.linearRampToValueAtTime(f3, t + at + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t + at);
        g.gain.exponentialRampToValueAtTime(0.09, t + at + 0.03);
        g.gain.setValueAtTime(0.09, t + at + dur - 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
        o.connect(g); g.connect(this._out(null, 0.5));
        o.start(t + at); o.stop(t + at + dur + 0.05);
      };
      seg(0, 1500, 1900, 2000, 0.16);
      seg(0.24, 1500, 2300, 1700, 0.38);
    }
    breathPlayer(intensity) {
      this.noise({ f: 900, q: 1.5, dur: 0.5, a: 0.15, gain: 0.04 * intensity });
    }

    // ---------------- dog ----------------
    bark(pos, n) {
      if (!this.ctx) return;
      n = n || 2;
      for (let i = 0; i < n; i++) {
        const at = i * (0.2 + Math.random() * 0.08);
        this.tone({ type: 'sawtooth', f: 480 + Math.random() * 60, f2: 240, dur: 0.14, a: 0.01, gain: 0.35, filter: 'bandpass', ff: 950, q: 1.3, pos, at });
        this.noise({ f: 1400, q: 1, dur: 0.1, gain: 0.2, pos, at });
        this.tone({ type: 'square', f: 250, f2: 160, dur: 0.1, gain: 0.08, filter: 'lowpass', ff: 700, pos, at });
      }
    }
    whine(pos) {
      if (!this.ctx) return;
      const ctx = this.ctx, t = this.t;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(760, t);
      o.frequency.linearRampToValueAtTime(1250, t + 0.3);
      o.frequency.linearRampToValueAtTime(820, t + 0.75);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.07, t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
      o.connect(g); g.connect(this._out(pos));
      o.start(t); o.stop(t + 0.85);
    }
    growl(pos, dur) {
      if (!this.ctx) return;
      const ctx = this.ctx, t = this.t;
      dur = dur || 1.3;
      const out = this._out(pos);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.28, t + 0.2);
      g.gain.setValueAtTime(0.28, t + dur - 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 2;
      const am = ctx.createGain();
      am.gain.value = 0.5;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 24 + Math.random() * 6;
      const lfoG = ctx.createGain(); lfoG.gain.value = 0.5;
      lfo.connect(lfoG); lfoG.connect(am.gain);
      for (const f of [72, 75.5]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = f + Math.random() * 6;
        o.connect(am); o.start(t); o.stop(t + dur + 0.1);
      }
      am.connect(lp); lp.connect(g); g.connect(out);
      lfo.start(t); lfo.stop(t + dur + 0.1);
    }
    pant(pos) {
      for (let i = 0; i < 4; i++) this.noise({ f: 1500, q: 1.2, dur: 0.1, a: 0.02, gain: 0.05, pos, at: i * 0.22 });
    }

    // ---------------- creature ----------------
    shriek(pos, loud) {
      if (!this.ctx) return;
      const ctx = this.ctx, t = this.t, dur = 1.6;
      const out = this._out(pos, 1.2);
      const ws = ctx.createWaveShaper();
      ws.curve = this.distCurve;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.setValueAtTime(1100, t); bp.frequency.linearRampToValueAtTime(2200, t + dur); bp.Q.value = 0.9;
      const g = ctx.createGain();
      const peak = loud ? 0.9 : 0.5;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.06);
      g.gain.setValueAtTime(peak, t + dur * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      for (const base of [520, 557, 830, 1245]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(base * 0.7, t);
        o.frequency.exponentialRampToValueAtTime(base * 1.25, t + 0.25);
        for (let i = 1; i < 14; i++) o.frequency.setValueAtTime(base * (1.1 + Math.random() * 0.3), t + 0.25 + i * 0.09);
        o.frequency.exponentialRampToValueAtTime(base * 0.6, t + dur);
        o.connect(ws); o.start(t); o.stop(t + dur + 0.05);
      }
      ws.connect(bp); bp.connect(g); g.connect(out);
      this.noise({ type: 'highpass', f: 2500, dur: dur * 0.8, a: 0.05, gain: peak * 0.35, pos, wet: 1 });
    }
    cstep(pos) {
      this.tone({ f: 60, f2: 32, dur: 0.18, gain: 0.35, pos });
      this.noise({ type: 'lowpass', f: 300, dur: 0.14, gain: 0.3, pos });
      if (Math.random() < 0.3) this.noise({ type: 'highpass', f: 3000, dur: 0.015, gain: 0.12, pos, at: 0.05 });
    }
    clicks(pos, n) {
      n = n || 10 + ((Math.random() * 8) | 0);
      let at = 0;
      for (let i = 0; i < n; i++) {
        at += 0.035 + Math.random() * 0.09;
        this.noise({ f: 2600 + Math.random() * 1200, q: 6, dur: 0.018, a: 0.001, gain: 0.35, pos, at, wet: 1 });
      }
    }
    breath(pos) {
      this.noise({ f: 650, f2: 1150, q: 3, dur: 1.1, a: 0.5, gain: 0.14, pos });
      this.noise({ f: 1100, f2: 420, q: 3, dur: 1.4, a: 0.2, gain: 0.12, pos, at: 1.2 });
    }
    // wordless "voice" - a formant-filtered buzz that almost sounds like speech
    voice(pos, dur, deep, phone) {
      if (!this.ctx) return;
      const ctx = this.ctx, t = this.t;
      dur = dur || 2.5;
      const out = phone ? this._out(null, 0.2) : this._out(pos, 1.3);
      const src = ctx.createOscillator();
      src.type = 'sawtooth';
      const f0 = deep ? 68 : 185;
      src.frequency.setValueAtTime(f0, t);
      const syll = Math.max(3, Math.floor(dur * 3.2));
      for (let i = 1; i <= syll; i++) {
        const tt = t + (i / syll) * dur;
        src.frequency.linearRampToValueAtTime(f0 * (0.85 + Math.random() * 0.35) * (i === syll ? 0.7 : 1), tt);
      }
      const vib = ctx.createOscillator();
      vib.frequency.value = 5.5;
      const vibG = ctx.createGain(); vibG.gain.value = deep ? 3 : 7;
      vib.connect(vibG); vibG.connect(src.frequency);
      const mixG = ctx.createGain();
      mixG.gain.setValueAtTime(0.0001, t);
      const peak = phone ? 0.5 : deep ? 0.55 : 0.35;
      const env = mixG.gain;
      env.exponentialRampToValueAtTime(peak, t + 0.08);
      for (let i = 1; i <= syll; i++) {
        const tt = t + (i / syll) * dur;
        env.linearRampToValueAtTime(peak * (0.25 + Math.random() * 0.75), tt - 0.12);
        env.linearRampToValueAtTime(peak * 0.15, tt - 0.03);
      }
      env.exponentialRampToValueAtTime(0.0001, t + dur + 0.1);
      const vowels = [[700, 1200, 2500], [400, 2000, 2600], [300, 900, 2300], [600, 1000, 2400], [450, 1700, 2500]];
      for (let k = 0; k < 3; k++) {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.Q.value = 7;
        bp.frequency.setValueAtTime(vowels[0][k], t);
        for (let i = 1; i <= syll; i++) {
          const v = vowels[(Math.random() * vowels.length) | 0];
          bp.frequency.linearRampToValueAtTime(v[k] * (deep ? 0.8 : 1), t + (i / syll) * dur);
        }
        const g = ctx.createGain(); g.gain.value = [1, 0.7, 0.35][k];
        src.connect(bp); bp.connect(g); g.connect(mixG);
      }
      let last = mixG;
      if (deep) {
        const ws = ctx.createWaveShaper(); ws.curve = this.distCurve;
        mixG.connect(ws); last = ws;
      }
      if (phone) {
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 350;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000;
        last.connect(hp); hp.connect(lp); last = lp;
        this.noise({ type: 'bandpass', f: 2000, q: 0.5, dur: dur + 0.3, a: 0.05, gain: 0.05 });
      }
      last.connect(out);
      src.start(t); vib.start(t);
      src.stop(t + dur + 0.2); vib.stop(t + dur + 0.2);
    }

    // ---------------- world ----------------
    doorOpen(pos) {
      this.noise({ type: 'highpass', f: 2500, dur: 0.03, gain: 0.15, pos });
      this.creak(pos, 0.13);
    }
    doorClose(pos, slam) {
      this.tone({ f: slam ? 90 : 75, f2: 40, dur: slam ? 0.4 : 0.22, gain: slam ? 0.6 : 0.3, pos, wet: slam ? 1.5 : 1 });
      this.noise({ type: 'lowpass', f: slam ? 900 : 500, dur: slam ? 0.3 : 0.15, gain: slam ? 0.5 : 0.25, pos, wet: 1.5 });
      this.noise({ type: 'highpass', f: 2500, dur: 0.03, gain: 0.12, pos, at: 0.02 });
    }
    locked(pos) {
      for (let i = 0; i < 3; i++) this.noise({ f: 1800, q: 4, dur: 0.04, gain: 0.18, pos, at: i * 0.09 });
    }
    knock(pos, n) {
      for (let i = 0; i < (n || 2); i++) {
        const at = i * 0.5;
        this.tone({ f: 130, f2: 60, dur: 0.14, gain: 0.55, pos, at, wet: 1.4 });
        this.noise({ f: 320, q: 1.5, dur: 0.1, gain: 0.45, pos, at, wet: 1.4 });
      }
    }
    phoneRing(pos) {
      if (!this.ctx) return;
      const ctx = this.ctx, t = this.t, dur = 1.8;
      const out = this._out(pos, 0.6);
      const g = ctx.createGain();
      g.gain.value = 0;
      const lfo = ctx.createOscillator();
      lfo.type = 'square'; lfo.frequency.value = 20;
      const lg = ctx.createGain(); lg.gain.value = 0.09;
      lfo.connect(lg); lg.connect(g.gain);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(1, t + 0.02);
      env.gain.setValueAtTime(1, t + dur - 0.05);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      for (const f of [440, 480, 1300]) {
        const o = ctx.createOscillator(); o.type = f > 1000 ? 'triangle' : 'sine'; o.frequency.value = f;
        o.connect(g); o.start(t); o.stop(t + dur + 0.05);
      }
      g.connect(env); env.connect(out);
      lfo.start(t); lfo.stop(t + dur + 0.05);
    }
    bell(pos) {
      const parts = [[1, 0.45, 4.5], [2.0, 0.28, 3.2], [2.76, 0.22, 2.4], [5.4, 0.12, 1.4], [8.93, 0.07, 0.9]];
      for (const [r, g, d] of parts) this.tone({ f: 520 * r, dur: d, a: 0.002, gain: g, pos, wet: 1.6 });
      this.noise({ type: 'highpass', f: 5000, dur: 0.04, gain: 0.2, pos });
    }
    chainBreak(pos) {
      for (let i = 0; i < 6; i++) {
        const at = i * 0.07 + Math.random() * 0.05;
        this.tone({ f: 900 + Math.random() * 1600, dur: 0.25, a: 0.001, gain: 0.25, pos, at, wet: 1.3 });
        this.noise({ f: 3000, q: 3, dur: 0.05, gain: 0.3, pos, at });
      }
      this.doorClose(pos, true);
      this.tone({ f: 70, f2: 30, dur: 0.8, gain: 0.7, pos, at: 0.25, wet: 1.5 });
    }
    powerDown() {
      this.tone({ type: 'sawtooth', f: 120, f2: 18, dur: 1.4, a: 0.01, gain: 0.25, filter: 'lowpass', ff: 400 });
      this.noise({ type: 'highpass', f: 3000, dur: 0.05, gain: 0.3 });
      this.stopHum();
    }
    pickup() {
      this.tone({ type: 'triangle', f: 660, dur: 0.4, gain: 0.12 });
      this.tone({ type: 'triangle', f: 990, dur: 0.6, gain: 0.1, at: 0.09 });
    }
    paper() {
      for (let i = 0; i < 4; i++) this.noise({ f: 3500 + Math.random() * 2000, q: 0.7, dur: 0.07, gain: 0.08, at: i * 0.05 });
    }
    click() { this.noise({ type: 'highpass', f: 2000, dur: 0.02, gain: 0.12 }); }
    flashClick() {
      this.noise({ f: 2500, q: 3, dur: 0.02, gain: 0.15 });
      this.tone({ type: 'square', f: 900, dur: 0.02, gain: 0.03 });
    }
    drip(pos) {
      const f = 1400 + Math.random() * 1400;
      this.tone({ f, f2: f * 0.55, dur: 0.12, a: 0.002, gain: 0.08, pos, wet: 2 });
    }
    thud(pos, gain) {
      this.tone({ f: 70, f2: 30, dur: 0.5, gain: gain || 0.5, pos, wet: 1.5 });
      this.noise({ type: 'lowpass', f: 400, dur: 0.3, gain: (gain || 0.5) * 0.8, pos, wet: 1.5 });
    }
    stinger(level) {
      if (!this.ctx) return;
      const lv = level == null ? 1 : level;
      const ctx = this.ctx, t = this.t;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(300, t);
      lp.frequency.exponentialRampToValueAtTime(3500, t + 0.15);
      lp.frequency.exponentialRampToValueAtTime(250, t + 2.5);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22 * lv, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
      for (const f of [98, 104, 146.8, 155.6, 207.6, 311]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 30;
        o.connect(lp); o.start(t); o.stop(t + 2.9);
      }
      lp.connect(g); g.connect(this._out(null, 1.2));
      this.tone({ f: 55, f2: 28, dur: 1.5, gain: 0.5 * lv });
      this.noise({ type: 'highpass', f: 1500, f2: 6000, dur: 0.6, a: 0.01, gain: 0.12 * lv });
    }
    jumpscare() {
      this.shriek(null, true);
      this.stinger(1.3);
      this.noise({ type: 'lowpass', f: 3000, dur: 1.2, a: 0.01, gain: 0.5 });
    }

    // ---------------- loops ----------------
    _loopNoise(buf, filterType, f, q, gain, pos) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const fl = ctx.createBiquadFilter(); fl.type = filterType; fl.frequency.value = f; fl.Q.value = q;
      const g = this._gain(0);
      g.gain.setTargetAtTime(gain, this.t, 0.3);
      src.connect(fl); fl.connect(g);
      g.connect(pos ? this._out(pos, 0.6) : this.amb);
      src.start();
      return { src, g, fl, stop: () => { g.gain.setTargetAtTime(0, this.t, 0.2); setTimeout(() => { try { src.stop(); } catch (e) { /* stopped */ } }, 1500); } };
    }
    tvStatic(pos) {
      if (!this.ctx) return { stop() {} };
      return this._loopNoise(this.noiseBuf, 'bandpass', 3200, 0.4, 0.14, pos);
    }
    startHum() {
      if (!this.ctx || this.hum) return;
      const ctx = this.ctx;
      const g = this._gain(0, this.amb);
      g.gain.setTargetAtTime(0.03, this.t, 0.5);
      const oscs = [60, 120, 180].map((f, i) => {
        const o = ctx.createOscillator(); o.frequency.value = f;
        const og = this._gain([1, 0.5, 0.2][i], g); o.connect(og); o.start(); return o;
      });
      this.hum = { g, oscs };
    }
    stopHum() {
      if (!this.hum) return;
      const h = this.hum;
      this.hum = null;
      h.g.gain.setTargetAtTime(0, this.t, 0.15);
      setTimeout(() => h.oscs.forEach((o) => { try { o.stop(); } catch (e) { /* ok */ } }), 1200);
    }

    // Music box: schedules its melody while playing
    musicBox(pos) {
      const self = this;
      const mel = [[76, 1], [81, 1], [83, 1], [84, 2], [83, 1], [81, 1], [76, 2], [0, 1], [77, 1], [81, 1], [79, 1], [76, 3],
        [74, 1], [76, 1], [77, 1], [76, 1], [74, 1], [72, 1], [71, 1], [69, 3], [0, 2]];
      const box = {
        pos, idx: 0, next: this.t + 0.2, beat: 0.42, alive: true,
        tick(now) {
          if (!this.alive) return false;
          while (this.next < now + 0.25) {
            const [m, b] = mel[this.idx];
            if (m) {
              const at = this.next - now;
              const f = mtof(m) * Math.pow(2, ((Math.random() - 0.5) * 30) / 1200);
              self.tone({ type: 'triangle', f, dur: 1.3, a: 0.004, gain: 0.1, pos: this.pos, at, wet: 1.2 });
              self.tone({ type: 'sine', f: f * 2.01, dur: 0.6, a: 0.002, gain: 0.04, pos: this.pos, at });
            }
            this.next += b * this.beat;
            this.idx++;
            if (this.idx >= mel.length) { this.idx = 0; this.beat *= 1.06; }
          }
          return true;
        },
        stop() { this.alive = false; },
      };
      this.loops.push(box);
      return box;
    }
    clock(pos) {
      const self = this;
      const c = {
        next: this.t + 0.5, tock: false, alive: true,
        tick(now) {
          if (!this.alive) return false;
          while (this.next < now + 0.2) {
            self.noise({ f: this.tock ? 2200 : 2900, q: 12, dur: 0.035, a: 0.001, gain: 0.22, pos, at: this.next - now });
            self.tone({ f: this.tock ? 800 : 1000, dur: 0.03, gain: 0.03, pos, at: this.next - now });
            this.tock = !this.tock;
            this.next += 1.0;
          }
          return true;
        },
        stop() { this.alive = false; },
      };
      this.loops.push(c);
      return c;
    }

    _buildChase() {
      const ctx = this.ctx;
      const g = this._gain(0, this.music);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
      const trem = ctx.createGain(); trem.gain.value = 0.6;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 7;
      const lg = ctx.createGain(); lg.gain.value = 0.4;
      lfo.connect(lg); lg.connect(trem.gain); lfo.start();
      for (const f of [55, 58.3, 82.4]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start();
      }
      lp.connect(trem); trem.connect(g);
      const hi = ctx.createBiquadFilter(); hi.type = 'bandpass'; hi.frequency.value = 1800; hi.Q.value = 12;
      const hg = this._gain(0.25, g);
      for (const f of [1760, 1864.7]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(hi); o.start();
      }
      hi.connect(hg);
      return g;
    }
    setChase(v) {
      if (!this.ctx) return;
      this.chase.gain.setTargetAtTime(v * 0.28, this.t, v > 0 ? 0.3 : 1.2);
    }
    setFear(v) { this.fear = v; }

    setAmbience(type) {
      if (!this.ctx || type === this.ambType) return;
      this.ambType = type;
      if (this.ambNodes) this.ambNodes.forEach((n) => n.stop());
      this.ambNodes = [];
      const ctx = this.ctx, A = this.ambNodes;
      const lfoTo = (param, rate, depth) => {
        const l = ctx.createOscillator(); l.frequency.value = rate;
        const lg = ctx.createGain(); lg.gain.value = depth;
        l.connect(lg); lg.connect(param); l.start();
        A.push({ stop: () => setTimeout(() => { try { l.stop(); } catch (e) { /* ok */ } }, 1500) });
      };
      const drone = (freqs, gain) => {
        const g = this._gain(0, this.amb);
        g.gain.setTargetAtTime(gain, this.t, 1);
        const os = freqs.map((f) => { const o = ctx.createOscillator(); o.frequency.value = f; o.connect(g); o.start(); return o; });
        A.push({ stop: () => { g.gain.setTargetAtTime(0, this.t, 0.4); setTimeout(() => os.forEach((o) => { try { o.stop(); } catch (e) { /* ok */ } }), 2000); } });
        return g;
      };
      if (type === 'wind' || type === 'title') {
        const w = this._loopNoise(this.brownBuf, 'bandpass', 500, 0.6, type === 'title' ? 0.35 : 0.55);
        lfoTo(w.fl.frequency, 0.07, 250);
        lfoTo(w.g.gain, 0.11, 0.18);
        A.push(w);
        A.push(this._loopNoise(this.noiseBuf, 'highpass', 5000, 0.5, 0.012));
        if (type === 'title') drone([41, 43.2, 61.7], 0.05);
        this.setReverb(1.2, 0.1);
      } else if (type === 'house') {
        A.push(this._loopNoise(this.brownBuf, 'lowpass', 180, 0.7, 0.2));
        A.push(this._loopNoise(this.brownBuf, 'bandpass', 380, 0.8, 0.07));
        drone([46, 47.3], 0.02);
        this.setReverb(1.5, 0.22);
      } else if (type === 'attic') {
        const w = this._loopNoise(this.brownBuf, 'lowpass', 260, 0.6, 0.35);
        lfoTo(w.g.gain, 0.09, 0.15);
        A.push(w);
        drone([52, 54.5], 0.03);
        this.setReverb(1.0, 0.18);
      } else if (type === 'cellar') {
        A.push(this._loopNoise(this.brownBuf, 'lowpass', 160, 0.8, 0.3));
        drone([36.7, 38.9, 55], 0.06);
        this.setReverb(3.2, 0.45);
      } else if (type === 'morning') {
        const w = this._loopNoise(this.brownBuf, 'bandpass', 700, 0.5, 0.18);
        lfoTo(w.g.gain, 0.08, 0.06);
        A.push(w);
        const pad = drone([220, 277.2, 329.6, 440, 554.4], 0.012);
        lfoTo(pad.gain, 0.2, 0.004);
        this.setReverb(2.5, 0.2);
      }
    }

    update(dt, env) {
      if (!this.ctx) return;
      const now = this.t;
      this.loops = this.loops.filter((l) => l.tick(now));
      // heartbeat
      if (this.fear > 0.25 && now >= this.nextBeat) {
        const rate = 0.95 - this.fear * 0.5;
        const g = 0.12 + this.fear * 0.35;
        this.tone({ f: 58, f2: 36, dur: 0.16, gain: g, dest: this.music });
        this.tone({ f: 52, f2: 34, dur: 0.14, gain: g * 0.6, at: 0.24, dest: this.music });
        this.nextBeat = now + rate;
      }
      // ambient random events
      if (now >= this.nextAmbEvent && env) {
        const L = this.listener;
        const around = () => {
          const a = Math.random() * Math.PI * 2, d = 4 + Math.random() * 8;
          return [L[0] + Math.cos(a) * d, 1 + Math.random() * 1.5, L[2] + Math.sin(a) * d];
        };
        if (this.ambType === 'house' || this.ambType === 'attic') {
          this.creak(around(), 0.05 + Math.random() * 0.06);
          this.nextAmbEvent = now + 5 + Math.random() * 12;
        } else if (this.ambType === 'cellar') {
          this.drip(around());
          if (Math.random() < 0.08) this.creak(around(), 0.05);
          this.nextAmbEvent = now + 0.8 + Math.random() * 3;
        } else if (this.ambType === 'wind') {
          if (Math.random() < 0.3) this.creak(around(), 0.03);
          this.nextAmbEvent = now + 6 + Math.random() * 10;
        } else this.nextAmbEvent = now + 5;
      }
    }
  }

  MH.Audio = new AudioEngine();
})(window.MH);
