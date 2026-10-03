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

const DIMENSION_CONFIG: { key: DimensionKey; label: string }[] = [
  { key: 'openness', label: '開放性' },
  { key: 'conscientiousness', label: '誠実性' },
  { key: 'extraversion', label: '外向性' },
  { key: 'agreeableness', label: '協調性' },
  { key: 'neuroticism', label: '情緒安定性/神経症' }
];

export const ComparisonChart: React.FC<ComparisonChartProps> = ({ aiScores, surveyResult }) => {
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
        label: `${surveyResult.scaleName} 測定値`,
        data: surveyData,
        backgroundColor: 'rgba(16, 185, 129, 0.25)',
        borderColor: 'rgba(5, 150, 105, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(5, 150, 105, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(5, 150, 105, 1)',
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
      <div className="comparison-chart-wrapper" style={{ height: '320px', position: 'relative' }}>
        <Radar data={data} options={options} />
      </div>

      <div className="comparison-table-wrapper">
        <table className="comparison-table">
          <thead>
            <tr>
              <th>特性次元</th>
              <th>AI対話推定</th>
              <th>質問紙測定</th>
              <th>差分 (AI - 質問紙)</th>
            </tr>
          </thead>
          <tbody>
            {DIMENSION_CONFIG.map(({ key, label }) => {
              const aiVal = aiScores[key].score;
              const surveyVal = surveyResult.scores[key].normalizedScore;
              const diff = aiVal - surveyVal;
              return (
                <tr key={key}>
                  <td className="font-semibold text-slate-800">{label}</td>
                  <td className="text-indigo-600 font-bold">{aiVal}点</td>
                  <td className="text-emerald-600 font-bold">{surveyVal}点</td>
                  <td className={`font-semibold ${diff > 0 ? 'text-indigo-500' : diff < 0 ? 'text-amber-500' : 'text-slate-400'}`}>
                    {diff > 0 ? `+${diff}` : `${diff}`}点
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
