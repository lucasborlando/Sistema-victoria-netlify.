
const AUTH_KEY = 'sistema_victoria_web_user';
const PASS_KEY = 'sistema_victoria_web_passwords_v2';
let usuarioActual = null;
let usuariosWebCache = [];

function normalizarRutWeb(rut){
  return String(rut || '')
    .replace(/[\.\s]/g,'')
    .replace(/k$/i,'K')
    .toLowerCase();
}
function authMsg(id, msg, ok=false){
  const el=document.getElementById(id);
  if(el){ el.textContent=msg; el.style.color = ok ? '#b9f6ca' : '#ffd1d1'; }
}
function leerPassLocales(){
  try { return JSON.parse(localStorage.getItem(PASS_KEY) || '{}'); }
  catch(e){ return {}; }
}
function guardarPassLocal(rutNormalizado, clave){
  const data = leerPassLocales();
  data[rutNormalizado] = clave;
  localStorage.setItem(PASS_KEY, JSON.stringify(data));
}
async function cargarUsuariosWeb(){
  if(usuariosWebCache.length) return usuariosWebCache;
  const res = await fetch(`data/usuarios_web.json?v=${Date.now()}`, {cache:'no-store'});
  if(!res.ok) throw new Error('No se encontró data/usuarios_web.json');
  usuariosWebCache = await res.json();
  return usuariosWebCache;
}
async function buscarUsuarioPorRut(rut){
  const rutNormal = normalizarRutWeb(rut);
  const usuarios = await cargarUsuariosWeb();
  return usuarios.find(u => normalizarRutWeb(u.rut || u.id) === rutNormal || normalizarRutWeb(u.id) === rutNormal);
}
function claveValidaWeb(usuario, clave){
  const rutNormal = normalizarRutWeb(usuario.rut || usuario.id);
  const passLocales = leerPassLocales();

  // Si el usuario ya cambió la clave en este dispositivo, se valida con esa clave.
  if(passLocales[rutNormal]) return clave === passLocales[rutNormal];

  // Clave inicial registrada desde el PC base. En esta versión estática se permite 12345
  // para usuarios activos sincronizados en usuarios_web.json.
  if(clave === '12345') return true;

  // Compatibilidad por si el exportador deja una clave temporal visible.
  if(usuario.clave_temporal && clave === String(usuario.clave_temporal)) return true;
  return false;
}
function usuarioPublico(usuario){
  return {
    id: usuario.id || usuario.rut,
    rut: usuario.rut || usuario.id,
    nombre: usuario.nombre || usuario.rut || usuario.id,
    cargo: usuario.cargo || '',
    perfil: usuario.perfil || 'informativo',
    debe_cambiar_clave: !!usuario.debe_cambiar_clave
  };
}
function setUsuarioSesion(user){
  usuarioActual = user;
  sessionStorage.setItem(AUTH_KEY, JSON.stringify(user));
  window.USUARIO_ACTUAL = user;
  const top = document.getElementById('usuarioTop');
  if(top) top.textContent = `${user.nombre || user.rut} | ${String(user.perfil || '').toUpperCase()}`;
}
function mostrarApp(){
  const login = document.getElementById('loginScreen');
  const shell = document.getElementById('appShell');
  if(login) login.hidden = true;
  if(shell) shell.hidden = false;
}
function mostrarLogin(){
  const login = document.getElementById('loginScreen');
  const shell = document.getElementById('appShell');
  if(shell) shell.hidden = true;
  if(login) login.hidden = false;
}
async function iniciarSesion(){
  const rut = document.getElementById('loginRut')?.value || '';
  const clave = document.getElementById('loginClave')?.value || '';
  if(!rut || !clave){ authMsg('loginMsg','Ingresa RUT y clave.'); return; }
  try{
    authMsg('loginMsg','Validando acceso...', true);
    const usuario = await buscarUsuarioPorRut(rut);
    if(!usuario || usuario.activo === false) throw new Error('Usuario no autorizado o inactivo.');
    if(!claveValidaWeb(usuario, clave)) throw new Error('RUT o clave incorrecta.');
    const user = usuarioPublico(usuario);
    setUsuarioSesion(user);
    mostrarApp();
    inicializarSistemaVictoria();
    const rutNormal = normalizarRutWeb(user.rut || user.id);
    const passLocales = leerPassLocales();
    if(clave === '12345' && !passLocales[rutNormal]) abrirCambioClave(true);
  }catch(e){ authMsg('loginMsg', e.message || 'No se pudo iniciar sesión.'); }
}
function cerrarSesion(){ sessionStorage.removeItem(AUTH_KEY); location.reload(); }
function abrirCambioClave(obligatorio=false){
  const modal=document.getElementById('passwordModal');
  const cancel=document.getElementById('cancelPassBtn');
  const notice=document.getElementById('passNotice');
  if(modal) modal.hidden=false;
  if(cancel) cancel.style.display = obligatorio ? 'none' : 'inline-block';
  if(notice) notice.textContent = obligatorio ? 'Por seguridad debes cambiar la clave por defecto antes de continuar.' : 'Actualiza tu contraseña de acceso web.';
}
function cerrarCambioClave(){ const modal=document.getElementById('passwordModal'); if(modal) modal.hidden=true; }
async function guardarNuevaClave(){
  const actual=document.getElementById('passActual')?.value || '';
  const nueva=document.getElementById('passNueva')?.value || '';
  const nueva2=document.getElementById('passNueva2')?.value || '';
  if(!usuarioActual){ authMsg('passMsg','Sesión no encontrada.'); return; }
  const usuario = await buscarUsuarioPorRut(usuarioActual.rut || usuarioActual.id);
  if(!usuario || !claveValidaWeb(usuario, actual)){ authMsg('passMsg','La clave actual no es correcta.'); return; }
  if(nueva !== nueva2){ authMsg('passMsg','Las contraseñas nuevas no coinciden.'); return; }
  if(nueva.length < 8){ authMsg('passMsg','La nueva contraseña debe tener mínimo 8 caracteres.'); return; }
  if(nueva === '12345'){ authMsg('passMsg','No uses la clave por defecto.'); return; }
  guardarPassLocal(normalizarRutWeb(usuarioActual.rut || usuarioActual.id), nueva);
  usuarioActual.debe_cambiar_clave = false;
  setUsuarioSesion(usuarioActual);
  authMsg('passMsg','Contraseña cambiada correctamente en este dispositivo.', true);
  setTimeout(()=>cerrarCambioClave(), 800);
}
function inicializarAuth(){
  document.getElementById('loginBtn')?.addEventListener('click', iniciarSesion);
  document.getElementById('loginRut')?.addEventListener('keydown', e=>{ if(e.key==='Enter') iniciarSesion(); });
  document.getElementById('loginClave')?.addEventListener('keydown', e=>{ if(e.key==='Enter') iniciarSesion(); });
  document.getElementById('logoutBtn')?.addEventListener('click', cerrarSesion);
  document.getElementById('changePassBtn')?.addEventListener('click', ()=>abrirCambioClave(false));
  document.getElementById('savePassBtn')?.addEventListener('click', guardarNuevaClave);
  document.getElementById('cancelPassBtn')?.addEventListener('click', cerrarCambioClave);
  const saved = sessionStorage.getItem(AUTH_KEY);
  if(saved){
    try{ setUsuarioSesion(JSON.parse(saved)); mostrarApp(); inicializarSistemaVictoria(); return; }catch(e){ sessionStorage.removeItem(AUTH_KEY); }
  }
  mostrarLogin();
}
let inventario = [];
let historial = [];

function moneda(n){return Number(n||0).toLocaleString("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0});}
function setText(id,value){const el=document.getElementById(id); if(el) el.textContent=value;}
function totalGeneralItem(d){return Number(d.cat1||0)+Number(d.cat2||0)+Number(d.planta||0)+Number(d.cat3||0);}
function actualizarReloj(){const reloj=document.getElementById("clock"); if(reloj) reloj.textContent=new Date().toLocaleTimeString("es-CL"); actualizarResponsabilidad();}
setInterval(actualizarReloj,1000);
function aplicarPermisos(){document.querySelectorAll(".solo-super,.solo-super-section,.solo-modifica,.solo-modifica-section").forEach(el=>el.style.display="none"); const aviso=document.getElementById("avisoInformativo"); if(aviso) aviso.style.display="block";}
async function cargarJSON(url){const res=await fetch(`${url}?v=${Date.now()}`,{cache:"no-store"}); if(!res.ok) throw new Error(url); return await res.json();}
async function cargarInventario(){try{inventario=await cargarJSON("data/inventario.json"); llenarSelects(); actualizarResumen(); renderInventario(); actualizarReporte(); actualizarResponsabilidad();}catch(e){alert("No se pudo cargar el inventario público. Revisa que data/inventario.json exista en Netlify.");}}
async function cargarHistorial(){try{historial=await cargarJSON("data/historial.json"); renderHistorial();}catch(e){historial=[]; renderHistorial();}}
async function cargarMetadata(){try{const m=await cargarJSON("data/metadata.json"); const el=document.getElementById("responsableDetalle");}catch(e){}}
function mostrarSeccion(id){document.querySelectorAll(".seccion").forEach(s=>s.classList.remove("activa")); const seccion=document.getElementById(id); if(seccion) seccion.classList.add("activa"); if(id==="inventario") renderInventario(); if(id==="historial") cargarHistorial(); if(id==="reportes") actualizarReporte();}
function aplicarLabelsTabla(tablaId, labels){const tabla=document.getElementById(tablaId); if(!tabla)return; tabla.classList.add("responsive-card-table"); tabla.querySelectorAll("tbody tr").forEach(tr=>{tr.querySelectorAll("td").forEach((td,i)=>td.setAttribute("data-label",labels[i]||"Dato"));});}
function actualizarResumen(){const cat1=inventario.reduce((a,d)=>a+Number(d.cat1||0),0), cat2=inventario.reduce((a,d)=>a+Number(d.cat2||0),0), planta=inventario.reduce((a,d)=>a+Number(d.planta||0),0), cat3=inventario.reduce((a,d)=>a+Number(d.cat3||0),0), total=cat1+cat2+planta+cat3; setText("resCat1",cat1);setText("resCat2",cat2);setText("resPlanta",planta);setText("resCat3",cat3);setText("resTotal",total);setText("cardItems",inventario.length);setText("cardGeneral",cat1+cat2);setText("cardPlanta",planta);setText("cardExcluidos",cat3);}
function actualizarResponsabilidad(){const valorEl=document.getElementById("valorResponsable"), detalleEl=document.getElementById("responsableDetalle"); if(!valorEl||!detalleEl||!inventario.length)return; const totalValor=inventario.reduce((a,d)=>a+Number(d.valor_total||0),0); valorEl.textContent=moneda(totalValor); const hora=new Date().toLocaleTimeString("es-CL"); detalleEl.innerHTML=`${hora}<br>${usuarioActual?.nombre || "USUARIO WEB"}<br>${usuarioActual?.rut || ""}`;}
function renderInventario(){const filtro=(document.getElementById("buscar")?.value||"").toLowerCase(); const cuerpo=document.querySelector("#tablaInventario tbody"); if(!cuerpo)return; cuerpo.innerHTML=""; inventario.filter(d=>String(d.codigo).toLowerCase().includes(filtro)||String(d.item).toLowerCase().includes(filtro)).forEach(d=>{const fila=document.createElement("tr"); fila.innerHTML=`<td>${d.codigo}</td><td>${d.item}</td><td>${d.cat1}</td><td>${d.cat2}</td><td>${d.planta}</td><td>${d.cat3}</td><td>${totalGeneralItem(d)}</td><td>${moneda(d.valor_unitario)}</td><td>${moneda(d.valor_total)}</td>`; cuerpo.appendChild(fila);}); aplicarLabelsTabla("tablaInventario",["Código","Item","CAT I","CAT II","Per. planta","CAT III","Total","Valor unit.","Valor total"]);}
function llenarSelects(){}
function renderHistorial(){const cuerpo=document.querySelector("#tablaHistorial tbody"); if(!cuerpo)return; cuerpo.innerHTML=""; const mes=document.getElementById("filtroMes")?.value||""; const resp=(document.getElementById("filtroResponsable")?.value||"").toLowerCase(); historial.filter(h=>{let okMes=true; if(mes&&h.fecha){const partes=String(h.fecha).split(" ")[0].split("-"); if(partes.length===3) okMes=`${partes[2]}-${partes[1]}`===mes;} const texto=`${h.usuario} ${h.persona} ${h.movimiento} ${h.item}`.toLowerCase(); return okMes&&texto.includes(resp);}).forEach(h=>{const fila=document.createElement("tr"); fila.innerHTML=`<td>${h.fecha||""}</td><td>${h.usuario||""}</td><td>${h.perfil||""}</td><td>${h.movimiento||""}</td><td>${h.codigo||""}</td><td>${h.item||""}</td><td>${h.cantidad||""}</td><td>${h.desde||""}</td><td>${h.hacia||""}</td><td>${h.persona||""}</td><td>${h.oal||""}</td><td>${h.observacion||""}</td>`; cuerpo.appendChild(fila);}); aplicarLabelsTabla("tablaHistorial",["Fecha","Usuario","Perfil","Movimiento","Código","Item","Cantidad","Desde","Hacia","Responsable","OAL","Obs."]);}
function actualizarReporte(){const select=document.getElementById("almacenReporte"), titulo=document.getElementById("tituloReporte"), cuerpo=document.querySelector("#tablaReporte tbody"); if(!select||!titulo||!cuerpo)return; const almacen=select.value; cuerpo.innerHTML=""; const nombres={general:"ALMACÉN GENERAL",planta:"PERSONAL DE PLANTA",excluidos:"ALMACÉN DE EXCLUIDOS",todos:"TODOS LOS ALMACENES"}; titulo.textContent=nombres[almacen]; inventario.forEach(d=>{let total=0; if(almacen==="general") total=Number(d.cat1||0)+Number(d.cat2||0); if(almacen==="planta") total=Number(d.planta||0); if(almacen==="excluidos") total=Number(d.cat3||0); if(almacen==="todos") total=totalGeneralItem(d); if(total>0){const valor=total*Number(d.valor_unitario||0); const fila=document.createElement("tr"); fila.innerHTML=`<td>${d.codigo}</td><td>${d.item}</td><td>${total}</td><td>${moneda(valor)}</td>`; cuerpo.appendChild(fila);}}); aplicarLabelsTabla("tablaReporte",["Código","Item","Total","Valor total"]);}
function inicializarSistemaVictoria(){const fecha=document.getElementById("fechaReporte"); if(fecha) fecha.textContent=new Date().toLocaleDateString("es-CL"); aplicarPermisos(); actualizarReloj(); cargarInventario(); cargarHistorial();}
document.addEventListener("DOMContentLoaded", inicializarAuth);
