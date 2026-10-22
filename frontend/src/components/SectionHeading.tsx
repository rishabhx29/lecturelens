import React from "react";

interface SectionHeadingProps {
  index: string;
  label: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

const SectionHeading: React.FC<SectionHeadingProps> = ({
  index,
  label,
  title,
  description,
  action,
}) => {
  return (
    <div className="flex flex-col gap-5 border-t border-line pt-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-3.5">
        <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
          {index}
        </span>
        <div>
          <p className="eyebrow">{label}</p>
          <h2 className="mt-1.5 font-display text-[clamp(1.8rem,3.2vw,2.7rem)] font-semibold leading-none tracking-[-0.055em] text-ink">
            {title}
          </h2>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 sm:justify-end">
        {description && (
          <p className="max-w-sm text-sm leading-6 text-ink-muted">
            {description}
          </p>
        )}
        {action}
      </div>
    </div>
  );
};

export default SectionHeading;
