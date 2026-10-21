import { get, post } from "aws-amplify/api";
import { StudyPackResponse, StudyPackStatus } from "./types";

const API_NAME = "serverless-pdf-chat";

const STUDY_PACK_STATUSES: StudyPackStatus[] = [
  "NOT_GENERATED",
  "QUEUED",
  "PROCESSING",
  "READY",
  "FAILED",
];

function isStudyPackStatus(value: unknown): value is StudyPackStatus {
  return (
    typeof value === "string" &&
    STUDY_PACK_STATUSES.includes(value as StudyPackStatus)
  );
}

/**
 * The API only returns the fields that are relevant to the current status.
 * Fill in the gaps so the UI can rely on a consistent shape.
 */
function normalizeStudyPackResponse(
  value: unknown
): StudyPackResponse {
  const data =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  return {
    status: isStudyPackStatus(data.status) ? data.status : "NOT_GENERATED",
    studyPack:
      data.studyPack && typeof data.studyPack === "object"
        ? (data.studyPack as StudyPackResponse["studyPack"])
        : null,
    updated: typeof data.updated === "string" ? data.updated : null,
    error: typeof data.error === "string" ? data.error : null,
  };
}

export async function getStudyPack(
  documentId: string
): Promise<StudyPackResponse> {
  const response = await get({
    apiName: API_NAME,
    path: `doc/${encodeURIComponent(documentId)}/study-pack`,
  }).response;

  return normalizeStudyPackResponse(
    await response.body.json()
  );
}

export async function generateStudyPack(
  documentId: string
): Promise<StudyPackResponse> {
  const response = await post({
    apiName: API_NAME,
    path: `doc/${encodeURIComponent(documentId)}/study-pack`,
  }).response;

  return normalizeStudyPackResponse(
    await response.body.json()
  );
}

function extractMessage(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    // API Gateway often returns the error body as a JSON string.
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return extractMessage(JSON.parse(trimmed));
      } catch {
        // Not JSON after all; fall through and use the raw string.
      }
    }

    return trimmed.length > 320 ? `${trimmed.slice(0, 320)}…` : trimmed;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["message", "error", "detail", "body"]) {
      const message = extractMessage(record[key]);
      if (message) return message;
    }
  }

  return null;
}

/**
 * Turn Amplify/API Gateway errors into a short, human-readable message.
 */
export function getStudyPackErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const response =
      record.response && typeof record.response === "object"
        ? (record.response as Record<string, unknown>)
        : null;

    const bodyMessage = extractMessage(response?.body);
    if (bodyMessage) return bodyMessage;

    if (response?.statusCode === 409) {
      return "This lecture is still processing. Try again once it is ready.";
    }

    const errorMessage = extractMessage(record.message);
    if (errorMessage) return errorMessage;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return "We couldn't reach the Study Pack service. Check your connection and try again.";
}
