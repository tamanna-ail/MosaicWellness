"use client";

/**
 * In-memory stand-ins for next/navigation and next/link, used only by the
 * single-file Artifact build (aliased in build.mjs). The page lives inside a
 * sandboxed frame, so navigation is kept in React state instead of the URL.
 */
import * as React from "react";

interface Loc {
  pathname: string;
  search: string;
}

interface RouterState {
  loc: Loc;
  push: (href: string) => void;
  replace: (href: string) => void;
  back: () => void;
}

const RouterCtx = React.createContext<RouterState | null>(null);

function parse(href: string): Loc {
  const [p, q = ""] = href.split("?");
  return { pathname: p || "/", search: q };
}

export function MemoryRouter({ children }: { children: (loc: Loc) => React.ReactNode }) {
  const [stack, setStack] = React.useState<Loc[]>([{ pathname: "/", search: "" }]);
  const loc = stack[stack.length - 1];
  const value = React.useMemo<RouterState>(
    () => ({
      loc,
      push: (href) => {
        setStack((s) => [...s, parse(href)]);
        window.scrollTo({ top: 0 });
      },
      replace: (href) => setStack((s) => [...s.slice(0, -1), parse(href)]),
      back: () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)),
    }),
    [loc],
  );
  return <RouterCtx.Provider value={value}>{children(loc)}</RouterCtx.Provider>;
}

function useRouterState() {
  const r = React.useContext(RouterCtx);
  if (!r) throw new Error("Router missing");
  return r;
}

// --- next/navigation surface ---
export function useRouter() {
  const { push, replace, back } = useRouterState();
  return { push, replace, back, refresh: () => {}, prefetch: () => {}, forward: () => {} };
}
export function usePathname() {
  return useRouterState().loc.pathname;
}
export function useSearchParams() {
  const { search } = useRouterState().loc;
  return React.useMemo(() => new URLSearchParams(search), [search]);
}
export function useParams() {
  return {};
}
export function notFound(): never {
  throw new Error("not found");
}

// --- next/link surface ---
type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean; replace?: boolean; scroll?: boolean };

const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(function Link({ href, onClick, prefetch, replace, scroll, ...rest }, ref) {
  void prefetch;
  void scroll;
  const r = useRouterState();
  return (
    <a
      ref={ref}
      href={`#${href.replace(/^\//, "") || "home"}`}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey) return;
        e.preventDefault();
        if (replace) r.replace(href);
        else r.push(href);
      }}
      {...rest}
    />
  );
});
export default Link;
