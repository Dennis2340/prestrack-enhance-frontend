import { useState } from 'react';
import { toast } from 'sonner';

export interface MedicalImage {
  id: string;
  url: string;
  fileName: string;
  fileType: string;
  description: string | null;
  analysis?: {
    id: string;
    analysisResult: string;
    model: string;
    createdAt: string;
  };
}

export function useMedicalImageUpload(roomId: string) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedImage, setUploadedImage] = useState<MedicalImage | null>(null);

  const uploadImage = async (file: File, description: string = '') => {
    if (!file) return null;

    const formData = new FormData();
    formData.append('file', file);
    if (description) {
      formData.append('description', description);
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Simulate progress (in a real app, you'd track actual upload progress)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const newProgress = prev + Math.floor(Math.random() * 20);
          return newProgress > 90 ? 90 : newProgress; // Cap at 90% until complete
        });
      }, 200);

      const response = await fetch(`/api/rooms/${roomId}/ai/analyze-image`, {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        throw new Error('Failed to upload and analyze image');
      }

      const data = await response.json();
      setUploadedImage({
        id: data.image.id,
        url: data.image.url,
        fileName: data.image.fileName,
        fileType: data.image.fileType,
        description: data.image.description,
        analysis: {
          id: data.analysis.id,
          analysisResult: data.analysis.analysisResult,
          model: data.analysis.model,
          createdAt: data.analysis.createdAt,
        },
      });

      toast.success('Image uploaded and analyzed successfully');
      return data;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload and analyze image');
      return null;
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  return {
    uploadImage,
    isUploading,
    uploadProgress,
    uploadedImage,
  };
}
