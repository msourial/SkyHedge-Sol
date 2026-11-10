import { lazy, Suspense } from "react";
import Landing from "./pages/waitlist";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
const PmAmm = lazy(() => import('./pages/pm-amm'));
const Developers = lazy(async () => {
  await import("./index.css");
  return import("./pages/developers");
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route
            path="/developers"
            element={
              <Suspense fallback={null}>
                <Developers />
              </Suspense>
            }
          />
          <Route
            path="/preview"
            element={
              <Suspense fallback={null}>
                <Navigate to="/app" replace />
              </Suspense>
            }
          />
          <Route path="/app/*" element={<Suspense fallback={null}><PmAmm /></Suspense>} />
          <Route path="*" element={<Landing />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
