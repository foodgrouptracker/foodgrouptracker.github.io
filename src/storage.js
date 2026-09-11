// On-device storage only (IndexedDB). Nothing here ever talks to a server.
import { get, set, del, keys } from "idb-keyval";

export async function storeGet(key) {
  try {
    const v = await get(key);
    return v === undefined ? null : v;
  } catch {
    return null;
  }
}
export async function storeSet(key, data) {
  try {
    await set(key, data);
  } catch {
    /* storage unavailable: the session still works in memory */
  }
}
export async function storeDel(key) {
  try {
    await del(key);
  } catch {
    /* ignore */
  }
}
export async function storeList(prefix) {
  try {
    const all = await keys();
    return all.filter((k) => typeof k === "string" && k.startsWith(prefix));
  } catch {
    return [];
  }
}
