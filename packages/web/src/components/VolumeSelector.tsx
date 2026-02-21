import { useQuery } from "@tanstack/react-query";
import { api, type VolumeInfo } from "../lib/api";
import { HardDrive } from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

interface VolumeSelectorProps {
  selectedVolume: string;
  onSelect: (volumeId: string) => void;
}

export default function VolumeSelector({
  selectedVolume,
  onSelect,
}: VolumeSelectorProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["volumes"],
    queryFn: () => api.getVolumes(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400">
        <HardDrive size={16} />
        Loading volumes...
      </div>
    );
  }

  const volumes = data?.volumes || [];

  if (volumes.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500">
        <HardDrive size={16} />
        No volumes configured
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <HardDrive size={16} className="text-gray-400 shrink-0" />
      <select
        value={selectedVolume}
        onChange={(e) => onSelect(e.target.value)}
        className="bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
      >
        {volumes.map((v: VolumeInfo) => (
          <option key={v.id} value={v.id}>
            {v.label} — {formatBytes(v.usedBytes)} / {formatBytes(v.totalBytes)}
          </option>
        ))}
      </select>
    </div>
  );
}
