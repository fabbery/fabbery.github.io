/* fabbery — всё поведение сайта:
   шапка и меню, светлая/тёмная тема, тексты (i18n.js), содержимое из папки content
   (каталог, лента последних дизайнов, истории мастерской, ссылки), переходы между
   страницами без перезагрузки, призраки, заставка на главной.
   Новую страницу достаточно добавить в список PAGES (и её тексты в i18n.js). */
(() => {
  const PAGES = [
    { id: 'workshop', href: 'workshop.html' },
    { id: 'catalog',  href: 'catalog.html' }
  ];
  const ITEMS = [{ id: 'home', href: 'index.html' }, ...PAGES];
  const ORDER = ITEMS.map(p => p.id);

  const DICT = window.I18N;
  const LANGS = Object.keys(DICT);
  const FALLBACK = 'en';
  let page = document.body.dataset.page || 'home';
  const root = document.documentElement;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = matchMedia('(hover: hover) and (pointer: fine)');

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} }
  };
  const session = {
    set(k, v) { try { sessionStorage.setItem(k, v); } catch {} }
  };
  const t = (lang, key) => DICT[lang]?.[key] ?? DICT[FALLBACK][key] ?? '';
  const nextFrame = fn => requestAnimationFrame(() => requestAnimationFrame(fn));

  /* ---------- верхняя полоса ----------
     Слева кнопка разделов, по центру название, слоган и счётчик моделей,
     справа кнопка темы (и кнопка языка — появится, когда языков станет больше одного). */
  const bar = document.getElementById('siteHeader');
  bar.className = 'bar';
  bar.dataset.page = page;
  bar.innerHTML = `
    <div class="wrap bar__row">
      <div class="dd dd--menu">
        <button class="rb rb--menu" type="button" aria-expanded="false" aria-controls="menuPanel" data-i18n-aria="nav.open">
          <span class="burger" aria-hidden="true"><i></i><i></i><i></i></span>
        </button>
        <div class="dd__panel" id="menuPanel">
          <nav class="dd__inner" data-i18n-aria="nav.label">
            <span class="pill" aria-hidden="true"></span>
            ${ITEMS.map((p, i) => `<a href="${p.href}" data-go="${p.id}" style="--i:${i}"
              class="${p.id === 'home' ? 'is-home' : ''}"
              data-i18n="${p.id === 'home' ? 'nav.homeItem' : 'nav.' + p.id}"
              ${p.id === page ? 'aria-current="page"' : ''}></a>`).join('')}
          </nav>
        </div>
      </div>
      <div class="bar__center">
        <a class="brand" href="index.html" data-go="home" data-i18n="brand" data-i18n-aria="nav.home">fabbery</a>
        <p class="bar__sub"><span data-i18n="home.slogan">Just a simple 3D world</span><a class="bar__count" href="catalog.html" data-go="catalog"></a></p>
      </div>
      <div class="bar__right">
      <button class="rb rb--theme" type="button">
        <svg class="ico-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>
        <svg class="ico-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>
      </button>
      <div class="dd dd--lang">
        <button class="rb rb--lang" type="button" aria-expanded="false" aria-controls="langPanel"></button>
        <div class="dd__panel" id="langPanel">
          <div class="dd__inner" role="menu"></div>
        </div>
      </div>
      </div>
    </div>`;

  /* ---------- светлая и тёмная тема ----------
     Иконка показывает текущую тему: солнце — светлая, месяц — тёмная.
     Выбор запоминается; пока человек ничего не выбрал, тема следует за системой. */
  const themeBtn = bar.querySelector('.rb--theme');
  const darkMq = matchMedia('(prefers-color-scheme: dark)');
  const theme = () => root.dataset.theme === 'dark' ? 'dark' : 'light';
  const themeLabel = () => themeBtn.setAttribute('aria-label', t(current, theme() === 'dark' ? 'theme.toLight' : 'theme.toDark'));
  function setTheme(mode, save) {
    root.classList.add('theme-switching');
    root.dataset.theme = mode;
    if (save) store.set('fabbery-theme', mode);
    themeLabel();
    setTimeout(() => root.classList.remove('theme-switching'), 450);
  }
  themeBtn.addEventListener('click', () => setTheme(theme() === 'dark' ? 'light' : 'dark', true));
  darkMq.addEventListener?.('change', e => { if (!store.get('fabbery-theme')) setTheme(e.matches ? 'dark' : 'light', false); });

  // счётчик выпущенных моделей в шапке
  function updateCount() {
    const el = bar.querySelector('.bar__count');
    const n = (window.CATALOG?.collections || []).reduce((s, c) => s + (c.models || []).length, 0);
    el.hidden = !n;
    el.textContent = t(current, n === 1 ? 'bar.count.one' : 'bar.count.many').replace('{n}', n);
  }

  /* ---------- маленькая строчка об авторских правах внизу каждой страницы ----------
     Стоит вне <main>, поэтому при перелистывании страниц не перерисовывается */
  const copyright = document.createElement('p');
  copyright.className = 'copyright';
  copyright.dataset.i18n = 'copyright';
  document.querySelector('main').after(copyright);

  /* ---------- выпадающие списки ----------
     ПК: раскрываются при наведении, кнопкой закрепляются открытыми.
     Телефон: по нажатию на кнопку, закрываются тапом мимо. */
  const dropdowns = [];
  function makeDropdown(dd, onOpen) {
    const button = dd.querySelector('.rb');
    const state = { open: false, pinned: false, blocked: false, timer: 0 };
    const set = v => {
      if (v === state.open) return;
      state.open = v;
      dd.classList.toggle('is-open', v);
      button.setAttribute('aria-expanded', String(v));
      if (v) { dropdowns.forEach(o => o !== api && o.close()); onOpen?.(); }
    };
    const api = {
      dd, button,
      get open() { return state.open; },
      get pinned() { return state.pinned; },
      close() { state.pinned = false; dd.classList.remove('is-pinned'); set(false); }
    };
    button.addEventListener('click', () => {
      if (state.pinned || (state.open && !canHover.matches)) { api.close(); state.blocked = canHover.matches; }
      else { state.pinned = true; dd.classList.add('is-pinned'); set(true); }
    });
    dd.addEventListener('mouseenter', () => {
      if (!canHover.matches) return;
      clearTimeout(state.timer);
      if (!state.blocked) set(true);
    });
    dd.addEventListener('mouseleave', () => {
      if (!canHover.matches) return;
      state.blocked = false;
      if (!state.pinned) state.timer = setTimeout(() => set(false), 220);
    });
    dd.addEventListener('focusout', e => {
      if (!dd.contains(e.relatedTarget) && !dd.matches(':hover')) api.close();
    });
    dropdowns.push(api);
    return api;
  }
  document.addEventListener('click', e => {
    dropdowns.forEach(d => { if (d.open && !d.dd.contains(e.target)) d.close(); });
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    dropdowns.forEach(d => { if (d.open) { d.close(); d.button.focus(); } });
  });

  /* ---------- список разделов и плашка ----------
     Главная — прозрачный овал с обводкой, остальные — цветная плашка.
     При выборе пункта плашка перетекает к нему и меняет цвет, страница уезжает
     в сторону, и только потом открывается новая (въезжает с другой стороны). */
  const menuDd = bar.querySelector('.dd--menu');
  const navInner = menuDd.querySelector('.dd__inner');
  const pill = navInner.querySelector('.pill');
  const itemOf = id => navInner.querySelector(`a[data-go="${id}"]`);
  let active = page;
  let smoothReset = () => {};

  function placePill(animate) {
    const el = itemOf(active);
    if (!el) { pill.style.opacity = '0'; navInner.querySelectorAll('a').forEach(a => a.classList.remove('is-on')); return; }
    pill.style.opacity = '';
    pill.classList.toggle('no-anim', !animate);
    pill.style.width = el.offsetWidth + 'px';
    pill.style.height = el.offsetHeight + 'px';
    pill.style.translate = `${el.offsetLeft}px ${el.offsetTop}px`;
    navInner.dataset.active = active;
    navInner.querySelectorAll('a').forEach(a => a.classList.toggle('is-on', a === el));
    if (!animate) { void pill.offsetWidth; pill.classList.remove('no-anim'); }
  }
  const menu = makeDropdown(menuDd, () => { placePill(false); prefetch(); });

  /* ---------- содержимое сайта: лежит в папке content и редактируется в админке (/admin) ----------
     catalog.json — модели и коллекции, stories.json — истории мастерской, site.json — ссылки и почта.
     no-cache: браузер каждый раз сверяется с сервером, поэтому правки из админки видны сразу после публикации. */
  window.CATALOG = null; window.STORIES = null; window.SITE = null;
  const getJSON = name => fetch('content/' + name + '.json', { cache: 'no-cache' })
    .then(r => r.ok ? r.json() : null).catch(() => null);
  const contentReady = Promise.all([getJSON('catalog'), getJSON('stories'), getJSON('site')])
    .then(([catalog, stories, site]) => { window.CATALOG = catalog; window.STORIES = stories; window.SITE = site; });

  /* ---------- каталог: коллекции и карточки из content/catalog.json ---------- */
  const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const ghostSvg = (color, cls = '') => `<svg${cls ? ` class="${cls}"` : ''} viewBox="-10 -14 260 244" style="--g:${esc(color || '#FBFAFF')}" aria-hidden="true"><use href="#ghost" /></svg>`;
  // ссылка на историю — только если такая история есть в мастерской (удалённая история = нет кнопки)
  const storyAnchor = id => 'story-' + String(id).replace(/[^a-z0-9-]/gi, '-');
  const storyHref = id => id && (window.STORIES?.stories || []).some(s => s && s.id === id) ? `workshop.html#${storyAnchor(id)}` : '';
  const visibleUpcoming = () => (window.CATALOG?.upcoming || []).filter(u => u && u.name && u.show !== false);
  function renderCatalog(scope) {
    const box = scope.querySelector('[data-catalog]');
    const data = window.CATALOG;
    if (!box || !data) return;
    const card = m => {
      const story = storyHref(m.story);
      return `
          <li class="card card--${esc(m.bg || 'mint')}">
            <div class="card__pic">${m.photo ? `<img src="${esc(m.photo)}" alt="${esc(m.name)}" loading="lazy">` : ghostSvg(m.ghost, 'card__ghost')}</div>
            <h3>${esc(m.name)}</h3>
            ${m.text ? `<p>${esc(m.text)}</p>` : ''}
            <div class="card__links">
              ${m.link ? `<a href="${esc(m.link)}" target="_blank" rel="noopener" data-i18n="catalog.get"></a>` : ''}
              ${story ? `<a class="card__story" href="${story}" data-i18n="catalog.story"></a>` : ''}
            </div>
          </li>`;
    };
    // пустые коллекции не показываются, пока в них не появится хотя бы одна модель
    const colls = (data.collections || []).filter(c => c && c.name && (c.models || []).length).map(c => `
      <section class="coll">
        <header class="coll__head">
          <h2>${esc(c.name)}</h2>
          ${c.text ? `<p>${esc(c.text)}</p>` : ''}
          <span class="coll__count">${c.models.length} <span data-i18n="${c.models.length === 1 ? 'catalog.model' : 'catalog.models'}"></span></span>
        </header>
        <ul class="cards">${c.models.filter(m => m && m.name).map(card).join('')}</ul>
      </section>`).join('');
    // скоро выйдут: карточка ведёт к истории, если она выбрана
    const up = visibleUpcoming();
    const soon = up.length ? `
      <section class="coll upcoming">
        <header class="coll__head"><h2 data-i18n="catalog.next"></h2></header>
        <ul class="cards">${up.map(u => {
          const story = storyHref(u.story);
          const tag = story ? 'a' : 'div';
          return `
          <li><${tag} class="next card--${esc(u.bg || 'lemon')}"${story ? ` href="${story}"` : ''}>
            <span class="card__pic">${u.photo ? `<img src="${esc(u.photo)}" alt="${esc(u.name)}" loading="lazy">` : ghostSvg(u.ghost, 'card__ghost')}</span>
            <b>${esc(u.name)}</b>
            ${u.text ? `<span>${esc(u.text)}</span>` : ''}
            ${story ? '<em data-i18n="catalog.story"></em>' : ''}
          </${tag}></li>`;
        }).join('')}</ul>
      </section>` : '';
    box.innerHTML = colls + soon;
  }

  /* ---------- лента последних дизайнов на главной ----------
     Карточки медленно едут сами; стрелки и свайп листают; при наведении или после нажатия лента замирает */
  let latestStop = null;
  // '2026-11-14' → 'Nov 14, 2026', '2026-11' → 'Nov 2026'
  function releasedText(v) {
    const [y, m, d] = String(v).split('-').map(Number);
    if (!y || !m) return String(v);
    const date = new Date(Date.UTC(y, m - 1, d || 1));
    const opts = d ? { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' } : { month: 'short', year: 'numeric', timeZone: 'UTC' };
    try { return date.toLocaleDateString(current || 'en', opts); } catch { return String(v); }
  }
  function renderLatest(scope) {
    const box = scope.querySelector('[data-latest]');
    const data = window.CATALOG;
    if (!box || !data) return;
    // самые свежие — по дате выпуска; модели без даты идут после, новые снизу списка считаются свежее
    const models = (data.collections || []).flatMap(c => (c.models || []).filter(m => m && m.name).map(m => ({ ...m, collection: c.name })))
      .map((m, i) => ({ m, i }))
      .sort((a, b) => (b.m.released || '').localeCompare(a.m.released || '') || b.i - a.i)
      .map(x => x.m).slice(0, data.latest || 8);
    if (!models.length) { box.hidden = true; return; }
    const tile = (m, hidden) => `
      <a class="tile tile--${esc(m.bg || 'mint')}" href="catalog.html"${hidden ? ' aria-hidden="true" tabindex="-1"' : ''}>
        <span class="tile__pic">${m.photo ? `<img src="${esc(m.photo)}" alt="" loading="lazy">` : ghostSvg(m.ghost || '#FFFFFF')}</span>
        <b>${esc(m.name)}</b><small>${esc(m.collection)}</small>${m.released ? `<time datetime="${esc(m.released)}">${esc(t(current, 'latest.released').replace('{date}', releasedText(m.released)))}</time>` : ''}
      </a>`;
    // набор повторяется, чтобы лента шла по кругу; копии скрыты от экранных читалок
    const copies = Math.max(2, Math.ceil(10 / models.length));
    const view = box.querySelector('.latest__view'), track = box.querySelector('.latest__track');
    track.innerHTML = Array.from({ length: copies * 2 }, (_, k) => models.map(m => tile(m, k > 0)).join('')).join('');
    let half = 0, pos = 0, paused = 0, hover = false, raf = 0, last = 0;
    // длина одного круга — точное расстояние между первой карточкой и её копией во второй половине
    // (scrollWidth / 2 не подходит: в нём есть поля ленты, из-за них лента дёргалась при перескоке)
    const measure = () => {
      const tiles = track.children, n = tiles.length / 2;
      half = tiles[n] ? tiles[n].offsetLeft - tiles[0].offsetLeft : 0;
    };
    const wrap = () => { if (half && view.scrollLeft >= half) view.scrollLeft -= half; if (view.scrollLeft < 1 && half) view.scrollLeft += half; };
    const tick = now => {
      raf = requestAnimationFrame(tick);
      // ширину меряем, когда лента уже на странице (после перелистывания она вставляется позже)
      if (!half) { if (!view.isConnected) return; measure(); if (!half) return; view.scrollLeft = 1; pos = 1; }
      const dt = Math.min(50, now - (last || now)); last = now;
      if (hover || now < paused || reduceMotion || document.hidden) { pos = view.scrollLeft; return; }
      pos = (Math.abs(pos - view.scrollLeft) > 2 ? view.scrollLeft : pos) + dt * .03;
      view.scrollLeft = pos; wrap(); pos = view.scrollLeft;
    };
    raf = requestAnimationFrame(tick);
    const hold = ms => { paused = performance.now() + ms; };
    const step = () => (track.querySelector('.tile')?.offsetWidth || 150) + 16;
    box.querySelector('.latest__arrow--next').onclick = () => { hold(4000); wrap(); view.scrollBy({ left: step() * 2, behavior: reduceMotion ? 'instant' : 'smooth' }); };
    box.querySelector('.latest__arrow--prev').onclick = () => { hold(4000); if (view.scrollLeft < step() * 2) view.scrollLeft += half; view.scrollBy({ left: -step() * 2, behavior: reduceMotion ? 'instant' : 'smooth' }); };
    view.addEventListener('scroll', () => { if (performance.now() < paused) wrap(); }, { passive: true });
    view.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hover = true; });
    view.addEventListener('pointerleave', () => { hover = false; });
    view.addEventListener('touchstart', () => hold(5000), { passive: true });
    view.addEventListener('wheel', () => hold(4000), { passive: true });
    box.addEventListener('focusin', () => hold(8000));
    addEventListener('resize', measure);
    latestStop = () => { cancelAnimationFrame(raf); removeEventListener('resize', measure); };
  }

  /* ---------- истории мастерской из content/stories.json ----------
     История — это набор блоков в любом порядке: заголовок, подзаголовок, текст,
     фото в рамках, цвета, плашка в конце. Блоки добавляются в админке. */

  // текст из админки: абзацы, **жирный**, *курсив*, [ссылки](https://…) и списки «- пункт»
  const inline = s => esc(s)
    .replace(/\\([\\`*_[\]()#+\-.!])/g, (_, ch) => `&#${ch.charCodeAt(0)};`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
      const href = url.replace(/&amp;/g, '&');
      if (!/^(https?:|mailto:|\/|#|[\w-]+\.html)/i.test(href)) return label;
      const ext = /^https?:/i.test(href);
      return `<a href="${esc(href)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`;
    })
    .replace(/(\*\*|__)(.+?)\1/g, '<strong>$2</strong>')
    .replace(/(^|[^\w*])[*_](?!\s)(.+?)[*_](?!\w)/g, '$1<em>$2</em>')
    .replace(/ {2,}$|\\$/gm, '').replace(/\n/g, '<br>');
  const md = text => String(text || '').replace(/\r/g, '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean).map(p => {
    const lines = p.split('\n');
    if (lines.every(l => /^\s*[-*+]\s+/.test(l))) return `<ul>${lines.map(l => `<li>${inline(l.replace(/^\s*[-*+]\s+/, ''))}</li>`).join('')}</ul>`;
    if (lines.every(l => /^\s*\d+[.)]\s+/.test(l))) return `<ol>${lines.map(l => `<li>${inline(l.replace(/^\s*\d+[.)]\s+/, ''))}</li>`).join('')}</ol>`;
    return `<p>${inline(p)}</p>`;
  }).join('');

  const TILT = [-2, 1.5, -1, 2, -1.5, 1];
  const BLOCKS = {
    heading: b => b.text ? `<h3 class="story__h">${esc(b.text)}</h3>` : '',
    subheading: b => b.text ? `<h4 class="story__sub">${esc(b.text)}</h4>` : '',
    text: b => b.body ? `<div class="story__text${b.large ? ' story__text--large' : ''}">${md(b.body)}</div>` : '',
    photos: b => {
      const list = (b.photos || []).filter(s => s && (s.image || s.caption));
      if (!list.length) return '';
      const layout = ['one', 'two', 'three'].includes(b.layout) ? b.layout : 'three';
      return `<div class="snaps snaps--${layout}${b.tape === 'pink' ? ' snaps--pink' : ''}">${list.map((s, i) => `
        <figure class="snap" style="--r:${TILT[i % TILT.length]}deg">
          ${s.image ? `<img class="snap__img" src="${esc(s.image)}" alt="${esc(s.caption || '')}" loading="lazy">` : '<div class="snap__img" data-ph></div>'}
          ${s.caption ? `<figcaption>${esc(s.caption)}</figcaption>` : ''}
        </figure>`).join('')}</div>`;
    },
    colors: b => {
      const list = (b.colors || []).filter(c => c && c.name);
      return list.length ? `<ul class="swatches">${list.map(c => `
        <li>${ghostSvg(c.color)}<span>${esc(c.name)}</span><em${c.kept ? '' : ' class="is-out"'} data-i18n="workshop.${c.kept ? 'kept' : 'out'}"></em></li>`).join('')}</ul>` : '';
    },
    callout: b => b.text ? `<div class="story__end"><p>${esc(b.text)}</p>${b.button ? '<a class="half__cta" href="catalog.html" data-i18n="workshop.toCatalog"></a>' : ''}</div>` : ''
  };
  function renderStories(scope) {
    const box = scope.querySelector('[data-stories]');
    const list = window.STORIES?.stories;
    if (!box || !list) return;
    box.innerHTML = list.filter(s => s && s.id && s.name).map(s => {
      const id = storyAnchor(s.id);
      const icon = s.icon_photo ? `<img src="${esc(s.icon_photo)}" alt="" loading="lazy">` : ghostSvg(s.icon_color);
      return `
      <article class="story" id="${id}">
        <button class="story__toggle" id="${id}-toggle" type="button" aria-expanded="false" aria-controls="${id}-body">
          <span class="story__icon story__icon--${esc(s.icon_bg || 'mint')}${s.icon_photo ? ' story__icon--photo' : ''}">${icon}</span>
          <span class="story__name"><b>${esc(s.name)}</b>${s.subtitle ? `<i>${esc(s.subtitle)}</i>` : ''}</span>
          <span class="story__open"><span class="story__word" data-i18n="workshop.open"></span><span class="story__word story__word--close" data-i18n="workshop.close"></span><span class="story__plus" aria-hidden="true"></span></span>
        </button>
        <div class="story__body" id="${id}-body" role="region" aria-labelledby="${id}-toggle">
          <div class="story__inner">
            <header class="story__head">
              ${s.status === 'wip' ? '<p class="story__tag story__tag--wip" data-i18n="workshop.wip"></p>' : `<p class="story__tag">${esc(s.name)}</p>`}
              ${s.title ? `<h2>${esc(s.title)}</h2>` : ''}
            </header>
            ${(s.blocks || []).map(b => (b && BLOCKS[b.type] ? BLOCKS[b.type](b) : '')).join('')}
          </div>
        </div>
      </article>`;
    }).join('');
  }

  /* ---------- ссылки на соцсети и почта из content/site.json ---------- */
  function applyLinks(scope) {
    const site = window.SITE;
    if (!site) return;
    scope.querySelectorAll('[data-link]').forEach(a => { if (site[a.dataset.link]) a.href = site[a.dataset.link]; });
    if (site.email) {
      scope.querySelectorAll('[data-email]').forEach(a => { a.href = 'mailto:' + site.email; a.textContent = site.email; a.dataset.copyAlso = site.email; });
      scope.querySelectorAll('[data-email-copy]').forEach(b => { b.dataset.copy = site.email; });
    }
  }

  // всё, что строится из содержимого
  function renderAll(scope) {
    renderCatalog(scope);
    renderLatest(scope);
    renderStories(scope);
    applyLinks(scope);
    initStories(scope);
    translate(scope, current);
  }

  /* ---------- переходы между страницами без перезагрузки ----------
     Новая страница подгружается в фоне, и меняется только <main>.
     Шапка и открытое меню остаются теми же самыми элементами, поэтому никуда не уплывают. */
  const hrefOf = id => ITEMS.find(p => p.id === id).href;
  const idOfUrl = url => {
    let u; try { u = new URL(url, location.href); } catch { return null; }
    if (u.origin !== location.origin) return null;
    const file = u.pathname.split('/').pop() || 'index.html';
    const item = ITEMS.find(p => p.href === file);
    return item ? item.id : null;
  };
  const cache = new Map();
  const load = href => {
    const key = new URL(href, location.href).href;
    if (!cache.has(key)) {
      cache.set(key, fetch(key, { credentials: 'same-origin' })
        .then(r => { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then(html => new DOMParser().parseFromString(html, 'text/html'))
        .catch(err => { cache.delete(key); throw err; }));
    }
    return cache.get(key);
  };
  // заранее подгружаем остальные страницы, когда открывается меню
  const prefetch = () => ITEMS.forEach(p => p.id !== page && load(p.href).catch(() => {}));

  const OUT = {
    left:  'translateX(-24%)',
    right: 'translateX(24%)'
  };
  let navToken = 0;

  function swapTo(id, doc, dir) {
    const oldMain = document.querySelector('main:not(.page-old)');
    document.querySelectorAll('main.page-old').forEach(m => m.remove());
    const newMain = document.importNode(doc.querySelector('main'), true);
    // рисунок призрака (спрайт) есть на каждой странице; на всякий случай переносим, если его нет
    if (!document.getElementById('ghost')) {
      const sprite = doc.getElementById('ghost')?.closest('svg');
      if (sprite) document.body.prepend(document.importNode(sprite, true));
    }
    page = id;
    document.body.dataset.page = id;
    if (latestStop) { latestStop(); latestStop = null; }
    renderAll(newMain);
    document.title = t(current, 'title.' + id);
    navInner.querySelectorAll('a[data-go]').forEach(a => {
      if (a.dataset.go === id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });

    if (!dir) { oldMain.replaceWith(newMain); scrollTo(0, 0); smoothReset(); return; }

    // старая страница фиксируется на месте и уходит, новая сразу въезжает с другой стороны
    // фиксируем старую страницу ровно там, где она была: те же отступы и ширина, иначе она дёргается
    const r = oldMain.getBoundingClientRect();
    oldMain.style.cssText += `;top:${r.top}px;left:${r.left}px;width:${r.width}px;max-width:none;`;
    oldMain.classList.add('page-old');
    oldMain.setAttribute('aria-hidden', 'true');
    oldMain.inert = true;
    oldMain.after(newMain);
    scrollTo(0, 0); smoothReset();
    const back = dir === 'left' ? 'right' : 'left';
    oldMain.style.transformOrigin = dir === 'left' ? 'right center' : 'left center';
    newMain.style.transformOrigin = dir === 'left' ? 'left center' : 'right center';
    const out = oldMain.animate(
      [{ transform: 'none', opacity: 1, offset: 0 }, { opacity: 0, offset: .45 }, { transform: OUT[dir], opacity: 0 }],
      { duration: 450, easing: 'cubic-bezier(.5, 0, .75, .3)', fill: 'forwards' });
    newMain.animate(
      [{ transform: OUT[back], opacity: 0 }, { opacity: 1, offset: .5 }, { transform: 'none', opacity: 1 }],
      { duration: 600, delay: 150, easing: 'cubic-bezier(.2, .7, .2, 1)', fill: 'backwards' })
      .finished.then(() => { newMain.style.transformOrigin = ''; }, () => {});
    out.finished.then(() => oldMain.remove(), () => oldMain.remove());
  }

  /* ---------- истории в мастерской: разворачиваются прямо на странице ---------- */
  const absTop = el => { let y = 0; for (let n = el; n; n = n.offsetParent) y += n.offsetTop; return y; };
  // своя плавная прокрутка: идёт в такт с раскрытием истории (та же длительность и кривая)
  let tween = 0;
  const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const scrollToY = (y, smooth) => {
    smoothReset();
    cancelAnimationFrame(tween);
    const to = Math.max(0, Math.min(y - bar.offsetHeight - 16, root.scrollHeight - innerHeight + 2000));
    if (!smooth || reduceMotion) { scrollTo({ top: to, behavior: 'instant' }); return; }
    const from = scrollY, start = performance.now(), dur = 800;
    const step = now => {
      const k = Math.min(1, (now - start) / dur);
      scrollTo({ top: from + (to - from) * ease(k), behavior: 'instant' });
      if (k < 1) tween = requestAnimationFrame(step); else smoothReset();
    };
    tween = requestAnimationFrame(step);
  };
  // если человек сам крутит колесо или тянет пальцем — не мешаем ему
  ['wheel', 'touchstart', 'keydown'].forEach(type => addEventListener(type, () => cancelAnimationFrame(tween), { passive: true }));
  const setHash = hash => { try { history.replaceState(history.state, '', hash || location.pathname + location.search); } catch {} };
  function setStory(story, open, animate) {
    if (!animate) story.classList.add('no-anim');
    story.classList.toggle('is-open', open);
    story.querySelector('.story__toggle').setAttribute('aria-expanded', String(open));
    story.querySelector('.story__body').inert = !open;
    if (!animate) { void story.offsetHeight; nextFrame(() => story.classList.remove('no-anim')); }
  }
  function initStories(scope) {
    scope.querySelectorAll('.story').forEach(s => setStory(s, s.classList.contains('is-open'), false));
  }
  // открыть историю; другие открытые остаются открытыми
  function openStory(story, animate) {
    setStory(story, true, animate);
    setHash('#' + story.id);
    const y = absTop(story);
    const viewTop = scrollY + bar.offsetHeight;
    if (!animate || y < viewTop || y > viewTop + innerHeight * .35) scrollToY(y, animate);
  }
  function closeStory(story) {
    setStory(story, false, true);
    if (location.hash === '#' + story.id) {
      const other = [...document.querySelectorAll('.story.is-open')].pop();
      setHash(other ? '#' + other.id : '');
    }
    const y = absTop(story);
    if (y < scrollY + bar.offsetHeight) scrollToY(y, true);
  }
  document.addEventListener('click', e => {
    const btn = e.target.closest('.story__toggle');
    if (!btn) return;
    const story = btn.closest('.story');
    if (story.classList.contains('is-open')) closeStory(story); else openStory(story, true);
  });

  function scrollToHash(hash, smooth) {
    let el = null; try { el = document.querySelector(hash); } catch {}
    if (!el) return;
    if (el.classList.contains('story')) { openStory(el, smooth); return; }
    scrollToY(absTop(el), smooth);
    setHash(hash);
  }

  function goTo(id, opts = {}) {
    if (id === page) { if (!opts.pop) menu.close(); return; }
    const href = hrefOf(id);
    const dir = reduceMotion ? null : (ORDER.indexOf(id) > ORDER.indexOf(page) ? 'left' : 'right');
    const token = ++navToken;
    active = id;
    placePill(true);                               // плашка перетекает к выбранному пункту
    bar.dataset.page = id;                         // кнопка разделов перекрашивается в цвет новой страницы
    const started = performance.now();
    load(href).then(doc => {
      if (token !== navToken) return;
      // даём плашке немного доплыть, если меню открыто
      const wait = menu.open && dir ? Math.max(0, 180 - (performance.now() - started)) : 0;
      setTimeout(() => {
        if (token !== navToken) return;
        if (!opts.pop) { try { history.pushState({ page: id }, '', href + (opts.hash || '')); } catch {} }
        swapTo(id, doc, dir);
        if (opts.hash) requestAnimationFrame(() => scrollToHash(opts.hash, false));
        // на телефоне меню закрывается, когда новая страница уже въехала
        if (!canHover.matches && menu.open) setTimeout(() => { if (token === navToken) menu.close(); }, 450);
      }, wait);
    }).catch(() => { location.href = href; });
  }

  // любые ссылки на свои страницы (меню, название, половины на главной) — без перезагрузки
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target && a.target !== '_self') return;
    const id = a.dataset.go || idOfUrl(a.href);
    if (!id) return;
    const hash = a.dataset.go ? '' : new URL(a.href, location.href).hash;
    e.preventDefault();
    if (id === page && hash) { scrollToHash(hash, true); return; }
    goTo(id, { hash });
  });
  try { history.replaceState({ page }, ''); } catch {}
  window.addEventListener('popstate', e => {
    const id = (e.state && e.state.page) || idOfUrl(location.href);
    if (id) goTo(id, { pop: true });
  });

  // страница из кэша «Назад»/«Вперёд» после ухода с сайта: вернуть всё на место
  window.addEventListener('pageshow', e => {
    if (!e.persisted) return;
    active = page; bar.dataset.page = page; menu.close(); placePill(false);
  });
  window.addEventListener('resize', () => placePill(false));

  /* ---------- языки ---------- */
  const langDd = bar.querySelector('.dd--lang');
  const langBtn = langDd.querySelector('.rb');
  const langList = langDd.querySelector('.dd__inner');
  const langMenu = makeDropdown(langDd);
  if (LANGS.length < 2) langDd.hidden = true;   // один язык — кнопка не нужна

  function detect() {
    const saved = store.get('fabbery-lang');
    if (saved && DICT[saved]) return saved;
    for (const l of navigator.languages || [navigator.language || '']) {
      const code = l.slice(0, 2).toLowerCase();
      if (DICT[code]) return code;
    }
    return FALLBACK;
  }

  let current = FALLBACK;
  function translate(scope, l) {
    scope.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(l, el.dataset.i18n); });
    scope.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(l, el.dataset.i18nAria)); });
  }
  function apply(l) {
    current = l;
    root.lang = l;
    document.title = t(l, 'title.' + page);
    document.querySelector('meta[name="description"]').content = t(l, 'meta.description');
    translate(document, l);
    langBtn.textContent = l;
    langBtn.setAttribute('aria-label', t(l, 'lang.button'));
    updateCount();
    themeLabel();
    langList.setAttribute('aria-label', t(l, 'lang.menu'));
    // список языков строится один раз, дальше меняется только отметка выбранного —
    // так открытое меню не мигает и не пропадает при смене языка
    if (!langList.children.length) {
      langList.innerHTML = LANGS.map((code, i) => `
        <button class="lang-opt" type="button" role="menuitemradio" style="--i:${i}"
          data-lang="${code}" lang="${code}">
          <span>${DICT[code].name}</span><b>${code}</b>
        </button>`).join('');
    }
    langList.querySelectorAll('.lang-opt').forEach(o => o.setAttribute('aria-checked', String(o.dataset.lang === l)));
    placePill(false);
  }
  langList.addEventListener('click', e => {
    const o = e.target.closest('.lang-opt');
    if (!o) return;
    store.set('fabbery-lang', o.dataset.lang);
    apply(o.dataset.lang);
    // на ПК меню остаётся открытым, пока на нём мышь; на телефоне закрывается чуть позже,
    // чтобы было видно, какой язык выбран
    if (!canHover.matches) setTimeout(() => langMenu.close(), 350);
  });

  /* ---------- запуск ---------- */
  apply(detect());
  contentReady.then(() => {
    renderAll(document.querySelector('main:not(.page-old)') || document);
    updateCount();
    if (location.hash) requestAnimationFrame(() => scrollToHash(location.hash, false));
  });

  if (document.fonts) document.fonts.ready.then(() => placePill(false));

  /* ---------- кнопка «скопировать почту» ---------- */
  document.addEventListener('click', e => {
    // нажатие на сам адрес: почта открывается в отдельном окне (страница остаётся на месте),
    // а адрес заодно копируется — на случай, если почтовая программа не настроена
    const mail = e.target.closest('[data-copy-also]');
    const btn = mail ? document.querySelector('[data-copy="' + mail.dataset.copyAlso + '"]') : e.target.closest('[data-copy]');
    if (!btn) return;
    const done = () => {
      btn.textContent = t(current, 'mail.copied'); btn.classList.add('is-done');
      clearTimeout(btn._t);
      btn._t = setTimeout(() => { btn.textContent = t(current, btn.dataset.i18n); btn.classList.remove('is-done'); }, 1600);
    };
    const text = btn.dataset.copy;
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => fallback());
    else fallback();
    function fallback() {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch {}
      ta.remove();
    }
  });

  /* ---------- призраки: глаза следят за курсором, иногда моргают, подпрыгивают от нажатия ---------- */
  const ghosts = () => [...document.querySelectorAll('main use[href="#ghost"]')].map(u => u.ownerSVGElement).filter(Boolean);
  let lookAt = null, lookRaf = 0;
  function aimEyes() {
    lookRaf = 0;
    ghosts().forEach(g => {
      if (!lookAt) { g.style.setProperty('--ex', '0px'); g.style.setProperty('--ey', '0px'); return; }
      const r = g.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight || !r.width) return;
      const dx = lookAt.x - (r.left + r.width / 2), dy = lookAt.y - (r.top + r.height * .48);
      const d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 260);
      g.style.setProperty('--ex', (dx / d * 6 * k).toFixed(2) + 'px');
      g.style.setProperty('--ey', (dy / d * 5 * k).toFixed(2) + 'px');
    });
  }
  const look = p => { lookAt = p; if (!lookRaf) lookRaf = requestAnimationFrame(aimEyes); };
  addEventListener('pointermove', e => { if (e.pointerType === 'mouse') look({ x: e.clientX, y: e.clientY }); }, { passive: true });
  document.addEventListener('mouseleave', () => look(null));
  let lookTimer = 0;
  addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') return;
    look({ x: e.clientX, y: e.clientY });            // на телефоне призраки смотрят туда, куда нажали
    clearTimeout(lookTimer); lookTimer = setTimeout(() => look(null), 1400);
  }, { passive: true });
  addEventListener('scroll', () => { if (lookAt) look(lookAt); }, { passive: true });

  if (!reduceMotion) {
    (function blink() {
      setTimeout(() => {
        ghosts().forEach(g => {
          if (Math.random() < .55) {
            g.style.setProperty('--eb', '.12');
            setTimeout(() => g.style.setProperty('--eb', '1'), 130);
          }
        });
        blink();
      }, 2600 + Math.random() * 2600);
    })();
  }

  // нажми на призрака — подпрыгнет; пять раз подряд — пойдёт дождь из призраков
  const GHOST_HIT = '.half__mascot, .half__santa, .card__ghost, .lost__ghost, .swatches svg';
  let boos = 0, booTimer = 0;
  document.addEventListener('click', e => {
    const g = e.target.closest && e.target.closest(GHOST_HIT);
    if (!g) return;
    e.preventDefault(); e.stopPropagation();
    g.classList.remove('boo'); void g.getBoundingClientRect(); g.classList.add('boo');
    g.addEventListener('animationend', () => g.classList.remove('boo'), { once: true });
    boos++; clearTimeout(booTimer); booTimer = setTimeout(() => { boos = 0; }, 1600);
    if (boos >= 5) { boos = 0; ghostRain(); }
  }, true);

  function ghostRain() {
    if (reduceMotion || document.querySelector('.ghost-rain')) return;
    const box = document.createElement('div');
    box.className = 'ghost-rain'; box.setAttribute('aria-hidden', 'true');
    const colors = ['#FFFFFF', '#FFD84F', '#7FDBB6', '#FFA3CB', '#BFA9FF', '#A3C6FF'];
    const NS = 'http://www.w3.org/2000/svg';
    for (let i = 0; i < 28; i++) {
      const s = document.createElementNS(NS, 'svg');
      s.setAttribute('viewBox', '-10 -14 260 244');
      const size = 28 + Math.random() * 44;
      s.style.width = size + 'px';
      s.style.left = (Math.random() * 100) + '%';
      s.style.setProperty('--g', colors[i % colors.length]);
      s.style.setProperty('--dur', (1.8 + Math.random() * 1.6).toFixed(2) + 's');
      s.style.setProperty('--delay', (Math.random() * .7).toFixed(2) + 's');
      s.style.setProperty('--r0', (Math.random() * 60 - 30).toFixed(0) + 'deg');
      s.style.setProperty('--r1', (Math.random() * 120 - 60).toFixed(0) + 'deg');
      const u = document.createElementNS(NS, 'use');
      u.setAttribute('href', '#ghost');
      s.appendChild(u); box.appendChild(s);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 4200);
  }

  /* ---------- карточки соцсетей: каждый раз отклоняются немного по-разному ---------- */
  document.addEventListener('pointerover', e => {
    const card = e.target.closest && e.target.closest('.where__card');
    if (!card || card.contains(e.relatedTarget)) return;
    const r = (a, b) => a + Math.random() * (b - a);
    const side = Math.random() < .5 ? -1 : 1;
    card.style.setProperty('--rot', (side * r(.8, 2.6)).toFixed(2) + 'deg');
    card.style.setProperty('--ty', (-r(5, 11)).toFixed(1) + 'px');
    card.style.setProperty('--tx', (side * r(0, 3)).toFixed(1) + 'px');
  });

  /* ---------- плавная прокрутка колесом мыши ---------- */
  if (!reduceMotion) {
    let target = scrollY, cur = scrollY, raf = 0;
    smoothReset = () => { cancelAnimationFrame(raf); raf = 0; target = cur = scrollY; };
    const maxY = () => root.scrollHeight - innerHeight;
    const step = () => {
      cur += (target - cur) * 0.12;
      if (Math.abs(target - cur) < 0.5) cur = target;
      scrollTo({ top: cur, behavior: 'instant' });
      raf = cur === target ? 0 : requestAnimationFrame(step);
    };
    addEventListener('wheel', e => {
      if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (root.classList.contains('intro-lock') || e.target.closest('.dd__panel')) return;
      e.preventDefault();
      if (!raf) target = cur = scrollY;
      const k = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? innerHeight : 1;
      target = Math.max(0, Math.min(maxY(), target + e.deltaY * k));
      if (!raf) raf = requestAnimationFrame(step);
    }, { passive: false });
    // прокрутка клавишами, ползунком или пальцем — просто запоминаем позицию
    addEventListener('scroll', () => { if (!raf) target = cur = scrollY; }, { passive: true });
  }

  /* ---------- заставка на главной ---------- */
  const intro = document.getElementById('intro');
  if (intro && !root.classList.contains('no-intro')) {
    session.set('fabbery-intro', '1');
    root.classList.add('intro-lock');
    const timers = [];
    const finish = () => {
      timers.forEach(clearTimeout);
      intro.remove();
      root.classList.remove('intro-lock');
    };
    // 0 → 1.6 c: призрак печатается слоями; 2.2 c: фон уезжает вверх, за ним призрак
    timers.push(setTimeout(() => intro.classList.add('is-printed'), 1650));
    timers.push(setTimeout(() => intro.classList.add('is-leaving'), 2250));
    timers.push(setTimeout(finish, 3400));
    intro.addEventListener('click', finish);
    document.addEventListener('keydown', function skip(e) {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { finish(); document.removeEventListener('keydown', skip); }
    });
  }
})();
