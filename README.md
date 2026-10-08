# 🩺 Telemed Pre-Consult AI (`telemed-preconsult-ai`)

Generador automático de fichas médicas estándar pre-consulta (**SOAP** / **ISBAR**) + **Entregable para el Paciente** a partir de notas de voz rápidas y 3 preguntas dinámicas de seguimiento.

> 📌 **Documento de Especificación (Alcance y Plan de 1 Semana):** [Ver SPEC.md](./SPEC.md)
> 🔗 **Índice General de Proyectos:** [`ykro/hackathon-prototipos-index`](https://github.com/ykro/hackathon-prototipos-index)
> 🧪 **Benchmark Gemini 4 Argon & A/B Tests:** [`ykro/gemini-argon-agy-benchmark`](https://github.com/ykro/gemini-argon-agy-benchmark)

## 🎯 El Problema
Antes de una teleconsulta, los pacientes suelen describir sus síntomas de forma desordenada, rápida o ansiosa, omitiendo detalles clínicos clave. El médico pierde los primeros 5–10 minutos interrogando lo básico, y el paciente muchas veces entra a la consulta sin saber qué preguntar ni qué signos vigilar.

## 💡 La Solución (MVP de 1 Semana - PWA Mobile-First)
Una **Progressive Web App (PWA) Mobile-First** donde el paciente presiona un botón y habla libremente sobre cómo se siente (30–90 segundos):
1. **Captura por Voz en Tiempo Real:** Usa **Web Speech API (`SpeechRecognition`)** para transcripción instantánea en vivo en el navegador + respaldo multimodal con **Gemini (`gemini-3.8-flash`)** y opción de pre-triaje local en el navegador con **Gemma 4 E2B** (vía WebGPU / Transformers.js o Ollama).
2. **3 Preguntas Rápidas de Follow-Up:** Antes de generar la preconsulta, la IA evalúa los huecos clínicos (OPQRST) y le hace al paciente **exactamente 3 preguntas cortas y dinámicas** (respondibles por voz con `SpeechSynthesis` + `SpeechRecognition` o con un toque).
3. **Doble Entregable (Médico + Paciente):**
   - 👩‍⚕️ **Para el Médico:** Ficha estructurada **SOAP** e **ISBAR** con *Evidence Tracing* (citas exactas a lo que dijo el paciente) y semáforo de *Red Flags*.
   - 🧑‍💼 **Para el Paciente (Su Pase de Pre-Consulta):** Una tarjeta descargable/compartible por WhatsApp o PDF con el resumen claro de sus síntomas organizados, **3 preguntas clave sugeridas para hacerle al doctor**, checklist de qué tener a la mano en la videollamada y signos de alarma.

## 🛠️ Stack & Despliegue
- **Frontend:** Next.js (App Router, configurada como **PWA instalable**) + Tailwind CSS + Web Speech API (`SpeechRecognition` & `SpeechSynthesis`)
- **IA Cloud:** API de **Gemini (`gemini-3.8-flash`)** con *Structured Outputs*
- **IA Edge / On-Device (Opcional/Híbrido):** **Gemma 4 E2B** para anonimización PII local o generación offline de las 3 preguntas de follow-up
- **Deploy:** **Vercel** (o Google Cloud Run en `pm-innovationlab`)
