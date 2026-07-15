// js/chat.js
import { auth, db } from "./firebase.js";
import { mostrarToast } from "./notificaciones.js";
import {
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { calcularNivel } from "./gamificacion.js";
import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  increment,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


function getChatId(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

function formatHora(timestamp) {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function formatFechaSep(timestamp) {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const hoy = new Date();
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);

  if (date.toDateString() === hoy.toDateString()) return "Hoy";
  if (date.toDateString() === ayer.toDateString()) return "Ayer";

  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}


const headerAvatar = document.getElementById("chatHeaderAvatar");
const headerNombre = document.getElementById("chatHeaderNombre");
const headerEstado = document.getElementById("chatHeaderEstado");
const headerLink = document.getElementById("chatHeaderLink");
const contenedor = document.getElementById("chatMensajes");
const inputEl = document.getElementById("chatInput");
const sendBtn = document.getElementById("chatSendBtn");


let miUid = null;
let otroUid = null;
let chatId = null;
let miAvatar = "img/user_default.png";
let otroAvatar = "img/user_default.png";
let unsubMessages = null;


inputEl.addEventListener("input", () => {
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 100) + "px";
  sendBtn.disabled = inputEl.value.trim().length === 0;
});

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) enviarMensaje();
  }
});

sendBtn.addEventListener("click", enviarMensaje);


function renderMensajes(mensajes) {
  const wasAtBottom = isScrolledToBottom();
  contenedor.innerHTML = "";

  if (mensajes.length === 0) {
    contenedor.innerHTML = `
      <div class="mensajes-empty">
        <i class="fa fa-comments"></i>
        <p>Aquí aparecerán tus mensajes.<br>¡Rompe el hielo y saluda!</p>
      </div>
    `;
    return;
  }

  let lastDateStr = null;

  mensajes.forEach((msg) => {
    const esMio = msg.autorId === miUid;
    const sideClass = esMio ? "mia" : "suya";

    const dateStr = msg.fecha ? formatFechaSep(msg.fecha) : null;
    if (dateStr && dateStr !== lastDateStr) {
      const sep = document.createElement("div");
      sep.className = "chat-fecha-sep";
      sep.textContent = dateStr;
      contenedor.appendChild(sep);
      lastDateStr = dateStr;
    }

    const wrap = document.createElement("div");
    wrap.className = `burbuja-wrap ${sideClass}`;

    const avatarSrc = esMio ? miAvatar : otroAvatar;

    wrap.innerHTML = `
      <img class="burbuja-avatar" src="${avatarSrc}" alt="" onerror="this.src='img/user_default.png'" />
      <div class="burbuja">
        ${escapeHtml(msg.texto)}
        <span class="burbuja__hora">${formatHora(msg.fecha)}</span>
      </div>
    `;

    contenedor.appendChild(wrap);
  });

  if (wasAtBottom) scrollToBottom();
}

function isScrolledToBottom() {
  return contenedor.scrollHeight - contenedor.scrollTop - contenedor.clientHeight < 60;
}

function scrollToBottom() {
  contenedor.scrollTop = contenedor.scrollHeight;
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}


async function enviarMensaje() {
  const texto = inputEl.value.trim();
  if (!texto || !chatId) return;

  sendBtn.disabled = true;
  inputEl.value = "";
  inputEl.style.height = "auto";

  try {
    const chatRef = doc(db, "chats", chatId);
    const mensajesRef = collection(db, "chats", chatId, "mensajes");

    await setDoc(
      chatRef,
      {
        participantes: [miUid, otroUid],
        ultimoMensaje: texto,
        ultimaFecha: serverTimestamp(),
        [`noLeidos_${otroUid}`]: increment(1),
        [`noLeidos_${miUid}`]: 0,
      },
      { merge: true }
    );

    await addDoc(mensajesRef, {
      texto,
      autorId: miUid,
      fecha: serverTimestamp(),
    });
  } catch (err) {
    console.error("Error enviando mensaje:", err);
    mostrarToast("No se pudo enviar el mensaje. Inténtalo de nuevo.", "error");
    inputEl.value = texto;
    inputEl.dispatchEvent(new Event("input"));
  }
}


function suscribirMensajes() {
  if (unsubMessages) unsubMessages();

  const mensajesRef = collection(db, "chats", chatId, "mensajes");
  const q = query(mensajesRef, orderBy("fecha", "asc"));

  unsubMessages = onSnapshot(
    q,
    (snap) => {
      const msgs = [];
      snap.forEach((d) => msgs.push({ id: d.id, ...d.data() }));
      renderMensajes(msgs);
      scrollToBottom();
    },
    (err) => {
      console.error("Error escuchando mensajes:", err);
    }
  );
}


async function marcarLeidos() {
  if (!chatId || !miUid) return;
  try {
    const chatRef = doc(db, "chats", chatId);
    await updateDoc(chatRef, {
      [`noLeidos_${miUid}`]: 0,
    });
  } catch (_) {
  }
}

async function cargarOtroUsuario() {
  try {
    const snap = await getDoc(doc(db, "usuarios", otroUid));
    if (snap.exists()) {
      const data = snap.data();
      const nombre = data.nombre_usuario || "Usuario";
      if (headerNombre) headerNombre.textContent = nombre;
      if (headerEstado) {
        const puntos = data.puntos || 0;
        const nivelData = calcularNivel(puntos);
        headerEstado.textContent = `${nivelData.icon} ${nivelData.nombre}`;
      }
      if (data.foto && headerAvatar) {
        headerAvatar.src = data.foto;
        otroAvatar = data.foto;
      }
      if (headerLink) headerLink.href = `perfil_publico.html?userId=${otroUid}`;
      document.title = `Chat con ${nombre} — BirdyVal`;
    }
  } catch (err) {
    console.error("Error cargando datos del otro usuario:", err);
  }
}

async function cargarMiAvatar(uid) {
  try {
    const snap = await getDoc(doc(db, "usuarios", uid));
    if (snap.exists() && snap.data().foto) {
      miAvatar = snap.data().foto;
    }
  } catch (err) {
    console.warn('Error cargando avatar propio:', err.message);
  }
}


onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  miUid = user.uid;

  const params = new URLSearchParams(window.location.search);
  otroUid = params.get("userId");

  if (!otroUid) {
    mostrarToast("Parámetro userId no encontrado.", "error");
    setTimeout(() => (window.location.href = "mensajes.html"), 1800);
    return;
  }

  if (otroUid === miUid) {
    mostrarToast("No puedes chatear contigo mismo.", "aviso");
    setTimeout(() => (window.location.href = "mensajes.html"), 1800);
    return;
  }

  chatId = getChatId(miUid, otroUid);

  await Promise.all([
    cargarOtroUsuario(),
    cargarMiAvatar(miUid),
  ]);

  suscribirMensajes();
  marcarLeidos();

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) marcarLeidos();
  });
});
