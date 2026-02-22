import { useState, useCallback, useRef } from "react";
import * as tus from "tus-js-client";
import { withBase } from "../lib/basePath";

export interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "paused" | "complete" | "error";
  error?: string;
  upload?: tus.Upload;
}

export function useUpload(volume: string, directory: string, onComplete?: () => void) {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const idCounter = useRef(0);

  const updateUpload = useCallback(
    (id: string, updates: Partial<UploadItem>) => {
      setUploads((prev) =>
        prev.map((u) => (u.id === id ? { ...u, ...updates } : u))
      );
    },
    []
  );

  const addFiles = useCallback(
    (files: File[]) => {
      const newUploads: UploadItem[] = files.map((file) => {
        const id = `upload-${++idCounter.current}`;
        const upload = new tus.Upload(file, {
          endpoint: withBase("/api/v1/upload/"),
          retryDelays: [0, 3000, 5000, 10000, 20000],
          chunkSize: 5 * 1024 * 1024, // 5MB chunks
          metadata: {
            filename: file.name,
            filetype: file.type,
            volume,
            directory,
            // Preserve folder structure for directory uploads (e.g. "Photos/vacation/img.jpg")
            ...(file.webkitRelativePath ? { relativePath: file.webkitRelativePath } : {}),
          },
          onBeforeRequest: (req) => {
            const xhr = req.getUnderlyingObject() as XMLHttpRequest;
            xhr.withCredentials = true;
          },
          onProgress: (bytesUploaded, bytesTotal) => {
            const progress = Math.round((bytesUploaded / bytesTotal) * 100);
            updateUpload(id, { progress, status: "uploading" });
          },
          onSuccess: () => {
            updateUpload(id, { progress: 100, status: "complete" });
            onComplete?.();
          },
          onError: (error) => {
            updateUpload(id, {
              status: "error",
              error: error.message,
            });
          },
        });

        return {
          id,
          file,
          progress: 0,
          status: "pending" as const,
          upload,
        };
      });

      setUploads((prev) => [...prev, ...newUploads]);

      // Start all uploads
      for (const item of newUploads) {
        item.upload!.start();
        updateUpload(item.id, { status: "uploading" });
      }
    },
    [volume, directory, updateUpload, onComplete]
  );

  const pauseUpload = useCallback(
    (id: string) => {
      const item = uploads.find((u) => u.id === id);
      if (item?.upload) {
        item.upload.abort();
        updateUpload(id, { status: "paused" });
      }
    },
    [uploads, updateUpload]
  );

  const resumeUpload = useCallback(
    (id: string) => {
      const item = uploads.find((u) => u.id === id);
      if (item?.upload) {
        item.upload.start();
        updateUpload(id, { status: "uploading" });
      }
    },
    [uploads, updateUpload]
  );

  const cancelUpload = useCallback(
    (id: string) => {
      const item = uploads.find((u) => u.id === id);
      if (item?.upload) {
        item.upload.abort(true);
      }
      setUploads((prev) => prev.filter((u) => u.id !== id));
    },
    [uploads]
  );

  const clearCompleted = useCallback(() => {
    setUploads((prev) => prev.filter((u) => u.status !== "complete"));
  }, []);

  return {
    uploads,
    addFiles,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    clearCompleted,
  };
}
