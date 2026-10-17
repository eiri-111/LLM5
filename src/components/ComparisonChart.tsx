import React from 'react';
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
import { BigFiveScores, SurveyResult, DimensionKey } from '../types';

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
}

const DIMENSION_CONFIG: { key: DimensionKey; label: string; enName: string }[] = [
  { key: 'openness', label: '開放性', enName: 'Openness' },
  { key: 'conscientiousness', label: '誠実性', enName: 'Conscientiousness' },
  { key: 'extraversion', label: '外向性', enName: 'Extraversion' },
  { key: 'agreeableness', label: '協調性', enName: 'Agreeableness' },
  { key: 'neuroticism', label: '情緒安定性', enName: 'Emotional Stability' }
];

export const ComparisonChart: React.FC<ComparisonChartProps> = ({ aiScores, surveyResult }) => {
  const surveyLabel = `${surveyResult.scaleName} 測定値`;

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

  const diffs = DIMENSION_CONFIG.map(({ key }) => {
    return Math.abs(aiScores[key].score - surveyResult.scores[key].normalizedScore);
  });
  const avgDiff = Math.round((diffs.reduce((a, b) => a + b, 0) / diffs.length) * 10) / 10;
  const matchRate = Math.max(0, Math.min(100, Math.round(100 - avgDiff)));

  const data = {
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

  const options: any = {
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
        grid: {
          color: '#d8dde6'
        },
        angleLines: {
          color: '#d8dde6'
        },
        pointLabels: {
          font: {
            size: 12,
            weight: '600'
          },
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
        fontSize: '0.8rem'
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
            総合一致度: <strong style={{ color: '#007ac0', fontSize: '0.9rem' }}>{matchRate}%</strong>
          </span>
          <span style={{ color: '#cbd5e1' }}>|</span>
          <span style={{ color: '#5c6878' }}>
            平均絶対誤差 (MAE): <strong style={{ color: '#1b2432' }}>{avgDiff}点</strong>
          </span>
        </div>
      </div>

      <div className="comparison-chart-wrapper" style={{ height: '300px', position: 'relative' }}>
        <Radar data={data} options={options} />
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
                  <td style={{ color: '#007ac0', fontWeight: 700 }}>{aiVal}</td>
                  <td style={{ color: '#1b365d', fontWeight: 700 }}>{surveyVal}</td>
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
    </div>
  );
};
