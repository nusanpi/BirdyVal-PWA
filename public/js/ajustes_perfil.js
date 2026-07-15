import { auth, db } from "./firebase.js";
import { t } from "./i18n.js";
import { mostrarToast } from "./notificaciones.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const form = document.getElementById("profileForm");
const fileInput = document.getElementById("fileInput");
const previewAvatar = document.getElementById("previewAvatar");

fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      previewAvatar.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
});

//funcion de firebase que compreba si hay usuario
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const uid = user.uid;
    const docRef = doc(db, "usuarios", uid);

    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const datos = snap.data();
      form.nombreUsuario.value = datos.nombre_usuario || "";
      form.bioUsuario.value = datos.biografia || "";
      previewAvatar.src = datos.foto || "";
      form.emailUsuario.value = datos.email || "";
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const nombreusuario = form.nombreUsuario.value.trim();
      const bio = form.bioUsuario.value.trim();
      const fotoperf = previewAvatar.src;

      await updateDoc(docRef, {
        nombre_usuario: nombreusuario,
        biografia: bio,
        foto: fotoperf,
      });
      mostrarToast(t("Perfil actualizado correctamente."), "exito");
      setTimeout(() => (window.location.href = "perfil.html"), 1800);
    });
  } else {
    window.location.href = "login.html";
  }
});
