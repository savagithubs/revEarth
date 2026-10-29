# revEarth: game design

> Explore a living world. Lose it. Come back and undo it.

revEarth drops you into dreamy, endless open worlds built around Earth's critical ecosystems. You explore freely, with powers drawn from that place. Then, without warning, you're thrown into the future where the ecosystem has collapsed. Your powers are gone, the land is ruined, and the ghosts of the species that died there haunt you. You return to the present still haunted, and only undoing the damage (**revEarthing**) sets the ghosts free.

## The core loop

| Phase | Feeling | What the player does |
|---|---|---|
| **Present** | Wonder, play | Explore an endless world with 5 elemental powers |
| **Collapse** | Shock | White-out, then the title card: *"2100. The ice is gone."* |
| **Future** | Loss, dread | Walk a ruined version of the same place with no powers and slower movement. Ghost animals rise, circle and close in. Each one says how it died. |
| **Return** | Urgency, agency | Back in the present, still haunted. Use your powers to undo specific damage. Each fix frees one ghost. |
| **Restored** | Relief, hope | The ghosts leave. The land-condition score flips from −1 to +1. The map shows the next threatened biome. |

The haunting is the pressure: the ghosts stay until the harm humans caused is undone.

## The 4-minute demo (polar biome, playable now)

| Time | Beat |
|---|---|
| 0:00–0:36 | Play in the snow: surf (Space/RMB) and powers 1–5 |
| 0:36 | Collapse into 2100 |
| 0:36–1:22 | The melted future: the ice hills have slumped into a flat plain of mud and meltwater. No powers, a brown haze. The narrator speaks for each of the 5 ghosts while they cry and close in |
| 1:22–3:30 | Return, against a 150-second clock. Five beacons, one per power: wash the soot (Sweep 1), wash away the ghost net (hold Ribbon 2), douse the tundra fire (Bloom 3), refreeze the methane vent (Crystallize 4), lift the fuel drums (Vortex 5) |
| 3:30–3:42 | The ghosts gather in front of you and bow. The narrator says "The Earth has been successfully rev-Earthed. Thank you for doing your part. The Earth thanks you. And never forget: you have the power to rev-Earth now." Then they rise away |
| 3:42–4:00 | The 5-biome map |

## Controls

| Key | Action |
|---|---|
| WASD | Move |
| Shift | Sprint |
| Space or right mouse | Surf |
| Mouse | Look (click the game first to capture the mouse) |
| Scroll | Zoom |
| 1–5 | Powers (2 is held) |
| M | Mute |
| F1 | Settings |

**Getting to each task (during the return):**
- The compass at the top shows the current task, numbered 1 to 5 in key order, with its distance. When you're close enough it turns green: "In range — press N".
- **C** turns the camera to face the task. For Bloom (3) and Crystallize (4) it aims the centre of the screen at it, so pressing the key lands.
- Hold **G** to walk there; it stops by itself in range.
- **Tab** picks the next task.
- After each fix, the camera turns to the next task by itself.

**Presenter keys:**

| Key | Action |
|---|---|
| F2 | Next phase (on the ending, it restarts the run) |
| F3 | Previous phase |
| F4 | Complete the next task |

## The return: feeling the consequences
- **No free roaming.** You can't surf, and the ghosts block you from straying more than about 14 m beyond the damaged area.
- **Powers only answer where the Earth needs them.** Each power works only beside the site it heals. Anywhere else it fizzles with a reason ("Get closer…", "That wound is already healed").
- **The present degrades in real time.** A 150-second clock drags the world toward 2100: the snow thins and darkens, the hills start to slump, the haze rolls in, and the music turns. Each healed site pulls it back.
- **Warnings:** at 40%, 65% and 85% of the clock, the narrator says "Please rev-Earth, before it is too late," then "The ice is thinning…," then "There is almost no time left."
- **Run out of time** and it's "Too late. The ice is gone. Again." You're thrown back into 2100 to face the ghosts and try again.
- **Healing a site** turns its ghost warm gold and at peace. It stops attacking but keeps walking with you to the end.
- **Everything comes back** (powers, surf, free movement) only once the timeline is fully rev-Earthed.
- **Finding your way:** a compass at the top always points to the nearest unhealed site, with its distance. **C** swings the camera to face it (outside the return, C re-centres the camera behind you). If the mouse isn't captured, a prompt says to click the game.

## The narrator
One voice, three deliveries, set per line by its `tone` in `src/game/biomes.js`:
- **story:** peaceful and compassionate. Used for the 2100 lines about what each habitat lost.
- **warning:** firm and urgent. Used for "Please rev-Earth now, before it's too late," repeated at 40%, 65% and 85% of the clock, and for "Too late."
- **success:** warm, dignified and reassuring. Used for "Thank you for doing your part. The Earth thanks you."

Nothing else is narrated during the repairs; the music, the animal cries and the clock carry the pressure. The voice reads "rev Earth" as two words, because run together ("revearth") voices say "rev-AY-arth". Subtitles still show "rev-Earth".

**Voice (recorded):** "The Regal Monarch", take 3, from Gemini 3.8 Flash TTS Voice Design in Google AI Studio. It's a poised, commanding female voice in her 60s with a Received Pronunciation accent, measured and precise, with a hint of warmth. All 11 lines are recorded as WAV files (24 kHz mono) in `public/narration/polar/`, using one AI Studio style direction per tone:
- **story:** "Peaceful and compassionate, unhurried, quiet gravity, like a nature documentary narrator."
- **warning:** "Firm and urgent, grave and commanding, a clear warning, steady not shouting."
- **success:** "Warm, dignified and reassuring, gracious and grateful, a gentle sense of triumph, unhurried."

The clips ship inside the build, so the game never calls a speech service while it runs. If a clip were missing, the game would fall back to a female voice installed on the computer (Microsoft Zira on Windows).

**Re-recording or adding a line:**
1. In AI Studio, on the page for the project where the voice lives, select your paid key ("API key selected").
2. Pick The Regal Monarch 3 and set the line's style.
3. Save the WAV as `public/narration/polar/<id>.wav`.
4. Run `$env:MANIFEST_ONLY = "1"; node tools/make-narration.mjs`, then `npm run build`.

`tools/make-narration.mjs` can also record the lines through the ElevenLabs or Gemini APIs if you'd rather script it.

## Sound design (all synthesised live, no audio files)
- **Throughout:** the score never drops out. It only dips slightly under the narrator. The animals are always heard: alive and far off in the present and after the ending, as ghosts in 2100 and during the return (calmer, softer calls once healed).
- **Present:** a peaceful score. A slow, open pad (Dmaj9 → Bm11 → Gmaj7#11 → Aadd9), soft pentatonic bells drifting through a long reverb, a warm low drone, cold airy wind.
- **Future:** an unsettling score. A grinding minor-second drone under a breathing filter, a thin wavering tritone whine, metal scrapes, sagging string clusters, breathy whispers on either side, and a heartbeat that speeds up as the ghosts close in. The wind turns hot and low.
- **Return:** the peaceful score comes back with the tension still under it. The tension fades as each ghost is freed.
- **Sound effects:**
  - footsteps: snow crunch in the present, mud squelch in the future
  - surf hiss that rises with speed
  - one voice for each power: wave rush, liquid swirl, thump-and-splash, forming glass, rising vortex
  - a dead thud when a power is gone
  - the collapse boom
  - ghost moans as they rise, and shrieking stabs when they lunge, both panned to where the ghost is
  - a rising chime and sigh when damage is undone
  - a full resolved chord at the ending
- **Ghost cries:** each species calls in its own voice, synthesised from what makes the real call recognisable. They sound through a long reverb and a dark echo, panned to where the ghost is:
  - polar bear: a guttural, fluttering growl
  - ringed seal: short falling barks
  - arctic fox: yips, then a shrill scream
  - emperor penguin: two-voiced trumpeting (it sings two pitches at once)
  - walrus: deep grunts, then its ringing, bell-like knock

  They cry out as they rise, when they lunge, and every 7–14 seconds while they follow you.

## The ghosts
In the future and during the return, all five species follow you in a half circle. It runs from your left side, around your back, to your right side. They trail behind you, swing around when you turn, close in as the pressure builds, and lunge one at a time. Each fix frees one, and the rest spread out to close the gap.

## The five ecosystems

### 1. Polar Ice (playable)
- **ESA WorldCover:** 70 Snow and ice, 100 Moss and lichen
- **If lost:** melted ice sheets, bare rock and mud, a warm brown haze
- **Ghosts:** polar bear, ringed seal, arctic fox, emperor penguin, walrus
- **Powers:**
  - Sweep: sweeps water where you aim
  - Ribbon: hold to keep a ribbon of water going
  - Bloom: bursts water at a spot up to 22 m away
  - Crystallize: grows ice and glazes the snow
  - Vortex: spins water around you
- **revEarth actions (one per power):**
  - Sweep: wash black soot off the ice (soot absorbs sunlight and speeds melting)
  - Ribbon: wash away a lost fishing net that traps seals and walrus
  - Bloom: douse a smouldering tundra fire burning carbon-rich peat
  - Crystallize: refreeze a thawing methane vent
  - Vortex: lift away leaking fuel drums
- **The melt:** ice and packed drift are most of what stands up on the field. In 2100 the landform keeps only about 20% of its relief: a broad, low plain with gentle rises, mud, slush and standing meltwater.

### 2. Rainforest
- **ESA WorldCover:** 10 Tree cover
- **If lost:** cracked desert, heat shimmer, fields of stumps
- **Ghosts:** Bornean orangutan, jaguar, harpy eagle, poison dart frog, Sumatran tiger
- **Powers:**
  - Vine Lash: a living vine whipped along the ground
  - Canopy Swing: hold to grapple and swing
  - Seed Burst: an instant grove where you aim
  - Rootgrip: roots erupt and bind the soil
  - Leaf Cyclone
- **revEarth actions:** replant the clearcut, put out the burn front, block the illegal logging road

### 3. Shoreline
- **ESA WorldCover:** 95 Mangroves, 90 Herbaceous wetland
- **If lost:** sea-level rise drowns the dunes, mangroves and towns
- **Ghosts:** loggerhead turtle, piping plover, horseshoe crab, dugong, mangrove crab
- **Powers:**
  - Tidecall: a rolling wave
  - Dune Surf: ride sand like water
  - Mangrove Bloom
  - Oyster Wall: a living reef that breaks the waves
  - Gull Gyre
- **revEarth actions:** plant mangroves, rebuild the oyster reef, stop sand mining, dim the lights over the nesting beach

### 4. Ocean Reef
- **Data context:** open ocean lies beyond WorldCover's land classes, so the context comes from the marine layers in FAO Earth Map and Trends.Earth
- **If lost:** acidified water, bleached coral, a plastic gyre, an oil slick
- **Ghosts:** staghorn coral, vaquita, manta ray, green sea turtle, pteropod
- **Powers:**
  - Current Jet
  - Kelp Ribbon
  - Bioluminescent Bloom
  - Coral Grow: grows coral spires (reuses the ice-crystal system)
  - Gyre Vortex: a whirlpool that gathers plastic
- **revEarth actions:** skim the oil spill, cut ghost nets, regrow the coral, seal a marine reserve

### 5. River
- **ESA WorldCover:** 80 Permanent water bodies
- **If lost:** toxic foam, a cracked riverbed, an empty reservoir
- **Ghosts:** river dolphin, Atlantic salmon, freshwater mussel, Eurasian otter, axolotl
- **Powers:**
  - Riverflow
  - Current Ride: hold to ride the flow
  - Lotus Bloom
  - Clarity: filters the water clean
  - Whirlpool
- **revEarth actions:** shut the factory outfall, rebuild the wetland filter, fix the wasting pipe, reopen the dammed channel

## How the hackathon data is used

The worlds stay dreamy and procedural rather than literal maps. The data frames them:

- **ESA WorldCover 2021 v200** (CC BY 4.0). Each biome is defined by its land-cover class, shown on screen the whole time.
- **Trends.Earth SDG 15.3.1** coding. The collapsed future is scored **−1 (degradation)** and the restored world **+1 (improvement)**, using the indicator's own class coding on the ending screen.
- **Next steps:**
  - Seed each biome's look and its degradation severity from a real area's WorldCover and Trends.Earth values.
  - Use InVEST or NatCap outputs for one restoration trade-off per biome, for example how much carbon or water a replanted area stores.

## Running it (fully offline)
- **Built copy:** `node serve.mjs`, then open http://localhost:5190.
  - It needs only Node. There's no npm install and no internet; every asset is bundled into `dist/`.
  - It needs a WebGPU browser (recent Chrome or Edge).
  - A local server is required because browsers only allow WebGPU and ES modules on `http://localhost`, not on `file://`.
- **Development:** `npm install`, then `npm run dev`. Rebuild the offline copy with `npm run build`.
- **Verified:** a full playthrough makes zero requests outside localhost. No CDNs, web fonts or remote assets; all music and sound is synthesised in the browser.

## How it's built
- It extends SNOWFLOW (MIT, Maksymilian Dendura), a Babylon.js and WebGPU renderer with deformable snow.
- The game layer lives in `src/game/`:
  - `biomes.js`: all the biome data
  - `gameState.js`: the phase machine
  - `hud.js`: the on-screen layer
  - `ghosts.js`: the ghosts, drawn with an HDR rim shader
  - `objectives.js`: the restoration sites
  - `hdrMat.js`: an unlit HDR material for props
  - `flags.js`: the switches the game flips on existing systems
- **The melted future** is a `decay` uniform in `snow.fragment.wgsl` that turns snow into mud, slush and meltwater pools, plus sky and fog presets tweened from `biomes.js`.
- **Adding a biome** means a new `biomes.js` record, a terrain and material variant, and power classes that follow the spell interface in `src/spells/`.
