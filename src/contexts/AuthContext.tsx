
import { createContext, useContext } from 'react';

// Temporary minimal AuthContext during rebuild
interface AuthContextType {
  user: null;
  session: null;
  isLoading: false;
  authInitialized: true;
  signIn: () => Promise<null>;
  signUp: () => Promise<null>;
  signOut: () => Promise<void>;
  resetPassword: () => Promise<null>;
  forgotPassword: () => Promise<null>;
}

// Create a minimal context that doesn't block navigation during rebuild
const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: false,
  authInitialized: true,
  signIn: async () => null,
  signUp: async () => null,
  signOut: async () => {},
  resetPassword: async () => null,
  forgotPassword: async () => null,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  console.log("REBUILD: Using temporary AuthProvider placeholder");
  
  // Return minimal provider during rebuild
  return <AuthContext.Provider value={{
    user: null,
    session: null,
    isLoading: false,
    authInitialized: true,
    signIn: async () => null,
    signUp: async () => null,
    signOut: async () => {},
    resetPassword: async () => null,
    forgotPassword: async () => null,
  }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
