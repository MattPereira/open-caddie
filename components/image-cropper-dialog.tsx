"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { getCroppedBlob } from "@/lib/crop-image";

type ImageCropperDialogProps = {
  file: File | null;
  aspectRatio: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCropped: (blob: Blob) => void;
};

export function ImageCropperDialog({
  file,
  aspectRatio,
  open,
  onOpenChange,
  onCropped,
}: ImageCropperDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [prevFile, setPrevFile] = useState(file);

  if (file !== prevFile) {
    setPrevFile(file);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  }

  const imageSrc = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );

  useEffect(() => {
    if (!imageSrc) return;
    return () => URL.revokeObjectURL(imageSrc);
  }, [imageSrc]);

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleDone = async () => {
    if (!file || !croppedAreaPixels) return;
    setIsProcessing(true);
    try {
      const blob = await getCroppedBlob(file, croppedAreaPixels);
      onCropped(blob);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-dvh w-full max-w-none flex-col gap-0 p-0 sm:h-auto sm:max-w-lg sm:rounded-lg">
        <DialogHeader className="shrink-0 p-4">
          <DialogTitle>Crop image</DialogTitle>
          <DialogDescription>
            Drag to reposition, pinch or use the slider to zoom.
          </DialogDescription>
        </DialogHeader>

        <div className="relative flex-1 bg-black sm:aspect-square sm:flex-none">
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspectRatio}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          ) : null}
        </div>

        <div className="shrink-0 px-4 py-3">
          <Slider
            value={[zoom]}
            min={1}
            max={3}
            step={0.01}
            onValueChange={(value) => setZoom(value[0])}
            aria-label="Zoom"
          />
        </div>

        <DialogFooter className="shrink-0 p-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleDone}
            disabled={isProcessing || !croppedAreaPixels}
          >
            {isProcessing ? "Processing…" : "Done"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
