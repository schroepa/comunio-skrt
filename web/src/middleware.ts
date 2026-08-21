import { defineMiddleware } from "astro:middleware";
import { DIRECTUS_URL } from "astro:env/server";
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

  const access = context.cookies.get(ACCESS_COOKIE)?.value ?? "";
  const refresh = context.cookies.get(REFRESH_COOKIE)?.value ?? "";

  let token = access;
  let user = token ? await fetchMe({ url: DIRECTUS_URL, token }) : null;

  if (!user && refresh) {
    const rotated = await refreshTokens({ url: DIRECTUS_URL, refreshToken: refresh });
    if (rotated) {
      context.cookies.set(ACCESS_COOKIE, rotated.access_token, { ...opts, maxAge: 60 * 60 * 24 * 7 });
      context.cookies.set(REFRESH_COOKIE, rotated.refresh_token, { ...opts, maxAge: 60 * 60 * 24 * 30 });
      token = rotated.access_token;
      user = await fetchMe({ url: DIRECTUS_URL, token });
    }
  }

  if (path === "/login") {
    if (user) return context.redirect("/");
    return next();
  }

  if (!user) return context.redirect("/login");

  context.locals.user = user;
  context.locals.accessToken = token;
  return next();
});
