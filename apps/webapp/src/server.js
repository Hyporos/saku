import express from "express";
import axios from "axios";
import session from "express-session";
import cors from "cors";
import "dotenv/config";

const PORT = process.env.PORT || 8000;
const LOCAL_WEB_ORIGIN = "http://localhost:5173";
const DISCORD_API = "https://discord.com/api/v10";
const isProd = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);

// Role IDs
const BEE_ROLE_ID = process.env.BEE_ROLE_ID;
const FRIENDS_ROLE_ID = "720006084252663868";

const app = express();
app.set("trust proxy", 1);

const allowedOrigins = new Set(
  [
    LOCAL_WEB_ORIGIN,
    process.env.WEB_ORIGIN,
    "https://sakubot.com",
    "https://www.sakubot.com",
  ].filter(Boolean)
);

function getRequestOrigin(req) {
  if (process.env.WEB_ORIGIN) return process.env.WEB_ORIGIN;
  const protoHeader = req.headers["x-forwarded-proto"];
  const proto = typeof protoHeader === "string"
    ? protoHeader.split(",")[0]
    : (req.protocol || "https");
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (host) return `${proto}://${host}`;
  return LOCAL_WEB_ORIGIN;
}

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin)) return cb(null, true);
      if (origin.endsWith(".vercel.app")) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
    },
  })
);

app.use(express.json({ limit: "50mb" }));

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// Redirect the user to Discord's OAuth2 authorization page
app.get("/auth/login", (_req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: "code",
    // identify — user profile, guilds.members.read — server roles
    scope: "identify guilds.members.read",
  });
  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

// Exchange the OAuth2 code for a token, verify guild membership and roles
app.get("/auth/callback", async (req, res) => {
  const appOrigin = getRequestOrigin(req);
  const { code } = req.query;
  if (!code) return res.redirect(`${appOrigin}/login?error=no_code`);

  try {
    // Exchange the authorization code for an access token
    const tokenRes = await axios.post(
      `${DISCORD_API}/oauth2/token`,
      new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code: String(code),
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { access_token } = tokenRes.data;

    // Fetch the Discord user's profile
    const userRes = await axios.get(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const { id, username, avatar } = userRes.data;

    // Fetch the user's membership info for the Saku guild (roles, nickname, etc.)
    const memberRes = await axios.get(
      `${DISCORD_API}/users/@me/guilds/${process.env.SAKU_GUILD_ID}/member`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    const roles = memberRes.data.roles ?? [];

    // Friends (role) are not permitted to access the dashboard
    if (roles.includes(FRIENDS_ROLE_ID)) {
      return res.redirect(`${appOrigin}/login?error=friends`);
    }

    const isBee = roles.includes(BEE_ROLE_ID);

    const avatarUrl = avatar
      ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.webp`
      : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(id) % 5n)}.png`;

    // Persist the user to the session cookie
    req.session.user = { id, username, avatar: avatarUrl, isBee };

    res.redirect(appOrigin);
  } catch (error) {
    console.error("OAuth2 callback error:", error?.response?.data ?? error);

    // If Discord returns 404 the user is simply not in the guild
    const status = error?.response?.status;
    const errorKey = status === 404 ? "not_in_guild" : "auth_failed";
    res.redirect(`${appOrigin}/login?error=${errorKey}`);
  }
});

// Return the authenticated user from the session, or 401 if not logged in
app.get("/auth/me", (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
  res.json(req.session.user);
});

// Destroy the session and redirect back to the login page
app.get("/auth/logout", (req, res) => {
  const appOrigin = getRequestOrigin(req);
  req.session.destroy(() => {
    res.redirect(`${appOrigin}/login`);
  });
});

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// Proxy all /bot/* requests to the bot's Express API server-side.
// This avoids Mixed Content errors when the webapp is served over HTTPS
// but the bot API is plain HTTP (e.g. a raw VPS/game-host IP).
app.all("/bot/*", async (req, res) => {
  // For admin routes: verify the session user is a bee (or the owner).
  // If not, reject before forwarding — never let unauth requests reach the bot.
  const targetPath = req.path.replace(/^\/bot/, "");
  if (targetPath.startsWith("/api/admin/")) {
    const user = req.session.user;
    const isOwner = user?.id === process.env.OWNER_ID;
    if (!user || (!user.isBee && !isOwner)) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }

  // Dynamically determine bot API URL: use localhost if webapp is running locally, else use env
  let botApiUrl = process.env.BOT_API_URL;
  const isLocal = ["localhost", "127.0.0.1"].some((host) =>
    req.headers.host?.startsWith(host)
  );
  if (isLocal) {
    // Default to local bot port (3000) if running locally
    botApiUrl = "http://localhost:3000";
  }
  if (!botApiUrl) {
    return res.status(503).json({ error: "BOT_API_URL is not configured" });
  }

  // Strip the /bot prefix and forward to the real bot API
  const query = req.url.includes("?") ? "?" + req.url.split("?")[1] : "";
  const targetUrl = `${botApiUrl}${targetPath}${query}`;

  // For admin routes, forward the shared secret so the bot can validate the source
  const extraHeaders = {};
  if (targetPath.startsWith("/api/admin/")) {
    extraHeaders["x-admin-secret"] = process.env.ADMIN_API_SECRET ?? "";
    extraHeaders["x-admin-user-id"] = req.session.user?.id ?? "";
    extraHeaders["x-admin-username"] = req.session.user?.username ?? "";
    extraHeaders["x-admin-is-owner"] = String(req.session.user?.id === process.env.OWNER_ID);
  }

  try {
    const botRes = await axios({
      method: req.method,
      url: targetUrl,
      data: Object.keys(req.body ?? {}).length ? req.body : undefined,
      headers: { "Content-Type": "application/json", ...extraHeaders },
    });
    res.status(botRes.status).json(botRes.data);
  } catch (error) {
    const status = error?.response?.status ?? 502;
    res.status(status).json(error?.response?.data ?? { error: "Bot API error" });
  }
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
  });
}

export default app;
