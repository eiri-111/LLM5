import React, { useState } from 'react';
import { CheckCircle2, ChevronRight, ChevronLeft, Sparkles, Check, Wand2 } from 'lucide-react';
import { SurveyResult } from '../types';
import { BFI_2_S_CONFIG, calculateBfiScores } from '../data/bfi2s';

interface BfiSurveySectionProps {
  onCompleteSurvey: (result: SurveyResult) => void;
  onSkipToResult?: () => void;
  onBackToChat?: () => void;
  showToast: (msg: string) => void;
}

const QUESTIONS_PER_PAGE = 5;

export const BfiSurveySection: React.FC<BfiSurveySectionProps> = ({
  onCompleteSurvey,
  onSkipToResult,
  onBackToChat,
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
  const progressPercent = Math.round((answeredCount / totalQuestions) * 100);

  // 現在のページの質問リスト
  const startIndex = currentPage * QUESTIONS_PER_PAGE;
  const currentQuestions = questions.slice(startIndex, startIndex + QUESTIONS_PER_PAGE);

  // 現在のページがすべて回答済みか
  const isCurrentPageComplete = currentQuestions.every(q => typeof answers[q.id] === 'number');
  const isAllAnswered = answeredCount === totalQuestions;

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
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = () => {
    if (!isAllAnswered) {
      showToast(`未回答の設問があります（残り ${totalQuestions - answeredCount}問）`);
      return;
    }

    setIsSubmitting(true);
    showToast('BFI-2-Sスコアを集計し、AI対話分析と照合しています...');

    try {
      const scores = calculateBfiScores(answers);
      const completedAt = new Date().toISOString();

      const surveyResult: SurveyResult = {
        scaleType: 'bfi-2-s',
        scaleName: BFI_2_S_CONFIG.name,
        rawAnswers: answers,
        scores,
        completedAt,
        isQualtrics: false
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

  // テスト用自動入力
  const handleAutoFillSample = () => {
    const sampleAnswers: Record<number, number> = {};
    questions.forEach((q) => {
      const val = Math.floor(Math.random() * 3) + 2; // 2〜4
      sampleAnswers[q.id] = val;
    });
    setAnswers(sampleAnswers);
    try {
      localStorage.setItem('llm5_bfi_answers', JSON.stringify(sampleAnswers));
    } catch (_) {}
    showToast('すべての設問にサンプル回答を入力しました');
  };

  // 動作確認用: 結果画面へ直接スキップ
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
    const surveyResult: SurveyResult = {
      scaleType: 'bfi-2-s',
      scaleName: BFI_2_S_CONFIG.name,
      rawAnswers: sampleAnswers,
      scores,
      completedAt: new Date().toISOString(),
      isQualtrics: false
    };
    onCompleteSurvey(surveyResult);
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '0.5rem 0 2rem' }}>
      {/* 尺度ヘッダーカード */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        padding: '1.5rem',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)',
        marginBottom: '1.25rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 10px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(59, 130, 246, 0.08)',
              color: '#2563eb',
              fontSize: '0.72rem',
              fontWeight: 700
            }}>
              <Sparkles size={12} />
              心理尺度測定（BFI-2-S）
            </span>
            <span style={{
              fontSize: '0.72rem',
              color: '#64748b',
              fontWeight: 600
            }}>
              Part {currentPage + 1} / {totalPages}
            </span>
          </div>

          {/* 動作確認・テストボタン群 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
            <button
              type="button"
              onClick={handleAutoFillSample}
              title="テスト用自動入力"
              style={{
                backgroundColor: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                color: '#475569',
                cursor: 'pointer',
                padding: '4px 8px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.7rem',
                fontWeight: 600
              }}
            >
              <Wand2 size={12} />
              <span>自動入力</span>
            </button>

            <button
              type="button"
              onClick={handleSkipDirectlyToResult}
              title="結果画面へスキップ"
              style={{
                backgroundColor: '#f5f3ff',
                border: '1px solid #ddd6fe',
                borderRadius: '8px',
                color: '#6d28d9',
                cursor: 'pointer',
                padding: '4px 8px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.7rem',
                fontWeight: 600
              }}
            >
              <span>📊 結果へスキップ</span>
            </button>
          </div>
        </div>

        <h1 style={{
          fontSize: '1.15rem',
          fontWeight: 800,
          color: '#0f172a',
          letterSpacing: '-0.02em',
          marginBottom: '0.35rem'
        }}>
          自己認識アンケート
        </h1>
        <p style={{
          fontSize: '0.78rem',
          color: '#64748b',
          lineHeight: 1.5,
          marginBottom: '1rem'
        }}>
          あなた自身の普段の性格や傾向について、直感で当てはまる度合いを選んでください。
        </p>

        {/* 進捗バー */}
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: '#334155',
            marginBottom: '6px'
          }}>
            <span>全体の回答進捗</span>
            <span style={{ color: '#2563eb', fontFamily: 'monospace' }}>
              {answeredCount} / {totalQuestions}問 ({progressPercent}%)
            </span>
          </div>
          <div style={{
            width: '100%',
            height: '8px',
            backgroundColor: '#f1f5f9',
            borderRadius: '9999px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${progressPercent}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #3b82f6 0%, #6366f1 100%)',
              borderRadius: '9999px',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      </div>

      {/* 設問カードリスト（5問ずつ） */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.5rem' }}>
        {currentQuestions.map((q, idx) => {
          const selectedValue = answers[q.id];
          const isAnswered = typeof selectedValue === 'number';

          return (
            <div
              key={q.id}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '18px',
                padding: '1.1rem 1.2rem',
                border: isAnswered ? '1.5px solid rgba(59, 130, 246, 0.4)' : '1px solid #e2e8f0',
                boxShadow: isAnswered ? '0 2px 8px rgba(59, 130, 246, 0.06)' : '0 1px 3px rgba(0,0,0,0.02)',
                transition: 'all 0.2s ease'
              }}
            >
              {/* 設問文 */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '12px' }}>
                <span style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '8px',
                  backgroundColor: isAnswered ? '#2563eb' : '#f1f5f9',
                  color: isAnswered ? '#ffffff' : '#64748b',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {isAnswered ? <Check size={14} /> : q.id}
                </span>
                <p style={{
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  color: '#1e293b',
                  lineHeight: 1.45,
                  paddingTop: '2px'
                }}>
                  「私は普段、{q.text}」
                </p>
              </div>

              {/* 5段階の選択カード */}
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
                        padding: '10px 4px',
                        borderRadius: '12px',
                        border: isSelected ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                        backgroundColor: isSelected ? '#eff6ff' : '#f8fafc',
                        color: isSelected ? '#1d4ed8' : '#475569',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '2px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected ? '0 2px 6px rgba(37, 99, 235, 0.15)' : 'none'
                      }}
                    >
                      <span style={{
                        fontSize: '0.88rem',
                        fontWeight: 800,
                        color: isSelected ? '#2563eb' : '#334155'
                      }}>
                        {opt.value}
                      </span>
                      <span style={{
                        fontSize: '0.62rem',
                        fontWeight: isSelected ? 700 : 500,
                        color: isSelected ? '#1d4ed8' : '#64748b',
                        whiteSpace: 'nowrap',
                        textAlign: 'center'
                      }}>
                        {opt.value === 1 ? '全く違う' : opt.value === 5 ? 'とてもそう' : opt.value === 3 ? 'どちらでも' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* 選択中のラベル表示 */}
              {isAnswered && (
                <div style={{
                  marginTop: '8px',
                  textAlign: 'right',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: '#2563eb'
                }}>
                  選択: {BFI_2_S_CONFIG.scaleLabels.find(l => l.value === selectedValue)?.label}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ページナビゲーション / 送信バー */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        padding: '12px 16px',
        backgroundColor: '#ffffff',
        borderRadius: '20px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 20px -2px rgba(0,0,0,0.06)'
      }}>
        {currentPage > 0 ? (
          <button
            type="button"
            onClick={handlePrevPage}
            style={{
              padding: '10px 16px',
              borderRadius: '12px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#f8fafc',
              color: '#475569',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <ChevronLeft size={16} />
            <span>前へ</span>
          </button>
        ) : onBackToChat ? (
          <button
            type="button"
            onClick={onBackToChat}
            style={{
              padding: '8px 12px',
              borderRadius: '12px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#f8fafc',
              color: '#475569',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <ChevronLeft size={14} />
            <span>対話に戻る</span>
          </button>
        ) : (
          <div style={{ width: '70px' }} />
        )}

        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
          ページ {currentPage + 1} / {totalPages}
        </div>

        {currentPage < totalPages - 1 ? (
          <button
            type="button"
            onClick={handleNextPage}
            disabled={!isCurrentPageComplete}
            style={{
              padding: '10px 18px',
              borderRadius: '12px',
              border: 'none',
              background: isCurrentPageComplete ? 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)' : '#e2e8f0',
              color: isCurrentPageComplete ? '#ffffff' : '#94a3b8',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: isCurrentPageComplete ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: isCurrentPageComplete ? '0 2px 8px rgba(59, 130, 246, 0.3)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <span>次へ</span>
            <ChevronRight size={16} />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isAllAnswered || isSubmitting}
            style={{
              padding: '10px 20px',
              borderRadius: '12px',
              border: 'none',
              background: isAllAnswered && !isSubmitting ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#e2e8f0',
              color: isAllAnswered && !isSubmitting ? '#ffffff' : '#94a3b8',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: isAllAnswered && !isSubmitting ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: isAllAnswered && !isSubmitting ? '0 2px 10px rgba(16, 185, 129, 0.3)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <Sparkles size={16} />
            <span>{isSubmitting ? '照合中...' : '総合照合レポートを見る'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
