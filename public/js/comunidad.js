import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  where,
  getDocs,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { t } from "./i18n.js";

const feedCommunity = document.getElementById("feedComunidad");
const feedFollowed = document.getElementById("feedSeguidos");
const loaderCommunity = document.getElementById("loaderComunidad");
const loaderFollowed = document.getElementById("loaderSeguidos");
const feedToggle = document.querySelector(".community-toggle");
const feedIndicator = feedToggle?.querySelector(".toggle-indicator");
const panels = {
  comunidad: document.getElementById("panel-comunidad"),
  siguiendo: document.getElementById("panel-seguidos"),
};

let lastCommunityDoc = null;
let loadingCommunity = false;
let finishedCommunity = false;
let activeTab = "comunidad";
let currentUserId = null;
let followingIds = [];
let followedLoaded = false;
let communityLoadedOnce = false;

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

function getTimestampValue(timestamp) {
  if (!timestamp) return 0;
  if (typeof timestamp.toMillis === "function") return timestamp.toMillis();
  if (typeof timestamp.seconds === "number") return timestamp.seconds * 1000;
  return 0;
}

function chunkArray(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function renderEmpty(
  container,
  iconClass,
  title,
  description,
  actionHtml = "",
) {
  if (!container) return;

  container.innerHTML = `
    <div class="empty-state community-empty">
      <i class="fa ${iconClass}"></i>
      <p class="community-empty-title">${title}</p>
      <p class="community-empty-description">${description}</p>
      ${actionHtml}
    </div>
  `;
}

function renderLoader(container, text) {
  if (!container) return;
  container.style.display = "block";
  container.innerHTML = `<div class="loader">${text}</div>`;
}

async function crearTarjetaAvistamiento(data) {
  const div = document.createElement("div");
  div.className = "post-card";

  const userId = data.userId;
  const docId = data.docId;
  const lat = data.location ? data.location.lat : 0;
  const lng = data.location ? data.location.lng : 0;
  const speciesName = data.speciesName || t("common.unknownSpecies");
  const timeAgo = calcularTiempoAtras(data.fecha);
  const sightedVerb = t("common.sighted");

  let userName = data.userName || t("common.unknownUser");
  let userPhoto = data.userPhoto || "img/user_default.png";

  if (userId) {
    const perfil = await getPerfilUsuario(userId);
    if (perfil) {
      if (perfil.nombre_usuario) userName = perfil.nombre_usuario;
      if (perfil.foto) userPhoto = perfil.foto;
    }
  }

  div.innerHTML = `
    <div class="post-info">
      <div class="post-header">
        <img src="${userPhoto}" alt="${userName}" class="post-avatar ${userId ? "clickeable-user" : ""}" onerror="this.src='img/user_default.png'">
        <span class="post-username ${userId ? "clickeable-user" : ""}" ${userId ? 'title="Ver perfil de ' + userName + '"' : ""}>${userName}</span>
      </div>
    </div>
    <img src="${data.fotoUrl}" class="post-photo" alt="${speciesName}" onerror="this.style.display='none'">
    <div class="post-info">
      <span class="post-species"><i class="fa fa-dove"></i> ${sightedVerb} <em>${speciesName}</em></span>
      <div class="post-meta-row">
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
    const userImg = div.querySelector(".post-avatar.clickeable-user");
    const userNameElement = div.querySelector(".post-username.clickeable-user");

    const clickHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.location.href = `perfil_publico.html?userId=${userId}`;
    };

    userImg?.addEventListener("click", clickHandler);
    userNameElement?.addEventListener("click", clickHandler);
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

function calcularTiempoAtras(timestamp) {
  if (!timestamp) return "Desconocido";

  const now = new Date();
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
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

async function resolverUbicacion(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`;
    const res = await fetch(url);
    if (!res.ok) return "C. Valenciana";

    const data = await res.json();
    const addr = data.address;

    return (
      addr.suburb ||
      addr.village ||
      addr.town ||
      addr.city ||
      addr.county ||
      "C. Valenciana"
    );
  } catch (error) {
    console.warn("Error geocoding:", error);
    return "C. Valenciana";
  }
}

async function cargarMasComunidad() {
  if (loadingCommunity || finishedCommunity || activeTab !== "comunidad")
    return;
  loadingCommunity = true;
  renderLoader(loaderCommunity, t("messages.comunidad.loadingCommunity"));

  try {
    let q = query(
      collection(db, "avistamientos"),
      orderBy("fecha", "desc"),
      limit(5),
    );

    if (lastCommunityDoc) {
      q = query(
        collection(db, "avistamientos"),
        orderBy("fecha", "desc"),
        startAfter(lastCommunityDoc),
        limit(5),
      );
    }

    const snap = await getDocs(q);

    if (snap.empty) {
      finishedCommunity = true;
      renderEmpty(
        feedCommunity,
        "fa-binoculars",
        t("messages.comunidad.noCommunitySightings"),
        t("messages.comunidad.noCommunitySightings"),
      );
      loaderCommunity.style.display = "none";
      loadingCommunity = false;
      return;
    }

    if (!communityLoadedOnce) {
      feedCommunity.innerHTML = "";
      communityLoadedOnce = true;
    }

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const card = await crearTarjetaAvistamiento({
        ...data,
        docId: docSnap.id,
      });
      feedCommunity.appendChild(card);
    }

    lastCommunityDoc = snap.docs[snap.docs.length - 1];
    loaderCommunity.style.display = "none";
  } catch (error) {
    console.error("Error cargando feed de comunidad:", error);
    renderEmpty(
      feedCommunity,
      "fa-exclamation-triangle",
      t("messages.comunidad.feedLoadError"),
      t("messages.comunidad.feedLoadError"),
    );
  } finally {
    loadingCommunity = false;
  }
}

async function cargarAvistamientosSeguidos() {
  if (!feedFollowed) return;

  if (!currentUserId) {
    loaderFollowed.style.display = "none";
    renderEmpty(
      feedFollowed,
      "fa-right-to-bracket",
      t("messages.comunidad.loginToSeeFollowed"),
      t("messages.comunidad.loginToSeeFollowed"),
      `<a class="community-login-action" href="login.html">${t("messages.comunidad.loginAction")}</a>`,
    );
    return;
  }

  if (!followingIds.length) {
    loaderFollowed.style.display = "none";
    renderEmpty(
      feedFollowed,
      "fa-user-group",
      t("messages.comunidad.noFollowedSightings"),
      t("messages.comunidad.noFollowedSightings"),
    );
    return;
  }

  renderLoader(loaderFollowed, t("messages.comunidad.loadingFollowed"));
  feedFollowed.innerHTML = "";

  try {
    const resultados = [];
    const chunks = chunkArray(followingIds, 10);

    for (const chunk of chunks) {
      const q = query(
        collection(db, "avistamientos"),
        where("userId", "in", chunk),
      );
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((docSnap) => {
        resultados.push({ id: docSnap.id, ...docSnap.data() });
      });
    }

    resultados.sort(
      (a, b) => getTimestampValue(b.fecha) - getTimestampValue(a.fecha),
    );

    if (!resultados.length) {
      renderEmpty(
        feedFollowed,
        "fa-user-group",
        t("messages.comunidad.noFollowedSightings"),
        t("messages.comunidad.noFollowedSightings"),
      );
      return;
    }

    for (const avi of resultados.slice(0, 25)) {
      const card = await crearTarjetaAvistamiento({ ...avi, docId: avi.id });
      feedFollowed.appendChild(card);
    }
    followedLoaded = true;
    loaderFollowed.style.display = "none";
  } catch (error) {
    console.error("Error cargando avistamientos seguidos:", error);
    renderEmpty(
      feedFollowed,
      "fa-triangle-exclamation",
      t("messages.comunidad.feedLoadError"),
      t("messages.comunidad.feedLoadError"),
    );
    loaderFollowed.style.display = "none";
  }
}

async function cargarSiguiendoUsuarioActual() {
  if (!currentUserId) {
    followingIds = [];
    return;
  }

  try {
    const docSnap = await getDoc(doc(db, "usuarios", currentUserId));
    if (!docSnap.exists()) {
      followingIds = [];
      return;
    }

    const data = docSnap.data();
    followingIds = Array.isArray(data.siguiendo)
      ? [...new Set(data.siguiendo.filter(Boolean))]
      : [];
  } catch (error) {
    console.error("Error cargando seguidos del usuario actual:", error);
    followingIds = [];
  }
}

function actualizarFeedActivo(target) {
  activeTab = target;

  feedToggle?.querySelectorAll(".toggle-btn").forEach((button) => {
    const isActive = button.dataset.target === target;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  if (feedIndicator) {
    feedIndicator.style.transform =
      target === "siguiendo" ? "translateX(100%)" : "translateX(0)";
  }

  Object.entries(panels).forEach(([key, panel]) => {
    if (!panel) return;
    panel.classList.toggle("hidden", key !== target);
  });

  if (target === "comunidad" && !communityLoadedOnce) {
    cargarMasComunidad();
  }

  if (target === "siguiendo" && !followedLoaded) {
    cargarAvistamientosSeguidos();
  }
}

feedToggle?.addEventListener("click", (event) => {
  const button = event.target.closest(".toggle-btn");
  if (!button) return;
  actualizarFeedActivo(button.dataset.target || "comunidad");
});

window.addEventListener("scroll", () => {
  if (activeTab !== "comunidad") return;
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 200) {
    cargarMasComunidad();
  }
});

onAuthStateChanged(auth, async (user) => {
  currentUserId = user ? user.uid : null;
  await cargarSiguiendoUsuarioActual();
  await cargarAvistamientosSeguidos();
});

cargarMasComunidad();
actualizarFeedActivo("comunidad");

document.addEventListener("birdyval:language-changed", () => {
  if (!finishedCommunity && activeTab === "comunidad") {
    renderLoader(loaderCommunity, t("messages.comunidad.loadingCommunity"));
  } else {
    loaderCommunity.style.display = finishedCommunity ? "block" : "none";
    if (finishedCommunity) {
      renderLoader(loaderCommunity, t("messages.comunidad.noMoreSightings"));
    }
  }

  if (!currentUserId) {
    renderEmpty(
      feedFollowed,
      "fa-right-to-bracket",
      t("messages.comunidad.loginToSeeFollowed"),
      t("messages.comunidad.loginToSeeFollowed"),
      `<a class="community-login-action" href="login.html">${t("messages.comunidad.loginAction")}</a>`,
    );
  } else if (!followingIds.length) {
    renderEmpty(
      feedFollowed,
      "fa-user-group",
      t("messages.comunidad.noFollowedSightings"),
      t("messages.comunidad.noFollowedSightings"),
    );
  }
});
