/**
 * 类目管理 API 封装（Admin 端）。
 *
 * 契约 §6.1：
 * - GET    /admin/categories             返回完整树（不分页；量级 <500）
 * - GET    /admin/categories/{id}
 * - POST   /admin/categories             { parent_id?, name, slug, icon_url?, sort_order?, is_visible? }
 * - PATCH  /admin/categories/{id}        （不允许改 parent_id）
 * - DELETE /admin/categories/{id}        软删；6002 = 有子类目或被 SPU 引用
 *
 * 权限：admin:category:manage
 */

import { apiGet, apiPost, apiPatch, api, unwrap } from "@/lib/api";
import type { ApiResponse } from "@/types";
import type {
  CategoryOut,
  CategoryTreeNode,
  CreateCategoryPayload,
  UpdateCategoryPayload,
} from "@/types/api";

/**
 * GET /admin/categories
 *
 * 后端返回完整平铺列表或树；前端统一转换为树（若返回平铺，用 buildTree 组装）。
 */
export async function listAllCategories(): Promise<CategoryTreeNode[]> {
  // 后端返回可能是 tree 或 flat；两种都兼容。
  const data = await apiGet<CategoryTreeNode[] | CategoryOut[]>(
    "admin/categories",
  );
  if (data.length === 0) return [];
  // 判断是否已带 children：若首元素已有 children 字段则视为 tree
  const first = data[0] as Partial<CategoryTreeNode>;
  if (Array.isArray(first.children)) {
    return data as CategoryTreeNode[];
  }
  return buildTree(data as CategoryOut[]);
}

/**
 * 从平铺列表构建树。按 parent_id 组装 + sort_order 排序（同级）。
 */
export function buildTree(flat: readonly CategoryOut[]): CategoryTreeNode[] {
  const map = new Map<number, CategoryTreeNode>();
  for (const item of flat) {
    map.set(item.id, { ...item, children: [] });
  }
  const roots: CategoryTreeNode[] = [];
  for (const item of flat) {
    const node = map.get(item.id);
    if (!node) continue;
    if (item.parent_id === null || item.parent_id === undefined) {
      roots.push(node);
    } else {
      const parent = map.get(item.parent_id);
      if (parent) parent.children.push(node);
      else roots.push(node); // 孤儿节点兜底放根
    }
  }
  const sortRec = (nodes: CategoryTreeNode[]) => {
    nodes.sort(
      (a, b) => a.sort_order - b.sort_order || a.id - b.id,
    );
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

/**
 * GET /admin/categories/{id}
 */
export function getCategory(id: number | string): Promise<CategoryOut> {
  return apiGet<CategoryOut>(`admin/categories/${id}`);
}

/**
 * POST /admin/categories
 * 后端根据 parent_id 自动计算 level / path。
 * 错误：6003 层级超限 / 5001 校验
 */
export function createCategory(
  payload: CreateCategoryPayload,
): Promise<CategoryOut> {
  return apiPost<CategoryOut, CreateCategoryPayload>(
    "admin/categories",
    payload,
  );
}

/**
 * PATCH /admin/categories/{id}
 * 允许改 name/slug/icon/sort_order/is_visible。**不允许改 parent_id**（契约 §6.1）。
 * 错误：6001 不存在
 */
export function updateCategory(
  id: number | string,
  payload: UpdateCategoryPayload,
): Promise<CategoryOut> {
  return apiPatch<CategoryOut, UpdateCategoryPayload>(
    `admin/categories/${id}`,
    payload,
  );
}

/**
 * DELETE /admin/categories/{id}
 * 软删。错误：6001 不存在 / 6002 有子类目或被商品引用不可删。
 */
export function deleteCategory(id: number | string): Promise<null> {
  return unwrap(api.delete(`admin/categories/${id}`).json<ApiResponse<null>>());
}

// ---------------------------------------------------------------------------
// 前端辅助
// ---------------------------------------------------------------------------

/**
 * 遍历树，找出叶子 / 深度信息，供 UI 判断"添加子类目"是否可用（level=3 禁用）。
 */
export function countChildren(node: CategoryTreeNode): number {
  return node.children.length;
}
