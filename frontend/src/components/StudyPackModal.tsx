import React, { useEffect, useRef, useState } from "react";
import { Dialog } from "@headlessui/react";
import { format } from "date-fns";
import {
  ArrowPathIcon,
  ArrowUpRightIcon,
  BookOpenIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  QuestionMarkCircleIcon,
  RectangleStackIcon,
  SparklesIcon,
  XCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  Document,
  StudyPack,
  StudyPackResponse,
} from "../common/types";
import {
  generateStudyPack,
  getStudyPack,
  getStudyPackErrorMessage,
} from "../common/studyPackApi";
import { LensMark } from "./Logo";
import StatusBadge from "./StatusBadge";

interface StudyPackModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document | null;
}

type StudyPackTab = "summary" | "concepts" | "flashcards" | "quiz";

const TABS: { key: StudyPackTab; label: string }[] = [
  { key: "summary", label: "Summary" },
  { key: "concepts", label: "Key Concepts" },
  { key: "flashcards", label: "Flashcards" },
  { key: "quiz", label: "Quiz" },
];

const TAB_ICONS = {
  summary: DocumentTextIcon,
  concepts: LightBulbIcon,
  flashcards: RectangleStackIcon,
  quiz: QuestionMarkCircleIcon,
};

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120000;
const MAX_CONSECUTIVE_POLL_ERRORS = 3;

function formatGeneratedAt(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return format(date, "MMMM d, yyyy 'at' h:mm a");
}

const StudyPackModal: React.FC<StudyPackModalProps> = ({
  isOpen,
  onClose,
  document,
}) => {
  const documentId = document?.documentid ?? null;

  const [fullResponse, setFullResponse] =
    useState<StudyPackResponse | null>(null);
  const [initialLoading, setInitialLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [pollTimedOut, setPollTimedOut] = useState(false);

  const [activeTab, setActiveTab] = useState<StudyPackTab>("summary");
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizChecked, setQuizChecked] = useState(false);

  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  const status = fullResponse?.status ?? null;
  const studyPack: StudyPack | null =
    status === "READY" ? fullResponse?.studyPack ?? null : null;
  const isPending = status === "QUEUED" || status === "PROCESSING";
  const showTabs = status === "READY" && Boolean(studyPack);

  // Clear the previous session once the dialog is closed so reopening it
  // never flashes stale content before the fresh fetch begins.
  useEffect(() => {
    if (isOpen) return;
    setFullResponse(null);
    setInitialLoading(false);
    setRefreshing(false);
    setActionLoading(false);
    setRequestError(null);
    setPollTimedOut(false);
  }, [isOpen]);

  // Load the latest Study Pack whenever the modal opens for a document.
  useEffect(() => {
    if (!isOpen || !documentId) return;

    let cancelled = false;
    setFullResponse(null);
    setInitialLoading(true);
    setRefreshing(false);
    setRequestError(null);
    setPollTimedOut(false);
    setActionLoading(false);
    setActiveTab("summary");
    setFlashcardIndex(0);
    setIsFlipped(false);
    setQuizAnswers({});
    setQuizChecked(false);

    getStudyPack(documentId)
      .then((result) => {
        if (!cancelled) setFullResponse(result);
      })
      .catch((error) => {
        if (!cancelled) {
          setRequestError(getStudyPackErrorMessage(error));
        }
      })
      .finally(() => {
        if (!cancelled) setInitialLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, documentId]);

  // Poll while generation is in progress. Closing the modal or reaching a
  // terminal status cleans up the timer (and ignores any in-flight response).
  useEffect(() => {
    if (!isOpen || !documentId || !isPending || pollTimedOut) return;

    let cancelled = false;
    let timer: number | undefined;
    let consecutiveErrors = 0;
    const startedAt = Date.now();

    const poll = async () => {
      if (cancelled) return;

      if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
        setPollTimedOut(true);
        return;
      }

      try {
        const result = await getStudyPack(documentId);
        if (cancelled) return;

        consecutiveErrors = 0;
        setFullResponse(result);

        if (
          result.status === "QUEUED" ||
          result.status === "PROCESSING"
        ) {
          timer = window.setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch (error) {
        if (cancelled) return;

        consecutiveErrors += 1;
        if (consecutiveErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
          setRequestError(getStudyPackErrorMessage(error));
          setPollTimedOut(true);
          return;
        }
        timer = window.setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    timer = window.setTimeout(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [isOpen, documentId, isPending, pollTimedOut]);

  const refresh = async () => {
    if (!documentId || refreshing) return;
    setRefreshing(true);
    setRequestError(null);
    setPollTimedOut(false);
    try {
      const result = await getStudyPack(documentId);
      if (!isOpenRef.current) return;
      setFullResponse(result);
    } catch (error) {
      if (!isOpenRef.current) return;
      setRequestError(getStudyPackErrorMessage(error));
    } finally {
      setRefreshing(false);
    }
  };

  const handleGenerate = async () => {
    if (!documentId || actionLoading) return;
    setActionLoading(true);
    setRequestError(null);
    setPollTimedOut(false);
    try {
      const result = await generateStudyPack(documentId);
      if (!isOpenRef.current) return;
      setFullResponse(result);
    } catch (error) {
      if (!isOpenRef.current) return;
      setRequestError(getStudyPackErrorMessage(error));
    } finally {
      setIsFlipped(false);
      setQuizAnswers({});
      setQuizChecked(false);
      setFlashcardIndex(0);
      setActionLoading(false);
    }
  };

  const selectTab = (tab: StudyPackTab) => {
    setActiveTab(tab);
    if (tab === "flashcards") setIsFlipped(false);
  };

  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") {
      nextIndex = (index + 1) % TABS.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + TABS.length) % TABS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = TABS.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    selectTab(TABS[nextIndex].key);
    tabRefs.current[nextIndex]?.focus();
  };

  const showFlashcard = (index: number) => {
    setFlashcardIndex(index);
    setIsFlipped(false);
  };

  const quiz = studyPack?.quiz ?? [];
  const answeredCount = quiz.reduce(
    (count, _question, index) =>
      quizAnswers[index] === undefined ? count : count + 1,
    0
  );
  const allAnswered = quiz.length > 0 && answeredCount === quiz.length;
  const quizScore = quiz.reduce(
    (score, question, index) =>
      quizAnswers[index] === question.answerIndex ? score + 1 : score,
    0
  );

  if (!isOpen || !document) return null;

  const generatedAt = formatGeneratedAt(fullResponse?.updated ?? null);
  const flashcards = studyPack?.flashcards ?? [];
  const activeFlashcard = flashcards[flashcardIndex];

  const renderLoadingPanel = () => (
    <div className="mx-auto max-w-2xl py-8 sm:py-14">
      <p className="eyebrow">Preparing the desk</p>
      <div className="mt-5 space-y-3">
        <div className="skeleton h-10 w-4/5 rounded-xl" />
        <div className="skeleton h-4 w-full rounded-full" />
        <div className="skeleton h-4 w-11/12 rounded-full" />
        <div className="skeleton h-4 w-3/4 rounded-full" />
      </div>
      <p className="mt-8 text-sm text-ink-muted">
        Loading your study materials…
      </p>
    </div>
  );

  const renderErrorPanel = () => (
    <div className="mx-auto max-w-lg py-10 text-center sm:py-16">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-coral/10 text-coral">
        <ExclamationTriangleIcon className="h-7 w-7" aria-hidden="true" />
      </div>
      <h3 className="mt-5 font-display text-3xl font-semibold tracking-[-0.05em] text-ink">
        We couldn&apos;t load this pack.
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-ink-muted">
        {requestError ??
          "Something went wrong while talking to the Study Pack service."}
      </p>
      <button
        type="button"
        onClick={refresh}
        disabled={refreshing}
        className="btn btn-primary mt-6"
      >
        <ArrowPathIcon
          className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
          aria-hidden="true"
        />
        {refreshing ? "Retrying…" : "Try again"}
      </button>
    </div>
  );

  const renderPendingPanel = () => (
    <div className="mx-auto max-w-xl py-10 text-center sm:py-20">
      {pollTimedOut ? (
        <>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber/10 text-amber">
            <ExclamationTriangleIcon className="h-7 w-7" aria-hidden="true" />
          </div>
          <h3 className="mt-5 font-display text-3xl font-semibold tracking-[-0.05em] text-ink">
            This is taking a little longer.
          </h3>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink-muted">
            {requestError ??
              "Your Study Pack may still be generating. Check again in a moment, or close this window and come back later."}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="btn btn-primary"
            >
              <ArrowPathIcon
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              {refreshing ? "Checking…" : "Check again"}
            </button>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Close
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
            <div className="absolute inset-0 animate-ping rounded-full bg-cobalt/10" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-cobalt/20 bg-cobalt-soft text-cobalt">
              <BookOpenIcon className="h-7 w-7" aria-hidden="true" />
            </div>
          </div>
          <p className="mt-6 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-muted">
            {status === "QUEUED" ? "Queued for generation" : "Reading the lecture"}
          </p>
          <h3 className="mt-3 font-display text-3xl font-semibold tracking-[-0.05em] text-ink">
            Building your Study Pack.
          </h3>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink-muted">
            We&apos;re reading{" "}
            <span className="font-medium text-ink">{document.filename}</span>{" "}
            and putting together the summary, key concepts, flashcards, and quiz.
          </p>
          <div className="mx-auto mt-7 h-1.5 max-w-xs overflow-hidden rounded-full bg-line-soft">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-cobalt" />
          </div>
          <p className="mt-6 text-xs text-ink-muted">
            You can close this window. The pack keeps generating in the
            background.
          </p>
        </>
      )}
    </div>
  );

  const renderIntroPanel = () => (
    <div className="mx-auto max-w-3xl py-3 sm:py-8">
      <p className="eyebrow">Study Pack / not generated</p>
      <h2 className="mt-3 max-w-2xl font-display text-[clamp(2.4rem,5vw,4.2rem)] font-semibold leading-[0.9] tracking-[-0.07em] text-ink">
        Turn this lecture into a study session.
      </h2>
      <p className="mt-5 max-w-xl text-sm leading-7 text-ink-muted">
        LectureLens will read the pages and build a concise summary, the ideas
        worth remembering, a set of flashcards, and a practice quiz.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-3">
        {[
          { icon: DocumentTextIcon, number: "01", label: "Summary", copy: "A clear overview of the lecture." },
          { icon: LightBulbIcon, number: "02", label: "Key concepts", copy: "The terms and ideas that matter." },
          { icon: RectangleStackIcon, number: "03", label: "Flashcards", copy: "A quick way to test recall." },
          { icon: QuestionMarkCircleIcon, number: "04", label: "Practice quiz", copy: "Check what actually stuck." },
        ].map(({ icon: Icon, number, label, copy }) => (
          <div
            key={label}
            className="rounded-2xl border border-line bg-paper-light p-4"
          >
            <div className="flex items-center justify-between">
              <Icon className="h-4 w-4 text-cobalt" aria-hidden="true" />
              <span className="font-mono text-[9px] tracking-[0.12em] text-ink-muted">
                {number}
              </span>
            </div>
            <p className="mt-5 font-display text-xl font-semibold tracking-[-0.035em] text-ink">
              {label}
            </p>
            <p className="mt-1 text-xs leading-5 text-ink-muted">{copy}</p>
          </div>
        ))}
      </div>

      {status === "FAILED" && fullResponse?.error && (
        <div className="mt-6 rounded-xl border border-coral/25 bg-coral/10 p-4 text-sm leading-6 text-coral">
          <span className="font-semibold">Previous attempt failed: </span>
          {fullResponse.error}
        </div>
      )}

      {requestError && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-coral/25 bg-coral/10 p-4 text-sm leading-6 text-coral"
        >
          {requestError}
        </div>
      )}

      <button
        type="button"
        onClick={handleGenerate}
        disabled={actionLoading}
        className="btn btn-primary mt-7"
      >
        {actionLoading ? (
          <>
            <ArrowPathIcon className="h-4 w-4 animate-spin" aria-hidden="true" />
            Starting…
          </>
        ) : (
          <>
            <SparklesIcon className="h-4 w-4" aria-hidden="true" />
            Generate Study Pack
            <ArrowUpRightIcon className="h-4 w-4" aria-hidden="true" />
          </>
        )}
      </button>
      <p className="mt-3 text-xs text-ink-muted">
        Generation usually takes under a minute. Built from this PDF only.
      </p>
    </div>
  );

  const renderTabRail = () => (
    <div
      role="tablist"
      aria-label="Study Pack sections"
      className="grid grid-cols-2 gap-1.5 lg:flex lg:flex-col lg:gap-1"
    >
      {TABS.map((tab, index) => {
        const Icon = TAB_ICONS[tab.key];
        const selected = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`study-pack-tab-${tab.key}`}
            aria-selected={selected}
            aria-controls={`study-pack-panel-${tab.key}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => selectTab(tab.key)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
            className={`flex min-w-0 items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:ring-offset-2 ${
              selected
                ? "bg-ink text-paper"
                : "text-ink-soft hover:bg-paper-light hover:text-ink"
            }`}
          >
            <span
              className={`font-mono text-[9px] tracking-[0.1em] ${
                selected ? "text-lime" : "text-ink-muted"
              }`}
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span className="truncate">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );

  const renderPanels = () => (
    <>
      {TABS.map((tab) => (
        <div
          key={tab.key}
          role="tabpanel"
          id={`study-pack-panel-${tab.key}`}
          aria-labelledby={`study-pack-tab-${tab.key}`}
          hidden={activeTab !== tab.key}
          tabIndex={0}
          className="focus:outline-none"
        >
          {tab.key === "summary" && studyPack && (
            <div className="space-y-7">
              <div>
                <p className="eyebrow">01 / Summary</p>
                <h2 className="mt-3 max-w-2xl font-display text-[clamp(2rem,3.8vw,3.35rem)] font-semibold leading-[0.94] tracking-[-0.065em] text-ink">
                  {studyPack.title}
                </h2>
                {generatedAt && (
                  <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.13em] text-ink-muted">
                    Generated {generatedAt}
                  </p>
                )}
                <p className="mt-6 whitespace-pre-line text-[16px] leading-8 text-ink-soft">
                  {studyPack.summary || "No summary was generated."}
                </p>
              </div>

              <div className="grid grid-cols-3 divide-x overflow-hidden rounded-2xl border border-line bg-paper-light">
                {[
                  [studyPack.keyConcepts.length, "Key concepts"],
                  [studyPack.flashcards.length, "Flashcards"],
                  [studyPack.quiz.length, "Quiz questions"],
                ].map(([value, label]) => (
                  <div key={label} className="p-4">
                    <p className="font-display text-2xl font-semibold tracking-[-0.04em] text-ink">
                      {value}
                    </p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.1em] text-ink-muted">
                      {label}
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl bg-ink p-5 text-paper">
                <p className="eyebrow-light">A good way to use this</p>
                <p className="mt-3 text-sm leading-6 text-paper/70">
                  Read the summary once, close it, and explain the lecture out
                  loud. Then use the flashcards and quiz to find the gaps.
                </p>
              </div>
            </div>
          )}

          {tab.key === "concepts" && studyPack && (
            <div>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="eyebrow">02 / Key concepts</p>
                  <h2 className="mt-3 font-display text-[clamp(2rem,3.6vw,3rem)] font-semibold leading-[0.95] tracking-[-0.06em] text-ink">
                    The ideas worth keeping.
                  </h2>
                </div>
                <span className="hidden pb-1 font-mono text-[9px] uppercase tracking-[0.13em] text-ink-muted sm:block">
                  {studyPack.keyConcepts.length} ideas
                </span>
              </div>

              {studyPack.keyConcepts.length === 0 ? (
                <p className="mt-6 rounded-2xl border border-line bg-paper-light p-6 text-sm text-ink-muted">
                  No key concepts were generated for this lecture.
                </p>
              ) : (
                <ol className="mt-6 grid gap-3 sm:grid-cols-2">
                  {studyPack.keyConcepts.map((concept, index) => (
                    <li
                      key={`${concept.term}-${index}`}
                      className="rounded-2xl border border-line bg-paper-light p-5 transition duration-200 hover:border-cobalt/30"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[9px] uppercase tracking-[0.13em] text-ink-muted">
                          Concept {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="h-1.5 w-1.5 rounded-full bg-cobalt" />
                      </div>
                      <h3 className="mt-6 font-display text-2xl font-semibold leading-[1] tracking-[-0.045em] text-ink">
                        {concept.term}
                      </h3>
                      <p className="mt-3 text-sm leading-6 text-ink-muted">
                        {concept.definition}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {tab.key === "flashcards" && studyPack && (
            <div className="mx-auto max-w-2xl">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="eyebrow">03 / Flashcards</p>
                  <h2 className="mt-3 font-display text-[clamp(2rem,3.6vw,3rem)] font-semibold leading-[0.95] tracking-[-0.06em] text-ink">
                    Test the recall.
                  </h2>
                </div>
                <p className="pb-1 font-mono text-[10px] tabular-nums tracking-[0.12em] text-ink-muted">
                  {flashcards.length === 0
                    ? "00 / 00"
                    : `${String(flashcardIndex + 1).padStart(2, "0")} / ${String(
                        flashcards.length
                      ).padStart(2, "0")}`}
                </p>
              </div>

              {flashcards.length === 0 || !activeFlashcard ? (
                <p className="mt-6 rounded-2xl border border-line bg-paper-light p-6 text-sm text-ink-muted">
                  No flashcards were generated for this lecture.
                </p>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setIsFlipped((flipped) => !flipped)}
                    aria-pressed={isFlipped}
                    className={`relative mt-5 flex min-h-[330px] w-full flex-col justify-between overflow-hidden rounded-[28px] border p-6 text-left transition duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:ring-offset-4 sm:p-8 ${
                      isFlipped
                        ? "border-cobalt bg-cobalt text-white"
                        : "border-ink bg-ink text-paper"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-mono text-[9px] uppercase tracking-[0.16em] opacity-60">
                        {isFlipped ? "Answer" : "Question"}
                      </span>
                      <span className="font-mono text-[9px] uppercase tracking-[0.13em] opacity-60">
                        Card {String(flashcardIndex + 1).padStart(2, "0")}
                      </span>
                    </div>

                    <p className="my-8 max-w-[34rem] font-display text-[clamp(1.8rem,3.8vw,2.8rem)] font-semibold leading-[1.02] tracking-[-0.055em]">
                      {isFlipped ? activeFlashcard.back : activeFlashcard.front}
                    </p>

                    <div className="flex items-center justify-between gap-4 font-mono text-[9px] uppercase tracking-[0.13em] opacity-65">
                      <span>
                        {isFlipped ? "Tap for the question" : "Tap to reveal the answer"}
                      </span>
                      <ArrowPathIcon className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <span
                      className="absolute -bottom-20 -right-10 h-52 w-52 rounded-full border border-white/10"
                      aria-hidden="true"
                    />
                  </button>

                  <div className="mt-5 h-1 overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-cobalt transition-all duration-300"
                      style={{
                        width: `${
                          ((flashcardIndex + 1) / flashcards.length) * 100
                        }%`,
                      }}
                    />
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => showFlashcard(flashcardIndex - 1)}
                      disabled={flashcardIndex === 0}
                      className="btn btn-secondary"
                    >
                      <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => showFlashcard(flashcardIndex + 1)}
                      disabled={flashcardIndex >= flashcards.length - 1}
                      className="btn btn-primary"
                    >
                      Next
                      <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {tab.key === "quiz" && studyPack && (
            <div>
              <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="eyebrow">04 / Practice quiz</p>
                  <h2 className="mt-3 font-display text-[clamp(2rem,3.6vw,3rem)] font-semibold leading-[0.95] tracking-[-0.06em] text-ink">
                    Check what stuck.
                  </h2>
                  <p className="mt-2 text-sm text-ink-muted">
                    {quizChecked
                      ? "Read the explanations, then try again whenever you like."
                      : "Answer every question, then check your answers."}
                  </p>
                </div>
                {quizChecked ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQuizAnswers({});
                      setQuizChecked(false);
                    }}
                    className="btn btn-secondary shrink-0"
                  >
                    <ArrowPathIcon className="h-4 w-4" aria-hidden="true" />
                    Try again
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setQuizChecked(true)}
                    disabled={!allAnswered}
                    className="btn btn-primary shrink-0"
                  >
                    <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
                    Check answers
                  </button>
                )}
              </div>

              {quiz.length === 0 ? (
                <p className="mt-6 rounded-2xl border border-line bg-paper-light p-6 text-sm text-ink-muted">
                  No quiz questions were generated for this lecture.
                </p>
              ) : (
                <>
                  {!quizChecked && (
                    <p className="mt-5 font-mono text-[9px] uppercase tracking-[0.13em] text-ink-muted">
                      {answeredCount} of {quiz.length} answered
                    </p>
                  )}

                  {quizChecked && (
                    <div
                      role="status"
                      className="mt-5 rounded-2xl bg-lime p-5 text-ink"
                    >
                      <p className="font-display text-2xl font-semibold tracking-[-0.04em]">
                        {quizScore} / {quiz.length} correct
                        <span className="ml-2 font-sans text-sm font-normal text-ink/60">
                          ({Math.round((quizScore / quiz.length) * 100)}%)
                        </span>
                      </p>
                      <p className="mt-1 text-sm leading-6 text-ink/70">
                        {quizScore === quiz.length
                          ? "Perfect score — this lecture is in good shape."
                          : "Read through the explanations and give it another go."}
                      </p>
                    </div>
                  )}

                  <div className="mt-5 space-y-4">
                    {quiz.map((question, questionIndex) => {
                      const selectedAnswer = quizAnswers[questionIndex];

                      return (
                        <div
                          key={`${question.question}-${questionIndex}`}
                          className="rounded-2xl border border-line bg-paper-light p-5"
                        >
                          <div className="flex items-start gap-3">
                            <span className="flex h-7 w-8 shrink-0 items-center justify-center rounded-lg bg-ink font-mono text-[9px] tracking-[0.08em] text-paper">
                              {String(questionIndex + 1).padStart(2, "0")}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium leading-6 text-ink">
                                {question.question}
                              </p>

                              <div className="mt-4 space-y-2">
                                {question.options.map((option, optionIndex) => {
                                  const selected =
                                    selectedAnswer === optionIndex;
                                  const isCorrectOption =
                                    question.answerIndex === optionIndex;

                                  let optionClasses =
                                    "border-line bg-paper text-ink-soft hover:border-cobalt/30 hover:bg-cobalt-soft/50";
                                  if (quizChecked) {
                                    if (isCorrectOption) {
                                      optionClasses =
                                        "border-moss/30 bg-moss/10 text-moss";
                                    } else if (selected) {
                                      optionClasses =
                                        "border-coral/30 bg-coral/10 text-coral";
                                    } else {
                                      optionClasses =
                                        "border-line bg-paper text-ink-muted";
                                    }
                                  } else if (selected) {
                                    optionClasses =
                                      "border-cobalt bg-cobalt-soft text-cobalt";
                                  }

                                  return (
                                    <button
                                      key={`${option}-${optionIndex}`}
                                      type="button"
                                      onClick={() =>
                                        setQuizAnswers((answers) => ({
                                          ...answers,
                                          [questionIndex]: optionIndex,
                                        }))
                                      }
                                      disabled={quizChecked}
                                      aria-pressed={selected}
                                      className={`flex w-full items-center rounded-xl border px-3.5 py-3 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:ring-offset-2 disabled:cursor-default ${optionClasses}`}
                                    >
                                      <span
                                        className={`mr-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] ${
                                          quizChecked && isCorrectOption
                                            ? "border-moss/30 bg-moss/10 text-moss"
                                            : quizChecked &&
                                                selected &&
                                                !isCorrectOption
                                              ? "border-coral/30 bg-coral/10 text-coral"
                                              : selected
                                                ? "border-cobalt/30 bg-cobalt-soft text-cobalt"
                                                : "border-line text-ink-muted"
                                        }`}
                                      >
                                        {String.fromCharCode(65 + optionIndex)}
                                      </span>
                                      <span className="flex-1">{option}</span>
                                      {quizChecked && isCorrectOption && (
                                        <CheckCircleIcon
                                          className="ml-2 h-4 w-4 shrink-0 text-moss"
                                          aria-label="Correct answer"
                                        />
                                      )}
                                      {quizChecked &&
                                        selected &&
                                        !isCorrectOption && (
                                          <XCircleIcon
                                            className="ml-2 h-4 w-4 shrink-0 text-coral"
                                            aria-label="Your answer"
                                          />
                                        )}
                                    </button>
                                  );
                                })}
                              </div>

                              {quizChecked && question.explanation && (
                                <div className="mt-4 rounded-xl bg-paper p-3 text-sm leading-6 text-ink-soft">
                                  <span className="font-semibold text-ink">
                                    Why:{" "}
                                  </span>
                                  {question.explanation}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </>
  );

  const renderReadyContent = () => {
    if (!studyPack) {
      return (
        <div className="mx-auto max-w-lg rounded-2xl border border-amber/25 bg-amber/10 p-6 text-center">
          <p className="text-sm font-medium text-amber">
            This Study Pack is marked ready, but no content was returned.
          </p>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="btn btn-primary mt-4"
          >
            <ArrowPathIcon
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            Refresh
          </button>
        </div>
      );
    }
    return renderPanels();
  };

  const renderBody = () => {
    if (initialLoading) return renderLoadingPanel();
    if (!fullResponse) return renderErrorPanel();
    if (isPending) return renderPendingPanel();
    if (status === "READY") return renderReadyContent();
    if (status === "FAILED" || status === "NOT_GENERATED") {
      return renderIntroPanel();
    }
    return renderErrorPanel();
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div
        className="fixed inset-0 animate-fade-in bg-ink/60 backdrop-blur-[2px]"
        aria-hidden="true"
      />

      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-stretch justify-center sm:items-center sm:p-4">
          <Dialog.Panel className="relative flex min-h-screen w-full animate-scale-in flex-col overflow-hidden border-line bg-paper shadow-2xl sm:h-[90vh] sm:max-h-[900px] sm:min-h-0 sm:max-w-[1120px] sm:rounded-[30px] sm:border">
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-line bg-paper-light px-5 py-4 sm:px-7">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink text-paper">
                  <LensMark className="h-[19px] w-[19px]" />
                </span>
                <div className="min-w-0">
                  <p className="eyebrow">LectureLens</p>
                  <Dialog.Title className="truncate font-display text-lg font-semibold leading-tight tracking-[-0.04em] text-ink">
                    Study Pack
                    <span className="ml-2 hidden font-sans text-xs font-normal text-ink-muted sm:inline">
                      {document.filename}
                    </span>
                  </Dialog.Title>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {status && <StatusBadge status={status} kind="study" />}
                {showTabs && (
                  <button
                    type="button"
                    onClick={refresh}
                    disabled={refreshing}
                    aria-label="Refresh Study Pack"
                    className="icon-button h-9 w-9 border-transparent bg-transparent"
                  >
                    <ArrowPathIcon
                      className={`h-4 w-4 ${
                        refreshing ? "animate-spin" : ""
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close Study Pack"
                  className="icon-button h-9 w-9 border-line bg-transparent"
                >
                  <XMarkIcon className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {showTabs ? (
              <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                <aside className="shrink-0 border-b border-line bg-paper-deep/50 p-4 sm:p-5 lg:w-[270px] lg:border-b-0 lg:border-r">
                  <div className="hidden lg:block">
                    <p className="eyebrow">Generated pack</p>
                    <h2 className="mt-2 font-display text-[1.55rem] font-semibold leading-[0.98] tracking-[-0.05em] text-ink">
                      {studyPack?.title}
                    </h2>
                    {generatedAt && (
                      <p className="mt-2 font-mono text-[9px] uppercase leading-5 tracking-[0.11em] text-ink-muted">
                        {generatedAt}
                      </p>
                    )}
                  </div>

                  <div className="lg:mt-6">{renderTabRail()}</div>

                  <div className="mt-5 hidden border-t border-line pt-4 lg:block">
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        [studyPack?.keyConcepts.length ?? 0, "Ideas"],
                        [studyPack?.flashcards.length ?? 0, "Cards"],
                        [studyPack?.quiz.length ?? 0, "Qs"],
                      ].map(([value, label]) => (
                        <div key={label}>
                          <p className="font-display text-xl font-semibold tracking-[-0.04em] text-ink">
                            {value}
                          </p>
                          <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-ink-muted">
                            {label}
                          </p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-4 text-[10px] leading-5 text-ink-muted">
                      Grounded in {document.pages} pages of this lecture.
                    </p>
                  </div>
                </aside>

                <div className="min-h-0 flex-1 overflow-y-auto">
                  <div className="mx-auto max-w-3xl p-5 sm:p-7">
                    {requestError && (
                      <div
                        role="alert"
                        className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber/25 bg-amber/10 px-4 py-3 text-sm text-amber"
                      >
                        <span>{requestError}</span>
                        <button
                          type="button"
                          onClick={refresh}
                          disabled={refreshing}
                          className="inline-flex items-center rounded-lg border border-amber/25 bg-paper-light px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-amber transition hover:bg-amber/10 disabled:opacity-60"
                        >
                          <ArrowPathIcon
                            className={`mr-1.5 h-3.5 w-3.5 ${
                              refreshing ? "animate-spin" : ""
                            }`}
                            aria-hidden="true"
                          />
                          Retry
                        </button>
                      </div>
                    )}
                    {renderReadyContent()}
                  </div>
                </div>
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto max-w-3xl p-5 sm:p-7">
                  {renderBody()}
                </div>
              </div>
            )}
          </Dialog.Panel>
        </div>
      </div>
    </Dialog>
  );
};

export default StudyPackModal;
