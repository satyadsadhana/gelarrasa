import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/plus-jakarta-sans/wght.css";
import "./styles.css";
import "./v4.css";
import "./v4-sim.css";
import "./v4-tour.css";
import App from "./App";
import { applyChrome } from "./lib/theme";

applyChrome();

if (new URLSearchParams(location.search).has("capture")) document.documentElement.classList.add("capture");
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
