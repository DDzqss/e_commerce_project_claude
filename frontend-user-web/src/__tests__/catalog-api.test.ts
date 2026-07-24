import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiGet } from '@/lib/api';
import { getRecommendations, getRelatedSPUs, listCategories } from '@/lib/catalog-api';
import type { CategoryTree, SPUListItem } from '@/types/catalog';

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(),
}));

const apiGetMock = vi.mocked(apiGet);

const category: CategoryTree = {
  id: 1,
  parent_id: null,
  name: '数码',
  slug: 'digital',
  level: 1,
  path: '1',
  icon_url: null,
  sort_order: 1,
  is_visible: true,
  children: [],
};

const spu: SPUListItem = {
  id: 1001,
  title: '测试商品',
  subtitle: null,
  main_image: 'spu/test.jpg',
  min_price_cents: 9900,
  max_price_cents: 12900,
  sales_count: 12,
  brand: null,
  category: { id: 10, name: '手机' },
};

describe('catalog-api item wrappers', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
  });

  it('listCategories accepts backend {items} response', async () => {
    apiGetMock.mockResolvedValueOnce({ items: [category] });

    await expect(listCategories()).resolves.toEqual([category]);
  });

  it('listCategories remains compatible with array response', async () => {
    apiGetMock.mockResolvedValueOnce([category]);

    await expect(listCategories()).resolves.toEqual([category]);
  });

  it('getRelatedSPUs accepts backend {items} response', async () => {
    apiGetMock.mockResolvedValueOnce({ items: [spu] });

    await expect(getRelatedSPUs(1001, 8)).resolves.toEqual([spu]);
  });

  it('getRecommendations accepts backend {items} response', async () => {
    apiGetMock.mockResolvedValueOnce({ items: [spu] });

    await expect(getRecommendations(10)).resolves.toEqual([spu]);
  });

  it('item wrapper falls back to an empty array for missing items', async () => {
    apiGetMock.mockResolvedValueOnce({});

    await expect(getRecommendations(10)).resolves.toEqual([]);
  });
});
