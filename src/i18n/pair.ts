import type { CompatibilityCategory } from "@/config/compatibility";
import type { LanguageCode } from "@/config/languages";
import type { Friendship, Gana, IndianFactorKey, Nadi, TaraName, YoniAnimal } from "@/domain/astrology/compatibility-types";

/**
 * Fixed text for compatibility reports, per report language. AI prose is written
 * directly in the report language; headings, factor names and notes come from here.
 * Traditional terms (Gana, Nadi, Yoni, Tara) use the names common in each language.
 */
export interface PairDictionary {
  reportTitle: string;
  categories: Record<CompatibilityCategory, string>;
  sections: {
    theTwoOfYou: string;
    charts: string;
    factors: string;
    factorNotes: string;
    communication: string;
    sharedStrengths: string;
    potentialFriction: string;
    discussTogether: string;
    whatYouShared: string;
    summary: string;
    limitations: string;
    about: string;
  };
  personSection: (name: string) => string;
  factorNames: Record<IndianFactorKey | "inter_aspects" | "overlays" | "elements", string>;
  ganas: Record<Gana, string>;
  nadis: Record<Nadi, string>;
  yonis: Record<YoniAnimal, string>;
  taras: Record<TaraName, string>;
  friendship: Record<Friendship, string>;
  words: {
    same: string;
    different: string;
    traditionallyOpposed: string;
    traditionallyChallenging: string;
    bhakootLessFavourable: string;
    dependsOnTime: string;
    focus: string;
    house: (n: number) => string;
    planetsInHouses: (from: string, into: string) => string;
    overlaysNeedTime: (into: string) => string;
  };
  sharedFields: { howKnown: string; knownDuration: string; hopes: string; sharedCircumstances: string; notesAbout: (name: string) => string };
  notes: {
    noScore: string;
    sharedIsContext: string;
    moonRelationCaption: string;
    wheelCaption: (inner: string, outer: string) => string;
    elementsCaption: string;
    timeUnknown: (name: string) => string;
    timeApproximate: (name: string, minutes: number) => string;
  };
}

const en: PairDictionary = {
  reportTitle: "Compatibility report",
  categories: {
    relationship: "Relationship",
    marriage: "Marriage",
    friendship: "Friendship",
    career_teamwork: "Career & teamwork",
    business_partnership: "Business partnership",
    family: "Family",
  },
  sections: {
    theTwoOfYou: "The two of you",
    charts: "Your charts side by side",
    factors: "How your charts meet",
    factorNotes: "What each factor describes",
    communication: "Communication",
    sharedStrengths: "Shared strengths",
    potentialFriction: "What may take more understanding",
    discussTogether: "To discuss together",
    whatYouShared: "What you shared with us",
    summary: "Bringing it together",
    limitations: "What this reading can and cannot tell you",
    about: "About this report",
  },
  personSection: (name) => `What ${name} brings`,
  factorNames: {
    moon_sign_relationship: "Moon-sign (Rasi) relationship",
    tara: "Tara (birth-star count)",
    gana: "Gana (temperament)",
    graha_maitri: "Graha Maitri (Moon-sign lords)",
    yoni: "Yoni",
    nadi: "Nadi",
    inter_aspects: "Contacts between your charts",
    overlays: "Planets in each other's houses",
    elements: "Element balance",
  },
  ganas: { deva: "Deva", manushya: "Manushya", rakshasa: "Rakshasa" },
  nadis: { adi: "Adi", madhya: "Madhya", antya: "Antya" },
  yonis: {
    horse: "Horse",
    elephant: "Elephant",
    sheep: "Sheep",
    serpent: "Serpent",
    dog: "Dog",
    cat: "Cat",
    rat: "Rat",
    cow: "Cow",
    buffalo: "Buffalo",
    tiger: "Tiger",
    deer: "Deer",
    monkey: "Monkey",
    mongoose: "Mongoose",
    lion: "Lion",
  },
  taras: {
    janma: "Janma",
    sampat: "Sampat",
    vipat: "Vipat",
    kshema: "Kshema",
    pratyak: "Pratyak",
    sadhana: "Sadhana",
    naidhana: "Naidhana",
    mitra: "Mitra",
    parama_mitra: "Parama Mitra",
  },
  friendship: { same: "same ruling planet", friend: "friend", neutral: "neutral", enemy: "enemy" },
  words: {
    same: "same",
    different: "different",
    traditionallyOpposed: "traditionally opposed pair",
    traditionallyChallenging: "traditionally challenging",
    bhakootLessFavourable: "counted as less favourable in traditional Bhakoot matching",
    dependsOnTime: "depends on the birth time",
    focus: "emphasised for this category",
    house: (n) => `house ${n}`,
    planetsInHouses: (from, into) => `${from}'s planets in ${into}'s houses`,
    overlaysNeedTime: (into) => `House placements in ${into}'s chart need an exact birth time, so they are not shown.`,
  },
  sharedFields: {
    howKnown: "How you know each other",
    knownDuration: "How long",
    hopes: "What you hope to understand",
    sharedCircumstances: "Shared circumstances",
    notesAbout: (name) => `About ${name}`,
  },
  notes: {
    noScore: "This report gives no compatibility score. Each traditional factor is shown on its own, as something to understand rather than a verdict.",
    sharedIsContext: "This is what you told us. The report treats it as context, not as something the charts revealed.",
    moonRelationCaption: "Moon signs, counted from each other",
    wheelCaption: (inner, outer) => `Inner ring: ${inner} · Outer ring: ${outer}`,
    elementsCaption: "Planets in each element, side by side",
    timeUnknown: (name) => `${name}'s birth time is unknown, so the Ascendant, houses and any factor that depends on the exact Moon position are shown as possibilities or left out.`,
    timeApproximate: (name, minutes) => `${name}'s birth time is approximate (±${minutes} minutes); details that change within that window are shown as possibilities.`,
  },
};

const ta: PairDictionary = {
  reportTitle: "பொருத்த அறிக்கை",
  categories: {
    relationship: "உறவு",
    marriage: "திருமணம்",
    friendship: "நட்பு",
    career_teamwork: "பணி மற்றும் குழுப்பணி",
    business_partnership: "வணிகக் கூட்டாண்மை",
    family: "குடும்பம்",
  },
  sections: {
    theTwoOfYou: "நீங்கள் இருவரும்",
    charts: "உங்கள் ஜாதகங்கள் அருகருகே",
    factors: "உங்கள் ஜாதகங்கள் சந்திக்கும் விதம்",
    factorNotes: "ஒவ்வொரு அம்சமும் சொல்வது",
    communication: "தொடர்பாடல்",
    sharedStrengths: "பொதுவான பலங்கள்",
    potentialFriction: "கூடுதல் புரிதல் தேவைப்படக்கூடியவை",
    discussTogether: "சேர்ந்து பேச வேண்டியவை",
    whatYouShared: "நீங்கள் பகிர்ந்தவை",
    summary: "ஒட்டுமொத்தமாக",
    limitations: "இந்த வாசிப்பு சொல்லக்கூடியதும் சொல்ல முடியாததும்",
    about: "இந்த அறிக்கை பற்றி",
  },
  personSection: (name) => `${name} கொண்டு வருவது`,
  factorNames: {
    moon_sign_relationship: "ராசி (சந்திர ராசி) தொடர்பு",
    tara: "தாரை (நட்சத்திர எண்ணிக்கை)",
    gana: "கணம்",
    graha_maitri: "கிரக மைத்ரி (ராசி அதிபதிகள்)",
    yoni: "யோனி",
    nadi: "நாடி",
    inter_aspects: "உங்கள் ஜாதகங்களுக்கு இடையிலான தொடர்புகள்",
    overlays: "ஒருவரின் கிரகங்கள் மற்றவரின் பாவங்களில்",
    elements: "தத்துவ சமநிலை",
  },
  ganas: { deva: "தேவ கணம்", manushya: "மனுஷ கணம்", rakshasa: "ராட்சச கணம்" },
  nadis: { adi: "ஆதி நாடி", madhya: "மத்திய நாடி", antya: "அந்திய நாடி" },
  yonis: {
    horse: "குதிரை",
    elephant: "யானை",
    sheep: "ஆடு",
    serpent: "பாம்பு",
    dog: "நாய்",
    cat: "பூனை",
    rat: "எலி",
    cow: "பசு",
    buffalo: "எருமை",
    tiger: "புலி",
    deer: "மான்",
    monkey: "குரங்கு",
    mongoose: "கீரி",
    lion: "சிங்கம்",
  },
  taras: {
    janma: "ஜன்மம்",
    sampat: "சம்பத்து",
    vipat: "விபத்து",
    kshema: "க்ஷேமம்",
    pratyak: "பிரத்யக்கு",
    sadhana: "சாதகம்",
    naidhana: "நைதனம்",
    mitra: "மித்ரம்",
    parama_mitra: "பரம மித்ரம்",
  },
  friendship: { same: "ஒரே அதிபதி", friend: "நட்பு", neutral: "சமம்", enemy: "பகை" },
  words: {
    same: "ஒன்றே",
    different: "வேறுபட்டது",
    traditionallyOpposed: "மரபுப்படி பகையான இணை",
    traditionallyChallenging: "மரபுப்படி சவாலானது",
    bhakootLessFavourable: "மரபுவழி ராசிப் பொருத்தத்தில் குறைவான சாதகமாகக் கருதப்படுவது",
    dependsOnTime: "பிறந்த நேரத்தைப் பொறுத்தது",
    focus: "இந்த வகைக்கு முக்கியமானது",
    house: (n) => `${n}ஆம் பாவம்`,
    planetsInHouses: (from, into) => `${from} அவர்களின் கிரகங்கள், ${into} அவர்களின் பாவங்களில்`,
    overlaysNeedTime: (into) => `${into} அவர்களின் ஜாதகத்தில் பாவ நிலைகளுக்குத் துல்லியமான பிறந்த நேரம் தேவை; எனவே அவை காட்டப்படவில்லை.`,
  },
  sharedFields: {
    howKnown: "நீங்கள் அறிமுகமான விதம்",
    knownDuration: "எவ்வளவு காலமாக",
    hopes: "புரிந்துகொள்ள விரும்புவது",
    sharedCircumstances: "பொதுவான சூழ்நிலைகள்",
    notesAbout: (name) => `${name} பற்றி`,
  },
  notes: {
    noScore: "இந்த அறிக்கை பொருத்த மதிப்பெண் எதையும் தருவதில்லை. ஒவ்வொரு மரபுவழி அம்சமும் தனித்தனியாக, தீர்ப்பாக அல்லாமல் புரிந்துகொள்ள வேண்டிய ஒன்றாகக் காட்டப்படுகிறது.",
    sharedIsContext: "இவை நீங்கள் எங்களிடம் சொன்னவை. அறிக்கை இவற்றைச் சூழலாகவே கருதுகிறது; ஜாதகம் வெளிப்படுத்தியவையாக அல்ல.",
    moonRelationCaption: "ஒருவருக்கொருவர் எண்ணிய சந்திர ராசிகள்",
    wheelCaption: (inner, outer) => `உள் வட்டம்: ${inner} · வெளி வட்டம்: ${outer}`,
    elementsCaption: "ஒவ்வொரு தத்துவத்திலும் உள்ள கிரகங்கள்",
    timeUnknown: (name) => `${name} அவர்களின் பிறந்த நேரம் தெரியவில்லை; எனவே லக்னம், பாவங்கள் மற்றும் சந்திரனின் துல்லியமான நிலையைச் சார்ந்த அம்சங்கள் சாத்தியங்களாகக் காட்டப்படுகின்றன அல்லது விடப்படுகின்றன.`,
    timeApproximate: (name, minutes) => `${name} அவர்களின் பிறந்த நேரம் தோராயமானது (±${minutes} நிமிடங்கள்); அந்த இடைவெளியில் மாறும் விவரங்கள் சாத்தியங்களாகக் காட்டப்படுகின்றன.`,
  },
};

const hi: PairDictionary = {
  reportTitle: "संगतता रिपोर्ट",
  categories: {
    relationship: "संबंध",
    marriage: "विवाह",
    friendship: "मित्रता",
    career_teamwork: "करियर और टीमवर्क",
    business_partnership: "व्यावसायिक साझेदारी",
    family: "परिवार",
  },
  sections: {
    theTwoOfYou: "आप दोनों",
    charts: "आपकी कुंडलियाँ साथ-साथ",
    factors: "आपकी कुंडलियाँ कैसे मिलती हैं",
    factorNotes: "हर कारक क्या बताता है",
    communication: "संवाद",
    sharedStrengths: "साझा शक्तियाँ",
    potentialFriction: "जिन्हें अधिक समझ की ज़रूरत हो सकती है",
    discussTogether: "साथ मिलकर बात करने के लिए",
    whatYouShared: "आपने हमें जो बताया",
    summary: "सब कुछ एक साथ",
    limitations: "यह पठन क्या बता सकता है और क्या नहीं",
    about: "इस रिपोर्ट के बारे में",
  },
  personSection: (name) => `${name} क्या लाते हैं`,
  factorNames: {
    moon_sign_relationship: "चंद्र राशि संबंध",
    tara: "तारा (नक्षत्र गणना)",
    gana: "गण",
    graha_maitri: "ग्रह मैत्री (राशि स्वामी)",
    yoni: "योनि",
    nadi: "नाड़ी",
    inter_aspects: "आपकी कुंडलियों के बीच संपर्क",
    overlays: "एक-दूसरे के भावों में ग्रह",
    elements: "तत्व संतुलन",
  },
  ganas: { deva: "देव गण", manushya: "मनुष्य गण", rakshasa: "राक्षस गण" },
  nadis: { adi: "आदि नाड़ी", madhya: "मध्य नाड़ी", antya: "अन्त्य नाड़ी" },
  yonis: {
    horse: "अश्व",
    elephant: "गज",
    sheep: "मेष",
    serpent: "सर्प",
    dog: "श्वान",
    cat: "मार्जार",
    rat: "मूषक",
    cow: "गौ",
    buffalo: "महिष",
    tiger: "व्याघ्र",
    deer: "मृग",
    monkey: "वानर",
    mongoose: "नकुल",
    lion: "सिंह",
  },
  taras: {
    janma: "जन्म",
    sampat: "सम्पत्",
    vipat: "विपत्",
    kshema: "क्षेम",
    pratyak: "प्रत्यरि",
    sadhana: "साधक",
    naidhana: "नैधन",
    mitra: "मित्र",
    parama_mitra: "परम मित्र",
  },
  friendship: { same: "एक ही स्वामी", friend: "मित्र", neutral: "सम", enemy: "शत्रु" },
  words: {
    same: "समान",
    different: "भिन्न",
    traditionallyOpposed: "परंपरा में विरोधी जोड़ी",
    traditionallyChallenging: "परंपरा में चुनौतीपूर्ण",
    bhakootLessFavourable: "पारंपरिक भकूट मिलान में कम अनुकूल माना जाता है",
    dependsOnTime: "जन्म समय पर निर्भर",
    focus: "इस श्रेणी के लिए विशेष",
    house: (n) => `${n}वाँ भाव`,
    planetsInHouses: (from, into) => `${from} के ग्रह, ${into} के भावों में`,
    overlaysNeedTime: (into) => `${into} की कुंडली में भाव स्थितियों के लिए सटीक जन्म समय चाहिए, इसलिए वे नहीं दिखाई गई हैं।`,
  },
  sharedFields: {
    howKnown: "आप एक-दूसरे को कैसे जानते हैं",
    knownDuration: "कितने समय से",
    hopes: "आप क्या समझना चाहते हैं",
    sharedCircumstances: "साझा परिस्थितियाँ",
    notesAbout: (name) => `${name} के बारे में`,
  },
  notes: {
    noScore: "यह रिपोर्ट कोई संगतता अंक नहीं देती। हर पारंपरिक कारक अलग से दिखाया गया है, निर्णय के रूप में नहीं, बल्कि समझने की बात के रूप में।",
    sharedIsContext: "यह वह है जो आपने हमें बताया। रिपोर्ट इसे संदर्भ मानती है, कुंडली से मिली जानकारी नहीं।",
    moonRelationCaption: "एक-दूसरे से गिनी गई चंद्र राशियाँ",
    wheelCaption: (inner, outer) => `भीतरी वृत्त: ${inner} · बाहरी वृत्त: ${outer}`,
    elementsCaption: "हर तत्व में ग्रह, साथ-साथ",
    timeUnknown: (name) => `${name} का जन्म समय ज्ञात नहीं है, इसलिए लग्न, भाव और चंद्रमा की सटीक स्थिति पर निर्भर कारक संभावनाओं के रूप में दिखाए गए हैं या छोड़ दिए गए हैं।`,
    timeApproximate: (name, minutes) => `${name} का जन्म समय अनुमानित है (±${minutes} मिनट); उस अवधि में बदलने वाले विवरण संभावनाओं के रूप में दिखाए गए हैं।`,
  },
};

const te: PairDictionary = {
  reportTitle: "అనుకూలత నివేదిక",
  categories: {
    relationship: "సంబంధం",
    marriage: "వివాహం",
    friendship: "స్నేహం",
    career_teamwork: "కెరీర్ & టీమ్‌వర్క్",
    business_partnership: "వ్యాపార భాగస్వామ్యం",
    family: "కుటుంబం",
  },
  sections: {
    theTwoOfYou: "మీరిద్దరూ",
    charts: "మీ జాతకాలు పక్కపక్కనే",
    factors: "మీ జాతకాలు ఎలా కలుస్తాయి",
    factorNotes: "ప్రతి అంశం ఏమి చెబుతుంది",
    communication: "సంభాషణ",
    sharedStrengths: "ఉమ్మడి బలాలు",
    potentialFriction: "మరింత అవగాహన అవసరమయ్యేవి",
    discussTogether: "కలిసి మాట్లాడుకోవలసినవి",
    whatYouShared: "మీరు మాతో పంచుకున్నవి",
    summary: "మొత్తంగా",
    limitations: "ఈ పఠనం చెప్పగలిగేది, చెప్పలేనిది",
    about: "ఈ నివేదిక గురించి",
  },
  personSection: (name) => `${name} తీసుకువచ్చేది`,
  factorNames: {
    moon_sign_relationship: "చంద్ర రాశి సంబంధం",
    tara: "తార (నక్షత్ర గణన)",
    gana: "గణం",
    graha_maitri: "గ్రహ మైత్రి (రాశి అధిపతులు)",
    yoni: "యోని",
    nadi: "నాడి",
    inter_aspects: "మీ జాతకాల మధ్య సంబంధాలు",
    overlays: "ఒకరి గ్రహాలు మరొకరి భావాలలో",
    elements: "తత్వ సమతుల్యత",
  },
  ganas: { deva: "దేవ గణం", manushya: "మనుష్య గణం", rakshasa: "రాక్షస గణం" },
  nadis: { adi: "ఆది నాడి", madhya: "మధ్య నాడి", antya: "అంత్య నాడి" },
  yonis: {
    horse: "గుర్రం",
    elephant: "ఏనుగు",
    sheep: "గొర్రె",
    serpent: "పాము",
    dog: "కుక్క",
    cat: "పిల్లి",
    rat: "ఎలుక",
    cow: "ఆవు",
    buffalo: "గేదె",
    tiger: "పులి",
    deer: "జింక",
    monkey: "కోతి",
    mongoose: "ముంగిస",
    lion: "సింహం",
  },
  taras: {
    janma: "జన్మ",
    sampat: "సంపత్",
    vipat: "విపత్",
    kshema: "క్షేమ",
    pratyak: "ప్రత్యక్",
    sadhana: "సాధన",
    naidhana: "నైధన",
    mitra: "మిత్ర",
    parama_mitra: "పరమ మిత్ర",
  },
  friendship: { same: "ఒకే అధిపతి", friend: "మిత్రుడు", neutral: "సముడు", enemy: "శత్రువు" },
  words: {
    same: "ఒకటే",
    different: "వేరు",
    traditionallyOpposed: "సంప్రదాయంలో విరుద్ధ జంట",
    traditionallyChallenging: "సంప్రదాయంలో సవాలుగా భావించేది",
    bhakootLessFavourable: "సంప్రదాయ భకూట పొంతనలో తక్కువ అనుకూలంగా పరిగణించబడుతుంది",
    dependsOnTime: "జనన సమయంపై ఆధారపడి ఉంటుంది",
    focus: "ఈ విభాగానికి ప్రత్యేకం",
    house: (n) => `${n}వ భావం`,
    planetsInHouses: (from, into) => `${from} గ్రహాలు, ${into} భావాలలో`,
    overlaysNeedTime: (into) => `${into} జాతకంలో భావ స్థానాలకు ఖచ్చితమైన జనన సమయం అవసరం, కాబట్టి అవి చూపబడలేదు.`,
  },
  sharedFields: {
    howKnown: "మీరు ఒకరికొకరు ఎలా తెలుసు",
    knownDuration: "ఎంతకాలంగా",
    hopes: "మీరు అర్థం చేసుకోవాలనుకునేది",
    sharedCircumstances: "ఉమ్మడి పరిస్థితులు",
    notesAbout: (name) => `${name} గురించి`,
  },
  notes: {
    noScore: "ఈ నివేదిక ఎలాంటి అనుకూలత స్కోరునూ ఇవ్వదు. ప్రతి సంప్రదాయ అంశం విడిగా, తీర్పుగా కాకుండా అర్థం చేసుకోవలసిన విషయంగా చూపబడింది.",
    sharedIsContext: "ఇవి మీరు మాకు చెప్పినవి. నివేదిక వీటిని సందర్భంగా మాత్రమే పరిగణిస్తుంది; జాతకం వెల్లడించినవిగా కాదు.",
    moonRelationCaption: "ఒకరి నుండి మరొకరికి లెక్కించిన చంద్ర రాశులు",
    wheelCaption: (inner, outer) => `లోపలి వలయం: ${inner} · బయటి వలయం: ${outer}`,
    elementsCaption: "ప్రతి తత్వంలోని గ్రహాలు, పక్కపక్కనే",
    timeUnknown: (name) => `${name} జనన సమయం తెలియదు, కాబట్టి లగ్నం, భావాలు మరియు చంద్రుని ఖచ్చితమైన స్థానంపై ఆధారపడే అంశాలు అవకాశాలుగా చూపబడ్డాయి లేదా వదిలివేయబడ్డాయి.`,
    timeApproximate: (name, minutes) => `${name} జనన సమయం సుమారుగా ఉంది (±${minutes} నిమిషాలు); ఆ వ్యవధిలో మారే వివరాలు అవకాశాలుగా చూపబడ్డాయి.`,
  },
};

const kn: PairDictionary = {
  reportTitle: "ಹೊಂದಾಣಿಕೆ ವರದಿ",
  categories: {
    relationship: "ಸಂಬಂಧ",
    marriage: "ವಿವಾಹ",
    friendship: "ಸ್ನೇಹ",
    career_teamwork: "ವೃತ್ತಿ ಮತ್ತು ತಂಡಕಾರ್ಯ",
    business_partnership: "ವ್ಯಾಪಾರ ಪಾಲುದಾರಿಕೆ",
    family: "ಕುಟುಂಬ",
  },
  sections: {
    theTwoOfYou: "ನೀವಿಬ್ಬರು",
    charts: "ನಿಮ್ಮ ಜಾತಕಗಳು ಅಕ್ಕಪಕ್ಕದಲ್ಲಿ",
    factors: "ನಿಮ್ಮ ಜಾತಕಗಳು ಹೇಗೆ ಸಂಧಿಸುತ್ತವೆ",
    factorNotes: "ಪ್ರತಿಯೊಂದು ಅಂಶ ಏನು ಹೇಳುತ್ತದೆ",
    communication: "ಸಂವಹನ",
    sharedStrengths: "ಸಾಮಾನ್ಯ ಶಕ್ತಿಗಳು",
    potentialFriction: "ಹೆಚ್ಚಿನ ತಿಳುವಳಿಕೆ ಬೇಕಾಗಬಹುದಾದವು",
    discussTogether: "ಒಟ್ಟಿಗೆ ಮಾತನಾಡಲು",
    whatYouShared: "ನೀವು ನಮ್ಮೊಂದಿಗೆ ಹಂಚಿಕೊಂಡದ್ದು",
    summary: "ಒಟ್ಟಾರೆಯಾಗಿ",
    limitations: "ಈ ಓದು ಹೇಳಬಹುದಾದ್ದು ಮತ್ತು ಹೇಳಲಾಗದ್ದು",
    about: "ಈ ವರದಿಯ ಬಗ್ಗೆ",
  },
  personSection: (name) => `${name} ತರುವುದು`,
  factorNames: {
    moon_sign_relationship: "ಚಂದ್ರ ರಾಶಿ ಸಂಬಂಧ",
    tara: "ತಾರೆ (ನಕ್ಷತ್ರ ಎಣಿಕೆ)",
    gana: "ಗಣ",
    graha_maitri: "ಗ್ರಹ ಮೈತ್ರಿ (ರಾಶಿ ಅಧಿಪತಿಗಳು)",
    yoni: "ಯೋನಿ",
    nadi: "ನಾಡಿ",
    inter_aspects: "ನಿಮ್ಮ ಜಾತಕಗಳ ನಡುವಿನ ಸಂಪರ್ಕಗಳು",
    overlays: "ಒಬ್ಬರ ಗ್ರಹಗಳು ಇನ್ನೊಬ್ಬರ ಭಾವಗಳಲ್ಲಿ",
    elements: "ತತ್ತ್ವ ಸಮತೋಲನ",
  },
  ganas: { deva: "ದೇವ ಗಣ", manushya: "ಮನುಷ್ಯ ಗಣ", rakshasa: "ರಾಕ್ಷಸ ಗಣ" },
  nadis: { adi: "ಆದಿ ನಾಡಿ", madhya: "ಮಧ್ಯ ನಾಡಿ", antya: "ಅಂತ್ಯ ನಾಡಿ" },
  yonis: {
    horse: "ಕುದುರೆ",
    elephant: "ಆನೆ",
    sheep: "ಕುರಿ",
    serpent: "ಹಾವು",
    dog: "ನಾಯಿ",
    cat: "ಬೆಕ್ಕು",
    rat: "ಇಲಿ",
    cow: "ಹಸು",
    buffalo: "ಎಮ್ಮೆ",
    tiger: "ಹುಲಿ",
    deer: "ಜಿಂಕೆ",
    monkey: "ಕೋತಿ",
    mongoose: "ಮುಂಗುಸಿ",
    lion: "ಸಿಂಹ",
  },
  taras: {
    janma: "ಜನ್ಮ",
    sampat: "ಸಂಪತ್",
    vipat: "ವಿಪತ್",
    kshema: "ಕ್ಷೇಮ",
    pratyak: "ಪ್ರತ್ಯಕ್",
    sadhana: "ಸಾಧನ",
    naidhana: "ನೈಧನ",
    mitra: "ಮಿತ್ರ",
    parama_mitra: "ಪರಮ ಮಿತ್ರ",
  },
  friendship: { same: "ಒಂದೇ ಅಧಿಪತಿ", friend: "ಮಿತ್ರ", neutral: "ಸಮ", enemy: "ಶತ್ರು" },
  words: {
    same: "ಒಂದೇ",
    different: "ಬೇರೆ",
    traditionallyOpposed: "ಸಂಪ್ರದಾಯದಲ್ಲಿ ವಿರುದ್ಧ ಜೋಡಿ",
    traditionallyChallenging: "ಸಂಪ್ರದಾಯದಲ್ಲಿ ಸವಾಲಿನದು",
    bhakootLessFavourable: "ಸಾಂಪ್ರದಾಯಿಕ ಭಕೂಟ ಹೊಂದಾಣಿಕೆಯಲ್ಲಿ ಕಡಿಮೆ ಅನುಕೂಲಕರವೆಂದು ಪರಿಗಣಿಸಲಾಗುತ್ತದೆ",
    dependsOnTime: "ಜನನ ಸಮಯವನ್ನು ಅವಲಂಬಿಸಿದೆ",
    focus: "ಈ ವರ್ಗಕ್ಕೆ ವಿಶೇಷ",
    house: (n) => `${n}ನೇ ಭಾವ`,
    planetsInHouses: (from, into) => `${from} ಅವರ ಗ್ರಹಗಳು, ${into} ಅವರ ಭಾವಗಳಲ್ಲಿ`,
    overlaysNeedTime: (into) => `${into} ಅವರ ಜಾತಕದಲ್ಲಿ ಭಾವ ಸ್ಥಾನಗಳಿಗೆ ನಿಖರವಾದ ಜನನ ಸಮಯ ಬೇಕು, ಆದ್ದರಿಂದ ಅವುಗಳನ್ನು ತೋರಿಸಿಲ್ಲ.`,
  },
  sharedFields: {
    howKnown: "ನೀವು ಪರಸ್ಪರ ಹೇಗೆ ಪರಿಚಿತರು",
    knownDuration: "ಎಷ್ಟು ಕಾಲದಿಂದ",
    hopes: "ನೀವು ಅರ್ಥಮಾಡಿಕೊಳ್ಳಲು ಬಯಸುವುದು",
    sharedCircumstances: "ಸಾಮಾನ್ಯ ಸನ್ನಿವೇಶಗಳು",
    notesAbout: (name) => `${name} ಬಗ್ಗೆ`,
  },
  notes: {
    noScore: "ಈ ವರದಿ ಯಾವುದೇ ಹೊಂದಾಣಿಕೆ ಅಂಕವನ್ನು ನೀಡುವುದಿಲ್ಲ. ಪ್ರತಿಯೊಂದು ಸಾಂಪ್ರದಾಯಿಕ ಅಂಶವನ್ನು ಪ್ರತ್ಯೇಕವಾಗಿ, ತೀರ್ಪಾಗಿ ಅಲ್ಲದೆ ಅರ್ಥಮಾಡಿಕೊಳ್ಳಬೇಕಾದ ವಿಷಯವಾಗಿ ತೋರಿಸಲಾಗಿದೆ.",
    sharedIsContext: "ಇವು ನೀವು ನಮಗೆ ಹೇಳಿದವು. ವರದಿ ಇವುಗಳನ್ನು ಸಂದರ್ಭವಾಗಿ ಮಾತ್ರ ಪರಿಗಣಿಸುತ್ತದೆ; ಜಾತಕ ಬಹಿರಂಗಪಡಿಸಿದವು ಎಂದು ಅಲ್ಲ.",
    moonRelationCaption: "ಪರಸ್ಪರ ಎಣಿಸಿದ ಚಂದ್ರ ರಾಶಿಗಳು",
    wheelCaption: (inner, outer) => `ಒಳ ವಲಯ: ${inner} · ಹೊರ ವಲಯ: ${outer}`,
    elementsCaption: "ಪ್ರತಿ ತತ್ತ್ವದಲ್ಲಿನ ಗ್ರಹಗಳು, ಅಕ್ಕಪಕ್ಕದಲ್ಲಿ",
    timeUnknown: (name) => `${name} ಅವರ ಜನನ ಸಮಯ ತಿಳಿದಿಲ್ಲ; ಆದ್ದರಿಂದ ಲಗ್ನ, ಭಾವಗಳು ಮತ್ತು ಚಂದ್ರನ ನಿಖರ ಸ್ಥಾನವನ್ನು ಅವಲಂಬಿಸಿದ ಅಂಶಗಳನ್ನು ಸಾಧ್ಯತೆಗಳಾಗಿ ತೋರಿಸಲಾಗಿದೆ ಅಥವಾ ಬಿಡಲಾಗಿದೆ.`,
    timeApproximate: (name, minutes) => `${name} ಅವರ ಜನನ ಸಮಯ ಅಂದಾಜು (±${minutes} ನಿಮಿಷಗಳು); ಆ ಅವಧಿಯಲ್ಲಿ ಬದಲಾಗುವ ವಿವರಗಳನ್ನು ಸಾಧ್ಯತೆಗಳಾಗಿ ತೋರಿಸಲಾಗಿದೆ.`,
  },
};

const ml: PairDictionary = {
  reportTitle: "പൊരുത്ത റിപ്പോർട്ട്",
  categories: {
    relationship: "ബന്ധം",
    marriage: "വിവാഹം",
    friendship: "സൗഹൃദം",
    career_teamwork: "ജോലിയും ടീം വർക്കും",
    business_partnership: "ബിസിനസ് പങ്കാളിത്തം",
    family: "കുടുംബം",
  },
  sections: {
    theTwoOfYou: "നിങ്ങൾ ഇരുവരും",
    charts: "നിങ്ങളുടെ ജാതകങ്ങൾ അടുത്തടുത്ത്",
    factors: "നിങ്ങളുടെ ജാതകങ്ങൾ എങ്ങനെ സന്ധിക്കുന്നു",
    factorNotes: "ഓരോ ഘടകവും പറയുന്നത്",
    communication: "ആശയവിനിമയം",
    sharedStrengths: "പൊതുവായ ശക്തികൾ",
    potentialFriction: "കൂടുതൽ മനസ്സിലാക്കൽ ആവശ്യമായേക്കാവുന്നവ",
    discussTogether: "ഒരുമിച്ച് സംസാരിക്കാൻ",
    whatYouShared: "നിങ്ങൾ ഞങ്ങളോട് പങ്കുവെച്ചത്",
    summary: "എല്ലാം ചേർത്ത്",
    limitations: "ഈ വായനയ്ക്ക് പറയാൻ കഴിയുന്നതും കഴിയാത്തതും",
    about: "ഈ റിപ്പോർട്ടിനെക്കുറിച്ച്",
  },
  personSection: (name) => `${name} — കൊണ്ടുവരുന്നത്`,
  factorNames: {
    moon_sign_relationship: "ചന്ദ്രരാശി ബന്ധം",
    tara: "താര (നക്ഷത്ര എണ്ണം)",
    gana: "ഗണം",
    graha_maitri: "ഗ്രഹമൈത്രി (രാശ്യധിപന്മാർ)",
    yoni: "യോനി",
    nadi: "നാഡി",
    inter_aspects: "നിങ്ങളുടെ ജാതകങ്ങൾ തമ്മിലുള്ള ബന്ധങ്ങൾ",
    overlays: "ഒരാളുടെ ഗ്രഹങ്ങൾ മറ്റേയാളുടെ ഭാവങ്ങളിൽ",
    elements: "തത്ത്വ സന്തുലനം",
  },
  ganas: { deva: "ദേവഗണം", manushya: "മനുഷ്യഗണം", rakshasa: "രാക്ഷസഗണം" },
  nadis: { adi: "ആദി നാഡി", madhya: "മധ്യ നാഡി", antya: "അന്ത്യ നാഡി" },
  yonis: {
    horse: "കുതിര",
    elephant: "ആന",
    sheep: "ആട്",
    serpent: "പാമ്പ്",
    dog: "നായ",
    cat: "പൂച്ച",
    rat: "എലി",
    cow: "പശു",
    buffalo: "പോത്ത്",
    tiger: "പുലി",
    deer: "മാൻ",
    monkey: "കുരങ്ങ്",
    mongoose: "കീരി",
    lion: "സിംഹം",
  },
  taras: {
    janma: "ജന്മ",
    sampat: "സമ്പത്ത്",
    vipat: "വിപത്ത്",
    kshema: "ക്ഷേമ",
    pratyak: "പ്രത്യക്",
    sadhana: "സാധന",
    naidhana: "നൈധന",
    mitra: "മിത്ര",
    parama_mitra: "പരമമിത്ര",
  },
  friendship: { same: "ഒരേ അധിപൻ", friend: "മിത്രം", neutral: "സമം", enemy: "ശത്രു" },
  words: {
    same: "ഒന്നുതന്നെ",
    different: "വ്യത്യസ്തം",
    traditionallyOpposed: "പാരമ്പര്യമനുസരിച്ച് വിരുദ്ധ ജോഡി",
    traditionallyChallenging: "പാരമ്പര്യമനുസരിച്ച് വെല്ലുവിളിയുള്ളത്",
    bhakootLessFavourable: "പരമ്പരാഗത രാശിപ്പൊരുത്തത്തിൽ അനുകൂലം കുറഞ്ഞതായി കണക്കാക്കുന്നു",
    dependsOnTime: "ജനന സമയത്തെ ആശ്രയിച്ചിരിക്കുന്നു",
    focus: "ഈ വിഭാഗത്തിന് പ്രധാനം",
    house: (n) => `${n}-ാം ഭാവം`,
    planetsInHouses: (from, into) => `ഗ്രഹങ്ങൾ: ${from} → ഭാവങ്ങൾ: ${into}`,
    overlaysNeedTime: (into) => `${into} — ജാതകത്തിലെ ഭാവസ്ഥാനങ്ങൾക്ക് കൃത്യമായ ജനന സമയം ആവശ്യമാണ്, അതിനാൽ അവ കാണിച്ചിട്ടില്ല.`,
  },
  sharedFields: {
    howKnown: "നിങ്ങൾ പരസ്പരം അറിയുന്നത് എങ്ങനെ",
    knownDuration: "എത്ര കാലമായി",
    hopes: "നിങ്ങൾ മനസ്സിലാക്കാൻ ആഗ്രഹിക്കുന്നത്",
    sharedCircumstances: "പൊതുവായ സാഹചര്യങ്ങൾ",
    notesAbout: (name) => `${name} — കുറിപ്പുകൾ`,
  },
  notes: {
    noScore: "ഈ റിപ്പോർട്ട് പൊരുത്ത സ്കോർ ഒന്നും നൽകുന്നില്ല. ഓരോ പരമ്പരാഗത ഘടകവും വെവ്വേറെ, വിധിയായല്ല, മനസ്സിലാക്കേണ്ട കാര്യമായി കാണിച്ചിരിക്കുന്നു.",
    sharedIsContext: "ഇവ നിങ്ങൾ ഞങ്ങളോട് പറഞ്ഞവയാണ്. റിപ്പോർട്ട് ഇവയെ സന്ദർഭമായി മാത്രം കാണുന്നു; ജാതകം വെളിപ്പെടുത്തിയവയായല്ല.",
    moonRelationCaption: "പരസ്പരം എണ്ണിയ ചന്ദ്രരാശികൾ",
    wheelCaption: (inner, outer) => `അകത്തെ വലയം: ${inner} · പുറത്തെ വലയം: ${outer}`,
    elementsCaption: "ഓരോ തത്ത്വത്തിലുമുള്ള ഗ്രഹങ്ങൾ, അടുത്തടുത്ത്",
    timeUnknown: (name) => `${name} — ജനന സമയം അറിയില്ല; അതിനാൽ ലഗ്നം, ഭാവങ്ങൾ, ചന്ദ്രന്റെ കൃത്യമായ സ്ഥാനത്തെ ആശ്രയിക്കുന്ന ഘടകങ്ങൾ എന്നിവ സാധ്യതകളായി കാണിക്കുകയോ ഒഴിവാക്കുകയോ ചെയ്തിരിക്കുന്നു.`,
    timeApproximate: (name, minutes) => `${name} — ജനന സമയം ഏകദേശമാണ് (±${minutes} മിനിറ്റ്); ആ ഇടവേളയിൽ മാറുന്ന വിവരങ്ങൾ സാധ്യതകളായി കാണിച്ചിരിക്കുന്നു.`,
  },
};

const PAIR_DICTIONARIES: Record<LanguageCode, PairDictionary> = { en, ta, hi, te, kn, ml };

export function getPairDictionary(code: LanguageCode): PairDictionary {
  return PAIR_DICTIONARIES[code];
}
