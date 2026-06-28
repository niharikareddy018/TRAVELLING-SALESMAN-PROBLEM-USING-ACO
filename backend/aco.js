/**
 * Ant Colony Optimization — Travelling Salesman Problem
 * Author: Niharika Muduru | VIT-AP University
 *
 * Probability formula:
 *   P(i,j) = [τ(i,j)^α × η(i,j)^β] / Σ [τ(i,l)^α × η(i,l)^β]
 *   τ = pheromone, η = 1/distance, α & β = weights
 */

class ACO {
  constructor({
    numAnts       = 25,
    numIterations = 200,
    alpha         = 1.0,
    beta          = 3.0,
    evaporation   = 0.4,
    Q             = 100,
  } = {}) {
    this.numAnts       = numAnts;
    this.numIterations = numIterations;
    this.alpha         = alpha;
    this.beta          = beta;
    this.evaporation   = evaporation;
    this.Q             = Q;
  }

  solve(distanceMatrix) {
    const n = distanceMatrix.length;
    let pheromones = Array.from({ length: n }, () => Array(n).fill(1.0 / (n * n)));
    let bestRoute = null;
    let bestDistance = Infinity;
    const history = [];

    for (let iter = 0; iter < this.numIterations; iter++) {
      const allRoutes = [], allDistances = [];

      for (let ant = 0; ant < this.numAnts; ant++) {
        const route    = this._constructRoute(distanceMatrix, pheromones, n);
        const distance = this._routeDistance(route, distanceMatrix);
        allRoutes.push(route);
        allDistances.push(distance);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestRoute    = [...route];
        }
      }

      pheromones = this._updatePheromones(pheromones, allRoutes, allDistances, n);
      history.push({ iteration: iter + 1, bestDistance: Math.round(bestDistance) });
    }

    return { bestRoute, bestDistance: Math.round(bestDistance), history };
  }

  _constructRoute(distanceMatrix, pheromones, n) {
    const visited = new Set();
    const start   = Math.floor(Math.random() * n);
    const route   = [start];
    visited.add(start);
    while (route.length < n) {
      const current = route[route.length - 1];
      const next    = this._selectNext(current, visited, pheromones, distanceMatrix, n);
      route.push(next);
      visited.add(next);
    }
    return route;
  }

  _selectNext(current, visited, pheromones, distanceMatrix, n) {
    let total = 0;
    const probs = [];
    for (let j = 0; j < n; j++) {
      if (!visited.has(j) && distanceMatrix[current][j] > 0) {
        const tau  = Math.pow(pheromones[current][j], this.alpha);
        const eta  = Math.pow(1.0 / distanceMatrix[current][j], this.beta);
        const prob = tau * eta;
        probs.push({ node: j, prob });
        total += prob;
      }
    }
    if (!probs.length) {
      for (let j = 0; j < n; j++) if (!visited.has(j)) return j;
    }
    let rand = Math.random() * total;
    for (const { node, prob } of probs) {
      rand -= prob;
      if (rand <= 0) return node;
    }
    return probs[probs.length - 1].node;
  }

  _routeDistance(route, distanceMatrix) {
    let total = 0;
    for (let i = 0; i < route.length - 1; i++) total += distanceMatrix[route[i]][route[i + 1]];
    total += distanceMatrix[route[route.length - 1]][route[0]];
    return total;
  }

  _updatePheromones(pheromones, allRoutes, allDistances, n) {
    const updated = pheromones.map(row => row.map(val => val * (1 - this.evaporation)));
    for (let k = 0; k < allRoutes.length; k++) {
      const route   = allRoutes[k];
      const deposit = this.Q / allDistances[k];
      for (let i = 0; i < route.length - 1; i++) {
        updated[route[i]][route[i + 1]] += deposit;
        updated[route[i + 1]][route[i]] += deposit;
      }
      updated[route[route.length - 1]][route[0]] += deposit;
      updated[route[0]][route[route.length - 1]] += deposit;
    }
    return updated;
  }
}

module.exports = ACO;