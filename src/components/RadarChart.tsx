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
    '開放性 (Openness)',
    '誠実性 (Conscientiousness)',
    '外向性 (Extraversion)',
    '協調性 (Agreeableness)',
    '情緒安定性 (Stability)'
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
        backgroundColor: 'rgba(0, 122, 192, 0.2)',
        borderColor: '#007ac0',
        borderWidth: 2,
        pointBackgroundColor: '#007ac0',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 1.5,
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
        backgroundColor: '#1b2432',
        titleColor: '#ffffff',
        bodyColor: '#e2e8f0',
        padding: 10,
        cornerRadius: 4,
        callbacks: {
          label: (context: any) => ` スコア: ${context.raw} / 100`
        }
      }
    },
    scales: {
      r: {
        min: 0,
        max: 100,
        ticks: {
          stepSize: 20,
          color: '#7c8798',
          backdropColor: 'transparent',
          font: { size: 9 }
        },
        grid: {
          color: '#d8dde6'
        },
        angleLines: {
          color: '#d8dde6'
        },
        pointLabels: {
          color: '#1b2432',
          font: {
            size: 11,
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
