"use client";

import { UploadCloud } from "lucide-react";
import { useEffect, useMemo } from "react";

import { cn } from "@/lib/utils";

type FileDropZoneProps = {
  label: string;
  description: string;
  accept: string;
  file: File | null;
  valid: boolean;
  disabled?: boolean;
  convertRasterToWebp?: boolean;
  onFile: (file: File | null) => void;
};

async function convertToWebp(file: File) {
  if (!/^image\/(png|jpeg)$/.test(file.type)) return file;
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(bitmap, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
  if (!blob) return file;
  const name = file.name.replace(/\.(png|jpe?g)$/i, ".webp");
  return new File([blob], name, { type: "image/webp" });
}

export function FileDropZone({
  label,
  description,
  accept,
  file,
  valid,
  disabled,
  convertRasterToWebp,
  onFile,
}: FileDropZoneProps) {
  const preview = useMemo(() => {
    if (!file || !file.type.startsWith("image/")) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  return (
    <label
      className={cn(
        "grid min-h-56 cursor-pointer place-items-center gap-3 rounded-[16px] border border-dashed border-[var(--border)] bg-[var(--surface)] p-5 text-center transition hover:border-[var(--primary-border)] hover:bg-[var(--primary-soft)]",
        file && valid && "border-[var(--success)]",
        file && !valid && "border-[var(--danger)]",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <input
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        onChange={async (event) => {
          const next = event.target.files?.[0] ?? null;
          onFile(next && convertRasterToWebp ? await convertToWebp(next) : next);
          event.target.value = "";
        }}
      />
      {preview ? (
        <img src={preview} alt={`${label} preview`} className="max-h-28 rounded-[12px] object-cover" />
      ) : (
        <UploadCloud className="size-8 text-[var(--primary)]" />
      )}
      <span className="grid gap-1">
        <strong>{label}</strong>
        <small className="text-[var(--muted)]">{description}</small>
        {file ? (
          <small className={valid ? "text-[var(--success)]" : "text-[var(--danger)]"}>
            {file.name} ({Math.round(file.size / 1024)} KB)
          </small>
        ) : null}
      </span>
    </label>
  );
}
