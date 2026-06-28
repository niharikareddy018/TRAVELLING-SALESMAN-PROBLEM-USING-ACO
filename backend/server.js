require("dotenv").config();

const express    = require("express");
const cors       = require("cors");
const bodyParser = require("body-parser");
const http       = require("http");
const https      = require("https");
const ACO        = require("./aco");

const app        = express();
const PORT       = process.env.PORT || 5000;
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY || "";

app.use(cors());
app.use(bodyParser.json());

/* ─────────────────────────────────────────
   POST /api/geocode
───────────────────────────────────────── */
app.post("/api/geocode", async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: "query required" });

    if (GOOGLE_KEY) {
      const url  = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&language=en&key=${GOOGLE_KEY}`;
      const data = await httpsGet(url);
      if (data.status === "OK" && data.results.length) {
        const r = data.results[0];
        return res.json({
          success: true,
          name: r.address_components[0].long_name,
          fullAddress: r.formatted_address,
          lat: r.geometry.location.lat,
          lng: r.geometry.location.lng,
        });
      }
    }

    // Fallback: Nominatim
    const url  = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&accept-language=en`;
    const data = await httpsGet(url);
    if (!data.length) return res.status(404).json({ error: `Location not found: "${query}"` });
    return res.json({
      success: true,
      name: data[0].display_name.split(",")[0].trim(),
      fullAddress: data[0].display_name,
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    });
  } catch (e) {
    console.error("Geocode error:", e.message);
    return res.status(500).json({ error: e.message });
  }
});

/* ─────────────────────────────────────────────────────────
   POST /api/routes-between
   Get ALL available routes between two points via OSRM
   (OSRM returns up to 3 alternative routes)
   Body: { from: {name,lat,lng}, to: {name,lat,lng} }
───────────────────────────────────────────────────────── */
app.post("/api/routes-between", async (req, res) => {
  try {
    const { from, to } = req.body;
    if (!from || !to) return res.status(400).json({ error: "from and to required" });

    const url  = `http://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?alternatives=true&overview=full&geometries=geojson&steps=false`;
    const data = await httpGet(url);

    if (data.code !== "Ok" || !data.routes.length)
      return res.status(500).json({ error: "No routes found" });

    const routes = data.routes.map((r, i) => ({
      index:    i,
      distance: Math.round(r.distance / 100) / 10, // km
      duration: formatDuration(r.duration),
      durationSec: r.duration,
      geometry: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      isShortest: false,
    }));

    // Mark shortest by distance
    const shortestIdx = routes.reduce((minI, r, i, arr) =>
      r.distance < arr[minI].distance ? i : minI, 0);
    routes[shortestIdx].isShortest = true;

    return res.json({ success: true, from: from.name, to: to.name, routes });
  } catch (e) {
    console.error("Routes-between error:", e.message);
    return res.status(500).json({ error: e.message });
  }
});

/* ─────────────────────────────────────────────────────────
   POST /api/solve
   Step 1 → OSRM alternatives for every pair → pick shortest
   Step 2 → ACO on shortest distance matrix
   Step 3 → Return optimal tour + all route alternatives
───────────────────────────────────────────────────────── */
app.post("/api/solve", async (req, res) => {
  try {
    const { from, to, waypoints = [], acoParams = {} } = req.body;
    if (!from || !to) return res.status(400).json({ error: "from and to are required" });

    const allLocations = [from, ...waypoints, to];
    const n            = allLocations.length;

    // ── Step 1: Get ALL routes for every pair, pick shortest ──
    console.log(`\n[1/3] Fetching all route alternatives for ${n} cities...`);
    const distMatrix     = Array.from({ length: n }, () => Array(n).fill(0));
    const pairRoutes     = {}; // store all alternatives per pair

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        try {
          const url  = `http://router.project-osrm.org/route/v1/driving/${allLocations[i].lng},${allLocations[i].lat};${allLocations[j].lng},${allLocations[j].lat}?alternatives=true&overview=full&geometries=geojson`;
          const data = await httpGet(url);

          if (data.code === "Ok" && data.routes.length) {
            const routes = data.routes.map((r, idx) => ({
              index:       idx,
              distance:    Math.round(r.distance / 100) / 10,
              distanceM:   r.distance,
              duration:    formatDuration(r.duration),
              durationSec: r.duration,
              geometry:    r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
              isShortest:  false,
            }));

            // Pick shortest
            const shortestIdx = routes.reduce((minI, r, i, arr) =>
              r.distanceM < arr[minI].distanceM ? i : minI, 0);
            routes[shortestIdx].isShortest = true;

            pairRoutes[`${i}-${j}`] = routes;
            distMatrix[i][j] = routes[shortestIdx].distanceM; // metres for ACO
          } else {
            distMatrix[i][j] = haversine(allLocations[i], allLocations[j]) * 1000;
          }
        } catch (e) {
          distMatrix[i][j] = haversine(allLocations[i], allLocations[j]) * 1000;
        }
      }
    }

    // ── Step 2: ACO ──
    console.log(`[2/3] Running ACO...`);
    const aco = new ACO({
      numAnts:       acoParams.numAnts       || Math.max(25, n * 4),
      numIterations: acoParams.numIterations || 200,
      alpha:         acoParams.alpha         || 1.0,
      beta:          acoParams.beta          || 3.0,
      evaporation:   acoParams.evaporation   || 0.4,
      Q:             acoParams.Q             || 100,
    });

    const { bestRoute, history } = aco.solve(distMatrix);
    const orderedLocations = bestRoute.map(idx => allLocations[idx]);
    orderedLocations.push(orderedLocations[0]);

    // ── Step 3: Build final tour data ──
    console.log(`[3/3] Building tour result...`);
    const tourSegments     = [];
    const fullRoadPath     = [];
    let   totalDistance    = 0;

    for (let i = 0; i < bestRoute.length; i++) {
      const fromIdx  = bestRoute[i];
      const toIdx    = bestRoute[(i + 1) % bestRoute.length];
      const fromLoc  = allLocations[fromIdx];
      const toLoc    = allLocations[toIdx];
      const routes   = pairRoutes[`${fromIdx}-${toIdx}`] || [];
      const shortest = routes.find(r => r.isShortest) || routes[0];

      if (shortest) {
        fullRoadPath.push(...shortest.geometry);
        totalDistance += shortest.distanceM;
        tourSegments.push({
          from:      fromLoc.name,
          to:        toLoc.name,
          distance:  shortest.distance,
          duration:  shortest.duration,
          routes,                        // all alternatives for this segment
          shortestGeometry: shortest.geometry,
        });
      } else {
        fullRoadPath.push([fromLoc.lat, fromLoc.lng], [toLoc.lat, toLoc.lng]);
        totalDistance += distMatrix[fromIdx][toIdx];
        tourSegments.push({
          from: fromLoc.name, to: toLoc.name,
          distance: Math.round(distMatrix[fromIdx][toIdx] / 100) / 10,
          duration: "—", routes: [], shortestGeometry: [],
        });
      }
    }

    const bestDistanceKm = Math.round(totalDistance / 100) / 10;
    console.log(`✅ Total road distance: ${bestDistanceKm} km\n`);

    return res.json({
      success: true,
      bestRoute,
      bestDistance:   Math.round(totalDistance),
      bestDistanceKm,
      orderedLocations,
      fullRoadPath,
      tourSegments,   // includes all route alternatives per segment
      history,
    });

  } catch (e) {
    console.error("Solve error:", e.message);
    return res.status(500).json({ error: e.message });
  }
});

app.get("/health", (_, res) => res.json({ status: "ok", engine: "OSRM", googleKey: !!GOOGLE_KEY }));

app.listen(PORT, () => {
  console.log(`\n🐜 ACO-TSP backend  →  http://localhost:${PORT}`);
  console.log(`   Distance engine : OSRM (free, real road routing)`);
  console.log(`   Google Maps key : ${GOOGLE_KEY ? "✅ configured" : "⚠️  not set"}\n`);
});

/* ── HELPERS ── */
function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, { headers: { "User-Agent": "ACO-TSP-Solver/1.0" } }, (res) => {
      let raw = "";
      res.on("data", c => raw += c);
      res.on("end", () => { try { resolve(JSON.parse(raw)); } catch (e) { reject(new Error("Invalid JSON from OSRM")); } });
    }).on("error", reject);
  });
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "ACO-TSP-Solver/1.0" } }, (res) => {
      let raw = "";
      res.on("data", c => raw += c);
      res.on("end", () => { try { resolve(JSON.parse(raw)); } catch (e) { reject(new Error("Invalid JSON")); } });
    }).on("error", reject);
  });
}

function haversine(a, b) {
  const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180;
  const x = Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
}

function formatDuration(s) {
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60);
  return h > 0 ? `${h}h ${m}m` : `${m} mins`;
}