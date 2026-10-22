import DocumentDetail from "./DocumentDetail";
import { Conversation } from "../common/types";
import { getDateTime } from "../common/utilities";
import { Params } from "react-router-dom";
import {
  ArrowPathIcon,
  ArrowUpRightIcon,
  BookOpenIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";

interface ChatSidebarProps {
  conversation: Conversation;
  params: Params;
  addConversation: () => Promise<void>;
  switchConversation: (e: React.MouseEvent<HTMLButtonElement>) => void;
  conversationListStatus: "idle" | "loading";
  onOpenStudyPack: () => void;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  conversation,
  params,
  addConversation,
  switchConversation,
  conversationListStatus,
  onOpenStudyPack,
}) => {
  const isReady = conversation.document.docstatus === "READY";
  const threads = conversation.document.conversations ?? [];

  return (
    <aside className="order-2 flex flex-col border-t border-line bg-paper-deep/60 lg:order-1 lg:w-[320px] lg:shrink-0 lg:border-r lg:border-t-0">
      <div className="p-5 sm:p-6">
        <DocumentDetail document={conversation.document} />
      </div>

      <div className="px-5 pb-5">
        <button
          type="button"
          onClick={onOpenStudyPack}
          disabled={!isReady}
          aria-describedby={isReady ? undefined : "study-pack-hint"}
          className={`group flex w-full items-center gap-3 rounded-2xl p-4 text-left transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:ring-offset-4 focus-visible:ring-offset-paper ${
            isReady
              ? "bg-cobalt text-white hover:bg-cobalt-dark"
              : "cursor-not-allowed border border-line bg-paper-light text-ink-muted"
          }`}
        >
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              isReady ? "bg-white/10" : "bg-paper text-ink-muted"
            }`}
          >
            <BookOpenIcon className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-lg font-semibold tracking-[-0.035em]">
              Study Pack
            </span>
            <span
              className={`mt-0.5 block font-mono text-[9px] uppercase tracking-[0.11em] ${
                isReady ? "text-white/70" : "text-ink-muted"
              }`}
            >
              Summary · cards · quiz
            </span>
          </span>
          <ArrowUpRightIcon
            className={`h-4 w-4 shrink-0 transition ${
              isReady ? "text-white/70 group-hover:text-white" : "text-ink-muted"
            }`}
            aria-hidden="true"
          />
        </button>
        {!isReady && (
          <p
            id="study-pack-hint"
            className="mt-2 px-1 text-[11px] leading-5 text-ink-muted"
          >
            Available once this lecture finishes processing.
          </p>
        )}
      </div>

      <div className="border-t border-line px-5 py-5">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Threads</p>
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-muted">
            {String(threads.length).padStart(2, "0")}
          </span>
        </div>

        <button
          type="button"
          onClick={addConversation}
          disabled={conversationListStatus === "loading"}
          className="mt-3 inline-flex h-9 w-full items-center gap-2 rounded-full border border-line bg-paper-light/70 px-3.5 text-xs font-medium text-ink-soft transition hover:border-ink/25 hover:bg-paper-light hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          {conversationListStatus === "loading" ? (
            <ArrowPathIcon
              className="h-3.5 w-3.5 animate-spin"
              aria-hidden="true"
            />
          ) : (
            <PlusIcon className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {conversationListStatus === "loading"
            ? "Starting thread…"
            : "New thread"}
        </button>

        <div className="mt-2 max-h-[210px] space-y-1 overflow-y-auto pr-1">
          {threads.map((thread, index) => {
            const active = params.conversationid === thread.conversationid;
            return (
              <button
                key={thread.conversationid}
                id={thread.conversationid}
                type="button"
                onClick={switchConversation}
                aria-current={active ? "page" : undefined}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition ${
                  active
                    ? "bg-ink text-paper"
                    : "text-ink-soft hover:bg-paper-light hover:text-ink"
                }`}
              >
                <span
                  className={`font-mono text-[9px] tracking-[0.1em] ${
                    active ? "text-lime" : "text-ink-muted"
                  }`}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium">
                    Thread {String(index + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={`mt-0.5 block truncate text-[10px] ${
                      active ? "text-paper/50" : "text-ink-muted"
                    }`}
                  >
                    {getDateTime(thread.created)}
                  </span>
                </span>
                {active && (
                  <span className="h-1.5 w-1.5 rounded-full bg-lime" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-auto hidden items-center gap-2 border-t border-line px-5 py-4 font-mono text-[9px] uppercase tracking-[0.13em] text-ink-muted lg:flex">
        <span className="h-1.5 w-1.5 rounded-full bg-cobalt" />
        Grounded in {conversation.document.pages} pages
      </div>
    </aside>
  );
};

export default ChatSidebar;
