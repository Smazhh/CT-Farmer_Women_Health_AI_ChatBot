const messagesEl = document.getElementById("messages");
const quickRepliesEl = document.getElementById("quickReplies");
const inputEl = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendButton");
const languageSelect = document.getElementById("languageSelect");
const langLabel = document.getElementById("langLabel");
const brandTitle = document.getElementById("brandTitle");
const brandSubtitle = document.getElementById("brandSubtitle");
const noticeTitle = document.getElementById("noticeTitle");
const noticeBody = document.getElementById("noticeBody");

let sessionId = null;

const i18n = {
  en: {
    brandTitle: "AI Health Assistant",
    brandSubtitle: "For Women Farmers • SDG 3",
    langLabel: "Language",
    noticeTitle: "Important",
    noticeBody:
      "This chatbot provides general health information and is not a substitute for a clinician. If you think it’s an emergency, call your local emergency number (India: 112, US: 911). Your chats are not stored on disk.",
    placeholder: "Type your question…",
    send: "Send",
    botHello:
      "Hello! I’m a health assistant for women farmers. Ask about heat stress, back pain, nutrition/anemia, periods, pregnancy, pesticide exposure, or stress.",
    serverError: "Server error. Please try again.",
  },
  hi: {
    brandTitle: "एआई स्वास्थ्य सहायक",
    brandSubtitle: "महिला किसानों के लिए • SDG 3",
    langLabel: "भाषा",
    noticeTitle: "महत्वपूर्ण",
    noticeBody:
      "यह चैटबॉट सामान्य स्वास्थ्य जानकारी देता है और डॉक्टर की सलाह का विकल्प नहीं है। आपात स्थिति लगे तो अपने स्थानीय आपात नंबर पर कॉल करें (भारत: 112, US: 911)। चैट संदेश डिस्क पर सेव नहीं होते।",
    placeholder: "अपना सवाल लिखें…",
    send: "भेजें",
    botHello:
      "नमस्ते! मैं महिला किसानों के लिए स्वास्थ्य सहायक हूँ। गर्मी/लू, कमर दर्द, पोषण/खून की कमी, पीरियड, गर्भावस्था, कीटनाशक, या तनाव के बारे में पूछें।",
    serverError: "सर्वर में समस्या है। कृपया फिर से कोशिश करें।",
  },
};

const defaultQuickReplies = {
  en: ["Heat stress", "Back pain", "Nutrition/anemia", "Periods", "Pregnancy", "Pesticide exposure", "Stress"],
  hi: ["गर्मी/लू", "कमर दर्द", "पोषण/खून की कमी", "पीरियड", "गर्भावस्था", "कीटनाशक", "तनाव"],
};

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function addBubble(text, who) {
  const bubble = document.createElement("div");
  bubble.className = `bubble bubble--${who}`;
  bubble.textContent = text;

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = nowTime();

  const wrapper = document.createElement("div");
  wrapper.style.display = "grid";
  wrapper.appendChild(bubble);
  wrapper.appendChild(meta);

  messagesEl.appendChild(wrapper);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function setQuickReplies(chips) {
  quickRepliesEl.innerHTML = "";
  chips.forEach((label) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = label;
    chip.addEventListener("click", () => sendMessage(label));
    quickRepliesEl.appendChild(chip);
  });
}

async function sendMessage(text) {
  const message = (text ?? inputEl.value).trim();
  if (!message) return;

  addBubble(message, "user");
  inputEl.value = "";
  inputEl.focus();

  sendBtn.disabled = true;
  inputEl.disabled = true;

  const language = languageSelect.value;
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, language, session_id: sessionId }),
    });

    if (!res.ok) {
      addBubble((i18n[language] || i18n.en).serverError, "bot");
      return;
    }

    const data = await res.json();
    sessionId = data.session_id;
    addBubble(data.reply, "bot");
    setQuickReplies(data.quick_replies || []);
  } catch {
    addBubble((i18n[language] || i18n.en).serverError, "bot");
  } finally {
    sendBtn.disabled = false;
    inputEl.disabled = false;
  }
}

function applyLanguage(lang) {
  const t = i18n[lang] || i18n.en;
  brandTitle.textContent = t.brandTitle;
  brandSubtitle.textContent = t.brandSubtitle;
  langLabel.textContent = t.langLabel;
  noticeTitle.textContent = t.noticeTitle;
  noticeBody.textContent = t.noticeBody;
  inputEl.placeholder = t.placeholder;
  sendBtn.textContent = t.send;
  setQuickReplies(defaultQuickReplies[lang] || defaultQuickReplies.en);
}

sendBtn.addEventListener("click", () => sendMessage());
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});
languageSelect.addEventListener("change", () => applyLanguage(languageSelect.value));

applyLanguage(languageSelect.value);
addBubble(i18n[languageSelect.value].botHello, "bot");
setQuickReplies(defaultQuickReplies[languageSelect.value] || defaultQuickReplies.en);
