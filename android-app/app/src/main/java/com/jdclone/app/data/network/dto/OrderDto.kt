package com.jdclone.app.data.network.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// ─────────────────────────────────────────────────────────────────────────────
// Order
// ─────────────────────────────────────────────────────────────────────────────

@Serializable
data class OrderPreviewRequest(
    @SerialName("cart_item_ids") val cartItemIds: List<Long>,
    @SerialName("address_id") val addressId: Long,
)

@Serializable
data class OrderPreviewWarningDto(
    val type: String,
    val message: String,
    @SerialName("cart_item_id") val cartItemId: Long,
)

@Serializable
data class OrderPreviewGroupDto(
    val shop: CartShopBriefDto,
    val items: List<CartItemDto> = emptyList(),
    @SerialName("subtotal_cents") val subtotalCents: Int = 0,
    @SerialName("shipping_fee_cents") val shippingFeeCents: Int = 0,
    @SerialName("total_cents") val totalCents: Int = 0,
)

@Serializable
data class OrderPreviewDto(
    val address: AddressDto,
    @SerialName("groups_by_shop") val groupsByShop: List<OrderPreviewGroupDto> = emptyList(),
    @SerialName("grand_total_cents") val grandTotalCents: Int = 0,
    val warnings: List<OrderPreviewWarningDto> = emptyList(),
)

@Serializable
data class OrderCreateRequest(
    @SerialName("cart_item_ids") val cartItemIds: List<Long>,
    @SerialName("address_id") val addressId: Long,
    @SerialName("user_note") val userNote: String? = null,
)

@Serializable
data class OrderCreatedItemDto(
    val id: Long,
    @SerialName("order_no") val orderNo: String,
    @SerialName("total_cents") val totalCents: Int,
    val shop: CartShopBriefDto,
    @SerialName("payment_deadline_at") val paymentDeadlineAt: String? = null,
)

@Serializable
data class OrderCreateResponse(val orders: List<OrderCreatedItemDto>)

@Serializable
data class OrderItemDto(
    val id: Long,
    @SerialName("order_id") val orderId: Long,
    @SerialName("sku_id") val skuId: Long,
    @SerialName("spu_id") val spuId: Long,
    @SerialName("shop_id") val shopId: Long,
    @SerialName("spu_title") val spuTitle: String,
    @SerialName("sku_specs") val skuSpecs: Map<String, String> = emptyMap(),
    @SerialName("sku_image") val skuImage: String? = null,
    @SerialName("unit_price_cents") val unitPriceCents: Int,
    val quantity: Int,
    @SerialName("subtotal_cents") val subtotalCents: Int,
)

@Serializable
data class OrderStatusHistoryDto(
    val id: Long,
    @SerialName("from_status") val fromStatus: String? = null,
    @SerialName("to_status") val toStatus: String,
    @SerialName("actor_type") val actorType: String,
    @SerialName("actor_id") val actorId: Long? = null,
    val note: String? = null,
    @SerialName("created_at") val createdAt: String,
)

@Serializable
data class ShipmentEventDto(
    val id: Long,
    @SerialName("event_type") val eventType: String,
    val description: String,
    @SerialName("event_time") val eventTime: String,
)

@Serializable
data class PaymentSessionBriefDto(
    val id: Long,
    val channel: String,
    @SerialName("amount_cents") val amountCents: Int,
    val status: String,
    @SerialName("failure_reason") val failureReason: String? = null,
    @SerialName("created_at") val createdAt: String,
    @SerialName("completed_at") val completedAt: String? = null,
)

@Serializable
data class OrderListItemDto(
    val id: Long,
    @SerialName("order_no") val orderNo: String,
    @SerialName("user_id") val userId: Long,
    @SerialName("shop_id") val shopId: Long,
    val shop: CartShopBriefDto? = null,
    val status: String,
    @SerialName("subtotal_cents") val subtotalCents: Int,
    @SerialName("shipping_fee_cents") val shippingFeeCents: Int = 0,
    @SerialName("discount_cents") val discountCents: Int = 0,
    @SerialName("total_cents") val totalCents: Int,
    @SerialName("receiver_name") val receiverName: String,
    @SerialName("receiver_phone") val receiverPhone: String,
    @SerialName("receiver_address") val receiverAddress: String,
    @SerialName("payment_deadline_at") val paymentDeadlineAt: String? = null,
    @SerialName("paid_at") val paidAt: String? = null,
    @SerialName("shipped_at") val shippedAt: String? = null,
    @SerialName("auto_complete_at") val autoCompleteAt: String? = null,
    @SerialName("completed_at") val completedAt: String? = null,
    @SerialName("cancelled_at") val cancelledAt: String? = null,
    @SerialName("cancel_reason") val cancelReason: String? = null,
    @SerialName("shipping_carrier") val shippingCarrier: String? = null,
    @SerialName("tracking_no") val trackingNo: String? = null,
    val items: List<OrderItemDto> = emptyList(),
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String,
)

@Serializable
data class OrderDetailDto(
    val id: Long,
    @SerialName("order_no") val orderNo: String,
    @SerialName("user_id") val userId: Long,
    @SerialName("shop_id") val shopId: Long,
    val shop: CartShopBriefDto? = null,
    val status: String,
    @SerialName("subtotal_cents") val subtotalCents: Int,
    @SerialName("shipping_fee_cents") val shippingFeeCents: Int = 0,
    @SerialName("discount_cents") val discountCents: Int = 0,
    @SerialName("total_cents") val totalCents: Int,
    @SerialName("receiver_name") val receiverName: String,
    @SerialName("receiver_phone") val receiverPhone: String,
    @SerialName("receiver_address") val receiverAddress: String,
    @SerialName("payment_deadline_at") val paymentDeadlineAt: String? = null,
    @SerialName("paid_at") val paidAt: String? = null,
    @SerialName("shipped_at") val shippedAt: String? = null,
    @SerialName("auto_complete_at") val autoCompleteAt: String? = null,
    @SerialName("completed_at") val completedAt: String? = null,
    @SerialName("cancelled_at") val cancelledAt: String? = null,
    @SerialName("cancel_reason") val cancelReason: String? = null,
    @SerialName("cancel_note") val cancelNote: String? = null,
    @SerialName("shipping_carrier") val shippingCarrier: String? = null,
    @SerialName("tracking_no") val trackingNo: String? = null,
    @SerialName("user_note") val userNote: String? = null,
    @SerialName("merchant_note") val merchantNote: String? = null,
    val items: List<OrderItemDto> = emptyList(),
    @SerialName("status_history") val statusHistory: List<OrderStatusHistoryDto> = emptyList(),
    @SerialName("shipment_events") val shipmentEvents: List<ShipmentEventDto> = emptyList(),
    @SerialName("payment_sessions") val paymentSessions: List<PaymentSessionBriefDto> = emptyList(),
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String,
)

@Serializable
data class OrderCancelRequest(
    @SerialName("cancel_note") val cancelNote: String? = null,
)

@Serializable
data class ShipmentInfoDto(
    val carrier: String? = null,
    @SerialName("tracking_no") val trackingNo: String? = null,
    val events: List<ShipmentEventDto> = emptyList(),
)

// ─────────────────────────────────────────────────────────────────────────────
// Payment
// ─────────────────────────────────────────────────────────────────────────────

@Serializable
data class PayCreateRequest(val channel: String)

@Serializable
data class PaymentSessionDto(
    @SerialName("session_id") val sessionId: Long = 0,
    val id: Long? = null,
    @SerialName("order_id") val orderId: Long,
    val channel: String,
    @SerialName("amount_cents") val amountCents: Int,
    val status: String,
    @SerialName("external_txn_no") val externalTxnNo: String? = null,
    @SerialName("failure_reason") val failureReason: String? = null,
    @SerialName("mock_pay_url") val mockPayUrl: String? = null,
    @SerialName("expires_at") val expiresAt: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("completed_at") val completedAt: String? = null,
) {
    val effectiveId: Long get() = if (sessionId != 0L) sessionId else (id ?: 0L)
}

@Serializable
data class PaymentAmountOnlyDto(
    @SerialName("session_id") val sessionId: Long,
    @SerialName("order_id") val orderId: Long,
    @SerialName("order_status") val orderStatus: String,
    @SerialName("session_status") val sessionStatus: String,
)
