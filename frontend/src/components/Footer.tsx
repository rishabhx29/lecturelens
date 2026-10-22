import Logo from "./Logo";

const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="site-container grid gap-8 py-10 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-6 text-ink-muted">
            A calmer way to study from your own lecture PDFs. Ask questions,
            follow the citations, and leave with a plan.
          </p>
          <p className="mt-5 inline-flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-moss" />
            Serverless on AWS · Free-plan friendly
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm">
          <a
            href="https://github.com/rishabhx29/lecturelens"
            target="_blank"
            rel="noreferrer"
            className="text-ink-soft transition hover:text-ink"
          >
            GitHub
          </a>
          <a
            href="https://github.com/aws-samples/serverless-pdf-chat"
            target="_blank"
            rel="noreferrer"
            className="text-ink-soft transition hover:text-ink"
          >
            Base project
          </a>
          <a
            href="/#how-it-works"
            className="text-ink-soft transition hover:text-ink"
          >
            How it works
          </a>
          <a
            href="/#library"
            className="text-ink-soft transition hover:text-ink"
          >
            Library
          </a>
        </div>
      </div>

      <div className="border-t border-line/80">
        <div className="site-container flex flex-col gap-1.5 py-3 font-mono text-[9px] uppercase tracking-[0.13em] text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 LectureLens</span>
          <span>MIT-0 · Built with AWS SAM, React &amp; Amazon Bedrock</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
