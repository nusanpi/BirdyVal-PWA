import xlrd
import json

# Abrir el archivo .xls
workbook = xlrd.open_workbook('ESPÈCIES DE L\'ATLES.xls')
sheet = workbook.sheet_by_index(0)

# Lista para almacenar las especies
especies = []
familia_actual = None

# Recorrer las filas
for row_idx in range(sheet.nrows):
    # Leer las tres primeras columnas
    nombre_cientifico = sheet.cell_value(row_idx, 0) if sheet.ncols > 0 else ""
    nombre_valenciano = sheet.cell_value(row_idx, 1) if sheet.ncols > 1 else ""
    nombre_castellano = sheet.cell_value(row_idx, 2) if sheet.ncols > 2 else ""
    
    # Convertir a string y limpiar espacios
    nombre_cientifico = str(nombre_cientifico).strip()
    nombre_valenciano = str(nombre_valenciano).strip()
    nombre_castellano = str(nombre_castellano).strip()
    
    # Si es una familia (comienza con "Fam")
    if nombre_cientifico.startswith("Fam"):
        # Eliminar "Fam" y limpiar puntos y espacios
        familia_actual = nombre_cientifico.replace("Fam", "").replace(".", "").strip()
        print(f"Familia encontrada: {familia_actual}")
    # Si no está vacío y no es una familia, es una especie
    elif nombre_cientifico and not nombre_cientifico.startswith("Fam"):
        especie = {
            "nombre_cientifico": nombre_cientifico,
            "nombre_valenciano": nombre_valenciano,
            "nombre_castellano": nombre_castellano,
            "familia": familia_actual
        }
        especies.append(especie)
        print(f"  - {nombre_cientifico} | {nombre_valenciano} | {nombre_castellano}")

# Guardar en un archivo JSON
with open('atlas_especies.json', 'w', encoding='utf-8') as f:
    json.dump(especies, f, ensure_ascii=False, indent=2)

print(f"\n¡Proceso completado! Se encontraron {len(especies)} especies.")
print("Archivo guardado: atlas_especies.json")
