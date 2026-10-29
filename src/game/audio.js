/**
 * revEarth — all sound, synthesised live with WebAudio. No asset files.
 *
 * Two scores that crossfade with the story:
 *
 *   calm     the living present. A slow dreamy pad (Dmaj9 → Bm11 → Gmaj7#11 →
 *            Aadd9), soft pentatonic bells drifting in a long reverb, a warm low
 *            drone and cold airy wind.
 *   tension  the collapsed future. A detuned minor-second drone grinding under a
 *            breathing low-pass, a thin tritone whine high up, metal scrapes,
 *            clustered string swells, whispers and a heartbeat that quickens as
 *            the ghosts close in.
 *
 * Plus the world: snow crunch or mud squelch per footfall, surf hiss, one
 * voice per power, the collapse boom, ghost moans and lunge stingers, chimes
 * when damage is undone. M mutes.
 */

/** Reverb send and echo send for each way an animal's call can be heard. */
const VOICE_MODES = {
    ghost: { wet: 0.9, echo: 0.5 },
    calm: { wet: 0.7, echo: 0.15 },
    alive: { wet: 0.35, echo: 0 },
};

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

// Pad voicings (MIDI). Dmaj9, Bm11, Gmaj7#11, Aadd9 — open, unresolved, bright.
const CHORDS = [
    [50, 57, 62, 66, 69, 76],
    [47, 54, 62, 64, 69, 74],
    [43, 50, 59, 61, 66, 71],
    [45, 52, 59, 61, 64, 71],
];
// D major pentatonic, upper register, for the bells.
const BELLS = [74, 76, 78, 81, 83, 86, 88, 90];
const CHORD_SECONDS = 9;

export class GameAudio {
    constructor() {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        const ctx = this.ctx;

        // ------------------------------------------------------------- buses
        this.master = ctx.createGain();
        this.master.gain.value = 0.85;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16;
        comp.ratio.value = 3.5;
        this.master.connect(comp).connect(ctx.destination);

        this.reverb = ctx.createConvolver();
        this.reverb.buffer = this._impulse(4.5, 2.6);
        this.reverbOut = ctx.createGain();
        this.reverbOut.gain.value = 0.55;
        this.reverb.connect(this.reverbOut).connect(this.master);

        this.calm = this._bus(0);
        this.tension = this._bus(0);
        this.sfx = this._bus(0.9);
        this.amb = this._bus(0.6);

        this.noise = this._noiseBuffer(4);
        this.crackle = this._crackleBuffer(2);

        // A dark feedback echo the ghosts' cries trail into — a call that
        // comes back from somewhere it should not.
        this.echo = ctx.createDelay(1.0);
        this.echo.delayTime.value = 0.37;
        const fb = ctx.createGain();
        fb.gain.value = 0.42;
        const echoLp = ctx.createBiquadFilter();
        echoLp.type = "lowpass";
        echoLp.frequency.value = 1600;
        this.echo.connect(echoLp).connect(fb).connect(this.echo);
        echoLp.connect(this.sfx);

        this._muted = false;
        /** Music level under the narrator's voice. */
        this._duck = 1;
        /** @type {null | ((muted: boolean) => void)} */
        this.onMute = null;
        this._started = false;
        this._chordAt = 0;
        this._chordIx = 0;
        this._bellAt = 0;
        this._scrapeAt = 4;
        this._swellAt = 7;
        this._whisperAt = 3;
        this._beatAt = 0;
        this.mode = "calm";
        this.haunt = 0;
        this.pressure = 0;

        this._buildWind();
        this._buildSurf();
        this._buildDrone();

        const start = () => this.start();
        window.addEventListener("pointerdown", start);
        window.addEventListener("keydown", (e) => {
            if (e.code === "KeyM") this.toggleMute();
            start();
        });
    }

    // --------------------------------------------------------------- plumbing

    /**
     * A bus is a dry gain to the master plus its own reverb send. Both move
     * together, so fading a score out takes its reverb tail with it.
     */
    _bus(level) {
        const g = this.ctx.createGain();
        g.gain.value = level;
        g.connect(this.master);
        g.wet = this.ctx.createGain();
        g.wet.gain.value = level;
        g.wet.connect(this.reverb);
        return g;
    }

    _setBus(bus, level, t) {
        bus.gain.setTargetAtTime(level, t, 0.8);
        bus.wet.gain.setTargetAtTime(level, t, 0.8);
    }

    /** Send a node to a bus, with a share of it into that bus's reverb send. */
    _out(node, bus, wet = 0.3) {
        node.connect(bus);
        if (wet > 0) {
            const s = this.ctx.createGain();
            s.gain.value = wet;
            node.connect(s).connect(bus.wet);
        }
        return node;
    }

    _impulse(seconds, decay) {
        const ctx = this.ctx;
        const len = Math.floor(ctx.sampleRate * seconds);
        const buf = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) {
            const d = buf.getChannelData(c);
            for (let i = 0; i < len; i++) {
                d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
            }
        }
        return buf;
    }

    _noiseBuffer(seconds) {
        const ctx = this.ctx;
        const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        return buf;
    }

    /** Sparse clicks — the grain-on-grain crunch of compacting snow. */
    _crackleBuffer(seconds) {
        const ctx = this.ctx;
        const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) {
            d[i] = Math.random() < 0.06 ? (Math.random() * 2 - 1) : (Math.random() * 2 - 1) * 0.08;
        }
        return buf;
    }

    _src(buffer, loop = false) {
        const s = this.ctx.createBufferSource();
        s.buffer = buffer;
        s.loop = loop;
        return s;
    }

    _env(param, t, a, peak, d, floor = 0.0001) {
        param.cancelScheduledValues(t);
        param.setValueAtTime(floor, t);
        param.linearRampToValueAtTime(peak, t + a);
        param.exponentialRampToValueAtTime(floor, t + a + d);
    }

    _pan(x) {
        const p = this.ctx.createStereoPanner();
        p.pan.value = Math.max(-1, Math.min(1, x));
        return p;
    }

    get now() {
        return this.ctx.currentTime;
    }

    start() {
        if (this.ctx.state !== "running") this.ctx.resume();
        if (this._started) return;
        this._started = true;
        this.windSrc.start();
        this.surfSrc.start();
        this.droneOsc.forEach((o) => o.start());
        this._chordAt = this.now + 0.1;
        this._bellAt = this.now + 2;
        this._beatAt = this.now + 1;
    }

    toggleMute() {
        this._muted = !this._muted;
        this.master.gain.setTargetAtTime(this._muted ? 0 : 0.85, this.now, 0.1);
        this.onMute?.(this._muted);
    }

    /** Lower the music while the narrator speaks. */
    duck(on) {
        // A dip, not a drop: the score is part of the pressure and stays audible.
        this._duck = on ? 0.75 : 1;
    }

    // ------------------------------------------------------------- ambience

    _buildWind() {
        const ctx = this.ctx;
        this.windSrc = this._src(this.noise, true);
        this.windFilter = ctx.createBiquadFilter();
        this.windFilter.type = "bandpass";
        this.windFilter.frequency.value = 520;
        this.windFilter.Q.value = 0.6;
        this.windGain = ctx.createGain();
        this.windGain.gain.value = 0.18;
        this.windSrc.connect(this.windFilter).connect(this.windGain).connect(this.amb);
        this._gust = 0;
    }

    _buildSurf() {
        const ctx = this.ctx;
        this.surfSrc = this._src(this.noise, true);
        this.surfFilter = ctx.createBiquadFilter();
        this.surfFilter.type = "bandpass";
        this.surfFilter.frequency.value = 900;
        this.surfFilter.Q.value = 0.8;
        this.surfGain = ctx.createGain();
        this.surfGain.gain.value = 0;
        this.surfSrc.connect(this.surfFilter).connect(this.surfGain).connect(this.sfx);
    }

    /** The tension bed: a grinding cluster under a breathing low-pass. */
    _buildDrone() {
        const ctx = this.ctx;
        this.droneFilter = ctx.createBiquadFilter();
        this.droneFilter.type = "lowpass";
        this.droneFilter.frequency.value = 240;
        this.droneFilter.Q.value = 4;
        const g = ctx.createGain();
        g.gain.value = 0.16;
        this.droneFilter.connect(g);
        this._out(g, this.tension, 0.35);

        this.droneOsc = [];
        for (const [f, det, type] of [[36.7, 0, "sawtooth"], [38.9, 7, "sawtooth"], [55, -5, "sawtooth"], [73.4, 11, "square"]]) {
            const o = ctx.createOscillator();
            o.type = type;
            o.frequency.value = f;
            o.detune.value = det;
            const og = ctx.createGain();
            og.gain.value = type === "square" ? 0.25 : 0.5;
            o.connect(og).connect(this.droneFilter);
            this.droneOsc.push(o);
        }
        // A thin tritone whine, wavering, just at the edge of hearing.
        const whine = ctx.createGain();
        whine.gain.value = 0.012;
        this._out(whine, this.tension, 0.6);
        for (const f of [1244.5, 1760]) {
            const o = ctx.createOscillator();
            o.type = "sine";
            o.frequency.value = f;
            const lfo = ctx.createOscillator();
            lfo.frequency.value = 0.31 + f / 10000;
            const lg = ctx.createGain();
            lg.gain.value = 9;
            lfo.connect(lg).connect(o.detune);
            o.connect(whine);
            this.droneOsc.push(o, lfo);
        }
        // Calm bed: a soft low D under the pad.
        const low = ctx.createOscillator();
        low.type = "sine";
        low.frequency.value = midi(38);
        const lowG = ctx.createGain();
        lowG.gain.value = 0.05;
        low.connect(lowG);
        this._out(lowG, this.calm, 0.2);
        this.droneOsc.push(low);
    }

    // ------------------------------------------------------------ calm score

    _padChord(t, notes) {
        const ctx = this.ctx;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 1300;
        const g = ctx.createGain();
        lp.connect(g);
        this._out(g, this.calm, 0.7);
        const life = CHORD_SECONDS + 5;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.055, t + 3.5);
        g.gain.setValueAtTime(0.055, t + CHORD_SECONDS - 1);
        g.gain.exponentialRampToValueAtTime(0.0001, t + life);
        for (const n of notes) {
            for (const [type, det] of [["sine", -5], ["triangle", 6]]) {
                const o = ctx.createOscillator();
                o.type = type;
                o.frequency.value = midi(n);
                o.detune.value = det;
                const og = ctx.createGain();
                og.gain.value = type === "triangle" ? 0.35 : 0.6;
                o.connect(og).connect(lp);
                o.start(t);
                o.stop(t + life + 0.1);
            }
        }
    }

    _bell(t, n, level = 0.07) {
        const ctx = this.ctx;
        const p = this._pan(Math.random() * 1.6 - 0.8);
        const g = ctx.createGain();
        g.connect(p);
        this._out(p, this.calm, 0.9);
        this._env(g.gain, t, 0.01, level, 3.2);
        for (const [mul, lv] of [[1, 1], [2.76, 0.18], [5.4, 0.05]]) {
            const o = ctx.createOscillator();
            o.type = "sine";
            o.frequency.value = midi(n) * mul;
            const og = ctx.createGain();
            og.gain.value = lv;
            o.connect(og).connect(g);
            o.start(t);
            o.stop(t + 3.4);
        }
    }

    // --------------------------------------------------------- tension score

    _scrape(t) {
        const ctx = this.ctx;
        const s = this._src(this.noise);
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.Q.value = 18;
        const f0 = 500 + Math.random() * 900;
        bp.frequency.setValueAtTime(f0, t);
        bp.frequency.exponentialRampToValueAtTime(f0 * (2 + Math.random() * 2), t + 2.4);
        const g = ctx.createGain();
        const p = this._pan(Math.random() * 2 - 1);
        s.connect(bp).connect(g).connect(p);
        this._out(p, this.tension, 0.7);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.5, t + 1.6);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
        s.start(t, Math.random() * 2);
        s.stop(t + 2.7);
    }

    /** Clustered strings that swell up and fall away — semitones rubbing. */
    _swell(t) {
        const ctx = this.ctx;
        const root = 50 + Math.floor(Math.random() * 5);
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.setValueAtTime(400, t);
        lp.frequency.linearRampToValueAtTime(1800, t + 4);
        lp.frequency.linearRampToValueAtTime(300, t + 7);
        const g = ctx.createGain();
        lp.connect(g);
        this._out(g, this.tension, 0.6);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.06, t + 4.2);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 7.5);
        for (const n of [root, root + 1, root + 6, root + 13]) {
            const o = ctx.createOscillator();
            o.type = "sawtooth";
            o.frequency.value = midi(n);
            o.detune.setValueAtTime(0, t);
            o.detune.linearRampToValueAtTime(-35, t + 7.5); // sagging pitch
            o.connect(lp);
            o.start(t);
            o.stop(t + 7.6);
        }
    }

    /** Breathy syllables with no words in them, off to one side. */
    _whisper(t, level = 0.22) {
        const ctx = this.ctx;
        const syll = 3 + Math.floor(Math.random() * 4);
        const p = this._pan(Math.random() < 0.5 ? -0.85 : 0.85);
        const hp = ctx.createBiquadFilter();
        hp.type = "bandpass";
        hp.Q.value = 2.5;
        const g = ctx.createGain();
        g.gain.value = 0.0001;
        const s = this._src(this.noise);
        s.connect(hp).connect(g).connect(p);
        this._out(p, this.sfx, 0.8);
        let at = t;
        for (let i = 0; i < syll; i++) {
            const dur = 0.09 + Math.random() * 0.16;
            hp.frequency.setValueAtTime(1800 + Math.random() * 2600, at);
            g.gain.setValueAtTime(0.0001, at);
            g.gain.exponentialRampToValueAtTime(level, at + dur * 0.4);
            g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
            at += dur + 0.03 + Math.random() * 0.08;
        }
        s.start(t, Math.random() * 3);
        s.stop(at + 0.1);
    }

    _heartbeat(t, level) {
        const ctx = this.ctx;
        for (const [dt, k] of [[0, 1], [0.24, 0.65]]) {
            const o = ctx.createOscillator();
            o.type = "sine";
            o.frequency.setValueAtTime(70, t + dt);
            o.frequency.exponentialRampToValueAtTime(38, t + dt + 0.18);
            const g = ctx.createGain();
            o.connect(g).connect(this.sfx);
            this._env(g.gain, t + dt, 0.012, level * k, 0.22);
            o.start(t + dt);
            o.stop(t + dt + 0.3);
        }
    }

    // ------------------------------------------------------------- one-shots

    /** @param {number} key 1..5 */
    spell(key) {
        if (!this._started) return;
        const ctx = this.ctx, t = this.now;
        const whoosh = (f0, f1, f2, dur, level, q = 1.2) => {
            const s = this._src(this.noise);
            const bp = ctx.createBiquadFilter();
            bp.type = "bandpass";
            bp.Q.value = q;
            bp.frequency.setValueAtTime(f0, t);
            bp.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.4);
            bp.frequency.exponentialRampToValueAtTime(f2, t + dur);
            const g = ctx.createGain();
            s.connect(bp).connect(g);
            this._out(g, this.sfx, 0.45);
            this._env(g.gain, t, dur * 0.3, level, dur * 0.7);
            s.start(t, Math.random() * 3);
            s.stop(t + dur + 0.1);
        };
        const tone = (freqs, dur, level, type = "sine", glide = 1) => {
            const g = ctx.createGain();
            this._out(g, this.sfx, 0.7);
            this._env(g.gain, t, 0.01, level, dur);
            for (const f of freqs) {
                const o = ctx.createOscillator();
                o.type = type;
                o.frequency.setValueAtTime(f, t);
                o.frequency.exponentialRampToValueAtTime(f * glide, t + dur);
                o.connect(g);
                o.start(t);
                o.stop(t + dur + 0.05);
            }
        };
        if (key === 1) {         // Sweep — a wave rushing out
            whoosh(300, 2400, 500, 1.1, 0.7);
            tone([220], 0.6, 0.05, "sine", 0.5);
        } else if (key === 2) {  // Ribbon — a long liquid swirl
            whoosh(400, 1600, 900, 1.8, 0.45, 3);
            tone([midi(74), midi(81)], 1.5, 0.03, "sine", 1.06);
        } else if (key === 3) {  // Bloom — thump and splash
            tone([90], 0.5, 0.35, "sine", 0.4);
            whoosh(1800, 3500, 700, 0.9, 0.6, 0.7);
        } else if (key === 4) {  // Crystallize — glass forming
            tone([midi(96), midi(100), midi(103), midi(107)], 1.8, 0.05, "sine", 1.002);
            const s = this._src(this.crackle);
            const hp = ctx.createBiquadFilter();
            hp.type = "highpass";
            hp.frequency.value = 3000;
            const g = ctx.createGain();
            s.connect(hp).connect(g);
            this._out(g, this.sfx, 0.5);
            this._env(g.gain, t, 0.05, 0.5, 1.2);
            s.start(t);
            s.stop(t + 1.4);
        } else if (key === 5) {  // Vortex — rising swirl
            whoosh(200, 900, 2600, 1.6, 0.6, 2);
            tone([110, 165], 1.4, 0.06, "triangle", 2);
        }
    }

    /** A power that no longer exists. A dead, muffled thud. */
    blocked() {
        if (!this._started) return;
        const ctx = this.ctx, t = this.now;
        const o = ctx.createOscillator();
        o.type = "triangle";
        o.frequency.setValueAtTime(140, t);
        o.frequency.exponentialRampToValueAtTime(45, t + 0.35);
        const g = ctx.createGain();
        o.connect(g).connect(this.sfx);
        this._env(g.gain, t, 0.005, 0.3, 0.4);
        o.start(t);
        o.stop(t + 0.5);
    }

    /** @param {boolean} mud */
    footstep(mud, impact = 1) {
        if (!this._started) return;
        const ctx = this.ctx, t = this.now;
        const s = this._src(mud ? this.noise : this.crackle);
        const f = ctx.createBiquadFilter();
        f.type = mud ? "lowpass" : "bandpass";
        f.frequency.value = mud ? 420 : 2200 + Math.random() * 900;
        f.Q.value = mud ? 3 : 0.9;
        const g = ctx.createGain();
        s.connect(f).connect(g);
        this._out(g, this.sfx, 0.12);
        const lv = (mud ? 0.5 : 0.42) * Math.min(1.2, impact);
        this._env(g.gain, t, 0.008, lv, mud ? 0.25 : 0.17);
        s.start(t, Math.random() * 1.5);
        s.stop(t + 0.35);
        if (mud) {
            const o = ctx.createOscillator();
            o.frequency.setValueAtTime(190, t);
            o.frequency.exponentialRampToValueAtTime(70, t + 0.18);
            const og = ctx.createGain();
            o.connect(og).connect(this.sfx);
            this._env(og.gain, t, 0.01, 0.08, 0.18);
            o.start(t);
            o.stop(t + 0.25);
        }
    }

    /** The jump to 2100: a falling boom under a swelling roar and a ring. */
    collapse() {
        if (!this._started) return;
        const ctx = this.ctx, t = this.now;
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(80, t);
        o.frequency.exponentialRampToValueAtTime(22, t + 3.5);
        const g = ctx.createGain();
        o.connect(g);
        this._out(g, this.sfx, 0.5);
        this._env(g.gain, t, 0.02, 0.9, 3.8);
        o.start(t);
        o.stop(t + 4);
        const s = this._src(this.noise);
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.setValueAtTime(6000, t);
        lp.frequency.exponentialRampToValueAtTime(200, t + 3);
        const sg = ctx.createGain();
        s.connect(lp).connect(sg);
        this._out(sg, this.sfx, 0.8);
        this._env(sg.gain, t, 0.05, 0.6, 3);
        s.start(t);
        s.stop(t + 3.2);
        const r = ctx.createOscillator();
        r.frequency.value = 1661;
        const rg = ctx.createGain();
        r.connect(rg);
        this._out(rg, this.sfx, 1);
        this._env(rg.gain, t + 0.1, 0.3, 0.05, 4);
        r.start(t);
        r.stop(t + 4.5);
    }

    /** Back to the present: a reversed swell into air. */
    returnShift() {
        if (!this._started) return;
        const ctx = this.ctx, t = this.now;
        const s = this._src(this.noise);
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.setValueAtTime(200, t);
        bp.frequency.exponentialRampToValueAtTime(5000, t + 1.4);
        const g = ctx.createGain();
        s.connect(bp).connect(g);
        this._out(g, this.sfx, 0.9);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.7, t + 1.3);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
        s.start(t);
        s.stop(t + 2.3);
        this._bell(t + 1.3, 86, 0.08);
    }

    /** A ghost rising out of the ground: a low falling moan. */
    ghostRise(pan = 0) {
        if (!this._started) return;
        const ctx = this.ctx, t = this.now + Math.random() * 0.4;
        const p = this._pan(pan);
        const g = ctx.createGain();
        g.connect(p);
        this._out(p, this.sfx, 0.9);
        this._env(g.gain, t, 0.9, 0.14, 2.4);
        const f0 = 150 + Math.random() * 90;
        for (const mul of [1, 1.5, 2.02]) {
            const o = ctx.createOscillator();
            o.type = "sine";
            o.frequency.setValueAtTime(f0 * mul, t);
            o.frequency.exponentialRampToValueAtTime(f0 * mul * 0.7, t + 3.2);
            const vib = ctx.createOscillator();
            vib.frequency.value = 5.2;
            const vg = ctx.createGain();
            vg.gain.value = 18;
            vib.connect(vg).connect(o.detune);
            const og = ctx.createGain();
            og.gain.value = mul === 1 ? 1 : 0.3;
            o.connect(og).connect(g);
            o.start(t); vib.start(t);
            o.stop(t + 3.4); vib.stop(t + 3.4);
        }
        this._whisper(t + 0.6, 0.15);
    }

    // ------------------------------------------------------- animal voices

    /**
     * The output stage every ghost's cry runs through: an envelope, a pan to
     * where the ghost is, a long reverb and the echo.
     */
    _ghostVoice(t, pan, level, attack, dur) {
        // How the call is heard: a ghost trails into the echo and a long
        // reverb; a calmed ghost less so; a living animal is just out there.
        const m = VOICE_MODES[this._voiceMode] || VOICE_MODES.ghost;
        const g = this.ctx.createGain();
        const p = this._pan(pan);
        g.connect(p);
        this._out(p, this.sfx, m.wet);
        if (m.echo > 0) {
            const e = this.ctx.createGain();
            e.gain.value = m.echo;
            g.connect(e).connect(this.echo);
        }
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(level, t + attack);
        g.gain.setValueAtTime(level, t + Math.max(attack, dur - 0.25));
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        return g;
    }

    _osc(type, f, t, end, dest) {
        const o = this.ctx.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(f, t);
        o.connect(dest);
        o.start(t);
        o.stop(end + 0.05);
        return o;
    }

    _filter(type, f, q, dest) {
        const b = this.ctx.createBiquadFilter();
        b.type = type;
        b.frequency.value = f;
        b.Q.value = q;
        b.connect(dest);
        return b;
    }

    /**
     * The species' own call, as a ghost. Synthesised from what makes each call
     * recognisable: the bear's guttural, fluttering growl; the ringed seal's
     * short barks; the arctic fox's shrill scream; the emperor penguin's
     * two-voiced trumpeting (it sings with two pitches at once, and the beat
     * between them is the sound); the walrus's grunts and the ringing,
     * bell-like knock it is known for under water.
     *
     * @param {string} name species
     * @param {number} pan -1..1
     * @param {number} [level]
     * @param {"ghost"|"calm"|"alive"} [mode]
     */
    cry(name, pan = 0, level = 1, mode = "ghost") {
        if (!this._started) return;
        this._voiceMode = mode;
        const ctx = this.ctx, t = this.now + 0.02;
        if (name === "Polar bear") {
            const dur = 2.4;
            const v = this._ghostVoice(t, pan, 0.5 * level, 0.35, dur);
            const lp = this._filter("lowpass", 520, 2, v);
            // Flutter: the rattle in a growl is the voice being chopped ~20 Hz.
            const am = ctx.createGain();
            am.gain.value = 0.6;
            am.connect(lp);
            const lfo = this._osc("sine", 21, t, t + dur, ctx.createGain());
            const depth = ctx.createGain();
            depth.gain.value = 0.45;
            lfo.disconnect();
            lfo.connect(depth).connect(am.gain);
            for (const [f, type] of [[78, "sawtooth"], [117, "sawtooth"], [39, "square"]]) {
                const o = this._osc(type, f, t, t + dur, am);
                o.frequency.linearRampToValueAtTime(f * 1.25, t + 0.6);
                o.frequency.exponentialRampToValueAtTime(f * 0.7, t + dur);
            }
            const s = this._src(this.noise);
            const nb = this._filter("bandpass", 300, 1.5, am);
            const ng = ctx.createGain();
            ng.gain.value = 0.5;
            s.connect(ng).connect(nb);
            s.start(t, Math.random() * 2);
            s.stop(t + dur);
        } else if (name === "Ringed seal") {
            // Three short, falling barks.
            for (let i = 0; i < 3; i++) {
                const bt = t + i * (0.32 + Math.random() * 0.08);
                const v = this._ghostVoice(bt, pan, 0.32 * level, 0.02, 0.26);
                const bp = this._filter("bandpass", 850, 3, v);
                for (const [type, mul] of [["square", 1], ["sawtooth", 2.01]]) {
                    const o = this._osc(type, 360 * mul, bt, bt + 0.26, bp);
                    o.frequency.exponentialRampToValueAtTime(190 * mul, bt + 0.24);
                }
            }
        } else if (name === "Arctic fox") {
            // A couple of yips, then the scream.
            for (let i = 0; i < 2; i++) {
                const yt = t + i * 0.22;
                const v = this._ghostVoice(yt, pan, 0.18 * level, 0.01, 0.15);
                const bp = this._filter("bandpass", 1900, 2, v);
                const o = this._osc("sawtooth", 1100, yt, yt + 0.15, bp);
                o.frequency.linearRampToValueAtTime(1650, yt + 0.05);
                o.frequency.exponentialRampToValueAtTime(800, yt + 0.15);
            }
            const st = t + 0.55, dur = 1.1;
            const v = this._ghostVoice(st, pan, 0.2 * level, 0.08, dur);
            const bp = this._filter("bandpass", 1600, 1.4, v);
            const o = this._osc("sawtooth", 950, st, st + dur, bp);
            o.frequency.linearRampToValueAtTime(1450, st + 0.3);
            o.frequency.exponentialRampToValueAtTime(620, st + dur);
            const vib = this._osc("sine", 7.5, st, st + dur, ctx.createGain());
            vib.disconnect();
            const vg = ctx.createGain();
            vg.gain.value = 45;
            vib.connect(vg).connect(o.detune);
        } else if (name === "Emperor penguin") {
            // Two voices a few hertz apart, gated into a trumpeting pulse.
            const dur = 1.6;
            const v = this._ghostVoice(t, pan, 0.24 * level, 0.08, dur);
            const bp = this._filter("bandpass", 1150, 1.3, v);
            const gate = ctx.createGain();
            gate.gain.value = 0.5;
            gate.connect(bp);
            const pulse = this._osc("square", 15, t, t + dur, ctx.createGain());
            pulse.disconnect();
            const pd = ctx.createGain();
            pd.gain.value = 0.5;
            pulse.connect(pd).connect(gate.gain);
            for (const f of [430, 447]) {
                const o = this._osc("sawtooth", f, t, t + dur, gate);
                o.frequency.linearRampToValueAtTime(f * 1.12, t + 0.5);
                o.frequency.linearRampToValueAtTime(f * 0.93, t + dur);
            }
        } else if (name === "Walrus") {
            // Two deep grunts, then the ringing knock.
            for (let i = 0; i < 2; i++) {
                const gt = t + i * 0.42;
                const v = this._ghostVoice(gt, pan, 0.45 * level, 0.03, 0.34);
                const lp = this._filter("lowpass", 380, 4, v);
                const o = this._osc("sawtooth", 72, gt, gt + 0.34, lp);
                o.frequency.exponentialRampToValueAtTime(52, gt + 0.32);
            }
            const bt = t + 0.95;
            const v = this._ghostVoice(bt, pan, 0.14 * level, 0.005, 2.6);
            for (const [f, lv] of [[820, 1], [1652, 0.5], [2480, 0.25], [3340, 0.12]]) {
                const g = ctx.createGain();
                g.gain.value = lv;
                g.connect(v);
                this._osc("sine", f, bt, bt + 2.6, g);
            }
        }
    }

    /** A ghost lunging at the player: a shrieking dissonant stab. */
    lunge(pan = 0) {
        if (!this._started) return;
        const ctx = this.ctx, t = this.now;
        const p = this._pan(pan);
        const g = ctx.createGain();
        g.connect(p);
        this._out(p, this.sfx, 0.6);
        this._env(g.gain, t, 0.02, 0.22, 1.1);
        for (const n of [70, 71, 76, 77]) {
            const o = ctx.createOscillator();
            o.type = "sawtooth";
            o.frequency.setValueAtTime(midi(n), t);
            o.frequency.exponentialRampToValueAtTime(midi(n) * 0.82, t + 1.1);
            o.connect(g);
            o.start(t);
            o.stop(t + 1.2);
        }
        const s = this._src(this.noise);
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.Q.value = 9;
        bp.frequency.setValueAtTime(3500, t);
        bp.frequency.exponentialRampToValueAtTime(900, t + 0.7);
        const sg = ctx.createGain();
        s.connect(bp).connect(sg).connect(p);
        this._env(sg.gain, t, 0.01, 0.5, 0.7);
        s.start(t);
        s.stop(t + 0.8);
    }

    /** Damage undone: a bright rising chime, then a sigh as a ghost leaves. */
    restored() {
        if (!this._started) return;
        const t = this.now;
        [74, 78, 81, 86, 90].forEach((n, i) => this._bell(t + i * 0.12, n, 0.09));
        const ctx = this.ctx;
        const g = ctx.createGain();
        this._out(g, this.sfx, 1);
        g.gain.setValueAtTime(0.0001, t + 0.4);
        g.gain.exponentialRampToValueAtTime(0.06, t + 1.4);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 4);
        for (const n of [62, 69, 74, 78]) {
            const o = ctx.createOscillator();
            o.frequency.setValueAtTime(midi(n), t + 0.4);
            o.frequency.exponentialRampToValueAtTime(midi(n + 12), t + 4);
            o.connect(g);
            o.start(t + 0.4);
            o.stop(t + 4.1);
        }
    }

    /** The ending: one full, resolved chord. */
    finale() {
        if (!this._started) return;
        const t = this.now;
        this._padChord(t, [38, 50, 57, 62, 66, 69, 74, 78]);
        [74, 78, 81, 86].forEach((n, i) => this._bell(t + 0.5 + i * 0.35, n, 0.08));
    }

    // ----------------------------------------------------------------- frame

    /**
     * @param {"calm"|"tension"|"haunted"|"restored"} mode
     */
    setMode(mode) {
        this.mode = mode;
    }

    /**
     * @param {number} dt
     * @param {{surf:number, speed01:number, haunt:number, pressure:number, ghosts:number, doom?:number}} s
     */
    update(dt, s) {
        if (!this._started) return;
        const t = this.now;
        const mode = this.mode;

        // Crossfade the two scores.
        let calm = 1, tense = 0;
        if (mode === "tension") { calm = 0; tense = 1; }
        else if (mode === "haunted") {
            // The clock: as the present degrades, the peace drains out of the
            // score and the dread comes up under it.
            const doom = s.doom || 0;
            calm = 0.55 * (1 - 0.6 * doom);
            tense = Math.min(1, 0.15 + 0.4 * Math.min(1, s.ghosts / 5) + 0.6 * doom);
        }
        this._setBus(this.calm, calm * 0.9 * this._duck, t);
        this._setBus(this.tension, tense * 0.95 * (0.5 + 0.5 * this._duck), t);

        // Wind: cold and airy in the present, hot and low in the future.
        this._gust += dt;
        const gust = 0.6 + 0.4 * Math.sin(this._gust * 0.23) * Math.sin(this._gust * 0.61 + 1);
        const hot = mode === "tension";
        this.windFilter.frequency.setTargetAtTime(hot ? 230 + 80 * gust : 420 + 380 * gust, t, 0.4);
        this.windGain.gain.setTargetAtTime((hot ? 0.3 : 0.16) * gust, t, 0.4);

        // Surf hiss.
        const surf = s.surf * (0.15 + s.speed01);
        this.surfGain.gain.setTargetAtTime(Math.min(0.5, surf * 0.55), t, 0.08);
        this.surfFilter.frequency.setTargetAtTime(700 + s.speed01 * 2200, t, 0.1);

        // The drone breathes; it opens up as the ghosts close in.
        this.droneFilter.frequency.setTargetAtTime(160 + 260 * s.pressure + 140 * Math.sin(t * 0.13), t, 0.5);

        // Calm score scheduler.
        if (calm > 0.05) {
            if (t >= this._chordAt) {
                this._padChord(this._chordAt, CHORDS[this._chordIx % CHORDS.length]);
                this._chordIx++;
                this._chordAt += CHORD_SECONDS;
                if (this._chordAt < t) this._chordAt = t + CHORD_SECONDS;
            }
            if (t >= this._bellAt) {
                this._bell(t, BELLS[Math.floor(Math.random() * BELLS.length)]);
                if (Math.random() < 0.35) this._bell(t + 0.28, BELLS[Math.floor(Math.random() * BELLS.length)], 0.05);
                this._bellAt = t + 1.2 + Math.random() * 2.6;
            }
        } else {
            this._chordAt = Math.max(this._chordAt, t);
        }

        // Tension score scheduler.
        if (tense > 0.05) {
            if (t >= this._scrapeAt) { this._scrape(t); this._scrapeAt = t + 3.5 + Math.random() * 5; }
            if (t >= this._swellAt) { this._swell(t); this._swellAt = t + 8 + Math.random() * 6; }
        }
        // Whispers and the heartbeat follow the ghosts, in any score.
        if (s.ghosts > 0) {
            if (t >= this._whisperAt) {
                this._whisper(t, 0.12 + 0.25 * s.haunt);
                this._whisperAt = t + 2 + Math.random() * 4 - 1.5 * s.haunt;
            }
            if (t >= this._beatAt) {
                this._heartbeat(t, 0.35 + 0.5 * s.haunt);
                this._beatAt = t + 1.1 - 0.5 * s.haunt;
            }
        } else {
            this._beatAt = Math.max(this._beatAt, t);
        }
    }
}
