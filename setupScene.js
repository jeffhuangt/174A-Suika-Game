import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';


export function setupScene() {
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
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.physicallyCorrectLights = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    document.body.appendChild( renderer.domElement );

    scene.background = new THREE.Color(0xaee9ff);

    function createAxisLine(color, start, end) {
        const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
        const material = new THREE.LineBasicMaterial({ color: color });
        return new THREE.Line(geometry, material);
    }

    // // Create axis lines
    // const xAxis = createAxisLine(0xff0000, new THREE.Vector3(0, 0, 0), new THREE.Vector3(5, 0, 0)); // Red
    // const yAxis = createAxisLine(0x00ff00, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 5, 0)); // Green
    // const zAxis = createAxisLine(0x0000ff, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 5)); // Blue

    // // Add axes to scene
    // scene.add(xAxis);
    // scene.add(yAxis);
    // scene.add(zAxis);

    const controls = new OrbitControls(camera, renderer.domElement);
    camera.position.set(15, 20, 20);

    controls.minDistance = 10;
    controls.maxDistance = 55;
    controls.minPolarAngle = 0.3;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minAzimuthAngle = -Math.PI * 275 / 360;
    controls.maxAzimuthAngle = Math.PI * 275 / 360;
    controls.enablePan = false;

    return { scene, camera, renderer, controls };
}