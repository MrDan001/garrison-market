// components/SupportIntakeWizard.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";
import {
  CATEGORY_OPTIONS,
  URGENCY_OPTIONS,
  YES_NO_OPTIONS,
  SELF_HELP_OPTIONS,
  DETAIL_QUESTIONS,
  type IntakeCategory,
  type DetailOption,
} from "@/lib/support-intake-config";
import {
  resolveIntakeSelfServed,
  submitIntakeAndEscalate,
  type IntakeThreadType,
  type IntakeAnswers,
} from "@/lib/support-intake.actions";

type Step = "form" | "category" | "urgency" | "impact" | "detail" | "deflection" | "selfhelp" | "notes" | "resolved";

interface Props {
  threadType: IntakeThreadType;
  role: "owner" | "staff";
  prefill: { name: string; email: string; storeName: string };
  trialDaysLeft: number | null;
  subscriptionStatus: string;
  onEscalated: () => void;
}

const TOTAL_QUESTIONS = 6;

export default function SupportIntakeWizard({
  threadType,
  role,
  prefill,
  trialDaysLeft,
  subscriptionStatus,
  onEscalated,
}: Props) {
  const [step, setStep] = useState<Step>("form");
  const [submitting, setSubmitting] = useState(false);
  const [chosenDetail, setChosenDetail] = useState<DetailOption | null>(null);

  const [answers, setAnswers] = useState<IntakeAnswers>({
    name: prefill.name,
    storeName: prefill.storeName,
    email: prefill.email,
    category: "",
    urgency: "",
    blockingSales: "",
    detailAnswer: "",
    triedSelfHelp: "",
    extraNotes: "",
  });

  const detailConfig = answers.category ? DETAIL_QUESTIONS[answers.category as IntakeCategory] : null;
  const hasDetailStep = !!detailConfig && detailConfig.options.length > 0;

  // Question number shown in the progress bar (1-6), independent of whether
  // the "detail" step gets skipped for the "other" category.
  const questionNumber = useMemo(() => {
    switch (step) {
      case "category":
        return 1;
      case "urgency":
        return 2;
      case "impact":
        return 3;
      case "detail":
        return 4;
      case "selfhelp":
        return 5;
      case "notes":
        return 6;
      default:
        return null;
    }
  }, [step]);

  function update<K extends keyof IntakeAnswers>(key: K, value: IntakeAnswers[K]) {
    setAnswers((a) => ({ ...a, [key]: value }));
  }

  function goToDetailOrSkip() {
    if (hasDetailStep) {
      setStep("detail");
    } else {
      setStep("selfhelp");
    }
  }

  function pickDetail(opt: DetailOption) {
    update("detailAnswer", opt.value);
    setChosenDetail(opt);
    if (opt.dynamicTrialInfo || opt.deflection) {
      setStep("deflection");
    } else {
      setStep("selfhelp");
    }
  }

  async function handleSelfServedYes() {
    setSubmitting(true);
    try {
      await resolveIntakeSelfServed(threadType, answers);
      setStep("resolved");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await submitIntakeAndEscalate(threadType, answers);
      onEscalated();
    } finally {
      setSubmitting(false);
    }
  }

  const showOwnerOnlyLink = role === "owner";

  return (
    <div className="flex-1 overflow-y-auto px-5 py-5">
      {questionNumber && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Question {questionNumber} of {TOTAL_QUESTIONS}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${(questionNumber / TOTAL_QUESTIONS) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* ── STEP: CONTACT FORM ── */}
      {step === "form" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-bold text-[var(--text-primary)]">Before we connect you to admin</h2>
            <p className="text-xs text-slate-500 mt-1">
              A few quick details, then a short poll — so admin has the full picture right away.
            </p>
          </div>

          <Field label="Your name">
            <input
              type="text"
              value={answers.name}
              onChange={(e) => update("name", e.target.value)}
              className={inputClass}
              placeholder="Full name"
            />
          </Field>

          <Field label="Store name">
            <input
              type="text"
              value={answers.storeName}
              onChange={(e) => update("storeName", e.target.value)}
              className={inputClass}
              placeholder="Your store's name"
            />
          </Field>

          <Field label="Email">
            <input
              type="email"
              value={answers.email}
              onChange={(e) => update("email", e.target.value)}
              className={inputClass}
              placeholder="you@example.com"
            />
          </Field>

          <button
            disabled={!answers.name.trim() || !answers.email.trim()}
            onClick={() => setStep("category")}
            className="w-full mt-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold py-3 rounded-xl transition-colors"
          >
            Continue
          </button>
        </div>
      )}

      {/* ── Q1: CATEGORY ── */}
      {step === "category" && (
        <QuestionBlock title="What's this about?">
          {CATEGORY_OPTIONS.map((opt: { id: IntakeCategory; label: string }) => (
            <OptionButton
              key={opt.id}
              label={opt.label}
              onClick={() => {
                update("category", opt.id);
                setStep("urgency");
              }}
            />
          ))}
        </QuestionBlock>
      )}

      {/* ── Q2: URGENCY ── */}
      {step === "urgency" && (
        <QuestionBlock title="How urgent is this?" onBack={() => setStep("category")}>
          {URGENCY_OPTIONS.map((opt: { id: string; label: string }) => (
            <OptionButton
              key={opt.id}
              label={opt.label}
              onClick={() => {
                update("urgency", opt.id);
                setStep("impact");
              }}
            />
          ))}
        </QuestionBlock>
      )}

      {/* ── Q3: BLOCKING SALES ── */}
      {step === "impact" && (
        <QuestionBlock
          title="Is this stopping you from making sales or using the app right now?"
          onBack={() => setStep("urgency")}
        >
          {YES_NO_OPTIONS.map((opt: { id: string; label: string }) => (
            <OptionButton
              key={opt.id}
              label={opt.label}
              onClick={() => {
                update("blockingSales", opt.id);
                goToDetailOrSkip();
              }}
            />
          ))}
        </QuestionBlock>
      )}

      {/* ── Q4: CATEGORY DETAIL ── */}
      {step === "detail" && detailConfig && (
        <QuestionBlock title={detailConfig.question} onBack={() => setStep("impact")}>
          {detailConfig.options.map((opt: DetailOption) => (
            <OptionButton key={opt.value} label={opt.label} onClick={() => pickDetail(opt)} />
          ))}
        </QuestionBlock>
      )}

      {/* ── DEFLECTION (possible self-serve answer) ── */}
      {step === "deflection" && chosenDetail && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-blue-600/10 border border-blue-500/20 p-4">
            <p className="text-xs font-bold text-blue-500 mb-1.5">Here's a quick answer</p>
            <p className="text-sm text-[var(--text-primary)] leading-relaxed">
              {chosenDetail.dynamicTrialInfo ? trialInfoText(subscriptionStatus, trialDaysLeft) : chosenDetail.deflection}
            </p>
            {chosenDetail.deflectionLink && !(chosenDetail.deflectionLink.ownerOnly && !showOwnerOnlyLink) && (
              <Link
                href={chosenDetail.deflectionLink.href}
                className="inline-block mt-3 text-xs font-bold text-blue-500 underline underline-offset-2"
              >
                {chosenDetail.deflectionLink.label} →
              </Link>
            )}
          </div>

          <p className="text-xs text-slate-500 text-center">Did this solve it?</p>

          <div className="grid grid-cols-2 gap-3">
            <button
              disabled={submitting}
              onClick={handleSelfServedYes}
              className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold py-3 rounded-xl transition-colors"
            >
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <ThumbsUp size={15} />}
              Yes, thanks
            </button>
            <button
              disabled={submitting}
              onClick={() => setStep("selfhelp")}
              className="flex items-center justify-center gap-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 hover:dark:bg-slate-700 disabled:opacity-50 text-[var(--text-primary)] text-sm font-bold py-3 rounded-xl transition-colors"
            >
              <ThumbsDown size={15} />
              Still need help
            </button>
          </div>
        </div>
      )}

      {/* ── Q5: SELF-HELP CHECK ── */}
      {step === "selfhelp" && (
        <QuestionBlock
          title="Have you already tried anything to fix this yourself?"
          onBack={() => (hasDetailStep ? setStep("detail") : setStep("impact"))}
        >
          {SELF_HELP_OPTIONS.map((opt: { id: string; label: string }) => (
            <OptionButton
              key={opt.id}
              label={opt.label}
              onClick={() => {
                update("triedSelfHelp", opt.label);
                setStep("notes");
              }}
            />
          ))}
        </QuestionBlock>
      )}

      {/* ── Q6: EXTRA NOTES + SUBMIT ── */}
      {step === "notes" && (
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Question 6 of 6</p>
            <h2 className="text-sm font-bold text-[var(--text-primary)]">
              Anything else you'd like admin to know?
            </h2>
            <p className="text-xs text-slate-500 mt-1">Optional — you can also just hit submit.</p>
          </div>
          <textarea
            value={answers.extraNotes}
            onChange={(e) => update("extraNotes", e.target.value)}
            rows={4}
            className={inputClass}
            placeholder="Add any extra detail here..."
          />
          <button
            disabled={submitting}
            onClick={handleSubmit}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold py-3 rounded-xl transition-colors"
          >
            {submitting && <Loader2 size={15} className="animate-spin" />}
            Submit &amp; talk to admin
          </button>
        </div>
      )}

      {/* ── RESOLVED (self-served) ── */}
      {step === "resolved" && (
        <div className="flex flex-col items-center text-center gap-3 py-6">
          <div className="h-14 w-14 rounded-full bg-emerald-600/15 flex items-center justify-center">
            <CheckCircle2 size={26} className="text-emerald-500" />
          </div>
          <h2 className="text-sm font-bold text-[var(--text-primary)]">Glad that helped!</h2>
          <p className="text-xs text-slate-500 max-w-xs">
            We didn't need to bother admin this time. If it comes up again, just reopen this chat.
          </p>
        </div>
      )}
    </div>
  );
}

function trialInfoText(subscriptionStatus: string, trialDaysLeft: number | null) {
  if (subscriptionStatus !== "trialing") {
    return "You're not currently on the free trial — you're on a paid plan, so there's no trial countdown to worry about.";
  }
  if (trialDaysLeft === null) {
    return "We couldn't find an active trial countdown on your account — head to Billing for your current plan status.";
  }
  if (trialDaysLeft <= 0) {
    return "Your free trial has ended today. Head to Billing to pick a plan and keep everything running.";
  }
  return `You have ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left on your free trial.`;
}

const inputClass =
  "w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function QuestionBlock({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold text-[var(--text-primary)] leading-snug">{title}</h2>
      <div className="space-y-2">{children}</div>
      {onBack && (
        <button onClick={onBack} className="text-xs font-semibold text-slate-400 hover:text-slate-300 mt-2">
          ← Back
        </button>
      )}
    </div>
  );
}

function OptionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 hover:bg-blue-600/5 text-sm text-[var(--text-primary)] font-medium transition-colors"
    >
      {label}
    </button>
  );
}