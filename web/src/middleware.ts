import { defineMiddleware } from "astro:middleware";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "astro:env/server";
import { ACCESS_COOKIE, REFRESH_COOKIE, fetchMe, refreshTokens } from "./lib/session";

function cookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure,
  };
}

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;
  const secure = context.url.protocol === "https:";
  const opts = cookieOptions(secure);
  const url = SUPABASE_URL ?? "";
  const anonKey = SUPABASE_ANON_KEY ?? "";

  const access = context.cookies.get(ACCESS_COOKIE)?.value ?? "";
  const refresh = context.cookies.get(REFRESH_COOKIE)?.value ?? "";

  let token = access;
  let user = token && url && anonKey ? await fetchMe({ url, anonKey, token }) : null;

  if (!user && refresh && url && anonKey) {
    const rotated = await refreshTokens({ url, anonKey, refreshToken: refresh });
    if (rotated) {
      context.cookies.set(ACCESS_COOKIE, rotated.access_token, { ...opts, maxAge: 60 * 60 * 24 * 7 });
      context.cookies.set(REFRESH_COOKIE, rotated.refresh_token, { ...opts, maxAge: 60 * 60 * 24 * 30 });
      token = rotated.access_token;
      user = await fetchMe({ url, anonKey, token });
    }
  }

  if (path === "/login") {
    if (user) return context.redirect("/");
    return next();
  }

  if (!user) return context.redirect("/login");

  context.locals.user = user;
  context.locals.accessToken = token;
  context.locals.supabaseUrl = url;
  context.locals.supabaseAnonKey = anonKey;
  return next();
});
