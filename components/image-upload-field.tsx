"use client";

import { useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { upload } from "@vercel/blob/client";
import { Upload03Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ImageCropperDialog } from "@/components/image-cropper-dialog";
import { cn } from "@/lib/utils";

type ImageUploadFieldProps = {
  value: string | null;
  onChange: (url: string | null) => void;
  pathPrefix: string;
  aspectRatio?: number;
  fallback?: React.ReactNode;
  disabled?: boolean;
  onUploadingChange?: (uploading: boolean) => void;
  className?: string;
  variant?: "avatar" | "wide";
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const COMPRESSION_OPTIONS = {
  maxSizeMB: 1,
  useWebWorker: true,
  fileType: "image/webp" as const,
  initialQuality: 0.85,
};

export function ImageUploadField({
  value,
  onChange,
  pathPrefix,
  aspectRatio = 1,
  fallback,
  disabled,
  onUploadingChange,
  className,
  variant = "avatar",
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);

  const setUploading = (next: boolean) => {
    setIsUploading(next);
    onUploadingChange?.(next);
  };

  const handlePick = () => {
    if (disabled || isUploading) return;
    inputRef.current?.click();
  };

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    setPendingFile(file);
    setCropperOpen(true);
  };

  const handleCropperOpenChange = (open: boolean) => {
    setCropperOpen(open);
    if (!open) setPendingFile(null);
  };

  const handleCropped = async (croppedBlob: Blob) => {
    if (!pendingFile) return;
    setCropperOpen(false);
    setUploading(true);
    try {
      const croppedFile = new File([croppedBlob], pendingFile.name, {
        type: croppedBlob.type,
      });
      const compressed = await imageCompression(
        croppedFile,
        COMPRESSION_OPTIONS,
      );
      console.log(
        `[image-upload] ${pendingFile.name}: ${formatBytes(pendingFile.size)} → ${formatBytes(compressed.size)} (${Math.round((compressed.size / pendingFile.size) * 100)}%)`,
      );
      const filename = `${pathPrefix.replace(/\/$/, "")}/image-${Date.now()}.webp`;

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
      setPendingFile(null);
      setUploading(false);
    }
  };

  const buttons = (
    <div
      className={cn(
        "flex gap-2",
        variant === "wide" ? "flex-col items-start" : "flex-wrap",
      )}
    >
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
  );

  const helperText = error ? (
    <p className="text-sm text-destructive">{error}</p>
  ) : null;

  return (
    <div className={cn("flex items-center gap-4", className)}>
      {variant === "wide" ? (
        <div
          className="relative w-1/2 shrink-0 overflow-hidden rounded-lg border bg-muted"
          style={{ aspectRatio: `${aspectRatio}` }}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              {fallback ?? "No image"}
            </div>
          )}
        </div>
      ) : (
        <Avatar size="lg" className="size-16 rounded-lg">
          {value ? <AvatarImage src={value} alt="" /> : null}
          <AvatarFallback className="text-lg">{fallback ?? "?"}</AvatarFallback>
        </Avatar>
      )}

      <div className="flex flex-col gap-2">
        {buttons}
        {helperText}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFile}
      />

      <ImageCropperDialog
        file={pendingFile}
        aspectRatio={aspectRatio}
        open={cropperOpen}
        onOpenChange={handleCropperOpenChange}
        onCropped={handleCropped}
      />
    </div>
  );
}
