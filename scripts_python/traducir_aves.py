import json
import time
from deep_translator import GoogleTranslator

# Ruta del archivo
fichero_json = '../public/data/aves_cv_enriched.json'

print("Cargando base de datos de aves...")
try:
    with open(fichero_json, 'r', encoding='utf-8') as f:
        especies = json.load(f)
except FileNotFoundError:
    print("Error: No se encuentra el archivo JSON.")
    exit()

print(f"Total especies en base de datos: {len(especies)}")

# Inicializar traductor (es -> ca para Valenciano)
translator = GoogleTranslator(source='es', target='ca')

traducidas = 0
errores = 0

print("\nIniciando traducción de descripciones (ES -> VA)...")

for i, especie in enumerate(especies):
    nombre = especie.get('nombre_es', 'Desconocido')
    desc_es = especie.get('desc_es', '')
    desc_va = especie.get('desc_va', '')
    
    # Traducir SIEMPRE si hay descripción en español (Forzar sobrescritura)
    if desc_es and len(desc_es) > 20: 
        # Filtro opcional: Si ya es igual (muy raro) saltamos, pero mejor forzar para asegurar que es traducción de SEO
        print(f"[{i+1}/{len(especies)}] Traduciendo: {nombre}")
        
        try:
            # Google Translate tiene límite de caracteres (aprox 5000), las descripciones de aves suelen ser menores
            traduccion = translator.translate(desc_es)
            
            if traduccion:
                especie['desc_va'] = traduccion
                especie['fuente_texto_va'] = 'Traducción automática (Google) de SEO/BirdLife'
                traducidas += 1
            else:
                print(f"  ✗ Traducción vacía devolvida")
                
            # Pequeña pausa para no saturar
            time.sleep(0.5)
            
        except Exception as e:
            print(f"  ✗ Error al traducir: {e}")
            errores += 1
            time.sleep(2) # Pausa más larga si hay error
            
    # Guardar cada 10 traducciones para no perder progreso
    if traducidas > 0 and traducidas % 10 == 0:
        with open(fichero_json, 'w', encoding='utf-8') as f:
            json.dump(especies, f, ensure_ascii=False, indent=2)

# Guardado final
print("\nGuardando cambios finales...")
with open(fichero_json, 'w', encoding='utf-8') as f:
    json.dump(especies, f, ensure_ascii=False, indent=2)

print(f"\nRESUMEN:")
print(f" - Traducidas: {traducidas}")
print(f" - Errores: {errores}")
print("Proceso completado.")
