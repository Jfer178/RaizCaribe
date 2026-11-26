/* =========================================================================
   RaízCaribe · Aplicación (enrutador, shells, notificaciones, demo)
   Rutas: #/splash · #/login · #/<rol>/<página>/<parámetro>
   Roles: comprador (web) · productor (móvil) · conductor (móvil) · admin (web)
   ========================================================================= */
window.RC = window.RC || {};
RC.views = RC.views || {};

(function () {
  const I = RC.icon, ui = RC.ui;
  const ROLES = {
    comprador: { label: 'Comprador B2B', icon: 'store', shell: 'web', user: { id: 'CMP-01', nombre: 'Hotel Caribe Plaza', sub: 'Daniela Gómez · Compras', ini: 'HC' } },
    productor: { label: 'Productor', icon: 'sprout', shell: 'phone', user: { id: 'PRD-02', nombre: 'Luis Herrera', sub: 'Finca El Porvenir · Sabanalarga', ini: 'LH' } },
    conductor: { label: 'Conductor', icon: 'truck', shell: 'phone', user: { id: 'VEH-01', nombre: 'Carlos Mendoza', sub: 'Camión refrigerado ABC-123', ini: 'CM' } },
    admin: { label: 'Administrador', icon: 'user-cog', shell: 'web', user: { id: 'OPS', nombre: 'Equipo de operación', sub: 'Administrador / Operador', ini: 'OP' } }
  };
  const app = { cur: {}, ROLES: ROLES };

  function parse() {
    const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    const parts = h.split('/');
    return { role: parts[0] || '', page: parts[1] || '', param: parts.slice(2).join('/') || null };
  }
  app.go = function (hash) { if (location.hash === hash) app.render(); else location.hash = hash; };

  function ctxFor(role, key, param) {
    const R = ROLES[role] || {};
    return {
      role: role, key: key, param: param, q: RC.api.q, api: RC.api, ui: ui, db: RC.db, icon: I,
      user: R.user, phone: R.shell === 'phone', el: document.getElementById('page'),
      overlay: document.getElementById('phone-overlay') || null,
      go: app.go, refresh: function () { app.refresh(); }
    };
  }

  /* ======================= RENDER ======================= */
  app.render = function () {
    const r = parse();
    document.body.dataset.role = r.role || 'splash';
    if (!r.role || r.role === 'splash') return renderStandalone('splash');
    if (r.role === 'login') return renderStandalone('login');
    const mod = RC.views[r.role];
    if (!mod || !ROLES[r.role]) return app.go('#/login');
    const key = mod.pages[r.page] ? r.page : mod.home;
    const page = mod.pages[key];
    RC.db.state.sesion.rol = r.role; RC.db.save();
    if (app.cur.role !== r.role || !document.querySelector('[data-shell="' + r.role + '"]')) renderShell(r.role, mod);
    app.cur = { role: r.role, key: key, param: r.param, page: page, mod: mod };
    markNav(mod, key);
    renderPage(false);
  };
  function renderStandalone(name) {
    app.cur = { role: name };
    const v = RC.views.auth[name];
    const root = document.getElementById('app');
    root.innerHTML = v.render(ctxFor(null, name));
    ui.enhance(root);
    if (v.mount) v.mount(ctxFor(null, name));
    removeDock();
    window.scrollTo(0, 0);
  }
  function renderPage(soft) {
    const c = app.cur; const el = document.getElementById('page'); if (!el) return;
    const ctx = ctxFor(c.role, c.key, c.param);
    const scroller = ROLES[c.role].shell === 'phone' ? el : document.scrollingElement;
    const prevScroll = scroller.scrollTop;
    const prevFocus = document.activeElement && document.activeElement.id;
    el.classList.toggle('no-anim', !!soft);
    el.innerHTML = '<div class="page" data-page="' + c.key + '">' + c.page.render(ctx) + '</div>';
    ui.enhance(el);
    if (c.page.mount) c.page.mount(ctx);
    if (soft) { scroller.scrollTop = prevScroll; if (prevFocus) { const f = document.getElementById(prevFocus); if (f) f.focus(); } }
    else { scroller.scrollTop = 0; if (ROLES[c.role].shell !== 'phone') window.scrollTo({ top: 0 }); }
    document.title = (c.page.title || ROLES[c.role].label) + ' · RaízCaribe';
    updateBadges();
  }
  app.refresh = function () { if (app.cur.page) renderPage(true); };
  let pend = null;
  app.onData = function () {
    updateBadges();
    if (!app.cur.page || !app.cur.page.live) return;
    clearTimeout(pend);
    pend = setTimeout(function () {
      const typing = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
      if (!typing && !document.querySelector('.overlay')) renderPage(true);
    }, 260);
  };

  /* ======================= SHELLS ======================= */
  function navHtml(mod) {
    return mod.nav.map(function (n) {
      return '<button class="nav-item" data-go="#/' + mod.role + '/' + n.key + '" data-nav="' + n.key + '">' + I(n.icon, 22) + '<span>' + n.label + '</span>' + (n.count ? '<span class="nav-item__count" data-navcount="' + n.key + '" hidden></span>' : '') + '</button>';
    }).join('');
  }
  function renderShell(role, mod) {
    const R = ROLES[role]; const root = document.getElementById('app');
    if (R.shell === 'web') {
      root.innerHTML =
        '<div class="web" data-shell="' + role + '">' +
        '<header class="hdr"><a href="#/' + role + '/' + mod.home + '" aria-label="Inicio RaízCaribe">' + ui.logo() + '</a>' +
        '<div class="hdr__actions">' + (role === 'admin' ? '<span class="hdr__role">' + I('user-cog', 20) + 'Administrador / Operador</span>' : '<span class="hdr__role" style="background:var(--n100);color:var(--n600);letter-spacing:0;text-transform:none;font-weight:600">' + I('building', 18) + R.user.nombre + '</span>') +
        '<div style="position:relative" data-pop="bell"><button class="icon-btn" data-ui="bell" aria-label="Notificaciones">' + I('bell', 24) + '<span class="badge" data-badge hidden></span></button></div>' +
        '<div style="position:relative" data-pop="user"><button class="user-btn" data-ui="user" aria-label="Menú de usuario"><span class="avatar">' + R.user.ini + '</span>' + I('chevron-down', 18) + '</button></div>' +
        '</div></header>' +
        '<div class="web__body"><aside class="side"><div class="side__art" role="img" aria-label="Productor del Caribe"></div><nav class="side__nav">' + navHtml(mod) + '</nav>' +
        '<div class="side__foot"><div class="role-pill">' + I(R.icon, 16) + 'Rol: ' + R.label + '</div><button class="nav-item" data-ui="logout">' + I('log-out', 22) + '<span>Cerrar sesión</span></button></div></aside>' +
        '<main class="main" id="page"></main></div></div>';
    } else {
      root.innerHTML =
        '<div class="stage" data-shell="' + role + '"><div class="stage__bg">' + ui.landscape() + '</div>' +
        '<aside class="stage__info">' + stageInfo(role, mod) + '</aside>' +
        '<div class="phone-wrap"><div class="phone"><div class="phone__screen">' +
        '<div class="phone__status"><span data-clock>9:41</span><span class="phone__icons">' + (RC.db.state.online[role] === false ? I('wifi-off', 15) : '<svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor"/><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="currentColor"/><rect x="10" y="3" width="3" height="9" rx="1" fill="currentColor"/><rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor"/></svg>' + I('wifi', 15)) + '<svg width="26" height="12" viewBox="0 0 26 12"><rect x=".5" y=".5" width="22" height="11" rx="3.2" fill="none" stroke="currentColor" opacity=".4"/><rect x="2.5" y="2.5" width="16" height="7" rx="1.8" fill="currentColor"/><path d="M24 4v4a2 2 0 0 0 0-4z" fill="currentColor" opacity=".4"/></svg></span></div>' +
        '<div class="phone__body" id="page"></div>' +
        '<nav class="tabbar">' + mod.nav.map(function (n) { return '<button class="tab" data-go="#/' + role + '/' + n.key + '" data-nav="' + n.key + '">' + I(n.icon, 22) + '<span>' + n.label + '</span>' + (n.count ? '<i class="tab__count" data-navcount="' + n.key + '" hidden></i>' : '') + '</button>'; }).join('') + '</nav>' +
        '<div class="phone__home"></div><div id="phone-overlay"></div>' +
        '</div></div></div></div>';
      fitPhone(); tickClock();
    }
    showDock(role);
  }
  function stageInfo(role, mod) {
    const R = ROLES[role]; const on = RC.db.state.online[role] !== false;
    return '<div class="stage__brand">' + ui.logo({ stack: true, size: 40 }) + '</div>' +
      '<div class="role-pill" style="align-self:flex-start">' + I(R.icon, 16) + 'Rol: ' + R.label + '</div>' +
      '<h2 class="h2">' + mod.info.title + '</h2><p class="t-lead">' + mod.info.text + '</p>' +
      '<div class="stage__procs">' + mod.info.procesos.map(function (p) { return '<div class="stage__proc"><span class="tag-rule">' + p[0] + '</span><span>' + p[1] + '</span></div>'; }).join('') + '</div>' +
      '<div class="card stage__offline"><div class="row row--between"><div class="row gap-8">' + I(on ? 'wifi' : 'wifi-off', 20, on ? 't-green' : 't-orange') + '<div><div class="t-strong">' + (on ? 'Con conexión' : 'Sin conexión') + '</div><div class="t-cap">' + (on ? 'Los datos se envían al instante.' : 'Las acciones se guardan y se sincronizan después.') + '</div></div></div>' +
      '<button class="switch ' + (on ? 'is-on' : '') + '" data-ui="online" aria-label="Cambiar modo de conexión"></button></div>' + (RC.db.state.cola_sync.filter(function (c) { return c.rol === role; }).length ? '<div class="callout callout--warn mt-8">' + I('refresh', 16) + '<div>' + RC.db.state.cola_sync.filter(function (c) { return c.rol === role; }).length + ' acción(es) pendientes de sincronizar.</div></div>' : '') + '</div>';
  }
  function markNav(mod, key) {
    document.querySelectorAll('[data-nav]').forEach(function (n) { n.classList.toggle('is-active', !!(n.dataset.nav === key || (mod.navAlias && mod.navAlias[key] === n.dataset.nav))); });
  }
  function updateBadges() {
    const role = app.cur.role; if (!ROLES[role]) return;
    const n = RC.api.q.noLeidas(role);
    document.querySelectorAll('[data-badge]').forEach(function (b) { b.hidden = !n; b.textContent = n > 9 ? '9+' : n; });
    const mod = RC.views[role];
    (mod.nav || []).forEach(function (it) {
      if (!it.count) return;
      const v = it.count(RC.api.q);
      document.querySelectorAll('[data-navcount="' + it.key + '"]').forEach(function (b) { b.hidden = !v; b.textContent = v; });
    });
  }
  function fitPhone() {
    const wrap = document.querySelector('.phone-wrap'); if (!wrap) return;
    const small = window.innerWidth <= 520;
    const s = small ? 1 : Math.min(1, (window.innerHeight - 40) / 844);
    wrap.style.setProperty('--s', s.toFixed(3));
  }
  window.addEventListener('resize', fitPhone);
  function tickClock() {
    const t = new Date().toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: false });
    document.querySelectorAll('[data-clock]').forEach(function (c) { c.textContent = t; });
  }
  setInterval(tickClock, 20000);

  /* Encabezado común de las apps móviles */
  app.phoneHeader = function (ctx, o) {
    o = o || {};
    const n = RC.api.q.noLeidas(ctx.role);
    return '<header class="app-hdr ' + (o.cls || '') + '">' + (o.back ? '<button class="app-hdr__btn" data-go="' + o.back + '" aria-label="Volver">' + I('chevron-left', 22) + '</button>' : '') +
      '<div class="app-hdr__logo">' + ui.logo({ size: o.small ? 22 : 26, tag: o.tag !== false && !o.small, tagSize: 11 }) + '</div>' +
      '<button class="app-hdr__btn" data-ui="bell" aria-label="Notificaciones">' + I('bell', 21) + (n ? '<span class="badge">' + n + '</span>' : '') + '</button>' +
      '<button class="avatar app-hdr__av" data-ui="user" aria-label="Perfil">' + ctx.user.ini + '</button></header>';
  };

  /* ======================= DOCK DE DEMOSTRACIÓN ======================= */
  function showDock(role) {
    let d = document.querySelector('.dock');
    if (!d) { d = document.createElement('div'); d.className = 'dock'; document.body.appendChild(d); }
    d.innerHTML = '<span class="dock__label">Demo</span>' + Object.keys(ROLES).map(function (k) { return '<button class="dock__btn ' + (k === role ? 'is-active' : '') + '" data-ui="role" data-role="' + k + '" title="' + ROLES[k].label + '">' + I(ROLES[k].icon, 17) + '<span>' + ROLES[k].label + '</span></button>'; }).join('') +
      '<span class="dock__sep"></span><button class="dock__btn" data-ui="guide" title="Guía del flujo completo">' + I('sparkles', 17) + '<span>Guía</span></button><button class="dock__btn" data-ui="reset" title="Reiniciar datos de la demo">' + I('reset', 17) + '<span>Reiniciar</span></button>';
  }
  function removeDock() { const d = document.querySelector('.dock'); if (d) d.remove(); }

  const GUIA = [
    ['productor', 'inicio', 'sprout', 'Productor publica su cosecha', 'Publica Yuca con precio justo sugerido (PR-4 · PR-5 · RN6).'],
    ['comprador', 'productos', 'store', 'Comprador arma su pedido', 'Agrega productos, revisa cobertura y confirma (PR-6).'],
    ['admin', 'pedidos', 'user-cog', 'Operación aprueba y asigna', 'Cruza el pedido con ofertas (PR-7) y lo envía al motor de rutas (RN1).'],
    ['admin', 'rutas', 'route', 'Motor de rutas', 'Ruta compartida que respeta capacidad y ventanas (PR-8 · RN2).'],
    ['conductor', 'ruta', 'truck', 'Conductor recolecta', 'Escanea el QR, registra kilos, temperatura y calidad (PR-9 · RN3 · RN4).'],
    ['conductor', 'entrega', 'warehouse', 'Entrega en centro de acopio', 'Consolida en frío y confirma la entrega (PR-10 · PR-11).'],
    ['comprador', 'seguimiento', 'check-circle', 'Recepción conforme', 'El comprador confirma kilos y se liquida el pago (PR-11 · PR-12 · RN5).'],
    ['productor', 'pagos', 'wallet', 'Productor recibe su pago', 'Pago = kg conformes × precio − comisión.'],
    ['admin', 'indicadores', 'chart', 'Impacto medido', 'Pérdidas, ingreso, costo por kg y entregas a tiempo (PR-13).']
  ];
  function openGuide() {
    const m = ui.modal({
      title: 'Recorrido completo de RaízCaribe', icon: 'sparkles', size: 'lg',
      body: '<p class="t-lead" style="margin-bottom:14px">Sigue el ciclo de un pedido de punta a punta. Cada paso cambia los datos de los demás roles en tiempo real (bus de eventos).</p><div class="guide">' +
        GUIA.map(function (g, i) { return '<button class="guide__step" data-guide="#/' + g[0] + '/' + g[1] + '"><span class="guide__n">' + (i + 1) + '</span>' + ui.iconBox(g[2], i % 3 === 1 ? 'orange' : null, 'sm') + '<span class="grow"><span class="t-strong">' + g[3] + '</span><span class="t-cap" style="display:block">' + g[4] + '</span></span><span class="chip chip--neutral">' + ROLES[g[0]].label + '</span>' + I('chevron-right', 18) + '</button>'; }).join('') + '</div>',
      onMount: function (c) { c.el.querySelectorAll('[data-guide]').forEach(function (b) { b.onclick = function () { c.close(); app.go(b.dataset.guide); }; }); }
    });
    return m;
  }

  /* ======================= NOTIFICACIONES Y MENÚS ======================= */
  function notifList(role) {
    const ns = RC.api.q.notificaciones(role).slice(0, 25);
    const tone = { exito: ['check-circle', ''], info: ['info', 'blue'], alerta: ['alert-triangle', 'orange'], peligro: ['alert-triangle', 'red'] };
    return ns.length ? ns.map(function (n) { const t = tone[n.tipo] || tone.info; return '<div class="notif ' + (n.leida ? '' : 'is-unread') + '" data-link="' + (n.link || '') + '">' + ui.iconBox(t[0], t[1], 'sm') + '<div class="grow"><div class="notif__title">' + ui.esc(n.titulo) + '</div><div class="notif__detail">' + ui.esc(n.detalle) + '</div><div class="notif__time">' + ui.hace(n.fecha) + '</div></div></div>'; }).join('') : '<div style="padding:10px 18px 20px">' + ui.empty({ icon: 'bell', title: 'Sin notificaciones', text: 'Aquí verás avisos de pedidos, rutas, lotes y pagos.' }) + '</div>';
  }
  function closePops() { document.querySelectorAll('.popover,.menu').forEach(function (p) { p.remove(); }); }
  function toggleBell(btn) {
    const role = app.cur.role;
    if (ROLES[role].shell === 'phone') {
      const m = ui.modal({ title: 'Notificaciones', icon: 'bell', sheet: true, container: document.getElementById('phone-overlay'), body: '<div class="sheet-list">' + notifList(role) + '</div>' });
      m.el.querySelectorAll('[data-link]').forEach(function (n) { n.onclick = function () { m.close(); if (n.dataset.link) app.go(n.dataset.link); }; });
      setTimeout(function () { RC.api.marcarLeidas(role); }, 900);
      return;
    }
    const host = btn.closest('[data-pop]');
    if (host.querySelector('.popover')) return closePops();
    closePops();
    const p = document.createElement('div'); p.className = 'popover';
    p.innerHTML = '<div class="popover__head"><strong class="h3" style="font-size:17px">Notificaciones</strong><button class="link" data-markall>Marcar leídas</button></div>' + notifList(role);
    host.appendChild(p);
    p.querySelector('[data-markall]').onclick = function (e) { e.stopPropagation(); RC.api.marcarLeidas(role); p.querySelectorAll('.is-unread').forEach(function (x) { x.classList.remove('is-unread'); }); };
    p.querySelectorAll('[data-link]').forEach(function (n) { n.onclick = function () { closePops(); RC.api.marcarLeidas(role); if (n.dataset.link) app.go(n.dataset.link); }; });
  }
  function userMenu(btn) {
    const role = app.cur.role; const R = ROLES[role];
    const items = '<div style="padding:10px 12px 12px;border-bottom:1px solid var(--n100);margin-bottom:6px"><div class="t-strong">' + R.user.nombre + '</div><div class="t-cap">' + R.user.sub + '</div></div>' +
      Object.keys(ROLES).filter(function (k) { return k !== role; }).map(function (k) { return '<button class="menu__item" data-ui="role" data-role="' + k + '">' + I(ROLES[k].icon, 18) + 'Ver como ' + ROLES[k].label + '</button>'; }).join('') +
      '<button class="menu__item" data-ui="guide">' + I('sparkles', 18) + 'Guía del recorrido</button><button class="menu__item" data-ui="reset">' + I('reset', 18) + 'Reiniciar datos</button><button class="menu__item" data-ui="logout" style="color:var(--r600)">' + I('log-out', 18) + 'Cerrar sesión</button>';
    if (R.shell === 'phone') {
      const m = ui.modal({ title: 'Mi perfil', icon: 'user', sheet: true, container: document.getElementById('phone-overlay'), body: '<div class="sheet-menu">' + items + '</div>' });
      m.el.addEventListener('click', function (e) { if (e.target.closest('[data-ui]')) m.close(); });
      return;
    }
    const host = btn.closest('[data-pop]');
    if (host.querySelector('.menu')) return closePops();
    closePops();
    const p = document.createElement('div'); p.className = 'menu'; p.innerHTML = items; host.appendChild(p);
  }

  /* ======================= DELEGACIÓN DE EVENTOS ======================= */
  function currentActions() { return app.cur.page && app.cur.page.actions; }
  document.addEventListener('click', async function (e) {
    const uiEl = e.target.closest('[data-ui]');
    if (uiEl) {
      const k = uiEl.dataset.ui;
      if (k === 'bell') { e.stopPropagation(); return toggleBell(uiEl); }
      if (k === 'user') { e.stopPropagation(); return userMenu(uiEl); }
      closePops();
      if (k === 'logout') return app.go('#/login');
      if (k === 'role') return app.go('#/' + uiEl.dataset.role + '/' + RC.views[uiEl.dataset.role].home);
      if (k === 'guide') return openGuide();
      if (k === 'reset') {
        const ok = await ui.confirm({ title: 'Reiniciar la demo', text: 'Se restauran los datos iniciales (pedidos, rutas, lotes y pagos). ¿Continuar?', ok: 'Reiniciar', icon: 'reset', tone: 'orange' });
        if (ok) { RC.db.reset(); ui.toast('Datos reiniciados', 'La demo volvió a su estado inicial.', 'info'); app.cur.role = null; app.render(); }
        return;
      }
      if (k === 'online') {
        const role = app.cur.role; const on = RC.db.state.online[role] === false;
        const r = await RC.api.setOnline(role, on);
        ui.toast(on ? 'Conexión recuperada' : 'Modo sin conexión', on ? (r.sincronizadas ? r.sincronizadas + ' acción(es) sincronizadas con la plataforma.' : 'Todo está al día.') : 'Puedes seguir trabajando; se sincroniza al volver la señal.', on ? 'success' : 'warning');
        app.cur.role = null; app.render();
        return;
      }
    }
    if (!e.target.closest('[data-pop]')) closePops();
    const act = e.target.closest('[data-action]');
    if (act && !(act.type === 'submit' && act.closest('form[data-submit]'))) {
      const A = currentActions(); const fn = A && A[act.dataset.action];
      if (fn) { e.preventDefault(); try { await fn(ctxFor(app.cur.role, app.cur.key, app.cur.param), act, e); } catch (err) { ui.error(err); } return; }
    }
    const go = e.target.closest('[data-go]');
    if (go && !e.target.closest('[data-action]')) { e.preventDefault(); app.go(go.dataset.go); }
  });
  document.addEventListener('submit', async function (e) {
    const f = e.target.closest('form[data-submit]'); if (!f) return;
    e.preventDefault();
    const A = currentActions(); const fn = A && A[f.dataset.submit];
    if (fn) { try { await fn(ctxFor(app.cur.role, app.cur.key, app.cur.param), f, e); } catch (err) { ui.error(err); } }
  });
  ['input', 'change'].forEach(function (type) {
    document.addEventListener(type, function (e) {
      const el = e.target.closest('[data-on' + type + ']'); if (!el) return;
      const A = currentActions(); const fn = A && A[el.dataset['on' + type]];
      if (fn) fn(ctxFor(app.cur.role, app.cur.key, app.cur.param), el, e);
    });
  });
  window.addEventListener('hashchange', function () { closePops(); app.render(); });

  /* ======================= ARRANQUE ======================= */
  app.start = function () {
    RC.db.load();
    RC.app = app;
    if (!location.hash) location.hash = '#/splash'; else app.render();
  };
  RC.app = app;
  document.addEventListener('DOMContentLoaded', app.start);
})();
