import { useEffect, useMemo, useRef, useState } from "react";
const {
  FaceMesh,
  Camera,
  drawConnectors,
  drawLandmarks,
  FACEMESH_FACE_OVAL,
  FACEMESH_LEFT_EYE,
  FACEMESH_RIGHT_EYE,
  FACEMESH_LIPS,
  FACEMESH_NOSE,
  FACEMESH_LEFT_EYEBROW,
  FACEMESH_RIGHT_EYEBROW,
} = window;

type InputMode = "camera" | "image";

type PigmentationLevel = "low" | "medium" | "high";

type RegionDefinition = {
  name: string;
  indices: number[];
};

const PIGMENTATION_COLORS: Record<PigmentationLevel, string> = {
  low: "rgba(252, 211, 77, 0.2)",
  medium: "rgba(249, 115, 22, 0.28)",
  high: "rgba(239, 68, 68, 0.35)",
};

const wrinkleStroke = "rgba(92, 124, 188, 0.6)";

const pigmentationRegions: RegionDefinition[] = [
  {
    name: "leftCheek",
    indices: [234, 93, 132, 58, 172, 136, 150, 149, 170, 169],
  },
  {
    name: "rightCheek",
    indices: [454, 323, 361, 288, 397, 365, 379, 378, 400, 401],
  },
  {
    name: "forehead",
    indices: [10, 338, 297, 332, 284, 251, 389, 356, 9, 107, 66, 105],
  },
  {
    name: "nose",
    indices: [1, 2, 98, 327, 168, 197, 5, 4],
  },
];

const wrinkleCurves: RegionDefinition[] = [
  {
    name: "foreheadLine",
    indices: [70, 63, 105, 66, 107, 336, 296, 334, 293],
  },
  {
    name: "underEyeLeft",
    indices: [163, 144, 145, 153, 154, 155],
  },
  {
    name: "underEyeRight",
    indices: [390, 373, 374, 380, 381, 382],
  },
  {
    name: "smileLineLeft",
    indices: [61, 146, 91, 181],
  },
  {
    name: "smileLineRight",
    indices: [291, 375, 321, 405],
  },
];

const meshGroups = [
  {
    label: "Eyes",
    connectors: [FACEMESH_LEFT_EYE, FACEMESH_RIGHT_EYE],
    color: "#4f8fff",
  },
  {
    label: "Brows",
    connectors: [FACEMESH_LEFT_EYEBROW, FACEMESH_RIGHT_EYEBROW],
    color: "#5b7bbf",
  },
  {
    label: "Nose",
    connectors: [FACEMESH_NOSE],
    color: "#34d399",
  },
  {
    label: "Lips",
    connectors: [FACEMESH_LIPS],
    color: "#f472b6",
  },
  {
    label: "Contour",
    connectors: [FACEMESH_FACE_OVAL],
    color: "#94a3b8",
  },
];

const getBrightness = (data: Uint8ClampedArray, x: number, y: number, width: number) => {
  const index = (y * width + x) * 4;
  const r = data[index] ?? 0;
  const g = data[index + 1] ?? 0;
  const b = data[index + 2] ?? 0;
  return (r + g + b) / 3;
};

const categorizePigmentation = (brightness: number): PigmentationLevel => {
  const darkness = 1 - brightness / 255;
  if (darkness > 0.6) return "high";
  if (darkness > 0.42) return "medium";
  return "low";
};

const buildPolygonPath = (
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
) => {
  if (points.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.closePath();
};

const mapLandmarksToPoints = (
  landmarks: { x: number; y: number }[],
  indices: number[],
  width: number,
  height: number,
) =>
  indices
    .map((index) => landmarks[index])
    .filter(Boolean)
    .map((landmark) => ({
      x: landmark.x * width,
      y: landmark.y * height,
    }));

const averageBrightnessForRegion = (
  landmarks: { x: number; y: number }[],
  indices: number[],
  imageData: ImageData,
) => {
  const width = imageData.width;
  const height = imageData.height;
  const values: number[] = [];

  indices.forEach((index) => {
    const landmark = landmarks[index];
    if (!landmark) return;
    const x = Math.min(Math.max(Math.floor(landmark.x * width), 0), width - 1);
    const y = Math.min(Math.max(Math.floor(landmark.y * height), 0), height - 1);
    values.push(getBrightness(imageData.data, x, y, width));
  });

  if (values.length === 0) return 255;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const App = () => {
  const [mode, setMode] = useState<InputMode | null>(null);
  const [imageSource, setImageSource] = useState<string | null>(null);
  const [showMesh, setShowMesh] = useState(true);
  const [showPigmentation, setShowPigmentation] = useState(true);
  const [showWrinkles, setShowWrinkles] = useState(true);
  const [statusMessage, setStatusMessage] = useState("Awaiting input");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const inputCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const faceMeshRef = useRef<InstanceType<typeof FaceMesh.FaceMesh> | null>(
    null,
  );
  const cameraRef = useRef<InstanceType<typeof Camera> | null>(null);
  const showMeshRef = useRef(showMesh);
  const showPigmentationRef = useRef(showPigmentation);
  const showWrinklesRef = useRef(showWrinkles);

  const isLanding = mode === null;

  const resetExperience = () => {
    cameraRef.current?.stop();
    cameraRef.current = null;
    setMode(null);
    setImageSource(null);
    setStatusMessage("Awaiting input");
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageSource(url);
    setStatusMessage("Analyzing uploaded image");
  };

  const uiHints = useMemo(
    () => [
      "Proof of Concept – Not for Medical Use",
      "Chrome browser recommended",
    ],
    [],
  );

  useEffect(() => {
    showMeshRef.current = showMesh;
  }, [showMesh]);

  useEffect(() => {
    showPigmentationRef.current = showPigmentation;
  }, [showPigmentation]);

  useEffect(() => {
    showWrinklesRef.current = showWrinkles;
  }, [showWrinkles]);

  useEffect(() => {
    if (faceMeshRef.current) return;
    if (!FaceMesh?.FaceMesh || !Camera || !drawConnectors || !drawLandmarks) {
      setStatusMessage("MediaPipe scripts not loaded");
      return;
    }
    // FaceMesh setup: loads MediaPipe assets from CDN for browser-only execution.
    const faceMesh = new FaceMesh.FaceMesh({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });
    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });
    faceMesh.onResults((results: FaceMeshResults) => {
      const canvas = overlayRef.current;
      const inputCanvas = inputCanvasRef.current;
      if (!canvas || !inputCanvas) return;
      const ctx = canvas.getContext("2d");
      const inputCtx = inputCanvas.getContext("2d");
      if (!ctx || !inputCtx) return;

      const width = results.image.width;
      const height = results.image.height;
      canvas.width = width;
      canvas.height = height;
      inputCanvas.width = width;
      inputCanvas.height = height;

      ctx.clearRect(0, 0, width, height);
      inputCtx.clearRect(0, 0, width, height);
      inputCtx.drawImage(results.image, 0, 0, width, height);

      const landmarks = results.multiFaceLandmarks?.[0];
      if (!landmarks) {
        setStatusMessage("No face detected");
        return;
      }
      setStatusMessage("Face tracked");

      if (showPigmentationRef.current) {
        // Mock pigmentation heuristic: use average brightness to tint key regions.
        const imageData = inputCtx.getImageData(0, 0, width, height);
        pigmentationRegions.forEach((region) => {
          const brightness = averageBrightnessForRegion(
            landmarks,
            region.indices,
            imageData,
          );
          const level = categorizePigmentation(brightness);
          const points = mapLandmarksToPoints(landmarks, region.indices, width, height);
          ctx.save();
          ctx.fillStyle = PIGMENTATION_COLORS[level];
          buildPolygonPath(ctx, points);
          ctx.fill();
          ctx.restore();
        });
      }

      if (showWrinklesRef.current) {
        // Mock wrinkle overlay: draw soft curves using landmark paths and vary thickness.
        const imageData = inputCtx.getImageData(0, 0, width, height);
        wrinkleCurves.forEach((region) => {
          const brightness = averageBrightnessForRegion(
            landmarks,
            region.indices,
            imageData,
          );
          const level = categorizePigmentation(brightness);
          const thickness = level === "high" ? 3 : level === "medium" ? 2 : 1;
          const points = mapLandmarksToPoints(landmarks, region.indices, width, height);
          if (points.length < 2) return;
          ctx.save();
          ctx.strokeStyle = wrinkleStroke;
          ctx.lineWidth = thickness;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
          ctx.stroke();
          ctx.restore();
        });
      }

      if (showMeshRef.current) {
        meshGroups.forEach((group) => {
          group.connectors.forEach((connector) => {
            drawConnectors(ctx, landmarks, connector, {
              color: group.color,
              lineWidth: 1,
            });
          });
          drawLandmarks(ctx, landmarks, {
            color: group.color,
            lineWidth: 0.5,
            radius: 1.2,
          });
        });
      }
    });

    faceMeshRef.current = faceMesh;
    return () => {
      faceMesh.close();
    };
  }, []);

  useEffect(() => {
    if (!mode || !faceMeshRef.current) return;

    if (mode === "camera" && videoRef.current) {
      setStatusMessage("Starting camera");
      cameraRef.current?.stop();
      cameraRef.current = new Camera(videoRef.current, {
        onFrame: async () => {
          if (!videoRef.current) return;
          await faceMeshRef.current?.send({ image: videoRef.current });
        },
        width: 720,
        height: 540,
      });
      cameraRef.current.start();
    }

    if (mode === "image" && imageRef.current) {
      setStatusMessage("Analyzing uploaded image");
      faceMeshRef.current
        .send({ image: imageRef.current })
        .catch(() => setStatusMessage("Image analysis failed"));
    }

    return () => {
      cameraRef.current?.stop();
    };
  }, [mode, imageSource]);

  useEffect(() => () => {
    if (imageSource) URL.revokeObjectURL(imageSource);
  }, [imageSource]);

  return (
    <div className="min-h-screen bg-clinic-50 text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-clinic-600">
                Dermatological Analysis
              </p>
              <h1 className="text-3xl font-semibold text-slate-900">
                Face Tracking PoC
              </h1>
            </div>
            <div className="flex flex-col items-end text-xs text-slate-500">
              {uiHints.map((hint) => (
                <span key={hint}>{hint}</span>
              ))}
            </div>
          </div>
          <p className="max-w-3xl text-sm text-slate-600">
            Real-time landmark detection, dermatology-inspired overlays, and
            visual heuristics to showcase where production AI models can be
            connected later.
          </p>
        </header>

        {isLanding ? (
          <section className="grid gap-6 rounded-3xl bg-white p-10 shadow-soft">
            <div className="grid gap-3">
              <h2 className="text-xl font-semibold text-slate-900">
                Dermatological Analysis – Face Tracking PoC
              </h2>
              <p className="text-sm text-slate-500">
                Choose an input source to begin facial landmark detection and
                overlay visualization.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <button
                className="rounded-full bg-clinic-500 px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-clinic-600"
                onClick={() => {
                  setMode("camera");
                  setStatusMessage("Starting camera");
                }}
              >
                Use Camera
              </button>
              <button
                className="rounded-full border border-clinic-200 bg-white px-6 py-3 text-sm font-semibold text-clinic-600 shadow-soft transition hover:border-clinic-400"
                onClick={() => setMode("image")}
              >
                Upload Face Image
              </button>
            </div>
          </section>
        ) : (
          <section className="relative grid gap-6 rounded-3xl bg-white p-6 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold text-slate-900">
                  Face Tracking Screen
                </h2>
                <p className="text-xs text-slate-500">{statusMessage}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="rounded-full bg-clinic-100 px-3 py-1">
                  468 landmark points
                </span>
                <span className="rounded-full bg-clinic-100 px-3 py-1">
                  Overlay canvas
                </span>
              </div>
            </div>

            {mode === "image" && (
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex cursor-pointer items-center gap-3 rounded-full border border-clinic-200 bg-clinic-50 px-4 py-2 text-xs font-semibold text-clinic-600 shadow-soft">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                  Upload new image
                </label>
                <span className="text-xs text-slate-400">
                  JPG or PNG recommended
                </span>
              </div>
            )}

            <div className="relative overflow-hidden rounded-3xl border border-clinic-100 bg-white">
              {mode === "camera" && (
                <video
                  ref={videoRef}
                  className="h-full w-full object-cover"
                  autoPlay
                  playsInline
                />
              )}
              {mode === "image" && imageSource && (
                <img
                  ref={imageRef}
                  src={imageSource}
                  alt="Uploaded face"
                  className="h-full w-full object-contain"
                  onLoad={() => {
                    if (faceMeshRef.current && imageRef.current) {
                      faceMeshRef.current.send({ image: imageRef.current });
                    }
                  }}
                />
              )}
              {!imageSource && mode === "image" && (
                <div className="flex min-h-[360px] items-center justify-center text-sm text-slate-400">
                  Upload an image to start analysis
                </div>
              )}
              <canvas
                ref={overlayRef}
                className="absolute inset-0 h-full w-full"
              />
              <canvas ref={inputCanvasRef} className="hidden" />
            </div>

            <div className="absolute right-8 top-20 flex w-60 flex-col gap-4 rounded-2xl border border-clinic-100 bg-white/90 p-4 shadow-soft backdrop-blur">
              <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                Controls
              </div>
              <label className="flex items-center justify-between gap-2 text-sm text-slate-600">
                Show Face Mesh
                <input
                  type="checkbox"
                  checked={showMesh}
                  onChange={(event) => setShowMesh(event.target.checked)}
                  className="h-4 w-4 accent-clinic-500"
                />
              </label>
              <label className="flex items-center justify-between gap-2 text-sm text-slate-600">
                Show Pigmentation
                <input
                  type="checkbox"
                  checked={showPigmentation}
                  onChange={(event) => setShowPigmentation(event.target.checked)}
                  className="h-4 w-4 accent-clinic-500"
                />
              </label>
              <label className="flex items-center justify-between gap-2 text-sm text-slate-600">
                Show Wrinkles
                <input
                  type="checkbox"
                  checked={showWrinkles}
                  onChange={(event) => setShowWrinkles(event.target.checked)}
                  className="h-4 w-4 accent-clinic-500"
                />
              </label>
              <button
                className="rounded-full border border-clinic-200 bg-white px-4 py-2 text-sm font-semibold text-clinic-600 transition hover:border-clinic-400"
                onClick={resetExperience}
              >
                Reset
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default App;
