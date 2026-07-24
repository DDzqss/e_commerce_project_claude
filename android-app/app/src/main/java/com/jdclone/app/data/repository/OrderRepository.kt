package com.jdclone.app.data.repository

import com.jdclone.app.data.network.ApiService
import com.jdclone.app.data.network.dto.OrderCancelRequest
import com.jdclone.app.data.network.dto.OrderCreateRequest
import com.jdclone.app.data.network.dto.OrderCreateResponse
import com.jdclone.app.data.network.dto.OrderDetailDto
import com.jdclone.app.data.network.dto.OrderListItemDto
import com.jdclone.app.data.network.dto.OrderPreviewDto
import com.jdclone.app.data.network.dto.OrderPreviewRequest
import com.jdclone.app.data.network.dto.PageData
import com.jdclone.app.data.network.dto.ShipmentInfoDto
import com.jdclone.app.data.network.unwrap
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class OrderRepository @Inject constructor(private val api: ApiService) {

    suspend fun preview(
        cartItemIds: List<Long>,
        addressId: Long,
    ): Result<OrderPreviewDto> = safeIo {
        api.previewOrder(OrderPreviewRequest(cartItemIds, addressId)).unwrap()
    }

    suspend fun create(
        cartItemIds: List<Long>,
        addressId: Long,
        userNote: String? = null,
        idempotencyKey: String = UUID.randomUUID().toString(),
    ): Result<OrderCreateResponse> = safeIo {
        api.createOrder(
            body = OrderCreateRequest(cartItemIds, addressId, userNote),
            idempotencyKey = idempotencyKey,
        ).unwrap()
    }

    suspend fun list(
        status: String? = null,
        keyword: String? = null,
        page: Int = 1,
        size: Int = 20,
    ): Result<PageData<OrderListItemDto>> = safeIo {
        api.listOrders(status, keyword, page, size).unwrap()
    }

    suspend fun get(id: Long): Result<OrderDetailDto> = safeIo { api.getOrder(id).unwrap() }

    suspend fun cancel(id: Long, note: String? = null): Result<OrderDetailDto> = safeIo {
        api.cancelOrder(id, OrderCancelRequest(cancelNote = note)).unwrap()
    }

    suspend fun confirmReceipt(id: Long): Result<OrderDetailDto> = safeIo {
        api.confirmReceipt(id).unwrap()
    }

    suspend fun getShipment(id: Long): Result<ShipmentInfoDto> = safeIo {
        api.getShipment(id).unwrap()
    }
}
