import React, { useState, useRef, useEffect } from 'react';
import { ImageDown, RotateCcw, UserCheck } from 'lucide-react';
import { toPng } from 'html-to-image';
import { AnalysisResult, UserProfile, ChatMessage, SurveyResult } from '../types';
import { RadarChart } from './RadarChart';
import { ComparisonChart } from './ComparisonChart';

interface ResultReportProps {
  result: AnalysisResult;
  surveyResult?: SurveyResult | null;
  userProfile: UserProfile | null;
  messages: ChatMessage[];
  sessionId: string;
  onRetake: () => void;
  onUpdateSurveyResult?: (survey: SurveyResult) => void;
  showToast: (msg: string) => void;
}

export const ResultReport: React.FC<ResultReportProps> = ({
  result,
  surveyResult,
  userProfile,
  messages,
  sessionId,
  onRetake,
  showToast
}) => {
  const [isSavingImage, setIsSavingImage] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (userProfile && sessionId && result) {
      fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          user_profile: userProfile,
          messages,
          ai_result: result,
          survey_result: surveyResult || undefined
        })
      }).catch(err => console.warn('Auto-save result error:', err));
    }
  }, [sessionId, userProfile, result, messages, surveyResult]);

  const shareText = encodeURIComponent(
    `【パーソナリティ評価調査レポート】\n評価タイプ: 「${result.personality_title}」 (${result.personality_type})`
  );
  const shareUrl = encodeURIComponent(window.location.origin);

  const handleSaveAsImage = async () => {
    if (!reportRef.current || isSavingImage) return;
    setIsSavingImage(true);
    showToast('レポート画像を生成しています...');

    try {
      await new Promise(resolve => setTimeout(resolve, 150));

      const dataUrl = await toPng(reportRef.current, {
        quality: 0.98,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        filter: (node: HTMLElement) => {
          if (node?.classList?.contains('actions-section') || node?.classList?.contains('modal-backdrop')) {
            return false;
          }
          return true;
        }
      });

      const link = document.createElement('a');
      link.download = `LLM5_Assessment_Report_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
      showToast('レポート画像を保存しました');
    } catch (err: any) {
      console.error('画像生成エラー:', err);
      showToast('画像の生成に失敗しました。もう一度お試しください。');
    } finally {
      setIsSavingImage(false);
    }
  };

  const dimensions = [
    { key: 'openness', name: '開放性 (Openness)', badge: 'O', color: '#007ac0' },
    { key: 'conscientiousness', name: '誠実性 (Conscientiousness)', badge: 'C', color: '#1b365d' },
    { key: 'extraversion', name: '外向性 (Extraversion)', badge: 'E', color: '#008080' },
    { key: 'agreeableness', name: '協調性 (Agreeableness)', badge: 'A', color: '#1e7e5a' },
    { key: 'neuroticism', name: '情緒安定性 (Emotional Stability)', badge: 'N', color: '#4a5568' }
  ] as const;

  return (
    <div className="result-container" ref={reportRef}>
      {/* Qualtrics 100% Completion Progress Bar */}
      <div style={{ marginBottom: '0.25rem' }}>
        <div className="qualtrics-progress-row">
          <span className="qualtrics-progress-pct">0%</span>
          <div className="qualtrics-progress-track">
            <div className="qualtrics-progress-fill" style={{ width: '100%' }} />
          </div>
          <span className="qualtrics-progress-pct">100%</span>
        </div>
        <div style={{ textAlign: 'center', fontSize: '0.72rem', color: '#5c6878', marginTop: '4px' }}>
          調査完了 — ご回答ありがとうございました。以下はあなたの分析結果レポートです。
        </div>
      </div>

      {/* Hero Header */}
      <div className="result-hero-box">
        <div className="result-hero-meta-row">
          <span className="result-badge-top">ASSESSMENT REPORT</span>
          {(result.demographics?.age || result.demographics?.gender || userProfile?.age) && (
            <span className="result-user-badge">
              <UserCheck size={13} />
              <span>
                {[
                  (result.demographics?.age || userProfile?.age)
                    ? `${result.demographics?.age || userProfile?.age}歳`
                    : null,
                  result.demographics?.gender ||
                    (userProfile?.gender === 'male'
                      ? '男性'
                      : userProfile?.gender === 'female'
                      ? '女性'
                      : userProfile?.gender === 'other'
                      ? 'その他'
                      : null)
                ].filter(Boolean).join(' / ')}
              </span>
            </span>
          )}
        </div>
        <h2 className="result-hero-title">{result.personality_title}</h2>
        <span className="result-type-tag">分類タイプ: {result.personality_type}</span>
        <p className="result-hero-summary">{result.summary}</p>
      </div>

      {/* Radar / Comparison Chart Card */}
      <div className="radar-chart-card">
        {surveyResult ? (
          <>
            <h3 className="card-section-title">
              1. AI対話推定値 × 標準心理尺度（{surveyResult.scaleName}）の照合結果
            </h3>
            <ComparisonChart aiScores={result.scores} surveyResult={surveyResult} />
          </>
        ) : (
          <>
            <h3 className="card-section-title">
              1. ビッグファイブ 5因子プロファイル (AI対話推定)
            </h3>
            <RadarChart scores={result.scores} />
          </>
        )}
      </div>

      {/* AI Analysis Rationale & Evidence Card */}
      {(result.llm_analysis_rationale || (result.dialogue_evidence && result.dialogue_evidence.length > 0)) && (
        <div className="rationale-card">
          <div className="rationale-card-header">
            <div>
              <h3 className="rationale-card-title">
                2. 対話内容に基づく評価根拠（プロファイリング所見）
              </h3>
              <p className="rationale-card-subtitle">
                対話内で語られた行動エピソードおよび応答傾向に基づく分析
              </p>
            </div>
          </div>

          {result.llm_analysis_rationale && (
            <div className="rationale-body">
              <p className="rationale-text">{result.llm_analysis_rationale}</p>
            </div>
          )}

          {result.dialogue_evidence && result.dialogue_evidence.length > 0 && (
            <div className="dialogue-evidence-box">
              <span className="evidence-box-title">
                抽出された主な行動エピソード・発言傾向
              </span>
              <ul className="evidence-list">
                {result.dialogue_evidence.map((ev, idx) => (
                  <li key={idx} className="evidence-item">{ev}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Dimension Breakdown */}
      <div className="dimensions-section">
        <h3 className="card-section-title">
          3. 主要5因子（Big Five）別の詳細スコアと解説
        </h3>
        {dimensions.map(d => {
          const dimData = result.scores[d.key];
          if (!dimData) return null;
          return (
            <div key={d.key} className="dimension-card">
              <div className="dim-header-row">
                <div className="dim-name-group">
                  <span className="dim-avatar" style={{ backgroundColor: d.color }}>{d.badge}</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1b2432' }}>{d.name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {dimData.confidence && (
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: dimData.confidence === 'high' ? '#e6f4ea' : (dimData.confidence === 'moderate' ? '#fef7e0' : '#f1f3f4'),
                      color: dimData.confidence === 'high' ? '#137333' : (dimData.confidence === 'moderate' ? '#b06000' : '#5f6368')
                    }}>
                      {dimData.confidence === 'high' ? 'エビデンス十分' : (dimData.confidence === 'moderate' ? 'エビデンス中程度' : '言及少・参考値')}
                    </span>
                  )}
                  <span className="dim-score-badge" style={{ color: d.color }}>{dimData.score}</span>
                  <span style={{ fontSize: '0.75rem', color: '#5c6878', fontWeight: 600 }}>/ 100 ({dimData.level})</span>
                </div>
              </div>
              <div className="progress-rail">
                <div
                  className="progress-fill"
                  style={{ width: `${dimData.score}%`, backgroundColor: d.color }}
                />
              </div>
              <p className="dim-description">
                <strong>{dimData.title}</strong> — {dimData.description}
              </p>
              <div className="dim-tags-row">
                {(dimData.traits || []).map((t, idx) => (
                  <span key={idx} className="dim-tag-pill">{t}</span>
                ))}
              </div>

              {dimData.analysis_reasoning && (
                <div className="dim-reasoning-box">
                  <span className="dim-reasoning-title">
                    判定根拠
                  </span>
                  <p className="dim-reasoning-text">{dimData.analysis_reasoning}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Strengths */}
      <div className="insight-block" style={{ borderLeft: '4px solid #007ac0' }}>
        <h3 className="card-section-title">
          4. 行動特性上の強み・ポテンシャル
        </h3>
        <ul className="insight-item-list">
          {result.strengths.map((s, idx) => (
            <li key={idx}>{s}</li>
          ))}
        </ul>
      </div>

      {/* Growth Areas */}
      <div className="insight-block" style={{ borderLeft: '4px solid #1b365d' }}>
        <h3 className="card-section-title">
          5. 留意点・今後の成長に向けた示唆
        </h3>
        <ul className="insight-item-list">
          {result.growth_areas.map((g, idx) => (
            <li key={idx}>{g}</li>
          ))}
        </ul>
      </div>

      {/* Career */}
      <div className="insight-block" style={{ borderLeft: '4px solid #008080' }}>
        <h3 className="card-section-title">
          6. 適した環境・ワークスタイル
        </h3>
        <ul className="insight-item-list">
          {result.career_recommendations.map((c, idx) => (
            <li key={idx}>{c}</li>
          ))}
        </ul>
      </div>

      {/* Relationships */}
      <div className="insight-block" style={{ borderLeft: '4px solid #1e7e5a' }}>
        <h3 className="card-section-title">
          7. 対人関係・コミュニケーションの特徴
        </h3>
        <p style={{ fontSize: '0.88rem', color: '#333e4f', lineHeight: 1.7 }}>
          {result.relationship_style}
        </p>
      </div>

      {/* Stress */}
      <div className="insight-block" style={{ borderLeft: '4px solid #4a5568' }}>
        <h3 className="card-section-title">
          8. ストレス対処とセルフマネジメント
        </h3>
        <p style={{ fontSize: '0.88rem', color: '#333e4f', lineHeight: 1.7 }}>
          {result.stress_management}
        </p>
      </div>

      {/* Share & Actions */}
      <div className="actions-section">
        <h3 className="card-section-title" style={{ fontSize: '0.92rem' }}>
          レポートの保存・共有
        </h3>

        <button
          onClick={handleSaveAsImage}
          disabled={isSavingImage}
          className="btn-save-image"
        >
          <ImageDown size={17} />
          <span>{isSavingImage ? 'レポート画像を生成中...' : '結果レポートを画像（PNG）として保存'}</span>
        </button>

        <div className="share-action-grid" style={{ marginTop: '0.65rem' }}>
          <a
            href={`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-share-x"
          >
            X (Twitter) で共有
          </a>
          <a
            href={`https://social-plugins.line.me/lineit/share?url=${shareUrl}&text=${shareText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-share-line"
          >
            LINE で共有
          </a>
        </div>

        <button
          onClick={onRetake}
          className="btn-retake"
        >
          <RotateCcw size={15} />
          調査を最初からやり直す
        </button>
      </div>
    </div>
  );
};
