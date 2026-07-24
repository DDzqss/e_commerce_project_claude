/**
 * Phase 2 商品/类目/品牌相关强类型定义。
 *
 * 严格对齐 docs/API/phase-2-contracts.md：
 * - §3 数据模型（Category / Brand / SPU / SKU）
 * - §6.1 类目公开接口
 * - §6.2 品牌公开接口
 * - §11 用户浏览与搜索
 *
 * 关键约定：
 * - 金额一律用整数分 `*_cents: number`
 * - 图片 URL 全部存 MinIO object key（不含 host），渲染时前端拼 CDN 前缀
 * - 命名与后端 snake_case 保持一致，避免手工映射错位
 */

/** ---- Category ---- */

export interface CategoryOut {
  id: number;
  parent_id: number | null;
  name: string;
  slug: string;
  level: 1 | 2 | 3;
  path: string;
  icon_url: string | null;
  sort_order: number;
  is_visible: boolean;
}

/** 树形结构（GET /catalog/categories 返回）。 */
export interface CategoryTree extends CategoryOut {
  children: CategoryTree[];
}

/** 面包屑用的精简版本（详情页返回）。 */
export interface CategoryBreadcrumbItem {
  id: number;
  name: string;
}

export interface CategoryWithBreadcrumb {
  id: number;
  name: string;
  path: CategoryBreadcrumbItem[];
}

/** ---- Brand ---- */

export interface BrandOut {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  sort_order: number;
  is_visible: boolean;
}

export interface BrandBrief {
  id: number;
  name: string;
  slug?: string;
  logo_url?: string | null;
}

/** ---- SPU ---- */

/** 列表页/搜索页/推荐位使用的 SPU 简版结构。见 §11.2。 */
export interface SPUListItem {
  id: number;
  title: string;
  subtitle: string | null;
  main_image: string;
  min_price_cents: number;
  max_price_cents: number;
  sales_count: number;
  brand: BrandBrief | null;
  category: {
    id: number;
    name: string;
  } | null;
}

/** ---- SKU ---- */

/** SPU 详情页返回的 SKU 完整结构。见 §11.3。 */
export interface SKUOut {
  id: number;
  sku_code: string;
  specs: Record<string, string>;
  price_cents: number;
  original_price_cents: number | null;
  stock: number;
  image: string | null;
  is_active: boolean;
}

/** ---- SPU 详情 ---- */

export interface ShopBrief {
  id: number;
  name: string;
}

/** SPU 详情。见 §11.3。 */
export interface SPUDetail {
  id: number;
  title: string;
  subtitle: string | null;
  description: string | null;
  main_image: string;
  images: string[];
  spec_axes: string[];
  min_price_cents: number;
  max_price_cents: number;
  sales_count: number;
  view_count: number;
  shop: ShopBrief;
  brand: BrandBrief | null;
  category: CategoryWithBreadcrumb;
  skus: SKUOut[];
  published_at: string | null;
}

/** ---- 列表查询参数 ---- */

export type SPUSort =
  | "default"
  | "newest"
  | "price_asc"
  | "price_desc"
  | "sales";

export interface SPUListQuery {
  category_id?: number;
  brand_id?: number;
  keyword?: string;
  min_price_cents?: number;
  max_price_cents?: number;
  sort?: SPUSort;
  page?: number;
  size?: number;
}

export interface BrandListQuery {
  visible?: boolean;
  keyword?: string;
  page?: number;
  size?: number;
}
