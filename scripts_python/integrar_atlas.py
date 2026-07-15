import json

# Cargar el atlas de especies
with open('atlas_especies.json', 'r', encoding='utf-8') as f:
    atlas = json.load(f)

# Cargar el archivo enriched original
with open('../public/data/aves_cv_enriched.json', 'r', encoding='utf-8') as f:
    enriched_original = json.load(f)

# Crear un diccionario con el atlas indexado por nombre científico
atlas_dict = {}
for especie in atlas:
    nombre_cientifico = especie.get('nombre_cientifico', '').strip()
    # Ignorar encabezados y registros especiales
    if nombre_cientifico and not nombre_cientifico.startswith('NOM') and not nombre_cientifico.startswith('TOTAL'):
        atlas_dict[nombre_cientifico] = especie

print(f"Atlas cargado con {len(atlas_dict)} especies")

# Filtrar el archivo enriched para mantener solo las especies del atlas
enriched_filtrado = []
especies_encontradas = set()

for especie in enriched_original:
    nombre_cientifico = especie.get('scientificName', '').strip()
    
    if nombre_cientifico in atlas_dict:
        # Obtener la información del atlas
        info_atlas = atlas_dict[nombre_cientifico]
        
        # Actualizar/agregar información del atlas
        especie['nombre_es'] = info_atlas.get('nombre_castellano', especie.get('nombre_es', ''))
        especie['nombre_va'] = info_atlas.get('nombre_valenciano', especie.get('nombre_va', ''))
        especie['familia_atlas'] = info_atlas.get('familia', '')
        
        # Mantener toda la información existente (fotos, audio, etc.)
        enriched_filtrado.append(especie)
        especies_encontradas.add(nombre_cientifico)
        
        print(f"✓ {nombre_cientifico} | {info_atlas.get('nombre_castellano')} | {info_atlas.get('nombre_valenciano')}")

# Agregar especies del atlas que no estaban en enriched
especies_no_encontradas = []
for nombre_cientifico, info in atlas_dict.items():
    if nombre_cientifico not in especies_encontradas and not nombre_cientifico.startswith('NOM') and not nombre_cientifico.startswith('TOTAL'):
        # Crear una nueva entrada con la información del atlas
        nueva_especie = {
            "speciesCode": nombre_cientifico.lower().replace(' ', ''),
            "scientificName": nombre_cientifico,
            "nombre_es": info.get('nombre_castellano', ''),
            "nombre_va": info.get('nombre_valenciano', ''),
            "familia_atlas": info.get('familia', ''),
            "nota": "Especie del atlas sin imágenes adicionales"
        }
        enriched_filtrado.append(nueva_especie)
        especies_no_encontradas.append(nombre_cientifico)
        print(f"✚ {nombre_cientifico} (sin datos enriquecidos previos)")

# Guardar el archivo actualizado
with open('../public/data/aves_cv_enriched.json', 'w', encoding='utf-8') as f:
    json.dump(enriched_filtrado, f, ensure_ascii=False, indent=2)

print(f"\n✓ Archivo actualizado correctamente")
print(f"  - Especies del atlas encontradas en enriched: {len(especies_encontradas)}")
print(f"  - Especies nuevas del atlas agregadas: {len(especies_no_encontradas)}")
print(f"  - Total de especies en archivo final: {len(enriched_filtrado)}")
