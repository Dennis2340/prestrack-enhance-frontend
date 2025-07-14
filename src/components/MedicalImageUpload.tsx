"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useUploadThing } from "@/lib/uploadthing";
import { Loader2, X, FileImage } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";

interface FilePreview {
  url: string;
  name: string;
  fileType?: string;
}

interface MedicalImageUploadProps {
  roomId: string;
  onUploadComplete: (results: FilePreview[]) => void;
  onError: (error: Error) => void;
}

export function MedicalImageUpload({ 
  roomId, 
  onUploadComplete, 
  onError 
}: MedicalImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previews, setPreviews] = useState<FilePreview[]>([]);
  const { startUpload } = useUploadThing("medicalImage");

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    setIsUploading(true);
    const newPreviews = acceptedFiles.map(file => ({
      url: URL.createObjectURL(file),
      name: file.name,
      fileType: file.type
    }));

    setPreviews(newPreviews);

    try {
      // Upload files
      const uploadResults = await startUpload(acceptedFiles);
      if (!uploadResults) {
        throw new Error("Upload failed");
      }

      // Process each uploaded file
      const results = await Promise.all(
        uploadResults.map(async (file) => {
          const response = await fetch(`/api/rooms/${roomId}/ai/analyze-image`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileUrl: file.url,
              fileName: file.name,
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to analyze image");
          }

          const { image } = await response.json();
          return {
            url: image.url,
            name: image.fileName,
            fileType: image.fileType
          };
        })
      );

      onUploadComplete(results);
      toast.success(`${results.length} image(s) uploaded successfully`);
    } catch (error) {
      console.error("Upload error:", error);
      onError(error instanceof Error ? error : new Error("Upload failed"));
      toast.error("Failed to upload images");
    } finally {
      setIsUploading(false);
      // Clean up object URLs
      newPreviews.forEach(preview => URL.revokeObjectURL(preview.url));
      setPreviews([]);
    }
  }, [roomId, onUploadComplete, onError, startUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpeg", ".jpg", ".png", ".gif"],
    },
    multiple: true,
    disabled: isUploading,
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive 
            ? "border-blue-500 bg-blue-50" 
            : "border-gray-300 hover:border-gray-400"
        } ${isUploading ? "opacity-70 pointer-events-none" : ""}`}
      >
        <input {...getInputProps()} />
        <div className="space-y-2">
          {isUploading ? (
            <div className="flex flex-col items-center space-y-2">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="text-sm text-gray-500">Uploading and analyzing...</p>
            </div>
          ) : (
            <>
              <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                <FileImage className="h-6 w-6 text-blue-600" />
              </div>
              <p className="text-sm text-gray-600">
                {isDragActive
                  ? "Drop the files here"
                  : "Drag & drop medical images here, or click to select"}
              </p>
              <p className="text-xs text-gray-500">
                Supports: JPG, PNG, GIF
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}