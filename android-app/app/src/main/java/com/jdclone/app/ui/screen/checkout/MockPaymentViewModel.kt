package com.jdclone.app.ui.screen.checkout

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.jdclone.app.data.repository.OrderRepository
import com.jdclone.app.data.repository.PaymentRepository
import com.jdclone.app.ui.common.UiState
import com.jdclone.app.ui.common.errorMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Mock payment 页 —— 用户先在结算页选商品并"提交订单"（生成订单实体），
 * 然后走一次 `createPaymentSession` 得到 sessionId 才能到本页；
 * 因此本 ViewModel 支持两种入口：
 *  - 只有 orderId → 先创建 payment session
 *  - 直接有 sessionId → 拉取现存 session
 */
data class MockPaymentState(
    val orderId: Long,
    val sessionId: Long,
    val amountCents: Int,
    val status: String,
    val selectedChannel: String = "mock_alipay",
    val submitting: Boolean = false,
    val toast: String? = null,
    val done: Boolean = false,
)

@HiltViewModel
class MockPaymentViewModel @Inject constructor(
    private val paymentRepo: PaymentRepository,
    private val orderRepo: OrderRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val initialSessionId: Long =
        savedStateHandle.get<String>("sessionId")?.toLongOrNull() ?: 0L
    private val orderId: Long =
        savedStateHandle.get<String>("orderId")?.toLongOrNull() ?: 0L

    private val _state = MutableStateFlow<UiState<MockPaymentState>>(UiState.Loading)
    val state: StateFlow<UiState<MockPaymentState>> = _state.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            if (initialSessionId > 0) {
                paymentRepo.getSession(initialSessionId).fold(
                    onSuccess = {
                        _state.value = UiState.Success(
                            MockPaymentState(
                                orderId = it.orderId,
                                sessionId = it.effectiveId,
                                amountCents = it.amountCents,
                                status = it.status,
                                selectedChannel = it.channel,
                            ),
                        )
                    },
                    onFailure = { _state.value = UiState.Error(errorMessage(it)) },
                )
            } else if (orderId > 0) {
                orderRepo.get(orderId).fold(
                    onSuccess = { order ->
                        _state.value = UiState.Success(
                            MockPaymentState(
                                orderId = order.id,
                                sessionId = 0L,
                                amountCents = order.totalCents,
                                status = "pending",
                            ),
                        )
                    },
                    onFailure = { _state.value = UiState.Error(errorMessage(it)) },
                )
            } else {
                _state.value = UiState.Error("缺少订单或支付会话参数")
            }
        }
    }

    fun selectChannel(channel: String) {
        val current = (_state.value as? UiState.Success)?.data ?: return
        _state.value = UiState.Success(current.copy(selectedChannel = channel))
    }

    private suspend fun ensureSession(current: MockPaymentState): MockPaymentState? {
        if (current.sessionId > 0) return current
        val result = paymentRepo.createSession(current.orderId, current.selectedChannel)
        return result.fold(
            onSuccess = { session ->
                current.copy(
                    sessionId = session.effectiveId,
                    amountCents = session.amountCents,
                    status = session.status,
                )
            },
            onFailure = {
                _state.value = UiState.Success(current.copy(toast = errorMessage(it)))
                null
            },
        )
    }

    fun mockSucceed() {
        val current = (_state.value as? UiState.Success)?.data ?: return
        _state.value = UiState.Success(current.copy(submitting = true, toast = null))
        viewModelScope.launch {
            val withSession = ensureSession(current) ?: run {
                _state.value = UiState.Success(current.copy(submitting = false))
                return@launch
            }
            paymentRepo.mockSucceed(withSession.sessionId).fold(
                onSuccess = {
                    _state.value = UiState.Success(
                        withSession.copy(
                            submitting = false,
                            done = true,
                            toast = "支付成功",
                            status = "succeeded",
                        ),
                    )
                },
                onFailure = {
                    _state.value = UiState.Success(
                        withSession.copy(submitting = false, toast = errorMessage(it)),
                    )
                },
            )
        }
    }

    fun mockFail() {
        val current = (_state.value as? UiState.Success)?.data ?: return
        _state.value = UiState.Success(current.copy(submitting = true, toast = null))
        viewModelScope.launch {
            val withSession = ensureSession(current) ?: run {
                _state.value = UiState.Success(current.copy(submitting = false))
                return@launch
            }
            paymentRepo.mockFail(withSession.sessionId).fold(
                onSuccess = {
                    _state.value = UiState.Success(
                        withSession.copy(
                            submitting = false,
                            toast = "支付失败，可重试",
                            status = "failed",
                        ),
                    )
                },
                onFailure = {
                    _state.value = UiState.Success(
                        withSession.copy(submitting = false, toast = errorMessage(it)),
                    )
                },
            )
        }
    }

    fun clearToast() {
        val current = (_state.value as? UiState.Success)?.data ?: return
        _state.value = UiState.Success(current.copy(toast = null))
    }
}
