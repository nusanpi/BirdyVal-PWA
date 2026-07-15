"""
Tests del backend de BirdyVal (FastAPI).
Cubre los endpoints /predict y /ebird/recent, y las funciones auxiliares.

Ejecutar con:
    cd backend
    pytest tests/ -v
"""

import io
import json
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient


# ─────────────────────────────────────────────
# Fixtures y setup
# ─────────────────────────────────────────────

@pytest.fixture(autouse=True)
def mock_firebase():
    """Evita que Firebase Admin se inicialice en tests."""
    with patch("firebase_admin._apps", {"default": MagicMock()}), \
         patch("firebase_admin.firestore.client") as mock_db:
        mock_db.return_value = MagicMock()
        yield mock_db


@pytest.fixture
def client(mock_firebase):
    from main import app
    return TestClient(app)


@pytest.fixture
def imagen_jpg_valida():
    """Bytes mínimos de un JPEG válido para tests."""
    return b"\xff\xd8\xff\xe0" + b"\x00" * 100


@pytest.fixture
def audio_webm_valido():
    """Bytes mínimos de un audio WebM para tests."""
    return b"\x1a\x45\xdf\xa3" + b"\x00" * 100


def _especies_mock(nombres=None):
    """Devuelve un mock de Firestore con especies de la CV."""
    if nombres is None:
        nombres = ["Pardal comú", "Merla", "Tord", "Garsa", "Puput"]
    docs = []
    for nombre in nombres:
        doc = MagicMock()
        doc.to_dict.return_value = {
            "nombre_es": nombre,
            "nombre_va": nombre,
            "commonName": nombre,
        }
        docs.append(doc)
    return docs


# ─────────────────────────────────────────────
# Tests de funciones auxiliares
# ─────────────────────────────────────────────

class TestNormalizarLang:
    def test_espanol_devuelve_es(self):
        from main import _normalizar_lang
        assert _normalizar_lang("es") == "es"

    def test_ninguno_devuelve_es_por_defecto(self):
        from main import _normalizar_lang
        assert _normalizar_lang(None) == "es"

    def test_ca_devuelve_ca(self):
        from main import _normalizar_lang
        assert _normalizar_lang("ca") == "ca"

    def test_val_devuelve_ca(self):
        from main import _normalizar_lang
        assert _normalizar_lang("val") == "ca"

    def test_va_devuelve_ca(self):
        from main import _normalizar_lang
        assert _normalizar_lang("va") == "ca"

    def test_mayusculas_se_normalizan(self):
        from main import _normalizar_lang
        assert _normalizar_lang("CA") == "ca"
        assert _normalizar_lang("ES") == "es"


class TestNormalizarMimeType:
    def test_mp3_devuelve_audio_mpeg(self):
        from main import _normalizar_mime_type
        archivo = MagicMock()
        archivo.content_type = None
        archivo.filename = "canto_pajaro.mp3"
        assert _normalizar_mime_type(archivo) == "audio/mpeg"

    def test_m4a_devuelve_audio_mp4(self):
        from main import _normalizar_mime_type
        archivo = MagicMock()
        archivo.content_type = None
        archivo.filename = "grabacion.m4a"
        assert _normalizar_mime_type(archivo) == "audio/mp4"

    def test_webm_devuelve_audio_webm(self):
        from main import _normalizar_mime_type
        archivo = MagicMock()
        archivo.content_type = None
        archivo.filename = "audio.webm"
        assert _normalizar_mime_type(archivo) == "audio/webm"

    def test_content_type_tiene_prioridad_sobre_extension(self):
        from main import _normalizar_mime_type
        archivo = MagicMock()
        archivo.content_type = "image/png"
        archivo.filename = "foto.jpg"
        assert _normalizar_mime_type(archivo) == "image/png"

    def test_sin_extension_conocida_devuelve_jpeg_por_defecto(self):
        from main import _normalizar_mime_type
        archivo = MagicMock()
        archivo.content_type = None
        archivo.filename = "archivo_sin_extension"
        assert _normalizar_mime_type(archivo) == "image/jpeg"


class TestObtenerTipoMedia:
    def test_audio_mp3_devuelve_audio(self):
        from main import _obtener_tipo_media
        assert _obtener_tipo_media("audio/mpeg") == "audio"

    def test_audio_webm_devuelve_audio(self):
        from main import _obtener_tipo_media
        assert _obtener_tipo_media("audio/webm") == "audio"

    def test_image_jpeg_devuelve_image(self):
        from main import _obtener_tipo_media
        assert _obtener_tipo_media("image/jpeg") == "image"

    def test_image_png_devuelve_image(self):
        from main import _obtener_tipo_media
        assert _obtener_tipo_media("image/png") == "image"


class TestGenerarPromptEspecies:
    def test_prompt_incluye_nombre_de_especie(self):
        from main import _generar_prompt_especies
        especies = ["Pardal comú", "Merla negra", "Tord comú"]
        prompt = _generar_prompt_especies(especies, "es", "image")
        assert "Pardal comú" in prompt
        assert "Merla negra" in prompt

    def test_prompt_para_audio_menciona_canto(self):
        from main import _generar_prompt_especies
        prompt = _generar_prompt_especies(["Pardal"], "es", "audio")
        assert "canto" in prompt.lower() or "audio" in prompt.lower()

    def test_prompt_para_imagen_menciona_imagen(self):
        from main import _generar_prompt_especies
        prompt = _generar_prompt_especies(["Pardal"], "es", "image")
        assert "imagen" in prompt.lower()

    def test_prompt_en_valenciano_usa_idioma_catalan(self):
        from main import _generar_prompt_especies
        prompt = _generar_prompt_especies(["Pardal"], "ca", "image")
        assert "catalan" in prompt.lower() or "valenciano" in prompt.lower()

    def test_prompt_limita_a_500_especies(self):
        from main import _generar_prompt_especies
        # 600 especies para verificar que solo incluye 500
        especies = [f"Especie {i}" for i in range(600)]
        prompt = _generar_prompt_especies(especies, "es", "image")
        assert "Especie 499" in prompt
        assert "Especie 500" not in prompt


# ─────────────────────────────────────────────
# Tests del endpoint /ebird/recent
# ─────────────────────────────────────────────

class TestEbirdRecent:
    def test_devuelve_lista_de_observaciones_cuando_ebird_responde(self, client):
        observaciones_mock = [
            {"speciesCode": "houbuz", "comName": "Avutarda hubara", "lat": 39.47, "lng": -0.37},
            {"speciesCode": "grewhe1", "comName": "Garza real", "lat": 39.48, "lng": -0.38},
        ]
        with patch("main._obtener_avistamientos_ebird", return_value=observaciones_mock):
            respuesta = client.get("/ebird/recent?lat=39.47&lng=-0.37&dist=2&back=30")
        assert respuesta.status_code == 200
        datos = respuesta.json()
        assert "observations" in datos
        assert len(datos["observations"]) == 2

    def test_devuelve_lista_vacia_si_no_hay_avistamientos_cercanos(self, client):
        with patch("main._obtener_avistamientos_ebird", return_value=[]):
            respuesta = client.get("/ebird/recent?lat=39.47&lng=-0.37")
        assert respuesta.status_code == 200
        assert respuesta.json()["observations"] == []

    def test_devuelve_502_si_ebird_no_responde(self, client):
        with patch("main._obtener_avistamientos_ebird",
                   side_effect=RuntimeError("Error consultando eBird")):
            respuesta = client.get("/ebird/recent?lat=39.47&lng=-0.37")
        assert respuesta.status_code == 502

    def test_requiere_parametros_lat_y_lng(self, client):
        respuesta = client.get("/ebird/recent")
        assert respuesta.status_code == 422

    def test_parametros_dist_y_back_son_opcionales(self, client):
        with patch("main._obtener_avistamientos_ebird", return_value=[]):
            respuesta = client.get("/ebird/recent?lat=39.47&lng=-0.37")
        assert respuesta.status_code == 200


# ─────────────────────────────────────────────
# Tests del endpoint /predict
# ─────────────────────────────────────────────

class TestPredict:
    def test_identifica_ave_en_foto_jpg_y_devuelve_frase(self, client, imagen_jpg_valida):
        with patch("main._obtener_nombres_especies", return_value=["Pardal comú", "Merla"]), \
             patch("main._generar_respuesta_gemini",
                   return_value="Parece un Pardal comú. Dato curioso: es el pájaro más común de Valencia."):
            respuesta = client.post(
                "/predict",
                files={"file": ("foto.jpg", imagen_jpg_valida, "image/jpeg")},
                data={"lang": "es"},
            )
        assert respuesta.status_code == 200
        datos = respuesta.json()
        assert "frase_sugerencia" in datos
        assert "Pardal" in datos["frase_sugerencia"]
        assert datos["lang"] == "es"

    def test_identifica_ave_en_audio_webm_y_devuelve_frase(self, client, audio_webm_valido):
        with patch("main._obtener_nombres_especies", return_value=["Rossinyol"]), \
             patch("main._generar_respuesta_gemini",
                   return_value="Parece un Rossinyol. Dato curioso: canta principalmente de noche."):
            respuesta = client.post(
                "/predict",
                files={"file": ("grabacion.webm", audio_webm_valido, "audio/webm")},
                data={"lang": "es"},
            )
        assert respuesta.status_code == 200
        assert "frase_sugerencia" in respuesta.json()

    def test_responde_en_valenciano_cuando_lang_es_ca(self, client, imagen_jpg_valida):
        with patch("main._obtener_nombres_especies", return_value=["Pardal comú"]), \
             patch("main._generar_respuesta_gemini",
                   return_value="Sembla un Pardal comú. Dada curiosa: és l'ocell més vist a València."):
            respuesta = client.post(
                "/predict",
                files={"file": ("foto.jpg", imagen_jpg_valida, "image/jpeg")},
                data={"lang": "ca"},
            )
        assert respuesta.status_code == 200
        assert respuesta.json()["lang"] == "ca"

    def test_devuelve_400_si_el_archivo_esta_vacio(self, client):
        respuesta = client.post(
            "/predict",
            files={"file": ("vacio.jpg", b"", "image/jpeg")},
            data={"lang": "es"},
        )
        assert respuesta.status_code == 400

    def test_devuelve_422_si_no_se_envia_archivo(self, client):
        respuesta = client.post("/predict", data={"lang": "es"})
        assert respuesta.status_code == 422

    def test_devuelve_500_si_no_hay_especies_en_firestore(self, client, imagen_jpg_valida):
        with patch("main._obtener_nombres_especies", return_value=[]):
            respuesta = client.post(
                "/predict",
                files={"file": ("foto.jpg", imagen_jpg_valida, "image/jpeg")},
                data={"lang": "es"},
            )
        assert respuesta.status_code == 500

    def test_devuelve_502_si_gemini_falla(self, client, imagen_jpg_valida):
        with patch("main._obtener_nombres_especies", return_value=["Pardal"]), \
             patch("main._generar_respuesta_gemini",
                   side_effect=RuntimeError("Gemini no disponible")):
            respuesta = client.post(
                "/predict",
                files={"file": ("foto.jpg", imagen_jpg_valida, "image/jpeg")},
                data={"lang": "es"},
            )
        assert respuesta.status_code == 502

    def test_devuelve_frase_por_defecto_si_gemini_responde_vacio(self, client, imagen_jpg_valida):
        with patch("main._obtener_nombres_especies", return_value=["Pardal"]), \
             patch("main._generar_respuesta_gemini", return_value=""):
            respuesta = client.post(
                "/predict",
                files={"file": ("foto.jpg", imagen_jpg_valida, "image/jpeg")},
                data={"lang": "es"},
            )
        assert respuesta.status_code == 200
        frase = respuesta.json()["frase_sugerencia"]
        assert len(frase) > 0
        assert "No he podido identificar" in frase

    def test_frase_por_defecto_en_valenciano_cuando_gemini_responde_vacio(
        self, client, imagen_jpg_valida
    ):
        with patch("main._obtener_nombres_especies", return_value=["Pardal"]), \
             patch("main._generar_respuesta_gemini", return_value=""):
            respuesta = client.post(
                "/predict",
                files={"file": ("foto.jpg", imagen_jpg_valida, "image/jpeg")},
                data={"lang": "ca"},
            )
        frase = respuesta.json()["frase_sugerencia"]
        assert "No he pogut identificar" in frase


class TestGenerarRespuestaGemini:
    def test_usa_modelo_alternativo_si_el_principal_falla(self):
        from main import _generar_respuesta_gemini

        llamadas = []

        def gemini_falla_primero(model, contents):
            llamadas.append(model)
            if len(llamadas) == 1:
                raise Exception("503 Service Unavailable")
            resp = MagicMock()
            resp.text = "Parece una Garsa. Dato curioso: colecciona objetos brillantes."
            return resp

        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = gemini_falla_primero

        with patch("main.gemini_client", mock_client):
            resultado = _generar_respuesta_gemini("prompt", b"bytes", "image/jpeg")

        assert "Garsa" in resultado
        assert len(llamadas) >= 2

    def test_lanza_excepcion_si_todos_los_modelos_fallan(self):
        from main import _generar_respuesta_gemini

        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = Exception("503 Todos caídos")

        with patch("main.gemini_client", mock_client):
            with pytest.raises(RuntimeError, match="Ninguno de los modelos"):
                _generar_respuesta_gemini("prompt", b"bytes", "image/jpeg")

    def test_no_reintenta_si_el_error_es_400_bad_request(self):
        from main import _generar_respuesta_gemini

        llamadas = []
        mock_client = MagicMock()

        def falla_con_400(*args, **kwargs):
            llamadas.append(1)
            raise Exception("400 INVALID_ARGUMENT: formato no válido")

        mock_client.models.generate_content.side_effect = falla_con_400

        with patch("main.gemini_client", mock_client):
            with pytest.raises(Exception, match="400"):
                _generar_respuesta_gemini("prompt", b"bytes", "image/jpeg")

        # Con error 400 no debe reintentar otros modelos
        assert len(llamadas) == 1
