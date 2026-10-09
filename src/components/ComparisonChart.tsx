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
  const isQualtrics = Boolean(
    surveyResult.isQualtrics || 
    surveyResult.qualtrics_id || 
    surveyResult.scaleType === 'qualtrics'
  );

  const surveyLabel = isQualtrics 
    ? 'クアルトリクス分析結果' 
    : `${surveyResult.scaleName} 測定値`;

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

  // 平均絶対誤差 (MAE) と一致度指数の計算
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
        backgroundColor: 'rgba(99, 102, 241, 0.25)',
        borderColor: 'rgba(79, 70, 229, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(79, 70, 229, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(79, 70, 229, 1)',
        pointRadius: 4
      },
      {
        label: surveyLabel,
        data: surveyData,
        backgroundColor: isQualtrics ? 'rgba(14, 165, 233, 0.25)' : 'rgba(16, 185, 129, 0.25)',
        borderColor: isQualtrics ? 'rgba(2, 132, 199, 1)' : 'rgba(5, 150, 105, 1)',
        borderWidth: 2,
        pointBackgroundColor: isQualtrics ? 'rgba(2, 132, 199, 1)' : 'rgba(5, 150, 105, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: isQualtrics ? 'rgba(2, 132, 199, 1)' : 'rgba(5, 150, 105, 1)',
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
          color: '#94a3b8',
          font: { size: 10 }
        },
        grid: {
          color: 'rgba(226, 232, 240, 0.8)'
        },
        angleLines: {
          color: 'rgba(226, 232, 240, 0.8)'
        },
        pointLabels: {
          font: {
            size: 12,
            weight: '600'
          },
          color: '#1e293b'
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
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        padding: 10,
        callbacks: {
          label: (context: any) => `${context.dataset.label}: ${context.raw}点`
        }
      }
    }
  };

  return (
    <div className="comparison-card">
      {/* Qualtrics メタ情報 & 一致度サマリー */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl mb-4 text-xs">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded font-bold ${isQualtrics ? 'bg-sky-100 text-sky-800 border border-sky-300' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'}`}>
            {isQualtrics ? 'Qualtrics 心理測定' : surveyResult.scaleName}
          </span>
          {surveyResult.qualtrics_id && (
            <span className="text-slate-500 font-mono">
              ID: {surveyResult.qualtrics_id}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-600">
            総合一致度: <strong className="text-indigo-600 text-sm font-bold">{matchRate}%</strong>
          </span>
          <span className="text-slate-400">|</span>
          <span className="text-slate-500">
            平均差分: <strong className="text-slate-700">{avgDiff}点</strong>
          </span>
        </div>
      </div>

      <div className="comparison-chart-wrapper" style={{ height: '320px', position: 'relative' }}>
        <Radar data={data} options={options} />
      </div>

      <div className="comparison-table-wrapper mt-4">
        <table className="comparison-table">
          <thead>
            <tr>
              <th>特性次元</th>
              <th>AI対話推定</th>
              <th>{isQualtrics ? 'クアルトリクス測定' : 'BFI-2-S 心理測定'}</th>
              <th>差分 (AI - 測定)</th>
              <th>照合考察</th>
            </tr>
          </thead>
          <tbody>
            {DIMENSION_CONFIG.map(({ key, label }) => {
              const aiVal = aiScores[key].score;
              const surveyVal = surveyResult.scores[key].normalizedScore;
              const diff = aiVal - surveyVal;

              let insightText = '';
              let insightBadge = '';
              if (Math.abs(diff) <= 10) {
                insightBadge = 'text-emerald-700 bg-emerald-50 border border-emerald-200';
                insightText = '高い整合性 (対話行動と自己評価が一致)';
              } else if (diff > 10) {
                insightBadge = 'text-indigo-700 bg-indigo-50 border border-indigo-200';
                insightText = 'AI推定優位 (対話中に積極行動が観察)';
              } else {
                insightBadge = 'text-amber-700 bg-amber-50 border border-amber-200';
                insightText = '自己認識優位 (内面的意識が行動より高い傾向)';
              }

              return (
                <tr key={key}>
                  <td className="font-semibold text-slate-800">{label}</td>
                  <td className="text-indigo-600 font-bold">{aiVal}点</td>
                  <td className={`${isQualtrics ? 'text-sky-600' : 'text-emerald-600'} font-bold`}>{surveyVal}点</td>
                  <td className={`font-semibold ${diff > 0 ? 'text-indigo-500' : diff < 0 ? 'text-amber-500' : 'text-slate-400'}`}>
                    {diff > 0 ? `+${diff}` : `${diff}`}点
                  </td>
                  <td>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${insightBadge}`}>
                      {insightText}
                    </span>
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
