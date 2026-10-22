import React from "react";

type StatusKind = "document" | "study";

interface StatusBadgeProps {
  status: string;
  kind?: StatusKind;
  inverse?: boolean;
}

const DOCUMENT_LABELS: Record<string, string> = {
  UPLOADED: "Awaiting processing",
  PROCESSING: "Processing",
  READY: "Ready",
  FAILED: "Failed",
};

const STUDY_LABELS: Record<string, string> = {
  NOT_GENERATED: "Not generated",
  QUEUED: "Queued",
  PROCESSING: "Generating",
  READY: "Ready",
  FAILED: "Failed",
};

const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  kind = "document",
  inverse = false,
}) => {
  const label =
    kind === "study"
      ? STUDY_LABELS[status] ?? status
      : DOCUMENT_LABELS[status] ?? status;

  const tone = (() => {
    if (inverse) {
      if (status === "READY") {
        return "border-lime/25 bg-lime/20 text-lime";
      }
      if (status === "FAILED") {
        return "border-coral/30 bg-coral/10 text-[#ffb3a4]";
      }
      return "border-paper/20 bg-paper/10 text-paper/75";
    }

    if (status === "READY") {
      return "border-moss/20 bg-moss/10 text-moss";
    }
    if (status === "FAILED") {
      return "border-coral/25 bg-coral/10 text-coral";
    }
    if (status === "PROCESSING" || status === "QUEUED") {
      return "border-cobalt/20 bg-cobalt-soft text-cobalt";
    }
    if (status === "UPLOADED") {
      return "border-amber/25 bg-amber/10 text-amber";
    }
    return "border-line bg-paper text-ink-muted";
  })();

  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2.5 font-mono text-[9px] font-medium uppercase tracking-[0.13em] ${tone}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === "PROCESSING" || status === "QUEUED"
            ? "animate-pulse bg-cobalt"
            : "bg-current"
        }`}
      />
      {label}
    </span>
  );
};

export default StatusBadge;
