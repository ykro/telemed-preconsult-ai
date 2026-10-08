import {
  CurrencyCode,
  DemoPatientCase,
  DoctorDeliverable,
  EvidenceQuote,
  FollowUpAnswer,
  FollowUpQuestion,
  PatientDeliverable,
} from '@/types/telemed';

export const DEMO_PATIENT_CASES: DemoPatientCase[] = [
  {
    id: 'migraine-photophobia',
    badge: 'Caso 1 · Neurología / Ambulatorio',
    title: 'Caso 1: Migraña Aguda con Fotofobia',
    subtitle: 'Cefalea hemicraneal pulsátil 8/10 con intolerancia a la luz y náuseas',
    patientProfile: 'Mujer, 31 años · Zona 10, Ciudad de Guatemala',
    simulatedWpm: 148,
    triageHint: 'AMARILLO',
    transcript:
      'Hola doctor, mi nombre es Andrea Morales, mi DPI es 2456 78901 0101 y mi teléfono es 5544-3322. Disculpe que hable rápido pero desde hace como cuatro horas me empezó un dolor de cabeza horrible en el lado derecho, justo detrás del ojo, como que me late fuerte. Me duele como un ocho de diez y no aguanto ni ver la luz del celular ni el monitor de la oficina. Hace dos horas me tomé una acetaminofén de 500 miligramos pero no me hizo absolutamente nada y ahorita siento un poco de náuseas, aunque todavía no he vomitado.',
  },
  {
    id: 'chest-pain-redflag',
    badge: 'Caso 2 · Alerta Roja / Cardiología',
    title: 'Caso 2: Dolor Torácico Opresivo (Alerta Red Flag)',
    subtitle: 'Opresión retroesternal súbita con irradiación a brazo izquierdo y diaforesis',
    patientProfile: 'Hombre, 54 años · Mixco, Guatemala',
    simulatedWpm: 162,
    triageHint: 'ROJO',
    transcript:
      'Buen día doctor, me llamo Carlos Roberto Méndez, mi teléfono es 4210-9876 y mi NIT es 4589123-K. Le hablo porque hace unos cuarenta minutos, mientras subía las gradas de la casa, sentí una presión muy fea en el centro del pecho, como si tuviera una piedra pesada encima. El dolor se me está corriendo hacia el brazo izquierdo y la mandíbula, estoy sudando frío y siento que me falta el aire al hablar. Yo padezco de presión alta desde hace cinco años pero hoy en la mañana se me olvidó tomarme el losartán.',
  },
  {
    id: 'respiratory-fever',
    badge: 'Caso 3 · Respiratorio / Medicina Interna',
    title: 'Caso 3: Infección Respiratoria y Fiebre Persistente',
    subtitle: 'Cuadro febril de 3 días con odinofagia, tos productiva y mialgias',
    patientProfile: 'Paciente, 28 años · Antigua Guatemala',
    simulatedWpm: 136,
    triageHint: 'AMARILLO',
    transcript:
      'Hola doctora, soy Sofía Hernández, mi número es 3312-4455 y mi DPI 1987 65432 0301. Fíjese que llevo ya tres días con calentura que me sube a treinta y ocho punto ocho por las noches, dolor de garganta al tragar hasta agua y una tos con flema amarillenta que no me deja dormir bien. Me duele todo el cuerpo como si me hubieran apaleado, sobre todo la espalda baja, pero respiro bien cuando estoy en reposo y el oxímetro de la casa me marca noventa y seis por ciento.',
  },
];

export interface PiiRedactionResult {
  redactedText: string;
  piiRedactedCount: number;
  piiTypesDetected: string[];
}

export function redactPiiLocally(rawText: string): PiiRedactionResult {
  let redactedText = rawText;
  let piiRedactedCount = 0;
  const typesSet = new Set<string>();

  // 1. Guatemalan DPI pattern (13 digits: 4-5-4)
  const dpiRegex = /\b\d{4}[\s-]?\d{5}[\s-]?\d{4}\b/g;
  redactedText = redactedText.replace(dpiRegex, () => {
    piiRedactedCount += 1;
    typesSet.add('DPI');
    return '[DPI-PROTEGIDO]';
  });

  // 2. NIT pattern
  const nitRegex = /\b(?:NIT\s*(?:es)?\s*)?(\d{5,9}-?[\dkK])\b/gi;
  redactedText = redactedText.replace(nitRegex, (match) => {
    piiRedactedCount += 1;
    typesSet.add('NIT');
    return match.toLowerCase().includes('nit')
      ? 'NIT [NIT-PROTEGIDO]'
      : '[NIT-PROTEGIDO]';
  });

  // 3. Guatemalan / LatAm Phone Numbers (8 digits or +502)
  const phoneRegex = /\b(?:\+?502[\s-]?)?\d{4}[\s-]\d{4}\b/g;
  redactedText = redactedText.replace(phoneRegex, () => {
    piiRedactedCount += 1;
    typesSet.add('Teléfono');
    return '[TEL-PROTEGIDO]';
  });

  // 4. Email addresses
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  redactedText = redactedText.replace(emailRegex, () => {
    piiRedactedCount += 1;
    typesSet.add('Correo');
    return '[EMAIL-PROTEGIDO]';
  });

  // 5. Explicit Spanish self-introductions ("mi nombre es X Y", "me llamo X Y", "soy X Y")
  const nameIntroRegex =
    /\b(mi nombre es|me llamo|soy)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,2})/g;
  redactedText = redactedText.replace(nameIntroRegex, (_full, prefix) => {
    piiRedactedCount += 1;
    typesSet.add('Nombre Propio');
    return `${prefix} [PACIENTE-ANONIMIZADO]`;
  });

  return {
    redactedText,
    piiRedactedCount,
    piiTypesDetected: Array.from(typesSet),
  };
}

export function buildDeterministicFollowUps(transcript: string): FollowUpQuestion[] {
  const lower = transcript.toLowerCase();

  // Case 2: Chest Pain / Cardiac Red Flag
  if (
    lower.includes('pecho') ||
    lower.includes('brazo izquierdo') ||
    lower.includes('mandíbula') ||
    lower.includes('presión alta') ||
    lower.includes('losartán')
  ) {
    return [
      {
        id: 1,
        opqrst_target: 'Severity & Time (Severidad y Evolución)',
        question:
          '¿Del 1 al 10, qué tan fuerte es la opresión en el pecho ahora mismo y disminuye al sentarte en reposo?',
        quick_options: [
          'Es muy fuerte (9/10) y NO mejora ni sentado en reposo',
          'Es moderada (6/10) y baja un poco al descansar',
          'Va y viene cada pocos minutos (7-8/10)',
        ],
      },
      {
        id: 2,
        opqrst_target: 'Associated Red Flags (Síntomas Neurológicos / Síncope)',
        question:
          '¿Has sentido mareo intenso, sensación de desmayo, palpitaciones rápidas o náuseas?',
        quick_options: [
          'Sí, siento mareo fuerte y palpitaciones rápidas',
          'Solo el sudor frío y la falta de aire al hablar',
          'No he tenido desmayo ni mareo hasta ahora',
        ],
      },
      {
        id: 3,
        opqrst_target: 'Context & Medications (Antecedentes / Alergias)',
        question:
          '¿Tienes aspirina a la mano, eres alérgico a algún medicamento o has tenido infartos previos?',
        quick_options: [
          'Sin alergias; nunca me ha dado esto pero mi papá tuvo infarto',
          'Tomé aspirina hace 10 minutos; no tengo alergias',
          'Soy alérgico a AINEs / penicilina',
        ],
      },
    ];
  }

  // Case 3: Respiratory / Fever
  if (
    lower.includes('calentura') ||
    lower.includes('fiebre') ||
    lower.includes('garganta') ||
    lower.includes('tos') ||
    lower.includes('flema')
  ) {
    return [
      {
        id: 1,
        opqrst_target: 'Severity & Provocation (Disnea / Dolor al Respirar)',
        question:
          '¿Sientes dolor en el pecho al respirar profundo, silbidos en el pecho o fatiga al caminar pocos pasos?',
        quick_options: [
          'Me canso al caminar al baño, pero no me silba el pecho',
          'Sí siento ardor en el pecho al toser fuerte',
          'Respiro sin dolor, el malestar es más en garganta y cuerpo',
        ],
      },
      {
        id: 2,
        opqrst_target: 'Quality & Time (Hidratación y Evolución Térmica)',
        question:
          '¿Has podido tomar líquidos normalmente hoy y la fiebre baja cuando tomas medicamento?',
        quick_options: [
          'Tomo agua con dolor al tragar; la fiebre baja con paracetamol pero regresa',
          'Casi no he podido tomar líquidos hoy por el dolor de garganta',
          'Sí tomo líquidos bien y la fiebre ha sido intermitente',
        ],
      },
      {
        id: 3,
        opqrst_target: 'Context & Allergies (Medicación y Alergias)',
        question:
          '¿Qué medicamentos has tomado en estos 3 días, eres alérgico a algún antibiótico o convives con alguien enfermo?',
        quick_options: [
          'Solo paracetamol cada 8h; sin alergias; en mi trabajo varios tienen gripe',
          'Tomé antigripal de venta libre; soy alérgico a la penicilina',
          'No he tomado medicamentos; sin alergias conocidas',
        ],
      },
    ];
  }

  // Default / Case 1: Migraine with Photophobia or general clinical consult
  return [
    {
      id: 1,
      opqrst_target: 'Onset & Quality (Forma de Inicio y Signos Neurológicos)',
      question:
        '¿El dolor empezó de golpe en segundos o fue subiendo poco a poco, y has notado vista borrosa, hormigueo o dificultad para hablar?',
      quick_options: [
        'Subió poco a poco en 30 minutos; veo luces/destellos pero hablo bien',
        'Empezó de repente muy fuerte; tengo algo de vista borrosa',
        'Fue gradual y no tengo hormigueo ni problemas al hablar',
      ],
    },
    {
      id: 2,
      opqrst_target: 'Provocation & Associated Symptoms (Agravantes y Vómito)',
      question:
        '¿El dolor empeora al caminar o agacharte, y has llegado a vomitar o tener fiebre hoy?',
      quick_options: [
        'Sí empeora al mover la cabeza o ver luz; solo náuseas sin vómito ni fiebre',
        'He vomitado una vez hoy y el ruido también me molesta mucho',
        'Se mantiene igual quieta o caminando; sin fiebre',
      ],
    },
    {
      id: 3,
      opqrst_target: 'Context & Allergies (Antecedentes y Alergias Medicamentosas)',
      question:
        '¿Has padecido de migrañas antes o eres alérgica a algún analgésico (como ibuprofeno, ketorolaco o aspirina)?',
      quick_options: [
        'Me dan migrañas cada par de meses; no tengo alergias a medicamentos',
        'Es la primera vez que me duele así de fuerte; sin alergias',
        'Sí soy alérgica a AINEs / ibuprofeno',
      ],
    },
  ];
}

function extractSentencesFromTranscript(transcript: string): string[] {
  return transcript
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);
}

export function buildDeterministicDeliverables(
  transcript: string,
  followUpAnswers: FollowUpAnswer[],
  currency: CurrencyCode
): {
  patient_deliverable: PatientDeliverable;
  doctor_deliverable: DoctorDeliverable;
} {
  const lower = transcript.toLowerCase();
  const sentences = extractSentencesFromTranscript(transcript);
  const firstQuote =
    sentences[1] ||
    sentences[0] ||
    transcript.slice(0, 140).trim();
  const secondQuote =
    sentences[2] ||
    sentences[sentences.length - 1] ||
    firstQuote;

  const a1 = followUpAnswers[0]?.answer || 'Confirmado durante interrogatorio dirigido';
  const a2 = followUpAnswers[1]?.answer || 'Sin otros síntomas de alarma adicionales reportados';
  const a3 = followUpAnswers[2]?.answer || 'Sin alergias medicamentosas conocidas reportadas';

  const evidenceQuotes: EvidenceQuote[] = [
    {
      fact: 'Motivo principal y cronología inicial del cuadro',
      quote: firstQuote,
      source: 'Relato Inicial',
    },
    {
      fact: 'Contexto terapéutico y síntomas acompañantes en relato libre',
      quote: secondQuote,
      source: 'Relato Inicial',
    },
    ...followUpAnswers.map((ans, idx) => ({
      fact: `Respuesta OPQRST #${idx + 1} (${ans.opqrst_target || 'Seguimiento dirigido'})`,
      quote: ans.answer,
      source: 'Follow-Up OPQRST' as const,
    })),
  ];

  // Case 2: Chest Pain Red Flag
  if (
    lower.includes('pecho') ||
    lower.includes('brazo izquierdo') ||
    lower.includes('mandíbula') ||
    lower.includes('losartán')
  ) {
    const costRef =
      currency === 'GTQ'
        ? 'Q 0.00 en Telemedicina (Derivación Inmediata a Emergencia Hospitalaria · Evaluación ECG urgente est. Q 350 – Q 650)'
        : '$ 0.00 Teleconsult (Immediate ER Dispatch · Urgent ECG Triage est. $ 45 – $ 85 USD)';

    return {
      patient_deliverable: {
        friendly_summary:
          'Reportaste dolor opresivo en el centro del pecho iniciado hace 40 minutos tras esfuerzo físico, con irradiación al brazo izquierdo y mandíbula, acompañado de sudoración fría, falta de aire y antecedente de hipertensión arterial sin dosis matutina de losartán.',
        questions_to_ask_doctor: [
          '¿Debo masticar una aspirina de inmediato mientras me trasladan al servicio de urgencias más cercano?',
          '¿Qué hospital o centro de emergencias cercano cuenta con electrocardiograma inmediato y protocolo de dolor torácico?',
          '¿Debo evitar tomar mi dosis atrasada de losartán hasta que me midan la presión arterial en urgencias?',
        ],
        prep_checklist: [
          'NO conduzcas por tu cuenta: pide a un familiar o ambulancia que te traslade de inmediato',
          'Siéntate en posición semi-incorporada (45°) en reposo absoluto y afloja ropa ajustada',
          'Ten a la mano tu documento de identificación y la caja de Losartán',
          'Mantén la línea telefónica abierta con el médico de triaje durante el traslado',
        ],
        urgency_notice:
          'ALERTA ROJA (Prioridad Crítica Inmediata): Tus síntomas requieren valoración presencial de urgencia con electrocardiograma (ECG de 12 derivaciones) en los próximos 10 minutos para descartar síndrome coronario agudo.',
        estimated_consultation_cost: costRef,
        recommended_modality: 'Derivación Inmediata a Urgencias Presenciales (Código Corazón)',
      },
      doctor_deliverable: {
        triage_level: 'ROJO',
        red_flags: [
          'Dolor torácico opresivo retroesternal de inicio agudo (40 min) desencadenado por esfuerzo',
          'Irradiación típica a miembro superior izquierdo y región mandibular',
          'Cortejo vegetativo (diaforesis fría) y disnea al hablar',
          'Hipertensión arterial crónica con omisión de tratamiento antihipertensivo hoy (Losartán)',
        ],
        opqrst: {
          onset: 'Hace ~40 minutos, inicio súbito al subir gradas',
          provocation: `Esfuerzo físico; ${a1}`,
          quality: 'Opresivo ("como si tuviera una piedra pesada encima")',
          radiation: 'Centro del pecho hacia brazo izquierdo y mandíbula',
          severity: a1,
          time: '40 minutos de evolución continua',
        },
        soap: {
          subjective: `Paciente masculino de 54 años con antecedente de HTA (5 años en manejo con losartán, omitido hoy) refiere dolor torácico retroesternal opresivo iniciado hace 40 minutos tras esfuerzo físico. Irradia a brazo izquierdo y mandíbula, asociado a diaforesis fría y disnea. En seguimiento dirigido refiere: "${a1}", "${a2}" y "${a3}".`,
          objective:
            'Discurso taquilálico con disnea perceptible en relato por voz. Reporta diaforesis fría activa. Pendiente toma inmediata de signos vitales, SpO2 y ECG de 12 derivaciones.',
          assessment:
            'Síndrome Coronario Agudo (SCA) a descartar de forma prioritaria vs. crisis hipertensiva / angina inestable. Triaje Nivel ROJO.',
          plan: '1. Activar protocolo de derivación inmediata a sala de urgencias para ECG en <10 min y troponinas. 2. Indicar reposo absoluto y traslado asistido (no conducir). 3. Valorar AAS 300 mg masticada si no existe alergia ni contraindicación.',
        },
        isbar: {
          identification: 'Paciente masculino, 54 años, con HTA conocida en pre-consulta urgente.',
          situation:
            'Dolor torácico opresivo agudo de 40 min con irradiación a brazo izquierdo/mandíbula, diaforesis y disnea.',
          background:
            'HTA de 5 años de evolución; omitió dosis matutina de losartán hoy. ' + a3,
          assessment:
            'Alta sospecha clínica de evento coronario agudo (Red Flags positivas). ' + a1,
          recommendation:
            'Suspender espera ambulatoria; referir inmediatamente a urgencias hospitalarias con pre-aviso a cardiología/emergencias.',
        },
        evidence_quotes: evidenceQuotes,
      },
    };
  }

  // Case 3: Respiratory Infection & Persistent Fever
  if (
    lower.includes('calentura') ||
    lower.includes('fiebre') ||
    lower.includes('garganta') ||
    lower.includes('tos') ||
    lower.includes('flema')
  ) {
    const costRef =
      currency === 'GTQ'
        ? 'Copago Teleconsulta Estimado: Q 125.00 (Con panel respiratorio / hisopado opcional: Q 260.00)'
        : 'Estimated Teleconsult Copay: $ 16.00 USD (Optional rapid respiratory panel: $ 34.00 USD)';

    return {
      patient_deliverable: {
        friendly_summary:
          'Reportaste 3 días de fiebre nocturna de hasta 38.8 °C, dolor intenso de garganta al tragar, tos con flema amarillenta y dolor muscular generalizado, manteniendo una oxigenación en casa de 96% sin falta de aire en reposo.',
        questions_to_ask_doctor: [
          '¿Mis síntomas sugieren una infección viral o necesito una prueba rápida (estreptococo / influenza) antes de usar antibióticos?',
          '¿Cómo debo alternar el medicamento para la fiebre y el dolor de garganta para poder descansar en la noche?',
          '¿A partir de qué nivel en mi oxímetro de pulso o temperatura debería acudir a una evaluación presencial?',
        ],
        prep_checklist: [
          'Tener a la mano tu termómetro y oxímetro de pulso para verificar lectura en vivo con el médico',
          'Ubicarte en un lugar bien iluminado por si el médico solicita revisar tu garganta por cámara',
          'Tener un vaso con agua cerca y anotar la última hora en que tomaste paracetamol',
        ],
        urgency_notice:
          'Prioridad Moderada (Amarillo): Tu oxigenación de 96% es tranquilizadora, pero si baja de 92%, notas hundimiento de costillas al respirar o imposibilidad total para tragar líquidos, acude a urgencias.',
        estimated_consultation_cost: costRef,
        recommended_modality: 'Videoconsulta Médica Inmediata + Valoración de Hisopado Faríngeo',
      },
      doctor_deliverable: {
        triage_level: 'AMARILLO',
        red_flags: [
          'Fiebre persistente de 38.8 °C por 72 horas con odinofagia importante',
          'Tos productiva purulenta que interfiere con el sueño (SpO2 actual conservada en 96%)',
        ],
        opqrst: {
          onset: 'Hace 3 días de forma progresiva',
          provocation: `Deglución de líquidos/sólidos y predominio nocturno; ${a1}`,
          quality: 'Odinofagia intensa, tos productiva amarillenta y mialgias difusas',
          radiation: 'Faringe, vías respiratorias altas y región dorsolumbar por mialgias',
          severity: `Fiebre cuantificada en 38.8 °C; SpO2 96%; ${a2}`,
          time: '72 horas de evolución con picos febriles nocturnos',
        },
        soap: {
          subjective: `Paciente refiere cuadro de 3 días de evolución caracterizado por fiebre cuantificada hasta 38.8 °C de predominio nocturno, odinofagia severa incluso a líquidos, tos productiva con expectoración amarillenta e insomnio secundario, además de mialgias generalizadas. Niega disnea en reposo (SpO2 domiciliaria 96%). En interrogatorio OPQRST agrega: "${a1}", "${a2}" y "${a3}".`,
          objective:
            'Voz clara con leve congestión respiratoria alta, sin estridor ni taquipnea audible. Autocontrol domiciliario reporta T° 38.8 °C y SpO2 96% al aire ambiente.',
          assessment:
            'Infección Respiratoria Aguda Superior (faringoamigdalitis aguda viral vs. bacteriana por Streptococcus pyogenes / síndrome gripal). Sin datos de insuficiencia respiratoria actual.',
          plan: '1. Inspección orofaríngea dirigida por videocámara (evaluar criterios de Centor). 2. Manejo antipirético/analgésico horario e hidratación oral abundante. 3. Valorar prueba rápida de antígeno estreptocócico/viral y dar pauta de alarma respiratoria (SpO2 < 92%).',
        },
        isbar: {
          identification: 'Paciente adulto joven en pre-consulta por cuadro febril respiratorio de 72h.',
          situation:
            'Fiebre de 38.8 °C de 3 días con odinofagia intensa, tos productiva y mialgias; SpO2 96%.',
          background: `${a3}. Hidratación y evolución térmica: ${a2}.`,
          assessment:
            'Faringoamigdalitis aguda / infección respiratoria alta hemodinámicamente estable.',
          recommendation:
            'Realizar teleconsulta prioritaria hoy, verificar criterios de Centor y definir necesidad de antimicrobiano vs. manejo sintomático.',
        },
        evidence_quotes: evidenceQuotes,
      },
    };
  }

  // Default / Case 1: Acute Migraine with Photophobia
  const costRef =
    currency === 'GTQ'
      ? 'Copago Teleconsulta Estimado: Q 120.00 (Medicamento abortivo de migraña en farmacia est. Q 85 – Q 140)'
      : 'Estimated Teleconsult Copay: $ 15.00 USD (Prescription migraine therapy est. $ 11 – $ 18 USD)';

  return {
    patient_deliverable: {
      friendly_summary:
        'Reportaste un dolor de cabeza pulsátil en el lado derecho y detrás del ojo que inició hace 4 horas con intensidad 8/10, acompañado de molestia intensa a la luz (fotofobia) y náuseas leves, sin mejoría tras tomar acetaminofén de 500 mg hace 2 horas.',
      questions_to_ask_doctor: [
        '¿Qué medicamento específico (como un triptano o antiinflamatorio combinado con antiemético) puedo tomar hoy dado que el acetaminofén no me alivió?',
        '¿Estos episodios requieren algún estudio preventivo o cambio en mi ergonomía frente a pantallas en la oficina?',
        '¿Qué señales neurológicas de alarma indicarían que debo ir a urgencias en lugar de descansar en casa?',
      ],
      prep_checklist: [
        'Ubícate en una habitación silenciosa con luz tenue y baja el brillo de tu pantalla al mínimo durante la videollamada',
        'Ten a la mano el empaque de la acetaminofén de 500 mg que tomaste hace 2 horas',
        'Ten cerca un vaso con agua fría para hidratarte',
      ],
      urgency_notice:
        'Prioridad Media-Alta (Amarillo): Si presentas pérdida súbita de fuerza en un brazo o pierna, dificultad para articular palabras, fiebre o el dolor se vuelve "el peor de tu vida en un segundo", acude a urgencias de inmediato.',
      estimated_consultation_cost: costRef,
      recommended_modality: 'Videoconsulta Médica Prioritaria (Ambiente con Luz Tenue)',
    },
    doctor_deliverable: {
      triage_level: 'AMARILLO',
      red_flags: [
        'Cefalea hemicraneal aguda severa (8/10) con fotofobia marcada y náuseas',
        'Falla terapéutica a analgesia oral de primera línea (Acetaminofén 500 mg hace 2h)',
      ],
      opqrst: {
        onset: `Hace 4 horas; ${a1}`,
        provocation: `Exposición a luz brillante/pantallas; ${a2}`,
        quality: 'Pulsátil ("como que me late fuerte")',
        radiation: 'Hemicraneal derecho y región retroocular derecha',
        severity: '8/10 en escala verbal numérica',
        time: '4 horas continuas sin remisión tras paracetamol',
      },
      soap: {
        subjective: `Paciente femenina refiere cefalea hemicraneal derecha y retroocular de carácter pulsátil, intensidad 8/10, de 4 horas de evolución, asociada a fotofobia severa y náuseas sin emesis. Refiere ingesta de acetaminofén 500 mg VO hace 2 horas sin respuesta clínica. En seguimiento OPQRST puntualiza: "${a1}", "${a2}" y "${a3}".`,
        objective:
          'Paciente orientada en tiempo, espacio y persona durante relato por voz; lenguaje fluido y coherente sin disartria audible. Intolerancia referida a luminosidad de pantalla.',
        assessment:
          'Crisis migrañosa aguda moderada-severa (con/sin aura) refractaria a paracetamol; descartar cefalea secundaria mediante tamizaje neurológico SNOOP4.',
        plan: '1. Exploración neurológica visual rápida por videollamada (simetría facial, oculomotricidad, fuerza distal). 2. Prescribir terapia abortiva específica (AINE + triptano y antiemético procinético según alergias). 3. Indicar reposo en oscuridad y signos de alarma SNOOP4.',
      },
      isbar: {
        identification: 'Paciente en pre-consulta de telemedicina por cefalea aguda severa.',
        situation:
          'Cefalea hemicraneal derecha pulsátil 8/10 de 4 horas con fotofobia y náuseas.',
        background: `Sin alivio tras acetaminofén 500 mg hace 2 horas. ${a3}.`,
        assessment: `Cuadro compatible con crisis de migraña aguda sin focalidad motora reportada (${a1}).`,
        recommendation:
          'Valoración médica prioritaria hoy para ajuste de analgesia abortiva y verificación de signos neurológicos por cámara.',
      },
      evidence_quotes: evidenceQuotes,
    },
  };
}
