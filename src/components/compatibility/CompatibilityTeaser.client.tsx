"use client";

import { useState } from "react";
import type { CompatibilityCategory } from "@/config/compatibility";
import { CTA } from "@/content/site-copy";
import { CategorySelector } from "./CategorySelector.client";

/**
 * Homepage category picker. A real GET form to /compatibility, so the chosen category
 * carries into the order form (?category=...) with or without JavaScript.
 */
export function CompatibilityTeaser({ available, pausedMessage }: { available: boolean; pausedMessage: string | null }) {
  const [category, setCategory] = useState<CompatibilityCategory>("relationship");
  return (
    <form action="/compatibility" method="get" className="mt-8">
      <CategorySelector value={category} onChange={setCategory} tone="dark" legend="Choose a connection" />
      {available ? (
        <button type="submit" className="btn btn-primary mt-6 w-full text-[1.02rem] sm:w-auto">
          {CTA.compatibility}
        </button>
      ) : (
        <p role="status" className="mt-6 rounded-lg bg-ivory-100/10 px-4 py-3 text-sm text-ivory-100">
          {pausedMessage}
        </p>
      )}
    </form>
  );
}
