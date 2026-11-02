import { lazy, Suspense } from "react";
import Landing from "./pages/waitlist";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
const LinePreview = lazy(async () => {
  await import("./index.css");
  return import("./pages/line-preview");
});
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
                <LinePreview />
              </Suspense>
            }
          />
          <Route path="*" element={<Landing />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
