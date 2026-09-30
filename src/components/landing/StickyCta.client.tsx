"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * A discreet bar for phones and tablets: it slides in once the hero is out of view,
 * steps aside while the closing call to action or the footer is on screen (so legal
 * links are never covered), and hides while a text field has focus (keyboard open).
 * When hidden it is also removed from the tab order and the accessibility tree.
 */
export function StickyCta({ href, label, note }: { href: string; label: string; note: string }) {
  const [pastHero, setPastHero] = useState(false);
  const [atEnd, setAtEnd] = useState(false);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("hero");
    const ends = [document.getElementById("begin"), document.querySelector("footer")].filter((el): el is HTMLElement => Boolean(el));
    const heroObserver = new IntersectionObserver(([entry]) => setPastHero(Boolean(entry && !entry.isIntersecting && entry.boundingClientRect.top < 0)));
    const visibleEnds = new Set<Element>();
    const endObserver = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) visibleEnds.add(e.target);
        else visibleEnds.delete(e.target);
      }
      setAtEnd(visibleEnds.size > 0);
    });
    if (hero) heroObserver.observe(hero);
    ends.forEach((el) => endObserver.observe(el));

    const isField = (t: EventTarget | null) => t instanceof HTMLElement && (t.matches("input:not([type=checkbox]):not([type=radio]), textarea, select") || t.isContentEditable);
    const onFocusIn = (e: FocusEvent) => setTyping(isField(e.target));
    const onFocusOut = () => setTyping(false);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      heroObserver.disconnect();
      endObserver.disconnect();
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  const show = pastHero && !atEnd && !typing;
  return (
    <div className={`sticky-cta lg:hidden ${show ? "is-shown" : ""}`} aria-hidden={!show}>
      <div className="mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-white/10 bg-(--color-midnight)/95 p-2.5 pl-4 shadow-[0_18px_40px_-12px_rgb(7_12_23/0.6)] backdrop-blur-md">
        <p className="min-w-0 flex-1 truncate text-[0.8rem] leading-tight text-ivory-300">{note}</p>
        <Link href={href} tabIndex={show ? undefined : -1} className="btn btn-primary min-h-11 shrink-0 px-4 py-2 text-[0.95rem]">
          {label}
        </Link>
      </div>
    </div>
  );
}
