import { db } from "./firebase.js";
import { CONFIG } from "./config.js";
import { t, getCurrentLang } from "./i18n.js";
import { mostrarToast } from "./notificaciones.js";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const RADIO_KM = 3; // Radio de búsqueda (Reducido para priorizar cercanía)
const DIAS_ATRAS = 30; // Antigüedad máxima de avistamientos
const MIN_USER_MOVE_METERS = 200; // Solo recargar si el usuario se desplaza significativamente

let map;
let misAves = []; // Base de datos local
let markersGroup; // Grupo de marcadores unificados
let userRealPosition = null; // Ubicación real del usuario
let userMarker = null;
let userWatchId = null;
let panelSugerenciasColapsado = false;

// ICONOS
const userIcon = L.divIcon({
  className: "custom-div-icon",
  html: "<div style='background-color:#4285F4; width:15px; height:15px; border-radius:50%; border:2px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5);'></div>",
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// Función para crear icono numerado (color verde — sin distinción de fuente)
const COLOR_NUM = "#4fa17f";
function crearIconoNumerado(num) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:30px; height:30px; background:${COLOR_NUM};
      border-radius:50%; border:2.5px solid white;
      box-shadow:0 2px 8px rgba(0,0,0,0.4);
      display:flex; align-items:center; justify-content:center;
      color:white; font-weight:700; font-size:12px;
      font-family:'Poppins',sans-serif;
    ">${num}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -18],
  });
}

// Evita que marcadores con mismas coordenadas queden exactamente superpuestos.
// Distribuye los puntos en un pequeno circulo alrededor de su posicion real.
function separarMarcadorSuperpuesto(lat, lng, index, total) {
  if (total <= 1) return { lat, lng };

  const radioMetros = Math.min(18 + total * 2, 55);
  const angulo = (2 * Math.PI * index) / total;

  const dLat = (radioMetros / 111320) * Math.sin(angulo);
  const cosLat = Math.cos((lat * Math.PI) / 180) || 0.00001;
  const dLng = (radioMetros / (111320 * cosLat)) * Math.cos(angulo);

  return {
    lat: lat + dLat,
    lng: lng + dLng,
  };
}

// Mapa de marcadores para sincronización con lista
let listaMarkers = []; // { marker, obs/data, miAve, num }

// 1. INICIALIZAR
document.addEventListener("DOMContentLoaded", async () => {
  inicializarTogglePanelSugerencias();
  initMap();

  try {
    await cargarBaseDatosLocal();
    if ("geolocation" in navigator) {
      userWatchId = navigator.geolocation.watchPosition(
        successLocation,
        errorLocation,
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
      );
    } else {
      errorLocation();
    }
  } catch (error) {
    console.error("Error inicializando:", error);
    mostrarMensaje(t("map.errorLoadingDB"));
  }
});

function actualizarEstadoPanelSugerencias() {
  const panel = document.getElementById("panel-sugerencias");
  const btn = document.getElementById("toggle-panel-sugerencias");
  if (!panel || !btn) return;

  panel.classList.toggle("is-collapsed", panelSugerenciasColapsado);
  btn.setAttribute("aria-expanded", String(!panelSugerenciasColapsado));
  btn.setAttribute(
    "aria-label",
    panelSugerenciasColapsado
      ? "Mostrar panel de aves"
      : "Ocultar panel de aves",
  );
}

function inicializarTogglePanelSugerencias() {
  const btn = document.getElementById("toggle-panel-sugerencias");
  if (!btn) return;

  btn.addEventListener("click", () => {
    panelSugerenciasColapsado = !panelSugerenciasColapsado;
    actualizarEstadoPanelSugerencias();
  });

  actualizarEstadoPanelSugerencias();
}

function initMap() {
  const boundsValencia = [
    [37.7, -2.0],
    [40.9, 1.0],
  ];

  map = L.map("map", {
    maxBounds: boundsValencia,
    maxBoundsViscosity: 1.0,
    minZoom: 8,
  }).setView([39.4699, -0.3763], 13);

  // Capa de marcadores volátiles (eBird y Comunidad juntos)
  markersGroup = L.layerGroup().addTo(map);

  L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Tiles © Esri",
    },
  ).addTo(map);
}

function successLocation(pos) {
  const { latitude, longitude } = pos.coords;
  const previousPosition = userRealPosition;
  const newPosition = { lat: latitude, lng: longitude };

  const movedEnough = previousPosition
    ? map.distance(
        [previousPosition.lat, previousPosition.lng],
        [latitude, longitude],
      ) >= MIN_USER_MOVE_METERS
    : true;

  userRealPosition = newPosition;

  if (!userMarker) {
    userMarker = L.marker([latitude, longitude], { icon: userIcon })
      .addTo(map)
      .bindPopup(t("map.youAreHere"));
  } else {
    userMarker.setLatLng([latitude, longitude]);
  }

  if (!userMarker.isPopupOpen()) {
    userMarker.openPopup();
  }

  if (movedEnough) {
    map.setView([latitude, longitude], 14);
    cargarAvesCercanasUsuario(latitude, longitude);
  }
}

function errorLocation() {
  mostrarToast(t("map.locationDenied"), "aviso");
  map.setView([39.4699, -0.3763], 14);
  cargarAvesCercanasUsuario(39.4699, -0.3763);
}

async function cargarBaseDatosLocal() {
  try {
    const snap = await getDocs(collection(db, "especies"));
    misAves = snap.docs.map((d) => {
      const data = d.data();
      return {
        speciesCode: d.id,
        nombre_es: data.nombre_es,
        nombre_va: data.nombre_va,
        commonName: data.commonName,
        scientificName: data.scientificName || data.nombre_cientifico,
        wikipedia_image: data.wikipedia_image || data.imagen,
      };
    });
  } catch (e) {
    console.warn("Fallo Firebase especies, cargando local", e);
    const response = await fetch("data/aves_cv_enriched.json");
    if (!response.ok) throw new Error("No se pudo cargar JSON local");
    misAves = await response.json();
  }
}

// Carga unificada de eBird y Comunidad con Promise.allSettled
async function cargarAvesCercanasUsuario(lat, lng) {
  const loading = document.getElementById("loading");
  if (loading) loading.style.display = "flex";

  try {
    markersGroup.clearLayers();
    listaMarkers = [];

    const radioBusqueda = RADIO_KM;

    const eBirdUrl = `${CONFIG.BACKEND_URL}/ebird/recent?lat=${lat}&lng=${lng}&dist=${radioBusqueda}&back=${DIAS_ATRAS}`;
    const pEbird = fetch(eBirdUrl).then(async (res) => {
      if (!res.ok) throw new Error("Error eBird API");
      const data = await res.json();
      return data.observations || [];
    });

    const pComunidad = (async () => {
      const q = query(
        collection(db, "avistamientos"),
        orderBy("fecha", "desc"),
        limit(50),
      );
      const querySnapshot = await getDocs(q);
      const docs = [];
      querySnapshot.forEach((doc) => docs.push({ ...doc.data(), id: doc.id }));
      return docs;
    })();

    const [resEbird, resComunidad] = await Promise.allSettled([
      pEbird,
      pComunidad,
    ]);
    let avistamientos = [];

    if (resEbird.status === "fulfilled") {
      resEbird.value.forEach((obs) => {
        const miAve = misAves.find((a) => a.speciesCode === obs.speciesCode);
        if (!miAve) return;

        const nombre =
          getCurrentLang() === "ca"
            ? miAve.nombre_va || miAve.nombre_es || miAve.commonName
            : miAve.nombre_es || miAve.nombre_va || miAve.commonName;

        avistamientos.push({
          origen: "ebird",
          lat: obs.lat,
          lng: obs.lng,
          nombre,
          nombreCientifico: miAve.scientificName,
          imagen: miAve.wikipedia_image || "img/logo_sintexto.png",
          fechaObs: new Date(obs.obsDt).toLocaleDateString("es-ES", {
            weekday: "short",
            hour: "2-digit",
            minute: "2-digit",
          }),
          comentario: "",
          link: `subir_avistamiento.html?especieCode=${miAve.speciesCode}`,
          speciesKey: miAve.speciesCode,
          origenLabel: "eBird",
          obsOriginal: obs,
        });
      });
    } else {
      console.error("Fallo la carga de eBird", resEbird.reason);
    }

    if (resComunidad.status === "fulfilled") {
      resComunidad.value.forEach((data) => {
        if (!data.location?.lat || !data.location?.lng) return;

        let fechaStr = "Reciente";
        if (data.fecha?.seconds) {
          fechaStr = new Date(data.fecha.seconds * 1000).toLocaleDateString(
            "es-ES",
          );
        }

        avistamientos.push({
          origen: "comunidad",
          lat: data.location.lat,
          lng: data.location.lng,
          nombre: data.speciesName || "Ave desconocida",
          nombreCientifico: `Avistado por ${data.userName || "Usuario"}`,
          imagen: data.fotoUrl || "img/logo_sintexto.png",
          fechaObs: fechaStr,
          comentario: data.descripcion || "Sin notas",
          link: `detalle_avistamiento.html?id=${data.id}`,
          speciesKey: data.speciesName || `comunidad-${data.id}`,
          speciesCode: data.speciesCode || data.especieCode || "",
          origenLabel: "Comunidad",
          obsOriginal: data,
        });
      });
    } else {
      console.error("Fallo la carga de Comunidad", resComunidad.reason);
    }

    const puntoReferencia = [lat, lng];

    const avistamientosFiltrados = avistamientos
      .map((obs) => {
        const distanciaMetros = map.distance(puntoReferencia, [
          obs.lat,
          obs.lng,
        ]);
        return { ...obs, distanciaMetros };
      })
      .filter((obs) => obs.distanciaMetros <= radioBusqueda * 1000)
      .sort((a, b) => a.distanciaMetros - b.distanciaMetros);

    const unicos = new Set();
    const gruposPorPosicion = new Map();
    let numMarcador = 0;

    // Construir el conteo por posición solo con observaciones únicas (post-dedup)
    // para que el círculo de separación tenga el tamaño correcto.
    avistamientosFiltrados.forEach((obs) => {
      const key = `${Math.round(obs.lat * 1000)}-${Math.round(obs.lng * 1000)}-${obs.speciesKey}`;
      if (unicos.has(key)) return;
      unicos.add(key);
      const posicionKey = `${obs.lat.toFixed(5)}|${obs.lng.toFixed(5)}`;
      const total = gruposPorPosicion.get(posicionKey) || 0;
      gruposPorPosicion.set(posicionKey, total + 1);
    });

    unicos.clear();
    const indiceEnGrupo = new Map();

    avistamientosFiltrados.forEach((obs) => {
      const key = `${Math.round(obs.lat * 1000)}-${Math.round(obs.lng * 1000)}-${obs.speciesKey}`;
      if (unicos.has(key)) return;

      unicos.add(key);
      numMarcador++;

      const posicionKey = `${obs.lat.toFixed(5)}|${obs.lng.toFixed(5)}`;
      const totalEnPosicion = gruposPorPosicion.get(posicionKey) || 1;
      const indexActual = indiceEnGrupo.get(posicionKey) || 0;
      indiceEnGrupo.set(posicionKey, indexActual + 1);

      const posicionMarcador = separarMarcadorSuperpuesto(
        obs.lat,
        obs.lng,
        indexActual,
        totalEnPosicion,
      );

      const marker = crearMarcadorUnificado(obs, numMarcador, posicionMarcador);
      listaMarkers.push({
        marker,
        num: numMarcador,
        nombre: obs.nombre,
        imagen: obs.imagen,
        distanciaMetros: obs.distanciaMetros,
      });
    });

    const avesMostradas = listaMarkers.map((entry) => ({
      num: entry.num,
      nombre: entry.nombre,
      imagen: entry.imagen,
      distanciaMetros: entry.distanciaMetros,
      marker: entry.marker,
    }));

    actualizarPanelSugerencias(avesMostradas);
    mostrarMensaje(t("map.radarNearby", { count: numMarcador }));
  } catch (error) {
    console.error("Error unificando aves:", error);
  } finally {
    if (loading) setTimeout(() => (loading.style.display = "none"), 2000);
  }
}

// Marcador Unificado (mismo icono verde, popup diferente según origen)
function crearMarcadorUnificado(obs, num, posicionMarcador = null) {
  let distTexto = "";
  if (obs.distanciaMetros) {
    distTexto =
      obs.distanciaMetros < 1000
        ? `${Math.round(obs.distanciaMetros)}m`
        : `${(obs.distanciaMetros / 1000).toFixed(1)}km`;
  }

  let popupBodyExtras = "";
  let badgeExtra = "";

  badgeExtra = `<span class="popup-badge" style="background:${COLOR_NUM}">#${num} · ${obs.origenLabel}</span>`;
  if (obs.origen === "ebird") {
    popupBodyExtras = `
            <div class="popup-subtitle">${escapeHtml(obs.nombreCientifico)}</div>
            <div class="popup-meta">
                <i class="fa fa-location-arrow"></i> <strong>A ${distTexto} de ti</strong><br>
                <i class="fa fa-clock"></i> Visto: ${obs.fechaObs}
            </div>
            <a href="${obs.link}" class="btn-capturar">
                <i class="fa fa-camera"></i> ¡Lo estoy viendo!
            </a>
      `;
  } else {
    popupBodyExtras = `
            <div class="popup-subtitle">${escapeHtml(obs.nombreCientifico)}</div>
            <div class="popup-meta">
                <i class="fa fa-location-arrow"></i> <strong>A ${distTexto} de ti</strong><br>
                <i class="fa fa-calendar"></i> ${obs.fechaObs}<br>
                <i class="fa fa-comment"></i> "${escapeHtml(obs.comentario)}"
            </div>
            <div style="display:flex; gap:10px;">
                <a href="${obs.link}" class="btn-capturar" style="background:#555; flex:1; padding: 8px 5px; font-size: 0.85em;">
                    <i class="fa fa-eye"></i> Detalle
                </a>
                <a href="subir_avistamiento.html${obs.speciesCode ? "?especieCode=" + obs.speciesCode : ""}" class="btn-capturar" style="flex:1.2; padding: 8px 5px; font-size: 0.85em;">
                    <i class="fa fa-camera"></i> ¡Lo veo!
                </a>
            </div>
      `;
  }

  const popupContent = `
        <div class="popup-ave">
            <div class="popup-header" style="background-image: url('${obs.imagen}');">
                ${badgeExtra}
            </div>
            <div class="popup-body">
                <div class="popup-title">${escapeHtml(obs.nombre)}</div>
                ${popupBodyExtras}
            </div>
        </div>
    `;

  const latMarcador = posicionMarcador?.lat ?? obs.lat;
  const lngMarcador = posicionMarcador?.lng ?? obs.lng;

  const marker = L.marker([latMarcador, lngMarcador], {
    icon: crearIconoNumerado(num),
  })
    .addTo(markersGroup)
    .bindPopup(popupContent);

  return marker;
}

function mostrarMensaje(texto) {
  const loadingText = document.querySelector("#loading span");
  if (loadingText) loadingText.innerText = texto;
}

function actualizarPanelSugerencias(aves) {
  const contenedor = document.getElementById("lista-sugerencias");
  if (!contenedor) return;

  if (!aves || aves.length === 0) {
    contenedor.innerHTML =
      '<p style="font-size:0.8rem; color:#666; padding:10px">Sin aves detectadas en la zona.</p>';
    return;
  }

  contenedor.innerHTML = "";
  const lista = document.createElement("div");
  lista.className = "suggestions-numbered-list";

  aves.forEach((entry) => {
    const item = document.createElement("div");
    item.className = "suggestion-num-item";

    const dist = entry.distanciaMetros
      ? entry.distanciaMetros < 1000
        ? `${Math.round(entry.distanciaMetros)} m`
        : `${(entry.distanciaMetros / 1000).toFixed(1)} km`
      : "";

    item.innerHTML = `
      <div class="suggestion-num-badge" style="background:${COLOR_NUM};">${entry.num}</div>
      <img class="suggestion-num-img" src="${entry.imagen}" alt="${escapeHtml(entry.nombre)}"
           onerror="this.src='img/logo_sintexto.png'">
      <div class="suggestion-num-info">
        <div class="suggestion-num-name">${escapeHtml(entry.nombre)}</div>
        ${dist ? `<div class="suggestion-num-dist"><i class="fa fa-location-arrow" style="font-size:0.6rem;"></i> ${dist}</div>` : ""}
      </div>
    `;

    // Al hacer click: hacer pan al marcador y abrir popup
    if (entry.marker) {
      item.addEventListener("click", () => {
        const latlng = entry.marker.getLatLng();
        map.flyTo(latlng, 16, { animate: true });
        entry.marker.openPopup();
        // Resaltar item
        document
          .querySelectorAll(".suggestion-num-item")
          .forEach((el) => (el.style.background = ""));
        item.style.background = "rgba(79,161,127,0.1)";
      });
    }

    lista.appendChild(item);
  });

  contenedor.appendChild(lista);
}
