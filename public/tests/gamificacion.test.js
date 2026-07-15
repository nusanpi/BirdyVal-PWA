/**
 * Tests de gamificacion.js — BirdyVal
 *
 * Cubre: calcularPuntosAvistamiento, calcularNivel, verificarLogros, getLogroTexto
 *
 * Ejecutar con:
 *   npx vitest run public/tests/gamificacion.test.js
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  calcularPuntosAvistamiento,
  calcularNivel,
  verificarLogros,
  getLogroTexto,
  PUNTOS_CONFIG,
  LISTA_LOGROS,
} from "../js/gamificacion.js";

// ─────────────────────────────────────────────
// calcularPuntosAvistamiento
// ─────────────────────────────────────────────

describe("calcularPuntosAvistamiento", () => {
  it("devuelve 10 puntos base para un avistamiento sin foto ni nueva especie", () => {
    const resultado = calcularPuntosAvistamiento({}, false, false);
    expect(resultado.total).toBe(10);
    expect(resultado.desglose.base).toBe(10);
    expect(resultado.desglose.foto).toBe(0);
    expect(resultado.desglose.nueva).toBe(0);
    expect(resultado.desglose.rareza).toBe(0);
  });

  it("suma 15 puntos extra cuando el avistamiento incluye foto", () => {
    const resultado = calcularPuntosAvistamiento({}, true, false);
    expect(resultado.total).toBe(25);
    expect(resultado.desglose.foto).toBe(15);
  });

  it("suma 50 puntos extra cuando es la primera vez que se avista esa especie", () => {
    const resultado = calcularPuntosAvistamiento({}, false, true);
    expect(resultado.total).toBe(60);
    expect(resultado.desglose.nueva).toBe(50);
  });

  it("calcula 75 puntos para avistamiento con foto de especie nueva sin rareza", () => {
    const resultado = calcularPuntosAvistamiento({}, true, true);
    expect(resultado.total).toBe(75);
  });

  it("suma 20 puntos de rareza para un ave 'Poco común'", () => {
    const aveData = { frecuencia: "Poco común" };
    const resultado = calcularPuntosAvistamiento(aveData, false, false);
    expect(resultado.desglose.rareza).toBe(20);
    expect(resultado.total).toBe(30);
  });

  it("suma 50 puntos de rareza para un ave 'Rara'", () => {
    const aveData = { frecuencia: "Rara" };
    const resultado = calcularPuntosAvistamiento(aveData, false, false);
    expect(resultado.desglose.rareza).toBe(50);
    expect(resultado.total).toBe(60);
  });

  it("suma 100 puntos de rareza para un ave 'No avistado / Rareza'", () => {
    const aveData = { frecuencia: "No avistado / Rareza" };
    const resultado = calcularPuntosAvistamiento(aveData, false, false);
    expect(resultado.desglose.rareza).toBe(100);
    expect(resultado.total).toBe(110);
  });

  it("no suma rareza si el ave es 'Común'", () => {
    const aveData = { frecuencia: "Común" };
    const resultado = calcularPuntosAvistamiento(aveData, false, false);
    expect(resultado.desglose.rareza).toBe(0);
  });

  it("no suma rareza si el ave es 'Muy común'", () => {
    const aveData = { frecuencia: "Muy común" };
    const resultado = calcularPuntosAvistamiento(aveData, false, false);
    expect(resultado.desglose.rareza).toBe(0);
  });

  it("trata frecuencia ausente como 'Común' (sin bonus)", () => {
    const resultado = calcularPuntosAvistamiento({}, false, false);
    expect(resultado.desglose.rareza).toBe(0);
  });

  it("calcula el máximo posible: foto + nueva especie + rareza máxima", () => {
    const aveData = { frecuencia: "No avistado / Rareza" };
    const resultado = calcularPuntosAvistamiento(aveData, true, true);
    // 10 base + 15 foto + 50 nueva + 100 rareza = 175
    expect(resultado.total).toBe(175);
  });
});

// ─────────────────────────────────────────────
// calcularNivel
// ─────────────────────────────────────────────

describe("calcularNivel", () => {
  beforeEach(() => {
    // Simular idioma español por defecto
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => "es"),
      setItem: vi.fn(),
    });
  });

  it("devuelve nivel 'Huevo (Novato)' con 0 puntos", () => {
    const nivel = calcularNivel(0);
    expect(nivel.nombre).toBe("Huevo (Novato)");
  });

  it("devuelve nivel 'Polluelo' al llegar a 100 puntos", () => {
    const nivel = calcularNivel(100);
    expect(nivel.nombre).toBe("Polluelo");
  });

  it("devuelve nivel 'Polluelo' con 299 puntos (justo antes del siguiente nivel)", () => {
    const nivel = calcularNivel(299);
    expect(nivel.nombre).toBe("Polluelo");
  });

  it("devuelve nivel 'Volantón' al llegar a 300 puntos", () => {
    const nivel = calcularNivel(300);
    expect(nivel.nombre).toBe("Volantón");
  });

  it("devuelve nivel 'Explorador' al llegar a 600 puntos", () => {
    const nivel = calcularNivel(600);
    expect(nivel.nombre).toBe("Explorador");
  });

  it("devuelve nivel 'Ornitólogo' al llegar a 1000 puntos", () => {
    const nivel = calcularNivel(1000);
    expect(nivel.nombre).toBe("Ornitólogo");
  });

  it("devuelve nivel 'Guardián del Turia' al llegar a 2000 puntos", () => {
    const nivel = calcularNivel(2000);
    expect(nivel.nombre).toBe("Guardián del Turia");
  });

  it("devuelve 'Leyenda de la Albufera' al superar 5000 puntos", () => {
    const nivel = calcularNivel(5000);
    expect(nivel.nombre).toBe("Leyenda de la Albufera");
  });

  it("devuelve 'Leyenda de la Albufera' con puntuación muy alta", () => {
    const nivel = calcularNivel(99999);
    expect(nivel.nombre).toBe("Leyenda de la Albufera");
  });

  it("cada nivel tiene icono definido", () => {
    [0, 100, 300, 600, 1000, 2000, 5000].forEach((pts) => {
      const nivel = calcularNivel(pts);
      expect(nivel.icon).toBeTruthy();
    });
  });

  it("devuelve nombres en valenciano cuando el idioma es 'ca'", () => {
    vi.stubGlobal("localStorage", { getItem: vi.fn(() => "ca") });
    const nivel = calcularNivel(5000);
    expect(nivel.nombre).toBe("Llegenda de l'Albufera");
  });

  it("devuelve nombres en español si el idioma no está definido", () => {
    vi.stubGlobal("localStorage", { getItem: vi.fn(() => null) });
    const nivel = calcularNivel(0);
    expect(nivel.nombre).toBe("Huevo (Novato)");
  });
});

// ─────────────────────────────────────────────
// verificarLogros
// ─────────────────────────────────────────────

describe("verificarLogros", () => {
  it("otorga el logro 'primer_paso' al primer avistamiento", () => {
    const stats = { avistamientos_count: 1, fotos_count: 0, puntos: 10, logros: [] };
    const nuevos = verificarLogros(stats);
    expect(nuevos).toContain("primer_paso");
  });

  it("no otorga 'primer_paso' si ya lo tiene", () => {
    const stats = {
      avistamientos_count: 5,
      fotos_count: 0,
      puntos: 50,
      logros: ["primer_paso"],
    };
    const nuevos = verificarLogros(stats);
    expect(nuevos).not.toContain("primer_paso");
  });

  it("otorga el logro 'paparazzi' al subir 5 fotos", () => {
    const stats = { avistamientos_count: 5, fotos_count: 5, puntos: 75, logros: [] };
    const nuevos = verificarLogros(stats);
    expect(nuevos).toContain("paparazzi");
  });

  it("no otorga 'paparazzi' con menos de 5 fotos", () => {
    const stats = { avistamientos_count: 4, fotos_count: 4, puntos: 40, logros: [] };
    const nuevos = verificarLogros(stats);
    expect(nuevos).not.toContain("paparazzi");
  });

  it("otorga 'explorador' al llegar a 20 avistamientos", () => {
    const stats = { avistamientos_count: 20, fotos_count: 0, puntos: 200, logros: [] };
    const nuevos = verificarLogros(stats);
    expect(nuevos).toContain("explorador");
  });

  it("otorga 'veterano' al superar 300 puntos", () => {
    const stats = { avistamientos_count: 10, fotos_count: 3, puntos: 300, logros: [] };
    const nuevos = verificarLogros(stats);
    expect(nuevos).toContain("veterano");
  });

  it("otorga 'influencer' al superar 1000 puntos", () => {
    const stats = { avistamientos_count: 30, fotos_count: 20, puntos: 1000, logros: [] };
    const nuevos = verificarLogros(stats);
    expect(nuevos).toContain("influencer");
  });

  it("puede otorgar varios logros a la vez si se cumplen varias condiciones", () => {
    const stats = {
      avistamientos_count: 20,
      fotos_count: 5,
      puntos: 1000,
      logros: [],
    };
    const nuevos = verificarLogros(stats);
    expect(nuevos.length).toBeGreaterThan(1);
    expect(nuevos).toContain("primer_paso");
    expect(nuevos).toContain("paparazzi");
    expect(nuevos).toContain("explorador");
    expect(nuevos).toContain("veterano");
    expect(nuevos).toContain("influencer");
  });

  it("devuelve lista vacía si ya tiene todos los logros", () => {
    const todosLosIds = LISTA_LOGROS.map((l) => l.id);
    const stats = {
      avistamientos_count: 100,
      fotos_count: 100,
      puntos: 5000,
      logros: todosLosIds,
    };
    const nuevos = verificarLogros(stats);
    expect(nuevos).toHaveLength(0);
  });

  it("devuelve lista vacía si el usuario no cumple ninguna meta", () => {
    const stats = { avistamientos_count: 0, fotos_count: 0, puntos: 0, logros: [] };
    const nuevos = verificarLogros(stats);
    expect(nuevos).toHaveLength(0);
  });

  it("trata stats sin campo 'logros' como usuario sin logros previos", () => {
    const stats = { avistamientos_count: 1, fotos_count: 0, puntos: 10 };
    expect(() => verificarLogros(stats)).not.toThrow();
    const nuevos = verificarLogros(stats);
    expect(nuevos).toContain("primer_paso");
  });
});

// ─────────────────────────────────────────────
// getLogroTexto
// ─────────────────────────────────────────────

describe("getLogroTexto", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => "es"),
      setItem: vi.fn(),
    });
  });

  it("devuelve el título en español por defecto", () => {
    const logro = LISTA_LOGROS.find((l) => l.id === "paparazzi");
    const texto = getLogroTexto(logro);
    expect(texto.titulo).toBe("Paparazzi");
  });

  it("devuelve la descripción en español por defecto", () => {
    const logro = LISTA_LOGROS.find((l) => l.id === "primer_paso");
    const texto = getLogroTexto(logro);
    expect(texto.desc).toContain("primer avistamiento");
  });

  it("devuelve texto en valenciano cuando el idioma es 'ca'", () => {
    vi.stubGlobal("localStorage", { getItem: vi.fn(() => "ca") });
    const logro = LISTA_LOGROS.find((l) => l.id === "primer_paso");
    const texto = getLogroTexto(logro);
    expect(texto.titulo).toBe("El Primer Pas");
    expect(texto.desc).toContain("avistament");
  });

  it("hace fallback a español si el idioma solicitado no existe en el logro", () => {
    vi.stubGlobal("localStorage", { getItem: vi.fn(() => "fr") });
    const logro = LISTA_LOGROS.find((l) => l.id === "veterano");
    const texto = getLogroTexto(logro);
    expect(texto.titulo).toBeTruthy();
  });

  it("funciona con logros cuyo título es un string en lugar de objeto", () => {
    const logroSimple = { id: "test", titulo: "Título directo", desc: "Descripción directa" };
    const texto = getLogroTexto(logroSimple);
    expect(texto.titulo).toBe("Título directo");
    expect(texto.desc).toBe("Descripción directa");
  });

  it("devuelve texto para todos los logros de la lista sin lanzar errores", () => {
    LISTA_LOGROS.forEach((logro) => {
      expect(() => getLogroTexto(logro)).not.toThrow();
      const texto = getLogroTexto(logro);
      expect(texto.titulo).toBeTruthy();
      expect(texto.desc).toBeTruthy();
    });
  });
});
