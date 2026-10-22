import React, { useState, useEffect, KeyboardEvent } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { get, post } from "aws-amplify/api";
import { ArrowLeftIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { Conversation } from "../common/types";
import ChatSidebar from "../components/ChatSidebar";
import ChatMessages from "../components/ChatMessages";
import StudyPackModal from "../components/StudyPackModal";

const Document: React.FC = () => {
  const params = useParams();
  const navigate = useNavigate();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = React.useState<string>("idle");
  const [messageStatus, setMessageStatus] = useState<string>("idle");
  const [conversationListStatus, setConversationListStatus] = useState<
    "idle" | "loading"
  >("idle");
  const [prompt, setPrompt] = useState("");
  const [studyPackOpen, setStudyPackOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchData = async (conversationid = params.conversationid) => {
    if (!conversationid) return;
    setLoading("loading");
    setLoadError(null);
    try {
      const response = await get({
        apiName: "serverless-pdf-chat",
        path: `doc/${params.documentid}/${conversationid}`,
      }).response;
      const nextConversation = (await response.body.json()) as unknown as Conversation;
      setConversation(nextConversation);
    } catch (error) {
      console.error("Failed to load conversation", error);
      setLoadError("This thread couldn’t be loaded. Head back to the library and try again.");
    } finally {
      setLoading("idle");
    }
  };

  useEffect(() => {
    fetchData();
    // Intentionally runs once on mount for the route's initial conversation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePromptChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPrompt(event.target.value);
  };

  const addConversation = async () => {
    setConversationListStatus("loading");
    try {
      const response = await post({
        apiName: "serverless-pdf-chat",
        path: `doc/${params.documentid}`,
      }).response;
      const newConversation =
        (await response.body.json()) as unknown as Conversation;
      await fetchData(newConversation.conversationid);
      navigate(`/doc/${params.documentid}/${newConversation.conversationid}`);
    } catch (error) {
      console.error("Failed to start a conversation", error);
    } finally {
      setConversationListStatus("idle");
    }
  };

  const switchConversation = (e: React.MouseEvent<HTMLButtonElement>) => {
    const conversationId = e.currentTarget.id;
    if (!conversationId) return;
    navigate(`/doc/${params.documentid}/${conversationId}`);
    fetchData(conversationId);
  };

  const handleKeyPress = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submitMessage();
    }
  };

  const submitMessage = async () => {
    if (
      !conversation ||
      conversation.document.docstatus !== "READY" ||
      !prompt.trim()
    ) {
      return;
    }

    const outgoingPrompt = prompt;
    setMessageStatus("loading");
    const previewMessage = {
      type: "text",
      data: {
        content: outgoingPrompt,
        additional_kwargs: {},
        example: false,
      },
    };

    setConversation({
      ...conversation,
      messages: [...conversation.messages, previewMessage],
    });
    setPrompt("");

    try {
      await post({
        apiName: "serverless-pdf-chat",
        path: `${conversation.document.documentid}/${conversation.conversationid}`,
        options: {
          body: {
            fileName: conversation.document.filename,
            prompt: outgoingPrompt,
          },
        },
      }).response;
    } catch (error) {
      console.error("Failed to send message", error);
      setPrompt(outgoingPrompt);
    } finally {
      await fetchData(conversation.conversationid);
      setMessageStatus("idle");
    }
  };

  return (
    <div className="page-enter pb-4">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-xs text-ink-muted">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 transition hover:bg-ink/5 hover:text-ink"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" aria-hidden="true" />
            Library
          </Link>
          <span className="text-line">/</span>
          <span className="truncate text-ink-soft">
            {conversation?.document.filename ?? "Lecture"}
          </span>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-muted">
          Page-grounded answers
        </span>
      </div>

      {loading === "loading" && !conversation && (
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="rounded-[30px] border border-line bg-paper-light p-6">
            <div className="skeleton h-3 w-20 rounded-full" />
            <div className="mt-4 flex gap-3">
              <div className="skeleton h-11 w-11 rounded-2xl" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-3/4 rounded-full" />
                <div className="skeleton h-3 w-1/2 rounded-full" />
              </div>
            </div>
            <div className="skeleton mt-6 h-32 w-full rounded-xl" />
          </div>
          <div className="min-h-[560px] rounded-[30px] border border-line bg-paper-light p-6">
            <div className="skeleton h-3 w-24 rounded-full" />
            <div className="mt-8 space-y-4">
              <div className="skeleton h-24 w-4/5 rounded-2xl" />
              <div className="skeleton ml-auto h-16 w-3/5 rounded-2xl" />
              <div className="skeleton h-28 w-5/6 rounded-2xl" />
            </div>
          </div>
        </div>
      )}

      {loadError && !conversation && (
        <div className="mx-auto max-w-lg rounded-[28px] border border-coral/25 bg-paper-light p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-coral/10 text-coral">
            <ExclamationTriangleIcon className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="mt-5 font-display text-3xl font-semibold tracking-[-0.05em] text-ink">
            Thread unavailable.
          </h1>
          <p className="mt-2 text-sm leading-6 text-ink-muted">{loadError}</p>
          <Link to="/" className="btn btn-primary mt-6">
            Back to the library
          </Link>
        </div>
      )}

      {conversation && (
        <div className="flex flex-col overflow-hidden rounded-[30px] border border-line bg-paper-light shadow-card lg:h-[calc(100vh-190px)] lg:min-h-[620px] lg:flex-row">
          <ChatSidebar
            conversation={conversation}
            params={params}
            addConversation={addConversation}
            switchConversation={switchConversation}
            conversationListStatus={conversationListStatus}
            onOpenStudyPack={() => setStudyPackOpen(true)}
          />
          <ChatMessages
            prompt={prompt}
            conversation={conversation}
            messageStatus={messageStatus}
            submitMessage={submitMessage}
            handleKeyPress={handleKeyPress}
            handlePromptChange={handlePromptChange}
            onSuggestion={setPrompt}
            onOpenStudyPack={() => setStudyPackOpen(true)}
          />
        </div>
      )}

      <StudyPackModal
        isOpen={studyPackOpen}
        onClose={() => setStudyPackOpen(false)}
        document={conversation?.document ?? null}
      />
    </div>
  );
};

export default Document;
