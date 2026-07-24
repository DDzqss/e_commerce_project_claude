package com.jdclone.app.ui.screen.notifications

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.jdclone.app.data.network.dto.NotificationDto
import com.jdclone.app.data.repository.NotificationRepository
import com.jdclone.app.ui.common.errorMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class NotificationTab(val label: String, val category: String?) {
    ALL("全部", null),
    ORDER("订单", "order"),
    AFTERSALES("售后", "aftersales"),
    SYSTEM("系统", "system"),
}

data class NotificationsState(
    val tab: NotificationTab = NotificationTab.ALL,
    val items: List<NotificationDto> = emptyList(),
    val unreadTotal: Int = 0,
    val loading: Boolean = false,
    val error: String? = null,
    val toast: String? = null,
)

@HiltViewModel
class NotificationViewModel @Inject constructor(
    private val repo: NotificationRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(NotificationsState())
    val state: StateFlow<NotificationsState> = _state.asStateFlow()

    init { refresh() }

    fun switchTab(tab: NotificationTab) {
        if (tab == _state.value.tab) return
        _state.value = _state.value.copy(tab = tab)
        refresh()
    }

    fun refresh() {
        _state.value = _state.value.copy(loading = true, error = null)
        viewModelScope.launch {
            repo.list(category = _state.value.tab.category, page = 1, size = 50).fold(
                onSuccess = {
                    _state.value = _state.value.copy(
                        loading = false,
                        items = it.items,
                        unreadTotal = it.unreadTotal,
                    )
                },
                onFailure = { _state.value = _state.value.copy(loading = false, error = errorMessage(it)) },
            )
        }
    }

    fun markRead(id: Long) {
        viewModelScope.launch {
            repo.markRead(id).fold(
                onSuccess = {
                    _state.value = _state.value.copy(
                        items = _state.value.items.map { if (it.id == id) it.copy(isRead = true) else it },
                        unreadTotal = (_state.value.unreadTotal - 1).coerceAtLeast(0),
                    )
                },
                onFailure = { _state.value = _state.value.copy(toast = errorMessage(it)) },
            )
        }
    }

    fun markAllRead() {
        viewModelScope.launch {
            repo.markAllRead().fold(
                onSuccess = { refresh() },
                onFailure = { _state.value = _state.value.copy(toast = errorMessage(it)) },
            )
        }
    }

    fun clearToast() { _state.value = _state.value.copy(toast = null) }
}

// 未读数只读单例（用于 App 顶部铃铛）
@HiltViewModel
class NotificationBadgeViewModel @Inject constructor(
    private val repo: NotificationRepository,
) : ViewModel() {
    private val _unread = MutableStateFlow(0)
    val unread: StateFlow<Int> = _unread.asStateFlow()

    fun refresh() {
        viewModelScope.launch {
            repo.unreadCount().onSuccess { _unread.value = it }
        }
    }
}
