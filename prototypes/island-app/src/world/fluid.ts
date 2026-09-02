/* GPU fluid running under the sea surface, after Pavel Dobryakov's classic
   WebGL fluid sim and ksenia-k's liquid-distortion pen: velocity and
   pressure fields on ping-pong half-float render targets, a dye field
   advected along the flow for the visible swirl. The island's water
   shader samples the dye and velocity textures each frame. */
import * as THREE from "three";

/** the sim covers world coordinates [-FLUID_WORLD, FLUID_WORLD] on x and z */
export const FLUID_WORLD = 12;

const VERT = `varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;

const ADVECT = `
uniform sampler2D uVel; uniform sampler2D uSrc;
uniform float uDt; uniform float uDiss;
varying vec2 vUv;
void main(){
  vec2 uv = vUv - texture2D(uVel, vUv).xy * uDt;
  gl_FragColor = texture2D(uSrc, uv) * uDiss;
}`;

const SPLAT = `
uniform sampler2D uSrc; uniform vec2 uPoint; uniform vec3 uValue; uniform float uRadius;
varying vec2 vUv;
void main(){
  vec2 d = vUv - uPoint;
  float a = exp(-dot(d, d) / uRadius);
  gl_FragColor = texture2D(uSrc, vUv) + vec4(uValue * a, 0.);
}`;

const DIVERGENCE = `
uniform sampler2D uVel; uniform vec2 uTexel;
varying vec2 vUv;
void main(){
  float l = texture2D(uVel, vUv - vec2(uTexel.x, 0.)).x;
  float r = texture2D(uVel, vUv + vec2(uTexel.x, 0.)).x;
  float b = texture2D(uVel, vUv - vec2(0., uTexel.y)).y;
  float t = texture2D(uVel, vUv + vec2(0., uTexel.y)).y;
  gl_FragColor = vec4((r - l + t - b) * .5, 0., 0., 1.);
}`;

const PRESSURE = `
uniform sampler2D uPrs; uniform sampler2D uDiv; uniform vec2 uTexel;
varying vec2 vUv;
void main(){
  float l = texture2D(uPrs, vUv - vec2(uTexel.x, 0.)).x;
  float r = texture2D(uPrs, vUv + vec2(uTexel.x, 0.)).x;
  float b = texture2D(uPrs, vUv - vec2(0., uTexel.y)).x;
  float t = texture2D(uPrs, vUv + vec2(0., uTexel.y)).x;
  float d = texture2D(uDiv, vUv).x;
  gl_FragColor = vec4((l + r + b + t - d) * .25, 0., 0., 1.);
}`;

const GRADIENT = `
uniform sampler2D uPrs; uniform sampler2D uVel; uniform vec2 uTexel;
varying vec2 vUv;
void main(){
  float l = texture2D(uPrs, vUv - vec2(uTexel.x, 0.)).x;
  float r = texture2D(uPrs, vUv + vec2(uTexel.x, 0.)).x;
  float b = texture2D(uPrs, vUv - vec2(0., uTexel.y)).x;
  float t = texture2D(uPrs, vUv + vec2(0., uTexel.y)).x;
  vec2 v = texture2D(uVel, vUv).xy - vec2(r - l, t - b) * .5;
  gl_FragColor = vec4(v, 0., 1.);
}`;

interface Splat { u: number; v: number; du: number; dv: number; r: number; dye: number }

class Pair {
  a: THREE.WebGLRenderTarget;
  b: THREE.WebGLRenderTarget;
  constructor(size: number, opts: THREE.WebGLRenderTargetOptions) {
    this.a = new THREE.WebGLRenderTarget(size, size, opts);
    this.b = new THREE.WebGLRenderTarget(size, size, opts);
  }
  get read(): THREE.WebGLRenderTarget { return this.a; }
  get write(): THREE.WebGLRenderTarget { return this.b; }
  swap(): void { const t = this.a; this.a = this.b; this.b = t; }
}

export class FluidSim {
  frames = 0;
  splats = 0;
  private size = 128;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam = new THREE.Camera();
  private mesh: THREE.Mesh;
  private vel: Pair;
  private dye: Pair;
  private prs: Pair;
  private div: THREE.WebGLRenderTarget;
  private advMat: THREE.ShaderMaterial;
  private splatMat: THREE.ShaderMaterial;
  private divMat: THREE.ShaderMaterial;
  private prsMat: THREE.ShaderMaterial;
  private gradMat: THREE.ShaderMaterial;
  private queue: Splat[] = [];

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    const opts: THREE.WebGLRenderTargetOptions = {
      type: THREE.HalfFloatType, format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false, stencilBuffer: false,
    };
    this.vel = new Pair(this.size, opts);
    this.dye = new Pair(this.size, opts);
    this.prs = new Pair(this.size, opts);
    this.div = new THREE.WebGLRenderTarget(this.size, this.size, opts);
    const texel = new THREE.Vector2(1 / this.size, 1 / this.size);
    const mk = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
      new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
    this.advMat = mk(ADVECT, { uVel: { value: null }, uSrc: { value: null }, uDt: { value: 0 }, uDiss: { value: 1 } });
    this.splatMat = mk(SPLAT, { uSrc: { value: null }, uPoint: { value: new THREE.Vector2() }, uValue: { value: new THREE.Vector3() }, uRadius: { value: .0018 } });
    this.divMat = mk(DIVERGENCE, { uVel: { value: null }, uTexel: { value: texel } });
    this.prsMat = mk(PRESSURE, { uPrs: { value: null }, uDiv: { value: this.div.texture }, uTexel: { value: texel } });
    this.gradMat = mk(GRADIENT, { uPrs: { value: null }, uVel: { value: null }, uTexel: { value: texel } });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.advMat);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  get dyeTex(): THREE.Texture { return this.dye.read.texture; }
  get velTex(): THREE.Texture { return this.vel.read.texture; }

  /** stir the water at world x/z: dx/dz push the flow, dye makes it visible */
  splat(x: number, z: number, dx: number, dz: number, dye: number): void {
    const F = FLUID_WORLD, s = 2 * F;
    this.queue.push({ u: (x + F) / s, v: (z + F) / s, du: dx / s * 14, dv: dz / s * 14, r: .0018, dye });
    if (this.queue.length > 12) this.queue.shift();
    this.splats++;
  }

  private run(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget): void {
    this.mesh.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.cam);
    this.renderer.setRenderTarget(null);
  }

  step(dt: number): void {
    const d = Math.min(dt, .033);
    const av = this.advMat.uniforms;
    av.uVel.value = this.vel.read.texture;
    av.uSrc.value = this.vel.read.texture;
    av.uDt.value = d;
    av.uDiss.value = Math.pow(.988, d * 60);
    this.run(this.advMat, this.vel.write); this.vel.swap();
    for (const s of this.queue) {
      const sp = this.splatMat.uniforms;
      (sp.uPoint.value as THREE.Vector2).set(s.u, s.v);
      sp.uRadius.value = s.r;
      sp.uSrc.value = this.vel.read.texture;
      (sp.uValue.value as THREE.Vector3).set(s.du, s.dv, 0);
      this.run(this.splatMat, this.vel.write); this.vel.swap();
      sp.uSrc.value = this.dye.read.texture;
      (sp.uValue.value as THREE.Vector3).set(s.dye, 0, 0);
      this.run(this.splatMat, this.dye.write); this.dye.swap();
    }
    this.queue.length = 0;
    this.divMat.uniforms.uVel.value = this.vel.read.texture;
    this.run(this.divMat, this.div);
    for (let i = 0; i < 14; i++) {
      this.prsMat.uniforms.uPrs.value = this.prs.read.texture;
      this.run(this.prsMat, this.prs.write); this.prs.swap();
    }
    this.gradMat.uniforms.uPrs.value = this.prs.read.texture;
    this.gradMat.uniforms.uVel.value = this.vel.read.texture;
    this.run(this.gradMat, this.vel.write); this.vel.swap();
    av.uVel.value = this.vel.read.texture;
    av.uSrc.value = this.dye.read.texture;
    av.uDiss.value = Math.pow(.955, d * 60);
    this.run(this.advMat, this.dye.write); this.dye.swap();
    this.frames++;
  }
}
