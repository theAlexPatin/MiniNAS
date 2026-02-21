import { useEffect, useCallback } from "react";
import { X, Download } from "lucide-react";
import { api, type FileEntry } from "../lib/api";

interface PreviewModalProps {
  file: FileEntry;
  volume: string;
  onClose: () => void;
}

export default function PreviewModal({
  file,
  volume,
  onClose,
}: PreviewModalProps) {
  const downloadUrl = api.getDownloadUrl(volume, file.path);
  const mime = file.mimeType || "";

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  const renderContent = () => {
    if (mime.startsWith("image/")) {
      return (
        <img
          src={downloadUrl}
          alt={file.name}
          className="max-w-full max-h-[80vh] object-contain"
        />
      );
    }

    if (mime.startsWith("video/")) {
      return (
        <video
          src={downloadUrl}
          controls
          autoPlay
          className="max-w-full max-h-[80vh]"
        >
          Your browser does not support the video tag.
        </video>
      );
    }

    if (mime.startsWith("audio/")) {
      return (
        <div className="p-8">
          <p className="text-lg font-medium mb-4 text-gray-900">{file.name}</p>
          <audio src={downloadUrl} controls autoPlay className="w-full">
            Your browser does not support the audio tag.
          </audio>
        </div>
      );
    }

    if (mime === "application/pdf") {
      return (
        <iframe
          src={downloadUrl}
          className="w-full h-[80vh]"
          title={file.name}
        />
      );
    }

    if (mime.startsWith("text/") || mime.includes("json") || mime.includes("xml") || mime.includes("javascript")) {
      return (
        <iframe
          src={downloadUrl}
          className="w-full h-[80vh] bg-white"
          title={file.name}
        />
      );
    }

    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 mb-4">Preview not available for this file type</p>
        <a
          href={downloadUrl}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-md text-sm font-medium transition-colors"
        >
          <Download size={16} />
          Download
        </a>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-lg max-w-5xl w-full overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-medium truncate pr-4 text-gray-900">{file.name}</h3>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={downloadUrl}
              className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-700 transition-colors"
              title="Download"
            >
              <Download size={16} />
            </a>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-700 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex items-center justify-center">{renderContent()}</div>
      </div>
    </div>
  );
}
