# AGENTS.md: revEarth (handover)

You're picking up **revEarth**, a hackathon game built on top of **SNOWFLOW**, an open-source (MIT) Babylon.js + WebGPU snow renderer by Maksymilian Dendura. This file covers what exists, how it works, the rules the owner set, and how to verify changes. For the player-facing design (all five biomes, powers, species and story), read `GAME_DESIGN.md`.

## The game in one paragraph
You explore an endless polar snow world with five water and ice powers. Without warning you're thrown into 2100: the ice has melted, the hills have slumped into a flat plain of mud, your powers are gone, and the ghosts of five species circle you and cry out. You return to the present, still haunted and against a clock. You must heal five wounds (soot, a ghost net, a tundra fire, a methane vent, fuel drums), each with one specific power, while the present visibly melts around you. Succeed and the ghosts gather, bow, and leave, and the narrator thanks you. Fail and the future happens again. The demo must fit in **4 minutes**.

## Owner's hard rules
1. **Fully self-contained and offline at runtime.** No CDNs, web fonts, remote assets or live API calls. All music and sound effects are synthesised with WebAudio. Narration is pre-recorded WAV files shipped in `public/`. Check this with the "zero external requests" test below.
2. **The music and animal cries are present throughout.** They carry the pressure. Narration only ducks the music slightly (to 0.75).
3. **No narration while the player repairs the timeline**, except:
   - the warning "Please rev-Earth now, before it's too late" (at 40%, 65% and 85% of the clock);
   - "Please use your powers wisely, and rev-Earth now" when a power is used anywhere other than its task (throttled to once per 8 s).
4. **Completion line:** "The Earth has been successfully rev-Earthed. Thank you for doing your part. The Earth thanks you. And never forget: you have the power to rev-Earth now."
5. **Pronunciation:** spoken text says "rev Earth" as two words. Run together, TTS says "rev-AY-arth" (verified from Windows voice phonemes). Subtitles show "rev-Earth".
6. **The narrator voice** is **"The Regal Monarch", take 3**: a female Gemini 3.8 Flash TTS Voice Design voice in Google AI Studio. The owner approved these clips ("perfect"). Don't regenerate them unless asked.
7. **Don't commit** until the owner says so. The work is on branch `revearth-polar`, and nothing has been committed yet; the only commit is the upstream `Init`.

## Run it
- **Offline build (use this for demos):** `node serve.mjs`, then open http://localhost:5190. It serves `dist/` using Node built-ins only, so no `npm install` is needed. It needs a WebGPU browser (Chrome or Edge), and must be served over `http://localhost` rather than opened as a `file://`.
- **Development:** `npm install`, then `npm run dev -- --port 5180`, then open http://localhost:5180.
- **Rebuild the offline copy** after any change with `npm run build`.

## Controls

| Key | Action |
|---|---|
| WASD | Move |
| Shift | Sprint |
| Space or right mouse | Surf |
| Mouse | Look (click the game first to capture the mouse) |
| Scroll wheel | Zoom |
| 1–5 | Powers: 1 Sweep, 2 Ribbon (hold), 3 Bloom (aimed), 4 Crystallize (aimed), 5 Vortex |
| C | Face the current task (aims the screen centre at it), or re-centre the camera |
| G (hold) | Walk to the current task; stops in range |
| Tab | Next task |
| M | Mute |
| F1 | Settings and performance overlay |
| **Presenter:** F2 / F3 | Next / previous phase (F2 on the ending restarts) |
| **Presenter:** F4 | Complete the next task |

## Story phases (`src/game/gameState.js`)

| Phase | Duration | What happens |
|---|---|---|
| `PRESENT` | 36 s | Free play. Peaceful score, living animals calling in the distance. |
| `FUTURE` | 46 s | `S.decay` = 1, so the terrain melts flat. Powers and surf off, walking at 0.7×. Ghosts rise; the narrator speaks one line per species. |
| `RETURN` | clock: 150 s | Five sites spawn in a fan ahead of the player. No surf. The player is tethered to the area. Powers only work beside their own site (`G.canCast`). The doom clock drags `S.decay` and other look keys toward the future. Each fix calms a ghost (it turns gold and stays) and auto-faces the next task. |
| `TOO_LATE` | — | Reached when the clock hits 0. Plays "Too late" and goes back to `FUTURE`. |
| `RESTORED` | ~11.5 s | Ghosts gather in a front arc and bow; the narrator says the completion line; ghosts ascend; ending screen with the 5 biome cards. Powers and surf are fully restored. |

## Architecture
The game layer lives in `src/game/`. Existing SNOWFLOW systems get small hooks only, mostly through the leaf module `src/game/flags.js` (`G`), which avoids circular imports.

| File | Role |
|---|---|
| `src/game/biomes.js` | All biome data: WorldCover class, present/future look presets (partial `S` dicts), species, powers, actions, and **narration** entries (`{text, say?, tone}`). Adding a biome starts here. |
| `src/game/gameState.js` | Phase machine. Also handles the doom clock, tether, task targeting (C/G/Tab), camera auto-face (no auto-recentring: with camera-relative movement it makes the camera and player chase each other in circles), narration triggers and wildlife calls. |
| `src/game/ghosts.js` | Five procedural ghost animals, built by merging primitives. They use a WGSL Fresnel-rim **HDR** shader. States: HIDDEN, RISING, HAUNTING, PEACEFUL, GATHER (bow), FREED. They follow in a half circle behind the player and lunge. |
| `src/game/objectives.js` | The five sites: props, beacons, detection (`onCast` by landing point, Ribbon by hold time), `canCast` ranges, re-grounding as the land melts. |
| `src/game/audio.js` | All synthesised audio: calm and tension scores, wind, surf hiss, footsteps, per-power effects, per-species cries (ghost/calm/alive modes), heartbeat, whispers, stingers. |
| `src/game/narrator.js` | Plays `public/narration/<biome>/<id>.wav` from `manifest.json`. Falls back to a local (offline) system voice per line. Queues lines and ducks the music. |
| `src/game/hud.js` | DOM overlay: objectives, compass, doom bar, status line, subtitles, title cards, vignette and heartbeat, ending screen. |
| `src/game/hdrMat.js` | An unlit HDR flat material for props and beacons. |
| `src/game/flags.js` | `G` switches: `powersEnabled`, `surfEnabled`, `walkScale`, `autoWalk`, `canCast`, `onCast`, `onSpell`, `onBlocked`, `addLights`. |
| `tools/make-narration.mjs` | Optional scripted TTS (ElevenLabs or Gemini API). `MANIFEST_ONLY=1` just indexes WAV files placed by hand. |
| `serve.mjs` | Zero-dependency static server for `dist/`. |

### Hooks into SNOWFLOW

| File | Change |
|---|---|
| `src/main.js` | Builds `Game` after `SpellSystem`, calls `game.update()` after `spells.update`, and exposes it as `globalThis.SNOWFLOW.game`. |
| `src/spells/spellSystem.js` | `_dispatch` gate (`G.powersEnabled`, `G.canCast`) plus the `G.onSpell`, `G.onCast` and `G.addLights` calls. |
| `src/core/input.js` | **Space surf was missing upstream** (only right mouse worked); fixed. Also adds the `G.autoWalk` forward input. |
| `src/character/controller.js` | Applies `G.surfEnabled` and `G.walkScale`. |
| `src/character/snowContact.js` | No footprints when `S.decay > 0.5`. |
| `src/shaders/snow.fragment.wgsl` | `decay` uniform: mud, slush and meltwater albedo; slope flattening. |
| `src/shaders/lib/clipmap.wgsl` (`meltHeight`) + `src/terrain/heightfield.js` (`heightAt`) | **The same melt formula on GPU and CPU**: `h → base + (h − base) × 0.2`, blended by decay. They must stay identical, or the character floats or sinks. The `melt` uniform is pushed to all three terrain materials in `terrain.js`. |
| `src/core/settings.js` | `decay: 0`. |

### Gotchas
- **HDR:** sunlit snow is about 12 in linear. Babylon's `StandardMaterial` clamps its output to 1, so it renders black under this exposure. Use `hdrMaterial()` or a custom WGSL shader with values scaled about 6–10×.
- **Sky re-solve:** changing the sun (`sunElevation`, `sunIntensity`, …) re-solves the sky asynchronously and stalls frames briefly. Those keys switch instantly behind the white-out flash (the `INSTANT` set) and are never tweened.
- **Spell lights:** the light pool has 4 slots. Spells take theirs first; objectives light only the 2 nearest sites, then ghosts use whatever is left.
- **Throttled test frames:** when the browser tab is in the background, frames are throttled. Tests should wait on `SNOWFLOW.scene.getFrameId()` or `game.t`, never wall-clock time.
- **Pointer lock** can't be granted to automated pages. Simulate it with `SNOWFLOW.input.locked = true` plus dispatched mouse events.

## Verifying changes (do this every time)
Use a browser with WebGPU. Everything is reachable from the console through `SNOWFLOW` (`game`, `character`, `rig`, `spells`, `terrain`, `S`, …).

1. **Loads cleanly:** no console errors, and `SNOWFLOW.game.phase === "PRESENT"`.
2. **Offline:** after a full run, this should return `[]`:
   ```js
   performance.getEntriesByType('resource').map(e => e.name)
     .filter(u => !u.startsWith(location.origin) && !u.startsWith('data:') && !u.startsWith('blob:'))
   ```
3. **Keys:** drive them with `window.dispatchEvent(new KeyboardEvent('keydown', {code}))`. Expected results:
   - W/A/S/D each move about 3.5 m in 1.5 s;
   - walking is 2.5 m/s, sprinting 5.4 m/s;
   - Space or right mouse surfs at up to about 17 m/s;
   - keys 1–5 set the spells' `.active` flags (Ribbon: `.held`);
   - F1 toggles `#ov.show`; M toggles `game.audio._muted`.
4. **Story:**
   - **Future:** `game.enter('FUTURE')`, then check:
     - `S.decay === 1`;
     - terrain relief drops from about 20 m to about 3.6 m (sample `terrain.heightAt` on a grid);
     - powers are blocked, surf is off, walking is 1.75 m/s;
     - all 5 species cry.
   - **Return:** `game.enter('RETURN')`, then check:
     - 5 sites spawn;
     - holding G walks to each site;
     - the compass shows "In range — press N";
     - each power key completes its site;
     - the camera auto-faces the next site;
     - a wrong power refuses with a reason and plays the "wise" line;
     - walking out is stopped at the tether;
     - setting `game.t = 148.5` gives "Too late" and then `FUTURE`.
   - **Restored:** ghosts reach state 5 (GATHER) in an arc between −63° and +63° in front of the player, with `rotation.x ≈ 0.55` (bowing); the narrator says `ending`; the ending screen shows 5 biome cards; powers and surf work again.
5. **Narration:** `game.narrator.source === "recorded"` and `Object.keys(game.narrator.buffers).length === 11`.

## What's next (suggested, not started)
- **The other four biomes** (rainforest, shoreline, ocean, river) are fully designed in `GAME_DESIGN.md` and `biomes.js`, each with powers, species and actions. Each one needs:
  - a terrain and material variant (driven by a uniform, like `decay`);
  - its five powers, reusing the swept-tube (`WaterBody`) and instanced-prism (`CrystalField`) systems where possible;
  - its sites in `objectives.js`;
  - its ghost silhouettes in `ghosts.js`;
  - its narration lines (record them in the same voice).
- Optional: seed each biome's look from real ESA WorldCover / Trends.Earth data (hackathon datasets; see `GAME_DESIGN.md`).
