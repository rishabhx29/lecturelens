import React, { useEffect, useRef, useState } from "react";
import { Dialog } from "@headlessui/react";
import { format } from "date-fns";
import {
  ArrowPathIcon,
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

  const renderLoadingPanel = (label: string) => (
    <div className="flex flex-col items-center py-20 text-center">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full bg-violet-200 opacity-50" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-violet-100 text-violet-900">
          <BookOpenIcon className="h-8 w-8" aria-hidden="true" />
        </div>
      </div>
      <p className="mt-6 text-base font-semibold text-gray-900">{label}</p>
      <p className="mt-2 text-sm text-gray-500">
        Just a moment while we fetch your study materials.
      </p>
    </div>
  );

  const renderErrorPanel = () => (
    <div className="mx-auto max-w-lg rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm sm:p-8">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
        <ExclamationTriangleIcon className="h-7 w-7" aria-hidden="true" />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-gray-900">
        We couldn&apos;t load this Study Pack
      </h3>
      <p className="mt-2 text-sm leading-6 text-gray-600">
        {requestError ??
          "Something went wrong while talking to the Study Pack service."}
      </p>
      <button
        type="button"
        onClick={refresh}
        disabled={refreshing}
        className="mt-6 inline-flex items-center justify-center rounded-xl bg-violet-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <ArrowPathIcon
          className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
          aria-hidden="true"
        />
        {refreshing ? "Retrying…" : "Try again"}
      </button>
    </div>
  );

  const renderPendingPanel = () => (
    <div className="flex flex-col items-center py-14 text-center sm:py-20">
      {pollTimedOut ? (
        <>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <ExclamationTriangleIcon
              className="h-8 w-8"
              aria-hidden="true"
            />
          </div>
          <h3 className="mt-6 text-lg font-semibold text-gray-900">
            This is taking longer than expected
          </h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-gray-600">
            {requestError ??
              "Your Study Pack may still be generating. Check again in a moment, or close this window and come back later."}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="inline-flex items-center justify-center rounded-xl bg-violet-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ArrowPathIcon
                className={`mr-2 h-4 w-4 ${
                  refreshing ? "animate-spin" : ""
                }`}
                aria-hidden="true"
              />
              {refreshing ? "Checking…" : "Check again"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-700 focus-visible:ring-offset-2"
            >
              Close
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="relative flex h-16 w-16 items-center justify-center">
            <div className="absolute inset-0 animate-ping rounded-full bg-violet-200 opacity-50" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-violet-100 text-violet-900">
              <BookOpenIcon className="h-8 w-8" aria-hidden="true" />
            </div>
          </div>
          <h3 className="mt-6 text-lg font-semibold text-gray-900">
            Building your Study Pack…
          </h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-gray-600">
            We&apos;re reading{" "}
            <span className="font-medium text-gray-800">
              {document.filename}
            </span>{" "}
            and putting together your summary, flashcards, and quiz. This can
            take up to a minute.
          </p>
          <span className="mt-5 inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-800">
            <ArrowPathIcon
              className="mr-1.5 h-3.5 w-3.5 animate-spin"
              aria-hidden="true"
            />
            {status === "QUEUED"
              ? "Queued for generation"
              : "Generating content"}
          </span>
          <p className="mt-6 max-w-sm text-xs leading-5 text-gray-400">
            You can close this window and come back later — your Study Pack
            will keep generating in the background.
          </p>
        </>
      )}
    </div>
  );

  const renderIntroPanel = () => (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm sm:p-9">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-900 to-violet-700 text-white shadow-sm">
          <SparklesIcon className="h-8 w-8" aria-hidden="true" />
        </div>
        <h3 className="mt-5 text-xl font-semibold text-gray-900 sm:text-2xl">
          {status === "FAILED"
            ? "Let's give your Study Pack another try"
            : "Build a Study Pack from this lecture"}
        </h3>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-gray-600">
          LectureLens will read this lecture and create a concise summary, the
          key concepts to remember, flashcards, and a practice quiz — all in one
          place.
        </p>

        <div className="mt-7 grid grid-cols-2 gap-3 text-left sm:grid-cols-4">
          {[
            { icon: DocumentTextIcon, label: "Summary" },
            { icon: LightBulbIcon, label: "Key concepts" },
            { icon: RectangleStackIcon, label: "Flashcards" },
            { icon: QuestionMarkCircleIcon, label: "Practice quiz" },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5"
            >
              <Icon
                className="h-4 w-4 shrink-0 text-violet-700"
                aria-hidden="true"
              />
              <span className="text-xs font-medium text-gray-700">
                {label}
              </span>
            </div>
          ))}
        </div>

        {status === "FAILED" && fullResponse?.error && (
          <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-left text-sm leading-6 text-rose-800">
            <span className="font-semibold">Previous attempt failed: </span>
            {fullResponse.error}
          </div>
        )}

        {requestError && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-left text-sm leading-6 text-rose-800"
          >
            {requestError}
          </div>
        )}

        <button
          type="button"
          onClick={handleGenerate}
          disabled={actionLoading}
          className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-violet-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
        >
          {actionLoading ? (
            <>
              <ArrowPathIcon
                className="mr-2 h-4 w-4 animate-spin"
                aria-hidden="true"
              />
              Starting…
            </>
          ) : (
            <>
              <SparklesIcon
                className="mr-2 h-4 w-4"
                aria-hidden="true"
              />
              Generate Study Pack
            </>
          )}
        </button>
        <p className="mt-3 text-xs text-gray-400">
          Generation usually takes under a minute.
        </p>
      </div>
    </div>
  );

  const renderTabs = () => {
    if (!studyPack) return null;

    return (
      <>
        <div
          role="tablist"
          aria-label="Study Pack sections"
          className="mb-6 flex flex-wrap gap-1 border-b border-gray-200 pb-2"
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
                className={`inline-flex shrink-0 items-center rounded-xl px-3.5 py-2.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-700 focus-visible:ring-offset-2 ${
                  selected
                    ? "bg-violet-900 text-white shadow-sm"
                    : "text-gray-600 hover:bg-violet-50 hover:text-violet-900"
                }`}
              >
                <Icon className="mr-2 h-4 w-4" aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </div>

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
            {tab.key === "summary" && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-violet-700">
                  <SparklesIcon className="h-4 w-4" aria-hidden="true" />
                  Study guide
                </div>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-gray-900">
                  {studyPack.title}
                </h3>
                {generatedAt && (
                  <p className="mt-1 text-xs text-gray-500">
                    Generated {generatedAt}
                  </p>
                )}
                <div className="mt-5 whitespace-pre-line text-[15px] leading-7 text-gray-700">
                  {studyPack.summary || "No summary was generated."}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  {
                    label: `${studyPack.keyConcepts.length} key concepts`,
                  },
                  {
                    label: `${studyPack.flashcards.length} flashcards`,
                  },
                  { label: `${studyPack.quiz.length} quiz questions` },
                ].map((item) => (
                  <span
                    key={item.label}
                    className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600"
                  >
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {tab.key === "concepts" && (
            <div>
              {studyPack.keyConcepts.length === 0 ? (
                <p className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
                  No key concepts were generated for this lecture.
                </p>
              ) : (
                <ol className="grid gap-4 sm:grid-cols-2">
                  {studyPack.keyConcepts.map((concept, index) => (
                    <li
                      key={`${concept.term}-${index}`}
                      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-900 text-sm font-semibold text-white">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <h4 className="font-semibold text-gray-900">
                            {concept.term}
                          </h4>
                          <p className="mt-1.5 text-sm leading-6 text-gray-600">
                            {concept.definition}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {tab.key === "flashcards" && (
            <div className="mx-auto max-w-2xl">
              {flashcards.length === 0 || !activeFlashcard ? (
                <p className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
                  No flashcards were generated for this lecture.
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <p className="font-semibold text-gray-800">Flashcards</p>
                    <p className="tabular-nums text-gray-500">
                      {flashcardIndex + 1} / {flashcards.length}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsFlipped((flipped) => !flipped)}
                    aria-pressed={isFlipped}
                    className={`mt-3 flex min-h-[260px] w-full flex-col items-center justify-center rounded-2xl border p-6 text-center shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-700 focus-visible:ring-offset-2 sm:min-h-[300px] sm:p-10 ${
                      isFlipped
                        ? "border-violet-200 bg-violet-50"
                        : "border-gray-200 bg-white hover:border-violet-300 hover:bg-violet-50/40"
                    }`}
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-700">
                      {isFlipped ? "Answer" : "Term"}
                    </span>
                    <span className="mt-4 max-w-xl text-lg font-medium leading-7 text-gray-900 sm:text-xl">
                      {isFlipped ? activeFlashcard.back : activeFlashcard.front}
                    </span>
                    <span className="mt-7 inline-flex items-center text-xs font-medium text-gray-500">
                      <ArrowPathIcon
                        className="mr-1.5 h-3.5 w-3.5"
                        aria-hidden="true"
                      />
                      {isFlipped
                        ? "Click to show the term"
                        : "Click to reveal the answer"}
                    </span>
                  </button>

                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-violet-900 transition-all duration-300"
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
                      className="inline-flex items-center rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4"
                    >
                      <ChevronLeftIcon
                        className="mr-1 h-4 w-4"
                        aria-hidden="true"
                      />
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => showFlashcard(flashcardIndex + 1)}
                      disabled={flashcardIndex >= flashcards.length - 1}
                      className="inline-flex items-center rounded-xl bg-violet-900 px-3.5 py-2.5 text-sm font-medium text-white transition hover:bg-violet-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300 sm:px-4"
                    >
                      Next
                      <ChevronRightIcon
                        className="ml-1 h-4 w-4"
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {tab.key === "quiz" && (
            <div className="mx-auto max-w-3xl">
              {quiz.length === 0 ? (
                <p className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
                  No quiz questions were generated for this lecture.
                </p>
              ) : (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        Practice quiz
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        {quizChecked
                          ? "Review the explanations below, then try again whenever you like."
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
                        className="inline-flex items-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-700 focus-visible:ring-offset-2"
                      >
                        <ArrowPathIcon
                          className="mr-2 h-4 w-4"
                          aria-hidden="true"
                        />
                        Try again
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setQuizChecked(true)}
                        disabled={!allAnswered}
                        className="inline-flex items-center rounded-xl bg-violet-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300"
                      >
                        <CheckCircleIcon
                          className="mr-2 h-4 w-4"
                          aria-hidden="true"
                        />
                        Check answers
                      </button>
                    )}
                  </div>

                  {!quizChecked && (
                    <p className="text-xs font-medium text-gray-500">
                      {answeredCount} of {quiz.length} answered
                    </p>
                  )}

                  {quizChecked && (
                    <div
                      role="status"
                      className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5"
                    >
                      <p className="text-sm font-semibold text-emerald-900">
                        You scored {quizScore} out of {quiz.length}
                        <span className="ml-2 font-normal text-emerald-700">
                          ({Math.round((quizScore / quiz.length) * 100)}%)
                        </span>
                      </p>
                      <p className="mt-1 text-xs leading-5 text-emerald-700">
                        {quizScore === quiz.length
                          ? "Perfect score — this lecture is in good shape."
                          : "Read through the explanations and give it another go."}
                      </p>
                    </div>
                  )}

                  {quiz.map((question, questionIndex) => {
                    const selectedAnswer = quizAnswers[questionIndex];

                    return (
                      <div
                        key={`${question.question}-${questionIndex}`}
                        className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-900">
                            {questionIndex + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-gray-900">
                              {question.question}
                            </p>

                            <div className="mt-4 space-y-2">
                              {question.options.map((option, optionIndex) => {
                                const selected =
                                  selectedAnswer === optionIndex;
                                const isCorrectOption =
                                  question.answerIndex === optionIndex;

                                let optionClasses =
                                  "border-gray-200 bg-white text-gray-800 hover:border-violet-300 hover:bg-violet-50";
                                if (quizChecked) {
                                  if (isCorrectOption) {
                                    optionClasses =
                                      "border-emerald-300 bg-emerald-50 text-emerald-900";
                                  } else if (selected) {
                                    optionClasses =
                                      "border-rose-300 bg-rose-50 text-rose-900";
                                  } else {
                                    optionClasses =
                                      "border-gray-200 bg-white text-gray-500";
                                  }
                                } else if (selected) {
                                  optionClasses =
                                    "border-violet-500 bg-violet-50 text-violet-900 ring-1 ring-violet-500";
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
                                    className={`flex w-full items-center rounded-xl border px-3.5 py-3 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-700 focus-visible:ring-offset-2 disabled:cursor-default ${optionClasses}`}
                                  >
                                    <span
                                      className={`mr-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                                        quizChecked && isCorrectOption
                                          ? "border-emerald-400 bg-emerald-100 text-emerald-800"
                                          : quizChecked &&
                                            selected &&
                                            !isCorrectOption
                                          ? "border-rose-400 bg-rose-100 text-rose-800"
                                          : selected
                                          ? "border-violet-400 bg-violet-100 text-violet-800"
                                          : "border-gray-300 text-gray-500"
                                      }`}
                                    >
                                      {String.fromCharCode(65 + optionIndex)}
                                    </span>
                                    <span className="flex-1">{option}</span>
                                    {quizChecked && isCorrectOption && (
                                      <CheckCircleIcon
                                        className="ml-2 h-5 w-5 shrink-0 text-emerald-600"
                                        aria-label="Correct answer"
                                      />
                                    )}
                                    {quizChecked &&
                                      selected &&
                                      !isCorrectOption && (
                                        <XCircleIcon
                                          className="ml-2 h-5 w-5 shrink-0 text-rose-500"
                                          aria-label="Your answer"
                                        />
                                      )}
                                  </button>
                                );
                              })}
                            </div>

                            {quizChecked && question.explanation && (
                              <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm leading-6 text-gray-700">
                                <span className="font-semibold text-gray-900">
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
              )}
            </div>
          )}
          </div>
        ))}
      </>
    );
  };

  const renderReadyContent = () => {
    if (!studyPack) {
      return (
        <div className="mx-auto max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="text-sm font-medium text-amber-900">
            This Study Pack is marked ready, but no content was returned.
          </p>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="mt-4 inline-flex items-center rounded-xl bg-violet-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-700 focus-visible:ring-offset-2 disabled:opacity-60"
          >
            <ArrowPathIcon
              className={`mr-2 h-4 w-4 ${
                refreshing ? "animate-spin" : ""
              }`}
              aria-hidden="true"
            />
            Refresh
          </button>
        </div>
      );
    }
    return renderTabs();
  };

  const renderBody = () => {
    if (initialLoading) {
      return renderLoadingPanel("Loading your Study Pack…");
    }

    if (!fullResponse) {
      return renderErrorPanel();
    }

    if (isPending) {
      return renderPendingPanel();
    }

    if (status === "READY") {
      return (
        <>
          {requestError && (
            <div
              role="alert"
              className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              <span>{requestError}</span>
              <button
                type="button"
                onClick={refresh}
                disabled={refreshing}
                className="inline-flex items-center rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-60"
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
        </>
      );
    }

    if (status === "FAILED" || status === "NOT_GENERATED") {
      return renderIntroPanel();
    }

    return renderErrorPanel();
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      className="relative z-50"
    >
      <div
        className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm"
        aria-hidden="true"
      />

      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-stretch justify-center sm:items-center sm:p-6">
          <Dialog.Panel className="relative flex min-h-screen w-full flex-col overflow-hidden bg-gray-50 shadow-2xl sm:h-[92vh] sm:max-h-[860px] sm:min-h-0 sm:max-w-4xl sm:rounded-2xl sm:border sm:border-gray-200">
            <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-violet-950 via-violet-900 to-violet-800 px-5 py-5 text-white sm:px-7 sm:py-6">
              <div
                className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full border border-white/10 bg-white/5"
                aria-hidden="true"
              />
              <div
                className="pointer-events-none absolute -bottom-16 right-16 h-32 w-32 rounded-full bg-violet-500/20 blur-2xl"
                aria-hidden="true"
              />
              <div className="relative flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 sm:flex">
                    <BookOpenIcon
                      className="h-6 w-6"
                      aria-hidden="true"
                    />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200">
                      LectureLens
                    </p>
                    <Dialog.Title className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
                      Study Pack
                    </Dialog.Title>
                    <p className="mt-1 truncate text-sm text-violet-200">
                      {document.filename}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close Study Pack"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-violet-100 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                >
                  <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="p-5 sm:p-7">{renderBody()}</div>
            </div>
          </Dialog.Panel>
        </div>
      </div>
    </Dialog>
  );
};

export default StudyPackModal;
