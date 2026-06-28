# ACO-TSP Solver 
## Screenshot
![ACO-TSP Solver](screenshot.png)
**Travelling Salesman Problem solved using Ant Colony Optimization**  
Full-stack application — React frontend + Node.js/Express backend + Google Maps API

> Built by [Niharika Muduru](https://github.com/niharikareddy018) | VIT-AP University

---

## What it does

- Accepts any number of real-world city inputs
- Fetches actual **road distances** using the **Google Distance Matrix API**
- Runs the **Ant Colony Optimization (ACO)** algorithm to find the shortest route
- Renders the optimized path on an interactive **Google Maps** interface in real time

---

## Tech Stack

| Layer     | Technology                            |
| --------- | ------------------------------------- |
| Frontend  | React 18, Vite, Google Maps JS API    |
| Backend   | Node.js, Express                      |
| Algorithm | ACO (custom implementation, no libs)  |
| APIs      | Google Distance Matrix, Geocoding API |

---

## ACO Algorithm — Key Concepts

The algorithm mimics how real ants find shortest paths using pheromone trails.

**Probability formula for ant k moving from city i → j:**

```
P(i,j) = [τ(i,j)^α × η(i,j)^β] / Σ [τ(i,l)^α × η(i,l)^β]
```

Where:

- `τ(i,j)` = pheromone level on edge (i,j)
- `η(i,j)` = 1/distance (heuristic desirability)
- `α` = pheromone importance weight
- `β` = heuristic importance weight

**Pheromone update:**

```
τ(i,j) ← (1 - ρ) × τ(i,j)  +  Σk (Q / Lk)
```

Where `ρ` = evaporation rate, `Q` = deposit constant, `Lk` = route length of ant k.

---

## Setup & Run

### Prerequisites

- Node.js 18+
- Google Maps API key (with Distance Matrix, Geocoding, Maps JS API enabled)

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# Add your GOOGLE_MAPS_API_KEY to .env
node server.js
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
# Add your VITE_GOOGLE_MAPS_KEY to .env
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## API Endpoints

| Method | Endpoint               | Description                           |
| ------ | ---------------------- | ------------------------------------- |
| POST   | `/api/geocode`         | Convert place name → lat/lng (Google) |
| POST   | `/api/distance-matrix` | Build NxN road distance matrix        |
| POST   | `/api/solve`           | Run ACO on distance matrix            |
| GET    | `/health`              | Check server + API key status         |

---

## Configuration (ACO Parameters)

| Parameter     | Default | Description                     |
| ------------- | ------- | ------------------------------- |
| `numAnts`     | 25      | Number of ants per iteration    |
| `numIter`     | 150     | Total iterations                |
| `alpha (α)`   | 1.0     | Pheromone trail importance      |
| `beta (β)`    | 2.0     | Heuristic (distance) importance |
| `evaporation` | 0.5     | Pheromone evaporation rate (ρ)  |
| `Q`           | 100     | Pheromone deposit constant      |

---

## Note on API Key

If no Google API key is provided:

- Distance matrix falls back to **Haversine** (great-circle) distances
- Geocoding falls back to **OpenStreetMap Nominatim**
- Map renders without tiles (add key for full Google Maps experience)

---

## License

MIT — feel free to use and modify.
