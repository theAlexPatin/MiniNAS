import { useState, useRef, type DragEvent } from "react";
import { Upload, FolderUp } from "lucide-react";

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
}

export default function UploadZone({ onFilesSelected }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onFilesSelected(files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFilesSelected(files);
    }
    // Reset input so same files can be selected again
    e.target.value = "";
  };

  return (
    <>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging
            ? "border-blue-500 bg-blue-500/10"
            : "border-gray-700 hover:border-gray-600"
        }`}
      >
        <Upload
          size={32}
          className={`mx-auto mb-3 ${isDragging ? "text-blue-400" : "text-gray-500"}`}
        />
        <p className="text-gray-400 mb-3">
          Drag and drop files here, or
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-md text-sm font-medium transition-colors"
          >
            Choose Files
          </button>
          <button
            onClick={() => folderInputRef.current?.click()}
            className="flex items-center gap-1.5 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-md text-sm font-medium transition-colors"
          >
            <FolderUp size={16} />
            Upload Folder
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileInput}
        className="hidden"
      />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is not in the type definition
        webkitdirectory=""
        onChange={handleFileInput}
        className="hidden"
      />
    </>
  );
}
