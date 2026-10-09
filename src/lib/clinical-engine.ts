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
        opqrst_target: 'Severity / Palliation',
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
        opqrst_target: 'Associated Red Flags',
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
        opqrst_target: 'Context / Allergies',
      },
    ];
  }

  if (
    lower.includes('calentura') ||
    lower.includes('fiebre') ||
    lower.includes('garganta') ||
    lower.includes('tos')
  ) {
    // El relato ya incluye duración (3 días), fiebre (38.8 °C) y oximetría (96%), por lo que solo faltan 2 preguntas clave
    return [
      {
        id: 1,
        question:
          '¿Has podido tomar líquidos hoy y la fiebre baja cuando tomas algún medicamento?',
        quick_options: [
          'Tomo líquidos con molestia; la fiebre cede con paracetamol',
          'Me cuesta mucho tragar líquidos hoy',
          'Me hidrato bien y la fiebre es solo nocturna',
        ],
        opqrst_target: 'Palliation / Hydration',
      },
      {
        id: 2,
        question:
          '¿Qué medicamentos has tomado en estos días o tienes alergia a algún antibiótico o analgésico?',
        quick_options: [
          'Solo paracetamol; sin alergias conocidas',
          'Antigripal de farmacia; sin alergias',
          'Soy alérgico a la penicilina / antibióticos',
        ],
        opqrst_target: 'Medications / Allergies',
      },
    ];
  }

  if (
    lower.includes('cabeza') ||
    lower.includes('migraña') ||
    lower.includes('detrás del ojo') ||
    lower.includes('acetaminofén')
  ) {
    return [
      {
        id: 1,
        question:
          '¿El dolor inició de forma gradual o súbita en segundos, y has notado vista borrosa o dificultad para hablar?',
        quick_options: [
          'Subió poco a poco; sin problemas para hablar',
          'Inició rápido y veo algunos destellos de luz',
          'Fue gradual, solo molestia a la luz',
        ],
        opqrst_target: 'Onset / Neurological Flags',
      },
      {
        id: 2,
        question:
          '¿Las náuseas te han impedido tomar líquidos hoy o el dolor empeora al caminar o agacharte?',
        quick_options: [
          'Puedo tomar agua; empeora al mover la cabeza',
          'Náuseas leves sin vómito; prefiero estar quieto',
          'He vomitado y me cuesta retener líquidos',
        ],
        opqrst_target: 'Provocation / Associated Symptoms',
      },
      {
        id: 3,
        question:
          '¿Has tenido episodios similares antes o eres alérgico a algún analgésico (como ibuprofeno o aspirina)?',
        quick_options: [
          'He tenido episodios similares antes; sin alergias',
          'Es la primera vez que me pasa; sin alergias',
          'Soy alérgico a antiinflamatorios (AINEs)',
        ],
        opqrst_target: 'History / Allergies',
      },
    ];
  }

  // Evaluación adaptativa (1 a 3 preguntas) según qué información falta en un relato libre
  const hasDuration =
    /\b(hace|desde|días|dia|horas|hora|minutos|semana|ayer|anoche)\b/i.test(
      lower
    );
  const hasSeverity =
    /\b([1-9]|10)\s*(de|\/)\s*10\b|\b(leve|moderad[oa]|fuerte|intenso|insoportable)\b/i.test(
      lower
    );
  const hasMedicationOrAllergy =
    /\b(tomé|tome|tomando|pastilla|medicamento|acetaminofén|paracetamol|ibuprofeno|alergia|alérgic[oa])\b/i.test(
      lower
    );

  const dynamicQuestions: Omit<FollowUpQuestion, 'id'>[] = [];

  if (!hasDuration || !hasSeverity) {
    dynamicQuestions.push({
      question: !hasDuration
        ? '¿Desde hace cuánto tiempo empezó el malestar y qué tan intenso es del 1 al 10?'
        : '¿Del 1 al 10, qué tan intenso sientes el malestar en este momento?',
      quick_options: !hasDuration
        ? [
            'Empezó hoy; intensidad moderada (5/10)',
            'Llevo 2 a 3 días; intensidad fuerte (7/10)',
            'Más de una semana; molestia leve-moderada',
          ]
        : [
            'Leve (2-3 de 10)',
            'Moderado (5-6 de 10)',
            'Fuerte (8-9 de 10)',
          ],
      opqrst_target: 'Time / Severity',
    });
  }

  dynamicQuestions.push({
    question:
      '¿Qué empeora o alivia tus síntomas, y has notado fiebre, mareo o falta de aire?',
    quick_options: [
      'Empeora con el movimiento; sin fiebre ni falta de aire',
      'Mejora en reposo; sin otros síntomas de alarma',
      'Se acompaña de fiebre o malestar general',
    ],
    opqrst_target: 'Provocation / Associated Symptoms',
  });

  if (!hasMedicationOrAllergy) {
    dynamicQuestions.push({
      question:
        '¿Has tomado algún medicamento para aliviarlo hoy o eres alérgico a algún fármaco?',
      quick_options: [
        'No he tomado medicamentos; sin alergias conocidas',
        'Tomé un analgésico hoy con poco alivio; sin alergias',
        'Sí tengo alergia a algunos medicamentos',
      ],
      opqrst_target: 'Medications / Allergies',
    });
  }

  return dynamicQuestions.slice(0, 3).map((q, index) => ({
    id: index + 1,
    ...q,
  }));
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
  const a2 = followUpAnswers[1]?.answer || a1;
  const a3 =
    followUpAnswers[2]?.answer ||
    followUpAnswers[followUpAnswers.length - 1]?.answer ||
    'Sin alergias medicamentosas reportadas';
  const followUpSummaryText =
    followUpAnswers.length > 0
      ? followUpAnswers.map((a) => `"${a.answer}"`).join(', ')
      : `"${a1}"`;

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
      fact: `Información adicional #${idx + 1}`,
      quote: ans.answer,
      source: 'Seguimiento clínico',
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
          subjective: `Paciente con antecedente de HTA refiere dolor torácico opresivo de 40 minutos de evolución iniciado tras esfuerzo, irradiado a brazo izquierdo y mandíbula, acompañado de diaforesis fría y disnea. Seguimiento: ${followUpSummaryText}.`,
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
          subjective: `Cuadro de 72 horas con fiebre nocturna hasta 38.8 °C, odinofagia, tos productiva y mialgias. Niega disnea en reposo (SpO2 96%). Seguimiento: ${followUpSummaryText}.`,
          objective:
            'Voz clara sin taquipnea audible. Autocontrol domiciliario: T° 38.8 °C y SpO2 96%.',
          assessment:
            'Infección respiratoria aguda superior (faringoamigdalitis aguda viral vs. bacteriana).',
          plan: 'Inspección faríngea por videollamada, evaluar criterios de Centor, ajuste antipirético/analgésico e hidratación.',
        },
        isbar: {
          identification: 'Paciente en pre-consulta por síndrome febril y respiratorio de 3 días.',
          situation: 'Fiebre de 38.8 °C, odinofagia y tos productiva con SpO2 96%.',
          background: `${a3}. Evolución e hidratación: ${a1}.`,
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
        subjective: `Cefalea hemicraneal derecha y retroocular pulsátil 8/10 de 4 horas de evolución, con fotofobia y náuseas leves. Sin mejora tras acetaminofén 500 mg hace 2h. Seguimiento: ${followUpSummaryText}.`,
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
