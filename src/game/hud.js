/**
 * revEarth — the game's DOM layer.
 *
 * Everything the story needs to say on screen: the biome line, the objective
 * list, toasts, full-screen title cards, the white-out, the haunting vignette
 * and the ending with the biome map. Plain DOM over the canvas, in the boot
 * screen's palette, so it reads as part of the same piece.
 */

import { BIOMES } from "./biomes.js";

const CSS = `
#rv { position: fixed; inset: 0; z-index: 60; pointer-events: none;
  font-family: ui-sans-serif, "Inter", "Segoe UI", system-ui, sans-serif; color: var(--frost); }
#rv .top { position: absolute; left: 22px; top: 18px; }
#rv .top b { display: block; font-size: 12px; font-weight: 600; letter-spacing: 0.34em; text-transform: uppercase; }
#rv .top i { display: block; font-style: normal; font-size: 10px; letter-spacing: 0.16em; color: var(--frost-dim); margin-top: 4px; }
#rv .phase { display: inline-block; margin-top: 8px; padding: 3px 8px; font-size: 10px; letter-spacing: 0.22em;
  text-transform: uppercase; border: 1px solid rgba(143,196,232,0.3); border-radius: 3px; color: var(--accent); }
#rv .phase.bad { color: #e8734f; border-color: rgba(232,115,79,0.45); }
#rv .phase.good { color: #9be8b4; border-color: rgba(155,232,180,0.45); }
#rv .obj { position: absolute; left: 22px; top: 112px; width: 300px; display: none;
  background: rgba(7,11,18,0.55); backdrop-filter: blur(10px); border: 1px solid rgba(143,196,232,0.14);
  border-radius: 6px; padding: 12px 14px; }
#rv .obj.show { display: block; }
#rv .obj h3 { font-size: 10px; font-weight: 500; letter-spacing: 0.24em; text-transform: uppercase; color: #9be8b4; margin-bottom: 8px; }
#rv .obj .it { display: flex; gap: 10px; margin: 6px 0; font-size: 12px; line-height: 1.35; }
#rv .obj .box { flex: 0 0 14px; height: 14px; margin-top: 2px; border: 1px solid var(--accent); border-radius: 3px; }
#rv .obj .it.done { opacity: 0.45; text-decoration: line-through; }
#rv .obj .it.done .box { background: #9be8b4; border-color: #9be8b4; }
#rv .obj small { display: block; font-size: 11px; color: var(--frost-dim); text-decoration: none; }
#rv .obj .ghosts { margin-top: 10px; font-size: 11px; letter-spacing: 0.12em; color: #c7a6ff; }
#rv .toast { position: absolute; left: 50%; bottom: 13%; transform: translateX(-50%);
  max-width: 70vw; text-align: center; font-size: 17px; letter-spacing: 0.04em; text-shadow: 0 2px 14px #000;
  opacity: 0; transition: opacity 400ms; }
#rv .toast.show { opacity: 1; }
#rv .status { position: absolute; left: 50%; top: 22%; transform: translateX(-50%); font-size: 14px;
  letter-spacing: 0.18em; text-transform: uppercase; color: #e8734f; text-shadow: 0 2px 12px #000;
  opacity: 0; transition: opacity 250ms; }
#rv .status.show { opacity: 1; }
#rv .doom { position: absolute; left: 50%; top: 16px; transform: translateX(-50%); width: min(420px, 60vw);
  text-align: center; display: none; }
#rv .doom.show { display: block; }
#rv .doom .lbl { font-size: 10px; letter-spacing: 0.3em; text-transform: uppercase; color: #e8b04f; margin-bottom: 6px; }
#rv .doom .bar { height: 6px; border-radius: 3px; background: rgba(255,255,255,0.12); overflow: hidden; }
#rv .doom .fill { height: 100%; width: 100%; background: linear-gradient(90deg, #e8734f, #e8b04f); transform-origin: left; }
#rv .doom.crit .lbl { color: #ff5a3c; animation: rvPulse 0.8s infinite; }
#rv .doom.crit .fill { background: #ff3c28; }
@keyframes rvPulse { 50% { opacity: 0.35; } }
#rv .compass { position: absolute; left: 50%; top: 58px; transform: translateX(-50%); display: none;
  align-items: center; gap: 10px; padding: 6px 12px; border-radius: 20px; background: rgba(7,11,18,0.55);
  border: 1px solid rgba(143,196,232,0.18); font-size: 12px; letter-spacing: 0.06em; }
#rv .compass.show { display: flex; }
#rv .compass .arrow { width: 22px; height: 22px; display: grid; place-items: center; color: #e8b04f; font-size: 18px; }
#rv .compass small { color: var(--frost-dim); }
#rv .compass.near { border-color: rgba(155,232,180,0.7); }
#rv .compass.near .cd { color: #9be8b4; font-weight: 600; }
#rv .compass.near .arrow { color: #9be8b4; }
#rv .look { position: absolute; left: 50%; bottom: 26%; transform: translateX(-50%); display: none;
  padding: 8px 16px; border-radius: 20px; background: rgba(7,11,18,0.7); font-size: 13px; letter-spacing: 0.08em; }
#rv .look.show { display: block; }
#rv .card { position: absolute; inset: 0; display: grid; place-items: center; text-align: center;
  background: radial-gradient(120% 90% at 50% 45%, rgba(10,14,22,0.55), rgba(3,4,8,0.9));
  opacity: 0; transition: opacity 700ms; }
#rv .card.show { opacity: 1; }
#rv .card .yr { font-size: 13px; letter-spacing: 0.6em; color: #e8734f; margin-bottom: 18px; }
#rv .card h1 { font-size: clamp(30px, 5vw, 64px); font-weight: 300; letter-spacing: 0.08em; }
#rv .card p { margin-top: 16px; font-size: 16px; color: var(--frost-dim); max-width: 640px; line-height: 1.5; }
#rv .flash { position: absolute; inset: 0; background: #f4f8ff; opacity: 0; }
#rv .vig { position: absolute; inset: 0; opacity: 0;
  background: radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(90,20,80,0.55) 80%, rgba(40,0,30,0.92) 100%); }
#rv .end { position: absolute; inset: 0; display: none; place-items: center; overflow-y: auto; pointer-events: auto;
  background: radial-gradient(120% 90% at 50% 40%, rgba(10,18,26,0.82), rgba(3,5,9,0.96)); padding: 40px 16px; }
#rv .end.show { display: grid; }
#rv .end .wrap { max-width: 1080px; width: 100%; text-align: center; }
#rv .end .tag { font-size: 12px; letter-spacing: 0.5em; color: #9be8b4; }
#rv .end h1 { font-size: clamp(30px, 5vw, 58px); font-weight: 300; letter-spacing: 0.1em; margin: 12px 0 6px; }
#rv .end .sdg { font-size: 13px; color: var(--frost-dim); margin-bottom: 28px; }
#rv .end .sdg b { color: #e8734f; font-weight: 600; } #rv .end .sdg b.up { color: #9be8b4; }
#rv .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; text-align: left; }
#rv .bc { border: 1px solid rgba(143,196,232,0.16); border-radius: 8px; padding: 14px; background: rgba(13,20,31,0.7); }
#rv .bc.done { border-color: rgba(155,232,180,0.6); }
#rv .bc h4 { font-size: 12px; letter-spacing: 0.24em; text-transform: uppercase; }
#rv .bc .st { font-size: 10px; letter-spacing: 0.2em; color: #e8b04f; margin: 4px 0 8px; }
#rv .bc.done .st { color: #9be8b4; }
#rv .bc p { font-size: 12px; color: var(--frost-dim); line-height: 1.45; margin: 4px 0; }
#rv .bc p b { color: var(--frost); font-weight: 500; }
#rv .end .cred { margin-top: 22px; font-size: 10px; color: #55677a; letter-spacing: 0.06em; line-height: 1.6; }
`;

export class Hud {
    constructor() {
        const style = document.createElement("style");
        style.textContent = CSS;
        document.head.appendChild(style);

        const root = document.createElement("div");
        root.id = "rv";
        root.innerHTML = `
          <div class="vig"></div>
          <div class="top"><b class="bn"></b><i class="wc"></i><span class="phase"></span></div>
          <div class="obj"><h3>revEarth · undo the future</h3><div class="list"></div><div class="ghosts"></div></div>
          <div class="toast"></div>
          <div class="status"></div>
          <div class="doom"><div class="lbl">Time left to rev-Earth</div><div class="bar"><div class="fill"></div></div></div>
          <div class="compass"><div class="arrow">&#x2191;</div><div><span class="ct"></span> <small class="cd"></small></div><small class="ck">C face · G walk · Tab next</small></div>
          <div class="look">Click the game to look around with the mouse</div>
          <div class="card"><div><div class="yr"></div><h1></h1><p></p></div></div>
          <div class="end"></div>
          <div class="flash"></div>`;
        document.body.appendChild(root);

        this.root = root;
        this.$ = (s) => root.querySelector(s);
        this.canvas = document.getElementById("view");
        this._toastT = 0;
        this._statusT = 0;
        this._cardT = 0;
        this._flash = 0;
        this._vig = 0;
        this._pulse = 0;
        this._desat = 0;
        this._lastSat = -1;
    }

    setBiome(b) {
        this.$(".bn").textContent = b.name;
        this.$(".wc").textContent = "ESA WorldCover · " + b.worldCover;
    }

    setPhase(text, kind) {
        const el = this.$(".phase");
        el.textContent = text;
        el.className = "phase" + (kind ? " " + kind : "");
    }

    toast(text, seconds = 3.2) {
        const el = this.$(".toast");
        el.textContent = text;
        el.classList.add("show");
        this._toastT = seconds;
    }

    /** A short system line, kept apart from the story toasts so neither hides the other. */
    status(text, seconds = 1.8) {
        const el = this.$(".status");
        el.textContent = text;
        el.classList.add("show");
        this._statusT = seconds;
    }

    card(year, title, line, seconds = 4) {
        this.$(".card .yr").textContent = year || "";
        this.$(".card h1").textContent = title;
        this.$(".card p").textContent = line || "";
        this.$(".card").classList.add("show");
        this._cardT = seconds;
    }

    hideCard() {
        this.$(".card").classList.remove("show");
        this._cardT = 0;
    }

    flash() {
        this._flash = 1;
    }

    /** @param {{label:string, why?:string, hint?:string, done?:boolean}[] | null} list */
    objectives(list, ghostsLeft) {
        const box = this.$(".obj");
        if (!list) {
            box.classList.remove("show");
            return;
        }
        box.classList.add("show");
        // Only the next open task carries its explanation; the rest stay one
        // line each, so the list never buries the world.
        const next = list.find((o) => !o.done);
        this.$(".obj .list").innerHTML = list.map((o) => `
          <div class="it${o.done ? " done" : ""}"><div class="box"></div>
          <div>${o.spell ? o.spell + " · " : ""}${o.label}${o === next
              ? `<small>${o.hint || ""}${o.why ? " · " + o.why : ""}</small>` : ""}</div></div>`
        ).join("");
        this.$(".obj .ghosts").textContent =
            ghostsLeft > 0 ? `${ghostsLeft} ghost${ghostsLeft > 1 ? "s" : ""} still haunting you` : "The ghosts are at peace.";
    }

    /**
     * @param {number} haunt 0..1 how close and how many ghosts
     * @param {number} desat 0..1 colour drained out of the world
     */
    setMood(haunt, desat) {
        this._vig = haunt;
        this._desat = desat;
    }

    /** @param {number|null} left 0..1 of the clock remaining, null hides it */
    doom(left, seconds) {
        const el = this.$(".doom");
        if (left === null) { el.classList.remove("show"); return; }
        el.classList.add("show");
        el.classList.toggle("crit", left < 0.25);
        this.$(".doom .fill").style.transform = `scaleX(${Math.max(0, left)})`;
        this.$(".doom .lbl").textContent = `Time left to rev-Earth · ${Math.ceil(seconds)}s`;
    }

    /**
     * Point the way to the next task, relative to where the camera looks.
     * @param {{label:string, angle:number, dist:number} | null} c
     */
    compass(c) {
        const el = this.$(".compass");
        if (!c) { el.classList.remove("show"); return; }
        el.classList.add("show");
        this.$(".compass .arrow").style.transform = `rotate(${c.angle}rad)`;
        this.$(".compass .ct").textContent = c.label;
        el.classList.toggle("near", !!c.inRange);
        this.$(".compass .cd").textContent = c.inRange ? `In range — press ${c.key}` : `${Math.round(c.dist)} m`;
    }

    lookPrompt(show) {
        this.$(".look").classList.toggle("show", show);
    }

    showEnding(biome, actionsDone) {
        const cards = BIOMES.map((b) => {
            const done = b.id === biome.id;
            return `<div class="bc${done ? " done" : ""}">
              <h4>${b.name}</h4>
              <div class="st">${done ? "REVEARTHED" : "THREATENED · NEXT"}</div>
              <p><b>If lost:</b> ${b.lost}</p>
              <p><b>Ghosts:</b> ${b.species.slice(0, 4).join(", ")}</p>
              <p><b>Powers:</b> ${b.powers.map((p) => p[0]).join(" · ")}</p>
            </div>`;
        }).join("");
        this.$(".end").innerHTML = `<div class="wrap">
            <div class="tag">THE FUTURE HAS CHANGED</div>
            <h1>${biome.name} · revEarthed</h1>
            <div class="sdg">SDG 15.3.1 land condition: future <b>−1 degraded</b> → now <b class="up">+1 improving</b>
              &nbsp;·&nbsp; ${actionsDone.length} actions taken: ${actionsDone.join(", ")}</div>
            <div class="grid">${cards}</div>
            <div class="cred">Land cover classes: ESA WorldCover 2021 v200 (CC BY 4.0). Degradation coding: Trends.Earth SDG 15.3.1.
              World and rendering built on SNOWFLOW by Maksymilian Dendura (MIT).</div>
          </div>`;
        this.$(".end").classList.add("show");
        if (document.pointerLockElement) document.exitPointerLock();
    }

    hideEnding() {
        this.$(".end").classList.remove("show");
    }

    update(dt) {
        if (this._toastT > 0 && (this._toastT -= dt) <= 0) this.$(".toast").classList.remove("show");
        if (this._statusT > 0 && (this._statusT -= dt) <= 0) this.$(".status").classList.remove("show");
        if (this._cardT > 0 && (this._cardT -= dt) <= 0) this.hideCard();

        if (this._flash > 0) {
            this._flash = Math.max(0, this._flash - dt * 0.55);
            this.$(".flash").style.opacity = String(Math.min(1, this._flash * 1.4));
        }

        // A heartbeat: two quick beats a little under one per second, faster
        // and harder the closer the ghosts are.
        this._pulse += dt * (0.9 + this._vig * 0.8);
        const ph = this._pulse % 1;
        const beat = Math.exp(-((ph - 0.05) ** 2) / 0.002) + 0.6 * Math.exp(-((ph - 0.22) ** 2) / 0.002);
        this.$(".vig").style.opacity = String(Math.min(1, this._vig * (0.55 + 0.45 * beat)));

        const sat = Math.round((1 - this._desat * 0.45) * 100) / 100;
        if (sat !== this._lastSat) {
            this._lastSat = sat;
            this.canvas.style.filter = sat < 0.995 ? `saturate(${sat}) contrast(1.05)` : "";
        }
    }
}
