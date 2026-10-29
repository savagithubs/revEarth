/**
 * revEarth — the narrator. A calm, assertive female voice that tells the
 * player what each habitat lost.
 *
 * Two sources, both offline at play time:
 *
 *   1. Pre-recorded lines in `narration/<biome>/<id>.wav`, listed in
 *      `narration/manifest.json`. These are made once, ahead of time, by
 *      `node tools/make-narration.mjs` (Gemini TTS, needs your API key).
 *      They ship inside the build, so the game never calls out to anything.
 *   2. If a line has no recording, the browser's own speech synthesis — and
 *      only a voice installed on this machine (`localService`), never a cloud
 *      voice, so it still works with no network.
 *
 * Lines queue rather than talk over each other, and the music dips under the
 * voice while it speaks.
 */

const DELIVERY = {
    story: { rate: 0.88, pitch: 1.0 },
    warning: { rate: 0.96, pitch: 0.92 },
    success: { rate: 0.82, pitch: 1.04 },
};

const FEMALE = /female|zira|aria|jenny|hazel|susan|samantha|victoria|karen|moira|tessa|fiona|libby|sonia|natasha|clara|emma|ava|allison|serena|michelle|joanna|salli|kendra/i;

export class Narrator {
    /**
     * @param {import("./audio.js").GameAudio} audio
     * @param {string} biomeId
     */
    constructor(audio, biomeId) {
        this.audio = audio;
        this.biome = biomeId;
        /** @type {Record<string, AudioBuffer>} */
        this.buffers = {};
        /** @type {{id:string, text:string, onStart?: () => void, tone?: string}[]} */
        this.queue = [];
        this.speaking = false;
        this.voice = null;
        this.muted = false;
        /** Bumped by `clear`, so callbacks from cut-off lines are ignored. */
        this._gen = 0;

        this.out = audio.ctx.createGain();
        this.out.gain.value = 1.0;
        this.out.connect(audio.master);

        this._loadRecordings();
        if ("speechSynthesis" in window) {
            this._pickVoice();
            speechSynthesis.addEventListener?.("voiceschanged", () => this._pickVoice());
        }
    }

    get source() {
        if (Object.keys(this.buffers).length) return "recorded";
        return this.voice ? "system:" + this.voice.name : "none";
    }

    async _loadRecordings() {
        try {
            const res = await fetch("narration/manifest.json", { cache: "no-cache" });
            if (!res.ok) return;
            const manifest = await res.json();
            const lines = manifest[this.biome] || {};
            await Promise.all(Object.entries(lines).map(async ([id, file]) => {
                const r = await fetch("narration/" + file);
                if (!r.ok) return;
                this.buffers[id] = await this.audio.ctx.decodeAudioData(await r.arrayBuffer());
            }));
        } catch {
            // No recordings shipped: the system voice covers every line.
        }
    }

    /** About how long the line takes to say, at a calm pace. */
    _readSeconds(text) {
        return 0.8 + text.split(/\s+/).length * 0.4;
    }

    _pickVoice() {
        const voices = speechSynthesis.getVoices().filter((v) => v.localService && /^en/i.test(v.lang));
        this.voice = voices.find((v) => FEMALE.test(v.name)) || null;
    }

    /**
     * Queue a line. `text` is what the system voice reads if no recording
     * exists; `onStart` fires as it begins, for the subtitle.
     */
    say(id, text, onStart, tone) {
        if (!text) return;
        this.queue.push({ id, text, onStart, tone });
        if (!this.speaking) this._next();
    }

    /** Drop anything not yet spoken (used when the story jumps). */
    clear() {
        this.queue = [];
        this._gen++;
        if ("speechSynthesis" in window) speechSynthesis.cancel();
        this._src?.stop();
        this._done();
    }

    setMuted(m) {
        this.muted = m;
        this.out.gain.value = m ? 0 : 1;
        if (m && "speechSynthesis" in window) speechSynthesis.cancel();
    }

    _done() {
        this.speaking = false;
        this._src = null;
        this.audio.duck(false);
    }

    _next() {
        const line = this.queue.shift();
        if (!line) return this._done();
        this.speaking = true;
        this.audio.duck(true);
        line.onStart?.();
        let finished = false;
        const gen = this._gen;
        const finish = () => {
            if (finished || gen !== this._gen) return;
            finished = true;
            this.speaking = false;
            this._next();
        };

        const buf = this.buffers[line.id];
        if (buf && this.audio.ctx.state === "running") {
            const src = this.audio.ctx.createBufferSource();
            src.buffer = buf;
            src.connect(this.out);
            src.onended = finish;
            src.start();
            this._src = src;
            return;
        }
        if (this.voice && !this.muted) {
            const u = new SpeechSynthesisUtterance(line.text);
            u.voice = this.voice;
            u.lang = this.voice.lang;
            // One voice, three deliveries. A system voice only offers rate and
            // pitch, so that is all the shading it gets: unhurried for the
            // stories, firmer and a touch quicker for warnings, slowest and
            // warmest for the ending.
            const d = DELIVERY[line.tone] || DELIVERY.story;
            u.rate = d.rate;
            u.pitch = d.pitch;
            u.volume = 1;
            u.onend = finish;
            u.onerror = finish;
            speechSynthesis.speak(u);
            // Some engines never fire `onend`; never let the queue stall.
            setTimeout(finish, this._readSeconds(line.text) * 1000 + 4000);
            return;
        }
        // Nothing to speak with: the subtitle carries the line, at reading pace.
        setTimeout(finish, this._readSeconds(line.text) * 1000);
    }
}
