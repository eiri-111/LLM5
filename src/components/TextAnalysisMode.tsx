import React, { useState } from 'react';
import { Sparkles, FileText } from 'lucide-react';
import { AnalysisResult } from '../types';

interface TextAnalysisModeProps {
  onAnalysisComplete: (result: AnalysisResult) => void;
  showToast: (msg: string) => void;
}

const SAMPLE_TEXT = `休日は新しいカフェを開拓して、技術書や心理学の本を読んだり、個人開発のコードを書いたりして過ごすのが一番の息抜きです。
仕事ではチームの進捗やコミュニケーションの風通しを良くすることを意識しており、何か課題が起きた時は感情的にならずに原因を整理して解決策を提案するようにしています。
友人からは「好奇心旺盛で行動力があるけれど、たまに熱中しすぎて周りが見えなくなることがある」とよく言われます。`;

export const TextAnalysisMode: React.FC<TextAnalysisModeProps> = ({ onAnalysisComplete, showToast }) => {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUseSample = () => {
    setText(SAMPLE_TEXT);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim().length < 20) {
      showToast('20文字以上の文章を入力してください');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'text',
          direct_text: text
        })
      });

      if (!res.ok) {
        const err: any = await res.json();
        throw new Error(err.error || err.detail || '文章分析に失敗しました');
      }

      const result: AnalysisResult = await res.json();
      onAnalysisComplete(result);
    } catch (err: any) {
      console.error(err);
      showToast(`分析エラー: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="glass-panel text-analysis-container">
      <div className="instruction-box">
        <h2 className="instruction-title">文章・テキスト一発診断</h2>
        <p className="instruction-desc">
          あなた自身が書いた文章（日記、SNS投稿、自己紹介文、志望動機など）を貼り付けると、AIが文体や心理的傾向からビッグファイブ特性を解読します。
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
        <button
          type="button"
          onClick={handleUseSample}
          style={{
            background: 'none',
            border: 'none',
            color: '#06b6d4',
            fontSize: '0.78rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          <FileText size={13} />
          例文を入力する
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <textarea
          className="text-analysis-area"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="あなたの文章をここに貼り付けてください...（例: 普段考えていること、休日の過ごし方、仕事への姿勢、好きなこと、SNSの投稿まとめなど）"
          disabled={isSubmitting}
        />

        <div className="char-counter">
          現在の文字数: {text.trim().length} 文字 (推奨: 50文字以上)
        </div>

        <button
          type="submit"
          disabled={text.trim().length < 20 || isSubmitting}
          className="btn-submit-main"
        >
          <Sparkles size={18} />
          {isSubmitting ? 'AIが深層心理を分析中...' : 'この文章から性格を診断する'}
        </button>
      </form>
    </div>
  );
};
