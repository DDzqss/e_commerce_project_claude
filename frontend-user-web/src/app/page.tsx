import { SiteHeader } from "@/components/layout/SiteHeader";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-5xl flex-col items-center justify-center gap-8 px-6 py-16">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-500">
            JD-Clone · Phase 1
          </span>
          <h1 className="text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">
            欢迎来到{" "}
            <span className="text-[color:var(--color-primary)]">JD-Clone</span>
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-neutral-600">
            电商平台建设中，用户认证已就绪。稍后将陆续上线商品浏览、购物车、下单、订单与售后等能力。
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { title: "商品浏览", desc: "全品类导航、搜索与筛选" },
            { title: "极简下单", desc: "多店铺购物车与快捷结算" },
            { title: "透明售后", desc: "订单全链路可追溯与仲裁" },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm"
            >
              <h2 className="text-base font-medium text-neutral-900">
                {item.title}
              </h2>
              <p className="mt-2 text-sm text-neutral-500">{item.desc}</p>
            </div>
          ))}
        </div>

        <footer className="mt-8 text-xs text-neutral-400">
          本站点为学习项目，非京东官方，与京东集团无任何关联。
        </footer>
      </main>
    </>
  );
}
