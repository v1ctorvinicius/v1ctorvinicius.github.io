import * as THREE from "three";
import { Lensflare, LensflareElement } from "three/addons/objects/Lensflare.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { resizeRendererToDisplaySize, loadShader } from "./util";
import { createNoise2D } from "simplex-noise";
import alea from "alea";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// Variáveis globais
let scene, camera, renderer, controls, clock, renderTarget;
let water, waterMaterial, depthMaterial;
let boat; // Armazenará o modelo da embarcação

// Inicializações de recursos e loaders
const textureLoader = new THREE.TextureLoader();
const textureFlare0 = textureLoader.load("/lensflare.jpg");
const lensflare = new Lensflare();
lensflare.addElement(new LensflareElement(textureFlare0, 512, 0));

const prng = alea("portfolio");
const noise2D = createNoise2D(prng);

// Função para gerar o terreno com base em ruído simplex
function generateTerrain(width, height, noise) {
  const geometry = new THREE.PlaneGeometry(width, height, 100, 100);
  const vertices = geometry.attributes.position.array;

  const scale = 0.01; // Fator de escala para as coordenadas x e y
  const heightFactor = 15; // Fator de amplificação da altura

  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i] * scale;
    const y = vertices[i + 1] * scale;
    const z = noise(x, y);
    vertices[i + 2] = z * heightFactor;
  }

  geometry.attributes.position.needsUpdate = true;
  return geometry;
}

// Função de renderização (extraída para o escopo global)
function render() {
  const time = clock.getElapsedTime();
  waterMaterial.uniforms.time.value = time;

  updateRendererSize();
  captureSceneDepth();
  applyWaterEffects(time);

  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

// Cria o render target para capturar a profundidade da cena
function createRenderTarget() {
  const target = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
  target.texture.minFilter = THREE.NearestFilter;
  target.texture.magFilter = THREE.NearestFilter;
  target.texture.generateMipmaps = false;
  target.depthTexture = new THREE.DepthTexture();
  target.depthTexture.type = THREE.UnsignedShortType;
  return target;
}

// Cria a câmera e define sua posição e orientação
function createCamera() {
  const cam = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 800);
  cam.position.set(-15, 15, -4);
  cam.lookAt(0, 0, 0);
  return cam;
}

// Cria os controles da cena usando OrbitControls
function createControls() {
  const ctrls = new OrbitControls(camera, renderer.domElement);
  ctrls.target.set(0, 0, 0);
  ctrls.update();
  return ctrls;
}

// Função para criar e adicionar objetos à cena
async function createSceneObjects() {
  // Luz direcional com helper
  const directionalLight = new THREE.DirectionalLight(0xffffff, 4);
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

  // Alinha o lensflare à luz
  directionalLight.add(lensflare);

  // Adiciona helper e alvo para a luz
  const directionalLightHelper = new THREE.DirectionalLightHelper(directionalLight);
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

  // Cube de exemplo
  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xffffff })
  );
  cube.position.set(-2, 3, -2);
  cube.castShadow = true;
  scene.add(cube);

  // Terreno
  const terrainGeometry = generateTerrain(1000, 1000, noise2D);
  terrainGeometry.computeVertexNormals();
  const terrainMaterial = new THREE.MeshStandardMaterial({
    color: 0xfffba0,
    flatShading: false,
  });
  const terrainMesh = new THREE.Mesh(terrainGeometry, terrainMaterial);
  terrainMesh.receiveShadow = true;
  terrainMesh.castShadow = true;
  terrainMesh.rotation.x = -Math.PI / 2;
  scene.add(terrainMesh);

  // Material para captura de profundidade
  depthMaterial = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    blending: THREE.NoBlending,
  });

  // Carrega shaders para o efeito da água
  const [vertexShader, fragmentShader] = await Promise.all([
    loadShader("/src/shaders/vertexShader.glsl"),
    loadShader("/src/shaders/fragmentShader.glsl"),
  ]);

  waterMaterial = new THREE.ShaderMaterial({
    defines: { DEPTH_PACKING: 0, ORTHOGRAPHIC_CAMERA: 0 },
    uniforms: {
      time: { value: 0 },
      threshold: { value: 3 },
      tDudv: { value: textureLoader.load("foam-texture.png") },
      tDepth: { value: renderTarget.depthTexture },
      cameraNear: { value: camera.near },
      cameraFar: { value: camera.far },
      resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      foamColor: { value: new THREE.Color(0xffffff) },
      waterColor: { value: new THREE.Color(0x02e6df) },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    fog: true,
    wireframe: false,
  });

  // Cria a malha da água
  const waterGeometry = new THREE.PlaneGeometry(1000, 1000, 500, 500);
  waterGeometry.computeVertexNormals();
  water = new THREE.Mesh(waterGeometry, waterMaterial);
  water.rotation.x = -Math.PI * 0.5;
  scene.add(water);

  // Carrega o modelo GLB da embarcação
  const loader = new GLTFLoader();
  loader.load(
    "/boat.glb",
    (gltf) => {
      const model = gltf.scene;
      model.scale.set(0.1, 0.1, 0.1);
      model.rotation.x = -Math.PI / 2;
      model.rotation.z = -Math.PI / 5;
      model.position.set(-5, 0, 0);
      scene.add(model);
      boat = model;
    },
    undefined,
    (error) => {
      console.error("Erro ao carregar o modelo:", error);
    }
  );
}

// Atualiza o tamanho do renderer de acordo com o tamanho da tela
function updateRendererSize() {
  if (resizeRendererToDisplaySize(renderer)) {
    camera.aspect = renderer.domElement.clientWidth / renderer.domElement.clientHeight;
    camera.updateProjectionMatrix();
  }
}

// Captura a profundidade da cena para os efeitos de água
function captureSceneDepth() {
  water.visible = false;
  scene.overrideMaterial = depthMaterial;
  renderer.setRenderTarget(renderTarget);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  scene.overrideMaterial = null;
  water.visible = true;
}

// Atualiza os uniformes do material da água com os efeitos desejados
function applyWaterEffects(time) {
  waterMaterial.uniforms.time.value = time;
  waterMaterial.uniforms.tDepth.value = renderTarget.depthTexture;
}

// Função principal de inicialização
async function main() {
  clock = new THREE.Clock();

  // Seleciona o canvas
  const canvas = document.querySelector("#canvas");

  // Cria o renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Inicializa a cena e a câmera
  scene = new THREE.Scene();
  camera = createCamera();

  // Cria os controles e o render target
  controls = createControls();
  renderTarget = createRenderTarget();

  // Cria os objetos da cena (luzes, terreno, água, modelos, etc)
  await createSceneObjects();

  // Inicia o loop de renderização
  requestAnimationFrame(render);
}

// Inicia a aplicação
main();
