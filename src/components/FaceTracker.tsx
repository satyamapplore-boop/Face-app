import { useEffect, useRef, useState } from "react";
import { useCamera } from "../hooks/useCamera";
import { useFacePipeline } from "../hooks/useFacePipeline";

const DEFAULT_STATUS = "Waiting for camera";

const FaceTracker = () => {
  const { start, status, error, stream } = useCamera();
  const [trackingStatus, setTrackingStatus] = useState(DEFAULT_STATUS);
  const [showFaceMesh, setShowFaceMesh] = useState(true);
  const [showBoundingBox, setShowBoundingBox] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useFacePipeline({
    videoRef,
    canvasRef,
    stream,
    showFaceMesh,
    showBoundingBox,
    showRegions: false,
    onStatusChange: setTrackingStatus,
  });

  useEffect(() => {
    if (error) {
      setTrackingStatus(error);
    }
  }, [error]);

  const handleStart = async () => {
    setTrackingStatus("Waiting for camera");
    await start();
  };

  const statusText = error ?? trackingStatus;
  const isError = Boolean(error);
  const isStarting = status === "requesting";
  const isActive = status === "ready";

  return (
    <section className="w-full rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)] backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-4">
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
        <div className="flex items-center gap-4 text-xs uppercase tracking-[0.2em] text-slate-500">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-slate-900"
              checked={showBoundingBox}
              onChange={(event) => setShowBoundingBox(event.target.checked)}
            />
            Bounding Box
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-slate-900"
              checked={showFaceMesh}
              onChange={(event) => setShowFaceMesh(event.target.checked)}
            />
            Face Mesh
          </label>
        </div>
      </div>

      <div className="camera-stack relative mt-6 aspect-video w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-950/5">
        <video
          ref={videoRef}
          className="camera-feed"
          autoPlay
          playsInline
          muted
          width={720}
          height={540}
          onLoadedMetadata={() => {
            if (videoRef.current && canvasRef.current) {
              canvasRef.current.width = videoRef.current.videoWidth;
              canvasRef.current.height = videoRef.current.videoHeight;
            }
          }}
        />
        <canvas ref={canvasRef} className="camera-overlay" />
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
