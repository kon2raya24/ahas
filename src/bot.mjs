// A simple driver for the title screen and for headless playtests: heads for the nearest food, never
// turns into a dead end it can see, and steps out of a tinikling line while it is warning.
const DIRS = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

export function bot(g) {
  const h = g.snake[0];
  // the tail only moves out of the way when the snake isn't growing
  const body = new Set([...(g.grow > 0 ? g.snake : g.snake.slice(0, -1)), ...g.pots].map((p) => p.y * g.cols + p.x));
  if (g.rooster) body.add(g.rooster.y * g.cols + g.rooster.x);
  const wrap = (x, y) => (g.wrap ? [(x + g.cols) % g.cols, (y + g.rows) % g.rows] : [x, y]);
  const inside = (x, y) => x >= 0 && y >= 0 && x < g.cols && y < g.rows;
  const blocked = (x0, y0) => { const [x, y] = wrap(x0, y0); return !inside(x, y) || body.has(y * g.cols + x); };
  const nearRooster = (x, y) => g.rooster && Math.abs(g.rooster.x - x) + Math.abs(g.rooster.y - y) <= 1;
  const danger = (x, y) => g.pole && g.pole.warn > 0 && (g.pole.axis === 'row' ? y === g.pole.index : x === g.pole.index);
  // cells reachable from a start, capped for speed
  const room = (sx, sy) => {
    const seen = new Set([sy * g.cols + sx]), todo = [[sx, sy]];
    while (todo.length && seen.size < g.snake.length + 10) {
      const [x, y] = todo.pop();
      for (const d of DIRS) {
        const [nx, ny] = wrap(x + d.x, y + d.y), k = ny * g.cols + nx;
        if (!blocked(nx, ny) && !seen.has(k)) { seen.add(k); todo.push([nx, ny]); }
      }
    }
    return seen.size;
  };
  const target = [...g.foods].sort((a, b) => (b.life !== undefined) - (a.life !== undefined) || dist(h, a) - dist(h, b))[0];
  let best = null, bestScore = -Infinity;
  for (const d of DIRS) {
    if (d.x === -g.dir.x && d.y === -g.dir.y) continue;
    const [x, y] = wrap(h.x + d.x, h.y + d.y);
    if (blocked(x, y)) continue;
    let score = Math.min(room(x, y), g.snake.length + 10) * 10;
    if (target) score -= dist({ x, y }, target) * 3;
    if (danger(x, y)) score -= 400;
    if (nearRooster(x, y)) score -= 60;
    if (d.x === g.dir.x && d.y === g.dir.y) score += 1;
    if (score > bestScore) { bestScore = score; best = d; }
  }
  return best;
}

const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
