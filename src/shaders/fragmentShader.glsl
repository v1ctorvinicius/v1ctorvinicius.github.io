#include <common>
#include <packing>
#include <fog_pars_fragment>

varying vec2 vUv;
uniform sampler2D tDepth;
uniform sampler2D tDudv;
uniform vec3 waterColor;
uniform vec3 foamColor;
uniform float cameraNear;
uniform float cameraFar;
uniform float time;
uniform float threshold;
uniform vec2 resolution;
uniform sampler2D tTexture; 

float getDepth(const in vec2 screenPosition) {
    #if DEPTH_PACKING == 1
        return unpackRGBAToDepth(texture2D(tDepth, screenPosition));
    #else
        return texture2D(tDepth, screenPosition).x;
    #endif
}

float getViewZ(const in float depth) {
    #if ORTHOGRAPHIC_CAMERA == 1
        return orthographicDepthToViewZ(depth, cameraNear, cameraFar);
    #else
        return perspectiveDepthToViewZ(depth, cameraNear, cameraFar);
    #endif
}

void main() {
    vec2 screenUV = gl_FragCoord.xy / resolution;

    float fragmentLinearEyeDepth = getViewZ(gl_FragCoord.z);
    float linearEyeDepth = getViewZ(getDepth(screenUV));

    float diff = saturate(fragmentLinearEyeDepth - linearEyeDepth);

    float foamForce = 0.05;
    float thickness = 0.01;
    float foamScale = 10.0;

    

    vec2 displacement = texture2D(tDudv, (vUv * foamScale) - time * 0.05).rg;
    displacement = ((displacement * 2.0) - 1.0) * 1.0;

    float waveAmount = sin((vUv.x + vUv.y) * 10.0 + time * 5.0) * foamForce;
    displacement.x += waveAmount;
    displacement.y += waveAmount;

    diff += displacement.x;

    vec3 finalColor = mix(foamColor, waterColor, step(threshold / (0.1 / thickness), diff));

    // Ajustar a transparência com base na profundidade
    float transparency = clamp((fragmentLinearEyeDepth - linearEyeDepth) * 0.3, 0.8, 1.0);
    
    gl_FragColor = vec4(finalColor, transparency);

    #include <fog_fragment>
    #include <tonemapping_fragment>

    // Aplicando correção gamma manualmente
    gl_FragColor.rgb = pow(gl_FragColor.rgb, vec3(1.0 / 2.2));
}
