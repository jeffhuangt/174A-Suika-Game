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