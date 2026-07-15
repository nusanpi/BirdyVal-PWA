<div align="center">

<img src="public/img/logo_sintexto.png" alt="BirdyVal logo" width="120"/>

# BirdyVal

**A gamified Progressive Web App for identifying and recording birds of the Valencian Community (Spain), powered by AI.**

[![Live Demo](https://img.shields.io/badge/Live_Demo-birdyval--450b5.web.app-2ea44f?style=for-the-badge)](https://birdyval-450b5.web.app)
[![Backend API](https://img.shields.io/badge/API-birdyval.onrender.com-blue?style=for-the-badge)](https://birdyval.onrender.com)

![JavaScript](https://img.shields.io/badge/JavaScript-ES_Modules-F7DF1E?logo=javascript&logoColor=black)
![Python](https://img.shields.io/badge/Python-FastAPI-3776AB?logo=python&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Auth_·_Firestore_·_Storage-FFCA28?logo=firebase&logoColor=black)
![Gemini](https://img.shields.io/badge/Google_Gemini-AI_identification-8E75B2?logo=googlegemini&logoColor=white)
![Leaflet](https://img.shields.io/badge/Leaflet-Interactive_maps-199900?logo=leaflet&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Installable-5A0FC8)

*Bachelor's Thesis (TFG) — Escola Tècnica Superior d'Enginyeria (ETSE), Universitat de València*

</div>

---

## Demo

<!-- Drag & drop demo_birdyval_github.mp4 into this section while editing the README on github.com — GitHub will replace it with an embedded video player. Then delete this comment. -->

## Features

**AI-powered identification** — Upload a photo *or an audio recording* of a bird and Google Gemini identifies the species, returning detailed information from the local species database.

**Live bird radar** — An interactive Leaflet map shows recent sightings within a 3 km radius around you, merging real-time data from the eBird API with sightings from the community.

**Sighting logging** — Record sightings with GPS location, photo/audio and notes, stored in Firestore and shared with the community feed.

**Gamification** — Earn points for every sighting, with bonuses for photos, rarity and first-time species. Climb through 7 levels, from *Egg* to *Legend of l'Albufera*.

**Species encyclopedia** — 700+ species of the Valencian Community with names in Spanish and Valencian, scientific names, images, songs (xeno-canto) and detailed field descriptions.

**Community** — Public profiles, activity feed and private messaging between birders.

**Fully bilingual** — Complete interface in Spanish and Valencian/Catalan (i18n).

**PWA** — Installable on mobile, with offline support via service worker.

## Architecture

```
┌─────────────────────┐        ┌──────────────────────────┐
│  Frontend (PWA)     │        │  Backend (FastAPI)       │
│  Vanilla JS modules │──────▶ │  /predict  → Gemini AI   │
│  Firebase Hosting   │        │  /ebird    → eBird proxy │
└──────────┬──────────┘        └──────────────────────────┘
           │                              Render
           ▼
┌─────────────────────┐
│  Firebase           │
│  Auth · Firestore   │
│  Storage            │
└─────────────────────┘
```

| Layer | Stack |
|---|---|
| Frontend | HTML5 / CSS3 / JavaScript (ES modules, no bundler) |
| Maps | Leaflet 1.9.4 |
| Auth & database | Firebase 10 (Auth, Firestore, Storage) |
| Backend | Python 3 · FastAPI · Uvicorn |
| AI | Google Gemini API (vision + audio) |
| External data | eBird API v2 · xeno-canto · Wikimedia |
| Testing | Vitest (frontend) · pytest (backend) |
| Hosting | Firebase Hosting (frontend) · Render (backend) |

## Getting started

### Prerequisites

Python 3.10+, Node 18+ (only for tests), a Firebase project, and API keys for [Gemini](https://aistudio.google.com/app/apikey) and [eBird](https://ebird.org/api/keygen).

### Backend

```bash
pip install -r requirements.txt
cp backend/environment/.env.example backend/environment/.env   # fill in your keys
# place your Firebase Admin service account JSON at backend/environment/firebase-service-account.json
uvicorn backend.main:app --reload
```

### Frontend

```bash
cd public/data && cp aves_cv_enriched.sample.json aves_cv_enriched.json && cd ../..
npx firebase serve       # or any static server over public/
```

### Tests

```bash
npx vitest run           # frontend
pytest backend/tests     # backend
```

## About the species data

The full species database (~700 birds) was built with the Python pipeline in [`scripts_python/`](scripts_python/): base list generation, enrichment with eBird taxonomy, Wikimedia images, xeno-canto songs and automatic ES/VA translation.

The field descriptions were kindly provided by the **Societat Valenciana d'Ornitologia (SVO)** for this project and **are not redistributed in this repository**. A [sample dataset](public/data/) with the same schema is included so the app can run out of the box.

## Credits

- Species descriptions: © Societat Valenciana d'Ornitologia (SVO), used with permission.
- Bird songs: [xeno-canto](https://xeno-canto.org) contributors (CC licenses).
- Images: Wikimedia Commons.
- Sighting data: [eBird](https://ebird.org) (Cornell Lab of Ornithology).

---

<div align="center">

Made by **Nuria Sanchis Pino** — TFG 2025/26, Universitat de València

</div>
