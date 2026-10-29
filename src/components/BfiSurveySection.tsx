import React, { useState, useEffect, useMemo } from 'react';
import { ArrowRight, ArrowLeft, RotateCcw } from 'lucide-react';
import { SurveyResult } from '../types';
import { BFI_2_S_CONFIG, calculateBfiScores, calculateBfiFacetScores } from '../data/bfi2s';
import {
  SOCIAL_DESIRABILITY_CONFIG,
  calculateSocialDesirabilityScore
} from '../data/additionalScales';

interface BfiSurveySectionProps {
  onCompleteSurvey: (result: SurveyResult) => void;
  onSkipToResult?: () => void;
  onBackToChat?: () => void;
  onReset?: () => void;
  showToast: (msg: string) => void;
}

export interface UnifiedSurveyQuestion {
  id: number;
  text: string;
  scaleType: 'bfi' | 'social_desirability';
  concept?: string;
  promptPrefix?: string;
}

const SCALE_LABELS = [
  { value: 1, label: '全くあてはまらない' },
  { value: 2, label: 'あまりあてはまらない' },
  { value: 3, label: 'どちらともいえない' },
  { value: 4, label: 'ややあてはまる' },
  { value: 5, label: 'とてもよくあてはまる' }
];

export const BfiSurveySection: React.FC<BfiSurveySectionProps> = ({
  onCompleteSurvey,
  onSkipToResult,
  onBackToChat,
  onReset,
  showToast
}) => {
  const [answers, setAnswers] = useState<Record<number, number>>(() => {
    try {
      const saved = localStorage.getItem('llm5_survey_answers') || localStorage.getItem('llm5_bfi_answers');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {};
  });

  const [currentPage, setCurrentPage] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // 全40問の設問リストを構築
  const allQuestions: UnifiedSurveyQuestion[] = useMemo(() => {
    const list: UnifiedSurveyQuestion[] = [];
    // 1. BFI-2-S (Q1〜Q30)
    BFI_2_S_CONFIG.questions.forEach(q => {
      list.push({
        id: q.id,
        text: q.text,
        scaleType: 'bfi',
        concept: q.facet,
        promptPrefix: '私は普段、'
      });
    });
    // 2. 社会的望ましさ尺度 (Q31〜Q40)
    SOCIAL_DESIRABILITY_CONFIG.questions.forEach(q => {
      list.push({
        id: q.id,
        text: q.text,
        scaleType: 'social_desirability',
        concept: q.conceptLabel
      });
    });
    return list;
  }, []);

  const totalQuestions = allQuestions.length; // 40問

  // ページごとの設問分割 (各10問 x 4ページ)
  // ページ0: BFI Q1-10
  // ページ1: BFI Q11-20
  // ページ2: BFI Q21-30
  // ページ3: 社会的望ましさ Q31-40
  const totalPages = 4;

  const currentQuestions = useMemo(() => {
    const start = currentPage * 10;
    return allQuestions.slice(start, start + 10);
  }, [allQuestions, currentPage]);

  const answeredCount = Object.keys(answers).length;

  const isCurrentPageComplete = currentQuestions.every(q => typeof answers[q.id] === 'number');
  const isAllAnswered = answeredCount === totalQuestions;


  // ページ切り替え時に最上部へスクロール
  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const scrollToTop = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      const appContainer = document.querySelector('.app-container');
      if (appContainer) appContainer.scrollTop = 0;
      const mainContent = document.querySelector('.main-content');
      if (mainContent) mainContent.scrollTop = 0;
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
        localStorage.setItem('llm5_survey_answers', JSON.stringify(updated));
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

  const buildSurveyResult = (ans: Record<number, number>): SurveyResult => {
    const scores = calculateBfiScores(ans);
    const facetScores = calculateBfiFacetScores(ans);
    const socialDesirability = calculateSocialDesirabilityScore(ans);
    const completedAt = new Date().toISOString();

    return {
      scaleType: 'bfi-2-s_sds',
      scaleName: 'BFI-2-S / 社会的望ましさ (MCSDS)',
      rawAnswers: ans,
      scores,
      facetScores,
      socialDesirability,
      completedAt
    };
  };

  const handleSubmit = () => {
    if (!isAllAnswered) {
      showToast(`未回答の設問があります（残り ${totalQuestions - answeredCount}問）`);
      return;
    }

    setIsSubmitting(true);
    showToast('回答データを送信し、分析結果を照合しています...');

    try {
      const surveyResult = buildSurveyResult(answers);

      try {
        localStorage.removeItem('llm5_survey_answers');
        localStorage.removeItem('llm5_bfi_answers');
      } catch (_) {}

      onCompleteSurvey(surveyResult);
    } catch (err: any) {
      console.error('質問紙集計エラー:', err);
      showToast('集計中にエラーが発生しました');
      setIsSubmitting(false);
    }
  };

  const handleAutoFillSample = () => {
    const sampleAnswers: Record<number, number> = {};
    allQuestions.forEach((q) => {
      const val = Math.floor(Math.random() * 3) + 2; // 2〜4
      sampleAnswers[q.id] = val;
    });
    setAnswers(sampleAnswers);
    try {
      localStorage.setItem('llm5_survey_answers', JSON.stringify(sampleAnswers));
      localStorage.setItem('llm5_bfi_answers', JSON.stringify(sampleAnswers));
    } catch (_) {}
    showToast('全40問にテスト回答を入力しました');
  };

  const handleSkipDirectlyToResult = () => {
    if (onSkipToResult) {
      onSkipToResult();
      return;
    }
    const sampleAnswers: Record<number, number> = {};
    allQuestions.forEach((q) => {
      sampleAnswers[q.id] = Math.floor(Math.random() * 3) + 2;
    });
    setAnswers(sampleAnswers);
    const surveyResult = buildSurveyResult(sampleAnswers);
    onCompleteSurvey(surveyResult);
  };

  return (
    <div className="qualtrics-sheet">
      {/* Survey Body */}
      <div style={{ padding: '1.5rem 1.5rem 2rem' }}>
        {/* Simple Top Bar (対話画面同様のすっきりした案内と補助ボタン) */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          paddingBottom: '0.85rem',
          marginBottom: '0.85rem',
          borderBottom: '1px solid #eef2f6'
        }}>
          <p style={{
            fontSize: '0.82rem',
            color: '#5c6878',
            margin: 0,
            lineHeight: 1.4
          }}>
            各設問について、直感で当てはまる選択肢をお選びください。
          </p>

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
                <span>やり直す</span>
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
              テスト入力
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

        {/* Questions List */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {currentQuestions.map((q) => {
            const selectedValue = answers[q.id];

            return (
              <div
                key={q.id}
                style={{
                  padding: '1.25rem 0',
                  borderBottom: '1px solid #e5e8ec'
                }}
              >
                {/* Question Prompt */}
                <div style={{
                  fontSize: '0.94rem',
                  fontWeight: 600,
                  color: '#1b2432',
                  lineHeight: 1.5,
                  marginBottom: '0.85rem'
                }}>
                  <span style={{ color: '#007ac0', fontWeight: 700, marginRight: '6px' }}>
                    Q{q.id}.
                  </span>
                  {q.promptPrefix && <span>{q.promptPrefix}</span>}
                  <strong>{q.text}</strong> <span style={{ color: '#d93025' }}>*</span>
                </div>

                {/* Qualtrics 5-Point Choice Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: '6px'
                }}>
                  {SCALE_LABELS.map((opt) => {
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
                          fontSize: '0.72rem',
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
              <span>次へ ({currentPage + 1}/{totalPages})</span>
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!isAllAnswered || isSubmitting}
              className="qualtrics-nav-btn"
            >
              <span>{isSubmitting ? '集計・照合中...' : '全40問回答完了・結果を見る'}</span>
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
