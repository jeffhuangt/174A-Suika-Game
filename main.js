import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';

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
new RGBELoader().load('./hdri/studio_small_08_1k.hdr', (hdr) => {
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = hdr;
});
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
