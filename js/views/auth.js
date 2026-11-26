/* =========================================================================
   RaízCaribe · Acceso: pantalla de bienvenida (splash) e inicio de sesión
   ========================================================================= */
window.RC = window.RC || {};
RC.views = RC.views || {};

(function () {
  const I = RC.icon, ui = RC.ui;
  let timer = null;

  const ROLES = [
    { k: 'comprador', icon: 'store', t: 'Comprador B2B', d: 'Portal web de pedidos', mail: 'compras@hotelcaribeplaza.co' },
    { k: 'productor', icon: 'sprout', t: 'Productor', d: 'App móvil de cosechas', mail: '+57 300 482 1937' },
    { k: 'conductor', icon: 'truck', t: 'Conductor', d: 'Ruta, lotes y entregas', mail: '+57 310 225 6180' },
    { k: 'admin', icon: 'user-cog', t: 'Administrador', d: 'Panel de operación', mail: 'operacion@raizcaribe.co' }
  ];

  RC.views.auth = {
    splash: {
      render: function () {
        return '<section class="splash" data-skip>' +
          '<span class="splash__bubble splash__bubble--1"></span><span class="splash__bubble splash__bubble--2"></span>' +
          '<div class="splash__center">' + ui.logo({ stack: true, size: 76, tagSize: 26 }) +
          '<p class="splash__sub">Conectamos a los productores del Caribe colombiano con mercados formales</p>' +
          '<div class="splash__bar"><span></span></div><span class="splash__cap">Preparando tu experiencia…</span></div>' +
          '<div class="splash__land">' + ui.landscape() + '</div></section>';
      },
      mount: function (ctx) {
        clearTimeout(timer);
        const go = function () { clearTimeout(timer); if (location.hash === '#/splash' || !location.hash) ctx.go('#/login'); };
        timer = setTimeout(go, 2900);
        document.querySelector('[data-skip]').addEventListener('click', go);
      }
    },

    login: {
      render: function () {
        const st = RC.db.state; const k = RC.api.q.indicadores();
        return '<section class="login">' +
          '<div class="login__hero">' +
          '<a href="#/splash" aria-label="RaízCaribe">' + ui.logo({ size: 34 }) + '</a>' +
          '<span class="login__tag">' + I('sprout', 16) + 'Plataforma agro-logística del Caribe colombiano</span>' +
          '<h1 class="h-display">Del campo Caribe<br>a más mesas</h1>' +
          '<p class="t-lead" style="max-width:560px">Conectamos a productores y pescadores de Atlántico, Magdalena y Bolívar con supermercados, restaurantes y hoteles mediante <b>rutas de recolección compartidas</b>, <b>trazabilidad</b> de la finca a la mesa y <b>precios justos</b>.</p>' +
          '<div class="login__stats">' +
          '<div class="login__stat"><b>' + I('users', 20) + '<span data-count="' + k.productoresActivos + '">0</span></b><span class="t-cap">Productores activos</span></div>' +
          '<div class="login__stat"><b>' + I('route', 20) + '<span data-count="' + k.rutasHoy + '">0</span></b><span class="t-cap">Rutas compartidas hoy</span></div>' +
          '<div class="login__stat"><b>' + I('check-circle', 20) + '<span data-count="' + k.aTiempo + '" data-format="pct">0</span></b><span class="t-cap">Entregas a tiempo</span></div>' +
          '</div>' +
          '<div class="login__visual"><div class="login__photo" role="img" aria-label="Productor con su cosecha"></div>' +
          '<div class="login__trace"><div class="row">' + ui.iconBox('qr-code') + '<div class="grow"><div class="t-strong">Lote L-000418</div><div class="t-cap">Yuca · Finca El Porvenir</div></div>' + ui.chip('Calidad A', 'success') + '</div>' +
          '<div class="row mt-8" style="gap:16px">' + '<span class="row gap-4 t-cap">' + I('thermometer', 15, 't-green') + '9,6 °C</span><span class="row gap-4 t-cap">' + I('weight', 15, 't-green') + '2.000 kg</span><span class="row gap-4 t-cap">' + I('clock', 15, 't-green') + '5:40 a. m.</span></div></div></div>' +
          ui.landscape() + '</div>' +
          '<form class="login__form" data-login novalidate>' +
          '<div><h2 class="h1">Ingresa a tu cuenta</h2><p class="t-lead mt-4">Elige tu rol para entrar a tu espacio de trabajo.</p></div>' +
          ui.field({ label: 'Correo o celular', name: 'usuario', icon: 'mail', value: ROLES[0].mail, placeholder: 'correo@empresa.co' }) +
          ui.field({ label: 'Contraseña', name: 'clave', type: 'password', icon: 'lock', value: 'raizcaribe2026', placeholder: 'Tu contraseña', right: '<button type="button" class="icon-btn" style="width:34px;height:34px" data-peek aria-label="Mostrar contraseña">' + I('eye', 18) + '</button>' }) +
          '<div class="row row--between"><label class="check"><input type="checkbox" checked> Recordarme</label><a class="link" href="#/login" data-forgot>¿Olvidaste tu contraseña?</a></div>' +
          '<span class="t-over">Selecciona tu rol</span>' +
          '<div class="roles">' + ROLES.map(function (r, i) { return '<button type="button" class="role-tile ' + (i === 0 ? 'is-active' : '') + '" data-role="' + r.k + '">' + ui.iconBox(r.icon) + '<span><span class="role-tile__t">' + r.t + '</span><span class="role-tile__d" style="display:block">' + r.d + '</span></span></button>'; }).join('') + '</div>' +
          '<button class="btn btn--primary btn--lg btn--block" type="submit" data-enter>' + I('arrow-right', 20) + '<span>Ingresar como Comprador B2B</span></button>' +
          '<div class="or">o</div>' +
          '<button type="button" class="btn btn--outline btn--block" data-tour>' + I('sparkles', 20) + '<span>Ver el recorrido completo de la plataforma</span></button>' +
          '<p class="row gap-8 t-cap" style="justify-content:center">' + I('shield-check', 16, 't-green') + 'Tus datos están protegidos · Ley 1581 de 2012 · Pedidos y pagos con trazabilidad</p>' +
          '</form></section>';
      },
      mount: function (ctx) {
        let role = 'comprador';
        const form = document.querySelector('[data-login]');
        const enter = form.querySelector('[data-enter] span');
        const user = form.querySelector('[name=usuario]');
        form.querySelectorAll('[data-role]').forEach(function (b) {
          b.addEventListener('click', function () {
            role = b.dataset.role;
            form.querySelectorAll('[data-role]').forEach(function (x) { x.classList.toggle('is-active', x === b); });
            const R = ROLES.find(function (r) { return r.k === role; });
            enter.textContent = 'Ingresar como ' + R.t;
            user.value = R.mail;
            user.closest('.control').animate([{ background: '#F2F8ED' }, { background: '#fff' }], { duration: 600 });
          });
          b.addEventListener('dblclick', function () { form.requestSubmit(); });
        });
        form.querySelector('[data-peek]').addEventListener('click', function () { const p = form.querySelector('[name=clave]'); p.type = p.type === 'password' ? 'text' : 'password'; });
        form.querySelector('[data-forgot]').addEventListener('click', function (e) { e.preventDefault(); ui.toast('Enlace enviado', 'Te enviamos un enlace para restablecer tu contraseña.', 'info'); });
        form.querySelector('[data-tour]').addEventListener('click', function () { const b = document.createElement('button'); b.dataset.ui = 'guide'; b.hidden = true; document.body.appendChild(b); b.click(); b.remove(); });
        form.addEventListener('submit', async function (e) {
          e.preventDefault();
          const btn = form.querySelector('[data-enter]');
          const u = user.value.trim(), p = form.querySelector('[name=clave]').value;
          if (!u || !p) { form.querySelectorAll('.control').forEach(function (c) { if (!c.querySelector('input').value) c.classList.add('is-invalid'); }); ui.toast('Completa tus datos', 'Ingresa usuario y contraseña.', 'warning'); return; }
          await ui.withLoading(btn, function () { return RC.api.delay(700); });
          ui.toast('¡Bienvenido!', 'Sesión iniciada como ' + ROLES.find(function (r) { return r.k === role; }).t + '.', 'success', 2600);
          ctx.go('#/' + role + '/' + RC.views[role].home);
        });
      }
    }
  };
})();
