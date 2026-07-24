/**
 * Phase 5 RegionCascader 单元测试。
 *
 * 目标：
 * - 首次挂载：拉省份
 * - 选省后：拉市；选市后：拉区
 * - 改省：清空市/区
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";

import {
  RegionCascader,
  type RegionValue,
} from "@/components/ui/RegionCascader";
import * as regionApi from "@/lib/region-api";
import type { RegionOut } from "@/types/region";

const provinces: RegionOut[] = [
  {
    code: "11",
    parent_code: null,
    name: "北京市",
    short_name: "京",
    level: 1,
    sort_order: 0,
  },
  {
    code: "31",
    parent_code: null,
    name: "上海市",
    short_name: "沪",
    level: 1,
    sort_order: 0,
  },
];

const beijingCities: RegionOut[] = [
  {
    code: "1101",
    parent_code: "11",
    name: "市辖区",
    short_name: null,
    level: 2,
    sort_order: 0,
  },
];

const beijingDistricts: RegionOut[] = [
  {
    code: "110101",
    parent_code: "1101",
    name: "东城区",
    short_name: null,
    level: 3,
    sort_order: 0,
  },
  {
    code: "110105",
    parent_code: "1101",
    name: "朝阳区",
    short_name: null,
    level: 3,
    sort_order: 0,
  },
];

const shanghaiCities: RegionOut[] = [
  {
    code: "3101",
    parent_code: "31",
    name: "市辖区",
    short_name: null,
    level: 2,
    sort_order: 0,
  },
];

function Harness({
  onValue,
}: {
  onValue?: (v: RegionValue) => void;
}) {
  const [value, setValue] = useState<RegionValue>({
    province_code: null,
    city_code: null,
    district_code: null,
    province_name: null,
    city_name: null,
    district_name: null,
  });
  return (
    <RegionCascader
      value={value}
      onChange={(v) => {
        setValue(v);
        onValue?.(v);
      }}
    />
  );
}

describe("RegionCascader", () => {
  const childrenSpy = vi.spyOn(regionApi, "getRegionChildren");

  beforeEach(() => {
    childrenSpy.mockImplementation(async (parent: string | null) => {
      if (!parent || parent === "root") return provinces;
      if (parent === "11") return beijingCities;
      if (parent === "31") return shanghaiCities;
      if (parent === "1101") return beijingDistricts;
      return [];
    });
  });

  afterEach(() => {
    childrenSpy.mockReset();
  });

  it("首次挂载拉省份", async () => {
    render(<Harness />);
    // 等到省份出现
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "北京市" })).toBeInTheDocument();
    });
    expect(childrenSpy).toHaveBeenCalledWith("root");
  });

  it("选省 → 拉市；选市 → 拉区", async () => {
    render(<Harness />);
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "北京市" })).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByTestId("region-cascader-province"), {
      target: { value: "11" },
    });
    await waitFor(() =>
      expect(childrenSpy).toHaveBeenCalledWith("11"),
    );
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "市辖区" })).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByTestId("region-cascader-city"), {
      target: { value: "1101" },
    });
    await waitFor(() =>
      expect(childrenSpy).toHaveBeenCalledWith("1101"),
    );
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "东城区" })).toBeInTheDocument(),
    );
  });

  it("改省 → 清空市/区", async () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "北京市" })).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByTestId("region-cascader-province"), {
      target: { value: "11" },
    });
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "市辖区" })).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByTestId("region-cascader-city"), {
      target: { value: "1101" },
    });
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "东城区" })).toBeInTheDocument(),
    );

    // 改省
    fireEvent.change(screen.getByTestId("region-cascader-province"), {
      target: { value: "31" },
    });

    const last = onValue.mock.calls.at(-1)?.[0] as RegionValue;
    expect(last.province_code).toBe("31");
    expect(last.city_code).toBeNull();
    expect(last.district_code).toBeNull();
  });
});
