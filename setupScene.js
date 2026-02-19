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

    // add a background color
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;

    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#aee9ff');
    grad.addColorStop(1, '#ffffff');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const bgTexture = new THREE.CanvasTexture(canvas);
    bgTexture.colorSpace = THREE.SRGBColorSpace;
    bgTexture.needsUpdate = true;

    scene.background = bgTexture;

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

    const controls = new OrbitControls(camera, renderer.domElement);
    camera.position.set(0, 5, 10); // Where the camera is.
    controls.target.set(0, 0, 0); // Orbit around world origin

    return { scene, camera, renderer, controls };
}