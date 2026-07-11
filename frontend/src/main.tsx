import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Theme initialization must happen before React paints the landing screen. Previously the
// ThemeToggle mounted only inside the dashboard, so returning the landing page early meant
// the saved/system dark preference was never applied until after the user continued.
const storedTheme = localStorage.getItem("theme");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
document.documentElement.classList.toggle(
  "dark",
  storedTheme === "dark" || (storedTheme !== "light" && prefersDark),
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
