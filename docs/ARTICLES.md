# Temas para Artículos Técnicos y de Producto: PreConsulta (`telemed-preconsult-ai`)

Selección de 6 temas (3 de producto/dominio clínico y 3 de ingeniería de software) derivados del desarrollo de **PreConsulta**.

---

## Producto y Dominio Clínico

### 1. Interrogatorio clínico adaptativo (1 a 3 preguntas) mediante evaluación de brechas semiológicas OPQRST
Cómo reemplazar formularios médicos estáticos y extensos por un flujo conversacional que analiza el relato libre del paciente e identifica únicamente las variables clínicas faltantes (*Aparición, Provocación, Calidad, Irradiación, Severidad y Tiempo*) antes de entrar a la consulta.

### 2. Una sola entrevista, dos lenguajes — Generación simultánea del Pase del Paciente y la Ficha Médica (`SOAP` / `ISBAR`)
Diseño de esquemas estructurados que transforman una misma captura clínica en dos entregables complementarios: una guía en lenguaje claro con alerta de prioridad visible para el paciente y una nota médica estandarizada con signos de alarma y citas textuales para el médico.

### 3. Privacidad desde la captura en aplicaciones web de salud — Sanitización local de PII antes de invocar la nube
Patrones prácticos para anonimizar identificadores personales (números de documento y teléfonos) directamente en el navegador y combinar dictado por voz en español con modelos generativos en la nube sin exponer datos sensibles.

---

## Ingeniería de Software

### 4. Validación determinista de esquemas JSON clínicos (`responseSchema` + motor heurístico de respaldo libre de alucinaciones)
Implementación en TypeScript de contratos estrictos de salida para notas `SOAP`, `ISBAR` y `OPQRST` con degradación automática a reglas clínicas deterministas ante latencia o fallos de red.

### 5. Arquitectura de voz bidireccional en el navegador (`SpeechRecognition` y `speechSynthesis`) con manejo de estados asíncronos en Next.js App Router
Cómo gestionar buffers de transcripción continua en español (`es-GT`), lectura por voz de preguntas de seguimiento y compatibilidad multi-navegador sin librerías externas pesadas.

### 6. Pipeline de redacción regex en memoria (*Zero-Trust Client Redaction*) previo a la serialización HTTP
Diseño de filtros deterministas en el cliente que interceptan y enmascaran identificadores sensibles (`DPI`, teléfonos y correos) antes de construir el cuerpo JSON enviado a la ruta serverless `/api/telemed`.
