// Usage: node combine.js [audio.json] [results.json]
const fs = require('fs');
const input = process.argv[2] || 'audio.json';
const output = process.argv[3] || 'results.json';
const MAX = 20 * 60;
const MAX_EXCLUDED = 3; // fewer than 4

const songs = JSON.parse(fs.readFileSync(input, 'utf8'));
const n = songs.length;
const idx = Object.fromEntries(songs.map((s, i) => [s.name, i]));
const conflicts = songs.map((s) => {
  const set = new Set();
  const list = [].concat(s.incompatibility || []);
  list.forEach((name) => {
    if (name in idx) set.add(idx[name]);
  });
  return set;
});
// incompatibility is symmetric
conflicts.forEach((set, i) => set.forEach((j) => conflicts[j].add(i)));

const results = [];
const assign = new Array(n);
const sum = { A: 0, B: 0 };

function ok(i, side) {
  if (sum[side] + songs[i].duration > MAX) return false;
  for (let j = 0; j < i; j++) if (assign[j] === side && conflicts[i].has(j)) return false;
  return true;
}

function rec(i, aUsed, excl = 0) {
  if (i === n) {
    const pick = (side) => songs.filter((_, k) => assign[k] === side);
    const A = pick('A'), B = pick('B'), X = pick('X');
    const fmt = (l) => l.map((s) => s.name);
    results.push({
      sideA: { songs: fmt(A), seconds: +sum.A.toFixed(1) },
      sideB: { songs: fmt(B), seconds: +sum.B.toFixed(1) },
      excluded: fmt(X),
      excludedNominated: X.filter((s) => s.nominated).map((s) => s.name),
    });
    return;
  }
  for (const side of ['A', 'B', 'X']) {
    // A/B mirror images are the same combination: first used side must be A
    if (side === 'B' && !aUsed) continue;
    if (side === 'X' && (excl >= MAX_EXCLUDED || songs[i].fixed)) continue;
    if (side !== 'X' && !ok(i, side)) continue;
    assign[i] = side;
    if (side !== 'X') sum[side] += songs[i].duration;
    rec(i + 1, aUsed || side === 'A', excl + (side === 'X' ? 1 : 0));
    if (side !== 'X') sum[side] -= songs[i].duration;
  }
}
rec(0, false);

results.sort(
  (a, b) =>
    b.excludedNominated.length - a.excludedNominated.length ||
    a.excluded.length - b.excluded.length ||
    a.sideA.songs.join().localeCompare(b.sideA.songs.join())
);

fs.writeFileSync(output, JSON.stringify({ maxSeconds: MAX, count: results.length, results }));
console.log(`${results.length} combinations -> ${output}`);
