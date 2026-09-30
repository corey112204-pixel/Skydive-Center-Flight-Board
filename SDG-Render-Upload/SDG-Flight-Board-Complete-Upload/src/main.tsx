import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import "./schedule.css";
import "./aircraft.css";
import "./profiles.css";
import "./mx-form.css";
import "./daily.css";
import "./squawks.css";
import "./squawk-actions.css";
import "./documents.css";
import "./daily-records.css";
import "./admin.css";
import "./notifications.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
