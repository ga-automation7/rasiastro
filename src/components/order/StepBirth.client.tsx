"use client";

import { BirthFields } from "./BirthFields.client";
import type { WizardState } from "./wizard-state";

export function StepBirth({ state, onChange, errors }: { state: WizardState; onChange: (patch: Partial<WizardState>) => void; errors: Record<string, string> }) {
  return (
    <BirthFields
      value={state}
      onChange={onChange}
      errors={errors}
      prefix="birth"
      tradition={state.tradition}
      nameLabel="Full name of the person this report is about"
      nameHint="This can be you or someone else. It appears on the report and is never sent to the AI."
    />
  );
}
