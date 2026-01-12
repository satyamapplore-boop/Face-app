import { useEffect, useRef, useState } from "react";
import { FaceMesh } from "@mediapipe/face_mesh";
import { Camera } from "@mediapipe/camera_utils";
import { drawLandmarks } from "@mediapipe/drawing_utils";
import { useCamera } from "../hooks/useCamera";

const DEFAULT_STATUS = "Click Start Camera to begin.";

const FaceTracker = () => {
  const { start, status, error, stream } = useCamera();
  const [trackingStatus, setTrackingStatus] = useState(DEFAULT_STATUS);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const faceMeshRef = useRef<FaceMesh | null>(null);
  const cameraRef = useRef<Camera | null>(null);

  useEffect(() => {
    const faceMesh = new FaceMesh({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });

    faceMesh.onResults((results) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

      const { width, height } = results.image;
      canvas.width = width;
      canvas.height = height;
      ctx.clearRect(0, 0, width, height);

      const faces = results.multiFaceLandmarks;
      if (!faces || faces.length === 0) {
        setTrackingStatus("No face detected");
        return;
      }

      setTrackingStatus("Tracking face");
      faces.forEach((landmarks) => {
        drawLandmarks(ctx, landmarks, {
          color: "#22d3ee",
          lineWidth: 1,
          radius: 1.4,
        });
      });
    });

    faceMeshRef.current = faceMesh;

    return () => {
      faceMesh.close();
      faceMeshRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!stream || !videoRef.current || !faceMeshRef.current) return;

    videoRef.current.srcObject = stream;
    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        if (!videoRef.current) return;
        await faceMeshRef.current?.send({ image: videoRef.current });
      },
      width: 720,
      height: 540,
    });

    cameraRef.current?.stop();
    cameraRef.current = camera;
    camera.start();
    setTrackingStatus("Camera active. Looking for a face...");

    return () => {
      camera.stop();
    };
  }, [stream]);

  useEffect(() => {
    if (error) {
      setTrackingStatus(error);
    }
  }, [error]);

  const handleStart = async () => {
    setTrackingStatus("Requesting camera access...");
    await start();
  };

  const statusText = error ?? trackingStatus;
  const isError = Boolean(error);
  const isStarting = status === "requesting";
  const isActive = status === "ready";

  return (
    <section className="w-full rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)] backdrop-blur">
      <div className="flex flex-col gap-4">
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={handleStart}
          disabled={isStarting || isActive}
        >
          {isActive ? "Camera Active" : isStarting ? "Starting..." : "Start Camera"}
        </button>
        <p className={`text-sm ${isError ? "text-rose-600" : "text-slate-500"}`}>
          {statusText}
        </p>
      </div>

      <div className="relative mt-6 aspect-video w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-950/5">
        <video
          ref={videoRef}
          className={`h-full w-full object-cover transition-opacity ${
            stream ? "opacity-100" : "opacity-0"
          }`}
          autoPlay
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
        {!stream && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
            Camera preview appears here
          </div>
        )}
      </div>
    </section>
  );
};

export default FaceTracker;
