import * as THREE from 'three';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';

export function createFaceDecals(sphereMesh, fruitName, faceMaterials, {
    radius = sphereMesh.geometry.parameters.radius,
    offset = radius * 0.995,
    size = radius * 0.75,
    yaw = 0,
} = {}) {
    sphereMesh.updateMatrixWorld(true);

    const center = new THREE.Vector3();
    sphereMesh.getWorldPosition(center);

    const normal = new THREE.Vector3(0, 0.2, 1).normalize();

    const position = center.clone().add(normal.clone().multiplyScalar(offset));
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    const orientation = new THREE.Euler().setFromQuaternion(q);

    const decalGeo = new DecalGeometry(
        sphereMesh,
        position,
        orientation,
        new THREE.Vector3(size, size, size*0.12)
    );

    const decalMesh = new THREE.Mesh(decalGeo, faceMaterials[fruitName]);
    decalMesh.renderOrder = 999;
    decalMesh.material.depthTest = false;
    sphereMesh.parent?.add(decalMesh);
    return decalMesh;
}