import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { resizeRendererToDisplaySize, loadShader } from "./util";

async function main() {
  const clock = new THREE.Clock();
  const canvas = document.querySelector("#canvas");
  const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
  renderer.outputEncoding = THREE.sRGBEncoding;

  const scene = new THREE.Scene();
  const camera = createCamera();
  createControls(camera, renderer);
  const renderTarget = createRenderTarget();
  const { depthMaterial, waterMaterial, water } = await createSceneObjects(
    scene,
    renderTarget,
    camera
  );

  function render() {
    const time = clock.getElapsedTime();
    updateRendererSize(renderer, camera);

    captureSceneDepth(
      renderer,
      scene,
      camera,
      renderTarget,
      depthMaterial,
      water
    );
    applyWaterEffects(waterMaterial, renderTarget, time);

    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

function createRenderTarget() {
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
  const camera = new THREE.PerspectiveCamera(75, 2, 0.1, 500);
  camera.position.set(5, 7, 10);
  camera.lookAt(0, 0, 0);
  return camera;
}

function createControls(camera, renderer) {
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.update();
  return controls;
}

async function createSceneObjects(scene, renderTarget, camera) {
  const directionalLight = new THREE.DirectionalLight(0xffffff, 4);
  directionalLight.position.set(0, 5, 0);

  const pointLight = new THREE.PointLight(0xffffff, 15);
  pointLight.position.set(1, 1, -1);
  scene.add(directionalLight, pointLight);

  const sandGeometry = new THREE.SphereGeometry(5, 32, 32);
  const sandMaterial = new THREE.MeshPhongMaterial({
    color: 0xFFFBA0,
    specular: 0x101010,
    shininess: 200,
  });
  const sand = new THREE.Mesh(sandGeometry, sandMaterial);
  sand.position.set(0, -3, 0);
  scene.add(sand);

  const depthMaterial = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    blending: THREE.NoBlending,
  });

  const [vertexShader, fragmentShader] = await Promise.all([
    loadShader("/src/shaders/vertexShader.glsl"),
    loadShader("/src/shaders/fragmentShader.glsl"),
  ]);

  const waterMaterial = new THREE.ShaderMaterial({
    defines: { DEPTH_PACKING: 0, ORTHOGRAPHIC_CAMERA: 0 },
    uniforms: {
      time: { value: 0 },
      threshold: { value: 3 },
      tDudv: {
        value: new THREE.TextureLoader().load("foam-texture.png"),
      },
      tDepth: { value: renderTarget.depthTexture },
      cameraNear: { value: camera.near },
      cameraFar: { value: camera.far },
      resolution: {
        value: new THREE.Vector2(window.innerWidth, window.innerHeight),
      },
      foamColor: { value: new THREE.Color(0xffffff) },
      waterColor: { value: new THREE.Color(0x02E6DF) },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    fog: true,
    side: THREE.DoubleSide,
  });

  const waterGeometry = new THREE.PlaneGeometry(50, 50);
  const water = new THREE.Mesh(waterGeometry, waterMaterial);
  water.rotation.x = -Math.PI * 0.5;
  scene.add(water);

  return { depthMaterial, waterMaterial, water };
}

function updateRendererSize(renderer, camera) {
  if (resizeRendererToDisplaySize(renderer)) {
    const canvas = renderer.domElement;
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
  }
}

function captureSceneDepth(
  renderer,
  scene,
  camera,
  renderTarget,
  depthMaterial,
  water
) {
  water.visible = false;
  scene.overrideMaterial = depthMaterial;
  renderer.setRenderTarget(renderTarget);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  scene.overrideMaterial = null;
  water.visible = true;
}

function applyWaterEffects(waterMaterial, renderTarget, time) {
  waterMaterial.uniforms.time.value = time;
  waterMaterial.uniforms.tDepth.value = renderTarget.depthTexture;
}

main();
