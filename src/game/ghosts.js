/**
 * revEarth — the ghosts of the species the future lost.
 *
 * Each ghost is a soft silhouette merged from a handful of primitives and drawn
 * additively, without depth write, in the alpha group. They are deliberately
 * left out of the shadow cascades and the depth prepass: they cast nothing and
 * the temporal filter smears them as the camera turns, which is exactly how a
 * ghost should sit in the frame.
 *
 * They rise out of the ground, circle the player, close in over time and lunge.
 * They keep following when the player returns to the present, and only leave
 * when the damage that killed them is undone.
 */

import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { ShaderLanguage } from "@babylonjs/core/Materials/shaderLanguage";
import { ShaderStore } from "@babylonjs/core/Engines/shaderStore";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Constants } from "@babylonjs/core/Engines/constants";

// A spectral body: faint through the middle, bright at the silhouette (a
// Fresnel rim), with slow bands drifting up through it. Output is additive and
// in scene-linear HDR, because Babylon's stock materials clamp at 1.0 and the
// exposure here would crush that to near black.
const GHOST_VERT = `
attribute position: vec3f;
attribute normal: vec3f;
uniform world: mat4x4f;
uniform viewProjection: mat4x4f;
varying vN: vec3f;
varying vW: vec3f;
@vertex
fn main(input: VertexInputs) -> FragmentInputs {
    let w = uniforms.world * vec4f(vertexInputs.position, 1.0);
    vertexOutputs.vW = w.xyz;
    vertexOutputs.vN = normalize((uniforms.world * vec4f(vertexInputs.normal, 0.0)).xyz);
    vertexOutputs.position = uniforms.viewProjection * w;
}
`;
const GHOST_FRAG = `
uniform cameraPos: vec3f;
uniform tint: vec3f;
uniform fade: f32;
uniform time: f32;
varying vN: vec3f;
varying vW: vec3f;
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
    let V = normalize(uniforms.cameraPos - input.vW);
    let rim = pow(1.0 - abs(dot(normalize(input.vN), V)), 2.2);
    let bands = 0.75 + 0.25 * sin(input.vW.y * 6.0 - uniforms.time * 2.5);
    let k = (0.07 + 1.3 * rim) * bands * uniforms.fade;
    fragmentOutputs.color = vec4f(uniforms.tint * k, 1.0);
}
`;

function registerGhostShader() {
    ShaderStore.ShadersStoreWGSL["ghostVertexShader"] = GHOST_VERT;
    ShaderStore.ShadersStoreWGSL["ghostPixelShader"] = GHOST_FRAG;
}

const HIDDEN = 0;
const RISING = 1;
const HAUNTING = 2;
const FREED = 3;
/** Its habitat has been restored: calm, warm, still walking with the player. */
const PEACEFUL = 4;
/** The ending: gathered in front of the player, bowing. */
const GATHER = 5;

const TINT_HAUNT = new Color3(0.42, 0.78, 1.0).scale(6);
const TINT_PEACE = new Color3(1.0, 0.78, 0.42).scale(6);

// ------------------------------------------------------------ silhouettes
// Every builder faces +Z with its feet at y = 0.

function part(scene, parts, kind, pos, scale, rotX = 0) {
    const m = kind === "cone"
        ? CreateCylinder("gp", { diameterTop: 0, diameterBottom: 1, height: 1, tessellation: 10 }, scene)
        : CreateSphere("gp", { diameter: 1, segments: 10 }, scene);
    m.position.set(pos[0], pos[1], pos[2]);
    m.scaling.set(scale[0], scale[1], scale[2]);
    m.rotation.x = rotX;
    parts.push(m);
}

function polarBear(scene, p) {
    part(scene, p, "s", [0, 1.05, 0], [1.25, 1.1, 2.3]);       // body
    part(scene, p, "s", [0, 1.3, 1.3], [0.75, 0.7, 0.8]);      // shoulders
    part(scene, p, "s", [0, 1.35, 1.85], [0.55, 0.5, 0.65]);   // head
    part(scene, p, "s", [0, 1.22, 2.18], [0.3, 0.26, 0.4]);    // snout
    part(scene, p, "s", [0.2, 1.62, 1.75], [0.16, 0.16, 0.1]); // ears
    part(scene, p, "s", [-0.2, 1.62, 1.75], [0.16, 0.16, 0.1]);
    for (const [x, z] of [[0.38, 0.75], [-0.38, 0.75], [0.38, -0.75], [-0.38, -0.75]]) {
        part(scene, p, "s", [x, 0.45, z], [0.36, 0.95, 0.42]); // legs
    }
}

function seal(scene, p) {
    part(scene, p, "s", [0, 0.38, 0], [0.75, 0.66, 2.0]);      // body
    part(scene, p, "s", [0, 0.62, 0.95], [0.52, 0.5, 0.56]);   // head
    part(scene, p, "s", [0, 0.55, 1.22], [0.24, 0.2, 0.26]);   // muzzle
    part(scene, p, "s", [0.42, 0.2, 0.45], [0.42, 0.08, 0.22]); // fore flippers
    part(scene, p, "s", [-0.42, 0.2, 0.45], [0.42, 0.08, 0.22]);
    part(scene, p, "s", [0.16, 0.2, -1.05], [0.32, 0.08, 0.42]); // tail flippers
    part(scene, p, "s", [-0.16, 0.2, -1.05], [0.32, 0.08, 0.42]);
}

function arcticFox(scene, p) {
    part(scene, p, "s", [0, 0.48, 0], [0.42, 0.42, 0.85]);     // body
    part(scene, p, "s", [0, 0.66, 0.5], [0.32, 0.3, 0.34]);    // head
    part(scene, p, "s", [0, 0.6, 0.72], [0.14, 0.12, 0.26]);   // snout
    part(scene, p, "cone", [0.1, 0.86, 0.48], [0.12, 0.2, 0.08]);  // ears
    part(scene, p, "cone", [-0.1, 0.86, 0.48], [0.12, 0.2, 0.08]);
    part(scene, p, "s", [0, 0.5, -0.62], [0.3, 0.3, 0.75], 0.5);   // brush tail
    for (const [x, z] of [[0.13, 0.25], [-0.13, 0.25], [0.13, -0.25], [-0.13, -0.25]]) {
        part(scene, p, "s", [x, 0.18, z], [0.1, 0.4, 0.12]);
    }
}

function penguin(scene, p) {
    part(scene, p, "s", [0, 0.62, 0], [0.62, 1.15, 0.55]);     // body
    part(scene, p, "s", [0, 1.32, 0.04], [0.36, 0.36, 0.36]);  // head
    part(scene, p, "cone", [0, 1.28, 0.3], [0.08, 0.26, 0.08], Math.PI / 2); // beak
    part(scene, p, "s", [0.34, 0.75, 0], [0.1, 0.62, 0.2]);    // flippers
    part(scene, p, "s", [-0.34, 0.75, 0], [0.1, 0.62, 0.2]);
    part(scene, p, "s", [0.13, 0.05, 0.12], [0.18, 0.06, 0.24]); // feet
    part(scene, p, "s", [-0.13, 0.05, 0.12], [0.18, 0.06, 0.24]);
}

function walrus(scene, p) {
    part(scene, p, "s", [0, 0.75, -0.2], [1.5, 1.3, 2.6]);     // great bulk
    part(scene, p, "s", [0, 1.1, 1.1], [0.95, 0.85, 0.8]);     // head
    part(scene, p, "s", [0, 0.95, 1.45], [0.75, 0.5, 0.45]);   // whiskered muzzle
    part(scene, p, "cone", [0.16, 0.45, 1.52], [0.09, 0.75, 0.09], Math.PI); // tusks
    part(scene, p, "cone", [-0.16, 0.45, 1.52], [0.09, 0.75, 0.09], Math.PI);
    part(scene, p, "s", [0.72, 0.18, 0.6], [0.6, 0.1, 0.32]);  // fore flippers
    part(scene, p, "s", [-0.72, 0.18, 0.6], [0.6, 0.1, 0.32]);
    part(scene, p, "s", [0, 0.25, -1.6], [0.9, 0.1, 0.5]);     // tail flippers
}

const BUILDERS = {
    "Polar bear": polarBear,
    "Ringed seal": seal,
    "Arctic fox": arcticFox,
    "Emperor penguin": penguin,
    "Walrus": walrus,
};

/** Smallest signed angle from a to b. */
function wrap(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
}

// ------------------------------------------------------------------ system

export class Ghosts {
    /**
     * @param {import("@babylonjs/core/scene").Scene} scene
     * @param {{ heightAt(x:number, z:number): number }} terrain
     * @param {{ addTrauma(a:number): void }} rig
     * @param {string[]} species
     */
    constructor(scene, terrain, rig, species) {
        this.terrain = terrain;
        this.rig = rig;

        registerGhostShader();
        /** One material per ghost, so each can fade on its own. */
        this._makeMat = (i) => {
            const mat = new ShaderMaterial(
                "ghostMat" + i, scene, { vertex: "ghost", fragment: "ghost" },
                {
                    attributes: ["position", "normal"],
                    uniforms: ["world", "viewProjection", "cameraPos", "tint", "fade", "time"],
                    shaderLanguage: ShaderLanguage.WGSL,
                    needAlphaBlending: true,
                }
            );
            mat.alphaMode = Constants.ALPHA_ADD;
            mat.backFaceCulling = false;
            mat.disableDepthWrite = true;
            // Scene-linear HDR: sunlit snow sits near 12 here, so a ghost has
            // to sit on the same scale to survive the exposure.
            mat.setColor3("tint", TINT_HAUNT);
            mat.setFloat("fade", 0);
            return mat;
        };
        this._time = 0;
        /** Smoothed player heading the formation hangs off. */
        this._face = 0;
        /** @type {null | ((pan: number, name: string) => void)} */
        this.onRise = null;
        /** @type {null | ((pan: number, name: string) => void)} */
        this.onLunge = null;
        /** @type {null | ((pan: number, name: string, calm: boolean) => void)} the species' own call */
        this.onCry = null;
        /** 0..1 how far the gathered ghosts have bowed. */
        this._bow = 0;
        this._bowing = false;

        /** @type {{name:string, mesh:Mesh, state:number, t:number, angle:number,
         *          radius:number, spin:number, lunge:number, nextLunge:number,
         *          alpha:number, x:number, y:number, z:number}[]} */
        this.list = [];
        species.filter((n) => BUILDERS[n]).forEach((name, i) => {
            const parts = [];
            BUILDERS[name](scene, parts);
            const mesh = Mesh.MergeMeshes(parts, true, true);
            mesh.name = "ghost:" + name;
            mesh.material = this._makeMat(i);
            mesh.renderingGroupId = 2;
            mesh.isPickable = false;
            mesh.setEnabled(false);
            this.list.push({
                name, mesh, state: HIDDEN, t: 0,
                angle: 0, radius: 14,
                lunge: 0, nextLunge: 7 + i * 3.1, alpha: 0,
                x: 0, y: 0, z: 0, placed: false, nextCry: 5 + i * 2.7,
            });
        });
    }

    /** Ghosts still haunting — the ones the player has not yet made peace with. */
    get haunting() {
        return this.list.filter((g) => g.state === RISING || g.state === HAUNTING).length;
    }

    /** Raise every hidden ghost out of the ground around the player. */
    summonAll() {
        let i = 0;
        for (const g of this.list) {
            if (g.state !== HIDDEN) continue;
            g.state = RISING;
            g.t = -i * 0.7; // they surface one after another, not all at once
            g.radius = 14;
            g.placed = false;
            g.mesh.setEnabled(true);
            g.mesh.material.setColor3("tint", TINT_HAUNT);
            i++;
        }
    }

    /**
     * Its habitat is safe again: the next haunting ghost turns warm and calm.
     * It does not leave — it keeps walking with the player until the end.
     * @returns {string|null} its species
     */
    calmOne() {
        const g = this.list.find((h) => h.state === RISING || h.state === HAUNTING);
        if (!g) return null;
        g.state = PEACEFUL;
        g.lunge = 0;
        g.mesh.material.setColor3("tint", TINT_PEACE);
        return g.name;
    }

    /** The timeline failed: every ghost turns on the player again. */
    rehaunt() {
        for (const g of this.list) {
            if (g.state !== PEACEFUL && g.state !== GATHER) continue;
            g.state = HAUNTING;
            g.mesh.material.setColor3("tint", TINT_HAUNT);
        }
        this._bowing = false;
        this._bow = 0;
    }

    /** The ending: all of them come round in front of the player. */
    gather() {
        for (const g of this.list) {
            if (g.state === HIDDEN || g.state === FREED) continue;
            g.state = GATHER;
            g.lunge = 0;
            g.mesh.material.setColor3("tint", TINT_PEACE);
        }
        this._bowing = false;
        this._bow = 0;
    }

    /** ...and bow to them. */
    bow() {
        this._bowing = true;
    }

    /** ...and rise into the sky. */
    ascendAll() {
        for (const g of this.list) {
            if (g.state !== GATHER && g.state !== PEACEFUL) continue;
            g.state = FREED;
            g.t = 0;
        }
    }

    /** Put everything back underground — used when stepping phases backwards. */
    reset() {
        for (const g of this.list) {
            g.state = HIDDEN;
            g.alpha = 0;
            g.mesh.rotation.x = 0;
            g.mesh.setEnabled(false);
        }
        this._bowing = false;
        this._bow = 0;
    }

    /** -1 (left of screen) .. 1 (right), for panning a ghost's voice. */
    _pan(g) {
        const c = this._cam, r = this.rig.right;
        const dx = g.x - c.x, dz = g.z - c.z;
        const d = Math.hypot(dx, dz) || 1;
        return (dx * r.x + dz * r.z) / d;
    }

    /**
     * The procession. Live ghosts hold a half circle behind the player — from
     * the left flank, around the back, to the right flank — spaced evenly and
     * re-spaced as each one is freed. They trail on a lag, so they visibly
     * *follow*: turn and the whole arc swings round after you; stop and it
     * closes in. The flanks stay in the corners of the frame while you walk;
     * look back and the whole line of them is there.
     *
     * @param {number} dt
     * @param {{position:{x:number,y:number,z:number}, facing:number}} character
     * @param {number} pressure 0..1 how hard they close in
     * @returns {number} 0..1 haunting intensity for the HUD
     */
    update(dt, character, pressure) {
        const player = character.position;
        let haunt = 0;
        this._time += dt;
        this._cam = this.rig.camera.position;
        this._face += wrap(character.facing - this._face) * Math.min(1, dt * 1.3);

        // Peaceful ghosts keep their place in the procession; gathered ones
        // form their own arc in front.
        const live = this.list.filter((h) => h.state === RISING || h.state === HAUNTING || h.state === PEACEFUL);
        const gathered = this.list.filter((h) => h.state === GATHER);
        this._bow += ((this._bowing ? 1 : 0) - this._bow) * Math.min(1, dt * 2.2);
        const want = 11 - 6 * pressure;

        for (const g of this.list) {
            if (g.state === HIDDEN) continue;
            g.t += dt;
            if (g.t < 0) continue; // still waiting its turn to surface

            if (g.state === RISING && !g.placed) {
                g.placed = true;
                this.onRise?.(this._pan(g), g.name);
            }

            if (g.state === FREED) {
                // Rise and dissolve into the sky.
                g.y += dt * (2 + g.t * 3);
                g.alpha = Math.max(0, 1 - g.t / 3);
                if (g.alpha <= 0) {
                    g.state = HIDDEN;
                    g.mesh.setEnabled(false);
                    continue;
                }
            } else {
                // Slot on the half circle: left flank (+90°) round the back
                // (180°) to the right flank (+270°) of the player's heading.
                const gather = g.state === GATHER;
                const group = gather ? gathered : live;
                const slot = group.indexOf(g);
                const n = group.length;
                const s = n > 1 ? slot / (n - 1) : 0.5;
                // Gathered: a shallower arc in *front* of the player, facing them.
                g.angle = gather
                    ? this._face - Math.PI * 0.35 + Math.PI * 0.7 * s
                    : this._face + Math.PI * 0.5 + Math.PI * s;
                const wantR = gather ? 6 : g.state === PEACEFUL ? 7 : want;
                g.radius += (wantR - g.radius) * Math.min(1, dt * (gather ? 1.5 : 0.4));

                g.nextLunge -= dt;
                if (g.state === HAUNTING && g.nextLunge <= 0) {
                    g.lunge = 1;
                    g.nextLunge = 8 + Math.random() * 6 - 3 * pressure;
                    this.rig.addTrauma(0.18);
                    this.onLunge?.(this._pan(g), g.name);
                }
                if (g.state !== HAUNTING) g.lunge = 0;
                g.lunge = Math.max(0, g.lunge - dt * 0.9);

                // Each one keeps calling, in its own voice, out of time with the rest.
                g.nextCry -= dt;
                // Calmed ones keep calling too — softer, and without the dread.
                if ((g.state === HAUNTING || g.state === PEACEFUL) && g.nextCry <= 0) {
                    g.nextCry = 7 + Math.random() * 7;
                    this.onCry?.(this._pan(g), g.name, g.state === PEACEFUL);
                }
                const lungeShape = Math.sin(Math.min(1, g.lunge) * Math.PI);
                const r = g.radius * (1 - 0.7 * lungeShape);

                const tx = player.x + Math.sin(g.angle) * r;
                const tz = player.z + Math.cos(g.angle) * r;
                if (g.state === RISING && g.t < dt * 2) {
                    g.x = tx; g.z = tz; // surface in place
                } else {
                    // Trail on a lag; a lunge snaps in fast.
                    const k = Math.min(1, dt * (lungeShape > 0.05 ? 6 : gather ? 2.5 : 1.5));
                    g.x += (tx - g.x) * k;
                    g.z += (tz - g.z) * k;
                }
                const ground = this.terrain.heightAt(g.x, g.z);
                const bob = 0.35 + Math.sin(g.t * 1.7 + g.angle) * 0.25;

                if (g.state === RISING) {
                    const k = Math.min(1, g.t / 2.5);
                    g.y = ground - 2.5 * (1 - k) + bob * k;
                    g.alpha = k;
                    if (k >= 1) g.state = HAUNTING;
                } else if (gather) {
                    // Settle, then bow: lowered and tipped toward the player.
                    g.y = ground + 0.2 - 0.45 * this._bow;
                    g.alpha = 0.95;
                } else {
                    g.y = ground + bob;
                    g.alpha = g.state === PEACEFUL ? 0.75 : 0.8 + 0.2 * Math.sin(g.t * 3.1 + g.angle);
                }

                if (g.state === RISING || g.state === HAUNTING) {
                    const dist = Math.hypot(g.x - player.x, g.z - player.z);
                    haunt += Math.min(1, Math.max(0, (16 - dist) / 12));
                }
            }

            g.mesh.position.set(g.x, g.y, g.z);
            // Facing the player: they are not following you anywhere, they
            // are following *you*.
            g.mesh.rotation.y = Math.atan2(player.x - g.x, player.z - g.z);
            // Positive pitch tips the head (+Z) down toward the player.
            g.mesh.rotation.x = g.state === GATHER ? 0.55 * this._bow : 0;
            const m = g.mesh.material;
            m.setFloat("fade", g.alpha);
            m.setFloat("time", this._time + g.angle * 3);
            m.setVector3("cameraPos", this._cam);
        }
        return Math.min(1, haunt / 2);
    }

    /** The nearest live ghost lights the snow it hovers over. */
    addLights(lights, player) {
        let best = null;
        let bd = 1e9;
        for (const g of this.list) {
            if (g.state === HIDDEN) continue;
            const d = Math.hypot(g.x - player.x, g.z - player.z);
            if (g.t >= 0 && d < bd) { bd = d; best = g; }
        }
        if (best) lights.add(best.x, best.y + 1, best.z, 6, 0.45, 0.8, 1.0, 1.4 * best.alpha);
    }
}
