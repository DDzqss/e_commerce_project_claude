package com.jdclone.app.data.network.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// ─────────────────────────────────────────────────────────────────────────────
// Aftersales
// ─────────────────────────────────────────────────────────────────────────────

@Serializable
data class AftersalesItemRequest(
    @SerialName("order_item_id") val orderItemId: Long,
    val quantity: Int,
)

@Serializable
data class AftersalesItemDto(
    val id: Long,
    @SerialName("aftersales_id") val aftersalesId: Long,
    @SerialName("order_item_id") val orderItemId: Long,
    val quantity: Int,
    @SerialName("refund_amount_cents") val refundAmountCents: Int,
)

@Serializable
data class AftersalesEvidenceDto(
    val id: Long,
    @SerialName("aftersales_id") val aftersalesId: Long,
    @SerialName("uploader_type") val uploaderType: String,
    @SerialName("uploader_id") val uploaderId: Long,
    val stage: String,
    @SerialName("image_url") val imageUrl: String,
    val note: String? = null,
    @SerialName("created_at") val createdAt: String,
)

@Serializable
data class AftersalesStatusHistoryDto(
    val id: Long,
    @SerialName("aftersales_id") val aftersalesId: Long,
    @SerialName("from_status") val fromStatus: String? = null,
    @SerialName("to_status") val toStatus: String,
    @SerialName("actor_type") val actorType: String,
    @SerialName("actor_id") val actorId: Long? = null,
    val note: String? = null,
    @SerialName("created_at") val createdAt: String,
)

@Serializable
data class AftersalesMessageDto(
    val id: Long,
    @SerialName("aftersales_id") val aftersalesId: Long,
    @SerialName("sender_type") val senderType: String,
    @SerialName("sender_id") val senderId: Long? = null,
    val kind: String,
    val content: String,
    @SerialName("created_at") val createdAt: String,
)

@Serializable
data class AftersalesCreateRequest(
    val type: String,
    @SerialName("reason_category") val reasonCategory: String,
    @SerialName("reason_note") val reasonNote: String,
    val items: List<AftersalesItemRequest>,
    @SerialName("refund_amount_cents") val refundAmountCents: Int,
    @SerialName("evidence_image_keys") val evidenceImageKeys: List<String> = emptyList(),
)

@Serializable
data class AftersalesCancelRequest(
    @SerialName("cancel_note") val cancelNote: String? = null,
)

@Serializable
data class AftersalesSubmitTrackingRequest(
    val carrier: String,
    @SerialName("tracking_no") val trackingNo: String,
)

@Serializable
data class AftersalesAppealRequest(
    val reason: String,
    @SerialName("evidence_image_keys") val evidenceImageKeys: List<String> = emptyList(),
)

@Serializable
data class AftersalesNudgeResultDto(
    @SerialName("nudge_count") val nudgeCount: Int,
    @SerialName("last_nudged_at") val lastNudgedAt: String? = null,
)

@Serializable
data class AftersalesEvidenceAddRequest(
    val stage: String,
    @SerialName("image_key") val imageKey: String,
    val note: String? = null,
)

@Serializable
data class AftersalesListItemDto(
    val id: Long,
    @SerialName("aftersales_no") val aftersalesNo: String,
    @SerialName("order_id") val orderId: Long,
    @SerialName("user_id") val userId: Long,
    @SerialName("shop_id") val shopId: Long,
    val type: String,
    val status: String,
    @SerialName("reason_category") val reasonCategory: String,
    @SerialName("reason_note") val reasonNote: String,
    @SerialName("refund_amount_cents") val refundAmountCents: Int,
    @SerialName("actual_refund_cents") val actualRefundCents: Int? = null,
    @SerialName("merchant_review_deadline") val merchantReviewDeadline: String? = null,
    @SerialName("escalated_at") val escalatedAt: String? = null,
    @SerialName("escalation_reason") val escalationReason: String? = null,
    @SerialName("arbitrator_admin_id") val arbitratorAdminId: Long? = null,
    @SerialName("nudge_count") val nudgeCount: Int = 0,
    @SerialName("appeal_count") val appealCount: Int = 0,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String,
)

@Serializable
data class AftersalesDetailDto(
    val id: Long,
    @SerialName("aftersales_no") val aftersalesNo: String,
    @SerialName("order_id") val orderId: Long,
    @SerialName("user_id") val userId: Long,
    @SerialName("shop_id") val shopId: Long,
    val type: String,
    val status: String,
    @SerialName("reason_category") val reasonCategory: String,
    @SerialName("reason_note") val reasonNote: String,
    @SerialName("refund_amount_cents") val refundAmountCents: Int,
    @SerialName("actual_refund_cents") val actualRefundCents: Int? = null,
    @SerialName("merchant_review_deadline") val merchantReviewDeadline: String? = null,
    @SerialName("merchant_reviewed_at") val merchantReviewedAt: String? = null,
    @SerialName("merchant_review_note") val merchantReviewNote: String? = null,
    @SerialName("return_address") val returnAddress: String? = null,
    @SerialName("return_carrier") val returnCarrier: String? = null,
    @SerialName("return_tracking_no") val returnTrackingNo: String? = null,
    @SerialName("return_shipped_at") val returnShippedAt: String? = null,
    @SerialName("return_ship_deadline") val returnShipDeadline: String? = null,
    @SerialName("merchant_received_at") val merchantReceivedAt: String? = null,
    @SerialName("merchant_receive_deadline") val merchantReceiveDeadline: String? = null,
    @SerialName("merchant_refuse_receive") val merchantRefuseReceive: Boolean = false,
    @SerialName("merchant_refuse_note") val merchantRefuseNote: String? = null,
    @SerialName("exchange_carrier") val exchangeCarrier: String? = null,
    @SerialName("exchange_tracking_no") val exchangeTrackingNo: String? = null,
    @SerialName("exchange_shipped_at") val exchangeShippedAt: String? = null,
    @SerialName("exchange_confirm_deadline") val exchangeConfirmDeadline: String? = null,
    @SerialName("exchange_confirmed_at") val exchangeConfirmedAt: String? = null,
    @SerialName("escalated_at") val escalatedAt: String? = null,
    @SerialName("escalation_reason") val escalationReason: String? = null,
    @SerialName("arbitrator_admin_id") val arbitratorAdminId: Long? = null,
    @SerialName("arbitrated_at") val arbitratedAt: String? = null,
    @SerialName("arbitration_conclusion") val arbitrationConclusion: String? = null,
    @SerialName("arbitration_outcome") val arbitrationOutcome: String? = null,
    @SerialName("refunded_at") val refundedAt: String? = null,
    @SerialName("refund_txn_no") val refundTxnNo: String? = null,
    @SerialName("closed_at") val closedAt: String? = null,
    @SerialName("close_reason") val closeReason: String? = null,
    @SerialName("nudge_count") val nudgeCount: Int = 0,
    @SerialName("last_nudged_at") val lastNudgedAt: String? = null,
    @SerialName("appeal_count") val appealCount: Int = 0,
    val items: List<AftersalesItemDto> = emptyList(),
    @SerialName("status_history") val statusHistory: List<AftersalesStatusHistoryDto> = emptyList(),
    val evidences: List<AftersalesEvidenceDto> = emptyList(),
    val messages: List<AftersalesMessageDto> = emptyList(),
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String,
)

// ─────────────────────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────────────────────

@Serializable
data class NotificationDto(
    val id: Long,
    @SerialName("recipient_type") val recipientType: String,
    @SerialName("recipient_id") val recipientId: Long,
    val category: String,
    val title: String,
    val body: String,
    @SerialName("action_url") val actionUrl: String? = null,
    @SerialName("related_type") val relatedType: String? = null,
    @SerialName("related_id") val relatedId: Long? = null,
    @SerialName("is_read") val isRead: Boolean = false,
    @SerialName("read_at") val readAt: String? = null,
    @SerialName("created_at") val createdAt: String,
)

@Serializable
data class NotificationListDto(
    val items: List<NotificationDto> = emptyList(),
    val total: Int = 0,
    val page: Int = 1,
    val size: Int = 20,
    @SerialName("unread_total") val unreadTotal: Int = 0,
)

@Serializable
data class UnreadCountDto(val count: Int = 0)
