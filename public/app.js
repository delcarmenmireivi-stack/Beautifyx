//==========================================================================
// BEAUTIFYX - MÓDULO DE CITAS (Barbería / Salón)
// Las citas ya no usan horarios fijos: se pueden agendar varias citas en el
// mismo día (con distintos profesionales). Cada cita queda ligada a un
// servicio y un profesional reales del catálogo del negocio (Personal /
// Servicios), y la duración/hora de fin/precio se calculan automáticamente.
// Todas las citas quedan asociadas al negocio que las creó (negocioId) y
// cada negocio solo ve y gestiona las suyas.
//==========================================================================

let todasLasCitasNegocio = [];
let panelCitasIniciado = false;
let citaEnEdicionId = null; // null = se está creando una cita nueva

// Se llama desde dashboard.js una vez que se confirmó que el usuario tiene
// una cuenta de tipo Barbería o Salón (dueño de negocio).
function iniciarPanelCitas() {
    if (panelCitasIniciado) return; // evita doble inicialización
    panelCitasIniciado = true;

    const selectorFecha = document.getElementById("selector-fecha");
    if (selectorFecha && !selectorFecha.value) {
        selectorFecha.value = new Date().toISOString().split("T")[0];
    }
    if (selectorFecha) selectorFecha.onchange = () => renderizarListaCitasDelDia();

    configurarEventosFormulario();

    const btnAbrirNuevaCita = document.getElementById("btnNuevaCita");
    if (btnAbrirNuevaCita) btnAbrirNuevaCita.onclick = () => abrirModalNuevaCita();

    const btnCerrarModal = document.getElementById("cerrar-modal");
    if (btnCerrarModal) {
        btnCerrarModal.onclick = () => {
            document.getElementById("modal-cita").classList.remove("modal-visible");
        };
    }

    cargarTodasCitasNegocio();
}

/** Trae TODAS las citas del negocio actual una sola vez y renderiza todo lo derivado. */
async function cargarTodasCitasNegocio() {
    try {
        todasLasCitasNegocio = await CitasAPI.obtenerPorNegocio(usuarioActualAuth.uid);
        todasLasCitasNegocio.sort((a, b) => (a.fecha_hora || "").localeCompare(b.fecha_hora || ""));

        renderizarListaCitasDelDia();
        renderizarProximasCitasInicio();
        renderizarHistorialUltimasCitas();
        actualizarMetricasInicio();

        // Refresca vistas derivadas si el usuario ya las tiene abiertas
        if (typeof cargarNotificaciones === "function") cargarNotificaciones();
        if (document.getElementById("seccion-reportes") && !document.getElementById("seccion-reportes").classList.contains("oculto")) {
            if (typeof cargarGraficoSemanal === "function") cargarGraficoSemanal("grafico-semanal-reportes", "grafico-total-semana-reportes");
            if (typeof cargarRankingServicios === "function") cargarRankingServicios();
        }
        if (document.getElementById("seccion-clientes") && !document.getElementById("seccion-clientes").classList.contains("oculto")) {
            if (typeof cargarClientesDelNegocio === "function") cargarClientesDelNegocio();
        }
    } catch (error) {
        console.error("Error al cargar las citas del negocio:", error);
    }
}

//==========================================================================
// LISTA DE CITAS DEL DÍA SELECCIONADO (pestaña "Citas")
//==========================================================================
function renderizarListaCitasDelDia() {
    const contenedor = document.getElementById("lista-horarios");
    const selectorFecha = document.getElementById("selector-fecha");
    if (!contenedor || !selectorFecha) return;

    const fechaSeleccionada = selectorFecha.value;
    const citasDelDia = todasLasCitasNegocio
        .filter(c => c.fecha_hora && c.fecha_hora.split("T")[0] === fechaSeleccionada)
        .sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora));

    if (!citasDelDia.length) {
        contenedor.innerHTML = '<p class="sin-citas">No hay citas agendadas para este día. Usa "Agendar Nueva Cita" para agregar una.</p>';
        return;
    }

    contenedor.innerHTML = "";
    citasDelDia.forEach(cita => contenedor.appendChild(crearFilaCita(cita)));
}

const CLASE_ESTADO_CITA = {
    "Pendiente": "badge-pendiente",
    "Confirmada": "badge-activo",
    "En proceso": "badge-pendiente",
    "Finalizada": "badge-activo",
    "Cancelada": "badge-cancelado"
};

function crearFilaCita(cita) {
    const horaInicio24 = cita.fecha_hora && cita.fecha_hora.includes("T") ? cita.fecha_hora.split("T")[1].substring(0, 5) : "--:--";
    const horaFin24 = cita.fecha_hora_fin && cita.fecha_hora_fin.includes("T") ? cita.fecha_hora_fin.split("T")[1].substring(0, 5) : null;
    const rangoHoras = horaFin24 ? `${formatoAMPM(horaInicio24)} - ${formatoAMPM(horaFin24)}` : formatoAMPM(horaInicio24);

    const telefonoLimpio = (cita.telefono_cliente || "").replace(/\D/g, "");
    const textoMensaje = mensajeWhatsappCita(cita, "recordatorio");
    const enlaceWhatsApp = `https://wa.me/${telefonoLimpio}?text=${encodeURIComponent(textoMensaje)}`;

    const estado = cita.estado || "Pendiente";
    const claseEstado = CLASE_ESTADO_CITA[estado] || "badge-pendiente";
    const cancelada = estado === "Cancelada";

    const div = document.createElement("div");
    div.className = "bloque-hora ocupado" + (cancelada ? " ocupado" : "");
    div.innerHTML = `
        <span class="hora-texto">⏰ ${rangoHoras}</span>
        <span style="flex:1;padding:0 14px">
            <strong>${cita.nombre_cliente || "Cliente"}</strong>
            <span class="badge-estado ${claseEstado}">${estado}</span><br>
            <small>${cita.servicio || "Servicio"} (${cita.duracion || "?"} min) · ${cita.nombre_profesional || "—"} · RD$${cita.precio ?? 0}</small>
        </span>
        <a href="${enlaceWhatsApp}" target="_blank" class="boton-whatsapp" title="Escribir por WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>
        <button class="boton-editar-cita" title="Editar / reprogramar"><i class="fa-solid fa-pen"></i></button>
        ${!cancelada ? '<button class="boton-cancelar-cita" title="Cancelar cita"><i class="fa-solid fa-ban"></i></button>' : ""}
        <button class="boton-eliminar-cita" title="Eliminar definitivamente"><i class="fa-solid fa-trash"></i></button>
    `;
    div.querySelector(".boton-editar-cita").onclick = (e) => { e.stopPropagation(); abrirModalNuevaCita(cita); };
    if (!cancelada) {
        div.querySelector(".boton-cancelar-cita").onclick = (e) => { e.stopPropagation(); cancelarCita(cita); };
    }
    div.querySelector(".boton-eliminar-cita").onclick = (e) => { e.stopPropagation(); eliminarCita(cita.id); };
    return div;
}

/** Construye el texto del mensaje de WhatsApp según el motivo (creación, cambio, cancelación, recordatorio). */
function mensajeWhatsappCita(cita, motivo) {
    const fecha = cita.fecha_hora ? cita.fecha_hora.split("T")[0] : "";
    const hora = cita.fecha_hora && cita.fecha_hora.includes("T") ? formatoAMPM(cita.fecha_hora.split("T")[1].substring(0, 5)) : "";
    const base = `¡Hola ${cita.nombre_cliente || "cliente"}! `;
    if (motivo === "cancelacion") {
        return base + `Tu cita del ${fecha} a las ${hora} (${cita.servicio || "servicio"}) fue CANCELADA. Si tienes dudas, contáctanos. — Beautifyx`;
    }
    if (motivo === "reprogramada") {
        return base + `Tu cita fue reprogramada para el ${fecha} a las ${hora}. Servicio: ${cita.servicio || "Servicio"}. Te atenderá: ${cita.nombre_profesional || "nuestro equipo"}. — Beautifyx`;
    }
    if (motivo === "nueva") {
        return base + `Tu cita quedó agendada para el ${fecha} a las ${hora}. Servicio: ${cita.servicio || "Servicio"}. Te atenderá: ${cita.nombre_profesional || "nuestro equipo"}. ¡Te esperamos! ✨`;
    }
    return base + `Te recordamos tu cita en Beautifyx el ${fecha} a las ${hora}. Servicio: ${cita.servicio || "Servicio"}. Te atenderá: ${cita.nombre_profesional || "nuestro equipo"}. ¡Te esperamos! ✨`;
}

/** Crea una notificación visible para el cliente (aparece en su campana al iniciar sesión). */
async function notificarCliente(cita, motivo) {
    if (!cita.telefono_cliente) return;
    const titulos = {
        nueva: "Cita agendada",
        reprogramada: "Cita reprogramada",
        cancelacion: "Cita cancelada"
    };
    try {
        await NotificacionesAPI.crear({
            negocioId: cita.negocioId,
            citaId: cita.id || null,
            telefonoCliente: cita.telefono_cliente,
            tipo: motivo === "cancelacion" ? "alerta" : "info",
            titulo: titulos[motivo] || "Actualización de tu cita",
            detalle: `${cita.servicio || "Servicio"} · ${cita.fecha_hora ? cita.fecha_hora.replace("T", " ").substring(0, 16) : ""}`
        });
    } catch (error) {
        console.error("Error al crear la notificación para el cliente:", error);
    }
}

async function cancelarCita(cita) {
    if (!confirm("¿Cancelar esta cita? El cliente verá el cambio en su panel y puedes avisarle por WhatsApp.")) return;
    try {
        await CitasAPI.actualizar(cita.id, { estado: "Cancelada" });
        await notificarCliente(cita, "cancelacion");
        await cargarTodasCitasNegocio();

        const telefonoLimpio = (cita.telefono_cliente || "").replace(/\D/g, "");
        if (telefonoLimpio && confirm("¿Deseas avisarle al cliente por WhatsApp ahora mismo?")) {
            window.open(`https://wa.me/${telefonoLimpio}?text=${encodeURIComponent(mensajeWhatsappCita(cita, "cancelacion"))}`, "_blank");
        }
    } catch (error) {
        console.error("Error al cancelar la cita:", error);
        alert("⚠️ No se pudo cancelar la cita.");
    }
}

async function eliminarCita(citaId) {
    if (!confirm("¿Eliminar esta cita de forma permanente? Esta acción no se puede deshacer.")) return;
    try {
        await CitasAPI.eliminar(citaId);
        await cargarTodasCitasNegocio();
    } catch (error) {
        console.error("Error al eliminar la cita:", error);
        alert("⚠️ No se pudo eliminar la cita.");
    }
}

//==========================================================================
// MÉTRICAS Y RESÚMENES (sección Inicio)
//==========================================================================
function actualizarMetricasInicio() {
    const hoyISO = new Date().toISOString().split("T")[0];
    const citasHoy = todasLasCitasNegocio.filter(c => c.fecha_hora && c.fecha_hora.split("T")[0] === hoyISO && c.estado !== "Cancelada");

    const ingresosTotales = citasHoy.reduce((total, c) => total + parseFloat(c.precio || 0), 0);
    const clientesUnicos = new Set(citasHoy.map(c => c.telefono_cliente || c.nombre_cliente));

    const elIngresos = document.getElementById("total-ingresos-hoy");
    const elCitas = document.getElementById("total-citas");
    const elOcupacion = document.getElementById("porcentaje-ocupacion");
    const lblClientes = document.getElementById("clientes-registrados");

    if (elIngresos) elIngresos.innerText = `RD$ ${ingresosTotales.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    if (elCitas) elCitas.innerText = citasHoy.length;
    if (lblClientes) lblClientes.innerText = clientesUnicos.size;
    if (elOcupacion) {
        // Referencia orientativa: 9 franjas horarias típicas de un día de trabajo
        const porcentaje = Math.min(100, Math.round((citasHoy.length / 9) * 100));
        elOcupacion.innerText = `${porcentaje}%`;
    }
}

function renderizarProximasCitasInicio() {
    const contenedor = document.getElementById("proximas-citas-inicio");
    if (!contenedor) return;

    const hoyISO = new Date().toISOString().split("T")[0];
    const proximas = todasLasCitasNegocio
        .filter(c => c.fecha_hora && c.fecha_hora.split("T")[0] === hoyISO && c.estado !== "Cancelada")
        .sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora))
        .slice(0, 5);

    if (!proximas.length) {
        contenedor.innerHTML = '<p class="sin-citas">No hay citas agendadas para hoy.</p>';
        return;
    }

    contenedor.innerHTML = "";
    proximas.forEach(cita => {
        const hora = formatoAMPM(cita.fecha_hora.split("T")[1].substring(0, 5));
        const div = document.createElement("div");
        div.className = "item-historial";
        div.innerHTML = `
            <span>⏰ ${hora} - <strong>${cita.nombre_cliente || "Cliente"}</strong></span><br>
            <small>${cita.servicio || "Servicio"} · ${cita.estado || "Pendiente"}</small>
        `;
        contenedor.appendChild(div);
    });
}

function renderizarHistorialUltimasCitas() {
    const historialContenedor = document.getElementById("historial-citas");
    if (!historialContenedor) return;

    const ultimas = [...todasLasCitasNegocio]
        .sort((a, b) => (b.creadoEn?.toMillis?.() || 0) - (a.creadoEn?.toMillis?.() || 0))
        .slice(0, 5);

    if (!ultimas.length) {
        historialContenedor.innerHTML = '<p class="sin-citas">Aún no hay citas registradas.</p>';
        return;
    }

    historialContenedor.innerHTML = "";
    ultimas.forEach(cita => {
        const hora = cita.fecha_hora && cita.fecha_hora.includes("T") ? formatoAMPM(cita.fecha_hora.split("T")[1].substring(0, 5)) : "--:--";
        const item = document.createElement("div");
        item.className = "item-historial";
        item.innerHTML = `
            <span>⏰ ${hora} - <strong>${cita.nombre_cliente || "Cliente"}</strong></span><br>
            <small>${cita.servicio || "Servicio"} · ${cita.estado || "Pendiente"}</small>
        `;
        historialContenedor.appendChild(item);
    });
}

//==========================================================================
// MODAL: AGENDAR / EDITAR CITA (catálogos dinámicos de servicios y personal)
//==========================================================================

/** Abre el modal. Si se pasa una "cita" existente, entra en modo edición/reprogramación. */
function abrirModalNuevaCita(citaExistente) {
    citaEnEdicionId = citaExistente ? citaExistente.id : null;

    const negocio = usuarioActualDatos.negocio || {};
    poblarSelectServicios(negocio.servicios || [], citaExistente ? citaExistente.servicioId : null);

    const selectorFecha = document.getElementById("selector-fecha");
    const inputFecha = document.getElementById("fecha-cita-modal");
    const inputHora = document.getElementById("hora-cita-modal");

    if (citaExistente) {
        document.getElementById("nombre-cliente").value = citaExistente.nombre_cliente || "";
        document.getElementById("telefono-cliente").value = citaExistente.telefono_cliente || "";
        document.getElementById("estado-cita").value = citaExistente.estado || "Pendiente";
        document.getElementById("metodo-pago").value = citaExistente.metodo_pago || "Efectivo";
        document.getElementById("notas").value = citaExistente.notas || "";
        inputFecha.value = citaExistente.fecha_hora ? citaExistente.fecha_hora.split("T")[0] : "";
        inputHora.value = citaExistente.fecha_hora && citaExistente.fecha_hora.includes("T") ? citaExistente.fecha_hora.split("T")[1].substring(0, 5) : "";
    } else {
        document.getElementById("formulario-cita").reset();
        inputFecha.value = (selectorFecha && selectorFecha.value) || new Date().toISOString().split("T")[0];
        inputHora.value = "";
    }

    document.getElementById("titulo-modal-cita").innerText = citaExistente ? "✏️ Editar / Reprogramar Cita" : "✨ Agendar Nueva Cita";
    document.getElementById("btnGuardarCita").innerText = citaExistente ? "Guardar cambios" : "Confirmar Cita";

    actualizarResumenDuracion();
    poblarSelectEmpleadosDisponibles(citaExistente ? citaExistente.personalId : null);
    document.getElementById("modal-cita").classList.add("modal-visible");
}

function poblarSelectServicios(servicios, servicioIdSeleccionado) {
    const select = document.getElementById("servicio");
    if (!select) return;
    const disponibles = (servicios || []).filter(s => (s.estado || "disponible") !== "no_disponible");
    if (!disponibles.length) {
        select.innerHTML = '<option value="">Agrega servicios primero en el módulo "Servicios"</option>';
        return;
    }
    select.innerHTML = '<option value="">Seleccione un servicio</option>' +
        disponibles.map(s => `<option value="${s.id}" data-precio="${s.precio || 0}" data-duracion="${s.duracion || 30}" data-nombre="${s.nombre}" data-personal="${(s.personalIds || []).join(",")}" ${s.id === servicioIdSeleccionado ? "selected" : ""}>${s.nombre} — RD$${s.precio || 0} (${s.duracion || 30} min)</option>`).join("");
}

/** Determina qué empleados están libres para el servicio/fecha/hora elegidos y llena el select. */
function poblarSelectEmpleadosDisponibles(personalIdSeleccionado) {
    const select = document.getElementById("seleccionar-empleado");
    if (!select) return;

    const negocio = usuarioActualDatos.negocio || {};
    const personalTodos = (negocio.personal || []).filter(p => (p.estado || "activo") === "activo");

    const selectServicio = document.getElementById("servicio");
    const opcionServicio = selectServicio.options[selectServicio.selectedIndex];
    const personalDelServicio = opcionServicio && opcionServicio.getAttribute("data-personal")
        ? opcionServicio.getAttribute("data-personal").split(",").filter(Boolean)
        : [];

    let candidatos = personalTodos;
    if (personalDelServicio.length) {
        candidatos = candidatos.filter(p => personalDelServicio.includes(p.id));
    }

    const fecha = document.getElementById("fecha-cita-modal").value;
    const horaInicio = document.getElementById("hora-cita-modal").value;
    const duracion = parseInt(opcionServicio ? opcionServicio.getAttribute("data-duracion") : 30, 10) || 30;

    if (fecha && horaInicio) {
        const horaFin = sumarMinutos(horaInicio, duracion);
        candidatos = candidatos.filter(p => {
            const ocupado = todasLasCitasNegocio.some(c => {
                if (c.id === citaEnEdicionId) return false; // ignora la cita que se está editando
                if (c.estado === "Cancelada") return false;
                if (c.personalId !== p.id) return false;
                if (!c.fecha_hora || c.fecha_hora.split("T")[0] !== fecha) return false;
                const cInicio = c.fecha_hora.split("T")[1].substring(0, 5);
                const cFin = c.fecha_hora_fin && c.fecha_hora_fin.includes("T") ? c.fecha_hora_fin.split("T")[1].substring(0, 5) : sumarMinutos(cInicio, c.duracion || 30);
                return seTraslapanHoras(horaInicio, horaFin, cInicio, cFin);
            });
            return !ocupado;
        });
    }

    if (!candidatos.length) {
        select.innerHTML = `<option value="">${personalTodos.length ? "Nadie disponible a esa fecha/hora" : 'Agrega personal primero en el módulo "Personal"'}</option>`;
        return;
    }
    select.innerHTML = '<option value="">Seleccione</option>' +
        candidatos.map(p => `<option value="${p.id}" data-nombre="${p.nombre}" ${p.id === personalIdSeleccionado ? "selected" : ""}>${p.nombre} (${p.tipoPersonal || "Personal"})</option>`).join("");
}

function actualizarResumenDuracion() {
    const selectServicio = document.getElementById("servicio");
    const opcionServicio = selectServicio.options[selectServicio.selectedIndex];
    const inputPrecio = document.getElementById("precio-servicio");
    const elDuracion = document.getElementById("duracion-servicio-texto");
    const elHoraFin = document.getElementById("hora-fin-texto");

    const precio = opcionServicio ? opcionServicio.getAttribute("data-precio") : null;
    const duracion = opcionServicio ? parseInt(opcionServicio.getAttribute("data-duracion"), 10) : null;
    const horaInicio = document.getElementById("hora-cita-modal").value;

    if (inputPrecio) inputPrecio.value = precio ? `RD$ ${precio}` : "";
    if (elDuracion) elDuracion.innerText = duracion ? `${duracion} minutos` : "—";
    if (elHoraFin) {
        if (duracion && horaInicio) {
            const fin = sumarMinutos(horaInicio, duracion);
            elHoraFin.innerText = `${formatoAMPM(horaInicio)} → ${formatoAMPM(fin)}`;
        } else {
            elHoraFin.innerText = "—";
        }
    }
}

function configurarEventosFormulario() {
    const selectServicio = document.getElementById("servicio");
    const inputFecha = document.getElementById("fecha-cita-modal");
    const inputHora = document.getElementById("hora-cita-modal");

    if (selectServicio) {
        selectServicio.onchange = () => {
            actualizarResumenDuracion();
            poblarSelectEmpleadosDisponibles();
        };
    }
    if (inputFecha) inputFecha.onchange = () => { actualizarResumenDuracion(); poblarSelectEmpleadosDisponibles(); };
    if (inputHora) inputHora.onchange = () => { actualizarResumenDuracion(); poblarSelectEmpleadosDisponibles(); };

    document.getElementById("formulario-cita").onsubmit = async (e) => {
        e.preventDefault();

        const nombre = document.getElementById("nombre-cliente").value.trim();
        const telefono = document.getElementById("telefono-cliente").value.trim();
        const opcionServicio = selectServicio.options[selectServicio.selectedIndex];
        const servicioId = selectServicio.value;
        const servicioNombre = opcionServicio ? opcionServicio.getAttribute("data-nombre") : "";
        const precio = opcionServicio ? parseFloat(opcionServicio.getAttribute("data-precio") || 0) : 0;
        const duracion = opcionServicio ? parseInt(opcionServicio.getAttribute("data-duracion") || 30, 10) : 30;
        const estado = document.getElementById("estado-cita").value;
        const metodoPago = document.getElementById("metodo-pago").value;
        const notas = document.getElementById("notas").value;

        const selectEmpleado = document.getElementById("seleccionar-empleado");
        const opcionEmpleado = selectEmpleado.options[selectEmpleado.selectedIndex];
        const personalId = selectEmpleado.value;
        const nombreProfesional = opcionEmpleado ? opcionEmpleado.getAttribute("data-nombre") : "";

        const fecha = inputFecha.value;
        const hora = inputHora.value;

        if (!servicioId) { alert("⚠️ Selecciona un servicio."); return; }
        if (!personalId) { alert("⚠️ Selecciona un profesional disponible."); return; }
        if (!fecha || !hora) { alert("⚠️ Selecciona la fecha y la hora de la cita."); return; }

        const horaFin = sumarMinutos(hora, duracion);
        const datosCita = {
            negocioId: usuarioActualAuth.uid,
            nombre_cliente: nombre,
            telefono_cliente: telefono,
            servicioId: servicioId,
            servicio: servicioNombre,
            precio: precio,
            duracion: duracion,
            estado: estado,
            metodo_pago: metodoPago,
            notas: notas,
            personalId: personalId,
            nombre_profesional: nombreProfesional,
            fecha_hora: `${fecha}T${hora}:00`,
            fecha_hora_fin: `${fecha}T${horaFin}:00`
        };

        try {
            let citaFinal;
            if (citaEnEdicionId) {
                await CitasAPI.actualizar(citaEnEdicionId, datosCita);
                citaFinal = { id: citaEnEdicionId, ...datosCita };
                await notificarCliente(citaFinal, "reprogramada");
                alert("✅ Cita actualizada correctamente.");
            } else {
                const citaId = await CitasAPI.crear(datosCita);
                citaFinal = { id: citaId, ...datosCita };

                await NotificacionesAPI.crear({
                    negocioId: usuarioActualAuth.uid,
                    citaId: citaId,
                    tipo: "cita",
                    titulo: "Nueva cita agendada",
                    detalle: `${nombre || "Cliente"} · ${servicioNombre}`
                });
                await notificarCliente(citaFinal, "nueva");

                alert("🎉 ¡Cita confirmada y guardada de forma segura en Beautifyx!");
            }

            document.getElementById("formulario-cita").reset();
            citaEnEdicionId = null;
            document.getElementById("modal-cita").classList.remove("modal-visible");

            await cargarTodasCitasNegocio();
        } catch (error) {
            console.error("Error al guardar la cita en Firestore:", error);
            alert("⚠️ Ocurrió un problema al guardar la cita. Revisa tu conexión o las reglas de Firestore.");
        }
    };
}