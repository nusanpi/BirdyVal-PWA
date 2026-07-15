/**
 * EDUCACION.JS - Tarjetas educativas para concienciar sobre la conservación
 * Datos reales sobre aves y naturaleza
 */

// Datos educativos sobre conservación de aves y naturaleza
const datosEducativos = {
  es: [
    {
      numero: "40%",
      texto:
        "de las especies de aves migratorias han disminuido en los últimos 30 años debido al cambio climático y la pérdida de hábitat.",
      fuente: "BirdLife International",
    },
    {
      numero: "3.000M",
      texto:
        "de aves han desaparecido de Norteamérica desde 1970. La conservación de espacios verdes urbanos es crucial.",
      fuente: "Science Magazine 2019",
    },
    {
      numero: "217",
      texto:
        "especies de aves están en peligro crítico de extinción a escala mundial. Cada avistamiento cuenta para la ciencia ciudadana.",
      fuente: "IUCN Red List",
    },
    {
      numero: "28%",
      texto:
        "de las especies de aves europeas están en declive. Los jardines urbanos pueden ser refugios importantes para muchas especies.",
      fuente: "European Bird Census Council",
    },
    {
      numero: "50%",
      texto:
        "de las migraciones de aves se han visto alteradas por la contaminación lumínica en las ciudades.",
      fuente: "Journal of Applied Ecology",
    },
    {
      numero: "1 ave",
      texto:
        "poliniza hasta 2.000 plantas al año. Proteger las aves también protege los ecosistemas completos.",
      fuente: "Nature Conservation Research",
    },
    {
      numero: "15%",
      texto:
        "más especies aviares se pueden encontrar en parques urbanos bien gestionados vs. mal mantenidos.",
      fuente: "Urban Ecology Institute",
    },
    {
      numero: "85%",
      texto:
        "de los humedales mediterráneos han desaparecido, afectando miles de especies de aves acuáticas.",
      fuente: "Wetlands International",
    },
    {
      numero: "24h",
      texto:
        "es el tiempo que algunas especies críticas necesitan de silencio para anidar con éxito. Menos ruido = más biodiversidad.",
      fuente: "Conservation Biology Journal",
    },
    {
      numero: "500km",
      texto:
        "puede volar un colibrí sin parar durante la migración. El cambio climático altera estas rutas milenarias.",
      fuente: "American Ornithological Society",
    },
  ],
  ca: [
    {
      numero: "40%",
      texto:
        "de les espècies d'aus migratòries han disminuït en els últims 30 anys pel canvi climàtic i la pèrdua d'hàbitat.",
      fuente: "BirdLife International",
    },
    {
      numero: "3.000M",
      texto:
        "d'aus han desaparegut de Nordamèrica des de 1970. La conservació d'espais verds urbans és crucial.",
      fuente: "Science Magazine 2019",
    },
    {
      numero: "217",
      texto:
        "espècies d'aus estan en perill crític d'extinció a escala mundial. Cada avistament compta per a la ciència ciutadana.",
      fuente: "IUCN Red List",
    },
    {
      numero: "28%",
      texto:
        "de les espècies d'aus europees estan en declivi. Els jardins urbans poden ser refugis importants per a moltes espècies.",
      fuente: "European Bird Census Council",
    },
    {
      numero: "50%",
      texto:
        "de les migracions d'aus s'han vist alterades per la contaminació lumínica a les ciutats.",
      fuente: "Journal of Applied Ecology",
    },
    {
      numero: "1 au",
      texto:
        "pol·linitza fins a 2.000 plantes a l'any. Protegir les aus també protegix els ecosistemes complets.",
      fuente: "Nature Conservation Research",
    },
    {
      numero: "15%",
      texto:
        "més espècies aviàries es poden trobar en parcs urbans ben gestionats vs. mal mantinguts.",
      fuente: "Urban Ecology Institute",
    },
    {
      numero: "85%",
      texto:
        "dels aiguamolls mediterranis han desaparegut, afectant milers d'espècies d'aus aquàtiques.",
      fuente: "Wetlands International",
    },
    {
      numero: "24h",
      texto:
        "és el temps que algunes espècies crítiques necessiten de silenci per a nidificar amb èxit. Menys soroll = més biodiversitat.",
      fuente: "Conservation Biology Journal",
    },
    {
      numero: "500km",
      texto:
        "pot volar un colibrí sense parar durant la migració. El canvi climàtic altera estes rutes mil·lenàries.",
      fuente: "American Ornithological Society",
    },
  ],
};

class TarjetasEducativas {
  constructor() {
    this.contenedor = document.getElementById("tarjeta-educativa");
    this.indiceActual = 0;
    this.intervalo = null;

    if (this.contenedor) {
      this.iniciar();
    }
  }

  getLang() {
    return localStorage.getItem("userLanguage") || "es";
  }

  getDatos() {
    return datosEducativos[this.getLang()] || datosEducativos.es;
  }

  iniciar() {
    // Mostrar primera tarjeta
    this.mostrarTarjeta(this.indiceActual);

    // Configurar rotación automática cada 5 segundos
    this.intervalo = setInterval(() => {
      this.siguienteTarjeta();
    }, 5000);

    // Pausar rotación cuando el usuario hace hover
    this.contenedor.addEventListener("mouseenter", () => {
      if (this.intervalo) {
        clearInterval(this.intervalo);
        this.intervalo = null;
      }
    });

    // Reanudar rotación cuando quita el hover
    this.contenedor.addEventListener("mouseleave", () => {
      if (!this.intervalo) {
        this.intervalo = setInterval(() => {
          this.siguienteTarjeta();
        }, 5000);
      }
    });
  }

  mostrarTarjeta(indice) {
    const datos = this.getDatos();
    const dato = datos[indice % datos.length];
    const fuenteLabel = this.getLang() === "ca" ? "Font" : "Fuente";

    const html = `
      <div class="dato-educativo">
        <div class="dato-numero">${dato.numero}</div>
        <div class="dato-texto">${dato.texto}</div>
        <div class="dato-fuente">${fuenteLabel}: ${dato.fuente}</div>
      </div>
    `;

    this.contenedor.innerHTML = html;
  }

  siguienteTarjeta() {
    const tarjetaActual = this.contenedor.querySelector(".dato-educativo");

    if (tarjetaActual) {
      // Animación de salida
      tarjetaActual.classList.add("saliendo");

      setTimeout(() => {
        this.indiceActual = (this.indiceActual + 1) % this.getDatos().length;
        this.mostrarTarjeta(this.indiceActual);
      }, 400);
    } else {
      // Si no hay tarjeta actual, mostrar la siguiente directamente
      this.indiceActual = (this.indiceActual + 1) % this.getDatos().length;
      this.mostrarTarjeta(this.indiceActual);
    }
  }

  // Método para limpiar el intervalo si es necesario
  destruir() {
    if (this.intervalo) {
      clearInterval(this.intervalo);
      this.intervalo = null;
    }
  }
}

// Inicializar cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", () => {
  const tarjetasEducativas = new TarjetasEducativas();

  // Hacer disponible globalmente para debugging
  window.tarjetasEducativas = tarjetasEducativas;

  // Actualizar tarjeta cuando cambia el idioma
  document.addEventListener("birdyval:language-changed", () => {
    tarjetasEducativas.mostrarTarjeta(tarjetasEducativas.indiceActual);
  });
});

// Limpiar intervalos al cambiar de página
window.addEventListener("beforeunload", () => {
  if (window.tarjetasEducativas) {
    window.tarjetasEducativas.destruir();
  }
});
