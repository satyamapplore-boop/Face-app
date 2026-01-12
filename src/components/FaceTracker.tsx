import { useEffect, useRef, useState } from "react";
import { useCamera } from "../hooks/useCamera";
import { useFacePipeline } from "../hooks/useFacePipeline";

const DEFAULT_STATUS = "Click Start Camera to begin.";

const FaceTracker = () => {
  const { start, status, error, stream } = useCamera();
  const [trackingStatus, setTrackingStatus] = useState(DEFAULT_STATUS);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showFaceMesh, setShowFaceMesh] = useState(true);
  const [showBoundingBox, setShowBoundingBox] = useState(true);
  const [showRegions, setShowRegions] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useFacePipeline({
    videoRef,
    canvasRef,
    stream,
    showFaceMesh,
    showBoundingBox,
    showRegions,
    onStatusChange: setTrackingStatus,
  });

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
        <div className="relative">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300"
            onClick={() => setDrawerOpen((open) => !open)}
            aria-expanded={drawerOpen}
          >
            Display Options
          </button>
          <div
            className={`absolute right-0 top-full z-10 mt-3 w-60 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-xl transition ${
              drawerOpen ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
            }`}
          >
            <div className="flex flex-col gap-3 text-slate-700">
              <label className="flex items-center justify-between gap-3">
                <span>Show Face Mesh</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-slate-900"
                  checked={showFaceMesh}
                  onChange={(event) => setShowFaceMesh(event.target.checked)}
                />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span>Show Bounding Box</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-slate-900"
                  checked={showBoundingBox}
                  onChange={(event) => setShowBoundingBox(event.target.checked)}
                />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span>Show Regions</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-slate-900"
                  checked={showRegions}
                  onChange={(event) => setShowRegions(event.target.checked)}
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="relative mt-6 aspect-video w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-950/5">
        <video
          ref={videoRef}
          className={`h-full w-full object-cover transition-opacity ${
            stream && isVideoReady ? "opacity-100" : "opacity-0"
          }`}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={() => setIsVideoReady(true)}
          onPlaying={() => setIsVideoReady(true)}
          onPause={() => setIsVideoReady(false)}
        />
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
        {(!stream || !isVideoReady) && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
            Camera preview appears here
          </div>
        )}
      </div>
    </section>
  );
};

export default FaceTracker;
