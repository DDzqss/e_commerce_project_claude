package com.jdclone.app.ui.screen.orders

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.jdclone.app.data.network.dto.OrderDetailDto
import com.jdclone.app.data.network.dto.OrderListItemDto
import com.jdclone.app.data.repository.OrderRepository
import com.jdclone.app.ui.common.UiState
import com.jdclone.app.ui.common.errorMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class OrderTab(val label: String, val filter: String?) {
    ALL("全部", null),
    PENDING_PAYMENT("待付款", "pending_payment"),
    PAID("待发货", "paid"),
    SHIPPED("待收货", "shipped"),
    COMPLETED("已完成", "completed"),
    CANCELLED("已取消", "cancelled,closed"),
}

data class OrderListState(
    val tab: OrderTab = OrderTab.ALL,
    val items: List<OrderListItemDto> = emptyList(),
    val loading: Boolean = false,
    val loadingMore: Boolean = false,
    val page: Int = 1,
    val allLoaded: Boolean = false,
    val error: String? = null,
    val toast: String? = null,
)

@HiltViewModel
class OrderListViewModel @Inject constructor(
    private val repo: OrderRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(OrderListState())
    val state: StateFlow<OrderListState> = _state.asStateFlow()

    init { refresh() }

    fun switchTab(tab: OrderTab) {
        if (tab == _state.value.tab) return
        _state.value = _state.value.copy(tab = tab)
        refresh()
    }

    fun refresh() {
        val current = _state.value
        _state.value = current.copy(loading = true, page = 1, items = emptyList(), allLoaded = false, error = null)
        viewModelScope.launch {
            repo.list(status = _state.value.tab.filter, page = 1, size = 20).fold(
                onSuccess = { page ->
                    _state.value = _state.value.copy(
                        loading = false,
                        items = page.items,
                        page = 1,
                        allLoaded = page.items.size >= page.total,
                    )
                },
                onFailure = {
                    _state.value = _state.value.copy(loading = false, error = errorMessage(it))
                },
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

data class OrderDetailState(
    val detail: OrderDetailDto,
    val actionInFlight: Boolean = false,
    val toast: String? = null,
)

@HiltViewModel
class OrderDetailViewModel @Inject constructor(
    private val repo: OrderRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val orderId: Long = savedStateHandle.get<String>("orderId")?.toLongOrNull() ?: 0L

    private val _state = MutableStateFlow<UiState<OrderDetailState>>(UiState.Loading)
    val state: StateFlow<UiState<OrderDetailState>> = _state.asStateFlow()

    init { load() }

    fun load() {
        _state.value = UiState.Loading
        viewModelScope.launch {
            _state.value = repo.get(orderId).fold(
                onSuccess = { UiState.Success(OrderDetailState(it)) },
                onFailure = { UiState.Error(errorMessage(it)) },
            )
        }
    }

    fun cancel() {
        val current = (_state.value as? UiState.Success)?.data ?: return
        _state.value = UiState.Success(current.copy(actionInFlight = true))
        viewModelScope.launch {
            repo.cancel(orderId).fold(
                onSuccess = {
                    _state.value = UiState.Success(current.copy(detail = it, actionInFlight = false, toast = "订单已取消"))
                },
                onFailure = { _state.value = UiState.Success(current.copy(actionInFlight = false, toast = errorMessage(it))) },
            )
        }
    }

    fun confirmReceipt() {
        val current = (_state.value as? UiState.Success)?.data ?: return
        _state.value = UiState.Success(current.copy(actionInFlight = true))
        viewModelScope.launch {
            repo.confirmReceipt(orderId).fold(
                onSuccess = {
                    _state.value = UiState.Success(current.copy(detail = it, actionInFlight = false, toast = "已确认收货"))
                },
                onFailure = { _state.value = UiState.Success(current.copy(actionInFlight = false, toast = errorMessage(it))) },
            )
        }
    }

    fun clearToast() {
        val current = (_state.value as? UiState.Success)?.data ?: return
        _state.value = UiState.Success(current.copy(toast = null))
    }
}

/** 订单状态文本 —— 中文化。 */
fun orderStatusLabel(status: String): String = when (status) {
    "pending_payment" -> "待付款"
    "paid" -> "待发货"
    "shipped" -> "待收货"
    "completed" -> "已完成"
    "cancelled" -> "已取消"
    "closed" -> "已关闭"
    else -> status
}
