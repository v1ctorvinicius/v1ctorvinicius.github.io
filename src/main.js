import * as THREE from "three";
import { Lensflare, LensflareElement } from "three/addons/objects/Lensflare.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { resizeRendererToDisplaySize, loadShader } from "./util";
import { createNoise2D } from "simplex-noise";
import alea from "alea";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import vertexShader from "./shaders/waterVertexShader.glsl";
import fragmentShader from "./shaders/waterFragmentShader.glsl";
import { Sky } from "three/addons/objects/Sky.js";

let time;
let scene, cam, renderer, controls, clock, depthRenderTarget;
let waterMesh, waterMaterial, depthMaterial;
let terrainMaterial,
  terrainSeed = "v1ctorvinicius";
let me;
let sky;
let directionalLight, lightCameraHelper;
let dirLightShadowMap;
let camIndex = 0;
let camPositions = [
  new THREE.Vector3(-40, 0, 75),
  new THREE.Vector3(-53, 2.5, 86),
];
let camTargetPositions = [
  new THREE.Vector3(0, 0, 60),
  new THREE.Vector3(30, 0, 90),
];

// debug
let camPos = new THREE.Vector3();

const textureLoader = new THREE.TextureLoader();
const textureFlare0 = textureLoader.load("/lensflare.jpg");
const lensflare = new Lensflare();
lensflare.addElement(new LensflareElement(textureFlare0, 512, 0));

const prng = alea(terrainSeed);
const noise2D = createNoise2D(prng);

async function main() {
  clock = new THREE.Clock();
  const canvas = document.querySelector("#canvas");
  renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  scene = new THREE.Scene();
  cam = createCamera();
  controls = createControls();

  depthRenderTarget = createDepthRenderTarget();
  createSceneObjects();
  requestAnimationFrame(render);
}

function render() {
  // debug();
  time = clock.getElapsedTime();
  updateCamera();
  updateRendererSize();
  // water animation
  captureSceneDepth();
  updateWaterMaterialUniforms(time);

  renderer.render(scene, cam);
  requestAnimationFrame(render);
}

function updateCamera() {
  // animate camera with sin wave
  cam.position.x = camPositions[camIndex].x + Math.sin(time * 0.8) * .05;
  cam.position.y = camPositions[camIndex].y + Math.sin(time * 0.8) * .05;
  cam.position.z = camPositions[camIndex].z + Math.cos(time * 0.8) * .05;
}

function debug() {
  const debugParams = {
    camPos: cam.position,
    camRot: cam.rotation,
    sunPosition: directionalLight.position,
    sky: sky,
  };
  camPos.setFromMatrixPosition(cam.matrixWorld);
  console.log("Debug", debugParams);
}

function generateTerrain(width, height, noise) {
  const geometry = new THREE.PlaneGeometry(width, height, 1000, 1000);
  const vertices = geometry.attributes.position.array;

  const scale = 0.02;
  const heightFactor = 3.0;
  const stretchFactor = 2.5;

  const windDirection = new THREE.Vector2(1, -3).normalize();
  const cosA = windDirection.x;
  const sinA = windDirection.y;

  for (let i = 0; i < vertices.length; i += 3) {
    let x = vertices[i] * scale;
    let y = vertices[i + 1] * scale;

    // Rotaciona as coordenadas para alinhar o noise com o vento
    let xAligned = x * cosA - y * sinA;
    let yAligned = x * sinA + y * cosA;

    // Alongamento na direção do vento
    let baseHeight = noise(xAligned, yAligned * stretchFactor);

    let height = baseHeight * heightFactor;

    vertices[i + 2] = height;
  }

  geometry.computeVertexNormals();
  geometry.attributes.position.needsUpdate = true;

  return geometry;
}

// Cria o render target para capturar a profundidade da cena
function createDepthRenderTarget() {
  const depthRenderTarget = new THREE.WebGLRenderTarget(
    window.innerWidth,
    window.innerHeight
  );
  depthRenderTarget.texture.minFilter = THREE.NearestFilter;
  depthRenderTarget.depthTexture = new THREE.DepthTexture();
  depthRenderTarget.depthTexture.type = THREE.UnsignedShortType;
  return depthRenderTarget;
}

function createCamera() {
  const cam = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.01,
    3000
  );

  cam.position.set(camPositions[0].x, camPositions[0].y, camPositions[0].z);
  cam.lookAt(camTargetPositions[0]);

  return cam;
}

function createControls() {
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.maxPolarAngle = Math.PI / 2.2;
  controls.update();
  return controls;
}

function createSceneObjects() {
  scene.fog = new THREE.Fog(new THREE.Color(0x9aabc3), 10, 400);

  sky = new Sky();
  sky.material.uniforms.turbidity.value = 0.2; // haze
  sky.material.uniforms.rayleigh.value = 0.1; // blue scattering
  sky.material.uniforms.mieCoefficient.value = 0.005; // Air particle density
  sky.material.uniforms.mieDirectionalG.value = 0.8; // Sun glow intensity
  renderer.toneMappingExposure = 0.5; // brightness

  sky.scale.setScalar(450000);
  const phi = THREE.MathUtils.degToRad(65);
  const theta = THREE.MathUtils.degToRad(90);
  const sunPosition = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
  sky.material.uniforms.sunPosition.value = sunPosition;
  scene.add(sky);

  directionalLight = new THREE.DirectionalLight(0xffffff, 3.5);
  directionalLight.position.set(0, 10, 10);
  directionalLight.shadow.camera.near = 0.1;
  directionalLight.shadow.camera.far = 500;
  directionalLight.shadow.camera.left = -200;
  directionalLight.shadow.camera.right = 200;
  directionalLight.shadow.camera.top = 200;
  directionalLight.shadow.camera.bottom = -200;
  directionalLight.shadow.mapSize.width = 2000;
  directionalLight.shadow.mapSize.height = 2000;
  directionalLight.shadow.bias = -0.0002;
  // directionalLight.add(lensflare);
  directionalLight.castShadow = true;

  const directionalLightHelper = new THREE.DirectionalLightHelper(
    directionalLight
  );

  const directionalLightTarget = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xffffff })
  );

  directionalLightTarget.position.set(0, 2, 0);
  directionalLightTarget.castShadow = true;
  directionalLight.target = directionalLightTarget;

  lightCameraHelper = new THREE.CameraHelper(directionalLight.shadow.camera);
  // scene.add(lightCameraHelper);
  scene.add(directionalLightHelper);
  scene.add(directionalLightTarget);
  scene.add(directionalLight);

  dirLightShadowMap = directionalLight.shadow.map;

  const terrainTexture = new THREE.TextureLoader().load("sand-texture.jpg");
  terrainTexture.wrapS = THREE.RepeatWrapping;
  terrainTexture.wrapT = THREE.RepeatWrapping;
  terrainTexture.rotation = Math.PI / 5;

  const terrainGeometry = generateTerrain(1500, 1500, noise2D);

  terrainMaterial = new THREE.MeshStandardMaterial({
    map: terrainTexture,
    fog: true,
  });
  terrainMaterial.onBeforeCompile = function (shader) {
    shader.uniforms.uTexture = { value: terrainTexture };
    shader.uniforms.uMinHeight = { value: -0.3 };
    shader.uniforms.uMaxHeight = { value: -0.5 };
    shader.uniforms.uRepeat = { value: new THREE.Vector2(500, 500) };
    shader.uniforms.uRotation = { value: Math.PI / 1.4 };
    shader.vertexShader = shader.vertexShader.replace(
      `#include <common>`,
      `
        #include <common>
        varying vec2 vUv;
        varying vec3 vPosition;
        varying float vHeight;
      `
    );
    shader.vertexShader = shader.vertexShader.replace(
      `#include <uv_vertex>`,
      `
      #include <uv_vertex>
      vUv = uv;
      vPosition = position;
      vHeight = position.z;
    `
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      `#include <common>`,
      `
        #include <common>
        uniform sampler2D uTexture;
        uniform float uMinHeight;
        uniform float uMaxHeight;
        uniform vec2 uRepeat;
        uniform float uRotation;
        varying vec2 vUv;
        varying float vHeight;
      `
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      `#include <map_fragment>`,
      `
        #include <map_fragment>
        vec2 repeatedUV = vUv * uRepeat;
  
        float cosR = cos(uRotation);
        float sinR = sin(uRotation);
        mat2 rotationMatrix = mat2(cosR, -sinR, sinR, cosR);
  
        vec2 rotatedUV = rotationMatrix * repeatedUV;
        vec4 texColor = texture2D(uTexture, rotatedUV);
  
        float wetFactor = smoothstep(uMaxHeight, uMinHeight, vHeight);
        vec3 darkenedColor = mix(texColor.rgb * (vec3(149, 127, 83) * 0.05) * 0.1, texColor.rgb, wetFactor);
        diffuseColor.rgb = darkenedColor;
      `
    );
  };

  const terrainMesh = new THREE.Mesh(terrainGeometry, terrainMaterial);
  terrainMesh.castShadow = true;
  terrainMesh.receiveShadow = true;
  terrainMesh.rotation.x = -Math.PI / 2;
  scene.add(terrainMesh);

  waterMaterial = new THREE.ShaderMaterial({
    defines: { DEPTH_PACKING: 0, ORTHOGRAPHIC_CAMERA: 0 },
    uniforms: {
      fogColor: { value: new THREE.Color(0x9aabc3) },
      fogNear: { value: 0.0 },
      fogFar: { value: 10.0 },
      time: { value: 0 },
      threshold: { value: 0.0 },
      foamScale: { value: 0.0 },
      thickness: { value: 0.5 },
      tDudv: { value: textureLoader.load("foam-texture.png") },
      tDepth: { value: depthRenderTarget.depthTexture },
      cameraNear: { value: cam.near },
      cameraFar: { value: cam.far },
      resolution: {
        value: new THREE.Vector2(window.innerWidth, window.innerHeight),
      },
      foamColor: { value: new THREE.Color(0x149f75) },
      waterColor: { value: new THREE.Color(0x025b5e) },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    wireframe: false,
    fog: true,
  });

  const waterGeometry = new THREE.PlaneGeometry(1000, 1000, 500, 500);
  waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
  waterMesh.receiveShadow = true;
  waterMesh.castShadow = true;
  waterMesh.rotation.x = -Math.PI * 0.5;
  waterMesh.position.y = -0.5;
  scene.add(waterMesh);

  const loader = new GLTFLoader();
}

function updateRendererSize() {
  if (resizeRendererToDisplaySize(renderer)) {
    cam.aspect =
      renderer.domElement.clientWidth / renderer.domElement.clientHeight;
    cam.updateProjectionMatrix();
  }
}

// Captura a profundidade da cena para os efeitos de água
function captureSceneDepth() {
  waterMesh.visible = false;
  // scene.overrideMaterial = depthMaterial;
  renderer.setRenderTarget(depthRenderTarget);
  renderer.render(scene, cam);
  renderer.setRenderTarget(null);
  scene.overrideMaterial = null;
  waterMesh.visible = true;
}

function updateWaterMaterialUniforms(time) {
  waterMaterial.uniforms.time.value = time;
  waterMaterial.uniforms.tDepth.value = depthRenderTarget.depthTexture;
  waterMaterial.uniforms.tDepth.needsUpdate = true;
}

main();
