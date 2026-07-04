//==========================================================================
// BEAUTIFYX - CONTROLADOR DEL DASHBOARD (multi-rol)
// Requiere: firebase-config.js, auth.js, api.js, app.js cargados antes.
//==========================================================================

let usuarioActualAuth = null;
let usuarioActualDatos = null;

// Estado temporal de los formularios de Personal / Servicios
let personalEnEdicionId = null;
let fotoPersonalBase64Actual = null;
let servicioEnEdicionId = null;

document.addEventListener("DOMContentLoaded", () => {
    const hoy = new Date();
    const opciones = { weekday: "long", day: "numeric", month: "long", year: "numeric" };
    const elFecha = document.getElementById("fecha-actual");
    if (elFecha) elFecha.innerText = hoy.toLocaleDateString("es-DO", opciones);

    protegerPagina((usuarioAuth, datosPerfil) => {
        usuarioActualAuth = usuarioAuth;
        usuarioActualDatos = datosPerfil;
        inicializarDashboard();
    });

    const btnSalir1 = document.getElementById("btnCerrarSesion");
    const btnSalir2 = document.getElementById("btnCerrarSesion2");
    if (btnSalir1) btnSalir1.onclick = cerrarSesion;
    if (btnSalir2) btnSalir2.onclick = cerrarSesion;

    const btnNotif = document.getElementById("btnNotificaciones");
    const panelNotif = document.getElementById("panel-notificaciones");
    if (btnNotif && panelNotif) {
        btnNotif.onclick = (e) => {
            e.stopPropagation();
            const seVaAbrir = panelNotif.classList.contains("oculto");
            panelNotif.classList.toggle("oculto");
            if (seVaAbrir) cargarNotificaciones();
        };
        document.addEventListener("click", (e) => {
            if (!panelNotif.classList.contains("oculto") && !panelNotif.contains(e.target) && e.target !== btnNotif) {
                panelNotif.classList.add("oculto");
            }
        });
    }

    configurarModoOscuro();

    const btnMenuMovil = document.getElementById("btnMenuMovil");
    const sidebar = document.getElementById("sidebar");
    if (btnMenuMovil && sidebar) {
        btnMenuMovil.onclick = () => sidebar.classList.toggle("sidebar-abierta");
    }

    const btnAbrirPerfil = document.getElementById("btnAbrirPerfil");
    if (btnAbrirPerfil) btnAbrirPerfil.onclick = () => cambiarTab("configuracion");

    configurarNavegacionTabs();
    configurarFormularioPerfil();
    configurarFormularioNegocio();
    configurarModuloMantenimiento();
    configurarModuloAlertas();
    configurarModuloPersonal();
    configurarModuloServicios();
});

//==========================================================================
// MODO OSCURO (persistente, disponible para todos los roles)
//==========================================================================
function configurarModoOscuro() {
    const btnModo = document.getElementById("btnModoOscuro");
    if (!btnModo) return;
    const icono = btnModo.querySelector("i");

    const aplicarEstado = (activo) => {
        document.body.classList.toggle("dark-mode", activo);
        if (icono) {
            icono.classList.toggle("fa-moon", !activo);
            icono.classList.toggle("fa-sun", activo);
        }
    };

    aplicarEstado(localStorage.getItem("beautifyx-modo-oscuro") === "true");

    btnModo.onclick = () => {
        const nuevoEstado = !document.body.classList.contains("dark-mode");
        aplicarEstado(nuevoEstado);
        localStorage.setItem("beautifyx-modo-oscuro", nuevoEstado);
    };
}

//==========================================================================
// INICIALIZACIÓN SEGÚN ROL
//==========================================================================
function inicializarDashboard() {
    const tipo = usuarioActualDatos.tipo;
    const nombre = usuarioActualDatos.nombre || usuarioActualAuth.email;

    document.getElementById("nombre-usuario").innerText = nombre;
    document.getElementById("tipo-usuario").innerText = ETIQUETAS_TIPO_CUENTA[tipo] || tipo;
    document.getElementById("avatar-usuario").innerText = nombre.charAt(0).toUpperCase();
    const primerNombre = nombre.split(" ")[0];
    document.getElementById("saludo-usuario").innerText = `¡Hola, ${primerNombre}! 👋`;

    document.querySelectorAll(".nav-item[data-roles]").forEach(btn => {
        const roles = btn.getAttribute("data-roles").split(",");
        btn.style.display = roles.includes(tipo) ? "flex" : "none";
    });

    const tarjetaInfoNegocio = document.getElementById("tarjeta-info-negocio");
    if (tarjetaInfoNegocio) {
        tarjetaInfoNegocio.classList.toggle("oculto", !(tipo === "barberia" || tipo === "salon"));
    }

    document.getElementById("panel-negocio").classList.add("oculto");
    document.getElementById("panel-admin").classList.add("oculto");
    document.getElementById("panel-cliente").classList.add("oculto");

    if (tipo === "barberia" || tipo === "salon") {
        document.getElementById("panel-negocio").classList.remove("oculto");
        iniciarPanelCitas();
        cargarDatosNegocioEnFormulario();
    } else if (tipo === "administrador") {
        document.getElementById("panel-admin").classList.remove("oculto");
        cargarResumenAdmin();
        cargarAprobacionesPendientes();
        cargarListaUsuarios();
    } else {
        document.getElementById("panel-cliente").classList.remove("oculto");
        document.getElementById("saludo-cliente").innerText = `¡Bienvenido/a, ${primerNombre}! 👋`;
        cargarResumenCliente();
        cargarNegociosParaCliente();
    }

    renderizarPerfil();
    cargarNotificaciones();
    cargarAlertaGlobal();
}

//==========================================================================
// NAVEGACIÓN ENTRE PESTAÑAS
//==========================================================================
function configurarNavegacionTabs() {
    document.querySelectorAll(".nav-item[data-tab]").forEach(btn => {
        btn.addEventListener("click", () => cambiarTab(btn.getAttribute("data-tab")));
    });

    document.querySelectorAll("[data-ir-tab]").forEach(btn => {
        btn.addEventListener("click", () => cambiarTab(btn.getAttribute("data-ir-tab")));
    });

    const btnIrAprobaciones = document.getElementById("btnIrAprobaciones");
    if (btnIrAprobaciones) btnIrAprobaciones.onclick = () => cambiarTab("aprobaciones");

    const btnIrBuscar = document.getElementById("btnIrBuscar");
    if (btnIrBuscar) btnIrBuscar.onclick = () => cambiarTab("buscar");
}

function cambiarTab(nombreTab) {
    document.querySelectorAll(".seccion-dashboard").forEach(sec => sec.classList.add("oculto"));
    document.querySelectorAll(".nav-item[data-tab]").forEach(btn => btn.classList.remove("activo"));

    const seccion = document.getElementById("seccion-" + nombreTab);
    if (seccion) seccion.classList.remove("oculto");

    document.querySelectorAll(`.nav-item[data-tab="${nombreTab}"]`).forEach(btn => btn.classList.add("activo"));

    const sidebar = document.getElementById("sidebar");
    if (sidebar) sidebar.classList.remove("sidebar-abierta");

    if (nombreTab === "miscitas") cargarMisCitas();
    if (nombreTab === "favoritos") cargarFavoritos();
    if (nombreTab === "clientes") cargarClientesDelNegocio();
    if (nombreTab === "reportes") { cargarGraficoSemanal("grafico-semanal-reportes", "grafico-total-semana-reportes"); cargarRankingServicios(); }
    if (nombreTab === "mantenimiento") cargarModuloMantenimiento();
    if (nombreTab === "alertas") cargarListaAlertas();
    if (nombreTab === "personal") cargarModuloPersonal();
    if (nombreTab === "servicios") cargarModuloServicios();
    if (nombreTab === "citas") renderizarListaCitasDelDia();
}

//==========================================================================
// NOTIFICACIONES
//==========================================================================
function tiempoRelativo(fecha) {
    const ahora = new Date();
    const diffMs = ahora - fecha;
    const minutos = Math.floor(diffMs / 60000);
    if (minutos < 1) return "Justo ahora";
    if (minutos < 60) return `Hace ${minutos} min`;
    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `Hace ${horas} h`;
    const dias = Math.floor(horas / 24);
    return `Hace ${dias} d`;
}

function actualizarBadgeNotificaciones(cantidad) {
    const badge = document.getElementById("badge-notificaciones");
    if (!badge) return;
    if (cantidad > 0) {
        badge.innerText = cantidad > 9 ? "9+" : cantidad;
        badge.classList.remove("oculto");
    } else {
        badge.classList.add("oculto");
    }
}

function renderizarNotificaciones(items) {
    const contenedor = document.getElementById("lista-notificaciones");
    if (!contenedor) return;
    if (!items.length) {
        contenedor.innerHTML = '<p class="sin-citas">No tienes notificaciones nuevas.</p>';
        actualizarBadgeNotificaciones(0);
        return;
    }
    contenedor.innerHTML = "";
    items.forEach(item => {
        const div = document.createElement("div");
        div.className = "item-notificacion";
        div.innerHTML = `
            <div class="icono-notif tipo-${item.tipo}"><i class="fa-solid ${item.icono}"></i></div>
            <div>
                <strong>${item.titulo}</strong>
                <small>${item.detalle}</small><br>
                <small>${item.cuando}</small>
            </div>
        `;
        contenedor.appendChild(div);
    });
    actualizarBadgeNotificaciones(items.length);
}

async function cargarNotificaciones() {
    if (!usuarioActualDatos) return;
    const tipo = usuarioActualDatos.tipo;

    try {
        if (tipo === "barberia" || tipo === "salon") {
            const notifs = await NotificacionesAPI.obtenerPorNegocio(usuarioActualAuth.uid);
            const items = notifs.map(n => ({
                tipo: "cita",
                icono: "fa-calendar-check",
                titulo: n.titulo || "Nueva cita agendada",
                detalle: n.detalle || "",
                cuando: n.creadoEn && n.creadoEn.toDate ? tiempoRelativo(n.creadoEn.toDate()) : ""
            }));
            renderizarNotificaciones(items);

        } else if (tipo === "administrador") {
            const snap = await db.collection("usuarios").where("estado", "==", "pendiente").limit(10).get();
            const items = snap.docs.map(doc => {
                const d = doc.data();
                return {
                    tipo: "alerta",
                    icono: "fa-clipboard-check",
                    titulo: "Nueva solicitud",
                    detalle: `${d.nombre} — ${ETIQUETAS_TIPO_CUENTA[d.tipo] || d.tipo}`,
                    cuando: d.fechaRegistro && d.fechaRegistro.toDate ? tiempoRelativo(d.fechaRegistro.toDate()) : ""
                };
            });
            renderizarNotificaciones(items);

        } else {
            if (!usuarioActualDatos.telefono) { renderizarNotificaciones([]); return; }

            // 1) Notificaciones explícitas generadas al crear/reprogramar/cancelar una cita
            const notifsDirectas = await NotificacionesAPI.obtenerPorTelefono(usuarioActualDatos.telefono, 10);
            const itemsDirectos = notifsDirectas.map(n => ({
                tipo: n.tipo === "alerta" ? "alerta" : "info",
                icono: n.tipo === "alerta" ? "fa-calendar-xmark" : "fa-bell",
                titulo: n.titulo || "Actualización de tu cita",
                detalle: n.detalle || "",
                cuando: n.creadoEn && n.creadoEn.toDate ? tiempoRelativo(n.creadoEn.toDate()) : ""
            }));

            // 2) Recordatorios de próximas citas (derivados, siempre útiles aunque no haya notif. explícita)
            const citas = await CitasAPI.obtenerPorTelefono(usuarioActualDatos.telefono);
            const ahoraISO = new Date().toISOString().split("T")[0];
            const itemsRecordatorio = citas
                .filter(c => c.fecha_hora && c.fecha_hora.split("T")[0] >= ahoraISO && c.estado !== "Cancelada")
                .sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora))
                .slice(0, 5)
                .map(c => ({
                    tipo: "info",
                    icono: "fa-bell",
                    titulo: "Recordatorio de cita",
                    detalle: `${c.servicio || "Servicio"} · ${c.estado || "Pendiente"}`,
                    cuando: c.fecha_hora ? c.fecha_hora.replace("T", " ").substring(0, 16) : ""
                }));

            renderizarNotificaciones([...itemsDirectos, ...itemsRecordatorio].slice(0, 10));
        }
    } catch (error) {
        console.error("Error al cargar notificaciones:", error);
    }
}

//==========================================================================
// ALERTAS DEL SISTEMA (banner global + módulo "Alertas")
//==========================================================================
async function cargarAlertaGlobal() {
    const banner = document.getElementById("banner-alerta");
    if (!banner) return;
    try {
        const activas = await AlertasAPI.obtenerActivas();
        if (!activas.length) {
            banner.classList.add("oculto");
            return;
        }
        const principal = activas[0];
        banner.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <strong>${principal.titulo}</strong> — ${principal.mensaje}`;
        banner.classList.remove("oculto");
    } catch (error) {
        console.error("Error al cargar alertas activas:", error);
    }
}

async function cargarListaAlertas() {
    const contenedor = document.getElementById("lista-alertas");
    if (!contenedor) return;
    contenedor.innerHTML = '<p class="sin-citas">Cargando...</p>';

    const esAdmin = usuarioActualDatos.tipo === "administrador";
    const wrapFormAdmin = document.getElementById("form-nueva-alerta-wrap");
    if (wrapFormAdmin) wrapFormAdmin.classList.toggle("oculto", !esAdmin);

    try {
        const alertas = esAdmin ? await AlertasAPI.obtenerTodas() : await AlertasAPI.obtenerActivas();
        if (!alertas.length) {
            contenedor.innerHTML = '<p class="sin-citas">No hay alertas registradas. Todo funciona con normalidad. ✅</p>';
            return;
        }
        contenedor.innerHTML = "";
        alertas.forEach(a => {
            const div = document.createElement("div");
            div.className = "item-solicitud";
            const fecha = a.creadoEn && a.creadoEn.toDate ? a.creadoEn.toDate().toLocaleString("es-DO") : "";
            div.innerHTML = `
                <div>
                    <strong>${a.titulo}</strong> ${a.activa ? '<span class="badge-estado badge-pendiente">Activa</span>' : '<span class="badge-estado badge-activo">Resuelta</span>'}<br>
                    <small>${a.mensaje}</small><br>
                    <small>${fecha}</small>
                </div>
                ${esAdmin ? `<div class="acciones-solicitud">
                    <button class="boton-bloquear">${a.activa ? "Marcar resuelta" : "Reactivar"}</button>
                    <button class="boton-rechazar boton-eliminar">Eliminar</button>
                </div>` : ""}
            `;
            if (esAdmin) {
                div.querySelector(".boton-bloquear").onclick = async () => {
                    await AlertasAPI.actualizar(a.id, { activa: !a.activa });
                    cargarListaAlertas();
                    cargarAlertaGlobal();
                };
                div.querySelector(".boton-eliminar").onclick = async () => {
                    await AlertasAPI.eliminar(a.id);
                    cargarListaAlertas();
                    cargarAlertaGlobal();
                };
            }
            contenedor.appendChild(div);
        });
    } catch (error) {
        console.error("Error al cargar alertas:", error);
        contenedor.innerHTML = '<p class="sin-citas">Ocurrió un error al cargar las alertas.</p>';
    }
}

function configurarModuloAlertas() {
    const form = document.getElementById("form-nueva-alerta");
    if (!form) return;
    form.onsubmit = async (e) => {
        e.preventDefault();
        const titulo = document.getElementById("alerta-titulo").value.trim();
        const mensaje = document.getElementById("alerta-mensaje").value.trim();
        if (!titulo || !mensaje) return;
        try {
            await AlertasAPI.crear({ titulo, mensaje, tipo: "alerta", activa: true });
            form.reset();
            cargarListaAlertas();
            cargarAlertaGlobal();
        } catch (error) {
            console.error("Error al crear la alerta:", error);
            alert("⚠️ No se pudo crear la alerta.");
        }
    };
}

//==========================================================================
// GRÁFICO DE INGRESOS DE LA SEMANA (a partir de las citas ya cargadas)
//==========================================================================
function cargarGraficoSemanal(idGrafico = "grafico-semanal", idTotal = "grafico-total-semana") {
    const contenedor = document.getElementById(idGrafico);
    const elTotal = document.getElementById(idTotal);
    if (!contenedor) return;

    const hoy = new Date();
    const dias = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(hoy);
        d.setDate(hoy.getDate() - i);
        dias.push(d.toISOString().split("T")[0]);
    }

    const totalesPorDia = {};
    dias.forEach(d => totalesPorDia[d] = 0);

    (todasLasCitasNegocio || []).filter(c => c.estado !== "Cancelada").forEach(c => {
        if (c.fecha_hora) {
            const fecha = c.fecha_hora.split("T")[0];
            if (totalesPorDia.hasOwnProperty(fecha)) {
                totalesPorDia[fecha] += parseFloat(c.precio || 0);
            }
        }
    });

    const valores = dias.map(d => totalesPorDia[d]);
    const totalSemana = valores.reduce((a, b) => a + b, 0);
    if (elTotal) elTotal.innerText = `RD$ ${totalSemana.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    dibujarGraficoLineal(contenedor, dias, valores);
}

function dibujarGraficoLineal(contenedor, dias, valores) {
    const ancho = 560, alto = 200, margen = 24;
    const maxValor = Math.max(...valores, 1);
    const etiquetasDia = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

    const puntos = valores.map((v, i) => {
        const x = margen + (i * (ancho - margen * 2) / (valores.length - 1));
        const y = alto - margen - (v / maxValor) * (alto - margen * 2);
        return { x, y };
    });

    const lineaPath = puntos.map((p, i) => (i === 0 ? "M" : "L") + p.x + "," + p.y).join(" ");
    const areaPath = lineaPath + ` L${puntos[puntos.length - 1].x},${alto - margen} L${puntos[0].x},${alto - margen} Z`;

    const circulos = puntos.map(p => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="var(--color-principal)" stroke="#fff" stroke-width="2"></circle>`).join("");
    const etiquetas = puntos.map((p, i) => {
        const fecha = new Date(dias[i] + "T12:00:00");
        return `<text x="${p.x}" y="${alto - 4}" font-size="11" fill="var(--color-texto-suave)" text-anchor="middle">${etiquetasDia[fecha.getDay()]}</text>`;
    }).join("");

    contenedor.innerHTML = `
        <svg viewBox="0 0 ${ancho} ${alto}" preserveAspectRatio="none">
            <defs>
                <linearGradient id="gradienteArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--color-principal)" stop-opacity="0.25"></stop>
                    <stop offset="100%" stop-color="var(--color-principal)" stop-opacity="0"></stop>
                </linearGradient>
            </defs>
            <path d="${areaPath}" fill="url(#gradienteArea)"></path>
            <path d="${lineaPath}" fill="none" stroke="var(--color-principal)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>
            ${circulos}
            ${etiquetas}
        </svg>
    `;
}

//==========================================================================
// CLIENTES DEL NEGOCIO (a partir de las citas ya cargadas por app.js)
//==========================================================================
function cargarClientesDelNegocio() {
    const clientesMap = {};
    (todasLasCitasNegocio || []).filter(c => c.estado !== "Cancelada").forEach(c => {
        const clave = c.telefono_cliente || c.nombre_cliente || c.id;
        if (!clientesMap[clave]) {
            clientesMap[clave] = { nombre: c.nombre_cliente || "Cliente", telefono: c.telefono_cliente || "—", visitas: 0, ultimaFecha: "" };
        }
        clientesMap[clave].visitas++;
        if (c.fecha_hora && c.fecha_hora > clientesMap[clave].ultimaFecha) clientesMap[clave].ultimaFecha = c.fecha_hora;
    });

    const listaClientes = Object.values(clientesMap).sort((a, b) => b.visitas - a.visitas);
    renderizarTablaClientes(listaClientes);

    const inputBuscar = document.getElementById("input-buscar-cliente");
    if (inputBuscar) {
        inputBuscar.oninput = () => {
            const texto = inputBuscar.value.toLowerCase();
            renderizarTablaClientes(listaClientes.filter(c => c.nombre.toLowerCase().includes(texto)));
        };
    }
}

function renderizarTablaClientes(lista) {
    const wrap = document.getElementById("tabla-clientes-wrap");
    if (!wrap) return;
    if (!lista.length) {
        wrap.innerHTML = '<p class="sin-citas">Aún no tienes clientes registrados en tus citas.</p>';
        return;
    }
    const filas = lista.map(c => `
        <tr><td>${c.nombre}</td><td>${c.telefono}</td><td>${c.visitas}</td><td>${c.ultimaFecha ? c.ultimaFecha.split("T")[0] : "—"}</td></tr>
    `).join("");
    wrap.innerHTML = `<table class="tabla-clientes"><thead><tr><th>Nombre</th><th>Teléfono</th><th>Visitas</th><th>Última cita</th></tr></thead><tbody>${filas}</tbody></table>`;
}

//==========================================================================
// REPORTES: SERVICIOS MÁS SOLICITADOS
//==========================================================================
function cargarRankingServicios() {
    const contenedor = document.getElementById("ranking-servicios");
    if (!contenedor) return;

    const conteo = {};
    (todasLasCitasNegocio || []).filter(c => c.estado !== "Cancelada").forEach(c => {
        const servicio = c.servicio || "Otro";
        conteo[servicio] = (conteo[servicio] || 0) + 1;
    });

    const items = Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, 6);
    if (!items.length) {
        contenedor.innerHTML = '<p class="sin-citas">Aún no hay citas registradas para generar un ranking.</p>';
        return;
    }
    const maximo = items[0][1];
    contenedor.innerHTML = "";
    items.forEach(([nombre, cantidad]) => {
        const porcentaje = Math.round((cantidad / maximo) * 100);
        const fila = document.createElement("div");
        fila.className = "fila-ranking";
        fila.innerHTML = `<span>${nombre}</span><div class="barra-ranking"><span style="width:${porcentaje}%"></span></div><strong>${cantidad}</strong>`;
        contenedor.appendChild(fila);
    });
}

//==========================================================================
// MÓDULO MANTENIMIENTO (administrador)
//==========================================================================
async function cargarModuloMantenimiento() {
    if (!usuarioActualDatos) return;

    const esCliente = usuarioActualDatos.tipo === "cliente";
    const esNegocio = usuarioActualDatos.tipo === "barberia" || usuarioActualDatos.tipo === "salon";
    const esAdmin = usuarioActualDatos.tipo === "administrador";

    const vistaCliente = document.getElementById("mantenimiento-cliente");
    const vistaNegocio = document.getElementById("mantenimiento-negocio");
    const vistaAdmin = document.getElementById("mantenimiento-admin");
    if (vistaCliente) vistaCliente.classList.toggle("oculto", !esCliente);
    if (vistaNegocio) vistaNegocio.classList.toggle("oculto", !esNegocio);
    if (vistaAdmin) vistaAdmin.classList.toggle("oculto", !esAdmin);

    if (esCliente) { await cargarMantenimientoCliente(); return; }
    if (esNegocio) { cargarMantenimientoNegocio(); return; }
    if (!esAdmin) return;

    const wrap = document.getElementById("tabla-usuarios-monitoreados");
    if (wrap) {
        wrap.innerHTML = '<p class="sin-citas">Cargando...</p>';
        try {
            const usuarios = await UsuariosAPI.obtenerTodos();
            const grupos = { cliente: 0, barberia: 0, salon: 0 };
            const activos = { cliente: 0, barberia: 0, salon: 0 };
            usuarios.forEach(u => {
                if (grupos.hasOwnProperty(u.tipo)) {
                    grupos[u.tipo]++;
                    if (u.estado !== "bloqueado") activos[u.tipo]++;
                }
            });
            const filas = Object.keys(grupos).map(tipo => `
                <tr>
                    <td>${ETIQUETAS_TIPO_CUENTA[tipo] || tipo}</td>
                    <td>${grupos[tipo]}</td>
                    <td><span class="badge-estado badge-activo">${activos[tipo]} activos</span></td>
                </tr>
            `).join("");
            wrap.innerHTML = `<table class="tabla-clientes"><thead><tr><th>Categoría / Zona</th><th>Cuentas registradas</th><th>Estado</th></tr></thead><tbody>${filas}</tbody></table>`;
        } catch (error) {
            console.error("Error al cargar usuarios monitoreados:", error);
            wrap.innerHTML = '<p class="sin-citas">Ocurrió un error al cargar los datos.</p>';
        }
    }

    try {
        const config = await ConfigSistemaAPI.obtener();
        const inputUmbral = document.getElementById("config-umbral-alertas");
        const selectEstado = document.getElementById("config-estado-sistema");
        const inputMensaje = document.getElementById("config-mensaje-mantenimiento");
        if (inputUmbral) inputUmbral.value = config.umbralAlertas ?? 3;
        if (selectEstado) selectEstado.value = config.enMantenimiento ? "mantenimiento" : "operativo";
        if (inputMensaje) inputMensaje.value = config.mensajeMantenimiento || "";
    } catch (error) {
        console.error("Error al cargar la configuración del sistema:", error);
    }
}

/** Mantenimiento para Cliente: estado de la cuenta, contadores y limpieza de sus propios datos. */
async function cargarMantenimientoCliente() {
    const d = usuarioActualDatos;

    const elEstado = document.getElementById("mant-cliente-estado");
    const elCorreo = document.getElementById("mant-cliente-correo");
    const elTelefono = document.getElementById("mant-cliente-telefono");
    const elFecha = document.getElementById("mant-cliente-fecha");
    if (elEstado) elEstado.innerHTML = d.estado === "bloqueado"
        ? '<span class="badge-estado badge-bloqueado">Bloqueada</span>'
        : '<span class="badge-estado badge-activo">Activa</span>';
    if (elCorreo) elCorreo.innerText = d.correo || usuarioActualAuth.email;
    if (elTelefono) elTelefono.innerText = d.telefono || "—";
    if (elFecha) elFecha.innerText = d.fechaRegistro && d.fechaRegistro.toDate ? d.fechaRegistro.toDate().toLocaleDateString("es-DO") : "—";

    const elFavoritos = document.getElementById("mant-total-favoritos");
    if (elFavoritos) elFavoritos.innerText = (d.favoritos || []).length;

    const elCitas = document.getElementById("mant-total-citas-cliente");
    if (elCitas) {
        try {
            const citas = d.telefono ? await CitasAPI.obtenerPorTelefono(d.telefono) : [];
            elCitas.innerText = citas.length;
        } catch (error) {
            console.error("Error al contar las citas del cliente:", error);
        }
    }
}

/** Mantenimiento para Barbería / Salón: estado de la cuenta, contadores y limpieza acotada a su propio negocio. */
function cargarMantenimientoNegocio() {
    const d = usuarioActualDatos;
    const negocio = d.negocio || {};

    const elEstado = document.getElementById("mant-negocio-estado");
    const elNombre = document.getElementById("mant-negocio-nombre");
    const elFecha = document.getElementById("mant-negocio-fecha");
    if (elEstado) elEstado.innerHTML = d.estado === "bloqueado"
        ? '<span class="badge-estado badge-bloqueado">Bloqueada</span>'
        : '<span class="badge-estado badge-activo">Activa</span>';
    if (elNombre) elNombre.innerText = negocio.nombre || "—";
    if (elFecha) elFecha.innerText = d.fechaRegistro && d.fechaRegistro.toDate ? d.fechaRegistro.toDate().toLocaleDateString("es-DO") : "—";

    const elPersonal = document.getElementById("mant-total-personal");
    const elServicios = document.getElementById("mant-total-servicios");
    const elCitas = document.getElementById("mant-total-citas-negocio");
    if (elPersonal) elPersonal.innerText = (negocio.personal || []).length;
    if (elServicios) elServicios.innerText = (negocio.servicios || []).length;
    if (elCitas) elCitas.innerText = (todasLasCitasNegocio || []).length;
}

function configurarModuloMantenimiento() {
    const btnVaciarFavoritos = document.getElementById("btnVaciarFavoritos");
    if (btnVaciarFavoritos) {
        btnVaciarFavoritos.onclick = async () => {
            if (!confirm("¿Vaciar tu lista de negocios favoritos?")) return;
            try {
                await db.collection("usuarios").doc(usuarioActualAuth.uid).update({ favoritos: [] });
                usuarioActualDatos.favoritos = [];
                alert("✅ Tu lista de favoritos fue vaciada.");
                cargarMantenimientoCliente();
                if (typeof cargarResumenCliente === "function") cargarResumenCliente();
                if (typeof cargarFavoritos === "function") cargarFavoritos();
            } catch (error) {
                console.error("Error al vaciar favoritos:", error);
                alert("⚠️ No se pudo vaciar tu lista de favoritos.");
            }
        };
    }

    const btnLimpiarMisNotificaciones = document.getElementById("btnLimpiarMisNotificaciones");
    if (btnLimpiarMisNotificaciones) {
        btnLimpiarMisNotificaciones.onclick = async () => {
            if (!confirm("¿Eliminar todas tus notificaciones? Tus citas no se verán afectadas.")) return;
            try {
                await NotificacionesAPI.eliminarPorTelefono(usuarioActualDatos.telefono);
                alert("✅ Tus notificaciones fueron eliminadas.");
                cargarNotificaciones();
            } catch (error) {
                console.error("Error al limpiar tus notificaciones:", error);
                alert("⚠️ No se pudo completar la limpieza.");
            }
        };
    }

    const btnLimpiarNegocio = document.getElementById("btnLimpiarMiNegocio");
    if (btnLimpiarNegocio) {
        btnLimpiarNegocio.onclick = async () => {
            const confirmacion = prompt('Esta acción eliminará TODAS las citas y notificaciones de TU negocio (no afecta a tu Personal ni tus Servicios). Escribe "ELIMINAR" para confirmar:');
            if (confirmacion !== "ELIMINAR") return;
            try {
                await UsuariosAPI.limpiarCitasYNotificacionesDeNegocio(usuarioActualAuth.uid);
                alert("✅ Tus citas y notificaciones fueron eliminadas.");
                await cargarTodasCitasNegocio();
                cargarMantenimientoNegocio();
            } catch (error) {
                console.error("Error al limpiar los datos del negocio:", error);
                alert("⚠️ No se pudo completar la limpieza.");
            }
        };
    }

    const formConfig = document.getElementById("form-config-sistema");
    if (formConfig) {
        formConfig.onsubmit = async (e) => {
            e.preventDefault();
            const umbralAlertas = parseInt(document.getElementById("config-umbral-alertas").value, 10) || 3;
            const enMantenimiento = document.getElementById("config-estado-sistema").value === "mantenimiento";
            const mensajeMantenimiento = document.getElementById("config-mensaje-mantenimiento").value.trim();
            try {
                await ConfigSistemaAPI.guardar({ umbralAlertas, enMantenimiento, mensajeMantenimiento });
                await AlertasAPI.establecerMantenimiento(enMantenimiento, mensajeMantenimiento);
                cargarAlertaGlobal();
                alert("✅ Configuración del sistema guardada.");
            } catch (error) {
                console.error("Error al guardar la configuración:", error);
                alert("⚠️ No se pudo guardar la configuración.");
            }
        };
    }

    const btnLimpiar = document.getElementById("btnLimpiarBaseDatos");
    if (btnLimpiar) {
        btnLimpiar.onclick = async () => {
            const confirmacion = prompt('Esta acción eliminará TODAS las citas y notificaciones del sistema (no afecta a los usuarios). Escribe "ELIMINAR" para confirmar:');
            if (confirmacion !== "ELIMINAR") return;
            try {
                await UsuariosAPI.limpiarCitasYNotificaciones();
                alert("✅ Las citas y notificaciones fueron eliminadas.");
            } catch (error) {
                console.error("Error al limpiar la base de datos:", error);
                alert("⚠️ No se pudo completar la limpieza.");
            }
        };
    }
}

//==========================================================================
// PERFIL DE USUARIO
//==========================================================================
function renderizarPerfil() {
    const d = usuarioActualDatos;
    const inicial = (d.nombre || "?").charAt(0).toUpperCase();

    document.getElementById("avatar-perfil").innerText = inicial;
    document.getElementById("perfil-nombre").innerText = d.nombre || "—";
    document.getElementById("perfil-correo").innerText = d.correo || usuarioActualAuth.email;
    document.getElementById("perfil-tipo").innerText = ETIQUETAS_TIPO_CUENTA[d.tipo] || d.tipo;

    document.getElementById("detalle-correo").innerText = d.correo || usuarioActualAuth.email;
    document.getElementById("detalle-telefono").innerText = d.telefono || "—";
    document.getElementById("detalle-tipo").innerText = ETIQUETAS_TIPO_CUENTA[d.tipo] || d.tipo;

    let fechaTexto = "—";
    if (d.fechaRegistro && d.fechaRegistro.toDate) fechaTexto = d.fechaRegistro.toDate().toLocaleDateString("es-DO");
    document.getElementById("detalle-fecha").innerText = fechaTexto;

    const wrapNegocio = document.getElementById("detalle-negocio-wrap");
    if (d.negocio && d.negocio.nombre) {
        wrapNegocio.classList.remove("oculto");
        document.getElementById("detalle-negocio").innerText = d.negocio.nombre;
    } else {
        wrapNegocio.classList.add("oculto");
    }

    document.getElementById("editar-nombre").value = d.nombre || "";
    document.getElementById("editar-telefono").value = d.telefono || "";
}

function configurarFormularioPerfil() {
    const form = document.getElementById("form-perfil");
    if (!form) return;
    form.onsubmit = async (e) => {
        e.preventDefault();
        const nuevoNombre = document.getElementById("editar-nombre").value.trim();
        const nuevoTelefono = document.getElementById("editar-telefono").value.trim();
        try {
            await db.collection("usuarios").doc(usuarioActualAuth.uid).update({ nombre: nuevoNombre, telefono: nuevoTelefono });
            usuarioActualDatos.nombre = nuevoNombre;
            usuarioActualDatos.telefono = nuevoTelefono;
            document.getElementById("nombre-usuario").innerText = nuevoNombre;
            document.getElementById("avatar-usuario").innerText = nuevoNombre.charAt(0).toUpperCase();
            document.getElementById("saludo-usuario").innerText = `¡Hola, ${nuevoNombre.split(" ")[0]}! 👋`;
            renderizarPerfil();
            alert("✅ Perfil actualizado correctamente.");
        } catch (error) {
            console.error("Error al actualizar el perfil:", error);
            alert("⚠️ No se pudo actualizar el perfil.");
        }
    };
}

//==========================================================================
// NEGOCIO (Barbería / Salón): datos generales
//==========================================================================
function cargarDatosNegocioEnFormulario() {
    const n = usuarioActualDatos.negocio || {};
    document.getElementById("negocio-nombre").value = n.nombre || "";
    document.getElementById("negocio-direccion").value = n.direccion || "";
    document.getElementById("negocio-horario").value = n.horario || "";
    cargarModuloPersonal();
    cargarModuloServicios();
}

function configurarFormularioNegocio() {
    const form = document.getElementById("form-negocio");
    if (!form) return;
    form.onsubmit = async (e) => {
        e.preventDefault();
        const nombre = document.getElementById("negocio-nombre").value.trim();
        const direccion = document.getElementById("negocio-direccion").value.trim();
        const horario = document.getElementById("negocio-horario").value.trim();
        try {
            const nuevoNegocio = { ...(usuarioActualDatos.negocio || {}), nombre, direccion, horario };
            await db.collection("usuarios").doc(usuarioActualAuth.uid).update({ negocio: nuevoNegocio });
            usuarioActualDatos.negocio = nuevoNegocio;
            alert("✅ Información del negocio guardada.");
        } catch (error) {
            console.error("Error al guardar el negocio:", error);
            alert("⚠️ No se pudo guardar la información del negocio.");
        }
    };
}

//==========================================================================
// MÓDULO: PERSONAL (barbería / salón)
// Campos: nombre, teléfono, correo, sexo, tipo de negocio, tipo de personal,
// especialidad, horario, días laborables, estado, foto, observaciones.
//==========================================================================
function cargarModuloPersonal() {
    const negocio = usuarioActualDatos.negocio || {};
    renderizarGridPersonal(negocio.personal || []);

    const inputBuscar = document.getElementById("input-buscar-personal");
    if (inputBuscar) {
        inputBuscar.oninput = () => {
            const texto = inputBuscar.value.toLowerCase();
            const lista = (usuarioActualDatos.negocio.personal || []).filter(p =>
                (p.nombre || "").toLowerCase().includes(texto) ||
                (p.especialidad || "").toLowerCase().includes(texto) ||
                (p.tipoPersonal || "").toLowerCase().includes(texto)
            );
            renderizarGridPersonal(lista);
        };
    }
}

function renderizarGridPersonal(lista) {
    const contenedor = document.getElementById("grid-personal");
    if (!contenedor) return;
    if (!lista.length) {
        contenedor.innerHTML = '<p class="sin-citas">Aún no has agregado profesionales. Usa "Agregar Personal" para comenzar.</p>';
        return;
    }
    contenedor.innerHTML = "";
    lista.forEach(p => {
        const activo = (p.estado || "activo") === "activo";
        const card = document.createElement("div");
        card.className = "tarjeta-negocio tarjeta-empleado";
        card.innerHTML = `
            <div class="cabecera-empleado">
                ${p.foto ? `<img class="foto-empleado" src="${p.foto}" alt="${p.nombre}">` : `<div class="avatar">${(p.nombre || "?").charAt(0).toUpperCase()}</div>`}
                <div>
                    <h4>${p.nombre || "Sin nombre"}</h4>
                    <small>${p.tipoPersonal || "—"}</small>
                </div>
            </div>
            <p><i class="fa-solid fa-tag"></i> ${ETIQUETAS_TIPO_NEGOCIO_PERSONAL[p.tipoNegocio] || p.tipoNegocio || "—"}</p>
            <p><i class="fa-solid fa-star"></i> ${p.especialidad || "Sin especialidad registrada"}</p>
            <p><i class="fa-solid fa-clock"></i> ${p.horarioInicio && p.horarioFin ? `${formatoAMPM(p.horarioInicio)} - ${formatoAMPM(p.horarioFin)}` : "Horario no definido"}</p>
            <p><i class="fa-solid fa-calendar-week"></i> ${(p.diasLaborables || []).join(", ") || "Sin días asignados"}</p>
            <span class="badge-estado ${activo ? "badge-activo" : "badge-bloqueado"}">${activo ? "Activo" : "Inactivo"}</span>
            <div class="acciones-solicitud" style="margin-top:12px">
                <button class="boton-bloquear boton-ver-empleado">Ver</button>
                <button class="boton-bloquear boton-editar-empleado">Editar</button>
                <button class="boton-rechazar boton-eliminar boton-eliminar-empleado">Eliminar</button>
            </div>
        `;
        card.querySelector(".boton-ver-empleado").onclick = () => verDetallePersonal(p);
        card.querySelector(".boton-editar-empleado").onclick = () => abrirModalPersonal(p);
        card.querySelector(".boton-eliminar-empleado").onclick = () => eliminarPersonal(p.id, p.nombre);
        contenedor.appendChild(card);
    });
}

function verDetallePersonal(p) {
    const negocio = usuarioActualDatos.negocio || {};
    const citasAtendidas = (todasLasCitasNegocio || []).filter(c => c.personalId === p.id && c.estado !== "Cancelada").length;
    const serviciosDelEmpleado = (negocio.servicios || []).filter(s => (s.personalIds || []).includes(p.id));
    const activo = (p.estado || "activo") === "activo";

    const avatarHtml = p.foto
        ? `<img class="avatar-grande-perfil" src="${p.foto}" alt="${p.nombre || ''}">`
        : `<div class="avatar avatar-grande-perfil">${(p.nombre || "?").charAt(0).toUpperCase()}</div>`;

    document.getElementById("contenido-perfil-personal").innerHTML = `
        <div class="perfil-cabecera-info">
            ${avatarHtml}
            <div>
                <h2>${p.nombre || "Sin nombre"}</h2>
                <p class="perfil-subtexto">${p.telefono || "—"} · ${p.correo || "—"}</p>
            </div>
        </div>

        <div class="grid-stats-perfil">
            <div class="caja-stat-perfil"><strong>${citasAtendidas}</strong><span>Citas Atendidas</span></div>
            <div class="caja-stat-perfil"><strong>${serviciosDelEmpleado.length}</strong><span>Servicios Asignados</span></div>
            <div class="caja-stat-perfil"><strong>${(p.diasLaborables || []).length}</strong><span>Días Laborables</span></div>
            <div class="caja-stat-perfil"><strong>${activo ? "Activo" : "Inactivo"}</strong><span>Estado</span></div>
        </div>

        <h4 class="perfil-seccion-titulo">Información personal</h4>
        <p><strong>Sexo:</strong> ${p.sexo || "—"}</p>
        <p><strong>Tipo de negocio:</strong> ${ETIQUETAS_TIPO_NEGOCIO_PERSONAL[p.tipoNegocio] || p.tipoNegocio || "—"}</p>
        <p><strong>Tipo de personal:</strong> ${p.tipoPersonal || "—"}</p>
        <p><strong>Especialidad:</strong> ${p.especialidad || "—"}</p>
        <p><strong>Horario:</strong> ${p.horarioInicio && p.horarioFin ? `${formatoAMPM(p.horarioInicio)} - ${formatoAMPM(p.horarioFin)}` : "—"}</p>
        <p><strong>Días laborables:</strong> ${(p.diasLaborables || []).join(", ") || "—"}</p>
        <p><strong>Observaciones:</strong> ${p.observaciones || "—"}</p>

        <h4 class="perfil-seccion-titulo">Servicios que puede realizar</h4>
        ${serviciosDelEmpleado.length
            ? `<ul class="lista-servicios-perfil">${serviciosDelEmpleado.map(s => `<li>💇 ${s.nombre} — RD$${s.precio || 0} (${s.duracion || 30} min)</li>`).join("")}</ul>`
            : '<p class="sin-citas">Sin servicios asignados todavía.</p>'}
    `;

    document.getElementById("modal-ver-personal").classList.add("modal-visible");
}

function poblarTipoPersonalSegunNegocio(tipoNegocio, seleccionActual) {
    const selectTipoPersonal = document.getElementById("personal-tipo-personal");
    if (!selectTipoPersonal) return;
    const opciones = TIPOS_PERSONAL_POR_NEGOCIO[tipoNegocio] || [];
    selectTipoPersonal.innerHTML = opciones.map(op => `<option value="${op}" ${op === seleccionActual ? "selected" : ""}>${op}</option>`).join("");
}

function poblarDiasLaborables(diasSeleccionados) {
    const contenedor = document.getElementById("personal-dias-laborables");
    if (!contenedor) return;
    const dias = diasSeleccionados || [];
    contenedor.innerHTML = DIAS_SEMANA.map(dia => `
        <label class="chip-checkbox">
            <input type="checkbox" value="${dia}" ${dias.includes(dia) ? "checked" : ""}> ${dia}
        </label>
    `).join("");
}

function abrirModalPersonal(empleado) {
    personalEnEdicionId = empleado ? empleado.id : null;
    fotoPersonalBase64Actual = empleado ? (empleado.foto || null) : null;

    document.getElementById("form-personal").reset();
    document.getElementById("titulo-modal-personal").innerText = empleado ? "✏️ Editar Personal" : "➕ Agregar Personal";

    const tipoNegocioInicial = (empleado && empleado.tipoNegocio) || "barberia";
    document.getElementById("personal-nombre").value = empleado ? (empleado.nombre || "") : "";
    document.getElementById("personal-telefono").value = empleado ? (empleado.telefono || "") : "";
    document.getElementById("personal-correo").value = empleado ? (empleado.correo || "") : "";
    document.getElementById("personal-sexo").value = empleado ? (empleado.sexo || "") : "";
    document.getElementById("personal-tipo-negocio").value = tipoNegocioInicial;
    poblarTipoPersonalSegunNegocio(tipoNegocioInicial, empleado ? empleado.tipoPersonal : null);
    document.getElementById("personal-especialidad").value = empleado ? (empleado.especialidad || "") : "";
    document.getElementById("personal-horario-inicio").value = empleado ? (empleado.horarioInicio || "") : "";
    document.getElementById("personal-horario-fin").value = empleado ? (empleado.horarioFin || "") : "";
    poblarDiasLaborables(empleado ? empleado.diasLaborables : []);
    document.getElementById("personal-estado").value = empleado ? (empleado.estado || "activo") : "activo";
    document.getElementById("personal-observaciones").value = empleado ? (empleado.observaciones || "") : "";

    const previewFoto = document.getElementById("personal-foto-preview");
    previewFoto.src = fotoPersonalBase64Actual || "";
    previewFoto.classList.toggle("oculto", !fotoPersonalBase64Actual);

    document.getElementById("modal-personal").classList.add("modal-visible");
}

/** Redimensiona y comprime una imagen en el navegador antes de guardarla como Base64 en Firestore. */
function procesarFotoABase64(archivo) {
    return new Promise((resolve, reject) => {
        if (!archivo) { resolve(null); return; }
        const lector = new FileReader();
        lector.onerror = () => reject(new Error("No se pudo leer la imagen."));
        lector.onload = () => {
            const img = new Image();
            img.onload = () => {
                const maxAncho = 300;
                const escala = Math.min(1, maxAncho / img.width);
                const canvas = document.createElement("canvas");
                canvas.width = img.width * escala;
                canvas.height = img.height * escala;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL("image/jpeg", 0.7));
            };
            img.onerror = () => reject(new Error("El archivo no es una imagen válida."));
            img.src = lector.result;
        };
        lector.readAsDataURL(archivo);
    });
}

function configurarModuloPersonal() {
    const btnAbrirNuevo = document.getElementById("btnAgregarPersonal");
    if (btnAbrirNuevo) btnAbrirNuevo.onclick = () => abrirModalPersonal(null);

    const btnCerrar = document.getElementById("cerrar-modal-personal");
    if (btnCerrar) btnCerrar.onclick = () => document.getElementById("modal-personal").classList.remove("modal-visible");

    const btnCerrarVer = document.getElementById("cerrar-modal-ver-personal");
    if (btnCerrarVer) btnCerrarVer.onclick = () => document.getElementById("modal-ver-personal").classList.remove("modal-visible");

    const selectTipoNegocio = document.getElementById("personal-tipo-negocio");
    if (selectTipoNegocio) selectTipoNegocio.onchange = () => poblarTipoPersonalSegunNegocio(selectTipoNegocio.value, null);

    const inputFoto = document.getElementById("personal-foto");
    if (inputFoto) {
        inputFoto.onchange = async () => {
            const archivo = inputFoto.files[0];
            if (!archivo) return;
            try {
                fotoPersonalBase64Actual = await procesarFotoABase64(archivo);
                const previewFoto = document.getElementById("personal-foto-preview");
                previewFoto.src = fotoPersonalBase64Actual;
                previewFoto.classList.remove("oculto");
            } catch (error) {
                console.error("Error al procesar la foto:", error);
                alert("⚠️ No se pudo procesar la imagen seleccionada.");
            }
        };
    }

    const form = document.getElementById("form-personal");
    if (!form) return;
    form.onsubmit = async (e) => {
        e.preventDefault();
        const diasSeleccionados = Array.from(document.querySelectorAll("#personal-dias-laborables input:checked")).map(chk => chk.value);

        const datosEmpleado = {
            nombre: document.getElementById("personal-nombre").value.trim(),
            telefono: document.getElementById("personal-telefono").value.trim(),
            correo: document.getElementById("personal-correo").value.trim(),
            sexo: document.getElementById("personal-sexo").value,
            tipoNegocio: document.getElementById("personal-tipo-negocio").value,
            tipoPersonal: document.getElementById("personal-tipo-personal").value,
            especialidad: document.getElementById("personal-especialidad").value.trim(),
            horarioInicio: document.getElementById("personal-horario-inicio").value,
            horarioFin: document.getElementById("personal-horario-fin").value,
            diasLaborables: diasSeleccionados,
            estado: document.getElementById("personal-estado").value,
            foto: fotoPersonalBase64Actual,
            observaciones: document.getElementById("personal-observaciones").value.trim()
        };

        if (!datosEmpleado.nombre) { alert("⚠️ El nombre es obligatorio."); return; }

        try {
            if (personalEnEdicionId) {
                await PersonalAPI.actualizar(usuarioActualAuth.uid, personalEnEdicionId, datosEmpleado);
                usuarioActualDatos.negocio.personal = (usuarioActualDatos.negocio.personal || []).map(p => p.id === personalEnEdicionId ? { ...p, ...datosEmpleado } : p);
            } else {
                const nuevo = await PersonalAPI.agregar(usuarioActualAuth.uid, datosEmpleado);
                usuarioActualDatos.negocio.personal = [...(usuarioActualDatos.negocio.personal || []), nuevo];
            }
            document.getElementById("modal-personal").classList.remove("modal-visible");
            personalEnEdicionId = null;
            fotoPersonalBase64Actual = null;
            cargarModuloPersonal();
            alert("✅ Personal guardado correctamente.");
        } catch (error) {
            console.error("Error al guardar el personal:", error);
            alert("⚠️ No se pudo guardar el personal.");
        }
    };
}

async function eliminarPersonal(id, nombre) {
    if (!confirm(`¿Eliminar a ${nombre || "este profesional"} de tu equipo?`)) return;
    try {
        await PersonalAPI.eliminar(usuarioActualAuth.uid, id);
        usuarioActualDatos.negocio.personal = (usuarioActualDatos.negocio.personal || []).filter(p => p.id !== id);
        cargarModuloPersonal();
    } catch (error) {
        console.error("Error al eliminar el personal:", error);
        alert("⚠️ No se pudo eliminar el personal.");
    }
}

//==========================================================================
// MÓDULO: SERVICIOS
// Campos: nombre, categoría, precio, duración, descripción, personal que
// puede realizarlo, estado (disponible / no disponible).
//==========================================================================
function cargarModuloServicios() {
    const negocio = usuarioActualDatos.negocio || {};
    renderizarGridServicios(negocio.servicios || []);

    const inputBuscar = document.getElementById("input-buscar-servicio");
    if (inputBuscar) {
        inputBuscar.oninput = () => {
            const texto = inputBuscar.value.toLowerCase();
            const lista = (usuarioActualDatos.negocio.servicios || []).filter(s =>
                (s.nombre || "").toLowerCase().includes(texto) ||
                (s.categoria || "").toLowerCase().includes(texto)
            );
            renderizarGridServicios(lista);
        };
    }
}

function renderizarGridServicios(lista) {
    const contenedor = document.getElementById("grid-servicios");
    if (!contenedor) return;
    if (!lista.length) {
        contenedor.innerHTML = '<p class="sin-citas">Aún no has agregado servicios. Usa "Agregar Servicio" para comenzar.</p>';
        return;
    }
    const negocio = usuarioActualDatos.negocio || {};
    const personal = negocio.personal || [];
    contenedor.innerHTML = "";
    lista.forEach(s => {
        const disponible = (s.estado || "disponible") !== "no_disponible";
        const nombresPersonal = (s.personalIds || []).map(id => (personal.find(p => p.id === id) || {}).nombre).filter(Boolean);
        const card = document.createElement("div");
        card.className = "tarjeta-negocio";
        card.innerHTML = `
            <h4>💇 ${s.nombre || "Servicio"}</h4>
            <p><i class="fa-solid fa-tags"></i> ${s.categoria || "Sin categoría"}</p>
            <p><i class="fa-solid fa-sack-dollar"></i> RD$${s.precio || 0} · <i class="fa-solid fa-clock"></i> ${s.duracion || 30} min</p>
            <p><i class="fa-solid fa-align-left"></i> ${s.descripcion || "Sin descripción"}</p>
            <p><i class="fa-solid fa-user-group"></i> ${nombresPersonal.length ? nombresPersonal.join(", ") : "Sin personal asignado"}</p>
            <span class="badge-estado ${disponible ? "badge-activo" : "badge-bloqueado"}">${disponible ? "Disponible" : "No disponible"}</span>
            <div class="acciones-solicitud" style="margin-top:12px">
                <button class="boton-bloquear boton-editar-servicio">Editar</button>
                <button class="boton-rechazar boton-eliminar boton-eliminar-servicio">Eliminar</button>
            </div>
        `;
        card.querySelector(".boton-editar-servicio").onclick = () => abrirModalServicio(s);
        card.querySelector(".boton-eliminar-servicio").onclick = () => eliminarServicio(s.id, s.nombre);
        contenedor.appendChild(card);
    });
}

function poblarPersonalDelServicio(personalIdsSeleccionados) {
    const contenedor = document.getElementById("servicio-personal-lista");
    if (!contenedor) return;
    const personal = (usuarioActualDatos.negocio && usuarioActualDatos.negocio.personal) || [];
    const seleccionados = personalIdsSeleccionados || [];
    if (!personal.length) {
        contenedor.innerHTML = '<p class="sin-citas">Agrega personal primero en el módulo "Personal".</p>';
        return;
    }
    contenedor.innerHTML = personal.map(p => `
        <label class="chip-checkbox">
            <input type="checkbox" value="${p.id}" ${seleccionados.includes(p.id) ? "checked" : ""}> ${p.nombre} <small>(${p.tipoPersonal || "—"})</small>
        </label>
    `).join("");
}

function abrirModalServicio(servicio) {
    servicioEnEdicionId = servicio ? servicio.id : null;
    document.getElementById("form-servicio").reset();
    document.getElementById("titulo-modal-servicio").innerText = servicio ? "✏️ Editar Servicio" : "➕ Agregar Servicio";

    document.getElementById("servicio-nombre").value = servicio ? (servicio.nombre || "") : "";
    document.getElementById("servicio-categoria").value = servicio ? (servicio.categoria || "") : "";
    document.getElementById("servicio-precio").value = servicio ? (servicio.precio || "") : "";
    document.getElementById("servicio-duracion").value = servicio ? (servicio.duracion || 30) : 30;
    document.getElementById("servicio-descripcion").value = servicio ? (servicio.descripcion || "") : "";
    document.getElementById("servicio-estado").value = servicio ? (servicio.estado || "disponible") : "disponible";
    poblarPersonalDelServicio(servicio ? servicio.personalIds : []);

    document.getElementById("modal-servicio").classList.add("modal-visible");
}

function configurarModuloServicios() {
    const btnAbrirNuevo = document.getElementById("btnAgregarServicio");
    if (btnAbrirNuevo) btnAbrirNuevo.onclick = () => abrirModalServicio(null);

    const btnCerrar = document.getElementById("cerrar-modal-servicio");
    if (btnCerrar) btnCerrar.onclick = () => document.getElementById("modal-servicio").classList.remove("modal-visible");

    const form = document.getElementById("form-servicio");
    if (!form) return;
    form.onsubmit = async (e) => {
        e.preventDefault();
        const personalIds = Array.from(document.querySelectorAll("#servicio-personal-lista input:checked")).map(chk => chk.value);

        const datosServicio = {
            nombre: document.getElementById("servicio-nombre").value.trim(),
            categoria: document.getElementById("servicio-categoria").value.trim(),
            precio: parseFloat(document.getElementById("servicio-precio").value) || 0,
            duracion: parseInt(document.getElementById("servicio-duracion").value, 10) || 30,
            descripcion: document.getElementById("servicio-descripcion").value.trim(),
            personalIds: personalIds,
            estado: document.getElementById("servicio-estado").value
        };

        if (!datosServicio.nombre) { alert("⚠️ El nombre del servicio es obligatorio."); return; }

        try {
            if (servicioEnEdicionId) {
                await ServiciosAPI.actualizar(usuarioActualAuth.uid, servicioEnEdicionId, datosServicio);
                usuarioActualDatos.negocio.servicios = (usuarioActualDatos.negocio.servicios || []).map(s => s.id === servicioEnEdicionId ? { ...s, ...datosServicio } : s);
            } else {
                const nuevo = await ServiciosAPI.agregar(usuarioActualAuth.uid, datosServicio);
                usuarioActualDatos.negocio.servicios = [...(usuarioActualDatos.negocio.servicios || []), nuevo];
            }
            document.getElementById("modal-servicio").classList.remove("modal-visible");
            servicioEnEdicionId = null;
            cargarModuloServicios();
            alert("✅ Servicio guardado correctamente.");
        } catch (error) {
            console.error("Error al guardar el servicio:", error);
            alert("⚠️ No se pudo guardar el servicio.");
        }
    };
}

async function eliminarServicio(id, nombre) {
    if (!confirm(`¿Eliminar el servicio "${nombre || ""}"?`)) return;
    try {
        await ServiciosAPI.eliminar(usuarioActualAuth.uid, id);
        usuarioActualDatos.negocio.servicios = (usuarioActualDatos.negocio.servicios || []).filter(s => s.id !== id);
        cargarModuloServicios();
    } catch (error) {
        console.error("Error al eliminar el servicio:", error);
        alert("⚠️ No se pudo eliminar el servicio.");
    }
}

//==========================================================================
// PANEL ADMINISTRADOR
//==========================================================================
async function cargarResumenAdmin() {
    try {
        const usuarios = await UsuariosAPI.obtenerTodos();
        let totalNegocios = 0, totalPendientes = 0;
        usuarios.forEach(d => {
            if (d.tipo === "barberia" || d.tipo === "salon") {
                totalNegocios++;
                if (d.estado === "pendiente") totalPendientes++;
            }
        });
        document.getElementById("admin-total-usuarios").innerText = usuarios.length;
        document.getElementById("admin-total-negocios").innerText = totalNegocios;
        document.getElementById("admin-total-pendientes").innerText = totalPendientes;

        const citas = await CitasAPI.obtenerTodas();
        document.getElementById("admin-total-citas").innerText = citas.length;
    } catch (error) {
        console.error("Error al cargar el resumen de administrador:", error);
    }
}

async function cargarAprobacionesPendientes() {
    const contenedor = document.getElementById("lista-aprobaciones");
    if (!contenedor) return;
    try {
        const snap = await db.collection("usuarios").where("estado", "==", "pendiente").get();
        if (snap.empty) {
            contenedor.innerHTML = '<p class="sin-citas">No hay solicitudes pendientes por revisar. 🎉</p>';
            return;
        }
        contenedor.innerHTML = "";
        snap.forEach(doc => {
            const d = doc.data();
            const div = document.createElement("div");
            div.className = "item-solicitud";
            div.innerHTML = `
                <div><strong>${d.nombre}</strong> — ${ETIQUETAS_TIPO_CUENTA[d.tipo] || d.tipo}<br><small>${d.correo} · ${d.telefono || ""}</small></div>
                <div class="acciones-solicitud"><button class="boton-aprobar">Aprobar</button><button class="boton-rechazar">Rechazar</button></div>
            `;
            div.querySelector(".boton-aprobar").onclick = async () => {
                await db.collection("usuarios").doc(doc.id).update({ estado: "activo" });
                cargarAprobacionesPendientes(); cargarResumenAdmin(); cargarListaUsuarios();
            };
            div.querySelector(".boton-rechazar").onclick = async () => {
                await db.collection("usuarios").doc(doc.id).update({ estado: "rechazado" });
                cargarAprobacionesPendientes(); cargarResumenAdmin(); cargarListaUsuarios();
            };
            contenedor.appendChild(div);
        });
    } catch (error) {
        console.error("Error al cargar solicitudes:", error);
        contenedor.innerHTML = '<p class="sin-citas">Ocurrió un error al cargar las solicitudes.</p>';
    }
}

async function cargarListaUsuarios() {
    const contenedor = document.getElementById("lista-usuarios");
    if (!contenedor) return;
    try {
        const snap = await db.collection("usuarios").limit(100).get();
        contenedor.innerHTML = "";
        snap.forEach(doc => {
            const d = doc.data();
            if (doc.id === usuarioActualAuth.uid) return;
            const div = document.createElement("div");
            div.className = "item-solicitud";
            const bloqueado = d.estado === "bloqueado";
            div.innerHTML = `
                <div><strong>${d.nombre}</strong> — ${ETIQUETAS_TIPO_CUENTA[d.tipo] || d.tipo}
                <span class="badge-estado badge-${d.estado}">${d.estado}</span><br><small>${d.correo}</small></div>
                <div class="acciones-solicitud">
                    <button class="boton-bloquear">${bloqueado ? "Desbloquear" : "Bloquear"}</button>
                    <button class="boton-rechazar boton-eliminar">Eliminar</button>
                </div>
            `;
            div.querySelector(".boton-bloquear").onclick = async () => {
                await db.collection("usuarios").doc(doc.id).update({ estado: bloqueado ? "activo" : "bloqueado" });
                cargarListaUsuarios();
            };
            div.querySelector(".boton-eliminar").onclick = async () => {
                if (!confirm(`¿Eliminar el perfil de ${d.nombre}? Esto solo elimina su perfil en Firestore, no su cuenta de acceso.`)) return;
                await db.collection("usuarios").doc(doc.id).delete();
                cargarListaUsuarios(); cargarResumenAdmin();
            };
            contenedor.appendChild(div);
        });
        if (contenedor.innerHTML === "") contenedor.innerHTML = '<p class="sin-citas">No hay otros usuarios registrados.</p>';
    } catch (error) {
        console.error("Error al cargar usuarios:", error);
        contenedor.innerHTML = '<p class="sin-citas">Ocurrió un error al cargar los usuarios.</p>';
    }
}

//==========================================================================
// PANEL CLIENTE
//==========================================================================
async function cargarResumenCliente() {
    const favoritos = usuarioActualDatos.favoritos || [];
    document.getElementById("cliente-total-favoritos").innerText = favoritos.length;
    try {
        const citas = usuarioActualDatos.telefono ? await CitasAPI.obtenerPorTelefono(usuarioActualDatos.telefono) : [];
        document.getElementById("cliente-total-citas").innerText = citas.length;
    } catch (error) {
        console.error("Error al contar citas del cliente:", error);
    }
}

async function cargarNegociosParaCliente() {
    const contenedor = document.getElementById("lista-negocios");
    if (!contenedor) return;
    try {
        const snap = await db.collection("usuarios").where("tipo", "in", ["barberia", "salon"]).get();
        const negocios = [];
        snap.forEach(doc => {
            const d = doc.data();
            if (d.estado !== "bloqueado") negocios.push({ id: doc.id, ...d });
        });
        renderizarNegocios(contenedor, negocios);

        const inputBuscar = document.getElementById("input-buscar-negocio");
        if (inputBuscar) {
            inputBuscar.oninput = () => {
                const texto = inputBuscar.value.toLowerCase();
                const filtrados = negocios.filter(n =>
                    (n.negocio && n.negocio.nombre && n.negocio.nombre.toLowerCase().includes(texto)) ||
                    n.nombre.toLowerCase().includes(texto)
                );
                renderizarNegocios(contenedor, filtrados);
            };
        }
    } catch (error) {
        console.error("Error al cargar negocios:", error);
        contenedor.innerHTML = '<p class="sin-citas">Ocurrió un error al cargar los negocios.</p>';
    }
}

function renderizarNegocios(contenedor, negocios) {
    contenedor.innerHTML = "";
    if (!negocios.length) {
        contenedor.innerHTML = '<p class="sin-citas">No se encontraron negocios por el momento.</p>';
        return;
    }
    const favoritos = usuarioActualDatos.favoritos || [];
    negocios.forEach(n => {
        const esFavorito = favoritos.includes(n.id);
        const card = document.createElement("div");
        card.className = "tarjeta-negocio";
        card.innerHTML = `
            <h4>${(n.negocio && n.negocio.nombre) || n.nombre}</h4>
            <p><i class="fa-solid fa-location-dot"></i> ${(n.negocio && n.negocio.direccion) || "Dirección no disponible"}</p>
            <p><i class="fa-solid fa-clock"></i> ${(n.negocio && n.negocio.horario) || "Horario no disponible"}</p>
            <button class="boton-favorito ${esFavorito ? "activo" : ""}">${esFavorito ? "❤️ En favoritos" : "🤍 Agregar a favoritos"}</button>
        `;
        card.querySelector(".boton-favorito").onclick = () => toggleFavorito(n.id);
        contenedor.appendChild(card);
    });
}

async function toggleFavorito(idNegocio) {
    const favoritos = usuarioActualDatos.favoritos || [];
    const yaEsta = favoritos.includes(idNegocio);
    const nuevos = yaEsta ? favoritos.filter(id => id !== idNegocio) : [...favoritos, idNegocio];
    try {
        await db.collection("usuarios").doc(usuarioActualAuth.uid).update({ favoritos: nuevos });
        usuarioActualDatos.favoritos = nuevos;
        cargarResumenCliente(); cargarNegociosParaCliente(); cargarFavoritos();
    } catch (error) {
        console.error("Error al actualizar favoritos:", error);
    }
}

async function cargarFavoritos() {
    const contenedor = document.getElementById("lista-favoritos");
    if (!contenedor) return;
    const favoritos = usuarioActualDatos.favoritos || [];
    if (!favoritos.length) {
        contenedor.innerHTML = '<p class="sin-citas">Aún no tienes negocios favoritos.</p>';
        return;
    }
    try {
        const negocios = [];
        for (const id of favoritos) {
            const doc = await db.collection("usuarios").doc(id).get();
            if (doc.exists) negocios.push({ id: doc.id, ...doc.data() });
        }
        renderizarNegocios(contenedor, negocios);
    } catch (error) {
        console.error("Error al cargar favoritos:", error);
        contenedor.innerHTML = '<p class="sin-citas">Ocurrió un error al cargar tus favoritos.</p>';
    }
}

async function cargarMisCitas() {
    const contenedor = document.getElementById("lista-mis-citas");
    if (!contenedor) return;
    if (!usuarioActualDatos.telefono) {
        contenedor.innerHTML = '<p class="sin-citas">Agrega tu número de teléfono en tu perfil para ver tu historial de citas.</p>';
        return;
    }
    try {
        const citas = await CitasAPI.obtenerPorTelefono(usuarioActualDatos.telefono);
        if (!citas.length) {
            contenedor.innerHTML = '<p class="sin-citas">Aún no tienes citas registradas.</p>';
            return;
        }
        contenedor.innerHTML = "";
        citas.sort((a, b) => (b.fecha_hora || "").localeCompare(a.fecha_hora || "")).forEach(d => {
            const hora = d.fecha_hora && d.fecha_hora.includes("T") ? formatoAMPM(d.fecha_hora.split("T")[1].substring(0, 5)) : "";
            const claseEstado = CLASE_ESTADO_CITA[d.estado] || "badge-pendiente";
            const div = document.createElement("div");
            div.className = "item-historial";
            div.innerHTML = `
                <strong>${d.servicio || "Servicio"}</strong> <span class="badge-estado ${claseEstado}">${d.estado || "Pendiente"}</span><br>
                <small>${d.fecha_hora ? d.fecha_hora.split("T")[0] : ""} · ${hora} · Con: ${d.nombre_profesional || "—"}</small>
            `;
            contenedor.appendChild(div);
        });
    } catch (error) {
        console.error("Error al cargar mis citas:", error);
        contenedor.innerHTML = '<p class="sin-citas">Ocurrió un error al cargar tu historial.</p>';
    }
}