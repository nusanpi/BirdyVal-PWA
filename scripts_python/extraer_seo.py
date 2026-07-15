import json
import requests
from bs4 import BeautifulSoup
import time
import re
from difflib import get_close_matches

# Cargar el archivo enriched actual
with open('../public/data/aves_cv_enriched.json', 'r', encoding='utf-8') as f:
    especies = json.load(f)

print(f"Cargadas {len(especies)} especies para actualizar descripciones\n")

# Headers para simular un navegador
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}

# 1. OBTENER MAPA DE URLs DESDE EL SITEMAP
print("Obteniendo mapa de URLs desde sitemap...")
sitemap_url = "https://seo.org/ave-sitemap.xml"
mapa_urls = {}

try:
    response = requests.get(sitemap_url, headers=headers, timeout=15)
    if response.status_code == 200:
        soup = BeautifulSoup(response.content, 'xml')
        urls = soup.find_all('loc')
        for url_node in urls:
            url = url_node.text.strip()
            # extraer el slug: https://seo.org/ave/aguila-imperial-iberica/ -> aguila-imperial-iberica
            slug = url.rstrip('/').split('/')[-1]
            mapa_urls[slug] = url
        print(f"✓ Mapa de URLs construido: {len(mapa_urls)} entradas")
    else:
        print("✗ No se pudo obtener el sitemap. Se usará el método de adivinanza.")
except Exception as e:
    print(f"✗ Error obteniendo sitemap: {e}")

# Funciones auxiliares
def normalizar_para_busqueda(texto):
    """Normaliza texto para comparar con slugs"""
    if not texto: return ""
    texto = texto.lower()
    texto = texto.replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u')
    texto = texto.replace('à', 'a').replace('è', 'e').replace('ï', 'i').replace('ò', 'o').replace('ù', 'u')
    texto = re.sub(r'[^a-z0-9]', '', texto) # solo letras y numeros
    return texto

def obtener_mejor_url(nombre_es, nombre_cientifico, mapa_urls):
    """Busca la mejor URL coincidente en el mapa de forma ESTRICTA"""
    if not mapa_urls: return None
    
    slug_es = normalizar_para_busqueda(nombre_es)
    slug_ci = normalizar_para_busqueda(nombre_cientifico)
    
    # Mapa inverso
    slugs_disponibles = list(mapa_urls.keys())
    slugs_norm = {normalizar_para_busqueda(s): s for s in slugs_disponibles}
    keys_norm = list(slugs_norm.keys())
    
    # 1. Búsqueda exacta (Nombre común o científico)
    if slug_es in slugs_norm: return mapa_urls[slugs_norm[slug_es]]
    if slug_ci in slugs_norm: return mapa_urls[slugs_norm[slug_ci]]
    
    # 2. Búsqueda fuzzy MUY ESTRICTA (cutoff 0.90) para errores tipográficos menores
    matches = get_close_matches(slug_es, keys_norm, n=1, cutoff=0.90)
    if matches: 
        print(f"   (Fuzzy match estricto: {slug_es} -> {matches[0]})")
        return mapa_urls[slugs_norm[matches[0]]]
        
    matches_ci = get_close_matches(slug_ci, keys_norm, n=1, cutoff=0.90)
    if matches_ci: 
        print(f"   (Fuzzy match estricto: {slug_ci} -> {matches_ci[0]})")
        return mapa_urls[slugs_norm[matches_ci[0]]]

    return None


actualizadas = 0
no_encontradas = []
con_error = []

for i, especie in enumerate(especies):
    # Si ya tiene descripción actualizada de SEO, saltar (o forzar si se desea)
    if especie.get('fuente_texto_es') == 'SEO/BirdLife - Guía de Aves de España' and len(especie.get('desc_es', '')) > 20:
        continue
        
    nombre_es = especie.get('nombre_es', '').strip()
    nombre_cientifico = especie.get('scientificName', '').strip()
    
    if not nombre_es:
        continue
    
    print(f"[{i+1}/{len(especies)}] Procesando: {nombre_es}")
    
    # Obtener URL
    url_destino = obtener_mejor_url(nombre_es, nombre_cientifico, mapa_urls)
    
    if not url_destino:
        # Fallback manual original
        url_destino = f"https://seo.org/ave/{nombre_es.lower().replace(' ', '-').replace('á','a').replace('é','e').replace('í','i').replace('ó','o').replace('ú','u')}/"
    else:
        print(f"  -> Match encontrado: {url_destino}")

    try:
        response = requests.get(url_destino, headers=headers, timeout=10)
        
        if response.status_code == 200:
            soup = BeautifulSoup(response.content, 'html.parser')
            descripcion = None
            
            # Lógica de extracción (igual que antes)
            contenedores = soup.find_all(['article', 'main'], limit=1)
            if not contenedores:
                contenedores = soup.find_all('div', class_=re.compile(r'content|texto|description|descripcion', re.I))
            
            for contenedor in contenedores:
                parrafos = contenedor.find_all('p')
                if parrafos:
                    textos = []
                    for p in parrafos[:4]: # Un poco más generoso con los párrafos
                        texto = p.get_text(strip=True)
                        # Evitar textos irrelevantes cortos o legales
                        if texto and len(texto) > 40 and "cookies" not in texto.lower():
                            textos.append(texto)
                    
                    if textos:
                        descripcion = '\n\n'.join(textos)
                        break
            
            # Backup search
            if not descripcion:
                parrafos = soup.find_all('p')
                for p in parrafos:
                    texto = p.get_text(strip=True)
                    if len(texto) > 150 and "cookies" not in texto.lower():
                        descripcion = texto
                        break
            
            if descripcion and len(descripcion) > 50:
                especie['desc_es'] = descripcion
                especie['fuente_texto_es'] = 'SEO/BirdLife - Guía de Aves de España'
                especie['credito_url'] = url_destino
                actualizadas += 1
                print(f"  ✓ Actualizado ({len(descripcion)} caracteres)")
            else:
                print(f"  ✗ Sin descripción válida en la página")
                no_encontradas.append(nombre_es)
        else:
            print(f"  ✗ 404 No encontrada")
            no_encontradas.append(nombre_es)
            
    except Exception as e:
        print(f"  ✗ Error: {str(e)[:50]}")
        con_error.append(nombre_es)
    
    time.sleep(1) # Respetar el servidor

# Guardar
with open('../public/data/aves_cv_enriched.json', 'w', encoding='utf-8') as f:
    json.dump(especies, f, ensure_ascii=False, indent=2)

print(f"\n✓ PROCESO FINALIZADO")
print(f"  - Actualizadas: {actualizadas}")
print(f"  - No encontradas: {len(no_encontradas)}")

