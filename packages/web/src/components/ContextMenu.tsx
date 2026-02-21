import { useEffect, useRef } from "react";
import { Download, Trash2, Link2, Eye, Pencil } from "lucide-react";
import type { FileEntry } from "../lib/api";

interface ContextMenuProps {
  x: number;
  y: number;
  file: FileEntry;
  onClose: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onShare: () => void;
  onPreview: () => void;
  onRename: () => void;
}

export default function ContextMenu({
  x,
  y,
  file,
  onClose,
  onDownload,
  onDelete,
  onShare,
  onPreview,
  onRename,
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - 250);

  return (
    <div
      ref={ref}
      className="fixed bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-1 z-50 min-w-[180px]"
      style={{ left: adjustedX, top: adjustedY }}
    >
      {!file.isDirectory && (
        <button
          onClick={() => { onPreview(); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-800 text-left"
        >
          <Eye size={16} className="text-gray-400" />
          Preview
        </button>
      )}
      {!file.isDirectory && (
        <button
          onClick={() => { onDownload(); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-800 text-left"
        >
          <Download size={16} className="text-gray-400" />
          Download
        </button>
      )}
      {!file.isDirectory && (
        <button
          onClick={() => { onShare(); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-800 text-left"
        >
          <Link2 size={16} className="text-gray-400" />
          Share
        </button>
      )}
      <button
        onClick={() => { onRename(); onClose(); }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-800 text-left"
      >
        <Pencil size={16} className="text-gray-400" />
        Rename
      </button>
      <div className="border-t border-gray-800 my-1" />
      <button
        onClick={() => { onDelete(); onClose(); }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-800 text-left text-red-400"
      >
        <Trash2 size={16} />
        Delete
      </button>
    </div>
  );
}
