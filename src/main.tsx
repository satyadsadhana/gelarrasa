import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/fira-sans/400.css";
import "@fontsource/fira-sans/500.css";
import "@fontsource/fira-sans/600.css";
import "@fontsource/fira-sans/700.css";
import "@fontsource-variable/fira-code";
import "./styles.css";
import App from "./App";
import { applyChrome } from "./lib/theme";

applyChrome();

if (new URLSearchParams(location.search).has("capture")) document.documentElement.classList.add("capture");
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
