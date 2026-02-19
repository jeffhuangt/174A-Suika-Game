import * as THREE from 'three';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

scene.add(new THREE.AmbientLight(0xffffff, 0.6));

const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(5, 10, 5);
scene.add(dirLight);

const rim = new THREE.DirectionalLight(0xffffff, 0.8);
rim.position.set(-5, 3, -5);
scene.add(rim);

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setAnimationLoop( animate );
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.physicallyCorrectLights = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
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

// const materials = [
//     new THREE.MeshBasicMaterial({ color: 0xff0000 }),
//     new THREE.MeshBasicMaterial({ color: 0x00ff00 }),
//     new THREE.MeshBasicMaterial({ color: 0x0000ff }),
//     new THREE.MeshBasicMaterial({ color: 0xffff00 }),
//     new THREE.MeshBasicMaterial({ color: 0xff00ff }),
//     new THREE.MeshBasicMaterial({ color: 0x00ffff }),
//     new THREE.MeshBasicMaterial({ color: 0xffffff }),
//     new THREE.MeshBasicMaterial({ color: 0x888888 }),
//     new THREE.MeshBasicMaterial({ color: 0xff8800 }),
//     new THREE.MeshBasicMaterial({ color: 0x88ff00 }),
//     new THREE.MeshBasicMaterial({ color: 0x0088ff })
// ];

const textureLoader = new THREE.TextureLoader();

const loadTextures = (path) => {
    const tex = textureLoader.load(path);
    tex.colorSpace = THREE.SRGBColorSpace;

    tex.wrapS = THREE.MirroredRepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(2, 1);

    return tex;
}

const fruitTextures = {
    cherry: loadTextures('./textures/cherry.jpg'),
    strawberry: loadTextures('./textures/strawberry.jpg'),
    grape: loadTextures('./textures/grape.jpg'),
    orange: loadTextures('./textures/orange.jpg'),
    persimmon: loadTextures('./textures/persimmon.jpg'),
    apple: loadTextures('./textures/apple.jpg'),
    pear: loadTextures('./textures/pear.jpg'),
    peach: loadTextures('./textures/peach.jpg'),
    pineapple: loadTextures('./textures/pineapple.jpg'),
    melon: loadTextures('./textures/melon.jpg'),
    watermelon: loadTextures('./textures/watermelon.jpg'),
}

Object.values(fruitTextures).forEach(tex => {
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
});

const fruitMaterials = Object.fromEntries(
    Object.entries(fruitTextures).map(([name, tex]) => [
      name,
      new THREE.MeshPhysicalMaterial({ 
        map: tex,
        roughness: 0.03,
        metalness: 0.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.01,
        transmission:0.15,
        thickness: 0.2,
        ior: 1.45,
        color: 0xffffff,
     })
    ])
);

const loadFaceTextures = (path) => {
    const tex = textureLoader.load(path);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.center.set(0.5, 0.5);
    tex.rotation = 0;
    tex.repeat.set(1, 1);
    tex.offset.set(0, 0);
    return tex;
};

const faceTextures = {
    cherry: loadFaceTextures('./faces/cherry_face.png'),
    strawberry: loadFaceTextures('./faces/strawberry_face.png'),
    grape: loadFaceTextures('./faces/grape_face.png'),
    orange: loadFaceTextures('./faces/orange_face.png'),
    persimmon: loadFaceTextures('./faces/persimmon_face.png'),
    apple: loadFaceTextures('./faces/apple_face.png'),
    pear: loadFaceTextures('./faces/pear_face.png'),
    peach: loadFaceTextures('./faces/peach_face.png'),
    pineapple: loadFaceTextures('./faces/pineapple_face.png'),
    melon: loadFaceTextures('./faces/melon_face.png'),
    watermelon: loadFaceTextures('./faces/watermelon_face.png'),
}

Object.values(faceTextures).forEach(tex => {
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    tex.minFilter = THREE.LinearMipMapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
});

const faceMaterials = Object.fromEntries(
    Object.entries(faceTextures).map(([name, tex]) => [
      name,
      new THREE.MeshBasicMaterial({ 
        map: tex,
        transparent: true,
        alphaTest: 0.1,
        depthTest: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        color: new THREE.Color(1.2, 1.2, 1.2),
     })
    ])
);

const fruitOrder = [
    'cherry',
    'strawberry',
    'grape',
    'orange',
    'persimmon',
    'apple',
    'pear',
    'peach',
    'pineapple',
    'melon',
    'watermelon'
];

// const texturedMaterial = new THREE.MeshStandardMaterial({map: watermelonTexture});

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
    addFaceDecal(sphere, sphere.userData.fruitName, { yaw: 0 });
});

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

function addFaceDecal(sphereMesh, fruitName, {
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
    scene.add(decalMesh);
    return decalMesh;
}