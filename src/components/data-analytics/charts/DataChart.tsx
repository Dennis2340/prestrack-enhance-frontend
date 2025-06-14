"use client";

import React from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  PointElement,
  LineElement
} from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import { VisualizationRecommendation, ColumnStatistic, Correlations } from '@/types/data-analytics';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  PointElement,
  LineElement
);

interface DataChartProps {
  chartInfo: VisualizationRecommendation;
  allColumnStats: ColumnStatistic[];
  correlations?: Correlations; // Optional, for scatter plots etc.
}

// Helper to generate varied colors for charts
const generateColors = (numColors: number): string[] => {
  const colors: string[] = [];
  for (let i = 0; i < numColors; i++) {
    const hue = (i * (360 / numColors)) % 360;
    colors.push(`hsla(${hue}, 70%, 60%, 0.7)`);
  }
  return colors;
};


const DataChart: React.FC<DataChartProps> = ({ chartInfo, allColumnStats, correlations }) => {
  const { chart_type, title, columns } = chartInfo;

  const targetColumnName = columns[0]; // Assuming single column for pie/bar for now
  const columnData = allColumnStats.find(stat => stat.name === targetColumnName);

  let chartElement = <div className="text-gray-500 flex items-center justify-center h-full">Chart data for '{title}' is unavailable or type is unsupported.</div>;

  if (!columnData && (chart_type === 'pie_chart' || chart_type === 'bar_chart' || chart_type === 'histogram')) {
    chartElement = <div className="text-red-600 flex items-center justify-center h-full">Data for column '{targetColumnName}' not found for chart '{title}'.</div>;
  } else if (columnData && columnData.frequent_values && (chart_type === 'pie_chart' || chart_type === 'bar_chart' || chart_type === 'histogram')) {
    const labels = Object.keys(columnData.frequent_values);
    const dataValues = Object.values(columnData.frequent_values);
    const backgroundColors = generateColors(labels.length);
    const borderColors = backgroundColors.map(color => color.replace('0.7', '1'));

    const chartDataConfig = {
      labels,
      datasets: [
        {
          label: title,
          data: dataValues,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 1,
        },
      ],
    };

    const optionsConfig: any = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
          labels: { 
            color: '#374151', // Dark gray for legend text
            boxWidth: 12, 
            padding: 15, 
            font: { size: 11 } 
          }
        },
        title: {
          display: true,
          text: title, // Using Chart.js title for better context if needed
          color: '#1f2937', // Even darker gray for title text
          font: { size: 14, weight: 'bold' },
          padding: { top: 5, bottom: 5 }
        },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)', // Keep dark tooltip for contrast
          titleColor: '#fff',
          bodyColor: '#fff',
          padding: 10,
          cornerRadius: 4,
        }
      },
    };
    
    if (chart_type === 'bar_chart' || chart_type === 'histogram') {
        optionsConfig.scales = {
            y: {
              beginAtZero: true,
              ticks: { color: '#4b5563', font: { size: 10 } }, // Medium-dark gray for Y-axis ticks
              grid: { color: '#e5e7eb' } // Light gray for Y-axis grid lines 
            },
            x: {
              ticks: { color: '#4b5563', font: { size: 10 }, maxRotation: 45, minRotation: 0 }, // Medium-dark gray for X-axis ticks
              grid: { color: '#f3f4f6' } // Even lighter for X-axis grid lines (often less prominent) 
            }
        };
        // For bar charts, legend might be redundant if it's just one dataset
        optionsConfig.plugins.legend.display = dataValues.length > 1; 
    }
     if (chart_type === 'pie_chart') {
        optionsConfig.plugins.title.display = false; // Title is already above
     }


    if (chart_type === 'pie_chart') {
      chartElement = <Pie data={chartDataConfig} options={optionsConfig} />;
    } else if (chart_type === 'bar_chart' || chart_type === 'histogram') {
      chartElement = <Bar data={chartDataConfig} options={optionsConfig} />;
    }
  } else if (chart_type === 'scatter_plot') {
    if (columns.length >= 2 && correlations) {
      const col1Name = columns[0];
      const col2Name = columns[1];
      const key1 = `${col1Name}-${col2Name}`;
      const key2 = `${col2Name}-${col1Name}`;
      let correlationValue: number | undefined = undefined;

      if (correlations[key1] !== undefined) {
        correlationValue = correlations[key1];
      } else if (correlations[key2] !== undefined) {
        correlationValue = correlations[key2];
      }

      if (correlationValue !== undefined) {
        chartElement = (
          <div className="text-gray-700 flex flex-col items-center justify-center h-full p-4 text-center">
            <p className="text-sm mb-2">
              A scatter plot visualization is recommended for '{col1Name}' vs '{col2Name}'.
              However, raw data points are not available to render the plot directly.
            </p>
            <p className="text-lg font-semibold">
              Correlation: <span className="text-purple-600">{correlationValue.toFixed(4)}</span>
            </p>
          </div>
        );
      } else {
        chartElement = <div className="text-gray-500 flex items-center justify-center h-full p-4 text-center">Correlation data not found for '{title}' between '{col1Name}' and '{col2Name}'. Scatter plot cannot be rendered.</div>;
      }
    } else {
      chartElement = <div className="text-gray-500 flex items-center justify-center h-full p-4 text-center">Insufficient data or configuration for scatter plot '{title}'.</div>;
    }
  } else if (columnData && !columnData.frequent_values && (chart_type === 'pie_chart' || chart_type === 'bar_chart' || chart_type === 'histogram')) {
    chartElement = <div className="text-gray-500 flex items-center justify-center h-full">No frequent values data for '{targetColumnName}' to render {chart_type}.</div>;
  }

  return (
    <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-200 flex flex-col h-96"> 
      <h4 className="text-md font-semibold text-gray-800 mb-1 truncate text-center" title={chartInfo.title}>{chartInfo.title}</h4>
      <p className="text-xs text-gray-600 mb-2 truncate text-center" title={chartInfo.description}>{chartInfo.description}</p>
      <div className="relative flex-grow w-full"> 
        {chartElement}
      </div>
    </div>
  );
};

export default DataChart;