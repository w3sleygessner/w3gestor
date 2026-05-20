import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ADICIONE A PALAVRA 'export' AQUI:
export const firebaseConfig = {
    apiKey: "AIzaSyAQhMr13jcGP5AxRBYa2uTf9pM4Sevj2tE",
    authDomain: "w3-gestor.firebaseapp.com",
    projectId: "w3-gestor",
    storageBucket: "w3-gestor.firebasestorage.app",
    messagingSenderId: "392898800309",
    appId: "1:392898800309:web:e11c73d1cab9db02512cfc",
    measurementId: "G-DQNRD4E44J"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db_firebase = getDatabase(app);