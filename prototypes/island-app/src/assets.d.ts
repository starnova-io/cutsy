declare module "*.glb" {
  const url: string;
  export default url;
}
declare module "*.png" {
  const url: string;
  export default url;
}
declare module "three/examples/jsm/loaders/GLTFLoader.js" {
  import { LoadingManager, Group } from "three";
  export interface GLTF { scene: Group }
  export class GLTFLoader {
    constructor(manager?: LoadingManager);
    load(url: string, onLoad: (gltf: GLTF) => void,
      onProgress?: (e: ProgressEvent) => void, onError?: (e: unknown) => void): void;
  }
}
