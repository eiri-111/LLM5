import React, { useState, useRef, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import { ChatMessage, UserProfile } from '../types';

interface ChatModeProps {
  userProfile: UserProfile | null;
  onUpdateProfile?: (profile: Partial<UserProfile>) => void;
  onStartSurvey: (messages: ChatMessage[]) => void;
  onSkipToSurvey?: () => void;
  onSkipToResult?: () => void;
  showToast: (msg: string) => void;
}

const INITIAL_GREETING =
  "本調査へのご協力ありがとうございます。\nこれより、実際の日常の場面の中であなたがどのように振る舞っているかを伺います。\n\n「自分はこういう性格だ」と難しく考えず、その場面を思い浮かべて「実際に何と言ったか・どう動いたか」を、普段通りの言葉でお気軽にお話しください。\n\nはじめに、あなたが普段よく過ごしていて「自分らしさ（素）」が出やすい場面（職場、学校、友人や家族との時間、趣味の場など）での、最近のちょっとした出来事を1つ教えてください。\n（例：誰かと何かを決めた、予定外のハプニングが起きた、少し面倒なことに取り組んだ 等）\n\nその時どんな状況で、あなたが実際にどう動いたか（何と言ったか）を教えていただけますか？";

function sanitizeMessage(text: string): string {
  if (!text) return '';
  return text
    .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thought>[\s\S]*$/gi, '')
    .replace(/<think>[\s\S]*$/gi, '')
    .trim();
}

export const ChatMode: React.FC<ChatModeProps> = ({
  userProfile,
  onStartSurvey,
  onSkipToSurvey,
  onSkipToResult,
  showToast,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('llm5_chat_messages');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (_) {}
    return [{ role: 'assistant', content: INITIAL_GREETING }];
  });

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');

  const [isReady, setIsReady] = useState<boolean>(() => {
    try {
      const savedReady = localStorage.getItem('llm5_chat_is_ready') === 'true';
      if (!savedReady) return false;
      const savedMsgs = localStorage.getItem('llm5_chat_messages');
      if (savedMsgs) {
        const parsed = JSON.parse(savedMsgs);
        if (Array.isArray(parsed)) {
          const uCount = parsed.filter((m: ChatMessage) => m.role === 'user').length;
          return uCount >= 6;
        }
      }
    } catch (_) {}
    return false;
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem('llm5_chat_messages', JSON.stringify(messages));
    } catch (_) {}
  }, [messages]);

  useEffect(() => {
    try {
      localStorage.setItem('llm5_chat_is_ready', String(isReady));
    } catch (_) {}
  }, [isReady]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, streamingText]);

  const userTurns = messages.filter(m => m.role === 'user').length;
  // セクション1(対話)は全体進捗の10%〜50%として表示
  const progressPercent = isReady
    ? 50
    : Math.min(48, 10 + Math.round((userTurns / 6) * 38));

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || isLoading) return;

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    const nextUserTurns = newMessages.filter(m => m.role === 'user').length;
    setMessages(newMessages);
    setInputText('');
    setIsLoading(true);
    setStreamingText('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages,
          user_input: text,
          user_profile: userProfile || undefined
        })
      });

      if (!res.ok) {
        let errMessage = 'メッセージの送信に失敗しました';
        try {
          const err: any = await res.json();
          errMessage = err.error || err.detail || errMessage;
        } catch (_) {}
        throw new Error(errMessage);
      }

      const contentType = res.headers.get('content-type') || '';

      if (contentType.includes('text/event-stream') && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = '';
        let buffer = '';
        let readyFlagFromServer = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:')) continue;

            const dataStr = trimmed.slice(5).trim();
            if (dataStr === '[DONE]') continue;

            try {
              const event = JSON.parse(dataStr);
              if (event.type === 'chunk' && event.text) {
                accumulatedText += event.text;
                setStreamingText(accumulatedText);
              } else if (event.type === 'done') {
                if (event.is_ready_for_analysis) {
                  readyFlagFromServer = true;
                }
              } else if (event.type === 'error') {
                throw new Error(event.error);
              }
            } catch (err: any) {
              if (err.message && !err.message.includes('JSON')) {
                console.warn('SSE event error:', err);
              }
            }
          }
        }

        const finalReply = sanitizeMessage(accumulatedText) || 'ご回答ありがとうございます。';
        setMessages([...newMessages, { role: 'assistant', content: finalReply }]);
        setStreamingText('');

        // ストリーミング完了後、かつ質問の途中（疑問符で終わっている状態）でないことを確認して完了ボタンを表示
        const endsWithQuestion = /[？?]\s*$/.test(finalReply);
        if (readyFlagFromServer && !endsWithQuestion && nextUserTurns >= 6) {
          setIsReady(true);
        }
      } else {
        const data: any = await res.json();
        const cleanReply = sanitizeMessage(data.response);
        setMessages([...newMessages, { role: 'assistant', content: cleanReply }]);
        const endsWithQuestion = /[？?]\s*$/.test(cleanReply);
        if (data.is_ready_for_analysis && !endsWithQuestion && nextUserTurns >= 6) {
          setIsReady(true);
        }
      }
    } catch (err: any) {
      console.error(err);
      showToast(`エラー: ${err.message}`);
      setStreamingText('');
    } finally {
      setIsLoading(false);
      setStreamingText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleProceedToSurvey = () => {
    onStartSurvey(messages);
  };

  return (
    <div className="chat-wrapper">
      {/* Qualtrics Top Progress Bar */}
      <div className="qualtrics-progress-bar-wrap">
        <div className="qualtrics-progress-row">
          <span className="qualtrics-progress-pct">0%</span>
          <div className="qualtrics-progress-track">
            <div className="qualtrics-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <span className="qualtrics-progress-pct">100%</span>
        </div>
      </div>

      {/* Qualtrics Instruction Header */}
      <div className="chat-instruction-banner">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
          <span>
            <strong>設問ブロック 1:</strong> AIインタビュアーの質問に対して、あなたの具体的な経験やエピソードをご記入ください。
          </span>
          {(onSkipToSurvey || onSkipToResult) && (
            <div style={{ display: 'flex', gap: '6px' }}>
              {onSkipToSurvey && (
                <button
                  type="button"
                  onClick={onSkipToSurvey}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #b8c2cc',
                    color: '#333e4f',
                    fontSize: '0.7rem',
                    fontWeight: 500,
                    padding: '2px 8px',
                    borderRadius: '3px',
                    cursor: 'pointer'
                  }}
                >
                  質問紙へスキップ
                </button>
              )}
              {onSkipToResult && (
                <button
                  type="button"
                  onClick={onSkipToResult}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #b8c2cc',
                    color: '#333e4f',
                    fontSize: '0.7rem',
                    fontWeight: 500,
                    padding: '2px 8px',
                    borderRadius: '3px',
                    cursor: 'pointer'
                  }}
                >
                  結果へスキップ
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="chat-scroll-area" ref={scrollRef}>
        {messages.map((m, idx) => (
          <div key={idx} className={`chat-bubble ${m.role === 'user' ? 'user' : 'assistant'}`}>
            <div style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: m.role === 'user' ? '#005e94' : '#5c6878',
              marginBottom: '4px'
            }}>
              {m.role === 'user' ? 'あなたの回答' : 'インタビュアー'}
            </div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{sanitizeMessage(m.content)}</div>
          </div>
        ))}
        {streamingText && (
          <div className="chat-bubble assistant">
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#5c6878', marginBottom: '4px' }}>
              インタビュアー
            </div>
            <div style={{ whiteSpace: 'pre-wrap' }}>
              {sanitizeMessage(streamingText)}
              <span className="typing-cursor"></span>
            </div>
          </div>
        )}
        {isLoading && !streamingText && (
          <div className="chat-bubble assistant">
            <span style={{ fontSize: '0.84rem', color: '#5c6878' }}>次の質問を準備しています...</span>
          </div>
        )}
      </div>

      <div className="chat-input-bar">
        {isReady && (
          <button
            type="button"
            onClick={handleProceedToSurvey}
            className="btn-analyze-ready"
          >
            <span>対話セッションが完了しました。次の質問紙（BFI-2-S）へ進んでください</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700, whiteSpace: 'nowrap' }}>
              次へ <ArrowRight size={17} />
            </span>
          </button>
        )}

        <form onSubmit={handleSend} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            className="chat-input-textarea"
            rows={2}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="こちらに回答を入力してください（Enterで送信 / Shift+Enterで改行）..."
            disabled={isLoading}
          />
          <button
            type="submit"
            className="chat-send-btn"
            disabled={isLoading || !inputText.trim()}
            aria-label="回答を送信"
          >
            <span>送信</span>
            <ArrowRight size={15} />
          </button>
        </form>
      </div>
    </div>
  );
};
