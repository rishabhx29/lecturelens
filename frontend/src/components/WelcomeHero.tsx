import {
  ArrowDownIcon,
  ArrowUpRightIcon,
  ChatBubbleLeftRightIcon,
  CloudArrowUpIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

const STEPS = [
  {
    icon: CloudArrowUpIcon,
    title: "Drop the PDF",
    description:
      "Slides, notes, or a scanned handout. We extract the text and keep the page numbers intact.",
  },
  {
    icon: ChatBubbleLeftRightIcon,
    title: "Ask the lecture",
    description:
      "Get plain-language answers with citations, so you always know where the idea came from.",
  },
  {
    icon: SparklesIcon,
    title: "Make it stick",
    description:
      "Turn the lecture into a summary, key concepts, flashcards, and a practice quiz in one click.",
  },
];

const WelcomeHero: React.FC = () => {
  return (
    <section className="relative pb-10 sm:pb-14">
      <div className="grid gap-14 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)] lg:items-center lg:gap-10">
        <div className="page-enter">
          <div className="flex items-center gap-3">
            <span className="eyebrow">AI study companion</span>
            <span className="h-px w-9 bg-line" />
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-muted">
              Est. 2026
            </span>
          </div>

          <h1 className="mt-6 max-w-[12ch] font-display text-[clamp(3.5rem,8.8vw,7.5rem)] font-semibold leading-[0.86] tracking-[-0.075em] text-ink">
            Make every
            <br />
            lecture <span className="highlight-lime">land.</span>
          </h1>

          <p className="mt-7 max-w-[35rem] text-base leading-7 text-ink-soft sm:text-lg sm:leading-8">
            Upload the slides. Ask the questions you didn&apos;t get to ask.
            Then leave with a Study Pack you can actually use before the next
            class.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="#upload-lecture" className="btn btn-primary">
              Upload a lecture
              <ArrowUpRightIcon className="h-4 w-4" aria-hidden="true" />
            </a>
            <a href="#library" className="btn btn-secondary">
              Browse the library
              <ArrowDownIcon className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>

          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-4 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-muted">
            <span>PDF native</span>
            <span className="text-line">/</span>
            <span>Page citations</span>
            <span className="text-line">/</span>
            <span>Study packs</span>
            <span className="text-line">/</span>
            <span>Free-plan ready</span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[465px] animate-fade-up px-3 [animation-delay:130ms] sm:px-0">
          <div
            className="absolute -left-7 top-16 hidden h-36 w-36 rounded-full border border-line sm:block"
            aria-hidden="true"
          />
          <div
            className="absolute right-0 top-0 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-muted"
            aria-hidden="true"
          >
            Fig. 01 — Study pack
          </div>

          <div className="group relative ml-auto mt-7 w-[93%] rotate-[-2.5deg] rounded-[28px] border border-ink/10 bg-paper-light p-5 shadow-lift transition duration-500 ease-out hover:rotate-0 hover:shadow-[0_34px_65px_-36px_rgba(20,21,24,0.46)] sm:p-6">
            <div className="flex items-center justify-between gap-3 border-b border-line pb-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cobalt" />
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-muted">
                  Lecture 04 / Cell biology
                </span>
              </div>
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-muted">
                4 pp.
              </span>
            </div>

            <div className="mt-6">
              <p className="eyebrow">The big idea</p>
              <h2 className="mt-2 font-display text-[clamp(2.2rem,4vw,2.8rem)] font-semibold leading-[0.9] tracking-[-0.065em] text-ink">
                Energy,
                <br />
                membranes &amp;
                <br />
                the cell.
              </h2>
            </div>

            <div className="mt-6 space-y-2" aria-hidden="true">
              <div className="h-1.5 w-[92%] rounded-full bg-line-soft" />
              <div className="h-1.5 w-[78%] rounded-full bg-line-soft" />
              <div className="h-1.5 w-[84%] rounded-full bg-line-soft" />
            </div>

            <div className="mt-6 rounded-2xl bg-lime p-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink/60">
                Key concept
              </p>
              <p className="mt-2 max-w-[18rem] font-display text-xl font-semibold leading-[1.05] tracking-[-0.035em] text-ink">
                The membrane decides what gets in.
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {["Plasma membrane", "ATP", "Mitochondria"].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-line bg-paper px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-muted"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="absolute -bottom-5 left-0 rotate-[3deg] rounded-2xl border border-ink/10 bg-white px-4 py-3 shadow-card sm:left-2">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-muted">
              Study pack
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-lime text-ink">
                <SparklesIcon className="h-3 w-3" aria-hidden="true" />
              </span>
              <span className="text-xs font-semibold text-ink">Ready to review</span>
            </div>
          </div>

          <div className="absolute -right-1 top-[43%] rotate-[5deg] rounded-full bg-cobalt px-3.5 py-2 font-mono text-[9px] uppercase tracking-[0.13em] text-white shadow-soft">
            4 pages → 1 pack
          </div>
        </div>
      </div>

      <div
        id="how-it-works"
        className="mt-16 grid scroll-mt-28 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:mt-20 sm:grid-cols-3"
      >
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={step.title} className="bg-paper-light p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-muted">
                  Step 0{index + 1}
                </span>
                <Icon
                  className="h-4 w-4 text-cobalt"
                  aria-hidden="true"
                />
              </div>
              <h2 className="mt-7 font-display text-xl font-semibold tracking-[-0.04em] text-ink">
                {step.title}
              </h2>
              <p className="mt-2 max-w-[18rem] text-sm leading-6 text-ink-muted">
                {step.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default WelcomeHero;
