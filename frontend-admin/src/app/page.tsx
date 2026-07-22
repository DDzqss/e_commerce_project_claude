import { redirect } from "next/navigation";

/**
 * 根路径重定向。
 *
 * 管理端不提供任何"落地页"式内容 —— 未登录用户后续会被
 * (console)/layout.tsx 中的鉴权守卫拦截并跳转到 /login。
 */
export default function RootPage(): never {
  redirect("/console");
}
