"use client";

import { useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { upload } from "@vercel/blob/client";
import {
  Upload03Icon,
  Delete02Icon,
  ImageUpload01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ImageCropperDialog } from "@/components/shared/image-cropper-dialog";
import {
  IMAGE_UPLOAD_MAX_BYTES,
  getImageUploadMaxBytes,
} from "@/lib/images/upload-limits";
import { cn } from "@/lib/utils";

type ImageUploadFieldProps = {
  value: string | null;
  onChange: (url: string | null) => void | Promise<void>;
  pathPrefix: string;
  /** Fixed crop aspect ratio. Omit for free-form cropping (e.g. scorecards). */
  aspectRatio?: number;
  /** Upload the selected image without opening the cropper. */
  skipCrop?: boolean;
  fallback?: React.ReactNode;
  disabled?: boolean;
  onUploadingChange?: (uploading: boolean) => void;
  className?: string;
  variant?: "avatar" | "wide" | "freeform";
  /** Optional title rendered inline with the upload buttons for non-avatar variants. */
  title?: React.ReactNode;
  /** Optional description rendered below the title. */
  description?: React.ReactNode;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getCompressionOptions(maxUploadBytes: number, fallback = false) {
  const isScorecardUpload = maxUploadBytes > IMAGE_UPLOAD_MAX_BYTES;

  return {
    maxSizeMB: fallback
      ? isScorecardUpload
        ? 1.5
        : 0.75
      : isScorecardUpload
        ? 2
        : 1,
    maxWidthOrHeight: fallback ? 1800 : isScorecardUpload ? 3000 : 2400,
    useWebWorker: true,
    fileType: "image/webp" as const,
    initialQuality: fallback ? 0.75 : 0.85,
    maxIteration: fallback ? 25 : 20,
  };
}

async function compressForUpload(file: File, maxUploadBytes: number) {
  const compressed = await imageCompression(
    file,
    getCompressionOptions(maxUploadBytes),
  );
  if (compressed.size <= maxUploadBytes) return compressed;

  const smaller = await imageCompression(
    file,
    getCompressionOptions(maxUploadBytes, true),
  );
  if (smaller.size <= maxUploadBytes) return smaller;

  throw new Error(
    `Image is still too large after compression (${formatBytes(smaller.size)}). Try cropping tighter or choose a smaller image.`,
  );
}

function getUploadErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Upload failed";
  const normalized = message.toLowerCase();
  if (
    normalized.includes("file too large") ||
    normalized.includes("maximum allowed size") ||
    normalized.includes("body size")
  ) {
    return "Image is too large to upload. Try cropping tighter or choose a smaller image.";
  }
  return message;
}

export function ImageUploadField({
  value,
  onChange,
  pathPrefix,
  aspectRatio,
  skipCrop = false,
  fallback,
  disabled,
  onUploadingChange,
  className,
  variant = "avatar",
  title,
  description,
}: ImageUploadFieldProps) {
  const effectiveAspectRatio =
    variant === "freeform" ? undefined : (aspectRatio ?? 1);
  const maxUploadBytes = getImageUploadMaxBytes(pathPrefix);
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

  const uploadImage = async (
    blob: Blob,
    sourceName: string,
    sourceSize: number,
  ) => {
    setUploading(true);
    try {
      const file = new File([blob], sourceName, { type: blob.type });
      const compressed = await compressForUpload(file, maxUploadBytes);
      console.log(
        `[image-upload] ${sourceName}: ${formatBytes(sourceSize)} → ${formatBytes(compressed.size)} (${Math.round((compressed.size / sourceSize) * 100)}%)`,
      );
      const filename = `${pathPrefix.replace(/\/$/, "")}/image-${Date.now()}.webp`;

      const result = await upload(filename, compressed, {
        access: "public",
        handleUploadUrl: "/api/upload",
        contentType: "image/webp",
      });

      await onChange(result.url);
    } catch (e) {
      console.error(e);
      setError(getUploadErrorMessage(e));
    } finally {
      setPendingFile(null);
      setUploading(false);
    }
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    if (skipCrop) {
      await uploadImage(file, file.name, file.size);
      return;
    }
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
    await uploadImage(croppedBlob, pendingFile.name, pendingFile.size);
  };

  const helperText = error ? <p className="text-destructive">{error}</p> : null;

  if (variant === "avatar") {
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
                onClick={() => onChange(null)}
                disabled={disabled || isUploading}
              >
                <HugeiconsIcon icon={Delete02Icon} data-icon="inline-start" />
                Remove
              </Button>
            ) : null}
          </div>
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
          aspectRatio={effectiveAspectRatio}
          open={cropperOpen}
          onOpenChange={handleCropperOpenChange}
          onCropped={handleCropped}
        />
      </div>
    );
  }

  const previewAspectRatio =
    variant === "wide"
      ? effectiveAspectRatio
      : aspectRatio; /* freeform with optional aspect ratio */

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {title ? (
        <div className="flex flex-col gap-1">
          <p className="leading-none font-medium">{title}</p>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      ) : null}

      {value ? (
        <div className="flex flex-col gap-2">
          {previewAspectRatio ? (
            <div
              className="relative w-full overflow-hidden rounded-md border"
              style={{ aspectRatio: `${previewAspectRatio}` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={value}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt=""
              className="w-full max-h-80 rounded-md border object-contain"
            />
          )}
          <div className="flex flex-wrap gap-2 self-start">
            <Button
              type="button"
              variant="outline"
              onClick={handlePick}
              disabled={disabled || isUploading}
            >
              <HugeiconsIcon icon={Upload03Icon} data-icon="inline-start" />
              {isUploading ? "Uploading…" : "Replace image"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onChange(null)}
              disabled={disabled || isUploading}
            >
              <HugeiconsIcon icon={Delete02Icon} data-icon="inline-start" />
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <HugeiconsIcon icon={ImageUpload01Icon} size={32} />
            {fallback ? (
              <p className="text-muted-foreground">{fallback}</p>
            ) : null}
            <Button
              type="button"
              variant="default"
              onClick={handlePick}
              disabled={disabled || isUploading}
            >
              {isUploading ? "Uploading…" : "Choose image"}
            </Button>
          </CardContent>
        </Card>
      )}

      {helperText}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFile}
      />

      <ImageCropperDialog
        file={pendingFile}
        aspectRatio={effectiveAspectRatio}
        open={cropperOpen}
        onOpenChange={handleCropperOpenChange}
        onCropped={handleCropped}
      />
    </div>
  );
}
