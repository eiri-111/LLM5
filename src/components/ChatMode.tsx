import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Eye } from 'lucide-react';
import { ChatMessage, AnalysisResult, UserProfile } from '../types';
import { User, Edit3 } from 'lucide-react';

interface ChatModeProps {
  userProfile: UserProfile | null;
  onEditProfile?: () => void;
  onStartSurvey: (messages: ChatMessage[]) => void;
  showToast: (msg: string) => void;
  onShowSample?: () => void;
}

const GREETING_PRESETS: string[] = [
  "こんにちは！何気ない会話から、あなたの性格を精密に診断しますね。\n\nテストではないので、リラックスしてお話ししましょう！\nまずは診断の土台として、あなたが普段【一番時間やエネルギーを使っていること】を教えていただけますか？（お仕事、学校・サークル、夢中になっている趣味、資格の勉強など、何でも大丈夫です！）",
  "こんにちは！AIとの自然なおしゃべりを通して、あなたのパーソナリティを分析します。\n\nお友達とLINEするような気軽な感覚でお答えくださいね。\nはじめに、あなたが今【多くの時間を注いでいることや、日頃熱中していること】は何ですか？（お仕事や学生生活、没頭している趣味や創作など、思いつくまま教えてください！）"
];

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
  onEditProfile,
  onStartSurvey,
  showToast,
  onShowSample
}) => {
  const [initialGreeting] = useState<string>(() => {
    const idx = Math.floor(Math.random() * GREETING_PRESETS.length);
    return GREETING_PRESETS[idx];
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { role: 'assistant', content: initialGreeting }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [isReady, setIsReady] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, streamingText]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || isLoading) return;

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
      <header className="chat-header">
        <div className="chat-header-title">
          <span className="chat-app-name">LLM5</span>
          {userProfile && (
            <div className="chat-user-badge" onClick={onEditProfile} title="学籍番号を変更">
              <User size={13} />
              <span>{userProfile.student_id}</span>
              {onEditProfile && <Edit3 size={11} className="badge-edit-icon" />}
            </div>
          )}
        </div>
        {onShowSample && (
          <button 
            type="button" 
            onClick={onShowSample} 
            className="btn-sample-preview"
            title="分析結果のサンプルを表示"
          >
            <Eye size={15} />
            <span>結果サンプル</span>
          </button>
        )}
      </header>

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
        <form onSubmit={handleSend} style={{ display: 'flex', gap: 8 }}>
          <textarea
            ref={inputRef}
            className="chat-input-textarea"
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="メッセージを入力..."
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
