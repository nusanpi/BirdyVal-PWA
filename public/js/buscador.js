import { db } from "./firebase.js";
import {
  collection,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { t, getCurrentLang } from "./i18n.js";

let todosLosPajaros = [];

const listaElemento = document.getElementById("speciesList");
const inputElemento = document.getElementById("searchInput");
async function cargarPajaros() {
  const loadingText = t("messages.buscador.loadingSpecies");
  // Si t() devuelve la clave cruda, usar un texto por defecto
  const displayText = loadingText.includes("messages.")
    ? "Cargando especies..."
    : loadingText;
  listaElemento.innerHTML = `<li class="loading">${displayText}</li>`;

  try {
    const querySnapshot = await getDocs(collection(db, "especies"));

    todosLosPajaros = querySnapshot.docs.map((doc) => doc.data());

    renderizarLista(todosLosPajaros);
  } catch (error) {
    console.error("Error cargando pájaros:", error);
    listaElemento.innerHTML = `<li class="error">${t("messages.buscador.loadError")}</li>`;
  }
}

function renderizarLista(lista) {
  listaElemento.innerHTML = "";

  if (lista.length === 0) {
    listaElemento.innerHTML = `<li class="no-results">${t("messages.buscador.noResults")}</li>`;
    return;
  }

  lista.forEach((pajaro) => {
    const li = document.createElement("li");
    li.className = "species-card";
    const lang = getCurrentLang();
    const displayName =
      lang === "ca"
        ? pajaro.nombre_va || pajaro.nombre_es || pajaro.commonName
        : pajaro.nombre_es || pajaro.nombre_va || pajaro.commonName;

    const imagen = pajaro.wikipedia_image || "img/logo_sintexto.png";

    li.innerHTML = `
            <div class="species-media">
                <img src="${imagen}" alt="${pajaro.commonName}" loading="lazy" />
            </div>
            <div class="species-info">
              <p class="species-name">${displayName}</p>
                <p class="species-scientific">${pajaro.scientificName}</p>
            </div>
            <a class="species-link" href="ficha_especie.html?id=${pajaro.speciesCode}">${t("common.viewCard")}</a>
        `;

    listaElemento.appendChild(li);
  });
}

document.addEventListener("birdyval:language-changed", () => {
  renderizarLista(todosLosPajaros);
});

//asi se llama cada vez que se escribe una letra
// inputElemento.addEventListener('input', (e) => {
//     const textoBusqueda = e.target.value.toLowerCase();
//     const filtrados = todosLosPajaros.filter(pajaro =>
//         (pajaro.nombre_es && pajaro.nombre_es.toLowerCase().includes(textoBusqueda)) ||
//         (pajaro.scientificName && pajaro.scientificName.toLowerCase().includes(textoBusqueda))||
//         (pajaro.nombre_va && pajaro.nombre_va.toLowerCase().includes(textoBusqueda))
//     );

//     renderizarLista(filtrados);
// });

// retrasa la ejecución de la función hasta que el usuario deja de escribir para evitar llamadas excesivas
function debounce(callback, wait) {
  let timerId;
  return (...args) => {
    clearTimeout(timerId);
    timerId = setTimeout(() => {
      callback(...args);
    }, wait);
  };
}

inputElemento.addEventListener("input", debounce(filtrar, 200));

function filtrar() {
  const texto = inputElemento.value.toLowerCase().trim();

  if (texto === "") {
    renderizarLista(todosLosPajaros);
    return;
  }

  const filtrados = todosLosPajaros.filter(
    (p) =>
      (p.nombre_es && p.nombre_es.toLowerCase().includes(texto)) ||
      (p.scientificName && p.scientificName.toLowerCase().includes(texto)) ||
      (p.nombre_va && p.nombre_va.toLowerCase().includes(texto)),
  );

  renderizarLista(filtrados);
}

document.addEventListener("DOMContentLoaded", () => {
  cargarPajaros();

  setTimeout(() => {
    try {
      inputElemento.focus();
    } catch (e) {}
  }, 500);
});

//HACER PAGINACIÓN
