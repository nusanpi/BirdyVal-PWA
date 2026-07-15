// js/mensajes.js
import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const lista = document.getElementById("mensajesLista");


function formatHoraCorta(timestamp) {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const hoy = new Date();

  if (date.toDateString() === hoy.toDateString()) {
    return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

const usuariosCache = {};

async function obtenerDatosUsuario(uid) {
  if (usuariosCache[uid]) return usuariosCache[uid];
  try {
    const snap = await getDoc(doc(db, "usuarios", uid));
    if (snap.exists()) {
      usuariosCache[uid] = snap.data();
      return snap.data();
    }
  } catch (err) {
    console.warn('Error cargando datos de usuario:', err.message);
  }
  return null;
}

async function renderChats(chats, miUid) {
  if (chats.length === 0) {
    lista.innerHTML = `
      <div class="mensajes-empty">
        <i class="fa fa-comment-slash"></i>
        <p>Todavía no tienes ninguna conversación.<br>Visita el perfil de otro birdwatcher para iniciar un chat.</p>
      </div>
    `;
    return;
  }

  lista.innerHTML = "";

  for (const chat of chats) {
    const otroUid = chat.participantes.find((p) => p !== miUid);
    if (!otroUid) continue;

    const datosOtro = await obtenerDatosUsuario(otroUid);
    const nombre = datosOtro?.nombre_usuario || "Usuario";
    const avatar = datosOtro?.foto || "img/user_default.png";

    const noLeidos = chat[`noLeidos_${miUid}`] || 0;
    const ultimoMsg = chat.ultimoMensaje || "Empezad a hablar 🐦";
    const hora = chat.ultimaFecha ? formatHoraCorta(chat.ultimaFecha) : "";

    const esNoLeido = noLeidos > 0;

    const item = document.createElement("a");
    item.className = `chat-item${esNoLeido ? " no-leido" : ""}`;
    item.href = `chat.html?userId=${otroUid}`;
    item.setAttribute("aria-label", `Chat con ${nombre}`);

    item.innerHTML = `
      <img
        class="chat-item__avatar"
        src="${avatar}"
        alt="${nombre}"
        onerror="this.src='img/user_default.png'"
      />
      <div class="chat-item__info">
        <p class="chat-item__nombre">${escapeHtml(nombre)}</p>
        <p class="chat-item__preview">${escapeHtml(ultimoMsg)}</p>
      </div>
      <div class="chat-item__meta">
        <span class="chat-item__hora">${hora}</span>
        ${esNoLeido ? `<span class="chat-item__dot" title="${noLeidos} nuevo(s)"></span>` : ""}
      </div>
    `;

    lista.appendChild(item);
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const miUid = user.uid;

  const chatsRef = collection(db, "chats");
  const q = query(chatsRef, where("participantes", "array-contains", miUid));

  lista.innerHTML = `<p class="chat-loading"><i class="fa fa-spinner fa-spin"></i> Cargando conversaciones...</p>`;

  onSnapshot(
    q,
    async (snap) => {
      const chats = [];
      snap.forEach((d) => chats.push({ id: d.id, ...d.data() }));

      chats.sort((a, b) => {
        const fA = a.ultimaFecha?.seconds || 0;
        const fB = b.ultimaFecha?.seconds || 0;
        return fB - fA;
      });

      await renderChats(chats, miUid);
    },
    (err) => {
      console.error("Error cargando chats:", err);
      lista.innerHTML = `
        <div class="mensajes-empty">
          <i class="fa fa-exclamation-circle"></i>
          <p>Error cargando conversaciones. Inténtalo más tarde.</p>
        </div>
      `;
    }
  );
});
