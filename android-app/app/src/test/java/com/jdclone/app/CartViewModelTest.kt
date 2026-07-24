package com.jdclone.app

import com.jdclone.app.data.network.ApiService
import com.jdclone.app.data.network.dto.CartGroupDto
import com.jdclone.app.data.network.dto.CartItemDto
import com.jdclone.app.data.network.dto.CartResponseDto
import com.jdclone.app.data.network.dto.CartShopBriefDto
import com.jdclone.app.data.network.dto.CartSkuBriefDto
import com.jdclone.app.data.network.dto.CartSpuBriefDto
import com.jdclone.app.data.repository.CartRepository
import com.jdclone.app.ui.common.UiState
import com.jdclone.app.ui.screen.cart.CartViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class CartViewModelTest {

    @get:Rule
    val dispatcherRule = MainDispatcherRule()

    private val stubApi: ApiService = stubApiService()

    private fun fakeItem(
        id: Long = 1L,
        selected: Boolean = true,
        status: String = "valid",
        qty: Int = 1,
        price: Int = 9900,
    ) = CartItemDto(
        id = id,
        skuId = 1000L + id,
        quantity = qty,
        selected = selected,
        status = status,
        sku = CartSkuBriefDto(
            id = 1000L + id, spuId = 2000L + id, priceCents = price, stock = 100,
        ),
        spu = CartSpuBriefDto(id = 2000L + id, title = "商品 $id", mainImage = ""),
    )

    private fun fakeResponse(items: List<CartItemDto>) = CartResponseDto(
        groups = listOf(
            CartGroupDto(
                shop = CartShopBriefDto(id = 1L, name = "测试店铺"),
                items = items,
                subtotalCentsSelected = items.filter { it.selected }.sumOf { it.sku.priceCents * it.quantity },
            ),
        ),
        totalCentsSelected = items.filter { it.selected }.sumOf { it.sku.priceCents * it.quantity },
        totalSelectedCount = items.filter { it.selected }.sumOf { it.quantity },
        invalidCount = items.count { it.status == "invalid" },
    )

    /** Fake repo：所有网络方法用内存状态替代。 */
    private class FakeCartRepo(
        initial: CartResponseDto,
        api: ApiService,
    ) : CartRepository(api) {
        private var response = initial
        override suspend fun getCart(): Result<CartResponseDto> = Result.success(response)
        override suspend fun updateSelected(itemId: Long, selected: Boolean): Result<CartItemDto> {
            var updated: CartItemDto? = null
            response = response.copy(
                groups = response.groups.map { g ->
                    g.copy(items = g.items.map {
                        if (it.id == itemId) it.copy(selected = selected).also { u -> updated = u }
                        else it
                    })
                },
            )
            return Result.success(updated!!)
        }
        override suspend fun updateQuantity(itemId: Long, quantity: Int): Result<CartItemDto> {
            var updated: CartItemDto? = null
            response = response.copy(
                groups = response.groups.map { g ->
                    g.copy(items = g.items.map {
                        if (it.id == itemId) it.copy(quantity = quantity).also { u -> updated = u }
                        else it
                    })
                },
            )
            return Result.success(updated!!)
        }
        override suspend fun delete(itemId: Long): Result<Unit> {
            response = response.copy(
                groups = response.groups.map { g -> g.copy(items = g.items.filter { it.id != itemId }) },
            )
            return Result.success(Unit)
        }
    }

    @Test
    fun `refresh emits success with cart data`() = runTest {
        val repo = FakeCartRepo(
            initial = fakeResponse(listOf(fakeItem(1L), fakeItem(2L))),
            api = stubApi,
        )
        val vm = CartViewModel(repo)
        vm.refresh()
        val state = vm.state.value
        assertTrue("state is $state", state is UiState.Success)
        val data = (state as UiState.Success).data
        assertEquals(2, data.response.groups[0].items.size)
    }

    @Test
    fun `selectedItemIds returns only selected valid items`() = runTest {
        val repo = FakeCartRepo(
            initial = fakeResponse(
                listOf(
                    fakeItem(1L, selected = true),
                    fakeItem(2L, selected = false),
                    fakeItem(3L, selected = true, status = "invalid"),
                ),
            ),
            api = stubApi,
        )
        val vm = CartViewModel(repo)
        vm.refresh()
        val ids = vm.selectedItemIds()
        assertEquals(listOf(1L), ids)
    }

    @Test
    fun `updateQuantity flows back into state`() = runTest {
        val repo = FakeCartRepo(
            initial = fakeResponse(listOf(fakeItem(1L, qty = 1))),
            api = stubApi,
        )
        val vm = CartViewModel(repo)
        vm.refresh()
        val item = (vm.state.value as UiState.Success).data.response.groups[0].items[0]
        vm.updateQuantity(item, 5)
        // 触发 refresh → items 里 qty 应变为 5
        val updated = (vm.state.value as UiState.Success).data.response.groups[0].items[0]
        assertEquals(5, updated.quantity)
    }
}
