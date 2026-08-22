/// <reference types="astro/client" />

interface Window {
  closeAppSidebar: () => void;
}

declare namespace App {
  interface Locals {
    user: { id: string; email: string };
    accessToken: string;
    supabaseUrl: string;
    supabaseAnonKey: string;
  }
}
