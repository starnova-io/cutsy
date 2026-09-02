import * as THREE from "three";
import { C3 } from "./palette";
import type { PetKind } from "../game/types";

type Emis = { c: number; i: number };

const M = (c: number, e?: Emis): THREE.MeshLambertMaterial => {
  const m = new THREE.MeshLambertMaterial({ color: c });
  if (e) { m.emissive = new THREE.Color(e.c); m.emissiveIntensity = e.i; }
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

/* ---------- item builders (footprint-centered, ground y=0) ---------- */
export const B3: Record<string, () => THREE.Group> = {
  pine() {
    return grp3(cyl3(.07, .1, .3, C3.woodD, 0, .15), cone3(.36, .55, C3.leafD, 0, .62),
      cone3(.28, .45, C3.leaf, 0, .98), cone3(.19, .34, C3.leafL, 0, 1.3));
  },
  oak() {
    return grp3(cyl3(.09, .12, .55, C3.woodD, 0, .27),
      sph3(.42, C3.leaf, 0, .82, 0, 1, .85, 1), sph3(.3, C3.leafL, .18, 1.05, .1));
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
  bush() { return grp3(sph3(.3, C3.leaf, 0, .26, 0, 1, .8, 1), sph3(.22, C3.leafL, .16, .34, .1)); },
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
    return grp3(m, sph3(.12, 0x86A872, .22, .1, .14, 1, .55, 1));
  },
  stump() { return grp3(cyl3(.24, .28, .3, C3.wood, 0, .15, 0, 12), cyl3(.2, .2, .02, C3.woodL, 0, .31, 0, 12)); },
  fence() {
    const g = new THREE.Group();
    [-.36, 0, .36].forEach(px => g.add(box3(.08, .5, .08, C3.wood, px, .25, 0)));
    g.add(box3(.9, .06, .05, C3.woodL, 0, .38, 0), box3(.9, .06, .05, C3.woodL, 0, .2, 0));
    return g;
  },
  sign() { return grp3(box3(.07, .5, .07, C3.wood, 0, .25, 0), box3(.5, .3, .05, C3.woodL, 0, .5, .02)); },
  bench() {
    return grp3(box3(.8, .06, .3, C3.woodL, 0, .28, 0), box3(.8, .26, .05, C3.woodL, 0, .48, -.14),
      box3(.07, .28, .26, C3.wood, -.32, .14, 0), box3(.07, .28, .26, C3.wood, .32, .14, 0));
  },
  lantern() {
    return grp3(cyl3(.12, .16, .1, C3.stoneD, 0, .05, 0, 6), cyl3(.05, .05, .35, C3.stoneD, 0, .3, 0, 6),
      box3(.2, .18, .2, C3.cream, 0, .55, 0, { c: 0xFFC978, i: .8 }), cone3(.2, .14, C3.stoneD, 0, .7, 0, 4));
  },
  mailbox() {
    return grp3(box3(.07, .45, .07, C3.wood, 0, .22, 0), box3(.32, .2, .2, C3.terra, 0, .55, 0),
      box3(.03, .12, .03, C3.gold, .14, .68, 0));
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
    return grp3(cyl3(.34, .36, .3, C3.stone, 0, .15, 0, 10), cyl3(.26, .26, .3, 0x4E6E78, 0, .16, 0, 10),
      box3(.06, .5, .06, C3.wood, -.3, .5, 0), box3(.06, .5, .06, C3.wood, .3, .5, 0),
      roof, box3(.5, .04, .04, C3.woodD, 0, .62, 0));
  },
  house() {
    const roof = cone3(1.18, .6, C3.terra, 0, 1.1, 0, 4);
    roof.rotation.y = Math.PI / 4;
    const g = grp3(box3(1.5, .8, 1.3, C3.cream, 0, .4, 0),
      box3(.4, .55, .06, C3.woodD, -.3, .28, .66),
      box3(.3, .3, .06, 0xBFD8DC, .35, .5, .66, { c: 0xFFDF9E, i: 0 }),
      box3(.2, .5, .2, C3.stoneD, .5, 1.15, -.3), roof);
    g.userData.homeWindow = g.children[2];
    return g;
  },
  cabin() {
    const roof = cone3(1.15, .62, C3.leafD, 0, 1.06, 0, 4);
    roof.rotation.y = Math.PI / 4;
    return grp3(box3(1.5, .7, 1.3, C3.wood, 0, .35, 0),
      box3(.38, .5, .06, C3.woodD, 0, .25, .66), box3(1.56, .1, 1.36, C3.woodD, 0, .72, 0),
      roof, cone3(.3, .5, C3.leafD, .62, .28, .5, 6));
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

/* ---------- the companion ---------- */
export function buildPet(kind: PetKind): THREE.Group {
  const B = kind === "dog" ? 0xD79754 : 0xEF9350, D = kind === "dog" ? 0xB0763C : 0xD5772E, CR = 0xFDECD4;
  const g = new THREE.Group();
  const body = grp3(sph3(.24, B, 0, .24, -.04, 1, .82, 1.25));
  body.add(sph3(.1, CR, 0, .2, .18, 1, .7, .6));
  body.add(sph3(.06, CR, -.1, .05, .22), sph3(.06, CR, .1, .05, .22));
  const head = grp3(sph3(.2, B, 0, .52, .22));
  head.add(sph3(.1, CR, 0, .45, .38, 1, .75, .7));
  head.add(sph3(.03, 0x33261F, -.085, .57, .37), sph3(.03, 0x33261F, .085, .57, .37));
  head.add(sph3(.022, 0x33261F, 0, .5, .43));
  if (kind === "dog") {
    head.add(box3(.09, .17, .05, D, -.16, .56, .18), box3(.09, .17, .05, D, .16, .56, .18));
    const tail = sph3(.08, D, 0, .3, -.3); tail.name = "tail"; body.add(tail);
  } else {
    head.add(cone3(.06, .15, B, -.11, .72, .18, 4), cone3(.06, .15, B, .11, .72, .18, 4));
    const tail = grp3(sph3(.055, D, 0, .16, -.3), sph3(.05, D, .01, .27, -.38), sph3(.045, D, .04, .38, -.4));
    tail.name = "tail"; body.add(tail);
  }
  body.name = "body"; head.name = "head";
  g.add(body, head);
  return g;
}
