"use client";

import React, { useState } from 'react';
import Papa from 'papaparse';
import FileUploadCard from '@/components/data-analytics/FileUploadCard';
import InsightsDashboard from '@/components/data-analytics/InsightsDashboard';
import { InsightsData, ColumnStatistic } from '@/types/data-analytics';

type Row = Record<string, string>;

function isNumberLike(val: string | null | undefined): boolean {
  if (val == null) return false;
  const n = Number(val);
  return !isNaN(n) && val.trim() !== '';
}

function isDateLike(val: string | null | undefined): boolean {
  if (!val) return false;
  const d = new Date(val);
  return !isNaN(d.getTime());
}

function statsForNumeric(values: number[]) {
  const n = values.length;
  if (n === 0) return { min: null, max: null, mean: null, median: null, std: null, p25: null, p75: null };
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[n - 1];
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / n;
  const std = Math.sqrt(variance);
  const idx = (p: number) => Math.floor((p / 100) * (n - 1));
  const p25 = sorted[idx(25)];
  const p75 = sorted[idx(75)];
  return { min, max, mean, median, std, p25, p75 };
}

function frequentValues(values: (string | null | undefined)[], limit = 20): Record<string, number> {
  const map: Record<string, number> = {};
  for (const v of values) {
    if (v == null || v === '') continue;
    map[v] = (map[v] || 0) + 1;
  }
  // limit top entries
  return Object.fromEntries(
    Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
  );
}

function pearson(x: number[], y: number[]) {
  const n = Math.min(x.length, y.length);
  if (n === 0) return 0;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const vx = x[i] - mx;
    const vy = y[i] - my;
    num += vx * vy;
    dx += vx * vx;
    dy += vy * vy;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num / den;
}

export default function DataAnalyticsPage() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>("");
  const [analysisId, setAnalysisId] = useState<string | null>(null);

  const handleFileUpload = async (file: File) => {
    setUploadedFile(file);
    setIsLoading(true);
    setError(null);
    setInsights(null);
    try {
      const text = await file.text();
      const parsed = Papa.parse<Row>(text, { header: true, skipEmptyLines: true });
      if (parsed.errors && parsed.errors.length > 0) {
        throw new Error(parsed.errors[0].message || 'Failed to parse CSV');
      }
      const rows = parsed.data;
      if (!rows || rows.length === 0) {
        throw new Error('CSV has no data rows');
      }

      const columns = Object.keys(rows[0] || {});
      const columnValues: Record<string, (string | null | undefined)[]> = {};
      for (const col of columns) columnValues[col] = rows.map((r) => r[col]);

      const dataTypes: Record<string, 'number' | 'date' | 'string'> = {};
      for (const col of columns) {
        const sample = columnValues[col].find((v) => v != null && String(v).trim() !== '');
        if (isNumberLike(sample || '')) dataTypes[col] = 'number';
        else if (isDateLike(sample || '')) dataTypes[col] = 'date';
        else dataTypes[col] = 'string';
      }

      const numericCols = columns.filter((c) => dataTypes[c] === 'number');
      const categoricalCols = columns.filter((c) => dataTypes[c] === 'string');
      const dateCols = columns.filter((c) => dataTypes[c] === 'date');

      const column_statistics: ColumnStatistic[] = [];
      for (const col of columns) {
        const vals = columnValues[col];
        const null_count = vals.filter((v) => v == null || String(v).trim() === '').length;
        const unique_count = new Set(vals.filter((v) => v != null && String(v).trim() !== '')).size;

        if (dataTypes[col] === 'number') {
          const nums = vals.filter((v) => isNumberLike(v || ''))
            .map((v) => Number(v));
          const s = statsForNumeric(nums);
          column_statistics.push({
            name: col,
            data_type: 'number',
            null_count,
            unique_count,
            min: s.min,
            max: s.max,
            mean: s.mean,
            median: s.median,
            std_dev: s.std,
            percentile_25: s.p25,
            percentile_75: s.p75,
            frequent_values: null,
          });
        } else if (dataTypes[col] === 'date') {
          column_statistics.push({
            name: col,
            data_type: 'date',
            null_count,
            unique_count,
            frequent_values: null,
          });
        } else {
          column_statistics.push({
            name: col,
            data_type: 'string',
            null_count,
            unique_count,
            frequent_values: frequentValues(vals),
          });
        }
      }

      const correlations: Record<string, number> = {};
      for (let i = 0; i < numericCols.length; i++) {
        for (let j = i + 1; j < numericCols.length; j++) {
          const a = numericCols[i];
          const b = numericCols[j];
          const ax = columnValues[a].filter((v) => isNumberLike(v || ''))
            .map((v) => Number(v));
          const by = columnValues[b].filter((v) => isNumberLike(v || ''))
            .map((v) => Number(v));
          const r = pearson(ax, by);
          correlations[`${a}~${b}`] = Number.isFinite(r) ? Number(r.toFixed(4)) : 0;
        }
      }

      const totalRows = rows.length;
      const data_summary = {
        row_count: totalRows,
        column_count: columns.length,
        numeric_columns: numericCols,
        categorical_columns: categoricalCols,
        date_columns: dateCols,
        summary_text: `Rows: ${totalRows}. Columns: ${columns.length}. Numeric: ${numericCols.length}. Categorical: ${categoricalCols.length}. Dates: ${dateCols.length}.`,
      };

      // Simple heuristic "AI" analysis without external calls
      const key_insights: string[] = [];
      const actionable_recommendations: { recommendation: string; rationale: string }[] = [];
      const visualization_recommendations: { chart_type: string; title: string; description: string; columns: string[] }[] = [];

      for (const stat of column_statistics) {
        if (stat.data_type === 'number' && typeof stat.std_dev === 'number' && stat.std_dev > 0) {
          visualization_recommendations.push({
            chart_type: 'histogram',
            title: `Distribution of ${stat.name}`,
            description: `Histogram showing distribution for ${stat.name}.`,
            columns: [stat.name],
          });
        }
        if (stat.data_type === 'string' && stat.frequent_values) {
          const unique = Object.keys(stat.frequent_values).length;
          if (unique >= 2 && unique <= 15) {
            visualization_recommendations.push({
              chart_type: 'bar_chart',
              title: `Distribution of ${stat.name}`,
              description: `Counts for categories in ${stat.name}.`,
              columns: [stat.name],
            });
          }
        }
        if (stat.null_count > 0) {
          key_insights.push(`${stat.name} has ${stat.null_count} missing values.`);
          actionable_recommendations.push({
            recommendation: `Address missing values in ${stat.name}`,
            rationale: `Found ${stat.null_count} missing entries which may bias analysis.`,
          });
        }
      }

      const corrEntries = Object.entries(correlations).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 3);
      for (const [pair, r] of corrEntries) {
        if (Math.abs(r) >= 0.5) key_insights.push(`Strong correlation (${r}) observed for ${pair}.`);
      }

      const ai_analysis = {
        summary: `Automated summary generated locally. ${data_summary.summary_text}`,
        key_insights,
        actionable_recommendations,
        visualization_recommendations,
      };

      let insightsData: InsightsData = {
        data_summary,
        column_statistics,
        correlations,
        ai_analysis,
      };

      // Call server API to generate detailed AI insights
      setLoadingMessage("Generating AI insights...");
      try {
        const sample_rows = rows.slice(0, 20); // send a small sample for more context
        const resp = await fetch('/api/analytics/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data_summary, column_statistics, correlations, sample_rows, fileName: uploadedFile?.name }),
        });
        if (resp.ok) {
          const json = await resp.json();
          if (json?.ai_analysis) {
            insightsData = { ...insightsData, ai_analysis: json.ai_analysis };
          }
          if (json?.id) {
            setAnalysisId(json.id);
          }
        } else {
          console.warn('AI analysis API returned non-OK status');
        }
      } catch (e) {
        console.warn('AI analysis API error:', e);
      }

      setInsights(insightsData);
    } catch (err: any) {
      console.error('Client analysis error:', err);
      setError(err.message || 'Failed to analyze CSV file.');
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  const handleReset = () => {
    setUploadedFile(null);
    setInsights(null);
    setIsLoading(false);
    setError(null);
    setAnalysisId(null);
  };

  const handleDownloadJson = () => {
    if (!insights) return;
    const payload = {
      id: analysisId,
      fileName: uploadedFile?.name || null,
      generatedAt: new Date().toISOString(),
      ...insights,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const base = uploadedFile?.name?.replace(/\.[^/.]+$/, '') || 'analysis';
    a.href = url;
    a.download = `${base}-insights.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-4 sm:p-8 flex flex-col items-center">
      <header className="w-full max-w-5xl mb-8 text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-2 text-center">Data Insights Hub</h1>
        <p className="text-gray-600 mt-2">Upload your CSV file to unlock powerful visualizations and locally generated summaries.</p>
      </header>

      <main className="w-full max-w-5xl">
        {error && (
          <div className="mt-8 text-xl text-red-600 p-4 bg-red-100 border border-red-300 rounded-lg" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {!insights && !isLoading && (
          <FileUploadCard onFileUpload={handleFileUpload} isLoading={isLoading} />
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center bg-white p-8 rounded-xl shadow-2xl">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-purple-500 mb-4"></div>
            <p className="mt-8 text-xl text-gray-700">{loadingMessage || 'Processing...'}</p>
          </div>
        )}

        {insights && !isLoading && (
          <>
            <div className="mb-6 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-semibold text-gray-800">Your Data Insights</h2>
                {uploadedFile && <p className="text-sm text-gray-600">File: {uploadedFile.name}</p>}
              </div>
              <div className="flex items-center gap-3">
                {analysisId && (
                  <span className="text-xs text-gray-500">ID: {analysisId}</span>
                )}
                <button
                  onClick={handleDownloadJson}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-sm"
                >
                  Download JSON
                </button>
              </div>
            </div>
            <button onClick={handleReset} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg shadow-md transition-colors duration-150">
              Analyze New File
            </button>
            <InsightsDashboard insights={insights} />
          </>
        )}
      </main>
    </div>
  );
}
