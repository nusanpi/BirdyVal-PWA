/**
 * aves_cercanas_home.js
 * Carga aves cercanas (eBird + comunidad Firebase) y las muestra:
 *  - En una lista numerada en el index.html
 *  - Con marcadores numerados en el mini-mapa
 */

import { db } from "./firebase.js";
import { CONFIG } from "./config.js";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const RADIO_KM = 3;
const DIAS_ATRAS = 14;
const MAX_LISTA = 25; // Aumentado el límite interno, la vista recorta a ~5 haciendo scroll
const COLOR_MARCADOR = "#4fa17f"; // Verde BirdyVal — igual para todas las fuentes

let miniMap = null;
let misAves = [];

document.addEventListener("DOMContentLoaded", async () => {
  initMiniMap();

  // Cargar JSON local (no bloquea si falla)
  try {
    await cargarBaseDatosLocal();
  } catch (e) {
    console.warn("JSON local no disponible:", e);
  }

  if (!navigator.geolocation) {
    renderSinUbicacion();
    return;
  }

  // Timeout de seguridad: si la geo tarda más de 10 s, usar Valencia
  const geoTimeout = setTimeout(() => {
    console.warn("Geolocalización timeout — usando Valencia por defecto");
    iniciarConUbicacion(39.4699, -0.3763, false);
  }, 10000);

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      clearTimeout(geoTimeout);
      const { latitude: lat, longitude: lng } = pos.coords;
      iniciarConUbicacion(lat, lng, true);
    },
    () => {
      clearTimeout(geoTimeout);
      iniciarConUbicacion(39.4699, -0.3763, false);
    },
    { enableHighAccuracy: false, timeout: 9000, maximumAge: 60000 },
  );
});

function iniciarConUbicacion(lat, lng, esPrecisa) {
  if (miniMap) {
    miniMap.setView([lat, lng], esPrecisa ? 14 : 12);
    if (esPrecisa) añadirMarcadorUsuario(lat, lng);
  }
  cargarAvesCercanas(lat, lng);
}

function initMiniMap() {
  const el = document.getElementById("mini-map");
  if (!el || typeof L === "undefined") return;

  miniMap = L.map("mini-map", {
    zoomControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    touchZoom: false,
    attributionControl: false,
  }).setView([39.4699, -0.3763], 12);

  L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { attribution: "" },
  ).addTo(miniMap);
}

function añadirMarcadorUsuario(lat, lng) {
  if (!miniMap) return;
  const userIcon = L.divIcon({
    className: "",
    html: `<div style="
      width:14px; height:14px; background:#4285F4;
      border-radius:50%; border:2px solid white;
      box-shadow:0 0 8px rgba(66,133,244,0.8);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
  L.marker([lat, lng], { icon: userIcon })
    .addTo(miniMap)
    .bindPopup("📍 Estás aquí");
}

function crearIconoNumero(num) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:26px; height:26px; background:${COLOR_MARCADOR};
      border-radius:50%; border:2px solid white;
      box-shadow:0 2px 6px rgba(0,0,0,0.35);
      display:flex; align-items:center; justify-content:center;
      color:white; font-weight:700; font-size:11px;
      font-family:'Poppins',sans-serif;
    ">${num}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

async function cargarBaseDatosLocal() {
  try {
    const snap = await getDocs(collection(db, "especies"));
    misAves = snap.docs.map(d => {
      const data = d.data();
      return {
        speciesCode: d.id,
        nombre_es: data.nombre_es,
        nombre_va: data.nombre_va,
        commonName: data.commonName,
        scientificName: data.scientificName || data.nombre_cientifico,
        wikipedia_image: data.wikipedia_image || data.imagen
      };
    });
  } catch (e) {
    console.warn("Fallo Firebase especies, cargando local", e);
    const resp = await fetch("data/aves_cv_enriched.json");
    if (!resp.ok) throw new Error("JSON no disponible");
    misAves = await resp.json();
  }
}

async function cargarAvesCercanas(lat, lng) {
  const contenedor = document.getElementById("cercanas-lista");
  if (!contenedor) return;

  contenedor.innerHTML = `
    <div class="cercanas-loading">
      <div class="cercanas-spinner"></div>
      <span>Buscando aves cercanas...</span>
    </div>`;

  try {
    // Lanzar ambas peticiones en paralelo con timeout individual
    const [ebirdItems, comunidadItems] = await Promise.all([
      fetchEbird(lat, lng).catch(() => []),
      fetchComunidad(lat, lng).catch(() => []),
    ]);

    // Juntar y ordenar por distancia (sin distinción de fuente)
    const todas = [...ebirdItems, ...comunidadItems]
      .filter((a) => a && a.nombre)
      .sort(
        (a, b) => (a.distanciaMetros || 9999) - (b.distanciaMetros || 9999),
      );

    const top = todas.slice(0, MAX_LISTA);

    if (top.length === 0) {
      contenedor.innerHTML = `
        <div class="cercanas-vacio">
          <i class="fa fa-binoculars"></i>
          <p>No se han encontrado aves cercanas en los últimos ${DIAS_ATRAS} días.</p>
        </div>`;
      actualizarConteoHeader(0);
      return;
    }

    actualizarConteoHeader(top.length);
    renderLista(top, contenedor);

    // Marcadores en mini-mapa
    const markersRef = [];
    top.forEach((ave, i) => {
      if (ave.lat && ave.lng && miniMap) {
        const marker = L.marker([ave.lat, ave.lng], {
          icon: crearIconoNumero(i + 1),
        }).addTo(miniMap);

        const nombre = ave.nombre || "Ave";
        const dist = formatearDistancia(ave.distanciaMetros);

        marker.bindPopup(`
          <div style="text-align:center; min-width:130px;">
            <div style="background:${COLOR_MARCADOR};color:white;border-radius:4px;padding:2px 8px;font-size:0.7rem;font-weight:700;margin-bottom:4px;">#${i + 1}</div>
            <strong style="font-size:0.9rem;">${nombre}</strong><br>
            <span style="font-size:0.75rem;color:#666;">A ${dist}</span>
          </div>
        `);
        markersRef.push(marker);
      }
    });

    // Guardar referencia de marcadores en items de la lista para el click
    document.querySelectorAll(".cercanas-item").forEach((li, i) => {
      if (markersRef[i]) {
        li._marker = markersRef[i];
      }
    });

    // Ajustar zoom del mini mapa
    if (miniMap && top.some((a) => a.lat)) {
      try {
        const pts = top
          .filter((a) => a.lat && a.lng)
          .map((a) => [a.lat, a.lng]);
        pts.push([lat, lng]);
        miniMap.fitBounds(L.latLngBounds(pts), {
          padding: [30, 30],
          maxZoom: 15,
        });
      } catch (err) {
        console.warn('Error ajustando bounds del mini-mapa:', err.message);
      }
    }
  } catch (err) {
    console.error("Error cargando aves cercanas:", err);
    contenedor.innerHTML = `
      <div class="cercanas-vacio">
        <i class="fa fa-exclamation-triangle" style="color:#f59e0b;"></i>
        <p>Error al cargar aves cercanas. Inténtalo de nuevo.</p>
      </div>`;
    actualizarConteoHeader(0);
  }
}

// eBird API — con timeout propio de 8s
async function fetchEbird(lat, lng) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const url = `${CONFIG.BACKEND_URL}/ebird/recent?lat=${lat}&lng=${lng}&dist=${RADIO_KM}&back=${DIAS_ATRAS}`;
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!resp.ok) return [];
    const data = await resp.json();
    const obs = data.observations || [];

    return obs
      .map((o) => {
        const miAve = misAves.find((a) => a.speciesCode === o.speciesCode);
        const dist = calcularDistanciaKm(lat, lng, o.lat, o.lng) * 1000;
        return {
          nombre: miAve
            ? miAve.nombre_es || miAve.nombre_va || miAve.commonName
            : o.comName,
          nombreCientifico: miAve ? miAve.scientificName : o.sciName,
          imagen: miAve?.wikipedia_image || null,
          lat: o.lat,
          lng: o.lng,
          distanciaMetros: dist,
          fecha: o.obsDt,
          speciesCode: o.speciesCode,
          fuente: "ebird",
        };
      })
      .filter((o) => o.nombre);
  } catch (e) {
    clearTimeout(timer);
    if (e.name !== "AbortError") console.warn("eBird error:", e.message);
    return [];
  }
}

// Firebase — avistamientos comunidad cercanos
async function fetchComunidad(lat, lng) {
  try {
    const q = query(
      collection(db, "avistamientos"),
      orderBy("fecha", "desc"),
      limit(50),
    );
    const snap = await getDocs(q);
    const items = [];

    snap.forEach((doc) => {
      const d = doc.data();
      if (!d.location?.lat || !d.location?.lng) return;

      const distKm = calcularDistanciaKm(
        lat,
        lng,
        d.location.lat,
        d.location.lng,
      );
      if (distKm > RADIO_KM) return;

      items.push({
        nombre: d.speciesName || "Ave desconocida",
        nombreCientifico: null,
        imagen: d.fotoUrl || null,
        lat: d.location.lat,
        lng: d.location.lng,
        distanciaMetros: distKm * 1000,
        fecha: d.fecha?.seconds
          ? new Date(d.fecha.seconds * 1000).toISOString()
          : null,
        userName: d.userName || null,
        avistamientoId: doc.id,
        fuente: "community",
      });
    });

    return items;
  } catch (e) {
    console.warn("Comunidad error:", e.message);
    return [];
  }
}

function renderLista(aves, contenedor) {
  contenedor.innerHTML = "";
  const ol = document.createElement("ol");
  ol.className = "cercanas-ol";

  aves.forEach((ave, i) => {
    const num = i + 1;
    const dist = formatearDistancia(ave.distanciaMetros);
    const fechaStr = ave.fecha ? formatearFecha(ave.fecha) : "";
    const imgSrc = ave.imagen || "img/logo_sintexto.png";
    const linkHref = ave.speciesCode
      ? `subir_avistamiento.html?especieCode=${ave.speciesCode}`
      : "subir_avistamiento.html";

    const li = document.createElement("li");
    li.className = "cercanas-item";
    li.dataset.index = num;
    li.style.cursor = "pointer";

    li.innerHTML = `
      <div class="cercanas-num">${num}</div>
      <img class="cercanas-img" src="${imgSrc}" alt="${ave.nombre}"
           onerror="this.src='img/logo_sintexto.png'">
      <div class="cercanas-info">
        <div class="cercanas-nombre">${ave.nombre}</div>
        ${ave.nombreCientifico ? `<div class="cercanas-cientifico">${ave.nombreCientifico}</div>` : ""}
        ${ave.userName ? `<div class="cercanas-usuario"><i class="fa fa-user"></i> ${ave.userName}</div>` : ""}
        <div class="cercanas-meta">
          <span class="cercanas-dist"><i class="fa fa-location-arrow"></i> ${dist}</span>
          ${fechaStr ? `<span class="cercanas-fecha"><i class="fa fa-clock"></i> ${fechaStr}</span>` : ""}
        </div>
      </div>
      <a href="${linkHref}" class="cercanas-accion" title="¡Lo estoy viendo!" onclick="event.stopPropagation()">
        <i class="fa fa-camera"></i>
      </a>
    `;

    // Click: pan en mini-mapa
    li.addEventListener("click", () => {
      if (ave.lat && ave.lng && miniMap) {
        miniMap.setView([ave.lat, ave.lng], 15, { animate: true });
        if (li._marker) li._marker.openPopup();
      }
      document
        .querySelectorAll(".cercanas-item")
        .forEach((el) => el.classList.remove("cercanas-item--activo"));
      li.classList.add("cercanas-item--activo");
    });

    ol.appendChild(li);
  });

  contenedor.appendChild(ol);
}

function renderSinUbicacion() {
  const contenedor = document.getElementById("cercanas-lista");
  if (!contenedor) return;
  contenedor.innerHTML = `
    <div class="cercanas-vacio">
      <i class="fa fa-map-marker-alt"></i>
      <p>Activa la ubicación para ver las aves más cercanas a ti.</p>
    </div>`;
  actualizarConteoHeader(0);
}

function actualizarConteoHeader(n) {
  const el = document.getElementById("cercanas-conteo");
  if (el) el.textContent = n > 0 ? `${n} cerca de ti` : "0 encontradas";
}

// ========================
// UTILS
// ========================
function calcularDistanciaKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

function formatearDistancia(metros) {
  if (!metros && metros !== 0) return "";
  return metros < 1000
    ? `${Math.round(metros)} m`
    : `${(metros / 1000).toFixed(1)} km`;
}

function formatearFecha(isoStr) {
  if (!isoStr) return "";
  try {
    return new Date(isoStr).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
    });
  } catch (_) {
    return "";
  }
}
