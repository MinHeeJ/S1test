import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Resume } from "../../domain/resume/types";
import { ApiRequestError } from "../../shared/apiClient";
import { resumeApi } from "./api";
import { ResumeRenderer } from "./ResumeRenderer";

/** Printing requires server readback, the selected real font face and every original image to be ready. */
export async function preparePrint(
  root: HTMLElement,
  resume: Resume,
): Promise<void> {
  if (!document.fonts) throw new Error("인쇄 글꼴 준비를 확인할 수 없습니다.");
  await document.fonts.ready;
  const family =
    resume.style.font === "pretendard"
      ? "Pretendard"
      : "Noto Serif KR Variable";
  const faces: FontFace[] = [];
  document.fonts.forEach((face) => {
    if (face.family.replace(/["']/g, "") === family) faces.push(face);
  });
  if (!faces.length) throw new Error("이력서 글꼴이 제공되지 않았습니다.");
  await Promise.all(faces.map((face) => face.load()));
  await Promise.all(
    Array.from(
      root.querySelectorAll<HTMLImageElement>(".resume-paper img"),
    ).map(async (image) => {
      if (image.decode) await image.decode();
      else if (!image.complete)
        await new Promise<void>((resolve, reject) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener(
            "error",
            () => reject(new Error("사진을 불러오지 못했습니다.")),
            { once: true },
          );
        });
      if (!image.naturalWidth) throw new Error("사진을 불러오지 못했습니다.");
    }),
  );
}
export function PrintPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [resume, setResume] = useState<Resume>();
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  useEffect(() => {
    let active = true;
    if (!id) return;
    void resumeApi
      .get(id)
      .then((result) => {
        if (!active) return;
        if (!result.data) throw new Error("저장본을 가져오지 못했습니다.");
        setResume(result.data);
      })
      .catch((value) => {
        if (!active) return;
        setError(
          value instanceof ApiRequestError && value.status === 404
            ? "자료를 찾을 수 없습니다."
            : "인쇄 준비 실패",
        );
        if (
          value instanceof ApiRequestError &&
          value.status === 401 &&
          window.parent === window
        )
          navigate("/login");
        window.parent.postMessage(
          value instanceof ApiRequestError && value.status === 401
            ? "resume-print-unauthorized"
            : "resume-print-error",
          window.location.origin,
        );
      });
    return () => {
      active = false;
    };
  }, [id, navigate]);
  useEffect(() => {
    if (!ready || !resume || !root.current || started.current) return;
    started.current = true;
    let active = true;
    const done = () =>
      window.parent.postMessage("resume-print-done", window.location.origin);
    window.addEventListener("afterprint", done);
    void preparePrint(root.current, resume)
      .then(() => {
        if (!active) return;
        const basics = resume.content.find((s) => s.type === "basics");
        if (basics?.type === "basics") {
          document.title = `${basics.data.name}_${basics.data.jobTitle}_이력서`;
        }
        if (window.parent !== window) window.print();
      })
      .catch((value) => {
        if (active)
          setError(value instanceof Error ? value.message : "인쇄 준비 실패");
        window.parent.postMessage("resume-print-error", window.location.origin);
      });
    return () => {
      active = false;
      window.removeEventListener("afterprint", done);
    };
  }, [ready, resume]);
  return (
    <main className="resume-print" ref={root}>
      {error ? (
        <p role="alert">{error}</p>
      ) : resume ? (
        <ResumeRenderer
          resume={resume}
          onReady={() => setReady(true)}
          onError={(message) => {
            setError(message);
            window.parent.postMessage(
              "resume-print-error",
              window.location.origin,
            );
          }}
        />
      ) : (
        <p role="status">인쇄 저장본 불러오는 중…</p>
      )}
    </main>
  );
}
