// js/detalle.js
import { db, auth } from "./firebase.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  arrayUnion,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { t, getCurrentLang } from "./i18n.js";
import { mostrarToast } from "./notificaciones.js";

//coge la id de la url
const params = new URLSearchParams(window.location.search);
const avistamientoId = params.get("id");

const domAvatar = document.getElementById("detUserAvatar");
const domUser = document.getElementById("detUserName");
const domLocation = document.getElementById("detLocation");
const domDate = document.getElementById("detDate");
const domImage = document.getElementById("detImage");
const domSpecies = document.getElementById("detSpecies");
const domDesc = document.getElementById("detDescription");

let listaCompletaAves = [];
let listaEspeciesActual = [];
let currentSightingData = null;

const speciesCache = new Map();

function getSpeciesDisplayName(sp) {
  const lang = getCurrentLang();
  if (lang === "ca") {
    return (
      sp.nombre_va ||
      sp.nombre_es ||
      sp.commonName ||
      t("messages.subir.speciesNoName")
    );
  }
  return (
    sp.nombre_es ||
    sp.nombre_va ||
    sp.commonName ||
    t("messages.subir.speciesNoName")
  );
}

function getLocalizedDescription(data) {
  const lang = getCurrentLang();
  const i18n = data?.descripcion_i18n;
  if (i18n && typeof i18n === "object") {
    if (i18n[lang]) return i18n[lang];
    if (i18n.es) return i18n.es;
    if (i18n.ca) return i18n.ca;
  }
  return (
    data?.descripcion_original || data?.descripcion || t("common.noComments")
  );
}

async function getLocalizedSpeciesName(data) {
  try {
    const lang = getCurrentLang();
    const speciesI18n = data?.speciesName_i18n;
    if (speciesI18n && typeof speciesI18n === "object") {
      if (speciesI18n[lang]) return speciesI18n[lang];
      if (speciesI18n.es) return speciesI18n.es;
      if (speciesI18n.ca) return speciesI18n.ca;
    }

    if (data?.speciesId) {
      if (!speciesCache.has(data.speciesId)) {
        const ref = doc(db, "especies", data.speciesId);
        const snap = await getDoc(ref);
        speciesCache.set(data.speciesId, snap.exists() ? snap.data() : null);
      }
      const speciesDoc = speciesCache.get(data.speciesId);
      if (speciesDoc) {
        return getSpeciesDisplayName({
          nombre_es: speciesDoc.nombre_es || "",
          nombre_va: speciesDoc.nombre_va || "",
          commonName: speciesDoc.commonName || "",
        });
      }
    }

    return data?.speciesName || t("common.unknownSpecies");
  } catch (error) {
    console.error("Error obteniendo nombre de especie:", error);
    return data?.speciesName || t("common.unknownSpecies");
  }
}

async function renderLocalizedSightingData(data) {
  try {
    domSpecies.innerText = await getLocalizedSpeciesName(data);
    domDesc.innerText = getLocalizedDescription(data);
    // Remover data-i18n para que i18n.js no los sobrescriba al cambiar idioma
    domSpecies.removeAttribute("data-i18n");
    domDesc.removeAttribute("data-i18n");
  } catch (error) {
    console.error("Error renderizando datos localizados:", error);
    domSpecies.innerText = data?.speciesName || t("common.unknownSpecies");
    domDesc.innerText = data?.descripcion || t("common.noComments");
    domSpecies.removeAttribute("data-i18n");
    domDesc.removeAttribute("data-i18n");
  }
}

async function cargarDetalle() {
  if (!avistamientoId) {
    mostrarToast(t("messages.detalle.missingId"), "error");
    setTimeout(() => (window.location.href = "index.html"), 1800);
    return;
  }

  try {
    const docRef = doc(db, "avistamientos", avistamientoId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      currentSightingData = data;

      domUser.innerText = data.userName || t("common.unknownUser");
      domUser.removeAttribute("data-i18n"); // Evitar que i18n lo sobrescriba
      domAvatar.src = data.userPhoto || "./img/user_default.png";

      // Hacer clickeable el nombre y avatar del usuario para ir a su perfil
      if (data.userId) {
        const clickHandler = () => {
          window.location.href = `perfil_publico.html?userId=${data.userId}`;
        };

        domUser.style.cursor = "pointer";
        domUser.style.color = "#4fa17f";
        domUser.style.textDecoration = "underline";
        domUser.onclick = clickHandler;

        domAvatar.style.cursor = "pointer";
        domAvatar.onclick = clickHandler;
      }

      const lat = data.location?.lat || 0;
      const lng = data.location?.lng || 0;
      domLocation.innerText = t("messages.detalle.findingLocation");
      if (lat && lng) {
        resolverUbicacion(lat, lng).then((lugar) => {
          domLocation.innerText = `📍 ${lugar}`;
        });
      } else {
        domLocation.innerText = t("messages.detalle.unknownLocation");
      }

      if (data.fecha) {
        const dateObj = data.fecha.toDate();
        //convertir fecha de firebase a string legible
        domDate.innerText =
          dateObj.toLocaleDateString() +
          " " +
          dateObj.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
      }

      const domAudio = document.getElementById("detAudio");

      if (data.fotoUrl) {
        domImage.src = data.fotoUrl;
        domImage.style.display = "block";
      } else {
        domImage.style.display = "none";
      }

      if (data.audioUrl) {
        domAudio.src = data.audioUrl;
        domAudio.style.display = "block";
      } else {
        domAudio.style.display = "none";
      }
      await renderLocalizedSightingData(data);

      // Mostrar sugerencias existentes
      mostrarSugerencias(data.sugerencias || []);

      // Mostrar opción de sugerir especie
      initSugerirEspecie();
    } else {
      domUser.innerText = "Error";
      domDesc.innerText = t("messages.detalle.sightingNotFound");
    }
  } catch (error) {
    console.error("Error cargando detalle:", error);
  }
}

async function initSugerirEspecie() {
  const box = document.getElementById("sugerirEspecieBox");
  const btnMostrar = document.getElementById("btnMostrarSugerir");
  const formSugerir = document.getElementById("formSugerir");
  const select = document.getElementById("selectEspecie");
  const btnEnviar = document.getElementById("btnEnviarSugerencia");
  const speciesModal = document.getElementById("speciesModalDetalle");
  const speciesListContainer = document.getElementById(
    "speciesListContainerDetalle",
  );
  const speciesSearchInput = document.getElementById(
    "speciesSearchInputDetalle",
  );
  const speciesPickerTrigger = document.getElementById(
    "speciesPickerTriggerDetalle",
  );
  const closeSpeciesModalBtn = document.getElementById(
    "closeSpeciesModalDetalle",
  );
  const speciesDisplayText = document.getElementById(
    "speciesDisplayTextDetalle",
  );

  box.style.display = "block";

  // Cargar especies con la misma fuente y estructura visual que en subir_avistamiento.
  const querySnapshot = await getDocs(collection(db, "especies"));
  listaCompletaAves = [];

  querySnapshot.forEach((speciesDoc) => {
    const data = speciesDoc.data();
    listaCompletaAves.push({
      id: speciesDoc.id,
      nombre_es: data.nombre_es || "",
      nombre_va: data.nombre_va || "",
      commonName: data.commonName || "",
      imagen: data.wikipedia_image || "",
    });
  });

  listaCompletaAves.sort((a, b) => {
    const nombreA = getSpeciesDisplayName(a) || "";
    const nombreB = getSpeciesDisplayName(b) || "";
    return nombreA.localeCompare(nombreB);
  });

  listaEspeciesActual = listaCompletaAves;
  select.innerHTML = `<option value="">${t("common.selectSpecies")}</option>`;

  listaCompletaAves.forEach((e) => {
    const nombre = getSpeciesDisplayName(e);
    if (!nombre) return;
    const option = document.createElement("option");
    option.value = nombre;
    option.textContent = nombre;
    select.appendChild(option);
  });

  function renderSpeciesList(lista) {
    if (!speciesListContainer) return;

    speciesListContainer.innerHTML = "";

    if (!lista || lista.length === 0) {
      const empty = document.createElement("div");
      empty.className = "species-empty-state";
      empty.textContent = t("messages.detalle.noResults");
      speciesListContainer.appendChild(empty);
      return;
    }

    lista.forEach((sp) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "species-item";

      const nombrePrincipal = getSpeciesDisplayName(sp);
      const nombreEn = sp.commonName || "";

      item.innerHTML = `
      <div class="species-item-thumb">
        ${
          sp.imagen
            ? `<img src="${sp.imagen}" alt="${nombrePrincipal}" />`
            : `<div class="species-item-thumb-placeholder"><i class="fa fa-dove"></i></div>`
        }
      </div>
      <div class="species-item-text">
        <div class="species-name-es">${nombrePrincipal}</div>
        ${
          nombreEn && nombreEn !== nombrePrincipal
            ? `<div class="species-name-en">${nombreEn}</div>`
            : ""
        }
      </div>
    `;

      item.addEventListener("click", () => {
        select.value = nombrePrincipal;
        if (speciesDisplayText) {
          speciesDisplayText.textContent = nombrePrincipal;
          speciesDisplayText.classList.add("has-value");
        }
        setSpeciesModalOpen(false);
      });

      speciesListContainer.appendChild(item);
    });
  }

  function setSpeciesModalOpen(isOpen) {
    if (!speciesModal) return;
    if (isOpen) {
      speciesModal.style.display = "flex";
      speciesModal.setAttribute("aria-hidden", "false");
      if (speciesSearchInput) {
        speciesSearchInput.value = "";
        renderSpeciesList(listaEspeciesActual);
        setTimeout(() => speciesSearchInput.focus(), 50);
      }
    } else {
      speciesModal.style.display = "none";
      speciesModal.setAttribute("aria-hidden", "true");
    }
  }

  if (speciesPickerTrigger) {
    speciesPickerTrigger.onclick = () => setSpeciesModalOpen(true);
  }

  if (closeSpeciesModalBtn) {
    closeSpeciesModalBtn.onclick = () => setSpeciesModalOpen(false);
  }

  if (speciesModal) {
    const backdrop = speciesModal.querySelector(".add-modal__backdrop");
    if (backdrop) backdrop.onclick = () => setSpeciesModalOpen(false);
  }

  if (speciesSearchInput) {
    speciesSearchInput.oninput = () => {
      const term = speciesSearchInput.value.trim().toLowerCase();
      if (!term) {
        renderSpeciesList(listaEspeciesActual);
        return;
      }

      const filtrados = listaEspeciesActual.filter((sp) => {
        const nombreEs = (sp.nombre_es || "").toLowerCase();
        const nombreVa = (sp.nombre_va || "").toLowerCase();
        const nombreEn = (sp.commonName || "").toLowerCase();
        return (
          nombreEs.includes(term) ||
          nombreVa.includes(term) ||
          nombreEn.includes(term)
        );
      });
      renderSpeciesList(filtrados);
    };
  }

  renderSpeciesList(listaEspeciesActual);

  btnMostrar.onclick = () => {
    formSugerir.style.display =
      formSugerir.style.display === "none" ? "block" : "none";
  };

  btnEnviar.onclick = async () => {
    const especie = select.value;
    if (!especie) { mostrarToast(t("messages.detalle.mustSelectSpecies"), "aviso"); return; }

    const user = auth.currentUser;
    if (!user) { mostrarToast(t("messages.detalle.mustLogin"), "aviso"); return; }

    try {
      const docRef = doc(db, "avistamientos", avistamientoId);
      const userName = user.displayName || "Usuario";
      await updateDoc(docRef, {
        sugerencias: arrayUnion({
          especie,
          usuarioId: user.uid,
          userName,
          fecha: new Date(),
        }),
      });
      agregarSugerenciaDOM(userName, especie);
      formSugerir.style.display = "none";
    } catch (err) {
      console.error(err);
      mostrarToast(t("messages.detalle.suggestionError"), "error");
    }
  };
}

function mostrarSugerencias(sugerencias) {
  if (sugerencias.length > 0) {
    document.getElementById("seccionSugerencias").style.display = "block";
    sugerencias.forEach((s) =>
      agregarSugerenciaDOM(s.userName || t("common.unknownUser"), s.especie),
    );
  }
}

function agregarSugerenciaDOM(userName, especie) {
  document.getElementById("seccionSugerencias").style.display = "block";
  const lista = document.getElementById("listaSugerencias");
  const div = document.createElement("div");
  div.className = "post-species-tag";
  div.style.cssText =
    "background: #fff3e0; border-left: 3px solid #ff9800; margin-bottom: 0.5rem; display: block;";
  div.innerHTML = `<span style="color:#666">${userName}:</span> <i class="fa fa-dove" style="color:#ff9800"></i> ${especie}`;
  lista.appendChild(div);
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

document.addEventListener("DOMContentLoaded", cargarDetalle);

document.addEventListener("birdyval:language-changed", async () => {
  if (currentSightingData) {
    await renderLocalizedSightingData(currentSightingData);
  }
});
