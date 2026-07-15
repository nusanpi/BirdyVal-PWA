import { db, auth } from "./firebase.js";
import { CONFIG } from "./config.js";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  increment,
  serverTimestamp,
  getDoc,
  arrayUnion,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  calcularPuntosAvistamiento,
  verificarLogros,
  calcularNivel,
} from "./gamificacion.js";
import { t, getCurrentLang } from "./i18n.js";
import { mostrarToast } from "./notificaciones.js";

const storage = getStorage();

const selectEspecie = document.getElementById("especieSelect");
const speciesDisplayText = document.getElementById("speciesDisplayText");
const geoStatus = document.getElementById("geoStatus");
const triggerGeoBtn = document.getElementById("triggerGeoBtn");
const latInput = document.getElementById("lat");
const lngInput = document.getElementById("lng");
const fotoInput = document.getElementById("fotoInput");
const fotoCameraInput = document.getElementById("fotoCameraInput");
const fotoPreview = document.getElementById("fotoPreview");
const btnPublicar = document.getElementById("btnPublicar");
const photoUploaderLabel = document.getElementById("photoUploaderLabel");
const audioInput = document.getElementById("audioInput");
const audioPreview = document.getElementById("audioPreview");
const audioPreviewContainer = document.getElementById("audioPreviewContainer");
const audioUploaderLabel = document.getElementById("audioUploaderLabel");
const audioChoiceModal = document.getElementById("audioChoiceModal");
const closeAudioChoiceBtn = document.getElementById("closeAudioChoice");
const btnRecordAudioNow = document.getElementById("btnRecordAudioNow");
const btnChooseAudioFromGallery = document.getElementById(
  "btnChooseAudioFromGallery",
);
const audioRecorderModal = document.getElementById("audioRecorderModal");
const closeAudioRecorderBtn = document.getElementById("closeAudioRecorder");
const btnStartAudioRecording = document.getElementById(
  "btnStartAudioRecording",
);
const btnStopAudioRecording = document.getElementById("btnStopAudioRecording");
const btnCancelAudioRecording = document.getElementById(
  "btnCancelAudioRecording",
);
const audioRecordingStatus = document.getElementById("audioRecordingStatus");
const audioRecordingTimer = document.getElementById("audioRecordingTimer");
const photoChoiceModal = document.getElementById("photoChoiceModal");
const closePhotoChoiceBtn = document.getElementById("closePhotoChoice");
const btnTakePhotoNow = document.getElementById("btnTakePhotoNow");
const btnChooseFromGallery = document.getElementById("btnChooseFromGallery");
const locationChoiceModal = document.getElementById("locationChoiceModal");
const closeLocationChoiceBtn = document.getElementById("closeLocationChoice");
const btnUseCurrentLocation = document.getElementById("btnUseCurrentLocation");
const btnPickOnMap = document.getElementById("btnPickOnMap");
const locationMapModal = document.getElementById("locationMapModal");
const closeLocationMapBtn = document.getElementById("closeLocationMap");
const locationPickMap = document.getElementById("locationPickMap");
const btnConfirmMapLocation = document.getElementById("btnConfirmMapLocation");

let usuarioActual = null;
let fotoArchivo = null;
let audioArchivo = null;
let listaCompletaAves = [];
let listaEspeciesActual = [];
let ultimaFraseSugerencia = "";
let pickLocationMap = null;
let pickLocationMarker = null;
let pendingMapLocation = null;
let audioStream = null;
let audioRecorder = null;
let audioChunks = [];
let audioRecordingStartedAt = 0;
let audioRecordingTimerId = null;
let audioRecordingInProgress = false;
let audioRecordingDiscard = false;

function getSugerenciasContainer() {
  let contenedor = document.getElementById("sugerencias");
  if (!contenedor) {
    contenedor = document.createElement("div");
    contenedor.id = "sugerencias";
    document.body.appendChild(contenedor);
  }
  return contenedor;
}

function getTextoCargandoIA() {
  return getCurrentLang() === "ca"
    ? "Analitzant el fitxer amb IA..."
    : "Analizando el archivo con IA...";
}

function getTextoNoSugerenciaIA() {
  return getCurrentLang() === "ca"
    ? "No s'ha pogut obtindre suggeriment automàtic per a este fitxer."
    : "No se pudo obtener sugerencia automática para este archivo.";
}

function getGeoPlaceholderText() {
  return getCurrentLang() === "ca" ? "Afegir ubicació" : "Añadir ubicación";
}

function setGeoStatusFromCoords(lat, lng) {
  latInput.value = lat;
  lngInput.value = lng;
  geoStatus.innerText = t("messages.subir.locationAdded", {
    lat: Number(lat).toFixed(2),
    lng: Number(lng).toFixed(2),
  });
  geoStatus.classList.add("has-value");
}

function setLocationChoiceModalOpen(isOpen) {
  if (!locationChoiceModal) return;
  locationChoiceModal.style.display = isOpen ? "flex" : "none";
  locationChoiceModal.setAttribute("aria-hidden", isOpen ? "false" : "true");
}

function setPhotoChoiceModalOpen(isOpen) {
  if (!photoChoiceModal) return;
  photoChoiceModal.style.display = isOpen ? "flex" : "none";
  photoChoiceModal.setAttribute("aria-hidden", isOpen ? "false" : "true");
}

function setAudioChoiceModalOpen(isOpen) {
  if (!audioChoiceModal) return;
  audioChoiceModal.style.display = isOpen ? "flex" : "none";
  audioChoiceModal.setAttribute("aria-hidden", isOpen ? "false" : "true");
}

function setAudioRecorderModalOpen(isOpen) {
  if (!audioRecorderModal) return;
  audioRecorderModal.style.display = isOpen ? "flex" : "none";
  audioRecorderModal.setAttribute("aria-hidden", isOpen ? "false" : "true");

  if (!isOpen && !audioRecordingInProgress) {
    resetAudioRecorderUi();
  }
}

function resetAudioRecorderUi() {
  audioChunks = [];
  audioRecordingInProgress = false;
  audioRecordingStartedAt = 0;
  audioRecordingDiscard = false;

  if (audioRecordingTimerId) {
    clearInterval(audioRecordingTimerId);
    audioRecordingTimerId = null;
  }

  if (audioRecordingStatus) {
    audioRecordingStatus.textContent =
      getCurrentLang() === "ca"
        ? "Prepara't per a gravar un àudio del cant o la crida de l'au."
        : "Prepárate para grabar un audio del canto o la llamada del ave.";
  }

  if (audioRecordingTimer) {
    audioRecordingTimer.textContent = "00:00";
  }

  if (btnStartAudioRecording) btnStartAudioRecording.disabled = false;
  if (btnStopAudioRecording) btnStopAudioRecording.disabled = true;
}

function formatRecordingTime(elapsedMs) {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

async function startAudioRecording() {
  if (audioRecordingInProgress) return;

  if (
    !navigator.mediaDevices?.getUserMedia ||
    typeof MediaRecorder === "undefined"
  ) {
    mostrarToast(
      getCurrentLang() === "ca"
        ? "El navegador no permet gravar àudio."
        : "El navegador no permite grabar audio.",
      "error",
    );
    return;
  }

  try {
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    audioRecordingDiscard = false;
    audioRecorder = new MediaRecorder(audioStream);
    audioRecordingInProgress = true;
    audioRecordingStartedAt = Date.now();

    if (audioRecordingStatus) {
      audioRecordingStatus.textContent =
        getCurrentLang() === "ca"
          ? "Gravació en curs... "
          : "Grabación en curso... ";
    }

    if (btnStartAudioRecording) btnStartAudioRecording.disabled = true;
    if (btnStopAudioRecording) btnStopAudioRecording.disabled = false;

    audioRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    audioRecorder.onstop = async () => {
      const discardRecording = audioRecordingDiscard;
      const mimeType =
        audioRecorder?.mimeType || audioChunks[0]?.type || "audio/webm";
      const blob = new Blob(audioChunks, { type: mimeType });
      cleanupAudioRecordingStream();

      if (discardRecording) {
        audioChunks = [];
        audioRecordingDiscard = false;
        return;
      }

      if (blob.size === 0) {
        if (audioRecordingStatus) {
          audioRecordingStatus.textContent =
            getCurrentLang() === "ca"
              ? "No s'ha pogut guardar la gravació. Torna-ho a intentar."
              : "No se ha podido guardar la grabación. Vuelve a intentarlo.";
        }
        return;
      }

      const extension = mimeType.includes("mp4")
        ? "m4a"
        : mimeType.includes("ogg")
          ? "ogg"
          : mimeType.includes("wav")
            ? "wav"
            : mimeType.includes("mp3")
              ? "mp3"
              : "webm";
      const recordedFile = new File(
        [blob],
        `grabacion_${Date.now()}.${extension}`,
        { type: mimeType },
      );

      setAudioRecorderModalOpen(false);
      await handleAudioFileSelection(recordedFile);
    };

    audioRecorder.onerror = (event) => {
      console.error("Error grabando audio:", event.error);
      cleanupAudioRecordingStream();
      setAudioRecorderModalOpen(false);
      mostrarToast(
        getCurrentLang() === "ca"
          ? "No s'ha pogut gravar l'àudio."
          : "No se ha podido grabar el audio.",
        "error",
      );
    };

    audioRecorder.start();

    audioRecordingTimerId = window.setInterval(() => {
      if (!audioRecordingTimer || !audioRecordingInProgress) return;
      audioRecordingTimer.textContent = formatRecordingTime(
        Date.now() - audioRecordingStartedAt,
      );
    }, 250);
  } catch (error) {
    console.error("No se pudo acceder al micrófono:", error);
    cleanupAudioRecordingStream();
    mostrarToast(
      getCurrentLang() === "ca"
        ? "Cal permetre l'accés al micròfon per a gravar l'àudio."
        : "Debes permitir el acceso al micrófono para grabar el audio.",
      "aviso",
    );
  }
}

function cleanupAudioRecordingStream() {
  audioRecordingInProgress = false;

  if (audioRecordingTimerId) {
    clearInterval(audioRecordingTimerId);
    audioRecordingTimerId = null;
  }

  if (audioStream) {
    audioStream.getTracks().forEach((track) => track.stop());
    audioStream = null;
  }

  audioRecorder = null;

  if (btnStartAudioRecording) btnStartAudioRecording.disabled = false;
  if (btnStopAudioRecording) btnStopAudioRecording.disabled = true;
}

function stopAudioRecording(cancel = false) {
  if (cancel) {
    audioRecordingDiscard = true;
    if (audioRecorder && audioRecorder.state === "recording") {
      audioRecorder.stop();
      return;
    }
    cleanupAudioRecordingStream();
    audioChunks = [];
    return;
  }

  if (!audioRecorder || audioRecorder.state !== "recording") return;
  audioRecorder.stop();
}

function setLocationMapModalOpen(isOpen) {
  if (!locationMapModal) return;
  locationMapModal.style.display = isOpen ? "flex" : "none";
  locationMapModal.setAttribute("aria-hidden", isOpen ? "false" : "true");

  if (isOpen) {
    initLocationPickerMap();
    setTimeout(() => {
      if (pickLocationMap) pickLocationMap.invalidateSize();
    }, 80);
  }
}

function initLocationPickerMap() {
  if (!locationPickMap || typeof L === "undefined") return;

  const boundsValencia = [
    [37.7, -2.0],
    [40.9, 1.0],
  ];

  const currentLat = parseFloat(latInput.value);
  const currentLng = parseFloat(lngInput.value);
  const startLat = Number.isFinite(currentLat) ? currentLat : 39.4699;
  const startLng = Number.isFinite(currentLng) ? currentLng : -0.3763;
  const startZoom =
    Number.isFinite(currentLat) && Number.isFinite(currentLng) ? 14 : 13;

  if (!pickLocationMap) {
    pickLocationMap = L.map("locationPickMap", {
      maxBounds: boundsValencia,
      maxBoundsViscosity: 1.0,
      minZoom: 8,
    }).setView([startLat, startLng], startZoom);

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Tiles © Esri",
      },
    ).addTo(pickLocationMap);

    pickLocationMap.on("click", (evt) => {
      pendingMapLocation = evt.latlng;
      if (pickLocationMarker) {
        pickLocationMarker.setLatLng(evt.latlng);
      } else {
        pickLocationMarker = L.marker(evt.latlng).addTo(pickLocationMap);
      }
      btnConfirmMapLocation.disabled = false;
    });
  } else {
    pickLocationMap.setView([startLat, startLng], startZoom);
  }

  if (Number.isFinite(currentLat) && Number.isFinite(currentLng)) {
    pendingMapLocation = { lat: currentLat, lng: currentLng };
    if (pickLocationMarker) {
      pickLocationMarker.setLatLng([currentLat, currentLng]);
    } else {
      pickLocationMarker = L.marker([currentLat, currentLng]).addTo(
        pickLocationMap,
      );
    }
    btnConfirmMapLocation.disabled = false;
  } else {
    pendingMapLocation = null;
    btnConfirmMapLocation.disabled = true;
  }
}

function usarUbicacionActual() {
  if (!navigator.geolocation) {
    mostrarToast(t("messages.subir.gpsUnavailable"), "aviso");
    return;
  }

  geoStatus.innerText = t("messages.subir.locating");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      setGeoStatusFromCoords(pos.coords.latitude, pos.coords.longitude);
      setLocationChoiceModalOpen(false);
    },
    () => {
      geoStatus.innerText = t("messages.subir.gpsError");
    },
  );
}

function mostrarCargandoSugerenciaIA() {
  const contenedor = getSugerenciasContainer();
  contenedor.innerHTML = `
    <div class="ia-suggestion-card ia-suggestion-card--loading" role="status" aria-live="polite">
      <div class="ia-suggestion-header">
        <i class="fa fa-robot" aria-hidden="true"></i>
        <strong>${t("messages.subir.suggestedSpeciesTitle")}</strong>
      </div>
      <div class="ia-suggestion-loading-row">
        <span class="ia-spinner" aria-hidden="true"></span>
        <span>${getTextoCargandoIA()}</span>
      </div>
    </div>
  `;
}

function normalizeSpeciesText(value) {
  return (value || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function encontrarEspecieSugerida(frase) {
  const fraseNormalizada = normalizeSpeciesText(frase);
  if (!fraseNormalizada) return null;

  let mejorCoincidencia = null;

  listaCompletaAves.forEach((ave) => {
    const posiblesNombres = [ave.nombre_es, ave.nombre_va, ave.commonName]
      .map((nombre) => normalizeSpeciesText(nombre))
      .filter(Boolean);

    const coincide = posiblesNombres.some(
      (nombre) =>
        fraseNormalizada.includes(nombre) &&
        (!mejorCoincidencia || nombre.length > mejorCoincidencia.matchLength),
    );

    if (coincide) {
      const nombreCoincidente = posiblesNombres.reduce((actual, nombre) => {
        if (!fraseNormalizada.includes(nombre)) return actual;
        if (!actual || nombre.length > actual.length) return nombre;
        return actual;
      }, "");

      mejorCoincidencia = {
        ave,
        matchLength: nombreCoincidente.length,
      };
    }
  });

  return mejorCoincidencia?.ave || null;
}

function seleccionarEspecieSugerida(ave) {
  if (!ave) return;
  selectEspecie.value = ave.id;
  selectEspecie.dispatchEvent(new Event("change"));
}

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

function buildLocalizedDescriptionPayload(rawText) {
  const text = (rawText || "").trim();
  const lang = getCurrentLang() === "ca" ? "ca" : "es";
  const i18n = {};
  if (text) i18n[lang] = text;
  return {
    descripcion: text,
    descripcion_original: text,
    descripcion_lang: lang,
    descripcion_i18n: i18n,
  };
}

const speciesModal = document.getElementById("speciesModal");
const speciesListContainer = document.getElementById("speciesListContainer");
const speciesSearchInput = document.getElementById("speciesSearchInput");
const speciesPickerTrigger = document.getElementById("speciesPickerTrigger");
const closeSpeciesModalBtn = document.getElementById("closeSpeciesModal");

onAuthStateChanged(auth, (user) => {
  if (user) {
    usuarioActual = user;
    cargarListaEspecies();
  } else {
    window.location.href = "login.html";
  }
});

async function cargarListaEspecies() {
  try {
    const querySnapshot = await getDocs(collection(db, "especies"));
    listaCompletaAves = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      listaCompletaAves.push({
        id: doc.id,
        nombre_es: data.nombre_es || "",
        nombre_va: data.nombre_va || "",
        commonName: data.commonName || "",
        imagen: data.wikipedia_image || "",
        frecuencia: data.frecuencia || "Común",
      });
    });

    //ordena alfabéticamente por nombre en español, si no existe usa el inglés
    listaCompletaAves.sort((a, b) => {
      const nombreA = getSpeciesDisplayName(a) || "";
      const nombreB = getSpeciesDisplayName(b) || "";
      return nombreA.localeCompare(nombreB);
    });
    rellenarSelect(listaCompletaAves);

    const urlParams = new URLSearchParams(window.location.search);
    const preSelectedCode = urlParams.get("especieCode");
    if (preSelectedCode) {
      const existe = listaCompletaAves.find((a) => a.id === preSelectedCode);
      if (existe) {
        selectEspecie.value = preSelectedCode;
        selectEspecie.dispatchEvent(new Event("change"));
      }
    }
  } catch (error) {
    console.error("Error aves:", error);
  }
}

function rellenarSelect(lista) {
  listaEspeciesActual = lista;
  selectEspecie.innerHTML = `<option value="" disabled selected>${t("common.selectSpecies")}</option>`;

  if (lista.length === 0) {
    const opt = document.createElement("option");
    opt.text = t("messages.detalle.noResults");
    selectEspecie.add(opt);
    return;
  }

  lista.forEach((sp) => {
    const option = document.createElement("option");
    option.value = sp.id;
    option.textContent = getSpeciesDisplayName(sp);
    selectEspecie.appendChild(option);
  });

  renderSpeciesList(lista);
}

function renderSpeciesList(lista) {
  if (!speciesListContainer) return;

  speciesListContainer.innerHTML = "";

  if (!lista || lista.length === 0) {
    const empty = document.createElement("div");
    empty.className = "species-empty-state";
    empty.textContent = t("messages.subir.noResults");
    speciesListContainer.appendChild(empty);
    return;
  }

  lista.forEach((sp) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "species-item";
    item.dataset.id = sp.id;

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
      selectEspecie.value = sp.id;
      selectEspecie.dispatchEvent(new Event("change"));
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
      // Pequeño retraso para asegurar que el input es visible antes de enfocar
      setTimeout(() => speciesSearchInput.focus(), 50);
    }
  } else {
    speciesModal.style.display = "none";
    speciesModal.setAttribute("aria-hidden", "true");
  }
}

if (speciesPickerTrigger) {
  speciesPickerTrigger.addEventListener("click", () => {
    setSpeciesModalOpen(true);
  });
}

if (closeSpeciesModalBtn) {
  closeSpeciesModalBtn.addEventListener("click", () => {
    setSpeciesModalOpen(false);
  });
}

if (speciesModal) {
  const backdrop = speciesModal.querySelector(".add-modal__backdrop");
  if (backdrop) {
    backdrop.addEventListener("click", () => setSpeciesModalOpen(false));
  }
}

if (speciesSearchInput) {
  speciesSearchInput.addEventListener("input", () => {
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
  });
}

selectEspecie.addEventListener("change", () => {
  const selected = selectEspecie.options[selectEspecie.selectedIndex];
  if (selected.value) {
    speciesDisplayText.textContent = selected.text;
    speciesDisplayText.classList.add("has-value");
    // Mostrar imagen de la especie seleccionada
    const especie = listaCompletaAves.find((e) => e.id === selected.value);
    const container = document.getElementById("especiePreviewContainer");
    const img = document.getElementById("especiePreviewImg");
    if (especie && especie.imagen) {
      img.src = especie.imagen;
      container.style.display = "block";
    } else {
      container.style.display = "none";
    }
  }
  checkValidity();
});

async function handlePhotoFileSelection(file) {
  fotoArchivo = file;
  if (fotoArchivo) {
    const reader = new FileReader();
    reader.onload = function (e) {
      fotoPreview.src = e.target.result;
      fotoPreview.classList.remove("hidden");
      photoUploaderLabel.querySelector(
        ".upload-placeholder-content",
      ).style.opacity = "0";
    };
    reader.readAsDataURL(fotoArchivo);
    checkValidity();
    mostrarCargandoSugerenciaIA();

    try {
      await solicitarSugerenciaIA(fotoArchivo);
    } catch (error) {
      console.error("Error en prediccion IA:", error);
      mostrarFraseSugerencia(getTextoNoSugerenciaIA());
    }
  }
}

async function handleAudioFileSelection(file) {
  audioArchivo = file;
  if (audioArchivo) {
    const reader = new FileReader();
    reader.onload = function (e) {
      audioPreview.src = e.target.result;
      audioPreview.style.display = "block";
      audioPreviewContainer.style.display = "flex";
      const content = audioUploaderLabel.querySelector(
        ".upload-placeholder-content",
      );
      if (content) content.style.display = "none";
    };
    reader.readAsDataURL(audioArchivo);
    checkValidity();

    if (!fotoArchivo) {
      mostrarCargandoSugerenciaIA();

      try {
        await solicitarSugerenciaIA(audioArchivo);
      } catch (error) {
        console.error("Error en prediccion IA:", error);
        mostrarFraseSugerencia(getTextoNoSugerenciaIA());
      }
    }
  }
}

if (photoUploaderLabel) {
  photoUploaderLabel.addEventListener("click", (e) => {
    e.preventDefault();
    setPhotoChoiceModalOpen(true);
  });
}

if (audioUploaderLabel) {
  audioUploaderLabel.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    setAudioChoiceModalOpen(true);
  });
}

if (photoChoiceModal) {
  const backdrop = photoChoiceModal.querySelector(".location-modal__backdrop");
  if (backdrop) {
    backdrop.addEventListener("click", () => setPhotoChoiceModalOpen(false));
  }
}

if (closePhotoChoiceBtn) {
  closePhotoChoiceBtn.addEventListener("click", () =>
    setPhotoChoiceModalOpen(false),
  );
}

if (btnChooseFromGallery) {
  btnChooseFromGallery.addEventListener("click", () => {
    setPhotoChoiceModalOpen(false);
    fotoInput.click();
  });
}

if (btnTakePhotoNow) {
  btnTakePhotoNow.addEventListener("click", () => {
    setPhotoChoiceModalOpen(false);
    if (fotoCameraInput) {
      fotoCameraInput.click();
    } else {
      fotoInput.click();
    }
  });
}

if (audioChoiceModal) {
  const backdrop = audioChoiceModal.querySelector(".location-modal__backdrop");
  if (backdrop) {
    backdrop.addEventListener("click", () => setAudioChoiceModalOpen(false));
  }
}

if (closeAudioChoiceBtn) {
  closeAudioChoiceBtn.addEventListener("click", () =>
    setAudioChoiceModalOpen(false),
  );
}

if (btnChooseAudioFromGallery) {
  btnChooseAudioFromGallery.addEventListener("click", () => {
    setAudioChoiceModalOpen(false);
    audioInput?.click();
  });
}

if (btnRecordAudioNow) {
  btnRecordAudioNow.addEventListener("click", () => {
    setAudioChoiceModalOpen(false);
    resetAudioRecorderUi();
    setAudioRecorderModalOpen(true);
  });
}

if (audioRecorderModal) {
  const backdrop = audioRecorderModal.querySelector(
    ".location-modal__backdrop",
  );
  if (backdrop) {
    backdrop.addEventListener("click", () => {
      stopAudioRecording(true);
      setAudioRecorderModalOpen(false);
    });
  }
}

if (closeAudioRecorderBtn) {
  closeAudioRecorderBtn.addEventListener("click", () => {
    stopAudioRecording(true);
    setAudioRecorderModalOpen(false);
  });
}

if (btnCancelAudioRecording) {
  btnCancelAudioRecording.addEventListener("click", () => {
    stopAudioRecording(true);
    setAudioRecorderModalOpen(false);
  });
}

if (btnStartAudioRecording) {
  btnStartAudioRecording.addEventListener("click", () => {
    startAudioRecording();
  });
}

if (btnStopAudioRecording) {
  btnStopAudioRecording.addEventListener("click", () => {
    stopAudioRecording(false);
  });
}

if (fotoInput) {
  fotoInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0] || null;
    await handlePhotoFileSelection(file);
    e.target.value = "";
  });
}

if (fotoCameraInput) {
  fotoCameraInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0] || null;
    await handlePhotoFileSelection(file);
    e.target.value = "";
  });
}

if (audioInput) {
  audioInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0] || null;
    await handleAudioFileSelection(file);
    e.target.value = "";
  });
}

triggerGeoBtn.addEventListener("click", () => {
  setLocationChoiceModalOpen(true);
});

if (locationChoiceModal) {
  const backdrop = locationChoiceModal.querySelector(
    ".location-modal__backdrop",
  );
  if (backdrop) {
    backdrop.addEventListener("click", () => setLocationChoiceModalOpen(false));
  }
}

if (closeLocationChoiceBtn) {
  closeLocationChoiceBtn.addEventListener("click", () =>
    setLocationChoiceModalOpen(false),
  );
}

if (btnUseCurrentLocation) {
  btnUseCurrentLocation.addEventListener("click", () => {
    usarUbicacionActual();
  });
}

if (btnPickOnMap) {
  btnPickOnMap.addEventListener("click", () => {
    setLocationChoiceModalOpen(false);
    if (typeof L === "undefined") {
      mostrarToast("El mapa no está disponible en este momento.", "aviso");
      return;
    }
    setLocationMapModalOpen(true);
  });
}

if (locationMapModal) {
  const backdrop = locationMapModal.querySelector(".location-modal__backdrop");
  if (backdrop) {
    backdrop.addEventListener("click", () => setLocationMapModalOpen(false));
  }
}

if (closeLocationMapBtn) {
  closeLocationMapBtn.addEventListener("click", () =>
    setLocationMapModalOpen(false),
  );
}

if (btnConfirmMapLocation) {
  btnConfirmMapLocation.addEventListener("click", () => {
    if (!pendingMapLocation) return;
    setGeoStatusFromCoords(pendingMapLocation.lat, pendingMapLocation.lng);
    setLocationMapModalOpen(false);
  });
}

function checkValidity() {
  if ((fotoArchivo || audioArchivo) && selectEspecie.value) {
    btnPublicar.disabled = false;
  } else {
    btnPublicar.disabled = true;
  }
}

btnPublicar.addEventListener("click", async (e) => {
  e.preventDefault();
  if (btnPublicar.disabled) return;

  btnPublicar.disabled = true;
  btnPublicar.innerText = t("messages.subir.sending");

  try {
    let urlFoto = null;
    let urlAudio = null;

    if (fotoArchivo) {
      const nombreArchivo = `avistamientos/${Date.now()}_img_${usuarioActual.uid}.jpg`;
      const storageRef = ref(storage, nombreArchivo);
      const snapshot = await uploadBytes(storageRef, fotoArchivo);
      urlFoto = await getDownloadURL(snapshot.ref);
    }

    if (audioArchivo) {
      const nombreArchivo = `avistamientos/${Date.now()}_aud_${usuarioActual.uid}.${audioArchivo.name.split(".").pop() || "mp3"}`;
      const storageRef = ref(storage, nombreArchivo);
      const snapshot = await uploadBytes(storageRef, audioArchivo);
      urlAudio = await getDownloadURL(snapshot.ref);
    }

    const especieSeleccionada =
      listaCompletaAves.find((e) => e.id === selectEspecie.value) || null;
    const speciesNameEs =
      especieSeleccionada?.nombre_es ||
      especieSeleccionada?.commonName ||
      selectEspecie.options[selectEspecie.selectedIndex].text;
    const speciesNameCa = especieSeleccionada?.nombre_va || speciesNameEs;
    const speciesNameI18n = {
      es: speciesNameEs,
      ca: speciesNameCa,
    };
    const descriptionPayload = buildLocalizedDescriptionPayload(
      document.getElementById("notas").value,
    );

    await addDoc(collection(db, "avistamientos"), {
      userId: usuarioActual.uid,
      userName: usuarioActual.displayName || t("common.unknownUser"),
      userPhoto: usuarioActual.photoURL,
      speciesId: selectEspecie.value,
      speciesName: selectEspecie.options[selectEspecie.selectedIndex].text,
      speciesName_i18n: speciesNameI18n,
      fotoUrl: urlFoto,
      audioUrl: urlAudio,
      ...descriptionPayload,
      location: {
        lat: parseFloat(latInput.value) || 0,
        lng: parseFloat(lngInput.value) || 0,
      },
      fecha: serverTimestamp(),
      likes: 0,
      frecuencia: especieSeleccionada?.frecuencia || "Común",
    });

    const userRef = doc(db, "usuarios", usuarioActual.uid);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data() || {};

    const especiesVistas = userData.especies_vistas || [];
    const especieId = selectEspecie.value;
    const esNuevaEspecie = !especiesVistas.includes(especieId);
    const tieneMultimedia = !!fotoArchivo || !!audioArchivo;

    const aveInfo = especieSeleccionada || {};

    const resultadoPuntos = calcularPuntosAvistamiento(
      aveInfo,
      tieneMultimedia,
      esNuevaEspecie,
    );
    const puntosGanados = resultadoPuntos.total;

    const statsSimulados = {
      ...userData,
      puntos: (userData.puntos || 0) + puntosGanados,
      avistamientos_count: (userData.avistamientos_count || 0) + 1,
      fotos_count: (userData.fotos_count || 0) + (tieneMultimedia ? 1 : 0),
      especies_vistas: esNuevaEspecie
        ? [...especiesVistas, especieId]
        : especiesVistas,
    };

    const nuevosLogrosDesbloqueados = verificarLogros(statsSimulados);

    await updateDoc(userRef, {
      puntos: increment(puntosGanados),
      avistamientos_count: increment(1),
      fotos_count: increment(tieneMultimedia ? 1 : 0),
      especies_vistas: arrayUnion(especieId),
      logros: arrayUnion(...nuevosLogrosDesbloqueados),
    });

    let mensaje = t("messages.subir.uploadOk", { points: puntosGanados });
    if (esNuevaEspecie) mensaje += t("messages.subir.newSpecies");
    if (nuevosLogrosDesbloqueados.length > 0)
      mensaje += t("messages.subir.achievements", {
        achievements: nuevosLogrosDesbloqueados.join(", "),
      });

    mostrarToast(mensaje, "exito");
    setTimeout(() => (window.location.href = "index.html"), 2000);
  } catch (error) {
    console.error(error);
    mostrarToast(t("messages.subir.uploadErrorPrefix") + error.message, "error");
    btnPublicar.disabled = false;
    btnPublicar.innerText = t("messages.subir.publish");
  }
});

//funcion que llama al backend y predice con ia
async function predecirEspecie(file, lang = getCurrentLang()) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("lang", lang === "ca" ? "ca" : "es");

  const response = await fetch(`${CONFIG.BACKEND_URL}/predict`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail ||
        t("messages.subir.uploadErrorPrefix") + response.status,
    );
  }

  const data = await response.json();
  return data;
}

async function solicitarSugerenciaIA(file) {
  const resultado = await predecirEspecie(file, getCurrentLang());
  if (resultado?.frase_sugerencia) {
    ultimaFraseSugerencia = resultado.frase_sugerencia;
    mostrarFraseSugerencia(resultado.frase_sugerencia);
  } else if (Array.isArray(resultado?.result)) {
    mostrarSugerencias(resultado.result);
  }
  return resultado;
}

// Función para mostrar sugerencias en pantalla
function mostrarSugerencias(sugerencias) {
  const contenedor = getSugerenciasContainer();
  contenedor.innerHTML = `
    <div class="ia-suggestion-card" aria-live="polite">
      <div class="ia-suggestion-header">
        <i class="fa fa-robot" aria-hidden="true"></i>
        <strong>${t("messages.subir.suggestedSpeciesTitle")}</strong>
      </div>
      <div class="ia-suggestion-list" id="iaSuggestionList"></div>
    </div>
  `;

  const lista = contenedor.querySelector("#iaSuggestionList");
  for (const especie of sugerencias) {
    // Buscar la especie en la base de datos por nombre en inglés, ignorando mayúsculas y espacios
    const ave = listaCompletaAves.find(
      (a) =>
        a.commonName &&
        a.commonName.trim().toLowerCase() ===
          especie.label.trim().toLowerCase(),
    );
    const nombreMostrar = ave ? getSpeciesDisplayName(ave) : especie.label;
    const item = document.createElement("button");
    item.type = "button";
    item.className = "ia-suggestion-item";
    item.innerHTML = `
      <span class="ia-suggestion-name">${nombreMostrar}</span>
      <span class="ia-suggestion-score">${(especie.score * 100).toFixed(1)}%</span>
    `;
    item.addEventListener("click", () => {
      if (ave) {
        selectEspecie.value = ave.id;
        selectEspecie.dispatchEvent(new Event("change"));
      }
    });
    lista.appendChild(item);
  }
}

function mostrarFraseSugerencia(frase) {
  const contenedor = getSugerenciasContainer();
  contenedor.innerHTML = `
    <div class="ia-suggestion-card" aria-live="polite">
      <div class="ia-suggestion-header">
        <i class="fa fa-robot" aria-hidden="true"></i>
        <strong>${t("messages.subir.suggestedSpeciesTitle")}</strong>
      </div>
      <p class="ia-suggestion-text">${frase}</p>
      <div class="ia-suggestion-actions" id="iaSuggestionActions"></div>
    </div>
  `;

  const aveSugerida = encontrarEspecieSugerida(frase);

  if (aveSugerida) {
    const acciones = contenedor.querySelector("#iaSuggestionActions");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "boton principal ia-suggestion-cta";
    button.textContent = `Seleccionar ${getSpeciesDisplayName(aveSugerida)}`;
    button.addEventListener("click", () => {
      seleccionarEspecieSugerida(aveSugerida);
    });
    acciones.appendChild(button);
  }
}

document.addEventListener("birdyval:language-changed", () => {
  if (listaCompletaAves.length > 0) {
    rellenarSelect(
      listaEspeciesActual.length ? listaEspeciesActual : listaCompletaAves,
    );
  }
  if (!selectEspecie.value) {
    speciesDisplayText.textContent = t("common.selectSpecies");
  }
  if (!latInput.value || !lngInput.value) {
    geoStatus.innerText = getGeoPlaceholderText();
  }
  if (!btnPublicar.disabled) {
    btnPublicar.innerText = t("messages.subir.publish");
  }

  if (fotoArchivo) {
    mostrarCargandoSugerenciaIA();
    solicitarSugerenciaIA(fotoArchivo).catch((error) => {
      console.error("Error al refrescar sugerencia IA por idioma:", error);
      if (ultimaFraseSugerencia) {
        mostrarFraseSugerencia(ultimaFraseSugerencia);
      } else {
        mostrarFraseSugerencia(getTextoNoSugerenciaIA());
      }
    });
  }
});
