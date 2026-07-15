// js/auth.js
import { auth, db, storage } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  updateProfile,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { t } from "./i18n.js";
import { mostrarToast } from "./notificaciones.js";

const registerForm = document.getElementById("registerForm");
const loginForm = document.querySelector(".login-form");
const googleBtn = document.getElementById("googleBtn");
const logoutBtn = document.getElementById("logoutBtn");
const DEFAULT_PROFILE_PHOTO = "img/user_default.png";

function mostrarErrorCampo(id, mensaje) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = mensaje;
  el.classList.add("visible");
}

function limpiarErrorCampo(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("visible");
}

function limpiarTodosErrores(...ids) {
  ids.forEach(limpiarErrorCampo);
}

function isGoogleHostedPhoto(url) {
  if (!url || typeof url !== "string") return false;
  return /googleusercontent\.com|gstatic\.com/i.test(url);
}

async function ensureGoogleUserDoc(user) {
  const docRef = doc(db, "usuarios", user.uid);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    await setDoc(docRef, {
      uid: user.uid,
      nombre_usuario: user.displayName,
      email: user.email,
      nivel: "Novato",
      puntos: 0,
      foto: DEFAULT_PROFILE_PHOTO,
      fecha_registro: new Date().toISOString(),
    });
    return;
  }

  const data = docSnap.data() || {};
  if (!data.foto || isGoogleHostedPhoto(data.foto)) {
    await setDoc(
      docRef,
      {
        foto: DEFAULT_PROFILE_PHOTO,
      },
      { merge: true },
    );
  }
}

//suprimir redirección automática
window._suppressAuthRedirect = window._suppressAuthRedirect || false;

//registro
if (registerForm) {
  // Limpiar error de campo al escribir
  document
    .getElementById("reg-email")
    ?.addEventListener("input", () => limpiarErrorCampo("error-email"));
  document
    .getElementById("reg-username")
    ?.addEventListener("input", () => limpiarErrorCampo("error-username"));
  document
    .getElementById("reg-password")
    ?.addEventListener("input", () => limpiarErrorCampo("error-password"));

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    limpiarTodosErrores("error-email", "error-username", "error-password");

    const username = document.getElementById("reg-username").value;
    const email = document.getElementById("reg-email").value;
    const password = document.getElementById("reg-password").value;
    const bio = document.getElementById("reg-bio").value;
    const photoFile = document.getElementById("reg-photo").files[0];

    const btnSubmit = registerForm.querySelector('button[type="submit"]');

    if (username.length < 3) {
      const msg = t("messages.auth.usernameMin");
      mostrarErrorCampo("error-username", msg);
      mostrarToast(msg, "aviso");
      return;
    }

    // Comprobar si el nombre de usuario ya existe
    try {
      const q = query(
        collection(db, "usuarios"),
        where("nombre_usuario", "==", username),
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const msg = t("messages.auth.usernameTaken");
        mostrarErrorCampo("error-username", msg);
        mostrarToast(msg, "aviso");
        return;
      }
    } catch (error) {
      console.error("Error al comprobar usuario:", error);
      mostrarToast(t("messages.auth.usernameVerifyError"), "error");
      return;
    }

    btnSubmit.disabled = true;
    btnSubmit.innerText = t("messages.auth.creatingAccount");

    try {
      window._suppressAuthRedirect = true;
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const user = userCredential.user;

      let photoURL = "img/user_default.png";

      if (photoFile) {
        try {
          const storageRef = ref(
            storage,
            `usuarios/${user.uid}/perfil_${Date.now()}`,
          );
          const snapshot = await uploadBytes(storageRef, photoFile);
          photoURL = await getDownloadURL(snapshot.ref);
        } catch (uploadErr) {
          console.error("Error al subir foto perfil:", uploadErr);
        }
      }

      await updateProfile(user, {
        displayName: username,
        photoURL: photoURL,
      });

      await setDoc(doc(db, "usuarios", user.uid), {
        uid: user.uid,
        nombre_usuario: username,
        email: email,
        biografia: bio,
        foto: photoURL,
        nivel: "Novato",
        puntos: 0,
        avistamientos_count: 0,
        fotos_count: 0,
        fecha_registro: new Date().toISOString(),
      });

      mostrarToast(
        t("messages.auth.accountCreatedWelcome", { username }),
        "exito",
      );
      setTimeout(() => window.location.replace("index.html"), 1800);
    } catch (error) {
      console.error("Error registro:", error);
      btnSubmit.disabled = false;
      btnSubmit.innerText = t("messages.auth.registerButton");

      if (error.code === "auth/email-already-in-use") {
        const msg = t("messages.auth.emailAlreadyInUse");
        mostrarErrorCampo("error-email", msg);
        mostrarToast(msg, "error");
      } else if (error.code === "auth/weak-password") {
        const msg = t("messages.auth.weakPassword");
        mostrarErrorCampo("error-password", msg);
        mostrarToast(msg, "error");
      } else {
        mostrarToast(
          "Ha ocurrido un error al crear la cuenta. Inténtalo de nuevo.",
          "error",
        );
      }
    }
  });
}

//login
if (loginForm && !registerForm) {
  document.getElementById("login-user")?.addEventListener("input", () => {
    limpiarErrorCampo("error-login-user");
    limpiarErrorCampo("error-login-password");
  });
  document.getElementById("login-password")?.addEventListener("input", () => {
    limpiarErrorCampo("error-login-user");
    limpiarErrorCampo("error-login-password");
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    limpiarTodosErrores("error-login-user", "error-login-password");

    const email = loginForm.user.value;
    const password = loginForm.password.value;

    try {
      await signInWithEmailAndPassword(auth, email, password);
      window.location.replace("index.html");
    } catch (error) {
      console.error(error);
      const msg = t("messages.auth.loginError");
      mostrarErrorCampo("error-login-password", msg);
      mostrarToast(msg, "error");
    }
  });
}

//login google
if (googleBtn) {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  console.log("[AUTH DEBUG] googleBtn encontrado");
  console.log("[AUTH DEBUG] isStandalone:", isStandalone);
  console.log("[AUTH DEBUG] display-mode standalone:", window.matchMedia("(display-mode: standalone)").matches);
  console.log("[AUTH DEBUG] navigator.standalone:", window.navigator.standalone);
  console.log("[AUTH DEBUG] URL actual:", window.location.href);

  // Recoger resultado de redirect (necesario cuando isStandalone=true)
  console.log("[AUTH DEBUG] Llamando getRedirectResult...");
  getRedirectResult(auth)
    .then(async (result) => {
      console.log("[AUTH DEBUG] getRedirectResult result:", result);
      console.log("[AUTH DEBUG] getRedirectResult user:", result?.user?.email ?? "null");
      if (!result?.user) {
        console.log("[AUTH DEBUG] getRedirectResult: sin usuario, no se redirige");
        return;
      }
      console.log("[AUTH DEBUG] getRedirectResult OK → ensureGoogleUserDoc...");
      await ensureGoogleUserDoc(result.user);
      console.log("[AUTH DEBUG] getRedirectResult → redirigiendo a index.html");
      window.location.replace("index.html");
    })
    .catch((error) => {
      console.error("[AUTH DEBUG] getRedirectResult ERROR:", error?.code, error?.message, error);
      if (error?.code !== "auth/no-auth-event") {
        mostrarToast("Error al iniciar con Google. Inténtalo de nuevo.", "error");
      }
    });

  googleBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    console.log("[AUTH DEBUG] Click en googleBtn");
    console.log("[AUTH DEBUG] isStandalone en click:", isStandalone);
    console.log("[AUTH DEBUG] → usando signInWithPopup (funciona en navegador y PWA móvil)");
    try {
      window._suppressAuthRedirect = true;
      const result = await signInWithPopup(auth, provider);
      console.log("[AUTH DEBUG] signInWithPopup OK, user:", result?.user?.email);
      await ensureGoogleUserDoc(result.user);
      window.location.replace("index.html");
    } catch (error) {
      console.error("[AUTH DEBUG] signInWithPopup ERROR:", error?.code, error?.message, error);

      // El usuario cerró el popup: no mostrar error
      if (error?.code === "auth/popup-closed-by-user") {
        console.log("[AUTH DEBUG] Popup cerrado por el usuario, sin acción");
        return;
      }

      // Popup bloqueado → fallback a redirect
      const shouldFallbackToRedirect = [
        "auth/popup-blocked",
        "auth/cancelled-popup-request",
        "auth/operation-not-supported-in-this-environment",
      ].includes(error?.code);

      if (shouldFallbackToRedirect) {
        console.log("[AUTH DEBUG] Popup bloqueado → fallback a signInWithRedirect");
        try {
          await signInWithRedirect(auth, provider);
        } catch (redirectError) {
          console.error("[AUTH DEBUG] signInWithRedirect fallback ERROR:", redirectError?.code, redirectError?.message);
          mostrarToast(
            t("messages.auth.googleErrorPrefix") + redirectError.message,
            "error",
          );
        }
        return;
      }

      mostrarToast(
        t("messages.auth.googleErrorPrefix") + error.message,
        "error",
      );
    }
  });
}

//logout
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
    window.location.replace("login.html");
  });
}

onAuthStateChanged(auth, (user) => {
  const path = window.location.pathname;
  console.log("[AUTH DEBUG] onAuthStateChanged fired — user:", user?.email ?? "null", "| path:", path, "| _suppressAuthRedirect:", window._suppressAuthRedirect);

  if (window._suppressAuthRedirect) {
    console.log("[AUTH DEBUG] onAuthStateChanged: suprimido, no redirige");
    return;
  }

  if (user) {
    if (path.includes("login.html") || path.includes("registro.html")) {
      console.log("[AUTH DEBUG] onAuthStateChanged: usuario logueado en login/registro → redirigiendo a index.html");
      window.location.replace("index.html");
    }
  } else {
    console.log("[AUTH DEBUG] onAuthStateChanged: sin usuario");
  }
});
