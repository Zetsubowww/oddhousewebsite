/* ==========================================================================
   ODD HOUSE — site behaviour. No dependencies, no build step.
   Everything here is an enhancement: the page reads fine without it.
   ========================================================================== */
(() => {
  'use strict';

  /* ------------------------------------------------------------- settings */
  const SITE = {
    // Paste your Calendly / Cal.com / Google Calendar booking link here.
    // While it is empty, "book a call." opens an email instead.
    bookingUrl: '',
    email: 'hello@oddhouse.media',
    timeZone: 'Asia/Manila',
    // Used only for the "awake / asleep" line. 1 = Monday ... 7 = Sunday.
    // open and close are hours in 24h time; 7.5 means 7:30.
    hours: { days: [1, 2, 3, 4, 5, 6, 7], open: 7.5, close: 18 },
  };

  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const reduceMq = matchMedia('(prefers-reduced-motion: reduce)');
  const fineMq = matchMedia('(hover: hover) and (pointer: fine)');
  const reduced = () => reduceMq.matches;

  /* ----------------------------------------------------------------- type */
  // When the Adobe Fonts kit is connected, relax tracking to the brand's -30.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      const has = Array.from(document.fonts).some((f) => /polymath/i.test(f.family) && f.status === 'loaded');
      if (has) root.classList.add('has-polymath');
      fitAll();
    });
  }

  /* --------------------------------------------------------- split + reveal */
  function split(el) {
    const label = el.textContent.replace(/\s+/g, ' ').trim();
    let i = 0;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'w';
            const wi = document.createElement('span');
            wi.className = 'wi';
            wi.style.setProperty('--i', i++);
            wi.textContent = part;
            w.appendChild(wi);
            frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && child.tagName !== 'BR' && !child.hasAttribute('data-keep')) {
          walk(child);
        }
      });
    };
    walk(el);
    // Screen readers get the sentence, not the pieces.
    const inner = document.createElement('span');
    inner.setAttribute('aria-hidden', 'true');
    while (el.firstChild) inner.appendChild(el.firstChild);
    el.appendChild(inner);
    el.setAttribute('aria-label', label);
    el.classList.add('is-split');
  }
  $$('[data-split]').forEach(split);

  const revealables = $$('[data-split], [data-reveal], .peek');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -9% 0px', threshold: 0.12 });
    // siblings arrive one after another
    const groups = new Map();
    revealables.forEach((el) => {
      if (el.hasAttribute('data-reveal')) {
        const n = groups.get(el.parentNode) || 0;
        el.style.setProperty('--d', `${n * 90}ms`);
        groups.set(el.parentNode, n + 1);
      }
      io.observe(el);
    });
  } else {
    revealables.forEach((el) => el.classList.add('is-in'));
  }
  // The first screen never waits for anything.
  function revealHero() { requestAnimationFrame(() => $$('.home [data-split], .home [data-reveal]').forEach((el) => el.classList.add('is-in'))); }
  // The intro (intro.js) holds the hero back until it ends, then fires 'oh:enter'.
  window.OH_SITE = SITE;
  if (root.classList.contains('is-intro') && document.querySelector('[data-intro]')) document.addEventListener('oh:enter', revealHero, { once: true });
  else { root.classList.remove('is-intro'); revealHero(); }

  /* ----------------------------------------------------------------- eyes */
  // The house has two windows, and they look back.
  const pointer = { x: innerWidth / 2, y: innerHeight * 0.4, at: 0, seen: false };
  addEventListener('pointermove', (e) => {
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.at = performance.now(); pointer.seen = true;
  }, { passive: true });
  addEventListener('pointerdown', (e) => {
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.at = performance.now(); pointer.seen = true;
  }, { passive: true });

  const eyeSets = $$('[data-eyes]').map((svg) => ({
    svg,
    lids: $$('.eye__lid', svg),
    pupils: $$('.eye__pupil', svg),
    x: 0, y: 0, tx: 0, ty: 0,
    lid: 1, blinkAt: performance.now() + rand(900, 3200), blinkStage: 0, blinkT: 0, again: false,
    wanderAt: 0, visible: true,
    reach: svg.dataset.eyes === 'mini' ? 0.55 : 1,
  }));

  if (eyeSets.length && 'IntersectionObserver' in window) {
    const eio = new IntersectionObserver((entries) => {
      entries.forEach((e) => { const s = eyeSets.find((x) => x.svg === e.target); if (s) s.visible = e.isIntersecting; });
    }, { rootMargin: '80px' });
    eyeSets.forEach((s) => eio.observe(s.svg));
  }

  let lastT = performance.now();
  function eyesFrame(now) {
    const dt = Math.min(64, now - lastT); lastT = now;
    const idle = !pointer.seen || now - pointer.at > 4200;
    eyeSets.forEach((s) => {
      if (!s.visible) return;
      if (idle) {
        if (now > s.wanderAt) {
          s.tx = rand(-0.85, 0.85); s.ty = rand(-0.5, 0.75);
          s.wanderAt = now + rand(1300, 3800);
        }
      } else {
        const r = s.svg.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        s.tx = clamp((pointer.x - cx) / (innerWidth * 0.3), -1, 1);
        s.ty = clamp((pointer.y - cy) / (innerHeight * 0.34), -1, 1);
      }
      const k = 1 - Math.pow(0.0018, dt / 1000);
      s.x = lerp(s.x, s.tx, k); s.y = lerp(s.y, s.ty, k);

      // blink: close fast, open a little slower, sometimes twice
      if (s.blinkStage === 0 && now > s.blinkAt) { s.blinkStage = 1; s.blinkT = 0; }
      if (s.blinkStage === 1) {
        s.blinkT += dt / 85; s.lid = lerp(1, 0.07, clamp(s.blinkT, 0, 1));
        if (s.blinkT >= 1) { s.blinkStage = 2; s.blinkT = 0; }
      } else if (s.blinkStage === 2) {
        s.blinkT += dt / 150; const t = clamp(s.blinkT, 0, 1); s.lid = lerp(0.07, 1, t * t * (3 - 2 * t));
        if (s.blinkT >= 1) {
          s.blinkStage = 0;
          if (!s.again && Math.random() < 0.22) { s.again = true; s.blinkAt = now + 110; }
          else { s.again = false; s.blinkAt = now + rand(2400, 6800); }
        }
      }

      const dx = (s.x * 74 * s.reach).toFixed(2);
      const sy = (1 + s.y * 0.3 * s.reach).toFixed(3);
      s.pupils.forEach((p) => p.setAttribute('transform', `translate(${dx} 0) scale(1 ${sy})`));
      const lid = s.lid.toFixed(3);
      s.lids.forEach((l) => l.setAttribute('transform', `scale(1 ${lid})`));
    });
    requestAnimationFrame(eyesFrame);
  }
  if (eyeSets.length && !reduced()) requestAnimationFrame(eyesFrame);

  /* --------------------------------------------------------------- lights */
  const lightsBtn = $('[data-lights-toggle]');
  const lightsLabel = $('[data-lights-label]');
  const themeMeta = $('meta[name="theme-color"]');
  function paintLights() {
    const on = root.getAttribute('data-lights') === 'on';
    if (lightsBtn) {
      lightsBtn.setAttribute('aria-pressed', String(on));
      lightsBtn.setAttribute('aria-label', on ? 'Turn the lights off' : 'Turn the lights on');
    }
    if (lightsLabel) lightsLabel.textContent = on ? 'lights off' : 'lights on';
    if (themeMeta) themeMeta.setAttribute('content', on ? '#FFFBEF' : '#141413');
  }
  function flipLights() {
    const next = root.getAttribute('data-lights') === 'on' ? 'off' : 'on';
    const apply = () => {
      root.setAttribute('data-lights', next);
      try { localStorage.setItem('oh-lights', next); } catch (e) { /* private mode */ }
      paintLights();
    };
    if (document.startViewTransition && !reduced() && lightsBtn) {
      const r = lightsBtn.getBoundingClientRect();
      root.style.setProperty('--lx', `${r.left + r.width / 2}px`);
      root.style.setProperty('--ly', `${r.top + r.height / 2}px`);
      document.startViewTransition(apply);
    } else {
      apply();
    }
  }
  if (lightsBtn) lightsBtn.addEventListener('click', flipLights);
  paintLights();

  /* ----------------------------------------------------------------- menu */
  const menu = $('[data-menu]');
  const menuBtn = $('[data-menu-toggle]');
  const menuLabel = $('[data-menu-label]');
  function setMenu(open) {
    if (!menu || !menuBtn) return;
    menu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    if (menuLabel) menuLabel.textContent = open ? 'close' : 'menu';
    root.classList.toggle('is-locked', open);
  }
  if (menu && menuBtn) {
    menuBtn.addEventListener('click', () => setMenu(menu.hidden));
    $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); } });
    matchMedia('(min-width: 56.25em)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });
  }

  /* ---------------------------------------------------------------- reel */
  // The strip of work that peeks into the first screen. It drifts; you can drag it.
  const reel = $('[data-reel]');
  const track = $('[data-reel-track]');
  if (reel && track && !reduced()) {
    const originals = Array.from(track.children);
    originals.forEach((li) => {
      const c = li.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      $$('img', c).forEach((img) => { img.alt = ''; img.loading = 'lazy'; img.removeAttribute('fetchpriority'); });
      track.appendChild(c);
    });
    let half = 0, x = 0, v = 0, held = false, lastX = 0, onScreen = true, hover = false, speed = 34, prev = performance.now();
    const measure = () => {
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      half = originals.reduce((w, li) => w + li.getBoundingClientRect().width + gap, 0);
    };
    measure();
    addEventListener('resize', measure);
    addEventListener('load', measure);
    new IntersectionObserver((es) => { onScreen = es[0].isIntersecting; }).observe(reel);
    reel.addEventListener('pointerenter', () => { hover = true; });
    reel.addEventListener('pointerleave', () => { hover = false; });
    reel.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      held = true; lastX = e.clientX; v = 0; reel.classList.add('is-held');
      try { reel.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
    });
    reel.addEventListener('pointermove', (e) => {
      if (!held) return;
      const d = e.clientX - lastX; lastX = e.clientX; x += d; v = d;
    });
    const drop = () => { held = false; reel.classList.remove('is-held'); };
    reel.addEventListener('pointerup', drop);
    reel.addEventListener('pointercancel', drop);
    const tick = (now) => {
      const dt = Math.min(64, now - prev) / 1000; prev = now;
      if (onScreen && half > 0) {
        if (!held) {
          const cruise = hover && fineMq.matches ? speed * 0.25 : speed;
          x += v; v *= Math.pow(0.004, dt);
          if (Math.abs(v) < 0.05) v = 0;
          x -= cruise * dt;
        }
        if (x <= -half) x += half;
        if (x > 0) x -= half;
        track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // On touch screens there is no hover, so work turns to colour as it reaches the middle of the screen.
  if ('IntersectionObserver' in window && !fineMq.matches) {
    const lit = new IntersectionObserver((es) => {
      es.forEach((e) => e.target.classList.toggle('is-lit', e.isIntersecting));
    }, { rootMargin: '-32% 0px -32% 0px' });
    $$('.case').forEach((el) => lit.observe(el));
  }

  /* ---------------------------------------------------------- case sheets */
  const sheet = $('[data-sheet]');
  const sheetBody = $('[data-sheet-body]');
  let lastOpener = null;
  function openCase(id, opener) {
    const tpl = document.getElementById(`case-${id}`);
    if (!sheet || !sheetBody || !tpl || typeof sheet.showModal !== 'function') return;
    sheetBody.innerHTML = '';
    sheetBody.appendChild(tpl.content.cloneNode(true));
    lastOpener = opener || null;
    sheet.classList.remove('is-leaving');
    sheet.showModal();
    sheet.scrollTop = 0;
    root.classList.add('is-locked');
  }
  function closeCase() {
    if (!sheet || !sheet.open) return;
    const done = () => {
      sheet.classList.remove('is-leaving');
      sheet.close();
      root.classList.remove('is-locked');
      if (lastOpener) lastOpener.focus();
    };
    if (reduced()) { done(); return; }
    sheet.classList.add('is-leaving');
    sheet.addEventListener('animationend', done, { once: true });
  }
  if (sheet) {
    $$('[data-case]').forEach((b) => b.addEventListener('click', () => openCase(b.dataset.case, b)));
    $$('[data-sheet-close]', sheet).forEach((b) => b.addEventListener('click', closeCase));
    sheet.addEventListener('cancel', (e) => { e.preventDefault(); closeCase(); });
  }

  /* -------------------------------------------------------------- cursor */
  if (fineMq.matches && !reduced()) {
    const tip = document.createElement('div');
    tip.className = 'cursor';
    tip.setAttribute('aria-hidden', 'true');
    document.body.appendChild(tip);
    let cx = 0, cy = 0, on = false;
    const targets = [['button[data-case]', 'open.'], ['[data-reel]', 'drag.']];
    addEventListener('pointermove', (e) => {
      const hit = targets.find(([sel]) => e.target.closest && e.target.closest(sel));
      on = !!hit && !(sheet && sheet.open);
      if (hit) tip.textContent = hit[1];
      tip.classList.toggle('is-on', on);
    }, { passive: true });
    const follow = () => {
      cx = lerp(cx, pointer.x + 26, 0.22); cy = lerp(cy, pointer.y + 26, 0.22);
      tip.style.transform = `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px) translate(-50%, -50%)`;
      requestAnimationFrame(follow);
    };
    requestAnimationFrame(follow);
  }

  /* ------------------------------------------------------------- the steps */
  // Four cards. Each one draws its picture once when it comes into view, then keeps one small loop.
  const route = $('[data-route]');
  if (route) {
    const items = Array.from(route.children);
    if (reduced() || !('IntersectionObserver' in window)) items.forEach((li) => li.classList.add('is-lit'));
    else {
      route.classList.add('is-armed');
      const rio = new IntersectionObserver((es) => {
        es.forEach((e) => { if (!e.isIntersecting) return; e.target.classList.add('is-lit'); rio.unobserve(e.target); });
      }, { threshold: 0.35 });
      items.forEach((li) => rio.observe(li));
    }
  }

  /* ---------------------------------------------------------------- wall */
  // Hand them out, leave them behind.
  const stage = $('[data-wall-stage]');
  if (stage) {
    const items = Array.from(stage.children);
    items.forEach((li) => {
      const img = $('img', li);
      if (img && img.width / img.height > 1.35) li.classList.add('is-wide');
      li.state = { x: 0, y: 0, vx: 0, vy: 0, r: null };
    });
    const put = (li) => {
      li.style.setProperty('--tx', `${li.state.x.toFixed(1)}px`);
      li.style.setProperty('--ty', `${li.state.y.toFixed(1)}px`);
      if (li.state.r !== null) li.style.setProperty('--r', `${li.state.r.toFixed(1)}deg`);
    };
    const limits = (li) => {
      const s = stage.getBoundingClientRect();
      const r = li.getBoundingClientRect();
      const homeX = r.left - li.state.x, homeY = r.top - li.state.y;
      return {
        minX: s.left - homeX + 8, maxX: s.right - homeX - r.width - 8,
        minY: s.top - homeY - 20, maxY: s.bottom - homeY - r.height + 20,
      };
    };
    let z = 1;

    if (fineMq.matches) {
      items.forEach((li) => {
        let held = false, px = 0, py = 0, raf = 0;
        li.addEventListener('pointerdown', (e) => {
          if (e.button !== 0) return;
          held = true; px = e.clientX; py = e.clientY; li.state.vx = li.state.vy = 0;
          cancelAnimationFrame(raf);
          li.classList.add('is-held'); li.classList.remove('is-free'); li.style.zIndex = String(++z);
          li.setPointerCapture(e.pointerId);
          e.preventDefault();
        });
        li.addEventListener('pointermove', (e) => {
          if (!held) return;
          const dx = e.clientX - px, dy = e.clientY - py; px = e.clientX; py = e.clientY;
          li.state.x += dx; li.state.y += dy; li.state.vx = dx; li.state.vy = dy;
          if (li.state.r === null) li.state.r = parseFloat(getComputedStyle(li).getPropertyValue('--r')) || 0;
          li.state.r = clamp(li.state.r + dx * 0.05, -16, 16);
          put(li);
        });
        const release = () => {
          if (!held) return;
          held = false; li.classList.remove('is-held'); li.classList.add('is-free');
          const glide = () => {
            const b = limits(li);
            li.state.x += li.state.vx; li.state.y += li.state.vy;
            li.state.vx *= 0.92; li.state.vy *= 0.92;
            if (li.state.x < b.minX || li.state.x > b.maxX) { li.state.x = clamp(li.state.x, b.minX, b.maxX); li.state.vx *= -0.4; }
            if (li.state.y < b.minY || li.state.y > b.maxY) { li.state.y = clamp(li.state.y, b.minY, b.maxY); li.state.vy *= -0.4; }
            put(li);
            if (Math.abs(li.state.vx) + Math.abs(li.state.vy) > 0.25) raf = requestAnimationFrame(glide);
            else li.classList.remove('is-free');
          };
          raf = requestAnimationFrame(glide);
        };
        li.addEventListener('pointerup', release);
        li.addEventListener('pointercancel', release);
      });
    } else {
      // Touch: a tap makes a sticker hop somewhere new, so scrolling is never trapped.
      const hint = $('[data-wall-hint]');
      if (hint) hint.textContent = 'tap them';
      items.forEach((li) => li.addEventListener('click', () => {
        const b = limits(li);
        li.state.x = clamp(li.state.x + rand(-70, 70), b.minX, b.maxX);
        li.state.y = clamp(li.state.y + rand(-50, 50), b.minY, b.maxY);
        li.state.r = rand(-14, 14);
        li.style.zIndex = String(++z);
        put(li);
      }));
    }

    const shuffle = $('[data-wall-shuffle]');
    if (shuffle) shuffle.addEventListener('click', () => {
      const wide = stage.getBoundingClientRect().width;
      items.forEach((li, n) => {
        li.classList.remove('is-free');
        const b = limits(li);
        li.state.x = clamp(rand(-wide * 0.2, wide * 0.2), b.minX, b.maxX);
        li.state.y = clamp(rand(-90, 90), b.minY, b.maxY);
        li.state.r = rand(-15, 15);
        li.style.transitionDelay = `${n * 16}ms`;
        li.style.zIndex = String(Math.ceil(rand(1, 20)));
        put(li);
        setTimeout(() => { li.style.transitionDelay = ''; }, 900);
      });
    });
  }

  /* ------------------------------------------------------------- contact */
  // Booking link, if one is set.
  if (SITE.bookingUrl) {
    $$('[data-book]').forEach((a) => { a.href = SITE.bookingUrl; a.target = '_blank'; a.rel = 'noopener'; });
  }

  // "i need" chips write the first lines of the email for you.
  const brief = $('[data-brief]');
  if (brief) {
    const chips = $$('.chip', brief);
    const mail = $('[data-brief-mail]', brief);
    const book = $('[data-brief-book]', brief);
    const compose = () => {
      const picked = chips.filter((c) => c.getAttribute('aria-pressed') === 'true').map((c) => c.textContent.trim());
      const lines = ['Hi Odd House,', '', `I need: ${picked.length ? picked.join(', ') : ''}`, 'Brand: ', 'Deadline: ', 'Anything else: ', ''];
      const q = (subject) => `mailto:${SITE.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
      if (mail) mail.href = q(picked.length ? `Brief: ${picked.join(', ')}` : 'A brief for Odd House');
      if (book && !SITE.bookingUrl) book.href = q('Book a call');
    };
    chips.forEach((c) => c.addEventListener('click', () => {
      c.setAttribute('aria-pressed', String(c.getAttribute('aria-pressed') !== 'true'));
      compose();
    }));
    compose();
  }

  $$('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    const text = b.dataset.copy;
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const t = document.createElement('textarea');
      t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); } catch (err) { /* nothing else to try */ }
      t.remove();
    }
    const was = b.textContent;
    b.textContent = 'copied'; b.classList.add('is-done');
    setTimeout(() => { b.textContent = was; b.classList.remove('is-done'); }, 1600);
  }));

  /* ---------------------------------------------------------------- clock */
  const statusEl = $('[data-status]');
  const statusText = $('[data-status-text]');
  const clockEl = $('[data-clock]');
  function tickClock() {
    let parts;
    try {
      parts = new Intl.DateTimeFormat('en-GB', { timeZone: SITE.timeZone, hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false }).formatToParts(new Date());
    } catch (e) { return; }
    const get = (t) => (parts.find((p) => p.type === t) || {}).value;
    const hh = get('hour'), mm = get('minute');
    const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday')) + 1;
    const h = parseInt(hh, 10) + parseInt(mm, 10) / 60;
    const awake = SITE.hours.days.includes(day) && h >= SITE.hours.open && h < SITE.hours.close;
    if (statusText) statusText.textContent = `manila ${hh}:${mm} ${awake ? 'the house is awake' : 'the house is asleep'}`;
    if (statusEl) { statusEl.classList.toggle('is-awake', awake); statusEl.classList.toggle('is-asleep', !awake); }
    if (clockEl) clockEl.textContent = awake
      ? `${hh}:${mm} in Manila. The house is awake.`
      : `${hh}:${mm} in Manila. The house is asleep. It reads email when it wakes up.`;
  }
  tickClock();
  setInterval(tickClock, 20000);

  /* ------------------------------------------------------------ nav here */
  // The page counter is gone in this draft; the nav still marks the section you are in.
  const pages = $$('[data-page]');
  if (pages.length && 'IntersectionObserver' in window) {
    const fio = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (!e.isIntersecting) return;
        $$('.stick--nav a').forEach((a) => a.classList.toggle('is-here', a.getAttribute('href') === `#${e.target.id}`));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    pages.forEach((p) => fio.observe(p));
  }

  /* ------------------------------------------------------------- fit text */
  // "stay odd." runs the full width of the page, whatever the page is.
  function fitAll() {
    $$('.foot__big').forEach((el) => {
      el.style.fontSize = '';
      const box = el.parentElement.getBoundingClientRect().width - parseFloat(getComputedStyle(el.parentElement).paddingLeft) * 2;
      const now = el.scrollWidth;
      if (!box || !now) return;
      const size = parseFloat(getComputedStyle(el).fontSize);
      el.style.fontSize = `${(size * (box / now) * 0.995).toFixed(2)}px`;
    });
  }
  fitAll();
  addEventListener('resize', fitAll);
  addEventListener('load', fitAll);

  /* ------------------------------------------------------------ logo tone */
  // The logo has no sticker behind it, so it takes the text colour of whatever section is under it.
  const logo = $('.logo');
  if (logo) {
    let asked = false;
    const tone = () => {
      asked = false;
      const r = logo.getBoundingClientRect();
      const under = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        .find((el) => !el.closest('.top') && el.closest('[data-tone]'));
      const sec = under && under.closest('[data-tone]');
      if (sec) root.style.setProperty('--logo', getComputedStyle(sec).color);
    };
    const ask = () => { if (!asked) { asked = true; requestAnimationFrame(tone); } };
    addEventListener('scroll', ask, { passive: true });
    addEventListener('resize', ask);
    document.addEventListener('oh:enter', () => setTimeout(tone, 50));
    tone();
  }

  /* --------------------------------------------------------- the services: media behind the halves
     Desktop: hovering one half fills the OTHER half (design -> sticker slideshow
     on the content side; content -> the reel on the design side).
     Phones and tablets: each half always has its own background, playing only on screen. */
  const halves = { content: $('[data-half="content"]'), design: $('[data-half="design"]') };
  if (halves.content && halves.design) {
    const deskMq = matchMedia('(hover: hover) and (min-width: 56.25em)');
    const shows = new Map();   // slideshow box -> timer
    const startSlides = (box) => {
      if (!box || shows.has(box) || reduced()) return;
      const imgs = Array.from(box.querySelectorAll('img'));
      let i = imgs.findIndex((im) => im.classList.contains('is-on'));
      shows.set(box, setInterval(() => {
        imgs[i].classList.remove('is-on'); i = (i + 1) % imgs.length; imgs[i].classList.add('is-on');
      }, 2200));
    };
    const stopSlides = (box) => { if (box && shows.has(box)) { clearInterval(shows.get(box)); shows.delete(box); } };
    const playVideo = (v) => { if (!v || reduced()) return; if (v.preload !== 'auto') v.preload = 'auto'; const p = v.play(); if (p && p.catch) p.catch(() => {}); };
    const stopVideo = (v) => { if (v && !v.paused) v.pause(); };
    const media = (half, kind, where) => $(`.split__media--${kind}.split__media--${where}`, half);
    const slidesOf = (half, where) => media(half, 'slides', where);
    const videoOf = (half, where) => { const box = media(half, 'video', where); return box && $('video', box); };

    // desktop hover
    const enter = (who) => {
      if (!deskMq.matches) return;
      const other = who === 'design' ? halves.content : halves.design;
      other.classList.add('is-media');
      if (who === 'design') startSlides(slidesOf(other, 'desk')); else playVideo(videoOf(other, 'desk'));
    };
    const leave = (who) => {
      if (!deskMq.matches) return;
      const other = who === 'design' ? halves.content : halves.design;
      other.classList.remove('is-media');
      if (who === 'design') stopSlides(slidesOf(other, 'desk')); else stopVideo(videoOf(other, 'desk'));
    };
    ['content', 'design'].forEach((who) => {
      halves[who].addEventListener('pointerenter', () => enter(who));
      halves[who].addEventListener('pointerleave', () => leave(who));
    });

    // phones and tablets: each half's own background, only while it's on screen
    const phoneRun = (half, on) => {
      if (half === halves.design) { on ? startSlides(slidesOf(half, 'phone')) : stopSlides(slidesOf(half, 'phone')); }
      else { on ? playVideo(videoOf(half, 'phone')) : stopVideo(videoOf(half, 'phone')); }
    };
    let phoneIo = null;
    const setMode = () => {
      [halves.content, halves.design].forEach((h) => h.classList.remove('is-media'));
      shows.forEach((t) => clearInterval(t)); shows.clear();
      document.querySelectorAll('[data-split-video]').forEach(stopVideo);
      if (phoneIo) { phoneIo.disconnect(); phoneIo = null; }
      if (!deskMq.matches && 'IntersectionObserver' in window) {
        phoneIo = new IntersectionObserver((es) => es.forEach((e) => phoneRun(e.target, e.isIntersecting)), { threshold: 0.15 });
        phoneIo.observe(halves.content); phoneIo.observe(halves.design);
      }
    };
    setMode();
    deskMq.addEventListener('change', setMode);
  }

  const year = $('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());
})();
