import { Link, NavLink } from "react-router-dom";
import { Menu } from "@headlessui/react";
import {
  ArrowLeftOnRectangleIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import Logo from "./Logo";

interface NavigationProps {
  userInfo: {
    attributes?: {
      email?: string;
    };
  } | null;
  handleSignOutClick: (
    event: React.MouseEvent<HTMLButtonElement>
  ) => Promise<void>;
}

const navLinkClass = (isActive: boolean) =>
  `relative inline-flex h-9 items-center rounded-full px-3 text-sm transition ${
    isActive
      ? "bg-ink text-paper"
      : "text-ink-soft hover:bg-ink/5 hover:text-ink"
  }`;

const Navigation: React.FC<NavigationProps> = ({
  userInfo,
  handleSignOutClick,
}: NavigationProps) => {
  const email = userInfo?.attributes?.email ?? "Student";
  const initial = email.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/80 backdrop-blur-xl">
      <div className="site-container flex h-[68px] items-center justify-between gap-4">
        <Link
          to="/"
          className="group inline-flex shrink-0 items-center rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:ring-offset-4 focus-visible:ring-offset-paper"
          aria-label="LectureLens home"
        >
          <Logo markClassName="transition-transform duration-300 group-hover:rotate-[-8deg]" />
        </Link>

        <nav
          className="hidden items-center gap-1 sm:flex"
          aria-label="Primary navigation"
        >
          <NavLink to="/" end className={({ isActive }) => navLinkClass(isActive)}>
            Library
          </NavLink>
          <a
            href="/#how-it-works"
            className="inline-flex h-9 items-center rounded-full px-3 text-sm text-ink-soft transition hover:bg-ink/5 hover:text-ink"
          >
            How it works
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 font-mono text-[9px] uppercase tracking-[0.15em] text-ink-muted xl:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-moss" />
            Free-plan demo
          </span>

          <Menu as="div" className="relative">
            <Menu.Button className="group flex items-center gap-2 rounded-full border border-line bg-paper-light/70 py-1.5 pl-1.5 pr-2.5 text-left transition hover:border-ink/20 hover:bg-paper-light focus:outline-none focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:ring-offset-4 focus-visible:ring-offset-paper">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-paper">
                {initial}
              </span>
              <span className="hidden max-w-[150px] truncate text-xs text-ink-soft sm:block">
                {email}
              </span>
              <ChevronDownIcon
                className="h-3.5 w-3.5 text-ink-muted transition group-hover:text-ink"
                aria-hidden="true"
              />
            </Menu.Button>

            <Menu.Items className="absolute right-0 z-50 mt-2 w-60 origin-top-right rounded-2xl border border-line bg-paper-light p-1.5 shadow-lift focus:outline-none">
              <div className="px-3 py-2">
                <p className="eyebrow">Signed in</p>
                <p className="mt-1 truncate text-sm text-ink">{email}</p>
              </div>
              <div className="my-1 h-px bg-line/70" />
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={handleSignOutClick}
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                      active ? "bg-ink/5 text-ink" : "text-ink-soft"
                    }`}
                  >
                    <ArrowLeftOnRectangleIcon
                      className="h-4 w-4"
                      aria-hidden="true"
                    />
                    Sign out
                  </button>
                )}
              </Menu.Item>
            </Menu.Items>
          </Menu>
        </div>
      </div>
    </header>
  );
};

export default Navigation;
