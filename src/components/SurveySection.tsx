import React, { useState } from 'react';
import { ScaleType, SurveyResult, BigFiveScores, UserProfile, ChatMessage, AnalysisResult } from '../types';
import { PERSONALITY_SCALES, calculateSurveyScores } from '../data/personalityScales';
import { ComparisonChart } from './ComparisonChart';
import { ClipboardCheck, Sparkles, CheckCircle, Database, HelpCircle, ArrowRight } from 'lucide-react';

interface SurveySectionProps {
  aiScores: BigFiveScores;
  userProfile: UserProfile | null;
  messages: ChatMessage[];
  aiResult: AnalysisResult;
  sessionId: string;
  showToast: (msg: string) => void;
  onSaved?: (targets: string[]) => void;
}

export const SurveySection: React.FC<SurveySectionProps> = ({
  aiScores,
  userProfile,
  messages,
  aiResult,
  sessionId,
  showToast,
  onSaved
}) => {
  const [selectedScale, setSelectedScale] = useState<ScaleType>('tipi-j');
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [surveyResult, setSurveyResult] = useState<SurveyResult | null>(null);
  const [savedTargets, setSavedTargets] = useState<string[]>([]);

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
    setSurveyResult(null);
  };

  const handleAnswer = (questionId: number, value: number) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleSubmit = async () => {
    if (!isComplete) {
      showToast('すべての質問項目に回答してください');
      return;
    }

    setIsSubmitting(true);
    showToast('回答を集計し、データベースへ保存しています...');

    try {
      const calculatedScores = calculateSurveyScores(selectedScale, answers);
      const resultData: SurveyResult = {
        scaleType: selectedScale,
        scaleName: scaleConfig.shortName,
        rawAnswers: answers,
        scores: calculatedScores,
        completedAt: new Date().toISOString()
      };

      setSurveyResult(resultData);

      // バックエンドAPI (/api/save) へ送信して D1 / R2 へ永続化
      if (userProfile) {
        const payload = {
          session_id: sessionId,
          user_profile: userProfile,
          messages,
          ai_result: aiResult,
          survey_result: resultData
        };

        const res = await fetch('/api/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const resData: any = await res.json();
          const targets = resData.saved_targets || [];
          setSavedTargets(targets);
          if (onSaved) onSaved(targets);
          if (targets.length > 0) {
            showToast(`診断データが ${targets.join(' と ')} に正常に保存されました！`);
          } else {
            showToast('集計が完了しました（ストレージ未バインド環境）');
          }
        } else {
          showToast('集計完了（保存APIレスポンスエラー）');
        }
      }

    } catch (err: any) {
      console.error('Survey submit error:', err);
      showToast(`エラー: ${err.message || '集計に失敗しました'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="survey-section" id="psychological-survey">
      <div className="survey-section-header">
        <div className="survey-badge">
          <ClipboardCheck size={16} />
          <span>心理測定尺度による客観的検証</span>
        </div>
        <h3 className="survey-title">
          学術尺度アンケートによる性格照合
        </h3>
        <p className="survey-description">
          AIの対話推定スコアと、心理学で確立された質問紙（自己評価尺度）の回答スコアを比較・検証します。以下の3つの尺度からいずれかを選択してご回答ください。
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

      {/* アンケート入力領域 または 照合結果 */}
      {!surveyResult ? (
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
              disabled={!isComplete || isSubmitting}
              onClick={handleSubmit}
            >
              {isSubmitting ? (
                <span>集計・保存中...</span>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>回答を完了してAI診断と比較する</span>
                </>
              )}
            </button>
            {!isComplete && (
              <p className="unanswered-warning">
                ※ まだ未回答の質問が {totalQuestions - answeredCount} 問あります
              </p>
            )}
          </div>
        </div>
      ) : (
        /* 完了後の照合比較ビュー */
        <div className="survey-completed-container">
          <div className="survey-success-banner">
            <CheckCircle size={28} className="text-emerald-500" />
            <div>
              <h4 className="font-bold text-slate-800">
                {scaleConfig.shortName} の回答が集計されました！
              </h4>
              <p className="text-sm text-slate-600">
                AIの対話推定スコアと、質問紙の測定スコアの比較結果を表示しています。
              </p>
            </div>
            {savedTargets.length > 0 && (
              <div className="saved-badge">
                <Database size={14} />
                <span>{savedTargets.join('・')} 保存済</span>
              </div>
            )}
          </div>

          {/* 比較レーダーチャートと詳細テーブル */}
          <ComparisonChart aiScores={aiScores} surveyResult={surveyResult} />

          <div className="survey-actions-footer">
            <button
              type="button"
              className="retake-scale-btn"
              onClick={() => {
                if (window.confirm('別の尺度で再度回答しますか？')) {
                  setSurveyResult(null);
                  setAnswers({});
                }
              }}
            >
              別の尺度を選んで再回答する
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
