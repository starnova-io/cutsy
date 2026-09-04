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

/* Rounded box — the clay-toy look: a subdivided box whose vertices are
   pushed onto a radius-r shell around the shrunken core, with matching
   smooth normals. Face groups survive, so multi-material tiles still work. */
export function rboxGeo(w: number, h: number, d: number, r: number, seg = 2): THREE.BufferGeometry {
  r = Math.min(r, w * .45, h * .45, d * .45);
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  const p = g.attributes.position as THREE.BufferAttribute;
  const n = g.attributes.normal as THREE.BufferAttribute;
  const hw = w / 2 - r, hh = h / 2 - r, hd = d / 2 - r;
  const v = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i), p.getY(i), p.getZ(i));
    c.set(Math.max(-hw, Math.min(hw, v.x)), Math.max(-hh, Math.min(hh, v.y)), Math.max(-hd, Math.min(hd, v.z)));
    v.sub(c);
    const len = v.length() || 1;
    v.multiplyScalar(r / len);
    n.setXYZ(i, v.x / r, v.y / r, v.z / r);
    p.setXYZ(i, c.x + v.x, c.y + v.y, c.z + v.z);
  }
  return g;
}

export function box3(w: number, h: number, d: number, c: number, x = 0, y = 0, z = 0, e?: Emis): THREE.Mesh {
  const r = Math.min(.05, w * .28, h * .28, d * .28);
  const m = shade(new THREE.Mesh(rboxGeo(w, h, d, r), M(c, e)));
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

/* A cloud of individual instanced leaves scattered over the canopy lobes,
   after ceramicSoda's falling-autumn-leaves pen: each leaf is a small quad
   facing outward, coloured by a three-stop gradient over height+outerness
   (their mix3). userData carries per-leaf summer (c0) and autumn (c1)
   colours so the seasonal tint can lerp instance colours. */
/** a proper leaf silhouette: pointed oval with a stem-side taper */
export function leafShapeGeo(w: number, h: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  const hw = w / 2, hh = h / 2;
  s.moveTo(0, -hh);
  s.bezierCurveTo(hw * 1.15, -hh * .3, hw * .95, hh * .5, 0, hh);
  s.bezierCurveTo(-hw * .95, hh * .5, -hw * 1.15, -hh * .3, 0, -hh);
  return new THREE.ShapeGeometry(s, 4);
}

const h01 = (n: number): number => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};
const mix3 = (a: THREE.Color, b: THREE.Color, c: THREE.Color, f: number): THREE.Color =>
  f > .5 ? b.clone().lerp(c, (f - .5) * 2) : a.clone().lerp(b, f * 2);

function leafCloud(lobes: [number, number, number, number][], count: number, seed: number): THREE.InstancedMesh {
  const im = new THREE.InstancedMesh(
    leafShapeGeo(.1, .15),
    new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
    count);
  im.name = "leafIM";
  im.castShadow = true;
  const dum = new THREE.Object3D();
  const c0: THREE.Color[] = [], c1: THREE.Color[] = [];
  let minY = 1e9, maxY = -1e9, maxR = 0;
  lobes.forEach(([x, y, z, r]) => {
    minY = Math.min(minY, y - r); maxY = Math.max(maxY, y + r);
    maxR = Math.max(maxR, Math.hypot(x, z) + r);
  });
  /* the pen's autumn ramp: dusty red -> tan -> pale straw */
  const A = linC(0xB45252), B = linC(0xD3A068), C = linC(0xEDE19E);
  const GA = linC(C3.leafD), GB = linC(C3.leaf), GC = linC(C3.leafL);
  for (let i = 0; i < count; i++) {
    const [lx, ly, lz, lr] = lobes[Math.floor(h01(seed + i * 3.7) * lobes.length)];
    const u = h01(seed + i * 7.3) * 2 - 1, az = h01(seed + i * 5.1) * Math.PI * 2;
    const sq = Math.sqrt(1 - u * u);
    const dx = sq * Math.cos(az), dy = u, dz = sq * Math.sin(az);
    const rr = lr * (.82 + h01(seed + i * 9.2) * .3);
    dum.position.set(lx + dx * rr, ly + dy * rr * .85, lz + dz * rr);
    dum.lookAt(dum.position.x + dx, dum.position.y + dy, dum.position.z + dz);
    dum.rotateZ(h01(seed + i * 11.7) * Math.PI * 2);
    dum.scale.setScalar(.75 + h01(seed + i * 13.3) * .6);
    dum.updateMatrix();
    im.setMatrixAt(i, dum.matrix);
    const t = Math.min(1, ((dum.position.y - minY) / (maxY - minY)) * .62
      + (Math.hypot(dum.position.x, dum.position.z) / maxR) * .46);
    c0.push(mix3(GA, GB, GC, t));
    c1.push(mix3(A, B, C, t));
    im.setColorAt(i, c0[i]);
  }
  im.userData.c0 = c0;
  im.userData.c1 = c1;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  return im;
}

/* faceted cone with radial vertex jitter — pine tiers with a natural crook,
   or (with 4 segments and a light touch) a handmade-looking roof */
function jcone(r: number, h: number, c: number, x: number, y: number, z: number,
  seed = 0, seg = 7, amt = .34): THREE.Mesh {
  const geo = new THREE.ConeGeometry(r, h, seg).toNonIndexed();
  const p = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i), p.getY(i), p.getZ(i));
    const hh = Math.sin(v.x * 127.1 + v.y * 311.7 + v.z * 74.7 + seed) * 43758.5453;
    const j = 1 + ((hh - Math.floor(hh)) - .5) * amt;
    p.setXYZ(i, v.x * j, v.y + ((hh - Math.floor(hh)) - .5) * h * .3 * amt, v.z * j);
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
    /* smaller dark lobes fill the core; the visible surface is a cloud of
       individual leaves */
    const g = grp3(trunk, br1, br2,
      blob(.3, C3.leafD, .02, 1.02, 0, 1.1, .82, 1, 1.3),
      blob(.22, C3.leafD, .3, .84, .13, 1, .9, .95, 4.7),
      blob(.21, C3.leafD, -.28, .9, -.1, 1.15, .78, .9, 8.2),
      blob(.18, C3.leafD, .08, 1.26, -.14, .9, .8, 1.1, 2.9),
      blob(.16, C3.leafD, -.16, 1.12, .25, 1.05, .85, .9, 6.1),
      blob(.12, C3.leafD, -.33, .7, .14, 1.1, .8, .9, 5.5),
      leafCloud([[.02, 1.02, 0, .36], [.3, .84, .13, .26], [-.28, .9, -.1, .27],
        [.08, 1.26, -.14, .22], [-.16, 1.12, .25, .2], [.32, 1.14, -.2, .17], [-.33, .7, .14, .15]], 330, 3.3));
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
      blob(.18, C3.leafD, 0, .2, 0, 1.3, .72, 1.05, 2.4),
      blob(.13, C3.leafD, .19, .24, .1, 1.1, .8, .95, 7.9),
      blob(.13, C3.leafD, -.17, .22, -.07, 1.2, .7, .9, 4.2),
      blob(.1, C3.leafD, .03, .34, -.11, 1, .8, 1.1, 9.8),
      leafCloud([[0, .2, 0, .23], [.19, .24, .1, .16], [-.17, .22, -.07, .16],
        [.03, .34, -.11, .13], [-.15, .28, .14, .12]], 160, 8.8));
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
    [-.36, 0, .36].forEach((px, i) => {
      const p = box3(.08, .5, .08, C3.wood, px, .25, 0);
      p.rotation.z = (i - 1) * .05;                               /* handmade lean */
      g.add(p);
    });
    const r1 = box3(.9, .06, .05, C3.woodL, 0, .38, 0), r2 = box3(.9, .06, .05, C3.woodL, 0, .2, 0);
    r1.rotation.z = .025; r2.rotation.z = -.02;
    g.add(r1, r2);
    if (winter()) g.add(box3(.92, .04, .07, C3.snow, 0, .43, 0));
    return g;
  },
  sign() {
    const g = grp3(box3(.07, .5, .07, C3.wood, 0, .25, 0), box3(.5, .3, .05, C3.woodL, 0, .5, .02),
      box3(.4, .022, .06, C3.woodD, 0, .55, .04), box3(.3, .022, .06, C3.woodD, 0, .48, .04));
    if (winter()) g.add(box3(.52, .04, .07, C3.snow, 0, .67, .02));
    g.rotation.z = .06;                                           /* a friendly tilt */
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
    const g = new THREE.Group();
    /* rim of chunky stones instead of a smooth drum */
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      const st = shade(new THREE.Mesh(new THREE.DodecahedronGeometry(.11), M(i % 2 ? C3.stone : C3.stoneD)));
      st.position.set(Math.cos(a) * .3, .12 + (i % 3) * .02, Math.sin(a) * .3);
      st.rotation.set(i, i * 2, 0);
      st.scale.set(1, .8, .9);
      g.add(st);
    }
    g.add(cyl3(.26, .26, .26, 0x4E6E78, 0, .14, 0, 10));          /* dark water */
    const p1 = box3(.06, .55, .06, C3.wood, -.3, .5, 0), p2 = box3(.06, .55, .06, C3.wood, .3, .5, 0);
    p1.rotation.z = .05; p2.rotation.z = -.05;
    const roof = jcone(.46, .28, C3.terra, 0, .9, 0, 21, 4, .16);
    roof.rotation.y = Math.PI / 4;
    g.add(p1, p2, roof, box3(.5, .04, .04, C3.woodD, 0, .66, 0),
      cyl3(.006, .006, .2, C3.woodD, 0, .56, 0, 4),               /* rope */
      cyl3(.05, .06, .08, C3.woodD, 0, .46, 0, 7));               /* bucket */
    if (winter()) {
      const sr = jcone(.38, .18, C3.snow, 0, .98, 0, 21, 4, .16);
      sr.rotation.y = Math.PI / 4;
      g.add(sr);
    }
    return g;
  },
  house() {
    const g = new THREE.Group();
    g.add(box3(1.58, .12, 1.38, C3.stoneD, 0, .06, 0));           /* stone footing */
    g.add(box3(1.5, .78, 1.3, C3.cream, 0, .51, 0));
    ([[-.72, .62], [.72, .62], [-.72, -.62], [.72, -.62]] as const)
      .forEach(([px, pz]) => g.add(box3(.09, .78, .09, C3.wood, px, .51, pz)));
    g.add(box3(1.6, .07, 1.4, C3.woodD, 0, .93, 0));              /* eaves trim */
    /* chunky clay roof: a wide under-lip below the main cap */
    const lip = jcone(1.34, .26, 0xB55E42, 0, 1.06, 0, 11, 4, .1);
    lip.rotation.y = Math.PI / 4;
    const roof = jcone(1.22, .66, C3.terra, 0, 1.3, 0, 11, 4, .1);
    roof.rotation.y = Math.PI / 4;
    g.add(lip, roof, sph3(.1, C3.woodD, 0, 1.64, 0));             /* ridge knob */
    /* door with frame, knob and a stone step */
    g.add(box3(.46, .6, .05, C3.wood, -.3, .34, .67),
      box3(.38, .54, .06, C3.woodD, -.3, .32, .69),
      sph3(.024, C3.gold, -.42, .32, .73),
      box3(.5, .06, .2, C3.stoneD, -.3, .03, .76));
    /* cross-framed window */
    const glass = box3(.32, .32, .05, 0xBFD8DC, .35, .56, .67, { c: 0xFFDF9E, i: 0 });
    g.add(box3(.4, .4, .04, C3.wood, .35, .56, .66), glass,
      box3(.33, .03, .06, C3.wood, .35, .56, .68),
      box3(.03, .33, .06, C3.wood, .35, .56, .68));
    g.userData.homeWindow = glass;
    /* stone chimney with cap and drifting smoke */
    g.add(box3(.22, .6, .22, C3.stoneD, .48, 1.28, -.32),
      box3(.28, .07, .28, C3.stone, .48, 1.6, -.32));
    const smoke = new THREE.Group();
    smoke.position.set(.48, 1.68, -.32);
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Mesh(new THREE.IcosahedronGeometry(.055 + i * .012, 1),
        new THREE.MeshLambertMaterial({ color: linC(0xD9D2D9), transparent: true, opacity: .5 }));
      smoke.add(p);
    }
    g.add(smoke);
    g.userData.smoke = smoke;
    if (winter()) {
      const sr = jcone(1.1, .46, C3.snow, 0, 1.3, 0, 11, 4, .12);
      sr.rotation.y = Math.PI / 4;
      g.add(sr, box3(.3, .06, .3, C3.snow, .48, 1.66, -.32));
    }
    return g;
  },
  cabin() {
    const g = new THREE.Group();
    g.add(box3(1.56, .1, 1.36, C3.stoneD, 0, .05, 0));            /* stone footing */
    g.add(box3(1.5, .68, 1.3, C3.wood, 0, .44, 0));
    /* horizontal log seams + protruding log-ends at the corners */
    for (let i = 0; i < 3; i++) {
      const y = .22 + i * .21;
      g.add(box3(1.52, .025, 1.32, C3.woodD, 0, y, 0));
      ([[-.76, .66], [.76, .66], [-.76, -.66], [.76, -.66]] as const).forEach(([px, pz]) => {
        const e = cyl3(.05, .05, .1, C3.woodD, px, y, pz, 6);
        e.rotation.x = Math.PI / 2;
        g.add(e);
      });
    }
    g.add(box3(1.58, .08, 1.38, C3.woodD, 0, .79, 0));            /* eaves */
    const clip = jcone(1.3, .24, 0x47663E, 0, .94, 0, 17, 4, .11);
    clip.rotation.y = Math.PI / 4;
    const roof = jcone(1.18, .64, C3.leafD, 0, 1.16, 0, 17, 4, .11);
    roof.rotation.y = Math.PI / 4;
    g.add(clip, roof, sph3(.09, C3.woodD, 0, 1.5, 0));
    g.add(box3(.44, .52, .05, C3.woodD, 0, .3, .67),              /* door frame */
      box3(.36, .46, .06, 0x6E4630, 0, .28, .69),
      box3(.28, .24, .05, 0xBFD8DC, .48, .5, .67),                /* small window */
      box3(.34, .3, .04, C3.woodD, .48, .5, .66));
    g.add(jcone(.3, .5, C3.leafD, .62, .3, .5, 9));               /* little pine */
    if (winter()) {
      const sr = jcone(.95, .44, C3.snow, 0, 1.22, 0, 17, 4, .13);
      sr.rotation.y = Math.PI / 4;
      g.add(sr, jcone(.21, .2, C3.snow, .62, .5, .5, 9));
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
    const hull = blob(.38, C3.terra, 0, .06, -.85, 1.1, .5, 1.9, 13.7, false);
    hull.rotation.set(0, 0, 0);
    hull.add(new THREE.Mesh(new THREE.IcosahedronGeometry(.3, 1),
      hull.material).translateY(.12));                            /* inner lip */
    (hull.children[0] as THREE.Mesh).scale.set(.85, .3, .85);
    g.add(hull,
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

/** shop thumbnail for a land expansion: a little grass patch rising from water */
export function landThumb(): THREE.Group {
  const g = new THREE.Group();
  ([[0, 0, C3.grass[0]], [1, 0, 0x8FB07A], [0, 1, 0x7C9E64], [1, 1, C3.grass[0]]] as const)
    .forEach(([a, b, c]) => g.add(box3(.95, .5, .95, c, a - .5, -.25, b - .5)));
  g.add(box3(2.1, .12, 2.1, 0x679690, 0, -.56, 0));
  g.add(cone3(.05, .22, 0x5A7D4A, -.3, .1, -.2, 5), cone3(.04, .18, 0x6F945C, -.2, .08, -.32, 5));
  g.add(sph3(.07, C3.blossom, .3, .06, .25), sph3(.055, C3.gold, .45, .05, .1));
  return g;
}

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
