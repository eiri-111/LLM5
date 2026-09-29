import React from 'react';
import { Share2, Download, RotateCcw, Award, Lightbulb, Briefcase, HeartHandshake, ShieldAlert } from 'lucide-react';
import { AnalysisResult } from '../types';
import { RadarChart } from './RadarChart';

interface ResultReportProps {
  result: AnalysisResult;
  onRetake: () => void;
  showToast: (msg: string) => void;
}

export const ResultReport: React.FC<ResultReportProps> = ({ result, onRetake, showToast }) => {
  const shareText = encodeURIComponent(
    `【OCEAN AI ビッグファイブ診断結果】\n私の性格タイプは「${result.personality_title}」でした！\n\n#OCEAN #ビッグファイブ #性格診断`
  );
  const shareUrl = encodeURIComponent(window.location.origin);

  const handleCopyShare = () => {
    const text = `【OCEAN AI ビッグファイブ診断結果】\n私のタイプ: ${result.personality_title} (${result.personality_type})\n${window.location.origin}`;
    navigator.clipboard.writeText(text);
    showToast('診断結果のテキストをクリップボードにコピーしました');
  };

  const handleDownloadJson = () => {
    const jsonStr = JSON.stringify(result, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bigfive_${result.personality_type}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('レポートJSONファイルを保存しました');
  };

  const dimensions = [
    { key: 'openness', name: '開放性 (Openness)', badge: 'O', color: '#8b5cf6' },
    { key: 'conscientiousness', name: '誠実性 (Conscientiousness)', badge: 'C', color: '#06b6d4' },
    { key: 'extraversion', name: '外向性 (Extraversion)', badge: 'E', color: '#f59e0b' },
    { key: 'agreeableness', name: '協調性 (Agreeableness)', badge: 'A', color: '#10b981' },
    { key: 'neuroticism', name: '情緒安定性 (Emotional Stability)', badge: 'N', color: '#f43f5e' }
  ] as const;

  return (
    <div className="result-container">
      {/* Hero Header */}
      <div className="result-hero-box">
        <span className="result-badge-top">BIG FIVE PERSONALITY PROFILE</span>
        <h2 className="result-hero-title">{result.personality_title}</h2>
        <span className="result-type-tag">{result.personality_type}</span>
        <p className="result-hero-summary">{result.summary}</p>
      </div>

      {/* Radar Chart Card */}
      <div className="glass-panel radar-chart-card">
        <h3 className="card-section-title">
          📊 ビッグファイブ・レーダーチャート
        </h3>
        <RadarChart scores={result.scores} />
      </div>

      {/* Dimension Breakdown */}
      <div className="glass-panel" style={{ padding: '1.2rem' }}>
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
                  <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{d.name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span className="dim-score-badge" style={{ color: d.color }}>{dimData.score}</span>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>点 ({dimData.level})</span>
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
            </div>
          );
        })}
      </div>

      {/* Strengths */}
      <div className="glass-panel insight-block" style={{ borderLeft: '4px solid #10b981' }}>
        <h3 className="card-section-title" style={{ color: '#10b981' }}>
          <Award size={18} /> あなたの強み・ポテンシャル
        </h3>
        <ul className="insight-item-list">
          {result.strengths.map((s, idx) => (
            <li key={idx}>{s}</li>
          ))}
        </ul>
      </div>

      {/* Growth Areas */}
      <div className="glass-panel insight-block" style={{ borderLeft: '4px solid #f59e0b' }}>
        <h3 className="card-section-title" style={{ color: '#f59e0b' }}>
          <Lightbulb size={18} /> 注意点・成長へのヒント
        </h3>
        <ul className="insight-item-list">
          {result.growth_areas.map((g, idx) => (
            <li key={idx}>{g}</li>
          ))}
        </ul>
      </div>

      {/* Career */}
      <div className="glass-panel insight-block" style={{ borderLeft: '4px solid #06b6d4' }}>
        <h3 className="card-section-title" style={{ color: '#06b6d4' }}>
          <Briefcase size={18} /> 適した環境・ワークスタイル
        </h3>
        <ul className="insight-item-list">
          {result.career_recommendations.map((c, idx) => (
            <li key={idx}>{c}</li>
          ))}
        </ul>
      </div>

      {/* Relationships */}
      <div className="glass-panel insight-block" style={{ borderLeft: '4px solid #8b5cf6' }}>
        <h3 className="card-section-title" style={{ color: '#8b5cf6' }}>
          <HeartHandshake size={18} /> 対人関係・コミュニケーション
        </h3>
        <p style={{ fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.65 }}>
          {result.relationship_style}
        </p>
      </div>

      {/* Stress */}
      <div className="glass-panel insight-block" style={{ borderLeft: '4px solid #f43f5e' }}>
        <h3 className="card-section-title" style={{ color: '#f43f5e' }}>
          <ShieldAlert size={18} /> ストレス傾向とリフレッシュ法
        </h3>
        <p style={{ fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.65 }}>
          {result.stress_management}
        </p>
      </div>

      {/* Share & Actions */}
      <div className="glass-panel" style={{ padding: '1.2rem' }}>
        <h3 className="card-section-title" style={{ fontSize: '0.95rem' }}>
          <Share2 size={16} /> 結果をシェア・保存
        </h3>
        <div className="share-action-grid">
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

        <div className="share-action-grid" style={{ marginTop: '0.6rem' }}>
          <button onClick={handleCopyShare} className="btn-secondary">
            📋 テキストをコピー
          </button>
          <button onClick={handleDownloadJson} className="btn-secondary">
            <Download size={15} /> JSONを保存
          </button>
        </div>

        <button 
          onClick={onRetake}
          className="btn-submit-main"
          style={{ marginTop: '1.2rem', background: 'rgba(255, 255, 255, 0.08)' }}
        >
          <RotateCcw size={16} />
          もう一度診断する
        </button>
      </div>
    </div>
  );
};
