// App.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveAs } from "file-saver";

interface Point {
  time: number;
  x: number;
  y: number;
}

const App: React.FC = () => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [maxX, setMaxX] = useState(10);
  const [maxY, setMaxY] = useState(10);
  const [recording, setRecording] = useState(false);
  const [data, setData] = useState<Point[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasScale, setCanvasScale] = useState(1);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const mousePositionRef = useRef<{ x: number; y: number } | null>(null);

  const updateCanvasSize = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const maxWidth = window.innerWidth * 0.9;
    const maxHeight = window.innerHeight * 0.6;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
    setCanvasScale(scale);

    const canvas = canvasRef.current;
    canvas.width = image.width * scale;
    canvas.height = image.height * scale;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    }
  }, [image]);

  useEffect(() => {
    window.addEventListener("resize", updateCanvasSize);
    return () => window.removeEventListener("resize", updateCanvasSize);
  }, [updateCanvasSize]);

  useEffect(() => {
    if (image) updateCanvasSize();
  }, [image, updateCanvasSize]);

  const scaleX = useMemo(() => (image ? maxX / (image.width * canvasScale) : 1), [image, maxX, canvasScale]);
  const scaleY = useMemo(() => (image ? maxY / (image.height * canvasScale) : 1), [image, maxY, canvasScale]);

  const downloadCSV = useCallback(() => {
    if (!data.length) return;
    const csv = ["time,x,y", ...data.map(d => `${d.time},${d.x},${d.y}`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "walk_trace.csv");
  }, [data]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (!recording && !waiting) {
          setWaiting(true);
          setTimeout(() => {
            setData([]);
            setElapsedTime(0);
            lastPointRef.current = null;
            setStartTime(performance.now());
            if (canvasRef.current && image) {
              const ctx = canvasRef.current.getContext("2d");
              if (ctx) {
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                ctx.drawImage(image, 0, 0, canvasRef.current.width, canvasRef.current.height);
              }
            }
            setRecording(true);
            setWaiting(false);
          }, 3000);
        } else if (recording) {
          setRecording(false);
          downloadCSV();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [recording, waiting, downloadCSV, image]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePositionRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    if (!recording || !canvasRef.current || !startTime) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let intervalId: number;

    intervalId = window.setInterval(() => {
      const mousePos = mousePositionRef.current;
      if (!mousePos) return;
      const rect = canvas.getBoundingClientRect();
      const mouseX = mousePos.x;
      const mouseY = mousePos.y;

      if (
        mouseX >= rect.left &&
        mouseX <= rect.right &&
        mouseY >= rect.top &&
        mouseY <= rect.bottom
      ) {
        const rawX = mouseX - rect.left;
        const rawY = mouseY - rect.top;
        const x = rawX * scaleX;
        const y = (rect.height - rawY) * scaleY;
        const now = performance.now();
        const time = Math.round(now - startTime);

        setData(prev => {
          const updated = [...prev, { time, x: parseFloat(x.toFixed(2)), y: parseFloat(y.toFixed(2)) }];
          if (ctx && lastPointRef.current) {
            ctx.beginPath();
            ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
            ctx.lineTo(rawX, rawY);
            ctx.strokeStyle = "red";
            ctx.lineWidth = 2;
            ctx.stroke();
          }
          lastPointRef.current = { x: rawX, y: rawY };
          return updated;
        });
      }
      setElapsedTime((performance.now() - startTime) / 1000);
    }, 1000 / 60);

    return () => clearInterval(intervalId);
  }, [recording, scaleX, scaleY, startTime]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        setMaxX(img.width);
        setMaxY(img.height);
      };
      img.src = URL.createObjectURL(file);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">歩行軌跡記録アプリ</h1>
      <div className="mb-2">
        <input type="file" accept="image/png" onChange={handleImageUpload} />
      </div>
      <div className="mb-2">
        <label>最大X座標: </label>
        <input type="number" value={maxX} onChange={(e) => setMaxX(parseFloat(e.target.value))} />
        <label className="ml-4">最大Y座標: </label>
        <input type="number" value={maxY} onChange={(e) => setMaxY(parseFloat(e.target.value))} />
      </div>
      <p>スペースを押して計測開始</p>
      {waiting && <p className="mt-2 text-yellow-500">3秒後に開始します...</p>}
      {recording && <p className="mt-2 text-green-600">記録中: {elapsedTime.toFixed(2)} 秒</p>}
      <canvas
        ref={canvasRef}
        className="border mt-4"
        style={{ display: image ? "block" : "none", width: image ? image.width * canvasScale : 0, height: image ? image.height * canvasScale : 0 }}
      />
    </div>
  );
};

export default App;