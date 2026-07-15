import { auth, db } from "./firebase.js";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import "./i18n.js";

const DEFAULT_PROFILE_PHOTO = "img/user_default.png";

function isGoogleHostedPhoto(url) {
  if (!url || typeof url !== "string") return false;
  return /googleusercontent\.com|gstatic\.com/i.test(url);
}

class Cabecera extends HTMLElement {
  constructor() {
    super();
    this.innerHTML = `
  <header class="header">
    <a id="btnMensajesHeader" href="mensajes.html" class="header-msg-btn" title="Mensajes" aria-label="Ir a mensajes">
      <i class="fa fa-comment-dots" aria-hidden="true"></i>
    </a>
    <div class="header-logo-group">
      <img src="img/logo_sintexto.png" alt="Logo BirdyVal" class="logo">
      <img src="img/texto.png" alt="Texto BirdyVal" class="logo-texto">
    </div>
    <div style="width:40px;"></div>
  </header>
`;
  }
  connectedCallback() {
    const btnMensajes = this.querySelector("#btnMensajesHeader");

    // Ocultar el icono si ya estamos en la página de mensajes
    if (btnMensajes && window.location.pathname.endsWith("mensajes.html")) {
      btnMensajes.style.display = "none";
    }

    const actualizarBadgeMensajes = (uid) => {
      const chatsRef = collection(db, "chats");
      const q = query(chatsRef, where("participantes", "array-contains", uid));
      onSnapshot(q, (snap) => {
        if (!btnMensajes) return;
        let chatsConNoLeidos = 0;
        snap.forEach((d) => {
          const data = d.data();
          if ((data[`noLeidos_${uid}`] || 0) > 0) chatsConNoLeidos++;
        });
        const prev = btnMensajes.querySelector(".nav-badge");
        if (prev) prev.remove();
        if (chatsConNoLeidos > 0) {
          const badge = document.createElement("span");
          badge.className = "nav-badge";
          badge.textContent = chatsConNoLeidos;
          badge.setAttribute("aria-label", `${chatsConNoLeidos} conversaciones con mensajes nuevos`);
          btnMensajes.appendChild(badge);
        }
      });
    };

    auth.onAuthStateChanged((user) => {
      if (user) actualizarBadgeMensajes(user.uid);
    });
  }
}
window.customElements.define("mi-cabecera", Cabecera);

class Pie extends HTMLElement {
  constructor() {
    super();
    this.innerHTML = `
    <footer class="footer">
    <!-- Barra de navegación inferior -->
    <div class="bottom-nav-wrapper">
      <div class="bottom-nav" role="navigation" aria-label="Navegación inferior">

        <a class="nav-btn nav-home" href="index.html" title="Inicio" aria-label="Ir a home">
          <i class="fa fa-home" aria-hidden="true"></i>
        </a>

        <div class="nav-btn nav-add">
          <a  style="text-decoration: none;" href="subir_avistamiento.html" id="addButton" class="add-button" title="Añadir">
            <i class="fa fa-plus" aria-hidden="true"></i>
          </a>
        </div>

        <a id="btnPerfil" class="nav-btn nav-profile" href="perfil.html" title="Perfil" aria-label="Ir a iniciar sesión">
          <i class="fa fa-user" aria-hidden="true"></i>
        </a>
      </div>
    </div>

    <div style="text-align:center; padding: 0.5rem 0 0.25rem; font-size:0.75rem;">
      <a href="privacidad.html" style="color:var(--color-muted); text-decoration:none;">Política de privacidad</a>
    </div>
  </footer>
        `;
  }
  connectedCallback() {
    const btnPerfil = this.querySelector("#btnPerfil");
    const btnAdd = this.querySelector("#addButton");

    const renderProfileAvatar = (url) => {
      btnPerfil.innerHTML = `<img src="${url}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;" onerror="this.outerHTML='<i class=\\'fa fa-user\\'></i>'">`;
    };

    // Mostrar foto de perfil si está logueado
    auth.onAuthStateChanged(async (user) => {
      if (!btnPerfil) return;

      if (!user) {
        renderProfileAvatar(DEFAULT_PROFILE_PHOTO);
        return;
      }

      try {
        const perfilRef = doc(db, "usuarios", user.uid);
        const perfilSnap = await getDoc(perfilRef);
        const fotoPerfil = perfilSnap.exists() ? perfilSnap.data()?.foto : null;

        if (fotoPerfil && !isGoogleHostedPhoto(fotoPerfil)) {
          renderProfileAvatar(fotoPerfil);
          return;
        }
      } catch (error) {
        console.error("No se pudo cargar foto de perfil para footer:", error);
      }

      renderProfileAvatar(DEFAULT_PROFILE_PHOTO);
    });

    if (btnPerfil || btnAdd) {
      btnPerfil.addEventListener("click", (e) => {
        e.preventDefault();

        const usuario = auth.currentUser;

        if (usuario) {
          window.location.href = "perfil.html";
        } else {
          window.location.href = "login.html";
        }
      });
    }
  }
}
window.customElements.define("mi-pie", Pie);

// Registro de Service Worker para PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
      .then(registration => {
        console.log('[PWA] Service Worker registrado con éxito en el scope:', registration.scope);
      })
      .catch(error => {
        console.error('[PWA] Error al registrar el Service Worker:', error);
      });
  });
}
