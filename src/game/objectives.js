/**
 * revEarth — the damage in the present that the player has to undo.
 *
 * Five sites per run, one for each power, placed in a fan ahead of the player
 * when they return from the future. Each is marked by a tall beacon and undone
 * by one specific power. The powers stay what they were: the spell itself is the fix,
 * this file only notices that it landed in the right place.
 */

import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateDisc } from "@babylonjs/core/Meshes/Builders/discBuilder";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { hdrMaterial } from "./hdrMat.js";

/** Radius a spell has to land within, metres, by objective kind. */
const REACH = { soot: 9, net: 8, fire: 7, vent: 6, drums: 7 };
/** Seconds of held Ribbon beside the net to wash it away. */
const NET_HOLD = 1.2;
/**
 * How close the player has to be to a site for its power to answer at all.
 * During the return the powers only work where the Earth needs them — Bloom
 * and Crystallize are aimed, so they reach out to their 22 m ray.
 */
const CAST_RANGE = { 1: 16, 2: 8, 3: 24, 4: 24, 5: 7 };

/** Scene-linear HDR: lit snow is near 12, so unlit props are scaled to match. */
const HDR = 10;
const BEACON = [1.0, 0.42, 0.22];
const BEACON_DONE = [0.4, 1.0, 0.6];

function flatMat(scene, name, rgb, alpha = 1, additive = false) {
    return hdrMaterial(scene, name, rgb.map((v) => v * HDR), alpha, additive);
}

export class Objectives {
    /**
     * @param {import("@babylonjs/core/scene").Scene} scene
     * @param {*} terrain  heightAt + deform
     * @param {*} spray    SprayField
     */
    constructor(scene, terrain, spray) {
        this.scene = scene;
        this.terrain = terrain;
        this.spray = spray;
        /** @type {any[]} */
        this.list = [];
        this._t = 0;
        /** The site the player is being steered toward; its beacon burns brighter. */
        this.target = null;
        this.mats = {
            soot: flatMat(scene, "rvSoot", [0.02, 0.018, 0.016], 0.88),
            oil: flatMat(scene, "rvOil", [0.01, 0.01, 0.012], 0.9),
            rock: flatMat(scene, "rvRock", [0.07, 0.065, 0.06]),
            vent: flatMat(scene, "rvVent", [0.7, 0.85, 0.2], 0.5, true),
            drum: flatMat(scene, "rvDrum", [0.32, 0.12, 0.05]),
            drum2: flatMat(scene, "rvDrum2", [0.18, 0.2, 0.22]),
            net: flatMat(scene, "rvNet", [0.05, 0.16, 0.12]),
            float: flatMat(scene, "rvFloat", [0.9, 0.3, 0.05]),
            ember: flatMat(scene, "rvEmber", [1.6, 0.45, 0.08], 0.85, true),
            char: flatMat(scene, "rvChar", [0.015, 0.012, 0.01], 0.92),
        };
    }

    get remaining() {
        return this.list.filter((o) => !o.done).length;
    }

    _mesh(m, mat) {
        m.material = mat;
        m.renderingGroupId = mat.metadata.blended ? 2 : 1;
        m.isPickable = false;
        return m;
    }

    _ground(x, z) {
        return this.terrain.heightAt(x, z);
    }

    /**
     * Place this biome's sites in a fan ahead of the player.
     * @param {*} biome
     * @param {{x:number,z:number}} player
     * @param {number} fx flat forward x
     * @param {number} fz flat forward z
     */
    spawn(biome, player, fx, fz) {
        this.clear();
        // Left to right in key order, so the row of beacons reads 1..5.
        const fan = [[-0.95, 15], [-0.48, 20], [0, 24], [0.48, 20], [0.95, 15]];
        biome.actions.forEach((a, i) => {
            const [ang, dist] = fan[i % fan.length];
            const c = Math.cos(ang), s = Math.sin(ang);
            const dx = fx * c - fz * s, dz = fx * s + fz * c;
            const x = player.x + dx * dist, z = player.z + dz * dist;
            const y = this._ground(x, z);
            const o = { ...a, x, y, z, done: false, t: 0, meshes: [], lift: 0, groundY: y };

            // Each beacon owns its material, so it can pulse and fade alone.
            const beacon = this._mesh(
                CreateCylinder("rvB", { diameter: 0.9, height: 60, tessellation: 12 }, this.scene),
                flatMat(this.scene, "rvBeacon" + i, BEACON, 0.22, true)
            );
            beacon.position.set(x, y + 30, z);
            o.beacon = beacon;

            if (a.id === "soot") {
                for (let k = 0; k < 7; k++) {
                    const r = 1.2 + Math.random() * 1.6;
                    const px = x + (Math.random() - 0.5) * 7, pz = z + (Math.random() - 0.5) * 7;
                    const d = this._mesh(CreateDisc("rvS", { radius: r, tessellation: 18 }, this.scene), this.mats.soot);
                    d.rotation.x = Math.PI / 2;
                    d.position.set(px, this._ground(px, pz) + 0.16, pz);
                    o.meshes.push(d);
                }
            } else if (a.id === "vent") {
                const rock = this._mesh(
                    CreateCylinder("rvV", { diameterTop: 1.0, diameterBottom: 2.6, height: 1.3, tessellation: 9 }, this.scene),
                    this.mats.rock
                );
                rock.position.set(x, y + 0.45, z);
                const glow = this._mesh(CreateDisc("rvG", { radius: 0.48, tessellation: 16 }, this.scene), this.mats.vent);
                glow.rotation.x = Math.PI / 2;
                glow.position.set(x, y + 1.12, z);
                o.meshes.push(rock, glow);
            } else if (a.id === "net") {
                // A tangle of lost net with a few floats, lying on the snow.
                for (let k = 0; k < 9; k++) {
                    const strand = this._mesh(
                        CreateCylinder("rvN", { diameter: 0.07, height: 5 + Math.random() * 2, tessellation: 5 }, this.scene),
                        this.mats.net
                    );
                    strand.rotation.z = Math.PI / 2;
                    strand.rotation.y = (k / 9) * Math.PI + (Math.random() - 0.5) * 0.3;
                    strand.position.set(x + (Math.random() - 0.5), y + 0.12, z + (Math.random() - 0.5));
                    o.meshes.push(strand);
                }
                for (let k = 0; k < 5; k++) {
                    const fl = this._mesh(CreateCylinder("rvF", { diameter: 0.32, height: 0.2, tessellation: 10 }, this.scene), this.mats.float);
                    const px = x + Math.cos(k * 1.3) * 2, pz = z + Math.sin(k * 1.3) * 2;
                    fl.position.set(px, this._ground(px, pz) + 0.15, pz);
                    o.meshes.push(fl);
                }
                o.hold = 0;
            } else if (a.id === "fire") {
                // A smouldering peat fire: a scorched patch with glowing embers.
                const scar = this._mesh(CreateDisc("rvC", { radius: 3.4, tessellation: 22 }, this.scene), this.mats.char);
                scar.rotation.x = Math.PI / 2;
                scar.position.set(x, y + 0.13, z);
                o.meshes.push(scar);
                for (let k = 0; k < 8; k++) {
                    const e = this._mesh(CreateDisc("rvE", { radius: 0.35 + Math.random() * 0.5, tessellation: 12 }, this.scene), this.mats.ember);
                    e.rotation.x = Math.PI / 2;
                    const px = x + (Math.random() - 0.5) * 4.5, pz = z + (Math.random() - 0.5) * 4.5;
                    e.position.set(px, this._ground(px, pz) + 0.17, pz);
                    o.meshes.push(e);
                }
            } else if (a.id === "drums") {
                const oil = this._mesh(CreateDisc("rvO", { radius: 3.2, tessellation: 22 }, this.scene), this.mats.oil);
                oil.rotation.x = Math.PI / 2;
                oil.position.set(x, y + 0.14, z);
                o.meshes.push(oil);
                o.drums = [];
                for (let k = 0; k < 4; k++) {
                    const dr = this._mesh(
                        CreateCylinder("rvD", { diameter: 0.6, height: 0.9, tessellation: 14 }, this.scene),
                        k % 2 ? this.mats.drum2 : this.mats.drum
                    );
                    const px = x + Math.cos(k * 1.7) * 1.3, pz = z + Math.sin(k * 1.7) * 1.3;
                    dr.position.set(px, this._ground(px, pz) + 0.4, pz);
                    if (k === 3) dr.rotation.z = Math.PI / 2; // one tipped over
                    o.drums.push(dr);
                    o.meshes.push(dr);
                }
            }
            this.list.push(o);
        });
    }

    clear() {
        for (const o of this.list) {
            o.beacon.material.dispose();
            o.beacon.dispose();
            for (const m of o.meshes) m.dispose();
        }
        this.list = [];
    }

    /**
     * A spell landed. Returns the objective it completed, if any.
     * @returns {any|null}
     */
    onCast(key, x, y, z) {
        for (const o of this.list) {
            if (o.done || o.spell !== key) continue;
            if (Math.hypot(o.x - x, o.z - z) <= REACH[o.id]) {
                this._complete(o);
                return o;
            }
        }
        return null;
    }

    /** The open site nearest the player, or null. */
    nearestOpen(player) {
        let best = null, bd = Infinity;
        for (const o of this.list) {
            if (o.done) continue;
            const d = Math.hypot(o.x - player.x, o.z - player.z);
            if (d < bd) { bd = d; best = o; }
        }
        return best;
    }

    /** Centre and radius of the area the sites occupy. */
    bounds() {
        if (!this.list.length) return null;
        let cx = 0, cz = 0;
        for (const o of this.list) { cx += o.x; cz += o.z; }
        cx /= this.list.length; cz /= this.list.length;
        let r = 0;
        for (const o of this.list) r = Math.max(r, Math.hypot(o.x - cx, o.z - cz));
        return { x: cx, z: cz, r };
    }

    /**
     * May this power be used here? Only beside an open site that needs it.
     * @returns {{ok: boolean, why?: string}}
     */
    canCast(key, player) {
        const site = this.list.find((o) => o.spell === key);
        if (!site) return { ok: false, why: "Your powers only answer where the Earth needs them" };
        if (site.done) return { ok: false, why: "That wound is already healed" };
        if (Math.hypot(site.x - player.x, site.z - player.z) > CAST_RANGE[key]) {
            return { ok: false, why: "Get closer — your powers only answer where the Earth needs them" };
        }
        return { ok: true };
    }

    /** Demo safety: finish the next open objective. */
    completeNext() {
        const o = this.list.find((p) => !p.done);
        if (o) this._complete(o);
        return o || null;
    }

    _complete(o) {
        o.done = true;
        o.t = 0;
        o.beacon.material.setColor3("color", new Color3(...BEACON_DONE.map((v) => v * HDR)));
        const deform = this.terrain.deform;
        if (o.id === "soot") {
            // Washed clean: fresh, loose, bright snow where the soot lay.
            deform.brush(o.x, o.z, 4.5, 0.02, 0.12, 0, 0, 0, 1, 1);
            for (const m of o.meshes) m.dispose();
            o.meshes = [];
        } else if (o.id === "net") {
            // Washed away: the snow it lay on is left smoothed and clean.
            deform.brush(o.x, o.z, 3.5, 0.03, 0.1, 0, 0, 0, 1, 1);
            for (const m of o.meshes) m.dispose();
            o.meshes = [];
        } else if (o.id === "fire") {
            // Doused: the embers die and the scar freezes over.
            deform.brush(o.x, o.z, 3.4, 0.02, 0, 0.6, 0.6, 0, 1, 0.8);
            for (const m of o.meshes.slice(1)) m.dispose();
            o.meshes.length = 1;
        } else if (o.id === "vent") {
            // Refrozen: a glaze of ice seals the vent.
            deform.brush(o.x, o.z, 3.2, 0.04, 0, 0.5, 1, 0, 1, 0.6);
            o.meshes[1].dispose();
            o.meshes.length = 1;
        } else if (o.id === "drums") {
            // The vortex carries them off; the oil goes with them.
            o.lift = 1;
            o.meshes[0].dispose();
        }
        for (let k = 0; k < 40; k++) {
            const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 4;
            this.spray.emit(o.x, o.y + 0.5, o.z, Math.cos(a) * v, 3 + Math.random() * 5, Math.sin(a) * v,
                0.05 + Math.random() * 0.08, 1.6, 0, 1.2);
        }
    }

    /**
     * @param {number} dt
     * @param {{x:number, z:number}} [player]
     * @param {boolean} [ribbonHeld]
     * @returns {any|null} an objective completed this frame by a held power
     */
    update(dt, player, ribbonHeld) {
        this._t += dt;
        let completed = null;
        // The ground melts under the sites as the clock runs: keep every prop
        // sitting on it rather than hanging in the air.
        for (const o of this.list) {
            const dy = this._ground(o.x, o.z) - o.groundY;
            if (Math.abs(dy) < 0.002) continue;
            o.groundY += dy;
            o.y += dy;
            o.beacon.position.y += dy;
            for (const m of o.meshes) if (!m.isDisposed()) m.position.y += dy;
        }
        for (const o of this.list) {
            if (o.done || o.id !== "net" || !player) continue;
            const near = Math.hypot(o.x - player.x, o.z - player.z) <= REACH.net;
            o.hold = near && ribbonHeld ? o.hold + dt : Math.max(0, o.hold - dt * 0.5);
            if (o.hold >= NET_HOLD) {
                this._complete(o);
                completed = o;
            }
        }
        for (const o of this.list) {
            o.t += dt;
            // Beacon breathes while open, fades away once fixed.
            const pulse = 0.16 + 0.08 * Math.sin(this._t * 3 + o.x);
            if (o.done) {
                const k = Math.max(0, 1 - o.t / 4);
                o.beacon.scaling.x = o.beacon.scaling.z = 0.3 + k;
                o.beacon.material.setFloat("alpha", 0.22 * k);
            } else {
                // The current target stands out from the row; the rest wait, dimmer.
                const isTarget = o === this.target;
                o.beacon.material.setFloat("alpha", isTarget ? pulse * 2.2 : pulse * 0.6);
                o.beacon.scaling.x = o.beacon.scaling.z = isTarget ? 1.6 + 0.25 * Math.sin(this._t * 4) : 1;
            }

            if (!o.done && o.id === "vent" && Math.random() < dt * 30) {
                // Methane plume.
                this.spray.emit(o.x + (Math.random() - 0.5) * 0.5, o.y + 1.2, o.z + (Math.random() - 0.5) * 0.5,
                    (Math.random() - 0.5) * 0.6, 2.5 + Math.random() * 2, (Math.random() - 0.5) * 0.6,
                    0.12 + Math.random() * 0.15, 3, 0, 0.3);
            }

            if (!o.done && o.id === "fire" && Math.random() < dt * 22) {
                // Smoke off the embers.
                this.spray.emit(o.x + (Math.random() - 0.5) * 3, o.y + 0.4, o.z + (Math.random() - 0.5) * 3,
                    (Math.random() - 0.5) * 0.4, 1.4 + Math.random() * 1.5, (Math.random() - 0.5) * 0.4,
                    0.15 + Math.random() * 0.2, 3.5, 0, 0.3);
            }

            if (o.id === "drums" && o.lift > 0 && o.drums) {
                for (let k = 0; k < o.drums.length; k++) {
                    const d = o.drums[k];
                    if (d.isDisposed()) continue;
                    const a = o.t * (3 + k) + k * 1.6;
                    const r = 1.3 + o.t * 0.6;
                    d.position.set(o.x + Math.cos(a) * r, o.y + 0.4 + o.t * o.t * 2.2, o.z + Math.sin(a) * r);
                    d.rotation.x += dt * 4;
                    d.rotation.y += dt * 3;
                    if (o.t > 4) d.dispose();
                }
            }
        }
        return completed;
    }

    /** Light the two nearest open sites; the spells keep the other slots. */
    addLights(lights, player) {
        const open = this.list.filter((o) => !o.done);
        if (player) open.sort((a, b) =>
            Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z));
        for (const o of open.slice(0, 2)) {
            if (o.id === "vent") lights.add(o.x, o.y + 1.4, o.z, 7, 0.75, 0.95, 0.2, 1.6);
            else if (o.id === "fire") lights.add(o.x, o.y + 1.0, o.z, 8, 1.0, 0.4, 0.08, 2.2);
            else lights.add(o.x, o.y + 1.5, o.z, 6, 1.0, 0.45, 0.2, 0.9);
        }
    }
}
