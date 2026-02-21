import { useState } from "react";
import { registerPasskey } from "../lib/passkeys";
import { Fingerprint, Loader2, CheckCircle } from "lucide-react";

export default function PasskeySetup() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState("");

  const handleRegister = async () => {
    setStatus("loading");
    setError("");
    try {
      const verified = await registerPasskey();
      if (verified) {
        setStatus("success");
        setTimeout(() => {
          window.location.href = "/";
        }, 1000);
      } else {
        setStatus("error");
        setError("Registration was not verified");
      }
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Registration failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="MiniNAS" className="w-24 h-24 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Welcome to MiniNAS</h1>
          <p className="text-gray-400">
            Set up your passkey to secure your NAS. This will use your device's
            biometric authentication (Touch ID, Face ID, etc.)
          </p>
        </div>

        <div className="bg-brand-900/50 border border-brand-800/50 rounded-lg p-6">
          {status === "success" ? (
            <div className="text-center py-4">
              <CheckCircle size={48} className="mx-auto mb-3 text-green-500" />
              <p className="text-lg font-medium">Passkey registered!</p>
              <p className="text-gray-400 text-sm mt-1">Redirecting...</p>
            </div>
          ) : (
            <>
              <button
                onClick={handleRegister}
                disabled={status === "loading"}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
              >
                {status === "loading" ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Fingerprint size={20} />
                )}
                {status === "loading"
                  ? "Waiting for device..."
                  : "Register Passkey"}
              </button>

              {error && (
                <p className="mt-3 text-sm text-red-400 text-center">
                  {error}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
