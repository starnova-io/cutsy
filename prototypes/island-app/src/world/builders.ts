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
  tulips() {
    const g = grp3(cyl3(.36, .38, .06, 0x7FA26A, 0, .03, 0, 10));
    const cols = [0xE8837B, 0xDFA23A, 0xF3B7CC, 0xC96A4A];
    ([[-.17, -.1], [.03, .15], [.19, -.05], [-.05, -.2], [.15, .2]] as const).forEach(([x, z], i) => {
      g.add(cyl3(.016, .018, .26, 0x5A7D4A, x, .15, z, 5));
      /* an upturned cone is a tulip cup; a sphere would just be another daisy */
      const cup = cone3(.055, .13, cols[i % 4], x, .32, z, 6);
      cup.rotation.x = Math.PI;
      g.add(cup, sph3(.05, C3.leaf, x + .06, .13, z, .45, 1.6, .25));
    });
    if (winter()) g.add(cyl3(.37, .39, .04, C3.snow, 0, .08, 0, 10));
    return g;
  },
  mushrooms() {
    const g = new THREE.Group();
    const cap = (x: number, z: number, r: number, h: number, c: number, seed: number) => {
      g.add(cyl3(r * .32, r * .42, h, C3.cream, x, h / 2, z, 8));
      /* gills under a dome: the underside is what says "mushroom" from the side */
      g.add(cyl3(r * .92, r * .5, .06, 0xEFE0C8, x, h - r * .3, z, 10));
      g.add(sph3(r, c, x, h - r * .28, z, 1, .8, 1));
      for (let i = 0; i < 3; i++) {
        const a = i * 2.1 + seed;
        g.add(sph3(r * .15, C3.cream, x + Math.cos(a) * r * .45, h + r * .38, z + Math.sin(a) * r * .45, 1, .5, 1));
      }
    };
    cap(-.2, .13, .18, .34, C3.terra, 1.7);
    cap(.19, -.02, .13, .24, 0xE8837B, 5.2);
    cap(-.02, -.26, .1, .17, C3.terra, 8.9);
    if (winter()) g.add(sph3(.19, C3.snow, -.15, .4, .08, 1, .4, 1));
    return g;
  },
  sunflower() {
    const g = grp3(cyl3(.32, .34, .05, 0x7FA26A, 0, .025, 0, 10));
    ([[-.13, .07, .64], [.11, -.07, .8], [.03, .17, .54]] as const).forEach(([x, z, h]) => {
      g.add(cyl3(.022, .03, h, 0x5A7D4A, x, h / 2, z, 6));
      g.add(sph3(.055, C3.leaf, x + .07, h * .5, z, .35, 1.5, .8));
      const head = new THREE.Group();
      head.position.set(x, h + .03, z);
      head.rotation.x = -.35;                /* tipped up, following the sun */
      for (let i = 0; i < 10; i++) {
        const a = i * Math.PI / 5;
        head.add(sph3(.05, C3.gold, Math.cos(a) * .1, Math.sin(a) * .1, 0, .85, 1.5, .35));
      }
      head.add(sph3(.07, 0x6E4630, 0, 0, .02, 1, 1, .6));
      g.add(head);
    });
    return g;
  },
  maple() {
    /* rounder and lower than the oak, and it turns a stop earlier */
    const trunk = cyl3(.07, .12, .6, C3.woodD, 0, .3);
    trunk.rotation.z = -.05;
    const br = cyl3(.035, .05, .3, C3.woodD, -.15, .5, .04);
    br.rotation.z = .7;
    const g = grp3(trunk, br,
      blob(.27, C3.fall[0], -.02, .88, 0, 1.15, .9, 1, 2.2),
      blob(.2, C3.fall[0], .26, .76, -.1, 1, .95, .95, 6.4),
      blob(.17, C3.fall[1], -.05, 1.12, .1, .95, .85, 1, 9.1),
      blob(.14, C3.fall[0], -.26, .82, .16, 1.05, .9, .95, 3.7),
      leafCloud([[-.02, .88, 0, .32], [.26, .76, -.1, .24], [-.05, 1.12, .1, .21],
        [-.26, .82, .16, .18]], 290, 4.4));
    if (winter()) g.add(blob(.22, C3.snow, -.02, 1.12, 0, 1.05, .4, 1, 2.2, false));
    if (spring()) ([[.28, .86, .2], [-.3, .8, .1], [.04, 1.24, .04], [-.14, 1.06, -.22]] as const)
      .forEach(([x, y, z]) => g.add(sph3(.055, C3.blossom, x, y, z)));
    g.userData.deciduous = { h: 1.05 };
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
  barrel() {
    const g = grp3(cyl3(.2, .24, .28, C3.wood, 0, .14, 0, 14),      /* lower half, flaring out */
      cyl3(.24, .2, .28, C3.wood, 0, .42, 0, 14),                   /* upper half, back in */
      cyl3(.245, .245, .025, C3.woodD, 0, .16, 0, 14),
      cyl3(.245, .245, .025, C3.woodD, 0, .4, 0, 14),
      cyl3(.185, .185, .015, winter() ? C3.ice : 0x4E6E78, 0, .553, 0, 16));  /* caught rain */
    return g;
  },
  birdbath() {
    const g = grp3(cyl3(.16, .2, .08, C3.stoneD, 0, .04, 0, 10),
      cyl3(.07, .09, .42, C3.stone, 0, .28, 0, 10),
      cyl3(.26, .2, .1, C3.stone, 0, .54, 0, 14),
      cyl3(.22, .18, .03, winter() ? C3.ice : 0x679690, 0, .58, 0, 14));
    return g;
  },
  birdhouse() {
    const g = grp3(box3(.07, .7, .07, C3.wood, 0, .35, 0),
      box3(.28, .26, .24, C3.cream, 0, .82, 0),
      sph3(.05, 0x33261F, 0, .84, .13, 1, 1, .4),        /* the way in */
      cyl3(.018, .018, .1, C3.wood, 0, .77, .17, 6));    /* perch */
    const rl = box3(.24, .04, .22, C3.terra, -.08, .98, 0), rr = box3(.24, .04, .22, C3.terra, .08, .98, 0);
    rl.rotation.z = .5; rr.rotation.z = -.5;
    g.add(rl, rr);
    if (winter()) g.add(box3(.3, .04, .24, C3.snow, 0, 1.05, 0));
    return g;
  },
  torii() {
    const g = new THREE.Group();
    [-.3, .3].forEach(x => {
      const post = cyl3(.05, .065, .9, C3.terra, x, .45, 0, 8);
      post.rotation.z = x > 0 ? .03 : -.03;              /* the legs splay, as they do */
      g.add(post);
    });
    g.add(box3(.86, .05, .1, C3.terra, 0, .74, 0),       /* nuki, the lower beam */
      box3(.16, .08, .11, C3.terra, 0, .84, 0),
      box3(1, .075, .15, 0xB5432F, 0, .93, 0));          /* kasagi, with its overhang */
    if (winter()) g.add(box3(1, .04, .15, C3.snow, 0, .98, 0));
    return g;
  },
  sandcastle() {
    const g = grp3(cyl3(.34, .4, .1, C3.sand, 0, .05, 0, 12));
    const tower = (x: number, z: number, h: number, r: number) => {
      g.add(cyl3(r, r * 1.15, h, 0xE7D2A2, x, .1 + h / 2, z, 8),
        cyl3(r * 1.25, r * 1.25, .04, C3.sand, x, .1 + h, z, 8),      /* battlement lip */
        cone3(r * 1.2, r * 1.5, C3.terra, x, .1 + h + r * .78, z, 8));
    };
    tower(-.14, .06, .32, .1); tower(.15, -.04, .23, .085); tower(.02, -.19, .17, .07);
    g.add(box3(.34, .13, .06, C3.sand, 0, .19, .18));
    g.add(sph3(.03, 0xF0E0E7, -.24, .12, -.18, 1, .6, 1),
      sph3(.025, 0xF3B7CC, .26, .11, .15, 1, .6, 1));    /* two shells */
    return g;
  },
  windmill() {
    const g = grp3(cyl3(.16, .26, .8, C3.cream, 0, .4, 0, 10),
      box3(.16, .22, .04, C3.wood, 0, .29, .23),
      cone3(.3, .22, C3.terra, 0, .91, 0, 10));
    const blades = new THREE.Group();
    blades.position.set(0, .78, .3);
    for (let i = 0; i < 4; i++) {
      const arm = box3(.52, .05, .03, C3.woodD);
      arm.geometry.translate(.26, 0, 0);                 /* pivot at the hub, not the middle */
      const sail = box3(.36, .17, .02, C3.cream);
      sail.geometry.translate(.3, .07, .015);            /* canvas hung off one side */
      const spar = new THREE.Group();
      spar.add(arm, sail);
      spar.rotation.z = i * Math.PI / 2;
      blades.add(spar);
    }
    const hub = cyl3(.05, .05, .08, C3.woodD, 0, 0, .02, 8);
    hub.rotation.x = Math.PI / 2;
    blades.add(hub);
    g.add(blades);
    g.userData.spin = blades;
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
    const boat = buildBoat();
    boat.position.z = -.85;
    g.add(boat);
    return g;
  },
  tent() {
    const g = new THREE.Group();
    /* A triangular prism is the whole shape of a tent; two thin sheets leaning
       together just read as paper. Cylinder with 3 sides, laid on its side. */
    const canvasGeo = new THREE.CylinderGeometry(.52, .52, .8, 3);
    canvasGeo.rotateX(-Math.PI / 2);     /* apex up, flat side down, ridge along z */
    const tent = shade(new THREE.Mesh(canvasGeo, M(winter() ? C3.snow : C3.cream)));
    tent.position.y = .26;
    g.add(tent);
    /* a seam along the ridge, or the two slopes merge into one flat sheet */
    g.add(box3(.05, .05, .84, C3.terra, 0, .77, 0));
    /* the way in: a darker triangle set into the front face */
    const doorGeo = new THREE.CylinderGeometry(.3, .3, .06, 3);
    doorGeo.rotateX(-Math.PI / 2);
    const door = shade(new THREE.Mesh(doorGeo, M(0x3A3040)));
    door.position.set(0, .15, .41);
    g.add(door);
    g.add(cyl3(.015, .015, .18, C3.wood, 0, .87, -.34, 5),         /* a little pennant */
      box3(.14, .09, .01, C3.plum, .07, .92, -.34));
    /* guy ropes pegged out at both ends */
    ([.5, -.5] as const).forEach(z => {
      const rope = cyl3(.008, .008, .42, C3.woodL, 0, .3, z * .78, 4);
      rope.rotation.x = z > 0 ? .95 : -.95;
      g.add(rope);
    });
    return g;
  },
  greenhouse() {
    /* glass needs its own material — M() has no transparency */
    const glass = () => new THREE.MeshLambertMaterial({
      color: linC(0xBFD8DC), transparent: true, opacity: .42, side: THREE.DoubleSide });
    const g = grp3(box3(1.84, .12, .9, C3.stone, 0, .06, 0));
    /* glass envelope, with the frame strictly inside it so nothing pokes out */
    const walls = shade(new THREE.Mesh(rboxGeo(1.7, .58, .78, .03), glass()));
    walls.position.y = .41;
    g.add(walls);
    const roofGeo = new THREE.CylinderGeometry(.46, .46, 1.7, 3);
    roofGeo.rotateX(-Math.PI / 2);
    roofGeo.rotateY(Math.PI / 2);                                /* ridge runs along x */
    const roof = shade(new THREE.Mesh(roofGeo, glass()));
    roof.position.y = .93;
    roof.scale.set(1, .62, .845);
    g.add(roof);
    /* corner posts, sill and ridge: the frame is what makes it a building */
    [-.83, .83].forEach(x => [-.37, .37].forEach(z => g.add(box3(.05, .62, .05, C3.leafD, x, .41, z))));
    g.add(box3(1.74, .05, .82, C3.leafD, 0, .71, 0));            /* eaves plate */
    g.add(box3(1.76, .06, .06, C3.leafD, 0, 1.12, 0));           /* ridge */
    g.add(box3(.34, .54, .05, C3.leafD, 0, .39, .38),
      sph3(.03, C3.gold, .12, .39, .41));                        /* door + handle */
    /* something growing inside, seen through the glass */
    g.add(blob(.15, C3.leaf, -.5, .28, 0, 1, .8, 1, 3.3, false),
      blob(.12, C3.leaf, .52, .25, .06, 1, .85, 1, 7.1, false),
      sph3(.05, 0xE8837B, .52, .4, .06));
    if (winter()) g.add(box3(1.7, .06, .3, C3.snow, 0, 1.14, 0));
    return g;
  },
  lighthouse() {
    const g = grp3(cyl3(.3, .38, .12, C3.stoneD, 0, .06, 0, 12),
      cyl3(.17, .3, 1.15, C3.cream, 0, .68, 0, 12),
      /* two red bands: the thing that makes a lighthouse a lighthouse */
      cyl3(.263, .275, .18, C3.terra, 0, .48, 0, 12),
      cyl3(.208, .22, .16, C3.terra, 0, .95, 0, 12),
      cyl3(.24, .24, .05, C3.stoneD, 0, 1.28, 0, 12));           /* gallery */
    const lamp = cyl3(.15, .15, .22, 0xFFE9B0, 0, 1.41, 0, 10, { c: 0xFFC978, i: 0 });
    g.add(lamp, cone3(.2, .18, C3.terra, 0, 1.61, 0, 10));
    g.userData.homeWindow = lamp;                                /* lights itself at dusk */
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
  foodbowl() {
    return grp3(cyl3(.19, .14, .1, C3.terra, 0, .05, 0, 12),
      cyl3(.15, .11, .04, C3.woodD, 0, .1, 0, 12));              /* kibble */
  },
  scratchpost() {
    const g = grp3(box3(.44, .06, .44, C3.wood, 0, .03, 0),
      cyl3(.09, .09, .62, C3.sand, 0, .37, 0, 10),               /* sisal */
      box3(.36, .05, .36, C3.woodL, 0, .7, 0));
    /* a dangling toy — a bare post is furniture, not something to play with */
    g.add(cyl3(.006, .006, .16, C3.woodD, .13, .62, 0, 5), sph3(.05, C3.plum, .13, .53, 0));
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

/** the lumpy little sailboat that moors beside the dock */
export function buildBoat(): THREE.Group {
  const hull = blob(.38, C3.terra, 0, .06, 0, 1.1, .5, 1.9, 13.7, false);
  hull.rotation.set(0, 0, 0);
  const lip = new THREE.Mesh(new THREE.IcosahedronGeometry(.3, 1), hull.material);
  lip.position.y = .12;
  lip.scale.set(.85, .3, .85);
  hull.add(lip);
  return grp3(hull,
    box3(.02, .55, .35, C3.cream, .02, .5, 0),
    cyl3(.02, .02, .6, C3.woodD, 0, .35, 0, 6));
}

/* ---------- the companion: a proper little quadruped ----------
   Faces +z. Node names the animator relies on: "head" (nods when napping
   or drinking), "tail" (wags), "legFL/FR/BL/BR" (leg groups pivoted at
   the hip, swung while walking). */
export function buildPet(kind: PetKind): THREE.Group {
  const cat = kind === "cat";
  const B = cat ? 0xEF9350 : 0xD79754;              /* coat */
  const D = cat ? 0xD5772E : 0xB0763C;              /* markings */
  const CR = 0xFDECD4;                              /* cream: chest, socks, mask */
  const INK = 0x33261F;
  const PINK = 0xF3B7CC;
  const g = new THREE.Group();

  const body = new THREE.Group();
  body.name = "body";
  if (cat) {
    /* a cat is a curve: deep chest, tucked waist, arched topline */
    body.add(sph3(.16, B, 0, .27, .09, 1.02, .98, 1.15));        /* chest */
    body.add(sph3(.155, B, 0, .265, -.13, 1.02, 1, 1.08));       /* haunches */

    body.add(sph3(.115, CR, 0, .205, .06, .96, .74, 1.25));      /* belly */
    body.add(sph3(.105, B, 0, .365, .155, .9, .95, .9));         /* neck */
    /* Two-tone coat: a copy of each body sphere, nudged up, so the colour
       break is a clean line that follows the body — a flat patch laid over
       the back just reads as a sticker. */
    body.add(sph3(.16, D, 0, .325, .09, 1.02, .98, 1.15));
    body.add(sph3(.155, D, 0, .32, -.13, 1.02, 1, 1.08));
  } else {
    /* a shiba is a barrel on stout legs: level back, cream ruff at the chest */
    body.add(sph3(.17, B, 0, .275, .10, 1.06, 1.02, 1.1));       /* chest */
    body.add(sph3(.165, B, 0, .27, -.14, 1.05, 1.02, 1.06));     /* haunches */

    body.add(sph3(.115, CR, 0, .255, .175, 1.15, .95, .8));      /* chest ruff */
    body.add(sph3(.12, CR, 0, .21, .03, .96, .72, 1.2));         /* belly */
    body.add(sph3(.115, B, 0, .375, .165, .95, .95, .9));        /* neck */
    /* the shiba's darker saddle, same trick */
    body.add(sph3(.17, D, 0, .335, .10, 1.06, 1.02, 1.1));
    body.add(sph3(.165, D, 0, .33, -.14, 1.05, 1.02, 1.06));
  }

  /* four short legs, pivoted at the hip so they can swing. Cream only on the
     lowest joint — a whole white foot reads as a sock, not a paw. */
  const leg = (name: string, x: number, z: number) => {
    const l = new THREE.Group();
    l.add(cyl3(cat ? .046 : .054, cat ? .05 : .058, .12, B, 0, -.055, 0, 8));
    l.add(sph3(cat ? .05 : .056, CR, 0, -.115, .008, 1, .72, 1.15));   /* paw */
    l.name = name;
    l.position.set(x, .165, z);
    body.add(l);
  };
  const lx = cat ? .095 : .105;
  leg("legFL", -lx, .155); leg("legFR", lx, .155);
  leg("legBL", -lx, -.155); leg("legBR", lx, -.155);

  /* head on a neck pivot at the front — oversized on purpose, that's the
     difference between a small animal and a toy of one */
  const head = new THREE.Group();
  head.name = "head";
  head.position.set(0, cat ? .455 : .46, cat ? .215 : .225);
  head.scale.setScalar(1.12);
  head.add(sph3(.145, B, 0, .07, .03, cat ? 1.02 : 1, cat ? .98 : .94, cat ? .92 : 1));
  /* cheeks: fluff on the cat, the shiba's cream mask on the dog */
  head.add(sph3(cat ? .075 : .066, cat ? B : CR, -.10, cat ? .03 : 0, cat ? .06 : .085, .9, .9, .8),
    sph3(cat ? .075 : .066, cat ? B : CR, .10, cat ? .03 : 0, cat ? .06 : .085, .9, .9, .8));
  /* muzzle + nose — pink on a ginger cat, dark on the shiba */
  head.add(cat ? sph3(.058, CR, 0, .005, .155, 1.1, .78, .8)
    : sph3(.075, CR, 0, 0, .17, 1.05, .85, 1));
  head.add(cat ? sph3(.022, PINK, 0, .035, .215, 1.2, .8, .8)
    : sph3(.026, INK, 0, .03, .235, 1.15, .85, .8));
  /* eyes, each with a catchlight — the single thing that makes them look alive */
  const eye = (x: number) => {
    head.add(sph3(.027, INK, x, .075, .152, .88, 1.05, .7));
    head.add(sph3(.010, 0xFFFFFF, x + (x < 0 ? .011 : -.011), .095, .172, 1, 1, .6));
  };
  eye(-.068); eye(.068);
  if (cat) {
    /* forehead "M" of a tabby, then upright ears with pink inners */
    head.add(sph3(.045, D, 0, .16, .075, 1.15, .22, .55));
    const ear = (x: number, tilt: number) => {
      const e = cone3(.058, .15, B, x, .20, .005, 4);
      e.rotation.set(-.12, 0, tilt);
      const inner = cone3(.032, .10, PINK, x, .195, .035, 4);
      inner.rotation.set(-.12, 0, tilt);
      head.add(e, inner);
    };
    ear(-.088, .18); ear(.088, -.18);
    /* whiskers: flat slivers, because thin cylinders just shimmer at this size */
    const whisker = (x: number, y: number, tilt: number) => {
      const w = box3(.13, .006, .006, CR, x, y, .16);
      w.rotation.z = tilt;
      head.add(w);
    };
    whisker(-.13, .04, .1); whisker(-.13, .015, -.06);
    whisker(.13, .04, -.1); whisker(.13, .015, .06);
  } else {
    /* shiba: cream brow dots and thick triangular ears */
    head.add(sph3(.024, CR, -.075, .155, .115, 1.2, .7, .6),
      sph3(.024, CR, .075, .155, .115, 1.2, .7, .6));
    const ear = (x: number, tilt: number) => {
      const e = cone3(.062, .125, B, x, .185, .01, 4);
      e.rotation.set(-.08, 0, tilt);
      const inner = cone3(.034, .08, CR, x, .18, .04, 4);
      inner.rotation.set(-.08, 0, tilt);
      head.add(e, inner);
    };
    ear(-.095, .22); ear(.095, -.22);
  }

  /* tail, pivoted at the rump. Overlapping spheres, close enough that it
     reads as one tapering tail instead of a string of beads. */
  const tail = new THREE.Group();
  tail.name = "tail";
  if (cat) {
    tail.position.set(0, .33, -.22);
    for (let i = 0; i < 7; i++) {
      const k = i / 6;
      tail.add(sph3(.046 - k * .012, i === 6 ? D : B,
        0, .03 + k * .30, -.02 - Math.sin(k * 2.4) * .05 + k * .05));
    }
  } else {
    tail.position.set(0, .35, -.19);
    /* the shiba curl: up off the rump, forward over the back, cream beneath */
    const pts: [number, number, number][] = [
      [.05, -.02, .052], [.115, .01, .05], [.15, .07, .047],
      [.145, .135, .043], [.105, .18, .038],
    ];
    pts.forEach(([y, z, r], i) => tail.add(sph3(r, i === 4 ? CR : B, 0, y, z)));
  }
  body.add(tail);

  g.add(body, head);
  return g;
}
