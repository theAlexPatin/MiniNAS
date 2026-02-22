import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import { RefreshCw, Loader2, Package } from "lucide-react";

export default function UpdateSection() {
  const [restarting, setRestarting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["version"],
    queryFn: () => api.getVersion(),
  });

  const updateMutation = useMutation({
    mutationFn: () => api.triggerUpdate(),
    onSuccess: () => {
      setRestarting(true);
    },
  });

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
      <div className="flex items-center gap-2.5 mb-3">
        <Package size={18} className="text-gray-700" />
        <h2 className="text-sm font-semibold text-gray-900">Software Update</h2>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">
            Current version:{" "}
            {isLoading ? (
              <span className="text-gray-400">loading...</span>
            ) : (
              <span className="font-mono font-medium text-gray-800">
                {data?.version || "unknown"}
              </span>
            )}
          </p>
        </div>

        {restarting ? (
          <div className="flex items-center gap-2 text-sm text-amber-600">
            <Loader2 size={16} className="animate-spin" />
            Restarting...
          </div>
        ) : (
          <button
            onClick={() => {
              if (confirm("Update MiniNAS and restart the server?")) {
                updateMutation.mutate();
              }
            }}
            disabled={updateMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updateMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            Update & Restart
          </button>
        )}
      </div>

      {updateMutation.isError && (
        <p className="mt-2 text-sm text-red-600">
          Failed to trigger update. Is MiniNAS installed via Homebrew?
        </p>
      )}
    </div>
  );
}
