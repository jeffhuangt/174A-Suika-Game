import * as THREE from "three";


export function merge({ scene,
    fallingFruits,
    fruitOrder,
    sphereGeometries,
    fruitMaterials,
    faceMaterials,
    createFaceDecals,
    eps = 0.02, // tolerance
    popY = 2.5,
}) {

    function spawnByIndex(fruitIndex, pos) {
        const fruitName = fruitOrder[fruitIndex];
        if (!fruitName) return;
    
        const geometry = sphereGeometries[fruitIndex];
        const radius = geometry.parameters.radius;
    
        const mat = fruitMaterials[fruitName];
        const mesh = new THREE.Mesh(geometry, mat);
        mesh.userData.fruitName = fruitName;
    
        mesh.position.copy(pos);
        scene.add(mesh);
    
        createFaceDecals(mesh, fruitName, faceMaterials, { yaw: 0 });
    
        fallingFruits.push({ mesh, velocityY: popY, radius });

    }


    for (let i = 0; i < fallingFruits.length; i++) {
        const first = fallingFruits[i];
        const firstName = first.mesh.userData.fruitName;

        for (let j = i + 1; j < fallingFruits.length; j++) {
        const second = fallingFruits[j];
        const secondName = second.mesh.userData.fruitName;

        if (firstName !== secondName) continue;

        const dx = first.mesh.position.x - second.mesh.position.x;
        const dy = first.mesh.position.y - second.mesh.position.y;
        const dz = first.mesh.position.z - second.mesh.position.z;
        const distanceFrom = dx * dx + dy * dy + dz * dz;

        const rSum = first.radius + second.radius;
        const thr = (rSum + eps) * (rSum + eps);
        if (distanceFrom > thr) continue;

        const curIndex = fruitOrder.indexOf(firstName);
        const nextIndex = curIndex + 1;

        if (nextIndex >= sphereGeometries.length) return;

        const mid = new THREE.Vector3()
            .addVectors(first.mesh.position, second.mesh.position)
            .multiplyScalar(0.5);

        scene.remove(second.mesh);
        scene.remove(first.mesh);

        fallingFruits.splice(j, 1);
        fallingFruits.splice(i, 1);

        spawnByIndex(nextIndex, mid);
        return;
        }
    }
}