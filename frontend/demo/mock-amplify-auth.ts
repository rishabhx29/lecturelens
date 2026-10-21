export const DEMO_USER_EMAIL = "demo@lecturelens.app";

export async function fetchUserAttributes() {
  return {
    email: DEMO_USER_EMAIL,
    name: "Demo Student",
    email_verified: "true",
  };
}

export async function signOut() {
  // Local demo: there is no Cognito session to end.
}

export async function fetchAuthSession() {
  return {
    tokens: {
      idToken: { toString: () => "local-demo-token" },
    },
  };
}

export async function getCurrentUser() {
  return {
    username: DEMO_USER_EMAIL,
    userId: "local-demo-user",
  };
}

// The real @aws-amplify/ui-react package imports these from `aws-amplify/auth`.
// The demo never renders the Authenticator, but providing stubs keeps the
// module graph resolvable if the package is pulled in by a dependency scan.
export async function signIn() {
  return {};
}

export async function signUp() {
  return {};
}

export async function confirmSignIn() {
  return {};
}

export async function confirmSignUp() {
  return {};
}

export async function confirmResetPassword() {
  return {};
}

export async function resetPassword() {
  return {};
}

export async function resendSignUpCode() {
  return {};
}

export async function signInWithRedirect() {
  return {};
}

export async function autoSignIn() {
  return {};
}

export async function updatePassword() {
  return {};
}

export async function deleteUser() {
  return {};
}

export async function sendUserAttributeVerificationCode() {
  return {};
}

export async function confirmUserAttribute() {
  return {};
}
