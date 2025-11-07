// index.js
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY || "";
// Optional: allow a proxy header for RoProxy if you use that service (not required)
const USE_ROROXY = process.env.USE_ROROXY === "1";

if (!ROBLOX_API_KEY) {
  console.warn("Warning: ROBLOX_API_KEY is not set. Some Cloud endpoints will fail.");
}

// helper to call Roblox Cloud APIs with x-api-key header
function cloudRequestOptions() {
  return {
    headers: {
      "x-api-key": ROBLOX_API_KEY,
      "User-Agent": "MyGamePassFetcher/1.0"
    },
    timeout: 10_000
  };
}

/**
 * GET /api/created-gamepasses/:userId
 * Fetches gamepasses created by the user via:
 *   https://apis.roblox.com/game-passes/v1/users/{userId}/game-passes?count=100&exclusiveStartId={startId}
 * Will page until no more results (or until a safety cap).
 */
app.get("/api/created-gamepasses/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!/^\d+$/.test(userId)) return res.status(400).json({ error: "userId must be numeric" });

    const results = [];
    let exclusiveStartId = "";
    const pageLimit = 100; // count param
    const safetyPages = 50; // safety cap: 50 pages => 5000 items max
    let pages = 0;
    const base = USE_ROROXY ? "https://rproxy.org/http://apis.roblox.com" : "https://apis.roblox.com";

    while (pages < safetyPages) {
      const url = `${base}/game-passes/v1/users/${userId}/game-passes?count=${pageLimit}${exclusiveStartId ? `&exclusiveStartId=${exclusiveStartId}` : ""}`;
      const resp = await axios.get(url, cloudRequestOptions());
      const body = resp.data;

      // body expected to contain an array of gamepasses (or items) and maybe a 'nextExclusiveStartId'
      if (Array.isArray(body.data)) {
        results.push(...body.data);
      } else if (Array.isArray(body)) {
        // fallback if API returns an array directly
        results.push(...body);
      } else if (body.gamePasses) {
        // other possible name
        results.push(...body.gamePasses);
      } else {
        // push whatever we can
        if (body.items) results.push(...body.items);
      }

      // try to detect a cursor / next id
      const nextId = body.nextExclusiveStartId || body.nextCursor || (body.meta && body.meta.nextExclusiveStartId) || null;
      if (!nextId) break;
      exclusiveStartId = nextId;
      pages += 1;
    }

    res.json({ ok: true, count: results.length, results });

  } catch (err) {
    console.error("created-gamepasses error:", err?.response?.data || err.message || err);
    const status = err?.response?.status || 500;
    res.status(status).json({ ok: false, error: err?.response?.data || err.message || "request failed" });
  }
});

/**
 * GET /api/owns/:userId/:gamePassId
 * Best-effort ownership check using inventory endpoint:
 *   https://inventory.roblox.com/v1/users/{userId}/items/GamePass/{gamePassId}
 * Some community posts indicate inventory behavior has changed for gamepasses; results may vary.
 */
app.get("/api/owns/:userId/:gamePassId", async (req, res) => {
  try {
    const { userId, gamePassId } = req.params;
    if (!/^\d+$/.test(userId) || !/^\d+$/.test(gamePassId)) {
      return res.status(400).json({ error: "userId and gamePassId must be numeric" });
    }

    // inventory endpoint is not Cloud API; it's inventory.roblox.com (no x-api-key needed)
    const inventoryUrl = `https://inventory.roblox.com/v1/users/${userId}/items/GamePass/${gamePassId}`;
    const resp = await axios.get(inventoryUrl, { timeout: 10000, headers: { "User-Agent": "MyGamePassFetcher/1.0" } });

    const body = resp.data;
    // If response has data array or totalCount etc.
    // The old behavior: data array empty => doesn't own; non-empty => owns
    if (body && Array.isArray(body.data)) {
      const owns = body.data.length > 0;
      return res.json({ ok: true, owns, raw: body });
    }

    // Fallback checks: some responses use 'total' or 'totalCount'
    if (body && (body.totalCount || body.total || body.count)) {
      const count = body.totalCount || body.total || body.count;
      return res.json({ ok: true, owns: count > 0, count, raw: body });
    }

    // If we can't interpret, return 'unknown' with raw response
    res.json({ ok: false, owns: "unknown", raw: body });

  } catch (err) {
    console.error("owns error:", err?.response?.data || err.message || err);
    // If 404 / empty => likely does not own
    if (err?.response?.status === 404) return res.json({ ok: true, owns: false });
    // Some endpoints may block gamepass ownership checks; surface the raw response
    const status = err?.response?.status || 500;
    return res.status(status).json({ ok: false, error: err?.response?.data || err.message || "request failed" });
  }
});

app.get("/", (req,res) => res.json({ ok: true, message: "Roblox Gamepass API wrapper. See /api/*" }));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
