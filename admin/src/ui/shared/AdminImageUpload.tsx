"use client";

import { useRef, useState } from "react";
import { uploadContentImages } from "../../adapters/http/contentApi";

export function AdminImageUpload({
  multiple = false,
  onUploaded,
}: {
  multiple?: boolean;
  onUploaded: (urls: string[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  return (
    <div className="admin-image-upload">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png"
        multiple={multiple}
        onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
      />
      <button
        type="button"
        disabled={files.length === 0 || uploading}
        onClick={async () => {
          setUploading(true);
          setError("");
          try {
            onUploaded(await uploadContentImages(files));
            setFiles([]);
            if (input.current) input.current.value = "";
          } catch (cause) {
            setError(
              cause instanceof Error ? cause.message : "업로드에 실패했습니다.",
            );
          } finally {
            setUploading(false);
          }
        }}
      >
        {uploading ? "업로드 중…" : "이미지 업로드"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
