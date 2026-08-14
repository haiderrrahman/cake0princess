"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, signOut as firebaseSignOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  loginWithEmail: (e: string, p: string) => Promise<void>;
  signupWithEmail: (data: { email: string; pass: string; firstName: string; lastName: string; gender: string; dob: string }) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  loading: true,
  loginWithEmail: async () => {},
  signupWithEmail: async () => {},
  signInWithGoogle: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const withTimeout = <T,>(promise: Promise<T>, ms: number = 8000): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), ms))
    ]);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Check if admin
        if (currentUser.email === "ontheway.princess@gmail.com" || currentUser.email === "haider.rahman@gmail.com" || currentUser.email === "haiderr.rahman@gmail.com" || currentUser.email === "test.user.12345@gmail.com") {
          setIsAdmin(true);
        } else {
          try {
            const userDoc = await withTimeout(getDoc(doc(db, "users", currentUser.uid)));
            if (userDoc.exists() && userDoc.data().role === "admin") {
              setIsAdmin(true);
            } else {
              setIsAdmin(false);
            }
          } catch (error) {
            console.error("Error fetching user role:", error);
            setIsAdmin(false);
          }
        }
      } else {
        setIsAdmin(false);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithEmail = async (email: string, pass: string) => {
    await withTimeout(signInWithEmailAndPassword(auth, email, pass));
  };

  const signupWithEmail = async (data: { email: string; pass: string; firstName: string; lastName: string; gender: string; dob: string }) => {
    const userCredential = await withTimeout(createUserWithEmailAndPassword(auth, data.email, data.pass));
    const fullName = `${data.firstName} ${data.lastName}`.trim();
    await updateProfile(userCredential.user, { displayName: fullName });
    // Save to firestore
    await withTimeout(setDoc(doc(db, "users", userCredential.user.uid), {
      email: data.email,
      name: fullName,
      firstName: data.firstName,
      lastName: data.lastName,
      gender: data.gender,
      dob: data.dob,
      role: "user",
      points: 0,
      rank: "bronz",
      createdAt: new Date().toISOString()
    }));
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const result = await withTimeout(signInWithPopup(auth, provider));
    if (result.user) {
      const userRef = doc(db, "users", result.user.uid);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        await setDoc(userRef, {
          email: result.user.email,
          name: result.user.displayName,
          role: "user",
          points: 0,
          rank: "bronz",
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString()
        });
      } else {
        await setDoc(userRef, {
          lastLoginAt: new Date().toISOString()
        }, { merge: true });
      }
    }
  };

  const logout = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, loginWithEmail, signupWithEmail, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
