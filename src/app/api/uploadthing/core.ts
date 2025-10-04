import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

// Define your UploadThing file router
export const ourFileRouter = {
  // Example: avatar image upload
  avatar: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .onUploadComplete(async ({ file }) => {
      // Optionally, persist references in DB here
      return { uploaded: true, url: file.url };
    }),
  // Example: documents (pdf)
  documents: f({ pdf: { maxFileSize: "16MB", maxFileCount: 5 } })
    .onUploadComplete(async ({ file }) => {
      return { uploaded: true, url: file.url };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
