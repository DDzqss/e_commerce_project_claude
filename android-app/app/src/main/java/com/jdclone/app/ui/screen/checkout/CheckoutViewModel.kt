package com.jdclone.app.ui.screen.checkout

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.jdclone.app.data.network.dto.AddressDto
import com.jdclone.app.data.network.dto.OrderPreviewDto
import com.jdclone.app.data.repository.AddressRepository
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

data class CheckoutUiState(
    val preview: OrderPreviewDto,
    val addresses: List<AddressDto> = emptyList(),
    val selectedAddress: AddressDto,
    val note: String = "",
    val submitting: Boolean = false,
    val toast: String? = null,
)

sealed interface CheckoutEffect {
    data class Created(val orderId: Long, val orderNo: String) : CheckoutEffect
}

@HiltViewModel
class CheckoutViewModel @Inject constructor(
    private val orderRepo: OrderRepository,
    private val addressRepo: AddressRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val cartItemIds: List<Long> = savedStateHandle.get<String>("ids")
        ?.split(",")
        ?.mapNotNull { it.toLongOrNull() }
        ?: emptyList()

    private val _state = MutableStateFlow<UiState<CheckoutUiState>>(UiState.Loading)
    val state: StateFlow<UiState<CheckoutUiState>> = _state.asStateFlow()

    private val _effect = MutableStateFlow<CheckoutEffect?>(null)
    val effect: StateFlow<CheckoutEffect?> = _effect.asStateFlow()

    /**
     * 每次会话生成一次 UUID，作为 Idempotency-Key。
     * 用户在同一次结算内点击"提交订单"重试会复用此 key。
     */
    private val idempotencyKey: String = UUID.randomUUID().toString()

    init { load() }

    fun load() {
        if (cartItemIds.isEmpty()) {
            _state.value = UiState.Error("未选中任何商品")
            return
        }
        _state.value = UiState.Loading
        viewModelScope.launch {
            val addressListResult = addressRepo.list()
            val addresses = addressListResult.getOrElse {
                _state.value = UiState.Error(errorMessage(it))
                return@launch
            }
            val default = addresses.firstOrNull { it.isDefault } ?: addresses.firstOrNull()
            if (default == null) {
                _state.value = UiState.Error("请先添加收货地址")
                return@launch
            }
            orderRepo.preview(cartItemIds, default.id).fold(
                onSuccess = { preview ->
                    _state.value = UiState.Success(
                        CheckoutUiState(
                            preview = preview,
                            addresses = addresses,
                            selectedAddress = default,
                        ),
                    )
                },
                onFailure = { _state.value = UiState.Error(errorMessage(it)) },
            )
        }
    }

    fun switchAddress(address: AddressDto) {
        val current = (_state.value as? UiState.Success)?.data ?: return
        _state.value = UiState.Success(current.copy(selectedAddress = address))
        viewModelScope.launch {
            orderRepo.preview(cartItemIds, address.id).fold(
                onSuccess = { preview ->
                    _state.value = UiState.Success(current.copy(preview = preview, selectedAddress = address))
                },
                onFailure = { showToast(errorMessage(it)) },
            )
        }
    }

    fun updateNote(note: String) {
        val current = (_state.value as? UiState.Success)?.data ?: return
        _state.value = UiState.Success(current.copy(note = note))
    }

    fun submit() {
        val current = (_state.value as? UiState.Success)?.data ?: return
        val hasHardBlocker = current.preview.warnings.any {
            it.type == "invalid_sku" || it.type == "stock_short"
        }
        if (hasHardBlocker) {
            showToast("购物车存在失效或库存不足商品，请返回处理")
            return
        }
        _state.value = UiState.Success(current.copy(submitting = true))
        viewModelScope.launch {
            orderRepo.create(
                cartItemIds = cartItemIds,
                addressId = current.selectedAddress.id,
                userNote = current.note.takeIf { it.isNotBlank() },
                idempotencyKey = idempotencyKey,
            ).fold(
                onSuccess = { result ->
                    val first = result.orders.firstOrNull()
                    if (first != null) {
                        _effect.value = CheckoutEffect.Created(first.id, first.orderNo)
                    }
                    _state.value = UiState.Success(current.copy(submitting = false))
                },
                onFailure = {
                    _state.value = UiState.Success(current.copy(submitting = false, toast = errorMessage(it)))
                },
            )
        }
    }

    fun clearEffect() { _effect.value = null }

    private fun showToast(msg: String) {
        val current = (_state.value as? UiState.Success)?.data ?: return
        _state.value = UiState.Success(current.copy(toast = msg))
    }

    fun clearToast() {
        val current = (_state.value as? UiState.Success)?.data ?: return
        _state.value = UiState.Success(current.copy(toast = null))
    }
}
