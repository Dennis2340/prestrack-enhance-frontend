import React from 'react';

import { InsightsData, VisualizationRecommendation } from '@/types/data-analytics';
import DataChart from './charts/DataChart';

interface InsightsDashboardProps {
  insights: InsightsData | null;
}

const InsightsDashboard: React.FC<InsightsDashboardProps> = ({ insights }) => {
  if (!insights) {
    return null; // Or a placeholder if no insights are available yet
  }

  // Start with AI-provided recommendations
  let allVisualizations: VisualizationRecommendation[] = insights.ai_analysis.visualization_recommendations ? [...insights.ai_analysis.visualization_recommendations] : [];

  // Get names of columns already recommended by AI to avoid duplicates
  const recommendedColumns = new Set(allVisualizations.map(rec => rec.columns[0]));

  // Auto-generate additional charts from column_statistics
  if (insights.column_statistics) {
    insights.column_statistics.forEach(stat => {
      if (stat.frequent_values) {
        const uniqueValueCount = Object.keys(stat.frequent_values).length;
        // Add chart if it has a reasonable number of unique values and isn't already recommended
        if (uniqueValueCount >= 2 && uniqueValueCount <= 15 && !recommendedColumns.has(stat.name)) {
          allVisualizations.push({
            chart_type: 'bar_chart',
            title: `Distribution of ${stat.name}`,
            description: `Shows the frequency distribution for the column: ${stat.name}.`,
            columns: [stat.name],
          });
        }
      }
    });
  }

  

  return (
    <div className="space-y-8">
      {/* AI Summary Section */}
      <section className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <h3 className="text-2xl font-semibold text-gray-800 mb-3">AI-Generated Analysis</h3>
        <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{insights.ai_analysis.summary}</p>
      </section>

      {/* Key Insights Section */}
      {insights.ai_analysis.key_insights && insights.ai_analysis.key_insights.length > 0 && (
        <section className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Key Insights</h3>
          <ul className="list-disc list-inside space-y-2">
            {insights.ai_analysis.key_insights.map((insight, index) => (
              <li key={`key-insight-${index}`} className="text-gray-700 leading-relaxed">{insight}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Actionable Recommendations Section */}
      {insights.ai_analysis.actionable_recommendations && insights.ai_analysis.actionable_recommendations.length > 0 && (
        <section className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Actionable Recommendations</h3>
          <div className="space-y-4">
            {insights.ai_analysis.actionable_recommendations.map((rec, index) => (
              <div key={`rec-${index}`} className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <h4 className="font-semibold text-purple-700 mb-1">{rec.recommendation}</h4>
                <p className="text-sm text-gray-600 leading-relaxed"><strong>Rationale:</strong> {rec.rationale}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Charts Section */}
      <section>
        <h3 className="text-2xl font-semibold text-gray-800 mb-6">Data Visualizations</h3>
        <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-8">
          {allVisualizations.map((chart: VisualizationRecommendation, index: number) => (
            <DataChart 
                key={`${chart.title}-${index}`}
                chartInfo={chart}
                allColumnStats={insights.column_statistics}
                correlations={insights.correlations}
              />
          ))}
        </div>
      </section>
    </div>
  );
};

export default InsightsDashboard;
