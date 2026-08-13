import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import SkyHedgePage from "@/pages/skyhedge";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SkyHedgePage />
    </QueryClientProvider>
  );
}

export default App;
