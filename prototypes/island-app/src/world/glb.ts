/* CC0 model integration (Kenney, kenney.nl — license alongside the assets):
   loads GLB models and, once ready, the world swaps them in for the
   matching catalog items in place of the procedural builders. Assets are
   inlined into the single-file bundle as data URIs; each kit's shared
   palette texture (hue-remapped into Fig & Marigold at build time) is
   resolved through a per-kit URL-modifier since GLBs reference it
   relatively. */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { box3, linC } from "./builders";
import houseUrl from "../assets/house-cottage.glb";
import cksColormapUrl from "../assets/kenney-colormap.png";
import fenceUrl from "../assets/ftk-fence.glb";
import lanternUrl from "../assets/ftk-lantern.glb";
import benchUrl from "../assets/ftk-bench.glb";
import ftkColormapUrl from "../assets/ftk-colormap.png";

/** loaded, footprint-normalised model roots by catalog item id */
export const GLBS: Record<string, THREE.Group | undefined> = {};

let onReady: (() => void) | null = null;
export const setGLBReady = (cb: () => void): void => {
  onReady = cb;
  if (Object.keys(GLBS).length) cb();
};

const mkLoader = (colormap: string): GLTFLoader => {
  const manager = new THREE.LoadingManager();
  manager.setURLModifier(url => url.includes("colormap") ? colormap : url);
  return new GLTFLoader(manager);
};
const cksLoader = mkLoader(cksColormapUrl);
const ftkLoader = mkLoader(ftkColormapUrl);

/** scale to the item's footprint (optionally height-capped), sit on the
    ground, face the camera side */
function normalise(scene: THREE.Group, targetW: number, rotY: number, maxH = 99): THREE.Group {
  const root = new THREE.Group();
  root.add(scene);
  scene.rotation.y = rotY;
  const bb = new THREE.Box3().setFromObject(scene);
  const size = bb.getSize(new THREE.Vector3());
  const s = Math.min(targetW / Math.max(size.x, size.z), maxH / size.y);
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

/** clone a loaded model and re-point userData at the clone's named nodes
    (a plain clone would keep references to the original's children) */
export function cloneGLB(id: string): THREE.Group {
  const g = GLBS[id]!.clone();
  const smoke = g.getObjectByName("smokeG");
  if (smoke) g.userData.smoke = smoke;
  const pane = g.getObjectByName("glowPane");
  if (pane) g.userData.homeWindow = pane;
  return g;
}

cksLoader.load(houseUrl, gltf => {
  const root = normalise(gltf.scene, 1.9, Math.PI / 2);
  /* re-attach the cozy bits the procedural house had: a glowing window
     pane for the night, and chimney smoke */
  const pane = box3(.05, .26, .3, 0xBFD8DC, 0, .5, 0, { c: 0xFFDF9E, i: 0 });
  pane.name = "glowPane";
  root.add(pane);
  pane.position.set(.74, .37, .13);
  const smoke = new THREE.Group();
  smoke.name = "smokeG";
  smoke.position.set(.12, 1.2, -.62);
  for (let i = 0; i < 3; i++) {
    smoke.add(new THREE.Mesh(new THREE.IcosahedronGeometry(.055 + i * .012, 1),
      new THREE.MeshLambertMaterial({ color: linC(0xD9D2D9), transparent: true, opacity: .5 })));
  }
  root.add(smoke);
  GLBS.house = root;
  onReady?.();
}, undefined, () => { /* trial asset failed to load — procedural house stays */ });

ftkLoader.load(fenceUrl, gltf => {
  GLBS.fence = normalise(gltf.scene, .95, 0);
  onReady?.();
}, undefined, () => { /* keep procedural fence */ });

ftkLoader.load(lanternUrl, gltf => {
  GLBS.lantern = normalise(gltf.scene, .5, 0, 1.15);
  onReady?.();
}, undefined, () => { /* keep procedural lantern */ });

ftkLoader.load(benchUrl, gltf => {
  GLBS.bench = normalise(gltf.scene, .85, 0);
  onReady?.();
}, undefined, () => { /* keep procedural bench */ });
