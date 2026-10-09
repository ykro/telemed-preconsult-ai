# Guía de Onboarding: PreConsulta (`telemed-preconsult-ai`)

Bienvenido a la guía oficial de **Onboarding Técnico y Clínico** para **PreConsulta (`telemed-preconsult-ai`)**. Este documento está diseñado tanto para **ingenieros de software** que deseen levantar, extender o auditar el proyecto localmente, como para **médicos evaluadores** que validen el interrogatorio dinámico OPQRST (1 a 3 preguntas), la anonimización de PII y el Doble Entregable (Pase del Paciente + Ficha SOAP/ISBAR).

> **Producción en Vivo (Vercel):** [https://telemed-preconsult-ai.vercel.app](https://telemed-preconsult-ai.vercel.app)  
> **App Android Nativa Complementaria:** [`ykro/telemed-preconsult-android`](https://github.com/ykro/telemed-preconsult-android)  
> **Arquitectura Detallada:** [Ver `docs/ARCHITECTURE.md`](./ARCHITECTURE.md) · [Ver `SPEC.md`](../SPEC.md)

---

## 1. Prerrequisitos del Entorno

Para ejecutar el proyecto en tu máquina local necesitas:

| Componente | Requisito Mínimo | Notas Clínicas / Técnicas |
| :--- | :--- | :--- |
| **Node.js** | `v20.x` o `v22.x` LTS | Requerido para Next.js 15 (App Router) y React 19. |
| **Gestor de paquetes** | `npm >= 10.x` | Usa `package-lock.json` incluido en el repositorio. |
| **Navegador Web** | Google Chrome, Edge o Safari | Requerido para soporte nativo de `SpeechRecognition` (`webkitSpeechRecognition`) y `speechSynthesis`. |
| **API Key de Google AI** | `GEMINI_API_KEY` | Opcional en modo demo local (cuenta con motor determinístico de respaldo), requerida para inferencia en vivo con `gemini-3.8-flash` y `gemma-4-26b-a4b-it`. |

---

## 2. Instalación Local Paso a Paso

### 2.1 Clonar el repositorio e instalar dependencias

```bash
git clone https://github.com/ykro/telemed-preconsult-ai.git
cd telemed-preconsult-ai
npm install
```

### 2.2 Configurar variables de entorno (`.env.local`)

Copia el archivo `.env.example` hacia `.env.local` y agrega tu clave de Google Generative Language API:

```bash
cp .env.example .env.local
```

Edita `.env.local`:

```ini
GEMINI_API_KEY="AIzaSyTuClaveDeApiAqui..."
```

> **Resiliencia Zero-Downtime:** Si ejecutas el proyecto sin `GEMINI_API_KEY` o sin conexión a internet, el endpoint `/api/telemed` activará automáticamente el motor determinístico de respaldo (`src/lib/clinical-engine.ts`), permitiéndote probar el flujo completo sin interrupciones.

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

## 3. Guía de Prueba de los 3 Escenarios Clínicos

Para facilitar la validación clínica sin necesidad de dictar por micrófono en cada prueba, el Paso 1 (**"Cuéntanos cómo te sientes"**) incluye **3 Casos de Ejemplo de 1 Clic** debajo del cuadro de texto:

### Caso 1: Migraña (`Triaje AMARILLO` — 3 preguntas de seguimiento)
1. En **1. Síntomas**, haz clic en la píldora **"Migraña"** y presiona **"Continuar"**.
2. En **2. Preguntas ("Ayúdame con más información")**, observa las 3 preguntas dirigidas sobre inicio del dolor/síntomas visuales, tolerancia oral/movimiento y antecedentes/alergias a AINEs.
3. Presiona **"Ver mi resumen"** para abrir el Paso 3 y verificar el banner superior de prioridad ámbar (`NIVEL DE PRIORIDAD CLÍNICA · CONSULTA PRIORITARIA HOY`) junto con el pase del paciente y la ficha SOAP / ISBAR.

### Caso 2: Dolor en el pecho (`Triaje ROJO` — 3 preguntas de seguimiento)
1. En **1. Síntomas**, selecciona **"Dolor en el pecho"** y presiona **"Continuar"**.
2. En **"Ayúdame con más información"**, revisa o ajusta las respuestas sobre intensidad en reposo, cortejo vegetativo y alergias/antecedentes cardíacos.
3. Presiona **"Ver mi resumen"** y verifica:
   - El **Banner Hero Rojo** en la parte superior (`NIVEL DE PRIORIDAD CLÍNICA · ATENCIÓN URGENTE INMEDIATA`) indicando valoración presencial urgente con electrocardiograma.
   - En la pestaña **Ficha Médica (SOAP / ISBAR)**, revisa las alertas clínicas (*Red Flags*), la síntesis OPQRST y las citas textuales del paciente.

### Caso 3: Fiebre y tos (`Triaje AMARILLO` — 2 preguntas de seguimiento)
1. En **1. Síntomas**, selecciona **"Fiebre y tos"** y presiona **"Continuar"**.
2. Como el relato inicial ya especifica evolución de 3 días, fiebre de `38.8 °C` y oximetría de `96%`, la sección **"Ayúdame con más información"** genera únicamente **2 preguntas puntuales** (hidratación/respuesta de la fiebre y medicamentos/alergias).
3. Presiona **"Ver mi resumen"** y comprueba que en la parte superior sobresale de forma inmediata el llamado de prioridad clínica:
   > **NIVEL DE PRIORIDAD CLÍNICA · CONSULTA PRIORITARIA HOY**  
   > *"Consulta prioritaria hoy: Tu oxigenación de 96% es estable; si baja de 92% o tienes dificultad para respirar, acude a urgencias."*

---

## 4. Despliegue Continuo (CI/CD) con Vercel

El proyecto está desplegado en producción sobre **Vercel** en:
**[https://telemed-preconsult-ai.vercel.app](https://telemed-preconsult-ai.vercel.app)**

1. **Rama de Producción (`main`):** Cada `git push origin main` dispara automáticamente la compilación de Vercel (`next build`), validando tipos de TypeScript (`tsconfig.json`) y empaquetando las rutas estáticas y la función Serverless `/api/telemed`.
2. **Variables de Entorno en Producción:** `GEMINI_API_KEY` se configura en el entorno de Producción de Vercel.
