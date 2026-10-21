import {
  ChatBubbleLeftRightIcon,
  CloudArrowUpIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

const STEPS = [
  {
    icon: CloudArrowUpIcon,
    title: "Upload a lecture PDF",
    description:
      "Drop in the slides or notes from your latest class. We'll index them for you.",
  },
  {
    icon: ChatBubbleLeftRightIcon,
    title: "Chat with the material",
    description:
      "Ask questions in plain language and get answers grounded in your lecture.",
  },
  {
    icon: SparklesIcon,
    title: "Generate a Study Pack",
    description:
      "Get a summary, key concepts, flashcards, and a practice quiz in one click.",
  },
];

const WelcomeHero: React.FC = () => {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.15fr,1fr] lg:items-center">
        <div>
          <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-800">
            <SparklesIcon className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Your lecture study companion
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Turn lecture PDFs into{" "}
            <span className="text-violet-900">study sessions</span>.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-gray-600 sm:text-base sm:leading-7">
            Upload a lecture PDF, chat with it to clear up anything you missed,
            then build a Study Pack with a summary, key concepts, flashcards,
            and a practice quiz.
          </p>
          <a
            href="#upload-lecture"
            className="mt-6 inline-flex items-center rounded-xl bg-violet-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-700 focus-visible:ring-offset-2"
          >
            <CloudArrowUpIcon
              className="mr-2 h-4 w-4"
              aria-hidden="true"
            />
            Upload a lecture
          </a>
        </div>

        <ol className="grid gap-3">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <li
                key={step.title}
                className="flex items-start gap-3.5 rounded-xl border border-gray-100 bg-gray-50/80 p-4"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-900 text-white">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-700">
                    Step {index + 1}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-gray-900">
                    {step.title}
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-gray-600">
                    {step.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
};

export default WelcomeHero;
