# PreConsulta (`telemed-preconsult-ai`)

Aplicación web de preparación previa a la teleconsulta médica que transforma el relato libre del paciente (por voz o texto) en un interrogatorio dirigido de **1 a 3 preguntas breves de seguimiento OPQRST**, generando el **Pase de Pre-Consulta para el Paciente** (con alerta de prioridad clínica en la parte superior) y la **Ficha Clínica Estructurada (`SOAP` / `ISBAR`) para el Médico**.

- **Aplicación Web en Producción:** [https://telemed-preconsult-ai.vercel.app](https://telemed-preconsult-ai.vercel.app)
- **Cliente Android Nativo:** [`ykro/telemed-preconsult-android`](https://github.com/ykro/telemed-preconsult-android)
- **Índice de Prototipos:** [`ykro/ilab-aibuilders-prototypes`](https://github.com/ykro/ilab-aibuilders-prototypes)

---

## Flujo en 3 Pasos

1. **1. Cuéntanos cómo te sientes:** Captura por voz (`Web Speech API`) o texto libre, signos vitales opcionales en casa y anonimización local de identificadores personales (DPI y teléfonos).
2. **2. Ayúdame con más información:** Entre **1 y 3 preguntas dinámicas** según las variables faltantes del protocolo semiológico **OPQRST**, con lectura en voz alta y opciones rápidas.
3. **3. Resumen de consulta:** Banner superior de prioridad clínica (`ROJO`, `AMARILLO`, `VERDE`), **Pase del Paciente** con lista de preparación y **Ficha Médica** con selector `SOAP` / `ISBAR`.

---

## Uso de Gemma 4 E2B (Móvil Nativo vs. Web)

- **¿Para qué se usa Gemma 4 E2B?** En el cliente móvil nativo ([`telemed-preconsult-android`](https://github.com/ykro/telemed-preconsult-android)), **Gemma 4 E2B** anonimiza datos sensibles en el dispositivo, evalúa brechas **OPQRST** para formular de 1 a 3 preguntas y genera el triaje y la nota `SOAP` completamente **offline** (brigadas médicas rurales o zonas sin señal).
- **¿Por qué en Android nativo sí y en Web no?** El modelo cuantizado (~1.3 GB) se descarga una sola vez en el almacenamiento persistente de Android y se ejecuta sobre la GPU/NPU del teléfono mediante **LiteRT / MediaPipe**. En un navegador web móvil, descargar 1.3 GB antes de una consulta urgente es inviable en datos móviles y excede los límites de memoria de WebAssembly/WebGPU. Por ello, esta versión web prioriza acceso inmediato sin instalación respaldado en la nube por **Gemini 3.8 Flash** (ver detalle en [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)).

---

## Documentación y Artículos

- **Arquitectura Técnica y Diagramas:** [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- **Temas para Artículos Técnicos y de Producto (6 temas):** [`docs/ARTICLES.md`](./docs/ARTICLES.md)
- **Especificación Funcional:** [`SPEC.md`](./SPEC.md)
- **Guía de Instalación y Pruebas:** [`docs/ONBOARDING.md`](./docs/ONBOARDING.md)

---

## Inicio Rápido Local

```bash
npm install
cp .env.example .env.local # Opcional: GEMINI_API_KEY
npm run dev
```
