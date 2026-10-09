'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Mic,
  Printer,
  Quote,
  RefreshCw,
  Share2,
  Stethoscope,
  Volume2,
} from 'lucide-react';
import { DEMO_PATIENT_CASES } from '@/lib/clinical-engine';
import {
  ClinicalFramework,
  DeliverablesApiResponse,
  DoctorDeliverable,
  FollowUpAnswer,
  FollowUpApiResponse,
  FollowUpQuestion,
  PatientDeliverable,
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

interface BrowserSpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export default function PreConsultaPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Voice & Transcript
  const [transcript, setTranscript] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);

  // Step 2: 3 Follow-Up Questions
  const [isLoadingFollowUps, setIsLoadingFollowUps] = useState<boolean>(false);
  const [followUpQuestions, setFollowUpQuestions] = useState<
    FollowUpQuestion[]
  >([]);
  const [followUpAnswers, setFollowUpAnswers] = useState<
    Record<number, string>
  >({});

  // Step 3: Deliverables
  const [isLoadingDeliverables, setIsLoadingDeliverables] =
    useState<boolean>(false);
  const [patientDeliverable, setPatientDeliverable] =
    useState<PatientDeliverable | null>(null);
  const [doctorDeliverable, setDoctorDeliverable] =
    useState<DoctorDeliverable | null>(null);
  const [activeTab, setActiveTab] = useState<'PATIENT' | 'DOCTOR'>('PATIENT');
  const [clinicalFramework, setClinicalFramework] =
    useState<ClinicalFramework>('SOAP');
  const [checkedPrep, setCheckedPrep] = useState<Record<number, boolean>>({});
  const [showQuotes, setShowQuotes] = useState<boolean>(false);
  const [copiedShare, setCopiedShare] = useState<boolean>(false);
  const [copiedMedical, setCopiedMedical] = useState<boolean>(false);

  const recognitionRef = useRef<BrowserSpeechRecognitionInstance | null>(null);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggleVoiceRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      setInterimTranscript('');
      return;
    }

    if (typeof window === 'undefined') return;
    const win = window as unknown as Record<string, unknown>;
    const SpeechRecognitionCtor = (win.SpeechRecognition ||
      win.webkitSpeechRecognition) as
      | (new () => BrowserSpeechRecognitionInstance)
      | undefined;

    if (!SpeechRecognitionCtor) {
      return;
    }

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = 'es-GT';
      recognition.continuous = true;
      recognition.interimResults = true;

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

      recognition.onerror = () => {
        setIsRecording(false);
        setInterimTranscript('');
      };

      recognition.onend = () => {
        setIsRecording(false);
        setInterimTranscript('');
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
    } catch {
      setIsRecording(false);
    }
  };

  const speakQuestion = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-MX';
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  const handleContinueToQuestions = async () => {
    const cleanText = transcript.trim();
    if (!cleanText) return;

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    }

    setIsLoadingFollowUps(true);
    try {
      const response = await fetch('/api/telemed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_followups',
          transcript: cleanText,
          variant: 'B',
        }),
      });

      const data = (await response.json()) as FollowUpApiResponse;
      if (data.follow_up_questions && data.follow_up_questions.length > 0) {
        setFollowUpQuestions(data.follow_up_questions);
        const defaults: Record<number, string> = {};
        data.follow_up_questions.forEach((q) => {
          if (q.quick_options?.[0]) {
            defaults[q.id] = q.quick_options[0];
          }
        });
        setFollowUpAnswers(defaults);
        setStep(2);
      }
    } finally {
      setIsLoadingFollowUps(false);
    }
  };

  const handleGenerateSummary = async () => {
    setIsLoadingDeliverables(true);

    const formattedAnswers: FollowUpAnswer[] = followUpQuestions.map((q) => ({
      id: q.id,
      question: q.question,
      answer: followUpAnswers[q.id] || q.quick_options[0] || '',
    }));

    try {
      const response = await fetch('/api/telemed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_deliverables',
          transcript: transcript.trim(),
          followUpAnswers: formattedAnswers,
          variant: 'B',
        }),
      });

      const data = (await response.json()) as DeliverablesApiResponse;
      if (data.patient_deliverable && data.doctor_deliverable) {
        setPatientDeliverable(data.patient_deliverable);
        setDoctorDeliverable(data.doctor_deliverable);
        setCheckedPrep({});
        setActiveTab('PATIENT');
        setStep(3);
      }
    } finally {
      setIsLoadingDeliverables(false);
    }
  };

  const handleSharePatientSummary = async () => {
    if (!patientDeliverable) return;
    const text = [
      'PRECONSULTA MEDICA',
      '',
      'Lo que reportaste:',
      patientDeliverable.friendly_summary,
      '',
      'Preguntas para tu medico:',
      ...patientDeliverable.questions_to_ask_doctor.map(
        (q, i) => `${i + 1}. ${q}`
      ),
      '',
      'Que tener a la mano:',
      ...patientDeliverable.prep_checklist.map((item) => `- ${item}`),
    ].join('\n');

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Resumen de PreConsulta',
          text,
        });
        return;
      }
    } catch {
      // Fallback to clipboard
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2200);
    } catch {
      // Ignore clipboard errors
    }
  };

  const handleCopyMedicalNote = async () => {
    if (!doctorDeliverable) return;
    const text =
      clinicalFramework === 'SOAP'
        ? [
            `S: ${doctorDeliverable.soap.subjective}`,
            `O: ${doctorDeliverable.soap.objective}`,
            `A: ${doctorDeliverable.soap.assessment}`,
            `P: ${doctorDeliverable.soap.plan}`,
          ].join('\n\n')
        : [
            `I: ${doctorDeliverable.isbar.identification}`,
            `S: ${doctorDeliverable.isbar.situation}`,
            `B: ${doctorDeliverable.isbar.background}`,
            `A: ${doctorDeliverable.isbar.assessment}`,
            `R: ${doctorDeliverable.isbar.recommendation}`,
          ].join('\n\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopiedMedical(true);
      setTimeout(() => setCopiedMedical(false), 2200);
    } catch {
      // Ignore clipboard errors
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col">
      {/* Minimal Header */}
      <header className="bg-white/90 backdrop-blur-xs border-b border-slate-200/80 no-print">
        <div className="mx-auto max-w-2xl px-5 h-16 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="flex items-center gap-2.5 text-left focus:outline-none cursor-pointer"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600 border border-sky-100">
              <Stethoscope className="h-4 w-4" />
            </div>
            <span className="text-base font-semibold tracking-tight text-slate-900">
              PreConsulta
            </span>
          </button>

          {/* Subtle 3-Step Indicator */}
          <nav
            aria-label="Progreso"
            className="flex items-center gap-1.5 sm:gap-2 text-xs font-medium"
          >
            <button
              type="button"
              onClick={() => setStep(1)}
              className={`px-2 py-1 rounded-md transition cursor-pointer ${
                step === 1
                  ? 'bg-sky-50 text-sky-700 font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              1. Síntomas
            </button>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
            <button
              type="button"
              disabled={followUpQuestions.length === 0}
              onClick={() => followUpQuestions.length > 0 && setStep(2)}
              className={`px-2 py-1 rounded-md transition ${
                step === 2
                  ? 'bg-sky-50 text-sky-700 font-semibold'
                  : followUpQuestions.length > 0
                  ? 'text-slate-500 hover:text-slate-800 cursor-pointer'
                  : 'text-slate-300 cursor-default'
              }`}
            >
              2. Preguntas
            </button>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
            <button
              type="button"
              disabled={!patientDeliverable}
              onClick={() => patientDeliverable && setStep(3)}
              className={`px-2 py-1 rounded-md transition ${
                step === 3
                  ? 'bg-sky-50 text-sky-700 font-semibold'
                  : patientDeliverable
                  ? 'text-slate-500 hover:text-slate-800 cursor-pointer'
                  : 'text-slate-300 cursor-default'
              }`}
            >
              3. Resumen
            </button>
          </nav>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 px-4 py-8 sm:py-12">
        {/* STEP 1: CUÉNTANOS CÓMO TE SIENTES */}
        {step === 1 && (
          <div className="max-w-xl mx-auto">
            <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs p-6 sm:p-8">
              <div className="text-center">
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
                  Cuéntanos cómo te sientes
                </h1>
                <p className="mt-1.5 text-sm text-slate-500">
                  Habla con naturalidad o escribe tus síntomas para preparar tu
                  consulta.
                </p>
              </div>

              {/* Centered Microphone Button */}
              <div className="my-8 flex flex-col items-center justify-center">
                <div className="relative flex items-center justify-center">
                  {isRecording && (
                    <>
                      <span className="absolute h-24 w-24 rounded-full bg-sky-100 animate-ping opacity-75" />
                      <span className="absolute h-20 w-20 rounded-full bg-sky-50 ring-1 ring-sky-200" />
                    </>
                  )}
                  <button
                    type="button"
                    onClick={toggleVoiceRecording}
                    className={`relative z-10 flex h-16 w-16 items-center justify-center rounded-full transition shadow-sm cursor-pointer focus:outline-none ${
                      isRecording
                        ? 'bg-rose-500 text-white hover:bg-rose-600'
                        : 'bg-sky-600 text-white hover:bg-sky-700'
                    }`}
                    aria-label={
                      isRecording ? 'Detener grabación' : 'Toca para hablar'
                    }
                  >
                    <Mic className="h-6 w-6" />
                  </button>
                </div>
                <span className="mt-3 text-xs font-medium text-slate-500">
                  {isRecording ? 'Escuchando... toca para pausar' : 'Toca para hablar'}
                </span>
              </div>

              {/* Clean Minimalist Text Area */}
              <div>
                <textarea
                  rows={4}
                  value={
                    interimTranscript
                      ? `${transcript} ${interimTranscript}`
                      : transcript
                  }
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Ej. Desde hace cuatro horas tengo un dolor de cabeza fuerte del lado derecho y me molesta la luz..."
                  className="w-full rounded-xl border border-slate-200/90 bg-[#F8FAFC] p-4 text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 focus:outline-none transition resize-none leading-relaxed"
                />

                {/* Tiny Subtle Example Pills */}
                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                  <span>Casos de ejemplo:</span>
                  {DEMO_PATIENT_CASES.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTranscript(item.transcript)}
                      className="rounded-full bg-slate-100/80 hover:bg-sky-50 text-slate-600 hover:text-sky-700 px-2.5 py-0.5 text-xs font-medium transition cursor-pointer"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Primary Action */}
              <div className="mt-7">
                <button
                  type="button"
                  onClick={handleContinueToQuestions}
                  disabled={!transcript.trim() || isLoadingFollowUps}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-2xs hover:bg-sky-700 disabled:opacity-40 transition cursor-pointer"
                >
                  {isLoadingFollowUps ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Preparando preguntas...</span>
                    </>
                  ) : (
                    <>
                      <span>Continuar</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: 3 PREGUNTAS RÁPIDAS */}
        {step === 2 && (
          <div className="max-w-xl mx-auto space-y-5">
            <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs p-6 sm:p-8">
              <div className="mb-6">
                <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                  Tres preguntas rápidas
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Selecciona o escribe una respuesta breve para afinar tu
                  resumen.
                </p>
              </div>

              <div className="space-y-6">
                {followUpQuestions.map((q, index) => {
                  const selectedAnswer = followUpAnswers[q.id] || '';
                  return (
                    <div
                      key={q.id}
                      className="pb-6 border-b border-slate-100 last:border-b-0 last:pb-0"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <p className="text-sm font-medium text-slate-900 leading-snug">
                          <span className="text-sky-600 font-semibold mr-1.5">
                            {index + 1}.
                          </span>
                          {q.question}
                        </p>
                        <button
                          type="button"
                          onClick={() => speakQuestion(q.question)}
                          title="Escuchar pregunta"
                          className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-sky-600 transition cursor-pointer"
                        >
                          <Volume2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {q.quick_options.map((opt) => {
                          const isSelected = selectedAnswer === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() =>
                                setFollowUpAnswers((prev) => ({
                                  ...prev,
                                  [q.id]: opt,
                                }))
                              }
                              className={`rounded-lg px-3 py-2 text-xs font-medium border text-left transition cursor-pointer ${
                                isSelected
                                  ? 'bg-sky-50 border-sky-500 text-sky-800 font-semibold'
                                  : 'bg-white border-slate-200/90 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>

                      <input
                        type="text"
                        value={selectedAnswer}
                        onChange={(e) =>
                          setFollowUpAnswers((prev) => ({
                            ...prev,
                            [q.id]: e.target.value,
                          }))
                        }
                        placeholder="O escribe tu respuesta aquí..."
                        className="mt-2.5 w-full rounded-lg border border-slate-200/80 bg-[#F8FAFC] px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-sky-500 focus:outline-none"
                      />
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 flex items-center justify-between gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Volver</span>
                </button>

                <button
                  type="button"
                  onClick={handleGenerateSummary}
                  disabled={isLoadingDeliverables}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-2xs hover:bg-sky-700 disabled:opacity-40 transition cursor-pointer"
                >
                  {isLoadingDeliverables ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Generando resumen...</span>
                    </>
                  ) : (
                    <>
                      <span>Ver mi resumen</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: RESULTADOS (VISTA PACIENTE / FICHA MÉDICA) */}
        {step === 3 && patientDeliverable && doctorDeliverable && (
          <div className="max-w-2xl mx-auto space-y-5">
            {/* Clean Segmented Control */}
            <div className="flex items-center justify-between gap-3 no-print">
              <div className="inline-flex rounded-xl bg-slate-200/70 p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('PATIENT')}
                  className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition cursor-pointer ${
                    activeTab === 'PATIENT'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Para mí (Paciente)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('DOCTOR')}
                  className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition cursor-pointer ${
                    activeTab === 'DOCTOR'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Ficha Médica (SOAP / ISBAR)
                </button>
              </div>

              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 transition cursor-pointer"
              >
                Editar síntomas
              </button>
            </div>

            {/* PATIENT VIEW */}
            {activeTab === 'PATIENT' && (
              <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="p-6 sm:p-8 space-y-6">
                  <div>
                    <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                      Tu pase de pre-consulta
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                      Ten esta guía a la mano durante tu consulta con el médico.
                    </p>
                  </div>

                  {/* Subtle Priority Banner */}
                  {patientDeliverable.urgency_notice && (
                    <div
                      className={`rounded-xl p-3.5 text-xs leading-relaxed border ${
                        doctorDeliverable.triage_level === 'ROJO'
                          ? 'bg-rose-50/70 border-rose-200 text-rose-800'
                          : 'bg-sky-50/60 border-sky-200/80 text-sky-900'
                      }`}
                    >
                      {patientDeliverable.urgency_notice}
                    </div>
                  )}

                  {/* 1. Lo que reportaste */}
                  <div>
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      1. Lo que reportaste
                    </h2>
                    <p className="text-sm text-slate-700 leading-relaxed bg-[#F8FAFC] rounded-xl p-4 border border-slate-200/60">
                      {patientDeliverable.friendly_summary}
                    </p>
                  </div>

                  {/* 2. 3 preguntas para hacerle a tu médico */}
                  <div>
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
                      2. Preguntas sugeridas para tu médico
                    </h2>
                    <ul className="space-y-2">
                      {patientDeliverable.questions_to_ask_doctor.map(
                        (q, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-3 rounded-xl border border-slate-200/70 p-3.5 text-sm text-slate-700"
                          >
                            <span className="text-xs font-semibold text-sky-600 mt-0.5">
                              {idx + 1}.
                            </span>
                            <span className="leading-snug">{q}</span>
                          </li>
                        )
                      )}
                    </ul>
                  </div>

                  {/* 3. Qué tener a la mano */}
                  <div>
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
                      3. Qué tener a la mano
                    </h2>
                    <div className="space-y-2">
                      {patientDeliverable.prep_checklist.map((item, idx) => {
                        const checked = Boolean(checkedPrep[idx]);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() =>
                              setCheckedPrep((prev) => ({
                                ...prev,
                                [idx]: !prev[idx],
                              }))
                            }
                            className="w-full flex items-center gap-3 rounded-xl border border-slate-200/70 p-3 text-left text-sm transition hover:bg-slate-50 cursor-pointer"
                          >
                            <span
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                                checked
                                  ? 'bg-sky-600 border-sky-600 text-white'
                                  : 'border-slate-300 bg-white'
                              }`}
                            >
                              {checked && <Check className="h-3 w-3" />}
                            </span>
                            <span
                              className={
                                checked
                                  ? 'line-through text-slate-400'
                                  : 'text-slate-700'
                              }
                            >
                              {item}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Single Clean Action Bar */}
                <div className="border-t border-slate-100 bg-[#F8FAFC] px-6 py-4 flex items-center justify-end gap-3 no-print">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  >
                    <Printer className="h-3.5 w-3.5 text-slate-500" />
                    <span>Imprimir / PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSharePatientSummary}
                    className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 transition cursor-pointer"
                  >
                    {copiedShare ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Copiado</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="h-3.5 w-3.5" />
                        <span>Compartir</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* DOCTOR VIEW (SOAP / ISBAR) */}
            {activeTab === 'DOCTOR' && (
              <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="p-6 sm:p-8 space-y-6">
                  {/* Top Bar: Title + SOAP | ISBAR Toggle */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
                    <div>
                      <h1 className="text-lg font-semibold text-slate-900">
                        Ficha clínica de pre-consulta
                      </h1>
                      <p className="text-xs text-slate-500">
                        Resumen estructurado para historia clínica
                      </p>
                    </div>

                    <div className="flex items-center gap-2 no-print">
                      <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200/80">
                        <button
                          type="button"
                          onClick={() => setClinicalFramework('SOAP')}
                          className={`rounded-md px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                            clinicalFramework === 'SOAP'
                              ? 'bg-white text-sky-700 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          SOAP
                        </button>
                        <button
                          type="button"
                          onClick={() => setClinicalFramework('ISBAR')}
                          className={`rounded-md px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                            clinicalFramework === 'ISBAR'
                              ? 'bg-white text-sky-700 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          ISBAR
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={handleCopyMedicalNote}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                      >
                        {copiedMedical ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 text-slate-400" />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Red Flags Pill / Banner (Only if present) */}
                  {doctorDeliverable.red_flags &&
                    doctorDeliverable.red_flags.length > 0 && (
                      <div
                        className={`rounded-xl p-3.5 border ${
                          doctorDeliverable.triage_level === 'ROJO'
                            ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                            : 'bg-amber-50/60 border-amber-200/80 text-amber-900'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-xs font-semibold mb-1">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          <span>Alertas clínicas (Red Flags)</span>
                        </div>
                        <ul className="space-y-1 pl-6 list-disc text-xs leading-relaxed">
                          {doctorDeliverable.red_flags.map((rf, i) => (
                            <li key={i}>{rf}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                  {/* SOAP or ISBAR Content */}
                  {clinicalFramework === 'SOAP' ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {[
                        {
                          label: 'S · Subjetivo',
                          text: doctorDeliverable.soap.subjective,
                        },
                        {
                          label: 'O · Objetivo',
                          text: doctorDeliverable.soap.objective,
                        },
                        {
                          label: 'A · Evaluación',
                          text: doctorDeliverable.soap.assessment,
                        },
                        {
                          label: 'P · Plan',
                          text: doctorDeliverable.soap.plan,
                        },
                      ].map((section) => (
                        <div
                          key={section.label}
                          className="rounded-xl border border-slate-200/70 bg-[#F8FAFC] p-3.5"
                        >
                          <span className="text-xs font-semibold text-sky-700 block mb-1">
                            {section.label}
                          </span>
                          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                            {section.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {[
                        {
                          label: 'I · Identificación',
                          text: doctorDeliverable.isbar.identification,
                        },
                        {
                          label: 'S · Situación',
                          text: doctorDeliverable.isbar.situation,
                        },
                        {
                          label: 'B · Antecedentes',
                          text: doctorDeliverable.isbar.background,
                        },
                        {
                          label: 'A · Evaluación',
                          text: doctorDeliverable.isbar.assessment,
                        },
                        {
                          label: 'R · Recomendación',
                          text: doctorDeliverable.isbar.recommendation,
                        },
                      ].map((row) => (
                        <div
                          key={row.label}
                          className="rounded-xl border border-slate-200/70 bg-[#F8FAFC] p-3.5"
                        >
                          <span className="text-xs font-semibold text-sky-700 block mb-0.5">
                            {row.label}
                          </span>
                          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                            {row.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Concise OPQRST Grid */}
                  <div>
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
                      Síntesis OPQRST
                    </h2>
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                      {[
                        { label: 'Inicio', val: doctorDeliverable.opqrst.onset },
                        {
                          label: 'Agravantes',
                          val: doctorDeliverable.opqrst.provocation,
                        },
                        {
                          label: 'Carácter',
                          val: doctorDeliverable.opqrst.quality,
                        },
                        {
                          label: 'Irradiación',
                          val: doctorDeliverable.opqrst.radiation,
                        },
                        {
                          label: 'Severidad',
                          val: doctorDeliverable.opqrst.severity,
                        },
                        {
                          label: 'Tiempo',
                          val: doctorDeliverable.opqrst.time,
                        },
                      ].map((cell) => (
                        <div
                          key={cell.label}
                          className="rounded-xl border border-slate-200/70 p-3"
                        >
                          <span className="text-[11px] font-medium text-slate-400 block">
                            {cell.label}
                          </span>
                          <p className="mt-0.5 text-xs font-medium text-slate-800 leading-snug">
                            {cell.val}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Collapsible Evidence Quotes */}
                  <div className="pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowQuotes((prev) => !prev)}
                      className="flex items-center justify-between w-full text-left py-1 text-xs font-medium text-slate-500 hover:text-slate-800 transition cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Quote className="h-3.5 w-3.5 text-slate-400" />
                        <span>
                          Citas textuales del paciente (
                          {doctorDeliverable.evidence_quotes.length})
                        </span>
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${
                          showQuotes ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {showQuotes && (
                      <div className="mt-3 space-y-2">
                        {doctorDeliverable.evidence_quotes.map((eq, i) => (
                          <div
                            key={i}
                            className="rounded-xl bg-[#F8FAFC] border border-slate-200/60 p-3 text-xs"
                          >
                            <span className="font-medium text-slate-600 block mb-0.5">
                              {eq.fact}
                            </span>
                            <p className="italic text-slate-500">
                              &ldquo;{eq.quote}&rdquo;
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
