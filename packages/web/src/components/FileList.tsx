import type { FileEntry } from "../lib/api";
import { api } from "../lib/api";
import {
  Folder,
  File,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileCode,
  Trash2,
  Download,
  Link2,
} from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "—";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getFileIcon(entry: FileEntry) {
  if (entry.isDirectory) return <Folder size={20} className="text-brand-400" />;
  const mime = entry.mimeType || "";
  if (mime.startsWith("image/")) return <FileImage size={20} className="text-purple-400" />;
  if (mime.startsWith("video/")) return <FileVideo size={20} className="text-pink-400" />;
  if (mime.startsWith("audio/")) return <FileAudio size={20} className="text-green-400" />;
  if (mime.startsWith("text/")) return <FileText size={20} className="text-yellow-400" />;
  if (mime.includes("zip") || mime.includes("tar") || mime.includes("gzip") || mime.includes("rar"))
    return <FileArchive size={20} className="text-orange-400" />;
  if (mime.includes("json") || mime.includes("javascript") || mime.includes("xml"))
    return <FileCode size={20} className="text-cyan-400" />;
  return <File size={20} className="text-gray-400" />;
}

interface FileListProps {
  entries: FileEntry[];
  volume: string;
  onNavigate: (path: string) => void;
  onDelete: (path: string) => void;
  onPreview?: (file: FileEntry) => void;
  onShare?: (file: FileEntry) => void;
}

export default function FileList({
  entries,
  volume,
  onNavigate,
  onDelete,
  onPreview,
  onShare,
}: FileListProps) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <Folder size={48} className="mb-3 opacity-50" />
        <p>This folder is empty</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-gray-400 text-left">
            <th className="pb-2 pl-3 font-medium">Name</th>
            <th className="pb-2 font-medium w-28">Size</th>
            <th className="pb-2 font-medium w-44">Modified</th>
            <th className="pb-2 font-medium w-20"></th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.path}
              className="border-b border-gray-800/50 hover:bg-gray-800/50 cursor-pointer group"
              onClick={() => {
                if (entry.isDirectory) {
                  onNavigate(entry.path);
                } else if (onPreview) {
                  onPreview(entry);
                }
              }}
            >
              <td className="py-2 pl-3">
                <div className="flex items-center gap-2.5">
                  {getFileIcon(entry)}
                  <span className="truncate">{entry.name}</span>
                </div>
              </td>
              <td className="py-2 text-gray-400">
                {entry.isDirectory ? "—" : formatBytes(entry.size)}
              </td>
              <td className="py-2 text-gray-400">{formatDate(entry.modifiedAt)}</td>
              <td className="py-2 pr-3">
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!entry.isDirectory && (
                    <a
                      href={api.getDownloadUrl(volume, entry.path)}
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200"
                      title="Download"
                    >
                      <Download size={16} />
                    </a>
                  )}
                  {!entry.isDirectory && onShare && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onShare(entry);
                      }}
                      className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-brand-400"
                      title="Share"
                    >
                      <Link2 size={16} />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete "${entry.name}"?`)) {
                        onDelete(entry.path);
                      }
                    }}
                    className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-red-400"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
