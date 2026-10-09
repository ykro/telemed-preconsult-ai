import {
  DemoPatientCase,
  DoctorDeliverable,
  EvidenceQuote,
  FollowUpAnswer,
  FollowUpQuestion,
  PatientDeliverable,
} from '@/types/telemed';

export const DEMO_PATIENT_CASES: DemoPatientCase[] = [
  {
    id: 'migraine',
    label: 'Migraña',
    transcript:
      'Desde hace cuatro horas me empezó un dolor de cabeza muy fuerte en el lado derecho, detrás del ojo, como un latido constante. Me duele 8 de 10 y me molesta mucho la luz de las pantallas. Hace dos horas tomé acetaminofén de 500 mg sin mejora y tengo un poco de náuseas.',
  },
  {
    id: 'chest-pain',
    label: 'Dolor en el pecho',
    transcript:
      'Hace unos cuarenta minutos, al subir las gradas, sentí una presión fuerte en el centro del pecho que se corre hacia el brazo izquierdo y la mandíbula. Estoy sudando frío y siento que me falta un poco el aire al hablar. Padezco de presión alta y hoy olvidé tomar mi losartán.',
  },
  {
    id: 'fever-cough',
    label: 'Fiebre y tos',
    transcript:
      'Llevo tres días con fiebre de 38.8 por las noches, dolor de garganta al tragar y tos con flema. Siento dolor de cuerpo generalizado, pero respiro bien en reposo y mi oxímetro en casa marca 96%.',
  },
];

export interface PiiRedactionResult {
  redactedText: string;
  piiRedactedCount: number;
}

export function redactPiiLocally(rawText: string): PiiRedactionResult {
  let redactedText = rawText;
  let piiRedactedCount = 0;

  const dpiRegex = /\b\d{4}[\s-]?\d{5}[\s-]?\d{4}\b/g;
  redactedText = redactedText.replace(dpiRegex, () => {
    piiRedactedCount += 1;
    return '[ID-PROTEGIDO]';
  });

  const phoneRegex = /\b(?:\+?502[\s-]?)?\d{4}[\s-]\d{4}\b/g;
  redactedText = redactedText.replace(phoneRegex, () => {
    piiRedactedCount += 1;
    return '[TEL-PROTEGIDO]';
  });

  const nameIntroRegex =
    /\b(mi nombre es|me llamo|soy)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,2})/g;
  redactedText = redactedText.replace(nameIntroRegex, (_full, prefix) => {
    piiRedactedCount += 1;
    return `${prefix} [PACIENTE]`;
  });

  return { redactedText, piiRedactedCount };
}

export function buildDeterministicFollowUps(
  transcript: string
): FollowUpQuestion[] {
  const lower = transcript.toLowerCase();

  if (
    lower.includes('pecho') ||
    lower.includes('brazo izquierdo') ||
    lower.includes('mandíbula') ||
    lower.includes('losartán')
  ) {
    return [
      {
        id: 1,
        question:
          '¿Qué tan intensa es la presión en el pecho del 1 al 10 y disminuye al estar sentado en reposo?',
        quick_options: [
          'Es muy fuerte (9/10) y no mejora en reposo',
          'Es moderada (6/10) y disminuye al descansar',
          'Aparece y desaparece por momentos',
        ],
      },
      {
        id: 2,
        question:
          '¿Has sentido mareo intenso, sensación de desmayo o palpitaciones rápidas?',
        quick_options: [
          'Sí, mareo y palpitaciones',
          'Solo sudor frío y falta de aire',
          'No he sentido mareo ni desmayo',
        ],
      },
      {
        id: 3,
        question:
          '¿Eres alérgico a algún medicamento o has tenido problemas cardíacos antes?',
        quick_options: [
          'Sin alergias ni antecedentes cardíacos previos',
          'Tomé aspirina hoy; no tengo alergias',
          'Sí tengo alergia a medicamentos',
        ],
      },
    ];
  }

  if (
    lower.includes('calentura') ||
    lower.includes('fiebre') ||
    lower.includes('garganta') ||
    lower.includes('tos')
  ) {
    return [
      {
        id: 1,
        question:
          '¿Sientes dolor en el pecho al respirar profundo o fatiga al caminar pocos pasos?',
        quick_options: [
          'Solo fatiga leve al caminar',
          'Siento molestia al toser fuerte',
          'Respiro sin dolor en el pecho',
        ],
      },
      {
        id: 2,
        question:
          '¿Has podido tomar líquidos hoy y la fiebre baja cuando tomas medicamento?',
        quick_options: [
          'Tomo líquidos con molestia; la fiebre cede con paracetamol',
          'Me cuesta mucho tragar líquidos hoy',
          'Me hidrato bien y la fiebre es solo nocturna',
        ],
      },
      {
        id: 3,
        question:
          '¿Qué medicamentos has tomado en estos días o tienes alergia a alguno?',
        quick_options: [
          'Solo paracetamol; sin alergias conocidas',
          'Antigripal de farmacia; sin alergias',
          'Soy alérgico a la penicilina / antibióticos',
        ],
      },
    ];
  }

  return [
    {
      id: 1,
      question:
        '¿El dolor inició de forma gradual o súbita, y has notado vista borrosa o dificultad para hablar?',
      quick_options: [
        'Subió poco a poco; sin problemas para hablar',
        'Inició rápido y veo algunos destellos de luz',
        'Fue gradual, solo molestia a la luz',
      ],
    },
    {
      id: 2,
      question:
        '¿El dolor empeora al caminar o mover la cabeza, o has tenido vómito o fiebre?',
      quick_options: [
        'Empeora con el movimiento y la luz; sin vómito ni fiebre',
        'He vomitado hoy y me molesta el ruido',
        'Se mantiene estable en reposo; sin fiebre',
      ],
    },
    {
      id: 3,
      question:
        '¿Has tenido migrañas antes o eres alérgico a algún analgésico (como ibuprofeno o aspirina)?',
      quick_options: [
        'He tenido episodios similares antes; sin alergias',
        'Es la primera vez que me pasa; sin alergias',
        'Soy alérgico a antiinflamatorios (AINEs)',
      ],
    },
  ];
}

function extractSentencesFromTranscript(transcript: string): string[] {
  return transcript
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);
}

export function buildDeterministicDeliverables(
  transcript: string,
  followUpAnswers: FollowUpAnswer[]
): {
  patient_deliverable: PatientDeliverable;
  doctor_deliverable: DoctorDeliverable;
} {
  const lower = transcript.toLowerCase();
  const sentences = extractSentencesFromTranscript(transcript);
  const firstQuote = sentences[0] || transcript.slice(0, 140).trim();
  const secondQuote = sentences[1] || sentences[sentences.length - 1] || firstQuote;

  const a1 = followUpAnswers[0]?.answer || 'Confirmado en preguntas de seguimiento';
  const a2 = followUpAnswers[1]?.answer || 'Sin otros síntomas agregados';
  const a3 = followUpAnswers[2]?.answer || 'Sin alergias medicamentosas reportadas';

  const evidenceQuotes: EvidenceQuote[] = [
    {
      fact: 'Síntoma principal y evolución inicial',
      quote: firstQuote,
      source: 'Relato inicial',
    },
    ...(secondQuote !== firstQuote
      ? [
          {
            fact: 'Contexto adicional mencionado',
            quote: secondQuote,
            source: 'Relato inicial',
          },
        ]
      : []),
    ...followUpAnswers.map((ans, idx) => ({
      fact: `Seguimiento #${idx + 1}`,
      quote: ans.answer,
      source: 'Preguntas rápidas',
    })),
  ];

  if (
    lower.includes('pecho') ||
    lower.includes('brazo izquierdo') ||
    lower.includes('mandíbula') ||
    lower.includes('losartán')
  ) {
    return {
      patient_deliverable: {
        friendly_summary:
          'Reportaste presión en el centro del pecho iniciada hace 40 minutos tras subir gradas, que se irradia al brazo izquierdo y mandíbula, con sudoración fría, falta de aire y antecedente de hipertensión arterial.',
        questions_to_ask_doctor: [
          '¿Debo acudir de inmediato al servicio de urgencias más cercano para un electrocardiograma?',
          '¿Puedo masticar una aspirina mientras me trasladan a evaluación presencial?',
          '¿Qué debo hacer respecto a la dosis de losartán que olvidé tomar hoy?',
        ],
        prep_checklist: [
          'Permanece sentado en reposo absoluto y no conduzcas por tu cuenta',
          'Ten a la mano el envase de tu medicamento para la presión (losartán)',
          'Pide a un familiar o acompañante que esté contigo en este momento',
        ],
        urgency_notice:
          'Atención prioritaria inmediata: Por las características del dolor en el pecho, se recomienda valoración presencial urgente con electrocardiograma.',
      },
      doctor_deliverable: {
        triage_level: 'ROJO',
        red_flags: [
          'Dolor torácico opresivo retroesternal de 40 min desencadenado por esfuerzo',
          'Irradiación a miembro superior izquierdo y mandíbula con diaforesis y disnea',
          'Antecedente de HTA con omisión de dosis matutina de losartán',
        ],
        opqrst: {
          onset: 'Hace 40 minutos al subir gradas',
          provocation: `Esfuerzo físico; ${a1}`,
          quality: 'Opresivo retroesternal',
          radiation: 'Brazo izquierdo y región mandibular',
          severity: a1,
          time: '40 minutos continuos',
        },
        soap: {
          subjective: `Paciente con antecedente de HTA refiere dolor torácico opresivo de 40 minutos de evolución iniciado tras esfuerzo, irradiado a brazo izquierdo y mandíbula, acompañado de diaforesis fría y disnea. Seguimiento: "${a1}", "${a2}", "${a3}".`,
          objective:
            'Disnea al hablar reportada en entrevista inicial. Pendiente toma inmediata de signos vitales, SpO2 y ECG de 12 derivaciones.',
          assessment:
            'Síndrome coronario agudo a descartar de forma prioritaria.',
          plan: 'Derivación inmediata a urgencias presenciales para ECG en <10 min, enzimas cardíacas y monitorización.',
        },
        isbar: {
          identification: 'Paciente adulto con HTA en pre-consulta por dolor torácico agudo.',
          situation:
            'Dolor torácico opresivo de 40 min con irradiación típica y cortejo vegetativo.',
          background: `HTA en tratamiento con losartán (omitido hoy). ${a3}.`,
          assessment: `Alta sospecha de evento coronario agudo (${a1}).`,
          recommendation:
            'Referir de inmediato a sala de urgencias con protocolo de dolor torácico.',
        },
        evidence_quotes: evidenceQuotes,
      },
    };
  }

  if (
    lower.includes('calentura') ||
    lower.includes('fiebre') ||
    lower.includes('garganta') ||
    lower.includes('tos')
  ) {
    return {
      patient_deliverable: {
        friendly_summary:
          'Reportaste 3 días de fiebre nocturna de hasta 38.8 °C, dolor de garganta al tragar, tos con flema y dolor muscular generalizado, manteniendo una saturación de oxígeno de 96% en reposo.',
        questions_to_ask_doctor: [
          '¿Mis síntomas sugieren una infección viral o necesito alguna prueba antes de considerar antibióticos?',
          '¿Qué esquema de analgésico o antiinflamatorio me recomienda para aliviar el dolor al tragar y controlar la fiebre?',
          '¿Qué signos respiratorios indicarían que debo acudir a una revisión presencial?',
        ],
        prep_checklist: [
          'Ten a la mano tu termómetro y oxímetro de pulso durante la consulta',
          'Ubícate en un lugar con buena luz por si el médico revisa tu garganta por cámara',
          'Ten cerca un vaso con agua e identifica qué medicamentos has tomado hoy',
        ],
        urgency_notice:
          'Consulta prioritaria hoy: Tu oxigenación de 96% es estable; si baja de 92% o tienes dificultad para respirar, acude a urgencias.',
      },
      doctor_deliverable: {
        triage_level: 'AMARILLO',
        red_flags: [
          'Fiebre persistente de 38.8 °C por 72 horas con odinofagia marcada',
        ],
        opqrst: {
          onset: 'Hace 3 días',
          provocation: `Deglución y predominio nocturno; ${a1}`,
          quality: 'Odinofagia, tos productiva y mialgias',
          radiation: 'Faringe y malestar muscular generalizado',
          severity: `Fiebre de 38.8 °C, SpO2 96%; ${a2}`,
          time: '72 horas de evolución',
        },
        soap: {
          subjective: `Cuadro de 72 horas con fiebre nocturna hasta 38.8 °C, odinofagia, tos productiva y mialgias. Niega disnea en reposo (SpO2 96%). Seguimiento: "${a1}", "${a2}", "${a3}".`,
          objective:
            'Voz clara sin taquipnea audible. Autocontrol domiciliario: T° 38.8 °C y SpO2 96%.',
          assessment:
            'Infección respiratoria aguda superior (faringoamigdalitis aguda viral vs. bacteriana).',
          plan: 'Inspección faríngea por videollamada, evaluar criterios de Centor, ajuste antipirético/analgésico e hidratación.',
        },
        isbar: {
          identification: 'Paciente en pre-consulta por síndrome febril y respiratorio de 3 días.',
          situation: 'Fiebre de 38.8 °C, odinofagia y tos productiva con SpO2 96%.',
          background: `${a3}. Evolución e hidratación: ${a2}.`,
          assessment: 'Infección respiratoria alta hemodinámicamente estable.',
          recommendation:
            'Valoración en teleconsulta para definir manejo sintomático vs. prueba rápida.',
        },
        evidence_quotes: evidenceQuotes,
      },
    };
  }

  return {
    patient_deliverable: {
      friendly_summary:
        'Reportaste un dolor de cabeza pulsátil en el lado derecho y detrás del ojo que inició hace 4 horas (intensidad 8/10), acompañado de molestia a la luz y náuseas leves, sin alivio tras tomar acetaminofén hace 2 horas.',
      questions_to_ask_doctor: [
        '¿Qué medicamento específico puedo tomar hoy dado que el acetaminofén no alivió el dolor?',
        '¿Estos síntomas corresponden a una migraña aguda o necesito algún estudio adicional?',
        '¿Qué señales de alarma deberían hacerme acudir a urgencias?',
      ],
      prep_checklist: [
        'Ubícate en una habitación tranquila con luz tenue y baja el brillo de tu pantalla',
        'Ten a la mano el envase del medicamento que tomaste hace 2 horas',
        'Ten un vaso con agua cerca para hidratarte',
      ],
      urgency_notice:
        'Prioridad media-alta: Si notas debilidad en un brazo, dificultad para hablar o fiebre alta, acude a urgencias de inmediato.',
    },
    doctor_deliverable: {
      triage_level: 'AMARILLO',
      red_flags: [
        'Cefalea hemicraneal aguda severa (8/10) con fotofobia marcada',
        'Sin respuesta clínica a acetaminofén 500 mg hace 2 horas',
      ],
      opqrst: {
        onset: `Hace 4 horas; ${a1}`,
        provocation: `Exposición a la luz y pantallas; ${a2}`,
        quality: 'Pulsátil',
        radiation: 'Hemicraneal derecho y retroocular',
        severity: '8/10',
        time: '4 horas continuas',
      },
      soap: {
        subjective: `Cefalea hemicraneal derecha y retroocular pulsátil 8/10 de 4 horas de evolución, con fotofobia y náuseas leves. Sin mejora tras acetaminofén 500 mg hace 2h. Seguimiento: "${a1}", "${a2}", "${a3}".`,
        objective:
          'Orientado en relato por voz, lenguaje fluido sin disartria audible. Intolerancia referida a la luz.',
        assessment:
          'Crisis migrañosa aguda moderada-severa refractaria a paracetamol; descartar signos de alarma neurológicos.',
        plan: 'Tamizaje neurológico visual por cámara, ajuste de analgesia abortiva específica + antiemético y reposo en oscuridad.',
      },
      isbar: {
        identification: 'Paciente en pre-consulta por cefalea aguda 8/10.',
        situation:
          'Cefalea hemicraneal derecha de 4 horas con fotofobia y náuseas.',
        background: `Falla a acetaminofén 500 mg hace 2 horas. ${a3}.`,
        assessment: `Compatible con crisis de migraña aguda sin déficit motor reportado (${a1}).`,
        recommendation:
          'Valoración médica prioritaria hoy para tratamiento abortivo y signos de alarma.',
      },
      evidence_quotes: evidenceQuotes,
    },
  };
}
