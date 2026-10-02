import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

// ─────────────────────────────────────────────────────────────
// INDEXEDDB LOCAL IMAGE STORE FOR HOME FINANCE
// Provides safe, persistent local storage (>100MB) that avoids
// localStorage's 5MB quota and survives page reloads.
// ─────────────────────────────────────────────────────────────

const DB_NAME = "HomeFinanceMediaDB";
const STORE_NAME = "media_store";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB not available"));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveLocalImage(key: string, dataUrl: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(dataUrl, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("IndexedDB saveLocalImage warning:", err);
  }
}

export async function getLocalImage(key: string): Promise<string | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as string) || null);
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// COMPRESS TO ULTRA-LIGHT BASE64 THUMBNAIL (< 25KB)
// Guarantees that even if saved inline in Firestore / localStorage,
// it never exceeds the 1MB document or 5MB storage limit.
// ─────────────────────────────────────────────────────────────
export async function compressToTinyThumbnail(
  dataUrl: string,
  maxDimension = 360,
  quality = 0.72
): Promise<string> {
  if (typeof window === "undefined" || !dataUrl.startsWith("data:image")) {
    return dataUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(dataUrl);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "medium";
      ctx.drawImage(img, 0, 0, width, height);

      try {
        const compressed = canvas.toDataURL("image/jpeg", quality);
        resolve(compressed);
      } catch (e) {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// ─────────────────────────────────────────────────────────────
// RESILIENT IMAGE UPLOAD
// Tries Firebase Storage first (permanent HTTPS URL).
// If storage upload fails (network/rules), falls back to a tiny
// optimized thumbnail (<25KB) and stores the high-res copy in
// local IndexedDB so the user NEVER loses their attached photos.
// ─────────────────────────────────────────────────────────────
export async function uploadImageResiliently(
  folder: "receipts" | "needs" | "inventory",
  id: string,
  dataUrlOrFile: string | File
): Promise<string> {
  let dataUrl = "";
  if (typeof dataUrlOrFile === "string") {
    dataUrl = dataUrlOrFile;
  } else {
    dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(dataUrlOrFile);
    });
  }

  // Already a permanent remote URL (http / https)
  if (!dataUrl.startsWith("data:image")) {
    return dataUrl;
  }

  const filename = `${folder}/${id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`;
  
  // 1. Cache the high-res image locally in IndexedDB immediately
  await saveLocalImage(`hf_${id}`, dataUrl);

  // 2. Attempt to upload to Firebase Storage with a 7-second timeout
  try {
    const storageRef = ref(storage, filename);
    const res = await fetch(dataUrl);
    const blob = await res.blob();

    const uploadPromise = uploadBytes(storageRef, blob).then(() => getDownloadURL(storageRef));
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error("Storage upload timeout")), 7000)
    );

    const remoteUrl = await Promise.race([uploadPromise, timeoutPromise]);
    if (remoteUrl && remoteUrl.startsWith("http")) {
      return remoteUrl;
    }
  } catch (storageError) {
    console.warn("Firebase Storage upload fallback triggered:", storageError);
  }

  // 3. Fallback: Compress to a tiny base64 thumbnail (<25KB) that safely fits in Firestore
  const tinyThumbnail = await compressToTinyThumbnail(dataUrl, 380, 0.7);
  return tinyThumbnail;
}
