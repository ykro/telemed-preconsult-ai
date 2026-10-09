# Especificación del Proyecto: PreConsulta (`telemed-preconsult-ai`)

**Objetivo:** Construir una **PWA Mobile-First** de pre-consulta médica por voz que escuche el relato del paciente, realice **entre 1 y 3 preguntas breves de seguimiento** bajo la sección **"Ayúdame con más información"**, y genere tanto la ficha clínica para el médico (**SOAP / ISBAR**) como un **Pase de Pre-Consulta para el Paciente** encabezado por una alerta de prioridad clínica de alta visibilidad.

---

## 1. Plataforma: PWA Mobile-First + Cliente Android Nativo

| Criterio | Web Adaptada a Móvil / **PWA (`telemed-preconsult-ai`)** | Android Nativa (`telemed-preconsult-android`) |
| :--- | :--- | :--- |
| **Fricción para el Paciente** | **Cero fricción:** El paciente abre un enlace antes de su cita sin instalar paquetes pesados y puede instalarla en pantalla de inicio como PWA. | Ideal para tabletas clínicas, quioscos comunitarios y operación en campo con soporte offline. |
| **Soporte de Voz** | **Web Speech API (`webkitSpeechRecognition` + `speechSynthesis`)** en navegadores móviles y de escritorio. | `RecognizerIntent` y `TextToSpeech` nativos de Android. |
| **Velocidad de Despliegue** | Un solo codebase para la vista del paciente y la ficha médica, desplegado continuamente en **Vercel**. | Repositorio nativo compañero sincronizado con el mismo contrato JSON. |
| **Inferencia Híbrida** | Redacción local de PII + `gemma-4-26b-a4b-it` + `gemini-3.8-flash` + motor determinístico local. | Conexión al endpoint productivo + motor local offline en dispositivo. |

---

## 2. Flujo de Usuario y Alcance Funcional

![Flujo clínico en 3 pasos y doble entregable](./docs/diagrams/clinical-flow.svg)

### Paso 1: Cuéntanos cómo te sientes (Captura de Voz y Texto)
- Usa `window.SpeechRecognition` / `webkitSpeechRecognition` con `continuous = true` e `interimResults = true` para transcribir en tiempo real mientras el paciente relata sus síntomas.
- Ofrece 3 casos clínicos de ejemplo de un toque (`Migraña`, `Dolor en el pecho`, `Fiebre y tos`).

### Paso 2: Ayúdame con más información (1 a 3 Preguntas de Seguimiento OPQRST)
Antes de generar el resumen final, el modelo evalúa qué elementos del protocolo clínico **OPQRST** faltaron en el relato libre y formula **entre 1 y 3 preguntas cortas y directas (máximo 3)**:
1. Si el relato inicial ya incluye duración, fiebre cuantificada y oximetría (como en el caso de *Fiebre y tos*), genera **2 preguntas focalizadas** (hidratación/respuesta a antipiréticos y medicamentos/alergias).
2. Si faltan más dimensiones semiológicas o signos de alarma (como en *Migraña* o *Dolor en el pecho*), genera **hasta 3 preguntas**.
3. El usuario puede escuchar cada pregunta por voz (`speechSynthesis`), elegir una opción rápida con un toque o escribir su respuesta, y avanzar tan pronto como las preguntas mostradas tengan respuesta.

### Paso 3: Resumen con Banner Hero de Prioridad y Doble Entregable

#### Banner Superior de Prioridad Clínica (Visible en Ambas Vistas)
En la parte superior de la pantalla final se muestra un bloque de alerta de alto contraste con borde izquierdo de `6px`, insignia en mayúsculas (`NIVEL DE PRIORIDAD CLÍNICA · CONSULTA PRIORITARIA HOY` / `ATENCIÓN URGENTE INMEDIATA` / `CONSULTA RUTINARIA`) y tipografía destacada:
- **URGENTE (`ROJO`):** Fondo `#FEF2F2`, borde `#EF4444`, texto `#991B1B`.
- **PRIORITARIA (`AMARILLO`):** Fondo `#FFFBEB`, borde `#F59E0B`, texto `#92400E`.
- **RUTINARIA (`VERDE`):** Fondo `#ECFDF5`, borde `#10B981`, texto `#065F46`.

#### A. Entregable para el Paciente ("Tu pase de pre-consulta")
1. **Lo que reportaste:** Resumen cronológico claro en segunda persona.
2. **Preguntas sugeridas para tu médico:** 3 dudas clave adaptadas al caso clínico.
3. **Qué tener a la mano:** Lista de verificación interactiva previo a la consulta, con opción de imprimir/PDF o compartir.

#### B. Entregable para el Médico (Ficha Médica SOAP / ISBAR)
1. **Conmutador instantáneo SOAP / ISBAR** con botón para copiar nota clínica al portapapeles.
2. **Alertas clínicas (Red Flags)** destacadas en la parte superior.
3. **Síntesis OPQRST** en cuadrícula de 6 dimensiones.
4. **Citas textuales del paciente (*Evidence Tracing*):** Frases literales del relato inicial y del seguimiento.

---

## 3. Esquema JSON Unificado (Médico + Paciente)

```json
{
  "follow_up_questions": [
    {
      "id": 1,
      "question": "¿Has podido tomar líquidos hoy y la fiebre baja cuando tomas algún medicamento?",
      "quick_options": [
        "Tomo líquidos con molestia; la fiebre cede con paracetamol",
        "Me cuesta mucho tragar líquidos hoy",
        "Me hidrato bien y la fiebre es solo nocturna"
      ]
    },
    {
      "id": 2,
      "question": "¿Qué medicamentos has tomado en estos días o tienes alergia a algún antibiótico o analgésico?",
      "quick_options": [
        "Solo paracetamol; sin alergias conocidas",
        "Antigripal de farmacia; sin alergias",
        "Soy alérgico a la penicilina / antibióticos"
      ]
    }
  ],
  "patient_deliverable": {
    "friendly_summary": "Reportaste 3 días de fiebre nocturna de hasta 38.8 °C, dolor de garganta al tragar, tos con flema y dolor muscular generalizado, manteniendo una saturación de oxígeno de 96% en reposo.",
    "questions_to_ask_doctor": [
      "¿Mis síntomas sugieren una infección viral o necesito alguna prueba antes de considerar antibióticos?",
      "¿Qué esquema de analgésico o antiinflamatorio me recomienda para aliviar el dolor al tragar y controlar la fiebre?",
      "¿Qué signos respiratorios indicarían que debo acudir a una revisión presencial?"
    ],
    "prep_checklist": [
      "Ten a la mano tu termómetro y oxímetro de pulso durante la consulta",
      "Ubícate en un lugar con buena luz por si el médico revisa tu garganta por cámara",
      "Ten cerca un vaso con agua e identifica qué medicamentos has tomado hoy"
    ],
    "urgency_notice": "Consulta prioritaria hoy: Tu oxigenación de 96% es estable; si baja de 92% o tienes dificultad para respirar, acude a urgencias."
  },
  "doctor_deliverable": {
    "triage_level": "AMARILLO",
    "red_flags": [
      "Fiebre persistente de 38.8 °C por 72 horas con odinofagia marcada"
    ],
    "opqrst": {
      "onset": "Hace 3 días",
      "provocation": "Deglución y predominio nocturno",
      "quality": "Odinofagia, tos productiva y mialgias",
      "radiation": "Faringe y malestar muscular generalizado",
      "severity": "Fiebre de 38.8 °C, SpO2 96%",
      "time": "72 horas de evolución"
    },
    "soap": {
      "subjective": "Cuadro de 72 horas con fiebre nocturna hasta 38.8 °C, odinofagia, tos productiva y mialgias. Niega disnea en reposo (SpO2 96%).",
      "objective": "Voz clara sin taquipnea audible. Autocontrol domiciliario: T° 38.8 °C y SpO2 96%.",
      "assessment": "Infección respiratoria aguda superior (faringoamigdalitis aguda viral vs. bacteriana).",
      "plan": "Inspección faríngea por videollamada, evaluar criterios de Centor, ajuste antipirético/analgésico e hidratación."
    },
    "isbar": {
      "identification": "Paciente en pre-consulta por síndrome febril y respiratorio de 3 días.",
      "situation": "Fiebre de 38.8 °C, odinofagia y tos productiva con SpO2 96%.",
      "background": "Solo paracetamol; sin alergias conocidas.",
      "assessment": "Infección respiratoria alta hemodinámicamente estable.",
      "recommendation": "Valoración en teleconsulta para definir manejo sintomático vs. prueba rápida."
    },
    "evidence_quotes": [
      {
        "fact": "Síntoma principal y evolución inicial",
        "quote": "Llevo tres días con fiebre de 38.8 por las noches, dolor de garganta al tragar y tos con flema.",
        "source": "Relato inicial"
      }
    ]
  }
}
```
