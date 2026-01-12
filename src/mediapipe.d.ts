declare global {
  interface Window {
    FaceMesh: {
      FaceMesh: new (options: { locateFile?: (file: string) => string }) => {
        setOptions: (options: {
          maxNumFaces?: number;
          refineLandmarks?: boolean;
          minDetectionConfidence?: number;
          minTrackingConfidence?: number;
        }) => void;
        onResults: (callback: (results: FaceMeshResults) => void) => void;
        send: (input: { image: CanvasImageSource }) => Promise<void>;
        close: () => void;
      };
    };
    Camera: new (
      video: HTMLVideoElement,
      options: { onFrame: () => Promise<void>; width?: number; height?: number },
    ) => { start: () => void; stop: () => void };
    drawConnectors: (
      ctx: CanvasRenderingContext2D,
      landmarks: FaceMeshLandmark[],
      connectors: number[][],
      style?: { color?: string; lineWidth?: number },
    ) => void;
    drawLandmarks: (
      ctx: CanvasRenderingContext2D,
      landmarks: FaceMeshLandmark[],
      style?: { color?: string; lineWidth?: number; radius?: number },
    ) => void;
    FACEMESH_FACE_OVAL: number[][];
    FACEMESH_LEFT_EYE: number[][];
    FACEMESH_RIGHT_EYE: number[][];
    FACEMESH_LIPS: number[][];
    FACEMESH_NOSE: number[][];
    FACEMESH_LEFT_EYEBROW: number[][];
    FACEMESH_RIGHT_EYEBROW: number[][];
  }
}

type FaceMeshLandmark = { x: number; y: number; z?: number };

type FaceMeshResults = {
  image: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;
  multiFaceLandmarks?: FaceMeshLandmark[][];
};

export {};
