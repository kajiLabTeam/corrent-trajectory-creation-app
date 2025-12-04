import { useCallback, useRef, RefObject } from "react";
import { saveAs } from "file-saver";

type SetRecording = (r: boolean) => void;

export default function useCanvasRecorder(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  setRecording: SetRecording
) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(() => {
    if (!canvasRef.current) return;

    recordedChunksRef.current = [];
    const stream = canvasRef.current.captureStream(30); // 30fps
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp9",
    });

    mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstart = () => {
	  console.log("録画を開始できる");
      setRecording(true);
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
  }, [canvasRef, setRecording]);

  const stopRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    if (!mediaRecorder || mediaRecorder.state === "inactive") return;

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
      saveAs(blob, "canvas_recording.webm");
      recordedChunksRef.current = [];
	  console.log("録画を開始できる");
      setRecording(false);
    };

    mediaRecorder.stop();
    mediaRecorderRef.current = null;
  }, [setRecording]);

  return { startRecording, stopRecording };
}
