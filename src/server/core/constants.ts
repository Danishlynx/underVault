// src/server/core/constants.ts — fixed integer constants (08 §0.3, all binding).

export const DAY_TTL_S = 172800; // 48 h  — day:* keys
export const RUN_TTL_S = 93600; // 26 h  — run:{uid}:{d}
export const CORPSE_TTL_S = 259200; // 72 h  — corpse lifetime (scores, not EXPIRE-only)
export const CHRONICLE_TTL_S = 1209600; // 14 d  (M3)
export const RUN_EXPIRY_MS = 2700000; // 45 min — token expiry after start (02 §7)
export const ACT_MIN_SPACING_MS = 1000; // act-batch rate limit per token
export const GC_GRACE_S = 3600; // corpses removed only when expiryTs < now - GRACE (08 §3.1 determinism)
export const ECHO_FLOOR_CAP = 50; // zRemRangeByRank cap (02 §5)
export const ECHO_SERVE_MAX = 8; // echoes shipped per floor payload
export const INK_AT = 5; // distinct confirmers to ink (mirrors dev adapter; 01-table cross-ref in PR)
export const MAX_RUN_STEPS = 4096; // hard ceiling on total log length per run
export const MAX_SEGMENT_STEPS = 256; // hard ceiling per act batch
export const KEY = "uv:"; // global key prefix (02 §5)
