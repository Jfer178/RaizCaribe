/* =========================================================================
   RaízCaribe · App del conductor y acopio (móvil)
   Usuario de la demo: Carlos Mendoza · camión refrigerado ABC-123 (VEH-01)
   Procesos: PR-8 ruta compartida · PR-9 recolección y lote (RN3) ·
             PR-10 cadena de frío (RN4) · PR-11 entrega y recepción
   ========================================================================= */
window.RC = window.RC || {};
RC.views = RC.views || {};

(function () {
  const I = RC.icon, ui = RC.ui;
  const VEH = 'VEH-01';
  const CONDUCTOR = 'Carlos Mendoza';
  /* Datos en edición por parada (sobreviven a los refrescos de pantalla) */
  const st = { qr: {}, cal: {}, temp: {}, kg: {}, rech: {}, tipo: null, desc: '', foto: false };

  /* ---------------- utilidades ---------------- */
  const hdr = function (ctx, o) { return RC.app.phoneHeader(ctx, Object.assign({ tag: false }, o || {})); };
  const successMark = '<div class="success-mark"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#2F8F3A" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></div>';
  function receipt(rows) { return '<div class="m-receipt">' + rows.map(function (r) { return '<div class="m-receipt__row"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>'; }).join('') + '</div>'; }
  const temp = function (v) { return String(v).replace('.', ',') + ' °C'; };
  function codigoQR(r, p) { return 'RC-' + r.id.replace('-', '') + '-' + p.id; }
  function paradaActual(r) { return r.paradas.find(function (p) { return p.estado === 'en_curso'; }) || r.paradas.find(function (p) { return p.estado !== 'recogido'; }) || null; }
  function rutaStops(r) {
    const stops = r.paradas.map(function (p) { return { lat: p.productor.latitud, lng: p.productor.longitud, label: p.productos.map(function (x) { return x.nombre; }).join(' + '), state: p.estado === 'recogido' ? 'done' : p.estado === 'en_curso' ? 'current' : 'pending' }; });
    const a = r.destinoAlmacen; if (a) stops.push({ lat: a.latitud, lng: a.longitud, label: a.municipio, state: 'dest' });
    return stops;
  }
  function progresoRuta(r) {
    const n = r.paradas.length + 1; const done = r.paradas.filter(function (p) { return p.estado === 'recogido'; }).length;
    return done ? Math.min(1, (done - 0.5) / (n - 1)) : 0;
  }
  /* Ajusta textos y marcadores del mapa para la pantalla de 358 px */
  function agrandarMapas(root) {
    root.querySelectorAll('.m-map text').forEach(function (t) { const f = parseFloat(t.style.fontSize); if (f) t.style.fontSize = (f * 1.7).toFixed(1) + 'px'; });
    root.querySelectorAll('.m-map .map__stop circle').forEach(function (c) { c.setAttribute('r', (parseFloat(c.getAttribute('r')) * 1.35).toFixed(1)); });
    root.querySelectorAll('.m-map .map__truck > g').forEach(function (g) { const m = /scale\(([\d.]+)\)/.exec(g.getAttribute('transform') || ''); if (m) g.setAttribute('transform', 'scale(' + (parseFloat(m[1]) * 1.5).toFixed(3) + ')'); });
  }
  /* LOTE registrados en las rutas del camión ABC-123 */
  function lotesDelCamion(q) {
    const db = RC.db;
    return db.state.lotes.filter(function (l) {
      const a = db.byId('asignaciones', l.id_asignacion); const pa = a && a.id_parada && db.byId('paradas', a.id_parada); const r = pa && db.byId('rutas', pa.id_ruta);
      return r && r.id_vehiculo === VEH;
    }).sort(function (a, b) { return a.fecha_hora_recoleccion < b.fecha_hora_recoleccion ? 1 : -1; }).map(function (l) { return q.lote(l.id); });
  }
  function rutasDelCamion() { return RC.db.state.rutas.filter(function (r) { return r.id_vehiculo === VEH; }).map(function (r) { return r.id; }); }
  function tempWarn(prod, v) {
    if (v === '' || v == null || isNaN(+v)) return '<div class="m-hint">' + I('snowflake', 15) + 'Rango de frío para ' + prod.nombre.toLowerCase() + ': <b>' + prod.temp_min + '–' + prod.temp_max + ' °C</b> ' + ui.rule('RN4') + '</div>';
    const t = +v;
    if (t < prod.temp_min || t > prod.temp_max) return ui.callout('thermometer', '<b>' + temp(t) + ' está fuera del rango</b> (' + prod.temp_min + '–' + prod.temp_max + ' °C). Puedes registrar el lote, pero operación recibirá una alerta de cadena de frío.', 'danger');
    return ui.callout('check-circle', temp(t) + ' dentro del rango de conservación (' + prod.temp_min + '–' + prod.temp_max + ' °C).');
  }
  function calWarn(prod, c) {
    const CAL = { A: 3, B: 2, C: 1 };
    return CAL[c] < CAL[prod.calidad_minima] ? ui.callout('alert-triangle', 'La calidad ' + c + ' está por debajo del mínimo acordado (' + prod.calidad_minima + '): el lote se registrará como <b>rechazo</b> (PR-9).', 'warn') : '';
  }
  function qrTile(code) {
    return code ? '<span class="m-qrtile__qr">' + ui.qr(code, 76) + '</span><span class="m-qrtile__txt"><b>' + I('check', 14) + ' QR vinculado</b><small>' + code + '</small></span>'
      : '<span class="m-qrtile__qr is-empty">' + ui.qr('RC-escanear', 76) + '</span><span class="m-qrtile__txt">Escanear QR<br>del lote</span>';
  }

  /* ---------------- Escáner de QR (cámara simulada) ---------------- */
  function scannerHtml(code) {
    return '<div class="scan"><div class="scan__view"><div class="scan__cam"><span class="scan__crate scan__crate--1"></span><span class="scan__crate scan__crate--2"></span></div>' +
      '<div class="scan__frame"><i></i><i></i><i></i><i></i><div class="scan__qr">' + ui.qr(code, 150) + '</div><span class="scan__line"></span></div></div>' +
      '<p class="scan__status" data-scanstatus>' + I('scan', 18) + 'Apunta la cámara al código QR del lote…</p></div>';
  }
  function abrirEscaner(ctx, code, onDone) {
    let t1, t2, done = false;
    const m = ui.modal({
      sheet: true, container: ctx.overlay, title: 'Escanear QR del lote', icon: 'scan',
      body: scannerHtml(code), noFocus: true,
      onClose: function () { clearTimeout(t1); clearTimeout(t2); }
    });
    const box = m.el.querySelector('.scan');
    t1 = setTimeout(function () {
      box.classList.add('is-found');
      box.querySelector('[data-scanstatus]').innerHTML = I('check-circle', 18) + 'QR detectado: <b>' + code + '</b>';
      if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(60);
      t2 = setTimeout(function () { if (!done) { done = true; onDone(code); m.close(); } }, 900);
    }, 1800);
    return m;
  }

  /* =====================================================================
     PÁGINAS
     ===================================================================== */
  const pages = {};

  /* ---------- RUTA DEL DÍA ---------- */
  pages.ruta = {
    title: 'Ruta del día',
    render: function (ctx) {
      const q = ctx.q; const r = q.rutaConductor();
      if (!r) return hdr(ctx) + '<div class="m-page">' + ui.empty({ icon: 'route', title: 'Sin ruta asignada', text: 'Cuando operación programe una ruta para tu camión aparecerá aquí.' }) + '</div>';
      const actual = paradaActual(r);
      const idx = actual ? r.paradas.indexOf(r.paradas.find(function (p) { return p.id === actual.id; })) : r.paradas.length;
      const dest = r.destinoAlmacen;
      const steps = r.paradas.map(function (p) {
        return { label: p.productos.map(function (x) { return x.nombre; }).join(' + '), sub: p.estado === 'recogido' ? 'Recogido' : (actual && p.id === actual.id ? ui.chip('En curso', 'warning') : '') };
      }).concat([{ label: dest ? dest.municipio : 'Acopio', sub: 'Entrega' }]);
      const manana = r.fecha > RC.db.util.fecha(0);
      const ocup = r.ocupacion;
      let html = hdr(ctx) +
        '<div class="m-hero m-hero--conductor" style="background-image:url(assets/img/encabezado-conductor.png)"><span class="m-hero__tag">Del campo Caribe a más mesas</span></div>' +
        '<div class="m-page reveal">' +
        (manana ? ui.callout('calendar', 'Ruta <b>' + r.id + '</b> programada para <b>' + ui.dia(r.fecha).toLowerCase() + ' a las ' + r.hora_salida + '</b>. Puedes revisar las paradas desde ahora.', 'info') : '') +
        /* Tarjeta de ruta */
        '<div class="card m-card m-route">' +
        '<div class="card-title">' + ui.iconBox('truck', null) + '<h3>Ruta del día</h3>' + ui.chip(r.id, 'brand') + '</div>' +
        ui.stepper(steps, idx) +
        '<div class="m-route__cap"><div class="row row--between t-cap"><span>' + I('package', 14) + ' ' + ui.kg(r.kg) + ' de ' + ui.kg(r.vehiculo.capacidad_kg) + '</span><span>' + r.vehiculo.placa + ' · ' + (r.vehiculo.refrigerado ? 'refrigerado' : 'seco') + ' · ' + r.distancia_km + ' km</span></div>' + ui.progress(ocup, ocup > 0.95 ? 'warn' : null) + '</div>' +
        '</div>' +
        '<div class="m-map">' + ui.map({ routes: [{ stops: rutaStops(r), progress: progresoRuta(r), truck: r.estado !== 'programada' }], height: 180, aspect: 2, pad: 70 }) + '</div>';

      if (actual) {
        const prod = actual.productos[0];
        const n = r.paradas.findIndex(function (p) { return p.id === actual.id; }) + 1;
        const qr = st.qr[actual.id] || '';
        const cal = st.cal[actual.id] || 'A';
        const tVal = st.temp[actual.id] != null ? st.temp[actual.id] : '';
        const kgVal = st.kg[actual.id] != null ? st.kg[actual.id] : actual.kg;
        const of = actual.asignaciones[0] && actual.asignaciones[0].oferta;
        html +=
          /* Parada actual */
          '<div class="card m-card m-stop">' +
          '<div class="row row--between"><span class="t-over">Parada ' + n + ' de ' + r.paradas.length + '</span>' + ui.estado(actual.estado === 'en_curso' ? 'en_curso' : 'pendiente') + '</div>' +
          '<div class="row mt-8">' + ui.iconBox('map-pin', 'orange') + '<div class="grow"><div class="list-row__title">' + actual.productor.nombre + '</div><div class="t-cap">' + actual.productor.municipio + ', ' + actual.productor.departamento + ' · ' + actual.productor.contacto + '</div></div>' +
          '<a class="btn btn--secondary btn--icon btn--sm" href="tel:' + actual.productor.telefono.replace(/\s/g, '') + '" aria-label="Llamar al productor">' + I('phone', 18) + '</a></div>' +
          '<div class="m-facts">' +
          '<span>' + I('clock', 15) + 'Llegada ' + ui.hora(actual.hora_estimada) + '</span>' +
          '<span>' + I('calendar', 15) + 'Ventana ' + (of ? of.ventana_inicio + '–' + of.ventana_fin : '—') + '</span>' +
          '<span>' + I('weight', 15) + ui.kg(actual.kg) + ' asignados</span>' +
          '<span>' + I('snowflake', 15) + prod.temp_min + '–' + prod.temp_max + ' °C</span></div>' +
          '<div class="t-cap">Pedidos: ' + actual.asignaciones.map(function (a) { return a.id_pedido; }).join(', ') + '</div>' +
          '</div>' +
          /* Registrar lote (PR-9) */
          '<form class="card m-card m-reg" data-submit="registrar" data-parada="' + actual.id + '" novalidate>' +
          '<div class="card-title">' + ui.iconBox('package') + '<h3>Registrar lote</h3>' + ui.rule('PR-9') + '</div>' +
          '<div class="m-reg__grid"><div class="m-reg__fields">' +
          '<div class="control control--sm">' + I('sprout', 20) + '<input value="' + prod.nombre + '" readonly aria-label="Producto"></div>' +
          '<div class="control control--sm">' + I('weight', 20) + '<input type="number" name="kg" value="' + kgVal + '" min="1" step="1" inputmode="decimal" placeholder="Kilos" aria-label="Kilos" data-oninput="guardarKg"><span class="control__suffix">kg</span></div>' +
          '<div class="control control--sm" data-tempctl>' + I('thermometer', 20) + '<input type="number" name="temperatura" step="0.1" inputmode="decimal" placeholder="Temperatura (°C)" aria-label="Temperatura" value="' + tVal + '" data-oninput="validarTemp"><span class="control__suffix">°C</span></div>' +
          '</div><button type="button" class="m-qrtile ' + (qr ? 'is-ok' : '') + '" data-action="escanear" data-qrtile aria-label="Escanear QR del lote">' + qrTile(qr) + '</button></div>' +
          '<input type="hidden" name="qr" value="' + qr + '"><input type="hidden" name="calidad" value="' + cal + '">' +
          '<div data-tempwarn>' + tempWarn(prod, tVal) + '</div>' +
          '<div class="field"><span class="field__label">Calidad del lote <span class="t-cap">Mínimo acordado: ' + prod.calidad_minima + '</span></span><div class="grade">' +
          ['A', 'B', 'C'].map(function (v) { return '<button type="button" data-action="calidad" data-v="' + v + '" class="' + (v === cal ? 'is-active' : '') + '">' + v + '</button>'; }).join('') + '</div></div>' +
          '<div data-calwarn>' + calWarn(prod, cal) + '</div>' +
          '<details class="m-more"' + (st.rech[actual.id] ? ' open' : '') + '><summary>' + I('alert-triangle', 15) + 'Rechazo en finca (opcional)</summary><div class="control control--sm mt-8">' + I('x-circle', 18) + '<input type="number" name="kg_rechazados" min="0" step="1" placeholder="Kg rechazados" value="' + (st.rech[actual.id] || '') + '" data-oninput="guardarRech"><span class="control__suffix">kg</span></div></details>' +
          '<button type="submit" class="btn btn--primary btn--lg btn--block">' + I('check-circle', 22) + '<span>Confirmar recolección</span></button>' +
          '</form>';
      } else {
        html += '<div class="card m-card m-done">' + successMark + '<h3 class="h3" style="text-align:center">Todas las paradas recogidas</h3><p class="t-body" style="text-align:center">' + ui.kg(r.kg) + ' a bordo en ' + r.paradas.length + ' paradas. Dirígete a ' + (dest ? dest.nombre : 'el centro de acopio') + '.</p>' +
          ui.btn({ label: 'Ir a entrega', icon: 'warehouse', block: true, size: 'lg', go: '#/conductor/entrega' }) + '</div>';
      }
      /* Resto de paradas */
      html += '<h3 class="h3">Paradas de la ruta</h3><div class="m-list">' + r.paradas.map(function (p, i) {
        const est = p.estado === 'recogido' ? ui.estado('recogido') : (actual && p.id === actual.id ? ui.chip('En curso', 'warning', { live: true }) : ui.chip(ui.hora(p.hora_estimada), 'neutral'));
        return '<div class="list-row"><span class="m-num ' + (p.estado === 'recogido' ? 'is-done' : '') + '">' + (p.estado === 'recogido' ? I('check', 14) : i + 1) + '</span><span class="grow"><span class="list-row__title">' + p.productor.nombre + '</span><span class="list-row__sub" style="display:block">' + p.productos.map(function (x) { return x.nombre; }).join(' + ') + ' · ' + ui.kg(p.kg) + ' · ' + p.productor.municipio + '</span></span>' + est + '</div>';
      }).join('') + '</div>' + '</div>';
      return html;
    },
    mount: function (ctx) { agrandarMapas(ctx.el); },
    actions: {
      guardarKg: function (ctx, el) { st.kg[el.form.dataset.parada] = el.value; el.closest('.control').classList.remove('is-invalid'); },
      guardarRech: function (ctx, el) { st.rech[el.form.dataset.parada] = el.value; },
      validarTemp: function (ctx, el) {
        const f = el.form; const pid = f.dataset.parada; st.temp[pid] = el.value;
        const r = ctx.q.rutaConductor(); const p = r.paradas.find(function (x) { return x.id === pid; });
        const prod = p.productos[0];
        const v = el.value; const fuera = v !== '' && (+v < prod.temp_min || +v > prod.temp_max);
        const ctl = el.closest('.control'); ctl.classList.toggle('is-invalid', fuera); ctl.classList.toggle('is-valid', v !== '' && !fuera);
        f.querySelector('[data-tempwarn]').innerHTML = tempWarn(prod, v);
      },
      calidad: function (ctx, el) {
        const f = el.closest('form'); const pid = f.dataset.parada;
        st.cal[pid] = el.dataset.v; f.calidad.value = el.dataset.v;
        f.querySelectorAll('.grade button').forEach(function (b) { b.classList.toggle('is-active', b === el); });
        const p = ctx.q.rutaConductor().paradas.find(function (x) { return x.id === pid; });
        f.querySelector('[data-calwarn]').innerHTML = calWarn(p.productos[0], el.dataset.v);
      },
      escanear: function (ctx, el) {
        const f = el.closest('form'); const pid = f.dataset.parada;
        const r = ctx.q.rutaConductor(); const p = r.paradas.find(function (x) { return x.id === pid; });
        abrirEscaner(ctx, codigoQR(r, p), function (code) {
          st.qr[pid] = code;
          if (!f.isConnected) return;
          f.qr.value = code;
          const tile = f.querySelector('[data-qrtile]');
          tile.innerHTML = qrTile(code); tile.classList.add('is-ok');
          tile.animate([{ transform: 'scale(.92)' }, { transform: 'scale(1.04)' }, { transform: 'scale(1)' }], { duration: 450, easing: 'cubic-bezier(.34,1.56,.64,1)' });
          ui.toast('QR vinculado al lote', code, 'success', 2600);
        });
      },
      registrar: async function (ctx, form) {
        const pid = form.dataset.parada;
        const btn = form.querySelector('[type=submit]');
        const fd = new FormData(form);
        const d = { kg: +fd.get('kg'), temperatura: fd.get('temperatura'), calidad: fd.get('calidad') || 'A', qr: fd.get('qr'), kg_rechazados: +fd.get('kg_rechazados') || 0 };
        /* Validación en cliente: RN3 (QR), kilos y RN4 (temperatura obligatoria) */
        if (!d.qr) { const t = form.querySelector('[data-qrtile]'); t.classList.add('is-missing'); t.animate([{ transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }], { duration: 300, iterations: 2 }); }
        if (!(d.kg > 0)) form.kg.closest('.control').classList.add('is-invalid');
        if (d.temperatura === '') form.temperatura.closest('.control').classList.add('is-invalid');
        try {
          const r = await ui.withLoading(btn, function () { return ctx.api.registrarLote(pid, d); });
          if (r.encolado) {
            ui.toast('Recolección guardada sin conexión', 'Se sincronizará al recuperar señal (' + r.pendientes + ' acción(es) en cola).', 'warning', 5200);
            return;
          }
          ['qr', 'cal', 'temp', 'kg', 'rech'].forEach(function (k) { delete st[k][pid]; });
          if (!r.fueraRango && !r.rechazado) ui.confetti();
          ui.modal({
            sheet: true, container: ctx.overlay,
            body: '<div class="m-success">' + successMark + '<h3 class="h2">Recolección confirmada</h3><p class="t-body">El lote quedó registrado y el comprador ya puede ver su trazabilidad.</p>' +
              '<div class="m-lotchips">' + r.lotes.map(function (l) { return ui.chip(l.id, 'brand', { icon: 'qr-code' }); }).join('') + '</div>' +
              receipt([['Producto', r.producto.nombre], ['Kilos recolectados', ui.kg(d.kg)], ['Temperatura', temp(d.temperatura)], ['Calidad', d.calidad], ['QR', d.qr]]) +
              (r.fueraRango ? ui.callout('thermometer', 'Temperatura fuera de rango: se generó una <b>alerta de cadena de frío</b> para operación (RN4).', 'danger') : '') +
              (r.rechazado ? ui.callout('alert-triangle', 'Calidad por debajo del mínimo: el lote quedó registrado como <b>rechazo</b> (PR-9).', 'warn') : '') +
              (r.siguiente ? ui.callout('navigation', 'Siguiente parada: <b>' + r.siguiente.nombre + '</b> · ' + r.siguiente.municipio + '.', 'info') : ui.callout('warehouse', '¡Ruta completa! Dirígete al centro de acopio para la entrega.')) + '</div>',
            foot: r.siguiente ? ui.btn({ label: 'Continuar a la siguiente parada', icon: 'navigation', block: true, attrs: ' data-close' }) : ui.btn({ label: 'Ir a entrega', icon: 'warehouse', block: true, attrs: ' data-ent' }),
            onMount: function (c) { const b = c.el.querySelector('[data-ent]'); if (b) b.onclick = function () { c.close(); ctx.go('#/conductor/entrega'); }; },
            onClose: function () { ctx.refresh(); }
          });
        } catch (e) {
          ui.error(e);
          if (e && e.regla === 'RN3') { const t = form.querySelector('[data-qrtile]'); if (t) t.classList.add('is-missing'); }
        }
      }
    }
  };

  /* ---------- ESCANEAR (pantalla completa) ---------- */
  pages.escanear = {
    title: 'Escanear QR',
    render: function (ctx) {
      const r = ctx.q.rutaConductor(); const p = r && paradaActual(r);
      return hdr(ctx, { back: '#/conductor/ruta' }) + '<div class="m-page reveal"><div><h2 class="h2">Escanear QR del lote</h2><p class="t-body">' + (p ? p.productor.nombre + ' · ' + p.productos[0].nombre : 'Sin parada activa') + '</p></div>' +
        (p ? scannerHtml(codigoQR(r, p)) : ui.empty({ icon: 'qr-code', title: 'No hay parada en curso', text: 'Todas las paradas de la ruta ya fueron recogidas.' })) + '</div>';
    },
    mount: function (ctx) {
      const r = ctx.q.rutaConductor(); const p = r && paradaActual(r); if (!p) return;
      const box = ctx.el.querySelector('.scan'); const code = codigoQR(r, p);
      setTimeout(function () {
        if (!box.isConnected) return;
        box.classList.add('is-found');
        box.querySelector('[data-scanstatus]').innerHTML = I('check-circle', 18) + 'QR detectado: <b>' + code + '</b>';
        st.qr[p.id] = code;
        setTimeout(function () { if (location.hash.indexOf('escanear') >= 0) { ui.toast('QR vinculado al lote', code, 'success', 2600); ctx.go('#/conductor/ruta'); } }, 900);
      }, 1800);
    }
  };

  /* ---------- ENTREGA EN CENTRO DE ACOPIO (PR-10 · PR-11) ---------- */
  pages.entrega = {
    title: 'Entrega',
    render: function (ctx) {
      const q = ctx.q; const r = q.rutaConductor();
      if (!r) return hdr(ctx, { back: '#/conductor/ruta' }) + '<div class="m-page">' + ui.empty({ icon: 'warehouse', title: 'Sin ruta activa' }) + '</div>';
      const pend = r.paradas.filter(function (p) { return p.estado !== 'recogido'; });
      const lotes = [].concat.apply([], r.paradas.map(function (p) { return p.lotes; }));
      const kgRec = lotes.reduce(function (t, l) { return t + l.kg_recolectados; }, 0);
      const kgRech = lotes.reduce(function (t, l) { return t + l.kg_rechazados; }, 0);
      const a = r.destinoAlmacen;
      const prods = [].concat.apply([], r.paradas.map(function (p) { return p.productos; }));
      const critico = prods.slice().sort(function (x, y) { return x.temp_max - y.temp_max; })[0];
      const base = lotes.length ? lotes.reduce(function (t, l) { return t + l.temperatura_c; }, 0) / lotes.length : (critico ? (critico.temp_min + critico.temp_max) / 2 : 6);
      const tel = critico ? q.telemetria(r.id, critico, base) : null;
      let html = hdr(ctx, { back: '#/conductor/ruta' }) + '<div class="m-page reveal">' +
        '<div><h2 class="h2">Entrega en acopio</h2><p class="t-body">Ruta ' + r.id + ' · ' + r.vehiculo.placa + '</p></div>';
      if (pend.length) {
        html += ui.callout('alert-triangle', 'Aún faltan <b>' + pend.length + ' parada(s)</b> por recoger. No puedes cerrar la ruta hasta registrar todos los lotes.', 'warn') +
          '<div class="m-list">' + pend.map(function (p) { return '<div class="list-row">' + ui.iconBox('map-pin', 'orange', 'sm') + '<span class="grow"><span class="list-row__title">' + p.productor.nombre + '</span><span class="list-row__sub" style="display:block">' + p.productos.map(function (x) { return x.nombre; }).join(' + ') + ' · ' + ui.kg(p.kg) + '</span></span>' + ui.estado(p.estado) + '</div>'; }).join('') + '</div>' +
          ui.btn({ label: 'Volver a la ruta', icon: 'route', variant: 'secondary', block: true, go: '#/conductor/ruta' });
      }
      html += '<div class="card m-card m-dest">' + '<div class="row">' + ui.iconBox('warehouse', 'blue', 'lg') + '<div class="grow"><div class="list-row__title">' + (a ? a.nombre : 'Centro de acopio') + '</div><div class="t-cap">' + (a ? a.municipio + ' · ' + a.temp_objetivo : '') + '</div></div></div>' +
        '<div class="m-stats m-stats--4">' +
        '<div class="m-stat"><span class="t-cap">Paradas</span><b>' + (r.paradas.length - pend.length) + '/' + r.paradas.length + '</b></div>' +
        '<div class="m-stat"><span class="t-cap">Lotes</span><b>' + lotes.length + '</b></div>' +
        '<div class="m-stat"><span class="t-cap">Kg a bordo</span><b>' + ui.num(kgRec - kgRech) + '</b></div>' +
        '<div class="m-stat"><span class="t-cap">Rechazo</span><b class="' + (kgRech ? 't-red' : '') + '">' + ui.num(kgRech) + '</b></div></div>' +
        (lotes.length ? '<div class="m-lotchips">' + lotes.map(function (l) { return ui.chip(l.id + ' · ' + temp(l.temperatura_c), 'success', { icon: 'qr-code' }); }).join('') + '</div>' : '') +
        '</div>';
      if (tel) {
        html += '<div class="card m-card"><div class="row row--between"><b>' + I('thermometer', 16, 't-green') + ' Cadena de frío en ruta</b>' + ui.chip('Sensor IoT', 'info', { live: true }) + '</div>' +
          '<p class="t-cap">Lecturas cada 30 min del furgón · rango crítico ' + critico.nombre.toLowerCase() + ' ' + critico.temp_min + '–' + critico.temp_max + ' °C</p>' +
          '<div class="m-chart">' + ui.lineChart({ series: [{ values: tel.lecturas, color: '#2D7BD8' }], labels: tel.lecturas.map(function (_, i) { return i % 4 === 0 ? (5 + i / 2) + 'h' : ''; }), band: [tel.min, tel.max], height: 170, fmt: function (v) { return ui.num(v, 1) + '°'; }, label: 'Temperatura del furgón' }) + '</div></div>';
      }
      if (!pend.length) {
        html += '<form class="card m-card" data-submit="entregar" novalidate>' +
          '<div class="card-title">' + ui.iconBox('check-circle') + '<h3>Confirmar entrega</h3>' + ui.rule('PR-11') + '</div>' +
          ui.field({ label: 'Recibe en acopio', name: 'receptor', icon: 'user', value: 'Yolanda Pérez · Jefe de bodega', placeholder: 'Nombre de quien recibe' }) +
          '<label class="check mt-8"><input type="checkbox" name="temp_ok" checked> Temperatura verificada al descargar (PR-10)</label>' +
          '<button type="button" class="m-sign" data-action="firmar" aria-label="Firma del receptor"><span class="t-cap">Toca para firmar</span></button>' +
          '<button type="submit" class="btn btn--primary btn--lg btn--block mt-8">' + I('check-circle', 22) + '<span>Confirmar entrega</span></button></form>';
      }
      return html + '</div>';
    },
    actions: {
      firmar: function (ctx, el) {
        el.classList.add('is-signed');
        el.innerHTML = '<svg viewBox="0 0 300 70" width="100%" height="70" aria-hidden="true"><path class="m-sign__path" d="M14 48 C 40 10, 52 62, 76 34 S 110 18, 122 44 S 160 60, 178 30 C 190 12, 204 56, 226 38 S 262 24, 288 30" fill="none" stroke="#123D26" stroke-width="2.6" stroke-linecap="round"/></svg><span class="t-cap">Firmado · ' + ui.hora(new Date().toISOString()) + '</span>';
      },
      entregar: async function (ctx, form) {
        const r = ctx.q.rutaConductor();
        const btn = form.querySelector('[type=submit]');
        if (!form.querySelector('.m-sign.is-signed')) { ui.toast('Falta la firma', 'Pide al receptor que firme para cerrar la entrega.', 'warning'); form.querySelector('.m-sign').classList.add('is-missing'); return; }
        try {
          const res = await ui.withLoading(btn, function () { return ctx.api.confirmarEntrega(r.id, { receptor: form.receptor.value }); });
          if (res.encolado) { ui.toast('Entrega guardada sin conexión', 'Se confirmará al recuperar señal.', 'warning'); return; }
          ui.confetti();
          ui.modal({
            sheet: true, container: ctx.overlay,
            body: '<div class="m-success">' + successMark + '<h3 class="h2">¡Entrega confirmada!</h3><p class="t-body">Ruta ' + r.id + ' completada. Los compradores fueron notificados para confirmar la recepción.</p>' +
              receipt([['Pedidos entregados', res.pedidos.join(', ')], ['Kilos', ui.kg(r.kg)], ['Recibe', form.receptor.value || '—']]) + '</div>',
            foot: ui.btn({ label: 'Ver ruta de mañana', icon: 'route', block: true, attrs: ' data-close' }),
            onClose: function () { ctx.go('#/conductor/ruta'); }
          });
        } catch (e) { ui.error(e); }
      }
    }
  };

  /* ---------- LOTES REGISTRADOS ---------- */
  pages.lotes = {
    title: 'Lotes', live: true,
    render: function (ctx) {
      const lotes = lotesDelCamion(ctx.q);
      const hoy = RC.db.util.fecha(0);
      const deHoy = lotes.filter(function (l) { return new Date(l.fecha_hora_recoleccion).toISOString().slice(0, 10) === hoy || ui.dia(l.fecha_hora_recoleccion) === 'Hoy'; });
      return hdr(ctx) + '<div class="m-page reveal">' +
        '<div><h2 class="h2">Lotes registrados</h2><p class="t-body">Cada lote tiene QR, kilos, temperatura y calidad (RN3).</p></div>' +
        '<div class="m-stats"><div class="m-stat"><span class="t-cap">Lotes hoy</span><b>' + deHoy.length + '</b></div><div class="m-stat"><span class="t-cap">Kg recolectados hoy</span><b>' + ui.num(deHoy.reduce(function (t, l) { return t + l.kg_recolectados; }, 0)) + '</b></div></div>' +
        (lotes.length ? '<div class="m-list">' + lotes.map(function (l) {
          const fuera = l.temperatura_c < l.producto.temp_min || l.temperatura_c > l.producto.temp_max;
          return '<button class="list-row m-lote" data-action="verLote" data-id="' + l.id + '"><span class="m-lote__qr">' + ui.qr(l.qr, 52) + '</span><span class="grow"><span class="list-row__title">' + l.id + '</span><span class="list-row__sub" style="display:block">' + l.producto.nombre + ' · ' + l.productor.nombre + '</span>' +
            '<span class="m-lote__chips">' + ui.chip(temp(l.temperatura_c), fuera ? 'danger' : 'info', { icon: 'thermometer' }) + ui.chip('Calidad ' + l.grado_calidad, l.grado_calidad === 'C' ? 'danger' : 'success') + '</span></span>' +
            '<span class="m-amount"><b class="num">' + ui.kg(l.kg_recolectados) + '</b><span class="t-cap">' + ui.hora(l.fecha_hora_recoleccion) + '</span></span></button>';
        }).join('') + '</div>' : ui.empty({ icon: 'qr-code', title: 'Aún no hay lotes', text: 'Registra la primera recolección desde la ruta del día.', action: ui.btn({ label: 'Ir a la ruta', icon: 'route', variant: 'secondary', go: '#/conductor/ruta' }) })) +
        '</div>';
    },
    actions: {
      verLote: function (ctx, el) {
        const l = ctx.q.lote(el.dataset.id); if (!l) return;
        const tel = l.telemetria;
        ui.modal({
          sheet: true, container: ctx.overlay, title: 'Lote ' + l.id, icon: 'qr-code',
          body: '<div class="m-lotdetail"><span class="m-lotdetail__qr">' + ui.qr(l.qr, 120) + '</span><div><div class="list-row__title">' + l.producto.nombre + ' · ' + ui.kg(l.kg_recolectados) + '</div><div class="t-cap">' + l.qr + '</div><div class="m-lote__chips mt-8">' + ui.chip(temp(l.temperatura_c), 'info', { icon: 'thermometer' }) + ui.chip('Calidad ' + l.grado_calidad, 'success') + '</div></div></div>' +
            ui.timeline([
              { title: 'Finca · ' + l.productor.nombre, sub: l.productor.municipio + ' · ' + ui.cuando(l.fecha_hora_recoleccion), state: 'done' },
              { title: 'Camión ' + (l.ruta ? l.ruta.vehiculo.placa : '') + ' · ruta ' + (l.ruta ? l.ruta.id : ''), sub: 'Cadena de frío monitoreada', state: l.almacen ? 'done' : 'current' },
              { title: l.almacen ? l.almacen.nombre : 'Centro de acopio', sub: l.fecha_hora_entrada_almacen ? 'Entrada ' + ui.cuando(l.fecha_hora_entrada_almacen) : 'Pendiente de entrega', state: l.almacen ? 'done' : 'pending' },
              { title: l.comprador.razon_social, sub: 'Pedido ' + l.pedido.id + ' · ' + l.comprador.municipio, state: l.pedido.estado === 'recibido' ? 'done' : 'pending' }
            ]) +
            '<div class="m-chart">' + ui.lineChart({ series: [{ values: tel.lecturas, color: '#2D7BD8' }], labels: tel.lecturas.map(function (_, i) { return i % 4 === 0 ? '+' + (i / 2) + 'h' : ''; }), band: [tel.min, tel.max], height: 160, fmt: function (v) { return ui.num(v, 1) + '°'; }, label: 'Telemetría del lote' }) + '</div>'
        });
      }
    }
  };

  /* ---------- INCIDENCIAS ---------- */
  const TIPOS = [['Vía bloqueada', 'route'], ['Falla mecánica', 'truck'], ['Temperatura fuera de rango', 'thermometer'], ['Producto dañado', 'package'], ['Retraso', 'clock']];
  pages.incidencias = {
    title: 'Incidencias', live: true,
    render: function (ctx) {
      const r = ctx.q.rutaConductor();
      const todas = ctx.q.incidencias();
      const mias = todas.filter(function (i) { return i.conductor === CONDUCTOR || rutasDelCamion().indexOf(i.id_ruta) >= 0; });
      const flota = todas.filter(function (i) { return mias.indexOf(i) < 0; }).slice(0, 4);
      const fila = function (i) { return '<div class="list-row">' + ui.iconBox('alert-triangle', i.estado === 'resuelta' ? null : 'orange', 'sm') + '<span class="grow"><span class="list-row__title">' + i.tipo + '</span><span class="list-row__sub" style="display:block">' + i.id + ' · ruta ' + i.id_ruta + ' · ' + ui.hace(i.fecha) + (i.descripcion ? ' · ' + ui.esc(i.descripcion) : '') + '</span></span>' + ui.estado(i.estado) + '</div>'; };
      return hdr(ctx) + '<div class="m-page reveal">' +
        '<div class="m-linkcard m-linkcard--orange">' + ui.iconBox('alert-triangle', 'orange', 'lg') + '<div class="grow"><b>Incidencias</b><span class="t-cap">Reporta cualquier novedad en la ruta ' + (r ? r.id : '') + '.</span></div></div>' +
        '<form class="card m-card" data-submit="reportar" novalidate>' +
        '<span class="field__label">Tipo de novedad</span><div class="m-chips">' + TIPOS.map(function (t) { return '<button type="button" class="chip-btn ' + (st.tipo === t[0] ? 'is-active' : '') + '" data-action="tipo" data-v="' + t[0] + '">' + I(t[1], 15) + ' ' + t[0] + '</button>'; }).join('') + '</div>' +
        ui.field({ label: 'Descripción', name: 'descripcion', area: true, value: st.desc, placeholder: 'Ej.: Derrumbe en la vía Repelón–Rotinet, desvío de 20 min.', attrs: ' data-oninput="guardarDesc"' }) +
        '<div class="row gap-8"><button type="button" class="m-photo ' + (st.foto ? 'is-on' : '') + '" data-action="foto">' + (st.foto ? '<span class="m-photo__img"></span><span class="t-cap">foto_novedad.jpg · 1,2 MB</span>' : I('camera', 20) + '<span>Adjuntar foto</span>') + '</button>' +
        '<span class="t-cap grow">' + I('map-pin', 14) + ' Ubicación GPS automática</span></div>' +
        '<button type="submit" class="btn btn--warning btn--block mt-8">' + I('send', 18) + '<span>Enviar reporte a operación</span></button></form>' +
        '<h3 class="h3">Mis reportes</h3>' + (mias.length ? '<div class="m-list">' + mias.map(fila).join('') + '</div>' : '<p class="t-body">No has reportado novedades. ¡Buen viaje!</p>') +
        (flota.length ? '<h3 class="h3">Novedades de la flota</h3><div class="m-list">' + flota.map(fila).join('') + '</div>' : '') +
        '</div>';
    },
    actions: {
      tipo: function (ctx, el) { st.tipo = el.dataset.v; el.parentNode.querySelectorAll('.chip-btn').forEach(function (b) { b.classList.toggle('is-active', b === el); }); },
      guardarDesc: function (ctx, el) { st.desc = el.value; },
      foto: function (ctx, el) {
        st.foto = !st.foto;
        el.classList.toggle('is-on', st.foto);
        el.innerHTML = st.foto ? '<span class="m-photo__img"></span><span class="t-cap">foto_novedad.jpg · 1,2 MB</span>' : I('camera', 20) + '<span>Adjuntar foto</span>';
      },
      reportar: async function (ctx, form) {
        const r = ctx.q.rutaConductor();
        const btn = form.querySelector('[type=submit]');
        if (!st.tipo) { ui.toast('Selecciona el tipo de novedad', 'Elige una de las opciones para que operación pueda priorizarla.', 'warning'); return; }
        try {
          const res = await ui.withLoading(btn, function () { return ctx.api.reportarIncidencia(r.id, { tipo: st.tipo, descripcion: (form.descripcion.value || '') + (st.foto ? ' (con foto)' : '') }); });
          if (res.encolado) ui.toast('Reporte guardado sin conexión', 'Se enviará al recuperar señal.', 'warning');
          else ui.toast('Reporte enviado', res.id + ' · operación fue notificada.', 'success');
          st.tipo = null; st.desc = ''; st.foto = false;
          ctx.refresh();
        } catch (e) { ui.error(e); }
      }
    }
  };

  /* ---------- PERFIL ---------- */
  pages.perfil = {
    title: 'Perfil',
    render: function (ctx) {
      const q = ctx.q; const r = q.rutaConductor(); const v = q.vehiculo(VEH);
      const lotes = lotesDelCamion(q).filter(function (l) { return ui.dia(l.fecha_hora_recoleccion) === 'Hoy'; });
      const on = RC.db.state.online.conductor !== false;
      const cola = RC.db.state.cola_sync.filter(function (c) { return c.rol === 'conductor'; }).length;
      return hdr(ctx) + '<div class="m-page reveal">' +
        '<div class="m-profile"><span class="avatar m-profile__av">' + ctx.user.ini + '</span><div class="grow"><h2 class="h3">' + CONDUCTOR + '</h2><span class="t-cap">Conductor · RaízCaribe</span><div class="m-stars">' + I('star', 14) + I('star', 14) + I('star', 14) + I('star', 14) + I('star', 14) + '<b>4,9</b></div></div></div>' +
        '<div class="card m-card"><div class="row">' + ui.iconBox('truck', null, 'lg') + '<div class="grow"><div class="list-row__title">' + v.placa + '</div><div class="t-cap">' + v.tipo_vehiculo + ' · ' + ui.kg(v.capacidad_kg) + '</div></div>' + (v.refrigerado ? ui.chip('Refrigerado', 'info', { icon: 'snowflake' }) : ui.chip('Seco', 'neutral')) + '</div>' +
        '<div class="m-facts mt-8"><span>' + I('activity', 15) + 'Sensor IoT conectado</span><span>' + I('navigation', 15) + 'GPS activo</span></div></div>' +
        '<div class="m-stats m-stats--4">' +
        '<div class="m-stat"><span class="t-cap">Paradas</span><b>' + (r ? r.hechas + '/' + r.paradas.length : '—') + '</b></div>' +
        '<div class="m-stat"><span class="t-cap">Lotes hoy</span><b>' + lotes.length + '</b></div>' +
        '<div class="m-stat"><span class="t-cap">Kg hoy</span><b>' + ui.num(lotes.reduce(function (t, l) { return t + l.kg_recolectados; }, 0)) + '</b></div>' +
        '<div class="m-stat"><span class="t-cap">Km ruta</span><b>' + (r ? r.distancia_km : 0) + '</b></div></div>' +
        '<button class="m-linkcard m-linkcard--orange" data-go="#/conductor/incidencias">' + ui.iconBox('alert-triangle', 'orange', 'lg') + '<span class="grow"><b>Incidencias</b><span class="t-cap">Reporta cualquier novedad en la ruta.</span></span>' + I('chevron-right', 20, 't-orange') + '</button>' +
        '<button class="m-linkcard" data-go="#/conductor/entrega">' + ui.iconBox('package', null, 'lg') + '<span class="grow"><b>Entrega</b><span class="t-cap">Confirma la entrega del lote recolectado.</span></span>' + I('chevron-right', 20, 't-green') + '</button>' +
        '<div class="card m-card"><div class="row gap-8">' + I(on ? 'wifi' : 'wifi-off', 20, on ? 't-green' : 't-orange') + '<b class="grow">' + (on ? 'Con conexión' : 'Modo sin conexión') + '</b>' + (cola ? ui.chip(cola + ' en cola', 'warning') : ui.chip('Sincronizado', 'success')) + '</div>' +
        '<p class="t-cap mt-8">La app funciona sin señal: las recolecciones, entregas e incidencias se guardan en el celular y se sincronizan al volver la conexión. Usa el interruptor junto al celular para simularlo.</p></div>' +
        ui.btn({ label: 'Cerrar sesión', icon: 'log-out', variant: 'outline', block: true, attrs: ' data-ui="logout"' }) +
        '</div>';
    }
  };

  RC.views.conductor = {
    role: 'conductor',
    home: 'ruta',
    nav: [
      { key: 'ruta', icon: 'home', label: 'Ruta' },
      { key: 'lotes', icon: 'package', label: 'Lotes' },
      { key: 'incidencias', icon: 'alert-triangle', label: 'Incidencias' },
      { key: 'perfil', icon: 'user', label: 'Perfil' }
    ],
    navAlias: { entrega: 'ruta', escanear: 'ruta' },
    info: {
      title: 'App del conductor y acopio',
      text: 'Ruta del día optimizada para varios productores, registro de lotes con QR, temperatura y calidad, y confirmación de entrega en el centro de acopio.',
      procesos: [['PR-8', 'Ruta compartida del día'], ['PR-9', 'Recolección y lote con QR (RN3)'], ['PR-10', 'Cadena de frío medida (RN4)'], ['PR-11', 'Entrega y recepción']]
    },
    pages: pages
  };
})();
