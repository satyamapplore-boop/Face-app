import { useEffect, useRef, type RefObject } from "react";
import { FaceDetection } from "@mediapipe/face_detection";
import { FaceMesh } from "@mediapipe/face_mesh";
import { Camera } from "@mediapipe/camera_utils";
import { drawLandmarks, drawRectangle } from "@mediapipe/drawing_utils";
import { faceRegions } from "../utils/faceRegions";

type NormalizedRect = {
  xCenter: number;
  yCenter: number;
  width: number;
  height: number;
  rotation: number;
};

type PixelRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type PipelineOptions = {
  videoRef: RefObject<HTMLVideoElement>;
  canvasRef: RefObject<HTMLCanvasElement>;
  stream: MediaStream | null;
  showFaceMesh: boolean;
  showBoundingBox: boolean;
  showRegions: boolean;
  onStatusChange?: (message: string) => void;
};

type NormalizedLandmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
  presence?: number;
};

const MIN_CONFIDENCE = 0.6;
const ROI_PADDING = 0.18;
const LOG_INTERVAL_MS = 1000;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const getRelativeBox = (detection: any): NormalizedRect | null => {
  const box = detection?.locationData?.relativeBoundingBox;
  if (!box) return null;
  const xMin = box.xMin ?? box.xmin ?? 0;
  const yMin = box.yMin ?? box.ymin ?? 0;
  const width = box.width ?? 0;
  const height = box.height ?? 0;
  if (!width || !height) return null;

  return {
    xCenter: xMin + width / 2,
    yCenter: yMin + height / 2,
    width,
    height,
    rotation: 0,
  };
};

const toPixelRect = (
  rect: NormalizedRect,
  imageWidth: number,
  imageHeight: number,
  padding = 0
): PixelRect => {
  const width = rect.width * imageWidth;
  const height = rect.height * imageHeight;
  const centerX = rect.xCenter * imageWidth;
  const centerY = rect.yCenter * imageHeight;

  const paddedWidth = width * (1 + padding);
  const paddedHeight = height * (1 + padding);

  const x = clamp(centerX - paddedWidth / 2, 0, imageWidth);
  const y = clamp(centerY - paddedHeight / 2, 0, imageHeight);
  const right = clamp(centerX + paddedWidth / 2, 0, imageWidth);
  const bottom = clamp(centerY + paddedHeight / 2, 0, imageHeight);

  return {
    x: Math.floor(x),
    y: Math.floor(y),
    width: Math.max(1, Math.floor(right - x)),
    height: Math.max(1, Math.floor(bottom - y)),
  };
};

const toNormalizedLandmarks = (
  landmarks: NormalizedLandmark[],
  roi: PixelRect,
  imageWidth: number,
  imageHeight: number
) =>
  landmarks.map((landmark) => ({
    x: (roi.x + landmark.x * roi.width) / imageWidth,
    y: (roi.y + landmark.y * roi.height) / imageHeight,
    z: landmark.z,
    visibility: landmark.visibility,
    presence: landmark.presence,
  }));

const toPixelPoint = (
  landmark: NormalizedLandmark,
  width: number,
  height: number
) => ({
  x: landmark.x * width,
  y: landmark.y * height,
});

const pointInPolygon = (x: number, y: number, polygon: { x: number; y: number }[]) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

const sampleRegionPixels = (
  imageData: ImageData,
  polygon: { x: number; y: number }[],
  step = 6
) => {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  polygon.forEach((point) => {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  });

  minX = clamp(Math.floor(minX), 0, width - 1);
  minY = clamp(Math.floor(minY), 0, height - 1);
  maxX = clamp(Math.ceil(maxX), 0, width - 1);
  maxY = clamp(Math.ceil(maxY), 0, height - 1);

  const samples: number[] = [];

  for (let y = minY; y <= maxY; y += step) {
    for (let x = minX; x <= maxX; x += step) {
      if (!pointInPolygon(x, y, polygon)) continue;
      const index = (y * width + x) * 4;
      samples.push(
        data[index],
        data[index + 1],
        data[index + 2],
        data[index + 3]
      );
    }
  }

  return new Uint8ClampedArray(samples);
};

const analyzePigmentation = (regionPixels: Uint8ClampedArray, regionId: string) => {
  const preview = Array.from(regionPixels.slice(0, 12));
  console.log(`[Pigmentation] ${regionId}`, { samples: preview, count: regionPixels.length });
};

const analyzeWrinkles = (regionPixels: Uint8ClampedArray, regionId: string) => {
  const preview = Array.from(regionPixels.slice(0, 12));
  console.log(`[Wrinkles] ${regionId}`, { samples: preview, count: regionPixels.length });
};

export const useFacePipeline = ({
  videoRef,
  canvasRef,
  stream,
  showFaceMesh,
  showBoundingBox,
  showRegions,
  onStatusChange,
}: PipelineOptions) => {
  const detectionRef = useRef<FaceDetection | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const roiRef = useRef<PixelRect | null>(null);
  const rectRef = useRef<NormalizedRect | null>(null);
  const landmarksRef = useRef<NormalizedLandmark[] | null>(null);
  const frameSizeRef = useRef<{ width: number; height: number } | null>(null);
  const frameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const roiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const statusRef = useRef<string | null>(null);
  const optionsRef = useRef({
    showFaceMesh,
    showBoundingBox,
    showRegions,
    onStatusChange,
  });
  const lastLogRef = useRef<number>(0);

  useEffect(() => {
    optionsRef.current = { showFaceMesh, showBoundingBox, showRegions, onStatusChange };
  }, [showFaceMesh, showBoundingBox, showRegions, onStatusChange]);

  useEffect(() => {
    frameCanvasRef.current = document.createElement("canvas");
    roiCanvasRef.current = document.createElement("canvas");

    const faceDetection = new FaceDetection({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
    });
    faceDetection.setOptions({
      model: "short",
      minDetectionConfidence: MIN_CONFIDENCE,
    });

    const faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });
    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: MIN_CONFIDENCE,
      minTrackingConfidence: MIN_CONFIDENCE,
    });

    const updateStatus = (message: string) => {
      if (statusRef.current === message) return;
      statusRef.current = message;
      optionsRef.current.onStatusChange?.(message);
    };

    const renderOverlay = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const frame = frameSizeRef.current;
      if (!canvas || !ctx || !frame) return;

      if (canvas.width !== frame.width) canvas.width = frame.width;
      if (canvas.height !== frame.height) canvas.height = frame.height;
      ctx.clearRect(0, 0, frame.width, frame.height);

      const { showBoundingBox: drawBox, showFaceMesh: drawMesh, showRegions: drawZones } =
        optionsRef.current;

      if (drawBox && rectRef.current) {
        drawRectangle(ctx, rectRef.current, {
          color: "#38bdf8",
          lineWidth: 2,
          fillColor: "rgba(56, 189, 248, 0.08)",
        });
      }

      if (drawZones && landmarksRef.current) {
        faceRegions.forEach((region) => {
          region.polygons.forEach((polygon) => {
            const points = polygon.map((index) =>
              toPixelPoint(landmarksRef.current![index], frame.width, frame.height)
            );
            if (points.length < 3) return;
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
            ctx.closePath();
            ctx.fillStyle = region.color;
            ctx.fill();
          });
        });
      }

      if (drawMesh && landmarksRef.current) {
        drawLandmarks(ctx, landmarksRef.current, {
          color: "#0f172a",
          lineWidth: 1,
          radius: 1.2,
        });
      }
    };

    faceDetection.onResults((results: any) => {
      const image = results.image as HTMLVideoElement | HTMLCanvasElement | HTMLImageElement;
      const width =
        (image as HTMLVideoElement).videoWidth ||
        (image as HTMLCanvasElement).width ||
        (image as HTMLImageElement).naturalWidth;
      const height =
        (image as HTMLVideoElement).videoHeight ||
        (image as HTMLCanvasElement).height ||
        (image as HTMLImageElement).naturalHeight;
      if (!width || !height) return;

      frameSizeRef.current = { width, height };
      const frameCanvas = frameCanvasRef.current;
      const frameCtx = frameCanvas?.getContext("2d");
      if (frameCanvas && frameCtx) {
        frameCanvas.width = width;
        frameCanvas.height = height;
        frameCtx.drawImage(image, 0, 0, width, height);
      }

      const detection = results.detections?.[0] ?? null;
      rectRef.current = detection ? getRelativeBox(detection) : null;

      if (!rectRef.current) {
        roiRef.current = null;
        landmarksRef.current = null;
        updateStatus("No face detected");
        renderOverlay();
        return;
      }

      updateStatus("Tracking face");
      roiRef.current = toPixelRect(rectRef.current, width, height, ROI_PADDING);

      const roiCanvas = roiCanvasRef.current;
      const roiCtx = roiCanvas?.getContext("2d");
      if (roiCanvas && roiCtx && roiRef.current) {
        roiCanvas.width = roiRef.current.width;
        roiCanvas.height = roiRef.current.height;
        roiCtx.drawImage(
          image,
          roiRef.current.x,
          roiRef.current.y,
          roiRef.current.width,
          roiRef.current.height,
          0,
          0,
          roiRef.current.width,
          roiRef.current.height
        );
        void faceMesh.send({ image: roiCanvas });
      }

      renderOverlay();
    });

    faceMesh.onResults((results: any) => {
      const landmarks = results.multiFaceLandmarks?.[0];
      const frame = frameSizeRef.current;
      const roi = roiRef.current;
      if (!landmarks || !frame || !roi) {
        landmarksRef.current = null;
        renderOverlay();
        return;
      }

      landmarksRef.current = toNormalizedLandmarks(landmarks, roi, frame.width, frame.height);

      const now = performance.now();
      if (now - lastLogRef.current > LOG_INTERVAL_MS && frameCanvasRef.current) {
        lastLogRef.current = now;
        const frameCtx = frameCanvasRef.current.getContext("2d");
        if (frameCtx) {
          const imageData = frameCtx.getImageData(0, 0, frame.width, frame.height);
          faceRegions.forEach((region) => {
            const regionPixels = region.polygons.reduce<Uint8ClampedArray[]>(
              (acc, polygon) => {
                const points = polygon.map((index) =>
                  toPixelPoint(landmarksRef.current![index], frame.width, frame.height)
                );
                if (points.length < 3) return acc;
                acc.push(sampleRegionPixels(imageData, points));
                return acc;
              },
              []
            );
            const merged = new Uint8ClampedArray(
              regionPixels.reduce((sum, item) => sum + item.length, 0)
            );
            let offset = 0;
            regionPixels.forEach((chunk) => {
              merged.set(chunk, offset);
              offset += chunk.length;
            });
            analyzePigmentation(merged, region.id);
            analyzeWrinkles(merged, region.id);
          });
        }
      }

      renderOverlay();
    });

    detectionRef.current = faceDetection;
    return () => {
      cameraRef.current?.stop();
      faceDetection.close();
      faceMesh.close();
      detectionRef.current = null;
    };
  }, [canvasRef, videoRef]);

  useEffect(() => {
    if (!stream || !videoRef.current || !detectionRef.current) return;

    videoRef.current.srcObject = stream;
    videoRef.current.muted = true;
    videoRef.current.playsInline = true;
    const playVideo = () => {
      const playPromise = videoRef.current?.play();
      if (playPromise && typeof playPromise.then === "function") {
        playPromise.catch(() => undefined);
      }
    };
    videoRef.current.onloadedmetadata = playVideo;
    playVideo();
    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        if (!videoRef.current) return;
        await detectionRef.current?.send({ image: videoRef.current });
      },
      width: 720,
      height: 540,
    });

    cameraRef.current?.stop();
    cameraRef.current = camera;
    camera.start();
    optionsRef.current.onStatusChange?.("Camera active. Looking for a face...");

    return () => {
      camera.stop();
    };
  }, [stream, videoRef]);
};
