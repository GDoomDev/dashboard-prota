import { initializeApp, getApps, getApp as _getApp } from "firebase/app";
import { initializeAuth, getAuth, indexedDBLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function createApp() {
  if (typeof window === "undefined") return null;
  return getApps().length ? _getApp() : initializeApp(firebaseConfig);
}

function createAuth(app: ReturnType<typeof createApp>) {
  if (!app) return null!;
  // If auth already exists (HMR), return it; otherwise initialize without popup resolver
  try {
    return initializeAuth(app, { persistence: indexedDBLocalPersistence });
  } catch {
    return getAuth(app);
  }
}

const app = createApp();
export const auth = createAuth(app);
export const db = app ? getFirestore(app) : null!;
