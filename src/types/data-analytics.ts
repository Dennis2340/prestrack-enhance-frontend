export interface UploadResponse {
    job_id: string;
    status: string;
    message: string;
  }
  
  export interface DataSummary {
    row_count: number;
    column_count: number;
    numeric_columns: string[];
    categorical_columns: string[];
    date_columns: string[];
    summary_text: string;
  }
  
  export interface ColumnStatistic {
    name: string;
    data_type: string;
    null_count: number;
    unique_count: number;
    min?: string | number | null;
    max?: string | number | null;
    mean?: number | null;
    median?: number | null;
    std_dev?: number | null;
    percentile_25?: number | null;
    percentile_75?: number | null;
    frequent_values?: Record<string, number> | null;
  }
  
  export interface Correlations {
    [key: string]: number;
  }
  
  export interface ActionableRecommendation {
    recommendation: string;
    rationale: string;
  }
  
  export interface VisualizationRecommendation {
    chart_type: 'pie_chart' | 'bar_chart' | 'histogram' | 'scatter_plot' | string; // Allow for other types
    title: string;
    description: string;
    columns: string[];
  }
  
  export interface AiAnalysis {
    summary: string;
    key_insights: string[];
    actionable_recommendations: ActionableRecommendation[];
    visualization_recommendations: VisualizationRecommendation[];
  }
  
  export interface InsightsData {
    data_summary: DataSummary;
    column_statistics: ColumnStatistic[];
    correlations: Correlations;
    ai_analysis: AiAnalysis;
  }
  
  export interface InsightsResponse {
    job_id: string;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    message: string;
    insights?: InsightsData;
  }
  