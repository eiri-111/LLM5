import React, { useState } from 'react';
import { ScaleType, SurveyResult, UserProfile } from '../types';
import { PERSONALITY_SCALES, calculateSurveyScores } from '../data/personalityScales';
import { ClipboardCheck, Sparkles, Loader2, UserCheck, HelpCircle, ArrowLeft, ExternalLink, Beaker } from 'lucide-react';

interface SurveySectionProps {
  userProfile: UserProfile | null;
  isAiAnalyzing: boolean;
  onCompleteSurvey: (surveyResult: SurveyResult) => void;
  showToast: (msg: string) => void;
  onBackToChat?: () => void;
  isSkippedMode?: boolean;
  qualtricsUrl?: string;
}

export const SurveySection: React.FC<SurveySectionProps> = ({
  userProfile,
  isAiAnalyzing,
  onCompleteSurvey,
  showToast,
  onBackToChat,
  isSkippedMode,
  qualtricsUrl
}) => {
  const [selectedScale, setSelectedScale] = useState<ScaleType>('tipi-j');
  const [answers, setAnswers] = useState<Record<number, number>>({});

  const scaleConfig = PERSONALITY_SCALES[selectedScale];
  const totalQuestions = scaleConfig.questions.length;
  const answeredCount = Object.keys(answers).length;
  const isComplete = answeredCount === totalQuestions;
  const progressPercent = Math.round((answeredCount / totalQuestions) * 100);

  const handleSelectScale = (scale: ScaleType) => {
    if (answeredCount > 0 && selectedScale !== scale) {
      if (!window.confirm('尺度を変更すると、現在入力中の回答はリセットされます。変更しますか？')) {
        return;
      }
    }
    setSelectedScale(scale);
    setAnswers({});
  };

  const handleAnswer = (questionId: number, value: number) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleSubmit = () => {
    if (!isComplete) {
      showToast('すべての質問項目に回答してください');
      return;
    }

    const calculatedScores = calculateSurveyScores(selectedScale, answers);
    const resultData: SurveyResult = {
      scaleType: selectedScale,
      scaleName: scaleConfig.shortName,
      rawAnswers: answers,
      scores: calculatedScores,
      completedAt: new Date().toISOString()
    };

    onCompleteSurvey(resultData);
  };

  return (
    <div className="survey-view-container">
      {/* ナビゲーションバー */}
      <div className="survey-top-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        {onBackToChat && (
          <button
            type="button"
            onClick={onBackToChat}
            className="btn-back-chat"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '9999px',
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              color: '#475569',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <ArrowLeft size={15} />
            <span>AI対話画面へ戻る</span>
          </button>
        )}
        {qualtricsUrl && (
          <a
            href={qualtricsUrl}
            className="btn-qualtrics-link"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              color: '#6366f1',
              fontSize: '0.8rem',
              fontWeight: 500,
              textDecoration: 'none'
            }}
          >
            <span>Qualtrics質問紙へ移動</span>
            <ExternalLink size={13} />
          </a>
        )}
      </div>

      {/* AI並行分析ステータスバナー */}
      <div className={`ai-status-banner ${isSkippedMode ? 'skipped' : ''}`} style={isSkippedMode ? { borderColor: '#fde047', background: 'rgba(254, 240, 138, 0.15)' } : {}}>
        <div className="ai-status-icon-box">
          {isSkippedMode ? (
            <Beaker size={20} className="text-amber-500" style={{ color: '#d97706' }} />
          ) : isAiAnalyzing ? (
            <Loader2 size={20} className="spinner text-indigo-600" />
          ) : (
            <Sparkles size={20} className="text-emerald-500" />
          )}
        </div>
        <div className="ai-status-content">
          <div className="ai-status-title">
            {isSkippedMode ? (
              <span style={{ color: '#b45309', fontWeight: 700 }}>動作確認モード（LLM対話スキップ中） 🧪</span>
            ) : isAiAnalyzing ? (
              <span>AI分析官が対話ログを深層プロファイリング中... ⚡</span>
            ) : (
              <span className="text-emerald-700 font-bold">AIの対話分析が準備完了しました！✨</span>
            )}
          </div>
          <p className="ai-status-desc">
            {isSkippedMode
              ? 'LLMによる対話検査をスキップして質問紙画面を表示しています。回答を完了すると、サンプルAI推定値との比較照合レポート・レーダーチャートを確認できます。'
              : isAiAnalyzing
              ? '分析が完了する間に、客観的検証用の心理尺度（質問紙アンケート）にご回答ください。回答完了と同時に両方の照合レポートが表示されます。'
              : '質問紙の回答が完了すると、AIの推定スコアと質問紙測定値の完全な比較照合レポートを表示します。'}
          </p>
        </div>
        {userProfile && (userProfile.student_id || userProfile.age || userProfile.gender) && (
          <div className="survey-user-badge">
            <UserCheck size={13} />
            <span>{userProfile.student_id || (userProfile.age ? `${userProfile.age}歳` : '被験者')}</span>
          </div>
        )}
      </div>

      <div className="survey-section-header">
        <div className="survey-badge">
          <ClipboardCheck size={16} />
          <span>心理測定尺度による客観的照合</span>
        </div>
        <h2 className="survey-title">
          学術尺度アンケートによる性格診断
        </h2>
        <p className="survey-description">
          AIの対話推定スコアと照合するための自己評価質問紙です。以下の3つの尺度からいずれかを選択してご回答ください。
        </p>
      </div>

      {/* 尺度選択タブカード */}
      <div className="scale-selector-cards">
        {(Object.keys(PERSONALITY_SCALES) as ScaleType[]).map((key) => {
          const cfg = PERSONALITY_SCALES[key];
          const isSelected = selectedScale === key;
          return (
            <button
              key={key}
              type="button"
              className={`scale-tab-card ${isSelected ? 'active' : ''}`}
              onClick={() => handleSelectScale(key)}
            >
              <div className="scale-tab-top">
                <span className="scale-tab-name">{cfg.shortName}</span>
                <span className="scale-tab-time">{cfg.estimatedMinutes}</span>
              </div>
              <p className="scale-tab-desc">{cfg.description}</p>
              <div className="scale-tab-meta">
                <span>{cfg.questionCount}項目</span>
                <span>•</span>
                <span>{cfg.likertPoints}件法</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* アンケート入力領域 */}
      <div className="survey-questions-card">
        <div className="survey-card-info">
          <h4 className="survey-scale-fullname">{scaleConfig.name}</h4>
          <span className="survey-author">{scaleConfig.authorYear}</span>
          <p className="survey-instruction">{scaleConfig.instruction}</p>
        </div>

        {/* 回答プログレスバー */}
        <div className="survey-progress-bar-container">
          <div className="survey-progress-header">
            <span>進捗状況: {answeredCount} / {totalQuestions} 問回答済み</span>
            <span className="font-bold">{progressPercent}%</span>
          </div>
          <div className="survey-progress-track">
            <div
              className="survey-progress-fill"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>

        {/* 質問リスト */}
        <div className="survey-questions-list">
          {scaleConfig.questions.map((q, idx) => {
            const currentVal = answers[q.id];
            return (
              <div key={q.id} className={`survey-question-item ${currentVal ? 'answered' : ''}`}>
                <div className="question-header">
                  <span className="question-number">Q{idx + 1}</span>
                  <p className="question-text">{q.text}</p>
                </div>

                <div className="likert-options-group">
                  {scaleConfig.scaleLabels.map((lbl) => {
                    const isChecked = currentVal === lbl.value;
                    return (
                      <button
                        key={lbl.value}
                        type="button"
                        className={`likert-option-btn ${isChecked ? 'selected' : ''}`}
                        onClick={() => handleAnswer(q.id, lbl.value)}
                      >
                        <span className="likert-val-num">{lbl.value}</span>
                        <span className="likert-val-label">{lbl.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* 送信ボタン */}
        <div className="survey-submit-container">
          <button
            type="button"
            className={`survey-submit-btn ${isComplete ? 'ready' : 'disabled'}`}
            disabled={!isComplete}
            onClick={handleSubmit}
          >
            <Sparkles size={18} />
            <span>回答を完了してAI診断と比較する</span>
          </button>
          {!isComplete && (
            <p className="unanswered-warning">
              ※ まだ未回答の質問が {totalQuestions - answeredCount} 問あります
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
