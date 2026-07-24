package com.jdclone.app.ui.screen.cart

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.jdclone.app.data.network.dto.CartItemDto
import com.jdclone.app.data.network.dto.CartResponseDto
import com.jdclone.app.data.repository.CartRepository
import com.jdclone.app.ui.common.UiState
import com.jdclone.app.ui.common.errorMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class CartUiState(
    val response: CartResponseDto,
    val actionInFlight: Boolean = false,
    val toast: String? = null,
) {
    val allSelected: Boolean
        get() = response.groups.flatMap { it.items }.filter { it.status == "valid" }
            .let { list -> list.isNotEmpty() && list.all { it.selected } }
}

@HiltViewModel
class CartViewModel @Inject constructor(
    private val repo: CartRepository,
) : ViewModel() {

    private val _state = MutableStateFlow<UiState<CartUiState>>(UiState.Loading)
    val state: StateFlow<UiState<CartUiState>> = _state.asStateFlow()

    fun refresh() {
        _state.value = UiState.Loading
        viewModelScope.launch {
            _state.value = repo.getCart().fold(
                onSuccess = { UiState.Success(CartUiState(response = it)) },
                onFailure = { UiState.Error(errorMessage(it)) },
            )
        }
    }

    private fun mutateResponse(block: (CartResponseDto) -> CartResponseDto) {
        val current = (_state.value as? UiState.Success)?.data ?: return
        _state.value = UiState.Success(current.copy(response = block(current.response)))
    }

    fun toggleSelected(item: CartItemDto) {
        viewModelScope.launch {
            repo.updateSelected(item.id, !item.selected).fold(
                onSuccess = { updated ->
                    mutateResponse { r ->
                        r.copy(
                            groups = r.groups.map { g ->
                                g.copy(items = g.items.map { if (it.id == updated.id) updated else it })
                            },
                        )
                    }
                    refresh()
                },
                onFailure = { showToast(errorMessage(it)) },
            )
        }
    }

    fun updateQuantity(item: CartItemDto, quantity: Int) {
        val target = quantity.coerceAtLeast(1)
        viewModelScope.launch {
            repo.updateQuantity(item.id, target).fold(
                onSuccess = { updated ->
                    mutateResponse { r ->
                        r.copy(
                            groups = r.groups.map { g ->
                                g.copy(items = g.items.map { if (it.id == updated.id) updated else it })
                            },
                        )
                    }
                    refresh()
                },
                onFailure = { showToast(errorMessage(it)) },
            )
        }
    }

    fun deleteItem(item: CartItemDto) {
        viewModelScope.launch {
            repo.delete(item.id).fold(
                onSuccess = { refresh() },
                onFailure = { showToast(errorMessage(it)) },
            )
        }
    }

    fun selectAll(selected: Boolean) {
        viewModelScope.launch {
            repo.selectAll(selected).fold(
                onSuccess = { mutateResponse { _ -> it } },
                onFailure = { showToast(errorMessage(it)) },
            )
        }
    }

    fun clearInvalid() {
        viewModelScope.launch {
            repo.clearInvalid().fold(
                onSuccess = { refresh() },
                onFailure = { showToast(errorMessage(it)) },
            )
        }
    }

    fun selectedItemIds(): List<Long> {
        val current = (_state.value as? UiState.Success)?.data ?: return emptyList()
        return current.response.groups.flatMap { g -> g.items.filter { it.selected && it.status == "valid" } }
            .map { it.id }
    }

    private fun showToast(msg: String) {
        val current = (_state.value as? UiState.Success)?.data ?: return
        _state.value = UiState.Success(current.copy(toast = msg))
    }

    fun clearToast() {
        val current = (_state.value as? UiState.Success)?.data ?: return
        _state.value = UiState.Success(current.copy(toast = null))
    }
}
