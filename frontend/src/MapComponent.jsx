import { useEffect, useRef, useState } from "react";

const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || "";
let _loaded = false, _promise = null;

function loadGoogleMaps(key) {
  if (_loaded) return Promise.resolve();
  if (_promise) return _promise;
  _promise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&language=en&region=US&v=weekly`;
    s.async = true; s.defer = true;
    s.onload  = () => { _loaded = true; resolve(); };
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
  return _promise;
}

const DARK_STYLE = [
  { elementType: "geometry",                stylers: [{ color: "#1a1f2e" }] },
  { elementType: "labels.text.stroke",      stylers: [{ color: "#1a1f2e" }] },
  { elementType: "labels.text.fill",        stylers: [{ color: "#c9d1d9" }] },
  { featureType: "road",                    elementType: "geometry",         stylers: [{ color: "#2d3347" }] },
  { featureType: "road",                    elementType: "labels.text.fill", stylers: [{ color: "#8b949e" }] },
  { featureType: "road.highway",            elementType: "geometry",         stylers: [{ color: "#3d4f6e" }] },
  { featureType: "road.highway",            elementType: "labels.text.fill", stylers: [{ color: "#adbdd0" }] },
  { featureType: "water",                   elementType: "geometry",         stylers: [{ color: "#0d1117" }] },
  { featureType: "poi",                     stylers: [{ visibility: "off"  }] },
  { featureType: "transit",                 stylers: [{ visibility: "off"  }] },
  { featureType: "administrative",          elementType: "geometry",         stylers: [{ color: "#30363d" }] },
  { featureType: "administrative.country",  elementType: "labels.text.fill", stylers: [{ color: "#8b949e" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#c9d1d9" }] },
];

export default function MapComponent({ from, to, waypoints=[], fullRoadPath, activeRoutes=[], totalDistanceKm, activeSegmentData, tourSegments=[] }) {
  const mapRef   = useRef(null);
  const gMap     = useRef(null);
  const markers  = useRef([]);
  const lines    = useRef([]);
  const infoWins = useRef([]);
  const [error, setError] = useState("");

  // Init map
  useEffect(() => {
    if (!GOOGLE_KEY) { setError("Add VITE_GOOGLE_MAPS_KEY to frontend/.env"); return; }
    loadGoogleMaps(GOOGLE_KEY).then(() => {
      if (gMap.current) return;
      gMap.current = new window.google.maps.Map(mapRef.current, {
        center: { lat: 15, lng: 80 }, zoom: 6,
        styles: DARK_STYLE, mapTypeId: "roadmap",
        mapTypeControl: false, streetViewControl: false,
        fullscreenControl: true, zoomControl: true, gestureHandling: "greedy",
      });
    }).catch(e => setError(e.message));
  }, []);

  // Markers
  useEffect(() => {
    if (!gMap.current) return;
    markers.current.forEach(m => m.setMap(null)); markers.current = [];
    const pins = [
      ...(from ? [{ loc: from, label: "A", color: "#0A84FF" }] : []),
      ...waypoints.map((w,i) => ({ loc: w, label: String(i+2), color: "#F59E0B" })),
      ...(to   ? [{ loc: to,   label: "B", color: "#10B981" }] : []),
    ];
    if (!pins.length) return;
    const bounds = new window.google.maps.LatLngBounds();
    pins.forEach(({ loc, label, color }) => {
      const m = new window.google.maps.Marker({
        position: { lat: loc.lat, lng: loc.lng }, map: gMap.current,
        label: { text: label, color: "#fff", fontWeight: "bold", fontSize: "13px" },
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 18, fillColor: color, fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2.5 },
        title: loc.name, zIndex: 10,
      });
      const info = new window.google.maps.InfoWindow({
        content: `<div style="font-family:sans-serif;font-size:13px;padding:4px 6px"><b>${loc.name}</b></div>`,
      });
      m.addListener("click", () => info.open(gMap.current, m));
      markers.current.push(m);
      bounds.extend({ lat: loc.lat, lng: loc.lng });
    });
    if (!fullRoadPath?.length && !activeRoutes.length) gMap.current.fitBounds(bounds, 80);
  }, [from, to, waypoints]);

  // Main drawing effect — handles both full tour and segment view
  useEffect(() => {
    if (!gMap.current) return;
    lines.current.forEach(p => p.setMap(null)); lines.current = [];
    infoWins.current.forEach(w => w.close()); infoWins.current = [];

    const bounds = new window.google.maps.LatLngBounds();

    if (activeRoutes.length > 0) {
      // ── SEGMENT VIEW: show all alternative routes ──
      // Draw full tour faintly in background
      if (fullRoadPath?.length) {
        const path = fullRoadPath.map(([lat,lng]) => ({ lat, lng }));
        lines.current.push(new window.google.maps.Polyline({
          path, strokeColor: "#0A84FF", strokeOpacity: 0.12, strokeWeight: 3, map: gMap.current, zIndex: 0,
        }));
      }

      // Draw all alternative routes — blue first (under), then red (on top)
      const otherRoutes  = activeRoutes.filter(r => !r.isShortest);
      const shortestRoute = activeRoutes.find(r => r.isShortest);

      // Blue — other routes
      otherRoutes.forEach((route, i) => {
        const path = route.geometry.map(([lat,lng]) => ({ lat, lng }));
        path.forEach(p => bounds.extend(p));

        lines.current.push(new window.google.maps.Polyline({
          path, strokeColor: "#3b82f6", strokeOpacity: 0.75, strokeWeight: 5,
          map: gMap.current, zIndex: 1,
        }));

        // Info label on blue route
        const mid = path[Math.floor(path.length / 2)];
        const iw  = new window.google.maps.InfoWindow({
          content: `<div style="font-family:sans-serif;font-size:12px;padding:3px 7px;text-align:center">
            <span style="color:#3b82f6;font-weight:700">🔵 Route ${i+1}</span><br>
            <b>${route.distance} km</b> · ${route.duration}
          </div>`,
          position: mid,
        });
        iw.open(gMap.current);
        infoWins.current.push(iw);
      });

      // Red — shortest/optimal route (drawn on top)
      if (shortestRoute) {
        const path = shortestRoute.geometry.map(([lat,lng]) => ({ lat, lng }));
        path.forEach(p => bounds.extend(p));

        // Shadow
        lines.current.push(new window.google.maps.Polyline({
          path, strokeColor: "#000", strokeOpacity: 0.2, strokeWeight: 9, map: gMap.current, zIndex: 2,
        }));
        // Red line
        lines.current.push(new window.google.maps.Polyline({
          path, strokeColor: "#ef4444", strokeOpacity: 1, strokeWeight: 6, map: gMap.current, zIndex: 3,
        }));

        const mid = path[Math.floor(path.length / 2)];
        const iw  = new window.google.maps.InfoWindow({
          content: `<div style="font-family:sans-serif;font-size:12px;padding:3px 7px;text-align:center">
            <span style="color:#ef4444;font-weight:700">🔴 Shortest Route</span><br>
            <b>${shortestRoute.distance} km</b> · ${shortestRoute.duration}
          </div>`,
          position: mid,
        });
        iw.open(gMap.current);
        infoWins.current.push(iw);
      }

      gMap.current.fitBounds(bounds, 80);

    } else if (fullRoadPath?.length) {
      // ── FULL TOUR VIEW: show optimal tour in red ──
      // Show all segment paths in blue first
      tourSegments.forEach(seg => {
        if (seg.shortestGeometry?.length) {
          // already part of optimal — will draw red on top
        }
        // Draw other routes for each segment in blue (faint)
        seg.routes?.filter(r => !r.isShortest).forEach(r => {
          const path = r.geometry.map(([lat,lng]) => ({ lat, lng }));
          lines.current.push(new window.google.maps.Polyline({
            path, strokeColor: "#3b82f6", strokeOpacity: 0.25, strokeWeight: 3,
            map: gMap.current, zIndex: 0,
          }));
        });
      });

      // Draw the full optimal tour in red on top
      const path = fullRoadPath.map(([lat,lng]) => ({ lat, lng }));
      path.forEach(p => bounds.extend(p));

      lines.current.push(new window.google.maps.Polyline({
        path, strokeColor: "#000", strokeOpacity: 0.2, strokeWeight: 8, map: gMap.current, zIndex: 1,
      }));
      lines.current.push(new window.google.maps.Polyline({
        path, strokeColor: "#ef4444", strokeOpacity: 0.95, strokeWeight: 5, map: gMap.current, zIndex: 2,
      }));

      gMap.current.fitBounds(bounds, 60);
    }
  }, [fullRoadPath, activeRoutes, tourSegments]);

  if (!GOOGLE_KEY) return (
    <div style={{height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,color:"#8b949e",fontSize:13,background:"#0d1117"}}>
      <span style={{fontSize:44}}>🗺️</span>
      <span>Add <code style={{background:"#21262d",padding:"2px 6px",borderRadius:4}}>VITE_GOOGLE_MAPS_KEY</code> to frontend/.env</span>
    </div>
  );
  if (error) return (
    <div style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center",color:"#f85149",fontSize:13}}>⚠ {error}</div>
  );

  return (
    <div style={{position:"relative",height:"100%",width:"100%"}}>
      <div ref={mapRef} style={{height:"100%",width:"100%",borderRadius:"12px"}}/>

      {/* Legend */}
      {(fullRoadPath?.length || activeRoutes.length > 0) && (
        <div style={{
          position:"absolute", top:24, right:24, zIndex:999,
          background:"rgba(11,15,26,0.93)", backdropFilter:"blur(10px)",
          border:"1px solid #1E2D42", borderRadius:10,
          padding:"10px 14px", pointerEvents:"none",
        }}>
          <div style={{fontSize:10,color:"#6B7C99",marginBottom:6,letterSpacing:"0.8px",textTransform:"uppercase",fontFamily:"sans-serif"}}>Legend</div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,fontFamily:"sans-serif",fontSize:12}}>
            <div style={{width:24,height:4,background:"#ef4444",borderRadius:2}}/>
            <span style={{color:"#e8edf5"}}>Optimal / Shortest Route</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,fontFamily:"sans-serif",fontSize:12}}>
            <div style={{width:24,height:4,background:"#3b82f6",borderRadius:2}}/>
            <span style={{color:"#e8edf5"}}>Alternative Routes</span>
          </div>
        </div>
      )}

      {/* Distance badge */}
      {totalDistanceKm && !activeRoutes.length && (
        <div style={{
          position:"absolute",bottom:30,right:24,zIndex:999,
          background:"rgba(11,15,26,0.93)",backdropFilter:"blur(10px)",
          border:"1.5px solid rgba(239,68,68,.4)",borderRadius:12,
          padding:"12px 20px",textAlign:"center",pointerEvents:"none",
          boxShadow:"0 4px 20px rgba(0,0,0,.4)",
        }}>
          <div style={{fontSize:28,fontWeight:800,color:"#ef4444",fontFamily:"sans-serif",lineHeight:1}}>{totalDistanceKm} km</div>
          <div style={{fontSize:10,color:"#6B7C99",marginTop:4,fontFamily:"sans-serif",letterSpacing:"0.8px",textTransform:"uppercase"}}>Optimal road distance</div>
        </div>
      )}

      {/* Segment comparison badge */}
      {activeSegmentData && activeRoutes.length > 0 && (
        <div style={{
          position:"absolute",bottom:30,right:24,zIndex:999,
          background:"rgba(11,15,26,0.93)",backdropFilter:"blur(10px)",
          border:"1.5px solid #1E2D42",borderRadius:12,
          padding:"12px 16px",pointerEvents:"none",
          boxShadow:"0 4px 20px rgba(0,0,0,.4)",minWidth:190,
        }}>
          <div style={{fontSize:10,color:"#6B7C99",marginBottom:8,fontFamily:"sans-serif",letterSpacing:"0.8px",textTransform:"uppercase"}}>Route comparison</div>
          {activeRoutes.map((r,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5,fontFamily:"sans-serif"}}>
              <div style={{width:12,height:12,borderRadius:"50%",background:r.isShortest?"#ef4444":"#3b82f6",flexShrink:0}}/>
              <div>
                <span style={{fontSize:12,color:r.isShortest?"#ef4444":"#3b82f6",fontWeight:r.isShortest?700:400}}>
                  {r.isShortest ? "Shortest" : `Route ${i+1}`}
                </span>
                <span style={{fontSize:12,color:"#e8edf5",marginLeft:6}}>{r.distance} km · {r.duration}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
