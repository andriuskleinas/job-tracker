import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Motion primitives for the landing page.
 *
 * One rule governs every helper in this file, and it is the same one the
 * dashboard's bar animation follows: **the resting state is the finished
 * state.** Nothing here hides content in the markup. An element is rendered at
 * its final position, and only once the client has mounted — and only if the
 * viewer has not asked for less motion — is it pulled back so it can arrive.
 *
 * That ordering matters more than it looks. If the initial HTML were hidden,
 * a failed hydration, a disabled script, or a throttled animation clock in a
 * background tab would leave a blank page. This way the worst case is a page
 * that simply does not move.
 */

/* Layout effects run before paint, which is what lets `Reveal` arm itself
 * without a flash of the final position. On the server there is no paint, so
 * fall back to useEffect and skip React's warning. */
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const REDUCED = "(prefers-reduced-motion: reduce)";

/** Read the preference imperatively, for effects that run once. */
export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia(REDUCED).matches;
}

/**
 * False on the server and for the first client paint; true once we know the
 * viewer is happy to see motion.
 *
 * Every animated class on this page hangs off this flag, and that is the whole
 * safety mechanism: markup ships finished, arms itself in a layout effect
 * before the first paint, and only then is allowed to hide anything.
 */
export function useArmed() {
  const [armed, setArmed] = useState(false);

  useIsoLayoutEffect(() => {
    if (!prefersReducedMotion()) setArmed(true);
  }, []);

  return armed;
}

/**
 * The same preference as state, for components that branch on it in render —
 * the scripted demos, which choose a *frame* rather than a class.
 *
 * It starts `true`, which is the opposite of what it looks like it should do
 * and is the whole point. A demo asked for its motionless frame renders the
 * finished one: the posting clipped, the calendar synced, every CSV row
 * imported. That is what the server sends, what a visitor with JavaScript off
 * keeps, and what a viewer who has asked for less motion keeps. Start it
 * `false` and the server would ship the *first* frame of each sequence
 * instead — a popup mid-read, a calendar stuck on "Syncing…" — and anyone
 * whose JavaScript never arrived would be left looking at a product caught
 * halfway through doing something.
 *
 * The sync runs in a layout effect so the switch to the opening frame happens
 * before the first paint, not after it. In an effect it would be a visible
 * flash of the finished state collapsing back to the start.
 */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);

  useIsoLayoutEffect(() => {
    const query = window.matchMedia(REDUCED);
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return reduced;
}

/**
 * True once the element has been scrolled into view.
 *
 * Defaults to latching: things that arrive should not leave again when you
 * scroll back past them. Pass `once: false` for the demos, which stop playing
 * when they are off-screen.
 */
export function useInView<T extends Element>(once = true, threshold = 0.2) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    /* No observer means no way to know — so assume visible rather than
     * withholding the animation forever. */
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            if (once) observer.disconnect();
          } else if (!once) {
            setInView(false);
          }
        }
      },
      { threshold, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [once, threshold]);

  return [ref, inView] as const;
}

type RevealProps = {
  /** How the element arrives. `rise` is the default and the quietest. */
  variant?: "rise" | "scale" | "blur" | "left";
  /** Milliseconds. Use to stagger siblings; keep the whole stagger under ~400ms. */
  delay?: number;
  className?: string;
  children: React.ReactNode;
};

/**
 * Wraps children so they arrive when scrolled into view.
 *
 * `armed` starts false, which is the state the server renders and the state a
 * reduced-motion viewer keeps: no classes, no transform, content in place.
 */
export function Reveal({ variant = "rise", delay = 0, className = "", children }: RevealProps) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const armed = useArmed();

  const motion = armed ? `reveal ${inView ? "reveal-in" : ""}` : "";

  return (
    <div
      ref={ref}
      data-reveal={variant}
      className={`${motion} ${className}`.trim()}
      style={armed && delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

/**
 * A number that counts to its new value instead of jumping.
 *
 * Used only where the number is genuinely changing — the live board's counters
 * move because an application moved. A count-up on a static figure is
 * decoration pretending to be data.
 */
export function CountUp({ value, duration = 650 }: { value: number; duration?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const start = from.current;
    from.current = value;

    if (start === value || prefersReducedMotion()) {
      setShown(value);
      return;
    }

    let frame = 0;
    const began = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - began) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(start + (value - start) * eased));
      if (t < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <>{shown}</>;
}

/**
 * Advances through a fixed list of beat lengths and loops.
 *
 * `enabled` is how the demos stay honest about cost: they run only while
 * on-screen, and stop while the pointer is resting on them so a visitor can
 * read a frame they are interested in.
 *
 * Pass `beats` as a module-level constant — it is an effect dependency.
 */
export function useLoop(beats: readonly number[], enabled: boolean) {
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const id = setTimeout(() => setBeat((current) => (current + 1) % beats.length), beats[beat]);
    return () => clearTimeout(id);
  }, [beat, beats, enabled]);

  return [beat, setBeat] as const;
}

/**
 * Pointer-follow tilt for the hero's board.
 *
 * The handler writes two custom properties rather than a transform string, so
 * the scroll-entry lift and the pointer angle compose in CSS instead of
 * fighting over one style attribute. Angles are small on purpose: past about
 * four degrees a screenshot-like panel starts to read as a toy.
 */
export function useTilt(active: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [tracking, setTracking] = useState(false);

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!active || event.pointerType !== "mouse") return;
      const element = ref.current;
      if (!element) return;

      const box = element.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width - 0.5;
      const y = (event.clientY - box.top) / box.height - 0.5;

      element.style.setProperty("--tilt-y", `${(x * 7).toFixed(2)}deg`);
      element.style.setProperty("--tilt-x", `${(-y * 4.5).toFixed(2)}deg`);
      setTracking(true);
    },
    [active],
  );

  const onPointerLeave = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    element.style.setProperty("--tilt-y", "0deg");
    element.style.setProperty("--tilt-x", "0deg");
    setTracking(false);
  }, []);

  return { ref, tracking, onPointerMove, onPointerLeave };
}

/**
 * Fraction of the document scrolled, 0 to 1, for the reading rail at the top
 * of the page. Sampled on a frame rather than on every scroll event.
 */
export function useScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;

    const measure = () => {
      frame = 0;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(scrollable > 0 ? Math.min(1, window.scrollY / scrollable) : 0);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return progress;
}

/**
 * Types a string out one character at a time, then holds it.
 *
 * Only used for the URL in the logo demo, where the point is that *you* paste
 * a careers page and the mark resolves — the typing is the visitor's own
 * action being played back to them.
 */
export function useTypewriter(text: string, playing: boolean, speed = 55) {
  /*
   * The count is stored with the text it belongs to, and a count from a
   * previous string counts for nothing. Keeping them as two pieces of state
   * meant that on the render where `text` changed — before the effect had run
   * — the new word was measured against the old word's progress, and a URL of
   * the same length read as already finished. What that looked like was the
   * next logo flashing in at full size, fading out, and resolving again.
   */
  const [state, setState] = useState({ text, count: text.length });

  useEffect(() => {
    if (!playing || prefersReducedMotion()) {
      setState({ text, count: text.length });
      return;
    }

    setState({ text, count: 0 });
    let index = 0;
    const id = setInterval(() => {
      index += 1;
      setState({ text, count: index });
      if (index >= text.length) clearInterval(id);
    }, speed);

    return () => clearInterval(id);
  }, [text, playing, speed]);

  const count = state.text === text ? state.count : 0;
  return { typed: text.slice(0, count), done: count >= text.length };
}
