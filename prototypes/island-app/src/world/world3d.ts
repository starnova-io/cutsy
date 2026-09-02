import * as THREE from "three";
import { B3, buildPet, box3, grp3 } from "./builders";
import { C3, PH3 } from "./palette";
import { GW, GH, MASKS, BRIDGE_TILES, WCX, WCZ, isBeach, placeOK } from "./island";
import { curPhase, curWeather } from "../game/weather";
import { byId } from "../game/catalog";
import { itemFootprint } from "../game/economy";
import type { GameState, PetKind, PlacedItem } from "../game/types";

export interface WorldOpts {
  ghost?: PlacedItem | null;
  grid?: boolean;
  previewPet?: PetKind | null;
}

export interface WorldCallbacks {
  getState(): GameState;
  onTapPet(clientX: number, clientY: number): void;
  onTapItem(pidx: number): void;
  onTapTile(x: number, y: number): void;
}

/* live pet pose, driven by the animation loop */
export const petView = {
  x: 6, y: 5, face: 0, mode: "idle" as "idle" | "happy",
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
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.canvas = this.renderer.domElement;
    this.canvas.style.cssText = "width:100%;height:100%;display:block;touch-action:none;";
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 100);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0xA8987F, 1);
    this.scene.add(this.hemi);
    this.sunL = new THREE.DirectionalLight(0xfff6e0, .9);
    this.sunL.castShadow = true;
    this.sunL.shadow.mapSize.set(1024, 1024);
    const sc = this.sunL.shadow.camera;
    sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -9;
    this.scene.add(this.sunL);
    this.glowL = new THREE.PointLight(0xFFB868, 0, 7);
    this.scene.add(this.glowL);

    this.seaMesh = new THREE.Mesh(new THREE.CircleGeometry(30, 40),
      new THREE.MeshLambertMaterial({ color: C3.water.day }));
    this.seaMesh.rotation.x = -Math.PI / 2;
    this.seaMesh.position.y = -.3;
    this.seaMesh.receiveShadow = true;
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
      new THREE.PointsMaterial({ color: 0xAAC0D8, size: .07, transparent: true, opacity: .7 }));
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
      new THREE.PointsMaterial({ color: 0xFFF4D8, size: .09, transparent: true, opacity: .9 }));
    this.scene.add(this.starPts);

    const cel = new THREE.Mesh(new THREE.SphereGeometry(.55, 14, 12),
      new THREE.MeshLambertMaterial({ color: 0xFFE9B0 }));
    (cel.material as THREE.MeshLambertMaterial).emissive = new THREE.Color(0xFFE9B0);
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

  private buildTiles(mask: Set<string>, into: THREE.Group): void {
    mask.forEach(k => {
      const [x, y] = k.split(",").map(Number);
      const top = isBeach(x, y) ? C3.sand : C3.grass[(x * 7 + y * 13) % 3];
      const side = new THREE.MeshLambertMaterial({ color: C3.dirt });
      const sideD = new THREE.MeshLambertMaterial({ color: C3.dirtD });
      const mats = [side, sideD, new THREE.MeshLambertMaterial({ color: top }), sideD, side, sideD];
      const m = new THREE.Mesh(new THREE.BoxGeometry(.98, .9, .98), mats);
      m.position.set(WCX(x), -.45, WCZ(y));
      m.receiveShadow = true;
      m.userData.tile = { x, y };
      into.add(m);
    });
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
    try { base = this.cb.getState().bridge ? 6.35 : 5.7; } catch { /* pre-init */ }
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
    this.scene.background = new THREE.Color(W === "rain" && !night ? 0xB9C2C4 : P.sky);
    this.hemi.color.set(P.hemi); this.hemi.groundColor.set(P.ground);
    this.hemi.intensity = P.hInt * (W === "rain" ? .8 : 1);
    this.sunL.color.set(P.sun);
    this.sunL.intensity = P.int * (W === "rain" ? .55 : W === "cloudy" ? .8 : 1);
    this.sunL.position.set(...P.dir);
    (this.seaMesh.material as THREE.MeshLambertMaterial).color.set(C3.water[curPhase()]);
    this.celestial.visible = W !== "rain";
    const cm = this.celestial.material as THREE.MeshLambertMaterial;
    cm.color.set(night ? 0xE8EEF8 : 0xFFE9B0);
    cm.emissive.set(night ? 0xC9D6EE : 0xFFE9B0);
    this.celestial.position.set(night ? 7 : -8, 7.2, -7);
    this.starPts.visible = night;
    this.rainPts.visible = W === "rain";
    this.cloudsG.children.forEach(c => c.traverse(o => {
      const m = (o as THREE.Mesh).material as THREE.MeshLambertMaterial | undefined;
      if (!m) return;
      m.opacity = W === "rain" ? .95 : W === "cloudy" ? .92 : .55;
      m.color.set(W === "rain" ? (night ? 0x4A5468 : 0x9EA6A8) : 0xFFFFFF);
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
    g.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (mesh.material) {
        mesh.material = (mesh.material as THREE.Material).clone();
        (mesh.material as THREE.Material).transparent = true;
        (mesh.material as THREE.Material).opacity = .55;
      }
    });
    g.rotation.y = -g0.rot * Math.PI / 2;
    const wrap = new THREE.Group();
    wrap.add(g);
    const ring = new THREE.Mesh(new THREE.RingGeometry(.55 * Math.max(f.w, f.d), .62 * Math.max(f.w, f.d), 28),
      new THREE.MeshBasicMaterial({ color: 0x9C4F76, transparent: true, opacity: .8, side: THREE.DoubleSide }));
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
    this.applyPhase();
    while (this.itemsG.children.length) this.itemsG.remove(this.itemsG.children[0]);
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
      if (g.userData.fire) wrap.userData.fire = true;
      if (g.userData.yarn) wrap.userData.yarn = true;
      if (g.userData.homeWindow) wrap.userData.homeWindow = g.userData.homeWindow;
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
    if (this.opts.grid && this.opts.ghost) {
      for (let x = 0; x < GW; x++) for (let y = 0; y < GH; y++) {
        if (!placeOK(S, x, y)) continue;
        const pl = new THREE.Mesh(new THREE.PlaneGeometry(.85, .85),
          new THREE.MeshBasicMaterial({ color: 0x8FB07A, transparent: true, opacity: .38, side: THREE.DoubleSide }));
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

  private onPointerMove(ev: PointerEvent): void {
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
    }
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
    }
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
      if (w.userData.sway !== undefined) w.rotation.z = Math.sin(t * 1.1 + (w.userData.sway as number)) * .025;
      if (w.userData.fire) (w.children[0] as THREE.Group).children.forEach(m => {
        if (m.name === "flame") m.scale.y = 1 + .18 * Math.sin(t * 11 + m.position.x * 9);
      });
      if (w.userData.yarn && this.yarnWobble > 0) {
        w.rotation.z = Math.sin(t * 14) * .3;
        w.position.y = Math.abs(Math.sin(t * 14)) * .06;
      } else if (w.userData.yarn) { w.rotation.z = 0; w.position.y = 0; }
    });
    if (this.yarnWobble > 0) this.yarnWobble -= dt;
    const ghost = this.ghostG.children[0] as THREE.Group | undefined;
    const ring = ghost?.getObjectByName("ring") as THREE.Mesh | undefined;
    if (ring) (ring.material as THREE.MeshBasicMaterial).opacity = .45 + .35 * Math.sin(t * 4);
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
    const bob = walking ? Math.abs(Math.sin(t * 12)) * .07
      : pv.mode === "happy" ? Math.abs(Math.sin(t * 9)) * .16
      : Math.sin(t * 2.4) * .015;
    this.petBody.position.y = bob + (pv.napping && !walking ? -.06 : 0);
    this.petBody.scale.y = (pv.napping && !walking ? .8 : 1) * 1.15;
    const tail = this.petBody.getObjectByName("tail");
    if (tail) tail.rotation.x = Math.sin(t * (walking ? 10 : 3)) * .4;
    const head = this.petBody.getObjectByName("head");
    if (head) head.rotation.x = pv.napping && !walking ? .35 : 0;
  }

  /* ---------- shop thumbnails ---------- */
  thumb(id: string): string {
    if (this.thumbCache[id]) return this.thumbCache[id];
    if (!this.thumbR) {
      this.thumbR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      this.thumbR.setSize(120, 120);
    }
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xffffff, 0xA8987F, 1.05));
    const dl = new THREE.DirectionalLight(0xfff6e0, .8);
    dl.position.set(3, 5, 2);
    sc.add(dl);
    const g = id === "pet-cat" || id === "pet-dog"
      ? buildPet(id.slice(4) as PetKind)
      : B3[id] ? B3[id]() : new THREE.Group();
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
