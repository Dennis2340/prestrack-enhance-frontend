import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileText, XCircle } from 'lucide-react';

interface FileUploadCardProps {
  onFileUpload: (file: File) => void;
  isLoading: boolean;
}

const FileUploadCard: React.FC<FileUploadCardProps> = ({ onFileUpload, isLoading }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
    setError(null);
    if (fileRejections.length > 0) {
      setError('Invalid file type. Please upload a CSV file.');
      setSelectedFile(null);
      return;
    }
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        setSelectedFile(file);
      } else {
        setError('Invalid file type. Please upload a CSV file.');
        setSelectedFile(null);
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
    },
    multiple: false,
  });

  const handleSubmit = () => {
    if (selectedFile) {
      onFileUpload(selectedFile);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setError(null);
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-xl border border-gray-200 w-full max-w-lg mx-auto">
      <div className="text-center mb-6">
        <UploadCloud className="w-12 h-12 text-purple-600 mx-auto" />
        <h2 className="text-2xl font-semibold text-gray-800">Upload Your CSV File</h2>
        <p className="text-gray-600 text-sm mt-1">Drag & drop or click to select a file.</p>
      </div>

      {!selectedFile ? (
        <div
          {...getRootProps()}
          className={`mt-6 p-8 border-2 border-dashed rounded-xl cursor-pointer transition-colors duration-200 ease-in-out flex flex-col items-center justify-center text-center ${isDragActive ? 'bg-purple-100 border-purple-500' : 'bg-gray-50 border-gray-300 hover:bg-purple-50 hover:border-purple-400'}`}
        >
          <input {...getInputProps()} />
          {isDragActive ? (
            <p className="text-lg font-semibold text-purple-600">Drop the file here ...</p>
          ) : (
            <>
              <UploadCloud className="w-16 h-16 text-gray-400 mb-3" />
              <p className="text-gray-600 font-medium">Drag 'n' drop a CSV file here, or click to select</p>
              <p className="text-xs text-gray-500 mt-1">CSV files up to 50MB</p>
            </>
          )}
        </div>
      ) : (
        <div className="bg-gray-100 p-4 rounded-lg flex items-center justify-between border border-gray-200">
          <div className="flex items-center space-x-3">
            <FileText className="w-8 h-8 text-purple-600" />
            <span className="text-gray-700 truncate max-w-xs sm:max-w-sm">{selectedFile.name}</span>
          </div>
          <button onClick={handleRemoveFile} className="text-red-500 hover:text-red-700">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {error && (
        <p className="text-red-600 text-sm mt-2 text-center">{error}</p>
      )}

      {selectedFile && !error && (
        <button
          onClick={handleSubmit}
          disabled={isLoading || !selectedFile}
          className="mt-6 w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </>
          ) : (
            'Generate Insights'
          )}
        </button>
      )}
    </div>
  );
};

export default FileUploadCard;
