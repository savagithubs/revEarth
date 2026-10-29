# revEarth

**You have the power to rev-Earth now.**

revEarth is a browser game about climate loss, made for a UN sustainability
hackathon challenge: reach 15–20 year olds with something as elusive as
sustainability. Instead of explaining it, the game lets you feel it.

**▶ Play: [savagithubs.github.io/revearth](https://savagithubs.github.io/revearth/)**

> Needs a WebGPU browser on a desktop: Chrome or Edge 113+, with a decent GPU.
> Click the game to capture the mouse; sound starts on that first click.

---

## The story (about 4 minutes)

1. **Present.** Explore an endless polar snow world with five water and ice
   powers. Peaceful music, animals calling in the distance.
2. **2100.** Without warning, the ice is gone. The hills have slumped into a
   flat plain of mud and meltwater. Your powers are gone. The ghosts of five
   species rise, circle you and cry out.
3. **Return.** Back in the present, still haunted, against a 150-second clock.
   Five wounds to heal, each with exactly one power, while the world melts
   around you: *"Please rev-Earth now, before it's too late."*
4. **Restored.** The ghosts gather, bow and rise away. Fail, and the future
   happens again.

| Power | Key | Repair |
|---|---|---|
| Sweep | `1` | Wash black-carbon soot off the snow |
| Ribbon | `2` (hold) | Pull a ghost fishing net free |
| Bloom | `3` | Put out a tundra fire |
| Crystallize | `4` | Refreeze a thawing methane vent |
| Vortex | `5` | Lift away leaking fuel drums |

## Controls

| Key | Action |
|---|---|
| `W` `A` `S` `D` | Move · `Shift` sprint |
| `Space` or right mouse | Surf |
| Mouse | Look · wheel to zoom |
| `1`–`5` | Powers (only work on their repair site during the return) |
| `C` | Face the current task |
| `G` (hold) | Walk to the current task |
| `Tab` | Next task |
| `M` | Mute |
| `F1` | Settings and performance overlay |
| `F2` / `F3` / `F4` | Presenter: next phase / previous phase / complete next task |

## Five worlds

The polar world is playable. Four more are designed in
[GAME_DESIGN.md](GAME_DESIGN.md), each tied to an ESA WorldCover land-cover
class, with its own lost future, five powers and five at-risk species:
**rainforest**, **shoreline**, **ocean** and **river**.

## How it's built

- **Babylon.js 9 + hand-written WGSL** on WebGPU, built with Vite.
- **Melting terrain:** one melt formula shared by the GPU shader and the CPU
  height lookup, so the player stays on the ground as the land flattens.
- **Ghosts:** procedural animal silhouettes with a custom HDR rim shader.
- **Audio:** all music, wind, power effects and animal cries are synthesised
  live with the Web Audio API. Narration is 11 clips voiced with Google Gemini
  TTS, bundled with the game.
- **Fully offline:** no network requests at runtime.

Architecture, rules and the verification checklist are in
[AGENTS.md](AGENTS.md).

## Run it locally

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # then: npm run play  → http://localhost:5190
```

`npm run play` serves the built `dist/` with Node built-ins only. WebGPU needs
`http://localhost` (or HTTPS), not a `file://` page.

## Credits

- Built on **[SNOWFLOW](https://github.com/Noniv/snowflow_demo)** by Maksymilian
  Dendura (MIT licence): the deformable snow, terrain, lighting and powers. Its
  original technical README is kept in [SNOWFLOW_README.md](SNOWFLOW_README.md).
- Narration voiced with Google Gemini TTS.
- Land-cover framing from ESA WorldCover (CC BY 4.0) and the Trends.Earth
  SDG 15.3.1 indicator.
- Designed and directed by [@savagithubs](https://github.com/savagithubs),
  built with Claude Code.

MIT licence: see [LICENSE](LICENSE).
