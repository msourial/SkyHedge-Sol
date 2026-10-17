import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import WaitlistPage from "@/pages/waitlist";

const AppShell = lazy(() => import("@/pages/app-shell"));
const AppDashboard = lazy(() => import("@/pages/app-shell").then((mod) => ({ default: mod.AppDashboard })));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);
  return null;
}

function CityRedirect() {
  const { slug } = useParams();
  return <Navigate to={`/app?tab=markets&city=${slug}`} replace />;
}

/** Legacy bookmarks like `/?tab=markets` land on the product app. */
function RootEntry() {
  const [params] = useSearchParams();
  if (params.has("tab") || params.has("city")) {
    return <Navigate to={`/app?${params.toString()}`} replace />;
  }
  return <WaitlistPage />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<RootEntry />} />
          <Route
            path="/app"
            element={
              <Suspense fallback={null}>
                <AppShell />
              </Suspense>
            }
          >
            <Route
              index
              element={
                <Suspense fallback={null}>
                  <AppDashboard />
                </Suspense>
              }
            />
          </Route>
          <Route path="/liquidity" element={<Navigate to="/app?tab=liquidity" replace />} />
          <Route path="/staking" element={<Navigate to="/app?tab=liquidity" replace />} />
          <Route path="/city/:slug" element={<CityRedirect />} />
          <Route path="/advisor" element={<Navigate to="/app" replace />} />
          <Route path="/settlements" element={<Navigate to="/app?tab=evidence" replace />} />
          <Route path="/portfolio" element={<Navigate to="/app?tab=portfolio" replace />} />
          <Route path="/explore" element={<Navigate to="/app" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
