"use client";

import { useEffect, useState } from "react";
import { toast } from "./Toast";
import { cn } from "@/lib/cn";
import { getRegionChildren } from "@/lib/region-api";
import type { RegionOut } from "@/types/region";

export interface RegionValue {
  province_code: string | null;
  city_code: string | null;
  district_code: string | null;
  province_name: string | null;
  city_name: string | null;
  district_name: string | null;
}

interface RegionCascaderProps {
  value: RegionValue;
  onChange: (v: RegionValue) => void;
  disabled?: boolean;
  className?: string;
  /** 是否显示错误提示样式 */
  error?: string | null;
}

const EMPTY_VALUE: RegionValue = {
  province_code: null,
  city_code: null,
  district_code: null,
  province_name: null,
  city_name: null,
  district_name: null,
};

/**
 * 三级地区级联下拉：省 → 市 → 区。
 *
 * - 首次挂载拉一次省列表
 * - 选择省 → 拉市；选择市 → 拉区；改上级 → 清空下级
 * - 使用后端 /regions/children 按需加载（数据固定 24h 缓存由请求侧管）
 * - 无外部 UI 依赖，纯 native <select>
 */
export function RegionCascader({
  value,
  onChange,
  disabled,
  className,
  error,
}: RegionCascaderProps) {
  const [provinces, setProvinces] = useState<RegionOut[]>([]);
  const [cities, setCities] = useState<RegionOut[]>([]);
  const [districts, setDistricts] = useState<RegionOut[]>([]);
  const [loadingLevel, setLoadingLevel] = useState<1 | 2 | 3 | null>(null);

  // 首次加载省
  useEffect(() => {
    let cancelled = false;
    setLoadingLevel(1);
    getRegionChildren("root")
      .then((list) => {
        if (!cancelled) setProvinces(list);
      })
      .catch(() => {
        if (!cancelled) toast.error("加载省份失败");
      })
      .finally(() => {
        if (!cancelled) setLoadingLevel(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // province 变了 → 拉 city
  useEffect(() => {
    if (!value.province_code) {
      setCities([]);
      setDistricts([]);
      return;
    }
    let cancelled = false;
    setLoadingLevel(2);
    getRegionChildren(value.province_code)
      .then((list) => {
        if (!cancelled) setCities(list);
      })
      .catch(() => {
        if (!cancelled) toast.error("加载城市失败");
      })
      .finally(() => {
        if (!cancelled) setLoadingLevel(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value.province_code]);

  // city 变了 → 拉 district
  useEffect(() => {
    if (!value.city_code) {
      setDistricts([]);
      return;
    }
    let cancelled = false;
    setLoadingLevel(3);
    getRegionChildren(value.city_code)
      .then((list) => {
        if (!cancelled) setDistricts(list);
      })
      .catch(() => {
        if (!cancelled) toast.error("加载区县失败");
      })
      .finally(() => {
        if (!cancelled) setLoadingLevel(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value.city_code]);

  const onSelectProvince = (code: string) => {
    if (!code) {
      onChange({ ...EMPTY_VALUE });
      return;
    }
    const p = provinces.find((r) => r.code === code) ?? null;
    onChange({
      province_code: code,
      province_name: p?.name ?? null,
      city_code: null,
      city_name: null,
      district_code: null,
      district_name: null,
    });
  };

  const onSelectCity = (code: string) => {
    const c = cities.find((r) => r.code === code) ?? null;
    onChange({
      ...value,
      city_code: code || null,
      city_name: c?.name ?? null,
      district_code: null,
      district_name: null,
    });
  };

  const onSelectDistrict = (code: string) => {
    const d = districts.find((r) => r.code === code) ?? null;
    onChange({
      ...value,
      district_code: code || null,
      district_name: d?.name ?? null,
    });
  };

  const selectCls = cn(
    "h-10 min-w-0 flex-1 rounded border border-neutral-300 bg-white px-2 text-sm text-neutral-800",
    "focus:border-[color:var(--color-primary)] focus:outline-none",
    error && "border-[color:var(--color-primary)]",
    disabled && "cursor-not-allowed opacity-60",
  );

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2" data-testid="region-cascader">
        <select
          className={selectCls}
          disabled={disabled || loadingLevel === 1}
          value={value.province_code ?? ""}
          onChange={(e) => onSelectProvince(e.target.value)}
          aria-label="省份"
          data-testid="region-cascader-province"
        >
          <option value="">请选择省份</option>
          {provinces.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          className={selectCls}
          disabled={disabled || !value.province_code || loadingLevel === 2}
          value={value.city_code ?? ""}
          onChange={(e) => onSelectCity(e.target.value)}
          aria-label="城市"
          data-testid="region-cascader-city"
        >
          <option value="">请选择城市</option>
          {cities.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className={selectCls}
          disabled={disabled || !value.city_code || loadingLevel === 3}
          value={value.district_code ?? ""}
          onChange={(e) => onSelectDistrict(e.target.value)}
          aria-label="区县"
          data-testid="region-cascader-district"
        >
          <option value="">请选择区县</option>
          {districts.map((d) => (
            <option key={d.code} value={d.code}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p
          className="mt-1 text-xs text-[color:var(--color-primary)]"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
