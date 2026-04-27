from __future__ import annotations

import re
from dataclasses import dataclass
from dataclasses import field
from datetime import datetime


def _contains_any(text: str, patterns: list[str]) -> bool:
    return any(re.search(p, text, flags=re.IGNORECASE) for p in patterns)


def _normalize(text: str) -> str:
    text = text.strip()
    text = re.sub(r"\s+", " ", text)
    return text


@dataclass
class SessionState:
    language: str = "en"
    last_topic: str | None = None
    created_at: datetime = field(default_factory=datetime.utcnow)


class Chatbot:
    """
    Basic, privacy-friendly health assistant for women farmers.

    Notes:
    - Uses lightweight rules (no LLM) so it works offline.
    - Does NOT store messages on disk (in-memory session only).
    - Not a substitute for a doctor. Always shows safety guidance.
    """

    def __init__(self) -> None:
        self._sessions: dict[str, SessionState] = {}

        # Danger signs that should trigger emergency guidance.
        self._red_flags = [
            r"\b(chest pain|pressure in chest)\b",
            r"\b(trouble breathing|shortness of breath|can't breathe)\b",
            r"\b(severe bleeding|bleeding a lot|heavy bleeding)\b",
            r"\b(fainted|passing out|unconscious)\b",
            r"\b(seizure|fit)\b",
            r"\b(stroke|face droop|slurred speech|weakness on one side)\b",
            r"\b(suicidal|want to die|self harm)\b",
            r"\b(poison|pesticide.*(swallow|drank|ingest))\b",
        ]

        self._topics = {
            "heat": {
                "keywords": [
                    r"\b(heat|hot|loo|sunstroke|heatstroke|dehydration|dehydrated)\b",
                    r"\b(चक्कर|बहुत गर्म|लू|धूप|प्यास|डिहाइड्रेशन)\b",
                ],
                "en": (
                    "Heat stress can be dangerous. Move to shade, sip clean water/ORS, loosen clothing, "
                    "and cool the body (wet cloth on neck/armpits). Rest.\n\n"
                    "Get urgent medical help if there is fainting, confusion, very high fever, or no sweating."
                ),
                "hi": (
                    "गर्मी/लू खतरनाक हो सकती है। छांव में जाएं, साफ पानी/ओआरएस घूंट-घूंट पिएं, कपड़े ढीले करें, "
                    "और शरीर ठंडा करें (गर्दन/बगल पर गीला कपड़ा)। आराम करें।\n\n"
                    "बेहोशी, भ्रम, बहुत तेज बुखार, या पसीना बिल्कुल न आना हो तो तुरंत डॉक्टर/आपात मदद लें।"
                ),
                "followups": {
                    "en": ["ORS recipe", "Heat danger signs"],
                    "hi": ["ओआरएस कैसे बनाएं", "गर्मी के खतरे के लक्षण"],
                },
            },
            "pesticide": {
                "keywords": [
                    r"\b(pesticide|spray|insecticide|herbicide|poison|chemical)\b",
                    r"\b(कीटनाशक|स्प्रे|जहर|रसायन)\b",
                ],
                "en": (
                    "If exposed to pesticides: move to fresh air, remove contaminated clothing, wash skin with soap "
                    "and water, and avoid eating/drinking until hands are washed.\n\n"
                    "If swallowed, vomiting, breathing trouble, or severe symptoms occur, seek urgent care immediately."
                ),
                "hi": (
                    "कीटनाशक के संपर्क में आए हों तो: ताज़ी हवा में जाएं, दूषित कपड़े उतारें, त्वचा को साबुन-पानी से धोएं, "
                    "और हाथ धोए बिना कुछ खाएं/पीएं नहीं।\n\n"
                    "यदि निगल लिया हो, उल्टी हो रही हो, सांस में तकलीफ हो, या लक्षण गंभीर हों तो तुरंत आपात मदद लें।"
                ),
                "followups": {
                    "en": ["Safety while spraying"],
                    "hi": ["स्प्रे करते समय सुरक्षा"],
                },
            },
            "back_pain": {
                "keywords": [
                    r"\b(back pain|lower back|waist pain|body ache|muscle pain)\b",
                    r"\b(पीठ दर्द|कमर दर्द|शरीर दर्द|मांसपेशी)\b",
                ],
                "en": (
                    "For common back/waist pain: rest the area, avoid heavy lifting for 24–48 hours, "
                    "use gentle stretching, and apply a warm compress. Maintain good posture while working.\n\n"
                    "See a clinician if there is numbness, weakness, fever, injury, or pain lasting >1–2 weeks."
                ),
                "hi": (
                    "पीठ/कमर के सामान्य दर्द में: आराम करें, 24–48 घंटे भारी वजन उठाने से बचें, "
                    "हल्का स्ट्रेच करें, और गर्म सेक करें। काम करते समय सही मुद्रा रखें।\n\n"
                    "सुन्नपन/कमजोरी, बुखार, चोट, या दर्द 1–2 हफ्ते से ज्यादा रहे तो डॉक्टर से मिलें।"
                ),
                "followups": {
                    "en": ["Work posture tips", "Gentle stretches"],
                    "hi": ["काम करते समय मुद्रा", "हल्के स्ट्रेच"],
                },
            },
            "nutrition": {
                "keywords": [
                    r"\b(nutrition|diet|food|anemia|iron|weakness|tired)\b",
                    r"\b(खाना|आहार|पोषण|खून की कमी|एनीमिया|आयरन|कमजोरी|थकान)\b",
                ],
                "en": (
                    "For daily nutrition: aim for a balanced plate—whole grains, pulses/beans, seasonal vegetables, "
                    "fruits, and some protein (eggs/milk/curd/fish/meat as available). "
                    "If you feel tired often, consider iron-rich foods (leafy greens, lentils, jaggery) "
                    "and vitamin C with meals.\n\n"
                    "If dizziness, paleness, or breathlessness persists, get a check-up for anemia."
                ),
                "hi": (
                    "रोज़ाना पोषण के लिए: संतुलित थाली रखें—अनाज, दाल/बीन्स, मौसमी सब्ज़ियां, फल, "
                    "और प्रोटीन (अंडा/दूध/दही/मछली/मांस जो उपलब्ध हो)। "
                    "अक्सर थकान हो तो आयरन वाले खाद्य (हरी पत्तेदार सब्ज़ी, दालें, गुड़) लें और भोजन के साथ विटामिन C लें।\n\n"
                    "चक्कर, पीलापन, या सांस फूलना बना रहे तो एनीमिया के लिए जांच कराएं।"
                ),
                "followups": {
                    "en": ["Iron-rich foods", "Anemia signs"],
                    "hi": ["आयरन वाले खाद्य", "एनीमिया के लक्षण"],
                },
            },
            "menstrual": {
                "keywords": [
                    r"\b(period|periods|menstrual|cramps|bleeding)\b",
                    r"\b(पीरियड|मासिक|माहवारी|दर्द|ब्लीडिंग)\b",
                ],
                "en": (
                    "For period cramps: warm compress on the lower abdomen, gentle movement/stretching, "
                    "and adequate fluids. Rest if needed.\n\n"
                    "Seek medical advice if bleeding is very heavy, cycles are very irregular, "
                    "there is severe pain, foul-smelling discharge, or you might be pregnant."
                ),
                "hi": (
                    "पीरियड के दर्द में: निचले पेट पर गर्म सेक, हल्की चाल/स्ट्रेचिंग, और पर्याप्त पानी/तरल लें। जरूरत हो तो आराम करें।\n\n"
                    "यदि ब्लीडिंग बहुत ज्यादा हो, चक्र बहुत अनियमित हों, दर्द बहुत तेज हो, दुर्गंधयुक्त डिस्चार्ज हो, "
                    "या गर्भ ठहरने की संभावना हो तो डॉक्टर से सलाह लें।"
                ),
                "followups": {
                    "en": ["Period hygiene tips"],
                    "hi": ["पीरियड स्वच्छता"],
                },
            },
            "pregnancy": {
                "keywords": [
                    r"\b(pregnant|pregnancy|morning sickness|baby|antenatal)\b",
                    r"\b(गर्भ|प्रेगनेंट|गर्भावस्था|उल्टी|बच्चा|एएनसी)\b",
                ],
                "en": (
                    "During pregnancy: eat small frequent meals, stay hydrated, and rest. "
                    "Take antenatal check-ups and supplements as advised by a clinician.\n\n"
                    "Urgent care is needed for severe headache, swelling of face/hands, bleeding, leaking fluid, "
                    "reduced fetal movement, or severe abdominal pain."
                ),
                "hi": (
                    "गर्भावस्था में: थोड़ी-थोड़ी मात्रा में बार-बार भोजन करें, पानी/तरल पर्याप्त लें, और आराम करें। "
                    "डॉक्टर की सलाह अनुसार एएनसी जांच और सप्लीमेंट लें।\n\n"
                    "तेज सिरदर्द, चेहरे/हाथों में सूजन, ब्लीडिंग, पानी जैसा रिसाव, बच्चे की हलचल कम होना, "
                    "या तेज पेट दर्द हो तो तुरंत डॉक्टर/आपात मदद लें।"
                ),
                "followups": {
                    "en": ["Pregnancy danger signs"],
                    "hi": ["गर्भावस्था के खतरे के संकेत"],
                },
            },
            "mental_health": {
                "keywords": [
                    r"\b(anxiety|stress|depressed|sad|sleep problem|can't sleep)\b",
                    r"\b(तनाव|घबराहट|उदास|डिप्रेशन|नींद नहीं)\b",
                ],
                "en": (
                    "Feeling stressed is common. Try short breaks, slow breathing (inhale 4 seconds, exhale 6 seconds), "
                    "talk to someone you trust, and rest when possible.\n\n"
                    "If you feel hopeless, unsafe, or think about self-harm, seek help immediately from a trusted person "
                    "and local emergency/helpline services."
                ),
                "hi": (
                    "तनाव होना आम है। छोटे-छोटे ब्रेक लें, धीमी सांस लें (4 सेकंड सांस अंदर, 6 सेकंड बाहर), "
                    "किसी भरोसेमंद व्यक्ति से बात करें, और मौका मिले तो आराम करें।\n\n"
                    "यदि बहुत निराशा हो, असुरक्षित महसूस हो, या आत्म-हानि के विचार आएं तो तुरंत किसी भरोसेमंद व्यक्ति "
                    "और स्थानीय आपात/हेल्पलाइन से मदद लें।"
                ),
                "followups": {
                    "en": ["Breathing exercise"],
                    "hi": ["सांस व्यायाम"],
                },
            },
        }

        self._actions = {
            "en": {
                "ORS recipe": (
                    "ORS (oral rehydration solution) at home:\n"
                    "- 1 liter clean water\n"
                    "- 6 level teaspoons sugar\n"
                    "- 1/2 level teaspoon salt\n\n"
                    "Mix well and sip slowly. Make fresh daily. If vomiting, take small sips frequently."
                ),
                "Heat danger signs": (
                    "Heat emergency warning signs:\n"
                    "- Fainting or confusion\n"
                    "- Very hot skin, severe headache\n"
                    "- Seizures, trouble breathing\n"
                    "- No sweating with high heat\n\n"
                    "If these happen, seek urgent medical help."
                ),
                "Safety while spraying": (
                    "Pesticide spraying safety:\n"
                    "- Wear gloves, mask/cloth covering, long sleeves\n"
                    "- Spray with the wind at your back; avoid strong wind\n"
                    "- Do not eat/drink/smoke while spraying\n"
                    "- Keep children away; store chemicals locked\n"
                    "- Wash hands/body and clothes after work"
                ),
                "Work posture tips": (
                    "Work posture tips to protect your back:\n"
                    "- Bend knees, keep load close to the body\n"
                    "- Avoid twisting while lifting; turn with your feet\n"
                    "- Take short breaks and change tasks\n"
                    "- Use a stool/raised surface when possible"
                ),
                "Gentle stretches": (
                    "Gentle stretches (stop if pain increases):\n"
                    "- Slow walking 5–10 minutes\n"
                    "- Cat–cow stretch (slow)\n"
                    "- Hamstring stretch (gentle)\n\n"
                    "If numbness, weakness, or injury, get medical advice first."
                ),
                "Iron-rich foods": (
                    "Iron-rich foods:\n"
                    "- Lentils/beans, chickpeas\n"
                    "- Leafy greens (spinach, amaranth)\n"
                    "- Sesame seeds, peanuts\n"
                    "- Eggs/meat/fish (if you eat them)\n"
                    "- Jaggery\n\n"
                    "Tip: add vitamin C (lemon, amla, guava) with meals to help absorption."
                ),
                "Anemia signs": (
                    "Common anemia signs:\n"
                    "- Tiredness/weakness\n"
                    "- Pale skin, dizziness\n"
                    "- Fast heartbeat, shortness of breath\n\n"
                    "If persistent, get a hemoglobin test at a clinic."
                ),
                "Period hygiene tips": (
                    "Period hygiene tips:\n"
                    "- Change pad/cloth regularly\n"
                    "- Wash hands before/after\n"
                    "- If using cloth, wash with soap and dry in direct sunlight\n"
                    "- Seek care for foul smell, fever, or severe itching"
                ),
                "Breathing exercise": (
                    "1-minute breathing:\n"
                    "- Inhale through nose for 4 seconds\n"
                    "- Exhale slowly for 6 seconds\n"
                    "- Repeat 6–8 times\n\n"
                    "If you feel dizzy, stop and breathe normally."
                ),
                "Pregnancy danger signs": (
                    "Pregnancy danger signs (seek urgent care):\n"
                    "- Bleeding or leaking fluid\n"
                    "- Severe headache/blurred vision\n"
                    "- Swelling of face/hands\n"
                    "- Severe belly pain\n"
                    "- Baby movement reduced"
                ),
            },
            "hi": {
                "ओआरएस कैसे बनाएं": (
                    "घर पर ओआरएस (ओरल रिहाइड्रेशन सॉल्यूशन):\n"
                    "- 1 लीटर साफ पानी\n"
                    "- 6 चम्मच (समतल) चीनी\n"
                    "- 1/2 चम्मच (समतल) नमक\n\n"
                    "अच्छी तरह मिलाएं और धीरे-धीरे घूंट लें। रोज़ ताज़ा बनाएं। उल्टी हो तो बार-बार थोड़ा-थोड़ा पिएं।"
                ),
                "गर्मी के खतरे के लक्षण": (
                    "गर्मी/लू में आपात चेतावनी लक्षण:\n"
                    "- बेहोशी या भ्रम\n"
                    "- त्वचा बहुत गर्म होना, तेज सिरदर्द\n"
                    "- दौरा, सांस में तकलीफ\n"
                    "- बहुत गर्मी में पसीना बिल्कुल न आना\n\n"
                    "ऐसा हो तो तुरंत डॉक्टर/आपात मदद लें।"
                ),
                "स्प्रे करते समय सुरक्षा": (
                    "कीटनाशक स्प्रे करते समय सुरक्षा:\n"
                    "- दस्ताने, मास्क/कपड़ा, पूरी बाजू के कपड़े पहनें\n"
                    "- हवा की दिशा का ध्यान रखें; तेज हवा में स्प्रे न करें\n"
                    "- स्प्रे करते समय खाना/पीना/धूम्रपान न करें\n"
                    "- बच्चों को दूर रखें; रसायन सुरक्षित जगह रखें\n"
                    "- काम के बाद हाथ/शरीर और कपड़े धोएं"
                ),
                "काम करते समय मुद्रा": (
                    "कमर बचाने के लिए काम की मुद्रा:\n"
                    "- घुटने मोड़ें, वजन शरीर के पास रखें\n"
                    "- वजन उठाते समय कमर न मोड़ें; पैरों के साथ मुड़ें\n"
                    "- छोटे ब्रेक लें और काम बदलते रहें\n"
                    "- संभव हो तो ऊँची सतह/स्टूल का उपयोग करें"
                ),
                "हल्के स्ट्रेच": (
                    "हल्के स्ट्रेच (दर्द बढ़े तो रोक दें):\n"
                    "- 5–10 मिनट धीमी चाल\n"
                    "- कैट–काउ स्ट्रेच (धीरे)\n"
                    "- हैमस्ट्रिंग स्ट्रेच (हल्का)\n\n"
                    "यदि सुन्नपन/कमजोरी या चोट हो तो पहले डॉक्टर से सलाह लें।"
                ),
                "आयरन वाले खाद्य": (
                    "आयरन वाले खाद्य:\n"
                    "- दालें/बीन्स/चना\n"
                    "- हरी पत्तेदार सब्ज़ियां\n"
                    "- तिल, मूंगफली\n"
                    "- अंडा/मांस/मछली (यदि खाते हों)\n"
                    "- गुड़\n\n"
                    "टिप: आयरन के साथ विटामिन C (नींबू, आंवला, अमरूद) लेने से अवशोषण बढ़ता है।"
                ),
                "एनीमिया के लक्षण": (
                    "एनीमिया (खून की कमी) के आम लक्षण:\n"
                    "- थकान/कमजोरी\n"
                    "- पीलापन, चक्कर\n"
                    "- धड़कन तेज होना, सांस फूलना\n\n"
                    "लक्षण बने रहें तो स्वास्थ्य केंद्र में Hb जांच कराएं।"
                ),
                "पीरियड स्वच्छता": (
                    "पीरियड स्वच्छता:\n"
                    "- पैड/कपड़ा नियमित बदलें\n"
                    "- पहले/बाद में हाथ धोएं\n"
                    "- कपड़ा उपयोग करें तो साबुन से धोकर धूप में सुखाएं\n"
                    "- दुर्गंध, बुखार, या तेज खुजली हो तो डॉक्टर से मिलें"
                ),
                "सांस व्यायाम": (
                    "1 मिनट का सांस व्यायाम:\n"
                    "- 4 सेकंड नाक से सांस अंदर लें\n"
                    "- 6 सेकंड धीरे-धीरे सांस बाहर छोड़ें\n"
                    "- 6–8 बार दोहराएं\n\n"
                    "चक्कर आए तो रोक दें और सामान्य सांस लें।"
                ),
                "गर्भावस्था के खतरे के संकेत": (
                    "गर्भावस्था के खतरे के संकेत (तुरंत डॉक्टर/आपात मदद लें):\n"
                    "- ब्लीडिंग या पानी जैसा रिसाव\n"
                    "- तेज सिरदर्द/धुंधला दिखना\n"
                    "- चेहरे/हाथों में सूजन\n"
                    "- तेज पेट दर्द\n"
                    "- बच्चे की हलचल कम होना"
                ),
            },
        }

        self._fallback = {
            "en": (
                "I can help with basic health guidance for women farmers (heat stress, nutrition, back pain, "
                "period health, pregnancy, pesticide exposure, stress).\n\n"
                "Tell me your concern and any symptoms (age, pregnancy status if relevant). "
                "If it's an emergency, call your local emergency number."
            ),
            "hi": (
                "मैं महिला किसानों के लिए बुनियादी स्वास्थ्य सलाह दे सकती/सकता हूँ (गर्मी/लू, पोषण, कमर दर्द, "
                "मासिक स्वास्थ्य, गर्भावस्था, कीटनाशक संपर्क, तनाव)।\n\n"
                "अपनी समस्या और लक्षण बताएं (उम्र, यदि लागू हो तो गर्भावस्था की स्थिति)। "
                "अगर आपात स्थिति है तो स्थानीय आपात नंबर पर कॉल करें।"
            ),
        }

    def reply(self, message: str, language: str, session_id: str) -> dict:
        message = _normalize(message)
        state = self._sessions.setdefault(session_id, SessionState(language=language))
        state.language = language

        # Safety first: red flags.
        if _contains_any(message, self._red_flags):
            return {
                "reply": self._emergency_reply(language),
                "quick_replies": self._default_quick_replies(language),
                "meta": {"topic": "emergency"},
            }

        action_reply = self._action_reply(message, language)
        if action_reply:
            return {
                "reply": f"{action_reply}\n\n{self._disclaimer(language)}",
                "quick_replies": self._default_quick_replies(language),
                "meta": {"topic": "action"},
            }

        # Identify best topic by keyword match.
        matched_topic = None
        for topic, cfg in self._topics.items():
            if _contains_any(message, cfg["keywords"]):
                matched_topic = topic
                break

        if matched_topic:
            state.last_topic = matched_topic
            cfg = self._topics[matched_topic]
            reply_text = cfg.get(language, cfg["en"])
            followups = (cfg.get("followups", {}) or {}).get(language, [])
            return {
                "reply": f"{reply_text}\n\n{self._disclaimer(language)}",
                "quick_replies": self._merge_quick_replies(followups, self._default_quick_replies(language)),
                "meta": {"topic": matched_topic},
            }

        # If the user says "hi/hello" etc, give a friendlier greeting.
        if _contains_any(message, [r"^(hi|hello|hey|namaste|नमस्ते)\b"]):
            return {
                "reply": self._greeting(language),
                "quick_replies": self._default_quick_replies(language),
                "meta": {"topic": "greeting"},
            }

        return {
            "reply": f"{self._fallback.get(language, self._fallback['en'])}\n\n{self._disclaimer(language)}",
            "quick_replies": self._default_quick_replies(language),
            "meta": {"topic": "fallback"},
        }

    def _action_reply(self, message: str, language: str) -> str | None:
        actions = self._actions.get(language, {})
        normalized = message.casefold()
        for label, reply in actions.items():
            if normalized == label.casefold():
                return reply
        return None

    def _merge_quick_replies(self, primary: list[str], fallback: list[str]) -> list[str]:
        seen = set()
        merged: list[str] = []
        for item in list(primary) + list(fallback):
            key = item.casefold()
            if key in seen:
                continue
            seen.add(key)
            merged.append(item)
        return merged[:10]

    def _default_quick_replies(self, language: str) -> list[str]:
        if language == "hi":
            return ["गर्मी/लू", "कमर दर्द", "पोषण/खून की कमी", "पीरियड", "गर्भावस्था", "कीटनाशक", "तनाव"]
        return ["Heat stress", "Back pain", "Nutrition/anemia", "Periods", "Pregnancy", "Pesticide exposure", "Stress"]

    def _disclaimer(self, language: str) -> str:
        if language == "hi":
            return (
                "महत्वपूर्ण: यह जानकारी सामान्य है और डॉक्टर की सलाह का विकल्प नहीं है। "
                "लक्षण गंभीर हों या सुधार न हो तो नजदीकी स्वास्थ्य केंद्र/डॉक्टर से मिलें।"
            )
        return (
            "Important: This is general information and not a substitute for a clinician. "
            "If symptoms are severe or not improving, visit a nearby health facility."
        )

    def _emergency_reply(self, language: str) -> str:
        if language == "hi":
            return (
                "यह आपात स्थिति हो सकती है। तुरंत मदद लें:\n"
                "- किसी भरोसेमंद व्यक्ति को साथ रखें\n"
                "- नजदीकी अस्पताल/स्वास्थ्य केंद्र जाएं\n"
                "- अपने स्थानीय आपात नंबर पर कॉल करें (भारत: 112, US: 911)\n\n"
                "यदि कीटनाशक/जहर का संपर्क है तो ताज़ी हवा में जाएं, दूषित कपड़े हटाएं, और त्वचा को साबुन-पानी से धोएं।"
            )
        return (
            "This may be an emergency. Get help right now:\n"
            "- Stay with a trusted person\n"
            "- Go to the nearest clinic/hospital\n"
            "- Call your local emergency number (India: 112, US: 911)\n\n"
            "If there was pesticide/poison exposure, move to fresh air, remove contaminated clothing, and wash skin."
        )

    def _greeting(self, language: str) -> str:
        if language == "hi":
            return (
                "नमस्ते! मैं महिला किसानों के लिए स्वास्थ्य सहायक हूँ। आप किस बारे में मदद चाहती हैं?\n\n"
                "उदाहरण: गर्मी/लू, कमर दर्द, पोषण/खून की कमी, पीरियड, गर्भावस्था, कीटनाशक, तनाव।\n\n"
                f"{self._disclaimer(language)}"
            )
        return (
            "Hello! I’m a health assistant for women farmers. What do you need help with?\n\n"
            "Examples: heat stress, back pain, nutrition/anemia, periods, pregnancy, pesticide exposure, stress.\n\n"
            f"{self._disclaimer(language)}"
        )
