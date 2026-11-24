const $ = id => document.getElementById(id);
const cv = $('game'), ctx = cv.getContext('2d');

const WORLD = 3000, SP = 7, FOOD_MAX = 450, BOTS = 14, START_LEN = 12;
const COLORS = [
  ['#ff5d73', '#ff8fa0'], ['#ffb347', '#ffd08a'], ['#ffe14d', '#fff08a'], ['#4ade80', '#86efac'],
  ['#38bdf8', '#7dd3fc'], ['#a78bfa', '#c4b5fd'], ['#f472b6', '#f9a8d4'], ['#2dd4bf', '#5eead4']
];
const NAMES = ['Naga', 'Kobra', 'Piton', 'Sanca', 'Welang', 'Derik', 'Kilat', 'Bayu', 'Rimba', 'Bintang', 'Senja', 'Fajar', 'Badai', 'Tiger'];

let snakes = [], foods = [], me = null;
let cam = { x: WORLD / 2, y: WORLD / 2 };
let aim = 0, boosting = false, running = false, last = 0, frame = 0, best = 0;

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const radius = s => 7 + Math.min(s.len, 300) * 0.025;
const score = s => Math.max(0, Math.floor((s.len - START_LEN) * 20));

function resize() { cv.width = innerWidth; cv.height = innerHeight; }
addEventListener('resize', resize);
resize();

/* ---------- Dunia ---------- */
function addFood(x, y, v, c) {
  foods.push({ x, y, v, c: c || pick(COLORS)[0], r: v > 1 ? 7 : 4 });
}

function spawn(name, bot) {
  const x = rnd(300, WORLD - 300), y = rnd(300, WORLD - 300), a = rnd(0, Math.PI * 2);
  return {
    name, bot, a, target: a, wa: a, wt: 0, len: START_LEN, boost: false, alive: true, col: pick(COLORS),
    body: Array.from({ length: START_LEN }, () => ({ x, y }))
  };
}

function init() {
  foods = [];
  snakes = [];
  for (let i = 0; i < BOTS; i++) snakes.push(spawn(pick(NAMES), true));
  refill();
}

function refill() {
  while (foods.length < FOOD_MAX) addFood(rnd(20, WORLD - 20), rnd(20, WORLD - 20), 1);
  if (foods.length > 1000) foods.splice(0, foods.length - 1000);
}

function play() {
  init();
  me = spawn('Kamu', false);
  me.col = COLORS[3];
  snakes.push(me);
  cam = { x: me.body[0].x, y: me.body[0].y };
  running = true;
  $('overlay').classList.add('hide');
}

function kill(s) {
  s.alive = false;
  for (let i = 0; i < s.body.length; i += 3) {
    const p = s.body[i];
    addFood(p.x + rnd(-8, 8), p.y + rnd(-8, 8), 2, s.col[0]);
  }
  snakes = snakes.filter(x => x !== s);
  if (s === me) return gameOver();
  setTimeout(() => snakes.push(spawn(pick(NAMES), true)), 1500);
}

function gameOver() {
  running = false;
  best = Math.max(best, score(me));
  $('title').textContent = 'Kamu kalah!';
  $('info').textContent = 'Skor: ' + score(me) + ' · Terbaik: ' + best;
  $('play').textContent = 'Main lagi';
  $('overlay').classList.remove('hide');
}

/* ---------- Gerak & AI ---------- */
function ai(s) {
  const h = s.body[0];
  if (--s.wt <= 0) { s.wt = rnd(40, 120); s.wa = s.a + rnd(-1, 1); }
  let ta = s.wa;

  let bd = 260 * 260, bf = null;
  for (const f of foods) {
    const dx = f.x - h.x, dy = f.y - h.y, d2 = dx * dx + dy * dy;
    if (d2 < bd) { bd = d2; bf = f; }
  }
  if (bf) ta = Math.atan2(bf.y - h.y, bf.x - h.x);

  if (h.x < 150 || h.x > WORLD - 150 || h.y < 150 || h.y > WORLD - 150) {
    ta = Math.atan2(WORLD / 2 - h.y, WORLD / 2 - h.x);
  }

  let ax = 0, ay = 0;
  for (const o of snakes) {
    if (o === s) continue;
    const lim = 45 + radius(o);
    for (let i = 0; i < o.body.length; i += 2) {
      const dx = h.x - o.body[i].x, dy = h.y - o.body[i].y, d = Math.hypot(dx, dy);
      if (d < lim && d > 0) { ax += dx / d; ay += dy / d; }
    }
  }
  if (ax || ay) ta = Math.atan2(ay, ax);
  s.target = ta;
  s.boost = false;
}

function move(s, dt) {
  let d = s.target - s.a;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  const maxTurn = 0.07 * dt;
  s.a += Math.max(-maxTurn, Math.min(maxTurn, d));

  const fast = s.boost && s.len > START_LEN + 2;
  if (fast) s.len -= 0.04 * dt;
  const sp = fast ? 4.4 : 2.7;

  const h = s.body[0];
  h.x += Math.cos(s.a) * sp * dt;
  h.y += Math.sin(s.a) * sp * dt;

  const n = Math.max(START_LEN, Math.floor(s.len));
  while (s.body.length < n) s.body.push({ ...s.body[s.body.length - 1] });
  while (s.body.length > n) s.body.pop();

  for (let i = 1; i < s.body.length; i++) {
    const p = s.body[i - 1], q = s.body[i];
    const dx = p.x - q.x, dy = p.y - q.y, dist = Math.hypot(dx, dy);
    if (dist > SP) { q.x += dx / dist * (dist - SP); q.y += dy / dist * (dist - SP); }
  }
}

function eat() {
  for (const s of snakes) {
    const h = s.body[0], r = radius(s) + (s.bot ? 0 : 6);
    for (let i = foods.length - 1; i >= 0; i--) {
      const f = foods[i], dx = f.x - h.x, dy = f.y - h.y, lim = r + f.r;
      if (dx * dx + dy * dy < lim * lim) { s.len += f.v * 0.5; foods.splice(i, 1); }
    }
  }
  refill();
}

function collide() {
  for (const s of [...snakes]) {
    if (!s.alive) continue;
    const h = s.body[0], r = radius(s);
    if (h.x < 0 || h.y < 0 || h.x > WORLD || h.y > WORLD) { kill(s); continue; }
    hit: for (const o of snakes) {
      if (o === s || !o.alive) continue;
      const lim = (r + radius(o)) * 0.7;
      for (const p of o.body) {
        const dx = h.x - p.x, dy = h.y - p.y;
        if (dx * dx + dy * dy < lim * lim) { kill(s); break hit; }
      }
    }
  }
}

function update(dt) {
  for (const s of snakes) {
    if (s === me) { s.target = aim; s.boost = boosting; } else ai(s);
    move(s, dt);
  }
  eat();
  collide();
  if (me && me.alive) {
    cam.x += (me.body[0].x - cam.x) * 0.15;
    cam.y += (me.body[0].y - cam.y) * 0.15;
  }
}

/* ---------- Gambar ---------- */
function circle(x, y, r, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawSnake(s) {
  const r = radius(s);
  if (s.boost && s.len > START_LEN + 2) { ctx.shadowColor = s.col[0]; ctx.shadowBlur = 18; }
  for (let i = s.body.length - 1; i >= 0; i--) {
    circle(s.body[i].x, s.body[i].y, r, Math.floor(i / 3) % 2 ? s.col[0] : s.col[1]);
  }
  ctx.shadowBlur = 0;
  const h = s.body[0], ex = Math.cos(s.a), ey = Math.sin(s.a);
  for (const k of [-1, 1]) {
    const x = h.x + ex * r * 0.4 - ey * r * 0.5 * k, y = h.y + ey * r * 0.4 + ex * r * 0.5 * k;
    circle(x, y, r * 0.32, '#fff');
    circle(x + ex * r * 0.12, y + ey * r * 0.12, r * 0.16, '#111');
  }
  ctx.fillStyle = '#fff';
  ctx.font = '12px system-ui, Arial';
  ctx.textAlign = 'center';
  ctx.fillText(s.name, h.x, h.y - r - 8);
}

function draw() {
  const w = cv.width, h = cv.height;
  ctx.fillStyle = '#10161f';
  ctx.fillRect(0, 0, w, h);

  const z = me ? Math.max(0.55, 1 - me.len / 1200) : 1;
  const vw = w / 2 / z + 60, vh = h / 2 / z + 60;
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(z, z);
  ctx.translate(-cam.x, -cam.y);

  ctx.strokeStyle = '#ffffff10';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const gx = Math.floor((cam.x - vw) / 100) * 100, gy = Math.floor((cam.y - vh) / 100) * 100;
  for (let x = gx; x < cam.x + vw; x += 100) { ctx.moveTo(x, cam.y - vh); ctx.lineTo(x, cam.y + vh); }
  for (let y = gy; y < cam.y + vh; y += 100) { ctx.moveTo(cam.x - vw, y); ctx.lineTo(cam.x + vw, y); }
  ctx.stroke();

  ctx.strokeStyle = '#e5484d';
  ctx.lineWidth = 8;
  ctx.strokeRect(0, 0, WORLD, WORLD);

  for (const f of foods) {
    if (Math.abs(f.x - cam.x) > vw || Math.abs(f.y - cam.y) > vh) continue;
    circle(f.x, f.y, f.r, f.c);
  }
  for (const s of snakes) if (s !== me) drawSnake(s);
  if (me && me.alive) drawSnake(me);
  ctx.restore();
}

function hud() {
  if (me) $('score').textContent = me.alive ? score(me) : 0;
  const top = [...snakes].sort((a, b) => b.len - a.len).slice(0, 5);
  $('board').innerHTML = top
    .map(s => '<li' + (s === me ? ' class="me"' : '') + '>' + s.name + ' – ' + score(s) + '</li>')
    .join('');
}

function loop(t) {
  const dt = Math.min((t - last) / 16.67, 3) || 1;
  last = t;
  update(dt);
  draw();
  if (++frame % 10 === 0) hud();
  requestAnimationFrame(loop);
}

/* ---------- Kontrol ---------- */
function setAim(e) { aim = Math.atan2(e.clientY - cv.height / 2, e.clientX - cv.width / 2); }
cv.addEventListener('pointermove', setAim);
cv.addEventListener('pointerdown', e => { setAim(e); if (e.pointerType === 'mouse') boosting = true; });
addEventListener('pointerup', e => { if (e.pointerType === 'mouse') boosting = false; });
addEventListener('keydown', e => { if (e.code === 'Space') { boosting = true; e.preventDefault(); } });
addEventListener('keyup', e => { if (e.code === 'Space') boosting = false; });

const b = $('boost');
b.addEventListener('pointerdown', e => { e.stopPropagation(); boosting = true; });
['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => { boosting = false; }));
$('play').onclick = play;

init();
requestAnimationFrame(loop);
