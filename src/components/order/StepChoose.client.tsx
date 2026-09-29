"use client";

import { REPORT_LANGUAGES, TRADITIONS, type LanguageCode, type TraditionCode } from "@/config/languages";
import { ChoiceCards } from "./fields";

export function StepChoose({
  tradition,
  language,
  onChange,
  errors,
}: {
  tradition: TraditionCode | null;
  language: LanguageCode | null;
  onChange: (patch: { tradition?: TraditionCode; language?: LanguageCode }) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="space-y-8">
      <ChoiceCards
        legend="Astrology tradition"
        name="tradition"
        value={tradition}
        onChange={(v) => onChange({ tradition: v })}
        error={errors.tradition}
        options={TRADITIONS.map((t) => ({ value: t.code, title: t.title, description: t.description }))}
      />
      <ChoiceCards
        legend="Report language"
        name="language"
        columns={3}
        value={language}
        onChange={(v) => onChange({ language: v })}
        error={errors.language}
        options={REPORT_LANGUAGES.filter((l) => l.enabled).map((l) => ({
          value: l.code,
          title: (
            <span lang={l.htmlLang}>
              {l.nativeName}
              {l.code !== "en" ? <span className="ml-2 text-sm font-normal text-muted" lang="en">{l.englishName}</span> : null}
            </span>
          ),
        }))}
      />
      <p className="text-sm text-muted">
        The language is separate from the tradition: for example, an Indian report in English, or a Western report in Tamil. The report text, chart labels and PDF all use the language you choose.
      </p>
    </div>
  );
}
