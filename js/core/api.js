/* =========================================================================
   RaízCaribe · Servicios de aplicación (simulan la API REST + bus de eventos)
   Aplicaciones núcleo (sección 5): Red y relaciones comerciales, Ofertas y
   pedidos, Motor de rutas (crítico), Trazabilidad y cadena de frío,
   Pagos y facturación, Analítica de precios e impacto.
   Reglas de negocio RN1–RN6 y compuertas PR-1…PR-12 (sección 3.5).
   ========================================================================= */
window.RC = window.RC || {};

(function () {
  const db = RC.db;
  const S = function () { return db.state; };
  const U = db.util;

  /* ======================= BUS DE EVENTOS ======================= */
  const handlers = {};
  RC.bus = {
    on: function (tipo, fn) { (handlers[tipo] = handlers[tipo] || []).push(fn); },
    emit: function (tipo, payload) {
      const ev = { id: db.nextId('evento', 'EVT-'), tipo: tipo, payload: payload, fecha: new Date().toISOString() };
      S().eventos.push(ev);
      if (S().eventos.length > 250) S().eventos.shift();
      (handlers[tipo] || []).concat(handlers['*'] || []).forEach(function (fn) { try { fn(payload, ev); } catch (e) { console.error(e); } });
      return ev;
    }
  };

  /* ======================= UTILIDADES ======================= */
  function ReglaError(regla, mensaje) { const e = new Error(mensaje); e.regla = regla; e.name = 'ReglaError'; return e; }
  const delay = function (ms) { return new Promise(function (r) { setTimeout(r, ms != null ? ms : 260 + Math.random() * 340); }); };
  const sum = function (a, f) { return a.reduce(function (t, x) { return t + (f ? f(x) : x); }, 0); };
  const round = function (n, step) { return Math.round(n / (step || 1)) * (step || 1); };
  const now = function () { return new Date().toISOString(); };
  function haversine(a, b) {
    const R = 6371, toR = Math.PI / 180;
    const dLat = (b.latitud - a.latitud) * toR, dLng = (b.longitud - a.longitud) * toR;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitud * toR) * Math.cos(b.latitud * toR) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  const necesitaFrio = function (prod) { return prod.temp_max <= 13; };
  const CAL = { A: 3, B: 2, C: 1 };
  function hash(str) { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return Math.abs(h); }

  function notificar(rol, titulo, detalle, tipo, link) {
    S().notificaciones.unshift({ id: db.nextId('notif', 'NOT-'), rol: rol, titulo: titulo, detalle: detalle, tipo: tipo || 'info', link: link || null, fecha: now(), leida: false });
    if (S().notificaciones.length > 120) S().notificaciones.pop();
  }
  function commit() { db.save(); if (RC.app && RC.app.onData) RC.app.onData(); }

  /* ======================= CONSULTAS (síncronas) ======================= */
  const q = {};
  q.producto = function (id) { return db.byId('productos', id); };
  q.productor = function (id) { return db.byId('productores', id); };
  q.comprador = function (id) { return db.byId('compradores', id); };
  q.vehiculo = function (id) { return db.byId('vehiculos', id); };
  q.almacen = function (id) { return db.byId('almacenes', id); };
  q.historialPrecios = function (pid) { return S().precios.filter(function (p) { return p.id_producto === pid; }).sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; }); };
  q.precioReferencia = function (pid) { const h = q.historialPrecios(pid); return h[h.length - 1]; };
  /* PR-4 / PR-5: precio justo sugerido a partir de las últimas 4 semanas */
  q.sugerirPrecio = function (pid) {
    const h = q.historialPrecios(pid).slice(-4);
    const prom = sum(h, function (x) { return x.precio_kg; }) / h.length;
    return { referencia: q.precioReferencia(pid).precio_kg, promedio: round(prom, 10), min: round(prom * 0.94, 10), max: round(prom * 1.08, 10), sugerido: round(prom * 1.02, 10) };
  };
  q.ofertasDisponibles = function (pid) {
    return S().ofertas.filter(function (o) {
      const pr = q.productor(o.id_productor);
      return o.id_producto === pid && o.estado === 'publicada' && o.cantidad_kg - o.kg_reservado > 0 && pr && pr.estado === 'activo';
    }).sort(function (a, b) { return a.fecha_cosecha < b.fecha_cosecha ? -1 : 1; });
  };
  /* kg ofrecidos menos los ya reservados y los comprometidos en pedidos aún no asignados */
  q.disponibilidad = function (pid) {
    const ofrecido = sum(q.ofertasDisponibles(pid), function (o) { return o.cantidad_kg - o.kg_reservado; });
    const comprometido = sum(S().pedidos.filter(function (p) { return p.id_producto === pid && p.estado === 'pendiente'; }), function (p) { return p.cantidad_kg; });
    return Math.max(0, ofrecido - comprometido);
  };
  q.precioVenta = function (pid) {
    const of = q.ofertasDisponibles(pid);
    if (!of.length) return q.sugerirPrecio(pid).sugerido;
    const kg = sum(of, function (o) { return o.cantidad_kg - o.kg_reservado; });
    return round(sum(of, function (o) { return (o.cantidad_kg - o.kg_reservado) * o.precio_kg_solicitado; }) / kg, 10);
  };
  q.origenPrincipal = function (pid) {
    const of = q.ofertasDisponibles(pid);
    const cuenta = {};
    of.forEach(function (o) { const d = q.productor(o.id_productor).departamento; cuenta[d] = (cuenta[d] || 0) + o.cantidad_kg - o.kg_reservado; });
    const top = Object.keys(cuenta).sort(function (a, b) { return cuenta[b] - cuenta[a]; })[0];
    return top || '—';
  };
  q.productos = function () {
    return S().productos.map(function (p) {
      const ref = q.precioReferencia(p.id); const h = q.historialPrecios(p.id);
      const prev = h[h.length - 2] ? h[h.length - 2].precio_kg : ref.precio_kg;
      return Object.assign({}, p, { disponible: q.disponibilidad(p.id), precio: q.precioVenta(p.id), referencia: ref.precio_kg, variacion: (ref.precio_kg - prev) / prev, origen: q.origenPrincipal(p.id), productores: new Set(q.ofertasDisponibles(p.id).map(function (o) { return o.id_productor; })).size });
    });
  };
  q.etapa = function (estado) { return { pendiente: 0, sin_cobertura: 0, rechazado: 0, aprobado: 1, en_ruta: 2, entregado: 3, recibido: 3 }[estado] || 0; };
  q.asignacion = function (a) {
    const of = db.byId('ofertas', a.id_oferta); const pa = a.id_parada ? db.byId('paradas', a.id_parada) : null;
    return Object.assign({}, a, {
      oferta: of, productor: of ? q.productor(of.id_productor) : null, parada: pa, ruta: pa ? db.byId('rutas', pa.id_ruta) : null,
      lotes: S().lotes.filter(function (l) { return l.id_asignacion === a.id; }), pago: S().pagos.find(function (p) { return p.id_asignacion === a.id; }) || null
    });
  };
  q.pedido = function (id) {
    const p = db.byId('pedidos', id); if (!p) return null;
    const asg = S().asignaciones.filter(function (a) { return a.id_pedido === id; }).map(q.asignacion);
    return Object.assign({}, p, { producto: q.producto(p.id_producto), comprador: q.comprador(p.id_comprador), asignaciones: asg, total: Math.round(p.cantidad_kg * p.precio_kg_acordado), etapa: q.etapa(p.estado), ruta: (asg.find(function (a) { return a.ruta; }) || {}).ruta || null });
  };
  q.pedidos = function (fn) { return S().pedidos.filter(fn || function () { return true; }).sort(function (a, b) { return a.creado < b.creado ? 1 : -1; }).map(function (p) { return q.pedido(p.id); }); };
  q.ruta = function (id) {
    const r = db.byId('rutas', id); if (!r) return null;
    const veh = q.vehiculo(r.id_vehiculo);
    const paradas = S().paradas.filter(function (p) { return p.id_ruta === id; }).sort(function (a, b) { return a.orden_parada - b.orden_parada || (a.hora_estimada < b.hora_estimada ? -1 : 1); }).map(function (pa) {
      const asg = S().asignaciones.filter(function (a) { return a.id_parada === pa.id; }).map(q.asignacion);
      const pr = q.productor(pa.id_productor);
      const prods = Array.from(new Set(asg.map(function (a) { return a.oferta.id_producto; }))).map(q.producto);
      return Object.assign({}, pa, { productor: pr, asignaciones: asg, kg: sum(asg, function (a) { return a.kg_asignados; }), productos: prods, lotes: [].concat.apply([], asg.map(function (a) { return a.lotes; })) });
    });
    const kg = sum(paradas, function (p) { return p.kg; });
    const hechas = paradas.filter(function (p) { return p.estado === 'recogido'; }).length;
    const pedidos = Array.from(new Set([].concat.apply([], paradas.map(function (p) { return p.asignaciones.map(function (a) { return a.id_pedido; }); }))));
    return Object.assign({}, r, { vehiculo: veh, paradas: paradas, kg: kg, ocupacion: veh ? kg / veh.capacidad_kg : 0, hechas: hechas, progreso: paradas.length ? hechas / paradas.length : 0, destinoAlmacen: q.almacen(r.destino), pedidos: pedidos });
  };
  q.rutas = function (fn) { return S().rutas.filter(fn || function () { return true; }).sort(function (a, b) { return (a.fecha + a.hora_salida) < (b.fecha + b.hora_salida) ? -1 : 1; }).map(function (r) { return q.ruta(r.id); }); };
  /* El conductor de la demo maneja el camión ABC-123 (VEH-01) */
  q.rutaConductor = function () {
    const rs = q.rutas(function (r) { return r.id_vehiculo === 'VEH-01' && r.estado !== 'completada'; });
    return rs[0] || q.rutas(function (r) { return r.id_vehiculo === 'VEH-01'; }).pop();
  };
  q.ofertasDe = function (prId) { return S().ofertas.filter(function (o) { return o.id_productor === prId; }).sort(function (a, b) { return a.creada < b.creada ? 1 : -1; }).map(function (o) { return Object.assign({}, o, { producto: q.producto(o.id_producto) }); }); };
  q.pagosDe = function (prId) {
    return S().pagos.map(function (pg) {
      const a = db.byId('asignaciones', pg.id_asignacion); const of = a ? db.byId('ofertas', a.id_oferta) : null;
      if (!of || of.id_productor !== prId) return null;
      const ped = db.byId('pedidos', a.id_pedido);
      return Object.assign({}, pg, { asignacion: a, producto: q.producto(of.id_producto), pedido: ped, precio: ped.precio_kg_acordado });
    }).filter(Boolean).sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; });
  };
  q.paradasDe = function (prId) {
    return S().paradas.filter(function (p) { return p.id_productor === prId; }).map(function (p) { const r = q.ruta(p.id_ruta); return Object.assign({}, r.paradas.find(function (x) { return x.id === p.id; }), { ruta: r }); }).sort(function (a, b) { return a.hora_estimada < b.hora_estimada ? -1 : 1; });
  };
  q.parcelasDe = function (prId) { return S().parcelas.filter(function (p) { return p.id_productor === prId; }).map(function (p) { return Object.assign({}, p, { producto: q.producto(p.id_producto) }); }); };
  q.lote = function (id) {
    const l = db.byId('lotes', id); if (!l) return null;
    const a = q.asignacion(db.byId('asignaciones', l.id_asignacion));
    const ped = db.byId('pedidos', a.id_pedido);
    const prod = q.producto(a.oferta.id_producto);
    return Object.assign({}, l, { asignacion: a, oferta: a.oferta, productor: a.productor, pedido: ped, comprador: q.comprador(ped.id_comprador), producto: prod, parada: a.parada, ruta: a.ruta ? q.ruta(a.ruta.id) : null, almacen: q.almacen(l.id_almacen), telemetria: q.telemetria(l.id, prod, l.temperatura_c) });
  };
  q.lotes = function () { return S().lotes.slice().sort(function (a, b) { return a.fecha_hora_recoleccion < b.fecha_hora_recoleccion ? 1 : -1; }); };
  /* Telemetría simulada de sensores IoT (I5): 16 lecturas cada 30 min */
  q.telemetria = function (seed, prod, base) {
    let h = hash(seed); const out = [];
    for (let i = 0; i < 16; i++) { h = (h * 9301 + 49297) % 233280; const ruido = (h / 233280 - 0.5) * 1.2; out.push(+(base + ruido + Math.sin(i / 2.5) * 0.35).toFixed(1)); }
    return { lecturas: out, min: prod.temp_min, max: prod.temp_max };
  };
  q.notificaciones = function (rol) { return S().notificaciones.filter(function (n) { return n.rol === rol; }); };
  q.noLeidas = function (rol) { return q.notificaciones(rol).filter(function (n) { return !n.leida; }).length; };
  q.carrito = function (cid) {
    const items = (S().carrito[cid] || []).map(function (it) { const p = q.producto(it.id_producto); const precio = q.precioVenta(it.id_producto); return { id_producto: it.id_producto, kg: it.kg, producto: p, precio: precio, subtotal: Math.round(it.kg * precio), disponible: q.disponibilidad(it.id_producto) }; });
    return { items: items, kg: sum(items, function (i) { return i.kg; }), total: sum(items, function (i) { return i.subtotal; }) };
  };
  q.eventos = function (n) { return S().eventos.slice(-(n || 30)).reverse(); };
  q.incidencias = function () { return S().incidencias.slice().sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; }); };

  /* ---------- PR-13 · Indicadores de impacto ---------- */
  q.indicadores = function () {
    const st = S();
    const recibidos = st.pedidos.filter(function (p) { return p.estado === 'recibido' || p.estado === 'entregado'; });
    const aTiempo = recibidos.filter(function (p) { return p.a_tiempo; }).length;
    const kgRec = sum(st.lotes, function (l) { return l.kg_recolectados; });
    const kgRech = sum(st.lotes, function (l) { return l.kg_rechazados; });
    const kgNoConf = sum(st.asignaciones.filter(function (a) { return a.kg_conformes != null; }), function (a) {
      const lot = st.lotes.filter(function (l) { return l.id_asignacion === a.id; });
      return Math.max(0, sum(lot, function (l) { return l.kg_recolectados - l.kg_rechazados; }) - a.kg_conformes);
    });
    const pagados = st.pagos.filter(function (p) { return p.estado === 'pagado'; });
    const prodPagados = new Set(pagados.map(function (p) { const a = db.byId('asignaciones', p.id_asignacion); return db.byId('ofertas', a.id_oferta).id_productor; }));
    const rutasHoy = st.rutas.filter(function (r) { return r.fecha === U.fecha(0); });
    const rutasConKg = st.rutas.map(function (r) { return q.ruta(r.id); });
    const kgTransp = sum(rutasConKg, function (r) { return r.kg; });
    const costo = sum(rutasConKg, function (r) { return r.costo_total; });
    const lotesCompletos = st.lotes.filter(function (l) { return l.qr && l.temperatura_c != null && l.grado_calidad; }).length;
    return {
      productoresTotal: st.productores.length,
      productoresActivos: st.productores.filter(function (p) { return p.estado === 'activo'; }).length,
      compradoresActivos: st.compradores.filter(function (c) { return c.estado === 'activo'; }).length,
      pedidosActivos: st.pedidos.filter(function (p) { return ['pendiente', 'aprobado', 'en_ruta', 'entregado'].indexOf(p.estado) >= 0; }).length,
      pendientes: st.pedidos.filter(function (p) { return p.estado === 'pendiente'; }).length,
      rutasHoy: rutasHoy.length,
      aTiempo: recibidos.length ? aTiempo / recibidos.length : 1,
      perdidas: kgRec ? (kgRech + kgNoConf) / kgRec : 0,
      kgRecolectados: kgRec,
      ingresoPromedio: prodPagados.size ? sum(pagados, function (p) { return p.neto; }) / prodPagados.size : 0,
      ingresoTotal: sum(pagados, function (p) { return p.neto; }),
      costoKg: kgTransp ? costo / kgTransp : 0,
      productoresPorRuta: rutasConKg.length ? sum(rutasConKg, function (r) { return r.paradas.length; }) / rutasConKg.length : 0,
      trazabilidad: st.lotes.length ? lotesCompletos / st.lotes.length : 1,
      pagosPendientes: st.pagos.filter(function (p) { return p.estado !== 'pagado'; }).length
    };
  };
  /* kg recolectados por día (últimos 14 días) para gráficos */
  q.serieRecoleccion = function () {
    const out = [];
    for (let d = -13; d <= 0; d++) {
      const f = U.fecha(d);
      out.push({ fecha: f, kg: sum(S().lotes.filter(function (l) { return l.fecha_hora_recoleccion && new Date(l.fecha_hora_recoleccion).toISOString().slice(0, 10) === f; }), function (l) { return l.kg_recolectados; }) });
    }
    return out;
  };

  /* ======================= COMANDOS (asíncronos) ======================= */
  const api = { q: q, ReglaError: ReglaError, delay: delay, haversine: haversine };

  function encolarSiOffline(rol, op, args) {
    if (S().online[rol] !== false) return null;
    S().cola_sync.push({ rol: rol, op: op, args: args, fecha: now() });
    db.save();
    return { encolado: true, pendientes: S().cola_sync.filter(function (c) { return c.rol === rol; }).length };
  }

  /* ---------- Modo sin conexión (principio "pensado para el campo") ---------- */
  api.setOnline = async function (rol, online) {
    S().online[rol] = online;
    let sincronizadas = 0;
    if (online) {
      const cola = S().cola_sync.filter(function (c) { return c.rol === rol; });
      S().cola_sync = S().cola_sync.filter(function (c) { return c.rol !== rol; });
      for (const c of cola) { try { await api[c.op].apply(null, c.args); sincronizadas++; } catch (e) { notificar(rol, 'No se pudo sincronizar', e.message, 'peligro'); } }
    }
    commit();
    return { sincronizadas: sincronizadas };
  };

  /* ---------- PR-5 · Publicar oferta ---------- */
  api.publicarOferta = async function (productorId, d) {
    const off = encolarSiOffline('productor', 'publicarOferta', [productorId, d]); if (off) return off;
    await delay();
    const pr = q.productor(productorId);
    if (!pr || pr.estado !== 'activo') throw ReglaError('RN6', 'Solo un productor activo puede publicar ofertas.');
    if (!d.id_producto || !d.cantidad_kg || !d.precio_kg || !d.fecha_cosecha) throw ReglaError('PR-5', 'Completa producto, cantidad, precio y fecha de cosecha.');
    if (d.cantidad_kg < 50) throw ReglaError('PR-5', 'La cantidad mínima por oferta es de 50 kg.');
    const sug = q.sugerirPrecio(d.id_producto);
    const of = {
      id: db.nextId('oferta', 'OFE-'), id_productor: productorId, id_producto: d.id_producto, cantidad_kg: +d.cantidad_kg, precio_kg_solicitado: +d.precio_kg,
      fecha_cosecha: d.fecha_cosecha, ventana_inicio: d.ventana_inicio || '05:00', ventana_fin: d.ventana_fin || '10:00', kg_reservado: 0, estado: 'publicada', creada: now()
    };
    db.insert('ofertas', of);
    const prod = q.producto(d.id_producto);
    RC.bus.emit('OfertaPublicada', { id_oferta: of.id, productor: pr.nombre, producto: prod.nombre, kg: of.cantidad_kg, precio_kg: of.precio_kg_solicitado });
    notificar('admin', 'Nueva oferta publicada', pr.nombre + ' publicó ' + prod.nombre + ' · ' + of.cantidad_kg.toLocaleString('es-CO') + ' kg.', 'info', '#/admin/pedidos');
    notificar('comprador', 'Nueva cosecha disponible', prod.nombre + ' de ' + pr.municipio + ': +' + of.cantidad_kg.toLocaleString('es-CO') + ' kg en el catálogo.', 'exito', '#/comprador/catalogo');
    commit();
    return { oferta: of, sugerido: sug, aviso: of.precio_kg_solicitado > sug.max * 1.15 ? 'Tu precio está por encima del rango sugerido; puede tardar más en asignarse.' : null };
  };

  /* ---------- Carrito del comprador ---------- */
  api.carritoAgregar = function (cid, pid, kg) {
    const c = S().carrito[cid] = S().carrito[cid] || [];
    const it = c.find(function (x) { return x.id_producto === pid; });
    if (it) it.kg += kg; else c.push({ id_producto: pid, kg: kg });
    commit();
  };
  api.carritoActualizar = function (cid, pid, kg) {
    const c = S().carrito[cid] || [];
    const it = c.find(function (x) { return x.id_producto === pid; });
    if (it) it.kg = Math.max(50, kg);
    commit();
  };
  api.carritoQuitar = function (cid, pid) { S().carrito[cid] = (S().carrito[cid] || []).filter(function (x) { return x.id_producto !== pid; }); commit(); };

  /* ---------- PR-6 · ¿Las ofertas cubren la cantidad? ---------- */
  api.verificarCobertura = function (cid) {
    return q.carrito(cid).items.map(function (it) {
      return { id_producto: it.id_producto, producto: it.producto, kg: it.kg, disponible: it.disponible, cubre: it.disponible >= it.kg, faltante: Math.max(0, it.kg - it.disponible) };
    });
  };
  /* ---------- PR-6 · Registrar pedido ---------- */
  api.crearPedidos = async function (cid, d) {
    await delay(500);
    const c = q.comprador(cid);
    if (!c || c.estado !== 'activo') throw ReglaError('RN6', 'Solo un comprador activo puede hacer pedidos.');
    const cart = q.carrito(cid);
    if (!cart.items.length) throw ReglaError('PR-6', 'Tu pedido está vacío.');
    const cob = api.verificarCobertura(cid);
    const sin = cob.filter(function (x) { return !x.cubre; });
    if (sin.length) throw ReglaError('PR-6', 'Sin cobertura para ' + sin.map(function (x) { return x.producto.nombre + ' (faltan ' + x.faltante.toLocaleString('es-CO') + ' kg)'; }).join(', ') + '. Ajusta la cantidad.');
    const sol = 'SOL-' + (S().seq.solicitud++);
    const creados = cart.items.map(function (it) {
      const ped = { id: db.nextId('pedido', 'PED-'), solicitud: sol, id_comprador: cid, id_producto: it.id_producto, cantidad_kg: it.kg, precio_kg_acordado: it.precio, fecha_requerida: d.fecha_requerida || U.fecha(1), fecha_entrega: null, estado: 'pendiente', creado: now(), a_tiempo: true, direccion: d.direccion || null, notas: d.notas || '' };
      db.insert('pedidos', ped);
      RC.bus.emit('PedidoRegistrado', { id_pedido: ped.id, comprador: c.razon_social, producto: it.producto.nombre, kg: it.kg });
      return ped;
    });
    S().carrito[cid] = [];
    notificar('admin', 'Nuevo pedido por aprobar', c.razon_social + ' registró ' + creados.length + ' pedido(s) · ' + sol + '.', 'alerta', '#/admin/pedidos');
    notificar('comprador', 'Pedido registrado', sol + ': ' + creados.map(function (p) { return p.id; }).join(', ') + '. Te avisaremos al asignar la ruta.', 'exito', '#/comprador/pedidos');
    commit();
    return { solicitud: sol, pedidos: creados };
  };

  /* ---------- PR-8 · Motor de rutas (capacidad crítica C2) ---------- */
  function ordenarParadas(rutaId) {
    const r = db.byId('rutas', rutaId);
    const pas = S().paradas.filter(function (p) { return p.id_ruta === rutaId; });
    const fijas = pas.filter(function (p) { return p.estado !== 'pendiente'; }).sort(function (a, b) { return a.orden_parada - b.orden_parada; });
    let pend = pas.filter(function (p) { return p.estado === 'pendiente'; });
    let actual = fijas.length ? q.productor(fijas[fijas.length - 1].id_productor) : q.almacen(r.destino);
    const orden = fijas.slice();
    while (pend.length) {
      pend.sort(function (a, b) { return haversine(actual, q.productor(a.id_productor)) - haversine(actual, q.productor(b.id_productor)); });
      const sig = pend.shift(); orden.push(sig); actual = q.productor(sig.id_productor);
    }
    let km = 0; let prev = q.almacen(r.destino);
    const salida = new Date(r.fecha + 'T' + r.hora_salida + ':00');
    orden.forEach(function (p, i) {
      p.orden_parada = i + 1;
      const pr = q.productor(p.id_productor); const tramo = haversine(prev, pr) * 1.3; km += tramo; prev = pr;
      if (p.estado === 'pendiente') p.hora_estimada = new Date(salida.getTime() + (km / 45) * 3600000 + i * 25 * 60000).toISOString();
    });
    km += haversine(prev, q.almacen(r.destino)) * 1.3;
    r.distancia_km = Math.round(km);
    r.costo_total = Math.round(km * S().meta.costo_km + S().meta.costo_fijo_ruta);
    return r;
  }
  function kgRuta(rutaId) { return sum(S().paradas.filter(function (p) { return p.id_ruta === rutaId; }), function (pa) { return sum(S().asignaciones.filter(function (a) { return a.id_parada === pa.id; }), function (a) { return a.kg_asignados; }); }); }
  function programarAsignacion(asg, prod) {
    const frio = necesitaFrio(prod);
    /* RN2: la carga cabe en el vehículo; se prefieren rutas programadas (no iniciadas) */
    const candidatas = S().rutas.filter(function (r) {
      const v = q.vehiculo(r.id_vehiculo);
      return r.estado === 'programada' && (!frio || v.refrigerado) && kgRuta(r.id) + asg.kg_asignados <= v.capacidad_kg;
    }).sort(function (a, b) { return (a.fecha + a.hora_salida) < (b.fecha + b.hora_salida) ? -1 : 1; });
    let ruta = candidatas[0];
    if (!ruta) {
      const ocupados = new Set(S().rutas.filter(function (r) { return r.estado !== 'completada' && r.fecha === U.fecha(1); }).map(function (r) { return r.id_vehiculo; }));
      const veh = S().vehiculos.filter(function (v) { return (!frio || v.refrigerado) && v.capacidad_kg >= asg.kg_asignados && !ocupados.has(v.id); }).sort(function (a, b) { return a.capacidad_kg - b.capacidad_kg; })[0] || S().vehiculos[0];
      ruta = { id: 'R-' + (S().seq.ruta++), id_vehiculo: veh.id, fecha: U.fecha(1), hora_salida: '05:30', distancia_km: 0, costo_total: 0, estado: 'programada', destino: 'ALM-01' };
      db.insert('rutas', ruta);
    }
    const of = db.byId('ofertas', asg.id_oferta);
    let pa = S().paradas.find(function (p) { return p.id_ruta === ruta.id && p.id_productor === of.id_productor; });
    if (!pa) { pa = { id: db.nextId('parada', 'PAR-', 4), id_ruta: ruta.id, id_productor: of.id_productor, orden_parada: 99, hora_estimada: now(), hora_real: null, estado: 'pendiente' }; db.insert('paradas', pa); }
    asg.id_parada = pa.id;
    ordenarParadas(ruta.id);
    return ruta;
  }

  /* ---------- PR-7 · Asignar ofertas al pedido + RN1 → PR-8 ---------- */
  api.aprobarPedido = async function (pedidoId) {
    await delay(650);
    const ped = db.byId('pedidos', pedidoId);
    if (!ped || ped.estado !== 'pendiente') throw ReglaError('PR-7', 'El pedido ya no está pendiente.');
    const c = q.comprador(ped.id_comprador);
    if (c.estado !== 'activo') throw ReglaError('RN6', 'El comprador no está activo.');
    const prod = q.producto(ped.id_producto);
    const ofertas = q.ofertasDisponibles(ped.id_producto);
    const total = sum(ofertas, function (o) { return o.cantidad_kg - o.kg_reservado; });
    if (total < ped.cantidad_kg) {
      ped.estado = 'sin_cobertura';
      notificar('comprador', 'Pedido ' + ped.id + ' sin cobertura', 'Solo hay ' + total.toLocaleString('es-CO') + ' kg de ' + prod.nombre + '. Te proponemos ajustar la cantidad o la fecha.', 'alerta', '#/comprador/pedidos');
      commit();
      throw ReglaError('PR-6', 'Las ofertas disponibles no cubren la cantidad pedida (' + total.toLocaleString('es-CO') + ' de ' + ped.cantidad_kg.toLocaleString('es-CO') + ' kg).');
    }
    let resto = ped.cantidad_kg; const nuevas = [];
    for (const of of ofertas) {
      if (resto <= 0) break;
      const kg = Math.min(resto, of.cantidad_kg - of.kg_reservado);
      of.kg_reservado += kg; if (of.kg_reservado >= of.cantidad_kg) of.estado = 'asignada';
      const asg = { id: db.nextId('asignacion', 'ASG-'), id_pedido: ped.id, id_oferta: of.id, id_parada: null, kg_asignados: kg, kg_conformes: null, motivo_no_conformidad: null, estado: 'asignada' };
      db.insert('asignaciones', asg); nuevas.push(asg); resto -= kg;
    }
    ped.estado = 'aprobado';
    RC.bus.emit('AsignacionConfirmada', { id_pedido: ped.id, asignaciones: nuevas.map(function (a) { return { id: a.id, oferta: a.id_oferta, kg: a.kg_asignados }; }) });
    const rutas = new Set();
    nuevas.forEach(function (a) {
      const ru = programarAsignacion(a, prod); rutas.add(ru.id);
      const of = db.byId('ofertas', a.id_oferta); const pr = q.productor(of.id_productor);
      const pa = db.byId('paradas', a.id_parada);
      if (pr.id === 'PRD-02') notificar('productor', 'Recolección programada', 'Ruta ' + ru.id + ' recogerá ' + a.kg_asignados.toLocaleString('es-CO') + ' kg de ' + prod.nombre + ' (' + new Date(pa.hora_estimada).toLocaleString('es-CO', { weekday: 'short', hour: 'numeric', minute: '2-digit' }) + ').', 'info', '#/productor/entregas');
      if (ru.id_vehiculo === 'VEH-01') notificar('conductor', 'Nueva parada en ' + ru.id, pr.nombre + ' · ' + prod.nombre + ' ' + a.kg_asignados.toLocaleString('es-CO') + ' kg.', 'info', '#/conductor/ruta');
    });
    rutas.forEach(function (id) { const r = q.ruta(id); RC.bus.emit('RutaProgramada', { id_ruta: id, paradas: r.paradas.length, kg: r.kg, vehiculo: r.vehiculo.placa, ocupacion: Math.round(r.ocupacion * 100) + '%' }); });
    notificar('comprador', 'Pedido ' + ped.id + ' aprobado', prod.nombre + ' asignado a ' + nuevas.length + ' productor(es) · ruta ' + Array.from(rutas).join(', ') + '.', 'exito', '#/comprador/seguimiento/' + ped.id);
    commit();
    return { pedido: q.pedido(ped.id), rutas: Array.from(rutas) };
  };
  api.rechazarPedido = async function (pedidoId, motivo) {
    await delay(400);
    const ped = db.byId('pedidos', pedidoId);
    if (!ped || ped.estado !== 'pendiente') throw ReglaError('PR-7', 'El pedido ya no está pendiente.');
    ped.estado = 'rechazado'; ped.motivo = motivo || 'No cumple condiciones comerciales';
    RC.bus.emit('PedidoRechazado', { id_pedido: ped.id, motivo: ped.motivo });
    notificar('comprador', 'Pedido ' + ped.id + ' no aprobado', ped.motivo, 'peligro', '#/comprador/pedidos');
    commit();
    return ped;
  };
  api.optimizarRuta = async function (rutaId) {
    await delay(900);
    const antes = db.byId('rutas', rutaId).distancia_km;
    const r = ordenarParadas(rutaId);
    RC.bus.emit('RutaOptimizada', { id_ruta: rutaId, km_antes: antes, km_despues: r.distancia_km });
    commit();
    return { antes: antes, despues: r.distancia_km, ahorro: Math.max(0, antes - r.distancia_km) };
  };

  /* ---------- PR-9 · Recolectar y registrar lote (RN3, RN4) ---------- */
  api.registrarLote = async function (paradaId, d) {
    const off = encolarSiOffline('conductor', 'registrarLote', [paradaId, d]); if (off) return off;
    await delay(550);
    const pa = db.byId('paradas', paradaId);
    if (!pa) throw ReglaError('PR-9', 'Parada no encontrada.');
    if (pa.estado === 'recogido') throw ReglaError('PR-9', 'Esta parada ya fue recogida.');
    if (!d.qr) throw ReglaError('RN3', 'Todo producto recolectado debe tener lote: escanea el QR antes de confirmar.');
    if (!(d.kg > 0)) throw ReglaError('PR-9', 'Ingresa los kilos recolectados.');
    if (d.temperatura === '' || d.temperatura == null || isNaN(+d.temperatura)) throw ReglaError('RN4', 'La temperatura del lote es obligatoria (cadena de frío).');
    const asgs = S().asignaciones.filter(function (a) { return a.id_parada === pa.id; });
    const prod = q.producto(db.byId('ofertas', asgs[0].id_oferta).id_producto);
    const temp = +d.temperatura;
    const fueraRango = temp < prod.temp_min || temp > prod.temp_max;
    const bajoMinimo = CAL[d.calidad] < CAL[prod.calidad_minima];
    const totalAsig = sum(asgs, function (a) { return a.kg_asignados; });
    const creados = asgs.map(function (a, i) {
      const kg = +(d.kg * a.kg_asignados / totalAsig).toFixed(1);
      const rech = bajoMinimo ? kg : +((d.kg_rechazados || 0) * a.kg_asignados / totalAsig).toFixed(1);
      const lote = { id: db.nextId('lote', 'L-', 6), id_asignacion: a.id, id_almacen: null, kg_recolectados: kg, kg_rechazados: rech, grado_calidad: d.calidad, temperatura_c: temp, fecha_hora_recoleccion: now(), fecha_hora_entrada_almacen: null, fecha_hora_salida_almacen: null, qr: d.qr + (asgs.length > 1 ? '-' + (i + 1) : '') };
      db.insert('lotes', lote);
      const ped = db.byId('pedidos', a.id_pedido); if (ped.estado === 'aprobado') ped.estado = 'en_ruta';
      RC.bus.emit('LoteRegistrado', { evento: 'LoteRegistrado', id_lote: lote.id, id_parada: pa.id, kg_recolectados: kg, grado_calidad: d.calidad, temperatura_c: temp, fecha_hora: lote.fecha_hora_recoleccion });
      notificar('comprador', 'Tu ' + prod.nombre.toLowerCase() + ' fue recogida', 'Pedido ' + ped.id + ' · lote ' + lote.id + ' · ' + temp + ' °C · calidad ' + d.calidad + '.', 'info', '#/comprador/seguimiento/' + ped.id);
      return lote;
    });
    pa.estado = 'recogido'; pa.hora_real = now();
    const ruta = db.byId('rutas', pa.id_ruta); if (ruta.estado === 'programada') ruta.estado = 'en_curso';
    const sig = S().paradas.filter(function (p) { return p.id_ruta === ruta.id && p.estado === 'pendiente'; }).sort(function (a, b) { return a.orden_parada - b.orden_parada; })[0];
    if (sig) sig.estado = 'en_curso';
    const pr = q.productor(pa.id_productor);
    if (pr.id === 'PRD-02') notificar('productor', 'Entrega registrada', d.kg.toLocaleString('es-CO') + ' kg de ' + prod.nombre + ' recogidos · lote ' + creados[0].id + '.', 'exito', '#/productor/lotes');
    if (fueraRango) {
      notificar('admin', 'Alerta de temperatura en ' + ruta.id, prod.nombre + ' a ' + temp + ' °C (rango ' + prod.temp_min + '–' + prod.temp_max + ' °C).', 'peligro', '#/admin/trazabilidad/' + creados[0].id);
      RC.bus.emit('AlertaTemperatura', { id_lote: creados[0].id, temperatura_c: temp, rango: [prod.temp_min, prod.temp_max] });
    }
    if (bajoMinimo) notificar('admin', 'Lote rechazado por calidad', creados[0].id + ' (' + prod.nombre + ') no alcanzó la calidad mínima ' + prod.calidad_minima + '.', 'alerta', '#/admin/trazabilidad/' + creados[0].id);
    commit();
    return { lotes: creados, fueraRango: fueraRango, rechazado: bajoMinimo, siguiente: sig ? q.productor(sig.id_productor) : null, producto: prod };
  };
  /* ---------- PR-10 / PR-11 · Consolidar y entregar ---------- */
  api.confirmarEntrega = async function (rutaId, d) {
    const off = encolarSiOffline('conductor', 'confirmarEntrega', [rutaId, d || {}]); if (off) return off;
    await delay(700);
    const r = q.ruta(rutaId);
    if (r.paradas.some(function (p) { return p.estado !== 'recogido'; })) throw ReglaError('RN1', 'Aún hay paradas sin recoger en la ruta.');
    const ruta = db.byId('rutas', rutaId); ruta.estado = 'completada';
    const hoy = U.fecha(0);
    const peds = new Set();
    r.paradas.forEach(function (pa) { pa.asignaciones.forEach(function (a) {
      peds.add(a.id_pedido);
      S().lotes.filter(function (l) { return l.id_asignacion === a.id; }).forEach(function (l) { l.id_almacen = ruta.destino; l.fecha_hora_entrada_almacen = now(); l.fecha_hora_salida_almacen = now(); });
    }); });
    peds.forEach(function (id) {
      const p = db.byId('pedidos', id); p.estado = 'entregado'; p.fecha_entrega = hoy; p.a_tiempo = hoy <= p.fecha_requerida;
      RC.bus.emit('EntregaRegistrada', { id_pedido: id, receptor: (d && d.receptor) || 'Centro de acopio', fecha: now() });
      if (p.id_comprador === 'CMP-01') notificar('comprador', 'Pedido ' + id + ' entregado', 'Confirma la recepción (kilos y calidad) para cerrar el pedido.', 'exito', '#/comprador/seguimiento/' + id);
    });
    notificar('admin', 'Ruta ' + rutaId + ' completada', peds.size + ' pedido(s) entregados en ' + q.almacen(ruta.destino).nombre + '.', 'exito', '#/admin/rutas');
    commit();
    return { ruta: q.ruta(rutaId), pedidos: Array.from(peds) };
  };
  /* ---------- PR-11 · Recepción conforme → PR-12 · Liquidar y pagar (RN5) ---------- */
  api.confirmarRecepcion = async function (pedidoId, d) {
    await delay(600);
    const ped = db.byId('pedidos', pedidoId);
    if (!ped || ped.estado !== 'entregado') throw ReglaError('PR-11', 'Solo puedes confirmar pedidos entregados.');
    const asgs = S().asignaciones.filter(function (a) { return a.id_pedido === pedidoId; });
    const recolect = sum(asgs, function (a) { return sum(S().lotes.filter(function (l) { return l.id_asignacion === a.id; }), function (l) { return l.kg_recolectados - l.kg_rechazados; }); });
    const conformes = +d.kg_conformes;
    if (!(conformes >= 0)) throw ReglaError('PR-11', 'Indica los kilos recibidos conformes.');
    if (conformes > recolect + 0.01) throw ReglaError('Integridad (d)', 'Los kg conformes (' + conformes + ') no pueden superar lo recolectado (' + recolect + ' kg).');
    const pagos = [];
    asgs.forEach(function (a) {
      const base = sum(S().lotes.filter(function (l) { return l.id_asignacion === a.id; }), function (l) { return l.kg_recolectados - l.kg_rechazados; });
      a.kg_conformes = +(recolect ? conformes * base / recolect : 0).toFixed(1);
      if (a.kg_conformes < base) a.motivo_no_conformidad = d.motivo || 'Diferencia en kilos o calidad';
      a.estado = 'liquidada';
      const bruto = Math.round(a.kg_conformes * ped.precio_kg_acordado);
      const comision = Math.round(bruto * S().meta.comision);
      const pg = { id: db.nextId('pago', 'PAG-'), id_asignacion: a.id, valor_bruto: bruto, comision: comision, neto: bruto - comision, estado: 'procesando', fecha: U.fecha(0), referencia: null };
      db.insert('pagos', pg); pagos.push(pg);
    });
    ped.estado = 'recibido';
    RC.bus.emit('EntregaConfirmada', { id_pedido: pedidoId, kg_conformes: conformes, no_conforme: conformes < recolect });
    if (conformes < recolect) notificar('admin', 'No conformidad en ' + pedidoId, (recolect - conformes).toFixed(1) + ' kg no conformes: ' + (d.motivo || 'sin detalle') + '.', 'alerta', '#/admin/pedidos');
    commit();
    /* I7 · Pasarela de pagos (asíncrona) */
    setTimeout(function () { pagos.forEach(function (pg) { liquidar(pg.id); }); commit(); }, 1600);
    return { pedido: q.pedido(pedidoId), pagos: pagos };
  };
  function liquidar(pagoId) {
    const pg = db.byId('pagos', pagoId);
    const ok = Math.random() > 0.08;
    const a = db.byId('asignaciones', pg.id_asignacion); const of = db.byId('ofertas', a.id_oferta); const pr = q.productor(of.id_productor);
    if (ok) {
      pg.estado = 'pagado'; pg.referencia = 'TRF-' + Math.floor(100000 + Math.random() * 899999);
      RC.bus.emit('PagoRealizado', { id_pago: pg.id, productor: pr.nombre, neto: pg.neto });
      if (pr.id === 'PRD-02') notificar('productor', 'Pago recibido', pg.id + ' por $ ' + pg.neto.toLocaleString('es-CO') + ' fue transferido a tu cuenta.', 'exito', '#/productor/pagos');
    } else {
      pg.estado = 'fallido';
      RC.bus.emit('PagoFallido', { id_pago: pg.id, productor: pr.nombre });
      notificar('admin', 'Pago fallido ' + pg.id, 'La pasarela rechazó la transferencia a ' + pr.nombre + '. Revisa datos y reintenta.', 'peligro', '#/admin/pagos');
    }
  }
  api.reintentarPago = async function (pagoId) { await delay(900); const pg = db.byId('pagos', pagoId); pg.estado = 'procesando'; liquidar(pagoId); if (pg.estado === 'fallido') { pg.estado = 'pagado'; pg.referencia = 'TRF-' + Math.floor(100000 + Math.random() * 899999); } commit(); return pg; };

  /* ---------- Incidencias del conductor ---------- */
  api.reportarIncidencia = async function (rutaId, d) {
    const off = encolarSiOffline('conductor', 'reportarIncidencia', [rutaId, d]); if (off) return off;
    await delay(450);
    if (!d.tipo) throw ReglaError('Incidencia', 'Selecciona el tipo de novedad.');
    const inc = { id: db.nextId('incidencia', 'INC-'), id_ruta: rutaId, tipo: d.tipo, descripcion: d.descripcion || '', estado: 'abierta', fecha: now(), conductor: q.vehiculo(db.byId('rutas', rutaId).id_vehiculo).conductor };
    db.insert('incidencias', inc);
    RC.bus.emit('IncidenciaReportada', { id: inc.id, ruta: rutaId, tipo: d.tipo });
    notificar('admin', 'Incidencia en ' + rutaId + ': ' + d.tipo, d.descripcion || 'Sin descripción', 'alerta', '#/admin/rutas');
    commit();
    return inc;
  };
  api.resolverIncidencia = async function (id) { await delay(300); const i = db.byId('incidencias', id); i.estado = 'resuelta'; commit(); return i; };

  /* ---------- PR-1 / PR-2 · Red de productores ---------- */
  api.evaluarProductor = async function (id, aprobado) {
    await delay(500);
    const pr = db.byId('productores', id);
    pr.estado = aprobado ? 'pendiente' : 'plan_mejora';
    RC.bus.emit('ProductorEvaluado', { id_productor: id, resultado: aprobado ? 'aprobado' : 'plan de mejora' });
    commit(); return pr;
  };
  api.activarProductor = async function (id) {
    await delay(500);
    const pr = db.byId('productores', id);
    pr.estado = 'activo'; pr.fecha_vinculacion = U.fecha(0);
    RC.bus.emit('ProductorActivado', { id_productor: id, nombre: pr.nombre });
    commit(); return pr;
  };
  api.activarComprador = async function (id) {
    await delay(500);
    const c = db.byId('compradores', id); c.estado = 'activo';
    RC.bus.emit('CompradorActivado', { id_comprador: id, razon_social: c.razon_social });
    commit(); return c;
  };

  /* ---------- Notificaciones ---------- */
  api.marcarLeidas = function (rol) { S().notificaciones.forEach(function (n) { if (n.rol === rol) n.leida = true; }); commit(); };

  RC.api = api;
})();
