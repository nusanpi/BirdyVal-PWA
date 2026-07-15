// Archivo: firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDKLnjHTupZ5EgHlgK-Df2i0Nt8GRV0JHo",
  authDomain: "birdyval-450b5.firebaseapp.com",
  projectId: "birdyval-450b5",
  storageBucket: "birdyval-450b5.firebasestorage.app",
  messagingSenderId: "590678812040",
  appId: "1:590678812040:web:77668924c0aaaea52ac63d",
  measurementId: "G-5T40H4MVXX"
};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { db, auth, storage };