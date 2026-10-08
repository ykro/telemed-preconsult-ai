'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Copy,
  Cpu,
  DollarSign,
  FileText,
  Globe,
  HeartPulse,
  HelpCircle,
  Layers,
  Mic,
  MicOff,
  Printer,
  Quote as QuoteIcon,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Stethoscope,
  UserCheck,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import {
  DEMO_PATIENT_CASES,
  redactPiiLocally,
} from '@/lib/clinical-engine';
import {
  ArchitectureVariant,
  ClinicalFramework,
  CurrencyCode,
  DeliverablesApiResponse,
  DoctorDeliverable,
  FollowUpAnswer,
  FollowUpApiResponse,
  FollowUpQuestion,
  PatientDeliverable,
  TelemetryMetadata,
  TriageLevel,
} from '@/types/telemed';

interface BrowserSpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      0: {
        transcript: string;
      };
    };
  };
}

interface BrowserSpeechRecognitionErrorEvent {
  error: string;
}

interface BrowserSpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechLocale = 'es-GT' | 'es-MX' | 'es-ES';

export default function TelemedPreConsultPage() {
  // Architecture & Currency Header Controls
  const [variant, setVariant] = useState<ArchitectureVariant>('B');
  const [currency, setCurrency] = useState<CurrencyCode>('GTQ');
  const [speechLocale, setSpeechLocale] = useState<SpeechLocale>('es-GT');

  // Step 1: Voice Capture & Transcript State
  const [selectedCaseId, setSelectedCaseId] = useState<string>(
    DEMO_PATIENT_CASES[0].id
  );
  const [transcript, setTranscript] = useState<string>(
    DEMO_PATIENT_CASES[0].transcript
  );
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [wordsPerMinute, setWordsPerMinute] = useState<number>(
    DEMO_PATIENT_CASES[0].simulatedWpm
  );
  const [speechSupported, setSpeechSupported] = useState<boolean>(true);
  const [voiceStatusMessage, setVoiceStatusMessage] = useState<string>(
    'Web Speech API lista para captura en tiempo real'
  );
  const [showRedactedPreview, setShowRedactedPreview] =
    useState<boolean>(false);

  // Step 2: 3 OPQRST Follow-Up Questions State
  const [isLoadingFollowUps, setIsLoadingFollowUps] = useState<boolean>(false);
  const [followUpQuestions, setFollowUpQuestions] = useState<
    FollowUpQuestion[]
  >([]);
  const [followUpAnswers, setFollowUpAnswers] = useState<
    Record<number, string>
  >({});
  const [activeVoiceQuestionId, setActiveVoiceQuestionId] = useState<
    number | null
  >(null);
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(true);
  const [isSpeakingTts, setIsSpeakingTts] = useState<boolean>(false);

  // Step 3: Dual Deliverables State
  const [isLoadingDeliverables, setIsLoadingDeliverables] =
    useState<boolean>(false);
  const [patientDeliverable, setPatientDeliverable] =
    useState<PatientDeliverable | null>(null);
  const [doctorDeliverable, setDoctorDeliverable] =
    useState<DoctorDeliverable | null>(null);
  const [clinicalFramework, setClinicalFramework] =
    useState<ClinicalFramework>('SOAP');
  const [checkedPrepItems, setCheckedPrepItems] = useState<
    Record<number, boolean>
  >({});
  const [copiedWhatsApp, setCopiedWhatsApp] = useState<boolean>(false);
  const [copiedClinicalNote, setCopiedClinicalNote] = useState<boolean>(false);
  const [deliverableViewTab, setDeliverableViewTab] = useState<
    'DUAL' | 'PATIENT' | 'DOCTOR'
  >('DUAL');

  // Telemetry State
  const [telemetry, setTelemetry] = useState<TelemetryMetadata>({
    latencyMs: 142,
    modelUsed: 'gemma-4-e2b / gemma-4-26b-a4b-it + gemini-3.8-flash',
    piiRedactedCount: 3,
    piiTypesDetected: ['Nombre Propio', 'DPI', 'Teléfono'],
    variant: 'B',
    usedFallback: false,
  });

  // Refs for Web Speech API & Timers
  const recognitionRef = useRef<BrowserSpeechRecognitionInstance | null>(null);
  const questionRecognitionRef =
    useRef<BrowserSpeechRecognitionInstance | null>(null);
  const recordingStartRef = useRef<number | null>(null);
  const step2SectionRef = useRef<HTMLDivElement | null>(null);
  const step3SectionRef = useRef<HTMLDivElement | null>(null);

  // Real-time local PII analysis on current transcript
  const livePiiAnalysis = useMemo(
    () => redactPiiLocally(transcript),
    [transcript]
  );

  const wordCount = useMemo(() => {
    const cleaned = transcript.trim();
    if (!cleaned) return 0;
    return cleaned.split(/\s+/).length;
  }, [transcript]);

  // Check browser support for Web Speech API on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const win = window as unknown as Record<string, unknown>;
      const SpeechRecognitionCtor =
        win.SpeechRecognition || win.webkitSpeechRecognition;
      setSpeechSupported(Boolean(SpeechRecognitionCtor));
    }
  }, []);

  // Timer for live recording duration & WPM calculation
  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => {
      setRecordingSeconds((prev) => {
        const next = prev + 1;
        const currentWords = transcript
          .trim()
          .split(/\s+/)
          .filter(Boolean).length;
        if (next > 2 && currentWords > 0) {
          const calculatedWpm = Math.min(
            220,
            Math.max(85, Math.round((currentWords / next) * 60))
          );
          setWordsPerMinute(calculatedWpm);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isRecording, transcript]);

  // Stop speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Start / Stop Live Voice Capture (Step 1)
  const toggleVoiceRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      setInterimTranscript('');
      setVoiceStatusMessage('Grabación finalizada · Transcripción lista');
      return;
    }

    if (typeof window === 'undefined') return;
    const win = window as unknown as Record<string, unknown>;
    const SpeechRecognitionCtor = (win.SpeechRecognition ||
      win.webkitSpeechRecognition) as
      | (new () => BrowserSpeechRecognitionInstance)
      | undefined;

    if (!SpeechRecognitionCtor) {
      setVoiceStatusMessage(
        'Web Speech API no disponible en este navegador; usa edición directa o los 3 Casos Demo.'
      );
      return;
    }

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = speechLocale;
      recognition.continuous = true;
      recognition.interimResults = true;

      recordingStartRef.current = Date.now();
      setRecordingSeconds(0);

      recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
        let finalChunk = '';
        let interimChunk = '';

        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const piece = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalChunk += `${piece} `;
          } else {
            interimChunk += piece;
          }
        }

        if (finalChunk) {
          setTranscript((prev) => `${prev.trim()} ${finalChunk.trim()}`.trim());
        }
        setInterimTranscript(interimChunk);
      };

      recognition.onerror = (event: BrowserSpeechRecognitionErrorEvent) => {
        setVoiceStatusMessage(
          `Aviso de micrófono (${event.error}): Puedes continuar editando el texto o usar los Casos Clínicos Demo.`
        );
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
        setInterimTranscript('');
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
      setVoiceStatusMessage(
        `Escuchando en vivo (${speechLocale})... Habla con naturalidad sobre tus síntomas`
      );
    } catch {
      setVoiceStatusMessage(
        'No se pudo iniciar el micrófono. Verifica los permisos del navegador.'
      );
      setIsRecording(false);
    }
  };

  // Dictate answer for a specific Follow-Up Question (Step 2)
  const toggleQuestionVoiceAnswer = (questionId: number) => {
    if (activeVoiceQuestionId === questionId) {
      if (questionRecognitionRef.current) {
        questionRecognitionRef.current.stop();
      }
      setActiveVoiceQuestionId(null);
      return;
    }

    if (typeof window === 'undefined') return;
    const win = window as unknown as Record<string, unknown>;
    const SpeechRecognitionCtor = (win.SpeechRecognition ||
      win.webkitSpeechRecognition) as
      | (new () => BrowserSpeechRecognitionInstance)
      | undefined;

    if (!SpeechRecognitionCtor) return;

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = speechLocale;
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
        const spokenAnswer = event.results[0]?.[0]?.transcript;
        if (spokenAnswer) {
          setFollowUpAnswers((prev) => ({
            ...prev,
            [questionId]: spokenAnswer.trim(),
          }));
        }
      };

      recognition.onend = () => {
        setActiveVoiceQuestionId(null);
      };

      recognition.onerror = () => {
        setActiveVoiceQuestionId(null);
      };

      questionRecognitionRef.current = recognition;
      setActiveVoiceQuestionId(questionId);
      recognition.start();
    } catch {
      setActiveVoiceQuestionId(null);
    }
  };

  // Speak text aloud using window.speechSynthesis
  const speakTextAloud = (textToSpeak: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = speechLocale;
    utterance.rate = 1.03;
    utterance.onstart = () => setIsSpeakingTts(true);
    utterance.onend = () => setIsSpeakingTts(false);
    utterance.onerror = () => setIsSpeakingTts(false);
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeakingAloud = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeakingTts(false);
    }
  };

  // Load 1-Click Realistic Demo Patient Case
  const handleSelectDemoCase = (demoCaseId: string) => {
    const found = DEMO_PATIENT_CASES.find((c) => c.id === demoCaseId);
    if (!found) return;

    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }

    setSelectedCaseId(found.id);
    setTranscript(found.transcript);
    setWordsPerMinute(found.simulatedWpm);
    setFollowUpQuestions([]);
    setFollowUpAnswers({});
    setPatientDeliverable(null);
    setDoctorDeliverable(null);
    setVoiceStatusMessage(
      `Caso clínico cargado (${found.simulatedWpm} palabras/min simuladas)`
    );
  };

  // Trigger Step 2: Generate 3 OPQRST Follow-Up Questions
  const handleGenerateFollowUps = async () => {
    if (!transcript.trim()) return;
    setIsLoadingFollowUps(true);
    setPatientDeliverable(null);
    setDoctorDeliverable(null);

    try {
      const response = await fetch('/api/telemed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_followups',
          transcript,
          variant,
        }),
      });

      const data = (await response.json()) as FollowUpApiResponse;
      if (data.follow_up_questions) {
        setFollowUpQuestions(data.follow_up_questions);
        // Pre-select the first quick option for instant demo ergonomics while allowing 1-tap change
        const initialAnswers: Record<number, string> = {};
        data.follow_up_questions.forEach((q) => {
          if (q.quick_options && q.quick_options[0]) {
            initialAnswers[q.id] = q.quick_options[0];
          }
        });
        setFollowUpAnswers(initialAnswers);

        if (data.telemetry) {
          setTelemetry(data.telemetry);
        }

        if (ttsEnabled && data.follow_up_questions[0]) {
          speakTextAloud(
            `Para completar tu pre-consulta, responde estas tres preguntas rápidas. Primera pregunta: ${data.follow_up_questions[0].question}`
          );
        }

        setTimeout(() => {
          step2SectionRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }, 120);
      }
    } finally {
      setIsLoadingFollowUps(false);
    }
  };

  // Trigger Step 3: Generate Dual Deliverables (Patient Pass + Doctor SOAP/ISBAR)
  const handleGenerateDeliverables = async (
    overrideCurrency?: CurrencyCode
  ) => {
    if (!transcript.trim() || followUpQuestions.length === 0) return;
    setIsLoadingDeliverables(true);

    const activeCurrency = overrideCurrency || currency;
    const formattedAnswers: FollowUpAnswer[] = followUpQuestions.map((q) => ({
      id: q.id,
      question: q.question,
      answer:
        followUpAnswers[q.id] ||
        q.quick_options[0] ||
        'Confirmado por el paciente',
      opqrst_target: q.opqrst_target,
    }));

    try {
      const response = await fetch('/api/telemed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_deliverables',
          transcript,
          followUpAnswers: formattedAnswers,
          variant,
          currency: activeCurrency,
        }),
      });

      const data = (await response.json()) as DeliverablesApiResponse;
      if (data.patient_deliverable && data.doctor_deliverable) {
        setPatientDeliverable(data.patient_deliverable);
        setDoctorDeliverable(data.doctor_deliverable);
        setCheckedPrepItems({ 0: true });

        if (data.telemetry) {
          setTelemetry(data.telemetry);
        }

        if (!overrideCurrency) {
          setTimeout(() => {
            step3SectionRef.current?.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            });
          }, 120);
        }
      }
    } finally {
      setIsLoadingDeliverables(false);
    }
  };

  // Re-compute currency display when user toggles GTQ / USD while deliverables are open
  const handleCurrencyChange = (nextCurrency: CurrencyCode) => {
    setCurrency(nextCurrency);
    if (patientDeliverable && doctorDeliverable) {
      handleGenerateDeliverables(nextCurrency);
    }
  };

  // Copy Patient Pass formatted for WhatsApp
  const handleCopyForWhatsApp = async () => {
    if (!patientDeliverable || !doctorDeliverable) return;
    const lines = [
      '🩺 *PASE DE PRE-CONSULTA TELEMED AI*',
      `📊 *Prioridad de Triaje:* ${doctorDeliverable.triage_level}`,
      '',
      '📋 *Tu Resumen en Palabras Simples:*',
      patientDeliverable.friendly_summary,
      '',
      '❓ *3 Preguntas Sugeridas para tu Médico:*',
      ...patientDeliverable.questions_to_ask_doctor.map(
        (q, i) => `${i + 1}. ${q}`
      ),
      '',
      '✅ *Checklist Pre-Videollamada:*',
      ...patientDeliverable.prep_checklist.map((item) => `• ${item}`),
      '',
      `💳 *Referencia:* ${patientDeliverable.estimated_consultation_cost}`,
      `⚠️ *Aviso Clínico:* ${patientDeliverable.urgency_notice}`,
    ];

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedWhatsApp(true);
      setTimeout(() => setCopiedWhatsApp(false), 2600);
    } catch {
      // Clipboard fallback
    }
  };

  // Copy Doctor Clinical Note (SOAP or ISBAR)
  const handleCopyClinicalNote = async () => {
    if (!doctorDeliverable) return;
    const noteText =
      clinicalFramework === 'SOAP'
        ? [
            `FICHA CLÍNICA PRE-CONSULTA (SOAP) — TRIAJE: ${doctorDeliverable.triage_level}`,
            `RED FLAGS: ${doctorDeliverable.red_flags.join(' | ')}`,
            `[S] SUBJETIVO: ${doctorDeliverable.soap.subjective}`,
            `[O] OBJETIVO: ${doctorDeliverable.soap.objective}`,
            `[A] ANÁLISIS / EVALUACIÓN: ${doctorDeliverable.soap.assessment}`,
            `[P] PLAN: ${doctorDeliverable.soap.plan}`,
          ].join('\n\n')
        : [
            `FICHA CLÍNICA PRE-CONSULTA (ISBAR) — TRIAJE: ${doctorDeliverable.triage_level}`,
            `[I] IDENTIFICACIÓN: ${doctorDeliverable.isbar.identification}`,
            `[S] SITUACIÓN: ${doctorDeliverable.isbar.situation}`,
            `[B] ANTECEDENTES (BACKGROUND): ${doctorDeliverable.isbar.background}`,
            `[A] EVALUACIÓN (ASSESSMENT): ${doctorDeliverable.isbar.assessment}`,
            `[R] RECOMENDACIÓN: ${doctorDeliverable.isbar.recommendation}`,
          ].join('\n\n');

    try {
      await navigator.clipboard.writeText(noteText);
      setCopiedClinicalNote(true);
      setTimeout(() => setCopiedClinicalNote(false), 2600);
    } catch {
      // Clipboard fallback
    }
  };

  const renderTriageBadge = (level: TriageLevel) => {
    if (level === 'ROJO') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700 ring-1 ring-inset ring-rose-600/30">
          <span className="h-2 w-2 rounded-full bg-rose-600 animate-ping" />
          TRIAJE ROJO · EMERGENCIA INMEDIATA
        </span>
      );
    }
    if (level === 'AMARILLO') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 ring-1 ring-inset ring-amber-600/30">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          TRIAJE AMARILLO · PRIORIDAD MEDIA-ALTA
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/30">
        <span className="h-2 w-2 rounded-full bg-emerald-600" />
        TRIAJE VERDE · CONSULTA ESTÁNDAR
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Top Clinical Header with PWA Status, Currency Switch & Live A/B Architecture Selector */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs no-print">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Brand + PWA Status Badge */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white shadow-xs">
                  <Stethoscope className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                      Telemed Pre-Consult AI
                    </h1>
                    <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-700 ring-1 ring-inset ring-teal-600/20">
                      <Smartphone className="h-3 w-3" />
                      PWA Mobile-First
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Triaje clínico por voz · Protocolo OPQRST · Pase del
                    Paciente y Ficha SOAP / ISBAR
                  </p>
                </div>
              </div>

              {/* Mobile Currency Toggle */}
              <div className="flex lg:hidden items-center rounded-lg bg-slate-100 p-0.5 border border-slate-200">
                <button
                  type="button"
                  onClick={() => handleCurrencyChange('GTQ')}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                    currency === 'GTQ'
                      ? 'bg-white text-sky-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  GTQ (Q)
                </button>
                <button
                  type="button"
                  onClick={() => handleCurrencyChange('USD')}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                    currency === 'USD'
                      ? 'bg-white text-sky-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  USD ($)
                </button>
              </div>
            </div>

            {/* Right Controls: A/B Architecture Switch + Currency Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* A/B Architecture Switch */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 rounded-xl bg-slate-100 p-1 border border-slate-200 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    setVariant('A');
                    setTelemetry((prev) => ({
                      ...prev,
                      variant: 'A',
                      modelUsed: 'gemini-3.8-flash (Monolithic Direct)',
                      piiRedactedCount: 0,
                    }));
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    variant === 'A'
                      ? 'bg-white text-sky-700 shadow-xs ring-1 ring-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Zap className="h-3.5 w-3.5 text-sky-600" />
                  <span>Variante A: Gemini 3.8 Flash Directo</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setVariant('B');
                    setTelemetry((prev) => ({
                      ...prev,
                      variant: 'B',
                      modelUsed:
                        'gemma-4-26b-a4b-it + gemini-3.8-flash (Cascade)',
                      piiRedactedCount: livePiiAnalysis.piiRedactedCount,
                      piiTypesDetected: livePiiAnalysis.piiTypesDetected,
                    }));
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    variant === 'B'
                      ? 'bg-white text-teal-700 shadow-xs ring-1 ring-teal-600/30'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
                  <span>Variante B: Cascada Gemma 4 + Gemini 3.8 Flash</span>
                </button>
              </div>

              {/* Desktop Currency Toggle */}
              <div className="hidden lg:flex items-center gap-1 rounded-xl bg-slate-100 p-1 border border-slate-200">
                <Globe className="ml-2 h-3.5 w-3.5 text-slate-500" />
                <button
                  type="button"
                  onClick={() => handleCurrencyChange('GTQ')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    currency === 'GTQ'
                      ? 'bg-white text-sky-700 shadow-xs ring-1 ring-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  GTQ (Q)
                </button>
                <button
                  type="button"
                  onClick={() => handleCurrencyChange('USD')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    currency === 'USD'
                      ? 'bg-white text-sky-700 shadow-xs ring-1 ring-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  USD ($)
                </button>
              </div>
            </div>
          </div>

          {/* Live Telemetry Sub-Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 py-2 text-xs text-slate-600">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                <Cpu className="h-3.5 w-3.5 text-sky-600" />
                <span>Arquitectura Activa:</span>
                <strong className="font-semibold text-slate-900">
                  {variant === 'A'
                    ? 'Monolithic Cloud (models/gemini-3.8-flash)'
                    : 'Edge-Assisted Cascade (PII Local + models/gemma-4-26b-a4b-it → models/gemini-3.8-flash)'}
                </strong>
              </span>

              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-800">
                <Clock className="h-3 w-3 text-sky-600" />
                Latencia: {telemetry.latencyMs} ms
              </span>

              <span
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                  variant === 'B'
                    ? 'bg-teal-50 text-teal-800 ring-1 ring-inset ring-teal-600/20'
                    : 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/20'
                }`}
              >
                <ShieldCheck className="h-3 w-3" />
                {variant === 'B'
                  ? `PII Protegidos Localmente: ${livePiiAnalysis.piiRedactedCount} (${
                      livePiiAnalysis.piiTypesDetected.join(', ') || 'Ninguno'
                    })`
                  : `PII sin anonimización previa (${livePiiAnalysis.piiRedactedCount} detectados en texto)`}
              </span>
            </div>

            {/* Step Progress Indicator */}
            <div className="hidden md:flex items-center gap-2 text-xs font-medium">
              <span className="inline-flex items-center gap-1 text-sky-700 font-semibold">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-sky-600 text-[10px] text-white">
                  1
                </span>
                Relato por Voz
              </span>
              <ArrowRight className="h-3 w-3 text-slate-400" />
              <span
                className={`inline-flex items-center gap-1 ${
                  followUpQuestions.length > 0
                    ? 'text-sky-700 font-semibold'
                    : 'text-slate-500'
                }`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                    followUpQuestions.length > 0
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  2
                </span>
                3 Preguntas OPQRST
              </span>
              <ArrowRight className="h-3 w-3 text-slate-400" />
              <span
                className={`inline-flex items-center gap-1 ${
                  patientDeliverable && doctorDeliverable
                    ? 'text-teal-700 font-semibold'
                    : 'text-slate-500'
                }`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                    patientDeliverable && doctorDeliverable
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  3
                </span>
                Doble Entregable
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8 space-y-8">
        {/* STEP 1: CAPTURA RÁPIDA DE SÍNTOMAS POR VOZ + CASOS DEMO */}
        <section className="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden no-print">
          <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-sm font-bold text-white">
                1
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Paso 1: Captura Rápida de Síntomas por Voz (30–90s)
                </h2>
                <p className="text-xs sm:text-sm text-slate-600">
                  Habla rápido y sin filtro como si le enviaras una nota de voz
                  al médico, o selecciona un paciente simulado con 1 clic.
                </p>
              </div>
            </div>

            {/* Speech Locale Selector */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <label
                htmlFor="speech-locale"
                className="text-xs font-medium text-slate-600"
              >
                Voz Web Speech:
              </label>
              <select
                id="speech-locale"
                value={speechLocale}
                onChange={(e) =>
                  setSpeechLocale(e.target.value as SpeechLocale)
                }
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs focus:border-sky-600 focus:outline-none"
              >
                <option value="es-GT">Español (Guatemala · es-GT)</option>
                <option value="es-MX">Español (México · es-MX)</option>
                <option value="es-ES">Español (España · es-ES)</option>
              </select>
            </div>
          </div>

          <div className="p-5 sm:p-6 space-y-6">
            {/* 3 1-Click Realistic Demo Patient Buttons */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Pacientes Simulados Realistas (1 Clic para Demo):
                </span>
                <span className="text-xs text-slate-500">
                  Incluyen datos PII (DPI, NIT, teléfono) para probar la
                  anonimización en Variante B
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {DEMO_PATIENT_CASES.map((demoCase) => {
                  const isSelected = selectedCaseId === demoCase.id;
                  const isRedFlag = demoCase.triageHint === 'ROJO';
                  return (
                    <button
                      key={demoCase.id}
                      type="button"
                      onClick={() => handleSelectDemoCase(demoCase.id)}
                      className={`group text-left rounded-xl p-3.5 border transition all ${
                        isSelected
                          ? isRedFlag
                            ? 'bg-rose-50/60 border-rose-500 ring-2 ring-rose-500/20 shadow-xs'
                            : 'bg-sky-50/70 border-sky-600 ring-2 ring-sky-600/20 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-sky-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                            isRedFlag
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-sky-100 text-sky-800'
                          }`}
                        >
                          {isRedFlag ? (
                            <AlertTriangle className="h-3 w-3 text-rose-600" />
                          ) : (
                            <Activity className="h-3 w-3 text-sky-600" />
                          )}
                          {demoCase.badge}
                        </span>
                        <span className="text-[11px] font-mono font-semibold text-slate-500">
                          ~{demoCase.simulatedWpm} PPM
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-900 group-hover:text-sky-700">
                        {demoCase.title}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600 line-clamp-2">
                        {demoCase.subtitle}
                      </p>
                      <p className="mt-2 text-[11px] font-medium text-slate-500">
                        {demoCase.patientProfile}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Microphone Control + Animated Waveform + WPM Counter */}
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={toggleVoiceRecording}
                    className={`inline-flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-bold shadow-xs transition ${
                      isRecording
                        ? 'bg-rose-600 text-white hover:bg-rose-700 ring-4 ring-rose-600/20'
                        : 'bg-sky-600 text-white hover:bg-sky-700'
                    }`}
                  >
                    {isRecording ? (
                      <>
                        <MicOff className="h-4 w-4 animate-pulse" />
                        <span>Detener Micrófono ({recordingSeconds}s)</span>
                      </>
                    ) : (
                      <>
                        <Mic className="h-4 w-4" />
                        <span>Iniciar Dictado por Voz en Vivo</span>
                      </>
                    )}
                  </button>

                  {/* Live Animated Waveform Bars */}
                  <div className="flex items-center gap-3 rounded-lg bg-white px-3.5 py-2 border border-slate-200">
                    <div className="flex items-end gap-1 h-5">
                      {[0.1, 0.25, 0.4, 0.15, 0.35, 0.5, 0.2, 0.45, 0.3, 0.15].map(
                        (delay, idx) => (
                          <span
                            key={idx}
                            style={{
                              animationDelay: `${delay}s`,
                              height: isRecording
                                ? `${10 + ((idx * 7) % 12)}px`
                                : '6px',
                            }}
                            className={`w-1 rounded-full transition-all ${
                              isRecording
                                ? 'bg-rose-500 waveform-bar'
                                : 'bg-sky-500/50'
                            }`}
                          />
                        )
                      )}
                    </div>
                    <span className="text-xs font-medium text-slate-700">
                      {voiceStatusMessage}
                    </span>
                  </div>
                </div>

                {/* Speed Counter (WPM / PPM) & Word Count */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-lg bg-white px-3 py-1.5 border border-slate-200 text-xs">
                    <span className="text-slate-500">Velocidad de Habla: </span>
                    <strong className="font-mono font-bold text-sky-700">
                      {wordsPerMinute} palabras/min
                    </strong>
                  </div>
                  <div className="rounded-lg bg-white px-3 py-1.5 border border-slate-200 text-xs">
                    <span className="text-slate-500">Longitud: </span>
                    <strong className="font-mono font-bold text-slate-800">
                      {wordCount} palabras
                    </strong>
                  </div>
                  {!speechSupported && (
                    <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 border border-amber-200">
                      Modo Texto / Demo Activo
                    </span>
                  )}
                </div>
              </div>

              {/* Editable Patient Transcript Box */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="patient-transcript"
                    className="text-xs font-bold uppercase tracking-wider text-slate-600"
                  >
                    Transcripción del Relato del Paciente (Editable en Vivo):
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setShowRedactedPreview((prev) => !prev)
                    }
                    className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {showRedactedPreview
                      ? 'Ver texto original con datos sensibles'
                      : `Ver vista previa anonimizada (${livePiiAnalysis.piiRedactedCount} PII protegidos)`}
                  </button>
                </div>

                {showRedactedPreview ? (
                  <div className="rounded-xl border border-teal-300 bg-teal-50/50 p-3.5 text-sm text-slate-800 leading-relaxed">
                    <div className="mb-1.5 flex items-center gap-2 text-xs font-bold text-teal-800">
                      <ShieldCheck className="h-4 w-4 text-teal-600" />
                      <span>
                        Filtro Edge PII Activo (Lo que se envía a la nube en
                        Variante B):
                      </span>
                    </div>
                    <p className="font-mono text-xs sm:text-sm">
                      {livePiiAnalysis.redactedText}
                    </p>
                  </div>
                ) : (
                  <textarea
                    id="patient-transcript"
                    rows={4}
                    value={
                      interimTranscript
                        ? `${transcript} ${interimTranscript}`
                        : transcript
                    }
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder="Presiona 'Iniciar Dictado por Voz en Vivo' o escribe aquí cómo te sientes, desde cuándo empezó y qué has tomado..."
                    className="w-full rounded-xl border border-slate-200 bg-white p-3.5 text-sm text-slate-900 shadow-2xs focus:border-sky-600 focus:ring-2 focus:ring-sky-600/20 focus:outline-none leading-relaxed"
                  />
                )}
              </div>

              {/* Action Bar to Launch Step 2 */}
              <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-slate-200/80">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Sparkles className="h-4 w-4 text-sky-600 shrink-0" />
                  <span>
                    {variant === 'B'
                      ? 'En Variante B, Gemma 4 evalúa huecos OPQRST tras enmascarar DPI, NIT, teléfono y nombre propio.'
                      : 'En Variante A, Gemini 3.8 Flash analiza directamente el relato para generar las 3 preguntas OPQRST.'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateFollowUps}
                  disabled={isLoadingFollowUps || !transcript.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-sky-700 disabled:opacity-50 transition cursor-pointer"
                >
                  {isLoadingFollowUps ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Analizando Huecos OPQRST...</span>
                    </>
                  ) : (
                    <>
                      <span>Generar 3 Preguntas Rápidas Follow-Up</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* STEP 2: 3 PREGUNTAS RÁPIDAS DE FOLLOW-UP (OPQRST) */}
        <div ref={step2SectionRef}>
          {followUpQuestions.length > 0 && (
            <section className="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden no-print">
              <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-sm font-bold text-white">
                    2
                  </span>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">
                      Paso 2: 3 Preguntas Rápidas de Seguimiento (Protocolo
                      OPQRST)
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600">
                      Responde con 1 toque en los chips sugeridos, por voz corta
                      o escribiendo tu respuesta.
                    </p>
                  </div>
                </div>

                {/* TTS Readout Controls */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (isSpeakingTts) {
                        stopSpeakingAloud();
                      } else {
                        const allQuestionsText = followUpQuestions
                          .map((q, idx) => `Pregunta ${idx + 1}: ${q.question}`)
                          .join('. ');
                        speakTextAloud(allQuestionsText);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
                  >
                    {isSpeakingTts ? (
                      <>
                        <VolumeX className="h-3.5 w-3.5 text-rose-600" />
                        <span>Detener Lectura por Voz</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-3.5 w-3.5 text-sky-600" />
                        <span>Leer las 3 Preguntas en Voz Alta</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setTtsEnabled((prev) => !prev)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold border transition ${
                      ttsEnabled
                        ? 'bg-sky-50 text-sky-700 border-sky-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    TTS Auto: {ttsEnabled ? 'Sí' : 'No'}
                  </button>
                </div>
              </div>

              <div className="p-5 sm:p-6 space-y-5">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  {followUpQuestions.map((q, idx) => {
                    const currentAnswer = followUpAnswers[q.id] || '';
                    const isListeningThisQuestion =
                      activeVoiceQuestionId === q.id;

                    return (
                      <div
                        key={q.id}
                        className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-4 shadow-2xs"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-800 ring-1 ring-inset ring-teal-600/20">
                              Pregunta {idx + 1} de 3 · {q.opqrst_target}
                            </span>
                            <button
                              type="button"
                              onClick={() => speakTextAloud(q.question)}
                              title="Escuchar pregunta en voz alta"
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-sky-600 transition"
                            >
                              <Volume2 className="h-4 w-4" />
                            </button>
                          </div>

                          <p className="text-sm font-bold text-slate-900 leading-snug mb-3">
                            {q.question}
                          </p>

                          {/* 1-Tap Quick Answer Chips */}
                          <div className="space-y-1.5 mb-3">
                            <span className="text-[11px] font-semibold text-slate-500 block">
                              Respuesta rápida con 1 toque:
                            </span>
                            <div className="flex flex-col gap-1.5">
                              {q.quick_options.map((option) => {
                                const isChosen = currentAnswer === option;
                                return (
                                  <button
                                    key={option}
                                    type="button"
                                    onClick={() =>
                                      setFollowUpAnswers((prev) => ({
                                        ...prev,
                                        [q.id]: option,
                                      }))
                                    }
                                    className={`text-left rounded-lg px-3 py-2 text-xs font-medium border transition flex items-center justify-between gap-2 ${
                                      isChosen
                                        ? 'bg-sky-600 text-white border-sky-600 font-semibold shadow-2xs'
                                        : 'bg-white text-slate-700 border-slate-200 hover:border-sky-300 hover:bg-sky-50/40'
                                    }`}
                                  >
                                    <span>{option}</span>
                                    {isChosen && (
                                      <Check className="h-3.5 w-3.5 shrink-0" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Custom Text Input + Voice Input Button */}
                        <div className="pt-2 border-t border-slate-200/80">
                          <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                            O personaliza / dicta tu respuesta:
                          </label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={currentAnswer}
                              onChange={(e) =>
                                setFollowUpAnswers((prev) => ({
                                  ...prev,
                                  [q.id]: e.target.value,
                                }))
                              }
                              placeholder="Escribe o dicta tu respuesta..."
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => toggleQuestionVoiceAnswer(q.id)}
                              title="Responder esta pregunta por voz"
                              className={`shrink-0 rounded-lg p-1.5 border transition ${
                                isListeningThisQuestion
                                  ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                                  : 'bg-white text-slate-600 border-slate-200 hover:text-sky-600'
                              }`}
                            >
                              <Mic className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Action Bar to Launch Step 3 */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl bg-sky-50/70 border border-sky-200 p-4">
                  <div className="flex items-center gap-2.5 text-xs text-slate-700">
                    <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0" />
                    <span>
                      Respuestas OPQRST listas. Al continuar,{' '}
                      <strong>gemini-3.8-flash</strong> generará en paralelo el{' '}
                      <strong>Pase del Paciente</strong> y la{' '}
                      <strong>Ficha Clínica SOAP / ISBAR</strong> en{' '}
                      <strong>{currency}</strong>.
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleGenerateDeliverables()}
                    disabled={isLoadingDeliverables}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-teal-700 disabled:opacity-50 transition cursor-pointer shrink-0"
                  >
                    {isLoadingDeliverables ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Generando Doble Entregable Clínico...</span>
                      </>
                    ) : (
                      <>
                        <span>
                          Generar Pase de Pre-Consulta + Ficha SOAP/ISBAR
                        </span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* STEP 3: DOBLE ENTREGABLE (VISTA PACIENTE & VISTA MÉDICO) */}
        <div ref={step3SectionRef}>
          {patientDeliverable && doctorDeliverable && (
            <section className="space-y-6">
              {/* Step 3 Header & View Switcher */}
              <div className="rounded-2xl bg-white border border-slate-200 p-4 sm:px-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-xs no-print">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">
                    3
                  </span>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">
                      Paso 3: Doble Entregable Clínico (Paciente + Médico)
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600">
                      Generado en <strong>{telemetry.latencyMs} ms</strong> vía{' '}
                      <span className="font-mono font-semibold text-sky-700">
                        {telemetry.modelUsed}
                      </span>
                    </p>
                  </div>
                </div>

                {/* View Mode Tabs */}
                <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-100 p-1 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setDeliverableViewTab('DUAL')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      deliverableViewTab === 'DUAL'
                        ? 'bg-white text-sky-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Vista Dual (Paciente + Médico)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliverableViewTab('PATIENT')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      deliverableViewTab === 'PATIENT'
                        ? 'bg-white text-teal-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    🧑‍💼 Solo Pase del Paciente
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliverableViewTab('DOCTOR')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      deliverableViewTab === 'DOCTOR'
                        ? 'bg-white text-sky-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    👩‍⚕️ Solo Ficha Médica (SOAP / ISBAR)
                  </button>
                </div>
              </div>

              {/* Dual Deliverable Grid */}
              <div
                className={`grid grid-cols-1 gap-6 ${
                  deliverableViewTab === 'DUAL' ? ' lg:grid-cols-12' : ''
                }`}
              >
                {/* LEFT COLUMN: ENTREGABLE PARA EL PACIENTE ("TU PASE DE PRE-CONSULTA") */}
                {(deliverableViewTab === 'DUAL' ||
                  deliverableViewTab === 'PATIENT') && (
                  <div
                    className={`${
                      deliverableViewTab === 'DUAL'
                        ? 'lg:col-span-5'
                        : 'max-w-3xl mx-auto w-full'
                    } rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between`}
                  >
                    <div>
                      {/* Patient Pass Header */}
                      <div className="bg-gradient-to-r from-sky-600 to-teal-600 px-5 py-4 text-white">
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white">
                            <UserCheck className="h-3.5 w-3.5" />
                            Entregable para el Paciente
                          </span>
                          <span className="text-xs font-mono text-sky-100">
                            Moneda: {currency}
                          </span>
                        </div>
                        <h3 className="mt-2 text-lg font-bold">
                          Tu Pase de Pre-Consulta Médica
                        </h3>
                        <p className="text-xs text-sky-100">
                          Guarda o comparte este resumen por WhatsApp antes de
                          entrar a tu videollamada.
                        </p>
                      </div>

                      <div className="p-5 space-y-5">
                        {/* Triage Semaphore Notice */}
                        <div
                          className={`rounded-xl p-3.5 border ${
                            doctorDeliverable.triage_level === 'ROJO'
                              ? 'bg-rose-50 border-rose-200 text-rose-900'
                              : doctorDeliverable.triage_level === 'AMARILLO'
                              ? 'bg-amber-50 border-amber-200 text-amber-900'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-xs font-bold uppercase tracking-wider">
                              Semáforo de Orientación Clínica
                            </span>
                            {renderTriageBadge(doctorDeliverable.triage_level)}
                          </div>
                          <p className="text-xs sm:text-sm font-medium leading-relaxed">
                            {patientDeliverable.urgency_notice}
                          </p>
                        </div>

                        {/* 1. Friendly Summary */}
                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
                            <HeartPulse className="h-4 w-4 text-sky-600" />
                            1. Tu Resumen en Palabras Simples
                          </h4>
                          <p className="text-sm text-slate-800 leading-relaxed">
                            {patientDeliverable.friendly_summary}
                          </p>
                        </div>

                        {/* 2. 3 Suggested Questions to Ask the Doctor */}
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5 flex items-center gap-1.5">
                            <HelpCircle className="h-4 w-4 text-teal-600" />
                            2. Tres Preguntas Clave para Hacerle a tu Médico
                          </h4>
                          <ul className="space-y-2">
                            {patientDeliverable.questions_to_ask_doctor.map(
                              (question, idx) => (
                                <li
                                  key={idx}
                                  className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3 text-xs sm:text-sm text-slate-800 shadow-2xs"
                                >
                                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-bold text-teal-700 ring-1 ring-teal-600/20">
                                    {idx + 1}
                                  </span>
                                  <span className="font-medium leading-snug">
                                    {question}
                                  </span>
                                </li>
                              )
                            )}
                          </ul>
                        </div>

                        {/* 3. Pre-Call Preparation Checklist */}
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5 flex items-center gap-1.5">
                            <ClipboardCheck className="h-4 w-4 text-sky-600" />
                            3. Checklist Pre-Llamada (Próximos 5 Minutos)
                          </h4>
                          <div className="space-y-2">
                            {patientDeliverable.prep_checklist.map(
                              (item, idx) => {
                                const isChecked = Boolean(
                                  checkedPrepItems[idx]
                                );
                                return (
                                  <label
                                    key={idx}
                                    className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs sm:text-sm cursor-pointer transition ${
                                      isChecked
                                        ? 'bg-emerald-50/50 border-emerald-200 text-slate-700'
                                        : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() =>
                                        setCheckedPrepItems((prev) => ({
                                          ...prev,
                                          [idx]: !prev[idx],
                                        }))
                                      }
                                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-600"
                                    />
                                    <span
                                      className={
                                        isChecked
                                          ? 'line-through text-slate-500'
                                          : 'font-medium'
                                      }
                                    >
                                      {item}
                                    </span>
                                  </label>
                                );
                              }
                            )}
                          </div>
                        </div>

                        {/* 4. Estimated Reference Consultation / Copay Value in GTQ or USD */}
                        <div className="rounded-xl bg-sky-50/70 border border-sky-200 p-3.5 flex items-start gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white">
                            <DollarSign className="h-4 w-4" />
                          </div>
                          <div className="text-xs">
                            <span className="font-bold text-slate-900 block">
                              Modalidad y Copago de Referencia ({currency}):
                            </span>
                            <span className="text-slate-700 font-medium block mt-0.5">
                              {patientDeliverable.recommended_modality}
                            </span>
                            <span className="text-sky-800 font-semibold block mt-1">
                              {patientDeliverable.estimated_consultation_cost}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Export / Share Buttons */}
                    <div className="border-t border-slate-200 bg-slate-50 p-4 flex flex-wrap items-center gap-2.5 no-print">
                      <button
                        type="button"
                        onClick={handleCopyForWhatsApp}
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition cursor-pointer"
                      >
                        {copiedWhatsApp ? (
                          <>
                            <Check className="h-4 w-4" />
                            <span>¡Copiado para WhatsApp!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            <span>Copiar para WhatsApp</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                      >
                        <Printer className="h-4 w-4 text-sky-600" />
                        <span>Descargar / Imprimir Pase</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* RIGHT COLUMN: ENTREGABLE PARA EL MÉDICO (FICHA CLÍNICA ESTANDARIZADA SOAP / ISBAR) */}
                {(deliverableViewTab === 'DUAL' ||
                  deliverableViewTab === 'DOCTOR') && (
                  <div
                    className={`${
                      deliverableViewTab === 'DUAL'
                        ? 'lg:col-span-7'
                        : 'max-w-4xl mx-auto w-full'
                    } rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between`}
                  >
                    <div>
                      {/* Doctor Clinical Header + Instant SOAP <-> ISBAR Toggle */}
                      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-md bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-800">
                              <Stethoscope className="h-3.5 w-3.5" />
                              Entregable para el Médico
                            </span>
                            {renderTriageBadge(doctorDeliverable.triage_level)}
                          </div>
                          <h3 className="mt-1.5 text-lg font-bold text-slate-900">
                            Ficha Clínica Estandarizada Pre-Consulta
                          </h3>
                        </div>

                        {/* Instant SOAP <-> ISBAR Switcher */}
                        <div className="flex items-center gap-2 no-print">
                          <div className="flex items-center rounded-xl bg-slate-200/80 p-1 border border-slate-300/80">
                            <button
                              type="button"
                              onClick={() => setClinicalFramework('SOAP')}
                              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                                clinicalFramework === 'SOAP'
                                  ? 'bg-sky-600 text-white shadow-xs'
                                  : 'text-slate-700 hover:text-slate-900'
                              }`}
                            >
                              Formato SOAP
                            </button>
                            <button
                              type="button"
                              onClick={() => setClinicalFramework('ISBAR')}
                              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                                clinicalFramework === 'ISBAR'
                                  ? 'bg-teal-600 text-white shadow-xs'
                                  : 'text-slate-700 hover:text-slate-900'
                              }`}
                            >
                              Formato ISBAR
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={handleCopyClinicalNote}
                            title="Copiar nota clínica para expediente electrónico (EHR)"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 shadow-2xs cursor-pointer"
                          >
                            {copiedClinicalNote ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                                <span className="text-emerald-700">
                                  Copiado
                                </span>
                              </>
                            ) : (
                              <>
                                <FileText className="h-3.5 w-3.5 text-sky-600" />
                                <span>Copiar {clinicalFramework}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="p-5 space-y-5">
                        {/* RED FLAGS ALERT BANNER */}
                        <div
                          className={`rounded-xl p-4 border ${
                            doctorDeliverable.triage_level === 'ROJO'
                              ? 'bg-rose-50 border-rose-300'
                              : 'bg-amber-50/80 border-amber-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle
                              className={`h-4 w-4 ${
                                doctorDeliverable.triage_level === 'ROJO'
                                  ? 'text-rose-600'
                                  : 'text-amber-600'
                              }`}
                            />
                            <h4
                              className={`text-xs font-bold uppercase tracking-wider ${
                                doctorDeliverable.triage_level === 'ROJO'
                                  ? 'text-rose-900'
                                  : 'text-amber-900'
                              }`}
                            >
                              Signos de Alarma y Red Flags Detectadas (
                              {doctorDeliverable.red_flags.length})
                            </h4>
                          </div>
                          <ul className="space-y-1">
                            {doctorDeliverable.red_flags.map((flag, idx) => (
                              <li
                                key={idx}
                                className={`text-xs sm:text-sm font-semibold flex items-start gap-2 ${
                                  doctorDeliverable.triage_level === 'ROJO'
                                    ? 'text-rose-800'
                                    : 'text-amber-900'
                                }`}
                              >
                                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-current shrink-0" />
                                <span>{flag}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* SOAP vs ISBAR Dynamic View */}
                        {clinicalFramework === 'SOAP' ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                <Layers className="h-4 w-4 text-sky-600" />
                                Nota Estructurada SOAP
                              </h4>
                              <span className="text-[11px] text-slate-500">
                                Subjetivo · Objetivo · Evaluación · Plan
                              </span>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
                                <span className="inline-block rounded-md bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-800 mb-1.5">
                                  S · Subjetivo
                                </span>
                                <p className="text-xs sm:text-sm text-slate-800 leading-relaxed">
                                  {doctorDeliverable.soap.subjective}
                                </p>
                              </div>

                              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
                                <span className="inline-block rounded-md bg-teal-100 px-2 py-0.5 text-[11px] font-bold text-teal-800 mb-1.5">
                                  O · Objetivo (Tele-Triaje)
                                </span>
                                <p className="text-xs sm:text-sm text-slate-800 leading-relaxed">
                                  {doctorDeliverable.soap.objective}
                                </p>
                              </div>

                              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
                                <span className="inline-block rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900 mb-1.5">
                                  A · Evaluación / Impresión Diagnóstica
                                </span>
                                <p className="text-xs sm:text-sm text-slate-800 leading-relaxed">
                                  {doctorDeliverable.soap.assessment}
                                </p>
                              </div>

                              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
                                <span className="inline-block rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800 mb-1.5">
                                  P · Plan Sugerido en Consulta
                                </span>
                                <p className="text-xs sm:text-sm text-slate-800 leading-relaxed">
                                  {doctorDeliverable.soap.plan}
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                <Layers className="h-4 w-4 text-teal-600" />
                                Traspaso Estructurado ISBAR
                              </h4>
                              <span className="text-[11px] text-slate-500">
                                Estándar OMS de Comunicación Clínica
                              </span>
                            </div>

                            <div className="space-y-2.5">
                              {[
                                {
                                  letter: 'I',
                                  title: 'Identification (Identificación)',
                                  value: doctorDeliverable.isbar.identification,
                                  color: 'bg-sky-100 text-sky-800',
                                },
                                {
                                  letter: 'S',
                                  title: 'Situation (Situación Principal)',
                                  value: doctorDeliverable.isbar.situation,
                                  color: 'bg-teal-100 text-teal-800',
                                },
                                {
                                  letter: 'B',
                                  title: 'Background (Contexto y Antecedentes)',
                                  value: doctorDeliverable.isbar.background,
                                  color: 'bg-slate-200 text-slate-800',
                                },
                                {
                                  letter: 'A',
                                  title: 'Assessment (Evaluación Clínica)',
                                  value: doctorDeliverable.isbar.assessment,
                                  color: 'bg-amber-100 text-amber-900',
                                },
                                {
                                  letter: 'R',
                                  title: 'Recommendation (Conducta Inmediata)',
                                  value: doctorDeliverable.isbar.recommendation,
                                  color: 'bg-emerald-100 text-emerald-800',
                                },
                              ].map((row) => (
                                <div
                                  key={row.letter}
                                  className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3"
                                >
                                  <span
                                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${row.color}`}
                                  >
                                    {row.letter}
                                  </span>
                                  <div>
                                    <span className="text-xs font-bold text-slate-700 block">
                                      {row.title}
                                    </span>
                                    <p className="text-xs sm:text-sm text-slate-900 mt-0.5">
                                      {row.value}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* STRUCTURED OPQRST SEMIOLOGY GRID */}
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5 flex items-center gap-1.5">
                            <Activity className="h-4 w-4 text-sky-600" />
                            Desglose Semiológico OPQRST
                          </h4>
                          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                            {[
                              {
                                code: 'O · Onset (Inicio)',
                                val: doctorDeliverable.opqrst.onset,
                              },
                              {
                                code: 'P · Provocation (Agravantes)',
                                val: doctorDeliverable.opqrst.provocation,
                              },
                              {
                                code: 'Q · Quality (Carácter)',
                                val: doctorDeliverable.opqrst.quality,
                              },
                              {
                                code: 'R · Radiation (Irradiación)',
                                val: doctorDeliverable.opqrst.radiation,
                              },
                              {
                                code: 'S · Severity (Severidad)',
                                val: doctorDeliverable.opqrst.severity,
                              },
                              {
                                code: 'T · Time (Evolución)',
                                val: doctorDeliverable.opqrst.time,
                              },
                            ].map((item) => (
                              <div
                                key={item.code}
                                className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs"
                              >
                                <span className="text-[11px] font-bold text-sky-700 block">
                                  {item.code}
                                </span>
                                <p className="mt-1 text-xs font-medium text-slate-800 leading-snug">
                                  {item.val}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* EVIDENCE TRACING (TRAZABILIDAD CON CITAS TEXTUALES EXACTAS) */}
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5 flex items-center gap-1.5">
                            <QuoteIcon className="h-4 w-4 text-teal-600" />
                            Evidence Tracing (Trazabilidad a Citas Exactas del
                            Paciente)
                          </h4>
                          <div className="space-y-2.5">
                            {doctorDeliverable.evidence_quotes.map(
                              (ev, idx) => (
                                <div
                                  key={idx}
                                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                                    <span className="text-xs font-bold text-slate-900">
                                      Hallazgo: {ev.fact}
                                    </span>
                                    <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold text-teal-700 border border-slate-200">
                                      Fuente: {ev.source || 'Relato del Paciente'}
                                    </span>
                                  </div>
                                  <p className="text-xs sm:text-sm italic text-slate-700 bg-white rounded-lg p-2.5 border border-slate-200/80">
                                    &ldquo;{ev.quote}&rdquo;
                                  </p>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Doctor Footer Metadata */}
                    <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
                      <span>
                        Verificación anti-alucinación: Citas vinculadas al
                        relato original y respuestas OPQRST.
                      </span>
                      <span className="font-mono font-semibold text-slate-700">
                        {telemetry.variant === 'B'
                          ? `Cascada Gemma 4 + Gemini 3.8 Flash (${telemetry.piiRedactedCount} PII protegidos)`
                          : 'Gemini 3.8 Flash Directo'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
