import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "../src/index.css";
import Layout from "../src/routes/layout";
import Documents from "../src/routes/documents";
import Chat from "../src/routes/chat";
import { installMockFetch } from "./mock-amplify-api";

// Serve the real UI against in-memory data instead of AWS.
installMockFetch();

const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <Layout />,
      children: [
        {
          index: true,
          Component: Documents,
        },
        {
          path: "/doc/:documentid/:conversationid",
          Component: Chat,
        },
      ],
    },
  ],
  { basename: "/demo" }
);

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
