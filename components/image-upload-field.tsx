"use client";

import { useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { upload } from "@vercel/blob/client";
import { Upload03Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ImageUploadFieldProps = {
  value: string | null;
  onChange: (url: string | null) => void;
  pathPrefix: string;
  fallback?: React.ReactNode;
  disabled?: boolean;
  onUploadingChange?: (uploading: boolean) => void;
  className?: string;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const COMPRESSION_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1024,
  useWebWorker: true,
  fileType: "image/webp" as const,
  initialQuality: 0.85,
};

export function ImageUploadField({
  value,
  onChange,
  pathPrefix,
  fallback,
  disabled,
  onUploadingChange,
  className,
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setUploading = (next: boolean) => {
    setIsUploading(next);
    onUploadingChange?.(next);
  };

  const handlePick = () => {
    if (disabled || isUploading) return;
    inputRef.current?.click();
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const compressed = await imageCompression(file, COMPRESSION_OPTIONS);
      console.log(
        `[image-upload] ${file.name}: ${formatBytes(file.size)} → ${formatBytes(compressed.size)} (${Math.round((compressed.size / file.size) * 100)}%)`,
      );
      const filename = `${pathPrefix.replace(/\/$/, "")}/avatar-${Date.now()}.webp`;

      const result = await upload(filename, compressed, {
        access: "public",
        handleUploadUrl: "/api/upload",
        contentType: "image/webp",
      });

      onChange(result.url);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <Avatar size="lg" className="size-16 rounded-lg">
        {value ? <AvatarImage src={value} alt="" /> : null}
        <AvatarFallback className="text-lg">{fallback ?? "?"}</AvatarFallback>
      </Avatar>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePick}
            disabled={disabled || isUploading}
          >
            <HugeiconsIcon icon={Upload03Icon} data-icon="inline-start" />
            {isUploading ? "Uploading…" : value ? "Replace" : "Upload"}
          </Button>
          {value ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(null)}
              disabled={disabled || isUploading}
            >
              <HugeiconsIcon icon={Delete02Icon} data-icon="inline-start" />
              Remove
            </Button>
          ) : null}
        </div>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            JPG, PNG, or WebP up to 2MB
          </p>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}
