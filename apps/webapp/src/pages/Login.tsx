import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaDiscord } from "react-icons/fa";
import useAuth from "../hooks/useAuth";
import { apiBase } from "../config/apiBase";

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const ERROR_MESSAGES: Record<string, string> = {
  friends:
    "Your Discord account has the Friends role and cannot access Saku.",
  not_in_guild: "Your Discord account is not a member of the Saku guild.",
  auth_failed: "Authentication failed. Please try again.",
  no_code: "Authorization was denied. Please try again.",
};

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

const Login = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const errorKey = searchParams.get("error");

  // Redirect already-authenticated users directly to the dashboard
  useEffect(() => {
    if (!isLoading && user) navigate("/", { replace: true });
  }, [user, isLoading, navigate]);

  return (
    <div className="flex flex-col justify-center items-center bg-background h-dvh py-12 px-6">
      {/* Login card */}
      <div className="flex flex-col items-center bg-panel rounded-xl drop-shadow-[0_0_12px_rgba(0,0,0,0.4)] gap-6 px-12 py-10 w-full max-w-sm">
        <div className="flex flex-col items-center gap-3">
          <img src="src/assets/logo.webp" width={56} height={56} />
          <h1 className="text-3xl">Saku</h1>
        </div>

        <div className="bg-tertiary/20 rounded-full w-full h-px" />

        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-tertiary text-sm leading-relaxed">
            Sign in with your Discord account to access your dashboard. Your
            account must be a member of Saku.
          </p>
        </div>

        {/* OAuth2 error feedback */}
        {errorKey && ERROR_MESSAGES[errorKey] && (
          <div className="bg-accent/10 border border-accent/20 rounded-lg px-4 py-3 w-full">
            <p className="text-accent/80 text-sm text-center">
              {ERROR_MESSAGES[errorKey]}
            </p>
          </div>
        )}

        {/* Redirect to the Express OAuth2 login handler */}
        <a
          href={`${apiBase}/auth/login`}
          className="flex items-center justify-center gap-3 bg-[#5865F2] hover:bg-[#4752C4] transition-colors rounded-lg w-full py-3 text-white font-medium"
        >
          <FaDiscord size={20} />
          Login with Discord
        </a>
      </div>
    </div>
  );
};

export default Login;
