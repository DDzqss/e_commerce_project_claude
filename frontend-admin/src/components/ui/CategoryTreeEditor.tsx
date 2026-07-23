"use client";

/**
 * 类目树的可视化编辑器。
 *
 * 特性：
 * - 树形展开 / 收起（默认全部展开）
 * - 拖拽 sort_order 简化为「上移 / 下移」按钮（在同 parent 内交换 sort_order）
 * - 每个节点操作：编辑 / 删除 / 添加子类目（level=3 时"添加子类目"禁用）
 *
 * 交互契约：
 * - 所有编辑动作通过 props 上抛（onEdit / onDelete / onAddChild / onMove），
 *   父组件负责调 API + invalidate query。
 * - 组件本身保持纯展示，仅维护"展开/收起"的本地状态。
 *
 * 契约 §6.1：类目层级最大 3。
 */

import { useState } from "react";
import clsx from "clsx";
import { Badge } from "./Badge";
import type { CategoryTreeNode } from "@/types/api";

const MAX_LEVEL = 3;

interface CategoryTreeEditorProps {
  tree: readonly CategoryTreeNode[];
  onEdit: (node: CategoryTreeNode) => void;
  onDelete: (node: CategoryTreeNode) => void;
  /** 触发"添加子类目"（在此 node 下）；根节点添加走另一个入口 */
  onAddChild: (parent: CategoryTreeNode) => void;
  /**
   * 触发上移 / 下移；父组件根据 direction 交换两个同级节点的 sort_order。
   * canMove 由本组件计算并 disable 相应按钮。
   */
  onMove?: (
    node: CategoryTreeNode,
    direction: "up" | "down",
    siblings: readonly CategoryTreeNode[],
  ) => void;
  /** 只读模式（无 review 权限时展示 tree 但不可编辑） */
  readOnly?: boolean;
}

export function CategoryTreeEditor({
  tree,
  onEdit,
  onDelete,
  onAddChild,
  onMove,
  readOnly = false,
}: CategoryTreeEditorProps) {
  if (tree.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-[color:var(--color-border)] bg-white p-8 text-center text-sm text-neutral-500">
        暂无类目。点击右上角「新建根类目」开始。
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-1 rounded-md border border-[color:var(--color-border)] bg-white p-3">
      {tree.map((node, index) => (
        <TreeItem
          key={node.id}
          node={node}
          siblings={tree}
          index={index}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddChild={onAddChild}
          onMove={onMove}
          readOnly={readOnly}
        />
      ))}
    </ul>
  );
}

interface TreeItemProps {
  node: CategoryTreeNode;
  siblings: readonly CategoryTreeNode[];
  index: number;
  onEdit: (node: CategoryTreeNode) => void;
  onDelete: (node: CategoryTreeNode) => void;
  onAddChild: (parent: CategoryTreeNode) => void;
  onMove?: (
    node: CategoryTreeNode,
    direction: "up" | "down",
    siblings: readonly CategoryTreeNode[],
  ) => void;
  readOnly?: boolean;
}

function TreeItem({
  node,
  siblings,
  index,
  onEdit,
  onDelete,
  onAddChild,
  onMove,
  readOnly,
}: TreeItemProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const canAddChild = node.level < MAX_LEVEL;
  const canMoveUp = index > 0;
  const canMoveDown = index < siblings.length - 1;

  return (
    <li>
      <div
        className={clsx(
          "flex items-center gap-2 rounded px-2 py-1.5 transition hover:bg-neutral-50",
          !node.is_visible && "opacity-70",
        )}
      >
        <button
          type="button"
          onClick={() => hasChildren && setExpanded((v) => !v)}
          disabled={!hasChildren}
          aria-label={
            hasChildren ? (expanded ? "折叠" : "展开") : "叶子节点"
          }
          className={clsx(
            "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs text-neutral-500",
            hasChildren
              ? "hover:bg-neutral-200"
              : "text-transparent cursor-default",
          )}
        >
          {hasChildren ? (expanded ? "−" : "+") : "·"}
        </button>

        <span className="text-xs text-neutral-400 tabular-nums">
          L{node.level}
        </span>

        <span className="font-medium text-neutral-900">{node.name}</span>

        <span className="text-xs text-neutral-500">
          <code className="rounded bg-neutral-100 px-1.5 py-0.5">{node.slug}</code>
        </span>

        {!node.is_visible ? (
          <Badge tone="default">已隐藏</Badge>
        ) : null}

        <span className="ml-auto flex items-center gap-1 text-xs">
          {!readOnly && onMove ? (
            <>
              <button
                type="button"
                title="上移"
                aria-label={`上移 ${node.name}`}
                disabled={!canMoveUp}
                onClick={() => onMove(node, "up", siblings)}
                className="rounded px-1.5 py-0.5 text-neutral-500 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-300"
              >
                ↑
              </button>
              <button
                type="button"
                title="下移"
                aria-label={`下移 ${node.name}`}
                disabled={!canMoveDown}
                onClick={() => onMove(node, "down", siblings)}
                className="rounded px-1.5 py-0.5 text-neutral-500 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-300"
              >
                ↓
              </button>
              <span className="mx-1 h-4 w-px bg-neutral-200" aria-hidden />
            </>
          ) : null}

          {!readOnly ? (
            <>
              <button
                type="button"
                onClick={() => onAddChild(node)}
                disabled={!canAddChild}
                title={
                  canAddChild
                    ? "添加子类目"
                    : "已达 3 级上限，无法再添加子类目"
                }
                className="rounded px-2 py-0.5 text-[color:var(--color-info)] hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-neutral-300 disabled:hover:bg-transparent"
              >
                + 子类目
              </button>
              <button
                type="button"
                onClick={() => onEdit(node)}
                className="rounded px-2 py-0.5 text-[color:var(--color-primary)] hover:bg-neutral-100"
              >
                编辑
              </button>
              <button
                type="button"
                onClick={() => onDelete(node)}
                className="rounded px-2 py-0.5 text-[color:var(--color-danger)] hover:bg-red-50"
              >
                删除
              </button>
            </>
          ) : null}
        </span>
      </div>

      {hasChildren && expanded ? (
        <ul
          className="ml-6 mt-1 flex flex-col gap-1 border-l border-neutral-200 pl-3"
          aria-label={`${node.name} 的子类目`}
        >
          {node.children.map((child, i) => (
            <TreeItem
              key={child.id}
              node={child}
              siblings={node.children}
              index={i}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onMove={onMove}
              readOnly={readOnly}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * 计算树的总节点数（用于 dashboard 或 header 显示）。
 */
export function countTreeNodes(tree: readonly CategoryTreeNode[]): number {
  let sum = 0;
  const walk = (nodes: readonly CategoryTreeNode[]) => {
    for (const n of nodes) {
      sum += 1;
      walk(n.children);
    }
  };
  walk(tree);
  return sum;
}

/**
 * 展平树（前序遍历）。方便 dashboard / 搜索场景。
 */
export function flattenTree(
  tree: readonly CategoryTreeNode[],
): CategoryTreeNode[] {
  const out: CategoryTreeNode[] = [];
  const walk = (nodes: readonly CategoryTreeNode[]) => {
    for (const n of nodes) {
      out.push(n);
      walk(n.children);
    }
  };
  walk(tree);
  return out;
}

/**
 * 便捷 helper：从树里找出叶子（Level 3）节点。测试用。
 */
export function pickLeaves(
  tree: readonly CategoryTreeNode[],
): CategoryTreeNode[] {
  return flattenTree(tree).filter((n) => n.children.length === 0);
}
