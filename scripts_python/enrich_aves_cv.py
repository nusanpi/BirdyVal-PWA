import requests
import json
import time
import os
import re
from deep_translator import GoogleTranslator
from bs4 import BeautifulSoup 

# ==========================================
# 🧠 BASE DE CONOCIMIENTO (CON PESOS MEJORADOS)
# ==========================================
DICCIONARIO_FAMILIAS = {
    # --- ESPECIALES (Prioridad Alta) ---
    "shelduck":       {"tamano": "58-70 cm", "peso": "1.2-1.7 kg", "dieta": "Omnívoro, Invertebrados", "actividad": "Diurno"}, 
    "whistling-duck": {"tamano": "45-55 cm", "peso": "600-800 g", "dieta": "Plantas, Semillas", "actividad": "Nocturno/Crepuscular"},
    "cackling goose": {"tamano": "55-65 cm", "peso": "1.2-1.8 kg", "dieta": "Hierba, Granos", "actividad": "Diurno"}, 
    "bar-headed":     {"tamano": "70-75 cm", "peso": "2-3 kg", "dieta": "Hierba, Granos", "actividad": "Diurno"},

    # --- ACUÁTICAS ---
    "swan":           {"tamano": "140-160 cm", "peso": "9-12 kg", "dieta": "Plantas acuáticas", "actividad": "Diurno"},
    "cygnus":         {"tamano": "140-160 cm", "peso": "9-12 kg", "dieta": "Plantas acuáticas", "actividad": "Diurno"},
    "geese":          {"tamano": "75-90 cm", "peso": "2.5-4 kg", "dieta": "Hierba, Plantas", "actividad": "Diurno"},
    "goose":          {"tamano": "75-90 cm", "peso": "2.5-4 kg", "dieta": "Hierba, Plantas", "actividad": "Diurno"},
    "anser":          {"tamano": "75-90 cm", "peso": "2.5-4 kg", "dieta": "Hierba, Plantas", "actividad": "Diurno"},
    "branta":         {"tamano": "55-80 cm", "peso": "1.2-4 kg", "dieta": "Hierba, Algas", "actividad": "Diurno"},
    "duck":           {"tamano": "50-60 cm", "peso": "0.8-1.4 kg", "dieta": "Plantas acuáticas", "actividad": "Diurno"},
    "anatidae":       {"tamano": "50-65 cm", "peso": "1-2 kg", "dieta": "Plantas acuáticas", "actividad": "Diurno"},
    
    # --- RESTO DE FAMILIAS ---
    "phoenicopteridae": {"tamano": "120-145 cm", "peso": "2-4 kg", "dieta": "Crustáceos, Algas", "actividad": "Diurno"},
    "podicipedidae":  {"tamano": "25-50 cm", "peso": "500-900 g", "dieta": "Peces, Insectos acuáticos", "actividad": "Diurno"},
    "grebe":          {"tamano": "25-50 cm", "peso": "500-900 g", "dieta": "Peces, Insectos acuáticos", "actividad": "Diurno"},
    "laridae":        {"tamano": "35-60 cm", "peso": "300-1000 g", "dieta": "Omnívoro, Peces", "actividad": "Diurno"},
    "gull":           {"tamano": "35-60 cm", "peso": "300-1000 g", "dieta": "Omnívoro, Peces", "actividad": "Diurno"},
    "sternidae":      {"tamano": "25-40 cm", "peso": "100-150 g", "dieta": "Peces pequeños", "actividad": "Diurno"},
    "tern":           {"tamano": "25-40 cm", "peso": "100-150 g", "dieta": "Peces pequeños", "actividad": "Diurno"},
    "ardeidae":       {"tamano": "60-90 cm", "peso": "1-2 kg", "dieta": "Peces, Anfibios", "actividad": "Diurno"},
    "heron":          {"tamano": "60-90 cm", "peso": "1-2 kg", "dieta": "Peces, Anfibios", "actividad": "Diurno"},
    "egret":          {"tamano": "55-90 cm", "peso": "500-1000 g", "dieta": "Peces, Anfibios", "actividad": "Diurno"},
    "phalacrocoracidae": {"tamano": "80-100 cm", "peso": "2-2.5 kg", "dieta": "Peces", "actividad": "Diurno"},
    "cormorant":      {"tamano": "80-100 cm", "peso": "2-2.5 kg", "dieta": "Peces", "actividad": "Diurno"},
    "rallidae":       {"tamano": "25-40 cm", "peso": "500-800 g", "dieta": "Omnívoro", "actividad": "Diurno/Crepuscular"},
    "rail":           {"tamano": "25-40 cm", "peso": "100-200 g", "dieta": "Omnívoro", "actividad": "Diurno/Crepuscular"},
    "scolopacidae":   {"tamano": "15-30 cm", "peso": "50-150 g", "dieta": "Invertebrados", "actividad": "Diurno"},
    "sandpiper":      {"tamano": "15-25 cm", "peso": "40-80 g", "dieta": "Invertebrados", "actividad": "Diurno"},
    "charadriidae":   {"tamano": "15-28 cm", "peso": "40-200 g", "dieta": "Insectos, Gusanos", "actividad": "Diurno"},
    "plover":         {"tamano": "15-28 cm", "peso": "40-200 g", "dieta": "Insectos, Gusanos", "actividad": "Diurno"},
    "recurvirostridae": {"tamano": "35-45 cm", "peso": "200-300 g", "dieta": "Invertebrados", "actividad": "Diurno"},
    "accipitridae":   {"tamano": "50-90 cm", "peso": "800g - 4kg", "dieta": "Carne, Presas vivas", "actividad": "Diurno"},
    "eagle":          {"tamano": "75-90 cm", "peso": "3-6 kg", "dieta": "Mamíferos, Aves", "actividad": "Diurno"},
    "hawk":           {"tamano": "40-60 cm", "peso": "700g - 1.5kg", "dieta": "Aves pequeñas, Roedores", "actividad": "Diurno"},
    "falconidae":     {"tamano": "30-50 cm", "peso": "150-1000 g", "dieta": "Aves, Insectos", "actividad": "Diurno"},
    "falcon":         {"tamano": "30-50 cm", "peso": "500-1000 g", "dieta": "Aves en vuelo", "actividad": "Diurno"},
    "pandionidae":    {"tamano": "55-60 cm", "peso": "1.4-2 kg", "dieta": "Peces", "actividad": "Diurno"},
    "strigidae":      {"tamano": "20-60 cm", "peso": "150g - 2kg", "dieta": "Roedores, Insectos", "actividad": "Nocturno"},
    "owl":            {"tamano": "20-60 cm", "peso": "150g - 2kg", "dieta": "Roedores, Insectos", "actividad": "Nocturno"},
    "tytonidae":      {"tamano": "33-39 cm", "peso": "250-400 g", "dieta": "Roedores", "actividad": "Nocturno"},
    "hirundinidae":   {"tamano": "15-20 cm", "peso": "15-25 g", "dieta": "Insectos voladores", "actividad": "Diurno"},
    "swallow":        {"tamano": "15-20 cm", "peso": "15-25 g", "dieta": "Insectos voladores", "actividad": "Diurno"},
    "apodidae":       {"tamano": "16-18 cm", "peso": "30-50 g", "dieta": "Insectos voladores", "actividad": "Diurno"},
    "swift":          {"tamano": "16-18 cm", "peso": "30-50 g", "dieta": "Insectos voladores", "actividad": "Diurno"},
    "paridae":        {"tamano": "10-14 cm", "peso": "10-20 g", "dieta": "Insectos, Semillas", "actividad": "Diurno"},
    "turdidae":       {"tamano": "20-25 cm", "peso": "60-100 g", "dieta": "Lombrices, Frutas", "actividad": "Diurno"},
    "blackbird":      {"tamano": "24-25 cm", "peso": "80-125 g", "dieta": "Lombrices, Frutas", "actividad": "Diurno"},
    "corvidae":       {"tamano": "40-50 cm", "peso": "200-600 g", "dieta": "Omnívoro", "actividad": "Diurno"},
    "sturnidae":      {"tamano": "20-22 cm", "peso": "60-90 g", "dieta": "Omnívoro", "actividad": "Diurno"},
    "passeridae":     {"tamano": "14-16 cm", "peso": "20-35 g", "dieta": "Semillas, Insectos", "actividad": "Diurno"},
    "sparrow":        {"tamano": "14-16 cm", "peso": "20-35 g", "dieta": "Semillas, Insectos", "actividad": "Diurno"},
    "fringillidae":   {"tamano": "12-16 cm", "peso": "15-25 g", "dieta": "Semillas", "actividad": "Diurno"},
    "finch":          {"tamano": "12-16 cm", "peso": "15-25 g", "dieta": "Semillas", "actividad": "Diurno"},
    "columbidae":     {"tamano": "30-35 cm", "peso": "200-400 g", "dieta": "Semillas, Granos", "actividad": "Diurno"},
    "pigeon":         {"tamano": "30-35 cm", "peso": "250-400 g", "dieta": "Semillas, Granos", "actividad": "Diurno"},
    "dove":           {"tamano": "25-32 cm", "peso": "150-250 g", "dieta": "Semillas, Granos", "actividad": "Diurno"},
}

# ==========================================
# CONFIGURACIÓN
# ==========================================

XC_KEY = os.getenv("XENO_CANTO_API_KEY", "")  # Get yours at https://xeno-canto.org/account

nombre_archivo = "aves_cv.json"
nombre_salida = "aves_cv_enriched.json"
carpeta_script = os.path.dirname(os.path.abspath(__file__))
INPUT_FILE = os.path.join(carpeta_script, nombre_archivo)
OUTPUT_FILE = os.path.join(carpeta_script, nombre_salida)

if not os.path.exists(INPUT_FILE):
    INPUT_FILE = os.path.join(os.path.dirname(carpeta_script), nombre_archivo)

# APIs
XENOCANTO_API = "https://xeno-canto.org/api/3/recordings"
GBIF_OCCURRENCE = "https://api.gbif.org/v1/occurrence/search"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"
HEADERS_WIKI = {"User-Agent": "BirdyValProject/1.0 (contact: nurisanpi@gmail.com)"}

traductor_es = GoogleTranslator(source='auto', target='es')
traductor_va = GoogleTranslator(source='auto', target='ca')

# ==========================================
# 1. FRECUENCIA EN VALENCIA (GBIF)
# ==========================================
def get_frecuencia_valencia(scientific_name):
    try:
        params = { "scientificName": scientific_name, "gadmGid": "ESP.17_1", "hasCoordinate": "true", "limit": 0 }
        r = requests.get(GBIF_OCCURRENCE, params=params)
        total = r.json().get("count", 0)
        if total == 0: return "No avistado / Rareza"
        elif total < 10: return "Rara"
        elif total < 100: return "Poco común"
        elif total < 1000: return "Común"
        else: return "Muy común"
    except: return "Desconocido"

# ==========================================
# 2. DATOS MASIVOS WIKIDATA (SPARQL)
# ==========================================
def obtener_datos_masivos_wikidata(lista_nombres_cientificos):
    if not lista_nombres_cientificos: return {}
    values_str = " ".join([f'"{nombre}"' for nombre in lista_nombres_cientificos])
    
    query = f"""
    SELECT ?scientificName ?mass ?length ?wingspan ?dietLabel ?activityLabel WHERE {{
      VALUES ?scientificName {{ {values_str} }}
      ?item wdt:P225 ?scientificName .
      OPTIONAL {{ ?item wdt:P2067 ?mass . }}
      OPTIONAL {{ ?item wdt:P2043 ?length . }}
      OPTIONAL {{ ?item wdt:P2050 ?wingspan . }}
      OPTIONAL {{ ?item wdt:P1034 ?diet . ?diet rdfs:label ?dietLabel filter (lang(?dietLabel) = "es") }}
      OPTIONAL {{ ?item wdt:P4284 ?activity . ?activity rdfs:label ?activityLabel filter (lang(?activityLabel) = "es") }}
    }}
    """
    
    url = "https://query.wikidata.org/sparql"
    try:
        r = requests.get(url, params={'format': 'json', 'query': query}, headers=HEADERS_WIKI)
        data = r.json()
        resultados = {}
        for item in data['results']['bindings']:
            sci = item['scientificName']['value']
            if sci not in resultados:
                resultados[sci] = { "pesos": [], "longitudes": [], "envergaduras": [], "dietas": set(), "actividades": set() }
            if 'mass' in item: resultados[sci]["pesos"].append(float(item['mass']['value']))
            if 'length' in item: resultados[sci]["longitudes"].append(float(item['length']['value']))
            if 'wingspan' in item: resultados[sci]["envergaduras"].append(float(item['wingspan']['value']))
            if 'dietLabel' in item: resultados[sci]["dietas"].add(item['dietLabel']['value'].capitalize())
            if 'activityLabel' in item: resultados[sci]["actividades"].add(item['activityLabel']['value'].capitalize())

        datos_limpios = {}
        for sci, raw in resultados.items():
            info = {}
            if raw["pesos"]:
                peso_max = max(raw["pesos"])
                if peso_max > 1000: info["peso"] = f"{peso_max/1000:.2f} kg"
                else: info["peso"] = f"{int(peso_max)} g"
            
            if raw["longitudes"]:
                l_max = max(raw["longitudes"])
                val_cm = l_max * 100 if l_max < 5 else l_max 
                info["tamano"] = f"{int(val_cm)} cm"
            
            if raw["envergaduras"]:
                e_max = max(raw["envergaduras"])
                val_cm = e_max * 100 if e_max < 5 else e_max
                info["envergadura"] = f"{int(val_cm)} cm"
            
            if raw["dietas"]: info["dieta"] = ", ".join(list(raw["dietas"]))
            if raw["actividades"]: info["actividad"] = ", ".join(list(raw["actividades"]))
            datos_limpios[sci] = info
        return datos_limpios
    except Exception as e:
        print(f"❌ Error SPARQL: {e}")
        return {}

# ==========================================
# 3. FILTRO "ANTI-ABSURDOS" Y ESTIMACIÓN
# ==========================================

def validar_y_corregir_datos(sci, datos):
    """
    Si Wikidata trae datos imposibles (ej: Cisne de 11g), los borra
    para que funcione la estimación por familia.
    """
    sci_lower = sci.lower()
    
    # 1. Detectar si es un ave GRANDE (Cisne, Ganso, Ansar, Branta)
    es_grande = any(x in sci_lower for x in ['cygnus', 'anser', 'branta', 'alopochen', 'tadorna'])
    
    # 2. Revisar el peso
    if datos.get("peso"):
        peso_str = datos["peso"]
        try:
            # Extraer número del string (ej: "11 g" -> 11)
            val = float(re.search(r"[\d\.]+", peso_str).group())
            
            # Si dice "kg", asumimos que está bien (nadie pone 0.01 kg por error)
            if "kg" in peso_str:
                pass 
            # Si dice "g" y es un ave grande y pesa menos de 500g -> ES BASURA
            elif "g" in peso_str and es_grande and val < 500:
                datos["peso"] = None # Borramos para forzar fallback
        except:
            pass

def estimar_por_familia(familia, common_name, scientific_name, datos):
    # Unimos todo para buscar palabras clave
    # IMPORTANTE: Buscamos primero en el nombre común/científico, luego en familia
    # para evitar que "Black Swan" coincida con "Geese" de la familia.
    
    str_especifico = (common_name + " " + scientific_name).lower()
    str_familia = familia.lower()
    
    match_encontrado = None
    claves_ordenadas = sorted(DICCIONARIO_FAMILIAS.keys(), key=len, reverse=True)

    # FASE 1: Buscar en el nombre del pájaro (Prioridad Alta)
    for clave in claves_ordenadas:
        if clave in str_especifico:
            match_encontrado = DICCIONARIO_FAMILIAS[clave]
            break
            
    # FASE 2: Si no hay match, buscar en la familia
    if not match_encontrado:
        for clave in claves_ordenadas:
            if clave in str_familia:
                # Evitar que "waterfowl" active "owl"
                if clave == "owl" and "waterfowl" in str_familia: continue
                match_encontrado = DICCIONARIO_FAMILIAS[clave]
                break

    if match_encontrado:
        if not datos["tamano"]: datos["tamano"] = match_encontrado["tamano"]
        if not datos["peso"]: datos["peso"] = match_encontrado.get("peso", "N/D")
        if not datos["dieta"]: datos["dieta"] = match_encontrado["dieta"]
        if not datos["actividad"]: datos["actividad"] = match_encontrado["actividad"]
    
    # Fallback final
    if not datos["tamano"]: datos["tamano"] = "Tamaño medio"
    if not datos["peso"]: datos["peso"] = "N/D"
    if not datos["dieta"]: datos["dieta"] = "Omnívoro"
    if not datos["actividad"]: datos["actividad"] = "Diurno"
    return datos

# ==========================================
# 4. EXTRAS (WIKI INFOBOX + MULTIMEDIA)
# ==========================================

def get_wiki_full_html(sci):
    params = {"action": "parse", "page": sci, "prop": "text", "format": "json", "redirects": 1}
    try:
        r = requests.get(WIKIPEDIA_API, params=params, headers=HEADERS_WIKI)
        data = r.json()
        if "parse" in data: return data["parse"]["text"]["*"]
    except: pass
    return None

def extraer_de_infobox_html(soup):
    datos = {}
    infobox = soup.find("table", {"class": "infobox biota"}) or soup.find("table", {"class": "infobox"})
    if not infobox: return datos
    for tr in infobox.find_all("tr"):
        th = tr.find("th")
        td = tr.find("td")
        if not th or not td: continue
        header = th.get_text().lower().strip()
        value = td.get_text(" ", strip=True)
        if "length" in header:
            m = re.search(r'(\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?)\s*cm', value)
            if m: datos["tamano"] = f"{m.group(1)} cm"
        if "wingspan" in header:
            m = re.search(r'(\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?)\s*cm', value)
            if m: datos["envergadura"] = f"{m.group(1)} cm"
        if "mass" in header or "weight" in header:
            m_g = re.search(r'(\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?)\s*g', value)
            m_kg = re.search(r'(\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?)\s*kg', value)
            if m_g: datos["peso"] = f"{m_g.group(1)} g"
            elif m_kg: datos["peso"] = f"{m_kg.group(1)} kg"
    return datos

def get_wiki_summary(sci):
    endpoint = f"https://en.wikipedia.org/api/rest_v1/page/summary/{sci}"
    try:
        r = requests.get(endpoint, headers=HEADERS_WIKI)
        if r.status_code == 200: return r.json()
    except: pass
    return {}

def get_xeno_canto(sci):
    """
    Busca audio en Xeno-Canto API v3.
    REQUIERE: Clave API y formato sp:"Nombre Cientifico".
    """
    try:
       
        params = {
            "query": f'sp:"{sci}" q:A',
            "key": XC_KEY
        }
        
        r = requests.get(XENOCANTO_API, params=params)
        
        if r.status_code != 200: return None
        
        data = r.json()
        num = int(data.get("numRecordings", 0))
        
        # Si no hay calidad A, probamos calidad B
        if num == 0:
             params["query"] = f'sp:"{sci}" q:B'
             r = requests.get(XENOCANTO_API, params=params)
             if r.status_code == 200:
                 data = r.json()
                 num = int(data.get("numRecordings", 0))

        if num > 0:
            rec = data["recordings"][0]
            
            # Construir URL segura
            audio_url = rec.get("file", "")
            if not audio_url.startswith("http"): 
                audio_url = "https:" + audio_url
            
            # Log de éxito
            print(f"   🎵 Audio encontrado: {rec.get('type', 'Sonido')}")
            
            return {
                "url": audio_url, 
                "autor": rec.get("rec", "Desconocido"), 
                "licencia": rec.get("lic", "")
            }
            
    except Exception as e: 
        # print(f"Debug error audio: {e}") # Descomenta si quieres ver errores detallados
        pass
    
    return None
def get_commons_gallery(sci):
    params = { "action": "query", "generator": "search", "gsrsearch": f"{sci} filetype:bitmap", "gsrnamespace": 6, "gsrlimit": 5, "prop": "imageinfo", "iiprop": "url", "format": "json", "origin": "*" }
    fotos = []
    try:
        r = requests.get(COMMONS_API, params=params, headers=HEADERS_WIKI)
        pages = r.json().get("query", {}).get("pages", {})
        for pid in pages:
            url = pages[pid]["imageinfo"][0]["url"]
            if url.endswith(('.jpg', '.png')): fotos.append(url)
    except: pass
    return fotos

# ==========================================
# 🚀 EJECUCIÓN PRINCIPAL
# ==========================================

def enrich_species(bird, wikidata_cache):
    out = bird.copy()
    sci = out.get("scientificName", "").strip()
    fam = out.get("family", "")
    common = out.get("commonName", "")
    
    print(f"   ...Procesando: {sci}")

    out["frecuencia"] = get_frecuencia_valencia(sci)

    wiki_basic = get_wiki_summary(sci)
    if wiki_basic.get("extract"):
        try:
            out["desc_es"] = traductor_es.translate(wiki_basic["extract"][:4000])
            out["desc_va"] = traductor_va.translate(wiki_basic["extract"][:4000])
        except: pass
    if wiki_basic.get("originalimage") and not out.get("photo_url"):
        out["wikipedia_image"] = wiki_basic["originalimage"]["source"]

    # --- LÓGICA DE DATOS ---
    datos = { "tamano": None, "envergadura": None, "peso": None, "dieta": None, "actividad": None }
    
    # 1. WIKIDATA CACHÉ
    datos.update(wikidata_cache.get(sci, {}))

    # 2. VALIDACIÓN (FILTRO ANTI-ABSURDOS) 🛑
    # Si Wikidata dice 11g para un Cisne, lo borramos aquí.
    validar_y_corregir_datos(sci, datos)

    # 3. INFOBOX HTML (Si falta algo)
    if not datos["peso"] or not datos["tamano"]:
        html = get_wiki_full_html(sci)
        if html:
            soup = BeautifulSoup(html, "html.parser")
            datos_html = extraer_de_infobox_html(soup)
            if not datos["tamano"]: datos["tamano"] = datos_html.get("tamano")
            if not datos["peso"]: datos["peso"] = datos_html.get("peso")
            if not datos["envergadura"]: datos["envergadura"] = datos_html.get("envergadura")
            # Volvemos a validar por si Wikipedia HTML trae basura
            validar_y_corregir_datos(sci, datos)

    # 4. ESTIMACIÓN POR FAMILIA (Respaldo inteligente)
    # Ahora buscará "Swan" en el nombre antes de ver "Geese" en la familia.
    datos = estimar_por_familia(fam, common, sci, datos)
    
    if not datos.get("colores"): datos["colores"] = "Variado"
    out.update(datos)

    xc = get_xeno_canto(sci)
    if xc: out["audio"] = xc
    out["galeria"] = get_commons_gallery(sci)

    return {k: v for k, v in out.items() if v}

def main():
    print(f"📂 Leyendo: {INPUT_FILE}")
    try:
        with open(INPUT_FILE, "r", encoding="utf-8") as f: aves = json.load(f)
    except Exception as e:
        print(f"❌ Error archivo: {e}"); return

    # --- FASE 1: PRE-CARGA MASIVA ---
    print("🌍 1. Iniciando carga masiva desde Wikidata...")
    todos_nombres = [a.get("scientificName") for a in aves if a.get("scientificName")]
    
    wikidata_cache = {}
    chunk_size = 50 
    
    for i in range(0, len(todos_nombres), chunk_size):
        lote = todos_nombres[i:i + chunk_size]
        print(f"⚡ Consultando lote {i}-{i+len(lote)} de {len(todos_nombres)}...")
        datos_parciales = obtener_datos_masivos_wikidata(lote)
        wikidata_cache.update(datos_parciales)
        time.sleep(1)

    # --- FASE 2: PROCESAMIENTO ---
    total = len(aves)
    print(f"🚀 ENRIQUECIENDO {total} ESPECIES...")
    
    enriched = []
    
    for i, a in enumerate(aves, 1):
        try:
            res = enrich_species(a, wikidata_cache)
            enriched.append(res)
            
            print(f"✅ [{i}/{total}] {res.get('commonName')}")
            print(f"   📍 Frecuencia: {res.get('frecuencia')}")
            print(f"   📏 {res.get('tamano')} | ⚖️ {res.get('peso')}")
            print(f"   🍽️ {res.get('dieta')} | 🕒 {res.get('actividad')}")
            if res.get("audio"):
                print(f"   🎵 Audio: SÍ ({res['audio']['autor']})")
            else:
                print(f"   🔇 Audio: NO encontrado")
            print("-" * 40)
            
            # --- PAUSA DE VERIFICACIÓN (10 Primeros) ---
            if i == 10:
                print("\n🛑 PAUSA DE VERIFICACIÓN 🛑")
                print("Revisa los pesos de gansos/cisnes. Deberían ser > 1kg.")
                continuar = input("¿Continuar? (S/N): ")
                if continuar.lower() != 's': break
            
        except Exception as e:
            print(f"❌ Error en {i}: {e}")
            enriched.append(a)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(enriched, f, ensure_ascii=False, indent=2)
    print(f"✅ FINALIZADO. Archivo: {OUTPUT_FILE}")

if __name__ == "__main__":
    main()