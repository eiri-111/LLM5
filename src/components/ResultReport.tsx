import React, { useState, useRef, useEffect } from 'react';
import { Share2, ImageDown, RotateCcw, Award, Lightbulb, Briefcase, HeartHandshake, ShieldAlert, Sparkles, Search, UserCheck, SlidersHorizontal, X, Check } from 'lucide-react';
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
  onUpdateSurveyResult,
  showToast
}) => {
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [isQualtricsModalOpen, setIsQualtricsModalOpen] = useState(false);

  // Qualtrics 入力モーダル用のフォームステート
  const [qualtricsIdInput, setQualtricsIdInput] = useState(surveyResult?.qualtrics_id || '');
  const [scoreOpenness, setScoreOpenness] = useState<number>(surveyResult?.scores?.openness?.normalizedScore ?? Math.min(100, Math.max(0, result.scores.openness.score - 5)));
  const [scoreConscientiousness, setScoreConscientiousness] = useState<number>(surveyResult?.scores?.conscientiousness?.normalizedScore ?? Math.min(100, Math.max(0, result.scores.conscientiousness.score + 5)));
  const [scoreExtraversion, setScoreExtraversion] = useState<number>(surveyResult?.scores?.extraversion?.normalizedScore ?? Math.min(100, Math.max(0, result.scores.extraversion.score - 10)));
  const [scoreAgreeableness, setScoreAgreeableness] = useState<number>(surveyResult?.scores?.agreeableness?.normalizedScore ?? Math.min(100, Math.max(0, result.scores.agreeableness.score + 8)));
  const [scoreNeuroticism, setScoreNeuroticism] = useState<number>(surveyResult?.scores?.neuroticism?.normalizedScore ?? Math.min(100, Math.max(0, result.scores.neuroticism.score - 4)));

  const reportRef = useRef<HTMLDivElement>(null);

  // surveyResult が外部から変わったときにフォーム初期値を同期
  useEffect(() => {
    if (surveyResult) {
      if (surveyResult.qualtrics_id) setQualtricsIdInput(surveyResult.qualtrics_id);
      if (surveyResult.scores?.openness) setScoreOpenness(surveyResult.scores.openness.normalizedScore);
      if (surveyResult.scores?.conscientiousness) setScoreConscientiousness(surveyResult.scores.conscientiousness.normalizedScore);
      if (surveyResult.scores?.extraversion) setScoreExtraversion(surveyResult.scores.extraversion.normalizedScore);
      if (surveyResult.scores?.agreeableness) setScoreAgreeableness(surveyResult.scores.agreeableness.normalizedScore);
      if (surveyResult.scores?.neuroticism) setScoreNeuroticism(surveyResult.scores.neuroticism.normalizedScore);
    }
  }, [surveyResult]);

  // 照合レポート表示時にD1/R2へ自動保存
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
          survey_result: surveyResult || undefined,
          qualtrics_id: surveyResult?.qualtrics_id
        })
      }).catch(err => console.warn('Auto-save result error:', err));
    }
  }, [sessionId, userProfile, result, messages, surveyResult]);

  const handleApplyQualtricsScores = () => {
    const newSurvey: SurveyResult = {
      scaleType: 'qualtrics',
      scaleName: 'Qualtrics BigFive質問紙',
      scores: {
        openness: { rawMean: scoreOpenness, normalizedScore: scoreOpenness },
        conscientiousness: { rawMean: scoreConscientiousness, normalizedScore: scoreConscientiousness },
        extraversion: { rawMean: scoreExtraversion, normalizedScore: scoreExtraversion },
        agreeableness: { rawMean: scoreAgreeableness, normalizedScore: scoreAgreeableness },
        neuroticism: { rawMean: scoreNeuroticism, normalizedScore: scoreNeuroticism }
      },
      completedAt: new Date().toISOString(),
      qualtrics_id: qualtricsIdInput || `R_${Date.now()}`,
      isQualtrics: true
    };

    if (onUpdateSurveyResult) {
      onUpdateSurveyResult(newSurvey);
    }
    setIsQualtricsModalOpen(false);
    showToast('クアルトリクス分析結果を反映し、D1/R2へ保存しました！');
  };

  const handleApplySampleQualtricsScores = () => {
    setQualtricsIdInput('R_sample_qualtrics_response');
    setScoreOpenness(Math.min(100, Math.max(0, result.scores.openness.score + 6)));
    setScoreConscientiousness(Math.min(100, Math.max(0, result.scores.conscientiousness.score - 8)));
    setScoreExtraversion(Math.min(100, Math.max(0, result.scores.extraversion.score + 12)));
    setScoreAgreeableness(Math.min(100, Math.max(0, result.scores.agreeableness.score - 5)));
    setScoreNeuroticism(Math.min(100, Math.max(0, result.scores.neuroticism.score + 4)));
    showToast('サンプルのクアルトリクス回答値をセットしました');
  };

  const shareText = encodeURIComponent(
    `【LLM5 性格診断結果】\n私の性格タイプは「${result.personality_title}」でした！\n\n#LLM5 #性格診断`
  );
  const shareUrl = encodeURIComponent(window.location.origin);

  const handleSaveAsImage = async () => {
    if (!reportRef.current || isSavingImage) return;
    setIsSavingImage(true);
    showToast('診断結果の画像を生成しています...');

    try {
      await new Promise(resolve => setTimeout(resolve, 150));

      const dataUrl = await toPng(reportRef.current, {
        quality: 0.98,
        pixelRatio: 2,
        backgroundColor: '#f8fafc',
        filter: (node: HTMLElement) => {
          if (node?.classList?.contains('actions-section') || node?.classList?.contains('modal-backdrop')) {
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

  const isQualtricsMode = Boolean(
    surveyResult?.isQualtrics || 
    surveyResult?.qualtrics_id || 
    surveyResult?.scaleType === 'qualtrics'
  );

  return (
    <div className="result-container" ref={reportRef}>
      {/* Hero Header */}
      <div className="result-hero-box">
        <div className="result-hero-meta-row">
          <span className="result-badge-top">LLM5 PERSONALITY PROFILE</span>
          {(result.demographics?.age || result.demographics?.gender) && (
            <span className="result-user-badge">
              <UserCheck size={13} />
              <span>
                {[
                  result.demographics.age ? (typeof result.demographics.age === 'number' ? `${result.demographics.age}歳` : result.demographics.age) : null,
                  result.demographics.gender
                ].filter(Boolean).join(' / ')}
              </span>
            </span>
          )}
        </div>
        <h2 className="result-hero-title">{result.personality_title}</h2>
        <span className="result-type-tag">{result.personality_type}</span>
        <p className="result-hero-summary">{result.summary}</p>
      </div>

      {/* Radar / Comparison Chart Card */}
      <div className="radar-chart-card">
        {surveyResult ? (
          <>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <h3 className="card-section-title" style={{ margin: 0 }}>
                {isQualtricsMode ? (
                  <span>📊 AI対話推定 × クアルトリクス分析結果の照合比較</span>
                ) : (
                  <span>📊 AI対話推定 × 質問紙測定（{surveyResult.scaleName}）の照合分析</span>
                )}
              </h3>
              <button
                type="button"
                onClick={() => setIsQualtricsModalOpen(true)}
                className="text-xs font-semibold text-sky-600 hover:text-sky-800 bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-lg border border-sky-200 transition-colors flex items-center gap-1.5"
              >
                <SlidersHorizontal size={14} />
                <span>クアルトリクス結果を編集</span>
              </button>
            </div>
            <ComparisonChart aiScores={result.scores} surveyResult={surveyResult} />
          </>
        ) : (
          <>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <h3 className="card-section-title" style={{ margin: 0 }}>
                📊 5因子レーダーチャート (AI推定)
              </h3>
              <button
                type="button"
                onClick={() => setIsQualtricsModalOpen(true)}
                className="text-xs font-semibold text-sky-600 hover:text-sky-800 bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-lg border border-sky-200 transition-colors flex items-center gap-1.5"
              >
                <SlidersHorizontal size={14} />
                <span>クアルトリクス結果を照合</span>
              </button>
            </div>
            <RadarChart scores={result.scores} />

            {/* クアルトリクス照合への案内バナー */}
            <div className="mt-4 p-3 bg-sky-50/70 border border-sky-200 rounded-xl flex items-center justify-between flex-wrap gap-3">
              <div className="text-xs text-sky-900">
                <div className="font-bold">📝 クアルトリクスの分析結果をお持ちですか？</div>
                <div className="text-sky-700">数値を照合すると、AI対話結果と重ね合わせた比較チャートを表示し、D1/R2へ自動保存します。</div>
              </div>
              <button
                type="button"
                onClick={() => setIsQualtricsModalOpen(true)}
                className="bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs px-3.5 py-2 rounded-lg shadow-sm transition-all flex items-center gap-1.5"
              >
                <SlidersHorizontal size={14} />
                <span>クアルトリクス結果を入力して比較</span>
              </button>
            </div>
          </>
        )}
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

      {/* Qualtrics スコア手動入力・照合モーダル */}
      {isQualtricsModalOpen && (
        <div className="modal-backdrop">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 m-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-sm">
                  Q
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    クアルトリクス分析結果の入力・照合
                  </h3>
                  <p className="text-xs text-slate-500">
                    Qualtrics質問紙のスコアを入力してLLM分析結果と比較します
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsQualtricsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-sm">
              {/* Qualtrics Response ID */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Qualtrics 回答ID (ResponseID - 任意)
                </label>
                <input
                  type="text"
                  value={qualtricsIdInput}
                  onChange={(e) => setQualtricsIdInput(e.target.value)}
                  placeholder="例: R_2xY9abc12345678"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              {/* 5因子のスコアスライダー */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
                  <span>ビッグファイブ各因子スコア (0〜100点)</span>
                  <button
                    type="button"
                    onClick={handleApplySampleQualtricsScores}
                    className="text-sky-600 hover:text-sky-800 underline font-normal"
                  >
                    サンプル値を入力
                  </button>
                </div>

                {/* 開放性 */}
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-slate-800 text-xs">💡 開放性 (Openness)</span>
                    <span className="font-bold text-sky-600 text-xs">{scoreOpenness}点</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={scoreOpenness}
                    onChange={(e) => setScoreOpenness(Number(e.target.value))}
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                </div>

                {/* 誠実性 */}
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-slate-800 text-xs">🎯 誠実性 (Conscientiousness)</span>
                    <span className="font-bold text-sky-600 text-xs">{scoreConscientiousness}点</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={scoreConscientiousness}
                    onChange={(e) => setScoreConscientiousness(Number(e.target.value))}
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                </div>

                {/* 外向性 */}
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-slate-800 text-xs">⚡ 外向性 (Extraversion)</span>
                    <span className="font-bold text-sky-600 text-xs">{scoreExtraversion}点</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={scoreExtraversion}
                    onChange={(e) => setScoreExtraversion(Number(e.target.value))}
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                </div>

                {/* 協調性 */}
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-slate-800 text-xs">🤝 協調性 (Agreeableness)</span>
                    <span className="font-bold text-sky-600 text-xs">{scoreAgreeableness}点</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={scoreAgreeableness}
                    onChange={(e) => setScoreAgreeableness(Number(e.target.value))}
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                </div>

                {/* 情緒安定性 */}
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-slate-800 text-xs">🛡️ 情緒安定性 (Emotional Stability)</span>
                    <span className="font-bold text-sky-600 text-xs">{scoreNeuroticism}点</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={scoreNeuroticism}
                    onChange={(e) => setScoreNeuroticism(Number(e.target.value))}
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* モーダルフッター */}
            <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsQualtricsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleApplyQualtricsScores}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-sm flex items-center gap-1.5 transition-all"
              >
                <Check size={14} />
                <span>保存して照合レポートに反映 (D1/R2へ保存)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
