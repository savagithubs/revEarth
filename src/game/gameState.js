/**
 * revEarth — the story, as a phase machine.
 *
 *   PRESENT   free play with every power and the surf
 *   FUTURE    the same place, melted flat. No powers, no surf, ghosts close in
 *   RETURN    back in the present, still haunted, against the clock. The
 *             player is held to the damaged area, the powers only answer at
 *             the sites that need them, and the present melts in real time
 *             until all five wounds are healed — or the clock runs out and
 *             the future happens again
 *   RESTORED  the ghosts gather, bow and leave; everything is given back
 *
 * Keys: C faces the current task (or re-centres the camera), Tab picks the
 * next task, hold G to walk to it. Hidden demo keys:
 * F2 next phase, F3 previous phase, F4 finish an objective.
 */

import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { S } from "../core/settings.js";
import { input, isDown } from "../core/input.js";
import { G } from "./flags.js";
import { Hud } from "./hud.js";
import { Ghosts } from "./ghosts.js";
import { Objectives } from "./objectives.js";
import { POLAR } from "./biomes.js";
import { GameAudio } from "./audio.js";
import { Narrator } from "./narrator.js";

export const PHASES = ["PRESENT", "FUTURE", "RETURN", "RESTORED"];

const PRESENT_SECONDS = 36;
/** Long enough for the narrator to speak for every ghost. */
const FUTURE_SECONDS = 46;
/** The clock on the return. Run it out and the future happens again. */
const RETURN_SECONDS = 150;
/** How far toward the melted future the present slides as the clock runs. */
const DOOM_MAX = 0.65;
/** Metres beyond the outermost site the player may stray during the return. */
const TETHER_SLACK = 14;
/** Changing these re-solves the sky, so they switch behind the white-out. */
const INSTANT = new Set(["sunElevation", "sunIntensity", "sunAzimuth", "sunTempWarm"]);
/** Look keys the clock drags toward the future preset as it runs. */
const DOOM_KEYS = ["fogDensity", "glintIntensity", "sssStrength", "sastrugiStrength", "ambientBlue", "shaftStrength"];

/**
 * Where G stops walking, metres from the site, per power. The aimed powers
 * (Bloom, Crystallize) stop at a comfortable throw; the rest walk right up.
 */
const WALK_TO = { 1: 5, 2: 3.5, 3: 12, 4: 12, 5: 3.5 };

const slug = (name) => name.toLowerCase().replace(/\s+/g, "-");
const wrap = (a) => {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
};

export class Game {
    /**
     * @param {{ scene:any, terrain:any, spray:any, rig:any, character:any, spells:any }} sys
     */
    constructor(sys) {
        this.sys = sys;
        this.biome = POLAR;
        this.hud = new Hud();
        this.ghosts = new Ghosts(sys.scene, sys.terrain, sys.rig, this.biome.species);
        this.objectives = new Objectives(sys.scene, sys.terrain, sys.spray);

        this.phase = "PRESENT";
        this.t = 0;
        this._tween = null;
        this._events = [];
        this._done = [];
        this.haunt = 0;
        this.doom = 0;
        this._desat = 0;
        this._desatWant = 0;
        this._why = "";
        this._tetherNag = 0;
        this._faceT = 0;
        /** The task the compass, C and G steer toward during the return. */
        this.target = null;
        this._ceremony = false;
        /** Seconds before the "use your powers wisely" line may play again. */
        this._wiseT = 0;
        /** Seconds until a living animal next calls out across the field. */
        this._wildT = 4;

        this.hud.setBiome(this.biome);

        this.audio = new GameAudio();
        this.narrator = new Narrator(this.audio, this.biome.id);
        this.audio.onMute = (m) => this.narrator.setMuted(m);

        this.ghosts.onRise = (pan, name) => {
            this.audio.ghostRise(pan);
            this.audio.cry(name, pan, 0.8);
        };
        this.ghosts.onLunge = (pan, name) => {
            this.audio.lunge(pan);
            this.audio.cry(name, pan, 1.3);
        };
        this.ghosts.onCry = (pan, name, calm) => this.audio.cry(name, pan, calm ? 0.55 : 1, calm ? "calm" : "ghost");

        G.onCast = (key, x, y, z) => this._onCast(key, x, y, z);
        G.onSpell = (key) => this.audio.spell(key);
        G.onBlocked = () => {
            this.audio.blocked();
            if (this.phase === "FUTURE") {
                this.hud.status("Your powers died with the ice");
                return;
            }
            this.hud.status(this._why || "Not now");
            // Spending a power on anything but the wounds earns a rebuke —
            // once, not on every press, and never over the top of another line.
            if (this.phase === "RETURN" && this._wiseT <= 0 && !this.narrator.speaking) {
                this._wiseT = 8;
                this._narrate("wise");
            }
        };
        G.addLights = (lights) => {
            this.objectives.addLights(lights, this.sys.character.position);
            this.ghosts.addLights(lights, this.sys.character.position);
        };

        window.addEventListener("keydown", (e) => {
            if (e.code === "F2") { e.preventDefault(); this.step(1); }
            else if (e.code === "F3") { e.preventDefault(); this.step(-1); }
            else if (e.code === "F4") { e.preventDefault(); this._finishOne(); }
            else if (e.code === "KeyC" && !e.repeat) this.faceTask();
            else if (e.code === "Tab") { e.preventDefault(); if (!e.repeat) this.cycleTask(); }
        });

        this.enter("PRESENT");
    }

    /** Say a line and put it on screen while it is spoken. */
    _narrate(id) {
        const line = this.biome.narration?.[id];
        if (!line) return;
        const show = () => this.hud.toast(line.text, Math.max(3.5, line.text.split(" ").length * 0.42));
        this.narrator.say(id, line.say || line.text, show, line.tone);
    }

    // --------------------------------------------------------------- phases

    step(dir) {
        // F2 on the ending starts the run over, for back-to-back demos.
        if (dir > 0 && this.phase === "RESTORED") { this.enter("PRESENT"); return; }
        const i = Math.max(0, Math.min(PHASES.length - 1, PHASES.indexOf(this.phase) + dir));
        this.enter(PHASES[i]);
    }

    /** Schedule `fn` to run `delay` seconds into the current phase. */
    _at(delay, fn) {
        this._events.push({ at: delay, fn });
    }

    enter(phase) {
        const b = this.biome;
        this.phase = phase;
        this.t = 0;
        this._events = [];
        this._ceremony = false;
        this.doom = 0;
        G.canCast = null;
        G.autoWalk = false;
        this.target = null;
        this.narrator.clear();
        this.hud.hideEnding();
        this.hud.hideCard();
        this.hud.doom(null);
        this.hud.compass(null);

        if (phase === "PRESENT") {
            this._look(b.present, 0.01);
            this._powers(true);
            this.ghosts.reset();
            this.objectives.clear();
            this.hud.objectives(null);
            this.hud.setPhase("Present day", "");
            this.audio.setMode("calm");
            this._desatWant = 0;
            this.hud.toast("Explore. WASD to move · hold Space / RMB to surf · 1–5 to bend water and ice.", 6);
            this._at(PRESENT_SECONDS - 10, () => this.hud.toast("The ice is groaning…", 3));
            this._at(PRESENT_SECONDS, () => this.enter("FUTURE"));
        } else if (phase === "FUTURE") {
            this.hud.flash();
            this.objectives.clear();
            this.hud.objectives(null);
            this.ghosts.rehaunt();
            this._powers(false);
            this._at(0.35, () => {
                this._look(b.future, 0.01);
                this.hud.card(String(b.futureYear), b.futureTitle, b.futureLine, 4.5);
                this._narrate("future");
            });
            this.hud.setPhase(`${b.futureYear} · collapsed`, "bad");
            this.audio.collapse();
            this.audio.setMode("tension");
            this._desatWant = 1;
            this._at(3.0, () => this.ghosts.summonAll());
            // The narrator speaks for each of them in turn; the queue paces it.
            this._at(5, () => this.ghosts.list.forEach((g) => this._narrate("ghost-" + slug(g.name))));
            this._at(FUTURE_SECONDS - 5, () => this._narrate("go-back"));
            this._at(FUTURE_SECONDS, () => this.enter("RETURN"));
        } else if (phase === "RETURN") {
            this.hud.flash();
            this._powers(true);
            // Repairing, not exploring: no surf, and only an even walk.
            G.surfEnabled = false;
            G.walkScale = 0.9;
            this.ghosts.rehaunt();
            this.ghosts.summonAll(); // jumping straight here still brings them
            this._at(0.35, () => {
                this._look(b.present, 2.5);
                const ch = this.sys.character.position;
                const fwd = this.sys.rig.getFlatForward(new Vector3());
                this.objectives.spawn(b, ch, fwd.x, fwd.z);
                this._refreshObjectives();
                this.hud.card("Present day", "You came back.",
                    "The ghosts came with you. Heal the five wounds before it is too late.", 3.8);
                G.canCast = (key) => {
                    const r = this.objectives.canCast(key, this.sys.character.position);
                    this._why = r.why || "";
                    return r.ok;
                };
            });
            // One warning, repeated as the clock runs — nothing else is
            // narrated while the player works.
            for (const at of [0.4, 0.65, 0.85]) this._at(RETURN_SECONDS * at, () => this._warn());
            this._at(RETURN_SECONDS, () => this._tooLate());
            this.hud.setPhase("Present · haunted", "bad");
            this.audio.returnShift();
            this.audio.setMode("haunted");
            this._desatWant = 0.35;
            this._done = [];
        } else if (phase === "RESTORED") {
            // The ceremony: hold still, the ghosts come round, bow, and go.
            this._ceremony = true;
            G.powersEnabled = false;
            G.surfEnabled = false;
            G.walkScale = 0;
            this._look(b.present, 1.5);
            this.ghosts.summonAll(); // jumping straight here still has them to bow
            this.ghosts.gather();
            const rig = this.sys.rig;
            rig.yaw = this.sys.character.facing;
            rig.pitch = 0.14;
            this.hud.objectives(null);
            this.hud.setPhase("Future restored", "good");
            this.audio.setMode("calm");
            this._desatWant = 0;
            if (this._done.length === 0) this._done = b.actions.map((a) => a.label.toLowerCase());
            this._at(2.2, () => {
                this.ghosts.bow();
                this._narrate("ending");
            });
            this._at(8.5, () => {
                this.ghosts.ascendAll();
                this.audio.finale();
            });
            this._at(11.5, () => {
                // Everything is given back.
                this._ceremony = false;
                this._powers(true);
                this.hud.showEnding(b, this._done);
            });
        }
    }

    _powers(on) {
        G.powersEnabled = on;
        G.surfEnabled = on;
        G.walkScale = on ? 1 : 0.7;
    }

    _warn() {
        if (this.phase !== "RETURN") return;
        this.audio.blocked();
        this.hud.status("rev-Earth now, before it's too late", 3);
        this._narrate("warn");
    }

    _tooLate() {
        if (this.phase !== "RETURN") return;
        G.canCast = null;
        this.hud.card("", "Too late.", "The ice is gone. Again.", 3.5);
        this._narrate("too-late");
        this._at(this.t + 3.8, () => this.enter("FUTURE"));
        this.phase = "TOO_LATE";
    }

    // ------------------------------------------------------------ camera

    /**
     * The task being steered toward: the one the player picked with Tab if it
     * is still open, otherwise the next open one in key order (1 → 5), so the
     * row of beacons is worked left to right.
     */
    _currentTarget() {
        if (this.phase !== "RETURN") return null;
        if (this.target && !this.target.done) return this.target;
        this.target = this.objectives.list.find((o) => !o.done) || null;
        return this.target;
    }

    /** Tab: move on to the next open task, and turn to face it. */
    cycleTask() {
        if (this.phase !== "RETURN") return;
        const open = this.objectives.list.filter((o) => !o.done);
        if (!open.length) return;
        const i = open.indexOf(this._currentTarget());
        this.target = open[(i + 1) % open.length];
        this.audio.blocked();
        this.faceTask();
    }

    /**
     * C: swing the camera to face the current task — or, with none, back
     * behind the player. Eased over a moment rather than snapped.
     */
    faceTask() {
        const o = this._currentTarget();
        this._faceTarget = o;
        if (!o) {
            this._faceYaw = this.sys.character.facing;
            this._facePitch = 0.12;
        }
        this._faceT = 0.9;
    }

    /**
     * Aim the camera at a site from where the camera actually is, so the
     * centre of the screen — which is where Bloom and Crystallize land — sits
     * on it. Re-solved every frame while turning, because the camera orbits
     * the player as it turns and its position moves with it.
     */
    _aimAt(o) {
        const c = this.sys.rig.camera.position;
        const dx = o.x - c.x, dz = o.z - c.z;
        this._faceYaw = Math.atan2(dx, dz);
        // At the ground under the site, not the top of its prop: the aimed
        // powers land where the view ray meets the terrain, and at a shallow
        // angle a ray aimed a metre high lands several metres beyond.
        const drop = c.y - o.y;
        this._facePitch = Math.max(-0.2, Math.min(0.9, Math.atan2(drop, Math.hypot(dx, dz))));
    }

    _updateFacing(dt) {
        const rig = this.sys.rig;
        const ch = this.sys.character;
        // Any mouse movement hands the camera back to the player at once.
        if (input.lookX || input.lookY) this._faceT = 0;

        // G: walk to the current task. The camera turns to it and the feet
        // follow; it stops by itself once the task is in reach.
        const o = this._currentTarget();
        const dist = o ? Math.hypot(o.x - ch.position.x, o.z - ch.position.z) : 0;
        const walking = !!(o && isDown("KeyG") && !this._ceremony && dist > WALK_TO[o.spell]);
        G.autoWalk = walking;
        if (o && isDown("KeyG") && !this._ceremony) {
            this._faceTarget = o;
            this._faceT = Math.max(this._faceT, 0.15);
        }

        if (this._faceT > 0) {
            if (this._faceTarget && !this._faceTarget.done) this._aimAt(this._faceTarget);
            this._faceT -= dt;
            const k = Math.min(1, dt * 7);
            rig.yaw += wrap(this._faceYaw - rig.yaw) * k;
            rig.pitch += (this._facePitch - rig.pitch) * k;
        }
        // No automatic recentring while walking: movement is camera-relative,
        // so a camera that swings behind a strafing player turns "right" with
        // it and the two chase each other in circles. C, G and the auto-face
        // after each fix are the ways the view is put back.
    }

    // ----------------------------------------------------------- objectives

    _onCast(key, x, y, z) {
        if (this.phase !== "RETURN") return;
        const o = this.objectives.onCast(key, x, y, z);
        if (o) this._completed(o);
    }

    _finishOne() {
        if (this.phase !== "RETURN") { this.step(1); return; }
        const o = this.objectives.completeNext();
        if (o) this._completed(o);
    }

    _completed(o) {
        this.audio.restored();
        this._done.push(o.label.toLowerCase());
        const remaining = this.objectives.remaining;
        const calmed = this.ghosts.calmOne();
        this.hud.status(calmed ? `${o.label} — the ${calmed.toLowerCase()} is at peace` : `${o.label} — healed`, 2.5);
        this._refreshObjectives();
        if (remaining > 0) {
            // On to the next one: pick it and turn to it, after a beat to
            // let the fix land.
            this.target = null;
            this._at(this.t + 1.2, () => {
                if (this.phase !== "RETURN") return;
                this.faceTask();
                const next = this._currentTarget();
                if (next) this.hud.status(`Next: ${next.spell} · ${next.label}`, 2.5);
            });
        }
        if (remaining === 0) {
            G.canCast = null;
            this._events = this._events.filter((e) => e.at <= this.t); // stop the clock
            this.hud.doom(null);
            this._at(this.t + 2.5, () => this.enter("RESTORED"));
        }
    }

    _refreshObjectives() {
        this.hud.objectives(this.objectives.list, this.ghosts.haunting);
    }

    // ------------------------------------------------------------------ look

    /** Tween the world toward a partial `S` preset over `seconds`. */
    _look(preset, seconds) {
        const from = {};
        for (const k in preset) {
            if (INSTANT.has(k)) S[k] = preset[k];
            else from[k] = S[k];
        }
        this._tween = { from, to: preset, t: 0, dur: Math.max(0.01, seconds) };
    }

    _applyTween(dt) {
        const tw = this._tween;
        if (!tw) return;
        tw.t += dt;
        const k = Math.min(1, tw.t / tw.dur);
        const e = k * k * (3 - 2 * k);
        for (const key in tw.from) {
            const a = tw.from[key], b = tw.to[key];
            S[key] = typeof b === "number" ? a + (b - a) * e : (e < 0.5 ? a : b);
        }
        if (k >= 1) this._tween = null;
    }

    /**
     * The present degrading in real time. The clock drags the world toward
     * the melted future — the snow thins and darkens, the hills start to
     * slump, the haze comes in — and every healed site pulls it back.
     */
    _applyDoom(dt) {
        if (this.phase !== "RETURN" || this._tween || this.objectives.list.length === 0) return;
        const frac = Math.min(1, this.t / RETURN_SECONDS);
        const open = this.objectives.remaining / Math.max(1, this.objectives.list.length);
        const want = DOOM_MAX * frac * (0.35 + 0.65 * open);
        this.doom += (want - this.doom) * Math.min(1, dt * 0.8);
        const p = this.biome.present, f = this.biome.future;
        S.decay = this.doom;
        for (const k of DOOM_KEYS) {
            if (typeof p[k] === "number" && typeof f[k] === "number") S[k] = p[k] + (f[k] - p[k]) * this.doom;
        }
        this.hud.doom(1 - frac, RETURN_SECONDS - this.t);
    }

    /** Hold the player to the damaged area until it is healed. */
    _tether(dt) {
        if (this.phase !== "RETURN") return;
        const b = this.objectives.bounds();
        if (!b) return;
        const ch = this.sys.character;
        const R = b.r + TETHER_SLACK;
        const dx = ch.position.x - b.x, dz = ch.position.z - b.z;
        const d = Math.hypot(dx, dz);
        this._tetherNag -= dt;
        this._wiseT -= dt;
        if (d <= R) return;
        // Back onto the rim, and kill the outward part of the velocity.
        ch.position.x = b.x + (dx / d) * R;
        ch.position.z = b.z + (dz / d) * R;
        const nx = dx / d, nz = dz / d;
        const out = ch.velocity.x * nx + ch.velocity.z * nz;
        if (out > 0) { ch.velocity.x -= nx * out; ch.velocity.z -= nz * out; }
        if (this._tetherNag <= 0) {
            this._tetherNag = 3;
            this.audio.blocked();
            this.hud.status("The ghosts block your way — rev-Earth before it's too late", 2.5);
        }
    }

    /**
     * The living world: while the ice is whole, the animals are out there
     * calling, unseen and far off. That is the sound the future takes away.
     */
    _wildlife(dt) {
        const alive = this.phase === "PRESENT" || (this.phase === "RESTORED" && !this._ceremony);
        if (!alive) return;
        this._wildT -= dt;
        if (this._wildT > 0) return;
        this._wildT = 5 + Math.random() * 6;
        const sp = this.biome.species;
        this.audio.cry(sp[Math.floor(Math.random() * sp.length)], Math.random() * 1.6 - 0.8, 0.4, "alive");
    }

    _updateCompass() {
        if (this.phase !== "RETURN" || this._ceremony) { this.hud.compass(null); return; }
        const ch = this.sys.character.position;
        const o = this._currentTarget();
        this.objectives.target = o;
        if (!o) { this.hud.compass(null); return; }
        const bearing = Math.atan2(o.x - ch.x, o.z - ch.z);
        this.hud.compass({
            label: `${o.spell} · ${o.label}`,
            angle: wrap(bearing - this.sys.rig.yaw),
            dist: Math.hypot(o.x - ch.x, o.z - ch.z),
            inRange: this.objectives.canCast(o.spell, ch).ok,
            key: o.spell === 2 ? "and hold 2" : String(o.spell),
        });
    }

    // ---------------------------------------------------------------- frame

    update(dt) {
        this.t += dt;
        for (let i = 0; i < this._events.length; i++) {
            const ev = this._events[i];
            if (this.t >= ev.at) {
                this._events.splice(i--, 1);
                ev.fn();
            }
        }
        this._applyTween(dt);
        this._applyDoom(dt);
        this._tether(dt);
        this._updateFacing(dt);
        this._updateCompass();
        this.hud.lookPrompt(!input.locked && !this._ceremony && !this.hud.$(".end").classList.contains("show"));

        let pressure = 0;
        if (this.phase === "FUTURE") pressure = Math.min(1, 0.25 + this.t / FUTURE_SECONDS);
        else if (this.phase === "RETURN") pressure = 0.3 + 0.2 * (this.objectives.remaining / 5) + 0.4 * this.doom;

        const before = this.ghosts.haunting;
        const ch = this.sys.character;
        this.haunt = this.ghosts.update(dt, ch, pressure);

        if (ch.footfall) this.audio.footstep(S.decay > 0.5, ch.footImpact);
        this._wildlife(dt);
        this.audio.update(dt, {
            surf: ch.surf, speed01: ch.speed01, haunt: this.haunt,
            pressure, ghosts: this.ghosts.haunting, doom: this.doom / DOOM_MAX,
        });
        if (this.ghosts.haunting !== before && this.phase === "RETURN") this._refreshObjectives();
        // Ribbon is a held power, so the net is checked here rather than on a cast.
        const held = this.phase === "RETURN" && this.sys.spells.ribbon.held;
        const doneNow = this.objectives.update(dt, ch.position, held);
        if (doneNow) this._completed(doneNow);

        this._desat += (this._desatWant - this._desat) * Math.min(1, dt * 1.5);
        this.hud.setMood(this.haunt, this._desat);
        this.hud.update(dt);
    }
}
