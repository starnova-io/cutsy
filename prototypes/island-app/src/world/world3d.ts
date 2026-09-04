import * as THREE from "three";
import { B3, buildPet, box3, grp3, landThumb, linC } from "./builders";
import { C3, PH3 } from "./palette";
import { GW, GH, MASKS, LANDS, BRIDGE_TILES, WCX, WCZ, isBeachIn, mainMask, placeOK } from "./island";
import { curPhase, curSeason, curWeather, isAutumn } from "../game/weather";
import { FluidSim, FLUID_WORLD } from "./fluid";
import { byId } from "../game/catalog";
import { itemFootprint } from "../game/economy";
import type { GameState, PetKind, Phase, PlacedItem, Season, Weather } from "../game/types";

/* Ambient falling particles per season — autumn leaves, spring petals, snow —
   drawn as ONE InstancedMesh (physics on the CPU, matrices recomposed per
   frame, after ceramicSoda's falling-leaves shader pen). Landed particles
   rest where they fell and build up a carpet until `carpet`/`life` recycle
   them. */
interface PConf {
  cap: number; w: number; h: number; cols: number[];
  vy: number; vyR: number; rainVy: number; sway: number;
  want: Record<Weather, number>;
  /** leaves wait for the colour turn; petals and snow start at once */
  gate: number;
  /** share spawned from a real canopy vs drifting in high on the wind */
  treeShare: number;
  /** leaves and petals come from the island's own trees — none placed, none
      fall; snow needs no tree */
  needTrees: boolean;
  /** how many landed particles may rest on the ground, and for how long */
  carpet: number; life: number;
}
const PCONF: Partial<Record<Season, PConf>> = {
  autumn: { cap: 340, w: .13, h: .17, cols: C3.fall, vy: .35, vyR: .3, rainVy: .45, sway: .5,
    want: { clear: 26, cloudy: 40, rain: 10 }, gate: .45, treeShare: .6, needTrees: true, carpet: 250, life: 120 },
  spring: { cap: 220, w: .11, h: .14, cols: C3.petal, vy: .22, vyR: .18, rainVy: .3, sway: .7,
    want: { clear: 22, cloudy: 30, rain: 8 }, gate: 0, treeShare: .4, needTrees: true, carpet: 130, life: 45 },
  winter: { cap: 280, w: .08, h: .08, cols: [0xFFFFFF, 0xF0F6FA, 0xE4EEF4], vy: .3, vyR: .22, rainVy: .3,
    sway: .35, want: { clear: 38, cloudy: 55, rain: 70 }, gate: 0, treeShare: 0, needTrees: false, carpet: 150, life: 25 },
};

/* gradient sky per phase: [zenith, horizon] — the horizon colour doubles as
   the fog colour so the sea melts into the sky */
const SKY3: Record<Phase, [string, string]> = {
  dawn: ["#EFCFA9", "#FBEDDD"],
  day: ["#A7CBD1", "#E2EFE6"],
  dusk: ["#E2A57E", "#F8DDC2"],
  night: ["#1F2A44", "#41527A"],
};
const SKY_RAIN: [string, string] = ["#9FAAAD", "#C6CFCE"];

interface LeafState {
  ph: 0 | 1 | 2 | 3;              /* free, falling, resting, fading */
  x: number; y: number; z: number;
  rx: number; ry: number; rz: number;
  vy: number; vx: number; vz: number;
  spinX: number; spinZ: number;
  wph: number; swf: number;
  age: number; sc: number;
  water: boolean;
}

export interface WorldOpts {
  ghost?: PlacedItem | null;
  grid?: boolean;
  previewPet?: PetKind | null;
  /** arrange mode: pulse a ring under every placed item */
  highlight?: boolean;
}

export interface WorldCallbacks {
  getState(): GameState;
  onTapPet(clientX: number, clientY: number): void;
  onTapItem(pidx: number): void;
  onTapTile(x: number, y: number): void;
}

/* live pet pose, driven by the animation loop */
export const petView = {
  x: 6, y: 5, face: 0, mode: "idle" as "idle" | "happy" | "drink",
  modeT: 0, napping: false,
  path: null as { x: number; y: number }[] | null,
  seg: 0, prog: 0,
  done: null as (() => void) | null,
};

class World {
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.OrthographicCamera;
  private canvas!: HTMLCanvasElement;
  private hemi!: THREE.HemisphereLight;
  private sunL!: THREE.DirectionalLight;
  private glowL!: THREE.PointLight;
  private seaMesh!: THREE.Mesh;
  private tilesG!: THREE.Group;
  private isletTilesG!: THREE.Group;
  private bridgeG!: THREE.Group;
  private itemsG!: THREE.Group;
  private ghostG!: THREE.Group;
  private gridG!: THREE.Group;
  private petRoot!: THREE.Group;
  private petBody: THREE.Group | null = null;
  private cloudsG!: THREE.Group;
  private rainPts!: THREE.Points;
  private starPts!: THREE.Points;
  private celestial!: THREE.Mesh;
  private waves: THREE.Mesh[] = [];
  private thumbR: THREE.WebGLRenderer | null = null;
  private thumbCache: Record<string, string> = {};
  private cb!: WorldCallbacks;
  private opts: WorldOpts = {};
  private petKind: PetKind | null = null;
  private t = 0;
  private lastT = performance.now();
  private isletAnim: { t: number } | null = null;
  private yarnWobble = 0;
  /* seasons: autumn leaves turn (autumnK 0→1) then fall; petals, snow, fireflies */
  private season: Season = "summer";
  private pconf: PConf | null = null;
  private autumnK = 0;
  private turnDelay = 1.2;
  private leafIM: THREE.InstancedMesh | null = null;
  private leafSt: LeafState[] = [];
  private leafFree: number[] = [];
  private settledQ: number[] = [];
  private leafDummy = new THREE.Object3D();
  private seaMat!: THREE.ShaderMaterial;
  private ripples: { x: number; z: number; t0: number; s: number }[] = [];
  private fluid: FluidSim | null = null;
  private lastSplat: { sx: number; sy: number; x: number; z: number } | null = null;
  private drinkSpot: { x: number; z: number } | null = null;
  private drinkTick = 0;
  private firefliesG!: THREE.Group;
  private shootPts!: THREE.Points;
  private shootT = -1;
  private shootV = new THREE.Vector3();
  private canopies: { x: number; z: number; h: number; r: number }[] = [];
  private grassSpots: { x: number; z: number }[] = [];
  private landKey = "";
  private landAnim: { keys: Set<string>; t: number } | null = null;
  private popQueue: string | null = null;
  private started = false;
  /* orbit camera: azimuth, elevation, zoom (1 = default framing) */
  private camTheta = Math.atan2(10, 11.3);
  private camPhi = Math.asin(8.6 / 15.1);
  private camZoom = 1;
  private needProj = true;
  private pointers = new Map<number, { x: number; y: number }>();
  private drag: { x: number; y: number; sx: number; sy: number; moved: boolean; t: number } | null = null;
  private pinch: { d0: number; z0: number } | null = null;

  /** the next sync scale-pops the newest item with this id */
  queuePop(id: string): void { this.popQueue = id; }

  /** Register game callbacks (child effects may have mounted the canvas already). */
  init(cb: WorldCallbacks): void {
    this.cb = cb;
    this.ensure();
    if (this.canvas.parentElement) { this.resize(); this.sync(); }
  }

  private ensure(): void {
    if (this.started) return;
    this.started = true;
    if (!this.cb) {
      this.cb = {
        getState: () => { throw new Error("world callbacks not registered"); },
        onTapPet: () => {}, onTapItem: () => {}, onTapTile: () => {},
      };
    }
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.canvas = this.renderer.domElement;
    this.canvas.style.cssText = "width:100%;height:100%;display:block;touch-action:none;";
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xE2EFE6, 22, 40);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 100);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0xA8987F, 1);
    this.hemi.groundColor.convertSRGBToLinear();
    this.scene.add(this.hemi);
    this.sunL = new THREE.DirectionalLight(0xfff6e0, .9);
    this.sunL.castShadow = true;
    this.sunL.shadow.mapSize.set(2048, 2048);
    this.sunL.shadow.bias = -.0004;
    const sc = this.sunL.shadow.camera;
    sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -9;
    this.scene.add(this.sunL);
    this.glowL = new THREE.PointLight(0xFFB868, 0, 7);
    this.glowL.color.convertSRGBToLinear();
    this.scene.add(this.glowL);

    /* living water: gentle interference waves + expanding tap/landing ripples,
       colour-only in the fragment shader (after ksenia-k's liquid pens, scaled
       down to cozy) */
    try {
      if (this.renderer.capabilities.isWebGL2) this.fluid = new FluidSim(this.renderer);
    } catch { this.fluid = null; }
    const blankTex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat);
    blankTex.needsUpdate = true;
    this.seaMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(C3.water.day) },
        uRipples: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, -99, 0)) },
        uFluid: { value: blankTex },
        uFluidVel: { value: blankTex },
        uFog: { value: new THREE.Color(0xE2EFE6) },
      },
      vertexShader: `
        varying vec2 vXZ;
        varying float vDist;
        void main() {
          vXZ = vec2(position.x, -position.y);
          vec4 mv = modelViewMatrix * vec4(position, 1.);
          vDist = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        uniform vec4 uRipples[8];
        uniform sampler2D uFluid;
        uniform sampler2D uFluidVel;
        uniform vec3 uFog;
        varying vec2 vXZ;
        varying float vDist;
        void main() {
          vec2 fuv = (vXZ + ${FLUID_WORLD}.) / ${FLUID_WORLD * 2}.;
          vec2 fvel = texture2D(uFluidVel, fuv).xy;
          float dye = texture2D(uFluid, fuv).x;
          /* the fluid's flow bends the ambient wave pattern */
          vec2 p = vXZ + fvel * 14.;
          float w = sin(p.x * 1.4 + uTime * .7) * sin(p.y * 1.1 - uTime * .55)
                  + .5 * sin(p.x * 2.3 - uTime * .9) * sin(p.y * 2.7 + uTime * .8);
          vec3 col = uColor * (1. + w * .045);
          float foam = 0.;
          for (int i = 0; i < 8; i++) {
            vec4 r = uRipples[i];
            float age = uTime - r.z;
            if (age < 0. || age > 2.4) continue;
            float d = distance(vXZ, r.xy);
            float ring = age * 1.7 + .1;
            foam += smoothstep(.16, .0, abs(d - ring)) * (1. - age / 2.4) * r.w;
          }
          /* brighter shallows hug the island */
          float shore = smoothstep(8.2, 5., length(vXZ - vec2(0., -.6)));
          col = mix(col, col * 1.22 + vec3(.05, .07, .06), shore * .5);
          foam = clamp(foam, 0., 1.) * .65 + clamp(dye, 0., 1.2) * .55;
          col = mix(col, vec3(.95, .98, 1.), clamp(foam, 0., .85));
          col = mix(col, uFog, smoothstep(22., 40., vDist));
          gl_FragColor = vec4(col, 1.);
        }`,
    });
    this.seaMesh = new THREE.Mesh(new THREE.CircleGeometry(30, 48), this.seaMat);
    this.seaMesh.rotation.x = -Math.PI / 2;
    this.seaMesh.position.y = -.3;
    this.scene.add(this.seaMesh);
    for (let i = 0; i < 3; i++) {
      const w = new THREE.Mesh(new THREE.RingGeometry(5 + i * .5, 5.12 + i * .5, 48),
        new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: .25 }));
      w.rotation.x = -Math.PI / 2;
      w.position.y = -.28;
      w.userData.ph = i * 2.1;
      this.scene.add(w);
      this.waves.push(w);
    }

    this.tilesG = new THREE.Group(); this.scene.add(this.tilesG);
    this.buildTiles(MASKS.main, this.tilesG);
    this.isletTilesG = new THREE.Group(); this.scene.add(this.isletTilesG);
    this.buildTiles(MASKS.islet, this.isletTilesG);

    this.bridgeG = new THREE.Group();
    BRIDGE_TILES.forEach(k => {
      const [x, y] = k.split(",").map(Number);
      const p = grp3(box3(.86, .09, 1.04, C3.woodL, 0, .02, 0),
        box3(.06, .3, 1.04, C3.wood, -.42, .12, 0), box3(.06, .3, 1.04, C3.wood, .42, .12, 0));
      p.position.set(WCX(x), 0, WCZ(y));
      this.bridgeG.add(p);
    });
    this.scene.add(this.bridgeG);

    this.itemsG = new THREE.Group(); this.scene.add(this.itemsG);
    this.ghostG = new THREE.Group(); this.scene.add(this.ghostG);
    this.gridG = new THREE.Group(); this.scene.add(this.gridG);
    this.petRoot = new THREE.Group(); this.scene.add(this.petRoot);

    this.cloudsG = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const mk = (r: number, x: number, y: number, z: number) => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8),
          new THREE.MeshLambertMaterial({ color: 0xFFFFFF, transparent: true, opacity: .92 }));
        m.position.set(x, y, z);
        m.scale.set(1, .5, .8);
        return m;
      };
      const c = grp3(mk(.7, 0, 0, 0), mk(.5, .6, .06, .1), mk(.45, -.55, .04, -.05));
      c.position.set(-8 + i * 6, 4.4 + i * .4, -3 + i * 2.4);
      this.cloudsG.add(c);
    }
    this.scene.add(this.cloudsG);

    const rainGeo = new THREE.BufferGeometry();
    const rp = new Float32Array(260 * 3);
    for (let i = 0; i < 260; i++) {
      rp[i * 3] = (Math.random() - .5) * 13;
      rp[i * 3 + 1] = Math.random() * 7;
      rp[i * 3 + 2] = (Math.random() - .5) * 15;
    }
    rainGeo.setAttribute("position", new THREE.BufferAttribute(rp, 3));
    this.rainPts = new THREE.Points(rainGeo,
      new THREE.PointsMaterial({ color: linC(0xAAC0D8), size: .07, transparent: true, opacity: .7 }));
    this.scene.add(this.rainPts);

    const starGeo = new THREE.BufferGeometry();
    const sp = new Float32Array(90 * 3);
    for (let i = 0; i < 90; i++) {
      sp[i * 3] = (Math.random() - .5) * 30;
      sp[i * 3 + 1] = 5 + Math.random() * 9;
      sp[i * 3 + 2] = (Math.random() - .5) * 30 - 4;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    this.starPts = new THREE.Points(starGeo,
      new THREE.PointsMaterial({ color: linC(0xFFF4D8), size: .09, transparent: true, opacity: .9 }));
    this.scene.add(this.starPts);

    this.season = curSeason();
    this.pconf = PCONF[this.season] ?? null;
    if (this.pconf) {
      const cf = this.pconf;
      this.leafIM = new THREE.InstancedMesh(
        new THREE.PlaneGeometry(cf.w, cf.h),
        new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }),
        cf.cap);
      this.leafIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const col = new THREE.Color();
      const dum = this.leafDummy;
      dum.position.set(0, -50, 0);
      dum.scale.setScalar(.0001);
      dum.updateMatrix();
      for (let i = 0; i < cf.cap; i++) {
        this.leafIM.setColorAt(i, col.set(cf.cols[i % cf.cols.length]).convertSRGBToLinear());
        this.leafIM.setMatrixAt(i, dum.matrix);
        this.leafSt.push({
          ph: 0, x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, vy: 0, vx: 0, vz: 0,
          spinX: 0, spinZ: 0, wph: 0, swf: 0, age: 0, sc: 1, water: false,
        });
        this.leafFree.push(i);
      }
      if (this.leafIM.instanceColor) this.leafIM.instanceColor.needsUpdate = true;
      this.scene.add(this.leafIM);
    }
    this.computeGrassSpots(MASKS.main);

    /* summer nights: fireflies wandering over the grass */
    this.firefliesG = new THREE.Group();
    for (let i = 0; i < 14; i++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(.035, 6, 5),
        new THREE.MeshBasicMaterial({ color: linC(0xFFE9A8), transparent: true, opacity: .8 }));
      const b = this.grassSpots[(i * 7) % this.grassSpots.length] ?? { x: 0, z: 0 };
      f.userData.fly = { bx: b.x, bz: b.z, ph: i * 1.7, f1: .35 + (i % 5) * .08, f2: .28 + (i % 4) * .09, amp: .8 + (i % 3) * .4 };
      this.firefliesG.add(f);
    }
    this.firefliesG.visible = false;
    this.scene.add(this.firefliesG);

    /* clear winter nights: the odd shooting star */
    const shootGeo = new THREE.BufferGeometry();
    shootGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6 * 3), 3));
    this.shootPts = new THREE.Points(shootGeo,
      new THREE.PointsMaterial({ color: 0xFFFFFF, size: .12, transparent: true, opacity: 0 }));
    this.shootPts.visible = false;
    this.scene.add(this.shootPts);

    const cel = new THREE.Mesh(new THREE.SphereGeometry(.55, 14, 12),
      new THREE.MeshLambertMaterial({ color: linC(0xFFE9B0) }));
    (cel.material as THREE.MeshLambertMaterial).emissive = linC(0xFFE9B0);
    cel.position.set(-8, 7, -6);
    this.celestial = cel;
    this.scene.add(cel);

    this.canvas.addEventListener("pointerdown", ev => this.onPointerDown(ev));
    this.canvas.addEventListener("pointermove", ev => this.onPointerMove(ev));
    this.canvas.addEventListener("pointerup", ev => this.onPointerUp(ev));
    this.canvas.addEventListener("pointercancel", ev => this.onPointerUp(ev, true));
    this.canvas.addEventListener("wheel", ev => {
      ev.preventDefault();
      this.setZoom(this.camZoom * (ev.deltaY > 0 ? .92 : 1.08));
    }, { passive: false });
    this.canvas.addEventListener("dblclick", () => this.resetCamera());
    window.addEventListener("resize", () => this.resize());
    requestAnimationFrame(now => this.loop(now));
  }

  /* The logical grid stays, but the ground shouldn't read as squares:
     near-uniform grass with a whisper of per-tile variation, organic
     scatter (tufts, wildflowers, pebbles, sun patches) breaking the tile
     rhythm, and rounded sand bumps scalloping the coastline. Decoration
     lives in a sub-group so tile raycasts (non-recursive) skip it. */
  private buildTiles(mask: Set<string>, into: THREE.Group): void {
    const sn = curSeason();
    const rng = (x: number, y: number, k: number) => {
      const v = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453;
      return v - Math.floor(v);
    };
    const grassBase = sn === "autumn" ? C3.grassFall[0] : sn === "spring" ? C3.grassSpring[0]
      : sn === "winter" ? C3.grassWinter[0] : C3.grass[0];
    const sandBase = sn === "winter" ? C3.sandWinter : C3.sand;
    const side = new THREE.MeshLambertMaterial({ color: linC(C3.dirt) });
    const sideD = new THREE.MeshLambertMaterial({ color: linC(C3.dirtD) });
    /* the coast cliff reads as dune sand, not dark dirt */
    const sandSide = new THREE.MeshLambertMaterial({ color: linC(sn === "winter" ? 0xCFC7AF : 0xCBB076) });
    const sandSideD = new THREE.MeshLambertMaterial({ color: linC(sn === "winter" ? 0xC2BAA2 : 0xBFA268) });
    const bumpMat = new THREE.MeshLambertMaterial({ color: linC(sandBase) });
    const tuftMat = new THREE.MeshLambertMaterial({
      color: linC(sn === "winter" ? 0xDDE6E2 : sn === "autumn" ? 0x8A8A50 : 0x6F945C),
    });
    const patchMat = new THREE.MeshLambertMaterial({
      color: new THREE.Color(grassBase).offsetHSL(0, .02, .06).convertSRGBToLinear(),
      transparent: true, opacity: .5,
    });
    const pebbleMat = new THREE.MeshLambertMaterial({ color: linC(C3.stoneD) });
    const deco = new THREE.Group();
    const grassTiles: { x: number; y: number }[] = [];
    mask.forEach(k => {
      const [x, y] = k.split(",").map(Number);
      const beach = isBeachIn(mask, x, y);
      if (!beach) grassTiles.push({ x, y });
      const top = new THREE.Color(beach ? sandBase : grassBase);
      top.offsetHSL(0, beach ? 0 : (rng(x, y, 1) - .5) * .015, (rng(x, y, 2) - .5) * (beach ? .025 : .032));
      const s1 = beach ? sandSide : side, s2 = beach ? sandSideD : sideD;
      const mats = [s1, s2, new THREE.MeshLambertMaterial({ color: top.convertSRGBToLinear() }), s2, s1, s2];
      const m = new THREE.Mesh(new THREE.BoxGeometry(.999, .9, .999), mats);
      m.position.set(WCX(x), -.45, WCZ(y));
      m.receiveShadow = true;
      m.userData.tile = { x, y };
      into.add(m);
      const wx = WCX(x), wz = WCZ(y);
      if (beach) {
        /* rounded sand bumps soften the square coastline */
        ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).forEach(([dx, dy], di) => {
          if (mask.has((x + dx) + "," + (y + dy))) return;
          const b = new THREE.Mesh(new THREE.SphereGeometry(.55, 10, 8), bumpMat);
          const along = 1.3 + rng(x, y, 10 + di) * .35;
          b.scale.set(dx ? .95 : along, .55, dx ? along : .95);
          b.position.set(wx + dx * .5, -.28, wz + dy * .5);
          b.receiveShadow = true;
          deco.add(b);
        });
        ([[1, 1], [1, -1], [-1, 1], [-1, -1]] as const).forEach(([dx, dy], di) => {
          if (mask.has((x + dx) + "," + y) || mask.has(x + "," + (y + dy))) return;
          const b = new THREE.Mesh(new THREE.SphereGeometry(.5, 10, 8), bumpMat);
          b.scale.set(.95 + rng(x, y, 20 + di) * .2, .55, .95 + rng(x, y, 24 + di) * .2);
          b.position.set(wx + dx * .45, -.28, wz + dy * .45);
          b.receiveShadow = true;
          deco.add(b);
        });
        if (rng(x, y, 4) < .14) {
          const p = new THREE.Mesh(new THREE.SphereGeometry(.045, 7, 6), pebbleMat);
          p.position.set(wx + (rng(x, y, 5) - .5) * .5, .01, wz + (rng(x, y, 6) - .5) * .5);
          p.scale.y = .6;
          deco.add(p);
        }
        return;
      }
      const r = rng(x, y, 3);
      const ox = (rng(x, y, 5) - .5) * .55, oz = (rng(x, y, 6) - .5) * .55;
      if (sn === "winter") {
        if (r < .26) {
          const lump = new THREE.Mesh(new THREE.SphereGeometry(.1, 8, 6),
            new THREE.MeshLambertMaterial({ color: linC(C3.snow) }));
          lump.position.set(wx + ox, .02, wz + oz);
          lump.scale.y = .5;
          deco.add(lump);
        }
        return;
      }
      if (r < .25) {
        for (let i = 0; i < 3; i++) {
          const c = new THREE.Mesh(new THREE.ConeGeometry(.025, .15, 5), tuftMat);
          c.position.set(wx + ox + (rng(x, y, 7 + i) - .5) * .09, .07, wz + oz + (rng(x, y, 11 + i) - .5) * .09);
          c.rotation.z = (rng(x, y, 15 + i) - .5) * .5;
          deco.add(c);
        }
      } else if (r < .38) {
        const patch = new THREE.Mesh(new THREE.CircleGeometry(.2 + rng(x, y, 8) * .14, 10), patchMat);
        patch.rotation.x = -Math.PI / 2;
        patch.position.set(wx + ox, .012, wz + oz);
        deco.add(patch);
      } else if (r < .48 && sn !== "autumn") {
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .09, 5),
          new THREE.MeshLambertMaterial({ color: linC(0x5A7D4A) }));
        stem.position.set(wx + ox, .045, wz + oz);
        const head = new THREE.Mesh(new THREE.SphereGeometry(.032, 7, 6),
          new THREE.MeshLambertMaterial({ color: linC(rng(x, y, 9) < .5 ? 0xF0E7EE : C3.gold) }));
        head.position.set(wx + ox, .1, wz + oz);
        deco.add(stem, head);
      } else if (r < .48) {
        /* autumn: a little mushroom instead of flowers */
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(.02, .025, .06, 6),
          new THREE.MeshLambertMaterial({ color: linC(C3.cream) }));
        stem.position.set(wx + ox, .03, wz + oz);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6),
          new THREE.MeshLambertMaterial({ color: linC(C3.terra) }));
        cap.position.set(wx + ox, .065, wz + oz);
        cap.scale.y = .6;
        deco.add(stem, cap);
      } else if (r < .54) {
        const p = new THREE.Mesh(new THREE.SphereGeometry(.04, 7, 6), pebbleMat);
        p.position.set(wx + ox, .015, wz + oz);
        p.scale.set(1, .55, .8);
        deco.add(p);
      }
    });
    /* a carpet of instanced grass blades so the meadow reads as grass,
       not paint (none in winter — snow covers it) */
    if (sn !== "winter" && grassTiles.length) {
      const per = 10;
      const im = new THREE.InstancedMesh(
        new THREE.ConeGeometry(.016, .11, 4),
        new THREE.MeshLambertMaterial({ color: 0xffffff }),
        grassTiles.length * per);
      const colA = new THREE.Color(sn === "autumn" ? 0x97A05E : sn === "spring" ? 0x7FB864 : 0x749B60).convertSRGBToLinear();
      const colB = new THREE.Color(sn === "autumn" ? 0xAAAE6C : sn === "spring" ? 0x93C774 : 0x87AD6F).convertSRGBToLinear();
      const dum = new THREE.Object3D(), cc = new THREE.Color();
      let i = 0;
      for (const gt of grassTiles) {
        for (let b = 0; b < per; b++) {
          const r1 = rng(gt.x, gt.y, 30 + b), r2 = rng(gt.x, gt.y, 60 + b), r3 = rng(gt.x, gt.y, 90 + b);
          dum.position.set(WCX(gt.x) + (r1 - .5) * .92, .05, WCZ(gt.y) + (r2 - .5) * .92);
          dum.rotation.set((r3 - .5) * .4, r1 * 6.28, (r2 - .5) * .4);
          dum.scale.setScalar(.65 + r3 * .75);
          dum.updateMatrix();
          im.setMatrixAt(i, dum.matrix);
          im.setColorAt(i, cc.copy(colA).lerp(colB, r2));
          i++;
        }
      }
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      deco.add(im);
    }
    into.add(deco);
  }

  mount(wrap: HTMLElement, opts: WorldOpts = {}): void {
    this.ensure();
    this.opts = opts;
    if (this.canvas.parentElement !== wrap) wrap.appendChild(this.canvas);
    this.resize();
    try { this.sync(); } catch { /* callbacks not registered yet — first sync comes with init */ }
  }

  setOpts(opts: WorldOpts): void { this.opts = opts; this.sync(); }

  private viewHalf(): number {
    let base = 5.7;
    try {
      const S = this.cb.getState();
      base = (S.bridge ? 6.35 : 5.7) + Math.min(1.1, S.lands.length * .28);
    } catch { /* pre-init */ }
    return base / this.camZoom;
  }

  private setZoom(z: number): void {
    this.camZoom = Math.min(1.9, Math.max(.55, z));
    this.needProj = true;
  }

  resetCamera(): void {
    this.camTheta = Math.atan2(10, 11.3);
    this.camPhi = Math.asin(8.6 / 15.1);
    this.camZoom = 1;
    this.needProj = true;
  }

  resize(): void {
    const wrap = this.canvas.parentElement;
    if (!wrap) return;
    const w = wrap.clientWidth || 400, h = wrap.clientHeight || 420;
    this.renderer.setSize(w, h, false);
    const halfH = this.viewHalf(), aspect = w / h;
    this.camera.left = -halfH * aspect; this.camera.right = halfH * aspect;
    this.camera.top = halfH; this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
  }

  private frameCamera(): void {
    if (this.needProj) { this.resize(); this.needProj = false; }
    let tz = -1.3;
    try { tz = this.cb.getState().bridge ? 0.2 : -1.3; } catch { /* pre-init */ }
    const R = 15.1;
    const x = R * Math.cos(this.camPhi) * Math.sin(this.camTheta);
    const y = R * Math.sin(this.camPhi);
    const z = R * Math.cos(this.camPhi) * Math.cos(this.camTheta);
    this.camera.position.set(x, y, tz + z);
    this.camera.lookAt(0, 0, tz);
  }

  private applyPhase(): void {
    const S = this.cb.getState();
    const P = PH3[curPhase()], W = curWeather(), night = curPhase() === "night";
    this.frameCamera();
    /* gradient sky painted behind the transparent canvas; fog melts the sea
       into the horizon colour */
    const grad = W === "rain" && !night ? SKY_RAIN : SKY3[curPhase()];
    const wrapEl = this.canvas.parentElement as HTMLElement | null;
    if (wrapEl) wrapEl.style.background = `linear-gradient(180deg, ${grad[0]} 0%, ${grad[1]} 72%)`;
    (this.scene.fog as THREE.Fog).color.set(grad[1]);
    (this.seaMat.uniforms.uFog.value as THREE.Color).set(grad[1]);
    this.hemi.color.set(P.hemi).convertSRGBToLinear();
    this.hemi.groundColor.set(P.ground).convertSRGBToLinear();
    this.hemi.intensity = P.hInt * (W === "rain" ? .8 : 1);
    this.sunL.color.set(P.sun).convertSRGBToLinear();
    this.sunL.intensity = P.int * (W === "rain" ? .55 : W === "cloudy" ? .8 : 1);
    this.sunL.position.set(...P.dir);
    const wintry = this.season === "winter";
    const wc = new THREE.Color(C3.water[curPhase()]);
    if (wintry) wc.lerp(new THREE.Color(C3.ice), .45);
    (this.seaMat.uniforms.uColor.value as THREE.Color).copy(wc);
    this.celestial.visible = W !== "rain";
    const cm = this.celestial.material as THREE.MeshLambertMaterial;
    cm.color.set(night ? 0xE8EEF8 : 0xFFE9B0).convertSRGBToLinear();
    cm.emissive.set(night ? 0xC9D6EE : 0xFFE9B0).convertSRGBToLinear();
    this.celestial.position.set(night ? 7 : -8, 7.2, -7);
    /* winter: a big low moon and denser stars; "rain" falls as snow instead */
    this.celestial.scale.setScalar(wintry && night ? 1.35 : 1);
    (this.starPts.material as THREE.PointsMaterial).size = wintry ? .12 : .09;
    this.starPts.visible = night;
    this.rainPts.visible = W === "rain" && !wintry;
    this.firefliesG.visible = night && this.season === "summer" && W !== "rain";
    this.cloudsG.children.forEach(c => c.traverse(o => {
      const m = (o as THREE.Mesh).material as THREE.MeshLambertMaterial | undefined;
      if (!m) return;
      m.opacity = W === "rain" ? .95 : W === "cloudy" ? .92 : .55;
      m.color.set(W === "rain" ? (night ? 0x4A5468 : 0x9EA6A8) : 0xFFFFFF).convertSRGBToLinear();
    }));
    this.glowL.intensity = night ? 1.1 : 0;
    /* house windows glow at night */
    this.itemsG.traverse(o => {
      const win = (o as THREE.Group).userData?.homeWindow as THREE.Mesh | undefined;
      if (win) ((win.material) as THREE.MeshLambertMaterial).emissiveIntensity = night ? .8 : 0;
    });
  }

  private makeGhost(g0: PlacedItem): THREE.Group {
    const a = byId(g0.id), f = itemFootprint(g0);
    const g = B3[g0.id] ? B3[g0.id]() : new THREE.Group();
    let lj = 0;
    g.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (mesh.material) {
        mesh.material = (mesh.material as THREE.Material).clone();
        (mesh.material as THREE.Material).transparent = true;
        (mesh.material as THREE.Material).opacity = .55;
        if (this.season === "autumn" && o.name === "leaf")
          (mesh.material as THREE.MeshLambertMaterial).color.copy(linC(C3.fall[(lj++ * 3) % C3.fall.length]));
      }
    });
    g.rotation.y = -g0.rot * Math.PI / 2;
    const wrap = new THREE.Group();
    wrap.add(g);
    const ring = new THREE.Mesh(new THREE.RingGeometry(.55 * Math.max(f.w, f.d), .62 * Math.max(f.w, f.d), 28),
      new THREE.MeshBasicMaterial({ color: linC(0x9C4F76), transparent: true, opacity: .8, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = .03;
    ring.name = "ring";
    wrap.add(ring);
    wrap.position.set(WCX(g0.x, f.w), .01, WCZ(g0.y, f.d));
    void a;
    return wrap;
  }

  sync(): void {
    const S = this.cb.getState();
    /* rebuild the main island when a land expansion was raised */
    const lk = S.lands.join(",");
    if (lk !== this.landKey) {
      this.landKey = lk;
      while (this.tilesG.children.length) this.tilesG.remove(this.tilesG.children[0]);
      const m = mainMask(S);
      this.buildTiles(m, this.tilesG);
      this.computeGrassSpots(m);
    }
    this.applyPhase();
    while (this.itemsG.children.length) this.itemsG.remove(this.itemsG.children[0]);
    this.canopies = [];
    S.placed.forEach((p, i) => {
      if (!B3[p.id]) return;
      const a = byId(p.id);
      const f = itemFootprint(p);
      const g = B3[p.id]();
      g.rotation.y = -p.rot * Math.PI / 2;
      const wrap = new THREE.Group();
      wrap.add(g);
      wrap.position.set(WCX(p.x, f.w), 0, WCZ(p.y, f.d));
      wrap.userData.pidx = i;
      wrap.userData.id = p.id;
      if (a.cat === "plants") {
        wrap.userData.sway = (p.x * 3 + p.y) % 6;
        wrap.scale.setScalar(.62 + .19 * Math.min(2, p.stage ?? 0));
      }
      const dec = g.userData.deciduous as { h: number } | undefined;
      if (dec) {
        const sc = wrap.scale.x;
        this.canopies.push({ x: WCX(p.x, f.w), z: WCZ(p.y, f.d), h: dec.h * sc + .12, r: .4 * sc });
      }
      if (g.userData.fire) wrap.userData.fire = true;
      if (g.userData.yarn) wrap.userData.yarn = true;
      if (g.userData.homeWindow) wrap.userData.homeWindow = g.userData.homeWindow;
      if (g.userData.smoke) wrap.userData.smoke = g.userData.smoke;
      this.itemsG.add(wrap);
    });
    if (this.popQueue) {
      for (let i = this.itemsG.children.length - 1; i >= 0; i--) {
        const w = this.itemsG.children[i];
        if (w.userData.id === this.popQueue) {
          w.userData.popT = 0;
          w.userData.baseScale = w.scale.x;
          break;
        }
      }
      this.popQueue = null;
    }
    if (!this.isletAnim) this.isletTilesG.position.y = S.bridge ? 0 : -2.2;
    this.isletTilesG.visible = S.bridge || !!this.isletAnim;
    this.bridgeG.visible = S.bridge;
    while (this.ghostG.children.length) this.ghostG.remove(this.ghostG.children[0]);
    if (this.opts.ghost) this.ghostG.add(this.makeGhost(this.opts.ghost));
    while (this.gridG.children.length) this.gridG.remove(this.gridG.children[0]);
    if (this.opts.highlight) {
      S.placed.forEach(p => {
        const f = itemFootprint(p);
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(.5 * Math.max(f.w, f.d), .58 * Math.max(f.w, f.d), 26),
          new THREE.MeshBasicMaterial({ color: linC(0x9C4F76), transparent: true, opacity: .7, side: THREE.DoubleSide }));
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(WCX(p.x, f.w), .04, WCZ(p.y, f.d));
        ring.userData.pulse = (p.x * 3 + p.y) % 6;
        this.gridG.add(ring);
      });
    }
    if (this.opts.grid && this.opts.ghost) {
      for (let x = 0; x < GW; x++) for (let y = 0; y < GH; y++) {
        if (!placeOK(S, x, y)) continue;
        const pl = new THREE.Mesh(new THREE.PlaneGeometry(.85, .85),
          new THREE.MeshBasicMaterial({ color: linC(0x8FB07A), transparent: true, opacity: .38, side: THREE.DoubleSide }));
        pl.rotation.x = -Math.PI / 2;
        pl.position.set(WCX(x), .02, WCZ(y));
        this.gridG.add(pl);
      }
    }
    const kind = this.opts.previewPet ?? S.pet;
    if (kind !== this.petKind) {
      this.petKind = kind;
      while (this.petRoot.children.length) this.petRoot.remove(this.petRoot.children[0]);
      this.petBody = buildPet(kind);
      this.petBody.scale.setScalar(1.15);
      this.petRoot.add(this.petBody);
    }
    const warm = S.placed.find(p => p.id === "campfire" || p.id === "lantern") ?? S.placed.find(p => p.id === "house");
    if (warm) {
      const f = itemFootprint(warm);
      this.glowL.position.set(WCX(warm.x, f.w), 1, WCZ(warm.y, f.d));
    }
    this.applyAutumnTint();
  }

  /* lerp deciduous foliage from summer green toward its turn color;
     each tree turns on a slightly different clock */
  private applyAutumnTint(): void {
    if (this.season !== "autumn") return;
    this.itemsG.children.forEach(wrap => {
      const pidx = (wrap.userData.pidx as number) ?? 0;
      const k = Math.min(1, Math.max(0, this.autumnK * 1.5 - ((pidx * 7) % 4) * .12));
      let j = 0;
      wrap.traverse(o => {
        if (o.name !== "leaf") return;
        const m = (o as THREE.Mesh).material as THREE.MeshLambertMaterial;
        if (!o.userData.c0) o.userData.c0 = m.color.clone();
        const target = linC(C3.fall[(pidx * 5 + j * 3) % C3.fall.length]);
        m.color.copy(o.userData.c0 as THREE.Color).lerp(target, k);
        j++;
      });
    });
  }

  /** does a world x/z sit over an island tile (else it's open water)? */
  private overLand(x: number, z: number): boolean {
    const k = Math.round(x + 5) + "," + Math.round(z + 5.6);
    try {
      const S = this.cb.getState();
      if (mainMask(S).has(k)) return true;
      if (S.bridge && (MASKS.islet.has(k) || BRIDGE_TILES.includes(k))) return true;
      return false;
    } catch { return MASKS.main.has(k); /* pre-init */ }
  }

  private setLeafM(i: number): void {
    const st = this.leafSt[i], dum = this.leafDummy;
    dum.position.set(st.x, st.y, st.z);
    dum.rotation.set(st.rx, st.ry, st.rz);
    dum.scale.setScalar(Math.max(.0001, st.sc));
    dum.updateMatrix();
    this.leafIM!.setMatrixAt(i, dum.matrix);
  }

  private spawnLeaf(cx: number, cz: number, h: number, r: number, impulse = 0): void {
    const cf = this.pconf!;
    const idx = this.leafFree.pop();
    if (idx === undefined) {
      /* pool exhausted: fade the oldest resting leaf, spawn again later */
      const old = this.settledQ.shift();
      if (old !== undefined && this.leafSt[old].ph === 2) this.leafSt[old].ph = 3;
      return;
    }
    const st = this.leafSt[idx], W = curWeather();
    st.ph = 1;
    st.x = cx + (Math.random() - .5) * 2 * r;
    st.y = h + Math.random() * .3;
    st.z = cz + (Math.random() - .5) * 2 * r;
    st.rx = Math.random() * 3; st.ry = Math.random() * 3; st.rz = Math.random() * 3;
    st.vy = cf.vy + Math.random() * cf.vyR + (W === "rain" ? cf.rainVy : 0);
    const ia = Math.random() * 6.28;
    st.vx = Math.cos(ia) * impulse * (.6 + Math.random() * .8);
    st.vz = Math.sin(ia) * impulse * (.6 + Math.random() * .8);
    st.spinX = (Math.random() - .5) * 4; st.spinZ = (Math.random() - .5) * 4;
    st.wph = Math.random() * 6.28; st.swf = 1.2 + Math.random() * 1.4;
    st.age = 0; st.sc = 1; st.water = false;
    this.setLeafM(idx);
  }

  private updateLeaves(dt: number, t: number): void {
    const cf = this.pconf!;
    const W = curWeather();
    /* the island's own deciduous trees set how much can fall */
    const most = cf.needTrees
      ? (this.canopies.length ? Math.min(cf.want[W], 8 + this.canopies.length * 14) : 0)
      : cf.want[W];
    const want = this.autumnK >= cf.gate ? most : 0;
    const wind = W === "cloudy" ? .55 : W === "rain" ? .12 : .25;
    let airborne = 0;
    this.leafSt.forEach(s => { if (s.ph === 1) airborne++; });
    if (airborne < want && Math.random() < dt * .35 * (want - airborne)) {
      /* shed from a real canopy, or drift in high on the wind */
      const c = this.canopies.length && Math.random() < cf.treeShare
        ? this.canopies[Math.floor(Math.random() * this.canopies.length)]
        : { ...this.grassSpots[Math.floor(Math.random() * this.grassSpots.length)], h: 2.2 + Math.random() * 1.4, r: .45 };
      this.spawnLeaf(c.x, c.z, c.h, c.r);
    }
    let dirty = false;
    for (let i = 0; i < this.leafSt.length; i++) {
      const st = this.leafSt[i];
      if (st.ph === 0) continue;
      if (st.ph === 1) {
        st.y -= st.vy * dt;
        st.x += (wind + Math.sin(t * st.swf + st.wph) * cf.sway + st.vx) * dt;
        st.z += (Math.cos(t * .6 + st.wph) * .2 + st.vz) * dt;
        const dec = Math.pow(.25, dt);
        st.vx *= dec; st.vz *= dec;
        st.rx += st.spinX * dt; st.rz += st.spinZ * dt;
        const floor = this.overLand(st.x, st.z) ? .045 : -.26;
        if (st.y <= floor) {
          st.y = floor;
          st.rx = -Math.PI / 2 + (Math.random() - .5) * .25;
          st.ry = 0;
          st.rz = Math.random() * 6.28;
          st.ph = 2; st.age = 0;
          if (floor < 0) {
            st.water = true;
            this.addRipple(st.x, st.z, .45);
            this.fluid?.splat(st.x, st.z, 0, 0, .4);
          }
          this.settledQ.push(i);
          while (this.settledQ.length > cf.carpet) {
            const old = this.settledQ.shift()!;
            if (this.leafSt[old].ph === 2) this.leafSt[old].ph = 3;
          }
        }
        this.setLeafM(i); dirty = true;
      } else if (st.ph === 2) {
        st.age += dt;
        if (st.age > (st.water ? 6 : cf.life)) st.ph = 3;
      } else {
        st.sc -= dt * 1.6;
        if (st.sc <= 0) {
          st.ph = 0; st.sc = 0;
          this.leafFree.push(i);
          const dum = this.leafDummy;
          dum.position.set(0, -50, 0); dum.rotation.set(0, 0, 0); dum.scale.setScalar(.0001);
          dum.updateMatrix();
          this.leafIM!.setMatrixAt(i, dum.matrix);
        } else this.setLeafM(i);
        dirty = true;
      }
    }
    if (dirty) this.leafIM!.instanceMatrix.needsUpdate = true;
  }

  /** tap a tree: shake it, shed a burst of leaves, push nearby airborne ones */
  burstLeaves(pidx: number): boolean {
    if (!this.pconf || !this.leafIM) return false;
    const wrap = this.itemsG.children.find(w => w.userData.pidx === pidx);
    if (!wrap) return false;
    const g = wrap.children[0] as THREE.Group | undefined;
    const dec = g?.userData.deciduous as { h: number } | undefined;
    const h = (dec?.h ?? 1.2) * wrap.scale.x + .15;
    const n = 10 + Math.floor(Math.random() * 6);
    for (let i = 0; i < n; i++)
      this.spawnLeaf(wrap.position.x, wrap.position.z, h * (.7 + Math.random() * .5), .35 * wrap.scale.x + .1, 1.4);
    this.leafSt.forEach(st => {
      if (st.ph !== 1) return;
      const dx = st.x - wrap.position.x, dz = st.z - wrap.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.6 && d > .01) { st.vx += dx / d * 1.2; st.vz += dz / d * 1.2; }
    });
    wrap.userData.shakeT = 1;
    return true;
  }

  /** the companion crouches at the shore and laps at this water spot */
  petDrink(x: number, z: number): void {
    petView.mode = "drink";
    petView.modeT = 3.2;
    this.drinkSpot = { x, z };
    this.drinkTick = .3;
  }

  /** spreading ring on the water at world x/z */
  addRipple(x: number, z: number, s = 1): void {
    if (!this.seaMat) return;
    this.ripples.push({ x, z, t0: this.t, s });
    if (this.ripples.length > 8) this.ripples.shift();
    const arr = this.seaMat.uniforms.uRipples.value as THREE.Vector4[];
    for (let i = 0; i < 8; i++) {
      const r = this.ripples[i];
      arr[i].set(r ? r.x : 0, r ? r.z : 0, r ? r.t0 : -99, r ? r.s : 0);
    }
  }

  private updateFireflies(t: number): void {
    if (!this.firefliesG.visible) return;
    this.firefliesG.children.forEach(f => {
      const d = f.userData.fly as { bx: number; bz: number; ph: number; f1: number; f2: number; amp: number };
      f.position.set(
        d.bx + Math.sin(t * d.f1 + d.ph) * d.amp,
        .45 + .35 * Math.sin(t * .8 + d.ph * 2),
        d.bz + Math.cos(t * d.f2 + d.ph) * d.amp * .8);
      ((f as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = .25 + .65 * Math.abs(Math.sin(t * 1.4 + d.ph * 3));
    });
  }

  private updateShooting(dt: number): void {
    if (this.shootT < 0) {
      const ok = this.season === "winter" && curPhase() === "night" && curWeather() === "clear";
      if (!ok || Math.random() > dt / 14) return;
      this.shootT = 0;
      this.shootPts.position.set(-2 + Math.random() * 10, 8 + Math.random() * 2.5, -9);
      this.shootV.set(-4.5, -2.2, 0);
      const a = this.shootPts.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < 6; i++) a.setXYZ(i, i * .22, i * .11, 0); /* trail behind the head */
      a.needsUpdate = true;
      this.shootPts.visible = true;
    }
    this.shootT += dt;
    this.shootPts.position.addScaledVector(this.shootV, dt);
    (this.shootPts.material as THREE.PointsMaterial).opacity = Math.sin(Math.PI * Math.min(1, this.shootT / 1.1));
    if (this.shootT > 1.1) { this.shootT = -1; this.shootPts.visible = false; }
  }

  /** test/debug hook */
  get seasonInfo(): { season: Season; autumn: boolean; k: number; leaves: number; carpet: number; ripples: number; fireflies: boolean; fluid: number; splats: number; tiles: number } {
    let air = 0, carpet = 0;
    this.leafSt.forEach(s => { if (s.ph === 1) air++; else if (s.ph === 2) carpet++; });
    return {
      tiles: this.tilesG ? this.tilesG.children.filter(m => m.userData.tile).length : 0,
      season: this.season, autumn: this.season === "autumn", k: this.autumnK,
      leaves: air, carpet,
      ripples: this.ripples.filter(r => this.t - r.t0 < 2.4).length,
      fireflies: !!this.firefliesG?.visible,
      fluid: this.fluid ? this.fluid.frames : -1,
      splats: this.fluid ? this.fluid.splats : -1,
    };
  }

  /* ---------- input: drag = orbit, pinch/wheel = zoom, quick tap = interact ---------- */
  private onPointerDown(ev: PointerEvent): void {
    this.canvas.setPointerCapture(ev.pointerId);
    this.pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (this.pointers.size === 1) {
      this.drag = { x: ev.clientX, y: ev.clientY, sx: ev.clientX, sy: ev.clientY, moved: false, t: performance.now() };
      this.pinch = null;
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: this.camZoom };
      this.drag = null;
    }
  }

  /** moving the pointer over open water stirs the fluid under it */
  private hoverSplat(ev: PointerEvent): void {
    if (!this.fluid) return;
    const last = this.lastSplat;
    if (last && Math.hypot(ev.clientX - last.sx, ev.clientY - last.sy) < 6) return;
    const r = this.canvas.getBoundingClientRect();
    this.ndc.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    this.ndc.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    this.ray.setFromCamera(this.ndc, this.camera);
    const land = this.ray.intersectObjects(
      [...this.tilesG.children, ...this.itemsG.children], true);
    if (land.length) { this.lastSplat = null; return; }
    const hit = this.ray.intersectObject(this.seaMesh, false);
    if (!hit.length) { this.lastSplat = null; return; }
    const p = hit[0].point;
    if (last) {
      const dx = p.x - last.x, dz = p.z - last.z;
      const len = Math.hypot(dx, dz);
      if (len > .02 && len < 6) this.fluid.splat(p.x, p.z, dx, dz, Math.min(.9, len * .7));
    }
    this.lastSplat = { sx: ev.clientX, sy: ev.clientY, x: p.x, z: p.z };
  }

  private onPointerMove(ev: PointerEvent): void {
    this.hoverSplat(ev);
    if (!this.pointers.has(ev.pointerId)) return;
    this.pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (this.pinch && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      this.setZoom(this.pinch.z0 * (Math.hypot(a.x - b.x, a.y - b.y) / this.pinch.d0));
      return;
    }
    if (this.drag) {
      const dx = ev.clientX - this.drag.x, dy = ev.clientY - this.drag.y;
      this.drag.x = ev.clientX; this.drag.y = ev.clientY;
      if (Math.hypot(ev.clientX - this.drag.sx, ev.clientY - this.drag.sy) > 7) this.drag.moved = true;
      if (this.drag.moved) {
        this.camTheta -= dx * .006;
        this.camPhi = Math.min(1.15, Math.max(.28, this.camPhi + dy * .004));
      }
    }
  }

  private onPointerUp(ev: PointerEvent, cancelled = false): void {
    const wasTap = this.drag && !this.drag.moved && performance.now() - this.drag.t < 400 && !cancelled;
    this.pointers.delete(ev.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    if (this.pointers.size === 0) this.drag = null;
    if (wasTap) this.tapAt(ev.clientX, ev.clientY);
  }

  /** project a tile center to client coordinates (used by tests) */
  screenOfTile(x: number, y: number): { x: number; y: number } {
    const v = new THREE.Vector3(WCX(x), .3, WCZ(y));
    v.project(this.camera);
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - (v.y + 1) / 2) * r.height };
  }

  /** camera debug/test hook */
  get cameraPose(): { theta: number; phi: number; zoom: number } {
    return { theta: this.camTheta, phi: this.camPhi, zoom: this.camZoom };
  }

  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private tapAt(clientX: number, clientY: number): void {
    const ev = { clientX, clientY };
    const r = this.canvas.getBoundingClientRect();
    this.ndc.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    this.ndc.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    this.ray.setFromCamera(this.ndc, this.camera);
    const petHit = this.ray.intersectObject(this.petRoot, true);
    if (petHit.length) { this.cb.onTapPet(ev.clientX, ev.clientY); return; }
    const itemHit = this.ray.intersectObject(this.itemsG, true);
    if (itemHit.length) {
      let o: THREE.Object3D | null = itemHit[0].object;
      while (o && o.userData.pidx === undefined) o = o.parent;
      if (o) { this.cb.onTapItem(o.userData.pidx as number); return; }
    }
    const S = this.cb.getState();
    const tileHit = this.ray.intersectObjects(
      [...this.tilesG.children, ...(S.bridge ? this.isletTilesG.children : [])], false);
    if (tileHit.length) {
      const { x, y } = tileHit[0].object.userData.tile as { x: number; y: number };
      this.cb.onTapTile(x, y);
      return;
    }
    const seaHit = this.ray.intersectObject(this.seaMesh, false);
    if (seaHit.length) {
      this.addRipple(seaHit[0].point.x, seaHit[0].point.z, 1);
      this.fluid?.splat(seaHit[0].point.x, seaHit[0].point.z, 0, 0, 1.1);
    }
  }

  private computeGrassSpots(mask: Set<string>): void {
    this.grassSpots = [];
    mask.forEach(k => {
      const [x, y] = k.split(",").map(Number);
      if (!isBeachIn(mask, x, y)) this.grassSpots.push({ x: WCX(x), z: WCZ(y) });
    });
  }

  /** a bought/gifted land patch rises from the sea with a splash */
  revealLand(id: string): void {
    const def = LANDS[id];
    if (!def) return;
    this.landAnim = { keys: new Set(def.tiles.map(([x, y]) => x + "," + y)), t: 0 };
    def.tiles.forEach(([x, y]) => {
      this.addRipple(WCX(x), WCZ(y), .5);
      this.fluid?.splat(WCX(x), WCZ(y), 0, 0, .6);
    });
  }

  revealIslet(): void {
    this.isletAnim = { t: 0 };
    this.isletTilesG.visible = true;
    this.bridgeG.visible = true;
    this.bridgeG.children.forEach((p, i) => { p.position.y = 2 + i; p.userData.drop = true; });
  }

  walkPath(tiles: { x: number; y: number }[], done?: () => void): void {
    petView.path = tiles;
    petView.seg = 0;
    petView.prog = 0;
    petView.done = done ?? null;
    petView.napping = false;
  }

  setYarnWobble(sec: number): void { this.yarnWobble = sec; }

  /* ---------- loop ---------- */
  private loop(now: number): void {
    const dt = Math.min(.05, (now - this.lastT) / 1000);
    this.lastT = now;
    this.t += dt;
    const t = this.t;
    this.petAnim(dt);
    this.waves.forEach(w => {
      const s = 1 + .025 * Math.sin(t * 1.1 + (w.userData.ph as number));
      w.scale.set(s, s, 1);
      (w.material as THREE.MeshBasicMaterial).opacity = .18 + .12 * Math.sin(t * 1.1 + (w.userData.ph as number));
    });
    this.cloudsG.children.forEach((c, i) => {
      c.position.x += dt * (.12 + i * .05);
      if (c.position.x > 12) c.position.x = -12;
    });
    if (this.rainPts.visible) {
      const a = this.rainPts.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < a.count; i++) {
        let y = a.getY(i) - dt * 7;
        if (y < -.4) y = 6.5;
        a.setY(i, y);
      }
      a.needsUpdate = true;
      /* drops pepper the sea with little stirs */
      if (Math.random() < dt * 6) {
        const ang = Math.random() * 6.28, rad = 6.2 + Math.random() * 4.5;
        const rx = Math.cos(ang) * rad, rz = Math.sin(ang) * rad - .6;
        if (!this.overLand(rx, rz)) {
          this.fluid?.splat(rx, rz, 0, 0, .2);
          if (Math.random() < .22) this.addRipple(rx, rz, .22);
        }
      }
    }
    /* lapping at the shore: rhythmic little stirs where the pet drinks */
    if (petView.mode === "drink" && this.drinkSpot) {
      this.drinkTick -= dt;
      if (this.drinkTick <= 0) {
        this.drinkTick = .8;
        this.addRipple(this.drinkSpot.x, this.drinkSpot.z, .3);
        this.fluid?.splat(this.drinkSpot.x, this.drinkSpot.z, 0, 0, .35);
      }
    } else this.drinkSpot = null;
    if (this.starPts.visible)
      (this.starPts.material as THREE.PointsMaterial).opacity = .65 + .3 * Math.sin(t * 1.7);
    this.itemsG.children.forEach(w => {
      if (w.userData.popT !== undefined) {
        w.userData.popT += dt;
        const k = Math.min(1, (w.userData.popT as number) / .55);
        const c = 1.70158;
        const e = k === 1 ? 1 : 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2);
        w.scale.setScalar((w.userData.baseScale as number) * Math.max(.15, e));
        if (k >= 1) { w.scale.setScalar(w.userData.baseScale as number); delete w.userData.popT; }
      }
      if ((w.userData.shakeT as number | undefined) !== undefined && (w.userData.shakeT as number) > 0)
        w.userData.shakeT = Math.max(0, (w.userData.shakeT as number) - dt);
      const shake = ((w.userData.shakeT as number) || 0) > 0
        ? Math.sin(t * 26) * .09 * (w.userData.shakeT as number) : 0;
      if (w.userData.sway !== undefined)
        w.rotation.z = Math.sin(t * 1.1 + (w.userData.sway as number)) * .025 + shake;
      else if (shake) w.rotation.z = shake;
      if (w.userData.fire) (w.children[0] as THREE.Group).children.forEach(m => {
        if (m.name === "flame") m.scale.y = 1 + .18 * Math.sin(t * 11 + m.position.x * 9);
      });
      if (w.userData.smoke) (w.userData.smoke as THREE.Group).children.forEach((p, i) => {
        const ph = (t * .2 + i * .37) % 1;
        p.position.y = ph * .55;
        p.position.x = Math.sin(t * 1.2 + i * 2.1) * .045;
        p.scale.setScalar(.45 + ph * .95);
        ((p as THREE.Mesh).material as THREE.MeshLambertMaterial).opacity = .45 * (1 - ph);
      });
      if (w.userData.yarn && this.yarnWobble > 0) {
        w.rotation.z = Math.sin(t * 14) * .3;
        w.position.y = Math.abs(Math.sin(t * 14)) * .06;
      } else if (w.userData.yarn) { w.rotation.z = 0; w.position.y = 0; }
    });
    if (this.yarnWobble > 0) this.yarnWobble -= dt;
    this.gridG.children.forEach(r => {
      if (r.userData.pulse !== undefined)
        ((r as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = .4 + .3 * Math.sin(t * 4 + (r.userData.pulse as number));
    });
    const ghost = this.ghostG.children[0] as THREE.Group | undefined;
    const ring = ghost?.getObjectByName("ring") as THREE.Mesh | undefined;
    if (ring) (ring.material as THREE.MeshBasicMaterial).opacity = .45 + .35 * Math.sin(t * 4);
    if (this.landAnim) {
      this.landAnim.t += dt;
      const k = Math.min(1, this.landAnim.t / 1.4);
      const e = 1 - Math.pow(1 - k, 3);
      this.tilesG.children.forEach(m => {
        const tl = m.userData.tile as { x: number; y: number } | undefined;
        if (tl && this.landAnim!.keys.has(tl.x + "," + tl.y))
          m.position.y = -.45 - 2.4 * (1 - e);
      });
      if (k >= 1) {
        this.tilesG.children.forEach(m => {
          const tl = m.userData.tile as { x: number; y: number } | undefined;
          if (tl && this.landAnim!.keys.has(tl.x + "," + tl.y)) m.position.y = -.45;
        });
        this.landAnim = null;
      }
    }
    if (this.isletAnim) {
      this.isletAnim.t += dt;
      const k = Math.min(1, this.isletAnim.t / 1.4);
      const e = 1 - Math.pow(1 - k, 3);
      this.isletTilesG.position.y = -2.2 + 2.2 * e;
      this.bridgeG.children.forEach(p => { if (p.userData.drop) p.position.y = Math.max(0, 2 * (1 - e * 1.3)); });
      if (k >= 1) {
        this.isletAnim = null;
        this.isletTilesG.position.y = 0;
        this.bridgeG.children.forEach(p => (p.position.y = 0));
      }
    }
    if (this.season === "autumn") {
      if (this.turnDelay > 0) this.turnDelay -= dt;
      else if (this.autumnK < 1) {
        this.autumnK = Math.min(1, this.autumnK + dt / 5);
        this.applyAutumnTint();
      }
    }
    if (this.pconf && this.leafIM) this.updateLeaves(dt, t);
    this.updateFireflies(t);
    this.updateShooting(dt);
    if (this.seaMat) this.seaMat.uniforms.uTime.value = t;
    if (this.fluid) {
      this.fluid.step(dt);
      this.seaMat.uniforms.uFluid.value = this.fluid.dyeTex;
      this.seaMat.uniforms.uFluidVel.value = this.fluid.velTex;
    }
    this.frameCamera();
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(n => this.loop(n));
  }

  private petAnim(dt: number): void {
    const pv = petView, t = this.t;
    if (pv.modeT > 0) {
      pv.modeT -= dt;
      if (pv.modeT <= 0) pv.mode = "idle";
    }
    if (pv.path && pv.path.length > 1) {
      pv.prog += dt * 2.3;
      while (pv.prog >= 1 && pv.seg < pv.path.length - 2) { pv.prog -= 1; pv.seg++; }
      const a = pv.path[pv.seg], b = pv.path[Math.min(pv.seg + 1, pv.path.length - 1)];
      const k = Math.min(1, pv.prog);
      pv.x = a.x + (b.x - a.x) * k;
      pv.y = a.y + (b.y - a.y) * k;
      pv.face = Math.atan2(b.x - a.x, b.y - a.y);
      if (pv.seg >= pv.path.length - 2 && k >= 1) {
        const done = pv.done;
        pv.path = null; pv.done = null;
        if (done) done();
      }
    }
    if (!this.petBody) return;
    this.petRoot.position.set(pv.x - 5, 0, pv.y - 5.6);
    this.petRoot.rotation.y = pv.face;
    const walking = !!pv.path;
    const nap = pv.napping && !walking;
    const bob = walking ? Math.abs(Math.sin(t * 12)) * .07
      : pv.mode === "happy" ? Math.abs(Math.sin(t * 9)) * .16
      : Math.sin(t * 2.4) * .015;
    this.petBody.position.y = bob + (nap ? -.12 : 0);
    this.petBody.scale.y = (nap ? .82 : 1) * 1.15;
    /* diagonal leg pairs swing while walking; folded into a loaf for naps */
    const sw = walking ? Math.sin(t * 12) * .6 : 0;
    const setLeg = (n: string, r: number) => {
      const l = this.petBody!.getObjectByName(n);
      if (l) l.rotation.x = r;
    };
    setLeg("legFL", nap ? 1.25 : sw); setLeg("legBR", nap ? -1.25 : sw);
    setLeg("legFR", nap ? 1.25 : -sw); setLeg("legBL", nap ? -1.25 : -sw);
    const tail = this.petBody.getObjectByName("tail");
    if (tail) tail.rotation.z = Math.sin(t * (walking ? 10 : pv.mode === "happy" ? 12 : 3)) * .35;
    const head = this.petBody.getObjectByName("head");
    if (head) head.rotation.x = pv.mode === "drink" && !walking
      ? .55 + .1 * Math.sin(t * 5)
      : pv.napping && !walking ? .35 : 0;
  }

  /* ---------- shop thumbnails ---------- */
  thumb(id: string): string {
    if (this.thumbCache[id]) return this.thumbCache[id];
    if (!this.thumbR) {
      this.thumbR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      this.thumbR.outputEncoding = THREE.sRGBEncoding;
      this.thumbR.toneMapping = THREE.ACESFilmicToneMapping;
      this.thumbR.toneMappingExposure = 1;
      this.thumbR.setSize(120, 120);
    }
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xffffff, 0xA8987F, 1.05));
    const dl = new THREE.DirectionalLight(0xfff6e0, .8);
    dl.position.set(3, 5, 2);
    sc.add(dl);
    const g = id === "pet-cat" || id === "pet-dog"
      ? buildPet(id.slice(4) as PetKind)
      : id.startsWith("land-") ? landThumb()
      : B3[id] ? B3[id]() : new THREE.Group();
    if (isAutumn()) {
      let j = 0;
      g.traverse(o => {
        if (o.name === "leaf")
          ((o as THREE.Mesh).material as THREE.MeshLambertMaterial).color.copy(linC(C3.fall[(j++ * 3) % C3.fall.length]));
      });
    }
    sc.add(g);
    const bb = new THREE.Box3().setFromObject(g);
    const size = bb.getSize(new THREE.Vector3()), ctr = bb.getCenter(new THREE.Vector3());
    const half = Math.max(size.x, size.y, size.z) * .62 + .12;
    const cam = new THREE.OrthographicCamera(-half, half, half, -half, .1, 50);
    cam.position.set(ctr.x + 3, ctr.y + 2.6, ctr.z + 3);
    cam.lookAt(ctr);
    this.thumbR.render(sc, cam);
    const url = this.thumbR.domElement.toDataURL("image/png");
    this.thumbCache[id] = url;
    return url;
  }
}

export const world = new World();
