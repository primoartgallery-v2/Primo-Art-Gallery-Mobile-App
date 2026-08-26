import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  getStoredUser,
  loginWithEmailPassword,
  logoutUser,
  resetPasswordWithOtp,
  sendEmailOtp,
  signInWithGoogle,
  updateStoredUserProfile,
  verifyEmailOtp,
  type PrimoCollectorUser,
  type RegisterCustomerParams,
  type UpdateProfileParams,
} from "@/services/auth";
import { getFirebaseAuth, getFirebaseAuthModule } from "@/services/firebase";

export type PendingRegistrationData = {
  email: string;
  password?: string;
  fullName?: string;
  phone?: string;
};

type AuthContextType = {
  user: PrimoCollectorUser | null;
  isLoading: boolean;
  sendOtp: (email: string) => Promise<{ success: boolean; message: string; expiresInSeconds: number }>;
  verifyOtp: (email: string, otp: string) => Promise<PrimoCollectorUser>;
  loginWithPassword: (email: string, password: string) => Promise<PrimoCollectorUser>;
  resetPassword: (email: string, otp: string, newPassword: string) => Promise<PrimoCollectorUser>;
  setPendingRegistration: (data: PendingRegistrationData | null) => void;
  getPendingRegistrationEmail: () => string | null;
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
  const pendingRegistrationRef = useRef<PendingRegistrationData | null>(null);

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

  const setPendingRegistration = useCallback((data: PendingRegistrationData | null) => {
    pendingRegistrationRef.current = data;
  }, []);

  const getPendingRegistrationEmail = useCallback(() => {
    return pendingRegistrationRef.current?.email || null;
  }, []);

  const sendOtp = async (email: string) => {
    return sendEmailOtp(email);
  };

  const verifyOtp = async (email: string, otp: string) => {
    setIsLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      let registrationOptions: { password?: string; fullName?: string; phone?: string } | undefined;

      if (
        pendingRegistrationRef.current &&
        pendingRegistrationRef.current.email.trim().toLowerCase() === cleanEmail
      ) {
        registrationOptions = {
          password: pendingRegistrationRef.current.password,
          fullName: pendingRegistrationRef.current.fullName,
          phone: pendingRegistrationRef.current.phone,
        };
        // Wipe sensitive in-memory registration data immediately upon consumption
        pendingRegistrationRef.current = null;
      }

      const loggedUser = await verifyEmailOtp(cleanEmail, otp, registrationOptions);
      setUser(loggedUser);
      return loggedUser;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithPassword = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const loggedUser = await loginWithEmailPassword(email, password);
      setUser(loggedUser);
      return loggedUser;
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (email: string, otp: string, newPassword: string) => {
    setIsLoading(true);
    try {
      const loggedUser = await resetPasswordWithOtp(email, otp, newPassword);
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
      pendingRegistrationRef.current = null;
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
    return loginWithPassword(identifier, pass);
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
        loginWithPassword,
        resetPassword,
        setPendingRegistration,
        getPendingRegistrationEmail,
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
