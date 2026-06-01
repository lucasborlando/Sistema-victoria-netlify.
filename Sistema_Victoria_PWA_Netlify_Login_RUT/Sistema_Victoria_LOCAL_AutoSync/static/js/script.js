let inventario = [];
let historial = [];
let usuarioActual = window.USUARIO_ACTUAL || {};

function moneda(n) {
  return Number(n || 0).toLocaleString("es-CL", {style:"currency", currency:"CLP", maximumFractionDigits:0});
}

function actualizarReloj() {
  const reloj = document.getElementById("clock");
  if (reloj) reloj.textContent = new Date().toLocaleTimeString("es-CL");
  actualizarResponsabilidad();
}
setInterval(actualizarReloj, 1000);

function aplicarPermisos() {
  const perfil = usuarioActual.perfil || "";
  const esSuper = perfil === "supervigilante";
  const esInformativo = perfil === "informativo";
  const puedeModificar = perfil === "usuario" || perfil === "supervigilante";

  document.querySelectorAll(".solo-super, .solo-super-section").forEach(el => {
    el.style.display = esSuper ? "" : "none";
  });
  document.querySelectorAll(".solo-super-inline").forEach(el => {
    el.style.display = esSuper ? "grid" : "none";
  });
  document.querySelectorAll(".solo-modifica, .solo-modifica-section").forEach(el => {
    el.style.display = puedeModificar ? "" : "none";
  });

  const aviso = document.getElementById("avisoInformativo");
  if (aviso) aviso.style.display = esInformativo ? "block" : "none";
}

async function cargarInventario() {
  const res = await fetch("/api/inventario");
  if (res.status === 401) {
    location.href = "/login";
    return;
  }
  inventario = await res.json();
  llenarSelects();
  actualizarResumen();
  renderInventario();
  actualizarReporte();
  actualizarResponsabilidad();
}

async function cargarHistorial() {
  const res = await fetch("/api/historial");
  historial = await res.json();
  renderHistorial();
}

function mostrarSeccion(id) {
  const seccionesBloqueadas = ["movimientos", "entregar", "recibir", "excluidos", "agregarItem", "eliminarItem", "usuarios"];
  if (usuarioActual.perfil === "informativo" && seccionesBloqueadas.includes(id)) {
    alert("Perfil informativo: solo puede visualizar inventario, categorías, historial y reportes.");
    id = "inventario";
  }

  document.querySelectorAll(".seccion").forEach(s => s.classList.remove("activa"));
  const seccion = document.getElementById(id);
  if (seccion) seccion.classList.add("activa");
  if (id === "inventario") renderInventario();
  if (id === "historial") cargarHistorial();
  if (id === "usuarios") cargarUsuarios();
}

function totalGeneralItem(d) {
  return Number(d.cat1) + Number(d.cat2) + Number(d.planta) + Number(d.cat3);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function aplicarLabelsTabla(tablaId, labels) {
  const tabla = document.getElementById(tablaId);
  if (!tabla) return;
  tabla.classList.add("responsive-card-table");
  tabla.querySelectorAll("tbody tr").forEach(tr => {
    tr.querySelectorAll("td").forEach((td, i) => {
      td.setAttribute("data-label", labels[i] || "Dato");
    });
  });
}

function actualizarResumen() {
  const cat1 = inventario.reduce((a,d)=>a+Number(d.cat1),0);
  const cat2 = inventario.reduce((a,d)=>a+Number(d.cat2),0);
  const planta = inventario.reduce((a,d)=>a+Number(d.planta),0);
  const cat3 = inventario.reduce((a,d)=>a+Number(d.cat3),0);
  const total = cat1 + cat2 + planta + cat3;

  setText("resCat1", cat1);
  setText("resCat2", cat2);
  setText("resPlanta", planta);
  setText("resCat3", cat3);
  setText("resTotal", total);
  setText("cardItems", inventario.length);
  setText("cardGeneral", cat1 + cat2);
  setText("cardPlanta", planta);
  setText("cardExcluidos", cat3);
}

function actualizarResponsabilidad() {
  const valorEl = document.getElementById("valorResponsable");
  const detalleEl = document.getElementById("responsableDetalle");
  if (!valorEl || !detalleEl || !inventario.length) return;

  const totalValor = inventario.reduce((a,d)=>a + Number(d.valor_total || 0), 0);
  valorEl.textContent = moneda(totalValor);

  const hora = new Date().toLocaleTimeString("es-CL");
  const rut = usuarioActual.rut ? ` | ${usuarioActual.rut}` : "";
  detalleEl.innerHTML = `${hora}<br>${usuarioActual.nombre}${rut}<br>${String(usuarioActual.perfil || "").toUpperCase()}`;
}

function renderInventario() {
  const filtro = (document.getElementById("buscar")?.value || "").toLowerCase();
  const cuerpo = document.querySelector("#tablaInventario tbody");
  if (!cuerpo) return;
  cuerpo.innerHTML = "";

  inventario
    .filter(d => d.codigo.toLowerCase().includes(filtro) || d.item.toLowerCase().includes(filtro))
    .forEach(d => {
      const fila = document.createElement("tr");
      fila.innerHTML = `
        <td>${d.codigo}</td><td>${d.item}</td><td>${d.cat1}</td><td>${d.cat2}</td>
        <td>${d.planta}</td><td>${d.cat3}</td><td>${totalGeneralItem(d)}</td>
        <td>${moneda(d.valor_unitario)}</td><td>${moneda(d.valor_total)}</td>
      `;
      cuerpo.appendChild(fila);
    });

  aplicarLabelsTabla("tablaInventario", ["Código", "Item", "CAT I", "CAT II", "Per. planta", "CAT III", "Total", "Valor unit.", "Valor total"]);
}

function llenarSelects() {
  ["entregarItem","recibirItem","excluirItem","eliminarSelect"].forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;
    select.innerHTML = "";
    inventario.forEach(d => {
      const op = document.createElement("option");
      op.value = d.fila;
      op.textContent = `${d.codigo} - ${d.item}`;
      select.appendChild(op);
    });
  });
  actualizarInfoEntrega();
}

function actualizarInfoEntrega() {
  const itemSelect = document.getElementById("entregarItem");
  const origenSelect = document.getElementById("entregarOrigen");
  const info = document.getElementById("entregarStockInfo");
  if (!itemSelect || !origenSelect || !info) return;

  const fila = Number(itemSelect.value);
  const origen = origenSelect.value;
  const item = inventario.find(d => Number(d.fila) === fila);
  if (!item) {
    info.textContent = "Stock disponible: --";
    return;
  }

  const nombreCategoria = origen === "cat1" ? "CAT I NUEVO" : "CAT II USADO";
  info.textContent = `Stock disponible en ${nombreCategoria}: ${Number(item[origen] || 0)}`;
}

async function guardarMovimiento(tipo) {
  if (usuarioActual.perfil === "informativo") return alert("Perfil informativo: no puede modificar inventario ni realizar movimientos.");
  let payload = { tipo };

  if (tipo === "entregar") {
    payload.fila = document.getElementById("entregarItem").value;
    payload.origen = document.getElementById("entregarOrigen").value;
    payload.cantidad = document.getElementById("entregarCantidad").value;
    payload.persona = document.getElementById("entregarPersona").value;
    payload.observacion = document.getElementById("entregarObs").value;
  }

  if (tipo === "recibir") {
    payload.fila = document.getElementById("recibirItem").value;
    payload.cantidad = document.getElementById("recibirCantidad").value;
    payload.persona = document.getElementById("recibirPersona").value;
    payload.observacion = document.getElementById("recibirObs").value;
  }

  if (tipo === "excluir") {
    payload.fila = document.getElementById("excluirItem").value;
    payload.origen = document.getElementById("excluirOrigen").value;
    payload.cantidad = document.getElementById("excluirCantidad").value;
    payload.persona = document.getElementById("excluirPersona").value;
    payload.observacion = document.getElementById("excluirObs").value;
  }

  const res = await fetch("/api/movimiento", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) return alert(data.mensaje || "No se pudo guardar.");

  alert(data.mensaje);
  await cargarInventario();
  await cargarHistorial();
}

async function agregarItem() {
  if (usuarioActual.perfil === "informativo") return alert("Perfil informativo: no puede modificar inventario ni realizar movimientos.");
  const payload = {
    codigo: document.getElementById("nuevoCodigo").value,
    item: document.getElementById("nuevoItem").value,
    categoria: document.getElementById("nuevoCategoria").value,
    cantidad: document.getElementById("nuevoCantidad").value,
    valor_unitario: document.getElementById("nuevoValor").value,
    oal: document.getElementById("nuevoOal").value,
    observacion: document.getElementById("nuevoObs").value
  };

  const res = await fetch("/api/item/agregar", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) return alert(data.mensaje);
  alert(data.mensaje);
  await cargarInventario();
  await cargarHistorial();
}

async function eliminarItem() {
  if (usuarioActual.perfil === "informativo") return alert("Perfil informativo: no puede modificar inventario ni realizar movimientos.");
  if (!confirm("¿Seguro que deseas eliminar este item del inventario?")) return;

  const payload = {
    fila: document.getElementById("eliminarSelect").value,
    oal: document.getElementById("eliminarOal").value,
    motivo: document.getElementById("eliminarMotivo").value
  };

  const res = await fetch("/api/item/eliminar", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) return alert(data.mensaje);
  alert(data.mensaje);
  await cargarInventario();
  await cargarHistorial();
}

function renderHistorial() {
  const cuerpo = document.querySelector("#tablaHistorial tbody");
  if (!cuerpo) return;
  cuerpo.innerHTML = "";

  const mes = document.getElementById("filtroMes")?.value || "";
  const resp = (document.getElementById("filtroResponsable")?.value || "").toLowerCase();

  historial
    .filter(h => {
      let okMes = true;
      if (mes && h.fecha) {
        const partes = String(h.fecha).split(" ")[0].split("-");
        if (partes.length === 3) {
          const yyyyMM = `${partes[2]}-${partes[1]}`;
          okMes = yyyyMM === mes;
        }
      }
      const texto = `${h.usuario} ${h.persona} ${h.movimiento} ${h.item}`.toLowerCase();
      return okMes && texto.includes(resp);
    })
    .forEach(h => {
      const fila = document.createElement("tr");
      fila.innerHTML = `
        <td>${h.fecha || ""}</td><td>${h.usuario || ""}</td><td>${h.perfil || ""}</td>
        <td>${h.movimiento || ""}</td><td>${h.codigo || ""}</td><td>${h.item || ""}</td>
        <td>${h.cantidad || ""}</td><td>${h.desde || ""}</td><td>${h.hacia || ""}</td>
        <td>${h.persona || ""}</td><td>${h.oal || ""}</td><td>${h.observacion || ""}</td>
      `;
      cuerpo.appendChild(fila);
    });

  aplicarLabelsTabla("tablaHistorial", ["Fecha", "Usuario", "Perfil", "Movimiento", "Código", "Item", "Cantidad", "Desde", "Hacia", "Responsable", "OAL", "Obs."]);
}

function actualizarReporte() {
  const select = document.getElementById("almacenReporte");
  const titulo = document.getElementById("tituloReporte");
  const cuerpo = document.querySelector("#tablaReporte tbody");
  if (!select || !titulo || !cuerpo) return;

  const almacen = select.value;
  cuerpo.innerHTML = "";

  const nombres = {
    general: "ALMACÉN GENERAL",
    planta: "PERSONAL DE PLANTA",
    excluidos: "ALMACÉN DE EXCLUIDOS",
    todos: "TODOS LOS ALMACENES"
  };

  titulo.textContent = nombres[almacen];

  inventario.forEach(d => {
    let total = 0;
    if (almacen === "general") total = Number(d.cat1) + Number(d.cat2);
    if (almacen === "planta") total = Number(d.planta);
    if (almacen === "excluidos") total = Number(d.cat3);
    if (almacen === "todos") total = totalGeneralItem(d);

    if (total > 0) {
      const valor = total * Number(d.valor_unitario || 0);
      const fila = document.createElement("tr");
      fila.innerHTML = `<td>${d.codigo}</td><td>${d.item}</td><td>${total}</td><td>${moneda(valor)}</td>`;
      cuerpo.appendChild(fila);
    }
  });

  aplicarLabelsTabla("tablaReporte", ["Código", "Item", "Total", "Valor total"]);
}

async function cambiarClave() {
  const res = await fetch("/api/cambiar-clave", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      actual: document.getElementById("claveActual").value,
      nueva: document.getElementById("claveNueva").value
    })
  });

  const data = await res.json();
  alert(data.mensaje);

  if (res.ok) {
    document.getElementById("claveActual").value = "";
    document.getElementById("claveNueva").value = "";
  }
}

async function cargarUsuarios() {
  if (usuarioActual.perfil !== "supervigilante") return;

  const res = await fetch("/api/usuarios");
  if (!res.ok) return;

  const usuarios = await res.json();
  const cuerpo = document.querySelector("#tablaUsuarios tbody");
  if (!cuerpo) return;
  cuerpo.innerHTML = "";

  usuarios.forEach(u => {
    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td>${u.id || ""}</td><td>${u.rut || ""}</td><td>${u.nombre || ""}</td><td>${u.cargo || ""}</td><td>${u.perfil || ""}</td>
      <td><button class="save danger" onclick="eliminarUsuario('${u.id}')">Eliminar</button></td>
    `;
    cuerpo.appendChild(fila);
  });

  aplicarLabelsTabla("tablaUsuarios", ["ID", "RUT", "Nombre", "Cargo", "Perfil", "Acción"]);
}

async function crearUsuario() {
  const payload = {
    rut: document.getElementById("userRut").value,
    nombre: document.getElementById("userNombre").value,
    cargo: document.getElementById("userCargo").value,
    perfil: document.getElementById("userPerfil").value,
    clave: document.getElementById("userClave").value
  };

  const res = await fetch("/api/usuarios", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(payload)
  });

  const data = await res.json();
  alert(data.mensaje);

  if (res.ok) {
    document.getElementById("userRut").value = "";
    document.getElementById("userNombre").value = "";
    document.getElementById("userCargo").value = "";
    document.getElementById("userClave").value = "12345";
    cargarUsuarios();
  }
}

async function eliminarUsuario(id) {
  if (!confirm("¿Eliminar usuario?")) return;

  const res = await fetch("/api/usuarios/eliminar", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({id})
  });

  const data = await res.json();
  alert(data.mensaje);

  if (res.ok) cargarUsuarios();
}

document.addEventListener("DOMContentLoaded", () => {
  const fecha = document.getElementById("fechaReporte");
  if (fecha) fecha.textContent = new Date().toLocaleDateString("es-CL");

  aplicarPermisos();
  actualizarReloj();
  cargarInventario();
  cargarHistorial();
});
