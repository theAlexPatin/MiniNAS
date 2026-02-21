import type { UploadItem } from "../hooks/useUpload";
import {
  X,
  Pause,
  Play,
  CheckCircle,
  AlertCircle,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

interface UploadProgressProps {
  uploads: UploadItem[];
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onClearCompleted: () => void;
}

export default function UploadProgress({
  uploads,
  onPause,
  onResume,
  onCancel,
  onClearCompleted,
}: UploadProgressProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (uploads.length === 0) return null;

  const active = uploads.filter(
    (u) => u.status === "uploading" || u.status === "pending"
  );
  const completed = uploads.filter((u) => u.status === "complete");

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 shadow-2xl z-50">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-gray-800/50"
        onClick={() => setCollapsed(!collapsed)}
      >
        <span className="text-sm font-medium">
          {active.length > 0
            ? `Uploading ${active.length} file${active.length > 1 ? "s" : ""}...`
            : `${completed.length} upload${completed.length > 1 ? "s" : ""} complete`}
        </span>
        <div className="flex items-center gap-2">
          {completed.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClearCompleted();
              }}
              className="text-xs text-gray-400 hover:text-gray-200"
            >
              Clear completed
            </button>
          )}
          {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {/* Upload list */}
      {!collapsed && (
        <div className="max-h-64 overflow-y-auto px-4 pb-3">
          {uploads.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 py-2 border-t border-gray-800/50"
            >
              {/* Status icon */}
              {item.status === "complete" ? (
                <CheckCircle size={16} className="text-green-500 shrink-0" />
              ) : item.status === "error" ? (
                <AlertCircle size={16} className="text-red-500 shrink-0" />
              ) : null}

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{item.file.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        item.status === "error"
                          ? "bg-red-500"
                          : item.status === "complete"
                            ? "bg-green-500"
                            : "bg-blue-500"
                      }`}
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">
                    {item.progress}% · {formatBytes(item.file.size)}
                  </span>
                </div>
                {item.error && (
                  <p className="text-xs text-red-400 mt-0.5">{item.error}</p>
                )}
              </div>

              {/* Controls */}
              <div className="flex items-center gap-1 shrink-0">
                {item.status === "uploading" && (
                  <button
                    onClick={() => onPause(item.id)}
                    className="p-1 hover:bg-gray-700 rounded"
                  >
                    <Pause size={14} />
                  </button>
                )}
                {item.status === "paused" && (
                  <button
                    onClick={() => onResume(item.id)}
                    className="p-1 hover:bg-gray-700 rounded"
                  >
                    <Play size={14} />
                  </button>
                )}
                {item.status !== "complete" && (
                  <button
                    onClick={() => onCancel(item.id)}
                    className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-red-400"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
