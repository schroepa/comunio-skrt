import type { APIRoute } from "astro";
import { DIRECTUS_URL } from "astro:env/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "../lib/session";

export const POST: APIRoute = async ({ cookies, redirect }) => {
  const refresh = cookies.get(REFRESH_COOKIE)?.value;
  if (refresh) {
    try {
      await fetch(`${DIRECTUS_URL.replace(/\/$/, "")}/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
    } catch {
      /* still clear cookies */
    }
  }
  cookies.delete(ACCESS_COOKIE, { path: "/" });
  cookies.delete(REFRESH_COOKIE, { path: "/" });
  return redirect("/login");
};
