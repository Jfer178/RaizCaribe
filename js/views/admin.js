/* =========================================================================
   RaízCaribe · Panel de operación (Administrador / Operador)
   Aplicación "Panel de operación" (sección 5.1): vinculación (PR-1/2/3),
   asignaciones (PR-7), rutas (PR-8), trazabilidad (PR-9/10/11),
   pagos (PR-12) e indicadores de impacto (PR-13).
   ========================================================================= */
window.RC = window.RC || {};
RC.views = RC.views || {};

(function () {
  const I = RC.icon, ui = RC.ui;
  const esc = ui.esc;

  /* ---------- Estado local de la vista (filtros, selección) ---------- */
  const st = {
    ped: 'todos', pedQ: '', pedParam: null,
    ruta: null,
    prodQ: '', prodDep: '', prodEst: '', prodPag: 1,
    pagos: 'todos', ev: 'todos'
  };
  const POR_PAGINA = 10;
  const COLORES = ['#2F8F3A', '#2D7BD8', '#E07A12', '#7B5CC4', '#0E9AA7', '#B4462B', '#1B5E33', '#5F6863'];

  /* ======================= UTILIDADES ======================= */
  const hoy = function () { return RC.db.util.fecha(0); };
  const necesitaFrio = function (p) { return p.temp_max <= 13; };
  const zona = function (p) { return p.comprador ? p.comprador.departamento : '—'; };
  const productoTxt = function (ids) { return ids.map(function (id) { const p = RC.api.q.producto(id); return p ? p.nombre : id; }).join(', '); };
  const colorRuta = function (id) { const n = parseInt(String(id).replace(/\D/g, ''), 10) || 0; return COLORES[n % COLORES.length]; };
  const diaRuta = function (r) { return r.fecha === hoy() ? 'Hoy' : ui.dia(r.fecha); };
  const tonoOcupacion = function (o) { return o > 1 ? 'danger' : o > 0.88 ? 'warn' : null; };
  const link = function (txt, go) { return '<button class="link" data-go="' + go + '">' + txt + I('chevron-right', 16) + '</button>'; };

  /* Puntos de una ruta para el mapa: paradas en orden + centro de acopio de destino */
  function stopsRuta(r) {
    const s = r.paradas.map(function (pa) {
      return { lat: pa.productor.latitud, lng: pa.productor.longitud, label: pa.productos.map(function (p) { return p.nombre; }).join(' + ') || pa.productor.municipio, state: pa.estado === 'recogido' ? 'done' : pa.estado === 'en_curso' ? 'current' : 'pending' };
    });
    if (r.destinoAlmacen) s.push({ lat: r.destinoAlmacen.latitud, lng: r.destinoAlmacen.longitud, label: r.destinoAlmacen.municipio, state: 'dest' });
    return s;
  }
  /* Posición aproximada del camión (fracción del recorrido) */
  function progresoRuta(r) {
    const n = r.paradas.length; if (!n) return 0;
    if (r.estado === 'completada') return 1;
    if (!r.hechas) return 0.02;
    return Math.min(0.97, (r.hechas - 0.45) / n);
  }

  /* Resumen legible de los eventos del bus (interfaces I1–I8) */
  const EV = {
    PedidoRegistrado: ['package', null, function (p) { return 'Pedido <b>' + p.id_pedido + '</b> registrado · ' + esc(p.producto) + ' ' + ui.num(p.kg) + ' kg'; }],
    AsignacionConfirmada: ['handshake', 'I1', function (p) { return 'Asignación confirmada <b>' + p.id_pedido + '</b> · ' + (p.asignaciones || []).length + ' oferta(s)'; }],
    RutaProgramada: ['route', 'I2', function (p) { return 'Ruta <b>' + p.id_ruta + '</b> programada · ' + p.paradas + ' paradas · ' + ui.num(p.kg) + ' kg'; }],
    RutaOptimizada: ['navigation', 'I3', function (p) { return 'Ruta <b>' + p.id_ruta + '</b> optimizada · ' + p.km_antes + ' → ' + p.km_despues + ' km'; }],
    LoteRegistrado: ['qr-code', 'I4', function (p) { return 'Lote <b>' + p.id_lote + '</b> · ' + ui.num(p.kg_recolectados, 1) + ' kg · ' + p.temperatura_c + ' °C · calidad ' + p.grado_calidad; }],
    AlertaTemperatura: ['thermometer', 'I5', function (p) { return 'Alerta de frío en <b>' + p.id_lote + '</b> · ' + p.temperatura_c + ' °C'; }],
    EntregaRegistrada: ['warehouse', null, function (p) { return 'Entrega de <b>' + p.id_pedido + '</b> en ' + esc(p.receptor || 'centro de acopio'); }],
    EntregaConfirmada: ['check-circle', 'I6', function (p) { return 'Recepción de <b>' + p.id_pedido + '</b> · ' + ui.num(p.kg_conformes, 1) + ' kg conformes'; }],
    PagoRealizado: ['wallet', 'I7', function (p) { return 'Pago <b>' + p.id_pago + '</b> · ' + ui.money(p.neto) + ' a ' + esc(p.productor); }],
    PagoFallido: ['x-circle', 'I7', function (p) { return 'Pago <b>' + p.id_pago + '</b> rechazado por la pasarela'; }],
    OfertaPublicada: ['sprout', null, function (p) { return esc(p.productor) + ' publicó <b>' + esc(p.producto) + '</b> · ' + ui.num(p.kg) + ' kg'; }],
    PedidoRechazado: ['x', null, function (p) { return 'Pedido <b>' + p.id_pedido + '</b> rechazado · ' + esc(p.motivo); }],
    IncidenciaReportada: ['alert-triangle', null, function (p) { return 'Incidencia en <b>' + p.ruta + '</b> · ' + esc(p.tipo); }],
    ProductorActivado: ['users', null, function (p) { return 'Productor <b>' + esc(p.nombre) + '</b> activado (PR-2)'; }],
    ProductorEvaluado: ['user-cog', null, function (p) { return 'Evaluación de <b>' + p.id_productor + '</b>: ' + esc(p.resultado); }],
    CompradorActivado: ['store', null, function (p) { return 'Comprador <b>' + esc(p.razon_social) + '</b> activado (PR-3)'; }]
  };
  function eventoHtml(e) {
    const d = EV[e.tipo] || ['activity', null, function () { return esc(e.tipo); }];
    const tone = /Alerta|Fallido|Rechazado|Incidencia/.test(e.tipo) ? 'orange' : null;
    return '<div class="adm-ev">' + ui.iconBox(d[0], tone, 'sm') + '<div class="grow"><div class="adm-ev__txt">' + d[2](e.payload || {}) + '</div><div class="adm-ev__meta">' + e.tipo + (d[1] ? ' · <span class="tag-rule">' + d[1] + '</span>' : '') + ' · ' + ui.hace(e.fecha) + '</div></div></div>';
  }

  /* ======================= PEDIDOS: tabla y detalle ======================= */
  const FILTROS = [['todos', 'Todos'], ['pendiente', 'Pendientes'], ['aprobado', 'Aprobados'], ['en_ruta', 'En ruta'], ['entregado', 'Entregados'], ['recibido', 'Completados'], ['rechazado', 'Rechazados']];
  function coincideFiltro(p, f) {
    if (f === 'todos') return true;
    if (f === 'pendiente') return p.estado === 'pendiente' || p.estado === 'sin_cobertura';
    if (f === 'rechazado') return p.estado === 'rechazado';
    return p.estado === f;
  }
  function pedidosFiltrados(q) {
    const t = st.pedQ.trim().toLowerCase();
    return q.pedidos().filter(function (p) {
      if (!coincideFiltro(p, st.ped)) return false;
      if (!t) return true;
      return (p.id + ' ' + p.solicitud + ' ' + p.comprador.razon_social + ' ' + p.producto.nombre + ' ' + p.comprador.municipio).toLowerCase().indexOf(t) >= 0;
    });
  }
  function tablaPedidos(q) {
    const rows = pedidosFiltrados(q);
    if (!rows.length) return '<div class="card">' + ui.empty({ icon: 'search', title: 'Sin resultados', text: 'No hay pedidos que coincidan con el filtro o la búsqueda.' }) + '</div>';
    return '<div class="table-wrap"><table class="table"><thead><tr><th>Pedido</th><th>Comprador</th><th>Producto</th><th class="t-right">Cantidad</th><th class="t-right">Precio / kg</th><th class="t-right">Total</th><th>Requerido</th><th>Estado</th><th></th></tr></thead><tbody>' +
      rows.map(function (p) {
        return '<tr class="is-click" data-action="verPedido" data-id="' + p.id + '"><td><div class="t-strong">' + p.id + '</div><div class="t-cap">' + esc(p.solicitud || '') + '</div></td>' +
          '<td><div class="t-strong">' + esc(p.comprador.razon_social) + '</div><div class="t-cap">' + esc(p.comprador.municipio) + ' · ' + esc(p.comprador.tipo_comprador) + '</div></td>' +
          '<td><div class="adm-prod"><img src="' + p.producto.img + '" alt="">' + esc(p.producto.nombre) + '</div></td>' +
          '<td class="t-right num">' + ui.kg(p.cantidad_kg) + '</td><td class="t-right num">' + ui.money(p.precio_kg_acordado) + '</td><td class="t-right num t-strong">' + ui.money(p.total) + '</td>' +
          '<td>' + ui.dia(p.fecha_requerida) + '</td><td>' + ui.estado(p.estado) + '</td><td>' + I('chevron-right', 18, 't-muted') + '</td></tr>';
      }).join('') + '</tbody></table></div><div class="pager"><span>' + rows.length + ' pedido(s)</span><span>Datos de PEDIDO · ASIGNACION · OFERTA</span></div>';
  }

  /* Simulación PR-7: qué ofertas se usarían (misma regla que el motor: primero la cosecha más antigua) */
  function simularAsignacion(q, ped) {
    let resto = ped.cantidad_kg;
    return q.ofertasDisponibles(ped.id_producto).map(function (o) {
      const pr = q.productor(o.id_productor);
      const libre = o.cantidad_kg - o.kg_reservado;
      const usa = Math.max(0, Math.min(resto, libre)); resto -= usa;
      return { o: o, pr: pr, libre: libre, usa: usa, km: RC.api.haversine(pr, ped.comprador) };
    });
  }
  function detallePedido(q, id) {
    const p = q.pedido(id);
    if (!p) return ui.empty({ icon: 'package', title: 'Pedido no encontrado' });
    const pasos = [{ label: 'Recibido', sub: ui.dia(p.creado) }, { label: 'Asignado' }, { label: 'En ruta' }, { label: 'Entregado' }];
    let h = '<div class="adm-ped-head"><img src="' + p.producto.img + '" alt="">' +
      '<div class="grow"><div class="row gap-8"><span class="h3">' + p.id + '</span>' + ui.estado(p.estado) + '<span class="chip chip--neutral">' + esc(p.solicitud || '') + '</span></div>' +
      '<div class="t-body">' + esc(p.comprador.razon_social) + ' · ' + esc(p.comprador.municipio) + ', ' + esc(p.comprador.departamento) + ' · NIT ' + esc(p.comprador.nit) + '</div></div>' +
      '<div class="adm-ped-total"><span class="t-cap">Total acordado</span><b>' + ui.money(p.total) + '</b><span class="t-cap">' + ui.kg(p.cantidad_kg) + ' × ' + ui.money(p.precio_kg_acordado) + '/kg</span></div></div>';
    if (p.estado !== 'rechazado' && p.estado !== 'sin_cobertura') h += '<div class="mt-16">' + ui.stepper(pasos, p.estado === 'recibido' ? 4 : p.etapa, { allDone: p.estado === 'recibido' }) + '</div>';
    h += '<div class="adm-kv-grid mt-16">' +
      '<div><span>Producto</span><b>' + esc(p.producto.nombre) + '</b></div><div><span>Fecha requerida</span><b>' + ui.fecha(p.fecha_requerida, { weekday: 'short', day: 'numeric', month: 'short' }) + '</b></div>' +
      '<div><span>Registrado</span><b>' + ui.cuando(p.creado) + '</b></div><div><span>Cadena de frío</span><b>' + p.producto.temp_min + '–' + p.producto.temp_max + ' °C</b></div></div>';

    if (p.estado === 'pendiente' || p.estado === 'sin_cobertura') {
      const sim = simularAsignacion(q, p);
      const total = sim.reduce(function (t, s) { return t + s.libre; }, 0);
      const cubre = total >= p.cantidad_kg;
      h += '<h4 class="adm-sub mt-24">' + ui.rule('PR-6') + ' Cobertura con ofertas disponibles</h4>' +
        '<div class="row row--between mt-8"><span class="t-body">' + ui.kg(Math.min(total, p.cantidad_kg)) + ' de ' + ui.kg(p.cantidad_kg) + ' cubiertos</span><span class="t-strong ' + (cubre ? 't-green' : 't-red') + '">' + ui.pct(Math.min(1, total / p.cantidad_kg)) + '</span></div>' +
        ui.progress(Math.min(1, total / p.cantidad_kg), cubre ? null : 'danger') +
        (cubre ? ui.callout('check-circle', 'Las ofertas de productores <b>activos</b> cubren la cantidad pedida. Al aprobar, el motor cruza el pedido con las ofertas (<b>PR-7</b>) y lo envía a una ruta compartida (<b>RN1</b> · <b>PR-8</b>).') : ui.callout('alert-triangle', 'Las ofertas no alcanzan la cantidad. Si apruebas, el pedido quedará <b>sin cobertura</b> y se propondrá una alternativa al comprador.', 'warn')) +
        '<h4 class="adm-sub mt-16">' + ui.rule('PR-7') + ' Ofertas candidatas (cosecha más antigua primero)</h4>' +
        (sim.length ? '<div class="table-wrap mt-8"><table class="table"><thead><tr><th>Productor</th><th>Oferta</th><th class="t-right">Disponible</th><th class="t-right">Precio</th><th>Cosecha</th><th class="t-right">Distancia</th><th class="t-right">Asignaría</th></tr></thead><tbody>' +
          sim.map(function (s) {
            return '<tr class="' + (s.usa ? 'adm-row-on' : '') + '"><td><div class="t-strong">' + esc(s.pr.nombre) + '</div><div class="t-cap">' + esc(s.pr.municipio) + ', ' + esc(s.pr.departamento) + '</div></td><td class="mono">' + s.o.id + '</td><td class="t-right num">' + ui.kg(s.libre) + '</td><td class="t-right num">' + ui.money(s.o.precio_kg_solicitado) + '</td><td>' + ui.dia(s.o.fecha_cosecha) + '</td><td class="t-right num">' + ui.num(s.km) + ' km</td><td class="t-right">' + (s.usa ? '<b class="t-green">' + ui.kg(s.usa) + '</b>' : '<span class="t-muted">—</span>') + '</td></tr>';
          }).join('') + '</tbody></table></div>' : ui.empty({ icon: 'sprout', title: 'Sin ofertas publicadas', text: 'No hay ofertas activas de este producto.' })) +
        '<div class="adm-reject hide" data-reject><h4 class="adm-sub">Motivo del rechazo</h4>' +
        ui.field({ name: 'motivo', id: 'adm-motivo', icon: 'file-text', options: ['Precio fuera del rango acordado', 'Fecha requerida no viable para la ruta', 'Comprador con documentación pendiente', 'Producto sin calidad mínima disponible', 'Otro motivo comercial'] }) + '</div>';
      if (p.estado === 'sin_cobertura') h += ui.callout('x-circle', 'Este pedido quedó <b>sin cobertura</b>: el comprador recibió una propuesta de ajuste.', 'danger');
    } else if (p.estado === 'rechazado') {
      h += '<div class="mt-16">' + ui.callout('x-circle', '<b>Rechazado:</b> ' + esc(p.motivo || 'No cumple condiciones comerciales'), 'danger') + '</div>';
    } else {
      h += '<h4 class="adm-sub mt-24">' + ui.rule('ASIGNACION') + ' Productores, paradas y lotes</h4><div class="list mt-8">' +
        p.asignaciones.map(function (a) {
          const lotes = a.lotes.map(function (l) { return '<button class="chip chip--info" data-goto="#/admin/trazabilidad/' + l.id + '">' + I('qr-code', 13) + l.id + ' · ' + l.temperatura_c + ' °C · ' + l.grado_calidad + '</button>'; }).join(' ');
          return '<div class="list-row">' + ui.iconBox('sprout', null, 'sm') + '<div class="grow"><div class="list-row__title">' + esc(a.productor.nombre) + ' · ' + ui.kg(a.kg_asignados) + '</div>' +
            '<div class="list-row__sub">' + esc(a.productor.municipio) + (a.ruta ? ' · ruta ' + a.ruta.id + ' · parada ' + (a.parada ? ui.cuando(a.parada.hora_real || a.parada.hora_estimada) : '') : '') +
            (a.kg_conformes != null ? ' · <b>' + ui.kg(a.kg_conformes) + ' conformes</b>' : '') + (a.motivo_no_conformidad ? ' · <span class="t-orange">' + esc(a.motivo_no_conformidad) + '</span>' : '') + '</div>' +
            (lotes ? '<div class="row row--wrap gap-4 mt-4">' + lotes + '</div>' : '') + '</div>' +
            (a.pago ? '<div class="t-right"><div class="t-strong">' + ui.money(a.pago.neto) + '</div>' + ui.estado(a.pago.estado) + '</div>' : (a.parada ? ui.estado(a.parada.estado) : '')) + '</div>';
        }).join('') + '</div>';
    }
    return h;
  }
  function pieDetalle(p) {
    if (!p) return '';
    if (p.estado === 'pendiente') return ui.btn({ label: 'Rechazar', variant: 'neutral', icon: 'x', attrs: ' data-m="rechazar"' }) + ui.btn({ label: 'Confirmar rechazo', variant: 'danger', icon: 'x-circle', cls: 'hide', attrs: ' data-m="confirmarRechazo"' }) + ui.btn({ label: 'Aprobar y asignar', icon: 'check-circle', attrs: ' data-m="aprobar"' });
    const r = p.ruta;
    return (r ? ui.btn({ label: 'Ver ruta ' + r.id, variant: 'outline', icon: 'route', attrs: ' data-m="ruta" data-ruta="' + r.id + '"' }) : '') + ui.btn({ label: 'Cerrar', variant: 'secondary', attrs: ' data-close' });
  }
  function resultadoAprobacion(r) {
    const p = r.pedido;
    return '<div class="success-mark"><svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#2F8F3A" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></div>' +
      '<h3 class="h2" style="text-align:center">Pedido ' + p.id + ' aprobado</h3><p class="t-lead" style="text-align:center">Se asignó a ' + p.asignaciones.length + ' oferta(s) y se programó la recolección compartida.</p>' +
      '<div class="row row--wrap gap-8 mt-16" style="justify-content:center">' + ui.rule('PR-7 asignación') + ui.rule('RN1 pedido confirmado') + ui.rule('PR-8 ruta') + ui.rule('RN2 capacidad') + '</div>' +
      '<div class="list mt-16">' + p.asignaciones.map(function (a) {
        const ru = a.ruta ? RC.api.q.ruta(a.ruta.id) : null;
        return '<div class="list-row">' + ui.iconBox('route', null, 'sm') + '<div class="grow"><div class="list-row__title">' + esc(a.productor.nombre) + ' · ' + ui.kg(a.kg_asignados) + '</div><div class="list-row__sub">' +
          (ru ? 'Ruta ' + ru.id + ' · ' + diaRuta(ru) + ' ' + ru.hora_salida + ' · ' + ru.vehiculo.placa + ' · parada estimada ' + ui.hora(a.parada.hora_estimada) : 'Sin ruta') + '</div>' +
          (ru ? '<div class="mt-8">' + ui.progress(ru.ocupacion, tonoOcupacion(ru.ocupacion)) + '<span class="t-cap">Ocupación del vehículo ' + ui.pct(ru.ocupacion) + ' (' + ui.kg(ru.kg) + ' de ' + ui.kg(ru.vehiculo.capacidad_kg) + ')</span></div>' : '') + '</div></div>';
      }).join('') + '</div>';
  }
  function abrirPedido(ctx, id) {
    const q = RC.api.q;
    const p = q.pedido(id);
    if (!p) return ui.toast('Pedido no encontrado', id, 'warning');
    const m = ui.modal({
      title: 'Detalle del pedido', icon: 'package', size: 'lg', noFocus: true,
      body: detallePedido(q, id), foot: pieDetalle(p),
      onMount: function (c) { enlazarModal(ctx, c, id); }
    });
    return m;
  }
  function enlazarModal(ctx, c, id) {
    const root = c.root;
    root.addEventListener('click', async function (e) {
      const b = e.target.closest('[data-m]');
      const g = e.target.closest('[data-goto]');
      if (g) { c.close(); ctx.go(g.dataset.goto); return; }
      if (!b) return;
      const k = b.dataset.m;
      if (k === 'ruta') { c.close(); st.ruta = b.dataset.ruta; ctx.go('#/admin/rutas/' + b.dataset.ruta); return; }
      if (k === 'rechazar') {
        root.querySelector('[data-reject]').classList.remove('hide');
        b.classList.add('hide'); root.querySelector('[data-m="confirmarRechazo"]').classList.remove('hide');
        root.querySelector('[data-reject]').scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (k === 'confirmarRechazo') {
        const motivo = root.querySelector('#adm-motivo').value;
        try {
          await ui.withLoading(b, function () { return RC.api.rechazarPedido(id, motivo); });
          ui.toast('Pedido ' + id + ' rechazado', motivo + '. Se notificó al comprador.', 'warning');
          c.close(); ctx.refresh();
        } catch (err) { ui.error(err); }
        return;
      }
      if (k === 'aprobar') {
        try {
          const r = await ui.withLoading(b, function () { return RC.api.aprobarPedido(id); });
          ui.toast('Pedido ' + id + ' aprobado', 'PR-7: ' + r.pedido.asignaciones.length + ' asignación(es) · RN1 cumplida · PR-8: ruta ' + r.rutas.join(', ') + '.', 'success', 5600);
          root.querySelector('.modal__body').innerHTML = resultadoAprobacion(r);
          root.querySelector('.modal__foot').innerHTML = ui.btn({ label: 'Ver ruta ' + r.rutas[0], variant: 'outline', icon: 'route', attrs: ' data-m="ruta" data-ruta="' + r.rutas[0] + '"' }) + ui.btn({ label: 'Listo', icon: 'check', attrs: ' data-close' });
          ui.enhance(root);
          ctx.refresh();
        } catch (err) {
          ui.error(err);
          root.querySelector('.modal__body').innerHTML = detallePedido(RC.api.q, id);
          root.querySelector('.modal__foot').innerHTML = pieDetalle(RC.api.q.pedido(id));
          ui.enhance(root); ctx.refresh();
        }
      }
    });
  }

  /* Acciones compartidas por varias páginas */
  const comunes = {
    verPedido: function (ctx, el) { abrirPedido(ctx, el.dataset.id); },
    quickAprobar: async function (ctx, el) {
      try {
        const r = await ui.withLoading(el, function () { return RC.api.aprobarPedido(el.dataset.id); });
        ui.toast('Pedido ' + el.dataset.id + ' aprobado', 'Asignado (PR-7) y programado en ruta ' + r.rutas.join(', ') + ' (PR-8).', 'success', 5000);
      } catch (e) { ui.error(e); }
      ctx.refresh();
    },
    quickRechazar: async function (ctx, el) {
      const ok = await ui.confirm({ title: 'Rechazar ' + el.dataset.id, text: 'El comprador recibirá la notificación con el motivo "Fecha requerida no viable para la ruta". ¿Continuar?', ok: 'Rechazar', okVariant: 'danger', icon: 'x-circle', tone: 'red' });
      if (!ok) return;
      try { await RC.api.rechazarPedido(el.dataset.id, 'Fecha requerida no viable para la ruta'); ui.toast('Pedido ' + el.dataset.id + ' rechazado', 'Se notificó al comprador.', 'warning'); } catch (e) { ui.error(e); }
      ctx.refresh();
    },
    revisar: function (ctx) { st.ped = 'pendiente'; ctx.go('#/admin/pedidos'); }
  };

  /* ======================= PÁGINA: INICIO ======================= */
  function mapaRutasHoy(q, alto) {
    let rs = q.rutas(function (r) { return r.fecha === hoy() && r.estado !== 'completada'; });
    if (!rs.length) rs = q.rutas(function (r) { return r.estado !== 'completada'; }).slice(0, 3);
    const hayCurso = rs.some(function (r) { return r.estado === 'en_curso'; });
    const routes = rs.map(function (r, i) {
      const activa = r.estado === 'en_curso' || (!hayCurso && i === 0);
      return { stops: stopsRuta(r), color: colorRuta(r.id), active: activa, mode: 'loop', progress: 0 };
    });
    const leyenda = '<div class="map__legend">' + rs.slice(0, 4).map(function (r) { return '<span class="row gap-4"><i class="adm-dot" style="background:' + colorRuta(r.id) + '"></i>' + r.id + '</span>'; }).join('') + '</div>';
    return ui.map({ routes: routes, height: alto || 300, aspect: 1.55, labels: false, legend: leyenda, badge: ui.chip(rs.filter(function (r) { return r.estado === 'en_curso'; }).length + ' en curso', 'success', { live: true }) });
  }
  function filaPedido(p) {
    return '<button class="list-row" data-action="verPedido" data-id="' + p.id + '">' + ui.iconBox('package', null, 'sm') + '<span class="grow"><span class="list-row__title" style="display:block">' + p.id + '</span><span class="list-row__sub">' + esc(p.producto.nombre) + ' · ' + esc(zona(p)) + '</span></span>' + ui.estado(p.estado) + I('chevron-right', 18) + '</button>';
  }
  function aprobacionesRapidas(q) {
    const pend = q.pedidos(function (p) { return p.estado === 'pendiente'; });
    if (!pend.length) return ui.empty({ icon: 'shield-check', title: 'Todo aprobado', text: 'No hay pedidos esperando asignación.' });
    return '<div class="list">' + pend.map(function (p) {
      const cub = simularAsignacion(q, p).reduce(function (t, s) { return t + s.libre; }, 0) >= p.cantidad_kg;
      return '<div class="adm-quick">' + ui.iconBox('package', null, 'sm') + '<div class="grow"><div class="list-row__title">' + p.id + ' <span class="t-cap">· ' + ui.hace(p.creado) + '</span></div><div class="list-row__sub">' + esc(p.producto.nombre) + ' ' + ui.kg(p.cantidad_kg) + ' · ' + esc(p.comprador.razon_social) + '</div>' +
        '<div class="t-cap ' + (cub ? 't-green' : 't-red') + '">' + I(cub ? 'check' : 'alert-triangle', 13) + (cub ? 'Cobertura completa' : 'Cobertura insuficiente') + '</div></div>' +
        '<div class="row gap-8">' + ui.btn({ label: 'Rechazar', variant: 'neutral', size: 'sm', action: 'quickRechazar', attrs: ' data-id="' + p.id + '"' }) + ui.btn({ label: 'Aprobar', size: 'sm', action: 'quickAprobar', attrs: ' data-id="' + p.id + '"' }) + '</div></div>';
    }).join('') + '</div>';
  }
  const inicio = {
    title: 'Inicio', live: true,
    render: function (ctx) {
      const q = ctx.q, k = q.indicadores();
      const rutasHoy = q.rutas(function (r) { return r.fecha === hoy(); });
      const enCurso = rutasHoy.filter(function (r) { return r.estado === 'en_curso'; }).length;
      const recientes = q.pedidos(function (p) { return p.estado !== 'recibido'; }).slice(0, 4);
      const inc = q.incidencias().filter(function (i) { return i.estado !== 'resuelta'; });
      return '<div class="page-head"><div><h1 class="h1">Hola, Administrador</h1><p class="page-head__sub">Gestiona pedidos, rutas y la operación agro-logística de RAÍZCARIBE.</p></div>' +
        '<div class="row gap-8">' + ui.chip('Operación en vivo', 'success', { live: true }) + '<span class="chip chip--neutral">' + I('calendar', 14) + ui.fecha(hoy(), { weekday: 'long', day: 'numeric', month: 'long' }) + '</span></div></div>' +
        '<div class="reveal stack" style="gap:22px">' +
        '<div class="grid grid-4">' +
        ui.kpi({ icon: 'package', label: 'Pedidos activos', count: k.pedidosActivos, foot: k.pendientes + ' por aprobar', footTone: k.pendientes ? '' : 'up', go: '#/admin/pedidos' }) +
        ui.kpi({ icon: 'users', label: 'Productores', count: k.productoresTotal, foot: I('trending-up', 14) + k.productoresActivos + ' activos en la red', footTone: 'up', go: '#/admin/productores' }) +
        ui.kpi({ icon: 'truck', label: 'Rutas del día', count: rutasHoy.length, foot: enCurso + ' en curso · ' + ui.num(k.productoresPorRuta, 1) + ' productores/ruta', go: '#/admin/rutas' }) +
        ui.kpi({ icon: 'check-circle', label: 'Entregas a tiempo', count: k.aTiempo, format: 'pct', foot: 'Meta OE5 ≥ 95 %', footTone: k.aTiempo >= 0.95 ? 'up' : 'down', go: '#/admin/indicadores' }) +
        '</div>' +
        '<div class="adm-dash">' +
        '<div class="card">' + ui.cardTitle('map-pin', 'Rutas compartidas', link('Ver rutas', '#/admin/rutas')) + mapaRutasHoy(q, 300) + '</div>' +
        '<div class="card">' + ui.cardTitle('package', 'Pedidos recientes', link('Ver todos', '#/admin/pedidos')) + '<div class="list">' + recientes.map(filaPedido).join('') + '</div></div>' +
        '</div>' +
        (k.pendientes ? '<div class="adm-alert">' + '<span class="adm-alert__icon">' + I('alert-triangle', 34) + '</span><strong class="adm-alert__title">Alertas</strong><span class="vr"></span><span class="grow t-lead" style="color:var(--n900)">' + k.pendientes + ' pedido' + (k.pendientes > 1 ? 's' : '') + ' pendiente' + (k.pendientes > 1 ? 's' : '') + ' de aprobación.' + (inc.length ? ' · ' + inc.length + ' incidencia(s) abierta(s).' : '') + '</span>' + ui.btn({ label: 'Revisar', variant: 'warning', iconRight: 'chevron-right', action: 'revisar' }) + '</div>'
          : '<div class="adm-alert adm-alert--ok"><span class="adm-alert__icon">' + I('shield-check', 32) + '</span><strong class="adm-alert__title">Todo en orden</strong><span class="vr"></span><span class="grow t-lead" style="color:var(--n900)">No hay pedidos pendientes de aprobación.</span></div>') +
        '<div class="adm-dash adm-dash--3">' +
        '<div class="card">' + ui.cardTitle('shield-check', 'Aprobaciones rápidas', ui.rule('PR-7')) + aprobacionesRapidas(q) + '</div>' +
        '<div class="card">' + ui.cardTitle('activity', 'Bus de eventos en vivo', link('Bitácora', '#/admin/eventos')) + '<div class="adm-feed">' + q.eventos(6).map(eventoHtml).join('') + '</div></div>' +
        '<div class="card">' + ui.cardTitle('alert-triangle', 'Incidencias abiertas', null, 'orange') +
        (inc.length ? '<div class="list">' + inc.slice(0, 4).map(function (i) { return '<div class="list-row">' + ui.iconBox('alert-triangle', 'orange', 'sm') + '<div class="grow"><div class="list-row__title">' + esc(i.tipo) + '</div><div class="list-row__sub">' + i.id_ruta + ' · ' + esc(i.conductor) + ' · ' + ui.hace(i.fecha) + '</div><div class="t-cap mt-4">' + esc(i.descripcion) + '</div></div>' + ui.estado(i.estado) + '</div>'; }).join('') + '</div>' : ui.empty({ icon: 'check-circle', title: 'Sin incidencias', text: 'Las rutas avanzan sin novedades.' })) + '</div>' +
        '</div></div>';
    },
    actions: comunes
  };

  /* ======================= PÁGINA: PEDIDOS ======================= */
  const pedidos = {
    title: 'Pedidos', live: true,
    render: function (ctx) {
      const q = ctx.q; const todos = q.pedidos();
      const cuenta = function (f) { return todos.filter(function (p) { return coincideFiltro(p, f); }).length; };
      const k = q.indicadores();
      return '<div class="page-head"><div><h1 class="h1">Pedidos</h1><p class="page-head__sub">Aprueba, asigna ofertas y sigue cada pedido del comprador hasta la recepción conforme.</p></div>' +
        '<div class="row gap-8">' + ui.rule('PR-6') + ui.rule('PR-7') + ui.rule('RN1') + '</div></div>' +
        '<div class="reveal stack" style="gap:18px">' +
        '<div class="grid grid-4">' +
        ui.kpi({ icon: 'alert-triangle', label: 'Por aprobar', count: k.pendientes, tone: 'orange', compact: true }) +
        ui.kpi({ icon: 'handshake', label: 'Asignados', count: cuenta('aprobado'), compact: true }) +
        ui.kpi({ icon: 'truck', label: 'En ruta', count: cuenta('en_ruta'), compact: true }) +
        ui.kpi({ icon: 'check-circle', label: 'Completados', count: cuenta('recibido'), compact: true }) + '</div>' +
        '<div class="adm-filters"><div class="seg adm-seg">' + FILTROS.map(function (f) { return '<button class="' + (st.ped === f[0] ? 'is-active' : '') + '" data-action="pedFiltro" data-v="' + f[0] + '">' + f[1] + ' <span class="adm-seg__n">' + cuenta(f[0]) + '</span></button>'; }).join('') + '</div>' +
        '<div class="adm-search">' + ui.field({ name: 'buscar', id: 'adm-ped-q', icon: 'search', value: st.pedQ, placeholder: 'Buscar pedido, comprador o producto', attrs: ' data-oninput="pedBuscar"' }) + '</div></div>' +
        '<div data-ped-tabla>' + tablaPedidos(q) + '</div></div>';
    },
    mount: function (ctx) {
      if (ctx.param && st.pedParam !== ctx.param && !document.querySelector('.overlay')) { st.pedParam = ctx.param; abrirPedido(ctx, ctx.param); }
      if (!ctx.param) st.pedParam = null;
    },
    actions: Object.assign({}, comunes, {
      pedFiltro: function (ctx, el) { st.ped = el.dataset.v; ctx.refresh(); },
      pedBuscar: function (ctx, el) { st.pedQ = el.value; ctx.el.querySelector('[data-ped-tabla]').innerHTML = tablaPedidos(ctx.q); }
    })
  };

  /* ======================= PÁGINA: RUTAS (motor de rutas, C2) ======================= */
  function tarjetaRuta(r, sel) {
    const frio = r.paradas.some(function (pa) { return pa.productos.some(necesitaFrio); });
    return '<button class="adm-route ' + (sel ? 'is-active' : '') + '" data-action="selRuta" data-id="' + r.id + '" style="--rc:' + colorRuta(r.id) + '">' +
      '<div class="row row--between"><span class="row gap-8"><i class="adm-dot" style="background:' + colorRuta(r.id) + '"></i><b class="adm-route__id">' + r.id + '</b><span class="t-cap">' + diaRuta(r) + ' · ' + r.hora_salida + '</span></span>' + ui.estado(r.estado) + '</div>' +
      '<div class="adm-route__veh">' + I('truck', 16) + r.vehiculo.placa + ' · ' + esc(r.vehiculo.tipo_vehiculo) + (r.vehiculo.refrigerado ? ' <span class="t-green" title="Refrigerado">' + I('snowflake', 14) + '</span>' : '') + (frio && !r.vehiculo.refrigerado ? ' <span class="t-red">' + I('alert-triangle', 14) + '</span>' : '') + '</div>' +
      '<div class="row row--between t-cap"><span>' + r.paradas.length + ' paradas · ' + r.hechas + ' recogidas</span><span class="num">' + ui.kg(r.kg) + ' / ' + ui.num(r.vehiculo.capacidad_kg) + '</span></div>' +
      ui.progress(r.ocupacion, tonoOcupacion(r.ocupacion)) +
      '<div class="row row--between t-cap"><span>' + ui.num(r.distancia_km) + ' km</span><span>' + ui.money(r.costo_total) + '</span></div></button>';
  }
  function detalleRuta(q, r, todas) {
    const frioReq = r.paradas.some(function (pa) { return pa.productos.some(necesitaFrio); });
    const pendientes = r.paradas.filter(function (p) { return p.estado === 'pendiente'; }).length;
    const routes = todas.filter(function (x) { return x.id !== r.id && x.fecha === r.fecha; }).map(function (x) { return { stops: stopsRuta(x), color: colorRuta(x.id), active: false }; });
    routes.push({ stops: stopsRuta(r), color: colorRuta(r.id), active: true, mode: r.estado === 'programada' ? 'to' : 'to', progress: r.estado === 'programada' ? 0 : progresoRuta(r) });
    const inc = q.incidencias().filter(function (i) { return i.id_ruta === r.id; });
    const costoKg = r.kg ? r.costo_total / r.kg : 0;
    return '<div class="card card--pad-lg adm-route-detail">' +
      '<div class="row row--between row--wrap"><div class="row gap-8"><span class="icon-box" style="background:' + colorRuta(r.id) + '1f;color:' + colorRuta(r.id) + '">' + I('route', 22) + '</span><div><div class="h2">Ruta ' + r.id + '</div><div class="t-body">' + diaRuta(r) + ' · salida ' + r.hora_salida + ' · ' + esc(r.vehiculo.conductor) + ' · destino ' + esc(r.destinoAlmacen ? r.destinoAlmacen.nombre : '—') + '</div></div></div>' +
      '<div class="row gap-8">' + ui.estado(r.estado) + ui.btn({ label: 'Optimizar ruta', variant: 'outline', icon: 'sparkles', action: 'optimizar', attrs: ' data-id="' + r.id + '"', disabled: pendientes < 2 }) + '</div></div>' +
      '<div class="adm-route-kpis mt-16">' +
      '<div><span class="ring" style="--p:' + Math.min(100, Math.round(r.ocupacion * 100)) + '"><span>' + ui.pct(r.ocupacion) + '</span></span><small>Ocupación</small></div>' +
      '<div><b>' + r.paradas.length + '</b><small>Paradas (productores)</small></div>' +
      '<div><b>' + ui.kg(r.kg) + '</b><small>Carga de ' + ui.num(r.vehiculo.capacidad_kg) + ' kg</small></div>' +
      '<div><b>' + ui.num(r.distancia_km) + ' km</b><small>Distancia</small></div>' +
      '<div><b>' + ui.money(costoKg) + '</b><small>Costo logístico / kg</small></div></div>' +
      '<div class="mt-16">' + ui.map({ routes: routes, height: 360, aspect: 1.9, pad: 70 }) + '</div>' +
      '<div class="grid grid-2 mt-16">' +
      (r.ocupacion <= 1 ? ui.callout('check-circle', '<b>RN2 · Capacidad:</b> ' + ui.kg(r.kg) + ' de ' + ui.kg(r.vehiculo.capacidad_kg) + ' (' + ui.pct(r.ocupacion) + '). La carga cabe en el vehículo.') : ui.callout('alert-triangle', '<b>RN2 · Capacidad excedida:</b> reagrupa paradas en otra ruta.', 'danger')) +
      (frioReq && !r.vehiculo.refrigerado ? ui.callout('thermometer', '<b>RN4 · Cadena de frío:</b> hay productos que requieren refrigeración y el vehículo no es refrigerado.', 'danger') : ui.callout('snowflake', '<b>RN4 · Cadena de frío:</b> ' + (r.vehiculo.refrigerado ? 'vehículo refrigerado con sensor IoT de temperatura (I5).' : 'los productos de esta ruta no requieren frío.'), 'info')) + '</div>' +
      '<h4 class="adm-sub mt-24">' + ui.rule('PARADA_RUTA') + ' Paradas en orden de recorrido</h4>' +
      '<div class="table-wrap mt-8"><table class="table"><thead><tr><th>#</th><th>Productor</th><th>Productos</th><th class="t-right">Carga</th><th>Hora estimada</th><th>Hora real</th><th>Lotes</th><th>Estado</th></tr></thead><tbody>' +
      r.paradas.map(function (pa) {
        return '<tr><td><span class="adm-order" style="background:' + colorRuta(r.id) + '">' + pa.orden_parada + '</span></td><td><div class="t-strong">' + esc(pa.productor.nombre) + '</div><div class="t-cap">' + esc(pa.productor.municipio) + ', ' + esc(pa.productor.departamento) + '</div></td>' +
          '<td>' + pa.productos.map(function (p) { return esc(p.nombre); }).join(', ') + '</td><td class="t-right num">' + ui.kg(pa.kg) + '</td><td>' + ui.hora(pa.hora_estimada) + '</td><td>' + (pa.hora_real ? '<b class="t-green">' + ui.hora(pa.hora_real) + '</b>' : '<span class="t-muted">—</span>') + '</td>' +
          '<td>' + (pa.lotes.length ? pa.lotes.map(function (l) { return '<button class="chip chip--info" data-go="#/admin/trazabilidad/' + l.id + '">' + l.id + '</button>'; }).join(' ') : '<span class="t-muted">—</span>') + '</td><td>' + ui.estado(pa.estado) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      (inc.length ? '<h4 class="adm-sub mt-24">Incidencias de la ruta</h4><div class="list mt-8">' + inc.map(function (i) { return '<div class="list-row">' + ui.iconBox('alert-triangle', 'orange', 'sm') + '<div class="grow"><div class="list-row__title">' + esc(i.tipo) + ' · ' + i.id + '</div><div class="list-row__sub">' + esc(i.descripcion) + ' · ' + ui.hace(i.fecha) + '</div></div>' + ui.estado(i.estado) + (i.estado !== 'resuelta' ? ui.btn({ label: 'Resolver', variant: 'secondary', size: 'sm', icon: 'check', action: 'resolver', attrs: ' data-id="' + i.id + '"' }) : '') + '</div>'; }).join('') + '</div>' : '') +
      '</div>';
  }
  const rutas = {
    title: 'Rutas', live: true,
    render: function (ctx) {
      const q = ctx.q;
      const todas = q.rutas(function (r) { return r.fecha >= hoy(); }).concat(q.rutas(function (r) { return r.fecha < hoy(); }).slice(-2));
      if (ctx.param && q.ruta(ctx.param)) st.ruta = ctx.param;
      if (!st.ruta || !q.ruta(st.ruta)) st.ruta = (todas.find(function (r) { return r.id_vehiculo === 'VEH-01' && r.estado !== 'completada'; }) || todas[0] || {}).id;
      const sel = q.ruta(st.ruta);
      const k = q.indicadores();
      const activas = todas.filter(function (r) { return r.estado !== 'completada'; });
      return '<div class="page-head"><div><h1 class="h1">Rutas compartidas</h1><p class="page-head__sub">Motor de rutas · capacidad crítica C2: varios productores, un solo camión.</p></div>' +
        '<div class="row gap-8">' + ui.rule('PR-8') + ui.rule('RN2') + '<span class="chip chip--neutral">' + I('route', 14) + ui.num(k.productoresPorRuta, 1) + ' productores por ruta</span><span class="chip chip--neutral">' + I('dollar', 14) + ui.money(k.costoKg) + ' / kg</span></div></div>' +
        '<div class="adm-split reveal"><div class="adm-route-list"><div class="t-over" style="margin:2px 4px 2px">' + activas.length + ' rutas activas</div>' + todas.map(function (r) { return tarjetaRuta(r, sel && r.id === sel.id); }).join('') + '</div>' +
        '<div>' + (sel ? detalleRuta(q, sel, todas) : '<div class="card">' + ui.empty({ icon: 'route', title: 'Sin rutas', text: 'Aprueba un pedido para programar una ruta.' }) + '</div>') + '</div></div>';
    },
    actions: Object.assign({}, comunes, {
      selRuta: function (ctx, el) { st.ruta = el.dataset.id; if (ctx.param) ctx.go('#/admin/rutas/' + el.dataset.id); else ctx.refresh(); },
      optimizar: async function (ctx, el) {
        try {
          const r = await ui.withLoading(el, function () { return RC.api.optimizarRuta(el.dataset.id); });
          ui.toast('Ruta ' + el.dataset.id + ' optimizada', r.antes + ' km → ' + r.despues + ' km' + (r.ahorro ? ' · ahorro de ' + r.ahorro + ' km' : ' · ya estaba en su mejor orden') + ' (vecino más cercano).', 'success', 5200);
          ctx.refresh();
        } catch (e) { ui.error(e); }
      },
      resolver: async function (ctx, el) { await ui.withLoading(el, function () { return RC.api.resolverIncidencia(el.dataset.id); }); ui.toast('Incidencia resuelta', el.dataset.id, 'success'); ctx.refresh(); }
    })
  };

  /* ======================= PÁGINA: TRAZABILIDAD ======================= */
  function buscarLote(txt) {
    const t = String(txt || '').trim().toUpperCase(); if (!t) return null;
    const ls = RC.db.state.lotes;
    const hit = ls.find(function (l) { return l.id.toUpperCase() === t || (l.qr || '').toUpperCase() === t; }) || ls.find(function (l) { return l.id.toUpperCase().indexOf(t) >= 0 || (l.qr || '').toUpperCase().indexOf(t) >= 0; });
    return hit ? hit.id : null;
  }
  function cadena(L) {
    const ped = L.pedido;
    const asg = L.asignacion;
    const nodos = [
      { icon: 'sprout', t: 'Finca', h: esc(L.productor.nombre), s: esc(L.productor.municipio) + ', ' + esc(L.productor.departamento) + '<br>Cosecha ' + ui.dia(L.oferta.fecha_cosecha), ok: true },
      { icon: 'truck', t: 'Recolección', h: L.ruta ? 'Ruta ' + L.ruta.id + ' · ' + L.ruta.vehiculo.placa : 'Ruta compartida', s: ui.cuando(L.fecha_hora_recoleccion) + '<br>' + L.temperatura_c + ' °C · calidad ' + L.grado_calidad, ok: true },
      { icon: 'warehouse', t: 'Centro de acopio', h: L.almacen ? esc(L.almacen.nombre) : 'En tránsito', s: L.fecha_hora_entrada_almacen ? 'Entrada ' + ui.cuando(L.fecha_hora_entrada_almacen) + (L.fecha_hora_salida_almacen ? '<br>Salida ' + ui.cuando(L.fecha_hora_salida_almacen) : '') : 'Pendiente de consolidar', ok: !!L.almacen },
      { icon: 'store', t: 'Comprador', h: esc(L.comprador.razon_social), s: ped.id + ' · ' + (ped.estado === 'recibido' ? (asg.kg_conformes != null ? ui.kg(asg.kg_conformes) + ' conformes' : 'Recibido') : ped.estado === 'entregado' ? 'Entregado, por confirmar' : 'En camino'), ok: ped.estado === 'recibido' || ped.estado === 'entregado' }
    ];
    return '<div class="adm-chain">' + nodos.map(function (n, i) {
      return '<div class="adm-chain__node ' + (n.ok ? 'is-ok' : '') + '" style="animation-delay:' + (i * 120) + 'ms">' + '<span class="adm-chain__icon">' + I(n.icon, 22) + '</span><span class="t-over">' + n.t + '</span><b>' + n.h + '</b><span class="t-cap">' + n.s + '</span></div>';
    }).join('<span class="adm-chain__arrow">' + I('arrow-right', 20) + '</span>') + '</div>';
  }
  function detalleLote(q, id) {
    const L = q.lote(id);
    if (!L) return '<div class="card">' + ui.empty({ icon: 'qr-code', title: 'Lote no encontrado', text: 'Verifica el código del lote o del QR.' }) + '</div>';
    const fuera = L.temperatura_c < L.producto.temp_min || L.temperatura_c > L.producto.temp_max;
    const tel = L.telemetria;
    const t0 = new Date(L.fecha_hora_recoleccion).getTime();
    const labels = tel.lecturas.map(function (_, i) { return new Date(t0 + i * 1800000).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }); });
    const fueraTel = tel.lecturas.filter(function (v) { return v < tel.min || v > tel.max; }).length;
    const ev = RC.db.state.eventos.find(function (e) { return e.tipo === 'LoteRegistrado' && e.payload && e.payload.id_lote === L.id; });
    const payload = ev ? ev.payload : { evento: 'LoteRegistrado', id_lote: L.id, id_parada: L.parada ? L.parada.id : null, kg_recolectados: L.kg_recolectados, grado_calidad: L.grado_calidad, temperatura_c: L.temperatura_c, fecha_hora: L.fecha_hora_recoleccion };
    return '<div class="card card--pad-lg">' +
      '<div class="row row--between row--wrap"><div class="row gap-16"><img class="adm-lot-img" src="' + L.producto.img + '" alt=""><div><div class="t-over">Lote de trazabilidad</div><div class="h2">' + L.id + '</div><div class="t-body">' + esc(L.producto.nombre) + ' · ' + ui.kg(L.kg_recolectados) + ' · QR ' + esc(L.qr) + '</div></div></div>' +
      '<div class="row gap-8">' + ui.chip('Calidad ' + L.grado_calidad, L.grado_calidad === 'A' ? 'success' : L.grado_calidad === 'B' ? 'info' : 'danger') + ui.chip(L.temperatura_c + ' °C', fuera ? 'danger' : 'success', { icon: 'thermometer' }) + ui.rule('RN3') + '</div></div>' +
      '<div class="mt-24">' + cadena(L) + '</div>' +
      '<div class="adm-lot-grid mt-24">' +
      '<div class="card"><div class="row row--between"><h4 class="adm-sub" style="margin:0">' + ui.rule('RN4') + ' Telemetría de temperatura (I5)</h4>' + ui.chip('Rango ' + tel.min + '–' + tel.max + ' °C', 'neutral') + '</div>' +
      ui.lineChart({ series: [{ values: tel.lecturas, color: '#2D7BD8' }], labels: labels, band: [tel.min, tel.max], height: 210, fmt: function (v) { return ui.num(v, 1) + '°'; }, label: 'Temperatura del lote' }) +
      (fueraTel ? ui.callout('alert-triangle', fueraTel + ' lectura(s) fuera del rango objetivo: se alertó al conductor y a operación (PR-10).', 'warn') : ui.callout('check-circle', 'Todas las lecturas dentro del rango de conservación del producto.')) + '</div>' +
      '<div class="card adm-qr"><div class="t-over">Código del lote</div>' + ui.qr(L.qr, 150) + '<div class="mono">' + esc(L.qr) + '</div>' + ui.btn({ label: 'Imprimir etiqueta', variant: 'outline', size: 'sm', icon: 'printer', action: 'imprimir' }) + '</div></div>' +
      '<div class="grid grid-2 mt-16">' +
      '<div class="card"><h4 class="adm-sub" style="margin-top:0">Datos del lote</h4><div class="stack gap-8 mt-8">' +
      '<div class="row row--between"><span class="t-body">Kg recolectados</span><b class="num">' + ui.kg(L.kg_recolectados) + '</b></div>' +
      '<div class="row row--between"><span class="t-body">Kg rechazados (calidad)</span><b class="num ' + (L.kg_rechazados ? 't-orange' : '') + '">' + ui.kg(L.kg_rechazados) + '</b></div>' +
      '<div class="row row--between"><span class="t-body">Kg conformes en recepción</span><b class="num">' + (L.asignacion.kg_conformes != null ? ui.kg(L.asignacion.kg_conformes) : '—') + '</b></div>' +
      '<div class="row row--between"><span class="t-body">Vida útil del producto</span><b>' + L.producto.vida_util_horas + ' h</b></div>' +
      '<div class="row row--between"><span class="t-body">Pedido · asignación</span><b>' + L.pedido.id + ' · ' + L.asignacion.id + '</b></div>' +
      '<div class="row row--between"><span class="t-body">Oferta del productor</span><b>' + L.oferta.id + '</b></div>' +
      '<div class="row row--between"><span class="t-body">Almacén</span><b>' + (L.almacen ? esc(L.almacen.nombre) : 'En tránsito') + '</b></div></div></div>' +
      '<div class="card"><div class="row row--between"><h4 class="adm-sub" style="margin:0">Evento publicado en el bus</h4>' + ui.rule('I4') + '</div><pre class="adm-code"><code>' + esc(JSON.stringify(payload, null, 2)) + '</code></pre><p class="t-cap">Las demás aplicaciones (pagos, analítica, portal del comprador) consumen este evento sin consultar directamente la base de trazabilidad.</p></div>' +
      '</div></div>';
  }
  const trazabilidad = {
    title: 'Trazabilidad', live: true,
    render: function (ctx) {
      const q = ctx.q;
      const id = (ctx.param && q.lote(ctx.param)) ? ctx.param : (q.lote('L-000418') ? 'L-000418' : (q.lotes()[0] || {}).id);
      const lotes = q.lotes().slice(0, 14);
      const k = q.indicadores();
      return '<div class="page-head"><div><h1 class="h1">Trazabilidad</h1><p class="page-head__sub">De la finca a la mesa: sigue cada lote con su QR, temperatura y recepción.</p></div>' +
        '<div class="row gap-8">' + ui.chip(ui.pct(k.trazabilidad) + ' lotes con trazabilidad completa', 'success', { icon: 'shield-check' }) + '</div></div>' +
        '<div class="adm-split adm-split--trace reveal"><div class="stack">' +
        '<form class="card" data-submit="buscarLote" style="padding:14px">' + ui.field({ name: 'lote', id: 'adm-lote-q', icon: 'qr-code', placeholder: 'Código de lote o QR (ej. L-000418)', value: '' }) + ui.btn({ label: 'Buscar lote', icon: 'search', type: 'submit', block: true, size: 'sm', cls: 'mt-8' }) + '</form>' +
        '<div class="t-over" style="margin:4px 4px 0">Lotes recientes</div><div class="list">' + lotes.map(function (l) {
          const a = RC.db.byId('asignaciones', l.id_asignacion); const of = a ? RC.db.byId('ofertas', a.id_oferta) : null; const p = of ? q.producto(of.id_producto) : null;
          return '<button class="adm-lot ' + (l.id === id ? 'is-active' : '') + '" data-go="#/admin/trazabilidad/' + l.id + '"><img src="' + (p ? p.img : '') + '" alt=""><span class="grow"><b>' + l.id + '</b><span class="t-cap" style="display:block">' + (p ? esc(p.nombre) : '') + ' · ' + ui.kg(l.kg_recolectados) + ' · ' + ui.dia(l.fecha_hora_recoleccion) + '</span></span><span class="t-cap num">' + l.temperatura_c + '°</span></button>';
        }).join('') + '</div></div>' +
        '<div>' + (id ? detalleLote(q, id) : '<div class="card">' + ui.empty({ icon: 'qr-code', title: 'Sin lotes', text: 'Aún no hay lotes registrados.' }) + '</div>') + '</div></div>';
    },
    actions: {
      buscarLote: function (ctx, form) {
        const v = form.querySelector('[name=lote]').value;
        const id = buscarLote(v);
        if (!id) { ui.toast('Lote no encontrado', 'No hay lotes con el código "' + esc(v) + '".', 'warning'); form.querySelector('.control').classList.add('is-invalid'); return; }
        ctx.go('#/admin/trazabilidad/' + id);
      },
      imprimir: function () { ui.toast('Etiqueta enviada a impresión', 'Etiqueta QR del lote lista para el empaque.', 'info'); }
    }
  };

  /* ======================= PÁGINA: PRODUCTORES (PR-1 · PR-2) ======================= */
  function productoresFiltrados() {
    const t = st.prodQ.trim().toLowerCase();
    return RC.db.state.productores.filter(function (p) {
      if (st.prodDep && p.departamento !== st.prodDep) return false;
      if (st.prodEst && p.estado !== st.prodEst) return false;
      return !t || (p.id + ' ' + p.nombre + ' ' + p.contacto + ' ' + p.municipio).toLowerCase().indexOf(t) >= 0;
    });
  }
  function resultadosProductores() {
    const lista = productoresFiltrados();
    const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
    if (st.prodPag > paginas) st.prodPag = paginas;
    const pag = lista.slice((st.prodPag - 1) * POR_PAGINA, st.prodPag * POR_PAGINA);
    const tonoMarca = { activo: 'green', en_evaluacion: 'orange', pendiente: 'navy', plan_mejora: 'orange' };
    const mapa = ui.map({ markers: lista.map(function (p) { return { lat: p.latitud, lng: p.longitud, label: p.nombre + ' · ' + p.municipio, tone: tonoMarca[p.estado] }; }), fit: 'region', height: 330, aspect: 1.05, legend: '<div class="map__legend"><span class="row gap-4"><i class="adm-dot" style="background:#2F8F3A"></i>Activo</span><span class="row gap-4"><i class="adm-dot" style="background:#F39324"></i>Evaluación</span><span class="row gap-4"><i class="adm-dot" style="background:#17375E"></i>Pendiente</span></div>' });
    const tabla = lista.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Productor</th><th>Tipo</th><th>Ubicación</th><th>Productos</th><th class="t-right">Ha</th><th>Vinculación</th><th>Estado</th><th class="t-right">Acción</th></tr></thead><tbody>' +
      pag.map(function (p) {
        let acc = '';
        if (p.estado === 'en_evaluacion' || p.estado === 'plan_mejora') acc = ui.btn({ label: p.estado === 'plan_mejora' ? 'Reevaluar' : 'Evaluar', variant: 'warning', size: 'xs', icon: 'file-text', action: 'evaluar', attrs: ' data-id="' + p.id + '"' });
        else if (p.estado === 'pendiente') acc = ui.btn({ label: 'Activar', size: 'xs', icon: 'check', action: 'activar', attrs: ' data-id="' + p.id + '"' });
        else acc = '<span class="t-cap">' + I('phone', 13) + ' ' + esc(p.telefono) + '</span>';
        return '<tr><td><div class="adm-person"><span class="avatar" style="width:34px;height:34px;font-size:12px">' + ui.iniciales(p.nombre) + '</span><div><div class="t-strong">' + esc(p.nombre) + '</div><div class="t-cap">' + p.id + ' · ' + esc(p.contacto) + '</div></div></div></td>' +
          '<td>' + esc(p.tipo) + '</td><td>' + esc(p.municipio) + '<div class="t-cap">' + esc(p.departamento) + '</div></td><td>' + productoTxt(p.productos) + '</td><td class="t-right num">' + (p.hectareas || '—') + '</td><td>' + ui.fecha(p.fecha_vinculacion, { day: 'numeric', month: 'short', year: 'numeric' }) + '</td><td>' + ui.estado(p.estado, 'productor') + '</td><td class="t-right">' + acc + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="pager"><span>' + lista.length + ' productor(es) · página ' + st.prodPag + ' de ' + paginas + '</span><span class="row gap-8">' +
      ui.btn({ label: 'Anterior', variant: 'outline', size: 'xs', icon: 'chevron-left', action: 'prodPag', attrs: ' data-d="-1"', disabled: st.prodPag <= 1 }) + ui.btn({ label: 'Siguiente', variant: 'outline', size: 'xs', iconRight: 'chevron-right', action: 'prodPag', attrs: ' data-d="1"', disabled: st.prodPag >= paginas }) + '</span></div>'
      : '<div class="card">' + ui.empty({ icon: 'users', title: 'Sin resultados', text: 'Ningún productor coincide con los filtros.' }) + '</div>';
    return '<div class="adm-split adm-split--prod"><div>' + tabla + '</div><div class="card" style="padding:14px"><div class="t-over" style="margin:0 4px 10px">Red de productores en el mapa</div>' + mapa + '</div></div>';
  }
  function abrirEvaluacion(ctx, id) {
    const p = RC.api.q.productor(id);
    const req = ['Documentos de identidad y RUT válidos', 'Visita a la finca satisfactoria', 'Capacidad de producción verificada', 'Calidad del producto aceptable', 'Zona alcanzable por las rutas compartidas'];
    ui.modal({
      title: 'Evaluar productor (PR-1)', icon: 'file-text', tone: 'orange',
      body: '<div class="row gap-16"><span class="avatar" style="width:52px;height:52px;font-size:16px">' + ui.iniciales(p.nombre) + '</span><div><div class="h3">' + esc(p.nombre) + '</div><div class="t-body">' + esc(p.contacto) + ' · ' + esc(p.municipio) + ', ' + esc(p.departamento) + ' · ' + productoTxt(p.productos) + '</div></div></div>' +
        '<h4 class="adm-sub mt-16">¿Cumple los requisitos?</h4><div class="stack gap-8 mt-8">' + req.map(function (r, i) { return '<label class="check adm-check"><input type="checkbox" ' + (i < 4 ? 'checked' : '') + '> ' + r + '</label>'; }).join('') + '</div>' +
        '<div class="mt-16">' + ui.callout('info', 'Si cumple, queda como <b>candidato aprobado</b> y pasa a activación (PR-2). Si no, recibe un <b>plan de mejora</b>.', 'info') + '</div>',
      foot: ui.btn({ label: 'Plan de mejora', variant: 'warning', icon: 'file-text', attrs: ' data-ev="0"' }) + ui.btn({ label: 'Aprobar candidato', icon: 'check-circle', attrs: ' data-ev="1"' }),
      onMount: function (c) {
        c.root.querySelectorAll('[data-ev]').forEach(function (b) {
          b.onclick = async function () {
            const ok = b.dataset.ev === '1';
            const todos = Array.prototype.every.call(c.root.querySelectorAll('.adm-check input'), function (x) { return x.checked; });
            if (ok && !todos) { ui.toast('Faltan requisitos', 'Marca todos los requisitos para aprobar al candidato (compuerta PR-1).', 'warning'); return; }
            try {
              await ui.withLoading(b, function () { return RC.api.evaluarProductor(id, ok); });
              ui.toast(ok ? 'Candidato aprobado' : 'Plan de mejora asignado', ok ? p.nombre + ' queda listo para activación (PR-2).' : p.nombre + ' recibirá acompañamiento técnico.', ok ? 'success' : 'warning');
              c.close(); ctx.refresh();
            } catch (e) { ui.error(e); }
          };
        });
      }
    });
  }
  const productores = {
    title: 'Productores', live: true,
    render: function (ctx) {
      const ps = RC.db.state.productores;
      const n = function (e) { return ps.filter(function (p) { return p.estado === e; }).length; };
      return '<div class="page-head"><div><h1 class="h1">Red de productores</h1><p class="page-head__sub">Evalúa, vincula y activa agricultores y pescadores artesanales del Caribe.</p></div><div class="row gap-8">' + ui.rule('PR-1') + ui.rule('PR-2') + ui.rule('RN6') + '</div></div>' +
        '<div class="reveal stack" style="gap:18px"><div class="grid grid-4">' +
        ui.kpi({ icon: 'users', label: 'Total en la red', count: ps.length, compact: true }) +
        ui.kpi({ icon: 'check-circle', label: 'Activos', count: n('activo'), compact: true }) +
        ui.kpi({ icon: 'file-text', label: 'En evaluación', count: n('en_evaluacion') + n('plan_mejora'), tone: 'orange', compact: true }) +
        ui.kpi({ icon: 'clock', label: 'Pendientes de activar', count: n('pendiente'), tone: 'blue', compact: true }) + '</div>' +
        '<div class="adm-filters"><div class="adm-search">' + ui.field({ name: 'q', id: 'adm-prod-q', icon: 'search', value: st.prodQ, placeholder: 'Buscar por nombre, contacto o municipio', attrs: ' data-oninput="prodBuscar"' }) + '</div>' +
        '<div class="adm-sel">' + ui.field({ name: 'dep', id: 'adm-prod-dep', icon: 'map-pin', value: st.prodDep, options: [{ value: '', label: 'Todos los departamentos' }, 'Atlántico', 'Magdalena', 'Bolívar'], attrs: ' data-onchange="prodDep"' }) + '</div>' +
        '<div class="adm-sel">' + ui.field({ name: 'est', id: 'adm-prod-est', icon: 'filter', value: st.prodEst, options: [{ value: '', label: 'Todos los estados' }, { value: 'activo', label: 'Activos' }, { value: 'en_evaluacion', label: 'En evaluación' }, { value: 'pendiente', label: 'Pendientes de activar' }, { value: 'plan_mejora', label: 'Plan de mejora' }], attrs: ' data-onchange="prodEst"' }) + '</div></div>' +
        '<div data-prod-res>' + resultadosProductores() + '</div></div>';
    },
    actions: {
      prodBuscar: function (ctx, el) { st.prodQ = el.value; st.prodPag = 1; const box = ctx.el.querySelector('[data-prod-res]'); box.innerHTML = resultadosProductores(); ui.enhance(box); },
      prodDep: function (ctx, el) { st.prodDep = el.value; st.prodPag = 1; ctx.refresh(); },
      prodEst: function (ctx, el) { st.prodEst = el.value; st.prodPag = 1; ctx.refresh(); },
      prodPag: function (ctx, el) { st.prodPag += parseInt(el.dataset.d, 10); const box = ctx.el.querySelector('[data-prod-res]'); box.innerHTML = resultadosProductores(); ui.enhance(box); },
      evaluar: function (ctx, el) { abrirEvaluacion(ctx, el.dataset.id); },
      activar: async function (ctx, el) {
        const p = RC.api.q.productor(el.dataset.id);
        const ok = await ui.confirm({ title: 'Activar productor (PR-2)', text: 'Se creará el usuario de <b>' + esc(p.nombre) + '</b> en la app del productor y podrá publicar ofertas (RN6). ¿Continuar?', ok: 'Activar', okIcon: 'check', icon: 'users' });
        if (!ok) return;
        try { await RC.api.activarProductor(p.id); ui.toast('Productor activado', p.nombre + ' ya puede publicar cosechas.', 'success'); } catch (e) { ui.error(e); }
        ctx.refresh();
      }
    }
  };

  /* ======================= PÁGINA: COMPRADORES (PR-3) ======================= */
  const compradores = {
    title: 'Compradores', live: true,
    render: function (ctx) {
      const q = ctx.q;
      const peds = RC.db.state.pedidos;
      const datos = RC.db.state.compradores.map(function (c) {
        const mios = peds.filter(function (p) { return p.id_comprador === c.id; });
        const valor = mios.filter(function (p) { return ['aprobado', 'en_ruta', 'entregado', 'recibido'].indexOf(p.estado) >= 0; }).reduce(function (t, p) { return t + p.cantidad_kg * p.precio_kg_acordado; }, 0);
        const kg = mios.filter(function (p) { return p.estado === 'recibido'; }).reduce(function (t, p) { return t + p.cantidad_kg; }, 0);
        return { c: c, pedidos: mios.length, activos: mios.filter(function (p) { return ['pendiente', 'aprobado', 'en_ruta', 'entregado'].indexOf(p.estado) >= 0; }).length, valor: valor, kg: kg };
      }).sort(function (a, b) { return b.valor - a.valor; });
      const max = Math.max.apply(null, datos.map(function (d) { return d.valor; })) || 1;
      const total = datos.reduce(function (t, d) { return t + d.valor; }, 0);
      const tipos = {}; datos.forEach(function (d) { tipos[d.c.tipo_comprador] = (tipos[d.c.tipo_comprador] || 0) + 1; });
      return '<div class="page-head"><div><h1 class="h1">Compradores institucionales</h1><p class="page-head__sub">Supermercados, restaurantes, hoteles y exportadores vinculados (relación B2B · C7).</p></div><div class="row gap-8">' + ui.rule('PR-3') + ui.rule('RN6') + '</div></div>' +
        '<div class="reveal stack" style="gap:18px"><div class="grid grid-4">' +
        ui.kpi({ icon: 'handshake', label: 'Compradores activos', count: q.indicadores().compradoresActivos, compact: true }) +
        ui.kpi({ icon: 'dollar', label: 'Valor comprado', count: total, format: 'money', compact: true }) +
        ui.kpi({ icon: 'store', label: 'Tipos de comprador', value: Object.keys(tipos).length, compact: true }) +
        ui.kpi({ icon: 'clock', label: 'En evaluación', count: RC.db.state.compradores.filter(function (c) { return c.estado !== 'activo'; }).length, tone: 'orange', compact: true }) + '</div>' +
        '<div class="adm-split adm-split--buy"><div class="table-wrap"><table class="table"><thead><tr><th>Comprador</th><th>Tipo</th><th>Municipio</th><th>Contacto</th><th class="t-right">Pedidos</th><th class="t-right">Valor</th><th>Estado</th><th class="t-right"></th></tr></thead><tbody>' +
        datos.map(function (d) {
          const c = d.c;
          return '<tr><td><div class="adm-person"><span class="avatar" style="width:34px;height:34px;font-size:12px;background:var(--b100);color:var(--b600)">' + ui.iniciales(c.razon_social) + '</span><div><div class="t-strong">' + esc(c.razon_social) + '</div><div class="t-cap">' + c.id + ' · NIT ' + esc(c.nit) + '</div></div></div></td>' +
            '<td>' + esc(c.tipo_comprador) + '</td><td>' + esc(c.municipio) + '<div class="t-cap">' + esc(c.departamento) + '</div></td><td class="t-cap">' + esc(c.contacto || '') + '</td><td class="t-right num">' + d.pedidos + (d.activos ? '<div class="t-cap">' + d.activos + ' activos</div>' : '') + '</td><td class="t-right num t-strong">' + ui.money(d.valor) + '</td><td>' + ui.estado(c.estado) + '</td>' +
            '<td class="t-right">' + (c.estado !== 'activo' ? ui.btn({ label: 'Vincular', size: 'xs', icon: 'check', action: 'activarComprador', attrs: ' data-id="' + c.id + '"' }) : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<div class="card">' + ui.cardTitle('chart', 'Participación en compras') + '<div class="stack gap-16">' + datos.filter(function (d) { return d.valor; }).map(function (d) { return '<div><div class="row row--between t-cap"><b class="t-strong" style="font-size:13.5px">' + esc(d.c.razon_social) + '</b><span class="num">' + ui.pct(d.valor / (total || 1)) + '</span></div>' + ui.progress(d.valor / max) + '</div>'; }).join('') + '</div></div></div></div>';
    },
    actions: {
      activarComprador: async function (ctx, el) {
        const c = RC.api.q.comprador(el.dataset.id);
        const ok = await ui.confirm({ title: 'Vincular comprador (PR-3)', text: 'Se verificó el NIT <b>' + esc(c.nit) + '</b> y las referencias comerciales de <b>' + esc(c.razon_social) + '</b>. Al aprobar podrá hacer pedidos en el portal B2B.', ok: 'Aprobar y vincular', okIcon: 'check', icon: 'handshake' });
        if (!ok) return;
        try { await RC.api.activarComprador(c.id); ui.toast('Comprador vinculado', c.razon_social + ' ya puede registrar pedidos.', 'success'); } catch (e) { ui.error(e); }
        ctx.refresh();
      }
    }
  };

  /* ======================= PÁGINA: INDICADORES (PR-13) ======================= */
  function conformidad() {
    const liq = RC.db.state.asignaciones.filter(function (a) { return a.kg_conformes != null; });
    return liq.length ? liq.filter(function (a) { return !a.motivo_no_conformidad; }).length / liq.length : 1;
  }
  const indicadores = {
    title: 'Indicadores de impacto', live: true,
    render: function (ctx) {
      const q = ctx.q, k = q.indicadores();
      const serie = q.serieRecoleccion();
      const conf = conformidad();
      const totalKg14 = serie.reduce(function (t, s) { return t + s.kg; }, 0);
      const OE = [
        ['OE1', 'Ampliar la red de productores y compradores', 'Productores y compradores activos', k.productoresActivos + ' · ' + k.compradoresActivos, '≥ 60 · ≥ 6', k.productoresActivos >= 60 && k.compradoresActivos >= 6],
        ['OE2', 'Reducir las pérdidas poscosecha', '% pérdidas = (rechazados + no conformes) / recolectados', ui.pct(k.perdidas, 1), '< 5 %', k.perdidas < 0.05],
        ['OE3', 'Aumentar el ingreso de los productores', 'Ingreso neto promedio por productor', ui.money(k.ingresoPromedio), '≥ $ 5.000.000', k.ingresoPromedio >= 5000000],
        ['OE4', 'Fortalecer trazabilidad y confianza', '% lotes trazables · % recepciones conformes', ui.pct(k.trazabilidad) + ' · ' + ui.pct(conf), '100 % · ≥ 90 %', k.trazabilidad >= 0.99 && conf >= 0.9],
        ['OE5', 'Optimizar la eficiencia logística', 'Costo/kg · productores por ruta · entregas a tiempo', ui.money(k.costoKg) + ' · ' + ui.num(k.productoresPorRuta, 1) + ' · ' + ui.pct(k.aTiempo), '≤ $ 300 · ≥ 2,5 · ≥ 95 %', k.costoKg <= 300 && k.productoresPorRuta >= 2.5 && k.aTiempo >= 0.95]
      ];
      return '<div class="page-head"><div><h1 class="h1">Indicadores de impacto</h1><p class="page-head__sub">Calculados con vistas sobre los datos transaccionales (no se almacenan): pérdidas, ingreso, logística y trazabilidad.</p></div>' +
        '<div class="row gap-8">' + ui.rule('PR-13') + ui.btn({ label: 'Pagos a productores', variant: 'outline', size: 'sm', icon: 'wallet', go: '#/admin/pagos' }) + ui.btn({ label: 'Bitácora de eventos', variant: 'outline', size: 'sm', icon: 'activity', go: '#/admin/eventos' }) + '</div></div>' +
        '<div class="reveal stack" style="gap:20px"><div class="grid grid-3">' +
        ui.kpi({ icon: 'leaf', label: 'Pérdidas poscosecha', count: k.perdidas, format: 'pct1', foot: 'Meta OE2 < 5 % · antes 20–40 %', footTone: k.perdidas < 0.05 ? 'up' : 'down' }) +
        ui.kpi({ icon: 'wallet', label: 'Ingreso neto promedio por productor', count: k.ingresoPromedio, format: 'money', foot: ui.money(k.ingresoTotal) + ' pagados en total', footTone: 'up' }) +
        ui.kpi({ icon: 'truck', label: 'Costo logístico por kg', count: k.costoKg, format: 'money', tone: 'orange', foot: 'Rutas compartidas · OE5' }) +
        ui.kpi({ icon: 'users', label: 'Productores por ruta', count: k.productoresPorRuta, format: 'dec', foot: 'Capacidad crítica C2' }) +
        ui.kpi({ icon: 'check-circle', label: 'Entregas a tiempo', count: k.aTiempo, format: 'pct', foot: 'Meta ≥ 95 %', footTone: k.aTiempo >= 0.95 ? 'up' : 'down' }) +
        ui.kpi({ icon: 'shield-check', label: 'Lotes con trazabilidad completa', count: k.trazabilidad, format: 'pct', foot: ui.pct(conf) + ' recepciones conformes', footTone: 'up' }) + '</div>' +
        '<div class="adm-dash"><div class="card">' + ui.cardTitle('chart', 'Kilos recolectados · últimos 14 días', '<span class="chip chip--success">' + ui.kg(totalKg14) + '</span>') +
        ui.barChart({ values: serie.map(function (s) { return s.kg; }), labels: serie.map(function (s) { return String(+s.fecha.slice(8, 10)); }), height: 220, fmt: function (v) { return ui.kg(v); }, label: 'Kilos recolectados por día' }) + '</div>' +
        '<div class="card">' + ui.cardTitle('flag', 'Objetivos estratégicos') + '<div class="adm-oe">' + OE.map(function (o) {
          return '<div class="adm-oe__row"><span class="tag-rule">' + o[0] + '</span><div class="grow"><div class="t-strong" style="font-size:14px">' + o[1] + '</div><div class="t-cap">' + o[2] + '</div></div><div class="t-right"><div class="t-strong num">' + o[3] + '</div><div class="t-cap">Meta ' + o[4] + '</div></div>' + ui.chip(o[5] ? 'Cumple' : 'En progreso', o[5] ? 'success' : 'warning') + '</div>';
        }).join('') + '</div></div></div>' +
        '<div><div class="row row--between" style="margin:4px 2px 12px"><h3 class="h3">Precios de referencia por producto (PR-4)</h3><span class="t-cap">Fuente: SIPSA · referencia mayorista semanal</span></div>' +
        '<div class="adm-prices">' + RC.db.state.productos.map(function (p) {
          const h = q.historialPrecios(p.id); const v = h.map(function (x) { return x.precio_kg; });
          const ult = v[v.length - 1], prev = v[v.length - 2] || ult, varr = (ult - prev) / prev;
          return '<div class="card adm-price"><div class="row"><img src="' + p.img + '" alt=""><div class="grow"><div class="t-strong">' + esc(p.nombre) + '</div><div class="t-cap">' + ui.money(ult) + ' / kg</div></div><span class="trend ' + (varr > 0 ? 'up' : 'down') + '">' + I(varr > 0 ? 'trending-up' : 'chart', 13) + ui.pct(Math.abs(varr), 1) + '</span></div>' +
            ui.lineChart({ series: [{ values: v, color: '#2F8F3A' }], labels: h.map(function (x) { return ui.fecha(x.fecha, { day: 'numeric', month: 'numeric' }); }), height: 150, fmt: function (n) { return '$' + ui.num(n / 1000, 1) + 'k'; }, label: 'Precio de ' + p.nombre }) + '</div>';
        }).join('') + '</div></div></div>';
    }
  };

  /* ======================= PÁGINA: PAGOS (PR-12 · RN5) ======================= */
  function pagosEnriquecidos() {
    const q = RC.api.q;
    return RC.db.state.pagos.map(function (pg) {
      const a = RC.db.byId('asignaciones', pg.id_asignacion); if (!a) return null;
      const of = RC.db.byId('ofertas', a.id_oferta); const ped = RC.db.byId('pedidos', a.id_pedido);
      return { pg: pg, a: a, pr: q.productor(of.id_productor), ped: ped, prod: q.producto(of.id_producto) };
    }).filter(Boolean).sort(function (x, y) { return x.pg.fecha < y.pg.fecha ? 1 : x.pg.fecha > y.pg.fecha ? -1 : (x.pg.id < y.pg.id ? 1 : -1); });
  }
  const pagos = {
    title: 'Pagos a productores', live: true,
    render: function () {
      const todos = pagosEnriquecidos();
      const f = st.pagos;
      const lista = todos.filter(function (x) { return f === 'todos' || (f === 'pendiente' ? (x.pg.estado === 'pendiente' || x.pg.estado === 'procesando') : x.pg.estado === f); });
      const pagados = todos.filter(function (x) { return x.pg.estado === 'pagado'; });
      const sum = function (arr, k) { return arr.reduce(function (t, x) { return t + x.pg[k]; }, 0); };
      const cnt = function (e) { return todos.filter(function (x) { return e === 'pendiente' ? (x.pg.estado === 'pendiente' || x.pg.estado === 'procesando') : x.pg.estado === e; }).length; };
      return '<div class="page-head"><div><h1 class="h1">Liquidación y pagos</h1><p class="page-head__sub">Se paga lo recibido y conforme: el ingreso llega justo y a tiempo al productor.</p></div><div class="row gap-8">' + ui.rule('PR-12') + ui.rule('RN5') + ui.btn({ label: 'Indicadores', variant: 'outline', size: 'sm', icon: 'chart', go: '#/admin/indicadores' }) + '</div></div>' +
        '<div class="reveal stack" style="gap:18px"><div class="grid grid-4">' +
        ui.kpi({ icon: 'dollar', label: 'Valor bruto liquidado', count: sum(todos, 'valor_bruto'), format: 'money', compact: true }) +
        ui.kpi({ icon: 'percent', label: 'Comisión RaízCaribe (8 %)', count: sum(todos, 'comision'), format: 'money', compact: true, tone: 'orange' }) +
        ui.kpi({ icon: 'wallet', label: 'Neto pagado a productores', count: sum(pagados, 'neto'), format: 'money', compact: true }) +
        ui.kpi({ icon: 'clock', label: 'Pendientes o fallidos', count: cnt('pendiente') + cnt('fallido'), compact: true, tone: 'blue' }) + '</div>' +
        ui.callout('info', '<b>RN5 · Pago = kg conformes × precio acordado − comisión.</b> La recepción conforme del comprador (PR-11, evento EntregaConfirmada · I6) dispara la liquidación y la orden de transferencia a la pasarela (I7).', 'info') +
        '<div class="seg adm-seg">' + [['todos', 'Todos'], ['pagado', 'Pagados'], ['pendiente', 'Pendientes'], ['fallido', 'Fallidos']].map(function (x) { return '<button class="' + (f === x[0] ? 'is-active' : '') + '" data-action="pagFiltro" data-v="' + x[0] + '">' + x[1] + ' <span class="adm-seg__n">' + (x[0] === 'todos' ? todos.length : cnt(x[0])) + '</span></button>'; }).join('') + '</div>' +
        (lista.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Pago</th><th>Productor</th><th>Pedido</th><th class="t-right">Kg conformes</th><th class="t-right">Bruto</th><th class="t-right">Comisión</th><th class="t-right">Neto</th><th>Fecha</th><th>Estado</th><th class="t-right"></th></tr></thead><tbody>' +
          lista.map(function (x) {
            const pg = x.pg;
            return '<tr><td><div class="t-strong">' + pg.id + '</div><div class="t-cap mono">' + (pg.referencia || '—') + '</div></td><td><div class="t-strong">' + esc(x.pr.nombre) + '</div><div class="t-cap">' + esc(x.pr.municipio) + '</div></td>' +
              '<td>' + x.ped.id + '<div class="t-cap">' + esc(x.prod.nombre) + ' · ' + ui.money(x.ped.precio_kg_acordado) + '/kg</div></td><td class="t-right num">' + ui.kg(x.a.kg_conformes || 0) + '</td><td class="t-right num">' + ui.money(pg.valor_bruto) + '</td><td class="t-right num t-orange">− ' + ui.money(pg.comision) + '</td><td class="t-right num t-strong">' + ui.money(pg.neto) + '</td>' +
              '<td>' + ui.dia(pg.fecha) + '</td><td>' + ui.estado(pg.estado) + '</td><td class="t-right">' + (pg.estado === 'fallido' ? ui.btn({ label: 'Reintentar', variant: 'warning', size: 'xs', icon: 'refresh', action: 'reintentar', attrs: ' data-id="' + pg.id + '"' }) : pg.estado === 'pendiente' ? ui.btn({ label: 'Pagar', size: 'xs', icon: 'send', action: 'reintentar', attrs: ' data-id="' + pg.id + '"' }) : '') + '</td></tr>';
          }).join('') + '</tbody></table></div>' : '<div class="card">' + ui.empty({ icon: 'wallet', title: 'Sin pagos en este estado' }) + '</div>') + '</div>';
    },
    actions: {
      pagFiltro: function (ctx, el) { st.pagos = el.dataset.v; ctx.refresh(); },
      reintentar: async function (ctx, el) {
        try { const pg = await ui.withLoading(el, function () { return RC.api.reintentarPago(el.dataset.id); }); ui.toast('Transferencia exitosa', pg.id + ' · ' + ui.money(pg.neto) + ' · ref. ' + pg.referencia, 'success'); } catch (e) { ui.error(e); }
        ctx.refresh();
      }
    }
  };

  /* ======================= PÁGINA: BITÁCORA DEL BUS DE EVENTOS ======================= */
  const eventos = {
    title: 'Bitácora de eventos', live: true,
    render: function (ctx) {
      const all = ctx.q.eventos(250);
      const tipos = Array.from(new Set(all.map(function (e) { return e.tipo; }))).sort();
      const lista = all.filter(function (e) { return st.ev === 'todos' || e.tipo === st.ev; }).slice(0, 60);
      return '<div class="page-head"><div><h1 class="h1">Bus de eventos</h1><p class="page-head__sub">Integración asíncrona entre aplicaciones núcleo: cada hecho del negocio dispara trabajo en otra aplicación.</p></div>' +
        '<div class="row gap-8">' + ui.rule('I1–I8') + '<div class="adm-sel">' + ui.field({ name: 'tipo', id: 'adm-ev-tipo', icon: 'filter', value: st.ev, options: [{ value: 'todos', label: 'Todos los eventos' }].concat(tipos.map(function (t) { return { value: t, label: t }; })), attrs: ' data-onchange="evTipo"' }) + '</div></div></div>' +
        '<div class="card reveal">' + (lista.length ? '<div class="adm-feed adm-feed--full">' + lista.map(function (e) {
          return '<details class="adm-evd">' + '<summary>' + eventoHtml(e) + '<span class="mono t-cap">' + e.id + '</span></summary><pre class="adm-code"><code>' + esc(JSON.stringify(Object.assign({ evento: e.tipo }, e.payload), null, 2)) + '</code></pre></details>';
        }).join('') + '</div>' : ui.empty({ icon: 'activity', title: 'Sin eventos' })) + '</div>';
    },
    actions: { evTipo: function (ctx, el) { st.ev = el.value; ctx.refresh(); } }
  };

  /* ======================= REGISTRO DEL MÓDULO ======================= */
  RC.views.admin = {
    role: 'admin', home: 'inicio',
    nav: [
      { key: 'inicio', icon: 'home', label: 'Inicio' },
      { key: 'productores', icon: 'users', label: 'Productores' },
      { key: 'compradores', icon: 'handshake', label: 'Compradores' },
      { key: 'pedidos', icon: 'package', label: 'Pedidos', count: function (q) { return q.indicadores().pendientes; } },
      { key: 'rutas', icon: 'truck', label: 'Rutas' },
      { key: 'trazabilidad', icon: 'leaf', label: 'Trazabilidad' },
      { key: 'indicadores', icon: 'chart', label: 'Indicadores' }
    ],
    navAlias: { pagos: 'indicadores', eventos: 'indicadores' },
    pages: { inicio: inicio, pedidos: pedidos, rutas: rutas, trazabilidad: trazabilidad, productores: productores, compradores: compradores, indicadores: indicadores, pagos: pagos, eventos: eventos },
    /* expuesto para pruebas */
    _test: { simularAsignacion: simularAsignacion, buscarLote: buscarLote, stopsRuta: stopsRuta, progresoRuta: progresoRuta, conformidad: conformidad, pagosEnriquecidos: pagosEnriquecidos, detallePedido: detallePedido, pieDetalle: pieDetalle, resultadoAprobacion: resultadoAprobacion, detalleLote: detalleLote, st: st }
  };
})();
