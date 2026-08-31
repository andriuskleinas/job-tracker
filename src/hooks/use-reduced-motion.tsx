import * as React from "react";

/**
 * Tracks the viewer's `prefers-reduced-motion` setting.
 *
 * Starts `false` and resolves in an effect, the same shape as `useIsMobile`:
 * the server has no media queries, so anything read during render would
 * disagree with the first client paint and hydrate mismatched.
 *
 * Reading `false` for one frame is the safe default here — a chart that has
 * already drawn does not retro-animate, so the worst case is that a reduced
 * motion viewer misses nothing rather than being handed movement they asked
 * not to see.
 */
export function useReducedMotion() {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener("change", onChange);
    setReduced(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
