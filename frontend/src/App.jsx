import { useState } from "react";
import "./App.css";
import MapComponent from "./MapComponent";
import { geocodePlace, solveRoute } from "./services/distanceApi";

const DEFAULT_PARAMS = {
  numAnts: 25, numIterations: 200,
  alpha: 1.0, beta: 3.0, evaporation: 0.4, Q: 100,
};

export default function App() {
  const [fromQuery,  setFromQuery]  = useState("");
  const [toQuery,    setToQuery]    = useState("");
  const [fromLoc,    setFromLoc]    = useState(null);
  const [toLoc,      setToLoc]      = useState(null);
  const [waypoints,  setWaypoints]  = useState([]);
  const [wpQuery,    setWpQuery]    = useState("");
  const [params,     setParams]     = useState(DEFAULT_PARAMS);
  const [showParams, setShowParams] = useState(false);
  const [result,     setResult]     = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [ldFrom,     setLdFrom]     = useState(false);
  const [ldTo,       setLdTo]       = useState(false);
  const [ldWp,       setLdWp]       = useState(false);
  const [error,      setError]      = useState("");
  const [activeSegment, setActiveSegment] = useState(null); // which segment to show routes for

  async function searchFrom() {
    if (!fromQuery.trim()) return;
    setLdFrom(true); setError("");
    try { const l = await geocodePlace(fromQuery.trim()); setFromLoc(l); setResult(null); }
    catch (e) { setError(e.message); }
    finally { setLdFrom(false); }
  }

  async function searchTo() {
    if (!toQuery.trim()) return;
    setLdTo(true); setError("");
    try { const l = await geocodePlace(toQuery.trim()); setToLoc(l); setResult(null); }
    catch (e) { setError(e.message); }
    finally { setLdTo(false); }
  }

  async function addWaypoint() {
    if (!wpQuery.trim()) return;
    setLdWp(true); setError("");
    try {
      const l = await geocodePlace(wpQuery.trim());
      if (waypoints.some(w => w.name === l.name)) { setError(`"${l.name}" already added`); return; }
      setWaypoints(p => [...p, l]); setWpQuery(""); setResult(null);
    } catch (e) { setError(e.message); }
    finally { setLdWp(false); }
  }

  function swapLocations() {
    const tl = fromLoc; setFromLoc(toLoc); setToLoc(tl);
    const tq = fromQuery; setFromQuery(toQuery); setToQuery(tq);
    setResult(null);
  }

  async function handleSolve() {
    if (!fromLoc || !toLoc) { setError("Please set both From and To locations."); return; }
    setError(""); setLoading(true); setResult(null); setActiveSegment(null);
    try {
      const data = await solveRoute(fromLoc, toLoc, waypoints, params);
      setResult(data);
      if (data.tourSegments?.length > 0) setActiveSegment(0);
    } catch (e) {
      setError(e.message || "Solve failed. Is backend running?");
    } finally { setLoading(false); }
  }

  function clearAll() {
    setFromLoc(null); setToLoc(null); setWaypoints([]);
    setFromQuery(""); setToQuery(""); setWpQuery("");
    setResult(null); setError(""); setActiveSegment(null);
  }

  // Get routes for map display
  const activeRoutes = result?.tourSegments?.[activeSegment]?.routes || [];
  const allShortestPaths = result?.tourSegments?.map(s => s.shortestGeometry) || [];

  return (
    <div className="app">
      <header className="hdr">
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
          <circle cx="13" cy="13" r="12" stroke="#0A84FF" strokeWidth="1.5"/>
          <circle cx="13" cy="4" r="2.5" fill="#0A84FF"/>
          <circle cx="4" cy="21" r="2.5" fill="#10B981"/>
          <circle cx="22" cy="21" r="2.5" fill="#10B981"/>
          <path d="M13 4 L22 21 L4 21 Z" stroke="#1E293B" strokeWidth="1" fill="none"/>
          <line x1="13" y1="4" x2="13" y2="13" stroke="#0A84FF" strokeWidth="1.5" strokeDasharray="2 2"/>
        </svg>
        <span className="hdr-title">ACO — Travelling Salesman Problem Solver</span>
        <span className="hdr-badge">Ant Colony Optimization</span>
      </header>

      <div className="body">
        <aside className="sidebar">
          <div className="sb-inner">

            {/* FROM */}
            <div className="igroup">
              <label className="ilabel"><span className="dot dot-b">A</span> From</label>
              <div className="irow">
                <input className="cinput" placeholder="Starting city…" value={fromQuery}
                  onChange={e => setFromQuery(e.target.value)}
                  onKeyDown={e => e.key==="Enter" && searchFrom()}/>
                <button className="btn bblu" onClick={searchFrom} disabled={ldFrom||!fromQuery.trim()}>
                  {ldFrom ? <span className="sp"/> : "Set"}
                </button>
              </div>
              {fromLoc && (
                <div className="confirmed">
                  <span className="ck">✓</span>
                  <span className="cname">{fromLoc.name}</span>
                  <button className="xbtn" onClick={()=>{setFromLoc(null);setResult(null);}}>×</button>
                </div>
              )}
            </div>

            {/* SWAP */}
            <div className="swap-row">
              <div className="sline"/>
              <button className="swpbtn" onClick={swapLocations}>⇅</button>
              <div className="sline"/>
            </div>

            {/* TO */}
            <div className="igroup">
              <label className="ilabel"><span className="dot dot-g">B</span> To</label>
              <div className="irow">
                <input className="cinput" placeholder="Destination city…" value={toQuery}
                  onChange={e => setToQuery(e.target.value)}
                  onKeyDown={e => e.key==="Enter" && searchTo()}/>
                <button className="btn bblu" onClick={searchTo} disabled={ldTo||!toQuery.trim()}>
                  {ldTo ? <span className="sp"/> : "Set"}
                </button>
              </div>
              {toLoc && (
                <div className="confirmed">
                  <span className="ck">✓</span>
                  <span className="cname">{toLoc.name}</span>
                  <button className="xbtn" onClick={()=>{setToLoc(null);setResult(null);}}>×</button>
                </div>
              )}
            </div>

            {/* VIA */}
            <div className="igroup">
              <label className="ilabel" style={{color:"#F59E0B"}}>+ Via (optional stops)</label>
              <div className="irow">
                <input className="cinput" placeholder="Add intermediate city…" value={wpQuery}
                  onChange={e => setWpQuery(e.target.value)}
                  onKeyDown={e => e.key==="Enter" && addWaypoint()}/>
                <button className="btn bamb" onClick={addWaypoint} disabled={ldWp||!wpQuery.trim()}>
                  {ldWp ? <span className="sp"/> : "Add"}
                </button>
              </div>
              {waypoints.length > 0 && (
                <div className="wp-list">
                  {waypoints.map((w,i)=>(
                    <div key={i} className="wp-item">
                      <span className="dot dot-a" style={{fontSize:9,width:18,height:18}}>{i+2}</span>
                      <span className="wpname">{w.name}</span>
                      <button className="xbtn" onClick={()=>{setWaypoints(p=>p.filter((_,idx)=>idx!==i));setResult(null);}}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* PARAMS */}
            <div>
              <button className="ptoggle" onClick={()=>setShowParams(p=>!p)}>
                <span>⚙ ACO Parameters</span><span>{showParams?"▲":"▼"}</span>
              </button>
              {showParams && (
                <div className="pgrid">
                  {[
                    {key:"numAnts",label:"Ants"},
                    {key:"numIterations",label:"Iterations"},
                    {key:"alpha",label:"Alpha α"},
                    {key:"beta",label:"Beta β"},
                    {key:"evaporation",label:"Evaporation"},
                    {key:"Q",label:"Q deposit"},
                  ].map(({key,label})=>(
                    <div className="pfield" key={key}>
                      <label>{label}</label>
                      <input type="number" value={params[key]}
                        step={["alpha","beta","evaporation"].includes(key)?0.1:1} min={0}
                        onChange={e=>setParams(p=>({...p,[key]:parseFloat(e.target.value)||p[key]}))}/>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && <div className="errmsg">⚠ {error}</div>}

            <button className="solvebtn" onClick={handleSolve} disabled={loading||!fromLoc||!toLoc}>
              {loading ? <><span className="sp"/>Analyzing all routes…</> : "🐜 Find Shortest Road Route"}
            </button>

            {(fromLoc||toLoc) && <button className="clrbtn" onClick={clearAll}>Clear all</button>}

            {/* RESULT */}
            {result && (
              <div className="result-box">
                <span className="rlabel">✅ Optimal Route Found</span>

                <div className="dist-hero">
                  <div className="dist-val">{result.bestDistanceKm} km</div>
                  <div className="dist-sub">Total optimal road distance</div>
                </div>

                <div className="rstats">
                  <div className="rstat"><div className="rv">{result.tourSegments?.length}</div><div className="rl">Segments</div></div>
                  <div className="rstat"><div className="rv">{result.orderedLocations.length-1}</div><div className="rl">Stops</div></div>
                </div>

                {/* SEGMENT TABS — click to see routes on map */}
                <span className="rlabel" style={{marginTop:12}}>Click segment to view routes</span>
                <div className="seg-tabs">
                  {result.tourSegments?.map((s,i)=>(
                    <button key={i}
                      className={`seg-tab ${activeSegment===i?"active":""}`}
                      onClick={()=>setActiveSegment(i)}>
                      <span className="tab-cities">{s.from} → {s.to}</span>
                      <span className="tab-dist">{s.distance} km</span>
                    </button>
                  ))}
                </div>

                {/* ROUTES FOR SELECTED SEGMENT */}
                {activeSegment !== null && result.tourSegments?.[activeSegment] && (
                  <div className="route-alts">
                    <span className="rlabel" style={{marginBottom:6}}>
                      {result.tourSegments[activeSegment].from} → {result.tourSegments[activeSegment].to}
                    </span>
                    {result.tourSegments[activeSegment].routes.map((r,i)=>(
                      <div key={i} className={`route-alt ${r.isShortest?"shortest":""}`}>
                        <div className="alt-label">
                          {r.isShortest
                            ? <span className="shortest-badge">🔴 Shortest Route</span>
                            : <span className="other-badge">🔵 Route {i+1}</span>}
                        </div>
                        <div className="alt-info">
                          <span className="alt-dist">{r.distance} km</span>
                          <span className="alt-dur">{r.duration}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* OPTIMAL ORDER */}
                <span className="rlabel" style={{marginTop:12}}>Optimal tour order</span>
                <div className="rorder">
                  {result.orderedLocations.map((loc,i)=>(
                    <div key={i} className="rstop">
                      <div className="rdot" style={{background:i===0||i===result.orderedLocations.length-1?"#0A84FF":"#10B981"}}/>
                      <span>{loc.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </aside>

        {/* MAP */}
        <div className="map-panel">
          <div className="map-inner">
            <MapComponent
              from={fromLoc}
              to={toLoc}
              waypoints={waypoints}
              fullRoadPath={result?.fullRoadPath}
              activeRoutes={activeRoutes}
              totalDistanceKm={result?.bestDistanceKm}
              activeSegmentData={result?.tourSegments?.[activeSegment]}
            />
          </div>
          <div className="map-ov">
            {result
              ? <><h3>Optimal Road Route</h3><p>{result.bestDistanceKm} km · Click a segment to compare routes</p></>
              : fromLoc && toLoc
                ? <><h3>{fromLoc.name} → {toLoc.name}</h3><p>Click Find Shortest Road Route</p></>
                : <><h3>ACO-TSP Solver</h3><p>Enter From & To cities on the left</p></>
            }
          </div>
        </div>
      </div>
    </div>
  );
}
