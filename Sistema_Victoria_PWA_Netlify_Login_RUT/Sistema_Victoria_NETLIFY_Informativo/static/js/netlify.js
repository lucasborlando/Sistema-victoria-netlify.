
const AUTH_KEY = 'sistema_victoria_web_user';
let usuarioActual = null;
function normalizarRutWeb(rut){ return String(rut || '').replace(/[\.\s]/g,'').toLowerCase(); }
function authMsg(id, msg, ok=false){ const el=document.getElementById(id); if(el){ el.textContent=msg; el.style.color = ok ? '#b9f6ca' : '#ffd1d1'; } }
async function apiPost(url, payload){
  const res = await fetch(url, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
  const data = await res.json().catch(()=>({ok:false,error:'Respuesta inválida'}));
  if(!res.ok || !data.ok) throw new Error(data.error || 'Error de conexión');
  return data;
}
function setUsuarioSesion(user){
  usuarioActual = user;
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
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
    const data = await apiPost('/.netlify/functions/login', {rut, clave});
    setUsuarioSesion(data.user);
    mostrarApp();
    inicializarSistemaVictoria();
    if(data.user.debe_cambiar_clave || clave === '12345') abrirCambioClave(true);
  }catch(e){ authMsg('loginMsg', e.message); }
}
function cerrarSesion(){ localStorage.removeItem(AUTH_KEY); location.reload(); }
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
  if(nueva !== nueva2){ authMsg('passMsg','Las contraseñas nuevas no coinciden.'); return; }
  if(nueva.length < 8){ authMsg('passMsg','La nueva contraseña debe tener mínimo 8 caracteres.'); return; }
  try{
    authMsg('passMsg','Guardando nueva contraseña...', true);
    const data = await apiPost('/.netlify/functions/change-password', {rut:usuarioActual.rut || usuarioActual.id, actual, nueva});
    setUsuarioSesion(data.user);
    authMsg('passMsg','Contraseña cambiada correctamente. Netlify actualizará el archivo de usuarios en GitHub.', true);
    setTimeout(()=>cerrarCambioClave(), 1000);
  }catch(e){ authMsg('passMsg', e.message); }
}
function inicializarAuth(){
  document.getElementById('loginBtn')?.addEventListener('click', iniciarSesion);
  document.getElementById('loginClave')?.addEventListener('keydown', e=>{ if(e.key==='Enter') iniciarSesion(); });
  document.getElementById('logoutBtn')?.addEventListener('click', cerrarSesion);
  document.getElementById('changePassBtn')?.addEventListener('click', ()=>abrirCambioClave(false));
  document.getElementById('savePassBtn')?.addEventListener('click', guardarNuevaClave);
  document.getElementById('cancelPassBtn')?.addEventListener('click', cerrarCambioClave);
  const saved = localStorage.getItem(AUTH_KEY);
  if(saved){
    try{ setUsuarioSesion(JSON.parse(saved)); mostrarApp(); inicializarSistemaVictoria(); return; }catch(e){ localStorage.removeItem(AUTH_KEY); }
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
