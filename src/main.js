import * as THREE from "three";
import { Lensflare, LensflareElement } from "three/addons/objects/Lensflare.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { resizeRendererToDisplaySize, loadShader } from "./util";
import { createNoise2D } from "simplex-noise";
import alea from "alea";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import vertexShader from "./shaders/vertexShader.glsl";
import fragmentShader from "./shaders/fragmentShader.glsl";

let scene, camera, renderer, controls, clock, renderTarget;
let waterMesh, waterMaterial, depthMaterial;
let terrainMesh;
let me;

const textureLoader = new THREE.TextureLoader();
const textureFlare0 = textureLoader.load("/lensflare.jpg");
const lensflare = new Lensflare();
lensflare.addElement(new LensflareElement(textureFlare0, 512, 0));

const prng = alea("v1ctorvinicius");
const noise2D = createNoise2D(prng);

function generateTerrain(width, height, noise) {
  const geometry = new THREE.PlaneGeometry(width, height, 750, 750);
  const vertices = geometry.attributes.position.array;

  const scale = 0.04;
  const heightFactor = 1.5;
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

function render() {
  const time = clock.getElapsedTime();
  waterMaterial.uniforms.time.value = time;
  terrainMesh;

  updateRendererSize();
  captureSceneDepth();
  applyWaterEffects(time);

  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

// Cria o render target para capturar a profundidade da cena
function createDepthRenderTarget() {
  const target = new THREE.WebGLRenderTarget(
    window.innerWidth,
    window.innerHeight
  );
  target.texture.minFilter = THREE.NearestFilter;
  target.texture.magFilter = THREE.NearestFilter;
  target.texture.generateMipmaps = false;
  target.depthTexture = new THREE.DepthTexture();
  target.depthTexture.type = THREE.UnsignedShortType;
  return target;
}

function createCamera() {
  const cam = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    800
  );
  cam.position.set(-25, 10, -4);
  return cam;
}

function createControls() {
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.maxPolarAngle = Math.PI / 2.2;
  controls.update();
  return controls;
}

async function createSceneObjects() {
  scene.background = new THREE.Color(0x9aabc3);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 5);
  directionalLight.position.set(0, 200, 200);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2000;
  directionalLight.shadow.mapSize.height = 2000;
  directionalLight.shadow.camera.near = 0.1;
  directionalLight.shadow.camera.far = 500;
  directionalLight.shadow.bias = -0.002;
  directionalLight.shadow.camera.top = 200;
  directionalLight.shadow.camera.bottom = -200;
  directionalLight.shadow.camera.left = -200;
  directionalLight.shadow.camera.right = 200;
  directionalLight.add(lensflare);

  const directionalLightHelper = new THREE.DirectionalLightHelper(
    directionalLight
  );
  const directionalLightTarget = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xffffff })
  );
  directionalLightTarget.position.set(0, 0, 0);
  directionalLight.target = directionalLightTarget;

  scene.add(new THREE.CameraHelper(directionalLight.shadow.camera));
  scene.add(directionalLightHelper);
  scene.add(directionalLightTarget);
  scene.add(directionalLight);

  // Cubo de exemplo
  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(1, 10, 1),
    new THREE.MeshStandardMaterial({ color: 0xffffff })
  );
  cube.position.set(7, 3, -2);
  cube.castShadow = true;
  scene.add(cube);

  const terrainGeometry = generateTerrain(500, 500, noise2D);
  const terrainMaterial = new THREE.MeshStandardMaterial({
    color: 0xccc5bf,
    flatShading: false,
  });
  terrainMesh = new THREE.Mesh(terrainGeometry, terrainMaterial);
  terrainMesh.receiveShadow = true;
  terrainMesh.castShadow = true;
  terrainMesh.rotation.x = -Math.PI / 2;
  scene.add(terrainMesh);

  // Material para captura de profundidade
  depthMaterial = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    blending: THREE.NoBlending,
  });

  waterMaterial = new THREE.ShaderMaterial({
    defines: { DEPTH_PACKING: 0, ORTHOGRAPHIC_CAMERA: 0 },
    uniforms: {
      time: { value: 0 },
      threshold: { value: 0.0 },
      foamScale: { value: 0.0 },
      thickness: { value: 0.5 },
      tDudv: { value: textureLoader.load("foam-texture.png") },
      tDepth: { value: renderTarget.depthTexture },
      cameraNear: { value: camera.near },
      cameraFar: { value: camera.far },
      resolution: {
        value: new THREE.Vector2(window.innerWidth, window.innerHeight),
      },
      foamColor: { value: new THREE.Color(0x149f75) },
      waterColor: { value: new THREE.Color(0x025b5e) },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    fog: true,
    wireframe: false,
  });

  const waterGeometry = new THREE.PlaneGeometry(1000, 1000, 500, 500);
  waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
  waterMesh.rotation.x = -Math.PI * 0.5;
  waterMesh.position.y = -0.5;
  scene.add(waterMesh);

  const loader = new GLTFLoader();
}

function updateRendererSize() {
  if (resizeRendererToDisplaySize(renderer)) {
    camera.aspect =
      renderer.domElement.clientWidth / renderer.domElement.clientHeight;
    camera.updateProjectionMatrix();
  }
}

// Captura a profundidade da cena para os efeitos de água
function captureSceneDepth() {
  waterMesh.visible = false;
  scene.overrideMaterial = depthMaterial;
  renderer.setRenderTarget(renderTarget);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  scene.overrideMaterial = null;
  waterMesh.visible = true;
}

function applyWaterEffects(time) {
  waterMaterial.uniforms.time.value = time;
  waterMaterial.uniforms.tDepth.value = renderTarget.depthTexture;
}

async function main() {
  clock = new THREE.Clock();

  const canvas = document.querySelector("#canvas");

  renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  camera = createCamera();

  controls = createControls();
  renderTarget = createDepthRenderTarget();

  await createSceneObjects();

  requestAnimationFrame(render);
}

main();
