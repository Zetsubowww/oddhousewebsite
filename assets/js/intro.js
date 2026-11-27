/* ==========================================================================
   THE INTRO. Two seconds with one character and its line.
   Runs only when the head script has put .is-intro on <html> (once per
   browser session, not on deep links, not with reduced motion).

   Each visit picks ONE character from the cast below (never the same as the
   previous visit) and shows it with its line for the whole two seconds:
   - the live house from the old front door: its eyes follow the cursor, wander,
     blink, squint when the cursor is close and giggle when rubbed;
   - or one of the animated moods in assets/moods/live/.
   At the end the screen closes while the site is already coming in underneath.
   Tap, click, Escape, Enter or Space skips straight in.
   ========================================================================== */
(() => {
  'use strict';
  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);

  const intro = $('[data-intro]');
  if (!intro) return;
  if (!root.classList.contains('is-intro')) { intro.remove(); return; }

  const LENGTH = 1800;   // ms before the paper starts to close (the character keeps moving)
  const OUT = 450;       // ms for the paper to close, while the site arrives underneath

  // The cast. One per visit.
  const CAST = [
    { id: 'house',       hint: 'that’s odd.' },
    { id: 'in-the-zone', hint: 'in the vibe.' },
    { id: 'big-idea',    hint: 'big idea.' },
    { id: 'off-hours',   hint: 'five more minutes.' },
    { id: 'boo',         hint: 'boo.' },
  ];

  const house = $('[data-intro-house]', intro);
  const svg = $('[data-intro-svg]', intro);
  const moodHost = $('[data-intro-mood]', intro);
  const hint = $('[data-intro-hint]', intro);

  const behind = Array.from(document.body.children).filter((el) => el !== intro && el.tagName !== 'SCRIPT');
  behind.forEach((el) => { el.inert = true; });
  root.classList.add('is-locked');

  // never the same character twice in a row
  let last = null;
  try { last = localStorage.getItem('oh-intro-pick'); } catch (e) { /* private mode */ }
  const pool = CAST.filter((c) => c.id !== last);
  const pick = pool[Math.floor(Math.random() * pool.length)];
  try { localStorage.setItem('oh-intro-pick', pick.id); } catch (e) { /* private mode */ }

  // nothing shows until the character is ready, so the line and the art arrive together
  intro.classList.add('is-loading');

  /* ------------------------------------------------------------------ the live house's eyes */
  const eyes = svg ? Array.from(svg.querySelectorAll('[data-geye]')).map((g) => ({
    lid: $('.ge__lid', g), pupil: $('.ge__pupil', g), white: $('.ge__white', g),
    x: 0, y: 0, tx: 0, ty: 0,
  })) : [];
  const P = { x: innerWidth / 2, y: innerHeight / 2, at: 0, seen: false };
  const rub = { lastX: 0, lastY: 0, dir: { x: 0, y: 0 }, hits: [] };
  let alive = false, giggleUntil = 0;
  let lid = 1, lidMood = 1;
  let blinkAt = 0, blinkStage = 0, blinkT = 0;
  const wander = { x: 0, y: 0, at: 0 };

  function onMove(e) {
    const now = performance.now();
    P.x = e.clientX; P.y = e.clientY; P.at = now; P.seen = true;
    const r = house.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) { rub.hits.length = 0; rub.dir.x = rub.dir.y = 0; rub.lastX = e.clientX; rub.lastY = e.clientY; return; }
    const dx = e.clientX - rub.lastX, dy = e.clientY - rub.lastY;
    rub.lastX = e.clientX; rub.lastY = e.clientY;
    // a rub is the pointer turning round again and again inside the house
    ['x', 'y'].forEach((k) => {
      const d = k === 'x' ? dx : dy;
      if (Math.abs(d) < 3) return;
      const s = Math.sign(d);
      if (rub.dir[k] && s !== rub.dir[k]) rub.hits.push(now);
      rub.dir[k] = s;
    });
    while (rub.hits.length && now - rub.hits[0] > 850) rub.hits.shift();
    if (rub.hits.length >= 4) giggleUntil = now + 1300;
  }

  let lastT = performance.now();
  function frame(now) {
    if (!alive) return;
    const dt = Math.min(64, now - lastT); lastT = now;
    const idle = !P.seen || now - P.at > 4200;
    // giggle beats squint beats a plain look
    let state = 'idle', nearest = Infinity;
    const centres = eyes.map((e) => { const r = e.white.getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width }; });
    centres.forEach((c) => { nearest = Math.min(nearest, Math.hypot(P.x - c.cx, P.y - c.cy) / (c.w || 1)); });
    if (now < giggleUntil) state = 'happy';
    else if (!idle && nearest < 1.35) state = 'squint';
    if (svg.dataset.mood !== state) svg.dataset.mood = state;
    intro.classList.toggle('is-giggling', state === 'happy');

    const mid = { cx: centres.reduce((a, c) => a + c.cx, 0) / (centres.length || 1), cy: centres.reduce((a, c) => a + c.cy, 0) / (centres.length || 1) };
    eyes.forEach((e) => {
      if (idle) {
        if (now > wander.at) { wander.x = Math.random() < 0.4 ? 0 : rand(-0.55, 0.55); wander.y = Math.random() < 0.5 ? 0 : rand(-0.2, 0.3); wander.at = now + rand(600, 1100); }
        e.tx = wander.x; e.ty = wander.y;
      } else {
        e.tx = clamp((P.x - mid.cx) / (innerWidth * 0.26), -1, 1);
        e.ty = clamp((P.y - mid.cy) / (innerHeight * 0.3), -1, 1);
      }
      const k = 1 - Math.pow(0.0016, dt / 1000);
      e.x = lerp(e.x, e.tx, k); e.y = lerp(e.y, e.ty, k);
    });

    // lids: squint narrows, one blink closes for a moment
    const want = state === 'squint' ? 0.62 : 1;
    lidMood = lerp(lidMood, want, 1 - Math.pow(0.0004, dt / 1000));
    if (blinkStage === 0 && blinkAt && now > blinkAt && state !== 'happy') { blinkStage = 1; blinkT = 0; }
    if (blinkStage === 1) {
      blinkT += dt / 80; lid = lerp(1, 0.06, clamp(blinkT, 0, 1));
      if (blinkT >= 1) { blinkStage = 2; blinkT = 0; }
    } else if (blinkStage === 2) {
      blinkT += dt / 140; const t = clamp(blinkT, 0, 1); lid = lerp(0.06, 1, t * t * (3 - 2 * t));
      if (blinkT >= 1) { blinkStage = 0; blinkAt = 0; }   // one blink in two seconds is plenty
    } else { lid = 1; }

    eyes.forEach((e) => {
      e.pupil.setAttribute('transform', `translate(${(e.x * 22).toFixed(2)} ${(e.y * 5).toFixed(2)})`);
      e.lid.setAttribute('transform', `scale(1 ${Math.max(0.04, lidMood * lid).toFixed(3)})`);
    });
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------ show one character */
  let finished = false, timer = 0, moodRoot = null;
  const pop = (el) => el.animate([
    { transform: 'translateY(8%) scale(0.86)', opacity: 0 },
    { transform: 'translateY(-2%) scale(1.04)', opacity: 1, offset: 0.6 },
    { transform: 'none', opacity: 1 },
  ], { duration: 420, easing: 'cubic-bezier(.3,.7,.2,1)', fill: 'both' });

  function showHouse() {
    hint.textContent = CAST[0].hint;
    intro.classList.remove('is-loading');
    pop(house);
    alive = true;
    blinkAt = performance.now() + rand(700, 1100);
    addEventListener('pointermove', onMove, { passive: true });
    if (eyes.length) requestAnimationFrame(frame);
    start();
  }

  function showMood() {
    hint.textContent = pick.hint;
    svg.style.visibility = 'hidden';            // the house keeps the space; the mood stands in it
    moodHost.dataset.mood = pick.id;
    moodHost.hidden = false;
    intro.classList.remove('is-loading');
    pop(moodHost);
    start();
  }

  function start() {
    timer = setTimeout(() => finish(), LENGTH);
  }

  if (pick.id === 'house') showHouse();
  else {
    // the mood art goes into a shadow root, so its own styles stay inside it
    fetch(`assets/moods/live/${pick.id}.svg`)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((markup) => {
        if (finished) return;
        moodRoot = moodHost.attachShadow({ mode: 'open' });
        moodRoot.innerHTML = '<style>:host{display:block}svg{display:block;width:100%;height:auto;overflow:visible}</style>' + markup;
        showMood();
      })
      .catch(() => { if (!finished) showHouse(); });   // no mood: the house steps in
  }

  /* ------------------------------------------------------------------ the way in */
  function finish(now) {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    removeEventListener('pointermove', onMove);
    try { sessionStorage.setItem('oh-intro-seen', '1'); } catch (e) { /* private mode */ }
    // the site starts arriving now, underneath the closing paper
    window.scrollTo(0, 0);
    root.classList.remove('is-locked');
    behind.forEach((el) => { el.inert = false; });
    intro.style.display = 'grid';               // stay on screen once .is-intro is gone
    root.classList.remove('is-intro');
    document.dispatchEvent(new Event('oh:enter'));
    let gone = false;
    const done = () => { if (gone) return; gone = true; alive = false; intro.remove(); };
    if (now) { done(); return; }
    intro.addEventListener('animationend', (e) => { if (e.target === intro) done(); });
    intro.classList.add('is-leaving');
    setTimeout(done, OUT + 150);                // in case animationend never comes
  }

  intro.addEventListener('click', () => finish());
  addEventListener('keydown', (e) => {
    if (!finished && (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); finish(); }
  });
  intro.focus({ preventScroll: true });
})();
