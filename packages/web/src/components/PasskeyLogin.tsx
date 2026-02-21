import { useState } from "react";
import { authenticatePasskey } from "../lib/passkeys";
import { Fingerprint, Loader2 } from "lucide-react";

export default function PasskeyLogin() {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setStatus("loading");
    setError("");
    try {
      const verified = await authenticatePasskey();
      if (verified) {
        window.location.href = "/";
      } else {
        setStatus("error");
        setError("Authentication was not verified");
      }
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Authentication failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="MiniNAS" className="w-24 h-24 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">MiniNAS</h1>
          <p className="text-gray-400">Sign in with your passkey</p>
        </div>

        <div className="bg-brand-900/50 border border-brand-800/50 rounded-lg p-6">
          <button
            onClick={handleLogin}
            disabled={status === "loading"}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
          >
            {status === "loading" ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Fingerprint size={20} />
            )}
            {status === "loading" ? "Waiting for device..." : "Sign In"}
          </button>

          {error && (
            <p className="mt-3 text-sm text-red-400 text-center">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
