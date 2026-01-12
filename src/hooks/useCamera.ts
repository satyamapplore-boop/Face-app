import { useCallback, useEffect, useState } from "react";

type CameraStatus = "idle" | "requesting" | "ready" | "error";

export const useCamera = () => {
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const start = useCallback(async () => {
    if (status === "requesting" || status === "ready") return stream;
    setStatus("requesting");
    setError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setError("Camera access is not supported in this browser.");
      return null;
    }

    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      setStream(nextStream);
      setStatus("ready");
      return nextStream;
    } catch (err) {
      setStatus("error");
      setError("Camera permission was denied. Please allow access and try again.");
      return null;
    }
  }, [status, stream]);

  const stop = useCallback(() => {
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
    setStatus("idle");
  }, [stream]);

  useEffect(() => () => stop(), [stop]);

  return {
    start,
    stop,
    status,
    error,
    stream,
  };
};
