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
import { BigFiveScores } from '../types';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

interface RadarChartProps {
  scores: BigFiveScores;
}

export const RadarChart: React.FC<RadarChartProps> = ({ scores }) => {
  const labels = [
    '開放性\n(好奇心・創造性)',
    '誠実性\n(自制心・計画性)',
    '外向性\n(社交・活発さ)',
    '協調性\n(共感・利他性)',
    '情緒安定性\n(ストレス耐性)'
  ];

  // 神経症傾向(Neuroticism)は直感的に分かりやすいよう「情緒安定性 (100 - Neuroticism)」としてチャート表示するか、あるいは元のスコアをそのまま表示するか。
  // 一般的な心理テストでは、右上がポジティブになるよう「情緒安定性」として表示されることが多いですが、ここではビッグファイブの正確な定義として表示しつつ、注記を付与。
  const dataValues = [
    scores.openness ? scores.openness.score : 50,
    scores.conscientiousness ? scores.conscientiousness.score : 50,
    scores.extraversion ? scores.extraversion.score : 50,
    scores.agreeableness ? scores.agreeableness.score : 50,
    scores.neuroticism ? scores.neuroticism.score : 50
  ];

  const data = {
    labels: labels,
    datasets: [
      {
        label: 'パーソナリティスコア',
        data: dataValues,
        backgroundColor: 'rgba(99, 102, 241, 0.35)',
        borderColor: '#818cf8',
        borderWidth: 2.5,
        pointBackgroundColor: '#a855f7',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6
      }
    ]
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: any) => ` スコア: ${context.raw}点`
        }
      }
    },
    scales: {
      r: {
        min: 0,
        max: 100,
        ticks: {
          stepSize: 20,
          color: '#64748b',
          backdropColor: 'transparent',
          font: { size: 9 }
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.08)'
        },
        angleLines: {
          color: 'rgba(255, 255, 255, 0.12)'
        },
        pointLabels: {
          color: '#cbd5e1',
          font: {
            size: 10,
            weight: '600'
          }
        }
      }
    }
  };

  return (
    <div className="radar-chart-wrap">
      <Radar data={data} options={options} />
    </div>
  );
};
