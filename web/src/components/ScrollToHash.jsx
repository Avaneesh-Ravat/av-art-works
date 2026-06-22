import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Handles in-page anchor navigation (e.g. /#about, /#contact) and resets scroll
// position on normal page changes. React Router's <Link> does not scroll to hash
// targets on its own, and sections like About/Contact may mount after data loads,
// so we retry a few times until the element exists.
export function ScrollToHash() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, behavior: "auto" });
      return;
    }

    const id = decodeURIComponent(hash.slice(1));
    let frame;
    const tries = [0, 80, 200, 400, 700];
    const timers = tries.map((delay) =>
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) {
          frame = requestAnimationFrame(() =>
            el.scrollIntoView({ behavior: "smooth", block: "start" }),
          );
        }
      }, delay),
    );

    return () => {
      timers.forEach(clearTimeout);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [pathname, hash]);

  return null;
}
