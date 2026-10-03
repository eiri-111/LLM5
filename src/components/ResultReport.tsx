import React, { useState, useRef, useEffect } from 'react';
import { Share2, ImageDown, RotateCcw, Award, Lightbulb, Briefcase, HeartHandshake, ShieldAlert, Sparkles, Search, UserCheck } from 'lucide-react';
import { toPng } from 'html-to-image';
import { AnalysisResult, UserProfile, ChatMessage } from '../types';
import { RadarChart } from './RadarChart';
import { SurveySection } from './SurveySection';

interface ResultReportProps {
  result: AnalysisResult;
  userProfile: UserProfile | null;
  messages: ChatMessage[];
  sessionId: string;
  onRetake: () => void;
  showToast: (msg: string) => void;
}

export const ResultReport: React.FC<ResultReportProps> = ({
  result,
  userProfile,
  messages,
  sessionId,
  onRetake,
  showToast
}) => {
  const [isSavingImage, setIsSavingImage] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // AI分析結果が出た段階で一度D1/R2へ自動保存
  useEffect(() => {
    if (userProfile && sessionId && result) {
      fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          user_profile: userProfile,
          messages,
          ai_result: result
        })
      }).catch(err => console.warn('Auto-save AI result error:', err));
    }
  }, [sessionId, userProfile, result, messages]);

  const shareText = encodeURIComponent(
    `【LLM5 性格診断結果】\n私の性格タイプは「${result.personality_title}」でした！\n\n#LLM5 #性格診断`
  );
  const shareUrl = encodeURIComponent(window.location.origin);

  const handleSaveAsImage = async () => {
    if (!reportRef.current || isSavingImage) return;
    setIsSavingImage(true);
    showToast('診断結果の画像を生成しています...');

    try {
      // 少しレンダリング安定時間を置く
      await new Promise(resolve => setTimeout(resolve, 150));

      const dataUrl = await toPng(reportRef.current, {
        quality: 0.98,
        pixelRatio: 2,
        backgroundColor: '#f8fafc',
        filter: (node: HTMLElement) => {
          // 保存ボタンやアクションエリアは画像に含めない
          if (node?.classList?.contains('actions-section')) {
            return false;
          }
          return true;
        }
      });

      const link = document.createElement('a');
      link.download = `LLM5_性格診断_${result.personality_type}_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
      showToast('診断結果の画像を保存しました！');
    } catch (err: any) {
      console.error('画像生成エラー:', err);
      showToast('画像の生成に失敗しました。もう一度お試しください。');
    } finally {
      setIsSavingImage(false);
    }
  };

  const dimensions = [
    { key: 'openness', name: '開放性 (Openness)', badge: 'O', color: '#7c3aed' },
    { key: 'conscientiousness', name: '誠実性 (Conscientiousness)', badge: 'C', color: '#0891b2' },
    { key: 'extraversion', name: '外向性 (Extraversion)', badge: 'E', color: '#d97706' },
    { key: 'agreeableness', name: '協調性 (Agreeableness)', badge: 'A', color: '#059669' },
    { key: 'neuroticism', name: '情緒安定性 (Emotional Stability)', badge: 'N', color: '#e11d48' }
  ] as const;

  return (
    <div className="result-container" ref={reportRef}>
      {/* Hero Header */}
      <div className="result-hero-box">
        <div className="result-hero-meta-row">
          <span className="result-badge-top">LLM5 PERSONALITY PROFILE</span>
          {userProfile && (
            <span className="result-user-badge">
              <UserCheck size={13} />
              <span>学籍番号: {userProfile.student_id}</span>
            </span>
          )}
        </div>
        <h2 className="result-hero-title">{result.personality_title}</h2>
        <span className="result-type-tag">{result.personality_type}</span>
        <p className="result-hero-summary">{result.summary}</p>
      </div>

      {/* Radar Chart Card */}
      <div className="radar-chart-card">
        <h3 className="card-section-title">
          📊 5因子レーダーチャート
        </h3>
        <RadarChart scores={result.scores} />
      </div>

      {/* AI Analysis Rationale & Evidence Card */}
      {(result.llm_analysis_rationale || (result.dialogue_evidence && result.dialogue_evidence.length > 0)) && (
        <div className="rationale-card">
          <div className="rationale-card-header">
            <Sparkles size={20} className="rationale-header-icon" />
            <div>
              <h3 className="rationale-card-title">
                AI分析官による深層プロファイリング根拠
              </h3>
              <p className="rationale-card-subtitle">
                対話の言葉選びやエピソードからAIが読み解いた根拠
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
                💡 対話から検出された特徴的な言動・エピソード
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
          🎯 5因子の詳細スコア分析
        </h3>
        {dimensions.map(d => {
          const dimData = result.scores[d.key];
          if (!dimData) return null;
          return (
            <div key={d.key} className="dimension-card">
              <div className="dim-header-row">
                <div className="dim-name-group">
                  <span className="dim-avatar" style={{ backgroundColor: d.color }}>{d.badge}</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>{d.name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span className="dim-score-badge" style={{ color: d.color }}>{dimData.score}</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>点 ({dimData.level})</span>
                </div>
              </div>
              <div className="progress-rail">
                <div 
                  className="progress-fill" 
                  style={{ width: `${dimData.score}%`, backgroundColor: d.color }} 
                />
              </div>
              <p className="dim-description">
                <strong>{dimData.title}</strong>: {dimData.description}
              </p>
              <div className="dim-tags-row">
                {(dimData.traits || []).map((t, idx) => (
                  <span key={idx} className="dim-tag-pill">{t}</span>
                ))}
              </div>

              {/* 因子の判定根拠 */}
              {dimData.analysis_reasoning && (
                <div className="dim-reasoning-box">
                  <span className="dim-reasoning-title">
                    <Search size={13} /> このスコアの対話根拠
                  </span>
                  <p className="dim-reasoning-text">{dimData.analysis_reasoning}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Strengths */}
      <div className="insight-block" style={{ borderLeft: '4px solid #059669' }}>
        <h3 className="card-section-title" style={{ color: '#059669' }}>
          <Award size={18} /> あなたの強み・ポテンシャル
        </h3>
        <ul className="insight-item-list">
          {result.strengths.map((s, idx) => (
            <li key={idx}>{s}</li>
          ))}
        </ul>
      </div>

      {/* Growth Areas */}
      <div className="insight-block" style={{ borderLeft: '4px solid #d97706' }}>
        <h3 className="card-section-title" style={{ color: '#d97706' }}>
          <Lightbulb size={18} /> 注意点・成長へのヒント
        </h3>
        <ul className="insight-item-list">
          {result.growth_areas.map((g, idx) => (
            <li key={idx}>{g}</li>
          ))}
        </ul>
      </div>

      {/* Career */}
      <div className="insight-block" style={{ borderLeft: '4px solid #0891b2' }}>
        <h3 className="card-section-title" style={{ color: '#0891b2' }}>
          <Briefcase size={18} /> 適した環境・ワークスタイル
        </h3>
        <ul className="insight-item-list">
          {result.career_recommendations.map((c, idx) => (
            <li key={idx}>{c}</li>
          ))}
        </ul>
      </div>

      {/* Relationships */}
      <div className="insight-block" style={{ borderLeft: '4px solid #7c3aed' }}>
        <h3 className="card-section-title" style={{ color: '#7c3aed' }}>
          <HeartHandshake size={18} /> 対人関係・コミュニケーション
        </h3>
        <p style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.7 }}>
          {result.relationship_style}
        </p>
      </div>

      {/* Stress */}
      <div className="insight-block" style={{ borderLeft: '4px solid #e11d48' }}>
        <h3 className="card-section-title" style={{ color: '#e11d48' }}>
          <ShieldAlert size={18} /> ストレス傾向とリフレッシュ法
        </h3>
        <p style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.7 }}>
          {result.stress_management}
        </p>
      </div>

      {/* 心理測定尺度アンケートセクション (TIPI-J / 並川ら短縮版 / BFI-2-S) */}
      <SurveySection
        aiScores={result.scores}
        userProfile={userProfile}
        messages={messages}
        aiResult={result}
        sessionId={sessionId}
        showToast={showToast}
      />

      {/* Share & Actions */}
      <div className="actions-section">
        <h3 className="card-section-title" style={{ fontSize: '0.98rem' }}>
          <Share2 size={16} /> 結果をシェア・画像保存
        </h3>
        
        {/* 画像保存ボタン */}
        <button 
          onClick={handleSaveAsImage} 
          disabled={isSavingImage} 
          className="btn-save-image"
        >
          <ImageDown size={18} />
          <span>{isSavingImage ? '診断結果の画像を生成中...' : '診断結果を画像（PNG）で保存'}</span>
        </button>

        <div className="share-action-grid" style={{ marginTop: '0.75rem' }}>
          <a 
            href={`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-share-x"
          >
            𝕏 でポスト
          </a>
          <a
            href={`https://social-plugins.line.me/lineit/share?url=${shareUrl}&text=${shareText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-share-line"
          >
            LINE で送る
          </a>
        </div>

        <button 
          onClick={onRetake}
          className="btn-retake"
        >
          <RotateCcw size={16} />
          もう一度対話診断する
        </button>
      </div>
    </div>
  );
};
