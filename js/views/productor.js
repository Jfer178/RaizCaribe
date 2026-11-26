/* =========================================================================
   RaízCaribe · App del productor (móvil)
   Usuario de la demo: PRD-02 · Finca El Porvenir · Luis Herrera (Sabanalarga)
   Procesos: PR-5 publicar oferta · PR-7 asignación · PR-9 entrega en parada ·
             PR-12 liquidación y pago (RN5)
   ========================================================================= */
window.RC = window.RC || {};
RC.views = RC.views || {};

(function () {
  const I = RC.icon, ui = RC.ui;
  const PRD = 'PRD-02';
  /* Estado local de la vista (no persiste: solo preferencias de pantalla) */
  const st = { filtro: 'publicada', preselect: null, confirmadas: {} };

  /* ---------------- utilidades ---------------- */
  const hdr = function (ctx, o) { return RC.app.phoneHeader(ctx, Object.assign({ tag: false }, o || {})); };
  function chipDia(iso) {
    const d = ui.dia(iso);
    if (d === 'Hoy') return 'Hoy, ' + ui.hora(iso);
    if (d === 'Mañana') return 'Mañana, ' + ui.fecha(iso);
    return d;
  }
  function pendientes(q) {
    return q.paradasDe(PRD).filter(function (p) { return p.estado !== 'recogido' && p.ruta && p.ruta.estado !== 'completada'; });
  }
  function productosDelProductor(q) { return q.productor(PRD).productos.map(q.producto); }
  /* LOTE recolectados de la finca (opcionalmente por producto) */
  function lotesDe(pid) {
    const db = RC.db;
    return db.state.lotes.filter(function (l) {
      const a = db.byId('asignaciones', l.id_asignacion); const of = a && db.byId('ofertas', a.id_oferta);
      return of && of.id_productor === PRD && (!pid || of.id_producto === pid);
    }).sort(function (a, b) { return a.fecha_hora_recoleccion < b.fecha_hora_recoleccion ? 1 : -1; });
  }
  function kgDeParada(p) { return p.asignaciones.reduce(function (t, a) { return t + a.kg_asignados; }, 0); }
  function productosDeParada(p) { return p.productos.map(function (x) { return x.nombre; }).join(' + '); }
  /* Paradas de una ruta para el mapa (lat/lng reales) */
  function rutaStops(r) {
    const stops = r.paradas.map(function (p) {
      return { lat: p.productor.latitud, lng: p.productor.longitud, label: p.productor.id === PRD ? 'Tu finca' : p.productor.municipio, state: p.estado === 'recogido' ? 'done' : p.estado === 'en_curso' ? 'current' : 'pending' };
    });
    const a = r.destinoAlmacen; if (a) stops.push({ lat: a.latitud, lng: a.longitud, label: a.municipio, state: 'dest' });
    return stops;
  }
  function progresoRuta(r) {
    const n = r.paradas.length + 1; const done = r.paradas.filter(function (p) { return p.estado === 'recogido'; }).length;
    return done ? Math.min(1, (done - 0.5) / (n - 1)) : 0;
  }
  /* Los mapas se ven a 358 px de ancho: agrandamos textos y marcadores para que sean legibles */
  function agrandarMapas(root) {
    root.querySelectorAll('.m-map text').forEach(function (t) { const f = parseFloat(t.style.fontSize); if (f) t.style.fontSize = (f * 1.7).toFixed(1) + 'px'; });
    root.querySelectorAll('.m-map .map__stop circle').forEach(function (c) { c.setAttribute('r', (parseFloat(c.getAttribute('r')) * 1.35).toFixed(1)); });
    root.querySelectorAll('.m-map .map__truck > g').forEach(function (g) { const m = /scale\(([\d.]+)\)/.exec(g.getAttribute('transform') || ''); if (m) g.setAttribute('transform', 'scale(' + (parseFloat(m[1]) * 1.5).toFixed(3) + ')'); });
  }
  const successMark = '<div class="success-mark"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#2F8F3A" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></div>';
  function receipt(rows) { return '<div class="m-receipt">' + rows.map(function (r) { return '<div class="m-receipt__row"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>'; }).join('') + '</div>'; }

  /* ---------------- bloque de precio justo (PR-4 / PR-5) ---------------- */
  function sugHtml(q, pid, precio, kg) {
    const s = q.sugerirPrecio(pid);
    const p = +precio || 0, k = +kg || 0;
    let aviso = '';
    if (p && p > s.max * 1.15) aviso = ui.callout('alert-triangle', 'Tu precio está <b>por encima</b> del rango justo; puede tardar más en asignarse a un pedido.', 'warn');
    else if (p && p < s.min * 0.85) aviso = ui.callout('info', 'Tu precio está <b>por debajo</b> del mercado: podrías cobrar más por tu cosecha.', 'info');
    const comision = RC.db.state.meta.comision;
    const neto = Math.round(p * k * (1 - comision));
    return '<div class="m-sug__row">' + I('sparkles', 16) + '<span>Precio justo sugerido</span><b>' + ui.money(s.min) + ' – ' + ui.money(s.max) + '</b></div>' +
      '<div class="m-sug__row t-cap">Referencia mayorista: ' + ui.money(s.referencia) + '/kg <button type="button" class="link" data-action="usarSugerido" data-v="' + s.sugerido + '">Usar ' + ui.money(s.sugerido) + '</button></div>' +
      aviso +
      '<div class="m-sug__total"><span>Ingreso neto estimado <small>(− ' + ui.pct(comision) + ' comisión · RN5)</small></span><b>' + ui.money(neto) + '</b></div>';
  }

  /* =====================================================================
     PÁGINAS
     ===================================================================== */
  const pages = {};

  /* ---------- INICIO ---------- */
  pages.inicio = {
    title: 'Inicio',
    render: function (ctx) {
      const q = ctx.q;
      const ofertas = q.ofertasDe(PRD);
      const pend = pendientes(q);
      const pagosPend = q.pagosDe(PRD).filter(function (p) { return p.estado !== 'pagado'; });
      const parcelas = q.parcelasDe(PRD);
      const prods = productosDelProductor(q);
      const pid = st.preselect && prods.some(function (p) { return p.id === st.preselect; }) ? st.preselect : prods[0].id;
      const sug = q.sugerirPrecio(pid);
      const prox = pend[0];
      const manana = RC.db.util.fecha(1);
      return hdr(ctx) +
        '<div class="m-hero" style="background-image:url(assets/img/encabezado-productor.png)"><span class="m-hero__tag">Del campo Caribe a más mesas</span></div>' +
        '<div class="m-page reveal">' +
        '<div class="m-greet"><h2 class="h2">Hola, productor</h2><p class="t-body">Gestiona tus cosechas, entregas y pagos en RAÍZCARIBE.</p></div>' +
        '<div class="m-kpis">' +
        ui.kpi({ compact: true, icon: 'sprout', label: 'Cosechas publicadas', count: ofertas.length, go: '#/productor/cosechas' }) +
        ui.kpi({ compact: true, icon: 'truck', label: 'Entregas programadas', count: pend.length, go: '#/productor/entregas' }) +
        ui.kpi({ compact: true, icon: 'credit-card', label: 'Pagos pendientes', count: pagosPend.length, tone: 'orange', go: '#/productor/pagos' }) +
        ui.kpi({ compact: true, icon: 'layers', label: 'Lotes', count: parcelas.length, go: '#/productor/lotes' }) +
        '</div>' +
        /* Formulario de publicación (PR-5) */
        '<form class="card m-card m-publish" data-submit="publicar" novalidate id="publicar">' +
        '<div class="m-publish__band">' + I('plus-circle', 24) + '<h3>Publicar cosecha</h3>' + ui.rule('PR-5') + '</div>' +
        '<div class="m-publish__body">' +
        '<div class="form-row"><span class="field__label">Producto</span><div class="control control--sm control--select"><select name="producto" data-onchange="cambiarProducto">' +
        prods.map(function (p) { return '<option value="' + p.id + '"' + (p.id === pid ? ' selected' : '') + '>' + p.nombre + '</option>'; }).join('') + '</select></div></div>' +
        '<div class="form-row"><span class="field__label">Cantidad</span><div class="control control--sm"><input type="number" name="cantidad" min="50" step="50" value="1000" inputmode="numeric" data-oninput="calcular"><span class="control__suffix">kg</span></div></div>' +
        '<div class="form-row"><span class="field__label">Precio</span><div class="control control--sm"><span class="control__suffix">$</span><input type="number" name="precio" min="1" step="10" value="' + sug.sugerido + '" inputmode="numeric" data-oninput="calcular"><span class="control__suffix">/kg</span></div></div>' +
        '<div class="form-row"><span class="field__label">Fecha</span><div class="control control--sm">' + I('calendar', 18) + '<input type="date" name="fecha" value="' + manana + '" min="' + RC.db.util.fecha(0) + '"></div></div>' +
        '<div class="form-row"><span class="field__label">Ventana</span><div class="control control--sm control--select">' + I('clock', 18) + '<select name="ventana"><option value="05:00-09:00">5:00 – 9:00 a. m.</option><option value="06:00-10:00">6:00 – 10:00 a. m.</option><option value="13:00-17:00">1:00 – 5:00 p. m.</option></select></div></div>' +
        '<div class="m-sug" data-sug>' + sugHtml(q, pid, sug.sugerido, 1000) + '</div>' +
        '<button type="submit" class="btn btn--primary btn--block">' + I('send', 18) + '<span>Publicar</span></button>' +
        '</div></form>' +
        /* Próxima recolección */
        (prox ? '<button class="list-row m-row" data-go="#/productor/entregas">' + ui.iconBox('truck', null, 'lg').replace('icon-box', 'icon-box icon-box--round') +
          '<span class="grow"><span class="list-row__title">Próxima recolección</span><span class="list-row__sub" style="display:block">' + productosDeParada(prox) + ' · ' + ui.kg(kgDeParada(prox)) + '</span></span>' + ui.chip(chipDia(prox.hora_estimada), 'warning') + I('chevron-right', 18) + '</button>'
          : '<div class="list-row m-row">' + ui.iconBox('truck', null, 'lg') + '<span class="grow"><span class="list-row__title">Sin recolecciones programadas</span><span class="list-row__sub" style="display:block">Publica una cosecha para que la asignemos a un pedido.</span></span></div>') +
        /* Mis lotes */
        '<button class="list-row m-row" data-go="#/productor/lotes">' + ui.iconBox('layers', null, 'lg').replace('icon-box', 'icon-box icon-box--round') +
        '<span class="grow"><span class="list-row__title">Mis lotes</span><span class="list-row__sub" style="display:block">' + parcelas.length + ' lotes registrados</span></span><span class="link">Ver lotes ' + I('chevron-right', 16) + '</span></button>' +
        '</div>';
    },
    mount: function (ctx) {
      if (st.preselect) { const f = ctx.el.querySelector('#publicar'); if (f) setTimeout(function () { f.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 200); st.preselect = null; }
    },
    actions: {
      cambiarProducto: function (ctx, el) {
        const f = el.form; const s = ctx.q.sugerirPrecio(el.value);
        f.precio.value = s.sugerido;
        f.querySelector('[data-sug]').innerHTML = sugHtml(ctx.q, el.value, f.precio.value, f.cantidad.value);
      },
      calcular: function (ctx, el) {
        const f = el.form;
        el.closest('.control').classList.remove('is-invalid');
        f.querySelector('[data-sug]').innerHTML = sugHtml(ctx.q, f.producto.value, f.precio.value, f.cantidad.value);
      },
      usarSugerido: function (ctx, el) {
        const f = el.closest('form'); f.precio.value = el.dataset.v;
        f.precio.closest('.control').animate([{ background: '#E3F1DA' }, { background: '#fff' }], { duration: 700 });
        f.querySelector('[data-sug]').innerHTML = sugHtml(ctx.q, f.producto.value, f.precio.value, f.cantidad.value);
      },
      publicar: async function (ctx, form) {
        const btn = form.querySelector('[type=submit]');
        const fd = new FormData(form);
        const ventana = String(fd.get('ventana') || '05:00-09:00').split('-');
        const d = { id_producto: fd.get('producto'), cantidad_kg: +fd.get('cantidad'), precio_kg: +fd.get('precio'), fecha_cosecha: fd.get('fecha'), ventana_inicio: ventana[0], ventana_fin: ventana[1] };
        /* Validación en el cliente (PR-5 · ¿oferta válida?) */
        let malo = false;
        [['cantidad', d.cantidad_kg >= 50], ['precio', d.precio_kg > 0], ['fecha', !!d.fecha_cosecha]].forEach(function (c) {
          const ctl = form.querySelector('[name=' + c[0] + ']').closest('.control');
          ctl.classList.toggle('is-invalid', !c[1]); if (!c[1]) malo = true;
        });
        if (malo) { ui.toast('Revisa los datos', 'La cantidad mínima es 50 kg y el precio y la fecha son obligatorios.', 'warning'); return; }
        try {
          const r = await ui.withLoading(btn, function () { return ctx.api.publicarOferta(PRD, d); });
          if (r.encolado) {
            ui.toast('Guardado sin conexión', 'Tu cosecha se publicará al recuperar señal (' + r.pendientes + ' pendiente(s)).', 'warning');
            return;
          }
          const p = ctx.q.producto(d.id_producto);
          ui.confetti();
          ui.modal({
            sheet: true, container: ctx.overlay,
            body: '<div class="m-success">' + successMark + '<h3 class="h2">¡Cosecha publicada!</h3><p class="t-body">Tu oferta ya está visible en el portal B2B para supermercados, hoteles y restaurantes del Caribe.</p>' +
              receipt([['Oferta', r.oferta.id], ['Producto', p.nombre], ['Cantidad', ui.kg(d.cantidad_kg)], ['Precio', ui.money(d.precio_kg) + '/kg'], ['Cosecha', ui.dia(d.fecha_cosecha)], ['Ventana de recogida', d.ventana_inicio + ' – ' + d.ventana_fin]]) +
              (r.aviso ? ui.callout('alert-triangle', r.aviso, 'warn') : ui.callout('sparkles', 'Precio dentro del rango justo. Te avisaremos cuando se asigne a un pedido (PR-7).')) + '</div>',
            foot: ui.btn({ label: 'Cerrar', variant: 'outline', attrs: ' data-close' }) + ui.btn({ label: 'Ver mis cosechas', icon: 'sprout', attrs: ' data-ver' }),
            onMount: function (c) { c.el.querySelector('[data-ver]').onclick = function () { c.close(); ctx.go('#/productor/cosechas'); }; },
            onClose: function () { ctx.refresh(); }
          });
        } catch (e) { ui.error(e); }
      }
    }
  };

  /* ---------- COSECHAS (ofertas publicadas) ---------- */
  pages.cosechas = {
    title: 'Mis cosechas', live: true,
    render: function (ctx) {
      const todas = ctx.q.ofertasDe(PRD);
      const lista = todas.filter(function (o) { return st.filtro === 'todas' || o.estado === st.filtro; });
      const disp = todas.filter(function (o) { return o.estado === 'publicada'; }).reduce(function (t, o) { return t + o.cantidad_kg - o.kg_reservado; }, 0);
      const res = todas.filter(function (o) { return o.estado !== 'vencida'; }).reduce(function (t, o) { return t + o.kg_reservado; }, 0);
      const seg = [['publicada', 'Publicadas'], ['asignada', 'Asignadas'], ['todas', 'Todas']];
      return hdr(ctx, { back: '#/productor/inicio' }) +
        '<div class="m-page reveal">' +
        '<div><h2 class="h2">Mis cosechas</h2><p class="t-body">Ofertas publicadas en el catálogo B2B y su reserva en pedidos.</p></div>' +
        '<div class="m-stats">' +
        '<div class="m-stat"><span class="t-cap">Disponible para venta</span><b>' + ui.kg(disp) + '</b></div>' +
        '<div class="m-stat"><span class="t-cap">Reservado en pedidos</span><b class="t-orange">' + ui.kg(res) + '</b></div></div>' +
        '<div class="seg m-seg">' + seg.map(function (s) { return '<button data-action="filtro" data-f="' + s[0] + '" class="' + (st.filtro === s[0] ? 'is-active' : '') + '">' + s[1] + ' <small>' + (s[0] === 'todas' ? todas.length : todas.filter(function (o) { return o.estado === s[0]; }).length) + '</small></button>'; }).join('') + '</div>' +
        (lista.length ? '<div class="m-list">' + lista.map(function (o) {
          const pct = o.cantidad_kg ? o.kg_reservado / o.cantidad_kg : 0;
          return '<div class="card m-card m-offer">' +
            '<div class="row"><img class="m-offer__img" src="' + o.producto.img + '" alt="' + o.producto.nombre + '">' +
            '<div class="grow"><div class="row row--between"><span class="list-row__title">' + o.producto.nombre + '</span>' + ui.estado(o.estado) + '</div>' +
            '<div class="t-cap">' + o.id + ' · cosecha ' + ui.dia(o.fecha_cosecha).toLowerCase() + ' · ' + o.ventana_inicio + '–' + o.ventana_fin + '</div>' +
            '<div class="row row--between mt-4"><b class="num">' + ui.kg(o.cantidad_kg) + '</b><b class="t-green num">' + ui.money(o.precio_kg_solicitado) + '/kg</b></div></div></div>' +
            '<div class="m-offer__res"><div class="row row--between t-cap"><span>Reservado en pedidos</span><span>' + ui.num(o.kg_reservado) + ' de ' + ui.num(o.cantidad_kg) + ' kg</span></div>' + ui.progress(pct, pct >= 1 ? null : 'warn') + '</div></div>';
        }).join('') + '</div>' : ui.empty({ icon: 'sprout', title: 'Sin cosechas en este filtro', text: 'Publica una cosecha desde el inicio para verla aquí.' })) +
        ui.btn({ label: 'Publicar nueva cosecha', icon: 'plus-circle', variant: 'secondary', block: true, go: '#/productor/inicio' }) +
        '</div>';
    },
    actions: { filtro: function (ctx, el) { st.filtro = el.dataset.f; ctx.refresh(); } }
  };

  /* ---------- ENTREGAS (recolecciones programadas · PR-8 / PR-9) ---------- */
  pages.entregas = {
    title: 'Entregas', live: true,
    render: function (ctx) {
      const q = ctx.q;
      const pend = pendientes(q);
      const hechas = q.paradasDe(PRD).filter(function (p) { return p.estado === 'recogido'; }).reverse().slice(0, 4);
      const prox = pend[0];
      let html = hdr(ctx, { back: '#/productor/inicio' }) + '<div class="m-page reveal"><div><h2 class="h2">Entregas</h2><p class="t-body">Recolecciones de tus cosechas en rutas compartidas.</p></div>';
      if (prox) {
        const r = prox.ruta; const v = r.vehiculo;
        const conf = st.confirmadas[prox.id];
        const tl = [
          { title: 'Ruta ' + r.id + ' programada', sub: 'Motor de rutas · ' + r.paradas.length + ' productores comparten el camión', state: 'done' },
          { title: r.estado === 'en_curso' ? 'Camión en camino' : 'Salida del camión', sub: ui.cuando(r.fecha + 'T' + r.hora_salida + ':00') + ' · ' + v.placa, state: r.estado === 'en_curso' ? (prox.estado === 'en_curso' ? 'done' : 'current') : 'pending' },
          { title: 'Recolección en tu finca', sub: 'Hora estimada ' + ui.hora(prox.hora_estimada) + ' · ' + ui.kg(kgDeParada(prox)), state: prox.estado === 'en_curso' ? 'current' : 'pending' },
          { title: 'Llegada al centro de acopio', sub: r.destinoAlmacen ? r.destinoAlmacen.nombre : 'Centro de acopio', state: 'pending' }
        ];
        html += '<div class="card m-card m-next">' +
          '<div class="row row--between"><span class="t-over">Próxima recolección</span>' + ui.chip(chipDia(prox.hora_estimada), 'warning') + '</div>' +
          '<div class="m-next__time"><b>' + ui.hora(prox.hora_estimada) + '</b><span>' + productosDeParada(prox) + ' · ' + ui.kg(kgDeParada(prox)) + '</span></div>' +
          '<div class="m-next__facts">' +
          '<span>' + I('route', 16) + 'Ruta ' + r.id + '</span><span>' + I('truck', 16) + v.placa + '</span><span>' + I(v.refrigerado ? 'snowflake' : 'package', 16) + (v.refrigerado ? 'Refrigerado' : 'Seco') + '</span><span>' + I('user', 16) + v.conductor + '</span></div>' +
          '<div class="m-map">' + ui.map({ routes: [{ stops: rutaStops(r), progress: progresoRuta(r), truck: r.estado !== 'programada' }], height: 170, aspect: 2.1, pad: 70 }) + '</div>' +
          ui.timeline(tl) +
          (conf ? ui.callout('check-circle', 'Confirmaste que la cosecha estará lista y empacada en la ventana acordada.') :
            ui.btn({ label: 'Confirmar que estará lista', icon: 'check-circle', block: true, action: 'confirmar', attrs: ' data-id="' + prox.id + '"' })) +
          '</div>';
        if (pend.length > 1) {
          html += '<h3 class="h3">Próximas recolecciones</h3><div class="m-list">' + pend.slice(1).map(function (p) {
            return '<div class="list-row">' + ui.iconBox('calendar', null, 'sm') + '<span class="grow"><span class="list-row__title">' + productosDeParada(p) + ' · ' + ui.kg(kgDeParada(p)) + '</span><span class="list-row__sub" style="display:block">Ruta ' + p.ruta.id + ' · ' + p.ruta.vehiculo.placa + '</span></span>' + ui.chip(chipDia(p.hora_estimada), 'neutral') + '</div>';
          }).join('') + '</div>';
        }
      } else {
        html += ui.empty({ icon: 'truck', title: 'Sin recolecciones programadas', text: 'Cuando un pedido use tu cosecha, el motor de rutas te asignará una parada.' });
      }
      if (hechas.length) {
        html += '<h3 class="h3">Entregadas recientemente</h3><div class="m-list">' + hechas.map(function (p) {
          return '<div class="list-row">' + ui.iconBox('check-circle', null, 'sm') + '<span class="grow"><span class="list-row__title">' + productosDeParada(p) + ' · ' + ui.kg(kgDeParada(p)) + '</span><span class="list-row__sub" style="display:block">Ruta ' + p.ruta.id + ' · ' + (p.hora_real ? ui.cuando(p.hora_real) : 'Recogido') + '</span></span>' + (p.lotes[0] ? ui.chip(p.lotes[0].id, 'success') : ui.estado('recogido')) + '</div>';
        }).join('') + '</div>';
      }
      return html + '</div>';
    },
    mount: function (ctx) { agrandarMapas(ctx.el); },
    actions: {
      confirmar: async function (ctx, el) {
        await ui.withLoading(el, function () { return RC.api.delay(500); });
        st.confirmadas[el.dataset.id] = true;
        ui.toast('Disponibilidad confirmada', 'El conductor y la operación fueron notificados.', 'success');
        ctx.refresh();
      }
    }
  };

  /* ---------- PAGOS (PR-12 · RN5) ---------- */
  pages.pagos = {
    title: 'Pagos', live: true,
    render: function (ctx) {
      const pagos = ctx.q.pagosDe(PRD);
      const mes = RC.db.util.fecha(0).slice(0, 7);
      const cobradoMes = pagos.filter(function (p) { return p.estado === 'pagado' && String(p.fecha).slice(0, 7) === mes; }).reduce(function (t, p) { return t + p.neto; }, 0);
      const pend = pagos.filter(function (p) { return p.estado !== 'pagado'; });
      const totalPend = pend.reduce(function (t, p) { return t + p.neto; }, 0);
      const total = pagos.filter(function (p) { return p.estado === 'pagado'; }).reduce(function (t, p) { return t + p.neto; }, 0);
      const ej = pagos[0];
      const com = RC.db.state.meta.comision;
      return hdr(ctx, { back: '#/productor/inicio' }) +
        '<div class="m-page reveal">' +
        '<div><h2 class="h2">Pagos</h2><p class="t-body">Liquidaciones de lo que entregaste conforme.</p></div>' +
        '<div class="m-balance"><span class="t-cap">Cobrado este mes</span><b data-count="' + cobradoMes + '" data-format="money">$ 0</b>' +
        '<div class="m-balance__row"><span>' + I('clock', 16) + 'Pendiente: <b>' + ui.money(totalPend) + '</b> (' + pend.length + ')</span><span>Histórico: <b>' + ui.money(total) + '</b></span></div></div>' +
        '<div class="card m-card m-formula"><div class="row gap-8">' + ui.iconBox('dollar', null, 'sm') + '<b class="grow">¿Cómo se calcula tu pago?</b>' + ui.rule('RN5') + '</div>' +
        '<div class="m-formula__eq"><span>kg conformes</span><i>×</i><span>precio acordado</span><i>−</i><span>' + ui.pct(com) + ' comisión</span><i>=</i><span class="is-total">neto</span></div>' +
        (ej ? '<p class="t-cap">Ejemplo ' + ej.id + ': ' + ui.num(ej.asignacion.kg_conformes || 0, 1) + ' kg × ' + ui.money(ej.precio) + ' = ' + ui.money(ej.valor_bruto) + ' − ' + ui.money(ej.comision) + ' = <b class="t-green">' + ui.money(ej.neto) + '</b></p>' : '') + '</div>' +
        '<h3 class="h3">Movimientos</h3>' +
        (pagos.length ? '<div class="m-list">' + pagos.map(function (p) {
          const tone = p.estado === 'pagado' ? null : (p.estado === 'fallido' ? 'red' : 'orange');
          return '<button class="list-row" data-action="verPago" data-id="' + p.id + '">' + ui.iconBox(p.estado === 'pagado' ? 'wallet' : 'clock', tone, 'sm') +
            '<span class="grow"><span class="list-row__title">' + p.id + ' · ' + p.producto.nombre + '</span><span class="list-row__sub" style="display:block">' + ui.num(p.asignacion.kg_conformes || 0, 1) + ' kg conformes · ' + ui.fecha(p.fecha) + '</span></span>' +
            '<span class="m-amount"><b class="num">' + ui.money(p.neto) + '</b>' + ui.estado(p.estado) + '</span></button>';
        }).join('') + '</div>' : ui.empty({ icon: 'wallet', title: 'Aún no tienes pagos', text: 'Se generan cuando el comprador confirma la recepción conforme.' })) +
        '</div>';
    },
    actions: {
      verPago: function (ctx, el) {
        const p = ctx.q.pagosDe(PRD).find(function (x) { return x.id === el.dataset.id; }); if (!p) return;
        ui.modal({
          sheet: true, container: ctx.overlay, title: 'Pago ' + p.id, icon: 'wallet',
          body: '<div class="row row--between" style="margin-bottom:10px"><span class="t-body">' + p.producto.nombre + ' · pedido ' + p.pedido.id + '</span>' + ui.estado(p.estado) + '</div>' +
            receipt([['Kg conformes', ui.kg(p.asignacion.kg_conformes || 0)], ['Precio acordado', ui.money(p.precio) + '/kg'], ['Valor bruto', ui.money(p.valor_bruto)], ['Comisión RaízCaribe (' + ui.pct(RC.db.state.meta.comision) + ')', '− ' + ui.money(p.comision)], ['Neto a tu cuenta', '<span class="t-green">' + ui.money(p.neto) + '</span>'], ['Fecha', ui.fecha(p.fecha, { day: 'numeric', month: 'long', year: 'numeric' })], ['Referencia', p.referencia || '—']]) +
            (p.estado === 'procesando' ? ui.callout('refresh', 'La pasarela de pagos está confirmando la transferencia…', 'info') : p.estado === 'fallido' ? ui.callout('alert-triangle', 'La transferencia falló. Operación revisará tus datos bancarios y reintentará.', 'danger') : p.estado === 'pendiente' ? ui.callout('clock', 'Pago programado: se transfiere en el próximo corte.', 'warn') : '') +
            (p.asignacion.motivo_no_conformidad ? ui.callout('info', 'No conformidad registrada: ' + p.asignacion.motivo_no_conformidad + '.', 'warn') : '')
        });
      }
    }
  };

  /* ---------- MIS LOTES (lotes de cultivo) ---------- */
  pages.lotes = {
    title: 'Mis lotes',
    render: function (ctx) {
      const parcelas = ctx.q.parcelasDe(PRD);
      return hdr(ctx, { back: '#/productor/inicio' }) +
        '<div class="m-page reveal">' +
        '<div class="row gap-8">' + I('layers', 24, 't-green') + '<h2 class="h2">Mis lotes</h2></div>' +
        '<p class="t-body" style="margin-top:-8px">Controla tus lotes y su trazabilidad.</p>' +
        '<div class="m-list">' + parcelas.map(function (p) {
          return '<button class="list-row m-lot" data-action="verLote" data-id="' + p.id + '">' + ui.iconBox('sprout', null, 'sm').replace('icon-box', 'icon-box icon-box--round') +
            '<span class="grow"><span class="list-row__title">' + p.id + '</span><span class="list-row__sub" style="display:block">' + p.producto.nombre + ' · ' + p.hectareas + ' ha</span></span>' + ui.estado(p.estado) + I('chevron-right', 18) + '</button>';
        }).join('') + '</div>' +
        '<div class="callout">' + I('qr-code', 18) + '<div>Cada entrega queda registrada como un <b>lote con QR</b> (RN3): el comprador puede ver de qué finca viene su producto.</div></div>' +
        '</div>';
    },
    actions: {
      verLote: function (ctx, el) {
        const p = ctx.q.parcelasDe(PRD).find(function (x) { return x.id === el.dataset.id; }); if (!p) return;
        const lots = lotesDe(p.id_producto).slice(0, 5);
        ui.modal({
          sheet: true, container: ctx.overlay, title: 'Lote ' + p.id + ' · ' + p.producto.nombre, icon: 'sprout',
          body: '<div class="row row--between" style="margin-bottom:8px">' + ui.estado(p.estado) + '<span class="t-cap">' + p.hectareas + ' ha · ' + p.rendimiento + '</span></div>' +
            receipt([['Siembra', ui.fecha(p.siembra, { day: 'numeric', month: 'short', year: 'numeric' })], ['Cosecha estimada', p.cosecha_estimada ? ui.dia(p.cosecha_estimada) : '—'], ['Rango de frío del producto', p.producto.temp_min + '–' + p.producto.temp_max + ' °C'], ['Vida útil', p.producto.vida_util_horas + ' h']]) +
            (p.nota ? ui.callout('alert-triangle', p.nota, 'warn') : '') +
            '<h4 class="t-over" style="margin:14px 0 8px">Lotes recolectados (trazabilidad)</h4>' +
            (lots.length ? '<div class="m-list">' + lots.map(function (l) {
              return '<div class="list-row">' + ui.iconBox('qr-code', null, 'sm') + '<span class="grow"><span class="list-row__title">' + l.id + ' · ' + ui.kg(l.kg_recolectados) + '</span><span class="list-row__sub" style="display:block">' + ui.cuando(l.fecha_hora_recoleccion) + ' · ' + String(l.temperatura_c).replace('.', ',') + ' °C</span></span>' + ui.chip('Calidad ' + l.grado_calidad, l.grado_calidad === 'C' ? 'danger' : 'success') + '</div>';
            }).join('') + '</div>' : '<p class="t-body">Aún no hay entregas de este cultivo.</p>'),
          foot: ui.btn({ label: 'Publicar cosecha de este lote', icon: 'plus-circle', block: true, attrs: ' data-pub' }),
          onMount: function (c) { c.el.querySelector('[data-pub]').onclick = function () { st.preselect = p.id_producto; c.close(); ctx.go('#/productor/inicio'); }; }
        });
      }
    }
  };

  RC.views.productor = {
    role: 'productor',
    home: 'inicio',
    nav: [
      { key: 'inicio', icon: 'home', label: 'Inicio' },
      { key: 'cosechas', icon: 'sprout', label: 'Cosechas' },
      { key: 'entregas', icon: 'truck', label: 'Entregas', count: function (q) { return pendientes(q).length; } },
      { key: 'pagos', icon: 'credit-card', label: 'Pagos' }
    ],
    navAlias: { lotes: 'inicio' },
    info: {
      title: 'App del productor',
      text: 'Publica tus cosechas con precio justo sugerido, sigue tus recolecciones en rutas compartidas y recibe tus pagos desde el celular, incluso con señal débil.',
      procesos: [['PR-5', 'Publicar oferta con precio sugerido'], ['PR-7', 'Cosecha asignada a pedidos'], ['PR-9', 'Entrega en la parada de la ruta'], ['PR-12', 'Liquidación y pago (RN5)']]
    },
    pages: pages
  };
})();
