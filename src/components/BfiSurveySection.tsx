import React, { useState, useEffect } from 'react';
import { ArrowRight, ArrowLeft, RotateCcw } from 'lucide-react';
import { SurveyResult } from '../types';
import { BFI_2_S_CONFIG, calculateBfiScores, calculateBfiFacetScores } from '../data/bfi2s';

interface BfiSurveySectionProps {
  onCompleteSurvey: (result: SurveyResult) => void;
  onSkipToResult?: () => void;
  onBackToChat?: () => void;
  onReset?: () => void;
  showToast: (msg: string) => void;
}

const QUESTIONS_PER_PAGE = 8;

export const BfiSurveySection: React.FC<BfiSurveySectionProps> = ({
  onCompleteSurvey,
  onSkipToResult,
  onBackToChat,
  onReset,
  showToast
}) => {
  const [answers, setAnswers] = useState<Record<number, number>>(() => {
    try {
      const saved = localStorage.getItem('llm5_bfi_answers');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {};
  });

  const [currentPage, setCurrentPage] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const questions = BFI_2_S_CONFIG.questions;
  const totalQuestions = questions.length;
  const totalPages = Math.ceil(totalQuestions / QUESTIONS_PER_PAGE);

  const answeredCount = Object.keys(answers).length;
  // 全体進捗バー（後半50%〜100%として表現、または質問紙単体0〜100%）
  const surveyProgressPercent = Math.round((answeredCount / totalQuestions) * 100);

  const startIndex = currentPage * QUESTIONS_PER_PAGE;
  const currentQuestions = questions.slice(startIndex, startIndex + QUESTIONS_PER_PAGE);

  const isCurrentPageComplete = currentQuestions.every(q => typeof answers[q.id] === 'number');
  const isAllAnswered = answeredCount === totalQuestions;

  // ページ切り替え時に確実に画面最上部へスクロール
  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const scrollToTop = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      const appContainer = document.querySelector('.app-container');
      if (appContainer) {
        appContainer.scrollTop = 0;
      }
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        mainContent.scrollTop = 0;
      }
    };
    scrollToTop();
    const rafId = requestAnimationFrame(scrollToTop);
    const timerId = window.setTimeout(scrollToTop, 50);
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
    };
  }, [currentPage]);

  const handleSelectAnswer = (questionId: number, value: number) => {
    setAnswers((prev) => {
      const updated = { ...prev, [questionId]: value };
      try {
        localStorage.setItem('llm5_bfi_answers', JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  };

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const handleSubmit = () => {
    if (!isAllAnswered) {
      showToast(`未回答の設問があります（残り ${totalQuestions - answeredCount}問）`);
      return;
    }

    setIsSubmitting(true);
    showToast('回答データを送信し、分析結果を照合しています...');

    try {
      const scores = calculateBfiScores(answers);
      const facetScores = calculateBfiFacetScores(answers);
      const completedAt = new Date().toISOString();

      const surveyResult: SurveyResult = {
        scaleType: 'bfi-2-s',
        scaleName: BFI_2_S_CONFIG.name,
        rawAnswers: answers,
        scores,
        facetScores,
        completedAt
      };

      try {
        localStorage.removeItem('llm5_bfi_answers');
      } catch (_) {}

      onCompleteSurvey(surveyResult);
    } catch (err: any) {
      console.error('BFI-2-S 集計エラー:', err);
      showToast('集計中にエラーが発生しました');
      setIsSubmitting(false);
    }
  };

  const handleAutoFillSample = () => {
    const sampleAnswers: Record<number, number> = {};
    questions.forEach((q) => {
      const val = Math.floor(Math.random() * 3) + 2;
      sampleAnswers[q.id] = val;
    });
    setAnswers(sampleAnswers);
    try {
      localStorage.setItem('llm5_bfi_answers', JSON.stringify(sampleAnswers));
    } catch (_) {}
    showToast('すべての設問にテスト回答を入力しました');
  };

  const handleSkipDirectlyToResult = () => {
    if (onSkipToResult) {
      onSkipToResult();
      return;
    }
    const sampleAnswers: Record<number, number> = {};
    questions.forEach((q) => {
      sampleAnswers[q.id] = Math.floor(Math.random() * 3) + 2;
    });
    setAnswers(sampleAnswers);
    const scores = calculateBfiScores(sampleAnswers);
    const facetScores = calculateBfiFacetScores(sampleAnswers);
    const surveyResult: SurveyResult = {
      scaleType: 'bfi-2-s',
      scaleName: BFI_2_S_CONFIG.name,
      rawAnswers: sampleAnswers,
      scores,
      facetScores,
      completedAt: new Date().toISOString()
    };
    onCompleteSurvey(surveyResult);
  };

  return (
    <div className="qualtrics-sheet">
      {/* Qualtrics Top Progress Bar */}
      <div className="qualtrics-progress-bar-wrap">
        <div className="qualtrics-progress-row">
          <span className="qualtrics-progress-pct">0%</span>
          <div className="qualtrics-progress-track">
            <div className="qualtrics-progress-fill" style={{ width: `${surveyProgressPercent}%` }} />
          </div>
          <span className="qualtrics-progress-pct">100%</span>
        </div>
        <div style={{ textAlign: 'center', fontSize: '0.72rem', color: '#5c6878', marginTop: '4px' }}>
          質問紙の回答進捗: {answeredCount} / {totalQuestions} 問完了 ({surveyProgressPercent}%) — ページ {currentPage + 1} / {totalPages}
        </div>
      </div>

      {/* Survey Body */}
      <div style={{ padding: '1.5rem 1.5rem 2rem' }}>
        {/* Instruction Block */}
        <div style={{
          paddingBottom: '1.25rem',
          marginBottom: '1.25rem',
          borderBottom: '1px solid #d8dde6'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '0.5rem' }}>
            <h1 style={{
              fontSize: '1.1rem',
              fontWeight: 700,
              color: '#1b2432'
            }}>
              設問ブロック 2: 自己認識に関する質問（BFI-2-S）
            </h1>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {onReset && (
                <button
                  type="button"
                  onClick={onReset}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #b8c2cc',
                    borderRadius: '3px',
                    color: '#5c6878',
                    cursor: 'pointer',
                    padding: '3px 8px',
                    fontSize: '0.72rem',
                    fontWeight: 500,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <RotateCcw size={11} />
                  <span>最初からやり直す</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleAutoFillSample}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #b8c2cc',
                  borderRadius: '3px',
                  color: '#333e4f',
                  cursor: 'pointer',
                  padding: '3px 8px',
                  fontSize: '0.72rem',
                  fontWeight: 500
                }}
              >
                テスト自動入力
              </button>
              <button
                type="button"
                onClick={handleSkipDirectlyToResult}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #b8c2cc',
                  borderRadius: '3px',
                  color: '#333e4f',
                  cursor: 'pointer',
                  padding: '3px 8px',
                  fontSize: '0.72rem',
                  fontWeight: 500
                }}
              >
                結果へスキップ
              </button>
            </div>
          </div>

          <p style={{
            fontSize: '0.88rem',
            color: '#333e4f',
            lineHeight: 1.65,
            backgroundColor: '#f7f9fa',
            padding: '0.75rem 1rem',
            borderLeft: '3px solid #007ac0',
            borderRadius: '2px'
          }}>
            ここには、あなた自身に当てはまるかもしれない、あるいは当てはまらないかもしれない特徴が並んでいます。それぞれの項目について、<strong>「私は普段、〜だと思う」</strong>という文にどの程度同意するか、最も当てはまる選択肢を1つ選んでください。
          </p>
        </div>

        {/* Questions List (Qualtrics Matrix / Multiple Choice Block Style) */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {currentQuestions.map((q) => {
            const selectedValue = answers[q.id];

            return (
              <div
                key={q.id}
                style={{
                  padding: '1.35rem 0',
                  borderBottom: '1px solid #e5e8ec'
                }}
              >
                {/* Question Prompt */}
                <div style={{
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  color: '#1b2432',
                  lineHeight: 1.5,
                  marginBottom: '0.9rem'
                }}>
                  <span style={{ color: '#007ac0', fontWeight: 700, marginRight: '6px' }}>
                    Q{q.id}.
                  </span>
                  私は普段、<strong>{q.text}</strong> <span style={{ color: '#d93025' }}>*</span>
                </div>

                {/* Qualtrics 5-Point Horizontal / Responsive Choice Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: '6px'
                }}>
                  {BFI_2_S_CONFIG.scaleLabels.map((opt) => {
                    const isSelected = selectedValue === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleSelectAnswer(q.id, opt.value)}
                        style={{
                          padding: '0.75rem 0.35rem',
                          borderRadius: '4px',
                          border: isSelected ? '1.5px solid #007ac0' : '1px solid #d8dde6',
                          backgroundColor: isSelected ? '#e8f3fa' : '#f7f9fa',
                          color: '#1b2432',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'flex-start',
                          gap: '6px',
                          cursor: 'pointer',
                          transition: 'background-color 0.12s ease, border-color 0.12s ease'
                        }}
                      >
                        {/* Qualtrics Radio Circle */}
                        <span style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          border: isSelected ? '5px solid #007ac0' : '1.5px solid #8c98a8',
                          backgroundColor: '#ffffff',
                          boxSizing: 'border-box',
                          flexShrink: 0
                        }} />
                        <span style={{
                          fontSize: '0.73rem',
                          fontWeight: isSelected ? 700 : 400,
                          color: isSelected ? '#005e94' : '#333e4f',
                          textAlign: 'center',
                          lineHeight: 1.3
                        }}>
                          {opt.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Qualtrics Bottom Navigation Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '1.75rem',
          paddingTop: '1rem'
        }}>
          {currentPage > 0 ? (
            <button
              type="button"
              onClick={handlePrevPage}
              className="qualtrics-nav-btn secondary"
            >
              <ArrowLeft size={16} />
              <span>前へ</span>
            </button>
          ) : onBackToChat ? (
            <button
              type="button"
              onClick={onBackToChat}
              className="qualtrics-nav-btn secondary"
            >
              <ArrowLeft size={16} />
              <span>対話へ戻る</span>
            </button>
          ) : (
            <div />
          )}

          {currentPage < totalPages - 1 ? (
            <button
              type="button"
              onClick={handleNextPage}
              disabled={!isCurrentPageComplete}
              className="qualtrics-nav-btn"
            >
              <span>次へ</span>
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!isAllAnswered || isSubmitting}
              className="qualtrics-nav-btn"
            >
              <span>{isSubmitting ? '集計・照合中...' : '回答を送信して結果を見る'}</span>
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
