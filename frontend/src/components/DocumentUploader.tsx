import {
  ChangeEvent,
  DragEvent,
  useRef,
  useState,
} from "react";
import { get } from "aws-amplify/api";
import { filesize } from "filesize";
import {
  CheckCircleIcon,
  CloudArrowUpIcon,
  DocumentTextIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import SectionHeading from "./SectionHeading";

interface DocumentUploaderProps {
  onDocumentUploaded?: () => void;
}

type UploadStatus = "ready" | "uploading" | "success" | "error";

const MAX_FILE_BYTES = 20 * 1024 * 1024;

const DocumentUploader: React.FC<DocumentUploaderProps> = ({
  onDocumentUploaded,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("ready");
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const acceptFile = (file: File | null | undefined) => {
    if (!file) return;

    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      setSelectedFile(null);
      setUploadStatus("ready");
      setErrorMessage("That file isn't a PDF. Choose a .pdf lecture file.");
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      setSelectedFile(null);
      setUploadStatus("ready");
      setErrorMessage("That PDF is over 20 MB. Try a smaller export.");
      return;
    }

    setSelectedFile(file);
    setUploadStatus("ready");
    setErrorMessage(null);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    acceptFile(event.target.files?.[0]);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    acceptFile(event.dataTransfer.files?.[0]);
  };

  const uploadFile = async () => {
    if (!selectedFile || uploadStatus === "uploading") return;

    setUploadStatus("uploading");
    setErrorMessage(null);

    try {
      const response = await get({
        apiName: "serverless-pdf-chat",
        path: "generate_presigned_url",
        options: {
          headers: { "Content-Type": "application/json" },
          queryParams: { file_name: selectedFile.name },
        },
      }).response;

      const payload = (await response.body.json()) as {
        presignedurl?: string;
      };

      if (!payload.presignedurl) {
        throw new Error("The upload URL was not returned.");
      }

      const upload = await fetch(payload.presignedurl, {
        method: "PUT",
        body: selectedFile,
        headers: { "Content-Type": "application/pdf" },
      });

      if (!upload.ok) {
        throw new Error("The PDF could not be uploaded.");
      }

      setUploadStatus("success");
      onDocumentUploaded?.();
    } catch (error) {
      console.error("Failed to upload document", error);
      setUploadStatus("error");
      setErrorMessage(
        "The upload didn't finish. Check your connection and try again."
      );
    }
  };

  const resetInput = () => {
    setSelectedFile(null);
    setUploadStatus("ready");
    setErrorMessage(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const isUploading = uploadStatus === "uploading";
  const isSuccess = uploadStatus === "success";

  return (
    <section id="upload-lecture" className="scroll-mt-28 pb-12 pt-2 sm:pb-16">
      <SectionHeading
        index="01"
        label="New lecture"
        title="Add a PDF. Get a study plan."
        description="Your file stays in your private AWS storage. Processing usually takes under a minute."
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_310px]">
        <div
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(event) => {
            if (event.currentTarget === event.target) setIsDragging(false);
          }}
          onDrop={handleDrop}
          className={`relative overflow-hidden rounded-[28px] border-2 border-dashed transition duration-200 ${
            isDragging
              ? "border-cobalt bg-cobalt-soft/60"
              : "border-line bg-paper-light/70 hover:border-ink/25 hover:bg-paper-light"
          }`}
        >
          <input
            ref={inputRef}
            id="dropzone-file"
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            className="sr-only"
          />

          {!selectedFile ? (
            <label
              htmlFor="dropzone-file"
              className="flex min-h-[252px] cursor-pointer flex-col items-center justify-center px-6 py-10 text-center"
            >
              <span
                className={`flex h-14 w-14 items-center justify-center rounded-full border transition ${
                  isDragging
                    ? "border-cobalt/30 bg-cobalt text-white"
                    : "border-line bg-white text-cobalt"
                }`}
              >
                <CloudArrowUpIcon className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="mt-5 font-display text-2xl font-semibold tracking-[-0.045em] text-ink">
                {isDragging ? "Drop it right here" : "Drop your lecture here"}
              </span>
              <span className="mt-2 text-sm text-ink-muted">
                or{" "}
                <span className="link-underline font-medium text-ink">
                  browse files
                </span>{" "}
                · PDF up to 20 MB
              </span>
              <span className="mt-5 rounded-full border border-line bg-paper px-3 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-muted">
                Text + page numbers stay intact
              </span>
            </label>
          ) : (
            <div className="flex min-h-[252px] flex-col justify-between p-5 sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3.5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cobalt text-white">
                    <DocumentTextIcon
                      className="h-6 w-6"
                      aria-hidden="true"
                    />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="eyebrow">Selected PDF</p>
                    <p className="mt-1.5 truncate font-display text-xl font-semibold tracking-[-0.035em] text-ink">
                      {selectedFile.name}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {filesize(selectedFile.size).toString()} · ready to index
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={resetInput}
                  disabled={isUploading}
                  className="icon-button h-9 w-9 border-line bg-transparent"
                  aria-label="Remove selected file"
                >
                  <XMarkIcon className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              {isUploading && (
                <div className="mt-8">
                  <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.14em] text-ink-muted">
                    <span>Uploading to your library</span>
                    <span>Working</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line-soft">
                    <div className="h-full w-2/3 animate-pulse rounded-full bg-cobalt" />
                  </div>
                </div>
              )}

              {isSuccess && (
                <div className="mt-8 flex items-start gap-3 rounded-2xl border border-moss/20 bg-moss/10 p-3.5 text-sm text-moss">
                  <CheckCircleIcon
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <p>
                    Uploaded. LectureLens is indexing the pages — it will appear
                    in the library in a moment.
                  </p>
                </div>
              )}

              {uploadStatus === "error" && errorMessage && (
                <p
                  role="alert"
                  className="mt-6 rounded-xl border border-coral/25 bg-coral/10 p-3 text-sm text-coral"
                >
                  {errorMessage}
                </p>
              )}

              <div className="mt-7 flex flex-wrap items-center gap-2">
                {isSuccess ? (
                  <button
                    type="button"
                    onClick={resetInput}
                    className="btn btn-secondary"
                  >
                    Upload another PDF
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={uploadFile}
                    disabled={isUploading}
                    className="btn btn-primary"
                  >
                    <CloudArrowUpIcon
                      className="h-4 w-4"
                      aria-hidden="true"
                    />
                    {isUploading
                      ? "Uploading…"
                      : uploadStatus === "error"
                        ? "Try again"
                        : "Upload lecture"}
                  </button>
                )}
                {!isSuccess && (
                  <button
                    type="button"
                    onClick={resetInput}
                    disabled={isUploading}
                    className="btn btn-ghost"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <aside className="rounded-[28px] bg-ink p-5 text-paper sm:p-6">
          <p className="eyebrow-light">What happens next</p>
          <ol className="mt-5 space-y-5">
            {[
              [
                "01",
                "Index the pages",
                "We pull the text out and keep a page reference for every answer.",
              ],
              [
                "02",
                "Ask better questions",
                "Chat with the lecture in plain language, then follow the citation.",
              ],
              [
                "03",
                "Leave with a pack",
                "Generate a summary, key concepts, flashcards, and a quiz.",
              ],
            ].map(([index, title, copy]) => (
              <li key={index} className="flex gap-3">
                <span className="pt-0.5 font-mono text-[9px] tracking-[0.1em] text-lime">
                  {index}
                </span>
                <div>
                  <p className="text-sm font-medium text-paper">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-paper/50">{copy}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-7 flex items-center gap-2 border-t border-paper/10 pt-4 font-mono text-[9px] uppercase tracking-[0.13em] text-paper/50">
            <span className="h-1.5 w-1.5 rounded-full bg-lime" />
            Usually under a minute
          </div>
        </aside>
      </div>

      {errorMessage && !selectedFile && (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-coral/25 bg-coral/10 px-3 py-2.5 text-sm text-coral"
        >
          {errorMessage}
        </p>
      )}
    </section>
  );
};

export default DocumentUploader;
