import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  getStoredUser,
  logoutUser,
  sendEmailOtp,
  signInWithGoogle,
  updateStoredUserProfile,
  verifyEmailOtp,
  type PrimoCollectorUser,
  type RegisterCustomerParams,
  type UpdateProfileParams,
} from "@/services/auth";
import { getFirebaseAuth, getFirebaseAuthModule } from "@/services/firebase";

type AuthContextType = {
  user: PrimoCollectorUser | null;
  isLoading: boolean;
  sendOtp: (email: string) => Promise<{ success: boolean; message: string; expiresInSeconds: number }>;
  verifyOtp: (email: string, otp: string) => Promise<PrimoCollectorUser>;
  loginWithGoogle: (idToken: string) => Promise<PrimoCollectorUser>;
  logout: () => Promise<void>;
  updateProfile: (params: UpdateProfileParams) => Promise<PrimoCollectorUser>;
  refreshUser: () => Promise<void>;

  // Backward-compatible methods
  login: (identifier: string, pass: string) => Promise<PrimoCollectorUser>;
  signup: (params: RegisterCustomerParams) => Promise<PrimoCollectorUser>;
  forgotPassword: (email: string) => Promise<boolean>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PrimoCollectorUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const stored = await getStoredUser();
      setUser(stored);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();

    // Attach Firebase Auth state listener if client SDK is active
    try {
      const auth = getFirebaseAuth();
      const fbAuthModule = getFirebaseAuthModule();
      if (auth && fbAuthModule?.onAuthStateChanged) {
        const unsubscribe = fbAuthModule.onAuthStateChanged(auth, async (fbUser: any) => {
          if (!fbUser) {
            // User signed out in Firebase
          } else {
            // Refresh local session
            const current = await getStoredUser();
            if (current && current.id === fbUser.uid) {
              setUser(current);
            }
          }
        });
        return () => unsubscribe();
      }
    } catch {
      // Modular fallback
    }
  }, [loadSession]);

  const sendOtp = async (email: string) => {
    return sendEmailOtp(email);
  };

  const verifyOtp = async (email: string, otp: string) => {
    setIsLoading(true);
    try {
      const loggedUser = await verifyEmailOtp(email, otp);
      setUser(loggedUser);
      return loggedUser;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async (idToken: string) => {
    setIsLoading(true);
    try {
      const loggedUser = await signInWithGoogle(idToken);
      setUser(loggedUser);
      return loggedUser;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await logoutUser();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (params: UpdateProfileParams) => {
    setIsLoading(true);
    try {
      const updated = await updateStoredUserProfile(params);
      setUser(updated);
      return updated;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    await loadSession();
  };

  // Backward-compatible stubs
  const login = async (identifier: string, pass: string) => {
    return verifyOtp(identifier, pass);
  };

  const signup = async (params: RegisterCustomerParams) => {
    await sendOtp(params.email);
    const mockUser: PrimoCollectorUser = {
      id: `primo_pending_${Date.now()}`,
      email: params.email,
      first_name: params.firstName,
      last_name: params.lastName || "",
      username: params.email.split("@")[0],
      billing: { email: params.email, phone: params.phone },
      date_created: new Date().toISOString(),
    };
    return mockUser;
  };

  const forgotPassword = async (email: string) => {
    await sendOtp(email);
    return true;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        sendOtp,
        verifyOtp,
        loginWithGoogle,
        logout,
        updateProfile,
        refreshUser,
        login,
        signup,
        forgotPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
