import React from "react";

interface LogoProps {
  markOnly?: boolean;
  className?: string;
  wordmarkClassName?: string;
  markClassName?: string;
}

export const LensMark: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    aria-hidden="true"
    className={className}
  >
    <circle
      cx="16"
      cy="16"
      r="11.5"
      stroke="currentColor"
      strokeWidth="1.7"
    />
    <circle cx="16" cy="16" r="4.6" fill="currentColor" />
    <path
      d="M16 2.8v5.3M16 23.9v5.3M2.8 16h5.3M23.9 16h5.3"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
  </svg>
);

const Logo: React.FC<LogoProps> = ({
  markOnly = false,
  className = "",
  wordmarkClassName = "",
  markClassName = "",
}) => {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-[10px] bg-ink text-paper ${markClassName}`}
      >
        <LensMark className="h-[19px] w-[19px]" />
      </span>
      {!markOnly && (
        <span
          className={`font-display text-[21px] font-semibold leading-none tracking-[-0.055em] text-ink ${wordmarkClassName}`}
        >
          LectureLens
        </span>
      )}
    </span>
  );
};

export default Logo;
