# Arquitectura Técnica: PreConsulta (`telemed-preconsult-ai`)

Este documento describe la arquitectura de software, el diseño de privacidad médica (*Privacy-by-Design*), la máquina de estados clínica **OPQRST** y la integración híbrida entre esta **Progressive Web App (PWA) Mobile-First** y su **Aplicación Nativa Android Complementaria** ([`ykro/telemed-preconsult-android`](https://github.com/ykro/telemed-preconsult-android)).

> **Producción en Vivo (PWA):** [https://telemed-preconsult-ai.vercel.app](https://telemed-preconsult-ai.vercel.app)  
> **Repositorio Android Nativo Complementario:** [`https://github.com/ykro/telemed-preconsult-android`](https://github.com/ykro/telemed-preconsult-android)  
> **Especificación Funcional:** [Ver `SPEC.md`](../SPEC.md) · [Guía de Onboarding](./ONBOARDING.md)

---

## 1. Visión Arquitectónica del Ecosistema (PWA + Android Nativo + IA Híbrida)

El sistema opera bajo un patrón **Dual-Client / Hybrid-Edge Clinical Pipeline**:
1. **Cliente Universal sin Fricción (Este Repositorio — PWA Next.js 15):** Permite que cualquier paciente abra un enlace antes de su videoconsulta sin instalar binarios pesados, y ofrece al médico una consola clínica expandida (SOAP / ISBAR + Evidence Tracing).
2. **Cliente Móvil Nativo On-Device ([`ykro/telemed-preconsult-android`](https://github.com/ykro/telemed-preconsult-android)):** Aplicación nativa en Kotlin + Jetpack Compose para brigadas médicas o tabletas clínicas en Android que aprovecha el reconocimiento de voz nativo del sistema operativo y respaldo local offline.

![Arquitectura híbrida de pre-consulta médica](./diagrams/system-architecture.svg)

---

## 2. Flujo Clínico en 3 Pasos y Máquina de Estados OPQRST

![Flujo clínico en 3 pasos y doble entregable](./diagrams/clinical-flow.svg)

### 2.1 Paso 1: Captura Continua de Relato Libre (`SpeechRecognition` / `webkitSpeechRecognition`)
Implementado en [`src/app/page.tsx`](../src/app/page.tsx), el motor de voz opera directamente en el navegador:
- `recognition.continuous = true`: Mantiene el canal de captura abierto durante pausas respiratorias naturales del paciente en relatos de 30 a 90 segundos.
- `recognition.interimResults = true`: Muestra palabras parciales (`interimTranscript`) en tiempo real y consolida los segmentos confirmados dentro del estado `transcript`.
- **Lectura Asistida (TTS):** En el Paso 2 (**"Ayúdame con más información"**), `window.speechSynthesis` permite escuchar cada pregunta en voz alta (`es-MX` / `es-GT`).

### 2.2 Paso 2: Interrogatorio Dinámico de 1 a 3 Preguntas ("Ayúdame con más información")
El protocolo semiológico **OPQRST** estructura el interrogatorio del síntoma guía:
- **O — Onset (Inicio):** ¿Empezó de forma súbita o gradual?
- **P — Provocation / Palliation (Agravantes y Atenuantes):** ¿Qué lo empeora o alivia?
- **Q — Quality (Carácter):** ¿Es pulsátil, opresivo o punzante?
- **R — Radiation (Irradiación):** ¿Hacia dónde se extiende?
- **S — Severity (Severidad):** Escala del `1 al 10` e impacto funcional.
- **T — Time & Context (Tiempo, Medicación y Alergias):** Evolución en horas o días, medicamentos tomados y alergias.

El endpoint `/api/telemed` (`action: 'generate_followups'`) y el motor determinístico en [`src/lib/clinical-engine.ts`](../src/lib/clinical-engine.ts) evalúan qué datos ya están presentes en el relato inicial y generan **entre 1 y 3 preguntas focalizadas (máximo 3)**. El paciente puede avanzar al resumen tan pronto como las preguntas desplegadas (`followUpQuestions.length`) estén respondidas.

### 2.3 Paso 3: Alerta Clínica de Prioridad y Síntesis Dual (`generate_deliverables`)
En el Paso 3, la pantalla de resultados presenta en la parte superior un **Banner Hero de Prioridad Clínica** (visible sobre las pestañas tanto para el Paciente como para el Médico):
- **ROJO (`ATENCIÓN URGENTE INMEDIATA`):** Fondo `#FEF2F2`, borde `#EF4444` con franja izquierda de `6px` y texto `#991B1B`.
- **AMARILLO (`CONSULTA PRIORITARIA HOY`):** Fondo `#FFFBEB`, borde `#F59E0B` con franja izquierda de `6px` y texto `#92400E`.
- **VERDE (`CONSULTA RUTINARIA`):** Fondo `#ECFDF5`, borde `#10B981` con franja izquierda de `6px` y texto `#065F46`.

Debajo del banner de prioridad se presenta el selector entre:
1. **`patient_deliverable` (`PatientDeliverable`):** Resumen amigable (`friendly_summary`), preguntas sugeridas para el médico (`questions_to_ask_doctor`) y lista de verificación interactiva (`prep_checklist`).
2. **`doctor_deliverable` (`DoctorDeliverable`):** Nivel de triaje (`triage_level`), banderas rojas (`red_flags`), desglose `opqrst`, notas clínicas `soap` e `isbar` con cambio instantáneo, y citas textuales verificables (`evidence_quotes`).

---

## 3. Pipeline de Redacción y Anonimización de PII (`redactPiiLocally`)

Definido en [`src/lib/clinical-engine.ts`](../src/lib/clinical-engine.ts), el motor de privacidad protege la información personal identificable (PII) antes de enviar el relato hacia los modelos en la nube:

| Tipo de Entidad PII | Patrón de Detección | Token de Reemplazo | Ejemplo |
| :--- | :--- | :--- | :--- |
| **DPI Guatemalteco (CUI)** | `/\b\d{4}[\s-]?\d{5}[\s-]?\d{4}\b/g` | `[ID-PROTEGIDO]` | `2456 78901 0101` -> `[ID-PROTEGIDO]` |
| **Teléfono (GT / LatAm)** | `/\b(?:\+?502[\s-]?)?\d{4}[\s-]\d{4}\b/g` | `[TEL-PROTEGIDO]` | `+502 5544-3322` -> `[TEL-PROTEGIDO]` |
| **Nombre Propio en Saludo** | `/\b(mi nombre es\|me llamo\|soy)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+...)/g` | `\1 [PACIENTE]` | `soy Sofía Hernández` -> `soy [PACIENTE]` |

---

## 4. Integración con Android Nativo y Uso de Gemma 4 E2B

Repositorio Oficial Android: **[`https://github.com/ykro/telemed-preconsult-android`](https://github.com/ykro/telemed-preconsult-android)**

### ¿Por qué Gemma 4 E2B corre localmente en la App Android Nativa y no en el navegador Web?

| Criterio Técnico | Cliente Web (`telemed-preconsult-ai`) | Cliente Móvil Nativo (`telemed-preconsult-android`) |
| :--- | :--- | :--- |
| **Descarga y persistencia del modelo** | Un navegador web móvil no puede exigir la descarga de **1.3 GB a 1.5 GB** de pesos cuantizados antes de atender una consulta médica urgente; consumiría el plan de datos del paciente y excedería las cuotas de almacenamiento volátil del navegador. | El paquete cuantizado `.task` de **Gemma 4 E2B** se almacena de forma persistente en el sistema de archivos local de Android una sola vez, quedando disponible al instante sin consumir datos en cada consulta. |
| **Aceleración de hardware (GPU / NPU)** | WebGPU y WebAssembly en navegadores móviles tienen límites estrictos de memoria por pestaña y sufren cierres abruptos (*Out-Of-Memory*) al cargar modelos de lenguaje en teléfonos de gama media. | Android nativo accede directamente a los delegados de GPU y NPU del procesador móvil mediante **MediaPipe LLM Inference API / LiteRT**, ejecutando inferencia local estable y con baja latencia. |
| **Caso de uso principal** | **Acceso inmediato sin instalación** (vía enlace por WhatsApp o código QR en sala de espera) respaldado en la nube por **Gemini 3.8 Flash**. | **Uso recurrente, brigadas médicas y operación offline** con **Gemma 4 E2B** en el dispositivo y sincronización con **Gemini 3.8 Flash** cuando hay conectividad. |

---

## 5. Estructura de Archivos del Proyecto

```text
telemed-preconsult-ai/
├── public/
│   ├── icon.svg                  # Ícono vectorial médico adaptable (maskable PWA)
│   └── manifest.json             # Manifiesto Web App (standalone, es-GT, theme #0284c7)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── telemed/
│   │   │       └── route.ts      # Endpoint Serverless (Gemma 4 + Gemini 3.8 Flash + Fallback)
│   │   ├── globals.css           # Estilos Tailwind CSS v4 + reglas @media print para exportar PDF
│   │   ├── layout.tsx            # Metadatos SEO/PWA, viewport móvil y tipografía
│   │   └── page.tsx              # Interfaz en 3 pasos (Síntomas, Ayúdame con más información, Resumen)
│   ├── lib/
│   │   └── clinical-engine.ts    # Redacción PII local, 3 Casos Clínicos y motor determinístico (1-3 preguntas)
│   └── types/
│       └── telemed.ts            # Contratos TypeScript para SOAP, ISBAR, OPQRST y entregables
├── docs/
│   ├── diagrams/                 # Diagramas editoriales canónicos (.html y .svg)
│   ├── ARCHITECTURE.md           # Documentación de arquitectura técnica (este archivo)
│   └── ONBOARDING.md             # Guía de instalación, pruebas clínicas y CI/CD
├── SPEC.md                       # Especificación funcional y esquema JSON
└── README.md                     # Documentación principal del proyecto
```
