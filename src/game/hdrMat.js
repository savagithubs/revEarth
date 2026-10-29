/**
 * revEarth — an unlit, flat-colour material on the scene's HDR scale.
 *
 * Babylon's StandardMaterial clamps its output at 1.0, and with this demo's
 * exposure (sunlit snow near 12 in linear) that renders as near black. This is
 * the smallest WGSL material that writes a colour straight through, for the
 * game's props and beacons.
 */

import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { ShaderLanguage } from "@babylonjs/core/Materials/shaderLanguage";
import { ShaderStore } from "@babylonjs/core/Engines/shaderStore";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Constants } from "@babylonjs/core/Engines/constants";

const VERT = `
attribute position: vec3f;
uniform world: mat4x4f;
uniform viewProjection: mat4x4f;
@vertex
fn main(input: VertexInputs) -> FragmentInputs {
    vertexOutputs.position = uniforms.viewProjection * (uniforms.world * vec4f(vertexInputs.position, 1.0));
}
`;
const FRAG = `
uniform color: vec3f;
uniform alpha: f32;
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
    fragmentOutputs.color = vec4f(uniforms.color, uniforms.alpha);
}
`;

let registered = false;

/**
 * @param {import("@babylonjs/core/scene").Scene} scene
 * @param {string} name
 * @param {number[]} rgb linear colour, already on the HDR scale
 * @param {number} [alpha] below 1 makes it blended
 * @param {boolean} [additive]
 */
export function hdrMaterial(scene, name, rgb, alpha = 1, additive = false) {
    if (!registered) {
        ShaderStore.ShadersStoreWGSL["rvFlatVertexShader"] = VERT;
        ShaderStore.ShadersStoreWGSL["rvFlatPixelShader"] = FRAG;
        registered = true;
    }
    const blended = alpha < 1 || additive;
    const m = new ShaderMaterial(name, scene, { vertex: "rvFlat", fragment: "rvFlat" }, {
        attributes: ["position"],
        uniforms: ["world", "viewProjection", "color", "alpha"],
        shaderLanguage: ShaderLanguage.WGSL,
        needAlphaBlending: blended,
    });
    m.backFaceCulling = false;
    if (blended) {
        m.alphaMode = additive ? Constants.ALPHA_ADD : Constants.ALPHA_COMBINE;
        m.disableDepthWrite = true;
    }
    m.setColor3("color", new Color3(rgb[0], rgb[1], rgb[2]));
    m.setFloat("alpha", alpha);
    m.metadata = { alpha, blended };
    return m;
}
