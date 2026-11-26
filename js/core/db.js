/* =========================================================================
   RaízCaribe · Capa de datos
   Modelo entidad-relación (sección 4 del documento de arquitectura):
   PRODUCTOR, COMPRADOR, PRODUCTO, PRECIO_REFERENCIA, OFERTA, PEDIDO,
   ASIGNACION, VEHICULO, RUTA, PARADA_RUTA, LOTE, ALMACEN, PAGO_PRODUCTOR.
   Simula la base de datos relacional (PostgreSQL + PostGIS) con
   persistencia local en el navegador (localStorage).
   ========================================================================= */
window.RC = window.RC || {};

(function () {
  const KEY = 'raizcaribe:db:v3';
  const DIA = 864e5;

  /* ---------- utilidades de fecha ---------- */
  function hoy0() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function fecha(n) { const d = hoy0(); d.setDate(d.getDate() + (n || 0)); return d.toISOString().slice(0, 10); }
  function hora(n, h, m) { const d = hoy0(); d.setDate(d.getDate() + (n || 0)); d.setHours(h || 0, m || 0, 0, 0); return d.toISOString(); }

  /* ---------- generador pseudoaleatorio determinista ---------- */
  function rng(seed) { let s = seed % 2147483647; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

  /* ---------- catálogo base ---------- */
  const PRODUCTOS = [
    { id: 'PRO-01', nombre: 'Mango', categoria: 'Frutas', unidad: 'kg', vida_util_horas: 240, temp_min: 10, temp_max: 13, img: 'assets/img/mango.png', calidad_minima: 'B', descripcion: 'Mango de azúcar y Tommy cosechado en su punto, ideal para hoteles y restaurantes.' },
    { id: 'PRO-02', nombre: 'Yuca', categoria: 'Tubérculos', unidad: 'kg', vida_util_horas: 72, temp_min: 8, temp_max: 12, img: 'assets/img/yuca.png', calidad_minima: 'B', descripcion: 'Yuca criolla parafinada, seleccionada por calibre y limpieza.' },
    { id: 'PRO-03', nombre: 'Pescado fresco', categoria: 'Pescados', unidad: 'kg', vida_util_horas: 48, temp_min: 0, temp_max: 4, img: 'assets/img/pescado.png', calidad_minima: 'A', descripcion: 'Pesca artesanal del día (mojarra, sierra y pargo) en hielo.' },
    { id: 'PRO-04', nombre: 'Plátano', categoria: 'Plátanos', unidad: 'kg', vida_util_horas: 168, temp_min: 13, temp_max: 15, img: 'assets/img/platano.png', calidad_minima: 'B', descripcion: 'Plátano hartón verde de primera, en racimo o por kilo.' },
    { id: 'PRO-05', nombre: 'Ñame', categoria: 'Tubérculos', unidad: 'kg', vida_util_horas: 336, temp_min: 12, temp_max: 16, img: 'assets/img/name.svg', calidad_minima: 'B', descripcion: 'Ñame espino de los Montes de María, firme y sin golpes.' }
  ];
  const PRECIO_BASE = { 'PRO-01': 2750, 'PRO-02': 1180, 'PRO-03': 14200, 'PRO-04': 1560, 'PRO-05': 1980 };

  /* Coordenadas aproximadas (lat, lng) para el mapa y el motor de rutas */
  const PRODUCTORES_BASE = [
    { id: 'PRD-01', nombre: 'Finca La Esperanza', contacto: 'Ana Polo', tipo: 'Agricultor', municipio: 'Ciénaga', departamento: 'Magdalena', latitud: 11.006, longitud: -74.247, telefono: '+57 301 554 2210', estado: 'activo', productos: ['PRO-01', 'PRO-04'], hectareas: 18 },
    { id: 'PRD-02', nombre: 'Finca El Porvenir', contacto: 'Luis Herrera', tipo: 'Agricultor', municipio: 'Sabanalarga', departamento: 'Atlántico', latitud: 10.632, longitud: -74.921, telefono: '+57 300 482 1937', estado: 'activo', productos: ['PRO-02', 'PRO-04', 'PRO-05'], hectareas: 37 },
    { id: 'PRD-03', nombre: 'Pescadores de Bocachica', contacto: 'Wilmer Arrieta', tipo: 'Pescador artesanal', municipio: 'Cartagena', departamento: 'Bolívar', latitud: 10.322, longitud: -75.583, telefono: '+57 315 220 8741', estado: 'activo', productos: ['PRO-03'], hectareas: 0 },
    { id: 'PRD-04', nombre: 'Finca Santa Lucía', contacto: 'Marta Ortiz', tipo: 'Agricultor', municipio: 'Repelón', departamento: 'Atlántico', latitud: 10.494, longitud: -75.124, telefono: '+57 312 118 4455', estado: 'activo', productos: ['PRO-04', 'PRO-02'], hectareas: 22 },
    { id: 'PRD-05', nombre: 'Cooperativa Montes de María', contacto: 'Edilberto Romero', tipo: 'Asociación', municipio: 'El Carmen de Bolívar', departamento: 'Bolívar', latitud: 9.717, longitud: -75.122, telefono: '+57 318 760 3321', estado: 'activo', productos: ['PRO-05', 'PRO-02'], hectareas: 64 },
    { id: 'PRD-06', nombre: 'Finca Villa Sandra', contacto: 'Jorge Pérez', tipo: 'Agricultor', municipio: 'Zona Bananera', departamento: 'Magdalena', latitud: 10.771, longitud: -74.152, telefono: '+57 304 991 2087', estado: 'activo', productos: ['PRO-04', 'PRO-01'], hectareas: 26 },
    { id: 'PRD-07', nombre: 'Asopesca Ciénaga Grande', contacto: 'Yamile Cantillo', tipo: 'Asociación', municipio: 'Pueblo Viejo', departamento: 'Magdalena', latitud: 10.993, longitud: -74.283, telefono: '+57 311 402 7765', estado: 'en_evaluacion', productos: ['PRO-03'], hectareas: 0 },
    { id: 'PRD-08', nombre: 'Finca Los Almendros', contacto: 'Ramiro Díaz', tipo: 'Agricultor', municipio: 'Luruaco', departamento: 'Atlántico', latitud: 10.611, longitud: -75.142, telefono: '+57 300 774 1290', estado: 'pendiente', productos: ['PRO-02'], hectareas: 9 }
  ];
  const MUNICIPIOS = [
    ['Baranoa', 'Atlántico', 10.795, -74.916], ['Sabanagrande', 'Atlántico', 10.792, -74.756], ['Campo de la Cruz', 'Atlántico', 10.378, -74.882], ['Manatí', 'Atlántico', 10.449, -74.958],
    ['Santa Marta', 'Magdalena', 11.15, -74.13], ['Aracataca', 'Magdalena', 10.592, -74.19], ['Fundación', 'Magdalena', 10.521, -74.185], ['El Retén', 'Magdalena', 10.611, -74.268],
    ['Turbaco', 'Bolívar', 10.332, -75.413], ['Arjona', 'Bolívar', 10.255, -75.344], ['San Jacinto', 'Bolívar', 9.831, -75.121], ['María La Baja', 'Bolívar', 9.982, -75.3]
  ];
  const NOMBRES = ['Rosa', 'Elkin', 'Dairo', 'Nelly', 'Yesid', 'Marelvis', 'Osvaldo', 'Liney', 'Fredy', 'Yuranis', 'Álvaro', 'Ledys', 'Hernando', 'Katia', 'Rafael', 'Iris', 'Benjamín', 'Zully', 'Arnulfo', 'Neidis'];
  const APELLIDOS = ['Barrios', 'Cassiani', 'Mercado', 'Pacheco', 'Orozco', 'Julio', 'Torres', 'De Ávila', 'Charris', 'Villa', 'Peña', 'Fontalvo', 'Navarro', 'Ruiz', 'Montes'];
  const FINCAS = ['Finca', 'Parcela', 'Granja', 'Finca', 'Hacienda'];
  const FINCA_NOM = ['El Paraíso', 'La Fe', 'Buenos Aires', 'Las Palmas', 'El Recreo', 'San José', 'La Gloria', 'Villa Luz', 'El Edén', 'La Bonanza', 'Los Mangos', 'El Cardón', 'La Ceiba', 'Bella Vista', 'El Totumo'];

  const COMPRADORES = [
    { id: 'CMP-01', razon_social: 'Hotel Caribe Plaza', nit: '900.456.781-3', tipo_comprador: 'Hotel', municipio: 'Cartagena', departamento: 'Bolívar', latitud: 10.42, longitud: -75.55, estado: 'activo', contacto: 'Daniela Gómez · Compras' },
    { id: 'CMP-02', razon_social: 'Supermercado La Costeña', nit: '901.223.004-1', tipo_comprador: 'Supermercado', municipio: 'Barranquilla', departamento: 'Atlántico', latitud: 10.99, longitud: -74.81, estado: 'activo', contacto: 'Andrés Rada' },
    { id: 'CMP-03', razon_social: 'Restaurante Sabor de Mar', nit: '900.778.315-6', tipo_comprador: 'Restaurante', municipio: 'Santa Marta', departamento: 'Magdalena', latitud: 11.24, longitud: -74.2, estado: 'activo', contacto: 'Camila Daza' },
    { id: 'CMP-04', razon_social: 'Exportadora Tropical S.A.S.', nit: '901.540.662-9', tipo_comprador: 'Exportador', municipio: 'Barranquilla', departamento: 'Atlántico', latitud: 10.95, longitud: -74.78, estado: 'activo', contacto: 'Mauricio Lara' },
    { id: 'CMP-05', razon_social: 'Hotel Sierra Azul', nit: '900.112.908-4', tipo_comprador: 'Hotel', municipio: 'Santa Marta', departamento: 'Magdalena', latitud: 11.21, longitud: -74.22, estado: 'activo', contacto: 'Paola Cuello' },
    { id: 'CMP-06', razon_social: 'Mercados del Río', nit: '901.007.553-2', tipo_comprador: 'Supermercado', municipio: 'Ciénaga', departamento: 'Magdalena', latitud: 11.0, longitud: -74.25, estado: 'activo', contacto: 'Iván Ospino' },
    { id: 'CMP-07', razon_social: 'Bocagrande Gourmet', nit: '900.880.127-0', tipo_comprador: 'Restaurante', municipio: 'Cartagena', departamento: 'Bolívar', latitud: 10.4, longitud: -75.555, estado: 'activo', contacto: 'Laura Vélez' },
    { id: 'CMP-08', razon_social: 'Supermercado El Ahorro', nit: '901.665.310-8', tipo_comprador: 'Supermercado', municipio: 'Soledad', departamento: 'Atlántico', latitud: 10.91, longitud: -74.77, estado: 'en_evaluacion', contacto: 'Gustavo Pérez' }
  ];

  const ALMACENES = [
    { id: 'ALM-01', nombre: 'Centro de acopio Barranquilla', municipio: 'Barranquilla', latitud: 10.963, longitud: -74.796, capacidad_kg: 20000, temp_objetivo: '2–14 °C por zona' },
    { id: 'ALM-02', nombre: 'Centro de acopio Cartagena', municipio: 'Cartagena', latitud: 10.39, longitud: -75.49, capacidad_kg: 12000, temp_objetivo: '2–14 °C por zona' }
  ];
  const VEHICULOS = [
    { id: 'VEH-01', placa: 'ABC-123', tipo_vehiculo: 'Camión 4,5 t', capacidad_kg: 4000, refrigerado: true, estado: 'en_ruta', conductor: 'Carlos Mendoza' },
    { id: 'VEH-02', placa: 'XTZ-908', tipo_vehiculo: 'Camión 3,5 t', capacidad_kg: 3000, refrigerado: true, estado: 'en_ruta', conductor: 'Rubén Ariza' },
    { id: 'VEH-03', placa: 'JKL-552', tipo_vehiculo: 'Furgón refrigerado 2,5 t', capacidad_kg: 2500, refrigerado: true, estado: 'en_ruta', conductor: 'Néstor Lobo' },
    { id: 'VEH-04', placa: 'MNB-317', tipo_vehiculo: 'Camión 4,5 t', capacidad_kg: 4000, refrigerado: true, estado: 'disponible', conductor: 'Aldo Pineda' },
    { id: 'VEH-05', placa: 'QWE-641', tipo_vehiculo: 'Furgón 2,5 t', capacidad_kg: 2500, refrigerado: false, estado: 'disponible', conductor: 'Henry Salas' },
    { id: 'VEH-06', placa: 'RTY-205', tipo_vehiculo: 'Camión 3,5 t', capacidad_kg: 3000, refrigerado: true, estado: 'disponible', conductor: 'Óscar Ibáñez' }
  ];

  /* =====================================================================
     SEMILLA: genera un estado inicial coherente con las reglas de negocio
     ===================================================================== */
  function seed() {
    const r = rng(20261125);
    const pick = function (a) { return a[Math.floor(r() * a.length)]; };
    const round = function (n, step) { return Math.round(n / step) * step; };
    const S = {
      meta: { version: 3, creado: new Date().toISOString(), comision: 0.08, costo_km: 3200, costo_fijo_ruta: 180000 },
      sesion: { rol: null },
      productos: PRODUCTOS.map(function (p) { return Object.assign({}, p); }),
      precios: [], productores: [], compradores: COMPRADORES.map(function (c) { return Object.assign({}, c, { fecha_vinculacion: fecha(-200 - Math.floor(r() * 300)) }); }),
      ofertas: [], pedidos: [], asignaciones: [], vehiculos: VEHICULOS.map(function (v) { return Object.assign({}, v); }),
      rutas: [], paradas: [], lotes: [], almacenes: ALMACENES.map(function (a) { return Object.assign({}, a); }), pagos: [],
      parcelas: [], carrito: {}, notificaciones: [], eventos: [], incidencias: [], cola_sync: [], online: { productor: true, conductor: true },
      seq: { oferta: 300, pedido: 1090, asignacion: 900, parada: 80, lote: 419, pago: 230, ruta: 17, notif: 1, evento: 1, incidencia: 30, solicitud: 2041 }
    };

    /* PRECIO_REFERENCIA: 8 semanas por producto (PR-4) */
    S.productos.forEach(function (p) {
      for (let w = 7; w >= 0; w--) {
        const base = PRECIO_BASE[p.id];
        const v = base * (0.92 + 0.02 * (7 - w) * 0.6 + (r() - 0.5) * 0.06);
        S.precios.push({ id: 'PRE-' + p.id.slice(4) + '-' + (8 - w), id_producto: p.id, fecha: fecha(-7 * w), precio_kg: round(v, 10), fuente: 'SIPSA · referencia mayorista' });
      }
    });

    /* PRODUCTORES: 8 detallados + red generada hasta 68 */
    PRODUCTORES_BASE.forEach(function (p, i) { S.productores.push(Object.assign({}, p, { fecha_vinculacion: fecha(-400 + i * 23) })); });
    for (let i = 9; i <= 68; i++) {
      const m = pick(MUNICIPIOS);
      const pesc = r() < 0.12;
      const prods = pesc ? ['PRO-03'] : [pick(['PRO-01', 'PRO-02', 'PRO-04', 'PRO-05'])];
      if (!pesc && r() < 0.4) { const extra = pick(['PRO-01', 'PRO-02', 'PRO-04', 'PRO-05']); if (prods.indexOf(extra) < 0) prods.push(extra); }
      const est = i > 64 ? (i % 2 ? 'en_evaluacion' : 'pendiente') : 'activo';
      S.productores.push({
        id: 'PRD-' + String(i).padStart(2, '0'),
        nombre: pesc ? 'Pescadores de ' + m[0] : pick(FINCAS) + ' ' + pick(FINCA_NOM),
        contacto: pick(NOMBRES) + ' ' + pick(APELLIDOS), tipo: pesc ? 'Pescador artesanal' : (r() < 0.15 ? 'Asociación' : 'Agricultor'),
        municipio: m[0], departamento: m[1], latitud: m[2] + (r() - 0.5) * 0.06, longitud: m[3] + (r() - 0.5) * 0.06,
        telefono: '+57 3' + Math.floor(10 + r() * 89) + ' ' + Math.floor(100 + r() * 899) + ' ' + Math.floor(1000 + r() * 8999),
        estado: est, productos: prods, hectareas: pesc ? 0 : Math.floor(3 + r() * 30), fecha_vinculacion: fecha(-Math.floor(20 + r() * 500))
      });
    }

    /* helpers de inserción */
    const nuevaOferta = function (o) {
      const id = 'OFE-' + (S.seq.oferta++);
      const row = Object.assign({ id: id, kg_reservado: 0, estado: 'publicada', creada: hora(-1, 9) }, o);
      S.ofertas.push(row); return row;
    };
    const paradaDe = function (ruta, productorId, orden, hEst, estado) {
      let pa = S.paradas.find(function (x) { return x.id_ruta === ruta.id && x.id_productor === productorId; });
      if (!pa) {
        pa = { id: 'PAR-' + String(S.seq.parada++).padStart(4, '0'), id_ruta: ruta.id, id_productor: productorId, orden_parada: orden, hora_estimada: hEst, hora_real: estado === 'recogido' ? new Date(new Date(hEst).getTime() + 10 * 60000).toISOString() : null, estado: estado || 'pendiente' };
        S.paradas.push(pa);
      }
      return pa;
    };
    const precioActual = function (pid) { const h = S.precios.filter(function (x) { return x.id_producto === pid; }); return h[h.length - 1].precio_kg; };
    const productoresDe = function (pid, soloActivos) { return S.productores.filter(function (p) { return p.productos.indexOf(pid) >= 0 && (!soloActivos || p.estado === 'activo'); }); };

    /* Crea un pedido con su asignación a ofertas (reservadas) */
    const crearPedido = function (o) {
      const id = o.id || 'PED-' + (S.seq.pedido++);
      const precio = o.precio || round(precioActual(o.producto) * 1.0, 10);
      const ped = { id: id, solicitud: o.solicitud || ('SOL-' + (1900 + Math.floor(r() * 140))), id_comprador: o.comprador, id_producto: o.producto, cantidad_kg: o.kg, precio_kg_acordado: precio, fecha_requerida: o.requerida, fecha_entrega: o.entrega || null, estado: o.estado, creado: o.creado || hora(-1, 15), a_tiempo: o.a_tiempo !== false, direccion: o.direccion || null };
      S.pedidos.push(ped);
      if (o.estado === 'pendiente' || o.estado === 'rechazado') return ped;
      const prods = o.productores || [pick(productoresDe(o.producto, true)).id];
      let resto = o.kg;
      prods.forEach(function (prId, k) {
        const kg = k === prods.length - 1 ? resto : round(o.kg / prods.length, 50);
        resto -= kg;
        const of = nuevaOferta({ id_productor: prId, id_producto: o.producto, cantidad_kg: kg, precio_kg_solicitado: round(precio * (0.97 + r() * 0.04), 10), fecha_cosecha: o.cosecha || fecha(-1), ventana_inicio: '05:00', ventana_fin: '09:00', kg_reservado: kg, estado: 'asignada', creada: hora(-3, 8) });
        const asg = { id: 'ASG-' + (S.seq.asignacion++), id_pedido: id, id_oferta: of.id, id_parada: null, kg_asignados: kg, kg_conformes: null, motivo_no_conformidad: null, estado: 'asignada' };
        S.asignaciones.push(asg);
        if (o.ruta) {
          const pa = paradaDe(o.ruta, prId, (o.orden || 1) + k, o.horaEst || o.ruta.hora_salida, o.paradaEstado);
          asg.id_parada = pa.id;
        }
        if (o.lote) {
          const tp = S.productos.find(function (p) { return p.id === o.producto; });
          const rech = o.estado === 'recibido' ? round(kg * (r() < 0.25 ? 0.03 + r() * 0.05 : r() * 0.015), 1) : 0;
          const temp = +(tp.temp_min + (tp.temp_max - tp.temp_min) * (0.25 + r() * 0.5)).toFixed(1);
          const lote = { id: 'L-' + String(S.seq.lote++).padStart(6, '0'), id_asignacion: asg.id, id_almacen: ('entradaAlm' in o && !o.entradaAlm) ? null : (o.almacen || 'ALM-01'), kg_recolectados: kg, kg_rechazados: rech, grado_calidad: rech > kg * 0.04 ? 'B' : 'A', temperatura_c: temp, fecha_hora_recoleccion: o.horaLote || hora(-2, 6, 10), fecha_hora_entrada_almacen: 'entradaAlm' in o ? o.entradaAlm : hora(-2, 11, 30), fecha_hora_salida_almacen: 'salidaAlm' in o ? o.salidaAlm : hora(-2, 15), qr: 'RC-' + id + '-' + (k + 1) };
          S.lotes.push(lote);
          if (o.estado === 'recibido') {
            asg.kg_conformes = +(kg - rech - (r() < 0.15 ? round(kg * 0.01, 1) : 0)).toFixed(1);
            if (asg.kg_conformes < kg - rech) asg.motivo_no_conformidad = 'Diferencia de peso en recepción';
            asg.estado = 'liquidada';
            const bruto = Math.round(asg.kg_conformes * precio);
            const com = Math.round(bruto * S.meta.comision);
            S.pagos.push({ id: 'PAG-' + (S.seq.pago++), id_asignacion: asg.id, valor_bruto: bruto, comision: com, neto: bruto - com, estado: o.pagoEstado || 'pagado', fecha: o.entrega || fecha(-1), referencia: 'TRF-' + Math.floor(100000 + r() * 899999) });
          }
        }
      });
      return ped;
    };

    /* ---------- HISTÓRICO: 26 pedidos recibidos (25 a tiempo → 96 %) ---------- */
    const activos = S.compradores.filter(function (c) { return c.estado === 'activo'; });
    let pendPorvenir = 0;
    for (let i = 0; i < 26; i++) {
      const pid = pick(['PRO-01', 'PRO-02', 'PRO-03', 'PRO-04', 'PRO-05']);
      const d = -(2 + Math.floor(i * 1.1));
      const prodsPr = productoresDe(pid, true);
      /* Cada cuarto pedido histórico lo cubre la Finca El Porvenir (PRD-02) si produce ese producto */
      const delPorvenirHist = i % 4 === 0 && ['PRO-02', 'PRO-04', 'PRO-05'].indexOf(pid) >= 0;
      const prs = delPorvenirHist ? ['PRD-02'] : [pick(prodsPr).id];
      /* Los dos pagos más recientes de El Porvenir quedan pendientes (pasarela en proceso) */
      const pagoPend = delPorvenirHist && pendPorvenir < 2 && (pendPorvenir += 1) > 0;
      crearPedido({
        id: 'PED-' + (1040 + i), comprador: (i % 5 === 0 ? 'CMP-01' : pick(activos).id), producto: pid, kg: round(400 + r() * 1800, 50),
        requerida: fecha(d), entrega: fecha(d + (i === 9 ? 1 : 0)), estado: 'recibido', a_tiempo: i !== 9, creado: hora(d - 2, 10),
        productores: prs, lote: true, horaLote: hora(d - 1, 6, 5), entradaAlm: hora(d - 1, 10, 40), salidaAlm: hora(d, 6, 30),
        pagoEstado: pagoPend ? 'pendiente' : 'pagado', almacen: pick(['ALM-01', 'ALM-02'])
      });
    }

    /* ---------- RUTAS DEL DÍA (6) + mañana (1) ---------- */
    const mkRuta = function (num, veh, dia, salida, estado, km) {
      const ru = { id: 'R-' + num, id_vehiculo: veh, fecha: fecha(dia), hora_salida: salida, distancia_km: km, costo_total: Math.round(km * S.meta.costo_km + S.meta.costo_fijo_ruta), estado: estado, destino: null };
      S.rutas.push(ru); return ru;
    };
    const R10 = mkRuta(10, 'VEH-02', 0, '04:30', 'en_curso', 126);
    const R11 = mkRuta(11, 'VEH-03', 0, '05:00', 'en_curso', 98);
    const R12 = mkRuta(12, 'VEH-01', 0, '05:00', 'en_curso', 214);
    const R13 = mkRuta(13, 'VEH-04', 0, '13:00', 'programada', 142);
    const R14 = mkRuta(14, 'VEH-05', 0, '14:00', 'programada', 88);
    const R15 = mkRuta(15, 'VEH-06', 0, '15:30', 'programada', 117);
    const R16 = mkRuta(16, 'VEH-01', 1, '05:30', 'programada', 156);
    R10.destino = 'ALM-01'; R11.destino = 'ALM-01'; R12.destino = 'ALM-02'; R13.destino = 'ALM-01'; R14.destino = 'ALM-01'; R15.destino = 'ALM-02'; R16.destino = 'ALM-01';

    /* ---------- PEDIDOS ACTIVOS GENERADOS (17) ---------- */
    const plan = [
      [R10, 'PRO-01', 'CMP-02', 900, ['PRD-01'], 'en_ruta', 'recogido'], [R10, 'PRO-04', 'CMP-06', 1100, ['PRD-06'], 'en_ruta', 'recogido'], [R10, 'PRO-01', 'CMP-05', 700, ['PRD-06'], 'en_ruta', 'recogido'],
      [R11, 'PRO-03', 'CMP-03', 450, ['PRD-03'], 'en_ruta', 'recogido'], [R11, 'PRO-03', 'CMP-07', 380, ['PRD-03'], 'en_ruta', 'recogido'], [R11, 'PRO-02', 'CMP-04', 1200, ['PRD-04'], 'en_ruta', 'en_curso'],
      [R13, 'PRO-04', 'CMP-02', 1000, ['PRD-02'], 'aprobado'], [R13, 'PRO-01', 'CMP-04', 600, ['PRD-01'], 'aprobado'], [R13, 'PRO-04', 'CMP-06', 800, ['PRD-06'], 'aprobado'],
      [R14, 'PRO-05', 'CMP-02', 400, ['PRD-02'], 'aprobado'], [R14, 'PRO-04', 'CMP-04', 900, ['PRD-04'], 'aprobado'], [R14, 'PRO-05', 'CMP-06', 700, ['PRD-05'], 'aprobado'],
      [R15, 'PRO-02', 'CMP-07', 700, ['PRD-02'], 'aprobado'], [R15, 'PRO-03', 'CMP-01', 300, ['PRD-03'], 'aprobado'], [R15, 'PRO-05', 'CMP-07', 900, ['PRD-05'], 'aprobado'],
      [R16, 'PRO-02', 'CMP-02', 1000, ['PRD-02'], 'aprobado']
    ];
    plan.forEach(function (p, i) {
      const enCurso = p[0].estado === 'en_curso';
      crearPedido({ id: 'PED-' + (1066 + i), comprador: p[2], producto: p[1], kg: p[3], productores: p[4], estado: p[5], requerida: p[0].fecha, ruta: p[0], orden: i % 3 + 1, horaEst: hora(p[0] === R16 ? 1 : 0, parseInt(p[0].hora_salida, 10) + (i % 3) + 1, 10), paradaEstado: p[6] || 'pendiente', lote: enCurso && p[6] === 'recogido', horaLote: hora(0, 5 + (i % 3), 20), entradaAlm: null, salidaAlm: null, creado: hora(-1, 11 + (i % 5)) });
    });
    /* PED-1082: entregado hoy al Hotel Caribe Plaza, pendiente de confirmar recepción (PR-11) */
    crearPedido({ id: 'PED-1082', comprador: 'CMP-01', producto: 'PRO-01', kg: 500, productores: ['PRD-01'], estado: 'entregado', requerida: fecha(0), entrega: fecha(0), lote: true, horaLote: hora(-1, 6, 0), entradaAlm: hora(-1, 13, 10), salidaAlm: hora(0, 5, 45), creado: hora(-2, 9), almacen: 'ALM-02' });

    /* ---------- RUTA R-12 (app del conductor): Yuca → Plátano → Ñame → Cartagena ---------- */
    crearPedido({ id: 'PED-1087', solicitud: 'SOL-2038', comprador: 'CMP-01', producto: 'PRO-02', kg: 2000, productores: ['PRD-02'], estado: 'en_ruta', requerida: fecha(0), ruta: R12, orden: 1, horaEst: hora(0, 5, 30), paradaEstado: 'recogido', lote: true, horaLote: hora(0, 5, 40), entradaAlm: null, salidaAlm: null, creado: hora(-1, 8, 20) });
    crearPedido({ id: 'PED-1083', solicitud: 'SOL-2035', comprador: 'CMP-07', producto: 'PRO-04', kg: 1200, productores: ['PRD-04'], estado: 'en_ruta', requerida: fecha(0), ruta: R12, orden: 2, horaEst: hora(0, 7, 10), paradaEstado: 'en_curso', creado: hora(-1, 9, 5) });
    crearPedido({ id: 'PED-1084', solicitud: 'SOL-2038', comprador: 'CMP-01', producto: 'PRO-05', kg: 600, productores: ['PRD-05'], estado: 'en_ruta', requerida: fecha(0), ruta: R12, orden: 3, horaEst: hora(0, 9, 20), paradaEstado: 'pendiente', creado: hora(-1, 8, 20) });
    S.lotes.forEach(function (l) { if (l.qr === 'RC-PED-1087-1') { l.id = 'L-000418'; l.kg_recolectados = 2000; l.temperatura_c = 9.6; l.grado_calidad = 'A'; l.id_almacen = null; } });

    /* ---------- Aprobados y pendientes del mockup ---------- */
    crearPedido({ id: 'PED-1086', comprador: 'CMP-04', producto: 'PRO-04', kg: 1200, productores: ['PRD-02', 'PRD-06'], estado: 'aprobado', requerida: fecha(1), ruta: R13, orden: 4, horaEst: hora(0, 16, 0), creado: hora(0, 7, 30) });
    crearPedido({ id: 'PED-1088', comprador: 'CMP-03', producto: 'PRO-04', kg: 900, productores: ['PRD-06'], estado: 'aprobado', requerida: fecha(1), ruta: R16, orden: 2, horaEst: hora(1, 7, 0), creado: hora(0, 8, 15) });
    crearPedido({ id: 'PED-1085', comprador: 'CMP-07', producto: 'PRO-05', kg: 600, estado: 'pendiente', requerida: fecha(2), creado: hora(0, 9, 2) });
    crearPedido({ id: 'PED-1089', comprador: 'CMP-02', producto: 'PRO-02', kg: 1500, estado: 'pendiente', requerida: fecha(2), creado: hora(0, 9, 48) });

    /* ---------- OFERTAS PUBLICADAS (catálogo disponible) ---------- */
    const pubs = [
      ['PRD-01', 'PRO-01', 2000, 2760, -1], ['PRD-06', 'PRO-01', 1800, 2800, 0], ['PRD-01', 'PRO-01', 1200, 2700, -2],
      ['PRD-02', 'PRO-02', 2500, 1200, 0], ['PRD-04', 'PRO-02', 2000, 1150, -1], ['PRD-05', 'PRO-02', 2000, 1180, 0], ['PRD-02', 'PRO-02', 1500, 1220, 1],
      ['PRD-03', 'PRO-03', 1500, 14200, 0], ['PRD-03', 'PRO-03', 1000, 14500, 0],
      ['PRD-04', 'PRO-04', 2000, 1550, -1], ['PRD-06', 'PRO-04', 2500, 1600, 0], ['PRD-02', 'PRO-04', 1500, 1580, 1],
      ['PRD-05', 'PRO-05', 2000, 2000, -1], ['PRD-02', 'PRO-05', 1200, 1950, 0]
    ];
    pubs.forEach(function (p) { nuevaOferta({ id_productor: p[0], id_producto: p[1], cantidad_kg: p[2], precio_kg_solicitado: p[3], fecha_cosecha: fecha(p[4]), ventana_inicio: '05:00', ventana_fin: '10:00', creada: hora(p[4] - 1, 16) }); });
    /* Historial de cosechas de PRD-02 hasta completar 12 publicadas */
    const delPorvenir = S.ofertas.filter(function (o) { return o.id_productor === 'PRD-02'; }).length;
    for (let i = delPorvenir; i < 12; i++) nuevaOferta({ id_productor: 'PRD-02', id_producto: pick(['PRO-02', 'PRO-04', 'PRO-05']), cantidad_kg: round(500 + r() * 1500, 50), precio_kg_solicitado: 1200, fecha_cosecha: fecha(-20 - i * 3), ventana_inicio: '05:00', ventana_fin: '09:00', kg_reservado: 0, estado: 'vencida', creada: hora(-21 - i * 3, 9) });

    /* ---------- Lotes de cultivo del productor (Mis lotes) ---------- */
    S.parcelas = [
      { id: 'L-006', id_productor: 'PRD-02', id_producto: 'PRO-02', hectareas: 12, estado: 'activo', siembra: fecha(-240), cosecha_estimada: fecha(3), rendimiento: '18 t/ha' },
      { id: 'L-005', id_productor: 'PRD-02', id_producto: 'PRO-04', hectareas: 8, estado: 'activo', siembra: fecha(-300), cosecha_estimada: fecha(10), rendimiento: '14 t/ha' },
      { id: 'L-004', id_productor: 'PRD-02', id_producto: 'PRO-05', hectareas: 6, estado: 'en_seguimiento', siembra: fecha(-200), cosecha_estimada: fecha(25), rendimiento: '11 t/ha', nota: 'Visita técnica por humedad del suelo' },
      { id: 'L-003', id_productor: 'PRD-02', id_producto: 'PRO-02', hectareas: 5, estado: 'activo', siembra: fecha(-180), cosecha_estimada: fecha(40), rendimiento: '17 t/ha' },
      { id: 'L-002', id_productor: 'PRD-02', id_producto: 'PRO-04', hectareas: 4, estado: 'activo', siembra: fecha(-150), cosecha_estimada: fecha(60), rendimiento: '13 t/ha' },
      { id: 'L-001', id_productor: 'PRD-02', id_producto: 'PRO-05', hectareas: 2, estado: 'en_descanso', siembra: fecha(-420), cosecha_estimada: null, rendimiento: '—' }
    ];

    /* ---------- Notificaciones iniciales ---------- */
    const N = function (rol, titulo, detalle, tipo, link, h) { S.notificaciones.push({ id: 'NOT-' + (S.seq.notif++), rol: rol, titulo: titulo, detalle: detalle, tipo: tipo || 'info', link: link || null, fecha: h || hora(0, 8), leida: false }); };
    N('comprador', 'PED-1082 fue entregado', 'Confirma la recepción para cerrar el pedido y liberar el pago al productor.', 'exito', '#/comprador/seguimiento/PED-1082', hora(0, 6, 40));
    N('comprador', 'Tu pedido PED-1087 va en ruta', 'Yuca 2.000 kg recogida en Sabanalarga a las 5:40 a. m.', 'info', '#/comprador/seguimiento/PED-1087', hora(0, 5, 42));
    N('productor', 'Recolección programada', 'Ruta R-16 pasará mañana a las 5:30 a. m. por tu finca (Yuca 1.000 kg).', 'info', '#/productor/entregas', hora(0, 7, 12));
    N('productor', 'Pago recibido', 'PAG-233 por $ 1.482.000 fue transferido a tu cuenta.', 'exito', '#/productor/pagos', hora(-1, 16, 20));
    N('conductor', 'Ruta R-12 asignada', '3 paradas · 3.800 kg · Camión refrigerado ABC-123.', 'info', '#/conductor/ruta', hora(0, 4, 30));
    N('admin', '2 pedidos pendientes de aprobación', 'PED-1085 (Ñame) y PED-1089 (Yuca) esperan asignación.', 'alerta', '#/admin/pedidos', hora(0, 9, 50));
    N('admin', 'Alerta de temperatura en R-11', 'Pescado fresco a 4,6 °C (rango 0–4 °C). Se notificó al conductor.', 'peligro', '#/admin/rutas', hora(0, 7, 5));

    /* ---------- Bitácora del bus de eventos ---------- */
    const EV = function (tipo, payload, h) { S.eventos.push({ id: 'EVT-' + (S.seq.evento++), tipo: tipo, payload: payload, fecha: h }); };
    EV('RutaProgramada', { id_ruta: 'R-12', paradas: 3, kg: 3800, vehiculo: 'ABC-123' }, hora(-1, 18, 0));
    EV('LoteRegistrado', { evento: 'LoteRegistrado', id_lote: 'L-000418', id_parada: 'PAR-R12-1', kg_recolectados: 2000, grado_calidad: 'A', temperatura_c: 9.6 }, hora(0, 5, 40));
    EV('PedidoRegistrado', { id_pedido: 'PED-1085', producto: 'Ñame', kg: 600 }, hora(0, 9, 2));
    EV('PedidoRegistrado', { id_pedido: 'PED-1089', producto: 'Yuca', kg: 1500 }, hora(0, 9, 48));

    S.incidencias.push({ id: 'INC-29', id_ruta: 'R-11', tipo: 'Temperatura fuera de rango', descripcion: 'Sensor del furgón reporta 4,6 °C en carga de pescado.', estado: 'en_atencion', fecha: hora(0, 7, 5), conductor: 'Néstor Lobo' });
    return S;
  }

  /* =====================================================================
     API de acceso a datos
     ===================================================================== */
  const db = {
    state: null,
    load: function () {
      try { const raw = localStorage.getItem(KEY); if (raw) { this.state = JSON.parse(raw); return this.state; } } catch (e) { /* almacenamiento no disponible */ }
      this.state = seed(); this.save(); return this.state;
    },
    save: function () { try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch (e) { /* sin persistencia */ } },
    reset: function () { this.state = seed(); this.save(); return this.state; },
    byId: function (tabla, id) { return (this.state[tabla] || []).find(function (x) { return x.id === id; }) || null; },
    where: function (tabla, fn) { return (this.state[tabla] || []).filter(fn); },
    insert: function (tabla, row) { this.state[tabla].push(row); return row; },
    update: function (tabla, id, patch) { const r = this.byId(tabla, id); if (r) Object.assign(r, patch); return r; },
    nextId: function (key, prefix, pad) { const n = this.state.seq[key]++; return prefix + (pad ? String(n).padStart(pad, '0') : n); },
    util: { fecha: fecha, hora: hora, hoy0: hoy0, DIA: DIA }
  };
  RC.db = db;
})();
