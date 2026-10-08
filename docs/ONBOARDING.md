# 🚀 Guía de Onboarding: Telemed Pre-Consult AI (`telemed-preconsult-ai`)

Bienvenido a la guía oficial de **Onboarding Técnico y Clínico** para **Telemed Pre-Consult AI**. Este documento está diseñado tanto para **ingenieros de software** que deseen levantar, extender o auditar el proyecto localmente, como para **médicos evaluadores y testers clínicos** que validen la precisión del triaje OPQRST, la anonimización de PII y el Doble Entregable (Pase del Paciente + Ficha SOAP/ISBAR).

> 🌐 **Producción en Vivo (Vercel):** [https://telemed-preconsult-ai.vercel.app](https://telemed-preconsult-ai.vercel.app)  
> 📱 **App Android Nativa Complementaria:** [`ykro/telemed-preconsult-android`](https://github.com/ykro/telemed-preconsult-android)  
> 🏗️ **Arquitectura Detallada:** [Ver `docs/ARCHITECTURE.md`](./ARCHITECTURE.md) · [Ver `SPEC.md`](../SPEC.md)

---

## 1. Prerrequisitos del Entorno

Para ejecutar el proyecto en tu máquina local necesitas:

| Componente | Requisito Mínimo | Notas Clínicas / Técnicas |
| :--- | :--- | :--- |
| **Node.js** | `v20.x` o `v22.x` LTS | Requerido para Next.js 15 (App Router) y React 19. |
| **Gestor de paquetes** | `npm >= 10.x` | Usa `package-lock.json` incluido en el repositorio. |
| **Navegador Web** | Google Chrome, Edge o Safari | Requerido para soporte nativo de `SpeechRecognition` (`webkitSpeechRecognition`) y `speechSynthesis`. |
| **API Key de Google AI** | `GEMINI_API_KEY` | Opcional en modo demo offline (cuenta con motor determinístico de respaldo), pero requerida para inferencia en vivo con `gemini-3.8-flash` y `gemma-4-26b-a4b-it`. |

---

## 2. Instalación Local Paso a Paso

### 2.1 Clonar el repositorio e instalar dependencias

```bash
git clone https://github.com/ykro/telemed-preconsult-ai.git
cd telemed-preconsult-ai
npm install
```

### 2.2 Configurar variables de entorno (`.env.local`)

Copia el archivo de ejemplo `.env.example` hacia `.env.local` y agrega tu clave de Google Generative Language API:

```bash
cp .env.example .env.local
```

Edita `.env.local`:

```ini
# Clave de API de Google AI Studio / Vertex AI para Gemini 3.8 Flash y Gemma 4
GEMINI_API_KEY="AIzaSyTuClaveDeApiAqui..."
```

> 💡 **Resiliencia Zero-Downtime:** Si ejecutas el proyecto sin `GEMINI_API_KEY` o sin conexión a internet, el endpoint `/api/telemed` activará automáticamente el motor determinístico de respaldo (`src/lib/clinical-engine.ts`), permitiéndote probar el flujo completo sin interrupciones.

### 2.3 Ejecutar el servidor de desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador. Para verificar el build de producción localmente:

```bash
npm run build
npm run start
```

---

## 3. Cómo Funciona el Selector de Arquitectura A/B

En la barra superior de la aplicación encontrarás un **conmutador interactivo de arquitectura en tiempo real** diseñado para el benchmark [`ykro/gemini-argon-agy-benchmark`](https://github.com/ykro/gemini-argon-agy-benchmark):

### ⚡ `Variante A: Gemini 3.8 Flash Directo` (Monolithic Cloud)
- **Cómo opera:** Envía la transcripción original directamente a `models/gemini-3.8-flash` en la nube tanto en el Paso 2 (generación de las 3 preguntas OPQRST) como en el Paso 3 (Doble Entregable con `responseMimeType: "application/json"`).
- **Privacidad PII:** No aplica redacción local previa (`piiRedactedCount = 0`). La barra de telemetría muestra una alerta ámbar indicando cuántos datos sensibles (DPI, NIT, teléfono, nombre propio) fueron detectados en el texto sin anonimizar.
- **Caso de uso ideal:** Comparativa base (*baseline*) de latencia y comportamiento monolítico en la nube.

### 🛡️ `Variante B: Cascada Gemma 4 + Gemini 3.8 Flash` (Edge-Assisted Cascade — Predeterminada)
- **Cómo opera:**
  1. **Capa 1 (Privacidad Edge):** Ejecuta `redactPiiLocally()` en cliente y servidor antes de cualquier llamada externa, reemplazando DPI guatemalteco, NIT, teléfonos, correos y nombres propios por tokens seguros (`[DPI-PROTEGIDO]`, `[NIT-PROTEGIDO]`, `[TEL-PROTEGIDO]`, `[PACIENTE-ANONIMIZADO]`).
  2. **Capa 2 (Interrogatorio OPQRST con Gemma 4):** Invoca el modelo compacto `models/gemma-4-26b-a4b-it` (arquitectura Gemma 4 E2B/MoE) sobre el texto sanitizado para identificar los huecos clínicos OPQRST y disparar las **3 preguntas de seguimiento**.
  3. **Capa 3 (Síntesis Clínica Dual con Gemini 3.8 Flash):** Combina el relato anonimizado + las 3 respuestas OPQRST e invoca `models/gemini-3.8-flash` para estructurar simultáneamente el **Pase del Paciente** y la **Ficha SOAP / ISBAR con Evidence Tracing**.
- **Telemetría en Vivo:** La sub-barra superior reporta en milisegundos (`latencyMs`) el tiempo de respuesta, el modelo activo y el conteo exacto de entidades PII protegidas.

---

## 4. Guía de Prueba de los 3 Escenarios Clínicos

Para facilitar la validación clínica sin necesidad de dictar por micrófono en cada prueba, la interfaz incluye **3 Casos Clínicos Pre-Cargados de 1 Clic** (además del soporte completo de micrófono en vivo en `es-GT`, `es-MX` y `es-ES`):

### 🧠 Caso 1: Migraña Aguda con Fotofobia (`Triaje AMARILLO`)
1. Haz clic en la tarjeta **"Caso 1: Migraña Aguda con Fotofobia"** (Mujer, 31 años · Zona 10, Ciudad de Guatemala, 148 palabras/min).
2. Activa el botón **"Ver vista previa con PII anonimizado"** para comprobar cómo `Andrea Morales`, el DPI `2456 78901 0101` y el teléfono `5544-3322` son enmascarados automáticamente en la Variante B.
3. Presiona **"Analizar Relato y Generar 3 Preguntas OPQRST"**.
4. Responde las 3 preguntas dirigidas (inicio súbito vs. gradual, síntomas visuales/vómito, alergias a AINEs) con un clic en los chips rápidos o usando el botón **"Dictar"**.
5. Presiona **"Generar Pase del Paciente + Ficha SOAP / ISBAR"** y verifica las citas textuales en la sección **Evidence Tracing**.

### 🚨 Caso 2: Dolor Torácico Opresivo — Alerta Red Flag (`Triaje ROJO`)
1. Selecciona **"Caso 2: Dolor Torácico Opresivo (Alerta Red Flag)"** (Hombre, 54 años · Mixco, Guatemala, 162 palabras/min).
2. Observa la detección de NIT guatemalteco (`4589123-K`), teléfono y antecedente de hipertensión con omisión matutina de losartán.
3. Genera las 3 preguntas OPQRST (enfocadas en dolor en reposo, cortejo vegetativo/síncope y uso de aspirina).
4. Genera el Doble Entregable y verifica:
   - El **Semáforo ROJO pulsante** de emergencia inmediata.
   - En el **Pase del Paciente**: instrucción crítica de **NO conducir por cuenta propia** y acudir a urgencias para ECG de 12 derivaciones en `< 10 minutos`.
   - En la **Ficha Médica**: alerta de *Síndrome Coronario Agudo (SCA) a descartar* y cambio instantáneo entre vista **SOAP** e **ISBAR**.

### 🌡️ Caso 3: Infección Respiratoria y Fiebre Persistente (`Triaje AMARILLO`)
1. Selecciona **"Caso 3: Infección Respiratoria y Fiebre Persistente"** (Paciente, 28 años · Antigua Guatemala, 136 palabras/min).
2. Evalúa cómo el sistema interpreta signos vitales domiciliarios reportados verbalmente (`38.8 °C` y oximetría de pulso `96%`).
3. Genera las preguntas de seguimiento (disnea al caminar, tolerancia a la vía oral/hidratación, alergia a penicilina).
4. En el Paso 3, alterna el selector de moneda entre **`GTQ (Q)`** y **`USD ($)`** en la barra superior para verificar la actualización dinámica del costo estimado de copago y panel respiratorio.

---

## 5. Despliegue Continuo (CI/CD) con Vercel

El proyecto está vinculado y desplegado en producción sobre **Vercel** en:
👉 **[https://telemed-preconsult-ai.vercel.app](https://telemed-preconsult-ai.vercel.app)**

### Flujo de Auto-Deploy
1. **Rama de Producción (`main`):** Cada `git push origin main` dispara automáticamente el pipeline de compilación de Vercel (`next build`), validando tipos de TypeScript (`tsconfig.json`) y empaquetando las rutas estáticas y la función Serverless `/api/telemed`.
2. **Ramas de Benchmark (`benchmark/argon-v1`):** Generan *Preview Deployments* inmutables para auditoría comparativa entre modelos.
3. **Variables de Entorno en Producción:** `GEMINI_API_KEY` está inyectada de forma cifrada en el entorno de Producción y Preview de Vercel.
4. **Despliegue Manual desde CLI (Opcional):**
   ```bash
   npx vercel --prod
   ```
