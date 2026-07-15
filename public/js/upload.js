// Archivo: js/upload.js

import { db } from './firebase.js'; 
import { collection, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

async function subirDatos() {
    const statusDiv = document.getElementById('status');
    statusDiv.innerHTML = "⏳ Leyendo archivo JSON...";

    try {

        const response = await fetch('./data/aves_cv_enriched.json');
        
        if (!response.ok) {
            throw new Error(`No se pudo leer el archivo JSON. Asegúrate de que aves_cv_enriched.json está en la carpeta raíz.`);
        }

        const aves = await response.json();
        statusDiv.innerHTML += `<br>✅ Archivo leído. Encontradas ${aves.length} especies.`;
        statusDiv.innerHTML += `<br>🚀 Iniciando subida a Firebase (Colección: 'especies')...`;

        let contador = 0;

        for (const ave of aves) {
        
            const docRef = doc(db, "especies", ave.speciesCode);
            await setDoc(docRef, ave);
            
            contador++;
            
            if (contador % 10 === 0) {
                statusDiv.innerHTML += `<br>... Procesados ${contador} pájaros`;
            }
        }

        statusDiv.innerHTML += `<br><br>🎉 ¡ÉXITO TOTAL! Se han subido ${contador} especies a la nube.`;

    } catch (error) {
        console.error("Error subiendo datos:", error);
        statusDiv.innerHTML += `<br><br>❌ ERROR: ${error.message}`;
    }
}


window.subirDatos = subirDatos;