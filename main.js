import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setAnimationLoop( animate );
document.body.appendChild( renderer.domElement );

function generateSphereGeometries(numSpheres, radius, scale) {
    const geometries = [];
    let curRadius = radius;
    for (let i = 0; i < numSpheres; i++) {
        const geometry = new THREE.SphereGeometry(curRadius, 32, 16);
        geometries.push(geometry);
        curRadius *= scale;
    }
    return geometries;
}

const sphereGeometries = generateSphereGeometries(11, 1, 1.2);
const sphereMeshes = [];
let xOffset = 0;
sphereGeometries.forEach(geometry => {
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const sphere = new THREE.Mesh(geometry, material);
    const r = geometry.parameters.radius;
    xOffset += r + 1;
    sphere.position.x = xOffset;
    xOffset += r + 1;
    sphereMeshes.push(sphere);
    scene.add(sphere);
});
const totalWidth = xOffset;
sphereMeshes.forEach(sphere => { sphere.position.x -= totalWidth / 2; });

const controls = new OrbitControls(camera, renderer.domElement);
camera.position.set(0, 5, 10); // Where the camera is.
controls.target.set(0, 0, 0); // Orbit around world origin

function animate() {

	renderer.render( scene, camera );

    controls.update();

}

function createAxisLine(color, start, end) {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineBasicMaterial({ color: color });
    return new THREE.Line(geometry, material);
}

// Create axis lines
const xAxis = createAxisLine(0xff0000, new THREE.Vector3(0, 0, 0), new THREE.Vector3(5, 0, 0)); // Red
const yAxis = createAxisLine(0x00ff00, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 5, 0)); // Green
const zAxis = createAxisLine(0x0000ff, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 5)); // Blue

// Add axes to scene
scene.add(xAxis);
scene.add(yAxis);
scene.add(zAxis);

