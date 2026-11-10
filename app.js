/* =====================================================================
   CONTROL DE PERMITIDOS
   Entregas de mercancía a locales en centros comerciales, cobros,
   devoluciones, inventario e informes. React + Supabase.
   ===================================================================== */
'use strict';
const { useState, useEffect, useMemo, useRef, useCallback, createContext, useContext, Fragment } = React;
const html = htm.bind(React.createElement);
const db = supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);

/* ---------- Utilidades ---------- */
const pesos = n => '$' + Math.round(Number(n || 0)).toLocaleString('es-CO');
const numero = n => Math.round(Number(n || 0)).toLocaleString('es-CO');
const pad = n => String(n).padStart(2, '0');
const aFecha = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hoy = () => aFecha(new Date());
const sumarDias = (f, n) => { const d = new Date(f + 'T00:00:00'); d.setDate(d.getDate() + n); return aFecha(d); };
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaCorta = f => {
  if (!f) return '';
  const d = new Date(String(f).length === 10 ? f + 'T00:00:00' : f);
  return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
};
const fechaHora = f => { const d = new Date(f); return `${fechaCorta(f)}, ${d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}`; };
const plural = (n, uno, varios) => `${numero(n)} ${Number(n) === 1 ? uno : varios}`;
const iniciales = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(x => x[0] || '').join('').toUpperCase();
const normal = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
const telWa = t => { let d = String(t || '').replace(/\D/g, ''); if (d.length === 10 && d.startsWith('3')) d = '57' + d; return d; };
const abrirWhatsApp = (tel, texto) => window.open(`https://wa.me/${telWa(tel)}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
const leer = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const MEDIOS = { efectivo: 'Efectivo', transferencia: 'Transferencia', nequi: 'Nequi', daviplata: 'Daviplata' };

function errorTexto(e) {
  const m = String(e?.message || e || 'Error desconocido');
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Sin conexión. Revisa tu internet e intenta de nuevo.';
  if (/JWT|token/i.test(m)) return 'Tu sesión venció. Cierra sesión y vuelve a entrar.';
  if (/duplicate key|unique/i.test(m)) return 'Ya existe un registro con ese nombre.';
  if (/row-level security|permission denied/i.test(m)) return 'Tu usuario no tiene permiso para hacer esto.';
  return m.replace(/^.*?ERROR:\s*/, '');
}
async function rpc(nombre, args) {
  const { data, error } = await db.rpc(nombre, args);
  if (error) throw error;
  return data;
}
async function consulta(q) {
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
function descargarCSV(nombre, filas) {
  const csv = '﻿' + filas.map(f => f.map(v => { const s = String(v ?? ''); return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------- Iconos ---------- */
const ICONOS = {
  inicio: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
  entregas: '<path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/>',
  cobros: '<rect x="2" y="6" width="20" height="13" rx="2"/><circle cx="12" cy="12.5" r="2.5"/><path d="M6 10v5M18 10v5"/>',
  devoluciones: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/>',
  permitidos: '<path d="M9 3h6l1 3H8l1-3z"/><rect x="4" y="6" width="16" height="15" rx="2"/><path d="M8 11h8M8 15h5"/>',
  locales: '<path d="M3 9l1.5-5h15L21 9"/><path d="M3 9h18v2a3 3 0 01-6 0 3 3 0 01-6 0 3 3 0 01-6 0V9z"/><path d="M5 13v8h14v-8"/>',
  inventario: '<path d="M20 7l-8-4-8 4v10l8 4 8-4V7z"/><path d="M4 7l8 4 8-4"/><path d="M12 11v10"/>',
  informes: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
  config: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  atras: '<path d="M15 6l-6 6 6 6"/>',
  buscar: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  salir: '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  luna: '<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/>',
  whatsapp: '<path d="M3 21l1.6-4.7A8.5 8.5 0 1112 20.5a8.4 8.4 0 01-4.3-1.2L3 21z"/>',
  ojo: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  escudo: '<path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z"/>',
  descargar: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 21h16"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  colapsar: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
};
const Ico = ({ n }) => html`<svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: ICONOS[n] || '' }}></svg>`;
const Vacio = ({ ico = 'check', children }) => html`<div className="vacio-bloque"><${Ico} n=${ico} /><div>${children}</div></div>`;

/* ---------- Avisos (toasts) ---------- */
let pintarAvisos = () => {};
let listaAvisos = [];
function aviso(texto, tipo = '') {
  const id = Math.random();
  listaAvisos = [...listaAvisos, { id, texto, tipo }];
  pintarAvisos(listaAvisos);
  setTimeout(() => { listaAvisos = listaAvisos.filter(a => a.id !== id); pintarAvisos(listaAvisos); }, tipo === 'error' ? 6000 : 3200);
}
function Avisos() {
  const [lista, setLista] = useState([]);
  useEffect(() => { pintarAvisos = setLista; }, []);
  return html`<div id="toasts" aria-live="polite">${lista.map(a => html`<div key=${a.id} className=${'toast ' + a.tipo}>${a.texto}</div>`)}</div>`;
}

/* ---------- Ventanas ---------- */
function Modal({ titulo, sub, onCerrar, ancho, children, pie }) {
  useEffect(() => {
    const k = e => { if (e.key === 'Escape') onCerrar(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onCerrar]);
  return html`<div className="modal-fondo" onMouseDown=${e => { if (e.target === e.currentTarget) onCerrar(); }}>
    <div className=${'modal' + (ancho ? ' ancho' : '')} role="dialog" aria-modal="true" aria-label=${titulo}>
      <div className="row" style=${{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        <div><h2>${titulo}</h2>${sub && html`<p className="muted" style=${{ margin: '2px 0 0' }}>${sub}</p>`}</div>
        <button className="icon-btn" onClick=${onCerrar} aria-label="Cerrar"><${Ico} n="x" /></button>
      </div>
      ${children}
      ${pie && html`<div className="modal-acciones">${pie}</div>`}
    </div>
  </div>`;
}

// Diálogo de confirmación con promesa: await preguntar({...}) → true/false o el texto escrito
let abrirDialogo = () => Promise.resolve(false);
function preguntar(opc) { return abrirDialogo(opc); }
function Dialogos() {
  const [d, setD] = useState(null);
  const [texto, setTexto] = useState('');
  useEffect(() => { abrirDialogo = opc => new Promise(res => { setTexto(''); setD({ ...opc, res }); }); }, []);
  if (!d) return null;
  const cerrar = v => { d.res(v); setD(null); };
  return html`<${Modal} titulo=${d.titulo} onCerrar=${() => cerrar(false)} pie=${html`
      <button className="btn" onClick=${() => cerrar(false)}>Cancelar</button>
      <button className=${'btn ' + (d.peligro ? 'btn-danger' : 'btn-primary')} disabled=${d.campo && !texto.trim()}
        onClick=${() => cerrar(d.campo ? texto.trim() : true)}>${d.ok || 'Aceptar'}</button>`}>
    <p style=${{ whiteSpace: 'pre-line' }}>${d.texto}</p>
    ${d.campo && html`<label htmlFor="dlgCampo">${d.campo}</label><input id="dlgCampo" autoFocus value=${texto} onChange=${e => setTexto(e.target.value)} />`}
  <//>`;
}

/* ---------- Datos con carga ---------- */
function useDatos(fn, deps) {
  const [estado, setEstado] = useState({ datos: null, cargando: true, error: null });
  const [vuelta, setVuelta] = useState(0);
  useEffect(() => {
    let vivo = true;
    setEstado(e => ({ ...e, cargando: true, error: null }));
    fn().then(d => vivo && setEstado({ datos: d, cargando: false, error: null }))
      .catch(e => vivo && setEstado({ datos: null, cargando: false, error: errorTexto(e) }));
    return () => { vivo = false; };
    // eslint-disable-next-line
  }, [...deps, vuelta]);
  return { ...estado, recargar: () => setVuelta(v => v + 1) };
}
const Cargando = ({ error, onReintentar }) => error
  ? html`<div className="fe-caja error"><b>No se pudo cargar la información.</b><span className="small">${error}</span>${onReintentar && html`<div style=${{ marginTop: 8 }}><button className="btn btn-sm" onClick=${onReintentar}>Reintentar</button></div>`}</div>`
  : html`<p className="muted">Cargando…</p>`;

/* ---------- Contexto de la aplicación ---------- */
const Ctx = createContext(null);
const useApp = () => useContext(Ctx);

function Encabezado({ titulo, sub, eti, ayuda, children }) {
  const clave = 'cp-ayuda-' + normal(titulo).slice(0, 30);
  const [abierta, setAbierta] = useState(() => !!ayuda && leer(clave) !== 'no');
  const cerrar = () => { guardar(clave, 'no'); setAbierta(false); };
  return html`<${Fragment}>
    <div className="encabezado"><div>${eti && html`<span className="etiqueta-sec">${eti}</span>`}<h1>${titulo}</h1>${sub && html`<p>${sub}</p>`}</div>
      <div className="row">${ayuda && !abierta && html`<button className="btn btn-ayuda" onClick=${() => setAbierta(true)} aria-label="¿Cómo se usa esta pantalla?">?</button>`}${children}</div></div>
    ${ayuda && abierta && html`<div className="ayuda" role="note"><div className="ayuda-ico">?</div><div className="ayuda-txt"><b>¿Cómo se usa?</b>
      <ol>${ayuda.map((x, i) => html`<li key=${i}>${x}</li>`)}</ol></div>
      <button className="btn btn-sm" onClick=${cerrar}>Entendido</button></div>`}
  <//>`;
}
const Kpi = ({ t, v, s, cls }) => html`<div className=${'kpi ' + (cls || '')}><span>${t}</span><strong>${v}</strong>${s && html`<small>${s}</small>`}</div>`;

function BarrasH({ filas }) {
  const max = Math.max(1, ...filas.map(f => f.valor));
  return html`<div className="barras-h">${filas.map((f, i) => html`<div className="fila-b" key=${i} title=${f.etiqueta}>
    <span>${f.etiqueta}</span><div className="pista"><i style=${{ width: Math.max(f.valor / max * 100, f.valor > 0 ? 1.5 : 0) + '%' }}></i></div><span>${f.texto}</span></div>`)}</div>`;
}

// Gráfica de barras por día (SVG con escala real y etiquetas legibles)
function GraficaDias({ datos, desde, hasta }) {
  const dias = [];
  for (let f = desde; f <= hasta && dias.length < 400; f = sumarDias(f, 1)) dias.push(f);
  const mapa = Object.fromEntries((datos || []).map(d => [d.fecha, Number(d.valor)]));
  const vals = dias.map(d => mapa[d] || 0);
  const max = Math.max(...vals, 0);
  const [tip, setTip] = useState(null);
  if (!max) return html`<${Vacio} ico="informes">No hay recaudos en este período.<//>`;
  const paso = (() => { const x = max / 4, p = Math.pow(10, Math.floor(Math.log10(x))), m = x / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; })();
  const tope = Math.ceil(max / paso) * paso;
  const W = 760, H = 220, L = 64, B = 26, T = 8, R = 6;
  const bw = (W - L - R) / dias.length;
  const y = v => T + (H - T - B) * (1 - v / tope);
  const cada = Math.ceil(dias.length / 10);
  const corto = v => v >= 1e6 ? '$' + (v / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' M' : v >= 1e3 ? '$' + Math.round(v / 1e3) + ' mil' : '$' + v;
  const lineas = [];
  for (let v = 0; v <= tope + 0.5; v += paso) lineas.push(v);
  return html`<div className="grafico">
    <svg viewBox=${`0 0 ${W} ${H}`} role="img" aria-label="Recaudo por día">
      ${lineas.map(v => html`<g key=${'l' + v}><line className=${v ? 'rejilla' : 'base'} x1=${L} x2=${W - R} y1=${y(v)} y2=${y(v)} /><text className="eje" x=${L - 8} y=${y(v) + 4} textAnchor="end">${corto(v)}</text></g>`)}
      ${dias.map((d, i) => html`<g key=${d} onMouseMove=${e => vals[i] && setTip({ x: e.clientX, y: e.clientY, d, v: vals[i] })} onMouseLeave=${() => setTip(null)}>
        <rect className="golpe" x=${L + i * bw} y=${T} width=${bw} height=${H - T - B} />
        ${vals[i] > 0 && html`<rect className="barra" x=${L + i * bw + bw * 0.15} y=${y(vals[i])} width=${Math.max(1, bw * 0.7)} height=${H - B - y(vals[i])} rx="2" />`}
        ${i % cada === 0 && html`<text className="eje" x=${L + i * bw + bw / 2} y=${H - 8} textAnchor="middle">${new Date(d + 'T00:00:00').getDate()} ${MESES[new Date(d + 'T00:00:00').getMonth()].slice(0, 3)}</text>`}
      </g>`)}
    </svg>
    ${tip && html`<div className="tooltip-graf" style=${{ left: tip.x + 12, top: tip.y - 40 }}><span>${fechaCorta(tip.d)}</span><b>${pesos(tip.v)}</b></div>`}
  </div>`;
}

/* ---------- Selector de local (buscador por centro comercial y local) ---------- */
function SelectorLocal({ valor, onCambio, saldos, autoFocus, permitirNuevo = true }) {
  const { cat, nombreLocal } = useApp();
  const [q, setQ] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [sel, setSel] = useState(0);
  const [nuevo, setNuevo] = useState(false);
  const caja = useRef(null);
  useEffect(() => {
    const f = e => { if (caja.current && !caja.current.contains(e.target)) setAbierto(false); };
    document.addEventListener('mousedown', f);
    return () => document.removeEventListener('mousedown', f);
  }, []);
  const saldoDe = id => saldos?.find(s => s.local_id === id)?.saldo;
  const lista = useMemo(() => {
    const t = normal(q).split(/\s+/).filter(Boolean);
    return cat.locales.filter(l => l.activo).filter(l => { const txt = normal(nombreLocal(l.id)); return t.every(p => txt.includes(p)); })
      .sort((a, b) => (Number(saldoDe(b.id) || 0) - Number(saldoDe(a.id) || 0)) || nombreLocal(a.id).localeCompare(nombreLocal(b.id))).slice(0, 40);
    // eslint-disable-next-line
  }, [q, cat.locales, saldos]);
  const elegir = l => { onCambio(l.id); setQ(''); setAbierto(false); };
  if (valor) {
    const s = saldoDe(valor);
    return html`<div className="local-elegido">
      <div><b>${nombreLocal(valor)}</b>${s != null && html`<span className="small muted">Saldo ${pesos(s)}</span>`}</div>
      <button className="btn btn-sm" type="button" onClick=${() => onCambio(null)}>Cambiar</button>
    </div>`;
  }
  return html`<div className="buscador" ref=${caja}>
    <div className="grupo">
      <input type="search" placeholder="Busca el centro comercial o el local (ej: imperio 25a)" value=${q} autoFocus=${autoFocus}
        onChange=${e => { setQ(e.target.value); setAbierto(true); setSel(0); }} onFocus=${() => setAbierto(true)}
        onKeyDown=${e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, lista.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
          if (e.key === 'Enter' && lista[sel]) { e.preventDefault(); elegir(lista[sel]); }
        }} aria-label="Buscar local" />
      ${permitirNuevo && html`<button className="btn" type="button" onClick=${() => setNuevo(true)}><${Ico} n="mas" />Nuevo local</button>`}
    </div>
    ${abierto && html`<div className="resultados" role="listbox">
      ${lista.length ? lista.map((l, i) => html`<div key=${l.id} className=${i === sel ? 'sel' : ''} role="option" onMouseDown=${e => { e.preventDefault(); elegir(l); }}>
        <span>${nombreLocal(l.id)}</span>${saldoDe(l.id) > 0 && html`<span className="small muted num">Debe ${pesos(saldoDe(l.id))}</span>`}</div>`)
        : html`<div className="muted" style=${{ cursor: 'default' }}>Ningún local coincide.</div>`}
    </div>`}
    ${nuevo && html`<${ModalLocal} onCerrar=${() => setNuevo(false)} onGuardado=${id => { setNuevo(false); onCambio(id); }} />`}
  </div>`;
}

function ModalLocal({ local, onCerrar, onGuardado }) {
  const { cat, recargarCat } = useApp();
  const [centro, setCentro] = useState(local?.centro_id || '');
  const [centroNuevo, setCentroNuevo] = useState('');
  const [d, setD] = useState({ nombre: local?.nombre || '', encargado: local?.encargado || '', telefono: local?.telefono || '', nota: local?.nota || '', activo: local?.activo ?? true });
  const [ocupado, setOcupado] = useState(false);
  const guardarLocal = async () => {
    if (!d.nombre.trim()) return aviso('Escribe el local (número o nombre).', 'error');
    if (!centro) return aviso('Elige el centro comercial.', 'error');
    setOcupado(true);
    try {
      let centroId = Number(centro);
      if (centro === 'nuevo') {
        if (!centroNuevo.trim()) throw new Error('Escribe el nombre del centro comercial nuevo.');
        const c = await consulta(db.from('cp_centros').insert({ nombre: centroNuevo.trim().toUpperCase() }).select('id').single());
        centroId = c.id;
      }
      const datos = { centro_id: centroId, nombre: d.nombre.trim().toUpperCase(), encargado: d.encargado.trim() || null, telefono: d.telefono.trim() || null, nota: d.nota.trim() || null, activo: d.activo };
      const r = local
        ? await consulta(db.from('cp_locales').update(datos).eq('id', local.id).select('id').single())
        : await consulta(db.from('cp_locales').insert(datos).select('id').single());
      await recargarCat();
      aviso(local ? 'Local actualizado' : 'Local creado', 'ok');
      onGuardado(r.id);
    } catch (e) { aviso(errorTexto(e), 'error'); }
    setOcupado(false);
  };
  const cambio = k => e => setD({ ...d, [k]: e.target.value });
  return html`<${Modal} titulo=${local ? 'Editar local' : 'Nuevo local'} sub="Cada local es un cliente o vendedor dentro de un centro comercial." onCerrar=${onCerrar}
    pie=${html`<button className="btn" onClick=${onCerrar}>Cancelar</button><button className="btn btn-primary" disabled=${ocupado} onClick=${guardarLocal}>${ocupado ? 'Guardando…' : 'Guardar'}</button>`}>
    <div className="grid2">
      <div><label htmlFor="mlCentro">Centro comercial</label>
        <select id="mlCentro" value=${centro} onChange=${e => setCentro(e.target.value)}>
          <option value="">Elige…</option>
          ${cat.centros.map(c => html`<option key=${c.id} value=${c.id}>${c.nombre}</option>`)}
          <option value="nuevo">+ Otro centro comercial…</option>
        </select></div>
      ${centro === 'nuevo'
        ? html`<div><label htmlFor="mlCentroN">Nombre del centro comercial</label><input id="mlCentroN" value=${centroNuevo} onChange=${e => setCentroNuevo(e.target.value)} placeholder="Ej: GRAN SAN" /></div>`
        : html`<div></div>`}
      <div><label htmlFor="mlNombre">Local</label><input id="mlNombre" value=${d.nombre} onChange=${cambio('nombre')} placeholder="Ej: 25A, 1-27 o 36 KEILA" autoFocus /></div>
      <div><label htmlFor="mlEnc">Encargada o vendedora</label><input id="mlEnc" value=${d.encargado} onChange=${cambio('encargado')} /></div>
      <div><label htmlFor="mlTel">Teléfono (WhatsApp)</label><input id="mlTel" inputMode="tel" value=${d.telefono} onChange=${cambio('telefono')} /></div>
      <div><label htmlFor="mlNota">Nota</label><input id="mlNota" value=${d.nota} onChange=${cambio('nota')} /></div>
    </div>
    ${local && html`<label className="interruptor" style=${{ marginTop: 16 }}><input type="checkbox" checked=${d.activo} onChange=${e => setD({ ...d, activo: e.target.checked })} /><span></span>Local activo</label>`}
  <//>`;
}

/* ---------- Tabla de prendas en el local, con cantidades a pagar o devolver ---------- */
function PrendasDelLocal({ items, cantidades, setCantidades, modo }) {
  if (!items.length) return html`<${Vacio}>Este local no tiene prendas pendientes.<//>`;
  const fijar = (id, v, max) => setCantidades({ ...cantidades, [id]: Math.max(0, Math.min(max, Math.floor(Number(v) || 0))) });
  const todas = items.every(i => (cantidades[i.item_id] || 0) === i.pendiente);
  return html`<div className="tabla-wrap"><table>
    <thead><tr><th>Entregada</th><th>Prenda</th><th className="num">Precio</th><th className="num">En el local</th>
      <th className="num">${modo === 'pago' ? 'Pagadas' : 'Devueltas'} <button className="link" type="button" onClick=${() => setCantidades(todas ? {} : Object.fromEntries(items.map(i => [i.item_id, i.pendiente])))}>${todas ? 'Ninguna' : 'Todas'}</button></th>
      <th className="num">Valor</th></tr></thead>
    <tbody>${items.map(i => html`<tr key=${i.item_id} className=${(cantidades[i.item_id] || 0) > 0 ? 'fila-sel' : ''}>
      <td style=${{ whiteSpace: 'nowrap' }}>${fechaCorta(i.fecha)}<br /><span className="small muted">#${i.entrega_numero} · ${plural(i.dias, 'día', 'días')}</span></td>
      <td><b>${i.descripcion}</b>${i.detalle && html` <span className="muted">${i.detalle}</span>`}</td>
      <td className="num">${pesos(i.precio)}</td>
      <td className="num">${i.pendiente}</td>
      <td className="num"><input className="cant" type="number" min="0" max=${i.pendiente} value=${cantidades[i.item_id] || ''} placeholder="0"
        onChange=${e => fijar(i.item_id, e.target.value, i.pendiente)} aria-label=${`${modo === 'pago' ? 'Pagadas' : 'Devueltas'} de ${i.descripcion}`} /></td>
      <td className="num">${pesos((cantidades[i.item_id] || 0) * i.precio)}</td>
    </tr>`)}</tbody>
  </table></div>`;
}

/* =====================================================================
   PANEL PRINCIPAL
   ===================================================================== */
function VistaPanel() {
  const { ir, perfil } = useApp();
  const ini = hoy().slice(0, 8) + '01';
  const r = useDatos(async () => {
    const [inf, ent, cob, dev, deudores] = await Promise.all([
      rpc('cp_informe', { p_desde: ini, p_hasta: hoy() }),
      consulta(db.from('cp_entregas').select('id, numero, fecha, total, estado, creado_en, local_id, cp_entrega_items(cantidad, cant_pagada, cant_devuelta)').order('creado_en', { ascending: false }).limit(10)),
      consulta(db.from('cp_cobros').select('id, numero, fecha, valor, medio, tipo, estado, creado_en, local_id').order('creado_en', { ascending: false }).limit(10)),
      consulta(db.from('cp_devoluciones').select('id, fecha, valor, cantidad, creado_en, local_id, cp_entrega_items(descripcion)').order('creado_en', { ascending: false }).limit(10)),
      consulta(db.from('cp_saldos_locales').select('local_id, saldo, dias_sin_pagar').gt('saldo', 0).order('saldo', { ascending: false }).limit(6)),
    ]);
    const movs = [
      ...ent.map(e => ({ k: 'e' + e.id, t: e.creado_en, fecha: e.fecha, local_id: e.local_id, tipo: `Entrega #${e.numero}`, valor: e.total,
        estado: e.estado === 'anulada' ? ['neutro', 'Anulada'] : e.cp_entrega_items.some(i => i.cantidad - i.cant_pagada - i.cant_devuelta > 0) ? ['aviso', 'Pendiente'] : ['ok', 'Pagada'] })),
      ...cob.map(c => ({ k: 'c' + c.id, t: c.creado_en, fecha: c.fecha, local_id: c.local_id, tipo: c.tipo === 'abono' ? `Abono #${c.numero}` : `Cobro #${c.numero}`, valor: c.valor,
        estado: c.estado === 'anulado' ? ['neutro', 'Anulado'] : c.medio === 'efectivo' ? ['ok', 'Efectivo'] : ['info', MEDIOS[c.medio]] })),
      ...dev.map(d => ({ k: 'd' + d.id, t: d.creado_en, fecha: d.fecha, local_id: d.local_id, tipo: `Devolución: ${d.cantidad} ${d.cp_entrega_items?.descripcion || ''}`, valor: d.valor, estado: ['neutro', 'Devuelta'] })),
    ].sort((a, b) => b.t.localeCompare(a.t)).slice(0, 10);
    return { inf, movs, deudores };
  }, []);
  const { localPorId, nombreLocal, cat } = useApp();
  const saludo = (() => { const h = new Date().getHours(); return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'; })();
  const mes = MESES[new Date().getMonth()];
  return html`<${Fragment}>
    <${Encabezado} eti=${fechaCorta(hoy())} titulo=${`${saludo}, ${perfil.nombre.split(' ')[0]}`} sub="¿Qué quieres hacer hoy?" />
    ${!r.datos ? html`<${Cargando} error=${r.error} onReintentar=${r.recargar} />` : html`<${Fragment}>
      <div className="acciones-grandes">
        <button className="accion-g" onClick=${() => ir('entregas', { nueva: true })}><span className="ico-caja"><${Ico} n="entregas" /></span><b>Dejé mercancía</b><small>Anota las prendas que le dejaste a un local</small></button>
        <button className="accion-g" onClick=${() => ir('cobros')}><span className="ico-caja"><${Ico} n="cobros" /></span><b>Me pagaron</b><small>Registra el dinero que te dio un local</small></button>
        <button className="accion-g" onClick=${() => ir('devoluciones')}><span className="ico-caja"><${Ico} n="devoluciones" /></span><b>Me devolvieron</b><small>Prendas que el local no vendió</small></button>
      </div>
      ${(() => {
        const pasos = [
          { ok: cat.prendas.length > 0, t: 'Crea tus prendas', d: 'Referencia, nombre y precio de lo que vendes.', a: () => ir('inventario') },
          { ok: cat.locales.length > 0, t: 'Agrega un local', d: 'El centro comercial y el local donde dejas mercancía.', a: () => ir('locales') },
          { ok: r.datos.inf.entregas > 0 || r.datos.movs.length > 0, t: 'Registra tu primera entrega', d: 'Lo que le dejaste al local.', a: () => ir('entregas', { nueva: true }) },
          { ok: r.datos.movs.some(m => m.k[0] === 'c'), t: 'Cobra cuando te paguen', d: 'Así sabes siempre quién te debe.', a: () => ir('cobros') },
        ];
        if (pasos.every(p => p.ok)) return null;
        return html`<div className="panel primeros"><h2>Primeros pasos</h2><p className="sub">Sigue estos pasos en orden y en pocos minutos tendrás todo funcionando.</p>
          <ol className="pasos">${pasos.map((p, i) => html`<li key=${i} className=${p.ok ? 'hecho' : ''}><span className="num-paso">${p.ok ? '✓' : i + 1}</span>
            <div><b>${p.t}</b><small>${p.d}</small></div>${!p.ok && html`<button className="btn btn-sm btn-primary" onClick=${p.a}>Hacerlo</button>`}</li>`)}</ol></div>`;
      })()}
      <div className="kpis">
        <${Kpi} t="Te deben" v=${pesos(r.datos.inf.saldo_total)} s=${r.datos.inf.atrasados ? `${plural(r.datos.inf.atrasados, 'local lleva', 'locales llevan')} más de ${r.datos.inf.dias_atraso} días sin pagar` : 'Entre todos los locales'} cls=${r.datos.inf.atrasados ? 'mora' : 'alerta'} />
        <${Kpi} t="Te pagaron este mes" v=${pesos(r.datos.inf.recaudado)} s=${`En ${mes}`} cls="bueno" />
        <${Kpi} t="Dejaste este mes" v=${pesos(r.datos.inf.entregado)} s=${plural(r.datos.inf.entregas, 'entrega', 'entregas')} />
        <${Kpi} t="Prendas en los locales" v=${numero(r.datos.inf.prendas_en_locales)} s="Sin pagar ni devolver" />
      </div>
      <div className="col-ancha">
        <div className="panel"><div className="panel-cab"><div><h2>Últimos movimientos</h2><p className="sub">Entregas, cobros y devoluciones más recientes</p></div></div>
          ${r.datos.movs.length ? html`<div className="tabla-wrap"><table>
            <thead><tr><th>Centro comercial</th><th>Local</th><th>Movimiento</th><th className="num">Valor</th><th>Estado</th></tr></thead>
            <tbody>${r.datos.movs.map(m => { const l = localPorId(m.local_id); return html`<tr key=${m.k} className="clic" onClick=${() => ir('local', { id: m.local_id })}>
              <td>${l?.centro || ''}</td><td><b>${l?.nombre || ''}</b></td>
              <td>${m.tipo}<br /><span className="small muted">${fechaCorta(m.fecha)}</span></td>
              <td className="num">${pesos(m.valor)}</td><td><span className=${'badge ' + m.estado[0]}>${m.estado[1]}</span></td></tr>`; })}</tbody>
          </table></div>` : html`<${Vacio} ico="entregas">Aún no hay movimientos. Empieza registrando una entrega.<//>`}
        </div>
        <div className="panel"><div className="panel-cab"><div><h2>Los que más te deben</h2><p className="sub">Toca uno para cobrarle</p></div><button className="link" onClick=${() => ir('locales', { filtro: 'saldo' })}>Ver todos</button></div>
          ${r.datos.deudores.length ? html`<div className="tabla-wrap"><table><tbody>${r.datos.deudores.map(d => html`<tr key=${d.local_id} className="clic" onClick=${() => ir('local', { id: d.local_id })}>
            <td><b>${nombreLocal(d.local_id)}</b><br /><span className="small muted">${d.dias_sin_pagar > r.datos.inf.dias_atraso ? html`<span className="badge bajo">${d.dias_sin_pagar} días sin pagar</span>` : `${plural(d.dias_sin_pagar || 0, 'día', 'días')} sin pagar`}</span></td>
            <td className="num"><b>${pesos(d.saldo)}</b></td></tr>`)}</tbody></table></div>` : html`<${Vacio}>Nadie debe en este momento.<//>`}
        </div>
      </div>
    <//>`}
  <//>`;
}

/* =====================================================================
   ENTREGAS
   ===================================================================== */
function VistaEntregas({ params }) {
  const { ir } = useApp();
  const [nueva, setNueva] = useState(!!params?.nueva);
  useEffect(() => { setNueva(!!params?.nueva); }, [params]);
  if (nueva) return html`<${FormEntrega} localInicial=${params?.local} onSalir=${() => { setNueva(false); ir('entregas'); }} />`;
  return html`<${ListaEntregas} onNueva=${() => setNueva(true)} />`;
}

function FormEntrega({ localInicial, onSalir }) {
  const { cat, esDueno, recargarCat, nombreLocal, localPorId } = useApp();
  const [local, setLocal] = useState(localInicial || null);
  const [fecha, setFecha] = useState(hoy());
  const [nota, setNota] = useState('');
  const [lineas, setLineas] = useState([]);
  const [q, setQ] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [hecha, setHecha] = useState(null);
  const prendas = cat.prendas.filter(p => p.activo);
  const res = useMemo(() => {
    const t = normal(q); if (!t) return [];
    return prendas.filter(p => normal(p.referencia).includes(t)).slice(0, 12);
    // eslint-disable-next-line
  }, [q, cat.prendas]);
  const agregar = p => { setLineas([...lineas, { k: Math.random(), prenda_id: p.id, referencia: p.referencia, stock: p.stock, cantidad: 1, precio: Number(p.precio), detalle: '' }]); setQ(''); };
  const cambiar = (k, campo, v) => setLineas(lineas.map(l => l.k === k ? { ...l, [campo]: v } : l));
  const usado = id => lineas.filter(l => l.prenda_id === id).reduce((t, l) => t + (Number(l.cantidad) || 0), 0);
  const total = lineas.reduce((t, l) => t + (Number(l.cantidad) || 0) * (Number(l.precio) || 0), 0);
  const unidades = lineas.reduce((t, l) => t + (Number(l.cantidad) || 0), 0);
  const faltan = lineas.filter(l => usado(l.prenda_id) > l.stock);
  const guardarEntrega = async () => {
    if (!local) return aviso('Elige el local que recibe la mercancía.', 'error');
    if (!lineas.length) return aviso('Agrega al menos una prenda.', 'error');
    if (lineas.some(l => !(Number(l.cantidad) > 0))) return aviso('Revisa las cantidades.', 'error');
    setOcupado(true);
    try {
      const r = await rpc('cp_registrar_entrega', {
        p_local: local, p_fecha: fecha, p_nota: nota.trim() || null,
        p_items: lineas.map(l => ({ prenda_id: l.prenda_id, cantidad: Number(l.cantidad), precio: esDueno ? Number(l.precio) : undefined, detalle: l.detalle })),
      });
      setHecha({ ...r, local, lineas, fecha });
      recargarCat();
    } catch (e) { aviso(errorTexto(e), 'error'); }
    setOcupado(false);
  };
  if (hecha) {
    const l = localPorId(hecha.local);
    const texto = `Remisión de mercancía #${hecha.numero}\n${nombreLocal(hecha.local)}\nFecha: ${fechaCorta(hecha.fecha)}\n\n` +
      hecha.lineas.map(x => `${x.cantidad} × ${x.referencia}${x.detalle ? ' ' + x.detalle.toUpperCase() : ''} a ${pesos(x.precio)} = ${pesos(x.cantidad * x.precio)}`).join('\n') +
      `\n\nTotal: ${pesos(hecha.total)}\nGracias.`;
    return html`<div className="panel exito">
      <span className="chip-ico ok" style=${{ width: 48, height: 48 }}><${Ico} n="check" /></span>
      <h2>Entrega #${hecha.numero} registrada</h2>
      <p className="muted">${nombreLocal(hecha.local)} recibió ${plural(hecha.lineas.reduce((t, x) => t + Number(x.cantidad), 0), 'prenda', 'prendas')} por <b>${pesos(hecha.total)}</b>. El inventario ya se descontó.</p>
      <div className="row" style=${{ justifyContent: 'center', marginTop: 16 }}>
        ${l?.telefono && html`<button className="btn" onClick=${() => abrirWhatsApp(l.telefono, texto)}><${Ico} n="whatsapp" />Enviar remisión por WhatsApp</button>`}
        ${!l?.telefono && html`<button className="btn" onClick=${() => abrirWhatsApp('', texto)}><${Ico} n="whatsapp" />Compartir remisión</button>`}
        <button className="btn" onClick=${onSalir}>Ver entregas</button>
        <button className="btn btn-primary" onClick=${() => { setHecha(null); setLineas([]); setNota(''); }}>Otra entrega</button>
      </div>
    </div>`;
  }
  return html`<${Fragment}>
    <button className="link volver" onClick=${onSalir}><${Ico} n="atras" />Volver a entregas</button>
    <${Encabezado} eti="Paso a paso" titulo="Dejar mercancía en un local" sub="Anota qué prendas le dejas al local. Después, cuando las venda, se las cobras." ayuda=${['Busca el local (si es nuevo, créalo ahí mismo).', 'Agrega cada prenda con la cantidad que le dejas.', 'Toca "Registrar entrega". El local queda debiendo ese valor y las prendas salen de tu bodega.']} />
    <div className="pos pos-entrega">
      <div className="apilado">
        <div className="panel">
          <h2>1. ¿A qué local se entrega?</h2><p className="sub">Busca por centro comercial y local.</p>
          <${SelectorLocal} valor=${local} onCambio=${setLocal} autoFocus=${!local} />
          <div className="grid2">
            <div><label htmlFor="feFecha">Fecha de entrega</label><input id="feFecha" type="date" value=${fecha} max=${hoy()} onChange=${e => setFecha(e.target.value)} /></div>
            <div><label htmlFor="feNota">Nota (opcional)</label><input id="feNota" value=${nota} onChange=${e => setNota(e.target.value)} placeholder="Ej: recibió Keila" /></div>
          </div>
        </div>
        <div className="panel">
          <h2>2. Prendas</h2><p className="sub">Busca la referencia. Puedes repetir una prenda para registrar colores distintos.</p>
          <div className="buscador">
            <input type="search" placeholder="Escribe la referencia (ej: MIA, LINA, PROMO)" value=${q} onChange=${e => setQ(e.target.value)}
              onKeyDown=${e => { if (e.key === 'Enter' && res[0]) { e.preventDefault(); agregar(res[0]); } }} aria-label="Buscar prenda" />
            ${res.length > 0 && html`<div className="resultados">${res.map(p => html`<div key=${p.id} onMouseDown=${e => { e.preventDefault(); agregar(p); }}>
              <span><b>${p.referencia}</b></span><span className="small muted num">${pesos(p.precio)} · ${p.stock > 0 ? `quedan ${p.stock}` : 'agotada'}</span></div>`)}</div>`}
            ${q && !res.length && html`<p className="small muted" style=${{ margin: '8px 0 0' }}>No hay prendas con "${q}". ${esDueno ? 'Créala en Inventario.' : 'Pídele al dueño que la cree en Inventario.'}</p>`}
          </div>
          ${lineas.length ? html`<div className="tabla-wrap" style=${{ marginTop: 14 }}><table>
            <thead><tr><th>Prenda</th><th>Color</th><th className="num">Cant.</th><th className="num">Precio</th><th className="num">Subtotal</th><th></th></tr></thead>
            <tbody>${lineas.map(l => html`<tr key=${l.k}>
              <td><b>${l.referencia}</b><br /><span style=${{ whiteSpace: 'nowrap' }} className=${'small ' + (usado(l.prenda_id) > l.stock ? 'texto-peligro' : 'muted')}>${usado(l.prenda_id) > l.stock ? `Solo hay ${l.stock} en bodega` : `En bodega: ${l.stock}`}</span></td>
              <td><input value=${l.detalle} onChange=${e => cambiar(l.k, 'detalle', e.target.value)} placeholder="Negro, beige…" className="input-detalle" aria-label="Color o detalle" /></td>
              <td className="num"><input className="cant" type="number" min="1" value=${l.cantidad} onChange=${e => cambiar(l.k, 'cantidad', e.target.value)} aria-label="Cantidad" /></td>
              <td className="num">${esDueno ? html`<input className="cant cant-precio" type="number" min="0" step="500" value=${l.precio} onChange=${e => cambiar(l.k, 'precio', e.target.value)} aria-label="Precio" />` : pesos(l.precio)}</td>
              <td className="num"><b>${pesos((Number(l.cantidad) || 0) * (Number(l.precio) || 0))}</b></td>
              <td><button className="quitar" onClick=${() => setLineas(lineas.filter(x => x.k !== l.k))} aria-label="Quitar"><${Ico} n="x" /></button></td>
            </tr>`)}</tbody></table></div>` : html`<${Vacio} ico="entregas">Aún no has agregado prendas.<//>`}
        </div>
      </div>
      <aside className="cobro">
        <div className="cobro-cab"><span>Remisión</span><b>${local ? nombreLocal(local) : 'Sin local'}</b></div>
        <div className="bloque-total">
          <div className="linea-total"><span>Prendas</span><b>${numero(unidades)}</b></div>
          <div className="linea-total"><span>Referencias</span><b>${lineas.length}</b></div>
          <div className="total-grande">${pesos(total)}</div>
          <p className="small muted" style=${{ margin: '4px 0 0' }}>Queda pendiente de cobro hasta que el local pague.</p>
        </div>
        ${faltan.length > 0 && html`<div className="fe-caja error small" style=${{ marginBottom: 12 }}>No hay existencias suficientes de ${[...new Set(faltan.map(f => f.referencia))].join(', ')}. ${esDueno ? 'Registra una entrada de mercancía o un conteo en Inventario.' : ''}</div>`}
        <button className="btn btn-primary btn-lg" style=${{ width: '100%' }} disabled=${ocupado || !local || !lineas.length || faltan.length > 0} onClick=${guardarEntrega}>${ocupado ? 'Guardando…' : 'Registrar entrega'}</button>
      </aside>
    </div>
  <//>`;
}

function filtroFechas(dias = 30) { return { desde: sumarDias(hoy(), -dias + 1), hasta: hoy() }; }

function ListaEntregas({ onNueva }) {
  const { cat, localPorId } = useApp();
  const [f, setF] = useState({ ...filtroFechas(30), centro: '', q: '', estado: '' });
  const [detalle, setDetalle] = useState(null);
  const r = useDatos(() => consulta(db.from('cp_entregas').select('id, numero, fecha, total, estado, nota, local_id, cp_entrega_items(cantidad, cant_pagada, cant_devuelta, precio)')
    .gte('fecha', f.desde).lte('fecha', f.hasta).order('fecha', { ascending: false }).order('numero', { ascending: false }).limit(1000)), [f.desde, f.hasta]);
  const filas = (r.datos || []).map(e => {
    const l = localPorId(e.local_id) || {};
    const pend = e.cp_entrega_items.reduce((t, i) => t + (i.cantidad - i.cant_pagada - i.cant_devuelta) * i.precio, 0);
    return { ...e, centro: l.centro, local: l.nombre, centro_id: l.centro_id, prendas: e.cp_entrega_items.reduce((t, i) => t + i.cantidad, 0), pend };
  }).filter(e => (!f.centro || String(e.centro_id) === f.centro) && (!f.q || normal(`${e.centro} ${e.local} ${e.numero}`).includes(normal(f.q))) &&
    (!f.estado || (f.estado === 'pendiente' ? e.estado === 'activa' && e.pend > 0 : f.estado === 'pagada' ? e.estado === 'activa' && e.pend <= 0 : e.estado === 'anulada')));
  const act = filas.filter(e => e.estado === 'activa');
  return html`<${Fragment}>
    <${Encabezado} eti="Operación" titulo="Entregas" sub="Todo lo que has dejado en los locales para que lo vendan." ayuda=${['Cada vez que dejas prendas en un local, registra una entrega con el botón "Nueva entrega".', 'Toca una entrega para ver qué prendas siguen en el local, cuáles pagó y cuáles devolvió.']}>
      <button className="btn btn-primary" onClick=${onNueva}><${Ico} n="mas" />Nueva entrega</button>
    <//>
    <div className="filtros">
      <input type="search" placeholder="Buscar local o número…" value=${f.q} onChange=${e => setF({ ...f, q: e.target.value })} />
      <select value=${f.centro} onChange=${e => setF({ ...f, centro: e.target.value })} aria-label="Centro comercial"><option value="">Todos los centros</option>${cat.centros.map(c => html`<option key=${c.id} value=${c.id}>${c.nombre}</option>`)}</select>
      <select value=${f.estado} onChange=${e => setF({ ...f, estado: e.target.value })} aria-label="Estado"><option value="">Todos los estados</option><option value="pendiente">Con saldo pendiente</option><option value="pagada">Pagadas o devueltas</option><option value="anulada">Anuladas</option></select>
      <input type="date" className="fecha-filtro" value=${f.desde} onChange=${e => setF({ ...f, desde: e.target.value })} aria-label="Desde" />
      <input type="date" className="fecha-filtro" value=${f.hasta} onChange=${e => setF({ ...f, hasta: e.target.value })} aria-label="Hasta" />
    </div>
    ${!r.datos ? html`<${Cargando} error=${r.error} onReintentar=${r.recargar} />` : html`<${Fragment}>
      <div className="kpis">
        <${Kpi} t="Entregado" v=${pesos(act.reduce((t, e) => t + Number(e.total), 0))} s=${plural(act.length, 'entrega', 'entregas')} />
        <${Kpi} t="Prendas" v=${numero(act.reduce((t, e) => t + e.prendas, 0))} />
        <${Kpi} t="Aún sin cobrar" v=${pesos(act.reduce((t, e) => t + e.pend, 0))} s="Valor de prendas en los locales" cls="alerta" />
      </div>
      <div className="tabla-wrap"><table>
        <thead><tr><th>#</th><th>Fecha</th><th>Centro comercial</th><th>Local</th><th className="num">Prendas</th><th className="num">Total</th><th className="num">Pendiente</th><th>Estado</th></tr></thead>
        <tbody>${filas.length ? filas.map(e => html`<tr key=${e.id} className="clic" onClick=${() => setDetalle(e.id)}>
          <td className="num">${e.numero}</td><td style=${{ whiteSpace: 'nowrap' }}>${fechaCorta(e.fecha)}</td><td>${e.centro}</td><td><b>${e.local}</b></td>
          <td className="num">${e.prendas}</td><td className="num">${pesos(e.total)}</td><td className="num">${e.estado === 'activa' ? pesos(e.pend) : '—'}</td>
          <td>${e.estado === 'anulada' ? html`<span className="badge neutro">Anulada</span>` : e.pend > 0 ? html`<span className="badge aviso">Pendiente</span>` : html`<span className="badge ok">Cerrada</span>`}</td>
        </tr>`) : html`<tr><td colSpan="8" className="vacio">No hay entregas con esos filtros.</td></tr>`}</tbody>
      </table></div>
    <//>`}
    ${detalle && html`<${DetalleEntrega} id=${detalle} onCerrar=${() => setDetalle(null)} onCambio=${r.recargar} />`}
  <//>`;
}

function DetalleEntrega({ id, onCerrar, onCambio }) {
  const { esDueno, nombreLocal, ir, recargarCat } = useApp();
  const r = useDatos(() => consulta(db.from('cp_entregas').select('*, cp_entrega_items(*)').eq('id', id).single()), [id]);
  const [devolver, setDevolver] = useState(null);
  const e = r.datos;
  const anular = async () => {
    const motivo = await preguntar({ titulo: `Anular entrega #${e.numero}`, texto: 'Las prendas vuelven a la bodega y la entrega deja de contar en el saldo del local. Esto no se puede deshacer.', campo: 'Motivo de la anulación', ok: 'Anular entrega', peligro: true });
    if (!motivo) return;
    try { await rpc('cp_anular_entrega', { p_entrega: id, p_motivo: motivo }); aviso('Entrega anulada', 'ok'); recargarCat(); onCambio(); r.recargar(); }
    catch (err) { aviso(errorTexto(err), 'error'); }
  };
  return html`<${Modal} ancho titulo=${e ? `Entrega #${e.numero}` : 'Entrega'} sub=${e ? `${nombreLocal(e.local_id)} · ${fechaCorta(e.fecha)}` : ''} onCerrar=${onCerrar}
    pie=${e && html`${esDueno && e.estado === 'activa' && !e.cp_entrega_items.some(i => i.cant_pagada || i.cant_devuelta) && html`<button className="btn btn-danger" onClick=${anular}>Anular entrega</button>`}
      ${e.estado === 'activa' && html`<button className="btn" onClick=${() => { onCerrar(); ir('local', { id: e.local_id }); }}>Ver el local</button>
      <button className="btn btn-primary" onClick=${() => { onCerrar(); ir('cobros', { local: e.local_id }); }}>Registrar cobro</button>`}`}>
    ${!e ? html`<${Cargando} error=${r.error} />` : html`<${Fragment}>
      ${e.estado === 'anulada' && html`<div className="fe-caja error"><b>Entrega anulada</b><span className="small">${e.motivo_anulacion || ''}</span></div>`}
      ${e.nota && html`<p className="muted">Nota: ${e.nota}</p>`}
      <div className="tabla-wrap" style=${{ marginTop: 12 }}><table>
        <thead><tr><th>Prenda</th><th className="num">Cant.</th><th className="num">Precio</th><th className="num">Pagadas</th><th className="num">Devueltas</th><th className="num">En el local</th><th></th></tr></thead>
        <tbody>${e.cp_entrega_items.map(i => { const p = i.cantidad - i.cant_pagada - i.cant_devuelta; return html`<tr key=${i.id}>
          <td><b>${i.descripcion}</b>${i.detalle && html` <span className="muted">${i.detalle}</span>`}</td>
          <td className="num">${i.cantidad}</td><td className="num">${pesos(i.precio)}</td><td className="num">${i.cant_pagada}</td><td className="num">${i.cant_devuelta}</td>
          <td className="num"><b>${p}</b></td>
          <td className="acciones">${p > 0 && e.estado === 'activa' && html`<button className="link" onClick=${() => setDevolver({ ...i, pendiente: p })}>Devolver</button>`}</td>
        </tr>`; })}</tbody>
        <tfoot><tr><td><b>Total</b></td><td className="num"><b>${e.cp_entrega_items.reduce((t, i) => t + i.cantidad, 0)}</b></td><td></td><td></td><td></td><td></td><td className="num"><b>${pesos(e.total)}</b></td></tr></tfoot>
      </table></div>
    <//>`}
    ${devolver && html`<${ModalDevolverItem} item=${devolver} onCerrar=${() => setDevolver(null)} onHecho=${() => { setDevolver(null); r.recargar(); onCambio(); }} />`}
  <//>`;
}

function ModalDevolverItem({ item, onCerrar, onHecho }) {
  const { recargarCat } = useApp();
  const [cant, setCant] = useState(item.pendiente);
  const [nota, setNota] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const ok = async () => {
    setOcupado(true);
    try {
      const r = await rpc('cp_registrar_devolucion', { p_item: item.id ?? item.item_id, p_cantidad: Number(cant), p_nota: nota.trim() || null });
      aviso(`Devolución registrada. Saldo del local: ${pesos(r.saldo)}`, 'ok'); recargarCat(); onHecho();
    } catch (e) { aviso(errorTexto(e), 'error'); }
    setOcupado(false);
  };
  return html`<${Modal} titulo="Registrar devolución" sub=${`${item.descripcion}${item.detalle ? ' ' + item.detalle : ''}: hay ${item.pendiente} en el local a ${pesos(item.precio)}`} onCerrar=${onCerrar}
    pie=${html`<button className="btn" onClick=${onCerrar}>Cancelar</button><button className="btn btn-primary" disabled=${ocupado || !(cant > 0)} onClick=${ok}>Registrar devolución</button>`}>
    <div className="grid2">
      <div><label htmlFor="dvCant">Prendas devueltas</label><input id="dvCant" type="number" min="1" max=${item.pendiente} value=${cant} onChange=${e => setCant(Math.max(0, Math.min(item.pendiente, Math.floor(Number(e.target.value) || 0))))} autoFocus /></div>
      <div><label htmlFor="dvNota">Motivo (opcional)</label><input id="dvNota" value=${nota} onChange=${e => setNota(e.target.value)} placeholder="Ej: no se vendió" /></div>
    </div>
    <p className="small muted" style=${{ margin: '10px 0 0' }}>Se descuentan ${pesos(cant * item.precio)} del saldo del local y las prendas vuelven a la bodega.</p>
  <//>`;
}

/* =====================================================================
   COBROS
   ===================================================================== */
function VistaCobros({ params }) {
  const [local, setLocal] = useState(params?.local || null);
  const [vuelta, setVuelta] = useState(0);
  useEffect(() => { if (params?.local) setLocal(params.local); }, [params]);
  return html`<${Fragment}>
    <${Encabezado} eti="Operación" titulo="Cobrar a un local" sub="Usa esta pantalla cuando el local te pague." ayuda=${['Elige el local: verás las prendas que te debe.', 'Escribe cuántas de cada prenda te pagó, o solo el dinero que te dio (eso es un abono: un pago parcial).', 'Elige cómo te pagó y toca "Registrar cobro". Lo que debe el local baja de inmediato.']} />
    <${FormCobro} local=${local} setLocal=${setLocal} onHecho=${() => setVuelta(v => v + 1)} />
    <${ListaCobros} vuelta=${vuelta} />
  <//>`;
}

function FormCobro({ local, setLocal, onHecho }) {
  const { localPorId, nombreLocal } = useApp();
  const saldos = useDatos(() => consulta(db.from('cp_saldos_locales').select('local_id, saldo').neq('saldo', 0)), []);
  const r = useDatos(async () => {
    if (!local) return null;
    const [s, items] = await Promise.all([
      consulta(db.from('cp_saldos_locales').select('*').eq('local_id', local).maybeSingle()),
      consulta(db.from('cp_items_pendientes').select('*').eq('local_id', local).order('fecha').order('item_id')),
    ]);
    return { s, items };
  }, [local]);
  const [cant, setCant] = useState({});
  const [valor, setValor] = useState('');
  const [valorTocado, setValorTocado] = useState(false);
  const [medio, setMedio] = useState('efectivo');
  const [fecha, setFecha] = useState(hoy());
  const [nota, setNota] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [devolver, setDevolver] = useState(null);
  const [recibo, setRecibo] = useState(null);
  useEffect(() => { setCant({}); setValor(''); setValorTocado(false); setNota(''); }, [local]);
  const items = r.datos?.items || [];
  const valorPrendas = items.reduce((t, i) => t + (cant[i.item_id] || 0) * i.precio, 0);
  useEffect(() => { if (!valorTocado) setValor(valorPrendas ? String(valorPrendas) : ''); }, [valorPrendas, valorTocado]);
  const saldo = Number(r.datos?.s?.saldo || 0);
  const recibido = Number(valor) || 0;
  const registrar = async () => {
    if (!(recibido > 0)) return aviso('Escribe cuánto dinero recibiste.', 'error');
    setOcupado(true);
    try {
      const sel = items.filter(i => cant[i.item_id] > 0);
      const res = await rpc('cp_registrar_cobro', { p_local: local, p_valor: recibido, p_medio: medio, p_fecha: fecha, p_nota: nota.trim() || null,
        p_items: sel.map(i => ({ item_id: i.item_id, cantidad: cant[i.item_id] })) });
      setRecibo({ ...res, local, recibido, medio, fecha, sel: sel.map(i => ({ ...i, c: cant[i.item_id] })) });
      setCant({}); setValor(''); setValorTocado(false); setNota('');
      r.recargar(); saldos.recargar(); onHecho();
    } catch (e) { aviso(errorTexto(e), 'error'); }
    setOcupado(false);
  };
  const tel = localPorId(local)?.telefono;
  return html`<div className="panel">
    <h2>Registrar cobro</h2><p className="sub">Busca el local que vas a cobrar.</p>
    <${SelectorLocal} valor=${local} onCambio=${setLocal} saldos=${saldos.datos} permitirNuevo=${false} />
    ${local && (!r.datos ? html`<div style=${{ marginTop: 14 }}><${Cargando} error=${r.error} /></div>` : html`<${Fragment}>
      <div className="kpis" style=${{ marginTop: 16 }}>
        <${Kpi} t="Saldo actual" v=${pesos(saldo)} cls=${saldo > 0 ? 'alerta' : 'bueno'} s=${r.datos.s?.ultimo_cobro ? `Último pago: ${fechaCorta(r.datos.s.ultimo_cobro)}` : 'Aún no ha pagado'} />
        <${Kpi} t="Prendas en el local" v=${numero(r.datos.s?.prendas_en_local || 0)} s=${pesos(items.reduce((t, i) => t + i.valor_pendiente, 0)) + ' en mercancía'} />
        <${Kpi} t="Saldo después del cobro" v=${pesos(saldo - recibido)} s=${recibido > saldo ? 'Queda saldo a favor del local' : ''} />
      </div>
      <h3 className="subtitulo">¿Qué prendas se pagaron?</h3>
      <p className="small muted" style=${{ margin: '0 0 8px' }}>Si solo te dieron un abono sin decir qué prendas, deja todo en cero.</p>
      <${PrendasDelLocal} items=${items} cantidades=${cant} setCantidades=${setCant} modo="pago" />
      ${items.length > 0 && html`<p className="small" style=${{ margin: '8px 0 0' }}>¿Devolvieron alguna prenda? ${items.slice(0, 6).map(i => html`<button key=${i.item_id} className="link" onClick=${() => setDevolver({ ...i, id: i.item_id })}>${i.descripcion}${i.detalle ? ' ' + i.detalle : ''}</button>`)}${items.length > 6 && html`<span className="muted"> o desde la pestaña Devoluciones.</span>`}</p>`}
      <div className="grid3" style=${{ marginTop: 6 }}>
        <div><label htmlFor="coValor">Dinero recibido</label><input id="coValor" type="number" min="0" step="1000" value=${valor} onChange=${e => { setValor(e.target.value); setValorTocado(true); }} placeholder="$0" /></div>
        <div><label htmlFor="coFecha">Fecha</label><input id="coFecha" type="date" value=${fecha} max=${hoy()} onChange=${e => setFecha(e.target.value)} /></div>
        <div><label htmlFor="coNota">Nota (opcional)</label><input id="coNota" value=${nota} onChange=${e => setNota(e.target.value)} placeholder="Ej: comprobante 4587" /></div>
      </div>
      <label>Medio de pago</label>
      <div className="medios cuatro">${Object.entries(MEDIOS).map(([k, v]) => html`<button key=${k} type="button" className=${medio === k ? 'activa' : ''} aria-pressed=${medio === k} onClick=${() => setMedio(k)}>${v}</button>`)}</div>
      <div className=${'cambio ' + (recibido && valorPrendas && recibido !== valorPrendas ? '' : recibido ? 'ok' : '')}>
        <span>${!valorPrendas ? (recibido ? 'Se registra como abono al saldo' : 'Elige prendas o escribe un abono') : recibido === valorPrendas ? 'Pago exacto de las prendas elegidas' : recibido > valorPrendas ? `Recibes ${pesos(recibido - valorPrendas)} más que el valor de las prendas: se abona al saldo` : `Faltan ${pesos(valorPrendas - recibido)} para cubrir las prendas elegidas: quedan en el saldo`}</span>
        <strong>${pesos(recibido)}</strong>
      </div>
      <div className="modal-acciones"><button className="btn btn-primary btn-lg" disabled=${ocupado || !(recibido > 0)} onClick=${registrar}>${ocupado ? 'Guardando…' : 'Registrar cobro'}</button></div>
    <//>`)}
    ${devolver && html`<${ModalDevolverItem} item=${devolver} onCerrar=${() => setDevolver(null)} onHecho=${() => { setDevolver(null); r.recargar(); saldos.recargar(); setCant({}); }} />`}
    ${recibo && html`<${Modal} titulo=${`${recibo.tipo === 'abono' ? 'Abono' : 'Cobro'} #${recibo.numero} registrado`} onCerrar=${() => setRecibo(null)}
      pie=${html`<button className="btn" onClick=${() => abrirWhatsApp(tel || '', textoRecibo(recibo, nombreLocal))}><${Ico} n="whatsapp" />${tel ? 'Enviar recibo por WhatsApp' : 'Compartir recibo'}</button><button className="btn btn-primary" onClick=${() => setRecibo(null)}>Listo</button>`}>
      <div className="recibo-prev" style=${{ maxWidth: 320 }}>
        <b>${CONFIG.producto}</b><div className="rd-c">${nombreLocal(recibo.local)} · ${fechaCorta(recibo.fecha)}</div><hr />
        ${recibo.sel.map(i => html`<div className="rd-l" key=${i.item_id}><span>${i.c} × ${i.descripcion}</span><span>${pesos(i.c * i.precio)}</span></div>`)}
        ${!recibo.sel.length && html`<div className="rd-l"><span>Abono a la cuenta</span><span>${pesos(recibo.recibido)}</span></div>`}
        <hr /><div className="rd-t"><span>Recibido</span><span>${pesos(recibo.recibido)}</span></div>
        <div className="rd-l"><span>${MEDIOS[recibo.medio]}</span><span></span></div>
        <div className="rd-l"><span>Saldo pendiente</span><span>${pesos(recibo.saldo)}</span></div>
      </div>
    <//>`}
  </div>`;
}
function textoRecibo(r, nombreLocal) {
  return `Recibo de ${r.tipo === 'abono' ? 'abono' : 'pago'} #${r.numero}\n${nombreLocal(r.local)}\nFecha: ${fechaCorta(r.fecha)}\n\n` +
    (r.sel.length ? r.sel.map(i => `${i.c} × ${i.descripcion}${i.detalle ? ' ' + i.detalle : ''} = ${pesos(i.c * i.precio)}`).join('\n') + '\n\n' : '') +
    `Recibido: ${pesos(r.recibido)} (${MEDIOS[r.medio]})\nSaldo pendiente: ${pesos(r.saldo)}\nGracias.`;
}

function ListaCobros({ vuelta }) {
  const { esDueno, localPorId, cat } = useApp();
  const [f, setF] = useState({ ...filtroFechas(30), medio: '', centro: '', q: '' });
  const [ver, setVer] = useState(null);
  const r = useDatos(() => consulta(db.from('cp_cobros').select('*, cp_cobro_items(cantidad, valor, cp_entrega_items(descripcion, detalle))')
    .gte('fecha', f.desde).lte('fecha', f.hasta).order('fecha', { ascending: false }).order('numero', { ascending: false }).limit(1000)), [f.desde, f.hasta, vuelta]);
  const filas = (r.datos || []).map(c => ({ ...c, l: localPorId(c.local_id) || {} }))
    .filter(c => (!f.medio || c.medio === f.medio) && (!f.centro || String(c.l.centro_id) === f.centro) && (!f.q || normal(`${c.l.centro} ${c.l.nombre} ${c.numero}`).includes(normal(f.q))));
  const act = filas.filter(c => c.estado === 'activo');
  const anular = async c => {
    const motivo = await preguntar({ titulo: `Anular cobro #${c.numero}`, texto: `El valor de ${pesos(c.valor)} vuelve a quedar pendiente en el saldo del local y las prendas pagadas vuelven a quedar sin pagar.`, campo: 'Motivo', ok: 'Anular cobro', peligro: true });
    if (!motivo) return;
    try { await rpc('cp_anular_cobro', { p_cobro: c.id, p_motivo: motivo }); aviso('Cobro anulado', 'ok'); setVer(null); r.recargar(); }
    catch (e) { aviso(errorTexto(e), 'error'); }
  };
  return html`<div className="panel">
    <div className="panel-cab"><div><h2>Cobros registrados</h2><p className="sub">Dinero recaudado en el período</p></div></div>
    <div className="filtros">
      <input type="search" placeholder="Buscar local o número…" value=${f.q} onChange=${e => setF({ ...f, q: e.target.value })} />
      <select value=${f.centro} onChange=${e => setF({ ...f, centro: e.target.value })} aria-label="Centro comercial"><option value="">Todos los centros</option>${cat.centros.map(c => html`<option key=${c.id} value=${c.id}>${c.nombre}</option>`)}</select>
      <select value=${f.medio} onChange=${e => setF({ ...f, medio: e.target.value })} aria-label="Medio"><option value="">Todos los medios</option>${Object.entries(MEDIOS).map(([k, v]) => html`<option key=${k} value=${k}>${v}</option>`)}</select>
      <input type="date" className="fecha-filtro" value=${f.desde} onChange=${e => setF({ ...f, desde: e.target.value })} aria-label="Desde" />
      <input type="date" className="fecha-filtro" value=${f.hasta} onChange=${e => setF({ ...f, hasta: e.target.value })} aria-label="Hasta" />
    </div>
    ${!r.datos ? html`<${Cargando} error=${r.error} onReintentar=${r.recargar} />` : html`<${Fragment}>
      <div className="kpis">
        <${Kpi} t="Recaudado" v=${pesos(act.reduce((t, c) => t + Number(c.valor), 0))} s=${plural(act.length, 'cobro', 'cobros')} cls="bueno" />
        ${Object.entries(MEDIOS).map(([k, v]) => { const s = act.filter(c => c.medio === k).reduce((t, c) => t + Number(c.valor), 0); return s ? html`<${Kpi} key=${k} t=${v} v=${pesos(s)} />` : null; })}
      </div>
      <div className="tabla-wrap"><table>
        <thead><tr><th>#</th><th>Fecha</th><th>Centro comercial</th><th>Local</th><th>Tipo</th><th>Medio</th><th className="num">Valor</th></tr></thead>
        <tbody>${filas.length ? filas.map(c => html`<tr key=${c.id} className="clic" onClick=${() => setVer(c)}>
          <td className="num">${c.numero}</td><td style=${{ whiteSpace: 'nowrap' }}>${fechaCorta(c.fecha)}</td><td>${c.l.centro}</td><td><b>${c.l.nombre}</b></td>
          <td>${c.estado === 'anulado' ? html`<span className="badge neutro">Anulado</span>` : c.tipo === 'abono' ? 'Abono' : plural(c.cp_cobro_items.reduce((t, i) => t + i.cantidad, 0), 'prenda', 'prendas')}</td>
          <td>${MEDIOS[c.medio]}</td><td className="num"><b>${pesos(c.valor)}</b></td></tr>`) : html`<tr><td colSpan="7" className="vacio">No hay cobros con esos filtros.</td></tr>`}</tbody>
      </table></div>
    <//>`}
    ${ver && html`<${Modal} titulo=${`${ver.tipo === 'abono' ? 'Abono' : 'Cobro'} #${ver.numero}`} sub=${`${ver.l.centro} · ${ver.l.nombre} · ${fechaCorta(ver.fecha)}`} onCerrar=${() => setVer(null)}
      pie=${html`${esDueno && ver.estado === 'activo' && html`<button className="btn btn-danger" onClick=${() => anular(ver)}>Anular cobro</button>`}<button className="btn btn-primary" onClick=${() => setVer(null)}>Cerrar</button>`}>
      ${ver.estado === 'anulado' && html`<div className="fe-caja error"><b>Cobro anulado</b><span className="small">${ver.motivo_anulacion}</span></div>`}
      <p><b>${pesos(ver.valor)}</b> en ${MEDIOS[ver.medio].toLowerCase()}${ver.nota ? ` · ${ver.nota}` : ''}</p>
      ${ver.cp_cobro_items.length ? html`<div className="tabla-wrap"><table><tbody>${ver.cp_cobro_items.map((i, n) => html`<tr key=${n}><td>${i.cantidad} × ${i.cp_entrega_items?.descripcion} ${i.cp_entrega_items?.detalle || ''}</td><td className="num">${pesos(i.valor)}</td></tr>`)}</tbody></table></div>`
        : html`<p className="muted">Abono a la cuenta del local, sin prendas específicas.</p>`}
    <//>`}
  </div>`;
}

/* =====================================================================
   DEVOLUCIONES
   ===================================================================== */
function VistaDevoluciones({ params }) {
  const { recargarCat } = useApp();
  const [local, setLocal] = useState(params?.local || null);
  const [cant, setCant] = useState({});
  const [nota, setNota] = useState('');
  const [fecha, setFecha] = useState(hoy());
  const [ocupado, setOcupado] = useState(false);
  const [vuelta, setVuelta] = useState(0);
  const r = useDatos(() => local ? consulta(db.from('cp_items_pendientes').select('*').eq('local_id', local).order('fecha').order('item_id')) : Promise.resolve(null), [local, vuelta]);
  const hist = useDatos(() => consulta(db.from('cp_devoluciones').select('*, cp_entrega_items(descripcion, detalle)').order('creado_en', { ascending: false }).limit(50)), [vuelta]);
  const { localPorId } = useApp();
  useEffect(() => { setCant({}); }, [local]);
  const items = r.datos || [];
  const sel = items.filter(i => cant[i.item_id] > 0);
  const valor = sel.reduce((t, i) => t + cant[i.item_id] * i.precio, 0);
  const registrar = async () => {
    setOcupado(true);
    let hechas = 0;
    for (const i of sel) {
      try { await rpc('cp_registrar_devolucion', { p_item: i.item_id, p_cantidad: cant[i.item_id], p_fecha: fecha, p_nota: nota.trim() || null }); hechas++; }
      catch (e) { aviso(`${i.descripcion}: ${errorTexto(e)}`, 'error'); }
    }
    if (hechas) aviso(`${plural(sel.filter((_, n) => n < hechas).reduce((t, i) => t + cant[i.item_id], 0), 'prenda devuelta', 'prendas devueltas')} a la bodega`, 'ok');
    setCant({}); setNota(''); setVuelta(v => v + 1); recargarCat();
    setOcupado(false);
  };
  return html`<${Fragment}>
    <${Encabezado} eti="Operación" titulo="Devoluciones" sub="Prendas que el local no vendió y te regresa." ayuda=${['Busca el local y la prenda que te devuelve.', 'Escribe la cantidad. Esas prendas vuelven a tu bodega y el local deja de deberlas.']} />
    <div className="panel">
      <h2>Registrar devolución</h2><p className="sub">Busca el local que devuelve mercancía.</p>
      <${SelectorLocal} valor=${local} onCambio=${setLocal} permitirNuevo=${false} />
      ${local && (!r.datos ? html`<div style=${{ marginTop: 14 }}><${Cargando} error=${r.error} /></div>` : html`<${Fragment}>
        <h3 className="subtitulo">¿Qué prendas devuelve?</h3>
        <${PrendasDelLocal} items=${items} cantidades=${cant} setCantidades=${setCant} modo="devolucion" />
        ${items.length > 0 && html`<${Fragment}>
          <div className="grid2">
            <div><label htmlFor="dvFecha">Fecha</label><input id="dvFecha" type="date" value=${fecha} max=${hoy()} onChange=${e => setFecha(e.target.value)} /></div>
            <div><label htmlFor="dvNota2">Motivo (opcional)</label><input id="dvNota2" value=${nota} onChange=${e => setNota(e.target.value)} placeholder="Ej: no se vendió, talla equivocada" /></div>
          </div>
          <div className="modal-acciones" style=${{ alignItems: 'center' }}>
            <span className="muted">${sel.length ? `Se descuentan ${pesos(valor)} del saldo` : 'Escribe cuántas prendas devuelve'}</span>
            <button className="btn btn-primary btn-lg" disabled=${ocupado || !sel.length} onClick=${registrar}>${ocupado ? 'Guardando…' : 'Registrar devolución'}</button>
          </div>
        <//>`}
      <//>`)}
    </div>
    <div className="panel">
      <h2>Últimas devoluciones</h2><p className="sub">Las 50 más recientes</p>
      ${!hist.datos ? html`<${Cargando} error=${hist.error} />` : hist.datos.length ? html`<div className="tabla-wrap"><table>
        <thead><tr><th>Fecha</th><th>Centro comercial</th><th>Local</th><th>Prenda</th><th className="num">Cant.</th><th className="num">Valor</th><th>Motivo</th></tr></thead>
        <tbody>${hist.datos.map(d => { const l = localPorId(d.local_id) || {}; return html`<tr key=${d.id}><td style=${{ whiteSpace: 'nowrap' }}>${fechaCorta(d.fecha)}</td><td>${l.centro}</td><td><b>${l.nombre}</b></td>
          <td>${d.cp_entrega_items?.descripcion} ${d.cp_entrega_items?.detalle || ''}</td><td className="num">${d.cantidad}</td><td className="num">${pesos(d.valor)}</td><td className="small muted">${d.nota || ''}</td></tr>`; })}</tbody>
      </table></div>` : html`<${Vacio} ico="devoluciones">Aún no hay devoluciones.<//>`}
    </div>
  <//>`;
}

/* =====================================================================
   CONTROL DE PERMITIDOS (prendas que siguen en los locales)
   ===================================================================== */
function VistaPermitidos() {
  const { cat, ir } = useApp();
  const [f, setF] = useState({ centro: '', q: '', dias: '' });
  const r = useDatos(() => consulta(db.from('cp_items_pendientes').select('*').order('fecha').limit(5000)), []);
  const filas = (r.datos || []).filter(i => (!f.centro || String(i.centro_id) === f.centro) && (!f.dias || i.dias > Number(f.dias)) &&
    (!f.q || normal(`${i.centro} ${i.local} ${i.descripcion} ${i.detalle || ''}`).includes(normal(f.q))));
  const grupos = useMemo(() => {
    const m = new Map();
    filas.forEach(i => {
      if (!m.has(i.centro)) m.set(i.centro, new Map());
      const c = m.get(i.centro);
      if (!c.has(i.local_id)) c.set(i.local_id, { local: i.local, local_id: i.local_id, items: [] });
      c.get(i.local_id).items.push(i);
    });
    return [...m.entries()].map(([centro, locs]) => ({ centro, locales: [...locs.values()] })).sort((a, b) => a.centro.localeCompare(b.centro));
    // eslint-disable-next-line
  }, [r.datos, f]);
  const total = filas.reduce((t, i) => t + Number(i.valor_pendiente), 0);
  return html`<${Fragment}>
    <${Encabezado} eti="Control" titulo="Prendas en los locales" sub="Lo que dejaste y todavía no te han pagado ni devuelto." ayuda=${['Cada fila es una prenda que sigue en un local.', 'Las que llevan muchos días aparecen marcadas: es buen momento para pasar a cobrar.']}>
      <button className="btn" disabled=${!filas.length} onClick=${() => descargarCSV(`permitidos_${hoy()}.csv`, [['Centro comercial', 'Local', 'Entrega', 'Fecha', 'Días', 'Prenda', 'Detalle', 'Cantidad', 'Pagadas', 'Devueltas', 'En el local', 'Precio', 'Valor pendiente'],
        ...filas.map(i => [i.centro, i.local, i.entrega_numero, i.fecha, i.dias, i.descripcion, i.detalle || '', i.cantidad, i.cant_pagada, i.cant_devuelta, i.pendiente, i.precio, i.valor_pendiente])])}><${Ico} n="descargar" />Descargar</button>
    <//>
    <div className="filtros">
      <input type="search" placeholder="Buscar local o prenda…" value=${f.q} onChange=${e => setF({ ...f, q: e.target.value })} />
      <select value=${f.centro} onChange=${e => setF({ ...f, centro: e.target.value })} aria-label="Centro comercial"><option value="">Todos los centros</option>${cat.centros.map(c => html`<option key=${c.id} value=${c.id}>${c.nombre}</option>`)}</select>
      <select value=${f.dias} onChange=${e => setF({ ...f, dias: e.target.value })} aria-label="Antigüedad"><option value="">Cualquier antigüedad</option><option value="7">Más de 7 días</option><option value="15">Más de 15 días</option><option value="30">Más de 30 días</option><option value="60">Más de 60 días</option></select>
    </div>
    ${!r.datos ? html`<${Cargando} error=${r.error} onReintentar=${r.recargar} />` : html`<${Fragment}>
      <div className="kpis">
        <${Kpi} t="Valor en los locales" v=${pesos(total)} s="Precio de las prendas sin pagar" />
        <${Kpi} t="Prendas en los locales" v=${numero(filas.reduce((t, i) => t + i.pendiente, 0))} />
        <${Kpi} t="Locales con mercancía" v=${numero(new Set(filas.map(i => i.local_id)).size)} />
        <${Kpi} t="Más de 30 días" v=${pesos(filas.filter(i => i.dias > 30).reduce((t, i) => t + Number(i.valor_pendiente), 0))} cls="alerta" />
      </div>
      ${grupos.length ? grupos.map(g => html`<div className="panel" key=${g.centro}>
        <div className="panel-cab"><div><h2>${g.centro}</h2><p className="sub">${plural(g.locales.length, 'local', 'locales')} · ${pesos(g.locales.reduce((t, l) => t + l.items.reduce((s, i) => s + Number(i.valor_pendiente), 0), 0))}</p></div></div>
        ${g.locales.map(l => html`<div className="grupo-local" key=${l.local_id}>
          <div className="row" style=${{ justifyContent: 'space-between' }}>
            <b className="clic-texto" onClick=${() => ir('local', { id: l.local_id })}>${l.local}</b>
            <span className="row"><span className="num"><b>${pesos(l.items.reduce((s, i) => s + Number(i.valor_pendiente), 0))}</b></span>
              <button className="btn btn-sm" onClick=${() => ir('cobros', { local: l.local_id })}>Cobrar</button></span>
          </div>
          <div className="tabla-wrap"><table><tbody>${l.items.map(i => html`<tr key=${i.item_id}>
            <td style=${{ whiteSpace: 'nowrap', width: '9em' }}>${fechaCorta(i.fecha)}</td>
            <td><b>${i.descripcion}</b>${i.detalle && html` <span className="muted">${i.detalle}</span>`}</td>
            <td className="num">${i.pendiente} de ${i.cantidad}</td><td className="num">${pesos(i.valor_pendiente)}</td>
            <td style=${{ width: '8em' }}>${i.dias > 30 ? html`<span className="badge bajo">${i.dias} días</span>` : i.dias > 15 ? html`<span className="badge aviso">${i.dias} días</span>` : html`<span className="badge neutro">${i.dias} días</span>`}</td>
          </tr>`)}</tbody></table></div>
        </div>`)}
      </div>`) : html`<div className="panel"><${Vacio}>No hay prendas pendientes en los locales.<//></div>`}
    <//>`}
  <//>`;
}

/* =====================================================================
   LOCALES
   ===================================================================== */
function VistaLocales({ params }) {
  const { cat, ir, perfil } = useApp();
  const [f, setF] = useState({ centro: '', q: '', filtro: params?.filtro || '' });
  const [nuevo, setNuevo] = useState(false);
  const [nuevoCentro, setNuevoCentro] = useState(false);
  useEffect(() => { if (params?.filtro) setF(x => ({ ...x, filtro: params.filtro })); }, [params]);
  const r = useDatos(() => consulta(db.from('cp_saldos_locales').select('*').order('saldo', { ascending: false }).limit(5000)), []);
  const atraso = perfil.tienda.dias_atraso || 15;
  const filas = (r.datos || []).filter(l => (!f.centro || String(l.centro_id) === f.centro) && (!f.q || normal(`${l.centro} ${l.local} ${l.encargado || ''}`).includes(normal(f.q))) &&
    (f.filtro === 'saldo' ? l.saldo > 0 : f.filtro === 'atrasados' ? l.saldo > 0 && l.dias_sin_pagar > atraso : f.filtro === 'mercancia' ? l.prendas_en_local > 0 : f.filtro === 'inactivos' ? !l.activo : l.activo));
  return html`<${Fragment}>
    <${Encabezado} eti="Control" titulo="Locales" sub="Los locales donde dejas mercancía y cuánto te debe cada uno." ayuda=${['"Debe" es lo que el local te tiene pendiente por pagar.', 'Toca un local para ver su historia completa y cobrarle o recibir devoluciones desde ahí.']}>
      <button className="btn" onClick=${() => setNuevoCentro(true)}><${Ico} n="mas" />Centro comercial</button>
      <button className="btn btn-primary" onClick=${() => setNuevo(true)}><${Ico} n="mas" />Nuevo local</button>
    <//>
    <div className="filtros">
      <input type="search" placeholder="Buscar local o encargada…" value=${f.q} onChange=${e => setF({ ...f, q: e.target.value })} />
      <select value=${f.centro} onChange=${e => setF({ ...f, centro: e.target.value })} aria-label="Centro comercial"><option value="">Todos los centros</option>${cat.centros.map(c => html`<option key=${c.id} value=${c.id}>${c.nombre}</option>`)}</select>
      <select value=${f.filtro} onChange=${e => setF({ ...f, filtro: e.target.value })} aria-label="Mostrar">
        <option value="">Todos los activos</option><option value="saldo">Con saldo pendiente</option><option value="atrasados">Atrasados (más de ${atraso} días)</option><option value="mercancia">Con mercancía</option><option value="inactivos">Inactivos</option></select>
    </div>
    ${!r.datos ? html`<${Cargando} error=${r.error} onReintentar=${r.recargar} />` : html`<${Fragment}>
      <div className="kpis">
        <${Kpi} t="Total que deben" v=${pesos(filas.reduce((t, l) => t + Math.max(0, Number(l.saldo)), 0))} s=${plural(filas.filter(l => l.saldo > 0).length, 'local con saldo', 'locales con saldo')} cls="alerta" />
        <${Kpi} t="Atrasados" v=${numero(filas.filter(l => l.saldo > 0 && l.dias_sin_pagar > atraso).length)} s=${`Más de ${atraso} días sin pagar`} />
        <${Kpi} t="Prendas en locales" v=${numero(filas.reduce((t, l) => t + Number(l.prendas_en_local), 0))} />
      </div>
      <div className="tabla-wrap"><table>
        <thead><tr><th>Centro comercial</th><th>Local</th><th className="num">Entregado</th><th className="num">Cobrado</th><th className="num">Devuelto</th><th className="num">Saldo</th><th className="num">Prendas</th><th>Último pago</th></tr></thead>
        <tbody>${filas.length ? filas.slice(0, 500).map(l => html`<tr key=${l.local_id} className="clic" onClick=${() => ir('local', { id: l.local_id })}>
          <td>${l.centro}</td><td><b>${l.local}</b>${l.encargado && html`<br /><span className="small muted">${l.encargado}</span>`}</td>
          <td className="num">${pesos(l.entregado)}</td><td className="num">${pesos(l.cobrado)}</td><td className="num">${pesos(l.devuelto)}</td>
          <td className="num"><b>${pesos(l.saldo)}</b></td><td className="num">${l.prendas_en_local}</td>
          <td>${l.ultimo_cobro ? fechaCorta(l.ultimo_cobro) : html`<span className="muted">Nunca</span>`}${l.saldo > 0 && l.dias_sin_pagar > atraso && html`<br /><span className="badge bajo">${l.dias_sin_pagar} días</span>`}</td>
        </tr>`) : html`<tr><td colSpan="8" className="vacio">Ningún local coincide.</td></tr>`}</tbody>
      </table></div>
      ${filas.length > 500 && html`<p className="small muted">Se muestran 500 de ${numero(filas.length)}. Usa la búsqueda para encontrar los demás.</p>`}
    <//>`}
    ${nuevo && html`<${ModalLocal} onCerrar=${() => setNuevo(false)} onGuardado=${id => { setNuevo(false); ir('local', { id }); }} />`}
    ${nuevoCentro && html`<${ModalCentro} onCerrar=${() => setNuevoCentro(false)} />`}
  <//>`;
}

function ModalCentro({ onCerrar }) {
  const { recargarCat } = useApp();
  const [nombre, setNombre] = useState('');
  const ok = async () => {
    if (!nombre.trim()) return aviso('Escribe el nombre.', 'error');
    try { await consulta(db.from('cp_centros').insert({ nombre: nombre.trim().toUpperCase() })); await recargarCat(); aviso('Centro comercial creado', 'ok'); onCerrar(); }
    catch (e) { aviso(errorTexto(e), 'error'); }
  };
  return html`<${Modal} titulo="Nuevo centro comercial" onCerrar=${onCerrar} pie=${html`<button className="btn" onClick=${onCerrar}>Cancelar</button><button className="btn btn-primary" onClick=${ok}>Crear</button>`}>
    <label htmlFor="ccNombre">Nombre</label><input id="ccNombre" value=${nombre} onChange=${e => setNombre(e.target.value)} autoFocus placeholder="Ej: UNICENTRO" onKeyDown=${e => e.key === 'Enter' && ok()} />
  <//>`;
}

function VistaLocal({ params }) {
  const { ir, localPorId, nombreLocal, perfil } = useApp();
  const id = params?.id;
  const [editar, setEditar] = useState(false);
  const [devolver, setDevolver] = useState(null);
  const r = useDatos(async () => {
    const [s, items, ent, cob, dev] = await Promise.all([
      consulta(db.from('cp_saldos_locales').select('*').eq('local_id', id).maybeSingle()),
      consulta(db.from('cp_items_pendientes').select('*').eq('local_id', id).order('fecha')),
      consulta(db.from('cp_entregas').select('id, numero, fecha, total, estado, creado_en, cp_entrega_items(cantidad)').eq('local_id', id).order('fecha')),
      consulta(db.from('cp_cobros').select('id, numero, fecha, valor, medio, tipo, estado, nota, creado_en').eq('local_id', id).order('fecha')),
      consulta(db.from('cp_devoluciones').select('id, fecha, valor, cantidad, nota, creado_en, cp_entrega_items(descripcion, detalle)').eq('local_id', id).order('fecha')),
    ]);
    let saldo = 0;
    const hist = [
      ...ent.filter(e => e.estado === 'activa').map(e => ({ k: 'e' + e.id, f: e.fecha, t: e.creado_en, txt: `Entrega #${e.numero}`, det: plural(e.cp_entrega_items.reduce((a, i) => a + i.cantidad, 0), 'prenda', 'prendas'), cargo: Number(e.total), abono: 0 })),
      ...cob.filter(c => c.estado === 'activo').map(c => ({ k: 'c' + c.id, f: c.fecha, t: c.creado_en, txt: `${c.tipo === 'abono' ? 'Abono' : 'Cobro'} #${c.numero}`, det: MEDIOS[c.medio] + (c.nota ? ` · ${c.nota}` : ''), cargo: 0, abono: Number(c.valor) })),
      ...dev.map(d => ({ k: 'd' + d.id, f: d.fecha, t: d.creado_en, txt: 'Devolución', det: `${d.cantidad} × ${d.cp_entrega_items?.descripcion || ''}${d.nota ? ` · ${d.nota}` : ''}`, cargo: 0, abono: Number(d.valor) })),
    ].sort((a, b) => a.f.localeCompare(b.f) || a.t.localeCompare(b.t)).map(m => { saldo += m.cargo - m.abono; return { ...m, saldo }; });
    return { s, items, hist: hist.reverse() };
  }, [id]);
  const l = localPorId(id);
  if (!l) return html`<${Fragment}><button className="link volver" onClick=${() => ir('locales')}><${Ico} n="atras" />Locales</button><${Cargando} error="No se encontró el local." /><//>`;
  const s = r.datos?.s;
  const atraso = perfil.tienda.dias_atraso || 15;
  const estadoCuenta = () => {
    const items = r.datos.items;
    return `Estado de cuenta: ${nombreLocal(id)}\nFecha: ${fechaCorta(hoy())}\n\nPrendas en el local:\n` +
      (items.length ? items.map(i => `${i.pendiente} × ${i.descripcion}${i.detalle ? ' ' + i.detalle : ''} (${fechaCorta(i.fecha)}) = ${pesos(i.valor_pendiente)}`).join('\n') : 'Ninguna') +
      `\n\nSaldo pendiente: ${pesos(s?.saldo)}\nGracias.`;
  };
  return html`<${Fragment}>
    <button className="link volver" onClick=${() => ir('locales')}><${Ico} n="atras" />Locales</button>
    <${Encabezado} eti=${l.centro} titulo=${l.nombre} sub=${[l.centro, l.encargado, l.telefono].filter(Boolean).join(' · ')}>
      <button className="btn" onClick=${() => setEditar(true)}>Editar</button>
      ${r.datos && html`<button className="btn" onClick=${() => abrirWhatsApp(l.telefono || '', estadoCuenta())}><${Ico} n="whatsapp" />Estado de cuenta</button>`}
      <button className="btn" onClick=${() => ir('entregas', { nueva: true, local: id })}><${Ico} n="entregas" />Entregar</button>
      <button className="btn btn-primary" onClick=${() => ir('cobros', { local: id })}><${Ico} n="cobros" />Cobrar</button>
    <//>
    ${!r.datos ? html`<${Cargando} error=${r.error} onReintentar=${r.recargar} />` : html`<${Fragment}>
      <div className="kpis">
        <${Kpi} t="Saldo pendiente" v=${pesos(s?.saldo)} cls=${s?.saldo > 0 ? 'alerta' : 'bueno'} s=${s?.saldo > 0 ? (s.dias_sin_pagar > atraso ? `Atrasado: ${s.dias_sin_pagar} días sin pagar` : `${plural(s.dias_sin_pagar || 0, 'día', 'días')} sin pagar`) : 'Al día'} />
        <${Kpi} t="Entregado" v=${pesos(s?.entregado)} s=${plural(s?.prendas_entregadas || 0, 'prenda', 'prendas')} />
        <${Kpi} t="Cobrado" v=${pesos(s?.cobrado)} s=${s?.ultimo_cobro ? `Último: ${fechaCorta(s.ultimo_cobro)}` : 'Nunca ha pagado'} />
        <${Kpi} t="Devuelto" v=${pesos(s?.devuelto)} s=${plural(s?.prendas_devueltas || 0, 'prenda', 'prendas')} />
        <${Kpi} t="Prendas en el local" v=${numero(s?.prendas_en_local)} />
      </div>
      <div className="panel">
        <h2>Prendas en el local</h2><p className="sub">Mercancía entregada que aún no se paga ni se devuelve</p>
        ${r.datos.items.length ? html`<div className="tabla-wrap"><table>
          <thead><tr><th>Entregada</th><th>Prenda</th><th className="num">Precio</th><th className="num">En el local</th><th className="num">Valor</th><th></th></tr></thead>
          <tbody>${r.datos.items.map(i => html`<tr key=${i.item_id}>
            <td style=${{ whiteSpace: 'nowrap' }}>${fechaCorta(i.fecha)}<br /><span className="small muted">#${i.entrega_numero} · ${plural(i.dias, 'día', 'días')}</span></td>
            <td><b>${i.descripcion}</b>${i.detalle && html` <span className="muted">${i.detalle}</span>`}</td>
            <td className="num">${pesos(i.precio)}</td><td className="num">${i.pendiente}</td><td className="num"><b>${pesos(i.valor_pendiente)}</b></td>
            <td className="acciones"><button className="link" onClick=${() => setDevolver({ ...i, id: i.item_id })}>Devolver</button></td></tr>`)}</tbody>
        </table></div>` : html`<${Vacio}>No tiene prendas pendientes.<//>`}
      </div>
      <div className="panel">
        <h2>Historial completo</h2><p className="sub">Todos los movimientos del local, con el saldo después de cada uno</p>
        ${r.datos.hist.length ? html`<div className="tabla-wrap"><table>
          <thead><tr><th>Fecha</th><th>Movimiento</th><th>Detalle</th><th className="num">Cargo</th><th className="num">Abono</th><th className="num">Saldo</th></tr></thead>
          <tbody>${r.datos.hist.map(m => html`<tr key=${m.k}><td style=${{ whiteSpace: 'nowrap' }}>${fechaCorta(m.f)}</td><td><b>${m.txt}</b></td><td className="small muted">${m.det}</td>
            <td className="num">${m.cargo ? pesos(m.cargo) : ''}</td><td className="num">${m.abono ? pesos(m.abono) : ''}</td><td className="num"><b>${pesos(m.saldo)}</b></td></tr>`)}</tbody>
        </table></div>` : html`<${Vacio} ico="reloj">Este local aún no tiene movimientos.<//>`}
      </div>
    <//>`}
    ${editar && html`<${ModalLocal} local=${l} onCerrar=${() => setEditar(false)} onGuardado=${() => setEditar(false)} />`}
    ${devolver && html`<${ModalDevolverItem} item=${devolver} onCerrar=${() => setDevolver(null)} onHecho=${() => { setDevolver(null); r.recargar(); }} />`}
  <//>`;
}

/* =====================================================================
   INVENTARIO
   ===================================================================== */
function VistaInventario() {
  const { cat, esDueno, recargarCat } = useApp();
  const [f, setF] = useState({ q: '', estado: '' });
  const [modal, setModal] = useState(null);
  const enLocales = useDatos(() => consulta(db.from('cp_items_pendientes').select('prenda_id, pendiente').limit(10000)), [cat.prendas]);
  const mapaLoc = useMemo(() => { const m = {}; (enLocales.datos || []).forEach(i => { m[i.prenda_id] = (m[i.prenda_id] || 0) + i.pendiente; }); return m; }, [enLocales.datos]);
  const filas = cat.prendas.filter(p => (!f.q || normal(p.referencia).includes(normal(f.q))) &&
    (f.estado === 'bajas' ? p.activo && p.stock <= p.stock_minimo : f.estado === 'inactivas' ? !p.activo : f.estado === 'sincosto' ? p.activo && !(p.costo > 0) : p.activo));
  const act = cat.prendas.filter(p => p.activo);
  const bodega = act.reduce((t, p) => t + Math.max(0, p.stock), 0);
  return html`<${Fragment}>
    <${Encabezado} eti="Bodega" titulo="Mis prendas" sub="Las prendas que vendes y cuántas tienes en bodega." ayuda=${['Crea aquí cada prenda (referencia, nombre y precio) antes de entregarla.', 'Cuando te llegue mercancía nueva usa "Entrada". Las entregas restan de la bodega y las devoluciones suman solas.']}>
      ${esDueno && html`<button className="btn" onClick=${() => setModal({ tipo: 'entrada' })}><${Ico} n="inventario" />Entrada de mercancía</button>
      <button className="btn btn-primary" onClick=${() => setModal({ tipo: 'prenda' })}><${Ico} n="mas" />Nueva prenda</button>`}
    <//>
    <div className="kpis">
      <${Kpi} t="En bodega" v=${numero(bodega)} s=${plural(act.length, 'referencia', 'referencias')} />
      <${Kpi} t="En los locales" v=${numero(Object.values(mapaLoc).reduce((a, b) => a + b, 0))} s="Entregadas sin pagar" />
      <${Kpi} t="Valor en bodega" v=${pesos(act.reduce((t, p) => t + Math.max(0, p.stock) * p.precio, 0))} s="A precio de venta" />
      ${esDueno && html`<${Kpi} t="Valor al costo" v=${pesos(act.reduce((t, p) => t + Math.max(0, p.stock) * (p.costo || 0), 0))} s=${act.some(p => !(p.costo > 0)) ? `${act.filter(p => !(p.costo > 0)).length} sin costo registrado` : ''} />`}
      <${Kpi} t="Por reponer" v=${numero(act.filter(p => p.stock <= p.stock_minimo).length)} cls="alerta" s="En el mínimo o por debajo" />
    </div>
    <div className="filtros">
      <input type="search" placeholder="Buscar referencia…" value=${f.q} onChange=${e => setF({ ...f, q: e.target.value })} />
      <select value=${f.estado} onChange=${e => setF({ ...f, estado: e.target.value })} aria-label="Mostrar"><option value="">Prendas activas</option><option value="bajas">Por reponer</option>${esDueno && html`<option value="sincosto">Sin costo registrado</option>`}<option value="inactivas">Inactivas</option></select>
    </div>
    <div className="tabla-wrap"><table>
      <thead><tr><th>Referencia</th><th className="num">Precio</th>${esDueno && html`<th className="num">Costo</th>`}<th className="num">En bodega</th><th className="num">En locales</th><th className="num">Mínimo</th><th className="acciones">Acciones</th></tr></thead>
      <tbody>${filas.length ? filas.map(p => html`<tr key=${p.id}>
        <td><b>${p.referencia}</b>${!p.activo && html` <span className="badge neutro">Inactiva</span>`}</td>
        <td className="num">${pesos(p.precio)}</td>${esDueno && html`<td className="num">${p.costo > 0 ? pesos(p.costo) : html`<span className="muted">—</span>`}</td>`}
        <td className="num">${p.stock <= 0 ? html`<span className="badge bajo">${p.stock}</span>` : p.stock <= p.stock_minimo ? html`<span className="badge aviso">${p.stock}</span>` : p.stock}</td>
        <td className="num">${mapaLoc[p.id] || 0}</td><td className="num">${p.stock_minimo}</td>
        <td className="acciones">
          <button className="link" onClick=${() => setModal({ tipo: 'kardex', p })}>Movimientos</button>
          ${esDueno && html`<button className="link" onClick=${() => setModal({ tipo: 'entrada', p })}>Entrada</button><button className="link" onClick=${() => setModal({ tipo: 'conteo', p })}>Contar</button><button className="link" onClick=${() => setModal({ tipo: 'prenda', p })}>Editar</button>`}
        </td></tr>`) : html`<tr><td colSpan="7" className="vacio">${cat.prendas.length ? 'Ninguna prenda coincide.' : 'Aún no hay prendas. Crea la primera con "Nueva prenda".'}</td></tr>`}</tbody>
    </table></div>
    ${modal?.tipo === 'prenda' && html`<${ModalPrenda} prenda=${modal.p} onCerrar=${() => setModal(null)} />`}
    ${modal?.tipo === 'entrada' && html`<${ModalEntrada} prenda=${modal.p} onCerrar=${() => setModal(null)} />`}
    ${modal?.tipo === 'conteo' && html`<${ModalConteo} prenda=${modal.p} onCerrar=${() => setModal(null)} />`}
    ${modal?.tipo === 'kardex' && html`<${ModalKardex} prenda=${modal.p} onCerrar=${() => setModal(null)} />`}
  <//>`;
}

function ModalPrenda({ prenda, onCerrar }) {
  const { recargarCat } = useApp();
  const [d, setD] = useState({ referencia: prenda?.referencia || '', precio: prenda?.precio ?? '', costo: prenda?.costo || '', stock: '', stock_minimo: prenda?.stock_minimo ?? 2, activo: prenda?.activo ?? true });
  const [ocupado, setOcupado] = useState(false);
  const cambio = k => e => setD({ ...d, [k]: e.target.value });
  const ok = async () => {
    if (!d.referencia.trim()) return aviso('Escribe la referencia.', 'error');
    if (!(Number(d.precio) >= 0) || d.precio === '') return aviso('Escribe el precio de venta.', 'error');
    setOcupado(true);
    try {
      const datos = { referencia: d.referencia.trim().toUpperCase(), precio: Number(d.precio), costo: Number(d.costo || 0), stock_minimo: Math.max(0, Math.floor(Number(d.stock_minimo) || 0)), activo: d.activo };
      if (prenda) await consulta(db.from('cp_prendas').update(datos).eq('id', prenda.id));
      else await consulta(db.from('cp_prendas').insert({ ...datos, stock: Math.max(0, Math.floor(Number(d.stock) || 0)) }));
      await recargarCat(); aviso(prenda ? 'Prenda actualizada' : 'Prenda creada', 'ok'); onCerrar();
    } catch (e) { aviso(errorTexto(e), 'error'); }
    setOcupado(false);
  };
  return html`<${Modal} titulo=${prenda ? 'Editar prenda' : 'Nueva prenda'} onCerrar=${onCerrar}
    pie=${html`<button className="btn" onClick=${onCerrar}>Cancelar</button><button className="btn btn-primary" disabled=${ocupado} onClick=${ok}>Guardar</button>`}>
    <div className="grid2">
      <div><label htmlFor="prRef">Referencia</label><input id="prRef" value=${d.referencia} onChange=${cambio('referencia')} autoFocus placeholder="Ej: MIA" /></div>
      <div><label htmlFor="prPrecio">Precio de venta al local</label><input id="prPrecio" type="number" min="0" step="500" value=${d.precio} onChange=${cambio('precio')} /></div>
      <div><label htmlFor="prCosto">Costo (opcional)</label><input id="prCosto" type="number" min="0" step="100" value=${d.costo} onChange=${cambio('costo')} placeholder="Para calcular la utilidad" /></div>
      ${!prenda && html`<div><label htmlFor="prStock">Existencia inicial</label><input id="prStock" type="number" min="0" value=${d.stock} onChange=${cambio('stock')} placeholder="0" /></div>`}
      <div><label htmlFor="prMin">Avisar cuando queden</label><input id="prMin" type="number" min="0" value=${d.stock_minimo} onChange=${cambio('stock_minimo')} /></div>
    </div>
    ${prenda && html`<p className="small muted" style=${{ margin: '10px 0 0' }}>La existencia se cambia con "Entrada" o "Contar" para que quede registro.</p>
      <label className="interruptor" style=${{ marginTop: 14 }}><input type="checkbox" checked=${d.activo} onChange=${e => setD({ ...d, activo: e.target.checked })} /><span></span>Prenda activa</label>`}
  <//>`;
}

function ModalEntrada({ prenda, onCerrar }) {
  const { cat, recargarCat } = useApp();
  const [pid, setPid] = useState(prenda?.id || '');
  const p = cat.prendas.find(x => x.id === Number(pid));
  const [cant, setCant] = useState('');
  const [costo, setCosto] = useState(prenda?.costo || '');
  const [nota, setNota] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const ok = async () => {
    if (!p) return aviso('Elige la prenda.', 'error');
    if (!(Number(cant) > 0)) return aviso('Escribe cuántas prendas entran.', 'error');
    setOcupado(true);
    try { const n = await rpc('cp_entrada_mercancia', { p_prenda: p.id, p_cantidad: Math.floor(Number(cant)), p_costo: costo ? Number(costo) : null, p_nota: nota.trim() || null }); await recargarCat(); aviso(`${p.referencia}: ahora hay ${n} en bodega`, 'ok'); onCerrar(); }
    catch (e) { aviso(errorTexto(e), 'error'); }
    setOcupado(false);
  };
  return html`<${Modal} titulo="Entrada de mercancía" sub="Prendas nuevas que llegan a la bodega (producción o compra)." onCerrar=${onCerrar}
    pie=${html`<button className="btn" onClick=${onCerrar}>Cancelar</button><button className="btn btn-primary" disabled=${ocupado} onClick=${ok}>Registrar entrada</button>`}>
    <label htmlFor="enPr">Prenda</label>
    <select id="enPr" value=${pid} onChange=${e => { setPid(e.target.value); const x = cat.prendas.find(y => y.id === Number(e.target.value)); setCosto(x?.costo || ''); }}>
      <option value="">Elige…</option>${cat.prendas.filter(x => x.activo).map(x => html`<option key=${x.id} value=${x.id}>${x.referencia} (hay ${x.stock})</option>`)}</select>
    <div className="grid2">
      <div><label htmlFor="enCant">Cantidad que entra</label><input id="enCant" type="number" min="1" value=${cant} onChange=${e => setCant(e.target.value)} autoFocus=${!!prenda} /></div>
      <div><label htmlFor="enCosto">Costo por prenda (opcional)</label><input id="enCosto" type="number" min="0" step="100" value=${costo} onChange=${e => setCosto(e.target.value)} /></div>
    </div>
    <label htmlFor="enNota">Nota (opcional)</label><input id="enNota" value=${nota} onChange=${e => setNota(e.target.value)} placeholder="Ej: taller de Marta, lote 12" />
  <//>`;
}

function ModalConteo({ prenda, onCerrar }) {
  const { recargarCat } = useApp();
  const [n, setN] = useState(Math.max(0, prenda.stock));
  const [ocupado, setOcupado] = useState(false);
  const ok = async () => {
    setOcupado(true);
    try { await rpc('cp_ajustar_stock', { p_prenda: prenda.id, p_contado: Math.floor(Number(n)) }); await recargarCat(); aviso('Conteo guardado', 'ok'); onCerrar(); }
    catch (e) { aviso(errorTexto(e), 'error'); }
    setOcupado(false);
  };
  const dif = Math.floor(Number(n) || 0) - prenda.stock;
  return html`<${Modal} titulo=${`Conteo físico: ${prenda.referencia}`} sub=${`El sistema dice que hay ${prenda.stock} en bodega.`} onCerrar=${onCerrar}
    pie=${html`<button className="btn" onClick=${onCerrar}>Cancelar</button><button className="btn btn-primary" disabled=${ocupado} onClick=${ok}>Guardar conteo</button>`}>
    <label htmlFor="ctN">Prendas contadas en bodega</label><input id="ctN" type="number" min="0" value=${n} onChange=${e => setN(e.target.value)} autoFocus />
    <p className="small muted" style=${{ margin: '10px 0 0' }}>${dif === 0 ? 'Coincide con el sistema.' : dif > 0 ? `Sobran ${dif}: se suman como ajuste.` : `Faltan ${-dif}: se restan como ajuste.`}</p>
  <//>`;
}

function ModalKardex({ prenda, onCerrar }) {
  const r = useDatos(() => consulta(db.from('cp_inventario_mov').select('*').eq('prenda_id', prenda.id).order('fecha', { ascending: false }).limit(200)), [prenda.id]);
  const TIPOS = { inicial: 'Existencia inicial', entrada: 'Entrada', entrega: 'Entrega a local', devolucion: 'Devolución', ajuste: 'Conteo físico', anulacion: 'Entrega anulada' };
  return html`<${Modal} ancho titulo=${`Movimientos de ${prenda.referencia}`} sub=${`Hay ${prenda.stock} en bodega`} onCerrar=${onCerrar}>
    ${!r.datos ? html`<${Cargando} error=${r.error} />` : r.datos.length ? html`<div className="tabla-wrap" style=${{ marginTop: 12 }}><table>
      <thead><tr><th>Fecha</th><th>Movimiento</th><th>Detalle</th><th className="num">Cantidad</th><th className="num">Queda</th></tr></thead>
      <tbody>${r.datos.map(m => html`<tr key=${m.id}><td style=${{ whiteSpace: 'nowrap' }}>${fechaHora(m.fecha)}</td><td>${TIPOS[m.tipo]}</td><td className="small muted">${[m.referencia, m.nota].filter(Boolean).join(' · ')}</td>
        <td className="num" style=${{ color: m.cantidad < 0 ? 'var(--danger)' : 'var(--ok)' }}><b>${m.cantidad > 0 ? '+' : ''}${m.cantidad}</b></td><td className="num">${m.saldo}</td></tr>`)}</tbody>
    </table></div>` : html`<${Vacio}>Sin movimientos.<//>`}
  <//>`;
}

/* =====================================================================
   INFORMES
   ===================================================================== */
function rangoPeriodo(p) {
  const h = new Date(), f = hoy();
  if (p === 'hoy') return { desde: f, hasta: f };
  if (p === 'semana') { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return { desde: aFecha(d), hasta: f }; }
  if (p === 'mes') return { desde: f.slice(0, 8) + '01', hasta: f };
  if (p === 'anterior') return { desde: aFecha(new Date(h.getFullYear(), h.getMonth() - 1, 1)), hasta: aFecha(new Date(h.getFullYear(), h.getMonth(), 0)) };
  if (p === '90') return { desde: sumarDias(f, -89), hasta: f };
  if (p === 'anio') return { desde: `${h.getFullYear()}-01-01`, hasta: f };
  return null;
}
function VistaInformes() {
  const { ir, nombreLocal, perfil } = useApp();
  const [per, setPer] = useState('mes');
  const [rango, setRango] = useState(rangoPeriodo('mes'));
  const r = useDatos(async () => {
    const [inf, saldos] = await Promise.all([
      rpc('cp_informe', { p_desde: rango.desde, p_hasta: rango.hasta }),
      consulta(db.from('cp_saldos_locales').select('*').gt('saldo', 0).order('saldo', { ascending: false }).limit(5000)),
    ]);
    return { inf, saldos };
  }, [rango.desde, rango.hasta]);
  const elegir = p => { setPer(p); setRango(rangoPeriodo(p)); };
  const atraso = perfil.tienda.dias_atraso || 15;
  const i = r.datos?.inf;
  const atrasados = (r.datos?.saldos || []).filter(s => s.dias_sin_pagar > atraso).sort((a, b) => b.dias_sin_pagar - a.dias_sin_pagar);
  const PER = [['hoy', 'Hoy'], ['semana', 'Esta semana'], ['mes', 'Este mes'], ['anterior', 'Mes anterior'], ['90', 'Últimos 90 días'], ['anio', 'Este año']];
  return html`<${Fragment}>
    <${Encabezado} eti="Gestión" titulo="Informes" sub=${`Del ${fechaCorta(rango.desde)} al ${fechaCorta(rango.hasta)}`}>
      <button className="btn" disabled=${!r.datos} onClick=${() => descargarCSV(`saldos_locales_${hoy()}.csv`, [['Centro comercial', 'Local', 'Encargada', 'Teléfono', 'Entregado', 'Cobrado', 'Devuelto', 'Saldo', 'Prendas en el local', 'Último pago', 'Días sin pagar'],
        ...r.datos.saldos.map(s => [s.centro, s.local, s.encargado || '', s.telefono || '', s.entregado, s.cobrado, s.devuelto, s.saldo, s.prendas_en_local, s.ultimo_cobro || '', s.dias_sin_pagar ?? ''])])}><${Ico} n="descargar" />Descargar saldos</button>
    <//>
    <div className="periodos">
      ${PER.map(([k, v]) => html`<button key=${k} className=${'chip ' + (per === k ? 'activa' : '')} onClick=${() => elegir(k)}>${v}</button>`)}
      <input type="date" className="fecha" value=${rango.desde} onChange=${e => { setPer(''); setRango({ ...rango, desde: e.target.value }); }} aria-label="Desde" />
      <input type="date" className="fecha" value=${rango.hasta} onChange=${e => { setPer(''); setRango({ ...rango, hasta: e.target.value }); }} aria-label="Hasta" />
    </div>
    ${!i ? html`<${Cargando} error=${r.error} onReintentar=${r.recargar} />` : html`<${Fragment}>
      <div className="kpis">
        <${Kpi} t="Mercancía entregada" v=${pesos(i.entregado)} s=${`${numero(i.prendas_entregadas)} prendas en ${plural(i.entregas, 'entrega', 'entregas')}`} />
        <${Kpi} t="Recaudado" v=${pesos(i.recaudado)} cls="bueno" s=${Object.entries(i.por_medio).map(([k, v]) => `${MEDIOS[k]} ${pesos(v)}`).join(' · ')} />
        <${Kpi} t="Devuelto" v=${pesos(i.devuelto)} s=${`${numero(i.prendas_devueltas)} prendas`} />
        <${Kpi} t="Deben todos los locales" v=${pesos(i.saldo_total)} cls="alerta" s=${`${plural(i.atrasados, 'local atrasado', 'locales atrasados')}`} />
        <${Kpi} t="Prendas" v=${`${numero(i.prendas_en_locales)} / ${numero(i.prendas_en_bodega)}`} s="En locales / disponibles en bodega" />
      </div>
      <div className="panel"><h2>Recaudo diario</h2><p className="sub">Dinero cobrado cada día del período</p><${GraficaDias} datos=${i.recaudo_diario} desde=${rango.desde} hasta=${rango.hasta} /></div>
      <div className="dos-col" style=${{ marginTop: 16 }}>
        <div className="panel"><h2>Centros comerciales con más ventas</h2><p className="sub">Mercancía entregada en el período</p>
          ${i.por_centro.length ? html`<${BarrasH} filas=${i.por_centro.slice(0, 12).map(c => ({ etiqueta: c.centro, valor: Number(c.entregado), texto: pesos(c.entregado) }))} />
            <div className="tabla-wrap" style=${{ marginTop: 14 }}><table><thead><tr><th>Centro</th><th className="num">Entregado</th><th className="num">Recaudado</th></tr></thead>
              <tbody>${i.por_centro.map(c => html`<tr key=${c.centro}><td>${c.centro}</td><td className="num">${pesos(c.entregado)}</td><td className="num">${pesos(c.recaudado)}</td></tr>`)}</tbody></table></div>`
            : html`<${Vacio} ico="locales">Sin movimientos en el período.<//>`}</div>
        <div className="panel"><h2>Prendas más entregadas</h2><p className="sub">Por valor en el período</p>
          ${i.por_prenda.length ? html`<${BarrasH} filas=${i.por_prenda.map(p => ({ etiqueta: `${p.referencia} (${p.cantidad})`, valor: Number(p.valor), texto: pesos(p.valor) }))} />` : html`<${Vacio} ico="inventario">Sin entregas en el período.<//>`}</div>
      </div>
      <div className="dos-col" style=${{ marginTop: 16 }}>
        <div className="panel"><h2>Cuánto deben los locales</h2><p className="sub">Saldo pendiente hoy, de mayor a menor</p>
          ${r.datos.saldos.length ? html`<div className="tabla-wrap tabla-alta"><table><tbody>${r.datos.saldos.slice(0, 100).map(s => html`<tr key=${s.local_id} className="clic" onClick=${() => ir('local', { id: s.local_id })}>
            <td><b>${s.local}</b><br /><span className="small muted">${s.centro}</span></td><td className="num">${plural(s.prendas_en_local, 'prenda', 'prendas')}</td><td className="num"><b>${pesos(s.saldo)}</b></td></tr>`)}</tbody></table></div>` : html`<${Vacio}>Nadie debe.<//>`}</div>
        <div className="panel"><h2>Locales atrasados</h2><p className="sub">Más de ${atraso} días sin pagar (cámbialo en Configuración)</p>
          ${atrasados.length ? html`<div className="tabla-wrap tabla-alta"><table><tbody>${atrasados.slice(0, 100).map(s => html`<tr key=${s.local_id} className="clic" onClick=${() => ir('local', { id: s.local_id })}>
            <td><b>${s.local}</b><br /><span className="small muted">${s.centro}${s.ultimo_cobro ? ` · último pago ${fechaCorta(s.ultimo_cobro)}` : ' · nunca ha pagado'}</span></td>
            <td><span className="badge bajo">${s.dias_sin_pagar} días</span></td><td className="num"><b>${pesos(s.saldo)}</b></td></tr>`)}</tbody></table></div>` : html`<${Vacio}>Ningún local está atrasado.<//>`}</div>
      </div>
    <//>`}
  <//>`;
}

/* =====================================================================
   CONFIGURACIÓN
   ===================================================================== */
function VistaConfig() {
  const { perfil, setPerfil, recargarCat } = useApp();
  const [dias, setDias] = useState(perfil.tienda.dias_atraso || 15);
  const [alcance, setAlcance] = useState('movimientos');
  const [conf, setConf] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const guardarDias = async () => {
    const n = Math.max(1, Math.min(365, Math.floor(Number(dias) || 15)));
    try {
      const t = await consulta(db.from('tiendas').update({ dias_atraso: n }).eq('id', perfil.tienda.id).select('*').single());
      setPerfil({ ...perfil, tienda: t }); aviso('Configuración guardada', 'ok');
    } catch (e) { aviso(errorTexto(e), 'error'); }
  };
  const restablecer = async () => {
    const ok = await preguntar({ titulo: 'Restablecer la información', peligro: true, ok: 'Sí, borrar',
      texto: alcance === 'todo' ? 'Se borran entregas, cobros, devoluciones, prendas, locales y centros comerciales. La cuenta queda vacía, como nueva. No se puede deshacer.'
        : 'Se borran entregas, cobros, devoluciones y movimientos de inventario. Las prendas y los locales se conservan con existencia en 0. No se puede deshacer.' });
    if (!ok) return;
    setOcupado(true);
    try {
      const r = await rpc('cp_restablecer', { p_alcance: alcance, p_confirmacion: conf });
      await recargarCat(); setConf('');
      aviso(`Información restablecida: se borraron ${plural(r.entregas, 'entrega', 'entregas')} y ${plural(r.cobros, 'cobro', 'cobros')}.`, 'ok');
    } catch (e) { aviso(errorTexto(e), 'error'); }
    setOcupado(false);
  };
  return html`<${Fragment}>
    <${Encabezado} eti="Gestión" titulo="Configuración" sub=${perfil.tienda.nombre} />
    <div className="dos-col">
      <div className="panel"><h2>Cobranza</h2><p className="sub">Cuándo se considera atrasado un local</p>
        <label htmlFor="cfDias">Días sin pagar para marcarlo como atrasado</label>
        <input id="cfDias" type="number" min="1" max="365" value=${dias} onChange=${e => setDias(e.target.value)} style=${{ maxWidth: 160 }} />
        <div className="modal-acciones"><button className="btn btn-primary" onClick=${guardarDias}>Guardar</button></div>
      </div>
      <div className="panel"><h2>Usuarios</h2><p className="sub">Quién puede entrar a esta cuenta</p>
        <p>El <b>dueño</b> maneja precios, costos e inventario, anula movimientos, ve los informes y puede restablecer la información.</p>
        <p>El <b>cajero</b> (cobrador o vendedor) registra entregas, cobros y devoluciones.</p>
        <p className="muted small">Los usuarios se crean y bloquean desde el panel de administración.</p>
      </div>
    </div>
    <div className="panel zona-peligro">
      <h2>Restablecer la información</h2><p className="sub">Deja la cuenta en cero para empezar de nuevo. Esta acción no se puede deshacer.</p>
      <div className="opciones-radio" role="radiogroup" aria-label="Qué borrar">
        <label><input type="radio" name="alcance" checked=${alcance === 'movimientos'} onChange=${() => setAlcance('movimientos')} /><span><b>Solo movimientos</b>Borra entregas, cobros, devoluciones y el historial de inventario. Conserva prendas, precios y locales (existencias en 0).</span></label>
        <label><input type="radio" name="alcance" checked=${alcance === 'todo'} onChange=${() => setAlcance('todo')} /><span><b>Todo</b>Además borra prendas, locales y centros comerciales. La cuenta queda vacía.</span></label>
      </div>
      <label htmlFor="cfBorrar">Para confirmar, escribe BORRAR</label>
      <div className="row" style=${{ flexWrap: 'nowrap' }}>
        <input id="cfBorrar" value=${conf} onChange=${e => setConf(e.target.value)} placeholder="BORRAR" style=${{ maxWidth: 220 }} autoComplete="off" />
        <button className="btn btn-danger" disabled=${ocupado || conf.trim().toUpperCase() !== 'BORRAR'} onClick=${restablecer}>${ocupado ? 'Borrando…' : 'Restablecer a cero'}</button>
      </div>
    </div>
  <//>`;
}

/* =====================================================================
   ESTRUCTURA: ingreso, navegación superior y barra inferior
   ===================================================================== */
const VISTAS = {
  inicio: { t: 'Inicio', c: VistaPanel },
  entregas: { t: 'Entregar', c: VistaEntregas },
  cobros: { t: 'Cobrar', c: VistaCobros },
  locales: { t: 'Locales', c: VistaLocales },
  inventario: { t: 'Mis prendas', c: VistaInventario },
  devoluciones: { t: 'Devoluciones', c: VistaDevoluciones },
  permitidos: { t: 'En locales', c: VistaPermitidos },
  informes: { t: 'Informes', c: VistaInformes, dueno: true },
  config: { t: 'Configuración', c: VistaConfig, dueno: true, oculto: true },
  local: { t: 'Local', c: VistaLocal, oculto: true, padre: 'locales' },
};
const TABBAR = ['inicio', 'entregas', 'cobros', 'locales'];
const PRINCIPALES = ['inicio', 'entregas', 'cobros', 'locales', 'inventario'];

const MarcaTag = () => html`<span className="marca-tag"><${Ico} n="entregas" /></span>`;

function Login() {
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [ver, setVer] = useState(false);
  const [msg, setMsg] = useState(['', '']);
  const [ocupado, setOcupado] = useState(false);
  const entrar = async e => {
    e.preventDefault();
    setOcupado(true); setMsg(['', 'Verificando tus datos…']);
    const { error } = await db.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: clave });
    setOcupado(false);
    if (error) setMsg(['error', /banned/i.test(error.message) ? 'Tu cuenta está bloqueada. Comunícate con el administrador.' : /fetch|network/i.test(error.message) ? 'Sin conexión. Revisa tu internet.' : 'Correo o contraseña incorrectos.']);
  };
  return html`<section className="login">
    <div className="login-marca">
      <div className="lm-top"><${MarcaTag} /><span>${CONFIG.producto}</span></div>
      <div className="lm-centro">
        <h1>Tu mercancía en cada local, <em>bajo control</em>.</h1>
        <p>Registra lo que dejas en los locales de los centros comerciales, cobra lo vendido, recibe devoluciones y sabe en todo momento quién debe y cuántas prendas quedan.</p>
      </div>
      <div className="etiquetas" aria-hidden="true">
        <div className="etiqueta"><span className="muted">Entregado · Imperio 25A</span><b>$290.000</b></div>
        <div className="etiqueta"><span>Pendiente de cobro</span><b>$120.000</b></div>
        <div className="etiqueta"><span className="muted">Prendas en el local</span><b>6 de 9</b></div>
      </div>
      <div className="lm-pie">Versión ${CONFIG.version} · Datos de ejemplo en las etiquetas</div>
    </div>
    <div className="login-form"><div className="lf-caja">
      <span className="etiqueta-sec">Bienvenido</span>
      <h2>Iniciar sesión</h2><p className="muted" style=${{ margin: '6px 0 0' }}>Entra con el correo y la contraseña que te entregó el administrador.</p>
      <form onSubmit=${entrar}>
        <label htmlFor="lEmail">Correo</label><input id="lEmail" type="email" required autoComplete="email" value=${email} onChange=${e => setEmail(e.target.value)} autoFocus />
        <label htmlFor="lClave">Contraseña</label>
        <div className="clave"><input id="lClave" type=${ver ? 'text' : 'password'} required minLength="6" autoComplete="current-password" value=${clave} onChange=${e => setClave(e.target.value)} />
          <button type="button" className="btn" onClick=${() => setVer(!ver)} aria-label="Mostrar u ocultar la contraseña"><${Ico} n="ojo" /></button></div>
        <button className="btn btn-primary btn-lg" type="submit" disabled=${ocupado}>${ocupado ? 'Entrando…' : 'Entrar'}</button>
        <div className=${'msg ' + msg[0]}>${msg[1]}</div>
      </form>
    </div></div>
  </section>`;
}

function PantallaAviso({ titulo, texto, onReintentar }) {
  return html`<section className="pantalla"><div className="login-card" style=${{ textAlign: 'center' }}>
    <div style=${{ display: 'grid', placeItems: 'center', marginBottom: 14 }}><${MarcaTag} /></div>
    <h2>${titulo}</h2><p className="muted">${texto}</p>
    <div className="row" style=${{ justifyContent: 'center', marginTop: 18 }}>
      ${onReintentar && html`<button className="btn" onClick=${onReintentar}>Reintentar</button>`}
      <button className="btn btn-primary" onClick=${async () => { await db.auth.signOut(); location.reload(); }}>Cerrar sesión</button>
    </div></div></section>`;
}

function App() {
  const [estado, setEstado] = useState({ fase: 'cargando' });
  const [perfil, setPerfil] = useState(null);
  const [cat, setCat] = useState({ centros: [], locales: [], prendas: [] });
  const [ruta, setRuta] = useState({ vista: leer('cp-vista') || 'inicio', params: null });
  const [hoja, setHoja] = useState(false);
  const [popUsuario, setPopUsuario] = useState(false);
  const [tema, setTema] = useState(document.documentElement.dataset.theme || 'light');
  const [offline, setOffline] = useState(!navigator.onLine);

  const recargarCat = useCallback(async () => {
    const [centros, locales, prendas] = await Promise.all([
      consulta(db.from('cp_centros').select('*').order('nombre')),
      consulta(db.from('cp_locales').select('*').order('nombre').limit(10000)),
      consulta(db.from('cp_prendas').select('*').order('referencia').limit(10000)),
    ]);
    setCat({ centros, locales, prendas: prendas.map(p => ({ ...p, precio: Number(p.precio), costo: Number(p.costo) })) });
  }, []);

  const iniciar = useCallback(async () => {
    setEstado({ fase: 'cargando' });
    try {
      const { data: { session } } = await db.auth.getSession();
      if (!session) return setEstado({ fase: 'login' });
      await db.rpc('aceptar_invitacion');
      const [{ data: ut, error }, { data: adm }] = await Promise.all([
        db.from('usuarios_tienda').select('tienda_id, rol, email, nombre, tiendas(*)').eq('user_id', session.user.id).maybeSingle(),
        db.from('administradores').select('user_id').eq('user_id', session.user.id).maybeSingle(),
      ]);
      if (error) throw error;
      if (!ut && adm) return setEstado({ fase: 'aviso', titulo: 'Cuenta de administrador', texto: 'Esta cuenta no pertenece a ninguna tienda. Para crear tiendas y usuarios usa el panel de administración.' });
      if (!ut) return setEstado({ fase: 'aviso', titulo: 'Tu cuenta aún no tiene tienda', texto: `La cuenta ${session.user.email} todavía no está vinculada a ninguna tienda. Pide al administrador que la vincule y luego toca "Reintentar".`, reintentar: true });
      if (ut.tiendas?.estado === 'suspendida') return setEstado({ fase: 'aviso', titulo: 'Servicio suspendido', texto: 'El servicio de esta cuenta está suspendido. Comunícate con el administrador para reactivarlo.' });
      if (ut.tiendas?.estado !== 'activa') return setEstado({ fase: 'aviso', titulo: 'Cuenta no disponible', texto: 'Esta cuenta todavía no está activa. Comunícate con el administrador.', reintentar: true });
      if (!adm) {
        const { data: acceso, error: eAcc } = await db.rpc('tiene_software', { p_codigo: 'permitidos' });
        if (!eAcc && acceso === false) return setEstado({ fase: 'aviso', titulo: 'Sin acceso a Control de Permitidos', texto: 'Tu cuenta existe, pero no tiene activado este programa. Pide al administrador que te lo active y toca "Reintentar".', reintentar: true });
      }
      const nombre = ut.nombre || session.user.email.split('@')[0];
      setPerfil({ uid: session.user.id, email: session.user.email, nombre, rol: ut.rol, tienda: ut.tiendas, esAdmin: !!adm });
      await recargarCat();
      setEstado({ fase: 'app' });
    } catch (e) {
      setEstado({ fase: 'aviso', titulo: 'No se pudo entrar', texto: errorTexto(e), reintentar: true });
    }
  }, [recargarCat]);

  useEffect(() => {
    iniciar();
    const { data: sub } = db.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT') iniciar(); });
    const on = () => setOffline(false), off = () => setOffline(true);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { sub.subscription.unsubscribe(); window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [iniciar]);

  const esDueno = perfil?.rol === 'dueno';
  const permitidas = Object.keys(VISTAS).filter(k => !VISTAS[k].dueno || esDueno);
  const ir = useCallback((vista, params = null) => {
    setRuta({ vista, params });
    if (!VISTAS[vista]?.oculto || vista === 'config') guardar('cp-vista', vista);
    setHoja(false); setPopUsuario(false);
    window.scrollTo(0, 0);
  }, []);
  const ctx = useMemo(() => {
    const centroDe = Object.fromEntries(cat.centros.map(c => [c.id, c.nombre]));
    const locMap = Object.fromEntries(cat.locales.map(l => [l.id, { ...l, centro: centroDe[l.centro_id] || '' }]));
    return {
      perfil, setPerfil, esDueno, cat, recargarCat, ir,
      localPorId: id => locMap[id],
      nombreLocal: id => locMap[id] ? `${locMap[id].centro} · ${locMap[id].nombre}` : 'Local',
    };
  }, [perfil, esDueno, cat, recargarCat, ir]);

  if (estado.fase === 'cargando') return html`<div className="pantalla"><p className="muted">Cargando…</p></div>`;
  if (estado.fase === 'login') return html`<${Fragment}><${Login} /><${Avisos} /><//>`;
  if (estado.fase === 'aviso') return html`<${PantallaAviso} titulo=${estado.titulo} texto=${estado.texto} onReintentar=${estado.reintentar ? iniciar : null} />`;

  const vista = permitidas.includes(ruta.vista) ? ruta.vista : 'inicio';
  const V = VISTAS[vista];
  const activa = V.padre || vista;
  const menu = permitidas.filter(k => !VISTAS[k].oculto);
  const enHoja = permitidas.filter(k => !TABBAR.includes(k) && (!VISTAS[k].oculto || k === 'config'));
  const enMas = permitidas.filter(k => !PRINCIPALES.includes(k) && (!VISTAS[k].oculto || k === 'config'));
  const enMenuMas = window.matchMedia('(max-width: 760px)').matches ? enHoja : enMas;
  const cambiarTema = () => { const t = tema === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; guardar('tema', t); setTema(t); setPopUsuario(false); setHoja(false); };
  const salir = async () => { await db.auth.signOut(); location.reload(); };

  return html`<${Ctx.Provider} value=${ctx}>
    ${offline && html`<div id="offline">Sin conexión a internet. Los cambios no se guardarán hasta que vuelva.</div>`}
    <header className="cab"><div className="cab-in">
      <div className="marca"><${MarcaTag} /><div><b>Permitidos</b><small>${perfil.tienda.nombre}</small></div></div>
      <nav className="nav-sup" aria-label="Secciones">${menu.filter(k => PRINCIPALES.includes(k)).map(k => html`<button key=${k} className=${activa === k ? 'activa' : ''} aria-current=${activa === k ? 'page' : undefined} title=${VISTAS[k].t} onClick=${() => ir(k)}><${Ico} n=${k} /><span>${VISTAS[k].t}</span></button>`)}
        <button className=${enMas.includes(activa) ? 'activa' : ''} title="Más" onClick=${() => setHoja(true)}><${Ico} n="menu" /><span>Más</span></button></nav>
      <div className="cab-der">
        <button className="btn btn-primary" onClick=${() => ir('entregas', { nueva: true })} aria-label="Nueva entrega"><${Ico} n="mas" /><span>Entrega</span></button>
        <button className="usuario-btn" onClick=${() => setPopUsuario(!popUsuario)} aria-label="Mi cuenta" aria-expanded=${popUsuario}>
          <span className="avatar">${iniciales(perfil.nombre)}</span><span className="u-txt"><b>${perfil.nombre}</b><small>${esDueno ? 'Dueño' : 'Cobrador'}</small></span></button>
      </div>
    </div></header>
    ${popUsuario && html`<div className="menu-pop" style=${{ right: 16, top: 70 }}>
      <div className="mp-cab"><b>${perfil.nombre}</b><span className="small muted" style=${{ display: 'block' }}>${perfil.email}</span></div>
      ${esDueno && html`<button className="menu-item" onClick=${() => ir('config')}><${Ico} n="config" /><span>Configuración</span></button>`}
      ${perfil.esAdmin && html`<button className="menu-item" onClick=${() => window.open(CONFIG.adminUrl, '_blank', 'noopener')}><${Ico} n="escudo" /><span>Panel de administración</span></button>`}
      <button className="menu-item" onClick=${cambiarTema}><${Ico} n=${tema === 'dark' ? 'sol' : 'luna'} /><span>${tema === 'dark' ? 'Usar modo claro' : 'Usar modo oscuro'}</span></button>
      <button className="menu-item" onClick=${salir}><${Ico} n="salir" /><span>Cerrar sesión</span></button>
    </div>`}
    <main className="contenido" key=${vista + JSON.stringify(ruta.params || {})} onClick=${() => popUsuario && setPopUsuario(false)}><${V.c} params=${ruta.params} /></main>
    <nav className="tabbar" aria-label="Secciones principales">
      ${TABBAR.map(k => html`<button key=${k} className=${activa === k ? 'activa' : ''} onClick=${() => ir(k)}><${Ico} n=${k} /><span>${VISTAS[k].t}</span></button>`)}
      <button className=${enHoja.includes(activa) ? 'activa' : ''} onClick=${() => setHoja(true)}><${Ico} n="menu" /><span>Más</span></button>
    </nav>
    ${hoja && html`<div className="hoja-fondo" onClick=${e => e.target === e.currentTarget && setHoja(false)}><div className="hoja" role="dialog" aria-label="Más secciones">
      ${enMenuMas.map(k => html`<button key=${k} title=${VISTAS[k].t} className=${activa === k ? 'activa' : ''} onClick=${() => ir(k)}><${Ico} n=${k} /><span>${VISTAS[k].t}</span></button>`)}
      ${perfil.esAdmin && html`<button onClick=${() => window.open(CONFIG.adminUrl, '_blank', 'noopener')}><${Ico} n="escudo" /><span>Panel de administración</span></button>`}
      <button onClick=${cambiarTema}><${Ico} n=${tema === 'dark' ? 'sol' : 'luna'} /><span>${tema === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span></button>
      <button onClick=${salir}><${Ico} n="salir" /><span>Cerrar sesión</span></button>
    </div></div>`}
    <${Avisos} /><${Dialogos} />
  <//>`;
}

ReactDOM.createRoot(document.getElementById('raiz')).render(html`<${App} />`);
