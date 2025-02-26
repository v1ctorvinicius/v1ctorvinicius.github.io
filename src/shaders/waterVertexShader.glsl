#include <fog_pars_vertex>

varying vec2 vUv;
uniform float time;

void main() {
    vUv = uv;
    #include <begin_vertex>
    #include <project_vertex>
    #include <fog_vertex>

    vec3 pos = position;
    float wave = sin(dot(pos.xz, vec2(1, 2)) + time * 1.0) * 0.03; //lagoon
    //float wave = sin(dot(pos.xz, vec2(10, 10)) + time * 2.0) * 0.05; //sea waves
    pos.z += wave;                      
    pos.x += cos(time * 2.0) * 0.01;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}