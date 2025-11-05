# Simuladores Go / No Go — Tres agentes (OnCity, Coto Digital, Dexter)

App estática para GitHub Pages. Tres agentes con 5+ pasos, pistas y bloqueo por intentos. Emite **Go / No Go** y permite **Descargar PDF** (via ventana imprimible).

## Estructura
- `index.html` — Hub.
- `agent.html` — Simulador por escenario (`?scenario=`).
- `style.css`, `hub.js`, `agent.js`.
- `configs/*.json` — Reglas/umbrales.

## Uso rápido
1. Publicá en GitHub Pages.
2. Entrá a un agente y escribí `validar`.
3. Completá panel y/o pegá JSON.
4. En el PASO 5, calculá la decisión. Usá **Descargar PDF** para guardar la transcripción.
