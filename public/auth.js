//==========================================================================
// BEAUTIFYX - AUTENTICACIÓN Y ROLES (módulo compartido)
// Usado por: registro.html, login.html y dashboard.html
// Requiere que firebase-config.js ya se haya cargado antes (variables
// globales "auth" y "db").
//
// NOTA: este archivo no necesitó cambios para los nuevos módulos de
// Personal / Servicios / Citas — se incluye igual para que tengas el set
// completo de archivos. El objeto "negocio.personal" que ya creabas aquí
// al registrar una cuenta es justo el que ahora usa PersonalAPI (antes
// dashboard.js leía por error "negocio.empleados", eso ya quedó corregido
// en dashboard.js/app.js para que coincida con este archivo).
//==========================================================================

const COLECCION_USUARIOS = "usuarios";

// Traduce el value de los radios del formulario de registro a las
// etiquetas legibles que se muestran en el dashboard.
const ETIQUETAS_TIPO_CUENTA = {
    cliente: "Cliente",
    barberia: "Barbería",
    salon: "Spa / Salón",
    administrador: "Administrador"
};

/**
 * Crea la cuenta en Firebase Authentication y guarda su perfil en Firestore.
 * Toda cuenta (cliente, barbería o salón) queda "activa" de inmediato: no
 * existe ningún paso de aprobación por un administrador. El campo "estado"
 * se conserva porque un administrador todavía puede bloquear una cuenta
 * más adelante si es necesario (moderación), pero nunca bloquea el acceso
 * al momento del registro.
 */
async function registrarUsuario({ nombre, correo, telefono, password, tipo }) {
    const credencial = await auth.createUserWithEmailAndPassword(correo, password);
    const usuario = credencial.user;

    await usuario.updateProfile({ displayName: nombre });

    const esNegocio = tipo === "barberia" || tipo === "salon";

    await db.collection(COLECCION_USUARIOS).doc(usuario.uid).set({
        nombre: nombre,
        correo: correo,
        telefono: telefono,
        tipo: tipo,
        estado: "activo",
        fechaRegistro: firebase.firestore.FieldValue.serverTimestamp(),
        fotoPerfil: null,
        negocio: esNegocio ? { nombre: "", direccion: "", horario: "", personal: [], servicios: [] } : null
    });

    return usuario;
}

/** Inicia sesión con correo y contraseña. */
async function iniciarSesion(correo, password) {
    const credencial = await auth.signInWithEmailAndPassword(correo, password);
    return credencial.user;
}

/** Cierra la sesión actual y regresa al usuario a index.html. */
async function cerrarSesion() {
    await auth.signOut();
    window.location.href = "index.html";
}

/** Obtiene el documento de perfil (Firestore) del usuario autenticado. */
async function obtenerDatosUsuario(uid) {
    const doc = await db.collection(COLECCION_USUARIOS).doc(uid).get();
    return doc.exists ? doc.data() : null;
}

/**
 * Protege una página: si no hay sesión, redirige a login.html.
 * Si hay sesión, obtiene el perfil desde Firestore y ejecuta el callback
 * con (usuarioAuth, datosPerfil). Se usa en dashboard.html.
 */
function protegerPagina(callback) {
    auth.onAuthStateChanged(async (usuario) => {
        if (!usuario) {
            window.location.href = "login.html";
            return;
        }
        try {
            const datos = await obtenerDatosUsuario(usuario.uid);
            if (!datos) {
                console.error("No se encontró el perfil del usuario en Firestore.");
                await cerrarSesion();
                return;
            }
            if (datos.estado === "bloqueado") {
                alert("Tu cuenta ha sido suspendida. Contacta al administrador de BeautifyX.");
                await cerrarSesion();
                return;
            }
            callback(usuario, datos);
        } catch (error) {
            console.error("Error al proteger la página:", error);
        }
    });
}

/** Traduce mensajes de error de Firebase Auth a español, para el usuario final. */
function traducirErrorFirebase(codigo) {
    const mensajes = {
        "auth/email-already-in-use": "Ese correo ya está registrado. Intenta iniciar sesión.",
        "auth/invalid-email": "El correo electrónico no es válido.",
        "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
        "auth/user-not-found": "No existe una cuenta con ese correo.",
        "auth/wrong-password": "La contraseña es incorrecta.",
        "auth/invalid-credential": "Correo o contraseña incorrectos.",
        "auth/too-many-requests": "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
        "auth/network-request-failed": "Problema de conexión. Revisa tu internet."
    };
    return mensajes[codigo] || "Ocurrió un error inesperado. Intenta de nuevo.";
}
