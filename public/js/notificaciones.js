let toastContainer = null;

function getContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.className = "toast-container";
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

function cerrarToast(toast) {
  if (toast._timer) clearTimeout(toast._timer);
  toast.classList.remove("toast--visible");
  toast.classList.add("toast--saliendo");
  toast.addEventListener("transitionend", () => toast.remove(), { once: true });
}

const ICONOS = { exito: "✓", error: "✕", aviso: "⚠", info: "ℹ" };

export function mostrarToast(mensaje, tipo = "info", duracion = 4000) {
  const container = getContainer();
  const toast = document.createElement("div");
  toast.className = `toast toast--${tipo}`;

  toast.innerHTML = `
    <span class="toast__icon">${ICONOS[tipo] ?? ICONOS.info}</span>
    <span class="toast__mensaje">${mensaje}</span>
    <button class="toast__cerrar" aria-label="Cerrar">×</button>
  `;

  toast.querySelector(".toast__cerrar").addEventListener("click", () => cerrarToast(toast));
  container.appendChild(toast);

  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add("toast--visible")));

  toast._timer = setTimeout(() => cerrarToast(toast), duracion);
  return toast;
}
