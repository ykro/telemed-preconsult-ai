# 🩺 Telemed Pre-Consult AI (`telemed-preconsult-ai`)

Generador automático de fichas médicas estándar pre-consulta (**SOAP** / **ISBAR**) a partir de notas de voz rápidas o conversación natural del paciente.

> 📌 **Documento de Especificación (Alcance y Plan de 1 Semana):** [Ver SPEC.md](./SPEC.md)

## 🎯 El Problema
Antes de una teleconsulta, los pacientes suelen describir sus síntomas de forma desordenada, rápida o ansiosa, omitiendo detalles clínicos clave. El médico pierde los primeros 5–10 minutos de la consulta interrogando lo básico y transcribiendo en el expediente clínico.

## 💡 La Solución (MVP de 1 Semana)
Una aplicación web/móvil donde el paciente presiona un botón y habla libremente sobre cómo se siente (ej. 60–90 segundos). El sistema:
1. Transcribe el audio con alta precisión médica.
2. Detecta si falta información crítica (ej. duración, intensidad del dolor, alergias) y hace **1 a 2 preguntas rápidas de seguimiento**.
3. Genera una ficha estructurada lista para el médico en formato **SOAP** (Subjetivo, Objetivo, Análisis preliminar, Plan sugerido) e **ISBAR** (Identificación, Situación, Antecedentes, Evaluación, Recomendación), con **trazabilidad de evidencia** (citas exactas a lo que dijo el paciente) y alertas de **banderas rojas (Red Flags)**.

## 🛠️ Stack Sugerido para Hackathon
- **Frontend:** Next.js (App Router) + Tailwind CSS + Web Audio API (`MediaRecorder`)
- **Transcripción (ASR):** OpenAI Whisper (`whisper-large-v3` vía Groq para baja latencia) o Gemini Multimodal directo (Audio -> JSON)
- **Motor Clínico (LLM):** Gemini 2.5 Flash / GPT-4o con *Structured Outputs* (JSON Schema estricto)

## 🚀 Cómo empezar
Revisa el detalle completo de arquitectura, prompts, modelo de datos y plan día por día en **[SPEC.md](./SPEC.md)**.
