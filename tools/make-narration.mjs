/**
 * revEarth — record the narrator's lines once, ahead of time.
 *
 * The game never calls a speech service while it runs. This script turns every
 * `narration` line in src/game/biomes.js into an audio file under
 * public/narration/, which the build then ships with the game. Lines without
 * a recording fall back to a voice installed on the player's computer.
 *
 * One voice for every line; its delivery follows each line's `tone`:
 *   story    peaceful and compassionate — what each habitat lost
 *   warning  firm and urgent — the clock
 *   success  warm, dignified and reassuring — the Earth restored
 *
 * ── ElevenLabs (default) ─────────────────────────────────────────────────────
 * Voice: "The Noble Duchess" from the ElevenLabs voice library, ID
 * k5vovWK8AmRvejuy7Frj — listed there as an elegant female voice in her late
 * 30s, refined accent, controlled pacing and quiet authority. The male
 * alternative is "The Regal Monarch" (rSl1WiLmgfWNoFRIGuM8). A library voice
 * usually has to be added to "My Voices" in your ElevenLabs account before
 * the API will use it.
 *
 *   $env:ELEVENLABS_API_KEY = "your key"           # elevenlabs.io → Profile → API keys
 *   node tools/make-narration.mjs
 *
 *   ELEVENLABS_VOICE_ID   default k5vovWK8AmRvejuy7Frj (The Noble Duchess)
 *   ELEVENLABS_MODEL      default eleven_multilingual_v2
 *
 * ── Gemini (alternative) ─────────────────────────────────────────────────────
 *   $env:TTS_PROVIDER = "gemini"; $env:GEMINI_API_KEY = "your key"
 *   GEMINI_TTS_MODEL default gemini-2.5-flash-preview-tts, GEMINI_TTS_VOICE default Kore
 *
 * FORCE=1 re-records lines that already have a file. Then `npm run build`.
 * Node 18+ and built-ins only. Keys are read from the environment, sent only
 * to the provider's API, and never written to disk.
 */

import { mkdir, writeFile, access, readdir, unlink } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BIOMES } from "../src/game/biomes.js";

const PROVIDER = (process.env.TTS_PROVIDER || "elevenlabs").toLowerCase();
/**
 * MANIFEST_ONLY=1: record nothing; just index the clips already in
 * public/narration/<biome>/ (e.g. ones saved by hand from AI Studio).
 */
const MANIFEST_ONLY = process.env.MANIFEST_ONLY === "1";
const FORCE = process.env.FORCE === "1";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "narration");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = (p) => access(p).then(() => true, () => false);

// ---------------------------------------------------------------- ElevenLabs

const EL_KEY = process.env.ELEVENLABS_API_KEY;
const EL_VOICE = process.env.ELEVENLABS_VOICE_ID || "k5vovWK8AmRvejuy7Frj";
const EL_MODEL = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";

/**
 * Same voice, three deliveries. Lower stability lets the voice move more
 * (urgency); `style` exaggerates the speaker's own manner; `speed` paces it.
 */
const EL_TONES = {
    story: { stability: 0.62, similarity_boost: 0.8, style: 0.15, speed: 0.92, use_speaker_boost: true },
    warning: { stability: 0.38, similarity_boost: 0.8, style: 0.45, speed: 1.0, use_speaker_boost: true },
    success: { stability: 0.55, similarity_boost: 0.8, style: 0.3, speed: 0.9, use_speaker_boost: true },
};

async function elevenlabs(text, tone) {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${EL_VOICE}?output_format=mp3_44100_128`;
    for (let attempt = 0; attempt < 5; attempt++) {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", "xi-api-key": EL_KEY, Accept: "audio/mpeg" },
            body: JSON.stringify({ text, model_id: EL_MODEL, voice_settings: EL_TONES[tone] || EL_TONES.story }),
        });
        if (res.status === 429 || res.status >= 500) {
            const wait = 10000 * (attempt + 1);
            console.log(`  busy (${res.status}), waiting ${wait / 1000}s…`);
            await sleep(wait);
            continue;
        }
        if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
        return { data: Buffer.from(await res.arrayBuffer()), ext: "mp3" };
    }
    throw new Error("gave up after repeated rate limits");
}

// -------------------------------------------------------------------- Gemini

const G_KEY = process.env.GEMINI_API_KEY;
const G_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
const G_VOICE = process.env.GEMINI_TTS_VOICE || "Kore";
const G_TONES = {
    story: "In a measured, precise, quietly commanding narrator's voice — peaceful and compassionate, unhurried:",
    warning: "In a measured, precise, quietly commanding narrator's voice — firm and urgent:",
    success: "In a measured, precise, quietly commanding narrator's voice — warm, dignified and reassuring:",
};

/** Gemini returns raw 16-bit PCM; wrap it in a WAV header. */
function wav(pcm, rate = 24000) {
    const h = Buffer.alloc(44);
    h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8);
    h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
    h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
    h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
    return Buffer.concat([h, pcm]);
}

async function gemini(text, tone) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${G_MODEL}:generateContent`;
    const body = {
        contents: [{ parts: [{ text: `${G_TONES[tone] || G_TONES.story} ${text}` }] }],
        generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: G_VOICE } } },
        },
    };
    for (let attempt = 0; attempt < 5; attempt++) {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": G_KEY },
            body: JSON.stringify(body),
        });
        if (res.status === 429 || res.status >= 500) {
            const wait = 15000 * (attempt + 1);
            console.log(`  busy (${res.status}), waiting ${wait / 1000}s…`);
            await sleep(wait);
            continue;
        }
        if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
        const json = await res.json();
        const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
        if (!part) throw new Error("no audio in response: " + JSON.stringify(json).slice(0, 300));
        const m = /rate=(\d+)/.exec(part.inlineData.mimeType || "");
        return { data: wav(Buffer.from(part.inlineData.data, "base64"), m ? Number(m[1]) : 24000), ext: "wav" };
    }
    throw new Error("gave up after repeated rate limits");
}

// ---------------------------------------------------------------------- run

const speak = PROVIDER === "gemini" ? gemini : elevenlabs;
if (!MANIFEST_ONLY && (PROVIDER === "gemini" ? !G_KEY : !EL_KEY)) {
    console.error(PROVIDER === "gemini"
        ? "Set GEMINI_API_KEY first (https://aistudio.google.com/apikey)."
        : "Set ELEVENLABS_API_KEY first (elevenlabs.io → Profile → API keys), or TTS_PROVIDER=gemini.");
    process.exit(1);
}
if (!MANIFEST_ONLY) console.log(PROVIDER === "gemini"
    ? `Gemini ${G_MODEL}, voice ${G_VOICE}`
    : `ElevenLabs ${EL_MODEL}, voice ${EL_VOICE}${{ k5vovWK8AmRvejuy7Frj: " (The Noble Duchess)", rSl1WiLmgfWNoFRIGuM8: " (The Regal Monarch)" }[EL_VOICE] || ""}`);

const manifest = {};
let made = 0, kept = 0;
for (const biome of BIOMES) {
    const lines = biome.narration;
    if (!lines) continue;
    manifest[biome.id] = {};
    const dir = join(outDir, biome.id);
    await mkdir(dir, { recursive: true });
    const present = await readdir(dir);
    for (const [id, line] of Object.entries(lines)) {
        const have = present.find((f) => f.replace(/\.(mp3|wav)$/, "") === id);
        if (MANIFEST_ONLY) {
            if (have) { manifest[biome.id][id] = `${biome.id}/${have}`; kept++; }
            else console.log(`missing: ${biome.id}/${id}`);
            continue;
        }
        if (have && !FORCE) {
            manifest[biome.id][id] = `${biome.id}/${have}`;
            kept++;
            continue;
        }
        process.stdout.write(`${biome.id}/${id} [${line.tone}]: `);
        const { data, ext } = await speak(line.say || line.text, line.tone);
        if (have) await unlink(join(dir, have));
        await writeFile(join(dir, `${id}.${ext}`), data);
        manifest[biome.id][id] = `${biome.id}/${id}.${ext}`;
        console.log("ok");
        made++;
        await sleep(800);
    }
    // Drop recordings for lines that no longer exist.
    if (!MANIFEST_ONLY) for (const f of present) {
        if (!(f.replace(/\.(mp3|wav)$/, "") in lines)) await unlink(join(dir, f));
    }
}
await writeFile(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`\nDone: ${made} recorded, ${kept} kept. Rebuild with \`npm run build\` to ship them.`);
