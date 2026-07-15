// js/perfil_publico.js
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  arrayUnion,
  arrayRemove,
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
const btnSeguir = document.getElementById("btnSeguir");
const btnSiguiendo = document.getElementById("btnSiguiendo");
const btnMensaje = document.getElementById("btnMensaje");
const loadingAction = document.getElementById("loadingAction");
const gridAvistamientos = document.getElementById("gridAvistamientos");
const panelPremios = document.getElementById("panel-premios");

let cachedUserData = null;
let cachedUserId = null;
let usuarioActualId = null;
let usuarioPerfilId = null;
let estadoSeguimiento = false;
let perfilSeguidoresCount = 0;

function obtenerParametroURL(nombre) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(nombre);
}

function getCurrentLang() {
  return localStorage.getItem("userLanguage") || "es";
}

function getDefaultBio() {
  return getCurrentLang() === "ca"
    ? "Benvingut/da a la comunitat de BirdyVal! Explora, avista i registra aus de la Comunitat Valenciana."
    : "¡Bienvenido a la comunidad de BirdyVal! Explora, avista y registra aves de la Comunidad Valenciana.";
}

function renderizarLogros(misLogrosIds) {
  const lang = getCurrentLang();
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

  if (panelPremios) {
    panelPremios.innerHTML = html;
  }
}

async function cargarDatosPerfilPublico(uid) {
  const docRef = doc(db, "usuarios", uid);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    console.error("Usuario no encontrado en la base de datos.");
    if (domUsername) domUsername.innerText = t("common.unknownUser");
    mostrarToast(t("user.notFound"), "error");
    setTimeout(() => window.history.back(), 1800);
    return null;
  }

  const data = docSnap.data();
  cachedUserData = data;
  cachedUserId = uid;
  const puntos = data.puntos || 0;
  const nivelData = calcularNivel(puntos);

  if (domUsername)
    domUsername.innerText = data.nombre_usuario || t("common.unknownUser");
  if (domNivel)
    domNivel.innerHTML = `${nivelData.icon} ${nivelData.nombre} • ${puntos} pts`;
  if (domBio) domBio.innerText = data.biografia || getDefaultBio();
  if (data.foto && domAvatar) domAvatar.src = data.foto;

  perfilSeguidoresCount = Array.isArray(data.seguidores)
    ? data.seguidores.length
    : 0;

  if (domStatSeguidores)
    domStatSeguidores.innerText = String(perfilSeguidoresCount);
  if (domStatSiguiendo)
    domStatSiguiendo.innerText = String((data.siguiendo || []).length);
  if (domStatAvistamientos)
    domStatAvistamientos.innerText = String(data.avistamientos_count || 0);

  renderizarLogros(data.logros || []);
  return data;
}

async function cargarGaleriaAvistamientos(uid) {
  if (!gridAvistamientos) return;

  gridAvistamientos.innerHTML =
    '<p class="loading-text" data-i18n="perfil.loadingPhotosPublic">Cargando fotos...</p>';

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
          <p data-i18n="user.noSightings">Este usuario aún no tiene avistamientos.</p>
        </div>
      `;
      return;
    }

    const avistamientos = [];
    querySnapshot.forEach((docSnap) => {
      avistamientos.push({ id: docSnap.id, ...docSnap.data() });
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

      div.innerHTML = `
        <img src="${avi.fotoUrl}" alt="${avi.speciesName}" loading="lazy" />
      `;
      gridAvistamientos.appendChild(div);
    });
  } catch (error) {
    console.error("Error cargando galería:", error);
    gridAvistamientos.innerHTML =
      '<p class="error-text" data-i18n="perfil.photosLoadError">No se pudieron cargar las fotos.</p>';
  }
}

async function verificarEstadoSeguimiento() {
  try {
    const docRef = doc(db, "usuarios", usuarioActualId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const siguiendo = docSnap.data().siguiendo || [];
      estadoSeguimiento = siguiendo.includes(usuarioPerfilId);
      mostrarBotonSeguimiento();
    }
  } catch (error) {
    console.error("Error verificando seguimiento:", error);
    mostrarBotonSeguimiento();
  }
}

function mostrarBotonSeguimiento() {
  if (loadingAction) loadingAction.style.display = "none";
  if (estadoSeguimiento) {
    if (btnSiguiendo) btnSiguiendo.style.display = "inline-block";
    if (btnSeguir) btnSeguir.style.display = "none";
  } else {
    if (btnSeguir) btnSeguir.style.display = "inline-block";
    if (btnSiguiendo) btnSiguiendo.style.display = "none";
  }
  if (btnMensaje) btnMensaje.style.display = "block";
}

async function seguirUsuario() {
  try {
    if (!btnSeguir) return;
    btnSeguir.disabled = true;
    btnSeguir.innerText = t("profilePublic.followingDots");

    await updateDoc(doc(db, "usuarios", usuarioActualId), {
      siguiendo: arrayUnion(usuarioPerfilId),
    });

    estadoSeguimiento = true;
    perfilSeguidoresCount += 1;
    if (domStatSeguidores) {
      domStatSeguidores.innerText = String(perfilSeguidoresCount);
    }

    mostrarBotonSeguimiento();
    btnSeguir.disabled = false;
    btnSeguir.innerText = t("profilePublic.follow");
  } catch (error) {
    console.error("Error siguiendo usuario:", error);
    mostrarToast(t("profilePublic.followError"), "error");
    if (btnSeguir) {
      btnSeguir.disabled = false;
      btnSeguir.innerText = t("profilePublic.follow");
    }
  }
}

async function dejarDeSeguir() {
  try {
    if (!btnSiguiendo) return;
    btnSiguiendo.disabled = true;
    btnSiguiendo.innerText = t("profilePublic.processingDots");

    await updateDoc(doc(db, "usuarios", usuarioActualId), {
      siguiendo: arrayRemove(usuarioPerfilId),
    });

    estadoSeguimiento = false;
    perfilSeguidoresCount = Math.max(0, perfilSeguidoresCount - 1);
    if (domStatSeguidores) {
      domStatSeguidores.innerText = String(perfilSeguidoresCount);
    }

    mostrarBotonSeguimiento();
    btnSiguiendo.disabled = false;
    btnSiguiendo.innerText = t("profilePublic.following");
  } catch (error) {
    console.error("Error dejando de seguir usuario:", error);
    mostrarToast(t("profilePublic.unfollowError"), "error");
    if (btnSiguiendo) {
      btnSiguiendo.disabled = false;
      btnSiguiendo.innerText = t("profilePublic.following");
    }
  }
}

btnSeguir?.addEventListener("click", seguirUsuario);
btnSiguiendo?.addEventListener("click", () => {
  if (confirm(t("profilePublic.confirmUnfollow"))) {
    dejarDeSeguir();
  }
});
btnMensaje?.addEventListener("click", () => {
  if (usuarioPerfilId) {
    window.location.href = `chat.html?userId=${usuarioPerfilId}`;
  }
});

const toggle = document.querySelector(".perfil-toggle");
const indicator = toggle?.querySelector(".toggle-indicator");
const panels = {
  avistamientos: document.getElementById("panel-avistamientos"),
  premios: document.getElementById("panel-premios"),
};

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
      if (!panel) return;
      if (key === target) {
        panel.classList.remove("hidden");
        panel.style.animation = "fadeIn 0.3s ease";
      } else {
        panel.classList.add("hidden");
      }
    });
  });
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    usuarioActualId = user.uid;
    usuarioPerfilId = obtenerParametroURL("userId");

    if (!usuarioPerfilId) {
      mostrarToast(t("profilePublic.missingUserId"), "error");
      setTimeout(() => (window.location.href = "index.html"), 1800);
      return;
    }

    if (usuarioPerfilId === usuarioActualId) {
      window.location.href = "perfil.html";
      return;
    }

    try {
      await Promise.all([
        cargarDatosPerfilPublico(usuarioPerfilId),
        cargarGaleriaAvistamientos(usuarioPerfilId),
        verificarEstadoSeguimiento(),
      ]);
    } catch (error) {
      console.error("Error cargando perfil público:", error);
      mostrarToast(t("profilePublic.loadError"), "error");
      setTimeout(() => window.history.back(), 1800);
    }
  } else {
    window.location.href = "login.html";
  }
});

document.addEventListener("birdyval:language-changed", () => {
  if (!cachedUserData) return;

  const data = cachedUserData;
  const puntos = data.puntos || 0;
  const nivelData = calcularNivel(puntos);
  if (domNivel)
    domNivel.innerHTML = `${nivelData.icon} ${nivelData.nombre} • ${puntos} pts`;
  if (domBio) {
    domBio.innerText = data.biografia || getDefaultBio();
  }
  if (btnSeguir) {
    btnSeguir.innerText = t("profilePublic.follow");
  }
  if (btnSiguiendo) {
    btnSiguiendo.innerText = t("profilePublic.following");
  }
  if (panelPremios) {
    renderizarLogros(data.logros || []);
  }
});
