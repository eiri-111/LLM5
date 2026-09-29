import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Bot } from 'lucide-react';
import { ChatMessage, AnalysisResult } from '../types';

interface ChatModeProps {
  onAnalysisComplete: (result: AnalysisResult) => void;
  showToast: (msg: string) => void;
}

const INITIAL_GREETING = 
  "こんにちは！AIパーソナリティ分析官の「Dr. OCEAN」です。心理学のビッグファイブ理論に基づいて、あなたの隠れた強みや行動パターンをプロファイリングします。\n\n" +
  "まずはリラックスして、あなたの日常について少し教えてください。\n" +
  "休日は普段どのように過ごされることが多いですか？また、最近夢中になっていることやワクワクした体験はありますか？";

export const ChatMode: React.FC<ChatModeProps> = ({ onAnalysisComplete, showToast }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: INITIAL_GREETING }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [isReady, setIsReady] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || isLoading) return;

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setInputText('');
    setIsLoading(true);

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
        const err: any = await res.json();
        throw new Error(err.error || err.detail || 'メッセージの送信に失敗しました');
      }

      const data: any = await res.json();
      setMessages([...newMessages, { role: 'assistant', content: data.response }]);
      setQuestionCount(data.question_count || questionCount + 1);
      if (data.is_ready_for_analysis) {
        setIsReady(true);
      }
    } catch (err: any) {
      console.error(err);
      showToast(`エラー: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'chat',
          messages: messages
        })
      });

      if (!res.ok) {
        const err: any = await res.json();
        throw new Error(err.error || err.detail || '性格分析に失敗しました');
      }

      const result: AnalysisResult = await res.json();
      onAnalysisComplete(result);
    } catch (err: any) {
      console.error(err);
      showToast(`分析エラー: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="glass-panel chat-wrapper">
      <div className="chat-status-bar">
        <div className="counselor-info">
          <div className="counselor-avatar">
            <Bot size={18} />
          </div>
          <div>
            <div className="counselor-name">Dr. OCEAN</div>
          </div>
        </div>
        <div className="chat-progress-chip">
          対話進度: {questionCount} / 4
        </div>
      </div>

      <div className="chat-scroll-area" ref={scrollRef}>
        {messages.map((m, idx) => (
          <div key={idx} className={`chat-bubble ${m.role === 'user' ? 'user' : 'assistant'}`}>
            {m.content}
          </div>
        ))}
        {isLoading && (
          <div className="chat-bubble assistant" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Dr. OCEANが考え中...</span>
          </div>
        )}
      </div>

      <div className="chat-input-bar">
        <div style={{ flex: 1 }}>
          {isReady && (
            <button 
              onClick={handleAnalyze} 
              disabled={isAnalyzing} 
              className="btn-analyze-ready"
            >
              <Sparkles size={18} />
              {isAnalyzing ? '分析中...' : '性格分析レポートを生成する'}
            </button>
          )}
          <form onSubmit={handleSend} style={{ display: 'flex', gap: 6, marginTop: isReady ? 6 : 0 }}>
            <textarea
              ref={inputRef}
              className="chat-input-textarea"
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="メッセージを入力..."
              disabled={isLoading || isAnalyzing}
            />
            <button 
              type="submit" 
              className="chat-send-btn" 
              disabled={isLoading || isAnalyzing || !inputText.trim()}
              aria-label="送信"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
