import './style.css'
import javascriptLogo from '/javascript.svg'

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Cube
const geometry = new THREE.BoxGeometry(1, 1, 1);
// const material = new THREE.MeshBasicMaterial({ color: 0x00ffff });
const material = new THREE.MeshStandardMaterial({ color: 0x00ffff });

const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

// Lights
const redLight = new THREE.PointLight(0xff0000);
redLight.position.set(0, 1, 1);
// redLight.position.set(2, 2, 2);

scene.add(redLight);

const blueLight = new THREE.PointLight(0x0000ff);
blueLight.position.set(1, 0, 1);
// blueLight.position.set(-2, -2, -2);
scene.add(blueLight);

const greenLight = new THREE.PointLight(0x00ff00);
greenLight.position.set(0, 0, 1);
scene.add(greenLight);

// Camera positioning
camera.position.z = 3;

// Animation
function animate() {
    requestAnimationFrame(animate);

    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;

    // redLight.position.x = Math.sin(Date.now() * 0.001) * 2;
    // redLight.position.y = Math.cos(Date.now() * 0.001) * 2;

    // blueLight.position.x = Math.sin(Date.now() * 0.002) * 2;
    // blueLight.position.y = Math.cos(Date.now() * 0.002) * 2;

    renderer.render(scene, camera);
}

animate();