import type { AttachmentItem } from "@clawui/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type LocalAttachment = {
  id: string;
  image: ComposerImageAttachment;
  item: AttachmentItem;
  objectUrl?: string;
};

export type ComposerImageAttachment = {
  id: string;
  filename: string;
  mediaType: string;
  size: number;
};

const MAX_IMAGE_ATTACHMENTS = 5;

function createLocalId(): string {
  const cryptoObj = (globalThis as unknown as { crypto?: Crypto }).crypto;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useImageAttachments() {
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const attachmentsRef = useRef<LocalAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    return () => {
      for (const a of attachmentsRef.current) {
        if (a.objectUrl) URL.revokeObjectURL(a.objectUrl);
      }
    };
  }, []);

  const attachmentItems: AttachmentItem[] = useMemo(
    () => attachments.map((a) => a.item),
    [attachments],
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.objectUrl) URL.revokeObjectURL(target.objectUrl);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onPickFiles = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    const next: LocalAttachment[] = [];
    const remainingSlots = Math.max(0, MAX_IMAGE_ATTACHMENTS - attachmentsRef.current.length);
    if (remainingSlots === 0) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    let acceptedCount = 0;
    for (const file of Array.from(files)) {
      if (!file.type.toLowerCase().startsWith("image/")) continue;
      if (acceptedCount >= remainingSlots) break;
      const id = createLocalId();
      const objectUrl = URL.createObjectURL(file);
      const image: ComposerImageAttachment = {
        id,
        filename: file.name || "image",
        mediaType: file.type || "image/*",
        size: Number.isFinite(file.size) ? file.size : 0,
      };
      next.push({
        id,
        image,
        objectUrl,
        item: {
          id,
          filename: image.filename,
          mediaType: file.type || undefined,
          url: objectUrl,
        },
      });
      acceptedCount += 1;
    }
    if (next.length > 0) {
      setAttachments((prev) => [...prev, ...next]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  /** Take images out and clear — call on submit. */
  const getImagesAndClear = useCallback((): ComposerImageAttachment[] => {
    const images = attachmentsRef.current.map((a) => a.image);
    setAttachments((prev) => {
      for (const a of prev) if (a.objectUrl) URL.revokeObjectURL(a.objectUrl);
      return [];
    });
    return images;
  }, []);

  return {
    attachments,
    attachmentsRef,
    attachmentItems,
    fileInputRef,
    removeAttachment,
    openFilePicker,
    onPickFiles,
    getImagesAndClear,
  };
}
