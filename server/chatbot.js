function normalize(text) {
  return String(text ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function containsAny(text, regexes) {
  return regexes.some((re) => re.test(text));
}

function mergeQuickReplies(primary, fallback, limit = 10) {
  const seen = new Set();
  const merged = [];
  for (const item of [...(primary || []), ...(fallback || [])]) {
    const key = String(item).toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged.slice(0, limit);
}

class Chatbot {
  constructor() {
    this.sessions = new Map();

    this.redFlags = [
      /\b(chest pain|pressure in chest)\b/i,
      /\b(trouble breathing|shortness of breath|can't breathe)\b/i,
      /\b(severe bleeding|bleeding a lot|heavy bleeding)\b/i,
      /\b(fainted|passing out|unconscious)\b/i,
      /\b(seizure|fit)\b/i,
      /\b(stroke|face droop|slurred speech|weakness on one side)\b/i,
      /\b(suicidal|want to die|self harm)\b/i,
      /\b(poison|pesticide.*(swallow|drank|ingest))\b/i,
    ];

    this.topics = {
      heat: {
        keywords: [/\b(heat|hot|loo|sunstroke|heatstroke|dehydration|dehydrated)\b/i, /\b(चक्कर|बहुत गर्म|लू|धूप|प्यास|डिहाइड्रेशन)\b/i],
        reply: {
          en: [
            "Heat stress can be dangerous. Move to shade, sip clean water/ORS, loosen clothing, and cool the body (wet cloth on neck/armpits). Rest.",
            "",
            "Get urgent medical help if there is fainting, confusion, very high fever, or no sweating.",
          ].join("\n"),
          hi: [
            "गर्मी/लू खतरनाक हो सकती है। छांव में जाएं, साफ पानी/ओआरएस घूंट-घूंट पिएं, कपड़े ढीले करें, और शरीर ठंडा करें (गर्दन/बगल पर गीला कपड़ा)। आराम करें।",
            "",
            "बेहोशी, भ्रम, बहुत तेज बुखार, या पसीना बिल्कुल न आना हो तो तुरंत डॉक्टर/आपात मदद लें।",
          ].join("\n"),
        },
        followups: {
          en: ["ORS recipe", "Heat danger signs"],
          hi: ["ओआरएस कैसे बनाएं", "गर्मी के खतरे के लक्षण"],
        },
      },
      pesticide: {
        keywords: [/\b(pesticide|spray|insecticide|herbicide|poison|chemical)\b/i, /\b(कीटनाशक|स्प्रे|जहर|रसायन)\b/i],
        reply: {
          en: [
            "If exposed to pesticides: move to fresh air, remove contaminated clothing, wash skin with soap and water, and avoid eating/drinking until hands are washed.",
            "",
            "If swallowed, vomiting, breathing trouble, or severe symptoms occur, seek urgent care immediately.",
          ].join("\n"),
          hi: [
            "कीटनाशक के संपर्क में आए हों तो: ताज़ी हवा में जाएं, दूषित कपड़े उतारें, त्वचा को साबुन-पानी से धोएं, और हाथ धोए बिना कुछ खाएं/पीएं नहीं।",
            "",
            "यदि निगल लिया हो, उल्टी हो रही हो, सांस में तकलीफ हो, या लक्षण गंभीर हों तो तुरंत आपात मदद लें।",
          ].join("\n"),
        },
        followups: {
          en: ["Safety while spraying"],
          hi: ["स्प्रे करते समय सुरक्षा"],
        },
      },
      back_pain: {
        keywords: [/\b(back pain|lower back|waist pain|body ache|muscle pain)\b/i, /\b(पीठ दर्द|कमर दर्द|शरीर दर्द|मांसपेशी)\b/i],
        reply: {
          en: [
            "For common back/waist pain: rest the area, avoid heavy lifting for 24–48 hours, use gentle stretching, and apply a warm compress. Maintain good posture while working.",
            "",
            "See a clinician if there is numbness, weakness, fever, injury, or pain lasting >1–2 weeks.",
          ].join("\n"),
          hi: [
            "पीठ/कमर के सामान्य दर्द में: आराम करें, 24–48 घंटे भारी वजन उठाने से बचें, हल्का स्ट्रेच करें, और गर्म सेक करें। काम करते समय सही मुद्रा रखें।",
            "",
            "सुन्नपन/कमजोरी, बुखार, चोट, या दर्द 1–2 हफ्ते से ज्यादा रहे तो डॉक्टर से मिलें।",
          ].join("\n"),
        },
        followups: {
          en: ["Work posture tips", "Gentle stretches"],
          hi: ["काम करते समय मुद्रा", "हल्के स्ट्रेच"],
        },
      },
      nutrition: {
        keywords: [/\b(nutrition|diet|food|anemia|iron|weakness|tired)\b/i, /\b(खाना|आहार|पोषण|खून की कमी|एनीमिया|आयरन|कमजोरी|थकान)\b/i],
        reply: {
          en: [
            "For daily nutrition: aim for a balanced plate—whole grains, pulses/beans, seasonal vegetables, fruits, and some protein (eggs/milk/curd/fish/meat as available). If you feel tired often, consider iron-rich foods (leafy greens, lentils, jaggery) and vitamin C with meals.",
            "",
            "If dizziness, paleness, or breathlessness persists, get a check-up for anemia.",
          ].join("\n"),
          hi: [
            "रोज़ाना पोषण के लिए: संतुलित थाली रखें—अनाज, दाल/बीन्स, मौसमी सब्ज़ियां, फल, और प्रोटीन (अंडा/दूध/दही/मछली/मांस जो उपलब्ध हो)। अक्सर थकान हो तो आयरन वाले खाद्य (हरी पत्तेदार सब्ज़ी, दालें, गुड़) लें और भोजन के साथ विटामिन C लें।",
            "",
            "चक्कर, पीलापन, या सांस फूलना बना रहे तो एनीमिया के लिए जांच कराएं।",
          ].join("\n"),
        },
        followups: {
          en: ["Iron-rich foods", "Anemia signs"],
          hi: ["आयरन वाले खाद्य", "एनीमिया के लक्षण"],
        },
      },
      menstrual: {
        keywords: [/\b(period|periods|menstrual|cramps|bleeding)\b/i, /\b(पीरियड|मासिक|माहवारी|दर्द|ब्लीडिंग)\b/i],
        reply: {
          en: [
            "For period cramps: warm compress on the lower abdomen, gentle movement/stretching, and adequate fluids. Rest if needed.",
            "",
            "Seek medical advice if bleeding is very heavy, cycles are very irregular, there is severe pain, foul-smelling discharge, or you might be pregnant.",
          ].join("\n"),
          hi: [
            "पीरियड के दर्द में: निचले पेट पर गर्म सेक, हल्की चाल/स्ट्रेचिंग, और पर्याप्त पानी/तरल लें। जरूरत हो तो आराम करें।",
            "",
            "यदि ब्लीडिंग बहुत ज्यादा हो, चक्र बहुत अनियमित हों, दर्द बहुत तेज हो, दुर्गंधयुक्त डिस्चार्ज हो, या गर्भ ठहरने की संभावना हो तो डॉक्टर से सलाह लें।",
          ].join("\n"),
        },
        followups: {
          en: ["Period hygiene tips"],
          hi: ["पीरियड स्वच्छता"],
        },
      },
      pregnancy: {
        keywords: [/\b(pregnant|pregnancy|morning sickness|baby|antenatal)\b/i, /\b(गर्भ|प्रेगनेंट|गर्भावस्था|उल्टी|बच्चा|एएनसी)\b/i],
        reply: {
          en: [
            "During pregnancy: eat small frequent meals, stay hydrated, and rest. Take antenatal check-ups and supplements as advised by a clinician.",
            "",
            "Urgent care is needed for severe headache, swelling of face/hands, bleeding, leaking fluid, reduced fetal movement, or severe abdominal pain.",
          ].join("\n"),
          hi: [
            "गर्भावस्था में: थोड़ी-थोड़ी मात्रा में बार-बार भोजन करें, पानी/तरल पर्याप्त लें, और आराम करें। डॉक्टर की सलाह अनुसार एएनसी जांच और सप्लीमेंट लें।",
            "",
            "तेज सिरदर्द, चेहरे/हाथों में सूजन, ब्लीडिंग, पानी जैसा रिसाव, बच्चे की हलचल कम होना, या तेज पेट दर्द हो तो तुरंत डॉक्टर/आपात मदद लें।",
          ].join("\n"),
        },
        followups: {
          en: ["Pregnancy danger signs"],
          hi: ["गर्भावस्था के खतरे के संकेत"],
        },
      },
      mental_health: {
        keywords: [/\b(anxiety|stress|depressed|sad|sleep problem|can't sleep)\b/i, /\b(तनाव|घबराहट|उदास|डिप्रेशन|नींद नहीं)\b/i],
        reply: {
          en: [
            "Feeling stressed is common. Try short breaks, slow breathing (inhale 4 seconds, exhale 6 seconds), talk to someone you trust, and rest when possible.",
            "",
            "If you feel hopeless, unsafe, or think about self-harm, seek help immediately from a trusted person and local emergency/helpline services.",
          ].join("\n"),
          hi: [
            "तनाव होना आम है। छोटे-छोटे ब्रेक लें, धीमी सांस लें (4 सेकंड सांस अंदर, 6 सेकंड बाहर), किसी भरोसेमंद व्यक्ति से बात करें, और मौका मिले तो आराम करें।",
            "",
            "यदि बहुत निराशा हो, असुरक्षित महसूस हो, या आत्म-हानि के विचार आएं तो तुरंत किसी भरोसेमंद व्यक्ति और स्थानीय आपात/हेल्पलाइन से मदद लें।",
          ].join("\n"),
        },
        followups: {
          en: ["Breathing exercise"],
          hi: ["सांस व्यायाम"],
        },
      },
    };

    this.actions = {
      en: {
        "ORS recipe": [
          "ORS (oral rehydration solution) at home:",
          "- 1 liter clean water",
          "- 6 level teaspoons sugar",
          "- 1/2 level teaspoon salt",
          "",
          "Mix well and sip slowly. Make fresh daily. If vomiting, take small sips frequently.",
        ].join("\n"),
        "Heat danger signs": [
          "Heat emergency warning signs:",
          "- Fainting or confusion",
          "- Very hot skin, severe headache",
          "- Seizures, trouble breathing",
          "- No sweating with high heat",
          "",
          "If these happen, seek urgent medical help.",
        ].join("\n"),
        "Safety while spraying": [
          "Pesticide spraying safety:",
          "- Wear gloves, mask/cloth covering, long sleeves",
          "- Spray with the wind at your back; avoid strong wind",
          "- Do not eat/drink/smoke while spraying",
          "- Keep children away; store chemicals locked",
          "- Wash hands/body and clothes after work",
        ].join("\n"),
        "Work posture tips": [
          "Work posture tips to protect your back:",
          "- Bend knees, keep load close to the body",
          "- Avoid twisting while lifting; turn with your feet",
          "- Take short breaks and change tasks",
          "- Use a stool/raised surface when possible",
        ].join("\n"),
        "Gentle stretches": [
          "Gentle stretches (stop if pain increases):",
          "- Slow walking 5–10 minutes",
          "- Cat–cow stretch (slow)",
          "- Hamstring stretch (gentle)",
          "",
          "If numbness, weakness, or injury, get medical advice first.",
        ].join("\n"),
        "Iron-rich foods": [
          "Iron-rich foods:",
          "- Lentils/beans, chickpeas",
          "- Leafy greens (spinach, amaranth)",
          "- Sesame seeds, peanuts",
          "- Eggs/meat/fish (if you eat them)",
          "- Jaggery",
          "",
          "Tip: add vitamin C (lemon, amla, guava) with meals to help absorption.",
        ].join("\n"),
        "Anemia signs": [
          "Common anemia signs:",
          "- Tiredness/weakness",
          "- Pale skin, dizziness",
          "- Fast heartbeat, shortness of breath",
          "",
          "If persistent, get a hemoglobin test at a clinic.",
        ].join("\n"),
        "Period hygiene tips": [
          "Period hygiene tips:",
          "- Change pad/cloth regularly",
          "- Wash hands before/after",
          "- If using cloth, wash with soap and dry in direct sunlight",
          "- Seek care for foul smell, fever, or severe itching",
        ].join("\n"),
        "Breathing exercise": [
          "1-minute breathing:",
          "- Inhale through nose for 4 seconds",
          "- Exhale slowly for 6 seconds",
          "- Repeat 6–8 times",
          "",
          "If you feel dizzy, stop and breathe normally.",
        ].join("\n"),
        "Pregnancy danger signs": [
          "Pregnancy danger signs (seek urgent care):",
          "- Bleeding or leaking fluid",
          "- Severe headache/blurred vision",
          "- Swelling of face/hands",
          "- Severe belly pain",
          "- Baby movement reduced",
        ].join("\n"),
      },
      hi: {
        "ओआरएस कैसे बनाएं": [
          "घर पर ओआरएस (ओरल रिहाइड्रेशन सॉल्यूशन):",
          "- 1 लीटर साफ पानी",
          "- 6 चम्मच (समतल) चीनी",
          "- 1/2 चम्मच (समतल) नमक",
          "",
          "अच्छी तरह मिलाएं और धीरे-धीरे घूंट लें। रोज़ ताज़ा बनाएं। उल्टी हो तो बार-बार थोड़ा-थोड़ा पिएं।",
        ].join("\n"),
        "गर्मी के खतरे के लक्षण": [
          "गर्मी/लू में आपात चेतावनी लक्षण:",
          "- बेहोशी या भ्रम",
          "- त्वचा बहुत गर्म होना, तेज सिरदर्द",
          "- दौरा, सांस में तकलीफ",
          "- बहुत गर्मी में पसीना बिल्कुल न आना",
          "",
          "ऐसा हो तो तुरंत डॉक्टर/आपात मदद लें।",
        ].join("\n"),
        "स्प्रे करते समय सुरक्षा": [
          "कीटनाशक स्प्रे करते समय सुरक्षा:",
          "- दस्ताने, मास्क/कपड़ा, पूरी बाजू के कपड़े पहनें",
          "- हवा की दिशा का ध्यान रखें; तेज हवा में स्प्रे न करें",
          "- स्प्रे करते समय खाना/पीना/धूम्रपान न करें",
          "- बच्चों को दूर रखें; रसायन सुरक्षित जगह रखें",
          "- काम के बाद हाथ/शरीर और कपड़े धोएं",
        ].join("\n"),
        "काम करते समय मुद्रा": [
          "कमर बचाने के लिए काम की मुद्रा:",
          "- घुटने मोड़ें, वजन शरीर के पास रखें",
          "- वजन उठाते समय कमर न मोड़ें; पैरों के साथ मुड़ें",
          "- छोटे ब्रेक लें और काम बदलते रहें",
          "- संभव हो तो ऊँची सतह/स्टूल का उपयोग करें",
        ].join("\n"),
        "हल्के स्ट्रेच": [
          "हल्के स्ट्रेच (दर्द बढ़े तो रोक दें):",
          "- 5–10 मिनट धीमी चाल",
          "- कैट–काउ स्ट्रेच (धीरे)",
          "- हैमस्ट्रिंग स्ट्रेच (हल्का)",
          "",
          "यदि सुन्नपन/कमजोरी या चोट हो तो पहले डॉक्टर से सलाह लें।",
        ].join("\n"),
        "आयरन वाले खाद्य": [
          "आयरन वाले खाद्य:",
          "- दालें/बीन्स/चना",
          "- हरी पत्तेदार सब्ज़ियां",
          "- तिल, मूंगफली",
          "- अंडा/मांस/मछली (यदि खाते हों)",
          "- गुड़",
          "",
          "टिप: आयरन के साथ विटामिन C (नींबू, आंवला, अमरूद) लेने से अवशोषण बढ़ता है।",
        ].join("\n"),
        "एनीमिया के लक्षण": [
          "एनीमिया (खून की कमी) के आम लक्षण:",
          "- थकान/कमजोरी",
          "- पीलापन, चक्कर",
          "- धड़कन तेज होना, सांस फूलना",
          "",
          "लक्षण बने रहें तो स्वास्थ्य केंद्र में Hb जांच कराएं।",
        ].join("\n"),
        "पीरियड स्वच्छता": [
          "पीरियड स्वच्छता:",
          "- पैड/कपड़ा नियमित बदलें",
          "- पहले/बाद में हाथ धोएं",
          "- कपड़ा उपयोग करें तो साबुन से धोकर धूप में सुखाएं",
          "- दुर्गंध, बुखार, या तेज खुजली हो तो डॉक्टर से मिलें",
        ].join("\n"),
        "सांस व्यायाम": [
          "1 मिनट का सांस व्यायाम:",
          "- 4 सेकंड नाक से सांस अंदर लें",
          "- 6 सेकंड धीरे-धीरे सांस बाहर छोड़ें",
          "- 6–8 बार दोहराएं",
          "",
          "चक्कर आए तो रोक दें और सामान्य सांस लें।",
        ].join("\n"),
        "गर्भावस्था के खतरे के संकेत": [
          "गर्भावस्था के खतरे के संकेत (तुरंत डॉक्टर/आपात मदद लें):",
          "- ब्लीडिंग या पानी जैसा रिसाव",
          "- तेज सिरदर्द/धुंधला दिखना",
          "- चेहरे/हाथों में सूजन",
          "- तेज पेट दर्द",
          "- बच्चे की हलचल कम होना",
        ].join("\n"),
      },
    };

    this.fallback = {
      en: [
        "I can help with basic health guidance for women farmers (heat stress, nutrition, back pain, period health, pregnancy, pesticide exposure, stress).",
        "",
        "Tell me your concern and any symptoms (age, pregnancy status if relevant). If it's an emergency, call your local emergency number.",
      ].join("\n"),
      hi: [
        "मैं महिला किसानों के लिए बुनियादी स्वास्थ्य सलाह दे सकती/सकता हूँ (गर्मी/लू, पोषण, कमर दर्द, मासिक स्वास्थ्य, गर्भावस्था, कीटनाशक संपर्क, तनाव)।",
        "",
        "अपनी समस्या और लक्षण बताएं (उम्र, यदि लागू हो तो गर्भावस्था की स्थिति)। अगर आपात स्थिति है तो स्थानीय आपात नंबर पर कॉल करें।",
      ].join("\n"),
    };
  }

  reply({ message, language = "en", sessionId }) {
    const lang = language === "hi" ? "hi" : "en";
    const text = normalize(message);

    const state = this.sessions.get(sessionId) || { language: lang, lastTopic: null, createdAt: Date.now() };
    state.language = lang;
    this.sessions.set(sessionId, state);

    if (containsAny(text, this.redFlags)) {
      return {
        reply: this.emergencyReply(lang),
        quickReplies: this.defaultQuickReplies(lang),
        meta: { topic: "emergency" },
      };
    }

    const action = this.actionReply(text, lang);
    if (action) {
      return {
        reply: `${action}\n\n${this.disclaimer(lang)}`,
        quickReplies: this.defaultQuickReplies(lang),
        meta: { topic: "action" },
      };
    }

    for (const [topic, cfg] of Object.entries(this.topics)) {
      if (containsAny(text, cfg.keywords)) {
        state.lastTopic = topic;
        const followups = (cfg.followups && cfg.followups[lang]) || [];
        const replyText = (cfg.reply && cfg.reply[lang]) || (cfg.reply && cfg.reply.en) || this.fallback[lang];
        return {
          reply: `${replyText}\n\n${this.disclaimer(lang)}`,
          quickReplies: mergeQuickReplies(followups, this.defaultQuickReplies(lang)),
          meta: { topic },
        };
      }
    }

    if (/^(hi|hello|hey|namaste|नमस्ते)\b/i.test(text)) {
      return {
        reply: this.greeting(lang),
        quickReplies: this.defaultQuickReplies(lang),
        meta: { topic: "greeting" },
      };
    }

    return {
      reply: `${this.fallback[lang] || this.fallback.en}\n\n${this.disclaimer(lang)}`,
      quickReplies: this.defaultQuickReplies(lang),
      meta: { topic: "fallback" },
    };
  }

  actionReply(text, lang) {
    const actions = this.actions[lang] || {};
    const normalized = String(text).toLocaleLowerCase();
    for (const [label, reply] of Object.entries(actions)) {
      if (normalized === String(label).toLocaleLowerCase()) return reply;
    }
    return null;
  }

  defaultQuickReplies(lang) {
    if (lang === "hi") return ["गर्मी/लू", "कमर दर्द", "पोषण/खून की कमी", "पीरियड", "गर्भावस्था", "कीटनाशक", "तनाव"];
    return ["Heat stress", "Back pain", "Nutrition/anemia", "Periods", "Pregnancy", "Pesticide exposure", "Stress"];
  }

  disclaimer(lang) {
    if (lang === "hi") {
      return "महत्वपूर्ण: यह जानकारी सामान्य है और डॉक्टर की सलाह का विकल्प नहीं है। लक्षण गंभीर हों या सुधार न हो तो नजदीकी स्वास्थ्य केंद्र/डॉक्टर से मिलें।";
    }
    return "Important: This is general information and not a substitute for a clinician. If symptoms are severe or not improving, visit a nearby health facility.";
  }

  emergencyReply(lang) {
    if (lang === "hi") {
      return [
        "यह आपात स्थिति हो सकती है। तुरंत मदद लें:",
        "- किसी भरोसेमंद व्यक्ति को साथ रखें",
        "- नजदीकी अस्पताल/स्वास्थ्य केंद्र जाएं",
        "- अपने स्थानीय आपात नंबर पर कॉल करें (भारत: 112, US: 911)",
        "",
        "यदि कीटनाशक/जहर का संपर्क है तो ताज़ी हवा में जाएं, दूषित कपड़े हटाएं, और त्वचा को साबुन-पानी से धोएं।",
      ].join("\n");
    }
    return [
      "This may be an emergency. Get help right now:",
      "- Stay with a trusted person",
      "- Go to the nearest clinic/hospital",
      "- Call your local emergency number (India: 112, US: 911)",
      "",
      "If there was pesticide/poison exposure, move to fresh air, remove contaminated clothing, and wash skin.",
    ].join("\n");
  }

  greeting(lang) {
    if (lang === "hi") {
      return [
        "नमस्ते! मैं महिला किसानों के लिए स्वास्थ्य सहायक हूँ। आप किस बारे में मदद चाहती हैं?",
        "",
        "उदाहरण: गर्मी/लू, कमर दर्द, पोषण/खून की कमी, पीरियड, गर्भावस्था, कीटनाशक, तनाव।",
        "",
        this.disclaimer(lang),
      ].join("\n");
    }
    return [
      "Hello! I’m a health assistant for women farmers. What do you need help with?",
      "",
      "Examples: heat stress, back pain, nutrition/anemia, periods, pregnancy, pesticide exposure, stress.",
      "",
      this.disclaimer(lang),
    ].join("\n");
  }
}

module.exports = { Chatbot };

