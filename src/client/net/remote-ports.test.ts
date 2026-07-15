// createRemotePorts — hydration, rule-cache behavior, descend caching, corpse
// yields, bank/end sequencing (08 §7). The api module is mocked; the shadow
// sim underneath runs the real shared engine.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  floorFromWire,
  floorToWire,
  type ActRes,
  type CodexEntryWire,
  type DayRes,
  type FloorWire,
  type StartRes,
} from "../../shared/protocol.js";
import { initState, tick } from "../../shared/sim/engine.js";
import { fromB64, h32Hex, packActions, toB64, unpackActions } from "../../shared/sim/pack.js";
import {
  Action,
  Status,
  Tile,
  isRuleRequest,
  type FloorData,
  type Step,
} from "../../shared/sim/types.js";
import {
  ApiError,
  apiCodex,
  apiDay,
  apiRunAct,
  apiRunBank,
  apiRunDescend,
  apiRunEnd,
  apiRunStart,
} from "./api.js";
import { createRemotePorts, VaultRefusal } from "./remote-ports.js";

vi.mock("./api.js", async (importOriginal) => {
  const orig = await importOriginal<typeof import("./api.js")>();
  return {
    ...orig,
    apiDay: vi.fn(),
    apiRunStart: vi.fn(),
    apiRunAct: vi.fn(),
    apiRunDescend: vi.fn(),
    apiRunBank: vi.fn(),
    apiRunEnd: vi.fn(),
    apiCodex: vi.fn(),
  };
});

const mDay = vi.mocked(apiDay);
const mStart = vi.mocked(apiRunStart);
const mAct = vi.mocked(apiRunAct);
const mDescend = vi.mocked(apiRunDescend);
const mBank = vi.mocked(apiRunBank);
const mEnd = vi.mocked(apiRunEnd);
const mCodex = vi.mocked(apiCodex);

const TOKEN = "0123456789abcdef0123456789abcdef";

function makeFloorWire(floor: number, corpseIds: string[] = [], stairsUnderfoot = false): FloorWire {
  const w = 8;
  const h = 8;
  const tiles = new Uint8Array(w * h).fill(Tile.FLOOR);
  if (stairsUnderfoot) tiles[2 * w + 2] = Tile.STAIRS_DOWN; // px/py = 2,2
  const fd: FloorData = { floor, w, h, tiles, px: 2, py: 2, entities: [], nextEntityId: 1 };
  const rng = new Uint32Array(20);
  for (let i = 0; i < 20; i++) rng[i] = (0x9e3779b9 * (i + 1)) >>> 0;
  return floorToWire(fd, rng, {
    signContents: [{ tileIndex: 9, template: 1, noun: 2 }],
    echoes: [{ day: 2, floor, frames: [[1, 1, 0]] }],
    corpseIds,
  });
}

function dayRes(): DayRes {
  return {
    day: 3,
    gatePct: 27,
    codexPct: 10,
    fallenToday: 4,
    teaser: "the dark hums low",
    houseLine: "⚑ House Ash · Ash III awaits",
  };
}

function startRes(): StartRes {
  return {
    token: TOKEN,
    day: 3,
    resumed: false,
    setup: {
      mods: {
        graceTicks: 25,
        burnBasic: 1,
        radiusPenalty: 0,
        quietFeet: 0,
        beastEar: 1,
        echoRadius: 0,
      },
      heirloom: 0,
      noSalt: false,
    },
    floor: makeFloorWire(1),
  };
}

const RAT_ENTRY: CodexEntryWire = {
  ruleKey: "rat|bump|salt",
  effect: 4,
  status: "true",
  confirms: 2,
  day: 1,
};

function okAct(serverTick: number): ActRes {
  return { serverTick, events: [], rules: [], corpses: [] };
}

beforeEach(() => {
  vi.useFakeTimers();
  mDay.mockResolvedValue(dayRes());
  mStart.mockResolvedValue(startRes());
  mCodex.mockResolvedValue({ entries: [RAT_ENTRY], page: 0, pageCount: 1 });
  mAct.mockImplementation(async (req) =>
    okAct(req.fromTick + unpackActions(fromB64(req.actions)).length),
  );
  mDescend.mockResolvedValue({ floor: makeFloorWire(2), serverTick: 0 });
  mBank.mockResolvedValue({ entries: [] });
  mEnd.mockResolvedValue({
    day: 3,
    floor: 1,
    cause: 1,
    generation: 2,
    epitaphLine: "The dark took them.",
    unbanked: [],
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("hydration", () => {
  it("apiDay → apiRunStart → apiCodex fills the sync read model", async () => {
    const ports = await createRemotePorts();
    expect(ports.getGuildhall()).toEqual({
      day: 3,
      omenRumor: "the dark hums low",
      gatePct: 27,
      codexPct: 10,
      fallenToday: 4,
      houseLine: "⚑ House Ash · Ash III awaits",
    });
    expect(ports.getHouse()).toBe("Ash"); // parsed from the houseLine
    expect(ports.getRunSetup()).toEqual({
      mods: startRes().setup.mods,
      heirloom: 0,
      noSalt: false,
    });
    const codex = ports.getCodex();
    expect(codex).toHaveLength(1);
    expect(codex[0]!.subject).toBe("a Tallow Rat"); // derived via describeRuleKey (C8)
    expect(mDescend).not.toHaveBeenCalled(); // nothing to hydrate on a fresh run
    expect(ports.getResume!()).toBeNull(); // fresh runs carry no adoption
  });

  it("getFloor(1) serves the decoded start payload; unfetched floors throw", async () => {
    const ports = await createRemotePorts();
    const f1 = ports.getFloor(1);
    expect(f1.floorData.floor).toBe(1);
    expect(f1.floorData.w).toBe(8);
    expect(f1.echoes).toEqual([{ day: 2, floor: 1, frames: [{ x: 1, y: 1, candle: 0 }] }]);
    expect(() => ports.getFloor(2)).toThrow(/not hydrated/);
  });

  it("payload signs merge with signs placed this session", async () => {
    const ports = await createRemotePorts();
    ports.signPlaced(1, 12, 2, 5);
    expect(ports.getSigns(1)).toEqual([
      { tileIndex: 9, template: 1, noun: 2 },
      { tileIndex: 12, template: 2, noun: 5 },
    ]);
  });
});

describe("mid-run resume (M2b)", () => {
  const RESUME_LEARNED = [{ key: "rat|bump|torch", effect: 2 }];
  const THREE_WAITS: Step[] = [
    { op: Action.WAIT, arg: 0 },
    { op: Action.WAIT, arg: 0 },
    { op: Action.WAIT, arg: 0 },
  ];

  function resumedStart(steps: Step[], floor = 1, banked: string[] = []): StartRes {
    return {
      ...startRes(),
      resumed: true,
      resume: {
        log: steps.length === 0 ? "" : toB64(packActions(steps)),
        floor,
        learned: RESUME_LEARNED,
        banked,
      },
    };
  }

  it("replays the log and reproduces the exact replayed state (hash-identical)", async () => {
    mStart.mockResolvedValue(resumedStart(THREE_WAITS, 1, ["rat|bump|torch"]));
    const ports = await createRemotePorts();
    const resume = ports.getResume!();
    expect(resume).not.toBeNull();

    // reference replay: same wire floor, same setup, same steps
    const { floorData, rngInit } = floorFromWire(makeFloorWire(1));
    let state = initState(floorData, rngInit, startRes().setup);
    for (const s of THREE_WAITS) {
      const r = tick(state, s, { get: () => undefined });
      if (isRuleRequest(r)) throw new Error("unexpected RuleRequest");
      state = r.state;
    }
    expect(h32Hex(resume!.state)).toBe(h32Hex(state));
    expect(resume!.state.tick).toBe(3);
    expect(resume!.floor.floorData.floor).toBe(1); // the CURRENT floor's payload
    expect(resume!.learned).toEqual(RESUME_LEARNED);
    expect(resume!.banked).toEqual(["rat|bump|torch"]);
  });

  it("is consume-once: the second getResume() returns null", async () => {
    mStart.mockResolvedValue(resumedStart(THREE_WAITS));
    const ports = await createRemotePorts();
    expect(ports.getResume!()).not.toBeNull();
    expect(ports.getResume!()).toBeNull();
  });

  it("seeds the rule cache from resume.learned — table misses never round-trip", async () => {
    mStart.mockResolvedValue(resumedStart(THREE_WAITS));
    const ports = await createRemotePorts();
    expect(ports.resolveRule("rat|bump|torch")).toBe(2);
    await expect(ports.resolveRuleAsync!("rat|bump|torch")).resolves.toBe(2);
    expect(mAct).not.toHaveBeenCalled();
  });

  it("continues the batcher fromTick at the replayed step count", async () => {
    mStart.mockResolvedValue(resumedStart(THREE_WAITS));
    const ports = await createRemotePorts();
    ports.actApplied!(Action.WAIT, 0, 3);
    await ports.reportExitAsync!();
    expect(mAct).toHaveBeenCalledTimes(1);
    const req = mAct.mock.calls[0]![0];
    expect(req.fromTick).toBe(3); // steps the server already holds
    expect(unpackActions(fromB64(req.actions))).toEqual([{ op: Action.WAIT, arg: 0 }]);
  });

  it("a resumed run with zero steps boots fresh: getResume() is null", async () => {
    mStart.mockResolvedValue(resumedStart([]));
    const ports = await createRemotePorts();
    expect(ports.getResume!()).toBeNull();
    expect(ports.getFloor(1).floorData.floor).toBe(1);
    expect(mDescend).not.toHaveBeenCalled(); // floor 1 arrived with /start
  });

  it("multi-floor: re-serves earlier floors and pre-crosses an acknowledged descend", async () => {
    // the run descended: log = [DESCEND] off floor 1's stairs, /descend acked (row.floor = 2)
    const floor1 = makeFloorWire(1, [], true /* stairs underfoot */);
    const floor2 = makeFloorWire(2);
    mStart.mockResolvedValue({ ...resumedStart([{ op: Action.DESCEND, arg: 0 }], 2), floor: floor2 });
    mDescend.mockImplementation(async (_token, toFloor) => ({
      floor: toFloor === 1 ? floor1 : floor2,
      serverTick: 1,
    }));

    const ports = await createRemotePorts();
    expect(mDescend).toHaveBeenCalledTimes(1); // floor 1 via idempotent re-serve
    expect(mDescend).toHaveBeenCalledWith(TOKEN, 1);

    const resume = ports.getResume!();
    expect(resume).not.toBeNull();
    expect(resume!.state.status).toBe(Status.ALIVE); // the acked descend is resolved
    expect(resume!.state.floor).toBe(2);
    expect(resume!.floor.floorData.floor).toBe(2);
  });

  it("refuses a resumed response that carries no resume payload", async () => {
    mStart.mockResolvedValue({ ...startRes(), resumed: true });
    await expect(createRemotePorts()).rejects.toBeInstanceOf(VaultRefusal);
  });
});

describe("rule cache", () => {
  it("resolveRuleAsync: flush carries the pending acts, ActRes.rules answers", async () => {
    const ports = await createRemotePorts();
    ports.actApplied!(Action.WAIT, 0, 0);
    ports.actApplied!(Action.INTERACT_N, 0, 1); // the act that hit the unknown rule
    mAct.mockResolvedValue({
      serverTick: 2,
      events: [],
      rules: [
        { key: "rat|bump|torch", effect: 2 },
        { key: "moth|touch|flame", effect: 3 },
      ],
      corpses: [],
    });

    const effect = await ports.resolveRuleAsync!("rat|bump|torch");
    expect(effect).toBe(2);
    expect(mAct).toHaveBeenCalledTimes(1);
    const req = mAct.mock.calls[0]![0];
    expect(req.fromTick).toBe(0);
    expect(unpackActions(fromB64(req.actions))).toEqual([
      { op: Action.WAIT, arg: 0 },
      { op: Action.INTERACT_N, arg: 0 },
    ]);
  });

  it("caches every returned rule: later resolveRule/resolveRuleAsync calls skip the wire", async () => {
    const ports = await createRemotePorts();
    ports.actApplied!(Action.WAIT, 0, 0);
    mAct.mockResolvedValue({
      serverTick: 1,
      events: [],
      rules: [
        { key: "rat|bump|torch", effect: 2 },
        { key: "moth|touch|flame", effect: 3 },
      ],
      corpses: [],
    });
    await ports.resolveRuleAsync!("rat|bump|torch");

    expect(ports.resolveRule("moth|touch|flame")).toBe(3); // superset cache fill
    await expect(ports.resolveRuleAsync!("moth|touch|flame")).resolves.toBe(3);
    expect(mAct).toHaveBeenCalledTimes(1); // no further round-trips
  });

  it("sync resolveRule throws only when truly unknown", async () => {
    const ports = await createRemotePorts();
    expect(() => ports.resolveRule("keeper|pickpocket|self")).toThrow(/not in the session cache/);
  });

  it("resolveRuleAsync rejects when the server never consulted the key", async () => {
    const ports = await createRemotePorts();
    await expect(ports.resolveRuleAsync!("keeper|pickpocket|self")).rejects.toThrow(
      /did not reveal/,
    );
  });
});

describe("descend", () => {
  it("getFloorAsync flushes the DESCEND act, then fetches and caches the floor", async () => {
    const ports = await createRemotePorts();
    ports.actApplied!(Action.DESCEND, 0, 0);

    const f2 = await ports.getFloorAsync!(2);
    expect(f2.floorData.floor).toBe(2);
    expect(mAct).toHaveBeenCalledTimes(1);
    expect(unpackActions(fromB64(mAct.mock.calls[0]![0].actions))).toEqual([
      { op: Action.DESCEND, arg: 0 },
    ]);
    // the act flush lands before /descend advances the run
    expect(mAct.mock.invocationCallOrder[0]!).toBeLessThan(mDescend.mock.invocationCallOrder[0]!);
    expect(mDescend).toHaveBeenCalledWith(TOKEN, 2);

    // cached: sync serve, no refetch
    expect(ports.getFloor(2).floorData.floor).toBe(2);
    await ports.getFloorAsync!(2);
    expect(mDescend).toHaveBeenCalledTimes(1);
  });

  it("a failed speculative prefetch is swallowed; the awaited fetch retries", async () => {
    const ports = await createRemotePorts();
    mDescend.mockRejectedValueOnce(new ApiError(400, "BAD_INPUT", "the delver is not upon the stairs"));

    ports.prefetchFloor!(2);
    await vi.advanceTimersByTimeAsync(0); // let the speculative miss settle

    const f2 = await ports.getFloorAsync!(2);
    expect(f2.floorData.floor).toBe(2);
    expect(mDescend).toHaveBeenCalledTimes(2);
  });

  it("prefetchFloor is idempotent per floor", async () => {
    const ports = await createRemotePorts();
    ports.prefetchFloor!(2);
    ports.prefetchFloor!(2);
    const f2 = await ports.getFloorAsync!(2); // rides the in-flight prefetch
    expect(f2.floorData.floor).toBe(2);
    expect(mDescend).toHaveBeenCalledTimes(1);
  });
});

describe("shadow checkpoint hashes", () => {
  it("a segment crossing the 32-step boundary carries a shadow-computed checkHash", async () => {
    const ports = await createRemotePorts();
    for (let i = 0; i < 32; i++) ports.actApplied!(Action.WAIT, 0, i);
    await ports.reportExitAsync!(); // force-drain, then /end

    expect(mAct).toHaveBeenCalledTimes(1);
    const req = mAct.mock.calls[0]![0];
    expect(req.fromTick).toBe(0);
    expect(unpackActions(fromB64(req.actions))).toHaveLength(32);
    expect(req.checkHash).toMatch(/^[0-9a-f]{8}$/); // real engine, real hash
    expect(mEnd).toHaveBeenCalledWith({ token: TOKEN, lastWords: "", echoFrames: [] });
  });
});

describe("bank", () => {
  it("bankClaimsAsync: flush → claims + drained confirms → server entries absorbed", async () => {
    const ports = await createRemotePorts();
    ports.actApplied!(Action.BANK, 1, 0);
    ports.confirmObservations(["moth|touch|flame", "rat|bump|salt"]);
    mBank.mockResolvedValue({
      entries: [{ ruleKey: "wickworm|bump|salt", effect: 4, status: "true", confirms: 1, day: 3 }],
    });

    const recs = await ports.bankClaimsAsync!([{ key: "wickworm|bump|salt", effect: 4 }]);
    expect(mAct).toHaveBeenCalledTimes(1); // the BANK act rode ahead
    expect(mBank).toHaveBeenCalledWith({
      token: TOKEN,
      claims: [{ key: "wickworm|bump|salt", effect: 4 }],
      confirms: ["moth|touch|flame", "rat|bump|salt"], // sorted drain
    });
    expect(recs).toHaveLength(1);
    expect(recs[0]!.status).toBe("true");
    expect(recs[0]!.subject).toBe("a Wickworm");
    expect(ports.getCodex().map((c) => c.ruleKey)).toContain("wickworm|bump|salt");

    // the confirm queue drained
    mBank.mockClear();
    mBank.mockResolvedValue({ entries: [] });
    await ports.bankClaimsAsync!([]);
    expect(mBank.mock.calls[0]![0].confirms).toEqual([]);
  });

  it("sync bankClaims returns optimistic pending rows and fires the async path", async () => {
    const ports = await createRemotePorts();
    mBank.mockResolvedValue({
      entries: [{ ruleKey: "wickworm|bump|salt", effect: 4, status: "conditional", confirms: 1, day: 3 }],
    });

    const recs = ports.bankClaims([{ key: "wickworm|bump|salt", effect: 4 }]);
    expect(recs[0]!.status).toBe("pending");
    await vi.advanceTimersByTimeAsync(0); // background bank lands
    const row = ports.getCodex().find((c) => c.ruleKey === "wickworm|bump|salt");
    expect(row?.status).toBe("conditional"); // server truth replaced the optimism
  });
});

describe("corpse yields (D51)", () => {
  it("serves synchronously from the ActRes yield cache; a miss hurries the flush", async () => {
    mStart.mockResolvedValue({ ...startRes(), floor: makeFloorWire(1, ["3-u1"]) });
    mAct.mockResolvedValue({
      serverTick: 1,
      events: [],
      rules: [],
      corpses: [
        {
          entityId: 9,
          corpseId: "3-u1",
          gift: { item: 2, charges: 1 },
          unbanked: [{ key: "shade|touch|mirror", effect: 13 }],
        },
      ],
    });
    const ports = await createRemotePorts();
    ports.actApplied!(Action.INTERACT_N, 0, 0); // the recovery act, still pending

    expect(ports.corpseRecovered(0)).toEqual({ unbanked: [], gift: null });
    await vi.advanceTimersByTimeAsync(0); // the hurried flush lands the yield

    expect(ports.corpseRecovered(0)).toEqual({
      unbanked: [{ key: "shade|touch|mirror", effect: 13 }],
      gift: { item: 2, charges: 1 },
    });
    expect(ports.resolveRule("shade|touch|mirror")).toBe(13); // unbanked joins the cache
  });
});

describe("run end", () => {
  it("reportDeathAsync flushes, then posts lastWords + clamped echo frames", async () => {
    const ports = await createRemotePorts();
    ports.actApplied!(Action.WAIT, 0, 0);

    await ports.reportDeathAsync!({
      day: 3,
      floor: 1,
      x: 2,
      y: 2,
      cause: 1,
      lastWords: "beware the third door",
      gift: null,
      unbanked: [],
      echoFrames: [{ x: 2, y: 2, candle: 0 }],
    });

    expect(mAct).toHaveBeenCalledTimes(1);
    expect(mAct.mock.invocationCallOrder[0]!).toBeLessThan(mEnd.mock.invocationCallOrder[0]!);
    expect(mEnd).toHaveBeenCalledWith({
      token: TOKEN,
      lastWords: "beware the third door",
      echoFrames: [[2, 2, 0]],
    });
    expect(ports.getGuildhall().fallenToday).toBe(5); // death noted locally
  });

  it("nextDay is a no-op (one candle per day — invariant 10)", async () => {
    const ports = await createRemotePorts();
    expect(() => ports.nextDay()).not.toThrow();
    expect(ports.getGuildhall().day).toBe(3);
  });
});
