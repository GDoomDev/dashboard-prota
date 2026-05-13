import { doc, getDoc, getDocs, collection, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";

export type WhitelistEntry = {
  email: string;
  hasAccount: boolean;
  role?: "admin" | "user";
};

/** Entries without a role field are treated as admins (backward compat). */
export function isAdminEntry(entry: WhitelistEntry): boolean {
  return !entry.role || entry.role === "admin";
}

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

export async function getAllWhitelistEntries(): Promise<WhitelistEntry[]> {
  const snap = await getDocs(collection(db, "whitelist"));
  return snap.docs
    .map((d) => d.data() as WhitelistEntry)
    .sort((a, b) => a.email.localeCompare(b.email));
}

export async function bulkAddUsers(
  emails: string[],
): Promise<{ added: string[]; skipped: string[] }> {
  const unique = [...new Set(emails.map((e) => e.toLowerCase().trim()).filter(Boolean))];
  const checks = await Promise.all(unique.map((e) => getDoc(doc(db, "whitelist", e))));
  const toAdd = unique.filter((_, i) => !checks[i].exists());
  const skipped = unique.filter((_, i) => checks[i].exists());
  if (toAdd.length > 0) {
    const batch = writeBatch(db);
    for (const email of toAdd) {
      batch.set(doc(db, "whitelist", email), { email, hasAccount: false, role: "user" });
    }
    await batch.commit();
  }
  return { added: toAdd, skipped };
}
