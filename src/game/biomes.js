/**
 * revEarth — the five ecosystems.
 *
 * One record per biome. The HUD, the title cards and the end-of-demo biome map
 * all read from here, so a new biome is a new record plus its world, never a
 * new copy of the story.
 *
 * `worldCover` is the ESA WorldCover 2021 v200 class the biome stands for
 * (CC BY 4.0). `present` / `future` are partial `S` dicts the game tweens
 * between; numbers lerp, booleans flip at the midpoint.
 */

export const BIOMES = [
    {
        id: "polar",
        name: "Polar Ice",
        playable: true,
        worldCover: "70 · Snow and ice  ·  100 · Moss and lichen",
        tagline: "A study in snow.",
        futureYear: 2100,
        futureTitle: "The ice is gone.",
        futureLine: "Sea ice that once rebuilt itself every winter never came back.",
        lost: "Melted ice sheets, bare rock, a warm brown haze.",
        species: ["Polar bear", "Ringed seal", "Arctic fox", "Emperor penguin", "Walrus"],
        /**
         * Every line the narrator speaks in this biome, keyed by id (the ids
         * name the recordings `tools/make-narration.mjs` produces).
         *
         *   text   what the subtitle shows
         *   say    what the voice reads, when it must differ from the text.
         *          "rev Earth" as two words: run together, voices say
         *          "rev-AY-arth" (checked against the Windows voice's phonemes)
         *   tone   story    peaceful and compassionate, for what was lost
         *          warning  firm and urgent, for the clock
         *          success  warm, dignified and reassuring, for the ending
         *
         * Nothing is narrated while the player is repairing the timeline
         * except the warning: the music, the cries and the clock carry it.
         */
        narration: {
            "future": { tone: "story", text: "It is the year twenty-one hundred. The ice is gone." },
            "ghost-polar-bear": { tone: "story", text: "The polar bear hunted seals from the sea ice. With no ice left, it starved on the shore." },
            "ghost-ringed-seal": { tone: "story", text: "The ringed seal raised its pups in snow dens on the ice. There was nowhere left to hide them." },
            "ghost-arctic-fox": { tone: "story", text: "The arctic fox followed the bears across the ice. It followed them to the end." },
            "ghost-emperor-penguin": { tone: "story", text: "The emperor penguin's chicks needed ice until they could swim. The ice broke up first." },
            "ghost-walrus": { tone: "story", text: "The walrus rested on floating ice between dives. With none left, the herds crowded the beaches, and crushed each other." },
            "go-back": { tone: "story", text: "They will not let you go. Go back, and undo it." },
            "warn": { tone: "warning", text: "Please rev-Earth now, before it's too late.", say: "Please, rev Earth now, before it's too late." },
            "wise": { tone: "warning", text: "Please use your powers wisely, and rev-Earth now.", say: "Please use your powers wisely, and rev Earth now." },
            "too-late": { tone: "warning", text: "Too late. The ice is gone." },
            "ending": {
                tone: "success",
                text: "The Earth has been successfully rev-Earthed. Thank you for doing your part. The Earth thanks you. And never forget: you have the power to rev-Earth now.",
                say: "The Earth has been successfully rev Earthed. Thank you for doing your part. The Earth thanks you. And never forget: you have the power to rev Earth, now.",
            },
        },
        powers: [
            ["Sweep", "Sweeps water in the direction you aim"],
            ["Ribbon", "Hold to keep a ribbon of water going"],
            ["Bloom", "Bursts water at a spot up to 22 m away"],
            ["Crystallize", "Grows ice crystals and glazes the snow"],
            ["Vortex", "Spins water around you"],
        ],
        actions: [
            {
                id: "soot",
                label: "Wash the black soot off the ice",
                why: "Dark soot absorbs sunlight, so the ice under it melts faster.",
                spell: 1,
                hint: "Sweep (1) toward the soot",
            },
            {
                id: "net",
                label: "Wash away the ghost net",
                why: "Lost fishing nets drift north and keep trapping seals and walrus for years.",
                spell: 2,
                hint: "Stand by the net and hold Ribbon (2)",
            },
            {
                id: "fire",
                label: "Douse the smouldering tundra fire",
                why: "Arctic fires burn the carbon stored in frozen peat and blacken the snow.",
                spell: 3,
                hint: "Aim at the fire and Bloom (3)",
            },
            {
                id: "vent",
                label: "Refreeze the thawing methane vent",
                why: "Thawing permafrost releases methane, which heats the planet further.",
                spell: 4,
                hint: "Crystallize (4) on the vent",
            },
            {
                id: "drums",
                label: "Lift away the leaking fuel drums",
                why: "Spilled fuel poisons the food web every polar animal depends on.",
                spell: 5,
                hint: "Stand by the drums and Vortex (5)",
            },
        ],
        present: {
            decay: 0,
            sastrugiStrength: 1.0,
            sunElevation: 13,
            sunIntensity: 4.2,
            sunTempWarm: 1.0,
            ambientBlue: 1.0,
            fogDensity: 0.0072,
            glintIntensity: 0.55,
            sssStrength: 1.0,
            shaftStrength: 0.3,
            showMountains: true,
        },
        future: {
            decay: 1,
            // Wind-carved snow ridges go with the snow.
            sastrugiStrength: 0.12,
            sunElevation: 30,
            sunIntensity: 5.6,
            sunTempWarm: 1.0,
            ambientBlue: 0.25,
            fogDensity: 0.014,
            glintIntensity: 0,
            sssStrength: 0.15,
            shaftStrength: 0.7,
            showMountains: false,
        },
    },
    {
        id: "rainforest",
        name: "Rainforest",
        worldCover: "10 · Tree cover",
        futureTitle: "The forest is dust.",
        lost: "Cracked desert, heat shimmer, fields of stumps.",
        species: ["Bornean orangutan", "Jaguar", "Harpy eagle", "Poison dart frog", "Sumatran tiger"],
        powers: [
            ["Vine Lash", "Whip a living vine along the ground"],
            ["Canopy Swing", "Hold to grapple and swing through the trees"],
            ["Seed Burst", "Grow an instant grove where you aim"],
            ["Rootgrip", "Roots erupt and bind the soil"],
            ["Leaf Cyclone", "A storm of leaves around you"],
        ],
        actions: [
            { label: "Replant the clearcut" },
            { label: "Put out the burn front" },
            { label: "Block the illegal logging road" },
        ],
    },
    {
        id: "shoreline",
        name: "Shoreline",
        worldCover: "95 · Mangroves  ·  90 · Herbaceous wetland",
        futureTitle: "The coast is underwater.",
        lost: "Drowned dunes, flooded towns, mangroves gone.",
        species: ["Loggerhead turtle", "Piping plover", "Horseshoe crab", "Dugong", "Mangrove crab"],
        powers: [
            ["Tidecall", "Send a wave rolling up the beach"],
            ["Dune Surf", "Ride the sand like water"],
            ["Mangrove Bloom", "Raise a mangrove thicket"],
            ["Oyster Wall", "Grow a living reef that breaks the waves"],
            ["Gull Gyre", "Spin the sea wind around you"],
        ],
        actions: [
            { label: "Plant mangroves" },
            { label: "Rebuild the oyster reef" },
            { label: "Stop the sand mining" },
            { label: "Dim the lights over the nesting beach" },
        ],
    },
    {
        id: "ocean",
        name: "Ocean Reef",
        worldCover: "Open ocean (beyond WorldCover's land classes)",
        futureTitle: "The reef is bone-white.",
        lost: "Bleached coral, a plastic gyre, an oil slick.",
        species: ["Staghorn coral", "Vaquita", "Manta ray", "Green sea turtle", "Pteropod"],
        powers: [
            ["Current Jet", "Blast a jet of current"],
            ["Kelp Ribbon", "Hold to trail a ribbon of kelp"],
            ["Bioluminescent Bloom", "Light the deep where you aim"],
            ["Coral Grow", "Grow a coral spire"],
            ["Gyre Vortex", "Spin a whirlpool that gathers plastic"],
        ],
        actions: [
            { label: "Skim the oil spill" },
            { label: "Cut the ghost nets" },
            { label: "Regrow the coral" },
            { label: "Seal a marine reserve" },
        ],
    },
    {
        id: "river",
        name: "River",
        worldCover: "80 · Permanent water bodies",
        futureTitle: "The river runs dry.",
        lost: "Toxic foam, a cracked riverbed, an empty reservoir.",
        species: ["River dolphin", "Atlantic salmon", "Freshwater mussel", "Eurasian otter", "Axolotl"],
        powers: [
            ["Riverflow", "Push the current where you aim"],
            ["Current Ride", "Hold to ride the river's flow"],
            ["Lotus Bloom", "Open a field of lotus"],
            ["Clarity", "Filter the water clean"],
            ["Whirlpool", "Spin the river around you"],
        ],
        actions: [
            { label: "Shut the factory outfall" },
            { label: "Rebuild the wetland filter" },
            { label: "Fix the wasting pipe" },
            { label: "Reopen the dammed channel" },
        ],
    },
];

export const POLAR = BIOMES[0];
