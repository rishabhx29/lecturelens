import React, { useEffect, useRef } from "react";
import {
  BookOpenIcon,
  PaperAirplaneIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { Conversation } from "../common/types";
import { LensMark } from "./Logo";

interface ChatMessagesProps {
  conversation: Conversation;
  messageStatus: string;
  handlePromptChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleKeyPress: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  prompt: string;
  submitMessage: () => Promise<void>;
  onSuggestion?: (text: string) => void;
  onOpenStudyPack?: () => void;
}

const SUGGESTIONS = [
  "What is the main idea of this lecture?",
  "Explain the hardest concept simply.",
  "Quiz me on the key facts.",
];

function renderMessageContent(content: string) {
  const parts = content.split(/(\(pages? [^)]+\))/gi);
  return parts.map((part, index) =>
    /^\(pages?/i.test(part) ? (
      <mark
        key={`${part}-${index}`}
        className="mx-1 inline-block rounded-md bg-cobalt-soft px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-cobalt"
      >
        {part}
      </mark>
    ) : (
      <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
    )
  );
}

const ChatMessages: React.FC<ChatMessagesProps> = ({
  prompt,
  conversation,
  messageStatus,
  submitMessage,
  handlePromptChange,
  handleKeyPress,
  onSuggestion,
  onOpenStudyPack,
}) => {
  const isReady = conversation.document.docstatus === "READY";
  const isSending = messageStatus === "loading";
  const inputDisabled = isSending || !isReady;
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const element = messagesRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  }, [conversation.messages.length, messageStatus]);

  const chooseSuggestion = (suggestion: string) => {
    onSuggestion?.(suggestion);
    inputRef.current?.focus();
  };

  return (
    <section className="order-1 flex min-h-[560px] min-w-0 flex-1 flex-col bg-paper-light lg:order-2 lg:min-h-0">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-7">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-moss/50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-moss" />
          </span>
          <p className="eyebrow">Live thread</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden font-mono text-[9px] uppercase tracking-[0.14em] text-ink-muted sm:inline">
            {conversation.document.pages} pages indexed
          </span>
          {isReady && onOpenStudyPack && (
            <button
              type="button"
              onClick={onOpenStudyPack}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-ink px-3 font-mono text-[9px] uppercase tracking-[0.1em] text-paper transition hover:bg-cobalt focus:outline-none focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:ring-offset-2 lg:hidden"
            >
              <BookOpenIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Study pack
            </button>
          )}
        </div>
      </header>

      <div
        ref={messagesRef}
        className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7 sm:py-8"
      >
        <div className="mx-auto max-w-3xl">
          {conversation.messages.length === 0 && (
            <div className="flex flex-col items-start py-10 sm:py-16">
              <span className="eyebrow">Thread 01 / Ready</span>
              <h2 className="mt-4 max-w-lg font-display text-[clamp(2.2rem,4vw,3.4rem)] font-semibold leading-[0.93] tracking-[-0.06em] text-ink">
                Ask the lecture.
              </h2>
              <p className="mt-4 max-w-md text-sm leading-7 text-ink-muted">
                Start with a question you didn&apos;t get to ask in class. Every
                answer stays grounded in the pages of this PDF.
              </p>
            </div>
          )}

          <div className="space-y-7">
            {conversation.messages.map((message, index) => {
              const isAi = message.type === "ai";
              return (
                <div
                  key={`${message.type}-${index}`}
                  className={`flex gap-3 ${isAi ? "justify-start" : "justify-end"}`}
                >
                  {isAi && (
                    <span className="mt-1 hidden h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-ink text-paper sm:flex">
                      <LensMark className="h-[17px] w-[17px]" />
                    </span>
                  )}
                  <div
                    className={`max-w-[86%] ${
                      isAi ? "min-w-0" : "flex justify-end"
                    }`}
                  >
                    {isAi && (
                      <div className="mb-2 flex items-center gap-2">
                        <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink-muted">
                          LectureLens
                        </span>
                        <span className="h-1 w-1 rounded-full bg-line" />
                        <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink-muted">
                          Grounded
                        </span>
                      </div>
                    )}
                    <div
                      className={
                        isAi
                          ? "rounded-2xl rounded-tl-md border border-line bg-white/70 px-4 py-3.5 text-[15px] leading-7 text-ink-soft shadow-[0_10px_24px_-22px_rgba(20,21,24,0.35)]"
                          : "rounded-2xl rounded-br-md bg-cobalt px-4 py-3.5 text-[15px] leading-7 text-white shadow-soft"
                      }
                    >
                      <p className="whitespace-pre-line">
                        {renderMessageContent(message.data.content)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {isSending && (
              <div className="flex gap-3">
                <span className="mt-1 hidden h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-ink text-paper sm:flex">
                  <LensMark className="h-[17px] w-[17px]" />
                </span>
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink-muted">
                      LectureLens
                    </span>
                  </div>
                  <div className="flex h-[52px] items-center gap-1.5 rounded-2xl rounded-tl-md border border-line bg-white/70 px-4">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-line bg-paper/60 p-4 sm:p-5">
        <div className="mx-auto max-w-3xl">
          {isReady && onSuggestion && (
            <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-0.5 hide-scrollbar">
              <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.13em] text-ink-muted">
                Try
              </span>
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => chooseSuggestion(suggestion)}
                  className="shrink-0 rounded-full border border-line bg-paper-light px-3 py-1.5 text-[11px] text-ink-soft transition hover:border-cobalt/30 hover:bg-cobalt-soft hover:text-cobalt"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-line bg-white/75 shadow-soft transition focus-within:border-cobalt/50 focus-within:ring-2 focus-within:ring-cobalt/10">
            <div className="flex items-center gap-1 px-2.5 py-2">
              <span className="pl-1 text-ink-muted">
                <SparklesIcon className="h-4 w-4" aria-hidden="true" />
              </span>
              <input
                ref={inputRef}
                disabled={inputDisabled}
                type="text"
                id="prompt"
                value={prompt}
                onChange={handlePromptChange}
                onKeyDown={handleKeyPress}
                className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-sm text-ink outline-none placeholder:text-ink-muted disabled:cursor-not-allowed"
                placeholder={
                  !isReady
                    ? conversation.document.docstatus === "FAILED"
                      ? "Processing failed. Delete and re-upload this PDF."
                      : "Your lecture is still processing…"
                    : `Ask ${conversation.document.filename} anything…`
                }
              />
              <button
                type="button"
                onClick={submitMessage}
                disabled={inputDisabled || !prompt.trim()}
                aria-label="Send message"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink text-paper transition hover:bg-cobalt disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-muted"
              >
                {isSending ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-paper/30 border-t-paper" />
                ) : (
                  <PaperAirplaneIcon className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-line/70 px-3.5 py-2 font-mono text-[9px] uppercase tracking-[0.11em] text-ink-muted">
              <span>{isReady ? "Enter to send" : "Waiting for processing"}</span>
              <span className="hidden sm:inline">
                {conversation.document.pages} pages indexed
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ChatMessages;
