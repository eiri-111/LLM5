import React, { useState } from 'react';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js';
import { Radar } from 'react-chartjs-2';
import { BigFiveScores, SurveyResult, DimensionKey, ClefScoringBreakdown } from '../types';
import { calculateBfiFacetScores } from '../data/bfi2s';

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

interface ComparisonChartProps {
  aiScores: BigFiveScores;
  surveyResult: SurveyResult;
  clefScoringData?: ClefScoringBreakdown;
}

const DIMENSION_CONFIG: { key: DimensionKey; label: string; enName: string; color: string }[] = [
  { key: 'openness', label: '開放性', enName: 'Openness', color: '#007ac0' },
  { key: 'conscientiousness', label: '誠実性', enName: 'Conscientiousness', color: '#1b365d' },
  { key: 'extraversion', label: '外向性', enName: 'Extraversion', color: '#008080' },
  { key: 'agreeableness', label: '協調性', enName: 'Agreeableness', color: '#1e7e5a' },
  { key: 'neuroticism', label: '情緒安定性', enName: 'Emotional Stability', color: '#4a5568' }
];

interface FacetItemConfig {
  key: string;
  name: string;
  factorKey: DimensionKey;
  factorName: string;
  description: string;
}

const ALL_FACET_CONFIGS: FacetItemConfig[] = [
  // 開放性
  { key: 'intellectual', factorKey: 'openness', factorName: '開放性', name: '知的好奇心', description: '未知の概念や仕組みに対する探究と深い思考' },
  { key: 'aesthetic', factorKey: 'openness', factorName: '開放性', name: '美的好奇心', description: '芸術・音楽・自然美や情緒的体験への関心' },
  { key: 'creative', factorKey: 'openness', factorName: '開放性', name: '創造力', description: '独自の工夫や新しいアイデア・解決策の試行' },
  // 誠実性
  { key: 'organization', factorKey: 'conscientiousness', factorName: '誠実性', name: '組織化', description: '事前準備・計画的な整理整頓・段取り' },
  { key: 'productiveness', factorKey: 'conscientiousness', factorName: '誠実性', name: '生産性', description: '先延ばしにせず最後までやり抜く粘り強さ' },
  { key: 'responsibility', factorKey: 'conscientiousness', factorName: '誠実性', name: '責任感', description: '約束や締切を守り役割を果たす信頼性' },
  // 外向性
  { key: 'sociability', factorKey: 'extraversion', factorName: '外向性', name: '社交性', description: '自分から進んで他者に話しかけ会話を広げる姿勢' },
  { key: 'assertiveness', factorKey: 'extraversion', factorName: '外向性', name: '主張性', description: '自分の意見を堂々と表明し場をリードする力' },
  { key: 'activity', factorKey: 'extraversion', factorName: '外向性', name: '活動性', description: 'エネルギッシュに能動的に動き回るフットワーク' },
  // 協調性
  { key: 'compassion', factorKey: 'agreeableness', factorName: '協調性', name: '思いやり', description: '他者の感情や事情に寄り添い助けようとする優しさ' },
  { key: 'respect', factorKey: 'agreeableness', factorName: '協調性', name: '敬意', description: '対立時にも穏やかに相手を尊重し角を立てない姿勢' },
  { key: 'trust', factorKey: 'agreeableness', factorName: '協調性', name: '信頼', description: '他者を疑わず好意的に受け止めて協調する信頼感' },
  // 情緒安定性
  { key: 'anxiety', factorKey: 'neuroticism', factorName: '情緒安定性', name: 'ストレス対処', description: 'プレッシャーや不測の事態でも取り乱さない冷静さ' },
  { key: 'depression', factorKey: 'neuroticism', factorName: '情緒安定性', name: '気分の安定', description: '失敗や不本意な出来事の後も素早く気持ちを切り替える力' },
  { key: 'volatility', factorKey: 'neuroticism', factorName: '情緒安定性', name: '動じにくさ', description: '突発的なトラブルや変更に対しても感情の起伏を出さない安定感' }
];

export const ComparisonChart: React.FC<ComparisonChartProps> = ({
  aiScores,
  surveyResult,
  clefScoringData
}) => {
  const [viewMode, setViewMode] = useState<'dimension' | 'facet'>('dimension');
  const surveyLabel = `${surveyResult.scaleName} 測定値`;

  // --- 1. 主要5因子のスコア計算 ---
  const labels = DIMENSION_CONFIG.map(d => d.label);
  const aiData = [
    aiScores.openness.score,
    aiScores.conscientiousness.score,
    aiScores.extraversion.score,
    aiScores.agreeableness.score,
    aiScores.neuroticism.score
  ];
  const surveyData = [
    surveyResult.scores.openness.normalizedScore,
    surveyResult.scores.conscientiousness.normalizedScore,
    surveyResult.scores.extraversion.normalizedScore,
    surveyResult.scores.agreeableness.normalizedScore,
    surveyResult.scores.neuroticism.normalizedScore
  ];

  const dimDiffs = DIMENSION_CONFIG.map(({ key }) => {
    return Math.abs(aiScores[key].score - surveyResult.scores[key].normalizedScore);
  });
  const avgDimDiff = Math.round((dimDiffs.reduce((a, b) => a + b, 0) / dimDiffs.length) * 10) / 10;
  const dimMatchRate = Math.max(0, Math.min(100, Math.round(100 - avgDimDiff)));

  // --- 2. 15ファセットのスコア計算 ---
  const resolvedSurveyFacets = surveyResult.facetScores ?? (
    surveyResult.rawAnswers ? calculateBfiFacetScores(surveyResult.rawAnswers) : null
  );

  const facetComparisonList = ALL_FACET_CONFIGS.map(f => {
    // AI側ファセットスコア（言及なし・未観測の場合は null）
    const rawAiVal = (clefScoringData?.facets?.[f.factorKey] as any)?.[f.key];
    const isObserved = typeof rawAiVal === 'number' && rawAiVal !== null;
    const aiFacetVal: number | null = isObserved ? rawAiVal : null;

    // 質問紙側ファセットスコア
    let surveyFacetVal = (resolvedSurveyFacets?.[f.factorKey] as any)?.[f.key];
    if (typeof surveyFacetVal !== 'number') {
      surveyFacetVal = surveyResult.scores[f.factorKey]?.normalizedScore ?? 50;
    }

    const diff = isObserved && aiFacetVal !== null ? aiFacetVal - surveyFacetVal : null;
    const absDiff = diff !== null ? Math.abs(diff) : null;

    // AI側の確信度
    const confidence = clefScoringData?.facet_confidences?.[`${f.factorKey}_${f.key}`] || (isObserved ? 'moderate' : 'insufficient');

    let insight = '';
    if (!isObserved) {
      insight = '対話内での行動データなし（判定保留）';
    } else if (absDiff !== null && absDiff <= 10) {
      insight = '高一致（対話行動と自己認識が整合）';
    } else if (diff !== null && diff > 10) {
      insight = 'AI推定優位（対話内で該当行動が顕著）';
    } else {
      insight = '自己認識優位（内面的意識が行動より高め）';
    }

    return {
      ...f,
      aiVal: aiFacetVal,
      surveyVal: surveyFacetVal,
      isObserved,
      diff,
      absDiff,
      confidence,
      insight
    };
  });

  const observedFacets = facetComparisonList.filter(f => f.isObserved);
  const avgFacetDiff = observedFacets.length > 0
    ? Math.round((observedFacets.reduce((acc, f) => acc + (f.absDiff ?? 0), 0) / observedFacets.length) * 10) / 10
    : 0;
  const facetMatchRate = Math.max(0, Math.min(100, Math.round(100 - avgFacetDiff)));

  // レーダーチャート用データ
  const radarData = {
    labels,
    datasets: [
      {
        label: 'AI対話推定スコア',
        data: aiData,
        backgroundColor: 'rgba(0, 122, 192, 0.2)',
        borderColor: '#007ac0',
        borderWidth: 2,
        pointBackgroundColor: '#007ac0',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#007ac0',
        pointRadius: 4
      },
      {
        label: surveyLabel,
        data: surveyData,
        backgroundColor: 'rgba(27, 54, 93, 0.15)',
        borderColor: '#1b365d',
        borderWidth: 2,
        borderDash: [4, 3],
        pointBackgroundColor: '#1b365d',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#1b365d',
        pointRadius: 4
      }
    ]
  };

  const radarOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        min: 0,
        max: 100,
        ticks: {
          stepSize: 20,
          display: true,
          backdropColor: 'transparent',
          color: '#7c8798',
          font: { size: 10 }
        },
        grid: { color: '#d8dde6' },
        angleLines: { color: '#d8dde6' },
        pointLabels: {
          font: { size: 12, weight: '600' },
          color: '#1b2432'
        }
      }
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          font: { size: 12, weight: '500' },
          boxWidth: 14,
          padding: 12
        }
      },
      tooltip: {
        backgroundColor: '#1b2432',
        padding: 10,
        cornerRadius: 4,
        callbacks: {
          label: (context: any) => `${context.dataset.label}: ${context.raw}点`
        }
      }
    }
  };

  return (
    <div className="comparison-card">
      {/* 表示切り替えタブ */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px',
        marginBottom: '0.85rem'
      }}>
        <div style={{
          display: 'inline-flex',
          backgroundColor: '#eef2f6',
          borderRadius: '6px',
          padding: '3px'
        }}>
          <button
            type="button"
            onClick={() => setViewMode('dimension')}
            style={{
              padding: '6px 14px',
              fontSize: '0.82rem',
              fontWeight: 600,
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: viewMode === 'dimension' ? '#ffffff' : 'transparent',
              color: viewMode === 'dimension' ? '#007ac0' : '#5c6878',
              boxShadow: viewMode === 'dimension' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            主要5因子（大枠比較）
          </button>
          <button
            type="button"
            onClick={() => setViewMode('facet')}
            style={{
              padding: '6px 14px',
              fontSize: '0.82rem',
              fontWeight: 600,
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: viewMode === 'facet' ? '#ffffff' : 'transparent',
              color: viewMode === 'facet' ? '#007ac0' : '#5c6878',
              boxShadow: viewMode === 'facet' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            15ファセット（詳細サブスケール比較） ✨
          </button>
        </div>

        {/* 凡例ラベル */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.78rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: '#007ac0', borderRadius: '2px' }} />
            <span style={{ color: '#1b2432', fontWeight: 600 }}>AI対話推定</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px dashed #1b365d', borderRadius: '2px' }} />
            <span style={{ color: '#1b2432', fontWeight: 600 }}>質問紙測定</span>
          </div>
        </div>
      </div>

      {/* 尺度メタ情報 & 一致度サマリー */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        padding: '0.65rem 0.9rem',
        backgroundColor: '#f7f9fa',
        border: '1px solid #d8dde6',
        borderRadius: '4px',
        fontSize: '0.8rem',
        marginBottom: '1rem'
      }}>
        <div>
          <span style={{
            padding: '2px 8px',
            borderRadius: '3px',
            fontWeight: 600,
            backgroundColor: '#e8f3fa',
            color: '#005e94',
            border: '1px solid #b6d8f2'
          }}>
            比較尺度: {surveyResult.scaleName}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: '#333e4f' }}>
            {viewMode === 'dimension' ? '5因子総合一致度: ' : '15ファセット総合一致度: '}
            <strong style={{ color: '#007ac0', fontSize: '0.9rem' }}>
              {viewMode === 'dimension' ? `${dimMatchRate}%` : `${facetMatchRate}%`}
            </strong>
            {viewMode === 'facet' && (
              <span style={{ fontSize: '0.72rem', color: '#64748b', marginLeft: '4px' }}>
                (観測データ: {observedFacets.length}/15)
              </span>
            )}
          </span>
          <span style={{ color: '#cbd5e1' }}>|</span>
          <span style={{ color: '#5c6878' }}>
            平均絶対誤差 (MAE):{' '}
            <strong style={{ color: '#1b2432' }}>
              {viewMode === 'dimension' ? `${avgDimDiff}点` : `${avgFacetDiff}点`}
            </strong>
          </span>
        </div>
      </div>

      {/* ================= モード1: 主要5因子比較 ================= */}
      {viewMode === 'dimension' && (
        <>
          <div className="comparison-chart-wrapper" style={{ height: '300px', position: 'relative' }}>
            <Radar data={radarData} options={radarOptions} />
          </div>

          <div className="comparison-table-wrapper">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>特性次元</th>
                  <th>AI対話推定</th>
                  <th>質問紙測定</th>
                  <th>差分 (AI - 測定)</th>
                  <th>照合所見</th>
                </tr>
              </thead>
              <tbody>
                {DIMENSION_CONFIG.map(({ key, label }) => {
                  const aiVal = aiScores[key].score;
                  const surveyVal = surveyResult.scores[key].normalizedScore;
                  const diff = aiVal - surveyVal;

                  let insightText = '';
                  if (Math.abs(diff) <= 10) {
                    insightText = '高一致（対話行動と自己認識が整合）';
                  } else if (diff > 10) {
                    insightText = 'AI推定優位（対話内で該当行動が顕著）';
                  } else {
                    insightText = '自己認識優位（内面的意識が行動より高め）';
                  }

                  return (
                    <tr key={key}>
                      <td style={{ fontWeight: 600, color: '#1b2432' }}>{label}</td>
                      <td style={{ color: '#007ac0', fontWeight: 700 }}>{aiVal}点</td>
                      <td style={{ color: '#1b365d', fontWeight: 700 }}>{surveyVal}点</td>
                      <td style={{ fontWeight: 600, color: '#333e4f' }}>
                        {diff > 0 ? `+${diff}` : `${diff}`}
                      </td>
                      <td style={{ fontSize: '0.78rem', color: '#333e4f' }}>
                        {insightText}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ================= モード2: 15ファセット詳細比較 ================= */}
      {viewMode === 'facet' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{
            padding: '0.65rem 0.85rem',
            backgroundColor: '#f0f7ff',
            border: '1px solid #c2e0ff',
            borderRadius: '6px',
            fontSize: '0.78rem',
            color: '#1a4971'
          }}>
            💡 <strong>15ファセット比較の見方:</strong>
            国際標準尺度BFI-2の30設問（各ファセット2問）の自己回答と、Clef-flashが対話の具体的エピソードから採点したファセット行動事実スコアを直接突き合わせています。
          </div>

          {/* 5因子ごとのファセットカードグループ */}
          {DIMENSION_CONFIG.map(dim => {
            const dimFacets = facetComparisonList.filter(f => f.factorKey === dim.key);
            return (
              <div
                key={dim.key}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  backgroundColor: '#ffffff'
                }}
              >
                {/* 因子見出しバー */}
                <div style={{
                  padding: '8px 12px',
                  backgroundColor: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      display: 'inline-block',
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: dim.color
                    }} />
                    <strong style={{ fontSize: '0.88rem', color: '#1b2432' }}>
                      {dim.label} ({dim.enName})
                    </strong>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    因子合計: AI {aiScores[dim.key].score}点 vs 質問紙 {surveyResult.scores[dim.key].normalizedScore}点
                  </div>
                </div>

                {/* 3つのファセット対比 */}
                <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {dimFacets.map(facet => (
                    <div
                      key={facet.key}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '170px 1fr 140px',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '6px 0',
                        borderBottom: '1px dashed #f1f5f9'
                      }}
                    >
                      {/* ファセット名称 & 説明 */}
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#1e293b' }}>
                          {facet.name}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '1px' }}>
                          {facet.description}
                        </div>
                      </div>

                      {/* バーによる視覚的対比 */}
                      <div>
                        {/* AI推定バー */}
                        {facet.isObserved ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '0.7rem', color: '#007ac0', width: '38px', fontWeight: 600 }}>AI</span>
                            <div style={{ flex: 1, height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${facet.aiVal}%`,
                                  height: '100%',
                                  backgroundColor: '#007ac0',
                                  borderRadius: '4px'
                                }}
                              />
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#007ac0', width: '35px', textAlign: 'right' }}>
                              {facet.aiVal}
                            </span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8', width: '38px', fontWeight: 600 }}>AI</span>
                            <div style={{
                              flex: 1,
                              padding: '2px 8px',
                              backgroundColor: '#f8fafc',
                              border: '1px dashed #cbd5e1',
                              borderRadius: '4px',
                              fontSize: '0.68rem',
                              color: '#64748b',
                              fontStyle: 'italic'
                            }}>
                              対話内での言及なし（未観測・欠測）
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', width: '35px', textAlign: 'right' }}>
                              ―
                            </span>
                          </div>
                        )}

                        {/* 質問紙測定バー */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.7rem', color: '#1b365d', width: '38px', fontWeight: 600 }}>質問紙</span>
                          <div style={{ flex: 1, height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${facet.surveyVal}%`,
                                height: '100%',
                                backgroundColor: '#1b365d',
                                borderRadius: '4px',
                                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.4) 3px, rgba(255,255,255,0.4) 6px)'
                              }}
                            />
                          </div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1b365d', width: '35px', textAlign: 'right' }}>
                            {facet.surveyVal}
                          </span>
                        </div>
                      </div>

                      {/* 差分 & 所見 */}
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          {facet.isObserved && facet.diff !== null ? (
                            <span style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: '3px',
                              backgroundColor: facet.absDiff! <= 10 ? '#e6f4ea' : (facet.diff > 0 ? '#e8f3fa' : '#fef7e0'),
                              color: facet.absDiff! <= 10 ? '#137333' : (facet.diff > 0 ? '#005e94' : '#b06000')
                            }}>
                              {facet.diff > 0 ? `+${facet.diff}` : `${facet.diff}`}点
                            </span>
                          ) : (
                            <span style={{
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              padding: '1px 6px',
                              borderRadius: '3px',
                              backgroundColor: '#f1f5f9',
                              color: '#64748b'
                            }}>
                              判定保留
                            </span>
                          )}
                          <span style={{
                            fontSize: '0.65rem',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            backgroundColor: facet.confidence === 'high' ? '#e6f4ea' : (facet.confidence === 'moderate' ? '#f8fafc' : '#f1f3f4'),
                            color: facet.confidence === 'high' ? '#137333' : '#64748b'
                          }}>
                            {facet.confidence === 'high' ? '確信度:高' : (facet.confidence === 'moderate' ? '確信度:中' : '参考・欠測')}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '3px' }}>
                          {facet.insight}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
