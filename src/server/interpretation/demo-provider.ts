import type { LanguageCode } from "@/config/languages";
import type { InterpretationInput } from "./input";
import type { GeneratedPart, InterpretationProvider } from "./provider";
import type { PartContent, PartName } from "./schema";

/**
 * DEMO ONLY: produces clearly labelled placeholder text in the selected language so
 * the complete flow (report page, PDF in every script, email) can be exercised
 * without an AI account. It never runs in live mode (see config/readiness.ts).
 */
interface DemoText {
  headline: string;
  p1: string;
  p2: string;
  themes: string[];
  opportunity: string;
  challenge: string;
}

export const DEMO_TEXT: Record<LanguageCode, DemoText> = {
  en: {
    headline: "Sample report text (demo mode)",
    p1: "This is sample text produced in demo mode. In a real report, this space holds a personalised interpretation written from the calculated details of your chart.",
    p2: "Astrology is an interpretive tradition, not scientifically validated prediction. Treat these ideas as prompts for reflection rather than certainties.",
    themes: ["Patience", "Clarity", "Steady growth"],
    opportunity: "Room for steady progress",
    challenge: "Balancing many priorities",
  },
  ta: {
    headline: "மாதிரி அறிக்கை உரை — டெமோ முறை",
    p1: "இது டெமோ முறையில் உருவாக்கப்பட்ட மாதிரி உரை. உண்மையான அறிக்கையில், உங்கள் ஜாதகத்தின் கணக்கிடப்பட்ட விவரங்களின் அடிப்படையில் எழுதப்பட்ட தனிப்பட்ட விளக்கம் இங்கே இடம்பெறும்.",
    p2: "ஜோதிடம் ஒரு விளக்க மரபு; அது அறிவியல் ரீதியாக நிரூபிக்கப்பட்ட முன்கணிப்பு அல்ல. இந்தக் கருத்துகளை உறுதியான முடிவுகளாக அல்லாமல், சிந்தனைக்கான குறிப்புகளாக எடுத்துக்கொள்ளுங்கள்.",
    themes: ["பொறுமை", "தெளிவு", "நிலையான வளர்ச்சி"],
    opportunity: "நிலையான முன்னேற்றத்திற்கான வாய்ப்பு",
    challenge: "பல முன்னுரிமைகளைச் சமநிலைப்படுத்துதல்",
  },
  hi: {
    headline: "नमूना रिपोर्ट पाठ — डेमो मोड",
    p1: "यह डेमो मोड में बनाया गया नमूना पाठ है। वास्तविक रिपोर्ट में यहाँ आपकी कुंडली के गणना किए गए विवरणों पर आधारित व्यक्तिगत व्याख्या होगी।",
    p2: "ज्योतिष एक व्याख्यात्मक परंपरा है, वैज्ञानिक रूप से प्रमाणित भविष्यवाणी नहीं। इन विचारों को निश्चित परिणाम नहीं, बल्कि चिंतन के संकेत के रूप में लें।",
    themes: ["धैर्य", "स्पष्टता", "स्थिर प्रगति"],
    opportunity: "स्थिर प्रगति का अवसर",
    challenge: "कई प्राथमिकताओं में संतुलन",
  },
  te: {
    headline: "నమూనా నివేదిక పాఠ్యం — డెమో మోడ్",
    p1: "ఇది డెమో మోడ్‌లో రూపొందించిన నమూనా పాఠ్యం. నిజమైన నివేదికలో, మీ జాతకంలోని లెక్కించిన వివరాల ఆధారంగా రాసిన వ్యక్తిగత వివరణ ఇక్కడ ఉంటుంది.",
    p2: "జ్యోతిష్యం ఒక వివరణాత్మక సంప్రదాయం; ఇది శాస్త్రీయంగా నిరూపితమైన భవిష్యవాణి కాదు. ఈ ఆలోచనలను ఖచ్చితమైన ఫలితాలుగా కాకుండా, ఆలోచనకు సూచనలుగా తీసుకోండి.",
    themes: ["సహనం", "స్పష్టత", "స్థిరమైన ఎదుగుదల"],
    opportunity: "స్థిరమైన పురోగతికి అవకాశం",
    challenge: "అనేక ప్రాధాన్యతలను సమతుల్యం చేయడం",
  },
  kn: {
    headline: "ಮಾದರಿ ವರದಿ ಪಠ್ಯ — ಡೆಮೋ ಮೋಡ್",
    p1: "ಇದು ಡೆಮೋ ಮೋಡ್‌ನಲ್ಲಿ ರಚಿಸಲಾದ ಮಾದರಿ ಪಠ್ಯ. ನಿಜವಾದ ವರದಿಯಲ್ಲಿ, ನಿಮ್ಮ ಜಾತಕದ ಲೆಕ್ಕಾಚಾರದ ವಿವರಗಳನ್ನು ಆಧರಿಸಿ ಬರೆದ ವೈಯಕ್ತಿಕ ವಿವರಣೆ ಇಲ್ಲಿ ಇರುತ್ತದೆ.",
    p2: "ಜ್ಯೋತಿಷ್ಯವು ಒಂದು ವ್ಯಾಖ್ಯಾನ ಪರಂಪರೆ; ಇದು ವೈಜ್ಞಾನಿಕವಾಗಿ ಸಾಬೀತಾದ ಭವಿಷ್ಯವಾಣಿ ಅಲ್ಲ. ಈ ವಿಚಾರಗಳನ್ನು ಖಚಿತ ಫಲಿತಾಂಶಗಳೆಂದು ಅಲ್ಲ, ಚಿಂತನೆಗೆ ಸೂಚನೆಗಳೆಂದು ಪರಿಗಣಿಸಿ.",
    themes: ["ತಾಳ್ಮೆ", "ಸ್ಪಷ್ಟತೆ", "ಸ್ಥಿರ ಬೆಳವಣಿಗೆ"],
    opportunity: "ಸ್ಥಿರ ಪ್ರಗತಿಗೆ ಅವಕಾಶ",
    challenge: "ಹಲವು ಆದ್ಯತೆಗಳನ್ನು ಸಮತೋಲನಗೊಳಿಸುವುದು",
  },
  ml: {
    headline: "മാതൃകാ റിപ്പോർട്ട് വാചകം — ഡെമോ മോഡ്",
    p1: "ഇത് ഡെമോ മോഡിൽ തയ്യാറാക്കിയ മാതൃകാ വാചകമാണ്. യഥാർത്ഥ റിപ്പോർട്ടിൽ, നിങ്ങളുടെ ജാതകത്തിലെ കണക്കാക്കിയ വിവരങ്ങളെ അടിസ്ഥാനമാക്കി എഴുതിയ വ്യക്തിഗത വ്യാഖ്യാനം ഇവിടെ ഉണ്ടാകും.",
    p2: "ജ്യോതിഷം ഒരു വ്യാഖ്യാന പാരമ്പര്യമാണ്; ഇത് ശാസ്ത്രീയമായി തെളിയിക്കപ്പെട്ട പ്രവചനമല്ല. ഈ ആശയങ്ങളെ ഉറപ്പുള്ള ഫലങ്ങളായല്ല, ചിന്തയ്ക്കുള്ള സൂചനകളായി കാണുക.",
    themes: ["ക്ഷമ", "വ്യക്തത", "സ്ഥിരമായ വളർച്ച"],
    opportunity: "സ്ഥിരമായ പുരോഗതിക്കുള്ള അവസരം",
    challenge: "പല മുൻഗണനകളും സന്തുലിതമാക്കൽ",
  },
};

export function demoPartContent<P extends PartName>(part: P, input: InterpretationInput): PartContent<P> {
  const t = DEMO_TEXT[input.language];
  const pair = [t.p1, t.p2];
  if (part === "core") {
    const core: PartContent<"core"> = {
      overview: { headline: t.headline, paragraphs: pair },
      chartExplanations: input.facts.filter((f) => f.certainty !== "omitted").slice(0, 6).map((f) => ({ factId: f.id, explanation: t.p1 })),
      perspectives: input.perspectives.map((p) => ({ key: p.key, paragraphs: pair, keyThemes: t.themes })),
    };
    return core as PartContent<P>;
  }
  if (part === "timeline") {
    const timeline: PartContent<"timeline"> = {
      lookingBack: { intro: t.p2, periods: input.periods.filter((p) => p.when === "past").map((p) => ({ periodId: p.id, paragraphs: [t.p1] })) },
      lookingAhead: {
        intro: t.p2,
        periods: input.periods
          .filter((p) => p.when !== "past")
          .map((p) => ({ periodId: p.id, paragraphs: [t.p1], opportunities: [t.opportunity], challenges: [t.challenge] })),
      },
      lifeAreas: { career: pair, relationships: pair, personalGrowth: pair, money: pair },
    };
    return timeline as PartContent<P>;
  }
  const hasContext = Boolean(input.customer.notes || input.customer.knownDetails.length || input.customer.discrepancies.length);
  const synthesis: PartContent<"synthesis"> = {
    agreements: [t.p2],
    differences: [t.p1],
    combinedSummary: pair,
    contextResponse: hasContext ? t.p1 : "",
    questionAnswers: input.customer.questions.map((_, i) => ({ questionNumber: i + 1, answer: pair })),
  };
  return synthesis as PartContent<P>;
}

export class DemoInterpretationProvider implements InterpretationProvider {
  readonly id = "demo" as const;
  readonly model = "demo-sample-text";
  readonly isDemo = true;

  async generate(part: PartName, _prompt: { instructions: string; userContent: string }, input: InterpretationInput): Promise<GeneratedPart> {
    return { raw: demoPartContent(part, input), inputTokens: 0, outputTokens: 0, latencyMs: 0 };
  }
}
