import FaceTracker from "./components/FaceTracker";

const App = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-sky-100 text-slate-900">
      <main className="mx-auto flex w-full max-w-4xl flex-col items-center gap-10 px-6 py-16">
        <header className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
            Browser-Only Demo
          </p>
          <h1 className="mt-3 text-4xl font-semibold text-slate-900 md:text-5xl">
            Face Tracking Demo
          </h1>
          <p className="mt-4 text-sm text-slate-600 md:text-base">
            Live webcam feed with MediaPipe detection + FaceMesh overlays.
          </p>
        </header>

        <FaceTracker />
      </main>
    </div>
  );
};

export default App;
