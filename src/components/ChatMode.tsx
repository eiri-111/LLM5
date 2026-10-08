import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { ChatMessage, AnalysisResult, UserProfile } from '../types';

interface ChatModeProps {
  userProfile: UserProfile | null;
  onUpdateProfile?: (profile: Partial<UserProfile>) => void;
  onStartSurvey: (messages: ChatMessage[]) => void;
  showToast: (msg: string) => void;
}

type OnboardingStep = 'age' | 'gender' | 'completed';

const INITIAL_GREETING =
  "こんにちは！AIとの自然な会話を通して、あなたのパーソナリティを精密に診断しますね。\n\nテストではないので、リラックスしてお話ししましょう！\nまずははじめに、あなたの【ご年齢】（または年代）を教えていただけますか？";

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
  onUpdateProfile,
  onStartSurvey,
  showToast,
}) => {
  // オンボーディング進行状況の復元
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>(() => {
    try {
      const saved = localStorage.getItem('llm5_onboarding_step') as OnboardingStep;
      if (saved && ['age', 'gender', 'completed'].includes(saved)) {
        return saved;
      }
      const savedMessages = localStorage.getItem('llm5_chat_messages');
      if (savedMessages) {
        const parsed = JSON.parse(savedMessages);
        if (Array.isArray(parsed)) {
          if (parsed.length >= 4) return 'completed';
          if (parsed.length >= 2) return 'gender';
        }
      }
    } catch (_) {}
    return 'age';
  });

  // 会話履歴の復元
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

  // 分析可能フラグの復元
  const [isReady, setIsReady] = useState<boolean>(() => {
    try {
      return localStorage.getItem('llm5_chat_is_ready') === 'true';
    } catch (_) {}
    return false;
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 会話履歴の自動保存
  useEffect(() => {
    try {
      localStorage.setItem('llm5_chat_messages', JSON.stringify(messages));
    } catch (_) {}
  }, [messages]);

  // オンボーディング進行状況の自動保存
  useEffect(() => {
    try {
      localStorage.setItem('llm5_onboarding_step', onboardingStep);
    } catch (_) {}
  }, [onboardingStep]);

  // 診断準備完了フラグの自動保存
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


  // 性別選択ボタン押下時
  const handleSelectGender = (genderLabel: string) => {
    if (isLoading) return;
    processGenderInput(genderLabel);
  };

  const processGenderInput = (text: string) => {
    let genderKey = 'other';
    if (text.includes('男')) genderKey = 'male';
    else if (text.includes('女')) genderKey = 'female';
    else if (text.includes('回答しない') || text.includes('答えたくない') || text.includes('無回答')) genderKey = 'prefer_not_to_say';
    
    onUpdateProfile?.({ gender: genderKey });

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setInputText('');
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content:
            "お答えいただきありがとうございます！\n\nそれでは診断を始めていきますね。お友達とLINEするような気軽な感覚でお答えください。\nまずは普段、あなたが【一番時間やエネルギーを使っていること】（お仕事や学業、夢中になっている趣味など）を教えていただけますか？"
        }
      ]);
      setOnboardingStep('completed');
    }, 450);
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || isLoading) return;

    // 1. 年齢の入力フェーズ
    if (onboardingStep === 'age') {
      const matchNum = text.match(/\d+/);
      const parsedAge = matchNum ? parseInt(matchNum[0], 10) : text;
      onUpdateProfile?.({ age: parsedAge });

      const newMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
      setMessages(newMessages);
      setInputText('');
      setIsLoading(true);

      setTimeout(() => {
        setIsLoading(false);
        setMessages([
          ...newMessages,
          {
            role: 'assistant',
            content: "ありがとうございます！\n\n次に、差し支えなければ【性別】を教えていただけますか？"
          }
        ]);
        setOnboardingStep('gender');
      }, 450);
      return;
    }

    // 2. 性別の入力フェーズ（手入力された場合）
    if (onboardingStep === 'gender') {
      processGenderInput(text);
      return;
    }

    // 3. 通常のAI対話フェーズ
    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
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
          user_input: text
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

      // SSEストリーミング対応
      if (contentType.includes('text/event-stream') && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = '';
        let buffer = '';

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
              } else if (event.type === 'done' || event.type === 'meta') {
                if (event.is_ready_for_analysis) {
                  setIsReady(true);
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

        const finalReply = sanitizeMessage(accumulatedText) || 'お答えいただきありがとうございます！';
        setMessages([...newMessages, { role: 'assistant', content: finalReply }]);
        setStreamingText('');
      } else {
        // フォールバック（JSONレスポンス）
        const data: any = await res.json();
        const cleanReply = sanitizeMessage(data.response);
        setMessages([...newMessages, { role: 'assistant', content: cleanReply }]);
        if (data.is_ready_for_analysis) {
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
      <div className="chat-scroll-area" ref={scrollRef}>
        {messages.map((m, idx) => (
          <div key={idx} className={`chat-bubble ${m.role === 'user' ? 'user' : 'assistant'}`}>
            {sanitizeMessage(m.content)}
          </div>
        ))}
        {streamingText && (
          <div className="chat-bubble assistant">
            {sanitizeMessage(streamingText)}
            <span className="typing-cursor"></span>
          </div>
        )}
        {isLoading && !streamingText && (
          <div className="chat-bubble assistant" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>考え中...</span>
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
            <Sparkles size={18} />
            <span>質問紙（アンケート）に回答して総合診断へ進む</span>
          </button>
        )}
        {onboardingStep === 'gender' && (
          <div className="gender-chips-wrapper" style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
            {['男性', '女性', 'その他', '回答しない'].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => handleSelectGender(g)}
                disabled={isLoading}
                style={{
                  padding: '6px 14px',
                  borderRadius: '9999px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#1e293b',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'all 0.15s ease'
                }}
              >
                {g}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSend} style={{ display: 'flex', gap: 8 }}>
          <textarea
            ref={inputRef}
            className="chat-input-textarea"
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              onboardingStep === 'age'
                ? "ご年齢を入力（例: 21歳、20代）..."
                : onboardingStep === 'gender'
                ? "性別を入力（上のボタンまたは手入力）..."
                : "メッセージを入力..."
            }
            disabled={isLoading}
          />
          <button 
            type="submit" 
            className="chat-send-btn" 
            disabled={isLoading || !inputText.trim()}
            aria-label="送信"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};
