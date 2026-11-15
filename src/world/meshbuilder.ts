import * as THREE from 'three';

/** Accumule des triangles (positions, normales, UV, couleurs) pour fusionner un chunk en un seul mesh. */
export class MeshBuilder {
  pos: number[] = []; nor: number[] = []; uv: number[] = []; col: number[] = []; idx: number[] = [];
  get count() { return this.pos.length / 3; }
  vert(x: number, y: number, z: number, nx: number, ny: number, nz: number, u: number, v: number, c: THREE.Color | null) {
    this.pos.push(x, y, z); this.nor.push(nx, ny, nz); this.uv.push(u, v);
    this.col.push(c ? c.r : 1, c ? c.g : 1, c ? c.b : 1); return this.count - 1;
  }
  tri(a: number, b: number, c: number) { this.idx.push(a, b, c); }
  quad(a: number, b: number, c: number, d: number) { this.idx.push(a, b, c, a, c, d); }
  /** Quad plan à partir de 4 points (ordre anti-horaire vu de la normale), normale calculée. */
  planar(p: number[][], uvs: number[][], c: THREE.Color | null) {
    const e1 = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]], e2 = [p[3][0] - p[0][0], p[3][1] - p[0][1], p[3][2] - p[0][2]];
    let nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const i = p.map((q, k) => this.vert(q[0], q[1], q[2], nx, ny, nz, uvs[k][0], uvs[k][1], c));
    this.quad(i[0], i[1], i[2], i[3]);
  }
  /** Boîte alignée sur les axes (centre x,z ; base y), UV en mètres/2 pour des textures répétées. */
  box(cx: number, cz: number, w: number, d: number, h: number, y0: number, c: THREE.Color) {
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, y1 = y0 + h; const k = 0.5;
    const P = (x: number, y: number, z: number) => [x, y, z];
    this.planar([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], [[x0 * k, y0 * k], [x1 * k, y0 * k], [x1 * k, y1 * k], [x0 * k, y1 * k]], c);
    this.planar([P(x1, y0, z0), P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0)], [[x1 * k, y0 * k], [x0 * k, y0 * k], [x0 * k, y1 * k], [x1 * k, y1 * k]], c);
    this.planar([P(x1, y0, z1), P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1)], [[z1 * k, y0 * k], [z0 * k, y0 * k], [z0 * k, y1 * k], [z1 * k, y1 * k]], c);
    this.planar([P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0)], [[z0 * k, y0 * k], [z1 * k, y0 * k], [z1 * k, y1 * k], [z0 * k, y1 * k]], c);
    this.planar([P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), P(x0, y1, z0)], [[x0 * k, z1 * k], [x1 * k, z1 * k], [x1 * k, z0 * k], [x0 * k, z0 * k]], c);
  }
  build(): THREE.BufferGeometry | null {
    if (!this.idx.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere(); return g;
  }
}
