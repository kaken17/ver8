
import "./style.css";

// HTMLの部品を取得する
const form = document.querySelector("#chat-form");
const questionInput = document.querySelector("#question");
const sendButton = document.querySelector("#send-button");
const messages = document.querySelector("#messages");
const statusText = document.querySelector("#status");
const stopButton = document.querySelector("#stop-button");
const avatar = document.querySelector("#avatar");
const mouth = document.querySelector("#mouth");
const avatarStatus = document.querySelector("#avatar-status");

// 会話の履歴を保存する
const conversation = [];

// 二重送信を防ぐ
let isLoading = false;

// 音声読み上げに対応しているか確認
const speechSupported =
  "speechSynthesis" in window &&
  "SpeechSynthesisUtterance" in window;

// 画面にメッセージを追加する
function addMessage(text, role) {
  const bubble = document.createElement("div");
  bubble.className = `bubble ${role}`;
  bubble.textContent = text;

  messages.appendChild(bubble);
  messages.scrollTop = messages.scrollHeight;

  return bubble;
}

// AIの回答を日本語で読み上げる
function speakJapanese(text) {
  if (!speechSupported) {
    statusText.textContent = "このブラウザでは音声を利用できません";
    return;
  }

  // 前の音声を止める
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ja-JP";
  utterance.rate = 1.0;
  utterance.pitch = 1.05;

  // ブラウザに日本語音声があれば優先して選ぶ
  const voices = window.speechSynthesis.getVoices();
  const japaneseVoice = voices.find(
    (voice) => voice.lang.toLowerCase() === "ja-jp"
  );

  if (japaneseVoice) {
    utterance.voice = japaneseVoice;
  }

  utterance.onstart = () => {
    avatar.classList.add("talking");
    mouth.classList.add("open");
    avatarStatus.textContent = "お話ししています…";
    statusText.textContent = "音声を再生中";
  };

  utterance.onend = () => {
    avatar.classList.remove("talking");
    mouth.classList.remove("open");
    avatarStatus.textContent = "あなたの学校案内係";
    statusText.textContent = "準備完了";
  };

  utterance.onerror = () => {
    avatar.classList.remove("talking");
    mouth.classList.remove("open");
    avatarStatus.textContent = "あなたの学校案内係";
    statusText.textContent = "音声を再生できませんでした";
  };

  window.speechSynthesis.speak(utterance);
}

// AIに質問を送信する
async function askAI(question) {
  if (isLoading) return;

  isLoading = true;
  sendButton.disabled = true;
  questionInput.disabled = true;
  statusText.textContent = "AIが回答を考えています…";

  const loadingBubble = addMessage("回答を考えています…", "ai");

  try {
    // Vercelに設置したサーバーAPIを呼び出す
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: [
          ...conversation,
          {
            role: "user",
            content: question
          }
        ]
      })
    });

    
const contentType = response.headers.get("content-type") || "";
const responseText = await response.text();

let data;

if (contentType.includes("application/json")) {
  try {
    data = JSON.parse(responseText);
  } catch {
    console.error("JSON解析エラー:", responseText.slice(0, 500));
    throw new Error("サーバーから正しいJSONが返されませんでした。");
  }
} else {
  console.error(
    "APIがHTMLなどを返しました:",
    response.status,
    responseText.slice(0, 500)
  );

  throw new Error(
    `APIの応答形式が正しくありません（HTTP ${response.status}）。Vercelのデプロイとログを確認してください。`
  );
}

if (!response.ok) {
  throw new Error(
    data.error || "AIとの通信に失敗しました。"
  );
}


    if (typeof data.answer !== "string" || !data.answer.trim()) {
      throw new Error("AIから回答が返ってきませんでした。");
    }

    const answer = data.answer.trim();

    loadingBubble.remove();
    addMessage(answer, "ai");

    // 次の質問にも会話の流れを引き継ぐ
    conversation.push(
      { role: "user", content: question },
      { role: "assistant", content: answer }
    );

    // 履歴が長くなりすぎないように制限
    if (conversation.length > 12) {
      conversation.splice(0, conversation.length - 12);
    }

    // 回答を音声で読み上げる
    speakJapanese(answer);
  } catch (error) {
    loadingBubble.remove();

    console.error("AI通信エラー:", error);

    addMessage(
      "申し訳ありません。AIに接続できませんでした。\n\n" +
      (error.message || "時間をおいて、もう一度お試しください。"),
      "error"
    );

    statusText.textContent = "接続エラー";
  } finally {
    isLoading = false;
    sendButton.disabled = false;
    questionInput.disabled = false;
    questionInput.focus();
  }
}

// フォーム送信時の処理
form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const question = questionInput.value.trim();

  if (!question || isLoading) return;

  // ユーザーの質問を画面に表示
  addMessage(question, "user");
  questionInput.value = "";

  await askAI(question);
});

// 音声停止ボタン
stopButton.addEventListener("click", () => {
  if (speechSupported) {
    window.speechSynthesis.cancel();
  }

  avatar.classList.remove("talking");
  mouth.classList.remove("open");
  avatarStatus.textContent = "あなたの学校案内係";
  statusText.textContent = "音声を停止しました";
});

// 初期表示
if (!speechSupported) {
  statusText.textContent =
    "音声読み上げ非対応のブラウザです";
} else {
  statusText.textContent = "準備完了";
}