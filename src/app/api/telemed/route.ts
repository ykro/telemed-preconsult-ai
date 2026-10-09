import { NextRequest, NextResponse } from 'next/server';
import {
  buildDeterministicDeliverables,
  buildDeterministicFollowUps,
  redactPiiLocally,
} from '@/lib/clinical-engine';
import {
  ArchitectureVariant,
  DoctorDeliverable,
  FollowUpAnswer,
  FollowUpQuestion,
  PatientDeliverable,
} from '@/types/telemed';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

interface TelemedRequestPayload {
  action: 'generate_followups' | 'generate_deliverables';
  transcript: string;
  variant?: ArchitectureVariant;
  followUpAnswers?: FollowUpAnswer[];
}

function extractJsonFromText(rawText: string): unknown {
  const trimmed = rawText.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
  }
  return JSON.parse(candidate);
}

async function callGenerativeLanguageModel(
  modelPath: string,
  prompt: string,
  useJsonMimeType: boolean
): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY environment variable');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 9000);

  try {
    const endpoint = `${GEMINI_API_BASE}/${modelPath}:generateContent?key=${apiKey}`;
    const generationConfig: Record<string, unknown> = {
      temperature: 0.2,
      topP: 0.9,
      maxOutputTokens: 2048,
    };

    if (useJsonMimeType) {
      generationConfig.responseMimeType = 'application/json';
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API ${response.status}: ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();
    const textOutput: string | undefined =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textOutput) {
      throw new Error('Empty response candidate');
    }

    return extractJsonFromText(textOutput);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TelemedRequestPayload;
    const action = body.action;
    const rawTranscript = (body.transcript || '').trim();
    const variant: ArchitectureVariant = body.variant === 'A' ? 'A' : 'B';

    if (!rawTranscript) {
      return NextResponse.json(
        { error: 'Por favor describe tus síntomas.' },
        { status: 400 }
      );
    }

    const piiResult =
      variant === 'B'
        ? redactPiiLocally(rawTranscript)
        : { redactedText: rawTranscript, piiRedactedCount: 0 };

    const processedTranscript = piiResult.redactedText;

    if (action === 'generate_followups') {
      const targetModel =
        variant === 'A'
          ? 'models/gemini-3.8-flash'
          : 'models/gemma-4-26b-a4b-it';

      const followUpPrompt = `Eres un médico empático en una pre-consulta de telemedicina.
Analiza el relato del paciente e identifica qué elementos del protocolo clínico OPQRST faltan por aclarar.

Relato del paciente:
"""
${processedTranscript}
"""

Devuelve ÚNICAMENTE un JSON válido con exactamente 3 preguntas breves, claras y directas en español, cada una con 3 opciones cortas de respuesta rápida:
{
  "follow_up_questions": [
    {
      "id": 1,
      "question": "¿Pregunta corta 1?",
      "quick_options": ["Opción 1", "Opción 2", "Opción 3"]
    },
    {
      "id": 2,
      "question": "¿Pregunta corta 2?",
      "quick_options": ["Opción 1", "Opción 2", "Opción 3"]
    },
    {
      "id": 3,
      "question": "¿Pregunta corta 3?",
      "quick_options": ["Opción 1", "Opción 2", "Opción 3"]
    }
  ]
}`;

      let followUpQuestions: FollowUpQuestion[] | null = null;

      try {
        const parsed = (await callGenerativeLanguageModel(
          targetModel,
          followUpPrompt,
          variant === 'A'
        )) as { follow_up_questions?: FollowUpQuestion[] };

        if (
          parsed &&
          Array.isArray(parsed.follow_up_questions) &&
          parsed.follow_up_questions.length === 3
        ) {
          followUpQuestions = parsed.follow_up_questions.map((q, idx) => ({
            id: idx + 1,
            question: String(q.question || ''),
            quick_options:
              Array.isArray(q.quick_options) && q.quick_options.length >= 2
                ? q.quick_options.map(String)
                : ['Sí', 'No', 'No estoy seguro'],
          }));
        }
      } catch {
        // Fallback below
      }

      if (!followUpQuestions) {
        followUpQuestions = buildDeterministicFollowUps(processedTranscript);
      }

      return NextResponse.json({
        follow_up_questions: followUpQuestions,
      });
    }

    if (action === 'generate_deliverables') {
      const rawAnswers = Array.isArray(body.followUpAnswers)
        ? body.followUpAnswers
        : [];

      const sanitizedAnswers: FollowUpAnswer[] = rawAnswers.map((item) => ({
        ...item,
        answer:
          variant === 'B'
            ? redactPiiLocally(item.answer || '').redactedText
            : item.answer,
      }));

      const deliverablesPrompt = `Eres un asistente clínico de pre-consulta médica.
Con base en el relato del paciente y sus 3 respuestas de seguimiento, genera en español:
1. "patient_deliverable": Resumen claro y empático ("friendly_summary"), 3 preguntas sugeridas para hacerle al médico ("questions_to_ask_doctor"), 3 puntos de preparación para la consulta ("prep_checklist"), y una orientación breve de prioridad ("urgency_notice"). No incluyas precios ni costos.
2. "doctor_deliverable": Ficha médica concisa con "triage_level" ("VERDE", "AMARILLO" o "ROJO"), "red_flags", "opqrst", "soap", "isbar" y "evidence_quotes" (citas textuales exactas del paciente).

Relato del paciente:
"""
${processedTranscript}
"""

Respuestas a las 3 preguntas rápidas:
${sanitizedAnswers
  .map((a, idx) => `${idx + 1}. ${a.question}: "${a.answer}"`)
  .join('\n')}

Devuelve ÚNICAMENTE un objeto JSON válido con esta estructura:
{
  "patient_deliverable": {
    "friendly_summary": "...",
    "questions_to_ask_doctor": ["...", "...", "..."],
    "prep_checklist": ["...", "...", "..."],
    "urgency_notice": "..."
  },
  "doctor_deliverable": {
    "triage_level": "VERDE" | "AMARILLO" | "ROJO",
    "red_flags": ["..."],
    "opqrst": {
      "onset": "...",
      "provocation": "...",
      "quality": "...",
      "radiation": "...",
      "severity": "...",
      "time": "..."
    },
    "soap": {
      "subjective": "...",
      "objective": "...",
      "assessment": "...",
      "plan": "..."
    },
    "isbar": {
      "identification": "...",
      "situation": "...",
      "background": "...",
      "assessment": "...",
      "recommendation": "..."
    },
    "evidence_quotes": [
      {
        "fact": "...",
        "quote": "...",
        "source": "Relato inicial"
      }
    ]
  }
}`;

      let patientDeliverable: PatientDeliverable | null = null;
      let doctorDeliverable: DoctorDeliverable | null = null;

      try {
        const parsed = (await callGenerativeLanguageModel(
          'models/gemini-3.8-flash',
          deliverablesPrompt,
          true
        )) as {
          patient_deliverable?: PatientDeliverable;
          doctor_deliverable?: DoctorDeliverable;
        };

        if (
          parsed?.patient_deliverable?.friendly_summary &&
          parsed?.doctor_deliverable?.soap?.subjective &&
          parsed?.doctor_deliverable?.isbar?.situation
        ) {
          patientDeliverable = parsed.patient_deliverable;
          doctorDeliverable = parsed.doctor_deliverable;
        }
      } catch {
        // Fallback below
      }

      if (!patientDeliverable || !doctorDeliverable) {
        const fallback = buildDeterministicDeliverables(
          processedTranscript,
          sanitizedAnswers
        );
        patientDeliverable = fallback.patient_deliverable;
        doctorDeliverable = fallback.doctor_deliverable;
      }

      return NextResponse.json({
        patient_deliverable: patientDeliverable,
        doctor_deliverable: doctorDeliverable,
      });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch {
    const fallback = buildDeterministicDeliverables(
      'Consulta médica general',
      []
    );
    return NextResponse.json(fallback);
  }
}
