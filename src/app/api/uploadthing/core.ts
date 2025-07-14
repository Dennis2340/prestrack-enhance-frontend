import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";

const f = createUploadthing();

// FileRouter for your app, can contain multiple FileRoutes
export const ourFileRouter = {
  // Company document uploader
  medicalImage: f({
    image: {
      maxFileSize: "8MB",
      maxFileCount: 10,
    },
  })
    
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Upload complete for user:");
      console.log("File URL:", file.ufsUrl);
      
      return { 
        uploadedBy: '',
        fileUrl: file.ufsUrl,
        fileKey: file.key,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
