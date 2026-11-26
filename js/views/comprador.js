/* =========================================================================
   RaízCaribe · Portal del comprador B2B (canal web)
   Procesos: PR-3 (vinculación), PR-6 (registrar pedido), PR-7 (asignación),
   PR-11 (recepción conforme) · Entidades: PEDIDO, ASIGNACION, LOTE
   ========================================================================= */
window.RC = window.RC || {};
RC.views = RC.views || {};

(function () {
  const I = RC.icon, ui = RC.ui;
  const CID = 'CMP-01';
  const PASO_KG = 250, KG_INICIAL = 500;
  const F = { texto: '', cat: 'Todos', dep: 'Todos', orden: 'relevancia', abierto: false };
  const ETAPAS = ['Recibido', 'En preparación', 'En ruta', 'Entregado'];

  /* ---------- utilidades de la vista ---------- */
  const q = function () { return RC.api.q; };
  function pedidosActivos() { return q().pedidos(function (p) { return p.id_comprador === CID && ['pendiente', 'aprobado', 'en_ruta', 'entregado'].indexOf(p.estado) >= 0; }); }
  function porConfirmar() { return q().pedidos(function (p) { return p.id_comprador === CID && p.estado === 'entregado'; }); }
  function tendencia(v) { if (Math.abs(v) < 0.005) return '<span class="trend">=</span>'; return '<span class="trend ' + (v > 0 ? 'up' : 'down') + '">' + (v > 0 ? '▲' : '▼') + ' ' + Math.abs(v * 100).toFixed(1).replace('.', ',') + ' %</span>'; }
  function stepperPedido(p, detalle) {
    const sub = detalle ? [ui.cuando(p.creado), p.etapa >= 1 ? 'Asignado' : 'Por aprobar', p.ruta ? 'Ruta ' + p.ruta.id : '', p.fecha_entrega ? ui.dia(p.fecha_entrega) : 'Requerido ' + ui.dia(p.fecha_requerida)] : [];
    return ui.stepper(ETAPAS.map(function (l, i) { return { label: l, sub: sub[i] ? '<span class="t-cap">' + sub[i] + '</span>' : '' }; }), p.estado === 'recibido' ? 4 : p.etapa, { allDone: p.estado === 'recibido' });
  }
  function puntosRuta(ruta) {
    if (!ruta) return null;
    const r = q().ruta(ruta.id);
    const stops = r.paradas.map(function (pa) { return { lat: pa.productor.latitud, lng: pa.productor.longitud, label: pa.productor.municipio, state: pa.estado === 'recogido' ? 'done' : pa.estado === 'en_curso' ? 'current' : 'pending' }; });
    const alm = r.destinoAlmacen;
    stops.push({ lat: alm.latitud, lng: alm.longitud, label: alm.nombre.replace('Centro de acopio ', 'Acopio '), state: 'dest' });
    const prog = r.estado === 'completada' ? 1 : Math.min(0.97, (r.hechas + (r.estado === 'en_curso' ? 0.5 : 0)) / (stops.length - 1));
    return { ruta: r, stops: stops, progress: r.estado === 'programada' ? 0 : prog };
  }
  /* Vuelo de la imagen del producto hacia el resumen del pedido */
  function volar(src, rect, target) {
    if (!target || !document.body.animate) return;
    const c = document.createElement('img'); c.src = src; c.className = 'fly';
    Object.assign(c.style, { left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px' });
    document.body.appendChild(c);
    const b = target.getBoundingClientRect();
    const dx = b.left + b.width / 2 - (rect.left + rect.width / 2), dy = b.top + 40 - (rect.top + rect.height / 2);
    c.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: 'translate(' + dx * 0.5 + 'px,' + (dy * 0.5 - 110) + 'px) scale(.7) rotate(-8deg)', offset: 0.5 }, { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.2) rotate(12deg)', opacity: 0.3 }], { duration: 800, easing: 'cubic-bezier(.5,0,.4,1)' }).onfinish = function () {
      c.remove();
      const t = document.querySelector('[data-summary]');
      if (t) t.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.025)' }, { transform: 'scale(1)' }], { duration: 380, easing: 'ease-out' });
    };
  }

  /* ---------- tarjeta "Mi pedido" (seguimiento resumido, como el mockup) ---------- */
  function tarjetaMiPedido() {
    const act = pedidosActivos();
    const p = porConfirmar()[0] || act.find(function (x) { return x.estado === 'en_ruta'; }) || act[0];
    if (!p) return '';
    return '<div class="card cmp-track">' +
      '<div class="cmp-track__head">' + ui.iconBox('truck', null, 'lg') + '<div><div class="h3">Mi pedido</div><div class="t-cap">' + p.id + ' · ' + p.producto.nombre + ' ' + ui.kg(p.cantidad_kg) + '</div></div></div>' +
      '<span class="vr"></span><div class="grow">' + stepperPedido(p) + '</div>' +
      '<a class="link" href="#/comprador/seguimiento/' + p.id + '">Ver seguimiento' + I('chevron-right', 16) + '</a></div>';
  }

  /* ---------- resumen del pedido (carrito) ---------- */
  function resumen(cart, compacto) {
    const items = cart.items.map(function (it) {
      return '<div class="cart-item"><span class="cart-item__img" style="background-image:url(' + it.producto.img + ')"></span>' +
        '<div class="grow"><div class="cart-item__name">' + it.producto.nombre + '</div><div class="cart-item__kg num">' + ui.kg(it.kg) + ' · ' + ui.money(it.precio) + '/kg</div>' +
        (it.kg > it.disponible ? '<div class="t-cap t-red">Solo ' + ui.kg(it.disponible) + ' disponibles</div>' : '') + '</div>' +
        '<button class="cart-item__x" data-action="quitar" data-pid="' + it.id_producto + '" aria-label="Quitar ' + it.producto.nombre + '">' + I('x', 16) + '</button></div>';
    }).join('');
    return '<aside class="card card--wave summary" data-summary>' + ui.cardTitle('cart', 'Resumen del pedido') +
      '<div class="divider"></div>' +
      (cart.items.length ? '<div class="cmp-cart-list">' + items + '</div>' : ui.empty({ icon: 'cart', title: 'Tu pedido está vacío', text: 'Agrega productos del catálogo para armar tu pedido.' })) +
      '<div class="divider" style="margin:12px 0"></div>' +
      '<div class="row row--between"><span class="t-strong" style="font-size:16px">Subtotal</span><span class="total-big num">' + ui.kg(cart.kg) + '</span></div>' +
      '<div class="row row--between mt-8"><span class="t-body">Total estimado</span><span class="t-strong num">' + ui.money(cart.total) + '</span></div>' +
      '<p class="t-cap mt-8">Precio acordado por kg · incluye recolección compartida y cadena de frío.</p>' +
      ui.btn({ label: 'Confirmar pedido', icon: 'check-circle', variant: cart.items.length ? 'primary' : 'neutral', block: true, action: 'checkout', disabled: !cart.items.length, cls: 'mt-16' }) +
      (compacto ? '' : '<button class="link mt-16" data-go="#/comprador/pedido" style="justify-content:center;width:100%">Ver detalle de Mi pedido' + I('chevron-right', 16) + '</button>') +
      '</aside>';
  }

  /* ---------- modal de detalle de producto ---------- */
  function detalleProducto(ctx, pid) {
    const p = q().productos().find(function (x) { return x.id === pid; });
    const hist = q().historialPrecios(pid);
    const ofertas = q().ofertasDisponibles(pid);
    const sug = q().sugerirPrecio(pid);
    const m = ui.modal({
      title: p.nombre, icon: 'package', size: 'lg',
      body: '<div class="cmp-detail"><div class="cmp-detail__img"><img src="' + p.img + '" alt="' + p.nombre + '"></div><div class="stack">' +
        '<p class="t-lead">' + p.descripcion + '</p>' +
        '<div class="row row--wrap gap-8">' + ui.chip(p.categoria, 'neutral') + ui.chip('Origen: ' + p.origen, 'success', { icon: 'map-pin' }) + ui.chip(p.temp_min + '–' + p.temp_max + ' °C', 'info', { icon: 'snowflake' }) + ui.chip('Vida útil ' + p.vida_util_horas + ' h', 'neutral', { icon: 'clock' }) + '</div>' +
        '<div class="grid grid-3" style="gap:10px"><div class="cmp-mini"><span class="t-cap">Precio</span><b>' + ui.money(p.precio) + '/kg</b></div><div class="cmp-mini"><span class="t-cap">Disponible</span><b>' + ui.kg(p.disponible) + '</b></div><div class="cmp-mini"><span class="t-cap">Productores</span><b>' + p.productores + '</b></div></div>' +
        '<div><div class="row row--between"><span class="t-over">Precio de referencia (8 semanas)</span>' + ui.rule('PR-4') + '</div>' + ui.lineChart({ height: 150, labels: hist.map(function (h) { return ui.fecha(h.fecha); }), series: [{ values: hist.map(function (h) { return h.precio_kg; }), color: '#2F8F3A' }], fmt: function (v) { return '$' + ui.num(v); } }) + '<p class="t-cap">Rango justo sugerido: ' + ui.money(sug.min) + ' – ' + ui.money(sug.max) + ' por kg.</p></div>' +
        '</div></div>' +
        '<div class="t-over mt-16" style="margin-bottom:8px">Ofertas que respaldan este producto</div><div class="table-wrap"><table class="table"><thead><tr><th>Productor</th><th>Municipio</th><th>Cosecha</th><th class="t-right">Disponible</th></tr></thead><tbody>' +
        ofertas.slice(0, 5).map(function (o) { const pr = q().productor(o.id_productor); return '<tr><td><b>' + pr.nombre + '</b></td><td>' + pr.municipio + ', ' + pr.departamento + '</td><td>' + ui.dia(o.fecha_cosecha) + '</td><td class="t-right num">' + ui.kg(o.cantidad_kg - o.kg_reservado) + '</td></tr>'; }).join('') + '</tbody></table></div>',
      foot: '<div class="qty" data-qty><button type="button" data-d="-1" aria-label="Menos">' + I('minus', 18) + '</button><input type="number" value="' + KG_INICIAL + '" min="50" step="50" aria-label="Kilos"><button type="button" data-d="1" aria-label="Más">' + I('plus', 18) + '</button></div><span class="t-body">kg</span><span class="grow"></span>' +
        ui.btn({ label: 'Agregar al pedido', icon: 'cart', attrs: ' data-add' }),
      onMount: function (c) {
        const inp = c.el.querySelector('[data-qty] input');
        c.el.querySelectorAll('[data-d]').forEach(function (b) { b.onclick = function () { inp.value = Math.max(50, (+inp.value || 0) + PASO_KG * (+b.dataset.d)); }; });
        c.el.querySelector('[data-add]').onclick = function () {
          const kg = Math.max(50, +inp.value || 0);
          RC.api.carritoAgregar(CID, pid, kg);
          c.close(); ctx.refresh();
          ui.toast(p.nombre + ' agregado a tu pedido', ui.kg(kg) + ' · ' + ui.money(kg * p.precio), 'success');
        };
      }
    });
    return m;
  }

  /* ---------- modal de confirmación (PR-6: ¿las ofertas cubren la cantidad?) ---------- */
  function checkout(ctx) {
    const cart = q().carrito(CID);
    const cob = RC.api.verificarCobertura(CID);
    const sinCob = cob.filter(function (c) { return !c.cubre; });
    const c = q().comprador(CID);
    const minFecha = RC.db.util.fecha(1);
    const m = ui.modal({
      title: 'Confirmar pedido', icon: 'check-circle', size: 'lg',
      body: '<div class="row row--between" style="margin-bottom:10px"><span class="t-over">Verificación de cobertura</span>' + ui.rule('PR-6') + '</div>' +
        '<div class="list">' + cob.map(function (x) {
          return '<div class="list-row"><span class="cart-item__img" style="background-image:url(' + x.producto.img + ')"></span><div class="grow"><div class="list-row__title">' + x.producto.nombre + ' · ' + ui.kg(x.kg) + '</div><div class="list-row__sub">Disponible en ofertas activas: ' + ui.kg(x.disponible) + '</div></div>' +
            (x.cubre ? ui.chip('Cubierto', 'success', { icon: 'check' }) : ui.chip('Faltan ' + ui.kg(x.faltante), 'danger') + ui.btn({ label: 'Ajustar', size: 'xs', variant: 'warning', attrs: ' data-ajustar="' + x.id_producto + '" data-kg="' + x.disponible + '"' })) + '</div>';
        }).join('') + '</div>' +
        (sinCob.length ? ui.callout('alert-triangle', '<b>Sin cobertura completa.</b> Ajusta la cantidad al disponible o elige otra fecha; la plataforma te propondrá alternativas.', 'warn') : ui.callout('check-circle', 'Todas las cantidades están cubiertas por ofertas de productores activos. Tu pedido quedará <b>pendiente de aprobación</b> y luego se asignará a una ruta compartida.')) +
        '<form class="form-grid mt-16" data-ck>' +
        ui.field({ label: 'Fecha requerida', name: 'fecha', type: 'date', icon: 'calendar', value: RC.db.util.fecha(2), attrs: ' min="' + minFecha + '"' }) +
        ui.field({ label: 'Franja de recepción', name: 'franja', icon: 'clock', options: ['6:00 – 9:00 a. m.', '9:00 – 12:00 m.', '2:00 – 5:00 p. m.'], value: '6:00 – 9:00 a. m.' }) +
        ui.field({ label: 'Dirección de entrega', name: 'direccion', icon: 'map-pin', value: 'Cra. 1 #4-120, Bocagrande · Muelle de carga', cls: 'span-2' }) +
        ui.field({ label: 'Notas para operación (opcional)', name: 'notas', area: true, placeholder: 'Ej.: Mango en punto de maduración 3, yuca parafinada.', cls: 'span-2' }) +
        '</form>' +
        '<div class="cmp-totals mt-16"><div><span class="t-cap">Productos</span><b>' + cart.items.length + '</b></div><div><span class="t-cap">Total kg</span><b class="num">' + ui.kg(cart.kg) + '</b></div><div><span class="t-cap">Total estimado</span><b class="num t-green">' + ui.money(cart.total) + '</b></div><div><span class="t-cap">Comprador</span><b>' + c.razon_social + '</b></div></div>',
      foot: ui.btn({ label: 'Seguir comprando', variant: 'outline', attrs: ' data-close' }) + ui.btn({ label: 'Confirmar pedido', icon: 'check-circle', attrs: ' data-confirm' + (sinCob.length ? ' disabled' : '') }),
      onMount: function (cm) {
        cm.el.querySelectorAll('[data-ajustar]').forEach(function (b) {
          b.onclick = function () {
            const kg = Math.floor(+b.dataset.kg / 50) * 50;
            if (kg <= 0) RC.api.carritoQuitar(CID, b.dataset.ajustar); else RC.api.carritoActualizar(CID, b.dataset.ajustar, kg);
            cm.close(); ctx.refresh(); setTimeout(function () { checkout(ctx); }, 250);
          };
        });
        const ok = cm.el.querySelector('[data-confirm]');
        ok.onclick = async function () {
          const f = cm.el.querySelector('[data-ck]');
          try {
            const r = await ui.withLoading(ok, function () { return RC.api.crearPedidos(CID, { fecha_requerida: f.fecha.value, direccion: f.direccion.value, notas: (f.franja.value + ' · ' + f.notas.value).trim() }); });
            cm.close(); ctx.refresh(); exito(ctx, r);
          } catch (e) { ui.error(e); }
        };
      }
    });
  }
  function exito(ctx, r) {
    ui.confetti();
    ui.modal({
      size: 'sm',
      body: '<div style="text-align:center;padding-top:18px"><div class="success-mark"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#2F8F3A" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></div>' +
        '<h3 class="h2">¡Pedido registrado!</h3><p class="t-lead mt-8">Solicitud <b>' + r.solicitud + '</b> con ' + r.pedidos.length + ' pedido(s): ' + r.pedidos.map(function (p) { return '<b>' + p.id + '</b>'; }).join(', ') + '.</p>' +
        '<div class="callout mt-16" style="text-align:left">' + I('info', 18) + '<div>Operación cruzará tu pedido con las ofertas de los productores (PR-7) y lo asignará a una <b>ruta compartida</b>. Te avisaremos en cada etapa.</div></div></div>',
      foot: ui.btn({ label: 'Seguir comprando', variant: 'outline', attrs: ' data-close' }) + ui.btn({ label: 'Ver seguimiento', icon: 'truck', attrs: ' data-close data-go="#/comprador/seguimiento/' + r.pedidos[0].id + '"' })
    });
  }

  /* ======================= PÁGINAS ======================= */
  const pages = {};

  /* ---------- PRODUCTOS (catálogo · pantalla principal del mockup) ---------- */
  pages.productos = {
    title: 'Productos',
    render: function (ctx) {
      const prods = q().productos();
      const cart = q().carrito(CID);
      const enCarrito = {}; cart.items.forEach(function (i) { enCarrito[i.id_producto] = i.kg; });
      const cats = ['Todos'].concat(Array.from(new Set(prods.map(function (p) { return p.categoria; }))));
      let lista = prods.filter(function (p) { return (F.cat === 'Todos' || p.categoria === F.cat) && (F.dep === 'Todos' || p.origen === F.dep); });
      if (F.orden === 'precio') lista.sort(function (a, b) { return a.precio - b.precio; });
      if (F.orden === 'disponible') lista.sort(function (a, b) { return b.disponible - a.disponible; });
      const deps = ['Todos', 'Atlántico', 'Magdalena', 'Bolívar'];
      return '<div class="page-head"><div><h1 class="h1">Bienvenido, Comprador B2B</h1><p class="page-head__sub">Compra productos del campo Caribe de forma simple y confiable.</p></div>' +
        '<span class="chip chip--neutral" style="height:34px;padding:0 14px">' + I('refresh', 15) + 'Precios de referencia actualizados hoy</span></div>' +
        '<div class="cmp-layout"><div class="stack gap-16" style="min-width:0">' +
        '<div class="row cmp-search"><div class="control grow">' + I('search', 20) + '<input type="search" placeholder="Buscar productos (ej. mango, yuca, plátano)" value="' + ui.esc(F.texto) + '" data-oninput="buscar" aria-label="Buscar productos"></div>' +
        '<div style="position:relative">' + ui.btn({ label: 'Filtrar', icon: 'filter', iconRight: 'chevron-down', variant: 'outline', action: 'filtro' }) +
        (F.abierto ? '<div class="menu cmp-filter"><div class="t-over" style="padding:6px 8px">Origen</div>' + deps.map(function (d) { return '<button class="menu__item" data-action="dep" data-v="' + d + '">' + (F.dep === d ? I('check', 16, 't-green') : '<span style="width:16px"></span>') + d + '</button>'; }).join('') +
          '<div class="t-over" style="padding:10px 8px 6px">Ordenar por</div>' + [['relevancia', 'Relevancia'], ['precio', 'Menor precio'], ['disponible', 'Mayor disponibilidad']].map(function (o) { return '<button class="menu__item" data-action="orden" data-v="' + o[0] + '">' + (F.orden === o[0] ? I('check', 16, 't-green') : '<span style="width:16px"></span>') + o[1] + '</button>'; }).join('') + '</div>' : '') +
        '</div></div>' +
        '<div class="row row--wrap gap-8">' + cats.map(function (c) { return '<button class="chip-btn ' + (F.cat === c ? 'is-active' : '') + '" data-action="cat" data-v="' + c + '">' + c + '</button>'; }).join('') +
        (F.dep !== 'Todos' ? '<span class="chip chip--success" style="height:36px;padding:0 14px">' + I('map-pin', 14) + F.dep + '</span>' : '') + '</div>' +
        '<div class="products reveal" data-grid>' + lista.map(function (p) {
          const kg = enCarrito[p.id];
          return '<article class="product ' + (kg ? 'is-added' : '') + '" data-name="' + p.nombre.toLowerCase() + ' ' + p.categoria.toLowerCase() + '">' +
            '<img class="product__img" src="' + p.img + '" alt="' + p.nombre + '" data-action="detalle" data-pid="' + p.id + '">' +
            '<div class="product__body"><div class="row row--between gap-8"><h3 class="product__name">' + p.nombre + '</h3>' + (kg ? ui.chip('En pedido', 'success', { icon: 'check' }) : '') + '</div>' +
            '<span class="product__meta">' + I('map-pin', 16) + p.origen + ' · ' + p.productores + ' productor' + (p.productores === 1 ? '' : 'es') + '</span>' +
            '<span class="product__meta">' + I('package', 16) + '<span><b class="t-strong num">' + ui.kg(p.disponible) + '</b> disponibles</span></span>' +
            '<span class="product__price num">' + ui.money(p.precio) + '<small> /kg</small> ' + tendencia(p.variacion) + '</span>' +
            '<div class="product__foot">' + (kg ?
              '<div class="qty qty--sm"><button data-action="menos" data-pid="' + p.id + '" aria-label="Menos">' + I('minus', 16) + '</button><input value="' + ui.num(kg) + ' kg" readonly aria-label="Cantidad"><button data-action="mas" data-pid="' + p.id + '" aria-label="Más">' + I('plus', 16) + '</button></div>' :
              ui.btn({ label: 'Agregar', icon: 'cart', variant: 'secondary', size: 'sm', action: 'agregar', attrs: ' data-pid="' + p.id + '"', disabled: p.disponible < 50 })) + '</div></div></article>';
        }).join('') + '</div>' +
        '<div class="empty-search hide" data-nores>' + ui.empty({ icon: 'search', title: 'Sin resultados', text: 'Prueba con otro producto o quita los filtros.' }) + '</div>' +
        '</div>' + resumen(cart) + '</div>' + tarjetaMiPedido();
    },
    mount: function () { if (F.texto) pages.productos.actions.buscar(null, document.querySelector('[data-oninput=buscar]')); },
    actions: {
      buscar: function (ctx, el) {
        F.texto = el.value; const t = F.texto.trim().toLowerCase(); let n = 0;
        document.querySelectorAll('[data-grid] .product').forEach(function (c) { const ok = !t || c.dataset.name.indexOf(t) >= 0; c.classList.toggle('hide', !ok); if (ok) n++; });
        document.querySelector('[data-nores]').classList.toggle('hide', n > 0);
      },
      filtro: function (ctx) { F.abierto = !F.abierto; ctx.refresh(); },
      dep: function (ctx, el) { F.dep = el.dataset.v; F.abierto = false; ctx.refresh(); },
      orden: function (ctx, el) { F.orden = el.dataset.v; F.abierto = false; ctx.refresh(); },
      cat: function (ctx, el) { F.cat = el.dataset.v; ctx.refresh(); },
      detalle: function (ctx, el) { detalleProducto(ctx, el.dataset.pid); },
      agregar: function (ctx, el) {
        const card = el.closest('.product'); const img = card.querySelector('.product__img');
        const rect = img.getBoundingClientRect(); const src = img.src;
        const p = q().producto(el.dataset.pid);
        RC.api.carritoAgregar(CID, el.dataset.pid, KG_INICIAL);
        ctx.refresh();
        volar(src, rect, document.querySelector('[data-summary]'));
        ui.toast(p.nombre + ' agregado a tu pedido', ui.kg(KG_INICIAL) + ' · ajusta la cantidad con + y −', 'success', 2800);
      },
      mas: function (ctx, el) { const it = q().carrito(CID).items.find(function (i) { return i.id_producto === el.dataset.pid; }); RC.api.carritoActualizar(CID, el.dataset.pid, it.kg + PASO_KG); ctx.refresh(); },
      menos: function (ctx, el) { const it = q().carrito(CID).items.find(function (i) { return i.id_producto === el.dataset.pid; }); if (it.kg - PASO_KG < 50) RC.api.carritoQuitar(CID, el.dataset.pid); else RC.api.carritoActualizar(CID, el.dataset.pid, it.kg - PASO_KG); ctx.refresh(); },
      quitar: function (ctx, el) { RC.api.carritoQuitar(CID, el.dataset.pid); ctx.refresh(); ui.toast('Producto retirado', 'Se quitó del resumen del pedido.', 'info', 2200); },
      checkout: function (ctx) { checkout(ctx); }
    }
  };

  /* ---------- INICIO (resumen del comprador) ---------- */
  pages.inicio = {
    title: 'Inicio', live: true,
    render: function () {
      const mios = q().pedidos(function (p) { return p.id_comprador === CID; });
      const act = pedidosActivos();
      const recibidos = mios.filter(function (p) { return p.estado === 'recibido'; });
      const aTiempo = recibidos.length ? recibidos.filter(function (p) { return p.a_tiempo; }).length / recibidos.length : 1;
      const totalMes = mios.filter(function (p) { return p.estado !== 'rechazado' && p.creado >= RC.db.util.fecha(-30); }).reduce(function (t, p) { return t + p.total; }, 0);
      const kgMes = mios.filter(function (p) { return p.estado !== 'rechazado' && p.creado >= RC.db.util.fecha(-30); }).reduce(function (t, p) { return t + p.cantidad_kg; }, 0);
      const conf = porConfirmar();
      const prods = q().productos();
      return '<div class="page-head"><div><h1 class="h1">Hola, Hotel Caribe Plaza</h1><p class="page-head__sub">Resumen de tus compras directas al campo Caribe.</p></div>' + ui.btn({ label: 'Hacer un pedido', icon: 'cart', go: '#/comprador/productos' }) + '</div>' +
        (conf.length ? '<div class="card card--warn cmp-alert">' + ui.iconBox('package', 'orange', 'lg') + '<div class="grow"><div class="h3">Tienes ' + conf.length + ' entrega(s) por confirmar</div><p class="t-body">' + conf.map(function (p) { return p.id + ' · ' + p.producto.nombre + ' ' + ui.kg(p.cantidad_kg); }).join(' · ') + '. Confirma kilos y calidad para liberar el pago al productor.</p></div>' + ui.btn({ label: 'Confirmar recepción', variant: 'warning', iconRight: 'chevron-right', go: '#/comprador/seguimiento/' + conf[0].id }) + '</div>' : '') +
        '<div class="grid grid-4 reveal">' +
        ui.kpi({ icon: 'package', label: 'Pedidos activos', count: act.length, foot: act.filter(function (p) { return p.estado === 'en_ruta'; }).length + ' en ruta ahora' }) +
        ui.kpi({ icon: 'weight', label: 'Kg comprados (30 días)', count: kgMes, format: 'kg' }) +
        ui.kpi({ icon: 'dollar', label: 'Compras del mes', count: totalMes, format: 'money', tone: 'orange' }) +
        ui.kpi({ icon: 'check-circle', label: 'Entregas a tiempo', count: aTiempo, format: 'pct', foot: recibidos.length + ' pedidos recibidos', footTone: 'up' }) + '</div>' +
        '<div class="grid cmp-home mt-24">' +
        '<div class="card">' + ui.cardTitle('truck', 'Pedidos en curso', '<a class="link" href="#/comprador/seguimiento">Ver todos' + I('chevron-right', 16) + '</a>') +
        '<div class="list">' + (act.length ? act.slice(0, 5).map(function (p) { return '<button class="list-row" data-go="#/comprador/seguimiento/' + p.id + '">' + ui.iconBox(p.estado === 'entregado' ? 'check-circle' : 'package', p.estado === 'entregado' ? 'orange' : null, 'sm') + '<div class="grow"><div class="list-row__title">' + p.id + ' · ' + p.producto.nombre + '</div><div class="list-row__sub">' + ui.kg(p.cantidad_kg) + ' · requerido ' + ui.dia(p.fecha_requerida) + '</div></div>' + ui.estado(p.estado) + I('chevron-right', 18) + '</button>'; }).join('') : ui.empty({ icon: 'package', title: 'Sin pedidos activos', text: 'Arma tu primer pedido desde el catálogo.' })) + '</div></div>' +
        '<div class="card">' + ui.cardTitle('trending-up', 'Precios de la semana', ui.rule('PR-4')) +
        '<div class="list">' + prods.map(function (p) { return '<div class="list-row"><span class="cart-item__img" style="background-image:url(' + p.img + ')"></span><div class="grow"><div class="list-row__title">' + p.nombre + '</div><div class="list-row__sub">Referencia ' + ui.money(p.referencia) + '/kg</div></div><div style="text-align:right"><div class="t-strong num">' + ui.money(p.precio) + '/kg</div>' + tendencia(p.variacion) + '</div></div>'; }).join('') + '</div></div></div>' +
        '<div class="mt-24">' + tarjetaMiPedido() + '</div>';
    }
  };

  /* ---------- MI PEDIDO (carrito editable + historial) ---------- */
  pages.pedido = {
    title: 'Mi pedido',
    render: function () {
      const cart = q().carrito(CID);
      const hist = q().pedidos(function (p) { return p.id_comprador === CID; });
      return '<div class="page-head"><div><h1 class="h1">Mi pedido</h1><p class="page-head__sub">Ajusta cantidades, verifica cobertura y confirma tu solicitud.</p></div>' + ui.btn({ label: 'Seguir comprando', icon: 'store', variant: 'outline', go: '#/comprador/productos' }) + '</div>' +
        '<div class="cmp-layout"><div class="card">' + ui.cardTitle('cart', 'Productos en tu pedido', ui.chip(cart.items.length + ' producto(s)', 'neutral')) +
        (cart.items.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Producto</th><th>Precio/kg</th><th>Cantidad</th><th>Cobertura</th><th class="t-right">Subtotal</th><th></th></tr></thead><tbody>' +
          cart.items.map(function (it) {
            return '<tr><td><div class="row"><span class="cart-item__img" style="background-image:url(' + it.producto.img + ')"></span><b>' + it.producto.nombre + '</b></div></td><td class="num">' + ui.money(it.precio) + '</td>' +
              '<td><div class="qty qty--sm"><button data-action="menos" data-pid="' + it.id_producto + '" aria-label="Menos">' + I('minus', 16) + '</button><input value="' + ui.num(it.kg) + ' kg" readonly aria-label="Cantidad"><button data-action="mas" data-pid="' + it.id_producto + '" aria-label="Más">' + I('plus', 16) + '</button></div></td>' +
              '<td>' + (it.disponible >= it.kg ? ui.chip('Cubierto', 'success', { icon: 'check' }) : ui.chip('Faltan ' + ui.kg(it.kg - it.disponible), 'danger')) + '</td><td class="t-right num t-strong">' + ui.money(it.subtotal) + '</td>' +
              '<td><button class="cart-item__x" data-action="quitar" data-pid="' + it.id_producto + '" aria-label="Quitar">' + I('trash', 16) + '</button></td></tr>';
          }).join('') + '</tbody></table></div>' : ui.empty({ icon: 'cart', title: 'Tu pedido está vacío', text: 'Explora el catálogo y agrega productos frescos del Caribe.', action: ui.btn({ label: 'Ir al catálogo', icon: 'store', go: '#/comprador/productos' }) })) +
        '</div>' + resumen(cart, true) + '</div>' +
        '<div class="card mt-24">' + ui.cardTitle('file-text', 'Historial de pedidos', ui.chip(hist.length + ' pedidos', 'neutral')) +
        '<div class="table-wrap"><table class="table"><thead><tr><th>Pedido</th><th>Solicitud</th><th>Producto</th><th class="t-right">Kg</th><th class="t-right">Total</th><th>Requerido</th><th>Estado</th><th></th></tr></thead><tbody>' +
        hist.slice(0, 14).map(function (p) { return '<tr class="is-click" data-go="#/comprador/seguimiento/' + p.id + '"><td><b>' + p.id + '</b></td><td class="t-muted">' + p.solicitud + '</td><td>' + p.producto.nombre + '</td><td class="t-right num">' + ui.num(p.cantidad_kg) + '</td><td class="t-right num">' + ui.money(p.total) + '</td><td>' + ui.fecha(p.fecha_requerida) + '</td><td>' + ui.estado(p.estado) + '</td><td>' + I('chevron-right', 18, 't-muted') + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
    },
    actions: {
      mas: pages.productos.actions.mas, menos: pages.productos.actions.menos, quitar: pages.productos.actions.quitar, checkout: pages.productos.actions.checkout
    }
  };

  /* ---------- SEGUIMIENTO (lista + detalle con mapa, trazabilidad y recepción) ---------- */
  pages.seguimiento = {
    title: 'Seguimiento', live: true,
    render: function (ctx) {
      const lista = q().pedidos(function (p) { return p.id_comprador === CID && p.estado !== 'rechazado'; });
      const id = ctx.param || (porConfirmar()[0] || pedidosActivos()[0] || lista[0] || {}).id;
      const p = id ? q().pedido(id) : null;
      if (!p) return ui.empty({ icon: 'truck', title: 'Sin pedidos para seguir', text: 'Cuando hagas un pedido verás aquí su recorrido en tiempo real.' });
      const mp = puntosRuta(p.ruta);
      const lotes = [].concat.apply([], p.asignaciones.map(function (a) { return a.lotes.map(function (l) { return { l: l, a: a }; }); }));
      const recolectado = lotes.reduce(function (t, x) { return t + x.l.kg_recolectados - x.l.kg_rechazados; }, 0);
      const ev = [{ title: 'Pedido registrado', sub: ui.cuando(p.creado) + ' · ' + p.solicitud, state: 'done' }];
      ev.push({ title: p.etapa >= 1 ? 'Aprobado y asignado' : 'En revisión por operación', sub: p.etapa >= 1 ? p.asignaciones.length + ' productor(es): ' + p.asignaciones.map(function (a) { return a.productor.nombre; }).join(', ') : 'Verificando cobertura con ofertas activas (PR-7)', state: p.etapa >= 1 ? 'done' : 'current' });
      if (p.ruta) ev.push({ title: 'Ruta ' + p.ruta.id + ' programada', sub: q().vehiculo(p.ruta.id_vehiculo).placa + ' · salida ' + ui.dia(p.ruta.fecha) + ' ' + p.ruta.hora_salida, state: p.etapa >= 2 ? 'done' : 'current' });
      lotes.forEach(function (x) { ev.push({ title: 'Recogido en ' + x.a.productor.municipio, sub: 'Lote ' + x.l.id + ' · ' + ui.kg(x.l.kg_recolectados) + ' · ' + x.l.temperatura_c.toString().replace('.', ',') + ' °C · calidad ' + x.l.grado_calidad, state: 'done' }); });
      ev.push({ title: 'Entregado', sub: p.fecha_entrega ? ui.dia(p.fecha_entrega) + (p.a_tiempo ? ' · a tiempo' : ' · con retraso') : 'Requerido ' + ui.dia(p.fecha_requerida), state: p.etapa >= 3 ? 'done' : (p.etapa === 2 ? 'current' : 'pending') });
      if (p.estado === 'entregado' || p.estado === 'recibido') ev.push({ title: 'Recepción conforme', sub: p.estado === 'recibido' ? 'Confirmada · pago liberado al productor' : 'Pendiente de tu confirmación', state: p.estado === 'recibido' ? 'done' : 'current' });
      const pagos = p.asignaciones.map(function (a) { return a.pago; }).filter(Boolean);
      return '<div class="cmp-track-layout">' +
        '<aside class="card cmp-orders"><div class="t-over" style="margin-bottom:10px">Mis pedidos</div><div class="list">' + lista.slice(0, 12).map(function (x) {
          return '<button class="list-row ' + (x.id === p.id ? 'is-sel' : '') + '" data-go="#/comprador/seguimiento/' + x.id + '"><span class="cart-item__img" style="width:42px;height:38px;background-image:url(' + x.producto.img + ')"></span><div class="grow"><div class="list-row__title">' + x.id + '</div><div class="list-row__sub">' + x.producto.nombre + ' · ' + ui.kg(x.cantidad_kg) + '</div></div>' + ui.estado(x.estado) + '</button>';
        }).join('') + '</div></aside>' +
        '<div class="stack gap-20" style="min-width:0">' +
        '<div class="card card--pad-lg"><div class="cmp-order-head"><img src="' + p.producto.img + '" alt=""><div class="grow"><div class="row gap-8 row--wrap"><h1 class="h1">' + p.id + '</h1>' + ui.estado(p.estado) + '</div><p class="t-lead">' + p.producto.nombre + ' · ' + ui.kg(p.cantidad_kg) + ' · ' + ui.money(p.precio_kg_acordado) + '/kg · <b>' + ui.money(p.total) + '</b></p></div>' +
        '<div class="cmp-order-meta"><span class="t-cap">Solicitud</span><b>' + p.solicitud + '</b><span class="t-cap mt-8">Requerido</span><b>' + ui.dia(p.fecha_requerida) + '</b></div></div>' +
        '<div class="mt-24">' + stepperPedido(p, true) + '</div></div>' +
        (p.estado === 'entregado' ? '<form class="card cmp-reception" data-submit="recibir"><div class="row row--between row--wrap">' + ui.cardTitle('check-circle', 'Confirmar recepción conforme', ui.rule('PR-11')).replace('card-title', 'card-title grow') + '</div>' +
          '<p class="t-body">Verifica kilos y calidad del lote. El pago al productor se calcula con los <b>kg conformes × precio acordado − comisión</b> (RN5).</p>' +
          '<div class="form-grid mt-16">' + ui.field({ label: 'Kg recibidos conformes', name: 'kg', type: 'number', icon: 'weight', value: recolectado, suffix: 'kg', attrs: ' max="' + recolectado + '" step="0.1" min="0" data-oninput="kgConf"', hint: 'Recolectado según lotes: ' + ui.kg(recolectado) }) +
          ui.field({ label: 'Motivo de no conformidad (si aplica)', name: 'motivo', icon: 'alert-triangle', options: ['—', 'Diferencia de peso', 'Producto golpeado', 'Temperatura fuera de rango', 'Calidad inferior a la acordada'], value: '—' }) + '</div>' +
          '<div class="row row--between row--wrap mt-16"><div class="cmp-pay-preview" data-preview>' + previewPago(p, recolectado) + '</div>' + ui.btn({ label: 'Confirmar recepción', icon: 'check-circle', type: 'submit', size: 'lg' }) + '</div></form>' : '') +
        (pagos.length ? '<div class="card">' + ui.cardTitle('wallet', 'Liquidación al productor', ui.rule('PR-12')) + '<div class="list">' + pagos.map(function (pg) { const a = p.asignaciones.find(function (x) { return x.id === pg.id_asignacion; }); return '<div class="list-row">' + ui.iconBox('dollar', pg.estado === 'pagado' ? null : 'orange', 'sm') + '<div class="grow"><div class="list-row__title">' + a.productor.nombre + '</div><div class="list-row__sub num">' + ui.kg(a.kg_conformes) + ' conformes × ' + ui.money(p.precio_kg_acordado) + ' − ' + ui.money(pg.comision) + ' comisión</div></div><div style="text-align:right"><div class="t-strong num">' + ui.money(pg.neto) + '</div>' + ui.estado(pg.estado) + '</div></div>'; }).join('') + '</div></div>' : '') +
        '<div class="cmp-track-grid">' +
        '<div class="card">' + ui.cardTitle('map-pin', 'Ruta compartida', mp ? ui.chip(mp.ruta.estado === 'en_curso' ? 'En vivo' : mp.ruta.estado === 'completada' ? 'Completada' : 'Programada', mp.ruta.estado === 'en_curso' ? 'success' : 'neutral', { live: mp.ruta.estado === 'en_curso' }) : '') +
        (mp ? ui.map({ routes: [{ stops: mp.stops, progress: mp.progress, mode: 'to' }], height: 300, aspect: 1.5 }) +
          '<div class="cmp-route-facts"><span>' + I('truck', 16) + mp.ruta.vehiculo.placa + (mp.ruta.vehiculo.refrigerado ? ' · refrigerado' : '') + '</span><span>' + I('route', 16) + ui.num(mp.ruta.distancia_km) + ' km</span><span>' + I('users', 16) + mp.ruta.paradas.length + ' productores comparten el camión</span></div>' :
          (p.etapa >= 2 ? ui.empty({ icon: 'check-circle', title: 'Ruta finalizada', text: 'El producto fue recolectado en una ruta compartida y consolidado en frío antes de la entrega.' }) :
            ui.empty({ icon: 'route', title: 'Ruta por asignar', text: 'Cuando operación apruebe el pedido, el motor de rutas lo agrupará con otros productores en una ruta compartida (PR-8).' }))) + '</div>' +
        '<div class="card">' + ui.cardTitle('clock', 'Línea de tiempo') + ui.timeline(ev) + '</div></div>' +
        '<div class="card">' + ui.cardTitle('qr-code', 'Trazabilidad del producto', ui.rule('RN3')) +
        (lotes.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Lote</th><th>Productor</th><th>Origen</th><th class="t-right">Kg</th><th>Temperatura</th><th>Calidad</th><th>Recolección</th><th></th></tr></thead><tbody>' + lotes.map(function (x) {
          const fuera = x.l.temperatura_c < p.producto.temp_min || x.l.temperatura_c > p.producto.temp_max;
          return '<tr class="is-click" data-action="qr" data-lote="' + x.l.id + '"><td><b>' + x.l.id + '</b></td><td>' + x.a.productor.nombre + '</td><td>' + x.a.productor.municipio + ', ' + x.a.productor.departamento + '</td><td class="t-right num">' + ui.num(x.l.kg_recolectados, 1) + '</td><td>' + ui.chip(x.l.temperatura_c.toString().replace('.', ',') + ' °C', fuera ? 'danger' : 'info', { icon: 'thermometer' }) + '</td><td>' + ui.chip(x.l.grado_calidad, x.l.grado_calidad === 'A' ? 'success' : 'warning') + '</td><td>' + ui.cuando(x.l.fecha_hora_recoleccion) + '</td><td>' + I('qr-code', 18, 't-green') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : ui.empty({ icon: 'qr-code', title: 'Aún sin lotes', text: 'Cada producto recolectado recibe un lote con QR, kilos, temperatura y calidad (RN3).' })) + '</div>' +
        '</div></div>';
    },
    actions: {
      kgConf: function (ctx, el) {
        const p = q().pedido(ctx.param || (porConfirmar()[0] || {}).id); if (!p) return;
        const box = document.querySelector('[data-preview]'); if (box) box.innerHTML = previewPago(p, +el.value || 0);
      },
      recibir: async function (ctx, form) {
        const p = q().pedido(ctx.param || (porConfirmar()[0] || {}).id);
        const btn = form.querySelector('[type=submit]');
        try {
          const r = await ui.withLoading(btn, function () { return RC.api.confirmarRecepcion(p.id, { kg_conformes: form.kg.value, motivo: form.motivo.value === '—' ? '' : form.motivo.value }); });
          ui.confetti();
          ui.toast('Recepción confirmada', r.pagos.length + ' pago(s) en proceso hacia el productor por ' + ui.money(r.pagos.reduce(function (t, x) { return t + x.neto; }, 0)) + '.', 'success', 5200);
          ctx.refresh();
        } catch (e) { ui.error(e); }
      },
      qr: function (ctx, el) {
        const l = q().lote(el.dataset.lote);
        ui.modal({
          title: 'Lote ' + l.id, icon: 'qr-code',
          body: '<div class="cmp-qr"><div class="cmp-qr__code">' + ui.qr(l.qr, 150) + '<span class="mono">' + l.qr + '</span></div><div class="stack gap-8 grow">' +
            [['Producto', l.producto.nombre], ['Productor', l.productor.nombre + ' · ' + l.productor.municipio], ['Recolectado', ui.kg(l.kg_recolectados) + (l.kg_rechazados ? ' (' + ui.kg(l.kg_rechazados) + ' rechazados)' : '')], ['Calidad', l.grado_calidad], ['Temperatura', l.temperatura_c.toString().replace('.', ',') + ' °C (rango ' + l.producto.temp_min + '–' + l.producto.temp_max + ' °C)'], ['Ruta', l.ruta ? l.ruta.id + ' · ' + l.ruta.vehiculo.placa : '—'], ['Almacén', l.almacen ? l.almacen.nombre : 'En tránsito']].map(function (kv) { return '<div class="row row--between"><span class="t-body">' + kv[0] + '</span><b style="text-align:right">' + kv[1] + '</b></div>'; }).join('') +
            '</div></div><div class="t-over mt-16">Telemetría de temperatura (sensor IoT)</div>' + ui.lineChart({ height: 150, labels: l.telemetria.lecturas.map(function (_, i) { return i % 4 === 0 ? (i / 2) + ' h' : ''; }), series: [{ values: l.telemetria.lecturas, color: '#2D7BD8' }], band: [l.telemetria.min, l.telemetria.max], fmt: function (v) { return ui.num(v, 1) + '°'; } })
        });
      }
    }
  };
  function previewPago(p, kg) {
    const bruto = kg * p.precio_kg_acordado; const com = bruto * RC.db.state.meta.comision;
    return '<span class="t-cap">Pago estimado al productor</span><b class="num">' + ui.money(bruto - com) + '</b><span class="t-cap num">' + ui.num(kg, 1) + ' kg × ' + ui.money(p.precio_kg_acordado) + ' − ' + ui.money(com) + ' (8 %)</span>';
  }

  RC.views.comprador = {
    role: 'comprador', home: 'productos',
    nav: [
      { key: 'inicio', icon: 'home', label: 'Inicio' },
      { key: 'productos', icon: 'store', label: 'Productos' },
      { key: 'pedido', icon: 'cart', label: 'Mi pedido', count: function (qq) { return qq.carrito(CID).items.length; } },
      { key: 'seguimiento', icon: 'truck', label: 'Seguimiento', count: function (qq) { return qq.pedidos(function (p) { return p.id_comprador === CID && p.estado === 'entregado'; }).length; } }
    ],
    pages: pages
  };
})();
