import { useCallback, useRef, RefObject } from "react";
import { saveAs } from "file-saver";

type SetRecording = (r: boolean) => void;

export default function useCanvasRecorder(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  setRecording: SetRecording
) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const selectedMimeRef = useRef<string | null>(null);

  const startRecording = useCallback(() => {
    if (!canvasRef.current) return;

    recordedChunksRef.current = [];
    const stream = canvasRef.current.captureStream(30); // 30fps

    const candidates = [
      "video/mp4; codecs=avc1.42001E,mp4a.40.2",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];

    // 対応しているビデオのタイプを選択する(mp4が使えないならwebm)
    let options: MediaRecorderOptions | undefined;
    for(const c of candidates) {
      if(typeof MediaRecorder !== "undefined" && "isTypeSupported" in MediaRecorder) {
        if(MediaRecorder.isTypeSupported(c)) {
          options = {mimeType : c};
          selectedMimeRef.current = c;
          break;
        }
      }
    }

    // 対応しているタイプを選んでMediaRecorderを生成する
    let mediaRecorder : MediaRecorder;
    try {
      mediaRecorder = options ? new MediaRecorder(stream, options) : new MediaRecorder(stream);
      selectedMimeRef.current = selectedMimeRef.current || mediaRecorder.mimeType || null;
    }catch {
      mediaRecorder = new MediaRecorder(stream);
      selectedMimeRef.current = mediaRecorder.mimeType || selectedMimeRef.current || null;
    }

    mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstart = () => {
	  console.log("録画を開始");
      setRecording(true);
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
  }, [canvasRef, setRecording]);

  const stopRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    if (!mediaRecorder || mediaRecorder.state === "inactive") return;

    mediaRecorder.onstop = () => {
      const firstType = recordedChunksRef.current[0]?.type || "video/webm"
      const lower = firstType.toLowerCase();
      const ext = lower.includes("mp4") || lower.includes("mpeg") ? "mp4" : lower.includes("webm") ? "webm" : "webm";
      const blob = new Blob(recordedChunksRef.current, { type: firstType });
      saveAs(blob, `canvas_recording.${ext}`);
      recordedChunksRef.current = [];
	    console.log("録画を停止");
      setRecording(false);
    };

    mediaRecorder.stop();
    mediaRecorderRef.current = null;
  }, [setRecording]);

  return { startRecording, stopRecording };
}
