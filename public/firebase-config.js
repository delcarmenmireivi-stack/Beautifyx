//==========================================================================
// BEAUTIFYX - CONFIGURACIÓN DE FIREBASE (sin cambios)
// Este archivo conecta TODO el proyecto (login, registro y dashboard)
//==========================================================================

const firebaseConfig = {
  apiKey: "AIzaSyDaWRKzW8GM1EevRUVZKqtqdYoiww1NhCs",
  authDomain: "beautifyx-ae2ae.firebaseapp.com",
  projectId: "beautifyx-ae2ae",
  storageBucket: "beautifyx-ae2ae.firebasestorage.app",
  messagingSenderId: "665342587281",
  appId: "1:665342587281:web:268f1c3bae9fb53a502a30",
  measurementId: "G-K35BZH8PVX"
};

// Validar que la librería de Firebase se haya cargado previamente en el HTML
if (typeof firebase === 'undefined') {
  console.error("❌ ERROR: Las librerías SDK de Firebase no se han cargado en el HTML antes de este script.");
} else {
  // Inicializa Firebase globalmente
  firebase.initializeApp(firebaseConfig);
  var auth = firebase.auth();
  var db = firebase.firestore();
  console.log("🚀 Firebase inicializado correctamente en el entorno.");
}
