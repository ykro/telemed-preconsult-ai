import { NextRequest, NextResponse } from 'next/server';
import {
  buildDeterministicDeliverables,
  buildDeterministicFollowUps,
  redactPiiLocally,
} from '@/lib/clinical-engine';
import {
  ArchitectureVariant,
  CurrencyCode,
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
  currency?: CurrencyCode;
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
  const timeoutId = setTimeout(() => controller.abort(), 9500);

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
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
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
      throw new Error('Empty response candidate from Generative Language API');
    }

    return extractJsonFromText(textOutput);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(request: NextRequest) {
  const startTime = performance.now();

  try {
    const body = (await request.json()) as TelemedRequestPayload;
    const action = body.action;
    const rawTranscript = (body.transcript || '').trim();
    const variant: ArchitectureVariant = body.variant === 'A' ? 'A' : 'B';
    const currency: CurrencyCode = body.currency === 'USD' ? 'USD' : 'GTQ';

    if (!rawTranscript) {
      return NextResponse.json(
        { error: 'La transcripción del paciente no puede estar vacía.' },
        { status: 400 }
      );
    }

    // Apply local PII redaction in Variant B (Edge-Assisted Cascade)
    const piiResult =
      variant === 'B'
        ? redactPiiLocally(rawTranscript)
        : {
            redactedText: rawTranscript,
            piiRedactedCount: 0,
            piiTypesDetected: [],
          };

    const processedTranscript = piiResult.redactedText;

    if (action === 'generate_followups') {
      // Variant A uses models/gemini-3.8-flash directly
      // Variant B uses models/gemma-4-26b-a4b-it (Gemma 4 E2B/MoE edge-tier architecture) after local PII redaction
      const targetModel =
        variant === 'A'
          ? 'models/gemini-3.8-flash'
          : 'models/gemma-4-26b-a4b-it';

      const displayModel =
        variant === 'A'
          ? 'gemini-3.8-flash (Monolithic Cloud)'
          : 'gemma-4-e2b / gemma-4-26b-a4b-it (Cascade Edge+Cloud)';

      const followUpPrompt = `Eres un médico especialista en triaje de telemedicina en Latinoamérica (Guatemala).
Analiza el siguiente relato inicial del paciente e identifica qué elementos clave del protocolo clínico OPQRST (Onset, Provocation/Palliation, Quality, Radiation, Severity 1-10, Time/Context/Allergies) faltan o requieren precisión inmediata.

Relato del paciente:
"""
${processedTranscript}
"""

Devuelve ÚNICAMENTE un objeto JSON válido con exactamente 3 preguntas cortas, empáticas y directas en español para el paciente, cada una con 3 opciones de respuesta rápida (chips de 1 toque).
Formato JSON requerido:
{
  "follow_up_questions": [
    {
      "id": 1,
      "opqrst_target": "Severity & Onset",
      "question": "¿Pregunta corta 1?",
      "quick_options": ["Opción 1", "Opción 2", "Opción 3"]
    },
    {
      "id": 2,
      "opqrst_target": "Provocation & Red Flags",
      "question": "¿Pregunta corta 2?",
      "quick_options": ["Opción 1", "Opción 2", "Opción 3"]
    },
    {
      "id": 3,
      "opqrst_target": "Medications & Allergies",
      "question": "¿Pregunta corta 3?",
      "quick_options": ["Opción 1", "Opción 2", "Opción 3"]
    }
  ]
}`;

      let followUpQuestions: FollowUpQuestion[] | null = null;
      let usedFallback = false;

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
            opqrst_target: q.opqrst_target || `OPQRST #${idx + 1}`,
            question: String(q.question || ''),
            quick_options:
              Array.isArray(q.quick_options) && q.quick_options.length >= 2
                ? q.quick_options.map(String)
                : ['Sí, continúa igual', 'Solo por momentos', 'No he notado eso'],
          }));
        }
      } catch {
        usedFallback = true;
      }

      if (!followUpQuestions) {
        usedFallback = true;
        followUpQuestions = buildDeterministicFollowUps(processedTranscript);
      }

      const latencyMs = Math.max(
        18,
        Math.round(performance.now() - startTime)
      );

      return NextResponse.json({
        follow_up_questions: followUpQuestions,
        telemetry: {
          latencyMs,
          modelUsed: displayModel,
          piiRedactedCount: piiResult.piiRedactedCount,
          piiTypesDetected: piiResult.piiTypesDetected,
          variant,
          usedFallback,
          redactedPreview: processedTranscript,
        },
      });
    }

    if (action === 'generate_deliverables') {
      const rawAnswers = Array.isArray(body.followUpAnswers)
        ? body.followUpAnswers
        : [];

      const sanitizedAnswers: FollowUpAnswer[] = rawAnswers.map((item) => {
        if (variant === 'B') {
          const r = redactPiiLocally(item.answer || '');
          piiResult.piiRedactedCount += r.piiRedactedCount;
          r.piiTypesDetected.forEach((t) => {
            if (!piiResult.piiTypesDetected.includes(t)) {
              piiResult.piiTypesDetected.push(t);
            }
          });
          return {
            ...item,
            answer: r.redactedText,
          };
        }
        return item;
      });

      const targetModel = 'models/gemini-3.8-flash';
      const displayModel =
        variant === 'A'
          ? 'gemini-3.8-flash (Monolithic Direct)'
          : 'gemma-4-26b-a4b-it → gemini-3.8-flash (Cascade)';

      const currencyContext =
        currency === 'GTQ'
          ? 'Quetzales guatemaltecos (GTQ, símbolo Q, ej. Copago estimado Q 120.00)'
          : 'Dólares estadounidenses (USD, símbolo $, ej. Estimated copay $ 15.00 USD)';

      const deliverablesPrompt = `Eres un sistema clínico avanzado de pre-consulta médica para telemedicina en Guatemala y Latinoamérica.
Con base en el relato inicial del paciente y sus respuestas a las 3 preguntas de seguimiento OPQRST, genera en español el Doble Entregable Clínico:
1. "patient_deliverable" ("Tu Pase de Pre-Consulta" en lenguaje empático, claro y accionable, con estimación de copago/consulta de referencia en ${currencyContext}).
2. "doctor_deliverable" (Ficha clínica estructurada con nivel de triaje VERDE/AMARILLO/ROJO, Red Flags, desglose OPQRST completo, nota SOAP, nota ISBAR y "evidence_quotes" con citas textuales exactas de lo que dijo el paciente).

Relato inicial del paciente:
"""
${processedTranscript}
"""

Respuestas a las 3 preguntas OPQRST:
${sanitizedAnswers
  .map((a, idx) => `P${idx + 1} (${a.question}): "${a.answer}"`)
  .join('\n')}

Devuelve ÚNICAMENTE un objeto JSON estricto con esta estructura exacta:
{
  "patient_deliverable": {
    "friendly_summary": "...",
    "questions_to_ask_doctor": ["Pregunta 1", "Pregunta 2", "Pregunta 3"],
    "prep_checklist": ["Item 1", "Item 2", "Item 3"],
    "urgency_notice": "...",
    "estimated_consultation_cost": "...",
    "recommended_modality": "..."
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
        "source": "Relato Inicial"
      }
    ]
  }
}`;

      let patientDeliverable: PatientDeliverable | null = null;
      let doctorDeliverable: DoctorDeliverable | null = null;
      let usedFallback = false;

      try {
        const parsed = (await callGenerativeLanguageModel(
          targetModel,
          deliverablesPrompt,
          true
        )) as {
          patient_deliverable?: PatientDeliverable;
          doctor_deliverable?: DoctorDeliverable;
        };

        if (
          parsed?.patient_deliverable?.friendly_summary &&
          parsed?.doctor_deliverable?.soap?.subjective &&
          parsed?.doctor_deliverable?.isbar?.situation &&
          parsed?.doctor_deliverable?.opqrst?.onset
        ) {
          patientDeliverable = parsed.patient_deliverable;
          doctorDeliverable = parsed.doctor_deliverable;
        }
      } catch {
        usedFallback = true;
      }

      if (!patientDeliverable || !doctorDeliverable) {
        usedFallback = true;
        const fallback = buildDeterministicDeliverables(
          processedTranscript,
          sanitizedAnswers,
          currency
        );
        patientDeliverable = fallback.patient_deliverable;
        doctorDeliverable = fallback.doctor_deliverable;
      }

      const latencyMs = Math.max(
        24,
        Math.round(performance.now() - startTime)
      );

      return NextResponse.json({
        patient_deliverable: patientDeliverable,
        doctor_deliverable: doctorDeliverable,
        telemetry: {
          latencyMs,
          modelUsed: displayModel,
          piiRedactedCount: piiResult.piiRedactedCount,
          piiTypesDetected: piiResult.piiTypesDetected,
          variant,
          usedFallback,
          redactedPreview: processedTranscript,
        },
      });
    }

    return NextResponse.json(
      { error: 'Acción no reconocida en /api/telemed' },
      { status: 400 }
    );
  } catch (error) {
    const latencyMs = Math.max(15, Math.round(performance.now() - startTime));
    const fallback = buildDeterministicDeliverables(
      'Paciente en pre-consulta de telemedicina',
      [],
      'GTQ'
    );
    return NextResponse.json({
      ...fallback,
      telemetry: {
        latencyMs,
        modelUsed: 'clinical-deterministic-fallback',
        piiRedactedCount: 0,
        piiTypesDetected: [],
        variant: 'B',
        usedFallback: true,
        errorDetail: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}
