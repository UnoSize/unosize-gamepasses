import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("✅ Roblox Proxy API is running!");
});

// Example: /proxy?url=https://apis.roblox.com/game-passes/v1/universes/12345/game-passes?passView=Full&pageSize=30
app.get("/proxy", async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: "Missing 'url' parameter" });

  try {
    const response = await fetch(targetUrl, {
      headers: { "User-Agent": "Roblox-Proxy" },
    });

    const data = await response.text();
    res.set("Access-Control-Allow-Origin", "*");
    res.type("application/json");
    res.send(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch data", details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy running on port ${PORT}`);
});
