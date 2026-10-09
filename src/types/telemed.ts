export type ArchitectureVariant = 'A' | 'B';

export type TriageLevel = 'VERDE' | 'AMARILLO' | 'ROJO';

export type ClinicalFramework = 'SOAP' | 'ISBAR';

export interface FollowUpQuestion {
  id: number;
  question: string;
  quick_options: string[];
  opqrst_target?: string;
}

export interface FollowUpAnswer {
  id: number;
  question: string;
  answer: string;
  opqrst_target?: string;
}

export interface PatientDeliverable {
  friendly_summary: string;
  questions_to_ask_doctor: string[];
  prep_checklist: string[];
  urgency_notice: string;
}

export interface OpqrstBreakdown {
  onset: string;
  provocation: string;
  quality: string;
  radiation: string;
  severity: string;
  time: string;
}

export interface SoapNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface IsbarNote {
  identification: string;
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
}

export interface EvidenceQuote {
  fact: string;
  quote: string;
  source?: string;
}

export interface DoctorDeliverable {
  triage_level: TriageLevel;
  red_flags: string[];
  opqrst: OpqrstBreakdown;
  soap: SoapNote;
  isbar: IsbarNote;
  evidence_quotes: EvidenceQuote[];
}

export interface FollowUpApiResponse {
  follow_up_questions: FollowUpQuestion[];
}

export interface DeliverablesApiResponse {
  patient_deliverable: PatientDeliverable;
  doctor_deliverable: DoctorDeliverable;
}

export interface DemoPatientCase {
  id: string;
  label: string;
  transcript: string;
}
