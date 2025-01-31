#include <fog_pars_vertex>

varying vec2 vUv;
uniform float time;

void main() {
    vUv = uv;
    #include <begin_vertex>
    #include <project_vertex>
    #include <fog_vertex>

    vec3 pos = position; // Pega a posição original do vértice
    float wave = sin(dot(pos.xz, vec2(0.1, 0.2)) + time * 2.0) * 0.1;
    pos.z += wave;
    pos.x += cos(time * 2.0) * 0.01;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}