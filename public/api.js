//==========================================================================
// BEAUTIFYX - API DE DATOS (capa de acceso a Firestore)
// Centraliza todas las lecturas/escrituras a la base de datos para que
// app.js y dashboard.js no llamen a Firestore directamente en todos lados.
// Requiere que firebase-config.js ya haya inicializado "db" y "firebase".
//==========================================================================

//==========================================================================
// CATÁLOGOS COMPARTIDOS (Personal / Servicios)
//==========================================================================

// Tipos de personal disponibles según el tipo de negocio seleccionado en
// la ficha del empleado (independiente del tipo de cuenta: un negocio tipo
// "salon" puede tener personal de Salón de Belleza y también de Spa).
const TIPOS_PERSONAL_POR_NEGOCIO = {
    barberia: ["Barbero(a)", "Barbero(a) Junior", "Estilista Masculino"],
    salon: ["Estilista", "Colorista", "Especialista en Tratamientos Capilares", "Manicurista", "Pedicurista", "Maquillista"],
    spa: ["Esteticista", "Cosmetóloga", "Masajista o Terapeuta de Masajes", "Especialista en Faciales", "Especialista en Depilación", "Técnico(a) en Uñas"]
};

const ETIQUETAS_TIPO_NEGOCIO_PERSONAL = {
    barberia: "💈 Barbería",
    salon: "💇 Salón de Belleza",
    spa: "🌿 Spa"
};

const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const ESTADOS_CITA = ["Pendiente", "Confirmada", "En proceso", "Finalizada", "Cancelada"];

//==========================================================================
// UTILIDADES DE FECHA / HORA (usadas por app.js y dashboard.js)
//==========================================================================

/** Convierte "14:30" (24h) a "2:30 PM". */
function formatoAMPM(horaHHMM) {
    if (!horaHHMM) return "--:--";
    const [h, m] = horaHHMM.split(":").map(Number);
    const periodo = h >= 12 ? "PM" : "AM";
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return `${h12}:${String(m).padStart(2, "0")} ${periodo}`;
}

/** Suma minutos a una hora "HH:MM" (24h) y devuelve "HH:MM". No cruza de día. */
function sumarMinutos(horaHHMM, minutos) {
    if (!horaHHMM) return "00:00";
    const [h, m] = horaHHMM.split(":").map(Number);
    let total = h * 60 + m + (parseInt(minutos, 10) || 0);
    total = Math.max(0, Math.min(23 * 60 + 59, total));
    const hh = Math.floor(total / 60);
    const mm = total % 60;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** true si los rangos [inicioA,finA) y [inicioB,finB) (strings "HH:MM") se traslapan. */
function seTraslapanHoras(inicioA, finA, inicioB, finB) {
    return inicioA < finB && inicioB < finA;
}

const CitasAPI = {
    /** Crea una cita y devuelve su id. Siempre debe incluir "negocioId". */
    async crear(datosCita) {
        const ref = await db.collection("citas").add({
            ...datosCita,
            creadoEn: firebase.firestore.FieldValue.serverTimestamp()
        });
        return ref.id;
    },

    /** Actualiza campos de una cita existente (reprogramar, cambiar estado, etc). */
    async actualizar(citaId, cambios) {
        await db.collection("citas").doc(citaId).update({
            ...cambios,
            actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
        });
    },

    /** Elimina una cita de forma permanente y su(s) notificación(es) asociada(s). */
    async eliminar(citaId) {
        await db.collection("citas").doc(citaId).delete();
        await NotificacionesAPI.eliminarPorCita(citaId);
    },

    /** Todas las citas que pertenecen a un negocio específico (por uid del dueño). */
    async obtenerPorNegocio(negocioId) {
        const snap = await db.collection("citas").where("negocioId", "==", negocioId).get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    /** Todas las citas asociadas a un teléfono de cliente (cruza negocios, a propósito). */
    async obtenerPorTelefono(telefono) {
        const snap = await db.collection("citas").where("telefono_cliente", "==", telefono).get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    /** Todas las citas del sistema (uso exclusivo del panel de administrador). */
    async obtenerTodas() {
        const snap = await db.collection("citas").get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
};

const NotificacionesAPI = {
    async crear(datos) {
        await db.collection("notificaciones").add({
            ...datos,
            leida: false,
            creadoEn: firebase.firestore.FieldValue.serverTimestamp()
        });
    },

    async eliminarPorCita(citaId) {
        const snap = await db.collection("notificaciones").where("citaId", "==", citaId).get();
        await Promise.all(snap.docs.map(doc => doc.ref.delete()));
    },

    async obtenerPorNegocio(negocioId, limite = 8) {
        const snap = await db.collection("notificaciones").where("negocioId", "==", negocioId).get();
        return snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.creadoEn?.toMillis?.() || 0) - (a.creadoEn?.toMillis?.() || 0))
            .slice(0, limite);
    },

    /** Notificaciones dirigidas a un cliente específico (creadas al agendar/editar/cancelar su cita). */
    async obtenerPorTelefono(telefono, limite = 8) {
        if (!telefono) return [];
        const snap = await db.collection("notificaciones").where("telefonoCliente", "==", telefono).get();
        return snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.creadoEn?.toMillis?.() || 0) - (a.creadoEn?.toMillis?.() || 0))
            .slice(0, limite);
    },

    /** Elimina TODAS las notificaciones dirigidas a un cliente (Mantenimiento del cliente). */
    async eliminarPorTelefono(telefono) {
        if (!telefono) return;
        const snap = await db.collection("notificaciones").where("telefonoCliente", "==", telefono).get();
        await Promise.all(snap.docs.map(doc => doc.ref.delete()));
    }
};

const AlertasAPI = {
    async crear(datos) {
        await db.collection("alertas").add({
            ...datos,
            creadoEn: firebase.firestore.FieldValue.serverTimestamp()
        });
    },

    /** Crea o actualiza la alerta fija de "sistema en mantenimiento". */
    async establecerMantenimiento(activa, mensaje) {
        await db.collection("alertas").doc("sistema-mantenimiento").set({
            titulo: "BeautifyX no está disponible temporalmente",
            mensaje: mensaje || "Estamos realizando mejoras en el sistema. Intenta de nuevo en unos minutos.",
            tipo: "alerta",
            activa: !!activa,
            actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    },

    async obtenerActivas() {
        const snap = await db.collection("alertas").where("activa", "==", true).get();
        return snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.creadoEn?.toMillis?.() || 0) - (a.creadoEn?.toMillis?.() || 0));
    },

    async obtenerTodas() {
        const snap = await db.collection("alertas").get();
        return snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.creadoEn?.toMillis?.() || 0) - (a.creadoEn?.toMillis?.() || 0));
    },

    async actualizar(id, cambios) {
        await db.collection("alertas").doc(id).update(cambios);
    },

    async eliminar(id) {
        await db.collection("alertas").doc(id).delete();
    }
};

const ConfigSistemaAPI = {
    ref() { return db.collection("configuracionSistema").doc("general"); },

    async obtener() {
        const doc = await ConfigSistemaAPI.ref().get();
        return doc.exists ? doc.data() : { umbralAlertas: 3, enMantenimiento: false, mensajeMantenimiento: "" };
    },

    async guardar(datos) {
        await ConfigSistemaAPI.ref().set(datos, { merge: true });
    }
};

const UsuariosAPI = {
    async obtenerTodos() {
        const snap = await db.collection("usuarios").get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    /** Borra TODAS las citas y notificaciones del sistema (no toca usuarios). Uso exclusivo de administrador. */
    async limpiarCitasYNotificaciones() {
        const snapCitas = await db.collection("citas").get();
        await Promise.all(snapCitas.docs.map(doc => doc.ref.delete()));
        const snapNotif = await db.collection("notificaciones").get();
        await Promise.all(snapNotif.docs.map(doc => doc.ref.delete()));
    },

    /** Borra las citas y notificaciones de UN solo negocio (Mantenimiento de barbería/salón). */
    async limpiarCitasYNotificacionesDeNegocio(negocioId) {
        const snapCitas = await db.collection("citas").where("negocioId", "==", negocioId).get();
        await Promise.all(snapCitas.docs.map(doc => doc.ref.delete()));
        const snapNotif = await db.collection("notificaciones").where("negocioId", "==", negocioId).get();
        await Promise.all(snapNotif.docs.map(doc => doc.ref.delete()));
    }
};

//==========================================================================
// PERSONAL (empleados de un negocio) — se guarda embebido en
// usuarios/{negocioId}.negocio.personal, igual que ya hacía "servicios".
//==========================================================================
const PersonalAPI = {
    generarId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    },

    async listar(negocioId) {
        const doc = await db.collection("usuarios").doc(negocioId).get();
        if (!doc.exists) return [];
        return (doc.data().negocio && doc.data().negocio.personal) || [];
    },

    async agregar(negocioId, empleado) {
        const ref = db.collection("usuarios").doc(negocioId);
        const doc = await ref.get();
        const negocio = doc.data().negocio || {};
        const personal = negocio.personal || [];
        const nuevo = { id: this.generarId(), ...empleado };
        personal.push(nuevo);
        await ref.update({ "negocio.personal": personal });
        return nuevo;
    },

    async actualizar(negocioId, empleadoId, cambios) {
        const ref = db.collection("usuarios").doc(negocioId);
        const doc = await ref.get();
        const negocio = doc.data().negocio || {};
        const personal = (negocio.personal || []).map(p => p.id === empleadoId ? { ...p, ...cambios } : p);
        await ref.update({ "negocio.personal": personal });
        return personal.find(p => p.id === empleadoId);
    },

    async eliminar(negocioId, empleadoId) {
        const ref = db.collection("usuarios").doc(negocioId);
        const doc = await ref.get();
        const negocio = doc.data().negocio || {};
        const personal = (negocio.personal || []).filter(p => p.id !== empleadoId);
        await ref.update({ "negocio.personal": personal });
    }
};

//==========================================================================
// SERVICIOS — se guarda embebido en usuarios/{negocioId}.negocio.servicios
//==========================================================================
const ServiciosAPI = {
    generarId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    },

    async listar(negocioId) {
        const doc = await db.collection("usuarios").doc(negocioId).get();
        if (!doc.exists) return [];
        return (doc.data().negocio && doc.data().negocio.servicios) || [];
    },

    async agregar(negocioId, servicio) {
        const ref = db.collection("usuarios").doc(negocioId);
        const doc = await ref.get();
        const negocio = doc.data().negocio || {};
        const servicios = negocio.servicios || [];
        const nuevo = { id: this.generarId(), ...servicio };
        servicios.push(nuevo);
        await ref.update({ "negocio.servicios": servicios });
        return nuevo;
    },

    async actualizar(negocioId, servicioId, cambios) {
        const ref = db.collection("usuarios").doc(negocioId);
        const doc = await ref.get();
        const negocio = doc.data().negocio || {};
        const servicios = (negocio.servicios || []).map(s => s.id === servicioId ? { ...s, ...cambios } : s);
        await ref.update({ "negocio.servicios": servicios });
        return servicios.find(s => s.id === servicioId);
    },

    async eliminar(negocioId, servicioId) {
        const ref = db.collection("usuarios").doc(negocioId);
        const doc = await ref.get();
        const negocio = doc.data().negocio || {};
        const servicios = (negocio.servicios || []).filter(s => s.id !== servicioId);
        await ref.update({ "negocio.servicios": servicios });
    }
};