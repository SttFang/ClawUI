import { createAuthClient } from "better-auth/react";

const baseURL = import.meta.env.VITE_AUTH_URL || "http://localhost:14015";

export const authClient = createAuthClient({
  baseURL,
});

export const { useSession, signIn, signOut, signUp } = authClient;

// Type exports
export type { Session, User } from "better-auth/types";
