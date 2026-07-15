import requests
import json
import time
from deep_translator import GoogleTranslator

# --- CONFIGURACIÓN ---
API_KEY = "16gbvoc0fnj5" # Tu API Key de eBird
REGION = "ES-VC"         # Comunidad Valenciana

headers = {
    "X-eBirdApiToken": API_KEY
}

# Inicializamos los traductores
traductor_es = GoogleTranslator(source='auto', target='es')
traductor_va = GoogleTranslator(source='auto', target='ca') # Usamos CA para Valenciano

# ------------------------------------------------------
# 1) Obtener lista de especies observadas en C. Valenciana
# ------------------------------------------------------
print("🔍 Descargando lista de especies de eBird...")
url_species = f"https://api.ebird.org/v2/product/spplist/{REGION}"
response = requests.get(url_species, headers=headers)

if response.status_code != 200:
    print("❌ Error conectando con eBird. Revisa tu API KEY.")
    exit()

species_codes = response.json()
print(f"➡ Encontradas {len(species_codes)} especies.")

# ------------------------------------------------------
# 2) Descargar taxonomía de eBird (Nombres científicos)
# ------------------------------------------------------
print("🔍 Descargando taxonomía completa...")
taxonomy_url = "https://api.ebird.org/v2/ref/taxonomy/ebird?fmt=json"
taxonomy = requests.get(taxonomy_url, headers=headers).json()
taxonomy_dict = {sp["speciesCode"]: sp for sp in taxonomy}

# ------------------------------------------------------
# 3) Función para info extra (Birdpedia) + Traducción
# ------------------------------------------------------
def get_bird_data(species_code, common_name):
    # --- Datos de Birdpedia ---
    try:
        bp = requests.get(f"https://birdpedia.xyz/api/species/{species_code}").json()
    except:
        bp = {}
    
    descripcion_en = bp.get("description", "")
    
    # --- TRADUCCIÓN (Lo nuevo) ---
    # Traducir nombre
    try:
        nombre_es = traductor_es.translate(common_name)
        nombre_va = traductor_va.translate(common_name)
    except:
        nombre_es = common_name
        nombre_va = common_name

    # Traducir descripción (si existe)
    desc_es = ""
    desc_va = ""
    if descripcion_en:
        try:
            # Limitamos a 400 caracteres para no saturar y que sea rápido
            desc_es = traductor_es.translate(descripcion_en[:400])
            desc_va = traductor_va.translate(descripcion_en[:400])
        except:
            pass

    return {
        "photo_url": bp.get("image", None),
        "habitat": bp.get("habitat", None),
        "diet": bp.get("diet", None),
        "description": descripcion_en,
        # Campos nuevos traducidos:
        "nombre_es": nombre_es,
        "nombre_va": nombre_va,
        "desc_es": desc_es,
        "desc_va": desc_va
    }

# ------------------------------------------------------
# 4) Fusionar todo
# ------------------------------------------------------
print("📦 Generando dataset final y TRADUCIENDO (Paciencia, tardará un poco)...")
aves_final = []

total = len(species_codes)

for i, code in enumerate(species_codes):
    tax = taxonomy_dict.get(code, {})
    nombre_ingles = tax.get("comName", "")
    cientifico = tax.get("sciName", "")
    
    print(f"[{i+1}/{total}] Procesando: {cientifico}...")

    bird = {
        "speciesCode": code,
        "commonName": nombre_ingles,
        "scientificName": cientifico,
        "family": tax.get("familyComName"),
        "order": tax.get("order"),
    }

    # Añadimos la info extra y traducciones
    datos_extra = get_bird_data(code, nombre_ingles)
    bird.update(datos_extra)

    aves_final.append(bird)
    
    # Pausa pequeña para no bloquear las APIs
    if i % 10 == 0:
        time.sleep(0.5)

# ------------------------------------------------------
# 5) Guardar JSON
# ------------------------------------------------------
with open("aves_cv.json", "w", encoding="utf-8") as f:
    json.dump(aves_final, f, ensure_ascii=False, indent=4)

print(f"✅ ¡Terminado! Archivo 'aves_cv.json' creado con {len(aves_final)} especies traducidas.")