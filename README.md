# PreConsulta (`telemed-preconsult-ai`)

[![Produccion en Vivo - Vercel](https://img.shields.io/badge/Produccion_en_Vivo-telemed--preconsult--ai.vercel.app-0284c7?style=for-the-badge&logo=vercel&logoColor=white)](https://telemed-preconsult-ai.vercel.app)
[![App Android Nativa](https://img.shields.io/badge/App_Android_Nativa-ykro%2Ftelemed--preconsult--android-0d9488?style=for-the-badge&logo=android&logoColor=white)](https://github.com/ykro/telemed-preconsult-android)
[![Indice de Prototipos](https://img.shields.io/badge/Indice_General-ilab--aibuilders--prototypes-334155?style=for-the-badge&logo=github)](https://github.com/ykro/ilab-aibuilders-prototypes)

Aplicación web de preparación previa a la teleconsulta médica que transforma el relato libre del paciente (por voz o texto) en un interrogatorio dirigido de **1 a 3 preguntas breves de seguimiento OPQRST**, generando dos entregables sincronizados: el **Pase de Pre-Consulta para el Paciente** (con alerta de prioridad clínica en la parte superior) y la **Ficha Clínica Estructurada (`SOAP` / `ISBAR`) para el Médico**.

---

## Accesos Rápidos y Documentación

| Recurso | Enlace Directo | Descripción |
| :--- | :--- | :--- |
| **Aplicación Web en Producción** | **[https://telemed-preconsult-ai.vercel.app](https://telemed-preconsult-ai.vercel.app)** | Aplicación web desplegada en Vercel. |
| **Repositorio Android Nativo** | **[`ykro/telemed-preconsult-android`](https://github.com/ykro/telemed-preconsult-android)** | Cliente móvil nativo en Kotlin y Jetpack Compose con soporte para Gemma 4 E2B. |
| **Guía de Onboarding** | **[`docs/ONBOARDING.md`](./docs/ONBOARDING.md)** | Instalación local, prueba de los 3 casos clínicos y despliegue continuo. |
| **Arquitectura Técnica** | **[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)** | Detalle de Web Speech API, Redacción PII, máquina de estados OPQRST e integración Android. |
| **Especificación del MVP** | **[`SPEC.md`](./SPEC.md)** | Alcance funcional del proyecto y esquema JSON unificado. |
| **Índice General** | **[`ykro/ilab-aibuilders-prototypes`](https://github.com/ykro/ilab-aibuilders-prototypes)** | Catálogo de prototipos del Innovation Lab Galileo. |

---

## ¿Para qué se usa Gemma 4 E2B en Telemedicina y por qué se ejecuta en el Móvil Nativo y no en Web?

El proyecto cuenta con dos canales complementarios: esta aplicación web (`telemed-preconsult-ai`) y el cliente móvil nativo Android ([`telemed-preconsult-android`](https://github.com/ykro/telemed-preconsult-android)).

### 1. ¿Para qué se usa Gemma 4 E2B en el flujo clínico?
- **Privacidad médica en el dispositivo (*On-Device Edge AI*):** Permite anonimizar identificadores personales (DPI, teléfonos) y estructurar el relato libre del paciente directamente en el teléfono antes de transmitir datos clínicos.
- **Interrogatorio dinámico y triaje offline:** Analiza localmente qué dimensiones del protocolo semiológico **OPQRST** (*Onset, Provocation, Quality, Radiation, Severity, Time*) faltan en el relato inicial para formular de **1 a 3 preguntas de seguimiento** y generar la clasificación de prioridad (`ROJO`, `AMARILLO`, `VERDE`) junto con la nota `SOAP` cuando no existe conexión a internet (brigadas médicas rurales, puestos de salud o zonas con cobertura celular intermitente).

### 2. ¿Por qué Gemma 4 E2B corre localmente en la App Android Nativa y no en el navegador Web?

| Criterio Técnico | Cliente Web (`telemed-preconsult-ai`) | Cliente Móvil Nativo (`telemed-preconsult-android`) |
| :--- | :--- | :--- |
| **Descarga y persistencia del modelo** | Un navegador web móvil no puede exigir la descarga de **1.3 GB a 1.5 GB** de pesos cuantizados antes de atender una consulta médica urgente; consumiría el plan de datos del paciente y excedería las cuotas de almacenamiento volátil del navegador. | El paquete cuantizado `.task` de **Gemma 4 E2B** se almacena de forma persistente en el sistema de archivos local de Android una sola vez, quedando disponible al instante sin consumir datos en cada consulta. |
| **Aceleración de hardware (GPU / NPU)** | WebGPU y WebAssembly en navegadores móviles tienen límites estrictos de memoria por pestaña y sufren cierres abruptos (*Out-Of-Memory*) al cargar modelos de lenguaje en teléfonos de gama media. | Android nativo accede directamente a los delegados de GPU y NPU del procesador móvil mediante **MediaPipe LLM Inference API / LiteRT**, ejecutando inferencia local estable y con baja latencia. |
| **Caso de uso principal** | **Acceso inmediato sin instalación** (vía enlace por WhatsApp o código QR en sala de espera) respaldado en la nube por **Gemini 3.8 Flash**. | **Uso recurrente, brigadas médicas y operación offline** con **Gemma 4 E2B** en el dispositivo y sincronización con **Gemini 3.8 Flash** cuando hay conectividad. |

---

## Flujo Clínico en 3 Pasos y Doble Entregable

### Paso 1. Cuéntanos cómo te sientes
- Captura por voz en español (`Web Speech API`) o escritura libre, con registro opcional de signos vitales en casa (`Temperatura`, `SpO2 %`, `Pulso`, `Presión arterial`) y 3 casos de prueba rápida (`Migraña`, `Dolor en el pecho`, `Fiebre y tos`).
- Sanitización local de identificadores sensibles (DPI y teléfonos) antes de procesar la consulta.

### Paso 2. Ayúdame con más información (1 a 3 preguntas dinámicas)
- Identifica qué variables del protocolo **OPQRST** faltaron en el relato inicial y formula únicamente **entre 1 y 3 preguntas puntuales** según la información faltante.
- El paciente puede escucharlas en voz alta, tocar una opción rápida o escribir su propia respuesta.

### Paso 3. Resumen con Alerta de Prioridad y Doble Entregable
- **Banner de Prioridad Clínica:** Ubicado en la parte superior del resumen (ej. *"Consulta prioritaria hoy: Tu oxigenación de 96% es estable; si baja de 92% o tienes dificultad para respirar, acude a urgencias."*).
- **Para el Paciente ("Tu pase de pre-consulta"):** Resumen claro de lo reportado, preguntas sugeridas para hacerle al médico y lista interactiva de preparación.
- **Para el Médico ("Ficha Médica"):** Nota estructurada con selector entre formato **SOAP** e **ISBAR**, signos de alarma (*Red Flags*) y citas textuales del paciente.

---

## Diagramas de Arquitectura

### 1. Flujo Clínico en 3 Pasos y Doble Entregable

![Flujo clínico en 3 pasos y doble entregable](./docs/diagrams/clinical-flow.svg)

### 2. Arquitectura del Sistema (Web + Android + Motores Clínicos)

![Arquitectura híbrida de pre-consulta médica](./docs/diagrams/system-architecture.svg)

---

## Temas para Artículos Técnicos y de Producto

1. **Interrogatorio clínico adaptativo (1 a 3 preguntas) mediante evaluación de brechas semiológicas OPQRST:** Cómo reemplazar formularios médicos estáticos y extensos por un flujo conversacional que analiza el relato libre del paciente e identifica únicamente las variables clínicas faltantes (*Aparición, Provocación, Calidad, Irradiación, Severidad y Tiempo*) antes de entrar a la consulta.
2. **Una sola entrevista, dos lenguajes — Generación simultánea del Pase del Paciente y la Ficha Médica (`SOAP` / `ISBAR`):** Diseño de esquemas estructurados que transforman una misma captura clínica en dos entregables complementarios: una guía en lenguaje claro con alerta de prioridad visible para el paciente y una nota médica estandarizada con signos de alarma y citas textuales para el médico.
3. **Privacidad desde la captura en aplicaciones web de salud — Sanitización local de PII antes de invocar la nube:** Patrones prácticos para anonimizar identificadores personales (números de documento y teléfonos) directamente en el navegador y combinar dictado por voz en español con modelos generativos en la nube sin exponer datos sensibles.
4. **Validación determinista de esquemas JSON clínicos (`responseSchema` + motor heurístico de respaldo libre de alucinaciones):** Implementación en TypeScript de contratos estrictos de salida para notas `SOAP`, `ISBAR` y `OPQRST` con degradación automática a reglas clínicas deterministas ante latencia o fallos de red.
5. **Arquitectura de voz bidireccional en el navegador (`SpeechRecognition` y `speechSynthesis`) con manejo de estados asíncronos en Next.js App Router:** Cómo gestionar buffers de transcripción continua en español (`es-GT`), lectura por voz de preguntas de seguimiento y compatibilidad multi-navegador sin librerías externas pesadas.
6. **Pipeline de redacción regex en memoria (*Zero-Trust Client Redaction*) previo a la serialización HTTP:** Diseño de filtros deterministas en el cliente que interceptan y enmascaran identificadores sensibles (`DPI`, teléfonos y correos) antes de construir el cuerpo JSON enviado a la ruta serverless `/api/telemed`.

---

## Inicio Rápido Local

```bash
git clone https://github.com/ykro/telemed-preconsult-ai.git
cd telemed-preconsult-ai
npm install
cp .env.example .env.local # Agrega tu GEMINI_API_KEY
npm run dev
```
