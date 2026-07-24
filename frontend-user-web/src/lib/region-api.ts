/**
 * Phase 5 · 地区数据 API 客户端。
 *
 * 契约：docs/API/phase-5-contracts.md §7
 *   GET /regions/tree                         全量 3 级树（前端本地缓存 24h）
 *   GET /regions/children/{parent_code}       单层子节点；root/空返回省列表
 *
 * 本地缓存策略：
 * - Tree：全量表数据几十 KB，一次拉齐；用 localStorage 存 24h 版本
 * - Children：按需拉取；同一 parent_code 内存去重
 */

import { apiGet } from './api';
import type { RegionOut, RegionTreeNode } from '@/types/region';

const CACHE_KEY = 'region-tree:v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

interface CachedTree {
  ts: number;
  tree: RegionTreeNode[];
}

type ItemsEnvelope<T> = { items?: T[] };

function unwrapItems<T>(data: T[] | ItemsEnvelope<T>): T[] {
  return Array.isArray(data) ? data : (data.items ?? []);
}

function safeLocal(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readCache(): RegionTreeNode[] | null {
  const s = safeLocal();
  if (!s) return null;
  try {
    const raw = s.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedTree;
    if (!parsed?.tree || !Array.isArray(parsed.tree)) return null;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed.tree;
  } catch {
    return null;
  }
}

function writeCache(tree: RegionTreeNode[]): void {
  const s = safeLocal();
  if (!s) return;
  try {
    const payload: CachedTree = { ts: Date.now(), tree };
    s.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* quota exceeded etc. */
  }
}

/**
 * GET /regions/tree — 全量树。带 24h localStorage 缓存。
 */
export async function getRegionTree(force = false): Promise<RegionTreeNode[]> {
  if (!force) {
    const cached = readCache();
    if (cached) return cached;
  }
  const data = await apiGet<RegionTreeNode[] | ItemsEnvelope<RegionTreeNode>>('regions/tree');
  const tree = unwrapItems(data);
  writeCache(tree);
  return tree;
}

/** GET /regions/children/{parent_code} — 单层子节点。 */
export async function getRegionChildren(
  parentCode: string | 'root' | '' | null,
): Promise<RegionOut[]> {
  const key = parentCode && parentCode !== '' ? parentCode : 'root';
  const data = await apiGet<RegionOut[] | ItemsEnvelope<RegionOut>>(
    `regions/children/${encodeURIComponent(key)}`,
  );
  return unwrapItems(data);
}

/** 手动清空缓存（调试或用户主动刷新）。 */
export function clearRegionCache(): void {
  const s = safeLocal();
  if (!s) return;
  try {
    s.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}
