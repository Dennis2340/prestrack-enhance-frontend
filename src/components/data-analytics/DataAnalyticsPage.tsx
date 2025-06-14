"use client";

import React, { useState, useEffect, useCallback } from 'react';
import FileUploadCard from '@/components/data-analytics/FileUploadCard';
import InsightsDashboard from '@/components/data-analytics/InsightsDashboard';
import { UploadResponse, InsightsResponse, InsightsData } from '@/types/data-analytics';

const UPLOAD_API_URL = 'http://localhost:3600/upload';
const INSIGHTS_API_URL_BASE = 'http://localhost:3600/insights';
const POLLING_INTERVAL = 5000; // 5 seconds
const MAX_POLL_ATTEMPTS = 36; // 36 attempts * 5s = 180s (3 minutes) total polling time

export default function DataAnalyticsPage() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const pollForInsights = useCallback(async (currentJobId: string, attemptCount: number = 1) => {
    setLoadingMessage(`Processing your data (attempt ${attemptCount}/${MAX_POLL_ATTEMPTS}). AI analysis can take some time...`);
    try {
      const response = await fetch(`${INSIGHTS_API_URL_BASE}/${currentJobId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to fetch insights status.' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data: InsightsResponse = await response.json();
      console.log(`Insights API Response (Attempt ${attemptCount}):`, JSON.stringify(data, null, 2));

      if (data.status === 'completed' && data.insights) {
        setInsights(data.insights);
        setIsLoading(false);
        setLoadingMessage('');
        setError(null);
        setJobId(null); // Clear job ID once completed
      } else if (data.status === 'failed') {
        setError(data.message || 'Processing failed. Please try again.');
        setIsLoading(false);
        setLoadingMessage('');
        setJobId(null);
      } else if (data.status === 'queued' || data.status === 'processing'){
        setLoadingMessage(`Status: ${data.status}. Checking again in ${POLLING_INTERVAL / 1000}s...`);
        if (attemptCount < MAX_POLL_ATTEMPTS) {
          setLoadingMessage(`Status: ${data.status} (attempt ${attemptCount}/${MAX_POLL_ATTEMPTS}). Checking again in ${POLLING_INTERVAL / 1000}s...`);
          setTimeout(() => pollForInsights(currentJobId, attemptCount + 1), POLLING_INTERVAL);
        } else {
          setError(`Processing timed out after ${MAX_POLL_ATTEMPTS} attempts. Please try again later or check the file.`);
          setIsLoading(false);
          setLoadingMessage('');
          setJobId(null);
        }
      } else {
        setError('Received an unexpected status from the server.');
        setIsLoading(false);
        setLoadingMessage('');
        setJobId(null);
      }
    } catch (err: any) {
      console.error('Polling error:', err);
      setError(err.message || 'An error occurred while fetching insights. Please check your network connection or the server status.');
      setIsLoading(false);
      setLoadingMessage('');
      setJobId(null);
    }
  }, []);

  useEffect(() => {
    if (jobId && isLoading && insights === null) { // Ensure polling only starts if no insights yet
      pollForInsights(jobId, 1); // Start with attempt 1
    }
  }, [jobId, isLoading, pollForInsights]);

  const handleFileUpload = async (file: File) => {
    setUploadedFile(file);
    setIsLoading(true);
    setError(null);
    setInsights(null);
    setLoadingMessage('Uploading your file...');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('user_id', 'test_user_001'); // Using a test user_id as requested

    try {
      const response = await fetch(UPLOAD_API_URL, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'File upload failed.' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data: UploadResponse = await response.json();
      console.log('Upload API Response:', JSON.stringify(data, null, 2));
      if (data.job_id) {
        setJobId(data.job_id);
        setLoadingMessage('File uploaded. Queued for processing...');
      } else {
        throw new Error('No job_id received from upload endpoint.');
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'An error occurred during file upload. Please ensure the file is a valid CSV and try again.');
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleReset = () => {
    setUploadedFile(null);
    setInsights(null);
    setIsLoading(false);
    setJobId(null);
    setError(null);
    setLoadingMessage('');
  };

  
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-4 sm:p-8 flex flex-col items-center">
      <header className="w-full max-w-5xl mb-8 text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-2 text-center">
          Data Insights Hub
        </h1>
        <p className="text-gray-600 mt-2">
          Upload your CSV file to unlock powerful visualizations and AI-driven summaries.
        </p>
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
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg shadow-md transition-colors duration-150"
              >
                Analyze New File
              </button>
            </div>
            <InsightsDashboard insights={insights} />
          </>
        )}
      </main>
    </div>
    
  );
}
