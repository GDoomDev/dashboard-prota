import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

export type WhitelistEntry = {
  email: string;
  hasAccount: boolean;
};

export async function getWhitelistEntry(email: string): Promise<WhitelistEntry | null> {
  const ref = doc(db, "whitelist", email.toLowerCase());
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as WhitelistEntry;
}

export async function markAccountCreated(email: string): Promise<void> {
  const ref = doc(db, "whitelist", email.toLowerCase());
  await updateDoc(ref, { hasAccount: true });
}
