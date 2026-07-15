// js/perfil.js
import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { calcularNivel, LISTA_LOGROS, getLogroTexto } from "./gamificacion.js";
import { t } from "./i18n.js";
import { mostrarToast } from "./notificaciones.js";

const domUsername = document.getElementById("perfilUsuario");
const domAvatar = document.querySelector(".perfil-avatar img");
const domNivel = document.querySelector(".nivel-tag");
const domBio = document.querySelector(".perfil-bio");
const domStatSeguidores = document.getElementById("statSeguidores");
const domStatSiguiendo = document.getElementById("statSiguiendo");
const domStatAvistamientos = document.getElementById("statAvistamientos");
const btnAction = document.querySelector(".perfil-actions button");
const gridAvistamientos = document.getElementById("gridAvistamientos");
const panelPremios = document.getElementById("panel-premios");

let cachedUserData = null;
let cachedUserId = null;

onAuthStateChanged(auth, async (user) => {
  if (user) {
    await Promise.all([
      cargarDatosPerfil(user.uid),
      cargarGaleriaAvistamientos(user.uid),
    ]);
  } else {
    window.location.href = "login.html";
  }
});

async function cargarDatosPerfil(uid) {
  try {
    const docRef = doc(db, "usuarios", uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      cachedUserData = data;
      cachedUserId = uid;
      const puntos = data.puntos || 0;
      const nivelData = calcularNivel(puntos);

      domUsername.innerText = data.nombre_usuario || t("common.unknownUser");
      domNivel.innerHTML = `${nivelData.icon} ${nivelData.nombre} • ${puntos} pts`;

      if (domBio && data.biografia) {
        domBio.innerText = data.biografia;
      } else if (domBio) {
        const lang = localStorage.getItem("userLanguage") || "es";
        domBio.innerText =
          lang === "ca"
            ? "Benvingut/da a la comunitat de BirdyVal! Explora, avista i registra aus de la Comunitat Valenciana."
            : "¡Bienvenido a la comunidad de BirdyVal! Explora, avista y registra aves de la Comunidad Valenciana.";
      }

      if (data.foto) {
        domAvatar.src = data.foto;
      }

      if (domStatSeguidores) {
        const seguidores = Array.isArray(data.seguidores)
          ? data.seguidores
          : [];
        domStatSeguidores.innerText = String(seguidores.length);
      }

      if (domStatSiguiendo) {
        const siguiendo = Array.isArray(data.siguiendo) ? data.siguiendo : [];
        domStatSiguiendo.innerText = String(siguiendo.length);
      }

      if (panelPremios) {
        renderizarLogros(data.logros || []);
      }

      if (btnAction) {
        const lang = localStorage.getItem("userLanguage") || "es";
        btnAction.innerText = lang === "ca" ? "Tancar Sessió" : "Cerrar Sesión";
        btnAction.classList.add("btn-danger");
        btnAction.onclick = cerrarSesion;
      }
    } else {
      console.error("Usuario autenticado pero sin ficha en Firestore.");
      domUsername.innerText = t("common.unknownUser");
    }
  } catch (error) {
    console.error("Error cargando perfil:", error);
  }
}

function renderizarLogros(misLogrosIds) {
  const lang = localStorage.getItem("userLanguage") || "es";
  const tituloSeccion = lang === "ca" ? "Els meus assoliments" : "Mis Logros";
  const sinLogros =
    lang === "ca"
      ? "Encara no tens assoliments. Puja avistaments!"
      : "Aún no tienes logros. ¡Sube avistamientos!";
  let html = `<h2 class="perfil-feed-title">${tituloSeccion}</h2>`;

  if (misLogrosIds.length === 0) {
    html += `<p style="text-align:center; color:#888;">${sinLogros}</p>`;
  }

  LISTA_LOGROS.forEach((logro) => {
    const conseguido = misLogrosIds.includes(logro.id);
    const claseEstado = conseguido ? "conseguido" : "bloqueado";
    const icono = conseguido ? logro.icon : "🔒";
    const textos = getLogroTexto(logro);

    html += `
            <div class="premio-card ${claseEstado}" style="${conseguido ? "" : "opacity: 0.5; filter: grayscale(1);"}">
                <div class="premio-icon" style="font-size: 1.5rem;">${icono}</div>
                <div class="premio-info">
                    <p class="premio-titulo" style="font-weight:bold;">${textos.titulo}</p>
                    <p class="premio-desc" style="font-size:0.85rem;">${textos.desc}</p>
                </div>
            </div>
        `;
  });

  panelPremios.innerHTML = html;
}

async function cargarGaleriaAvistamientos(uid) {
  if (!gridAvistamientos) return;

  gridAvistamientos.innerHTML =
    '<p class="loading-text" data-i18n="perfil.loadingPhotos">Cargando tus fotos...</p>';

  try {
    const q = query(
      collection(db, "avistamientos"),
      where("userId", "==", uid),
    );

    const querySnapshot = await getDocs(q);

    if (domStatAvistamientos) {
      domStatAvistamientos.innerText = querySnapshot.size;
    }

    gridAvistamientos.innerHTML = "";

    if (querySnapshot.empty) {
      gridAvistamientos.innerHTML = `
                <div class="empty-state">
                    <i class="fa fa-camera"></i>
                    <p data-i18n="perfil.noSightings">Aún no tienes avistamientos.</p>
                    <a href="subir_avistamiento.html" class="link-action" data-i18n="perfil.uploadFirst">¡Sube el primero!</a>
                </div>
            `;
      return;
    }

    let avistamientos = [];
    querySnapshot.forEach((doc) => {
      avistamientos.push({ id: doc.id, ...doc.data() });
    });

    avistamientos.sort((a, b) => {
      const fechaA = a.fecha ? a.fecha.seconds : 0;
      const fechaB = b.fecha ? b.fecha.seconds : 0;
      return fechaB - fechaA;
    });

    avistamientos.forEach((avi) => {
      const div = document.createElement("div");
      div.className = "grid-item";
      div.onclick = () => {
        window.location.href = `detalle_avistamiento.html?id=${avi.id}`;
      };

      const imgSrc = avi.fotoUrl ? avi.fotoUrl : (avi.audioUrl ? 'img/audio_placeholder.png' : 'img/user_default.png');
      div.innerHTML = `
                <img src="${imgSrc}" alt="${avi.speciesName}" loading="lazy" />
            `;
      gridAvistamientos.appendChild(div);
    });
  } catch (error) {
    console.error("Error cargando galería:", error);
    gridAvistamientos.innerHTML =
      '<p class="error-text" data-i18n="perfil.photosLoadError">No se pudieron cargar las fotos.</p>';
  }
}

async function cerrarSesion() {
  if (confirm(t("messages.perfil.logoutConfirm"))) {
    try {
      await signOut(auth);
      window.location.href = "login.html";
    } catch (error) {
      mostrarToast(t("messages.perfil.logoutErrorPrefix") + error.message, "error");
    }
  }
}

const toggle = document.querySelector(".perfil-toggle");
const indicator = toggle?.querySelector(".toggle-indicator");
const panels = {
  avistamientos: document.getElementById("panel-avistamientos"),
  premios: document.getElementById("panel-premios"),
};
//interruptor de avistamientos/premios
if (toggle) {
  toggle.addEventListener("click", (e) => {
    const btn = e.target.closest(".toggle-btn");
    if (!btn) return;

    const target = btn.dataset.target;

    toggle.querySelectorAll(".toggle-btn").forEach((b) => {
      const isActive = b.dataset.target === target;
      b.classList.toggle("active", isActive);
      b.setAttribute("aria-selected", isActive);
    });

    if (indicator) {
      indicator.style.transform =
        target === "premios" ? "translateX(100%)" : "translateX(0)";
    }

    Object.keys(panels).forEach((key) => {
      const panel = panels[key];
      if (key === target) {
        panel.classList.remove("hidden");

        panel.style.animation = "fadeIn 0.3s ease";
      } else {
        panel.classList.add("hidden");
      }
    });
  });
}

// Re-renderizar datos al cambiar idioma
document.addEventListener("birdyval:language-changed", () => {
  if (cachedUserData) {
    const data = cachedUserData;
    const puntos = data.puntos || 0;
    const nivelData = calcularNivel(puntos);
    domNivel.innerHTML = `${nivelData.icon} ${nivelData.nombre} • ${puntos} pts`;

    if (domBio && data.biografia) {
      domBio.innerText = data.biografia;
    } else if (domBio) {
      const lang = localStorage.getItem("userLanguage") || "es";
      domBio.innerText =
        lang === "ca"
          ? "Benvingut/da a la comunitat de BirdyVal! Explora, avista i registra aus de la Comunitat Valenciana."
          : "¡Bienvenido a la comunidad de BirdyVal! Explora, avista y registra aves de la Comunidad Valenciana.";
    }

    if (domStatSeguidores) {
      const seguidores = Array.isArray(data.seguidores) ? data.seguidores : [];
      domStatSeguidores.innerText = String(seguidores.length);
    }

    if (domStatSiguiendo) {
      const siguiendo = Array.isArray(data.siguiendo) ? data.siguiendo : [];
      domStatSiguiendo.innerText = String(siguiendo.length);
    }

    if (btnAction) {
      const lang = localStorage.getItem("userLanguage") || "es";
      btnAction.innerText = lang === "ca" ? "Tancar Sessió" : "Cerrar Sesión";
    }

    if (panelPremios) {
      renderizarLogros(data.logros || []);
    }
  }
});
