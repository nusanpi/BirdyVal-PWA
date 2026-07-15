import { db } from "./firebase.js";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { t } from "./i18n.js";

const feedContainer = document.getElementById("comunidad-feed");

const perfilCache = {};

async function getPerfilUsuario(uid) {
  if (!uid) return null;
  if (perfilCache[uid]) return perfilCache[uid];
  try {
    const snap = await getDoc(doc(db, "usuarios", uid));
    if (snap.exists()) {
      perfilCache[uid] = snap.data();
      return snap.data();
    }
  } catch (err) {
    console.warn('Error cargando perfil de usuario:', err.message);
  }
  return null;
}

async function cargarUltimosAvistamientos() {
  if (!feedContainer) return;

  try {
    const q = query(
      collection(db, "avistamientos"),
      orderBy("fecha", "desc"),
      limit(3),
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      feedContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fa fa-binoculars"></i>
                    <p style="margin: 0.5rem 0 0 0; font-weight: 500;">Aún no hay avistamientos recientes</p>
                    <p style="margin: 0; font-size: 13px; color: #9ca3af;">¡Sé el primero en compartir un avistamiento!</p>
                </div>
            `;
      return;
    }

    feedContainer.innerHTML = "";

    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data();
      const card = await crearTarjetaAvistamiento({ ...data, docId: docSnap.id });
      feedContainer.appendChild(card);
    }
  } catch (error) {
    console.error("Error cargando feed de comunidad:", error);
    feedContainer.innerHTML = `
            <div class="empty-state">
                <i class="fa fa-exclamation-triangle" style="color: #f59e0b;"></i>
                <p style="margin: 0.5rem 0 0 0; font-weight: 500;">Error al cargar avistamientos</p>
                <p style="margin: 0; font-size: 13px; color: #9ca3af;">Intenta recargar la página</p>
            </div>
        `;
  }
}

async function crearTarjetaAvistamiento(data) {
  const div = document.createElement("div");
  div.className = "publicacion-card";
  div.style.cursor = "pointer";

  const userId = data.userId;
  const docId = data.docId;
  const speciesName = data.speciesName || t("common.unknownSpecies");
  const timeAgo = calcularTiempoAtras(data.fecha);
  const lat = data.location ? data.location.lat : 0;
  const lng = data.location ? data.location.lng : 0;
  const sightedVerb = t("common.sighted");

  // Priorizar datos del perfil de Firestore sobre los guardados en el avistamiento
  let userName = data.userName || "Usuario Anónimo";
  let userPhoto = data.userPhoto || "img/user_default.png";

  if (userId) {
    const perfil = await getPerfilUsuario(userId);
    if (perfil) {
      if (perfil.nombre_usuario) userName = perfil.nombre_usuario;
      if (perfil.foto) userPhoto = perfil.foto;
    }
  }

  div.innerHTML = `
        <img src="${userPhoto}" alt="${userName}" class="publicacion__img ${userId ? "clickeable-user" : ""}" onerror="this.src='img/user_default.png'">
        <div class="publicacion__contenido">
            <p><strong class="${userId ? "clickeable-user" : ""}" ${userId ? 'title="Ver perfil de ' + userName + '"' : ""}>${userName}</strong> ${sightedVerb} <em>${speciesName}</em></p>
            <div class="publicacion__meta">
                <span class="location-text">${t("messages.detalle.findingLocation")}</span>
                <time>${timeAgo}</time>
            </div>
        </div>
    `;

  div.addEventListener("click", (e) => {
    if (e.target.closest(".clickeable-user")) return;
    if (docId) {
      window.location.href = `detalle_avistamiento.html?id=${docId}`;
    }
  });

  if (userId) {
    const userImg = div.querySelector(".publicacion__img.clickeable-user");
    const userNameElement = div.querySelector("strong.clickeable-user");

    const clickHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.location.href = `perfil_publico.html?userId=${userId}`;
    };

    if (userImg) {
      userImg.style.cursor = "pointer";
      userImg.addEventListener("click", clickHandler);
      userImg.title = `Ver perfil de ${userName}`;
    }

    if (userNameElement) {
      userNameElement.style.cursor = "pointer";
      userNameElement.addEventListener("click", clickHandler);
    }
  }

  if (lat && lng) {
    resolverUbicacion(lat, lng).then((lugar) => {
      const span = div.querySelector(".location-text");
      if (span) span.innerText = `📍 ${lugar}`;
    });
  } else {
    const span = div.querySelector(".location-text");
    if (span) span.innerText = t("messages.detalle.unknownLocation");
  }

  return div;
}

async function resolverUbicacion(lat, lng) {
  try {
    // API abierta (Nominatim) para obtener el municipio/barrio
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`;
    const res = await fetch(url);
    if (!res.ok) return "C. Valenciana";

    const data = await res.json();
    const addr = data.address;

    const lugar =
      addr.suburb ||
      addr.village ||
      addr.town ||
      addr.city ||
      addr.county ||
      "C. Valenciana";

    return lugar;
  } catch (error) {
    console.warn("Error geocoding:", error);
    return "C. Valenciana";
  }
}

function calcularTiempoAtras(timestamp) {
  if (!timestamp) return "Desconocido";

  const now = new Date();
  const date = timestamp.toDate();
  const diffMs = now - date;
  const diffSeg = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSeg / 60);
  const diffHoras = Math.floor(diffMin / 60);
  const diffDias = Math.floor(diffHoras / 24);

  if (diffSeg < 60) return "Hace un momento";
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHoras < 24) return `Hace ${diffHoras} h`;
  if (diffDias < 7) return `Hace ${diffDias} días`;

  return date.toLocaleDateString();
}

// LOGICA DE REDIRECCION BUSCADOR
function initHomeSearchRedirect() {
  const searchLaunchers = document.querySelectorAll(".buscador-launch");

  searchLaunchers.forEach((element) => {
    element.addEventListener("click", function () {
      window.location.href = "buscador.html";
    });

    element.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        window.location.href = "buscador.html";
      }
    });

    const input = element.querySelector("input");
    if (input) {
      input.addEventListener("focus", function () {
        window.location.href = "buscador.html";
      });
      input.addEventListener("click", function (e) {
        e.preventDefault();
        window.location.href = "buscador.html";
      });
    }
  });

  window.goBuscador = function () {
    window.location.href = "buscador.html";
  };
}

cargarUltimosAvistamientos();
initHomeSearchRedirect();
