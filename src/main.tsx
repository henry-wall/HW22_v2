import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

import { StorageProvider } from "./services/storage/StorageContext";
import { ErrorBoundary } from "./components/ErrorBoundary";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <StorageProvider>
        <App />
      </StorageProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
