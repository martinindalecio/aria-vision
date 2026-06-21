"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import kv from "@/lib/kv";

export async function logoutAdmin(): Promise<void> {
  cookies().set("admin_session", "", { maxAge: 0, path: "/" });
  redirect("/admin/login");
}

type HeldPost = {
  title_en?: string;
  title_es?: string;
  body_md_en?: string;
  body_md_es?: string;
  title?: string;
  body_md?: string;
  stats?: { sessions: number; cities: string[]; countries: string[] };
  reason?: string;
};

export async function releaseHeldPost(date: string): Promise<void> {
  const held = await kv.get<HeldPost>(`aria:held:${date}`);
  if (!held) throw new Error(`No held post for ${date}`);

  const post = {
    title_en: held.title_en ?? held.title ?? "[UNTITLED]",
    title_es: held.title_es ?? held.title ?? "[SIN TÍTULO]",
    body_md_en: held.body_md_en ?? held.body_md ?? "",
    body_md_es: held.body_md_es ?? held.body_md ?? "",
    title: held.title_en ?? held.title ?? "[UNTITLED]",
    body_md: held.body_md_en ?? held.body_md ?? "",
    stats: held.stats ?? { sessions: 0, cities: [], countries: [] },
    published_at: new Date().toISOString(),
  };

  const score = Number(date.replace(/-/g, ""));
  await Promise.all([
    kv.set(`aria:post:${date}`, post),
    kv.zadd("aria:posts", { score, member: date }),
    kv.del(`aria:held:${date}`),
  ]);

  revalidatePath("/admin");
  revalidatePath("/log");
}
