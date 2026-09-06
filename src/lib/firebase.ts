import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// مفاتيح مشروعك الحقيقية
const firebaseConfig = {
  apiKey: "AIzaSyA4l36usNaltDW4PAKr7lM4l8IOp2QJDRo",
  authDomain: "cake-publisher-app.firebaseapp.com",
  projectId: "cake-publisher-app",
  storageBucket: "cake-publisher-app.firebasestorage.app",
  messagingSenderId: "112876760850",
  appId: "1:112876760850:web:d5144e5abf764372408dcb"
};

// تهيئة Firebase بطريقة آمنة لبيئة Next.js
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// إعادة تفعيل الكاش المحلي لتسريع جلب البيانات والصور المؤقتة (Base64) بدون انتظار الخادم
const initDB = () => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
  } catch (e) {
    return getFirestore(app);
  }
};
const db = initDB();

const auth = getAuth(app);
const storage = getStorage(app);

export { app, db, auth, storage };