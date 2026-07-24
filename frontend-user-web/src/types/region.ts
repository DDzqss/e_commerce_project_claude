/**
 * Phase 5 · 地区（省 / 市 / 区）类型。
 *
 * 严格对齐 docs/API/phase-5-contracts.md §3.5 / §7。
 */

export type RegionLevel = 1 | 2 | 3;

/** 单个节点。 */
export interface RegionOut {
  code: string;
  parent_code: string | null;
  name: string;
  short_name: string | null;
  level: RegionLevel;
  sort_order: number;
}

/** 树形节点（返回全量树时使用）。 */
export interface RegionTreeNode extends RegionOut {
  children: RegionTreeNode[];
}
