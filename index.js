// ✅ Load environment variables first
require("dotenv").config();

const express = require("express");
const axios = require("axios");
const app = express();

const PORT = process.env.PORT || 3000;
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;

if (!ROBLOX_API_KEY) {
  console.warn("⚠️ Warning: ROBLOX_API_KEY is not set. Some Cloud endpoints will fail.");
}

// 🔧 Default request headers for Roblox Cloud API
function cloudRequestOptions() {
  return {
    headers: {
      "x-api-key": ROBLOX_API_KEY,
      "User-Agent": "MyRobloxGamepassFetcher/1.0"
    },
    timeout: 10000
  };
}

// 🏠 Home route (health check)
app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "✅ Roblox Gamepass API is running. Use /api/created-gamepasses/:userId or /api/owns/:userId/:gamePassId"
  });
});

// 🎮 Fetch all gamepasses created by a specific user
app.get("/api/created-gamepasses/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!/^\d+$/.test(userId)) return res.status(400).json({ error: "userId must be numeric" });

    const results = [];
    let exclusiveStartId = "";
    const pageLimit = 100;
    const safetyPages = 50;
    let pages = 0;
    const base = "https://apis.roblox.com";

    while (pages < safetyPages) {
      const url = `${base}/game-passes/v1/users/${userId}/game-passes?count=${pageLimit}${
        exclusiveStartId ? `&exclusiveStartId=${exclusiveStartId}` : ""
      }`;

      const resp = await axios.get(url, cloudRequestOptions());
      const body = resp.data;

      // Flexible handling for Roblox’s JSON responses
      if (Array.isArray(body.data)) results.push(...body.data);
      else if (Array.isArray(body.gamePasses)) results.push(...body.gamePasses);
      else if (Array.isArray(body.items)) results.push(...body.items);

      const nextId =
        body.nextExclusiveStartId ||
        body.nextCursor ||
        (body.meta && body.meta.nextExclusiveStartId);

      if (!nextId) break;
      exclusiveStartId = nextId;
      pages++;
    }

    res.json({ ok: true, count: results.length, results });
  } catch (err) {
    console.error("❌ Error:", err?.response?.data || err.message || err);
    res
      .status(err?.response?.status || 500)
      .json({ ok: false, error: err?.response?.data || err.message });
  }
});

// 👤 Check if a player owns a gamepass
app.get("/api/owns/:userId/:gamePassId", async (req, res) => {
  try {
    const { userId, gamePassId } = req.params;
    if (!/^\d+$/.test(userId) || !/^\d+$/.test(gamePassId)) {
      return res.status(400).json({ error: "userId and gamePassId must be numeric" });
    }

    const inventoryUrl = `https://inventory.roblox.com/v1/users/${userId}/items/GamePass/${gamePassId}`;
    const resp = await axios.get(inventoryUrl, {
      timeout: 10000,
      headers: { "User-Agent": "MyRobloxGamepassFetcher/1.0" }
    });

    const body = resp.data;

    if (body && Array.isArray(body.data)) {
      return res.json({ ok: true, owns: body.data.length > 0, raw: body });
    }

    if (body && (body.totalCount || body.total || body.count)) {
      const count = body.totalCount || body.total || body.count;
      return res.json({ ok: true, owns: count > 0, count, raw: body });
    }

    res.json({ ok: false, owns: "unknown", raw: body });
  } catch (err) {
    console.error("❌ Error:", err?.response?.data || err.message || err);
    if (err?.response?.status === 404) return res.json({ ok: true, owns: false });
    res
      .status(err?.response?.status || 500)
      .json({ ok: false, error: err?.response?.data || err.message });
  }
});

// 🚀 Start server
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
