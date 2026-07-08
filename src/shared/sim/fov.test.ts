import { describe, expect, test } from "vitest";
import { computeVisible, shadowcast } from "./fov.js";
import { Tile } from "./types.js";
import { floorFromAscii, makeState } from "../../../tests/helpers.js";
import { splitmix32 } from "./rng.js";

function cast(tiles: Uint8Array, w: number, h: number, x: number, y: number, r: number): Uint8Array {
  const out = new Uint8Array(w * h);
  shadowcast(tiles, w, h, x, y, r, out);
  return out;
}

describe("shadowcast", () => {
  test("open room: everything within the disc is visible", () => {
    const fd = floorFromAscii(["#######", "#.....#", "#..@..#", "#.....#", "#######"]);
    const vis = cast(fd.tiles, fd.w, fd.h, 3, 2, 8);
    for (let y = 1; y <= 3; y++) {
      for (let x = 1; x <= 5; x++) expect(vis[y * fd.w + x], `${x},${y}`).toBe(1);
    }
  });

  test("a pillar casts a shadow", () => {
    const fd = floorFromAscii(["#########", "#.......#", "#.@.#...#", "#.......#", "#########"]);
    const vis = cast(fd.tiles, fd.w, fd.h, 2, 2, -1);
    expect(vis[2 * fd.w + 4]).toBe(1); // the pillar itself is visible
    expect(vis[2 * fd.w + 6]).toBe(0); // directly behind it: shadow
    expect(vis[1 * fd.w + 6]).toBe(1); // above the shadow line
  });

  test("radius disc bounds visibility", () => {
    const fd = floorFromAscii([
      "###########",
      "#.........#",
      "#....@....#",
      "#.........#",
      "###########",
    ]);
    const vis = cast(fd.tiles, fd.w, fd.h, 5, 2, 2);
    expect(vis[2 * fd.w + 7]).toBe(1); // dist 2
    expect(vis[2 * fd.w + 8]).toBe(0); // dist 3 > radius
  });

  test("symmetry: vis(a→b) === vis(b→a) across seeded random maps", () => {
    let x = 0xfee1600d;
    const draw = (): number => {
      const [v, nx] = splitmix32(x);
      x = nx;
      return v;
    };
    for (let iter = 0; iter < 30; iter++) {
      const w = 12;
      const h = 12;
      const tiles = new Uint8Array(w * h).fill(Tile.FLOOR);
      for (let i = 0; i < w; i++) {
        tiles[i] = Tile.WALL;
        tiles[(h - 1) * w + i] = Tile.WALL;
        tiles[i * w] = Tile.WALL;
        tiles[i * w + (w - 1)] = Tile.WALL;
      }
      for (let i = 0; i < 20; i++) {
        const t = draw() % (w * h);
        tiles[t] = Tile.WALL;
      }
      const floors: number[] = [];
      for (let i = 0; i < w * h; i++) if (tiles[i] === Tile.FLOOR) floors.push(i);
      for (let pair = 0; pair < 40; pair++) {
        const a = floors[draw() % floors.length]!;
        const b = floors[draw() % floors.length]!;
        const visA = cast(tiles, w, h, a % w, (a / w) | 0, -1);
        const visB = cast(tiles, w, h, b % w, (b / w) | 0, -1);
        expect(visA[b], `map ${iter}: ${a}→${b}`).toBe(visB[a]);
      }
    }
  });

  test("closed door blocks; open door does not", () => {
    const closed = floorFromAscii(["#####", "#@+.#", "#####"]);
    expect(cast(closed.tiles, 5, 3, 1, 1, -1)[1 * 5 + 3]).toBe(0);
    const open = floorFromAscii(["#####", "#@o.#", "#####"]);
    expect(cast(open.tiles, 5, 3, 1, 1, -1)[1 * 5 + 3]).toBe(1);
  });
});

describe("computeVisible", () => {
  test("own tile always visible, even snuffed in the dark", () => {
    const fd = floorFromAscii(["#####", "#.@.#", "#####"]);
    const s = makeState(fd);
    const vis = computeVisible(s, 0);
    expect(vis[1 * 5 + 2]).toBe(1);
    expect(vis[1 * 5 + 1]).toBe(0);
  });

  test("distant lit brazier glows through LOS at radius 0", () => {
    const fd = floorFromAscii(["##########", "#@.....B.#", "##########"]);
    const s = makeState(fd);
    const vis = computeVisible(s, 0);
    expect(vis[1 * 10 + 7]).toBe(1); // the brazier tile itself glows
    expect(vis[1 * 10 + 6]).toBe(1); // its aura, in LOS
    expect(vis[1 * 10 + 2]).toBe(0); // dark corridor between
  });

  test("wall hides brazier glow (no LOS)", () => {
    const fd = floorFromAscii(["##########", "#@..#..B.#", "##########"]);
    const s = makeState(fd);
    const vis = computeVisible(s, 0);
    expect(vis[1 * 10 + 7]).toBe(0);
  });
});
