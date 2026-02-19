import * as THREE from 'three';
import { setupScene } from './setupScene.js';
import { createFruitsTextures } from './fruitTextures.js';
import { createFaceDecals } from './faceDecals.js';


const { scene, camera, renderer, controls } = setupScene();
const { fruitMaterials, faceMaterials, fruitOrder } = createFruitsTextures(renderer);

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

// create a table 
const tableWidth = 60;
const tableDepth = 30;
const tableThickness = 1.2;

const tableGeo = new THREE.BoxGeometry(
  tableWidth,
  tableThickness,
  tableDepth
);

const tableMat = new THREE.MeshStandardMaterial({
  color: 0xf5d7b2,
  roughness: 0.85,
  metalness: 0.0,
});

const table = new THREE.Mesh(tableGeo, tableMat);

// since spheres sit at y = 0, lower the table
table.position.y = - (tableThickness / 2) - 8.0;

scene.add(table);


const sphereGeometries = generateSphereGeometries(11, 1, 1.25);
const sphereMeshes = [];
let xOffset = 0;
sphereGeometries.forEach((geometry, index) => {
    const fruitName = fruitOrder[index] ?? 'no';
    const material = fruitMaterials[fruitName];

    const sphere = new THREE.Mesh(geometry, material);

    sphere.userData.fruitName = fruitName;

    const r = geometry.parameters.radius;
    xOffset += r + 1;
    sphere.position.x = xOffset;
    xOffset += r + 1;
    sphereMeshes.push(sphere);
    scene.add(sphere);
});
const totalWidth = xOffset;
sphereMeshes.forEach(sphere => { sphere.position.x -= totalWidth / 2; });

scene.updateMatrixWorld(true);

sphereMeshes.forEach(sphere => {
    createFaceDecals(sphere, sphere.userData.fruitName, faceMaterials, { yaw: 0 });
});


function animate() {

	renderer.render( scene, camera );

    controls.update();

}

renderer.setAnimationLoop(animate);