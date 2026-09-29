import React, { useState, useEffect } from 'react';
import { Sparkles, CheckCircle2 } from 'lucide-react';
import { Question, AnalysisResult } from '../types';

interface QuestionnaireModeProps {
  onAnalysisComplete: (result: AnalysisResult) => void;
  showToast: (msg: string) => void;
}

const SCALE_LABELS = [
  '全く違う',
  '少し違う',
  'どちらでもない',
  '少しそう',
  'まさにそう'
];

export const QuestionnaireMode: React.FC<QuestionnaireModeProps> = ({ onAnalysisComplete, showToast }) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [freeTextPrompt, setFreeTextPrompt] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [freeText, setFreeText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/questions')
      .then(res => res.json() as Promise<any>)
      .then(data => {
        setQuestions(data.questions || []);
        setFreeTextPrompt(data.free_text_prompt || null);
        setIsLoading(false);
      })
      .catch(err => {
        console.error(err);
        showToast('設問データの取得に失敗しました');
        setIsLoading(false);
      });
  }, []);

  const handleSelectScore = (questionId: number, score: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: score }));
  };

  const answeredCount = Object.keys(answers).length;
  const isAllAnswered = questions.length > 0 && answeredCount === questions.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAllAnswered) {
      showToast('すべての設問にお答えください');
      return;
    }

    setIsSubmitting(true);
    const answersList = Object.entries(answers).map(([qid, sc]) => ({
      question_id: parseInt(qid, 10),
      score: sc
    }));

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'questionnaire',
          answers: answersList,
          free_text: freeText
        })
      });

      if (!res.ok) {
        const err: any = await res.json();
        throw new Error(err.error || err.detail || '設問分析に失敗しました');
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

  if (isLoading) {
    return (
      <div className="glass-panel loading-view">
        <div className="spinner-ring"></div>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>設問を読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="glass-panel questionnaire-container">
      <div style={{ marginBottom: '1.2rem', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.3rem' }}>
          ビッグファイブ標準設問
        </h2>
        <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
          直感であなた自身の普段の傾向に最も近い選択肢をタップしてください。
        </p>
        <div style={{ marginTop: '0.6rem', fontSize: '0.78rem', color: '#06b6d4', fontWeight: 600 }}>
          回答進度: {answeredCount} / {questions.length} 問
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {questions.map((q, idx) => {
          const selected = answers[q.id];
          return (
            <div key={q.id} className="question-card">
              <div className="question-title-row">
                <span className="q-badge">Q{idx + 1}</span>
                <span className="q-text">{q.text}</span>
              </div>
              <div className="scale-buttons">
                {[1, 2, 3, 4, 5].map(val => (
                  <button
                    type="button"
                    key={val}
                    className={`scale-btn ${selected === val ? 'selected' : ''}`}
                    onClick={() => handleSelectScore(q.id, val)}
                  >
                    <span className="scale-num">{val}</span>
                    <span>{SCALE_LABELS[val - 1]}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {/* Free Text Input */}
        <div className="question-card" style={{ borderStyle: 'dashed' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 700 }}>🖋️ 自由記述</span>
            <span style={{ fontSize: '0.65rem', background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4', padding: '1px 6px', borderRadius: 99 }}>
              任意・精度向上
            </span>
          </div>
          <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: 8 }}>
            休日の過ごし方や、大切にしている信条、熱中していることなどをご自由に入力してください。
          </p>
          <textarea
            className="text-analysis-area"
            style={{ minHeight: '90px' }}
            rows={3}
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder={freeTextPrompt?.placeholder || '例：休日は一人でカフェに行って本を読んだり、新しいアプリを作ったりするのが好きです。'}
          />
        </div>

        <button 
          type="submit" 
          disabled={!isAllAnswered || isSubmitting} 
          className="btn-submit-main"
        >
          <Sparkles size={18} />
          {isSubmitting ? '性格分析中...' : '診断結果を見る'}
        </button>
      </form>
    </div>
  );
};
