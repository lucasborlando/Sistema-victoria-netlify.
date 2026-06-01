
/* Sistema Victoria - Netlify informativo
   Corrección: login RUT robusto + clave inicial 12345 + optimización móvil.
*/
const AUTH_KEY = 'sistema_victoria_web_user';
const PASS_KEY = 'sistema_victoria_web_passwords_v3';
let usuarioActual = null;
let usuariosWebCache = [];
let inventario = [];
let historial = [];

function $(id){ return document.getElementById(id); }

function normalizarRutWeb(rut){
  return String(rut || '')
    .trim()
    .replace(/\./g,'')
    .replace(/\s+/g,'')
    .replace(/-/g,'')
    .toLowerCase()
    .replace(/k$/,'k');
}

function formatearRutVisible(rut){
  const clean = normalizarRutWeb(rut).toUpperCase();
  if(clean.length < 2) return rut || '';
  return clean.slice(0, -1) + '-' + clean.slice(-1);
}

function authMsg(id, msg, ok=false){
  const el=$(id);
  if(el){
    el.textContent = msg;
    el.style.color = ok ? '#b9f6ca' : '#ffd1d1';
  }
}

function leerPassLocales(){
  try { return JSON.parse(localStorage.getItem(PASS_KEY) || '{}'); }
  catch(e){ return {}; }
}

function guardarPassLocal(rutNormalizado, clave){
  const data = leerPassLocales();
  data[rutNormalizado] = String(clave);
  localStorage.setItem(PASS_KEY, JSON.stringify(data));
}

async function cargarUsuariosWeb(){
  if(usuariosWebCache.length) return usuariosWebCache;

  const rutas = [
    'data/usuarios_web.json',
    './data/usuarios_web.json',
    '/data/usuarios_web.json'
  ];

  let ultimoError = null;
  for(const ruta of rutas){
    try{
      const res = await fetch(`${ruta}?v=${Date.now()}`, {cache:'no-store'});
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if(!Array.isArray(data)) throw new Error('usuarios_web.json no es una lista');
      usuariosWebCache = data;
      return usuariosWebCache;
    }catch(e){
      ultimoError = e;
    }
  }
  throw new Error('No se pudo cargar la lista de usuarios autorizados.');
}

async function buscarUsuarioPorRut(rut){
  const rutNormal = normalizarRutWeb(rut);
  const usuarios = await cargarUsuariosWeb();
  return usuarios.find(u => {
    const a = normalizarRutWeb(u.rut || '');
    const b = normalizarRutWeb(u.id || '');
    return a === rutNormal || b === rutNormal;
  });
}

function claveValidaWeb(usuario, clave){
  const rutNormal = normalizarRutWeb(usuario.rut || usuario.id);
  const passLocales = leerPassLocales();

  // Contraseña cambiada desde esta app web en este dispositivo.
  if(passLocales[rutNormal]) return String(clave) === String(passLocales[rutNormal]);

  // Clave inicial creada por defecto desde el PC base.
  if(String(clave) === '12345') return true;

  // Compatibilidad si el exportador trae clave temporal.
  if(usuario.clave_temporal && String(clave) === String(usuario.clave_temporal)) return true;
  if(usuario.clave && String(clave) === String(usuario.clave)) return true;

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
  const top = $('usuarioTop');
  if(top) top.textContent = `${user.nombre || user.rut} | ${String(user.perfil || '').toUpperCase()}`;
}

function mostrarApp(){
  const login = $('loginScreen');
  const shell = $('appShell');
  if(login) login.hidden = true;
  if(shell) shell.hidden = false;
}

function mostrarLogin(){
  const login = $('loginScreen');
  const shell = $('appShell');
  if(shell) shell.hidden = true;
  if(login) login.hidden = false;
  setTimeout(()=> $('loginRut')?.focus(), 150);
}

async function iniciarSesion(){
  const rutInput = $('loginRut');
  const claveInput = $('loginClave');
  const rut = rutInput?.value || '';
  const clave = claveInput?.value || '';

  if(!rut.trim() || !clave.trim()){
    authMsg('loginMsg','Ingresa RUT y clave.');
    return;
  }

  try{
    const btn = $('loginBtn');
    if(btn){ btn.disabled = true; btn.textContent = 'VALIDANDO...'; }
    authMsg('loginMsg','Validando acceso...', true);

    const usuario = await buscarUsuarioPorRut(rut);
    if(!usuario || usuario.activo === false){
      throw new Error('Usuario no autorizado o inactivo.');
    }

    const perfil = String(usuario.perfil || 'informativo').toLowerCase();
    if(!['informativo','supervigilante','usuario'].includes(perfil)){
      throw new Error('Este perfil no tiene permiso para la versión informativa.');
    }

    if(!claveValidaWeb(usuario, clave)){
      throw new Error('RUT o clave incorrecta.');
    }

    const user = usuarioPublico(usuario);
    setUsuarioSesion(user);
    mostrarApp();
    inicializarSistemaVictoria();

    const rutNormal = normalizarRutWeb(user.rut || user.id);
    const passLocales = leerPassLocales();

    if(String(clave) === '12345' && !passLocales[rutNormal]){
      setTimeout(()=>abrirCambioClave(true), 350);
    }
  }catch(e){
    authMsg('loginMsg', e.message || 'No se pudo iniciar sesión.');
  }finally{
    const btn = $('loginBtn');
    if(btn){ btn.disabled = false; btn.textContent = 'INGRESAR'; }
  }
}

window.iniciarSesion = iniciarSesion;

function cerrarSesion(){
  sessionStorage.removeItem(AUTH_KEY);
  location.reload();
}

function abrirCambioClave(obligatorio=false){
  const modal=$('passwordModal');
  const cancel=$('cancelPassBtn');
  const notice=$('passNotice');
  const msg=$('passMsg');
  if(msg) msg.textContent='';
  if(modal) modal.hidden=false;
  if(cancel) cancel.style.display = obligatorio ? 'none' : 'inline-block';
  if(notice) notice.textContent = obligatorio ? 'Por seguridad debes cambiar la clave por defecto antes de continuar.' : 'Actualiza tu contraseña de acceso web.';
  setTimeout(()=> $('passActual')?.focus(), 150);
}

function cerrarCambioClave(){
  const modal=$('passwordModal');
  if(modal) modal.hidden=true;
}

async function guardarNuevaClave(){
  const actual=$('passActual')?.value || '';
  const nueva=$('passNueva')?.value || '';
  const nueva2=$('passNueva2')?.value || '';

  if(!usuarioActual){
    authMsg('passMsg','Sesión no encontrada.');
    return;
  }

  const usuario = await buscarUsuarioPorRut(usuarioActual.rut || usuarioActual.id);
  if(!usuario || !claveValidaWeb(usuario, actual)){
    authMsg('passMsg','La clave actual no es correcta.');
    return;
  }

  if(nueva !== nueva2){
    authMsg('passMsg','Las contraseñas nuevas no coinciden.');
    return;
  }

  if(nueva.length < 8){
    authMsg('passMsg','La nueva contraseña debe tener mínimo 8 caracteres.');
    return;
  }

  if(nueva === '12345'){
    authMsg('passMsg','No uses la clave por defecto.');
    return;
  }

  guardarPassLocal(normalizarRutWeb(usuarioActual.rut || usuarioActual.id), nueva);
  usuarioActual.debe_cambiar_clave = false;
  setUsuarioSesion(usuarioActual);
  authMsg('passMsg','Contraseña cambiada correctamente en este dispositivo.', true);
  setTimeout(()=>cerrarCambioClave(), 800);
}

function inicializarAuth(){
  const loginBtn = $('loginBtn');
  if(loginBtn){
    loginBtn.onclick = iniciarSesion;
    loginBtn.addEventListener('click', iniciarSesion);
  }

  $('loginRut')?.addEventListener('keydown', e=>{ if(e.key==='Enter') iniciarSesion(); });
  $('loginClave')?.addEventListener('keydown', e=>{ if(e.key==='Enter') iniciarSesion(); });
  $('logoutBtn')?.addEventListener('click', cerrarSesion);
  $('changePassBtn')?.addEventListener('click', ()=>abrirCambioClave(false));
  $('savePassBtn')?.addEventListener('click', guardarNuevaClave);
  $('cancelPassBtn')?.addEventListener('click', cerrarCambioClave);

  const saved = sessionStorage.getItem(AUTH_KEY);
  if(saved){
    try{
      setUsuarioSesion(JSON.parse(saved));
      mostrarApp();
      inicializarSistemaVictoria();
      return;
    }catch(e){
      sessionStorage.removeItem(AUTH_KEY);
    }
  }
  mostrarLogin();
}

function moneda(n){
  return Number(n||0).toLocaleString("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0});
}

function setText(id,value){
  const el=$(id);
  if(el) el.textContent=value;
}

function totalGeneralItem(d){
  return Number(d.cat1||0)+Number(d.cat2||0)+Number(d.planta||0)+Number(d.cat3||0);
}

function actualizarReloj(){
  const reloj=$("clock");
  if(reloj) reloj.textContent=new Date().toLocaleTimeString("es-CL");
  actualizarResponsabilidad();
}
setInterval(actualizarReloj,1000);

function aplicarPermisos(){
  document.querySelectorAll(".solo-super,.solo-super-section,.solo-modifica,.solo-modifica-section")
    .forEach(el=>el.style.display="none");
  const aviso=$("avisoInformativo");
  if(aviso) aviso.style.display="block";
}

async function cargarJSON(url){
  const res=await fetch(`${url}?v=${Date.now()}`,{cache:"no-store"});
  if(!res.ok) throw new Error(url);
  return await res.json();
}

async function cargarInventario(){
  try{
    inventario=await cargarJSON("data/inventario.json");
    llenarSelects();
    actualizarResumen();
    renderInventario();
    actualizarReporte();
    actualizarResponsabilidad();
  }catch(e){
    console.error(e);
    alert("No se pudo cargar el inventario público. Revisa que data/inventario.json exista en Netlify.");
  }
}

async function cargarHistorial(){
  try{
    historial=await cargarJSON("data/historial.json");
    renderHistorial();
  }catch(e){
    historial=[];
    renderHistorial();
  }
}

async function cargarMetadata(){
  try{ await cargarJSON("data/metadata.json"); }catch(e){}
}

function mostrarSeccion(id){
  document.querySelectorAll(".seccion").forEach(s=>s.classList.remove("activa"));
  const seccion=$(id);
  if(seccion) seccion.classList.add("activa");
  if(id==="inventario") renderInventario();
  if(id==="historial") cargarHistorial();
  if(id==="reportes") actualizarReporte();
}
window.mostrarSeccion = mostrarSeccion;

function aplicarLabelsTabla(tablaId, labels){
  const tabla=$(tablaId);
  if(!tabla)return;
  tabla.classList.add("responsive-card-table");
  tabla.querySelectorAll("tbody tr").forEach(tr=>{
    tr.querySelectorAll("td").forEach((td,i)=>td.setAttribute("data-label",labels[i]||"Dato"));
  });
}

function actualizarResumen(){
  const cat1=inventario.reduce((a,d)=>a+Number(d.cat1||0),0);
  const cat2=inventario.reduce((a,d)=>a+Number(d.cat2||0),0);
  const planta=inventario.reduce((a,d)=>a+Number(d.planta||0),0);
  const cat3=inventario.reduce((a,d)=>a+Number(d.cat3||0),0);
  const total=cat1+cat2+planta+cat3;
  setText("resCat1",cat1); setText("resCat2",cat2); setText("resPlanta",planta); setText("resCat3",cat3); setText("resTotal",total);
  setText("cardItems",inventario.length); setText("cardGeneral",cat1+cat2); setText("cardPlanta",planta); setText("cardExcluidos",cat3);
}

function actualizarResponsabilidad(){
  const valorEl=$("valorResponsable");
  const detalleEl=$("responsableDetalle");
  if(!valorEl||!detalleEl||!inventario.length)return;
  const totalValor=inventario.reduce((a,d)=>a+Number(d.valor_total||0),0);
  valorEl.textContent=moneda(totalValor);
  const hora=new Date().toLocaleTimeString("es-CL");
  detalleEl.innerHTML=`${hora}<br>${usuarioActual?.nombre || "USUARIO WEB"}<br>${usuarioActual?.rut || ""}`;
}

function renderInventario(){
  const filtro=($("buscar")?.value||"").toLowerCase();
  const cuerpo=document.querySelector("#tablaInventario tbody");
  if(!cuerpo)return;
  cuerpo.innerHTML="";
  inventario
    .filter(d=>String(d.codigo).toLowerCase().includes(filtro)||String(d.item).toLowerCase().includes(filtro))
    .forEach(d=>{
      const fila=document.createElement("tr");
      fila.innerHTML=`<td>${d.codigo}</td><td>${d.item}</td><td>${d.cat1}</td><td>${d.cat2}</td><td>${d.planta}</td><td>${d.cat3}</td><td>${totalGeneralItem(d)}</td><td>${moneda(d.valor_unitario)}</td><td>${moneda(d.valor_total)}</td>`;
      cuerpo.appendChild(fila);
    });
  aplicarLabelsTabla("tablaInventario",["Código","Item","CAT I","CAT II","Per. planta","CAT III","Total","Valor unit.","Valor total"]);
}
window.renderInventario = renderInventario;

function llenarSelects(){}

function renderHistorial(){
  const cuerpo=document.querySelector("#tablaHistorial tbody");
  if(!cuerpo)return;
  cuerpo.innerHTML="";
  const mes=$("filtroMes")?.value||"";
  const resp=($("filtroResponsable")?.value||"").toLowerCase();
  historial
    .filter(h=>{
      let okMes=true;
      if(mes&&h.fecha){
        const partes=String(h.fecha).split(" ")[0].split("-");
        if(partes.length===3) okMes=`${partes[2]}-${partes[1]}`===mes;
      }
      const texto=`${h.usuario} ${h.persona} ${h.movimiento} ${h.item}`.toLowerCase();
      return okMes&&texto.includes(resp);
    })
    .forEach(h=>{
      const fila=document.createElement("tr");
      fila.innerHTML=`<td>${h.fecha||""}</td><td>${h.usuario||""}</td><td>${h.perfil||""}</td><td>${h.movimiento||""}</td><td>${h.codigo||""}</td><td>${h.item||""}</td><td>${h.cantidad||""}</td><td>${h.desde||""}</td><td>${h.hacia||""}</td><td>${h.persona||""}</td><td>${h.oal||""}</td><td>${h.observacion||""}</td>`;
      cuerpo.appendChild(fila);
    });
  aplicarLabelsTabla("tablaHistorial",["Fecha","Usuario","Perfil","Movimiento","Código","Item","Cantidad","Desde","Hacia","Responsable","OAL","Obs."]);
}
window.renderHistorial = renderHistorial;

function actualizarReporte(){
  const select=$("almacenReporte");
  const titulo=$("tituloReporte");
  const cuerpo=document.querySelector("#tablaReporte tbody");
  if(!select||!titulo||!cuerpo)return;
  const almacen=select.value;
  cuerpo.innerHTML="";
  const nombres={general:"ALMACÉN GENERAL",planta:"PERSONAL DE PLANTA",excluidos:"ALMACÉN DE EXCLUIDOS",todos:"TODOS LOS ALMACENES"};
  titulo.textContent=nombres[almacen];
  inventario.forEach(d=>{
    let total=0;
    if(almacen==="general") total=Number(d.cat1||0)+Number(d.cat2||0);
    if(almacen==="planta") total=Number(d.planta||0);
    if(almacen==="excluidos") total=Number(d.cat3||0);
    if(almacen==="todos") total=totalGeneralItem(d);
    if(total>0){
      const valor=total*Number(d.valor_unitario||0);
      const fila=document.createElement("tr");
      fila.innerHTML=`<td>${d.codigo}</td><td>${d.item}</td><td>${total}</td><td>${moneda(valor)}</td>`;
      cuerpo.appendChild(fila);
    }
  });
  aplicarLabelsTabla("tablaReporte",["Código","Item","Total","Valor total"]);
}
window.actualizarReporte = actualizarReporte;

function inicializarSistemaVictoria(){
  const fecha=$("fechaReporte");
  if(fecha) fecha.textContent=new Date().toLocaleDateString("es-CL");
  aplicarPermisos();
  actualizarReloj();
  cargarInventario();
  cargarHistorial();
}

document.addEventListener("DOMContentLoaded", inicializarAuth);
