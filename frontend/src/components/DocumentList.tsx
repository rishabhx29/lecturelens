import { useState, useEffect } from "react";
import { get, del } from "aws-amplify/api";
import { Link } from "react-router-dom";
import {
  ArrowPathRoundedSquareIcon,
  ArrowUpRightIcon,
  BookOpenIcon,
  DocumentTextIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { Document } from "../common/types";
import { filesize } from "filesize";
import { getShortDate } from "../common/utilities";
import SectionHeading from "./SectionHeading";
import StatusBadge from "./StatusBadge";

interface LectureCardProps {
  document: Document;
  index: number;
  featured: boolean;
  onDeleted: () => void;
}

const LectureCard: React.FC<LectureCardProps> = ({
  document,
  index,
  featured,
  onDeleted,
}) => {
  const [deleteStatus, setDeleteStatus] = useState<"idle" | "deleting">(
    "idle"
  );
  const conversationId = document.conversations?.[0]?.conversationid;
  const openPath = conversationId
    ? `/doc/${document.documentid}/${conversationId}`
    : "/";

  const deleteDocument = async (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (deleteStatus === "deleting") return;

    setDeleteStatus("deleting");
    try {
      await del({
        apiName: "serverless-pdf-chat",
        path: `doc/${document.documentid}`,
      }).response;
      onDeleted();
    } catch (error) {
      console.error("Failed to delete document", error);
    } finally {
      setDeleteStatus("idle");
    }
  };

  const number = String(index + 1).padStart(2, "0");
  const metaClass = featured
    ? "border-paper/10 divide-paper/10"
    : "border-line divide-line";
  const metaLabelClass = featured
    ? "font-mono text-[9px] uppercase tracking-[0.14em] text-paper/50"
    : "font-mono text-[9px] uppercase tracking-[0.14em] text-ink-muted";
  const metaValueClass = featured ? "text-paper" : "text-ink";

  return (
    <article
      className={`group relative flex min-h-[268px] flex-col justify-between overflow-hidden rounded-[28px] border p-5 transition duration-300 sm:p-6 ${
        featured
          ? "border-ink bg-ink text-paper md:col-span-2"
          : "border-line bg-paper-light text-ink hover:-translate-y-0.5 hover:border-ink/20 hover:shadow-lift"
      }`}
    >
      <Link
        to={openPath}
        className="absolute inset-0 z-10 rounded-[28px] focus:outline-none focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:ring-offset-4 focus-visible:ring-offset-paper"
        aria-label={`Open ${document.filename}`}
      />

      {featured && (
        <span className="absolute left-0 top-0 h-1 w-20 bg-lime" aria-hidden="true" />
      )}

      <div className="pointer-events-none relative z-20 flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3.5">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              featured
                ? "bg-lime text-ink"
                : "bg-cobalt text-white"
            }`}
          >
            <DocumentTextIcon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p
              className={`font-mono text-[9px] uppercase tracking-[0.16em] ${
                featured ? "text-paper/50" : "text-ink-muted"
              }`}
            >
              Lecture {number}
            </p>
            <h3 className="mt-2 line-clamp-2 max-w-[30rem] font-display text-[clamp(1.4rem,2.6vw,2.15rem)] font-semibold leading-[0.97] tracking-[-0.055em]">
              {document.filename}
            </h3>
            <p
              className={`mt-2 text-xs ${
                featured ? "text-paper/50" : "text-ink-muted"
              }`}
            >
              {document.pages} pages ·{" "}
              {filesize(Number(document.filesize)).toString()}
            </p>
          </div>
        </div>
        <StatusBadge status={document.docstatus} inverse={featured} />
      </div>

      <div className="pointer-events-none relative z-20 mt-8">
        <div
          className={`grid grid-cols-3 divide-x overflow-hidden rounded-xl border ${metaClass}`}
        >
          {[
            ["Added", getShortDate(document.created)],
            ["Threads", String(document.conversations?.length ?? 0)],
            [
              "Study pack",
              document.docstatus === "READY" ? "Available" : "Pending",
            ],
          ].map(([label, value]) => (
            <div key={label} className="bg-transparent p-3">
              <p className={metaLabelClass}>{label}</p>
              <p className={`mt-1 text-[11px] leading-5 ${metaValueClass}`}>
                {value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <p
            className={`text-[11px] ${
              featured ? "text-paper/50" : "text-ink-muted"
            }`}
          >
            {document.docstatus === "READY"
              ? "Chat and build a Study Pack"
              : document.docstatus === "FAILED"
                ? "Needs a fresh upload"
                : "Indexing pages…"}
          </p>

          <div className="relative z-30 flex items-center gap-2">
            <button
              type="button"
              onClick={deleteDocument}
              disabled={deleteStatus === "deleting"}
              aria-label={`Delete ${document.filename}`}
              className={`pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full transition ${
                featured
                  ? "text-paper/50 hover:bg-paper/10 hover:text-paper"
                  : "text-ink-muted hover:bg-coral/10 hover:text-coral"
              } disabled:opacity-40`}
            >
              <TrashIcon
                className={`h-4 w-4 ${
                  deleteStatus === "deleting" ? "animate-spin" : ""
                }`}
                aria-hidden="true"
              />
            </button>
            <span
              className={`pointer-events-none inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 font-mono text-[9px] uppercase tracking-[0.12em] transition ${
                featured
                  ? "bg-lime text-ink"
                  : "bg-ink text-paper group-hover:bg-cobalt"
              }`}
            >
              Open
              <ArrowUpRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </div>
        </div>
      </div>

      <span
        className={`pointer-events-none absolute -bottom-14 -right-2 z-0 font-display text-[10rem] font-semibold leading-none tracking-[-0.1em] ${
          featured ? "text-paper/[0.045]" : "text-ink/[0.035]"
        }`}
        aria-hidden="true"
      >
        {number}
      </span>
    </article>
  );
};

const DocumentList: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [listStatus, setListStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setListStatus("loading");
    setError(null);
    try {
      const response = await get({
        apiName: "serverless-pdf-chat",
        path: "doc",
      }).response;
      const docs = (await response.body.json()) as unknown as Document[];
      setDocuments(docs);
    } catch (fetchError) {
      console.error("Failed to load documents", fetchError);
      setError("The library didn’t load. Try refreshing in a moment.");
    } finally {
      setListStatus("idle");
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <section id="library" className="scroll-mt-28 pb-14">
      <SectionHeading
        index="02"
        label="Your library"
        title="Lectures, in one place."
        description="Open a lecture to ask questions or build a Study Pack from its pages."
        action={
          <button
            onClick={fetchData}
            type="button"
            aria-label="Refresh lecture library"
            className="icon-button"
          >
            <ArrowPathRoundedSquareIcon
              className={`h-4 w-4 ${
                listStatus === "loading" ? "animate-spin" : ""
              }`}
              aria-hidden="true"
            />
          </button>
        }
      />

      {error && (
        <div
          role="alert"
          className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-coral/25 bg-coral/10 px-4 py-3 text-sm text-coral"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={fetchData}
            className="font-medium underline underline-offset-4"
          >
            Try again
          </button>
        </div>
      )}

      {listStatus === "loading" && documents.length === 0 && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {[0, 1].map((item) => (
            <div
              key={item}
              className={`min-h-[268px] rounded-[28px] border border-line bg-paper-light p-6 ${
                item === 0 ? "md:col-span-2" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="skeleton h-10 w-10 rounded-xl" />
                <div className="space-y-2">
                  <div className="skeleton h-2.5 w-24 rounded-full" />
                  <div className="skeleton h-5 w-64 max-w-full rounded-full" />
                </div>
              </div>
              <div className="mt-8 skeleton h-16 w-full rounded-xl" />
            </div>
          ))}
        </div>
      )}

      {documents.length > 0 && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {documents.map((document, index) => (
            <LectureCard
              key={document.documentid}
              document={document}
              index={index}
              featured={index === 0}
              onDeleted={fetchData}
            />
          ))}
        </div>
      )}

      {listStatus === "idle" && !error && documents.length === 0 && (
        <div className="mt-6 overflow-hidden rounded-[28px] border border-dashed border-line bg-paper-light px-6 py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-line bg-paper text-cobalt">
            <BookOpenIcon className="h-6 w-6" aria-hidden="true" />
          </div>
          <h3 className="mt-5 font-display text-3xl font-semibold tracking-[-0.055em] text-ink">
            A quiet library.
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-ink-muted">
            Add your first lecture PDF to start asking questions and building
            Study Packs.
          </p>
          <a href="#upload-lecture" className="btn btn-primary mt-6">
            <PlusIcon className="h-4 w-4" aria-hidden="true" />
            Add your first lecture
          </a>
        </div>
      )}
    </section>
  );
};

export default DocumentList;
