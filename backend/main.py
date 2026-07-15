from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
import os
import json
import mimetypes
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import firebase_admin
from dotenv import load_dotenv
from firebase_admin import credentials, firestore

try:
    import google.genai as genai
    from google.genai import types
except ImportError as exc:
    raise RuntimeError(
        "No se ha encontrado el paquete google-genai en este interprete de Python. "
        "Instalalo con: py -3.13 -m pip install google-genai"
    ) from exc

# Cargar variables de entorno desde la carpeta environment/
backend_dir = os.path.dirname(__file__)
env_path = os.path.join(backend_dir, "environment", ".env")
load_dotenv(env_path)

app = FastAPI()

# Configurar CORS desde variables de entorno
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _initialize_firebase() -> None:
    if firebase_admin._apps:
        return

    credentials_path = os.getenv("FIREBASE_CREDENTIALS_PATH")

    if not credentials_path:
        raise RuntimeError(
            "Falta FIREBASE_CREDENTIALS_PATH en backend/environment/.env. "
            "Debes apuntar al archivo JSON de service account."
        )

    resolved_credentials_path = credentials_path
    if not os.path.isabs(resolved_credentials_path):
        resolved_credentials_path = os.path.join(backend_dir, resolved_credentials_path)
    resolved_credentials_path = os.path.normpath(resolved_credentials_path)

    if not os.path.exists(resolved_credentials_path):
        raise RuntimeError(
            "No se encontro el archivo de credenciales de Firebase Admin en "
            f"'{resolved_credentials_path}'. Descarga la service account desde Firebase "
            "Console y actualiza FIREBASE_CREDENTIALS_PATH."
        )

    firebase_cred = credentials.Certificate(resolved_credentials_path)
    firebase_admin.initialize_app(firebase_cred)


_initialize_firebase()
db = firestore.client()

gemini_api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
if not gemini_api_key:
    raise RuntimeError("Falta GEMINI_API_KEY (o GOOGLE_API_KEY) en el archivo .env")

gemini_client = genai.Client(api_key=gemini_api_key)
gemini_model_name = os.getenv("GEMINI_MODEL", "gemini-flash-latest")
ebird_api_key = os.getenv("EBIRD_API_KEY", "").strip()
ebird_api_url = "https://api.ebird.org/v2/data/obs/geo/recent"
gemini_fallback_models = [
    gemini_model_name,
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-flash-latest",
]


def _obtener_nombres_especies(lang: str) -> list[str]:
    nombres: set[str] = set()
    docs = db.collection("especies").stream()

    for doc in docs:
        data = doc.to_dict() or {}

        if lang == "ca":
            nombre = (
                data.get("nombre_va")
                or data.get("nombre_comun")
                or data.get("nombre_es")
                or data.get("commonName")
                or ""
            )
        else:
            nombre = (
                data.get("nombre_es")
                or data.get("nombre_comun")
                or data.get("nombre_va")
                or data.get("commonName")
                or ""
            )

        nombre_limpio = str(nombre).strip()
        if nombre_limpio:
            nombres.add(nombre_limpio)

    return sorted(nombres)


def _normalizar_lang(lang: str | None) -> str:
    normalized = (lang or "es").strip().lower()
    if normalized in {"ca", "val", "va"}:
        return "ca"
    return "es"


def _normalizar_mime_type(file: UploadFile) -> str:
    filename = (file.filename or "").lower()

    # .webm en esta app siempre es audio (grabación MediaRecorder).
    # mimetypes.guess_type devuelve video/webm (estándar genérico), así que
    # se resuelve por extensión antes de consultar content_type o mimetypes.
    if filename.endswith(".webm"):
        return "audio/webm"

    mime_type = file.content_type or mimetypes.guess_type(file.filename or "")[0]
    if mime_type:
        return mime_type

    if filename.endswith(".mp3"):
        return "audio/mpeg"
    if filename.endswith(".m4a"):
        return "audio/mp4"
    if filename.endswith(".aac"):
        return "audio/aac"
    if filename.endswith(".wav"):
        return "audio/wav"
    if filename.endswith(".ogg"):
        return "audio/ogg"
    if filename.endswith(".flac"):
        return "audio/flac"

    return "image/jpeg"


def _obtener_tipo_media(mime_type: str) -> str:
    if mime_type.startswith("audio/"):
        return "audio"
    return "image"


def _generar_prompt_especies(lista_especies: list[str], lang: str, media_type: str) -> str:
    especies_texto = "\n".join(f"- {especie}" for especie in lista_especies[:500])
    idioma_respuesta = "catalan" if lang == "ca" else "espanol"
    instruccion_nombre = (
        "5) Si el idioma es catalan/valenciano, usa el nombre valenciano exacto de la lista para la especie detectada."
        if lang == "ca"
        else "5) Si el idioma es espanol, usa el nombre en espanol exacto de la lista para la especie detectada."
    )
    if media_type == "audio":
        contexto_media = (
            "Analiza el audio del canto o llamada del ave suministrado y responde en "
            f"{idioma_respuesta}."
        )
    else:
        contexto_media = (
            "Analiza la imagen suministrada y responde en " f"{idioma_respuesta}."
        )

    return (
        f"Eres un ornitologo experto en aves. {contexto_media}\n"
        "Debes priorizar esta lista de especies de mi base de datos al identificar el ave:\n"
        f"{especies_texto}\n\n"
        "Reglas:\n"
        "1) Si identificas una especie de la lista, usa exactamente ese nombre.\n"
        "2) Si no estas seguro, indica la especie mas probable de la lista.\n"
        "3) Devuelve una sola frase natural con este formato: 'Parece un <nombre del ave>. Dato curioso: <dato breve>'.\n"
        "4) No uses markdown, ni listas, ni explicaciones extra.\n"
        f"{instruccion_nombre}"
    )


def _generar_respuesta_gemini(prompt: str, media_bytes: bytes, mime_type: str) -> str:
    last_error = None

    for model_name in dict.fromkeys(gemini_fallback_models):
        try:
            response = gemini_client.models.generate_content(
                model=model_name,
                contents=[
                    prompt,
                    types.Part.from_bytes(data=media_bytes, mime_type=mime_type),
                ],
            )
            return (response.text or "").strip()
        except Exception as exc:
            last_error = exc
            error_text = str(exc)
            
            # Si el error es claramente un 400 (Bad Request), no tiene sentido probar otro modelo
            if "400" in error_text or "INVALID_ARGUMENT" in error_text:
                raise
            
            # Para 503, 429 o 404, simplemente continuamos con el siguiente modelo
            continue

    raise RuntimeError(
        "Ninguno de los modelos Gemini configurados esta disponible para generate_content"
    ) from last_error

# para el mapa
def _obtener_avistamientos_ebird(lat: float, lng: float, dist: int, back: int) -> list[dict]:
    if not ebird_api_key:
        raise RuntimeError(
            "Falta EBIRD_API_KEY en backend/environment/.env"
        )

    query_string = urlencode(
        {
            "lat": lat,
            "lng": lng,
            "dist": dist,
            "back": back,
            "fmt": "json",
        }
    )
    request = Request(
        f"{ebird_api_url}?{query_string}",
        headers={"X-eBirdApiToken": ebird_api_key},
    )

    try:
        with urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        raise RuntimeError(f"Error consultando eBird: {exc}") from exc


@app.get("/ebird/recent")
async def ebird_recent(lat: float, lng: float, dist: int = 2, back: int = 30):
    try:
        observations = _obtener_avistamientos_ebird(lat, lng, dist, back)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {"observations": observations}

# lo más importante
@app.post("/predict")
async def predict(file: UploadFile = File(...), lang: str = Form("es")):
    media_bytes = await file.read()
    if not media_bytes:
        raise HTTPException(status_code=400, detail="No se ha recibido ninguna imagen o audio")

    current_lang = _normalizar_lang(lang)
    mime_type = _normalizar_mime_type(file)
    media_type = _obtener_tipo_media(mime_type)

    if media_type not in {"image", "audio"}:
        raise HTTPException(
            status_code=415,
            detail=f"Tipo de archivo no soportado: {mime_type}",
        )

    lista_especies = _obtener_nombres_especies(current_lang)
    if not lista_especies:
        raise HTTPException(
            status_code=500,
            detail="No se encontraron especies en Firestore para construir el contexto",
        )

    prompt = _generar_prompt_especies(lista_especies, current_lang, media_type)

    try:
        frase = _generar_respuesta_gemini(prompt, media_bytes, mime_type)
    except Exception as exc:
        detalle = str(exc)
        raise HTTPException(
            status_code=502,
            detail=f"Error al consultar Gemini para {media_type}: {detalle}",
        ) from exc

    if not frase:
        if current_lang == "ca":
            frase = (
                "No he pogut identificar l'ocell amb prou confiança. "
                "Dada curiosa: molts ocells es reconeixen millor per la silueta i el comportament."
            )
        else:
            frase = (
                "No he podido identificar el ave con suficiente confianza. "
                "Dato curioso: muchas aves se reconocen mejor por silueta y comportamiento."
            )

    return {"frase_sugerencia": frase, "lang": current_lang}