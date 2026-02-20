import * as THREE from 'three';

export function createFruitsTextures(renderer) {

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
            transmission:0.0,
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

    return { fruitMaterials, faceMaterials, fruitOrder };
}