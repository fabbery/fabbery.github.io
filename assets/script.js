/* fabbery — верхняя полоса, подвал, языки, переходы и заставка.
   Полоса и подвал собираются здесь, поэтому новую страницу
   достаточно добавить в список PAGES (и её текст в i18n.js). */
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
    get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch {} },
    del(k) { try { sessionStorage.removeItem(k); } catch {} }
  };
  const t = (lang, key) => DICT[lang]?.[key] ?? DICT[FALLBACK][key] ?? '';
  const nextFrame = fn => requestAnimationFrame(() => requestAnimationFrame(fn));

  /* ---------- верхняя полоса ----------
     Слева круглая кнопка разделов, по центру название, справа круглая кнопка языка. */
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
      <a class="brand" href="index.html" data-go="home" data-i18n="brand" data-i18n-aria="nav.home">fabbery</a>
      <div class="dd dd--lang">
        <button class="rb rb--lang" type="button" aria-expanded="false" aria-controls="langPanel"></button>
        <div class="dd__panel" id="langPanel">
          <div class="dd__inner" role="menu"></div>
        </div>
      </div>
    </div>`;

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
      if (v) { dropdowns.forEach(o => o !== api && o.close()); onOpen && onOpen(); }
    };
    const api = {
      dd, button,
      get open() { return state.open; },
      get pinned() { return state.pinned; },
      close() { state.pinned = false; dd.classList.remove('is-pinned'); set(false); },
      // открыть сразу, без анимации (когда список был открыт на прошлой странице)
      restore(pin) {
        dd.classList.add('no-anim');
        state.pinned = pin; dd.classList.toggle('is-pinned', pin);
        set(true);
        nextFrame(() => dd.classList.remove('no-anim'));
      },
      // закрыть, если открыт только наведением, а мыши над ним нет
      closeIfUnhovered() { if (!state.pinned) state.timer = setTimeout(() => set(false), 220); }
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
    dropdowns.forEach(d => { if (d.open && !d.dd.contains(e.target) && (!canHover.matches || true)) d.close(); });
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

  /* ---------- каталог: карточки из assets/catalog.js ---------- */
  const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  function renderCatalog(scope) {
    const box = scope.querySelector('[data-catalog]');
    const data = window.CATALOG;
    if (!box || !data) return;
    const ghost = color => `<svg class="card__ghost" viewBox="-10 -14 260 244" style="--g:${esc(color || '#FBFAFF')}" aria-hidden="true"><use href="#ghost" /></svg>`;
    box.innerHTML = data.collections.map(c => `
      <section class="coll">
        <header class="coll__head">
          <h2>${esc(c.name)}</h2>
          <p>${esc(c.text)}</p>
          <span class="coll__count">${c.models.length} <span data-i18n="${c.models.length === 1 ? 'catalog.model' : 'catalog.models'}"></span></span>
        </header>
        <ul class="cards">
          ${c.models.map(m => `
          <li class="card card--${esc(m.bg || 'mint')}">
            <div class="card__pic">${m.photo ? `<img src="${esc(m.photo)}" alt="${esc(m.name)}" loading="lazy">` : ghost(m.ghost)}</div>
            <h3>${esc(m.name)}</h3>
            <p>${esc(m.text)}</p>
            <div class="card__links">
              ${m.link ? `<a href="${esc(m.link)}" target="_blank" rel="noopener" data-i18n="catalog.get"></a>` : ''}
              ${(m.story || c.story) ? `<a class="card__story" href="workshop.html#story-${esc(m.story || c.story)}" data-i18n="catalog.story"></a>` : ''}
            </div>
          </li>`).join('')}
        </ul>
      </section>`).join('') + (data.next ? `
      <a class="next" href="workshop.html">
        <span class="next__label" data-i18n="catalog.next"></span>
        <b>${esc(data.next.name)}</b>
        <span>${esc(data.next.text)}</span>
      </a>` : '');
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
    root.classList.remove('enter-left', 'enter-right', 'leave-left', 'leave-right');
    const newMain = document.importNode(doc.querySelector('main'), true);
    // спрайт призрака есть только на главной — переносим его, если его ещё нет
    if (!document.getElementById('ghost')) {
      const sprite = doc.getElementById('ghost')?.closest('svg');
      if (sprite) document.body.prepend(document.importNode(sprite, true));
    }
    page = id;
    document.body.dataset.page = id;
    renderCatalog(newMain);
    initStories(newMain);
    translate(newMain, current);
    document.title = t(current, 'title.' + id);
    navInner.querySelectorAll('a[data-go]').forEach(a => {
      if (a.dataset.go === id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    session.set('fabbery-nav-last', id);

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
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
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
  ['wheel', 'touchstart', 'keydown'].forEach(t => addEventListener(t, () => cancelAnimationFrame(tween), { passive: true }));
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
    root.classList.remove('leave-left', 'leave-right');
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
    scope.querySelectorAll('[data-only]').forEach(el => { el.hidden = !el.dataset.only.split(' ').includes(l); });
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
  renderCatalog(document);
  initStories(document);
  apply(detect());
  if (location.hash) requestAnimationFrame(() => scrollToHash(location.hash, false));

  // Если пункт выбрали из открытого списка, на новой странице список остаётся открытым:
  // мышь ещё над ним. Как только мышь сдвинется за пределы списка — он свернётся.
  const keep = session.get('fabbery-menu-keep');
  session.del('fabbery-menu-keep');
  if (keep === 'touch' && !reduceMotion) {
    // телефон: меню видно, пока листается страница, потом оно плавно закрывается
    menu.restore(false);
    setTimeout(() => menu.close(), 700);
  } else if (keep && canHover.matches && !reduceMotion) {
    menu.restore(keep === 'pin');
    if (keep === 'hover') {
      document.addEventListener('mousemove', function firstMove(e) {
        document.removeEventListener('mousemove', firstMove);
        if (!menuDd.contains(e.target)) menu.closeIfUnhovered();
      });
    }
  }
  session.del('fabbery-nav-moved');
  session.set('fabbery-nav-last', page);
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

  /* ---------- карточки соцсетей: каждый раз отклоняются немного по-разному ---------- */
  document.addEventListener('pointerover', e => {
    const card = e.target.closest && e.target.closest('.where__card');
    if (!card || card.contains(e.relatedTarget)) return;
    const r = (a, b) => a + Math.random() * (b - a);
    const side = Math.random() < .5 ? -1 : 1;
    card.style.setProperty('--rot', (side * r(.8, 2.6)).toFixed(2) + 'deg');
    card.style.setProperty('--ty', -r(5, 11).toFixed(1) + 'px');
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
