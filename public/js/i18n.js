const STORAGE_KEY = "userLanguage";
const DEFAULT_LANG = "es";
const SUPPORTED_LANGS = new Set(["es", "ca"]);

let currentLang = DEFAULT_LANG;
let translations = {};

function getByPath(obj, path) {
  return path.split(".").reduce((acc, key) => {
    if (acc && Object.prototype.hasOwnProperty.call(acc, key)) {
      return acc[key];
    }
    return undefined;
  }, obj);
}

function interpolate(template, params = {}) {
  if (typeof template !== "string") return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      return String(params[key]);
    }
    return `{${key}}`;
  });
}

function detectLanguage() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && SUPPORTED_LANGS.has(saved)) {
    return saved;
  }

  const browserLang = (navigator.language || "").toLowerCase();
  if (browserLang.startsWith("ca")) {
    return "ca";
  }
  return DEFAULT_LANG;
}

async function loadLanguage(lang) {
  const langCode = SUPPORTED_LANGS.has(lang) ? lang : DEFAULT_LANG;
  const response = await fetch(`./i18n/${langCode}.json`, {
    cache: "no-cache",
  });
  if (!response.ok) {
    throw new Error(`No se pudo cargar el idioma ${langCode}`);
  }
  translations = await response.json();
  currentLang = langCode;
  document.documentElement.lang = langCode;
  return translations;
}

function t(key, params = {}) {
  const value = getByPath(translations, key);
  if (typeof value === "string") {
    return interpolate(value, params);
  }
  return key;
}

function replaceAttributeValues(attrName, attrMap) {
  if (!attrMap || typeof attrMap !== "object") return;

  document.querySelectorAll(`[${attrName}]`).forEach((el) => {
    const raw = el.getAttribute(attrName);
    if (!raw) return;

    if (el.hasAttribute(`data-i18n-${attrName}`)) {
      const key = el.getAttribute(`data-i18n-${attrName}`);
      const translated = t(key);
      if (translated !== key) {
        el.setAttribute(attrName, translated);
      } else if (attrMap[key]) {
        // Fallback para claves literales en attributeMap (p.ej., placeholders)
        el.setAttribute(attrName, attrMap[key]);
      }
      return;
    }

    const translated = attrMap[raw.trim()];
    if (translated) {
      el.setAttribute(attrName, translated);
    }
  });
}

function applyTextMap(root = document.body) {
  const textMap = translations.textMap || {};
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.parentElement) continue;

    const parentTag = node.parentElement.tagName;
    if (
      parentTag === "SCRIPT" ||
      parentTag === "STYLE" ||
      parentTag === "NOSCRIPT"
    ) {
      continue;
    }

    const raw = node.nodeValue;
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const translated = textMap[trimmed];
    if (!translated) continue;

    const prefix = raw.slice(0, raw.indexOf(trimmed));
    const suffix = raw.slice(raw.indexOf(trimmed) + trimmed.length);
    node.nodeValue = `${prefix}${translated}${suffix}`;
  }
}

function applyDataI18n(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (!key) return;
    el.textContent = t(key);
  });

  root.querySelectorAll("[data-i18n-alt]").forEach((el) => {
    const key = el.getAttribute("data-i18n-alt");
    if (!key) return;
    el.setAttribute("alt", t(key));
  });

  root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (!key) return;
    const translated = t(key);
    if (translated !== key) {
      el.setAttribute("placeholder", translated);
    } else {
      const attrMap = translations.attributeMap;
      if (attrMap && attrMap.placeholder && attrMap.placeholder[key]) {
        el.setAttribute("placeholder", attrMap.placeholder[key]);
      }
    }
  });

  root.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const key = el.getAttribute("data-i18n-title");
    if (!key) return;
    el.setAttribute("title", t(key));
  });

  root.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria-label");
    if (!key) return;
    el.setAttribute("aria-label", t(key));
  });
}

function ensureLanguageSwitcher() {
  if (document.getElementById("languageSwitcher")) return;

  const wrapper = document.createElement("div");
  wrapper.id = "languageSwitcher";
  wrapper.style.cssText =
    "position:fixed;top:12px;right:12px;z-index:10000;background:#ffffffeb;border:1px solid #d8e3dc;border-radius:999px;padding:4px;display:flex;gap:4px;box-shadow:0 8px 20px rgba(0,0,0,0.12);backdrop-filter:blur(4px);";

  const btnEs = document.createElement("button");
  btnEs.type = "button";
  btnEs.dataset.lang = "es";
  btnEs.textContent = t("common.langEs");
  btnEs.style.cssText =
    "border:none;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:600;cursor:pointer;background:transparent;color:#1f2937;";

  const btnCa = document.createElement("button");
  btnCa.type = "button";
  btnCa.dataset.lang = "ca";
  btnCa.textContent = t("common.langCa");
  btnCa.style.cssText = btnEs.style.cssText;

  function paintActive() {
    [btnEs, btnCa].forEach((btn) => {
      const isActive = btn.dataset.lang === currentLang;
      btn.style.background = isActive ? "#4fa17f" : "transparent";
      btn.style.color = isActive ? "#ffffff" : "#1f2937";
    });
  }

  btnEs.addEventListener("click", () => setLanguage("es"));
  btnCa.addEventListener("click", () => setLanguage("ca"));

  wrapper.appendChild(btnEs);
  wrapper.appendChild(btnCa);
  document.body.appendChild(wrapper);
  paintActive();

  document.addEventListener("birdyval:language-changed", paintActive);
}

function applyTranslations(root = document) {
  applyDataI18n(root);
  applyTextMap(root.body || root);

  const titleMap = translations.textMap || {};
  if (document.title && titleMap[document.title]) {
    document.title = titleMap[document.title];
  }

  const attrMap = translations.attributeMap || {};
  replaceAttributeValues("placeholder", attrMap.placeholder);
  replaceAttributeValues("title", attrMap.title);
  replaceAttributeValues("aria-label", attrMap["aria-label"]);
}

async function setLanguage(lang) {
  const langCode = SUPPORTED_LANGS.has(lang) ? lang : DEFAULT_LANG;
  localStorage.setItem(STORAGE_KEY, langCode);
  await loadLanguage(langCode);
  applyTranslations(document);

  // Re-aplicar traducciones a contenido dinámico
  setTimeout(() => {
    applyTranslations(document);
  }, 100);

  document.dispatchEvent(
    new CustomEvent("birdyval:language-changed", {
      detail: { lang: langCode },
    }),
  );
}

async function initI18n() {
  try {
    const lang = detectLanguage();
    await loadLanguage(lang);
    applyTranslations(document);
    ensureLanguageSwitcher();
  } catch (err) {
    console.error("Error inicializando i18n:", err);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initI18n);
} else {
  initI18n();
}

window.BirdyI18n = {
  t,
  setLanguage,
  getCurrentLang: () => currentLang,
  applyTranslations,
};

export { t, setLanguage, loadLanguage, applyTranslations };
export function getCurrentLang() {
  return currentLang;
}
