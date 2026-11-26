/* =========================================================================
   RaízCaribe · Librería de interfaz
   Componentes (HTML), mapa del Caribe, gráficos, modales, toasts y efectos.
   ========================================================================= */
window.RC = window.RC || {};

(function () {
  const I = RC.icon;
  const ui = {};

  /* ======================= FORMATOS ======================= */
  ui.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  ui.num = function (n, d) { return (+n || 0).toLocaleString('es-CO', { maximumFractionDigits: d == null ? 0 : d, minimumFractionDigits: 0 }); };
  ui.money = function (n) { return '$ ' + Math.round(+n || 0).toLocaleString('es-CO'); };
  ui.kg = function (n) { return ui.num(n, 1) + ' kg'; };
  ui.pct = function (n, d) { return ((+n || 0) * 100).toLocaleString('es-CO', { maximumFractionDigits: d == null ? 0 : d }) + ' %'; };
  const toDate = function (iso) { return new Date(String(iso).length === 10 ? iso + 'T12:00:00' : iso); };
  ui.fecha = function (iso, o) { return iso ? toDate(iso).toLocaleDateString('es-CO', o || { day: 'numeric', month: 'short' }) : '—'; };
  ui.hora = function (iso) { return iso ? toDate(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : '—'; };
  ui.dia = function (iso) {
    if (!iso) return '—';
    const d = toDate(iso); const h = new Date(); h.setHours(12, 0, 0, 0); const dd = new Date(d); dd.setHours(12, 0, 0, 0);
    const diff = Math.round((dd - h) / 864e5);
    if (diff === 0) return 'Hoy'; if (diff === 1) return 'Mañana'; if (diff === -1) return 'Ayer';
    return ui.fecha(iso, { weekday: 'short', day: 'numeric', month: 'short' });
  };
  ui.cuando = function (iso) { return ui.dia(iso) + ', ' + ui.hora(iso); };
  ui.hace = function (iso) {
    const s = (Date.now() - toDate(iso).getTime()) / 1000;
    if (s < 60) return 'hace un momento'; if (s < 3600) return 'hace ' + Math.floor(s / 60) + ' min';
    if (s < 86400) return 'hace ' + Math.floor(s / 3600) + ' h'; return ui.fecha(iso);
  };
  ui.iniciales = function (t) { return String(t).split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase(); };

  /* ======================= MARCA ======================= */
  const LEAF = '<svg class="logo__leaf" viewBox="0 0 16 17" aria-hidden="true"><path d="M2.5 16C2 9 6 3.2 15 1c.6 8.4-4.6 13.7-12.5 15z" fill="#45A548"/><path d="M3 15.5C6 11 9 7.6 12.6 4.4" stroke="#1B5E33" stroke-width="1.3" fill="none" stroke-linecap="round"/></svg>';
  ui.logo = function (o) {
    o = o || {};
    const style = (o.size ? '--logo-size:' + o.size + 'px;' : '') + (o.tagSize ? '--tag-size:' + o.tagSize + 'px;' : '');
    const word = '<span class="logo__word" aria-label="RaízCaribe"><span class="logo__raiz">RA<span class="logo__i">I' + LEAF + '</span>Z</span><span class="logo__caribe">CARIBE</span></span>';
    const tag = o.tag === false ? '' : '<span class="logo__sep"></span><span class="logo__tag">Del campo Caribe a más mesas<svg viewBox="0 0 110 8" preserveAspectRatio="none"><path d="M3 6.5C30 1.5 70 .8 107 3.4" stroke="#F39324" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg></span>';
    return '<span class="logo ' + (o.stack ? 'logo--stack' : '') + '" style="' + style + '">' + word + tag + '</span>';
  };

  /* ======================= COMPONENTES ======================= */
  ui.btn = function (o) {
    const cls = ['btn', 'btn--' + (o.variant || 'primary'), o.size ? 'btn--' + o.size : '', o.block ? 'btn--block' : '', o.cls || ''].join(' ');
    const attrs = (o.action ? ' data-action="' + o.action + '"' : '') + (o.go ? ' data-go="' + o.go + '"' : '') + (o.attrs || '') + (o.disabled ? ' disabled' : '');
    const ic = o.icon ? I(o.icon, o.size === 'sm' || o.size === 'xs' ? 17 : 20) : '';
    const ir = o.iconRight ? I(o.iconRight, 18) : '';
    return '<button type="' + (o.type || 'button') + '" class="' + cls + '"' + attrs + '>' + ic + (o.label != null ? '<span>' + o.label + '</span>' : '') + ir + '</button>';
  };
  ui.chip = function (text, tone, o) {
    o = o || {};
    return '<span class="chip chip--' + (tone || 'neutral') + (o.live ? ' chip--live' : '') + '">' + (o.dot || o.live ? '<span class="chip__dot"></span>' : '') + (o.icon ? I(o.icon, 14) : '') + ui.esc(text) + '</span>';
  };
  const ESTADOS = {
    pendiente: ['Pendiente', 'warning'], aprobado: ['Aprobado', 'success'], en_ruta: ['En ruta', 'success', true], entregado: ['Entregado', 'info'], recibido: ['Completado', 'neutral'],
    rechazado: ['Rechazado', 'danger'], sin_cobertura: ['Sin cobertura', 'danger'], publicada: ['Publicada', 'success'], asignada: ['Asignada', 'info'], vencida: ['Vencida', 'neutral'],
    pagado: ['Pagado', 'success'], procesando: ['Procesando', 'warning', true], fallido: ['Fallido', 'danger'], activo: ['Activo', 'success'], en_evaluacion: ['En evaluación', 'warning'],
    plan_mejora: ['Plan de mejora', 'danger'], en_seguimiento: ['En seguimiento', 'warning'], en_descanso: ['En descanso', 'neutral'], programada: ['Programada', 'neutral'],
    en_curso: ['En curso', 'warning', true], completada: ['Completada', 'success'], recogido: ['Recogido', 'success'], abierta: ['Abierta', 'danger'], en_atencion: ['En atención', 'warning'], resuelta: ['Resuelta', 'success'],
    liquidada: ['Liquidada', 'success'], en_entrega: ['En entrega', 'info', true]
  };
  ui.estado = function (e, extra) {
    if (e === 'pendiente' && extra === 'productor') return ui.chip('Pendiente activación', 'warning');
    const m = ESTADOS[e] || [e, 'neutral'];
    return ui.chip(m[0], m[1], { live: m[2] });
  };
  ui.iconBox = function (icon, tone, size) { return '<span class="icon-box ' + (tone ? 'icon-box--' + tone : '') + ' ' + (size ? 'icon-box--' + size : '') + '">' + I(icon, size === 'lg' ? 26 : size === 'sm' ? 18 : 22) + '</span>'; };
  ui.cardTitle = function (icon, title, right, tone) {
    return '<div class="card-title">' + (icon ? ui.iconBox(icon, tone) : '') + '<h3>' + title + '</h3>' + (right || '') + '</div>';
  };
  ui.kpi = function (o) {
    const val = o.count != null ? '<span data-count="' + o.count + '" data-format="' + (o.format || 'num') + '">0</span>' : o.value;
    return '<div class="kpi ' + (o.tone === 'orange' ? 'kpi--orange' : '') + (o.compact ? ' kpi--compact' : '') + '"' + (o.go ? ' data-go="' + o.go + '" style="cursor:pointer"' : '') + '>' +
      '<div class="kpi__head">' + ui.iconBox(o.icon, o.tone === 'orange' ? 'orange' : (o.tone === 'blue' ? 'blue' : ''), o.compact ? 'sm' : null).replace('icon-box', 'icon-box icon-box--round') +
      (o.compact ? '<div><div class="kpi__label">' + o.label + '</div><div class="kpi__value">' + val + '</div></div>' : '<div class="kpi__label">' + o.label + '</div>') + '</div>' +
      (o.compact ? '' : '<div class="kpi__value">' + val + '</div>') +
      (o.foot ? '<div class="kpi__foot ' + (o.footTone || '') + '">' + o.foot + '</div>' : '') + '</div>';
  };
  ui.stepper = function (steps, current, o) {
    o = o || {};
    const n = steps.length;
    const fill = current <= 0 ? 0 : Math.min(current, n - 1) / (n - 1) * 100 * (n - 1) / n;
    return '<div class="stepper" style="--n:' + n + '"><div class="stepper__track"></div><div class="stepper__fill" data-fill="' + fill + '%"></div>' +
      steps.map(function (s, i) {
        const st = o.allDone || i < current ? 'is-done' : (i === current ? 'is-current' : 'is-pending');
        return '<div class="step ' + st + '"><span class="step__dot">' + (st === 'is-done' ? I('check', 16) : '') + '</span><span class="step__label">' + s.label + '</span>' + (s.sub ? '<span class="step__sub">' + s.sub + '</span>' : '') + '</div>';
      }).join('') + '</div>';
  };
  ui.timeline = function (items) {
    return '<div class="timeline">' + items.map(function (it) {
      const st = it.state === 'done' ? 'is-done' : it.state === 'current' ? 'is-current' : 'is-pending';
      return '<div class="tl ' + st + '"><span class="tl__dot">' + (st === 'is-done' ? I('check', 13) : '') + '</span><div><div class="tl__title">' + it.title + '</div>' + (it.sub ? '<div class="tl__sub">' + it.sub + '</div>' : '') + (it.extra || '') + '</div></div>';
    }).join('') + '</div>';
  };
  ui.field = function (o) {
    const id = o.id || ('f-' + (o.name || Math.random().toString(36).slice(2, 7)));
    let control;
    const common = ' id="' + id + '" name="' + (o.name || '') + '"' + (o.required ? ' required' : '') + (o.attrs || '');
    if (o.options) {
      control = '<div class="control control--select">' + (o.icon ? I(o.icon, 20) : '') + '<select' + common + '>' + o.options.map(function (op) {
        const v = typeof op === 'string' ? op : op.value; const t = typeof op === 'string' ? op : op.label;
        return '<option value="' + ui.esc(v) + '"' + (String(v) === String(o.value) ? ' selected' : '') + '>' + ui.esc(t) + '</option>';
      }).join('') + '</select></div>';
    } else if (o.area) {
      control = '<div class="control control--area">' + '<textarea' + common + ' placeholder="' + ui.esc(o.placeholder || '') + '">' + ui.esc(o.value || '') + '</textarea></div>';
    } else {
      control = '<div class="control ' + (o.size ? 'control--' + o.size : '') + '">' + (o.icon ? I(o.icon, 20) : '') + '<input type="' + (o.type || 'text') + '"' + common + ' value="' + ui.esc(o.value == null ? '' : o.value) + '" placeholder="' + ui.esc(o.placeholder || '') + '"' +
        (o.min != null ? ' min="' + o.min + '"' : '') + (o.max != null ? ' max="' + o.max + '"' : '') + (o.step != null ? ' step="' + o.step + '"' : '') + ' autocomplete="off">' + (o.suffix ? '<span class="control__suffix">' + o.suffix + '</span>' : '') + (o.right || '') + '</div>';
    }
    return '<label class="field ' + (o.cls || '') + '" for="' + id + '">' + (o.label ? '<span class="field__label">' + o.label + (o.labelRight || '') + '</span>' : '') + control + (o.hint ? '<span class="field__hint" data-hint="' + (o.name || '') + '">' + o.hint + '</span>' : '<span class="field__hint" data-hint="' + (o.name || '') + '"></span>') + '</label>';
  };
  ui.empty = function (o) {
    return '<div class="empty"><span class="empty__icon">' + I(o.icon || 'package', 30) + '</span><div class="h3">' + o.title + '</div>' + (o.text ? '<p class="t-body" style="max-width:340px">' + o.text + '</p>' : '') + (o.action || '') + '</div>';
  };
  ui.progress = function (p, tone) { return '<div class="progress ' + (tone ? 'progress--' + tone : '') + '"><div class="progress__bar" data-w="' + Math.min(100, Math.round(p * 100)) + '%" style="width:0"></div></div>'; };
  ui.callout = function (icon, html, tone) { return '<div class="callout ' + (tone ? 'callout--' + tone : '') + '">' + I(icon || 'info', 18) + '<div>' + html + '</div></div>'; };
  ui.rule = function (code) { return '<span class="tag-rule" title="Regla de negocio / proceso del documento de arquitectura">' + code + '</span>'; };

  /* Código QR (patrón determinista a partir de un texto) */
  ui.qr = function (text, size) {
    let h = 0; for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
    const N = 21; let cells = '';
    const finder = function (x, y) { return '<rect x="' + x + '" y="' + y + '" width="7" height="7" rx="1.2" fill="#123D26"/><rect x="' + (x + 1) + '" y="' + (y + 1) + '" width="5" height="5" rx=".8" fill="#fff"/><rect x="' + (x + 2) + '" y="' + (y + 2) + '" width="3" height="3" rx=".5" fill="#123D26"/>'; };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if ((x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12)) continue;
      h = (h * 1103515245 + 12345) & 0x7fffffff;
      if (h % 100 < 47) cells += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="#123D26"/>';
    }
    return '<svg width="' + (size || 120) + '" height="' + (size || 120) + '" viewBox="-1 -1 23 23" shape-rendering="crispEdges" aria-label="Código QR ' + ui.esc(text) + '"><rect x="-1" y="-1" width="23" height="23" fill="#fff"/>' + cells + finder(0, 0) + finder(14, 0) + finder(0, 14) + '</svg>';
  };

  /* Paisaje (colinas, sol, palmeras) para fondos */
  function palm(x, baseY, h, lean, cls) {
    const cx = x + lean, cy = baseY - h, s = h / 80;
    const fr = function (a, b, c, d, e, g, col) { return '<path d="M' + cx + ' ' + cy + ' Q ' + (cx + a * s) + ' ' + (cy + b * s) + ' ' + (cx + c * s) + ' ' + (cy + d * s) + ' Q ' + (cx + e * s) + ' ' + (cy + g * s) + ' ' + cx + ' ' + cy + ' Z" fill="' + col + '"/>'; };
    return '<g class="' + (cls || 'palm') + '" style="transform-origin:' + x + 'px ' + baseY + 'px"><path d="M' + x + ' ' + baseY + ' C ' + (x + lean * 0.2) + ' ' + (baseY - h * 0.4) + ', ' + (x + lean * 0.6) + ' ' + (baseY - h * 0.8) + ', ' + cx + ' ' + cy + '" stroke="#6E8B3D" stroke-width="' + (h * 0.07).toFixed(1) + '" fill="none" stroke-linecap="round"/>' +
      fr(-30, -4, -40, 24, -22, 2, '#4E9A3A') + fr(30, -4, 40, 24, 22, 2, '#4E9A3A') + fr(-25, -18, -48, 6, -26, -6, '#3F8F35') + fr(25, -18, 48, 6, 26, -6, '#3F8F35') + fr(-15, -28, -34, -26, -16, -16, '#57A845') + fr(15, -28, 34, -26, 16, -16, '#57A845') + '</g>';
  }
  ui.landscape = function (o) {
    o = o || {};
    return '<svg class="landscape" viewBox="0 0 1440 220" preserveAspectRatio="' + (o.par || 'xMaxYMax slice') + '" aria-hidden="true">' +
      '<defs><linearGradient id="lg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D5EAC1"/><stop offset="1" stop-color="#BBDCA2"/></linearGradient><linearGradient id="lg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A3CF84"/><stop offset="1" stop-color="#83BC66"/></linearGradient><linearGradient id="lg3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6FB152"/><stop offset="1" stop-color="#4F9B3B"/></linearGradient><radialGradient id="lsun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FDDB7E"/><stop offset="1" stop-color="#F8C54A"/></radialGradient></defs>' +
      '<circle class="sun" cx="1225" cy="165" r="62" fill="url(#lsun)"/>' +
      '<path d="M0 135 C 200 80, 420 110, 620 135 S 1000 100, 1200 125 S 1380 110, 1440 100 L1440 220 L0 220 Z" fill="url(#lg1)"/>' +
      '<path d="M0 168 C 180 138, 380 143, 560 165 S 900 183, 1100 153 S 1350 143, 1440 155 L1440 220 L0 220 Z" fill="url(#lg2)"/>' +
      '<path d="M1060 170 C 1170 160, 1290 154, 1440 150" stroke="#C3E0AA" stroke-width="3" fill="none"/><path d="M1020 186 C 1150 176, 1290 170, 1440 168" stroke="#C3E0AA" stroke-width="3" fill="none"/>' +
      '<path d="M0 196 C 260 178, 520 186, 760 198 S 1180 186, 1440 191 L1440 220 L0 220 Z" fill="url(#lg3)"/>' +
      palm(1340, 176, 108, 10) + palm(1394, 184, 76, -6) + '</svg>';
  };

  /* ======================= MAPA DEL CARIBE ======================= */
  const BB = { lngMin: -76.0, lngMax: -73.8, latMin: 9.45, latMax: 11.45 };
  const W = 1000, Hh = 1000 * (BB.latMax - BB.latMin) / ((BB.lngMax - BB.lngMin) * Math.cos(10.5 * Math.PI / 180));
  const P = function (lat, lng) { return [((lng - BB.lngMin) / (BB.lngMax - BB.lngMin)) * W, ((BB.latMax - lat) / (BB.latMax - BB.latMin)) * Hh]; };
  const COSTA = [[9.30, -76.10], [9.55, -75.85], [9.90, -75.72], [10.18, -75.62], [10.38, -75.56], [10.52, -75.52], [10.68, -75.42], [10.78, -75.27], [10.87, -75.10], [10.96, -74.95], [11.08, -74.85], [11.03, -74.72], [10.99, -74.58], [10.99, -74.45], [11.0, -74.30], [11.06, -74.24], [11.16, -74.22], [11.25, -74.20], [11.30, -74.05], [11.30, -73.80], [11.35, -73.50]];
  const RIO = [[11.07, -74.85], [10.9, -74.80], [10.7, -74.77], [10.45, -74.80], [10.25, -74.86], [10.0, -74.90], [9.6, -74.85], [9.3, -74.80]];
  const DIQUE = [[10.25, -74.92], [10.27, -75.10], [10.28, -75.30], [10.3, -75.50]];
  const CIENAGA = [[10.98, -74.52], [10.95, -74.38], [10.85, -74.33], [10.74, -74.40], [10.72, -74.52], [10.80, -74.60], [10.93, -74.60]];
  const pts = function (arr) { return arr.map(function (c) { const p = P(c[0], c[1]); return p[0].toFixed(1) + ',' + p[1].toFixed(1); }); };
  function smooth(points) {
    if (points.length < 2) return '';
    let d = 'M' + points[0][0].toFixed(1) + ' ' + points[0][1].toFixed(1);
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] || points[i], p1 = points[i], p2 = points[i + 1], p3 = points[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ' C' + c1[0].toFixed(1) + ' ' + c1[1].toFixed(1) + ', ' + c2[0].toFixed(1) + ' ' + c2[1].toFixed(1) + ', ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
    }
    return d;
  }
  ui.proyectar = P;
  /**
   * Mapa SVG. o.routes = [{ id, stops:[{lat,lng,label,state:'done'|'current'|'pending'|'dest', kind}], color, active, progress (0-1), mode:'to'|'loop' }]
   * o.markers = [{lat,lng,label,tone}]  · o.aspect (ancho/alto)  · o.height (px)
   */
  ui.map = function (o) {
    o = o || {};
    const aspect = o.aspect || 1.7;
    const all = [];
    (o.routes || []).forEach(function (r) { r.stops.forEach(function (s) { all.push(P(s.lat, s.lng)); }); });
    (o.markers || []).forEach(function (m) { all.push(P(m.lat, m.lng)); });
    let x0, x1, y0, y1;
    if (all.length && o.fit !== 'region') {
      x0 = Math.min.apply(null, all.map(function (p) { return p[0]; })); x1 = Math.max.apply(null, all.map(function (p) { return p[0]; }));
      y0 = Math.min.apply(null, all.map(function (p) { return p[1]; })); y1 = Math.max.apply(null, all.map(function (p) { return p[1]; }));
      const pad = o.pad || 90; x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
    } else { x0 = 60; x1 = 980; y0 = 40; y1 = Hh - 60; }
    let w = x1 - x0, h = y1 - y0;
    if (w / h < aspect) { const nw = h * aspect; x0 -= (nw - w) / 2; w = nw; } else { const nh = w / aspect; y0 -= (nh - h) / 2; h = nh; }
    const sc = w / 700;
    const id = o.id || ('map' + Math.random().toString(36).slice(2, 8));
    let svg = '<svg viewBox="' + x0.toFixed(0) + ' ' + y0.toFixed(0) + ' ' + w.toFixed(0) + ' ' + h.toFixed(0) + '" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Mapa de rutas en Atlántico, Magdalena y Bolívar">';
    svg += '<rect x="-500" y="-500" width="2200" height="2200" fill="#CBE5F2"/>';
    svg += '<g opacity=".5" stroke="#B5D8EA" stroke-width="' + (1.2 * sc).toFixed(1) + '" fill="none"><path d="M-200 120 C 100 90, 300 140, 600 60"/><path d="M-200 260 C 120 220, 260 280, 520 200"/></g>';
    svg += '<polygon points="' + pts(COSTA).join(' ') + ' ' + P(8.9, -73.5).join(',') + ' ' + P(8.9, -76.2).join(',') + '" fill="#F4ECDC" stroke="#E5D7BB" stroke-width="' + (3 * sc).toFixed(1) + '" stroke-linejoin="round"/>';
    svg += '<polyline points="' + pts(RIO).join(' ') + '" fill="none" stroke="#B9DCEC" stroke-width="' + (5 * sc).toFixed(1) + '" stroke-linecap="round" stroke-linejoin="round"/>';
    svg += '<polyline points="' + pts(DIQUE).join(' ') + '" fill="none" stroke="#C8E3EF" stroke-width="' + (3 * sc).toFixed(1) + '" stroke-linecap="round"/>';
    svg += '<polygon points="' + pts(CIENAGA).join(' ') + '" fill="#CBE5F2" stroke="#B9DCEC" stroke-width="' + (2 * sc).toFixed(1) + '"/>';
    const lab = function (t, lat, lng, cls, size) { const p = P(lat, lng); return '<text x="' + p[0].toFixed(0) + '" y="' + p[1].toFixed(0) + '" class="' + cls + '" text-anchor="middle" style="font-size:' + (size * sc).toFixed(1) + 'px">' + t + '</text>'; };
    svg += lab('Atlántico', 10.62, -75.02, 'map__label', 14) + lab('Magdalena', 10.4, -74.35, 'map__label', 14) + lab('Bolívar', 9.95, -75.3, 'map__label', 14);
    svg += lab('M A R   C A R I B E', 11.18, -75.45, 'map__sea', 15);
    [['Barranquilla', 10.97, -74.80], ['Cartagena', 10.40, -75.51], ['Santa Marta', 11.24, -74.20]].forEach(function (c) {
      const p = P(c[1], c[2]);
      svg += '<circle cx="' + p[0].toFixed(0) + '" cy="' + p[1].toFixed(0) + '" r="' + (4 * sc).toFixed(1) + '" fill="#fff" stroke="#5F6863" stroke-width="' + (1.5 * sc).toFixed(1) + '"/><text x="' + (p[0] + 8 * sc).toFixed(0) + '" y="' + (p[1] - 6 * sc).toFixed(0) + '" class="map__city" style="font-size:' + (11 * sc).toFixed(1) + 'px">' + c[0] + '</text>';
    });
    (o.markers || []).forEach(function (m) {
      const p = P(m.lat, m.lng); const col = m.tone === 'orange' ? '#F39324' : m.tone === 'navy' ? '#17375E' : '#2F8F3A';
      svg += '<g><circle cx="' + p[0].toFixed(0) + '" cy="' + p[1].toFixed(0) + '" r="' + (5 * sc).toFixed(1) + '" fill="' + col + '" stroke="#fff" stroke-width="' + (2 * sc).toFixed(1) + '"><title>' + ui.esc(m.label || '') + '</title></circle></g>';
    });
    (o.routes || []).forEach(function (r, ri) {
      const pp = r.stops.map(function (s) { return P(s.lat, s.lng); });
      const d = smooth(pp);
      const col = r.color || '#2F8F3A';
      const active = r.active !== false;
      svg += '<path id="' + id + '-r' + ri + '" d="' + d + '" class="map__route ' + (active ? 'is-draw' : '') + '" style="stroke:' + col + ';stroke-width:' + ((active ? 4.5 : 3) * sc).toFixed(1) + 'px;opacity:' + (active ? 1 : 0.45) + '"/>';
      r.stops.forEach(function (s, si) {
        const p = pp[si]; const rr = (s.state === 'done' ? 11 : 9) * sc;
        let g = '<g class="map__stop" data-tip="' + ui.esc(s.label || '') + '">';
        if (s.state === 'dest') {
          g += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + (13 * sc).toFixed(1) + '" fill="#17375E" stroke="#fff" stroke-width="' + (2.5 * sc).toFixed(1) + '"/>';
          g += '<g transform="translate(' + (p[0] - 8 * sc).toFixed(1) + ',' + (p[1] - 8 * sc).toFixed(1) + ') scale(' + (16 * sc / 24).toFixed(3) + ')" color="#fff">' + I('warehouse', 24) + '</g>';
        } else if (s.state === 'done') {
          g += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + rr.toFixed(1) + '" fill="' + col + '" stroke="#fff" stroke-width="' + (2.5 * sc).toFixed(1) + '"/>';
          g += '<g transform="translate(' + (p[0] - 6 * sc).toFixed(1) + ',' + (p[1] - 6 * sc).toFixed(1) + ') scale(' + (12 * sc / 24).toFixed(3) + ')" color="#fff">' + I('check', 24) + '</g>';
        } else if (s.state === 'current') {
          g += '<circle class="pin-pulse" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + (10 * sc).toFixed(1) + '" fill="rgba(243,147,36,.35)"/>';
          g += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + (9 * sc).toFixed(1) + '" fill="#fff" stroke="#F39324" stroke-width="' + (4 * sc).toFixed(1) + '"/>';
        } else {
          g += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + rr.toFixed(1) + '" fill="#fff" stroke="' + col + '" stroke-width="' + (3.5 * sc).toFixed(1) + '"/>';
        }
        if (s.label && o.labels !== false && active) g += '<text x="' + (p[0] + 14 * sc).toFixed(0) + '" y="' + (p[1] + 4 * sc).toFixed(0) + '" class="map__city" style="font-size:' + (11.5 * sc).toFixed(1) + 'px;paint-order:stroke;stroke:#fff;stroke-width:' + (3 * sc).toFixed(1) + 'px">' + ui.esc(s.label) + '</text>';
        svg += g + '</g>';
      });
      if (r.truck !== false && active) {
        svg += '<g class="map__truck" data-route="' + id + '-r' + ri + '" data-progress="' + (r.progress || 0) + '" data-mode="' + (r.mode || 'to') + '" data-scale="' + sc.toFixed(3) + '" style="opacity:0">' +
          '<ellipse cx="0" cy="2" rx="' + (13 * sc).toFixed(1) + '" ry="' + (4 * sc).toFixed(1) + '" fill="rgba(0,0,0,.18)"/>' +
          '<g transform="scale(' + sc.toFixed(3) + ')"><path d="M0 0C0 0 -15 -15.5 -15 -26a15 15 0 0 1 30 0C15 -15.5 0 0 0 0z" fill="#F39324" stroke="#fff" stroke-width="2.5"/><g transform="translate(-9,-35) scale(.75)" color="#fff">' + I('truck', 24) + '</g></g></g>';
      }
    });
    svg += '</svg>';
    return '<div class="map" id="' + id + '" style="height:' + (o.height || 260) + 'px" data-map>' + svg + (o.legend || '') + (o.badge ? '<div class="map__badge">' + o.badge + '</div>' : '') + '</div>';
  };
  /* Anima el camión sobre la ruta (seguimiento GPS simulado) */
  ui.mountMaps = function (root) {
    (root || document).querySelectorAll('.map__truck').forEach(function (tr) {
      const path = document.getElementById(tr.dataset.route); if (!path) return;
      const len = path.getTotalLength();
      path.style.setProperty('--len', len);
      const target = parseFloat(tr.dataset.progress) || 0;
      const loop = tr.dataset.mode === 'loop';
      const t0 = performance.now();
      const dur = loop ? 14000 : 1800;
      tr.style.opacity = 1;
      function frame(t) {
        if (!tr.isConnected) return;
        let f;
        if (loop) f = ((t - t0) % dur) / dur;
        else { const k = Math.min(1, (t - t0) / dur); f = target * (1 - Math.pow(1 - k, 3)); }
        const p = path.getPointAtLength(len * f);
        const bob = loop ? 0 : Math.sin(t / 380) * 1.5;
        tr.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ',' + (p.y + bob).toFixed(1) + ')');
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
  };

  /* ======================= GRÁFICOS ======================= */
  ui.lineChart = function (o) {
    const Wc = 600, Hc = o.height || 200, padL = 40, padR = 12, padT = 14, padB = 26;
    const vals = [].concat.apply([], o.series.map(function (s) { return s.values; }));
    let min = o.yMin != null ? o.yMin : Math.min.apply(null, vals.concat(o.band ? [o.band[0]] : []));
    let max = o.yMax != null ? o.yMax : Math.max.apply(null, vals.concat(o.band ? [o.band[1]] : []));
    const span = max - min || 1; min -= span * 0.12; max += span * 0.12;
    const n = o.series[0].values.length;
    const X = function (i) { return padL + (Wc - padL - padR) * (n === 1 ? 0.5 : i / (n - 1)); };
    const Y = function (v) { return padT + (Hc - padT - padB) * (1 - (v - min) / (max - min)); };
    let s = '<svg class="chart" viewBox="0 0 ' + Wc + ' ' + Hc + '" role="img" aria-label="' + ui.esc(o.label || 'Gráfico') + '">';
    if (o.band) s += '<rect class="chart__band" x="' + padL + '" y="' + Y(o.band[1]).toFixed(1) + '" width="' + (Wc - padL - padR) + '" height="' + (Y(o.band[0]) - Y(o.band[1])).toFixed(1) + '"/>';
    for (let g = 0; g <= 3; g++) { const v = min + (max - min) * g / 3; const y = Y(v); s += '<line class="chart__grid" x1="' + padL + '" x2="' + (Wc - padR) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '"/><text class="chart__axis" x="' + (padL - 8) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end">' + (o.fmt ? o.fmt(v) : ui.num(v, 1)) + '</text>'; }
    (o.labels || []).forEach(function (l, i) { if (n > 10 && i % Math.ceil(n / 7) !== 0 && i !== n - 1) return; s += '<text class="chart__axis" x="' + X(i).toFixed(1) + '" y="' + (Hc - 6) + '" text-anchor="middle">' + l + '</text>'; });
    o.series.forEach(function (se, k) {
      const pts2 = se.values.map(function (v, i) { return [X(i), Y(v)]; });
      const d = smooth(pts2);
      const col = se.color || '#2F8F3A';
      const gid = 'g' + Math.random().toString(36).slice(2, 7);
      if (k === 0 && o.area !== false) s += '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + col + '" stop-opacity=".22"/><stop offset="1" stop-color="' + col + '" stop-opacity="0"/></linearGradient></defs><path class="chart__area" d="' + d + ' L' + X(n - 1).toFixed(1) + ' ' + (Hc - padB) + ' L' + X(0).toFixed(1) + ' ' + (Hc - padB) + ' Z" fill="url(#' + gid + ')"/>';
      s += '<path class="chart__line" d="' + d + '" stroke="' + col + '" style="animation-delay:' + (k * 0.25) + 's"/>';
      pts2.forEach(function (p, i) {
        const out = o.band && (se.values[i] < o.band[0] || se.values[i] > o.band[1]);
        if (i === n - 1 || out) s += '<circle class="chart__dot" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + (out ? 5 : 4.5) + '" fill="' + (out ? '#D14343' : '#fff') + '" stroke="' + (out ? '#fff' : col) + '" stroke-width="2.5" style="animation-delay:' + (1 + i * 0.02) + 's"><title>' + (o.fmt ? o.fmt(se.values[i]) : se.values[i]) + '</title></circle>';
      });
    });
    return s + '</svg>';
  };
  ui.barChart = function (o) {
    const Wc = 600, Hc = o.height || 180, padB = 24, padT = 16;
    const n = o.values.length; const max = Math.max.apply(null, o.values) || 1;
    const bw = (Wc / n) * 0.58;
    let s = '<svg class="chart" viewBox="0 0 ' + Wc + ' ' + Hc + '" role="img" aria-label="' + ui.esc(o.label || 'Gráfico de barras') + '">';
    o.values.forEach(function (v, i) {
      const h = (Hc - padB - padT) * v / max; const x = (Wc / n) * i + (Wc / n - bw) / 2; const y = Hc - padB - h;
      const last = i === n - 1;
      s += '<rect class="bar" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(2, h).toFixed(1) + '" rx="6" fill="' + (last ? (o.accent || '#F39324') : (o.color || '#45A548')) + '" style="animation-delay:' + (i * 0.04) + 's"><title>' + (o.labels ? o.labels[i] + ': ' : '') + (o.fmt ? o.fmt(v) : v) + '</title></rect>';
      if (o.labels && (n <= 14)) s += '<text class="chart__axis" x="' + (x + bw / 2).toFixed(1) + '" y="' + (Hc - 6) + '" text-anchor="middle">' + o.labels[i] + '</text>';
    });
    return s + '</svg>';
  };

  /* ======================= SUPERPOSICIONES ======================= */
  ui.toast = function (title, detail, tone, ms) {
    const box = document.getElementById('toasts'); if (!box) return;
    const icons = { success: 'check', warning: 'alert-triangle', danger: 'x', info: 'info' };
    const t = document.createElement('div');
    tone = tone || 'success'; ms = ms || 4200;
    t.className = 'toast toast--' + tone;
    t.innerHTML = '<span class="toast__icon">' + I(icons[tone] || 'check', 18) + '</span><div class="grow"><div class="toast__title">' + title + '</div>' + (detail ? '<div class="toast__detail">' + detail + '</div>' : '') + '</div><button class="cart-item__x" aria-label="Cerrar">' + I('x', 16) + '</button><span class="toast__bar" style="animation-duration:' + ms + 'ms;background:' + (tone === 'danger' ? '#D14343' : tone === 'warning' ? '#F39324' : tone === 'info' ? '#2D7BD8' : '#45A548') + '"></span>';
    box.prepend(t);
    const close = function () { t.classList.add('is-out'); setTimeout(function () { t.remove(); }, 320); };
    t.querySelector('button').onclick = close;
    setTimeout(close, ms);
  };
  ui.error = function (e) {
    const code = e && e.regla ? e.regla : null;
    ui.toast((code ? code + ' · ' : '') + 'No se pudo completar', e && e.message ? e.message : String(e), 'danger', 5600);
  };
  let modalStack = [];
  ui.modal = function (o) {
    const root = o.container || document.getElementById('modal-root');
    const ov = document.createElement('div');
    ov.className = 'overlay ' + (o.sheet ? 'overlay--sheet' : '');
    ov.innerHTML = '<div class="modal ' + (o.size ? 'modal--' + o.size : '') + (o.sheet ? ' sheet' : '') + '" role="dialog" aria-modal="true" aria-label="' + ui.esc(o.title || 'Diálogo') + '">' +
      (o.title ? '<div class="modal__head">' + (o.icon ? ui.iconBox(o.icon, o.tone) : '') + '<h3>' + o.title + '</h3><button class="icon-btn" data-close aria-label="Cerrar">' + I('x', 20) + '</button></div>' : '') +
      '<div class="modal__body">' + (o.body || '') + '</div>' + (o.foot ? '<div class="modal__foot">' + o.foot + '</div>' : '') + '</div>';
    root.appendChild(ov);
    const ctrl = {
      el: ov, root: ov.querySelector('.modal'),
      close: function (v) {
        if (ctrl.closed) return; ctrl.closed = true;
        ov.classList.add('is-closing'); setTimeout(function () { ov.remove(); }, 220);
        modalStack = modalStack.filter(function (m) { return m !== ctrl; });
        if (o.onClose) o.onClose(v);
      }
    };
    ov.addEventListener('click', function (e) {
      if (e.target === ov && o.dismiss !== false) ctrl.close();
      if (e.target.closest('[data-close]')) ctrl.close();
    });
    modalStack.push(ctrl);
    if (o.onMount) o.onMount(ctrl);
    ui.enhance(ov);
    const f = ov.querySelector('input,select,textarea,button.btn--primary'); if (f && !o.noFocus) setTimeout(function () { f.focus(); }, 60);
    return ctrl;
  };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modalStack.length) modalStack[modalStack.length - 1].close(); });
  ui.confirm = function (o) {
    return new Promise(function (res) {
      const m = ui.modal({
        title: o.title, icon: o.icon || 'help', tone: o.tone, size: 'sm', container: o.container, sheet: o.sheet,
        body: '<p class="t-lead">' + o.text + '</p>',
        foot: ui.btn({ label: o.cancel || 'Cancelar', variant: 'outline', attrs: ' data-close' }) + ui.btn({ label: o.ok || 'Confirmar', variant: o.okVariant || 'primary', icon: o.okIcon, attrs: ' data-ok' }),
        onClose: function (v) { res(!!v); },
        onMount: function (c) { c.el.querySelector('[data-ok]').onclick = function () { c.close(true); }; }
      });
      return m;
    });
  };
  ui.withLoading = async function (btn, fn) {
    if (btn) { btn.classList.add('is-loading'); btn.disabled = true; }
    try { return await fn(); }
    finally { if (btn && btn.isConnected) { btn.classList.remove('is-loading'); btn.disabled = false; } }
  };

  /* ======================= EFECTOS ======================= */
  ui.countUp = function (root) {
    (root || document).querySelectorAll('[data-count]').forEach(function (el) {
      const to = parseFloat(el.dataset.count); const fmt = el.dataset.format || 'num';
      const f = { num: function (v) { return ui.num(v); }, pct: function (v) { return ui.pct(v); }, pct1: function (v) { return ui.pct(v, 1); }, money: function (v) { return ui.money(v); }, kg: function (v) { return ui.kg(v); }, dec: function (v) { return ui.num(v, 1); } }[fmt];
      const t0 = performance.now(), dur = 1100;
      (function step(t) {
        const k = Math.min(1, (t - t0) / dur); const e = 1 - Math.pow(1 - k, 3);
        el.textContent = f(to * e);
        if (k < 1 && el.isConnected) requestAnimationFrame(step);
      })(t0);
      /* respaldo: si el navegador pausa las animaciones (pestaña oculta), fija el valor final */
      setTimeout(function () { if (el.isConnected) el.textContent = f(to); }, dur + 150);
    });
  };
  /* Activa animaciones de barras de progreso, stepper y conteos tras insertar HTML */
  ui.enhance = function (root) {
    requestAnimationFrame(function () {
      (root || document).querySelectorAll('[data-w]').forEach(function (b) { b.style.width = b.dataset.w; });
      (root || document).querySelectorAll('.stepper__fill[data-fill]').forEach(function (b) { b.style.width = b.dataset.fill; });
    });
    ui.countUp(root);
    ui.mountMaps(root);
  };
  document.addEventListener('pointerdown', function (e) {
    const b = e.target.closest('.btn'); if (!b || b.disabled) return;
    const r = b.getBoundingClientRect(); const s = Math.max(r.width, r.height);
    const sp = document.createElement('span'); sp.className = 'ripple';
    sp.style.width = sp.style.height = s + 'px'; sp.style.left = (e.clientX - r.left - s / 2) + 'px'; sp.style.top = (e.clientY - r.top - s / 2) + 'px';
    b.appendChild(sp); setTimeout(function () { sp.remove(); }, 620);
  });
  /* Animación "volar al carrito" */
  ui.flyTo = function (img, target) {
    if (!img || !target || !img.animate) return;
    const a = img.getBoundingClientRect(), b = target.getBoundingClientRect();
    const c = img.cloneNode(); c.className = 'fly';
    Object.assign(c.style, { left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px' });
    document.body.appendChild(c);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + 30 - (a.top + a.height / 2);
    c.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: 'translate(' + dx * 0.5 + 'px,' + (dy * 0.5 - 120) + 'px) scale(.7) rotate(-8deg)', opacity: 1, offset: 0.5 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.22) rotate(10deg)', opacity: 0.2 }
    ], { duration: 820, easing: 'cubic-bezier(.5,0,.4,1)' }).onfinish = function () {
      c.remove();
      target.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.03)' }, { transform: 'scale(1)' }], { duration: 350, easing: 'ease-out' });
    };
  };
  /* Confeti suave para celebraciones */
  ui.confetti = function (host) {
    const box = host || document.body;
    const colors = ['#45A548', '#F39324', '#F8C54A', '#2D7BD8', '#A8D59B'];
    for (let i = 0; i < 46; i++) {
      const p = document.createElement('span');
      const size = 6 + Math.random() * 6;
      Object.assign(p.style, { position: 'fixed', zIndex: 400, left: (40 + Math.random() * 20) + 'vw', top: '38vh', width: size + 'px', height: size * 0.6 + 'px', background: colors[i % colors.length], borderRadius: '2px', pointerEvents: 'none' });
      box.appendChild(p);
      const dx = (Math.random() - 0.5) * 700, dy = -200 - Math.random() * 260;
      p.animate([{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: 'translate(' + dx * 0.6 + 'px,' + dy + 'px) rotate(' + Math.random() * 360 + 'deg)', opacity: 1, offset: 0.45 }, { transform: 'translate(' + dx + 'px,' + (dy + 620) + 'px) rotate(' + Math.random() * 720 + 'deg)', opacity: 0 }], { duration: 1600 + Math.random() * 700, easing: 'cubic-bezier(.2,.6,.4,1)' }).onfinish = function () { p.remove(); };
    }
  };

  RC.ui = ui;
})();
