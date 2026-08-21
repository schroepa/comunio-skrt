import type { APIRoute } from "astro";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "astro:env/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "../lib/session";

export const POST: APIRoute = async ({ cookies, redirect }) => {
  const access = cookies.get(ACCESS_COOKIE)?.value;
  const url = (SUPABASE_URL ?? "").replace(/\/$/, "");
  const anonKey = SUPABASE_ANON_KEY ?? "";
  if (access && url && anonKey) {
    try {
      await fetch(`${url}/auth/v1/logout`, {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${access}`,
          "Content-Type": "application/json",
        },
      });
    } catch {
      /* still clear cookies */
    }
  }
  cookies.delete(ACCESS_COOKIE, { path: "/" });
  cookies.delete(REFRESH_COOKIE, { path: "/" });
  return redirect("/login");
};
