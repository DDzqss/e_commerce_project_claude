package com.jdclone.app.data.repository

import com.jdclone.app.data.network.ApiService
import com.jdclone.app.data.network.dto.CartAddRequest
import com.jdclone.app.data.network.dto.CartBatchDeleteRequest
import com.jdclone.app.data.network.dto.CartItemDto
import com.jdclone.app.data.network.dto.CartResponseDto
import com.jdclone.app.data.network.dto.CartSelectAllRequest
import com.jdclone.app.data.network.dto.CartUpdateRequest
import com.jdclone.app.data.network.unwrap
import com.jdclone.app.data.network.unwrapOptional
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
open class CartRepository @Inject constructor(private val api: ApiService) {

    open suspend fun getCart(): Result<CartResponseDto> = safeIo { api.getCart().unwrap() }

    open suspend fun add(skuId: Long, quantity: Int = 1): Result<CartItemDto> = safeIo {
        api.addToCart(CartAddRequest(skuId = skuId, quantity = quantity)).unwrap()
    }

    open suspend fun updateQuantity(itemId: Long, quantity: Int): Result<CartItemDto> = safeIo {
        api.updateCartItem(itemId, CartUpdateRequest(quantity = quantity)).unwrap()
    }

    open suspend fun updateSelected(itemId: Long, selected: Boolean): Result<CartItemDto> = safeIo {
        api.updateCartItem(itemId, CartUpdateRequest(selected = selected)).unwrap()
    }

    open suspend fun delete(itemId: Long): Result<Unit> = safeIo {
        api.deleteCartItem(itemId).unwrapOptional()
        Unit
    }

    open suspend fun batchDelete(ids: List<Long>): Result<Unit> = safeIo {
        api.batchDeleteCart(CartBatchDeleteRequest(ids)).unwrapOptional()
        Unit
    }

    open suspend fun selectAll(selected: Boolean): Result<CartResponseDto> = safeIo {
        api.selectAllCart(CartSelectAllRequest(selected)).unwrap()
    }

    open suspend fun clearInvalid(): Result<Unit> = safeIo {
        api.clearInvalidCart().unwrapOptional()
        Unit
    }
}
