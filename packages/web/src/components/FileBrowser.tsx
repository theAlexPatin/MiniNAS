import { useState, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import VolumeSelector from "./VolumeSelector";
import FileList from "./FileList";
import FileGrid from "./FileGrid";
import { useFiles, useDeleteFile, useCreateDirectory } from "../hooks/useFiles";
import { useAuth } from "../hooks/useAuth";
import { useUpload } from "../hooks/useUpload";
import UploadZone from "./UploadZone";
import UploadProgress from "./UploadProgress";
import SearchBar from "./SearchBar";
import PreviewModal from "./PreviewModal";
import ShareDialog from "./ShareDialog";
import type { FileEntry } from "../lib/api";
import { ChevronRight, Home, FolderPlus, RefreshCw, Loader2, LogOut, Upload, LayoutGrid, List } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

function FileBrowserInner({ initialVolume }: { initialVolume?: string }) {
  const { isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const [volume, setVolume] = useState(initialVolume || "");
  const [currentPath, setCurrentPath] = useState("");

  const { data, isLoading, error, refetch } = useFiles(volume, currentPath);
  const deleteMutation = useDeleteFile(volume, currentPath);
  const mkdirMutation = useCreateDirectory(volume, currentPath);
  const {
    uploads,
    addFiles,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    clearCompleted,
  } = useUpload(volume, currentPath);
  const [showUploadZone, setShowUploadZone] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileEntry | null>(null);
  const [shareFile, setShareFile] = useState<FileEntry | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  const navigateTo = useCallback((path: string) => {
    setCurrentPath(path);
  }, []);

  const navigateUp = useCallback(() => {
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    setCurrentPath(parts.join("/"));
  }, [currentPath]);

  const handleNewFolder = useCallback(() => {
    const name = prompt("New folder name:");
    if (name) {
      mkdirMutation.mutate(name);
    }
  }, [mkdirMutation]);

  // Build breadcrumb segments
  const pathParts = currentPath.split("/").filter(Boolean);
  const breadcrumbs = pathParts.map((part, i) => ({
    label: part,
    path: pathParts.slice(0, i + 1).join("/"),
  }));

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={32} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    if (typeof window !== "undefined") window.location.href = "/login";
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">MiniNAS</h1>
        <div className="flex items-center gap-4">
        <VolumeSelector
          selectedVolume={volume}
          onSelect={(id) => {
            setVolume(id);
            setCurrentPath("");
          }}
        />
        <button
          onClick={logout}
          className="p-1.5 rounded-md hover:bg-gray-800 text-gray-400 hover:text-gray-200"
          title="Sign out"
        >
          <LogOut size={18} />
        </button>
        </div>
      </div>

      {/* Search */}
      {volume && (
        <div className="mb-4">
          <SearchBar volume={volume} onNavigate={navigateTo} />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1 text-sm overflow-x-auto">
          <button
            onClick={() => navigateTo("")}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-800 text-gray-300 hover:text-white shrink-0"
          >
            <Home size={14} />
          </button>
          {breadcrumbs.map((crumb) => (
            <div key={crumb.path} className="flex items-center gap-1 shrink-0">
              <ChevronRight size={14} className="text-gray-600" />
              <button
                onClick={() => navigateTo(crumb.path)}
                className="px-2 py-1 rounded hover:bg-gray-800 text-gray-300 hover:text-white"
              >
                {crumb.label}
              </button>
            </div>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0 ml-4">
          {volume && (
            <button
              onClick={() => setShowUploadZone(!showUploadZone)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                showUploadZone
                  ? "bg-blue-600 hover:bg-blue-500 text-white"
                  : "bg-gray-800 hover:bg-gray-700 text-gray-300"
              }`}
              title="Upload"
            >
              <Upload size={16} />
              <span className="hidden sm:inline">Upload</span>
            </button>
          )}
          <button
            onClick={handleNewFolder}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-gray-800 hover:bg-gray-700 text-gray-300"
            title="New Folder"
          >
            <FolderPlus size={16} />
            <span className="hidden sm:inline">New Folder</span>
          </button>
          <div className="flex items-center border border-gray-700 rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 ${viewMode === "list" ? "bg-gray-700 text-white" : "text-gray-400 hover:text-gray-200"}`}
              title="List view"
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 ${viewMode === "grid" ? "bg-gray-700 text-white" : "text-gray-400 hover:text-gray-200"}`}
              title="Grid view"
            >
              <LayoutGrid size={16} />
            </button>
          </div>
          <button
            onClick={() => refetch()}
            className="p-1.5 rounded-md hover:bg-gray-800 text-gray-400 hover:text-gray-200"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Upload Zone */}
      {showUploadZone && volume && (
        <div className="mb-4">
          <UploadZone
            onFilesSelected={(files) => {
              addFiles(files);
              setShowUploadZone(false);
            }}
          />
        </div>
      )}

      {/* Content */}
      {!volume ? (
        <div className="text-center py-20 text-gray-500">
          Select a volume to get started
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-20 text-red-400">
          Error loading files: {(error as Error).message}
        </div>
      ) : (
        {viewMode === "list" ? (
          <FileList
            entries={data?.entries || []}
            volume={volume}
            onNavigate={navigateTo}
            onDelete={(path) => deleteMutation.mutate(path)}
            onPreview={setPreviewFile}
            onShare={setShareFile}
          />
        ) : (
          <FileGrid
            entries={data?.entries || []}
            volume={volume}
            onNavigate={navigateTo}
            onPreview={setPreviewFile}
          />
        )}
      )}
      {/* Preview Modal */}
      {previewFile && (
        <PreviewModal
          file={previewFile}
          volume={volume}
          onClose={() => setPreviewFile(null)}
        />
      )}

      {/* Share Dialog */}
      {shareFile && (
        <ShareDialog
          file={shareFile}
          volume={volume}
          onClose={() => setShareFile(null)}
        />
      )}

      {/* Upload Progress Panel */}
      <UploadProgress
        uploads={uploads}
        onPause={pauseUpload}
        onResume={resumeUpload}
        onCancel={cancelUpload}
        onClearCompleted={clearCompleted}
      />
    </div>
  );
}

export default function FileBrowser({ initialVolume }: { initialVolume?: string }) {
  return (
    <QueryClientProvider client={queryClient}>
      <FileBrowserInner initialVolume={initialVolume} />
    </QueryClientProvider>
  );
}
