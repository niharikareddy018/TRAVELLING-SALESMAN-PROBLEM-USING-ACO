const BASE = "/api";

export async function geocodePlace(query) {
  try {
    const res = await fetch(`${BASE}/geocode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) return data;
    }
  } catch (e) { console.warn("Geocode backend failed, using Nominatim:", e.message); }

  const r = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
    { headers: { "Accept-Language": "en" } }
  );
  const d = await r.json();
  if (!d.length) throw new Error(`Location not found: "${query}"`);
  return {
    name: d[0].display_name.split(",")[0].trim(),
    fullAddress: d[0].display_name,
    lat: parseFloat(d[0].lat),
    lng: parseFloat(d[0].lon),
  };
}

export async function solveRoute(from, to, waypoints = [], acoParams = {}) {
  const res = await fetch(`${BASE}/solve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, waypoints, acoParams }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Backend error" }));
    throw new Error(err.error || "Solve failed - check backend terminal");
  }
  return res.json();
}