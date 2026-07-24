/**
 * CategoryTreeEditor 单元测试。
 *
 * 覆盖：
 * - 树渲染层级正确
 * - 空树时展示引导文案
 * - 添加子类目按钮在 level=3 时 disabled（契约 §6.1 最大 3 级）
 * - 上/下移按钮在边界节点 disabled
 * - onEdit / onDelete / onAddChild / onMove 回调触发
 * - flattenTree / countTreeNodes / pickLeaves helper 正确
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  CategoryTreeEditor,
  countTreeNodes,
  flattenTree,
  pickLeaves,
} from "@/components/ui/CategoryTreeEditor";
import type { CategoryTreeNode } from "@/types/api";

function node(
  id: number,
  name: string,
  level: number,
  extra: Partial<CategoryTreeNode> = {},
  children: CategoryTreeNode[] = [],
): CategoryTreeNode {
  return {
    id,
    parent_id: null,
    name,
    // 用 id 派生 slug，避免中文 name 与 slug 视觉上一致导致 getByText 匹配 code
    slug: `slug-${id}`,
    level,
    path: String(id),
    icon_url: null,
    sort_order: 0,
    is_visible: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...extra,
    children,
  };
}

/**
 * 构造示范树：
 *   数码 (L1) ─┬─ 手机通讯 (L2) ─┬─ 手机 (L3)
 *              │                 └─ 对讲机 (L3)
 *              └─ 电脑办公 (L2) ── 笔记本电脑 (L3)
 */
function sampleTree(): CategoryTreeNode[] {
  return [
    node(1, "数码", 1, {}, [
      node(11, "手机通讯", 2, { parent_id: 1 }, [
        node(111, "手机", 3, { parent_id: 11 }),
        node(112, "对讲机", 3, { parent_id: 11, sort_order: 1 }),
      ]),
      node(12, "电脑办公", 2, { parent_id: 1, sort_order: 1 }, [
        node(121, "笔记本电脑", 3, { parent_id: 12 }),
      ]),
    ]),
  ];
}

describe("CategoryTreeEditor", () => {
  it("空树展示引导文案", () => {
    render(
      <CategoryTreeEditor
        tree={[]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onAddChild={vi.fn()}
      />,
    );
    expect(screen.getByText(/暂无类目/)).toBeInTheDocument();
  });

  it("展示树的各级节点名称", () => {
    render(
      <CategoryTreeEditor
        tree={sampleTree()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onAddChild={vi.fn()}
      />,
    );
    expect(screen.getByText("数码")).toBeInTheDocument();
    expect(screen.getByText("手机通讯")).toBeInTheDocument();
    expect(screen.getByText("手机")).toBeInTheDocument();
    expect(screen.getByText("对讲机")).toBeInTheDocument();
    expect(screen.getByText("笔记本电脑")).toBeInTheDocument();
  });

  it("Level=3 节点的「添加子类目」按钮 disabled", () => {
    render(
      <CategoryTreeEditor
        tree={sampleTree()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onAddChild={vi.fn()}
      />,
    );
    // 所有 "+ 子类目" 按钮
    const buttons = screen.getAllByRole("button", { name: /子类目/ });
    // 期望：L1 数码 + L2 手机通讯 + L2 电脑办公 都是 enabled；L3（手机/对讲机/笔记本电脑）都 disabled
    const enabled = buttons.filter((b) => !(b as HTMLButtonElement).disabled);
    const disabled = buttons.filter((b) => (b as HTMLButtonElement).disabled);
    expect(enabled).toHaveLength(3);
    expect(disabled).toHaveLength(3);
  });

  it("触发 onEdit / onDelete / onAddChild 回调", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const onAddChild = vi.fn();
    render(
      <CategoryTreeEditor
        tree={sampleTree()}
        onEdit={onEdit}
        onDelete={onDelete}
        onAddChild={onAddChild}
      />,
    );

    // 找到第一行「数码」附近的"编辑"按钮（第一个匹配即可）
    fireEvent.click(screen.getAllByRole("button", { name: "编辑" })[0]!);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit.mock.calls[0]?.[0].id).toBe(1);

    fireEvent.click(screen.getAllByRole("button", { name: "删除" })[0]!);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete.mock.calls[0]?.[0].id).toBe(1);

    // 「+ 子类目」在数码节点
    const addBtns = screen.getAllByRole("button", { name: /子类目/ });
    fireEvent.click(addBtns[0]!);
    expect(onAddChild).toHaveBeenCalledTimes(1);
  });

  it("上/下移按钮在边界 disabled，非边界可点击", () => {
    const onMove = vi.fn();
    render(
      <CategoryTreeEditor
        tree={sampleTree()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onAddChild={vi.fn()}
        onMove={onMove}
      />,
    );

    // "上移 数码" — 只有一个根节点，上/下都 disabled
    const upBtn = screen.getByRole("button", { name: "上移 数码" });
    const downBtn = screen.getByRole("button", { name: "下移 数码" });
    expect((upBtn as HTMLButtonElement).disabled).toBe(true);
    expect((downBtn as HTMLButtonElement).disabled).toBe(true);

    // "手机通讯" 有兄弟 "电脑办公"：手机通讯 down 可用
    const downSubBtn = screen.getByRole("button", { name: "下移 手机通讯" });
    expect((downSubBtn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(downSubBtn);
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove.mock.calls[0]?.[1]).toBe("down");
  });

  it("readOnly 模式下不渲染任何操作按钮", () => {
    render(
      <CategoryTreeEditor
        tree={sampleTree()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onAddChild={vi.fn()}
        readOnly
      />,
    );
    expect(screen.queryByRole("button", { name: "编辑" })).toBeNull();
    expect(screen.queryByRole("button", { name: "删除" })).toBeNull();
    expect(screen.queryByRole("button", { name: /子类目/ })).toBeNull();
  });
});

describe("tree helpers", () => {
  it("countTreeNodes 递归计数", () => {
    expect(countTreeNodes(sampleTree())).toBe(6);
    expect(countTreeNodes([])).toBe(0);
  });

  it("flattenTree 前序遍历", () => {
    const flat = flattenTree(sampleTree()).map((n) => n.id);
    expect(flat).toEqual([1, 11, 111, 112, 12, 121]);
  });

  it("pickLeaves 返回叶子节点（无 children）", () => {
    const leaves = pickLeaves(sampleTree()).map((n) => n.id);
    expect(leaves).toEqual([111, 112, 121]);
  });
});
