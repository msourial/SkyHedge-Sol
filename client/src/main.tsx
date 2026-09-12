import { createRoot } from "react-dom/client";
import App from "./App";
import "leaflet/dist/leaflet.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
