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

  /* ── pricing: billing switch, add-on pop-ups and running totals ── */
  const pricing = $('.pricing');
  let pdata = null;
  try { pdata = JSON.parse(($('#pricing-data') || {}).textContent || 'null'); } catch (e) {}
  if (pricing && pdata) {
    const inr = v => '₹' + Math.round(v).toLocaleString('en-IN');
    const plans = {}, addons = {};
    pdata.plans.forEach(p => { plans[p.id] = p; });
    pdata.addons.forEach(a => { addons[a.id] = a; });
    const picked = {};
    pdata.plans.forEach(p => { picked[p.id] = new Set(); });
    const sw = $('.bill-sw', pricing);
    const opts = $$('[role="radio"]', sw);
    const periods = opts.map(o => o.dataset.billing);
    const dlg = $('#addonDlg', pricing);
    let billing = pricing.dataset.billing || 'monthly';
    let cur = null;   // the add-on pop-up's { plan, addon, opener }

    const names = ids => ids.map(a => addons[a].name);
    const list = arr => arr.length < 2 ? arr.join('') : arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];
    const quarterly = () => billing === 'quarterly';
    const total = (id, sel) => quarterly() ? plans[id].quarterly + 3 * pdata.addon_price * sel.size : plans[id].monthly + pdata.addon_price * sel.size;
    const per = () => quarterly() ? 'for 3 months' : 'a month';
    // a bigger plan that already has everything chosen, for the same money or less
    const better = (id, sel) => {
      if (billing === 'yearly' || !sel.size) return null;
      const want = plans[id].includes.concat([...sel]);
      const key = quarterly() ? 'quarterly' : 'monthly';
      const t = total(id, sel);
      return pdata.plans.filter(p => p[key] > plans[id][key] && p[key] <= t && want.every(a => p.includes.includes(a)))
        .sort((a, b) => a[key] - b[key])[0] || null;
    };
    const tip = (id, sel) => {
      const b = better(id, sel);
      if (!b) return '';
      const key = quarterly() ? 'quarterly' : 'monthly';
      return b[key] === total(id, sel) ? `${b.name} costs the same and includes all of these.` : `${b.name} includes all of these for less: ${inr(b[key])} ${per()}.`;
    };
    const waLink = id => {
      const extra = names([...picked[id]]);
      const plus = extra.length ? `, with ${list(extra)}` : '';
      const text = billing === 'yearly'
        ? `Hi, could you send a yearly quote for the Field CRM ${plans[id].name} plan${plus}? We have __ people in the field.`
        : `Hi, I'd like to start on the Field CRM ${plans[id].name} plan, billed ${billing}${plus}. We have __ people in the field.`;
      return `https://wa.me/${pdata.whatsapp}?text=${encodeURIComponent(text)}`;
    };

    const paintCard = card => {
      const id = card.dataset.tier, sel = picked[id];
      $$('.ta-chip', card).forEach(c => c.setAttribute('aria-pressed', sel.has(c.dataset.addon)));
      const sum = $('.ta-sum', card);
      if (sum) {
        sum.replaceChildren();
        if (sel.size) {
          const head = document.createElement('b');
          head.textContent = `${plans[id].name} + ${list(names([...sel]))}`;
          const rest = billing === 'yearly' ? ': priced into your yearly quote.' : `: ${inr(total(id, sel))} ${per()} + GST.`;
          sum.append(head, rest);
          const t = tip(id, sel);
          if (t) { const s = document.createElement('span'); s.className = 'ta-tip'; s.textContent = 'Tip: ' + t; sum.append(s); }
        }
      }
      const cta = $('[data-choose]', card);
      if (cta) cta.href = waLink(id);
    };
    const paintAll = () => $$('.tier', pricing).forEach(paintCard);

    const paintDialog = () => {
      const a = addons[cur.addon], p = plans[cur.plan], on = picked[cur.plan].has(cur.addon);
      $('#addonDlgTitle', dlg).textContent = a.name;
      $('.ad-desc', dlg).textContent = a.desc;
      $('.ad-ic use', dlg).setAttribute('href', '#' + a.icon);
      $('.ad-points', dlg).replaceChildren(...a.points.map(t => { const li = document.createElement('li'); li.textContent = t; return li; }));
      const price = $('.ad-price', dlg), b = document.createElement('b');
      price.replaceChildren();
      if (billing === 'yearly') price.append('Priced into your yearly quote for ', Object.assign(b, { textContent: p.name }), '.');
      else price.append(Object.assign(b, { textContent: inr((quarterly() ? 3 : 1) * pdata.addon_price) }), ` ${per()}, on top of ${p.name}.`);
      const sim = new Set(picked[cur.plan]); sim.add(cur.addon);
      const nudge = $('.ad-nudge', dlg), t = on ? '' : tip(cur.plan, sim);
      nudge.textContent = t ? 'Tip: ' + t : '';
      nudge.hidden = !t;
      const tgl = $('[data-ad-toggle]', dlg);
      tgl.textContent = on ? `Remove from ${p.name}` : `Add to ${p.name}`;
      tgl.classList.toggle('btn-p', !on);
      tgl.classList.toggle('btn-s', on);
      $('[data-ad-more]', dlg).href = a.href;
    };

    const setBilling = (b, focus) => {
      billing = b;
      pricing.dataset.billing = b;
      opts.forEach(o => {
        const on = o.dataset.billing === b;
        o.setAttribute('aria-checked', on);
        o.tabIndex = on ? 0 : -1;
        if (on && focus) o.focus();
      });
      paintAll();
      if (cur && dlg.open) paintDialog();
    };
    const step = d => setBilling(periods[Math.min(periods.length - 1, Math.max(0, periods.indexOf(billing) + d))], true);
    let swiped = false;
    opts.forEach(o => o.addEventListener('click', () => { if (swiped) { swiped = false; return; } setBilling(o.dataset.billing); }));
    sw.addEventListener('keydown', e => {
      const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (d) { e.preventDefault(); step(d); }
    });
    // the switch can also be swiped left or right
    let sx = null;
    sw.addEventListener('pointerdown', e => { sx = e.clientX; });
    sw.addEventListener('pointercancel', () => { sx = null; });
    sw.addEventListener('pointerup', e => {
      if (sx === null) return;
      const dx = e.clientX - sx;
      sx = null;
      if (Math.abs(dx) < 24) return;
      swiped = true;
      setTimeout(() => { swiped = false; }, 0);
      step(dx > 0 ? 1 : -1);
    });

    if (dlg) {
      $$('.ta-chip', pricing).forEach(c => c.addEventListener('click', () => {
        cur = { plan: c.closest('.tier').dataset.tier, addon: c.dataset.addon, opener: c };
        if (typeof dlg.showModal !== 'function') { location.href = addons[cur.addon].href; return; }
        paintDialog();
        dlg.showModal();
      }));
      $('[data-ad-toggle]', dlg).addEventListener('click', () => {
        const s = picked[cur.plan];
        if (s.has(cur.addon)) s.delete(cur.addon); else s.add(cur.addon);
        paintCard($(`.tier[data-tier="${cur.plan}"]`, pricing));
        dlg.close();
      });
      // a click on the dimmed backdrop closes the pop-up
      dlg.addEventListener('click', e => {
        if (e.target !== dlg) return;
        const r = dlg.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close();
      });
      dlg.addEventListener('close', () => { if (cur && cur.opener) cur.opener.focus(); });
    }
    paintAll();
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
