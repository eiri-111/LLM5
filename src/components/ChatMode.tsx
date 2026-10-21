import React, { useState, useRef, useEffect } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { ChatMessage, UserProfile } from '../types';
import { buildInitialGreeting } from '../data/scenarios';

interface ChatModeProps {
  userProfile: UserProfile | null;
  onUpdateProfile?: (profile: Partial<UserProfile>) => void;
  onStartSurvey: (messages: ChatMessage[]) => void;
  onSkipToSurvey?: () => void;
  onSkipToResult?: () => void;
  onReset?: () => void;
  showToast: (msg: string) => void;
}

function sanitizeMessage(text: string): string {
  if (!text) return '';
  return text
    .replace(/<\|channel>thought[\s\S]*?<channel\|>/gi, '')
    .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\|channel>thought[\s\S]*$/gi, '')
    .replace(/<thought>[\s\S]*$/gi, '')
    .replace(/<think>[\s\S]*$/gi, '')
    .trim();
}

function isAssistantCompletionReply(text: string): boolean {
  const clean = sanitizeMessage(text);
  if (!clean) return false;
  return /(インタビューは.*終了|対話セッションは.*完了|次のステップ.*質問紙|お話を聞かせていただき.*ありがとうございました|質問紙へ進んで|アンケートへ進んで)/.test(clean);
}

export const ChatMode: React.FC<ChatModeProps> = ({
  userProfile,
  onStartSurvey,
  onSkipToSurvey,
  onSkipToResult,
  onReset,
  showToast,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const greeting = buildInitialGreeting(userProfile);
    try {
      const saved = localStorage.getItem('llm5_chat_messages');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // 旧固定文または初期挨拶1件のみの場合は最新の年齢適応シナリオに置換
          const isSingleAssistant = parsed.length === 1 && parsed[0].role === 'assistant';
          const isLegacyBEIGreeting = parsed[0]?.content?.includes('自分らしさ（素）が出やすい場面') ||
                                     parsed[0]?.content?.includes('最近のちょっとした出来事');
          if (isSingleAssistant || isLegacyBEIGreeting) {
            return [{ role: 'assistant', content: greeting }];
          }
          return parsed;
        }
      }
    } catch (_) {}
    return [{ role: 'assistant', content: greeting }];
  });

  // userProfile の年齢確定時に、まだユーザーが発言していなければ初期シナリオを即座に更新
  useEffect(() => {
    const freshGreeting = buildInitialGreeting(userProfile);
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].role === 'assistant') {
        if (prev[0].content !== freshGreeting) {
          try {
            localStorage.setItem('llm5_chat_messages', JSON.stringify([{ role: 'assistant', content: freshGreeting }]));
          } catch (_) {}
          return [{ role: 'assistant', content: freshGreeting }];
        }
      }
      return prev;
    });
  }, [userProfile]);

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');

  const [isReady, setIsReady] = useState<boolean>(() => {
    try {
      const savedMsgs = localStorage.getItem('llm5_chat_messages');
      if (savedMsgs) {
        const parsed = JSON.parse(savedMsgs);
        if (Array.isArray(parsed)) {
          const uCount = parsed.filter((m: ChatMessage) => m.role === 'user').length;
          const lastAssistant = [...parsed].reverse().find((m: ChatMessage) => m.role === 'assistant');
          if (lastAssistant && isAssistantCompletionReply(lastAssistant.content)) {
            return true;
          }
          const savedReady = localStorage.getItem('llm5_chat_is_ready') === 'true';
          if (savedReady && uCount >= 6) return true;
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
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    if (lastAssistant && isAssistantCompletionReply(lastAssistant.content)) {
      setIsReady(true);
    }
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
  // 対話セクションの進捗（0%〜100%：完了時に100%、対話中は最大8ターン基準で最大92%までスムーズに進行）
  const progressPercent = isReady
    ? 100
    : Math.min(92, Math.round((userTurns / 7) * 88));

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
        let streamError: string | null = null;

        const processSseLine = (line: string) => {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) return;

          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') return;

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
              streamError = event.error || 'ストリーム通信エラーが発生しました';
            }
          } catch (err: any) {
            if (err.message && !err.message.includes('JSON')) {
              console.warn('SSE event error:', err);
            }
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            // 残存バッファの完全フラッシュ処理（doneイベントやreadyFlagFromServerの欠落を防止）
            if (buffer.trim()) {
              const remainingLines = buffer.split('\n');
              for (const line of remainingLines) {
                processSseLine(line);
              }
            }
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            processSseLine(line);
          }
          if (streamError) break;
        }

        if (streamError) {
          throw new Error(streamError);
        }

        let finalReply = sanitizeMessage(accumulatedText);
        if (!finalReply) {
          finalReply = 'お答えいただきありがとうございます！\n少し場面を変えて、例えば最近、友人や誰かと何かを一緒に決めたり話したりした時の出来事について伺えますか？その時、具体的にどんな状況でしたか？';
        } else if (!readyFlagFromServer && !isAssistantCompletionReply(finalReply) && !finalReply.includes('？') && !finalReply.includes('?')) {
          finalReply += '\n\nちなみに、最近の学校や日常の生活の中で、誰かと一緒に何かをしたり話したりした場面は何かありましたか？';
        }

        setMessages([...newMessages, { role: 'assistant', content: finalReply }]);
        setStreamingText('');

        // サーバー側の準備完了フラグ（readyFlagFromServer）または完了発話判定を最優先
        if (
          readyFlagFromServer ||
          isAssistantCompletionReply(finalReply) ||
          nextUserTurns >= 8
        ) {
          setIsReady(true);
        }
      } else {
        const data: any = await res.json();
        let cleanReply = sanitizeMessage(data.response);
        if (!cleanReply) {
          cleanReply = 'お答えいただきありがとうございます！\n少し場面を変えて、例えば最近、友人や誰かと何かを一緒に決めたり話したりした時の出来事について伺えますか？その時、具体的にどんな状況でしたか？';
        } else if (!data.is_ready_for_analysis && !isAssistantCompletionReply(cleanReply) && !cleanReply.includes('？') && !cleanReply.includes('?')) {
          cleanReply += '\n\nちなみに、最近の学校や日常の生活の中で、誰かと一緒に何かをしたり話したりした場面は何かありましたか？';
        }

        setMessages([...newMessages, { role: 'assistant', content: cleanReply }]);
        if (
          data.is_ready_for_analysis ||
          isAssistantCompletionReply(cleanReply) ||
          nextUserTurns >= 8
        ) {
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
      {/* 操作バー（ヘッダー・進捗バーを全廃し、やり直し＆スキップボタンをコンパクトに横並び配置） */}
      {(onReset || onSkipToSurvey || onSkipToResult) && (
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          backgroundColor: '#f7f9fa',
          borderBottom: '1px solid #e2e6eb',
          flexShrink: 0,
          flexWrap: 'wrap'
        }}>
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: '#ffffff',
                border: '1px solid #b8c2cc',
                color: '#5c6878',
                fontSize: '0.72rem',
                fontWeight: 500,
                padding: '3px 8px',
                borderRadius: '3px',
                cursor: 'pointer'
              }}
            >
              <RotateCcw size={11} />
              <span>最初からやり直す</span>
            </button>
          )}
          {onSkipToSurvey && (
            <button
              type="button"
              onClick={onSkipToSurvey}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #b8c2cc',
                color: '#1b365d',
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '3px 8px',
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
                color: '#1b365d',
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: '3px',
                cursor: 'pointer'
              }}
            >
              結果へスキップ
            </button>
          )}
        </div>
      )}

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
            placeholder="こちらに回答を入力してください..."
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
