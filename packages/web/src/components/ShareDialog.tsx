import { useState } from "react";
import { X, Copy, Check, Link2, Loader2 } from "lucide-react";
import type { FileEntry } from "../lib/api";
import { withBase } from "../lib/basePath";

interface ShareDialogProps {
  file: FileEntry;
  volume: string;
  onClose: () => void;
}

export default function ShareDialog({ file, volume, onClose }: ShareDialogProps) {
  const [password, setPassword] = useState("");
  const [maxDownloads, setMaxDownloads] = useState("");
  const [expiresIn, setExpiresIn] = useState("24");
  const [isPublic, setIsPublic] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    setCreating(true);
    setError("");
    try {
      const res = await fetch(withBase("/api/v1/share"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          volume,
          path: file.path,
          password: password || undefined,
          maxDownloads: maxDownloads ? parseInt(maxDownloads) : undefined,
          expiresIn: expiresIn ? parseInt(expiresIn) : undefined,
          isPublic: isPublic || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create share");
      }

      const data = await res.json();
      const url = data.url || `${window.location.origin}${withBase(`/api/v1/share/${data.share.id}/download`)}`;
      setShareUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create share");
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white border border-gray-200 rounded-lg max-w-md w-full p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Share File</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded transition-colors">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4 truncate">
          {file.name}
        </p>

        {shareUrl ? (
          <div>
            <label className="block text-sm text-gray-500 mb-1">Share URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-900"
              />
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-md text-sm font-medium shrink-0 transition-colors"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            {password && (
              <p className="text-xs text-gray-400 mt-2">
                Password: {password}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-500 mb-1">
                Password (optional)
              </label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave empty for no password"
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">
                Max downloads (optional)
              </label>
              <input
                type="number"
                value={maxDownloads}
                onChange={(e) => setMaxDownloads(e.target.value)}
                placeholder="Unlimited"
                min="1"
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">
                Expires in (hours)
              </label>
              <select
                value={expiresIn}
                onChange={(e) => setExpiresIn(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="1">1 hour</option>
                <option value="24">24 hours</option>
                <option value="168">7 days</option>
                <option value="720">30 days</option>
                <option value="">Never</option>
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm text-gray-700">
                Allow public access
              </span>
            </label>
            <p className="text-xs text-gray-400 -mt-1 ml-6">
              Anyone with the link can download, even outside your network
            </p>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <button
              onClick={handleCreate}
              disabled={creating}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-md font-medium text-sm transition-colors"
            >
              {creating ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Link2 size={16} />
              )}
              Create Share Link
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
