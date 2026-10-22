import Logo from "./Logo";

export const AuthHeader = () => (
  <div className="mb-2 text-center">
    <div className="flex justify-center">
      <Logo />
    </div>
    <p className="mx-auto mt-5 max-w-[17rem] font-display text-[2rem] font-semibold leading-[0.98] tracking-[-0.055em] text-ink">
      Study, in focus.
    </p>
    <p className="mx-auto mt-2 max-w-[18rem] text-sm leading-6 text-ink-muted">
      Sign in to your lecture library. Ask better questions, then turn the
      answers into a Study Pack.
    </p>
  </div>
);

export const AuthFooter = () => (
  <p className="mt-2 text-center font-mono text-[9px] uppercase tracking-[0.16em] text-ink-muted">
    Serverless on AWS · Free-plan friendly
  </p>
);
