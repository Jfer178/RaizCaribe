# RaízCaribe · Prototipo funcional

**«Del campo Caribe a más mesas»**: portal web interactivo de la plataforma agro-logística RaízCaribe. Lo construimos con **HTML, CSS y JavaScript** sin librerías ni compilación, a partir del documento *Arquitectura Empresarial Digital · Proyecto final*.

## Cómo abrirlo

- **Opción rápida:** abre `index.html` con doble clic en el navegador (Chrome, Edge o Firefox).
- **Opción recomendada:** sírvelo con un servidor local, desde esta carpeta:

  ```powershell
  python -m http.server 5173
  ```

  Luego abre <http://localhost:5173>.

Los datos se guardan en el navegador (`localStorage`). Para volver al estado inicial, usa **Reiniciar** en la barra de demostración inferior.

## Despliegue en Netlify

El sitio es estático y no necesita compilación; la configuración está en `netlify.toml`. Cada `git push` a `main` vuelve a publicar el sitio automáticamente.

1. Entra a <https://app.netlify.com> e inicia sesión con GitHub.
2. Elige **Add new site → Import an existing project → GitHub** y selecciona el repositorio `RaizCaribe`.
3. Deja *Build command* vacío y *Publish directory* en `.`, luego pulsa **Deploy**.

## Roles y pantallas

| Rol | Canal | Pantallas |
| --- | --- | --- |
| Comprador B2B | Portal web | Inicio, Productos (catálogo + resumen del pedido), Mi pedido, Seguimiento (mapa en vivo, línea de tiempo, trazabilidad por lote, recepción conforme) |
| Productor | App móvil | Inicio (KPIs + publicar cosecha con precio justo sugerido), Cosechas, Entregas, Pagos, Mis lotes |
| Conductor | App móvil | Ruta del día (stepper + mapa), registrar lote con escáner QR, entrega en centro de acopio, lotes, incidencias, perfil |
| Administrador / Operador | Panel web | Inicio, Productores, Compradores, Pedidos (aprobar/rechazar), Rutas (motor de rutas), Trazabilidad, Indicadores, Pagos |

La barra **Demo** permite cambiar de rol en cualquier momento. La **Guía** recorre el ciclo completo de un pedido.

## Recorrido sugerido (flujo de punta a punta)

1. **Productor**: publica una cosecha. El precio justo se sugiere con los precios de referencia (PR-4, PR-5, RN6).
2. **Comprador**: agrega productos al pedido. El sistema verifica la cobertura con las ofertas antes de confirmar (PR-6).
3. **Administrador**: aprueba el pedido. Se cruza con las ofertas (PR-7) y entra a una ruta compartida (RN1).
4. **Motor de rutas**: agrupa paradas respetando la capacidad del vehículo y ordena el recorrido (PR-8, RN2).
5. **Conductor**: escanea el QR y registra kilos, temperatura y calidad del lote (PR-9, RN3, RN4).
6. **Conductor**: confirma la entrega en el centro de acopio (PR-10, PR-11).
7. **Comprador**: confirma la recepción conforme. Se liquida el pago: *kg conformes × precio − 8 % de comisión* (PR-12, RN5).
8. **Administrador**: revisa los indicadores de impacto: pérdidas, ingreso, costo por kg y entregas a tiempo (PR-13).

## Arquitectura del prototipo

```
index.html
css/
  styles.css      Sistema de diseño (tokens, componentes, animaciones)
  app.css         Marco del celular, splash, login y guía
  comprador.css   Portal B2B
  movil.css       Apps del productor y del conductor
  admin.css       Panel de operación
js/
  core/db.js      Modelo de datos: 13 entidades del MER y datos de ejemplo
  core/api.js     Servicios (API REST simulada), reglas RN1–RN6 y bus de eventos
  ui/icons.js     Iconos SVG
  ui/ui.js        Componentes, mapa del Caribe, gráficos, modales y efectos
  views/*.js      Vistas por rol (auth, comprador, productor, conductor, admin)
  app.js          Enrutador por hash, shells web y móvil, notificaciones
assets/img/       Fotografías e ilustraciones
```

- **Bus de eventos.** Publica `PedidoRegistrado`, `AsignacionConfirmada`, `RutaProgramada`, `LoteRegistrado`, `EntregaConfirmada` y `PagoRealizado`. Estos eventos generan las notificaciones de cada rol, como en la integración I1–I8 del documento.
- **Modo sin conexión.** En las apps móviles, el interruptor de conexión guarda las acciones y las sincroniza al volver la señal (principio «pensado para el campo»).
- **Trazabilidad.** Cada lote tiene QR, kilos, temperatura, calidad y telemetría simulada de sensores IoT. Con esos datos se reconstruye la cadena LOTE → ASIGNACION → OFERTA → PRODUCTOR y PEDIDO → COMPRADOR.
