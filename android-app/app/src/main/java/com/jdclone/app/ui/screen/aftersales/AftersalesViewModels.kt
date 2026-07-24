package com.jdclone.app.ui.screen.aftersales

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.jdclone.app.data.network.dto.AftersalesDetailDto
import com.jdclone.app.data.network.dto.AftersalesItemRequest
import com.jdclone.app.data.network.dto.AftersalesListItemDto
import com.jdclone.app.data.network.dto.OrderDetailDto
import com.jdclone.app.data.network.dto.OrderItemDto
import com.jdclone.app.data.repository.AftersalesRepository
import com.jdclone.app.data.repository.OrderRepository
import com.jdclone.app.ui.common.UiState
import com.jdclone.app.ui.common.errorMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

// ─────────────────────────────────────────────────────────────────────────────
// 状态/文案
// ─────────────────────────────────────────────────────────────────────────────

/** 售后类型（与后端 enum 保持一致）。 */
enum class AftersalesType(val backendKey: String, val label: String) {
    REFUND_ONLY("refund_only", "仅退款"),
    RETURN_REFUND("return_refund", "退货退款"),
    EXCHANGE("exchange", "换货"),
}

/** 原因分类（与 backend AftersalesReasonCategory 保持一致）。 */
enum class AftersalesReason(val backendKey: String, val label: String) {
    QUALITY_ISSUE("quality_issue", "质量问题"),
    WRONG_ITEM("wrong_item", "发错货"),
    DAMAGE_IN_TRANSIT("damage_in_transit", "运输损坏"),
    NOT_AS_DESCRIBED("not_as_described", "描述不符"),
    NO_LONGER_NEEDED("no_longer_needed", "不想要了"),
    DUPLICATE_PURCHASE("duplicate_purchase", "重复购买"),
    OTHER("other", "其它"),
}

fun aftersalesStatusLabel(status: String): String = when (status) {
    "pending_merchant_review" -> "等待商家审核"
    "merchant_rejected" -> "商家已拒绝"
    "merchant_agreed_waiting_return" -> "同意退货，等待寄回"
    "return_shipped_waiting_receive" -> "已寄回，等待收货"
    "merchant_agreed_waiting_ship" -> "已收货，等待再发货"
    "exchange_shipped_waiting_receive" -> "已再发货，等待收货"
    "refunding" -> "退款中"
    "admin_arbitrating" -> "平台仲裁中"
    "completed_refunded" -> "退款完成"
    "completed_exchanged" -> "换货完成"
    "user_cancelled" -> "已撤销"
    "system_closed" -> "已关闭"
    else -> status
}

fun aftersalesTypeLabel(type: String): String =
    AftersalesType.entries.firstOrNull { it.backendKey == type }?.label ?: type

/** 依据订单状态过滤可选售后类型（架构文档 §7.1）。 */
fun allowedAftersalesTypes(orderStatus: String): List<AftersalesType> = when (orderStatus) {
    "paid" -> listOf(AftersalesType.REFUND_ONLY)
    "shipped" -> AftersalesType.entries.toList()
    "completed" -> listOf(AftersalesType.RETURN_REFUND, AftersalesType.EXCHANGE)
    else -> emptyList()
}

// ─────────────────────────────────────────────────────────────────────────────
// Apply ViewModel
// ─────────────────────────────────────────────────────────────────────────────

data class ItemChoice(
    val orderItem: OrderItemDto,
    val selected: Boolean = false,
    val quantity: Int = 1,
)

data class ApplyState(
    val order: OrderDetailDto,
    val allowedTypes: List<AftersalesType>,
    val selectedType: AftersalesType,
    val itemChoices: List<ItemChoice>,
    val reason: AftersalesReason = AftersalesReason.QUALITY_ISSUE,
    val note: String = "",
    val refundAmountCents: Int = 0,
    val submitting: Boolean = false,
    val toast: String? = null,
    val successId: Long? = null,
) {
    /** 用户选中项对应的最大可退金额（申请值不得超过此上限）。 */
    val maxRefundCents: Int
        get() = itemChoices
            .filter { it.selected }
            .sumOf { it.orderItem.unitPriceCents * it.quantity }
}

@HiltViewModel
class AftersalesApplyViewModel @Inject constructor(
    private val orderRepo: OrderRepository,
    private val afterRepo: AftersalesRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val orderId: Long = savedStateHandle.get<String>("orderId")?.toLongOrNull() ?: 0L
    private val idempotencyKey: String = UUID.randomUUID().toString()

    private val _state = MutableStateFlow<UiState<ApplyState>>(UiState.Loading)
    val state: StateFlow<UiState<ApplyState>> = _state.asStateFlow()

    init { load() }

    fun load() {
        _state.value = UiState.Loading
        viewModelScope.launch {
            orderRepo.get(orderId).fold(
                onSuccess = { order ->
                    val allowed = allowedAftersalesTypes(order.status)
                    if (allowed.isEmpty()) {
                        _state.value = UiState.Error("当前订单状态不允许发起售后")
                        return@fold
                    }
                    val defaultType = allowed.first()
                    val choices = order.items.map { ItemChoice(it, selected = false, quantity = it.quantity) }
                    _state.value = UiState.Success(
                        ApplyState(
                            order = order,
                            allowedTypes = allowed,
                            selectedType = defaultType,
                            itemChoices = choices,
                            refundAmountCents = 0,
                        ),
                    )
                },
                onFailure = { _state.value = UiState.Error(errorMessage(it)) },
            )
        }
    }

    fun selectType(t: AftersalesType) {
        val current = (_state.value as? UiState.Success)?.data ?: return
        _state.value = UiState.Success(current.copy(selectedType = t))
        // EXCHANGE 时退款额没有意义 —— 归零；其它类型时若为 0 则预填当前 max
        val next = (_state.value as UiState.Success).data
        if (t == AftersalesType.EXCHANGE) {
            _state.value = UiState.Success(next.copy(refundAmountCents = 0))
        } else if (next.refundAmountCents == 0 || next.refundAmountCents > next.maxRefundCents) {
            _state.value = UiState.Success(next.copy(refundAmountCents = next.maxRefundCents))
        }
    }

    fun toggleItem(itemId: Long) {
        val current = (_state.value as? UiState.Success)?.data ?: return
        val newChoices = current.itemChoices.map {
            if (it.orderItem.id == itemId) it.copy(selected = !it.selected) else it
        }
        val updated = current.copy(itemChoices = newChoices)
        // 重算 refund 上限
        val newMax = updated.maxRefundCents
        val newAmount = if (updated.selectedType == AftersalesType.EXCHANGE) 0
        else newMax.coerceAtMost(updated.refundAmountCents.takeIf { it > 0 } ?: newMax)
        _state.value = UiState.Success(updated.copy(refundAmountCents = newAmount))
    }

    fun setItemQty(itemId: Long, qty: Int) {
        val current = (_state.value as? UiState.Success)?.data ?: return
        val newChoices = current.itemChoices.map {
            if (it.orderItem.id == itemId) {
                it.copy(quantity = qty.coerceIn(1, it.orderItem.quantity))
            } else it
        }
        val updated = current.copy(itemChoices = newChoices)
        val newMax = updated.maxRefundCents
        val newAmount = if (updated.selectedType == AftersalesType.EXCHANGE) 0
        else newMax.coerceAtMost(updated.refundAmountCents.takeIf { it > 0 } ?: newMax)
        _state.value = UiState.Success(updated.copy(refundAmountCents = newAmount))
    }

    fun selectReason(r: AftersalesReason) {
        val current = (_state.value as? UiState.Success)?.data ?: return
        _state.value = UiState.Success(current.copy(reason = r))
    }

    fun updateNote(s: String) {
        val current = (_state.value as? UiState.Success)?.data ?: return
        _state.value = UiState.Success(current.copy(note = s))
    }

    /** 退款金额只允许减少，不允许超过 maxRefundCents。 */
    fun setRefundAmount(cents: Int) {
        val current = (_state.value as? UiState.Success)?.data ?: return
        if (current.selectedType == AftersalesType.EXCHANGE) return
        _state.value = UiState.Success(current.copy(refundAmountCents = cents.coerceIn(0, current.maxRefundCents)))
    }

    fun submit() {
        val current = (_state.value as? UiState.Success)?.data ?: return
        val chosen = current.itemChoices.filter { it.selected }
        if (chosen.isEmpty()) {
            _state.value = UiState.Success(current.copy(toast = "请至少选择一件商品"))
            return
        }
        if (current.note.length < 10) {
            _state.value = UiState.Success(current.copy(toast = "说明至少 10 个字符"))
            return
        }
        _state.value = UiState.Success(current.copy(submitting = true, toast = null))
        viewModelScope.launch {
            afterRepo.create(
                orderId = current.order.id,
                type = current.selectedType.backendKey,
                reasonCategory = current.reason.backendKey,
                reasonNote = current.note,
                items = chosen.map { AftersalesItemRequest(it.orderItem.id, it.quantity) },
                refundAmountCents = if (current.selectedType == AftersalesType.EXCHANGE) 0 else current.refundAmountCents,
                idempotencyKey = idempotencyKey,
            ).fold(
                onSuccess = {
                    _state.value = UiState.Success(
                        current.copy(submitting = false, successId = it.id, toast = "已提交售后申请"),
                    )
                },
                onFailure = {
                    _state.value = UiState.Success(current.copy(submitting = false, toast = errorMessage(it)))
                },
            )
        }
    }

    fun clearToast() {
        val current = (_state.value as? UiState.Success)?.data ?: return
        _state.value = UiState.Success(current.copy(toast = null))
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// List ViewModel
// ─────────────────────────────────────────────────────────────────────────────

enum class AftersalesTab(val label: String, val filter: String?) {
    ALL("全部", null),
    PENDING("待审核", "pending_merchant_review"),
    PROCESSING("进行中", "merchant_agreed_waiting_return,return_shipped_waiting_receive,merchant_agreed_waiting_ship,exchange_shipped_waiting_receive,refunding,admin_arbitrating"),
    COMPLETED("已完成", "completed_refunded,completed_exchanged"),
    CLOSED("已关闭", "user_cancelled,system_closed,merchant_rejected"),
}

data class AftersalesListState(
    val tab: AftersalesTab = AftersalesTab.ALL,
    val items: List<AftersalesListItemDto> = emptyList(),
    val loading: Boolean = false,
    val loadingMore: Boolean = false,
    val page: Int = 1,
    val allLoaded: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class AftersalesListViewModel @Inject constructor(
    private val repo: AftersalesRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(AftersalesListState())
    val state: StateFlow<AftersalesListState> = _state.asStateFlow()

    init { refresh() }

    fun switchTab(tab: AftersalesTab) {
        if (tab == _state.value.tab) return
        _state.value = _state.value.copy(tab = tab)
        refresh()
    }

    fun refresh() {
        val tab = _state.value.tab
        _state.value = _state.value.copy(loading = true, page = 1, items = emptyList(), allLoaded = false, error = null)
        viewModelScope.launch {
            repo.list(status = tab.filter, page = 1, size = 20).fold(
                onSuccess = { page ->
                    _state.value = _state.value.copy(
                        loading = false,
                        items = page.items,
                        page = 1,
                        allLoaded = page.items.size >= page.total,
                    )
                },
                onFailure = { _state.value = _state.value.copy(loading = false, error = errorMessage(it)) },
            )
        }
    }

    fun loadMore() {
        val current = _state.value
        if (current.loading || current.loadingMore || current.allLoaded) return
        val next = current.page + 1
        _state.value = current.copy(loadingMore = true)
        viewModelScope.launch {
            repo.list(status = current.tab.filter, page = next, size = 20).fold(
                onSuccess = { page ->
                    _state.value = _state.value.copy(
                        loadingMore = false,
                        items = _state.value.items + page.items,
                        page = next,
                        allLoaded = (_state.value.items.size + page.items.size) >= page.total,
                    )
                },
                onFailure = { _state.value = _state.value.copy(loadingMore = false) },
            )
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail ViewModel
// ─────────────────────────────────────────────────────────────────────────────

data class AftersalesDetailState(
    val detail: AftersalesDetailDto,
    val actionInFlight: Boolean = false,
    val toast: String? = null,
    val appealDialogOpen: Boolean = false,
    val trackingDialogOpen: Boolean = false,
)

@HiltViewModel
class AftersalesDetailViewModel @Inject constructor(
    private val repo: AftersalesRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val id: Long = savedStateHandle.get<String>("id")?.toLongOrNull() ?: 0L

    private val _state = MutableStateFlow<UiState<AftersalesDetailState>>(UiState.Loading)
    val state: StateFlow<UiState<AftersalesDetailState>> = _state.asStateFlow()

    init { load() }

    fun load() {
        _state.value = UiState.Loading
        viewModelScope.launch {
            _state.value = repo.get(id).fold(
                onSuccess = { UiState.Success(AftersalesDetailState(it)) },
                onFailure = { UiState.Error(errorMessage(it)) },
            )
        }
    }

    fun cancel() {
        val current = (_state.value as? UiState.Success)?.data ?: return
        _state.value = UiState.Success(current.copy(actionInFlight = true))
        viewModelScope.launch {
            repo.cancel(id).fold(
                onSuccess = { _state.value = UiState.Success(current.copy(detail = it, actionInFlight = false, toast = "已撤销")) },
                onFailure = { _state.value = UiState.Success(current.copy(actionInFlight = false, toast = errorMessage(it))) },
            )
        }
    }

    fun nudge() {
        val current = (_state.value as? UiState.Success)?.data ?: return
        _state.value = UiState.Success(current.copy(actionInFlight = true))
        viewModelScope.launch {
            repo.nudge(id).fold(
                onSuccess = { _state.value = UiState.Success(current.copy(actionInFlight = false, toast = "催办成功")) ; load() },
                onFailure = { _state.value = UiState.Success(current.copy(actionInFlight = false, toast = errorMessage(it))) },
            )
        }
    }

    fun confirmExchange() {
        val current = (_state.value as? UiState.Success)?.data ?: return
        _state.value = UiState.Success(current.copy(actionInFlight = true))
        viewModelScope.launch {
            repo.confirmExchange(id).fold(
                onSuccess = { _state.value = UiState.Success(current.copy(detail = it, actionInFlight = false, toast = "已确认换货完成")) },
                onFailure = { _state.value = UiState.Success(current.copy(actionInFlight = false, toast = errorMessage(it))) },
            )
        }
    }

    fun submitTracking(carrier: String, trackingNo: String) {
        val current = (_state.value as? UiState.Success)?.data ?: return
        if (carrier.isBlank() || trackingNo.isBlank()) {
            _state.value = UiState.Success(current.copy(toast = "请填写快递公司与单号"))
            return
        }
        _state.value = UiState.Success(current.copy(actionInFlight = true, trackingDialogOpen = false))
        viewModelScope.launch {
            repo.submitTracking(id, carrier.trim(), trackingNo.trim()).fold(
                onSuccess = { _state.value = UiState.Success(current.copy(detail = it, actionInFlight = false, toast = "物流已回填")) },
                onFailure = { _state.value = UiState.Success(current.copy(actionInFlight = false, toast = errorMessage(it))) },
            )
        }
    }

    fun submitAppeal(reason: String) {
        val current = (_state.value as? UiState.Success)?.data ?: return
        if (reason.length < 20) {
            _state.value = UiState.Success(current.copy(toast = "申诉理由至少 20 字"))
            return
        }
        _state.value = UiState.Success(current.copy(actionInFlight = true, appealDialogOpen = false))
        viewModelScope.launch {
            repo.appeal(id, reason.trim()).fold(
                onSuccess = { _state.value = UiState.Success(current.copy(detail = it, actionInFlight = false, toast = "已升级至平台仲裁")) },
                onFailure = { _state.value = UiState.Success(current.copy(actionInFlight = false, toast = errorMessage(it))) },
            )
        }
    }

    fun setAppealDialog(open: Boolean) {
        val current = (_state.value as? UiState.Success)?.data ?: return
        _state.value = UiState.Success(current.copy(appealDialogOpen = open))
    }

    fun setTrackingDialog(open: Boolean) {
        val current = (_state.value as? UiState.Success)?.data ?: return
        _state.value = UiState.Success(current.copy(trackingDialogOpen = open))
    }

    fun clearToast() {
        val current = (_state.value as? UiState.Success)?.data ?: return
        _state.value = UiState.Success(current.copy(toast = null))
    }
}
