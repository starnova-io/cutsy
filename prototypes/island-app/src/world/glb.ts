/* CC0 model trial (Kenney, kenney.nl — license alongside the assets):
   loads GLB models and, once ready, the world swaps them in for the
   matching catalog items in place of the procedural builders. Assets are
   inlined into the single-file bundle as data URIs; the Kenney palette
   texture is resolved through a URL-modifier since GLBs reference it
   relatively. */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import houseUrl from "../assets/house-cottage.glb";
import colormapUrl from "../assets/kenney-colormap.png";

/** loaded, footprint-normalised model roots by catalog item id */
export const GLBS: Record<string, THREE.Group | undefined> = {};

let onReady: (() => void) | null = null;
export const setGLBReady = (cb: () => void): void => {
  onReady = cb;
  if (GLBS.house) cb();
};

const manager = new THREE.LoadingManager();
manager.setURLModifier(url => url.includes("colormap") ? colormapUrl : url);
const loader = new GLTFLoader(manager);

/** scale to the item's footprint, sit on the ground, face the camera side */
function normalise(scene: THREE.Group, targetW: number, rotY: number): THREE.Group {
  const root = new THREE.Group();
  root.add(scene);
  scene.rotation.y = rotY;
  const bb = new THREE.Box3().setFromObject(scene);
  const size = bb.getSize(new THREE.Vector3());
  const s = targetW / Math.max(size.x, size.z);
  scene.scale.setScalar(s);
  bb.setFromObject(scene);
  const ctr = bb.getCenter(new THREE.Vector3());
  scene.position.x -= ctr.x;
  scene.position.z -= ctr.z;
  scene.position.y -= bb.min.y;
  scene.traverse(o => {
    const m = o as THREE.Mesh;
    if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
  });
  return root;
}

loader.load(houseUrl, gltf => {
  GLBS.house = normalise(gltf.scene, 1.9, Math.PI / 2);
  onReady?.();
}, undefined, () => { /* trial asset failed to load — procedural house stays */ });
