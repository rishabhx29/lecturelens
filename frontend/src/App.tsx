import { Amplify } from "aws-amplify";
import { fetchAuthSession } from "aws-amplify/auth";
import { withAuthenticator } from "@aws-amplify/ui-react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import Layout from "./routes/layout";
import Documents from "./routes/documents";
import Chat from "./routes/chat";
import { AuthFooter, AuthHeader } from "./components/AuthBrand";

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID,
    },
  },
  API: {
    REST: {
      "serverless-pdf-chat": {
        endpoint: import.meta.env.VITE_API_ENDPOINT,
        region:
          import.meta.env.VITE_API_REGION || import.meta.env.VITE_REGION,
      },
    },
  }}, {
  API: {
    REST: {
      headers: async () => {
        const tokens = (await fetchAuthSession()).tokens;
        const jwt = tokens?.idToken?.toString();
          return {
            "authorization": `Bearer ${jwt}`
          };
      }
    }
  }
});

const router = createBrowserRouter([
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
]);

function App() {
  return <RouterProvider router={router} />;
}

const AuthenticatedApp = withAuthenticator(App, {
  hideSignUp: true,
  variation: "default",
  loginMechanisms: ["email"],
  components: {
    Header: AuthHeader,
    Footer: AuthFooter,
  },
});

export default AuthenticatedApp;
