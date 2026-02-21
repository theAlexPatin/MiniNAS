import { useState, useRef, type DragEvent } from "react";
import { Upload, FolderUp } from "lucide-react";
import { getFilesFromDataTransfer } from "../lib/drop";

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

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = await getFilesFromDataTransfer(e.dataTransfer);
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
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <Upload
          size={32}
          className={`mx-auto mb-3 ${isDragging ? "text-blue-500" : "text-gray-400"}`}
        />
        <p className="text-gray-500 mb-3">
          Drag and drop files here, or
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-md text-sm font-medium transition-colors"
          >
            Choose Files
          </button>
          <button
            onClick={() => folderInputRef.current?.click()}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-md text-sm font-medium transition-colors shadow-sm"
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
