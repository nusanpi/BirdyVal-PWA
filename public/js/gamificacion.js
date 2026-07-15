// public/js/gamificacion.js

export const PUNTOS_CONFIG = {
  BASE: 10,
  FOTO: 15,
  NUEVA_ESPECIE: 50,
  RAREZA: {
    Común: 0,
    "Muy común": 0,
    "Poco común": 20,
    Rara: 50,
    "No avistado / Rareza": 100,
  },
};

export function calcularPuntosAvistamiento(aveData, tieneMultimedia, esNuevaEspecie) {
  let puntos = PUNTOS_CONFIG.BASE;

  if (tieneMultimedia) puntos += PUNTOS_CONFIG.FOTO;
  if (esNuevaEspecie) puntos += PUNTOS_CONFIG.NUEVA_ESPECIE;

  const frecuencia = aveData.frecuencia || "Común";
  let bonusRareza = 0;
  if (frecuencia.includes("No avistado"))
    bonusRareza = PUNTOS_CONFIG.RAREZA["No avistado / Rareza"];
  else if (frecuencia.includes("Rara"))
    bonusRareza = PUNTOS_CONFIG.RAREZA["Rara"];
  else if (
    frecuencia.includes("Poco común") ||
    frecuencia.includes("Poco comÃºn")
  )
    bonusRareza = PUNTOS_CONFIG.RAREZA["Poco común"];

  puntos += bonusRareza;

  //desglose de puntos
  return {
    total: puntos,
    desglose: {
      base: PUNTOS_CONFIG.BASE,
      foto: tieneMultimedia ? PUNTOS_CONFIG.FOTO : 0,
      nueva: esNuevaEspecie ? PUNTOS_CONFIG.NUEVA_ESPECIE : 0,
      rareza: bonusRareza,
    },
  };
}

export function calcularNivel(puntos) {
  const lang =
    (typeof localStorage !== "undefined" &&
      localStorage.getItem("userLanguage")) ||
    "es";
  const niveles = {
    es: [
      { min: 5000, nombre: "Leyenda de la Albufera", icon: "👑" },
      { min: 2000, nombre: "Guardián del Turia", icon: "🌿" },
      { min: 1000, nombre: "Ornitólogo", icon: "🔭" },
      { min: 600, nombre: "Explorador", icon: "🧭" },
      { min: 300, nombre: "Volantón", icon: "🐥" },
      { min: 100, nombre: "Polluelo", icon: "🐣" },
      { min: 0, nombre: "Huevo (Novato)", icon: "🥚" },
    ],
    ca: [
      { min: 5000, nombre: "Llegenda de l'Albufera", icon: "👑" },
      { min: 2000, nombre: "Guardià del Túria", icon: "🌿" },
      { min: 1000, nombre: "Ornitòleg", icon: "🔭" },
      { min: 600, nombre: "Explorador", icon: "🧭" },
      { min: 300, nombre: "Volantó", icon: "🐥" },
      { min: 100, nombre: "Pollet", icon: "🐣" },
      { min: 0, nombre: "Ou (Novell)", icon: "🥚" },
    ],
  };
  const lista = niveles[lang] || niveles.es;
  for (const nivel of lista) {
    if (puntos >= nivel.min) return nivel;
  }
  return lista[lista.length - 1];
}

export const LISTA_LOGROS = [
  {
    id: "primer_paso",
    titulo: { es: "El Primer Paso", ca: "El Primer Pas" },
    desc: {
      es: "Sube tu primer avistamiento.",
      ca: "Puja el teu primer avistament.",
    },
    icon: "🥚",
    meta: 1,
    tipo: "count",
  },
  {
    id: "paparazzi",
    titulo: { es: "Paparazzi", ca: "Paparazzi" },
    desc: {
      es: "Sube 5 avistamientos con foto.",
      ca: "Puja 5 avistaments amb foto.",
    },
    icon: "📸",
    meta: 5,
    tipo: "count",
  },
  {
    id: "explorador",
    titulo: { es: "Explorador", ca: "Explorador" },
    desc: {
      es: "Alcanza los 20 avistamientos.",
      ca: "Arriba als 20 avistaments.",
    },
    icon: "🧭",
    meta: 20,
    tipo: "count",
  },
  {
    id: "veterano",
    titulo: { es: "Veterano", ca: "Veterà" },
    desc: {
      es: "Consigue 300 puntos de experiencia.",
      ca: "Aconsegueix 300 punts d'experiència.",
    },
    icon: "🎖️",
    meta: 300,
    tipo: "puntos",
  },
  {
    id: "influencer",
    titulo: { es: "Influencer", ca: "Influencer" },
    desc: { es: "Llega a 1000 puntos.", ca: "Arriba a 1000 punts." },
    icon: "✨",
    meta: 1000,
    tipo: "puntos",
  },
];

export function getLogroTexto(logro) {
  const lang =
    (typeof localStorage !== "undefined" &&
      localStorage.getItem("userLanguage")) ||
    "es";
  return {
    titulo:
      typeof logro.titulo === "object"
        ? logro.titulo[lang] || logro.titulo.es
        : logro.titulo,
    desc:
      typeof logro.desc === "object"
        ? logro.desc[lang] || logro.desc.es
        : logro.desc,
  };
}
export function verificarLogros(statsUsuario) {
  const nuevosLogros = [];
  const logrosActuales = statsUsuario.logros || [];

  LISTA_LOGROS.forEach((logro) => {
    if (logrosActuales.includes(logro.id)) return;

    let cumplido = false;

    if (logro.tipo === "count") {
      if (logro.id === "paparazzi") {
        if ((statsUsuario.fotos_count || 0) >= logro.meta) cumplido = true;
      } else {
        if ((statsUsuario.avistamientos_count || 0) >= logro.meta)
          cumplido = true;
      }
    } else if (logro.tipo === "puntos") {
      if ((statsUsuario.puntos || 0) >= logro.meta) cumplido = true;
    }

    if (cumplido) {
      nuevosLogros.push(logro.id);
    }
  });

  return nuevosLogros;
}
