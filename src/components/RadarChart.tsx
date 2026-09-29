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
        backgroundColor: 'rgba(59, 130, 246, 0.22)',
        borderColor: '#3b82f6',
        borderWidth: 2.5,
        pointBackgroundColor: '#2563eb',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 4.5,
        pointHoverRadius: 6.5
      }
    ]
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#ffffff',
        bodyColor: '#e2e8f0',
        padding: 10,
        cornerRadius: 8,
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
          color: '#94a3b8',
          backdropColor: 'transparent',
          font: { size: 9, family: 'Plus Jakarta Sans' }
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.08)'
        },
        angleLines: {
          color: 'rgba(0, 0, 0, 0.1)'
        },
        pointLabels: {
          color: '#1e293b',
          font: {
            size: 11,
            weight: '700',
            family: 'Plus Jakarta Sans, Noto Sans JP'
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
