import { useState } from "react";
import { photoUrl } from "./photoApi";
import "./photos.css";

export interface PhotoImageProps {
  photoId: string | null;
  alt?: string;
  onReady?: () => void;
  onFailure?: () => void;
}

/** Shared original-image view for input, renderer and print; never crops server bytes. */
export function PhotoImage({
  photoId,
  alt = "이력서 사진",
  onReady,
  onFailure,
}: PhotoImageProps) {
  if (!photoId) return null;
  return <OwnedPhoto key={photoId} {...{ photoId, alt, onReady, onFailure }} />;
}

function OwnedPhoto({
  photoId,
  alt,
  onReady,
  onFailure,
}: PhotoImageProps & { photoId: string }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  return (
    <div className="photo-view" aria-busy={state === "loading"}>
      {state === "loading" && (
        <span className="photo-loading" role="status">
          사진 불러오는 중…
        </span>
      )}
      {state === "error" && (
        <span role="alert">사진을 불러오지 못했습니다.</span>
      )}
      {state !== "error" && (
        <img
          src={photoUrl(photoId)}
          alt={alt}
          className="resume-photo"
          style={{
            aspectRatio: "3 / 4",
            objectFit: "cover",
            visibility: state === "ready" ? "visible" : "hidden",
          }}
          onLoad={() => {
            setState("ready");
            onReady?.();
          }}
          onError={() => {
            setState("error");
            onFailure?.();
          }}
        />
      )}
    </div>
  );
}
