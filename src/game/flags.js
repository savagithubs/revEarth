/**
 * revEarth — the handful of switches the game layer flips on existing systems.
 *
 * A leaf module with no imports, so the spell system and the controller can
 * read it without pulling the game layer (and a circular import) in with it.
 */
export const G = {
    /** False in the collapsed future: the powers died with the ice. */
    powersEnabled: true,
    surfEnabled: true,
    /** Multiplier on walk and sprint speed. */
    walkScale: 1,
    /** Held G during the return: walk forward (the camera is steered to the task). */
    autoWalk: false,
    /** @type {null | ((key: number, x: number, y: number, z: number) => void)} */
    onCast: null,
    /** @type {null | ((key: number) => void)} every cast, before it resolves */
    onSpell: null,
    /** @type {null | ((key: number) => boolean)} may this power fire right now? */
    canCast: null,
    /** @type {null | ((key: number) => void)} called when a cast is refused */
    onBlocked: null,
    /** @type {null | ((lights: import("../spells/spellLights.js").SpellLights) => void)} */
    addLights: null,
};
