(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nav = $('#nav');

  /* ── menu: drops down from the floating nav ── */
  const menuBtn = $('#menuBtn'), menu = $('#menu');
  const isOpen = () => root.classList.contains('menu-open');
  const setMenu = open => {
    root.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', open);
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.inert = !open;
  };
  menuBtn.addEventListener('click', e => { e.stopPropagation(); setMenu(!isOpen()); });
  $$('a', menu).forEach(a => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('click', e => { if (isOpen() && !nav.contains(e.target)) setMenu(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen()) { setMenu(false); menuBtn.focus(); } });
  matchMedia('(min-width: 920px)').addEventListener('change', e => { if (e.matches && isOpen()) setMenu(false); });

  /* ── count-up ── */
  const countUp = (el, from, to, dur, delay = 0) => {
    if (!el) return;
    if (reduce) { el.textContent = to; return; }
    el.textContent = from;
    setTimeout(() => {
      const t0 = performance.now();
      const tick = now => {
        const p = Math.min(1, (now - t0) / dur);
        el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay);
  };
  $$('[data-countup]').forEach(el => new IntersectionObserver(([e], io) => {
    if (!e.isIntersecting) return;
    countUp(el, 0, +el.dataset.countup, 1300, 120);
    io.disconnect();
  }, { threshold: 0.5 }).observe(el));

  /* ── phone demos play once they are on screen ── */
  const kpi = $('#kpiN');
  if (kpi && !reduce) kpi.textContent = 6;
  const pio = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('play');
    if (kpi && e.target.contains(kpi)) countUp(kpi, 6, 40, 1700, 900);
    pio.unobserve(e.target);
  }), { threshold: 0.3 });
  $$('[data-play]').forEach(p => pio.observe(p));

  /* ── bento widgets only animate while visible ── */
  const bio = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('live', e.isIntersecting)), { rootMargin: '60px 0px' });
  $$('.bw').forEach(w => bio.observe(w));

  /* ── feature groups: accordion on phones ── */
  const groups = $$('.fg');
  if (groups.length) {
    groups.forEach(fg => { const n = $('.fg-n', fg); if (n) n.textContent = $$('li', fg).length; });
    const wide = matchMedia('(min-width: 760px)');
    const sync = () => groups.forEach(fg => $('.fg-btn', fg).setAttribute('aria-expanded', wide.matches || fg.classList.contains('open')));
    groups.forEach(fg => $('.fg-btn', fg).addEventListener('click', () => { if (wide.matches) return; fg.classList.toggle('open'); sync(); }));
    wide.addEventListener('change', sync);
    sync();
  }

  /* ── journal contents: open on desktop, tucked away on phones ── */
  const tocWide = matchMedia('(min-width: 1040px)');
  const syncToc = () => $$('.toc details').forEach(d => { d.open = tocWide.matches; });
  tocWide.addEventListener('change', syncToc);
  syncToc();

  /* ── reveal: content is visible at rest; it only animates as it enters ── */
  $$('[data-stagger]').forEach(p => Array.from(p.children).forEach((c, i) => {
    c.setAttribute('data-reveal', '');
    c.style.setProperty('--i', i % 4);
  }));
  if (!reduce && 'IntersectionObserver' in window) {
    const vh = innerHeight;
    const rio = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('rv');
      rio.unobserve(e.target);
    }), { rootMargin: '0px 0px 8% 0px' });
    $$('[data-reveal]').forEach(el => { if (el.getBoundingClientRect().top > vh) rio.observe(el); });
  }

  /* ── prices: INR in India, USD elsewhere, with a switch ── */
  const priceData = $('#prices');
  let prices = null;
  try { prices = JSON.parse(priceData ? priceData.textContent : 'null'); } catch (e) {}
  if (prices && prices.INR) {
    root.classList.add('has-prices');
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const fmt = (c, v) => new Intl.NumberFormat(c === 'INR' ? 'en-IN' : 'en-US', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(v);
    const show = c => {
      $$('[data-plan]').forEach(el => { const v = prices[c] && prices[c][el.dataset.plan]; el.textContent = v ? fmt(c, v) : 'On request'; });
      $$('.cur-switch button').forEach(b => b.setAttribute('aria-pressed', b.dataset.cur === c));
    };
    $$('.cur-switch button').forEach(b => { if (!prices[b.dataset.cur]) b.hidden = true; b.addEventListener('click', () => show(b.dataset.cur)); });
    show(/Calcutta|Kolkata/.test(tz) || !prices.USD ? 'INR' : 'USD');
  }

  /* ── per-frame scroll work: read everything first, then write ── */
  const tasks = [];
  tasks.push({ read: () => scrollY, write: y => nav.classList.toggle('scrolled', y > 10) });

  // hero product window: tilted back, flattens as it rises into view
  const tilt = $('.show-tilt');
  if (tilt && !reduce) {
    let last = -1;
    tasks.push({
      read: () => tilt.parentElement.getBoundingClientRect(),
      write(r, vh) {
        if (r.top > vh || r.bottom < 0) return;
        const p = Math.round(clamp((vh - r.top) / (vh * 0.85), 0, 1) * 400) / 400;
        if (p === last) return;
        last = p;
        tilt.style.transform = `rotateX(${(18 * (1 - p)).toFixed(2)}deg) scale(${(0.92 + 0.08 * p).toFixed(4)}) translateZ(0)`;
      }
    });
  }

  // pinned story: scroll position picks the step
  const story = $('#story');
  if (story) {
    const stage = $('.stage', story);
    const caps = $$('.cap', story), scrs = $$('.scr', story), segs = $$('.seg', story);
    const fills = segs.map(s => $('.seg-bar i', s));
    const segP = fills.map(() => -1);
    const N = caps.length;
    let cur = -1, live = false, stageH = 1, storyH = 1, pinTop = 0;
    const restart = el => { el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); };
    const setStep = i => {
      if (i === cur) return;
      caps.forEach((c, k) => c.classList.toggle('is-active', k === i));
      scrs.forEach((s, k) => { s.classList.toggle('is-active', k === i); if (k !== i) s.classList.remove('on'); });
      restart(scrs[i]);
      segs.forEach((s, k) => k === i ? s.setAttribute('aria-current', 'step') : s.removeAttribute('aria-current'));
      cur = i;
    };
    setStep(0);
    segs.forEach((s, k) => s.addEventListener('click', () => {
      const top = story.getBoundingClientRect().top + scrollY - pinTop;
      scrollTo({ top: top + (k / N) * (storyH - stageH) + (k ? 4 : 0), behavior: reduce ? 'auto' : 'smooth' });
    }));
    tasks.push({
      measure() { stageH = stage.offsetHeight; storyH = story.offsetHeight; pinTop = parseFloat(getComputedStyle(stage).top) || 0; },
      read: () => story.getBoundingClientRect(),
      write(r, vh) {
        const isLive = r.top < vh * 0.6 && r.bottom > vh * 0.35;
        if (isLive !== live) {
          live = isLive;
          story.classList.toggle('play', live);
          if (!live) restart(scrs[cur]);   // rewind so it replays next time
        }
        if (r.bottom < -50 || r.top > vh + 50) return;
        const x = clamp((pinTop - r.top) / Math.max(1, storyH - stageH), 0, 1) * N;
        setStep(Math.min(N - 1, Math.floor(x)));
        fills.forEach((f, k) => {
          const v = k < cur ? 1 : k > cur ? 0 : Math.round((x - cur) * 500) / 500;
          if (v !== segP[k]) { f.style.transform = `scaleX(${v})`; segP[k] = v; }
        });
      }
    });
  }

  let queued = false;
  const frame = () => {
    queued = false;
    const vh = innerHeight;
    const reads = tasks.map(t => t.read(vh));
    tasks.forEach((t, i) => t.write(reads[i], vh));
  };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(frame); } };
  const measure = () => { tasks.forEach(t => t.measure && t.measure()); queue(); };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', measure);
  addEventListener('load', measure);
  if (document.fonts) document.fonts.ready.then(measure);
  measure();

  /* ── WhatsApp button on phones: after the hero, gone over the story and the closing band ── */
  const fab = $('#waFab');
  if (fab) {
    const watched = [$('.hero-cta'), story, $('.band'), $('.foot')].filter(Boolean);
    const seen = new Map();
    const upd = () => {
      const show = watched.every(el => seen.get(el) === false);
      fab.classList.toggle('show', show);
      fab.tabIndex = show ? 0 : -1;
    };
    const fio = new IntersectionObserver(es => { es.forEach(e => seen.set(e.target, e.isIntersecting)); upd(); });
    watched.forEach(el => fio.observe(el));
  }
})();
