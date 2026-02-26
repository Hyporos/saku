import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

/**
 * Returns the current auth user and loading state from the AuthContext.
 * Must be used within an AuthProvider.
 */
const useAuth = () => useContext(AuthContext);

export default useAuth;
