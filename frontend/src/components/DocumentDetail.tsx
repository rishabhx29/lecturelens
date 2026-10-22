import { Document } from "../common/types";
import { getDateTime } from "../common/utilities";
import { filesize } from "filesize";
import {
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { del } from "aws-amplify/api";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import StatusBadge from "./StatusBadge";

interface DocumentDetailProps {
  document: Document;
  onDocumentDeleted?: (document?: Document) => void;
}

const DocumentDetail: React.FC<DocumentDetailProps> = ({
  document,
  onDocumentDeleted,
}) => {
  const navigate = useNavigate();
  const [deleteStatus, setDeleteStatus] = useState<"idle" | "deleting">(
    "idle"
  );

  const deleteDocument = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (deleteStatus === "deleting") return;

    setDeleteStatus("deleting");
    try {
      await del({
        apiName: "serverless-pdf-chat",
        path: `doc/${document.documentid}`,
      }).response;

      if (onDocumentDeleted) onDocumentDeleted(document);
      else navigate("/");
    } catch (error) {
      console.error("Failed to delete document", error);
    } finally {
      setDeleteStatus("idle");
    }
  };

  const threadCount = document.conversations?.length ?? 0;

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow">Lecture file</p>
        <StatusBadge status={document.docstatus} />
      </div>

      <div className="mt-4 flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cobalt text-white">
          <DocumentTextIcon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 pt-0.5">
          <h2 className="break-words font-display text-[1.25rem] font-semibold leading-[1.05] tracking-[-0.04em] text-ink">
            {document.filename}
          </h2>
          <p className="mt-1.5 text-xs text-ink-muted">
            {document.pages} pages · {filesize(Number(document.filesize)).toString()}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line">
        <div className="bg-paper-light p-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-muted">
            Added
          </p>
          <p className="mt-1 text-[11px] leading-5 text-ink-soft">
            {getDateTime(document.created)}
          </p>
        </div>
        <div className="bg-paper-light p-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-muted">
            Threads
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] leading-5 text-ink-soft">
            <ChatBubbleLeftRightIcon
              className="h-3.5 w-3.5 text-ink-muted"
              aria-hidden="true"
            />
            {threadCount} conversation{threadCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[11px] leading-5 text-ink-muted">
          {document.docstatus === "READY"
            ? "Ready for questions and a Study Pack."
            : document.docstatus === "FAILED"
              ? "Processing failed. Remove it and try again."
              : "Hang tight while this lecture is indexed."}
        </p>
        <button
          onClick={deleteDocument}
          disabled={deleteStatus === "deleting"}
          aria-label={`Delete ${document.filename}`}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted transition hover:bg-coral/10 hover:text-coral disabled:opacity-40"
        >
          <TrashIcon
            className={`h-4 w-4 ${
              deleteStatus === "deleting" ? "animate-spin" : ""
            }`}
            aria-hidden="true"
          />
        </button>
      </div>
    </div>
  );
};

export default DocumentDetail;
