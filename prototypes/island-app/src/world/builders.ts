import * as THREE from "three";
import { C3 } from "./palette";
import { curSeason } from "../game/weather";
import type { PetKind } from "../game/types";

const winter = () => curSeason() === "winter";
const spring = () => curSeason() === "spring";

type Emis = { c: number; i: number };

/* palette hexes are authored in sRGB; convert to linear so the renderer's
   sRGB output stage reproduces them faithfully */
export const linC = (c: number): THREE.Color => new THREE.Color(c).convertSRGBToLinear();
const M = (c: number, e?: Emis): THREE.MeshLambertMaterial => {
  const m = new THREE.MeshLambertMaterial({ color: linC(c) });
  if (e) { m.emissive = linC(e.c); m.emissiveIntensity = e.i; }
  return m;
};
const shade = <T extends THREE.Mesh>(mesh: T): T => { mesh.castShadow = true; mesh.receiveShadow = true; return mesh; };

export function box3(w: number, h: number, d: number, c: number, x = 0, y = 0, z = 0, e?: Emis): THREE.Mesh {
  const m = shade(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(c, e)));
  m.position.set(x, y, z);
  return m;
}
export function cyl3(rt: number, rb: number, h: number, c: number, x = 0, y = 0, z = 0, seg = 10, e?: Emis): THREE.Mesh {
  const m = shade(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), M(c, e)));
  m.position.set(x, y, z);
  return m;
}
export function cone3(r: number, h: number, c: number, x = 0, y = 0, z = 0, seg = 8, e?: Emis): THREE.Mesh {
  const m = shade(new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), M(c, e)));
  m.position.set(x, y, z);
  return m;
}
export function sph3(r: number, c: number, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, e?: Emis): THREE.Mesh {
  const m = shade(new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), M(c, e)));
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  return m;
}
export function grp3(...ms: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  ms.forEach(o => g.add(o));
  return g;
}

/* faceted (flat-shaded) copy of a geometry — the low-poly foliage look */
const facet = (geo: THREE.BufferGeometry): THREE.BufferGeometry => {
  const g = geo.toNonIndexed();
  g.computeVertexNormals();
  geo.dispose();
  return g;
};
/** faceted cone for foliage tiers */
export function fcone3(r: number, h: number, c: number, x = 0, y = 0, z = 0, seg = 7): THREE.Mesh {
  const m = shade(new THREE.Mesh(facet(new THREE.ConeGeometry(r, h, seg)), M(c)));
  m.position.set(x, y, z);
  return m;
}
/* Lumpy faceted foliage blob: an icosahedron whose vertices are jittered
   by a hash of their (welded) position, so the silhouette turns organic
   instead of spherical; flat normals keep the low-poly facets. */
function blob(r: number, c: number, x: number, y: number, z: number,
  sx = 1, sy = .88, sz = 1, seed = 0, leafName = true): THREE.Mesh {
  const geo = new THREE.IcosahedronGeometry(r, 1);
  const p = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i), p.getY(i), p.getZ(i));
    const h = Math.sin(v.x * 127.1 + v.y * 311.7 + v.z * 74.7 + seed) * 43758.5453;
    v.multiplyScalar(1 + ((h - Math.floor(h)) - .5) * .5);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const m = shade(new THREE.Mesh(geo, M(c)));
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  if (leafName) {
    m.rotation.set((seed * 1.7) % .8 - .4, (seed * 2.3) % 3, (seed * 3.1) % .8 - .4);
    m.name = "leaf";
  } else m.rotation.y = (seed * 2.3) % 3; /* flat snow slabs stay flat */
  return m;
}

/* faceted cone with radial vertex jitter — pine tiers with a natural crook */
function jcone(r: number, h: number, c: number, x: number, y: number, z: number, seed = 0): THREE.Mesh {
  const geo = new THREE.ConeGeometry(r, h, 7).toNonIndexed();
  const p = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i), p.getY(i), p.getZ(i));
    const hh = Math.sin(v.x * 127.1 + v.y * 311.7 + v.z * 74.7 + seed) * 43758.5453;
    const j = 1 + ((hh - Math.floor(hh)) - .5) * .34;
    p.setXYZ(i, v.x * j, v.y + ((hh - Math.floor(hh)) - .5) * h * .1, v.z * j);
  }
  geo.computeVertexNormals();
  const m = shade(new THREE.Mesh(geo, M(c)));
  m.position.set(x, y, z);
  return m;
}

/* ---------- item builders (footprint-centered, ground y=0) ---------- */
export const B3: Record<string, () => THREE.Group> = {
  pine() {
    const t1 = jcone(.38, .55, C3.leafD, 0, .62, 0, 3.1);
    const t2 = jcone(.3, .46, C3.leaf, 0, .98, 0, 7.7);
    const t3 = jcone(.21, .36, C3.leafL, 0, 1.31, 0, 5.2);
    t2.rotation.y = .45; t3.rotation.y = .9;
    const trunk = cyl3(.07, .11, .3, C3.woodD, 0, .15);
    trunk.rotation.z = .03;
    const g = grp3(trunk, t1, t2, t3);
    if (winter()) {
      const s1 = jcone(.31, .24, C3.snow, 0, .78, 0, 3.1), s2 = jcone(.24, .21, C3.snow, 0, 1.12, 0, 7.7),
        s3 = jcone(.17, .21, C3.snow, 0, 1.43, 0, 5.2);
      s2.rotation.y = .45; s3.rotation.y = .9;
      g.add(s1, s2, s3);
    }
    return g;
  },
  oak() {
    /* leaning trunk with real branches, and a lumpy off-centre canopy */
    const trunk = cyl3(.08, .14, .72, C3.woodD, 0, .36);
    trunk.rotation.z = .06;
    const br1 = cyl3(.04, .055, .38, C3.woodD, .17, .62, .06);
    br1.rotation.z = -.75; br1.rotation.x = .15;
    const br2 = cyl3(.035, .05, .3, C3.woodD, -.14, .56, -.05);
    br2.rotation.z = .65; br2.rotation.x = -.3;
    const g = grp3(trunk, br1, br2,
      blob(.34, C3.leaf, .02, 1.02, 0, 1.15, .82, 1, 1.3),
      blob(.25, C3.leafL, .3, .84, .13, 1, .9, .95, 4.7),
      blob(.24, C3.leafD, -.28, .9, -.1, 1.2, .78, .9, 8.2),
      blob(.21, C3.leafL, .08, 1.26, -.14, .9, .8, 1.1, 2.9),
      blob(.19, C3.leaf, -.16, 1.12, .25, 1.05, .85, .9, 6.1),
      blob(.16, C3.leafD, .32, 1.14, -.2, .9, .95, 1, 9.4),
      blob(.13, C3.leafD, -.33, .7, .14, 1.1, .8, .9, 5.5));
    if (winter()) {
      g.add(blob(.24, C3.snow, .02, 1.3, -.03, 1.05, .4, 1, 1.3, false),
        blob(.16, C3.snow, .28, 1.02, .1, .8, .35, .8, 4.7, false),
        blob(.15, C3.snow, -.24, 1.06, 0, .85, .33, .8, 8.2, false));
    }
    if (spring()) ([[.32, .98, .26], [-.34, .94, .14], [.08, 1.4, .08], [-.18, 1.22, -.26], [.4, .78, -.12],
      [.3, 1.24, -.22], [-.34, .72, .22], [.02, .92, .36]] as const)
      .forEach(([x, y, z]) => g.add(sph3(.06, C3.blossom, x, y, z)));
    g.userData.deciduous = { h: 1.2 };
    return g;
  },
  palm() {
    const trunk = cyl3(.06, .09, .9, C3.wood, .08, .45, 0);
    trunk.rotation.z = -.18;
    const g = grp3(trunk);
    for (let i = 0; i < 5; i++) {
      const f = box3(.7, .04, .2, C3.leaf);
      f.geometry.translate(.3, 0, 0);
      f.rotation.y = i * Math.PI * 2 / 5;
      f.rotation.z = -.45;
      f.position.set(.16, .92, 0);
      g.add(f);
    }
    g.add(sph3(.07, C3.woodD, .13, .86, .05), sph3(.07, C3.woodD, .2, .86, -.04));
    return g;
  },
  bush() {
    const g = grp3(
      blob(.21, C3.leaf, 0, .2, 0, 1.3, .72, 1.05, 2.4),
      blob(.15, C3.leafL, .19, .24, .1, 1.1, .8, .95, 7.9),
      blob(.15, C3.leafD, -.17, .22, -.07, 1.2, .7, .9, 4.2),
      blob(.12, C3.leafL, .03, .34, -.11, 1, .8, 1.1, 9.8),
      blob(.11, C3.leaf, -.15, .28, .14, 1.1, .75, .9, 6.6));
    if (winter()) {
      g.add(blob(.15, C3.snow, 0, .38, 0, 1.2, .35, 1, 2.4, false),
        blob(.1, C3.snow, .16, .3, .08, .9, .3, .85, 7.9, false));
    }
    if (spring()) ([[.24, .32, .2], [-.22, .28, .14], [.05, .46, -.12], [.32, .22, -.03], [-.12, .4, -.16]] as const)
      .forEach(([x, y, z]) => g.add(sph3(.05, C3.blossom, x, y, z)));
    g.userData.deciduous = { h: .5 };
    return g;
  },
  flowerpatch() {
    const g = grp3(cyl3(.42, .45, .07, 0x7FA26A, 0, .035, 0, 12));
    const cols = [0xE8837B, 0xDFA23A, 0xF0E0E7, 0xC96A4A];
    ([[-.2, -.14], [.18, -.2], [.22, .16], [-.14, .2], [0, 0]] as const).forEach(([px, pz], i) => {
      g.add(cyl3(.015, .015, .16, 0x5A7D4A, px, .14, pz, 5), sph3(.06, cols[i % 4], px, .24, pz));
    });
    return g;
  },
  rock() {
    const m = shade(new THREE.Mesh(new THREE.DodecahedronGeometry(.3), M(C3.stone)));
    m.position.y = .16;
    m.scale.set(1, .72, .85);
    const g = grp3(m, sph3(.12, 0x86A872, .22, .1, .14, 1, .55, 1));
    if (winter()) g.add(sph3(.24, C3.snow, 0, .3, 0, 1, .45, .8));
    return g;
  },
  stump() {
    const g = grp3(cyl3(.24, .28, .3, C3.wood, 0, .15, 0, 12), cyl3(.2, .2, .02, C3.woodL, 0, .31, 0, 12));
    if (winter()) g.add(cyl3(.2, .2, .04, C3.snow, 0, .34, 0, 12));
    return g;
  },
  fence() {
    const g = new THREE.Group();
    [-.36, 0, .36].forEach(px => g.add(box3(.08, .5, .08, C3.wood, px, .25, 0)));
    g.add(box3(.9, .06, .05, C3.woodL, 0, .38, 0), box3(.9, .06, .05, C3.woodL, 0, .2, 0));
    if (winter()) g.add(box3(.92, .04, .07, C3.snow, 0, .43, 0));
    return g;
  },
  sign() {
    const g = grp3(box3(.07, .5, .07, C3.wood, 0, .25, 0), box3(.5, .3, .05, C3.woodL, 0, .5, .02));
    if (winter()) g.add(box3(.52, .04, .07, C3.snow, 0, .67, .02));
    return g;
  },
  bench() {
    const g = grp3(box3(.8, .06, .3, C3.woodL, 0, .28, 0), box3(.8, .26, .05, C3.woodL, 0, .48, -.14),
      box3(.07, .28, .26, C3.wood, -.32, .14, 0), box3(.07, .28, .26, C3.wood, .32, .14, 0));
    if (winter()) g.add(box3(.82, .04, .3, C3.snow, 0, .33, 0), box3(.82, .04, .07, C3.snow, 0, .63, -.14));
    return g;
  },
  lantern() {
    const g = grp3(cyl3(.12, .16, .1, C3.stoneD, 0, .05, 0, 6), cyl3(.05, .05, .35, C3.stoneD, 0, .3, 0, 6),
      box3(.2, .18, .2, C3.cream, 0, .55, 0, { c: 0xFFC978, i: .8 }), cone3(.2, .14, C3.stoneD, 0, .7, 0, 4));
    if (winter()) g.add(cone3(.17, .1, C3.snow, 0, .79, 0, 4));
    return g;
  },
  mailbox() {
    const g = grp3(box3(.07, .45, .07, C3.wood, 0, .22, 0), box3(.32, .2, .2, C3.terra, 0, .55, 0),
      box3(.03, .12, .03, C3.gold, .14, .68, 0));
    if (winter()) g.add(box3(.34, .05, .22, C3.snow, 0, .67, 0));
    return g;
  },
  campfire() {
    const g = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      g.add(sph3(.08, C3.stoneD, Math.cos(a) * .3, .05, Math.sin(a) * .3));
    }
    const l1 = box3(.4, .07, .07, C3.woodD, 0, .08, 0); l1.rotation.y = .5;
    const l2 = box3(.4, .07, .07, C3.woodD, 0, .1, 0); l2.rotation.y = -.6;
    const fl = cone3(.12, .3, C3.flame, 0, .26, 0, 6, { c: 0xFFA940, i: 1 }); fl.name = "flame";
    const fl2 = cone3(.06, .18, 0xF2C14E, 0, .3, 0, 6, { c: 0xFFE08A, i: 1 }); fl2.name = "flame";
    g.add(l1, l2, fl, fl2);
    g.userData.fire = true;
    return g;
  },
  well() {
    const roof = cone3(.42, .26, C3.terra, 0, .85, 0, 4);
    roof.rotation.y = Math.PI / 4;
    const g = grp3(cyl3(.34, .36, .3, C3.stone, 0, .15, 0, 10), cyl3(.26, .26, .3, 0x4E6E78, 0, .16, 0, 10),
      box3(.06, .5, .06, C3.wood, -.3, .5, 0), box3(.06, .5, .06, C3.wood, .3, .5, 0),
      roof, box3(.5, .04, .04, C3.woodD, 0, .62, 0));
    if (winter()) {
      const sr = cone3(.34, .18, C3.snow, 0, .92, 0, 4);
      sr.rotation.y = Math.PI / 4;
      g.add(sr);
    }
    return g;
  },
  house() {
    const roof = cone3(1.18, .6, C3.terra, 0, 1.1, 0, 4);
    roof.rotation.y = Math.PI / 4;
    const g = grp3(box3(1.5, .8, 1.3, C3.cream, 0, .4, 0),
      box3(.4, .55, .06, C3.woodD, -.3, .28, .66),
      box3(.3, .3, .06, 0xBFD8DC, .35, .5, .66, { c: 0xFFDF9E, i: 0 }),
      box3(.2, .5, .2, C3.stoneD, .5, 1.15, -.3), roof);
    g.userData.homeWindow = g.children[2];
    if (winter()) {
      const sr = cone3(1.06, .46, C3.snow, 0, 1.24, 0, 4);
      sr.rotation.y = Math.PI / 4;
      g.add(sr, box3(.24, .06, .24, C3.snow, .5, 1.43, -.3));
    }
    return g;
  },
  cabin() {
    const roof = cone3(1.15, .62, C3.leafD, 0, 1.06, 0, 4);
    roof.rotation.y = Math.PI / 4;
    const g = grp3(box3(1.5, .7, 1.3, C3.wood, 0, .35, 0),
      box3(.38, .5, .06, C3.woodD, 0, .25, .66), box3(1.56, .1, 1.36, C3.woodD, 0, .72, 0),
      roof, cone3(.3, .5, C3.leafD, .62, .28, .5, 6));
    if (winter()) {
      const sr = cone3(.92, .42, C3.snow, 0, 1.21, 0, 4);
      sr.rotation.y = Math.PI / 4;
      g.add(sr, cone3(.2, .2, C3.snow, .62, .48, .5, 6));
    }
    return g;
  },
  dock() {
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const p = box3(.42, .05, .9, C3.woodL, (i - 1.5) * .46, .1, 0);
      g.add(p);
    }
    g.add(box3(.07, .4, .07, C3.woodD, -.85, .12, .35), box3(.07, .4, .07, C3.woodD, .85, .12, .35));
    g.add(sph3(.4, C3.terra, 0, .06, -.85, 1.1, .5, 1.9),
      box3(.02, .55, .35, C3.cream, .02, .5, -.85),
      cyl3(.02, .02, .6, C3.woodD, 0, .35, -.85, 6));
    return g;
  },
  petbed() { return grp3(cyl3(.4, .44, .16, C3.wood, 0, .08, 0, 12), cyl3(.32, .32, .1, C3.cream, 0, .14, 0, 12)); },
  yarn() {
    const g = grp3(sph3(.16, C3.plum, 0, .16, 0));
    const th = shade(new THREE.Mesh(new THREE.TorusGeometry(.16, .02, 6, 14), M(0x7C3D60)));
    th.position.y = .16;
    th.rotation.x = 1.2;
    g.add(th);
    g.userData.yarn = true;
    return g;
  },
  bridge() { return grp3(box3(.8, .08, .9, C3.woodL, 0, .1, 0)); },
};

/* ---------- the companion: a proper little quadruped ----------
   Faces +z. Node names the animator relies on: "head" (nods when napping
   or drinking), "tail" (wags), "legFL/FR/BL/BR" (leg groups pivoted at
   the hip, swung while walking). */
export function buildPet(kind: PetKind): THREE.Group {
  const B = kind === "dog" ? 0xD79754 : 0xEF9350;   /* coat */
  const D = kind === "dog" ? 0xB0763C : 0xD5772E;   /* markings */
  const CR = 0xFDECD4;                              /* cream chest & paws */
  const INK = 0x33261F;
  const g = new THREE.Group();

  const body = new THREE.Group();
  body.name = "body";
  /* torso: chest + hindquarters overlapping into one long back */
  body.add(sph3(.17, B, 0, .3, .1, 1.02, .95, 1.15));
  body.add(sph3(.165, B, 0, .3, -.13, 1.05, 1, 1.1));
  body.add(sph3(.12, CR, 0, .23, .12, .95, .72, .95));         /* belly/chest */
  if (kind === "dog") body.add(sph3(.13, D, 0, .4, -.12, 1, .55, 1.05)); /* saddle */
  else for (let i = 0; i < 3; i++)                              /* tabby stripes */
    body.add(box3(.2, .014, .045, D, 0, .445 - i * .012, -.02 - i * .09));

  /* four legs, pivoted at the hip so they can swing */
  const leg = (name: string, x: number, z: number) => {
    const l = grp3(cyl3(.042, .05, .17, B, 0, -.085, 0, 8), sph3(.05, CR, 0, -.165, .012));
    l.name = name;
    l.position.set(x, .18, z);
    body.add(l);
  };
  leg("legFL", -.095, .17); leg("legFR", .095, .17);
  leg("legBL", -.1, -.17); leg("legBR", .1, -.17);

  /* head on a neck pivot at the front */
  const head = new THREE.Group();
  head.name = "head";
  head.position.set(0, .43, .2);
  head.add(sph3(.145, B, 0, .07, .04, 1, .92, .95));
  const mz = sph3(.075, CR, 0, .02, .16, 1, .7, .8);            /* muzzle */
  head.add(mz);
  head.add(sph3(.02, INK, 0, .045, .225));                      /* nose */
  head.add(sph3(.024, INK, -.075, .1, .15), sph3(.024, INK, .075, .1, .15)); /* eyes */
  if (kind === "dog") {
    const earL = cone3(.05, .12, D, -.09, .2, .0, 4);
    const earR = cone3(.05, .12, D, .09, .2, .0, 4);
    earL.rotation.z = .25; earR.rotation.z = -.25;
    head.add(earL, earR);
    head.add(sph3(.05, CR, 0, -.02, .19, 1, .6, .6));           /* shiba chin */
  } else {
    const earL = cone3(.055, .13, B, -.085, .2, 0, 4);
    const earR = cone3(.055, .13, B, .085, .2, 0, 4);
    earL.rotation.z = .18; earR.rotation.z = -.18;
    head.add(earL, earR);
    head.add(cone3(.03, .07, 0xF3B7CC, -.085, .19, .015, 4), cone3(.03, .07, 0xF3B7CC, .085, .19, .015, 4));
  }

  /* tail, pivoted at the rump */
  const tail = new THREE.Group();
  tail.name = "tail";
  tail.position.set(0, .36, -.24);
  if (kind === "dog") {
    /* shiba curl over the back */
    tail.add(sph3(.05, B, 0, .03, -.02), sph3(.048, CR, 0, .1, .02), sph3(.04, B, 0, .13, .09));
  } else {
    /* upright cat tail with a crook */
    tail.add(sph3(.042, B, 0, .04, -.03), sph3(.04, B, 0, .13, -.05),
      sph3(.038, B, 0, .21, -.03), sph3(.036, D, 0, .27, .02));
  }
  body.add(tail);

  g.add(body, head);
  return g;
}
