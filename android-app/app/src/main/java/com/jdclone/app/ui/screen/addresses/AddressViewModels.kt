package com.jdclone.app.ui.screen.addresses

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.jdclone.app.data.network.dto.AddressCreateRequest
import com.jdclone.app.data.network.dto.AddressDto
import com.jdclone.app.data.network.dto.AddressUpdateRequest
import com.jdclone.app.data.repository.AddressRepository
import com.jdclone.app.ui.common.UiState
import com.jdclone.app.ui.common.errorMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AddressListState(
    val addresses: List<AddressDto>,
    val actionInFlight: Boolean = false,
    val toast: String? = null,
)

@HiltViewModel
class AddressListViewModel @Inject constructor(
    private val repo: AddressRepository,
) : ViewModel() {

    private val _state = MutableStateFlow<UiState<AddressListState>>(UiState.Loading)
    val state: StateFlow<UiState<AddressListState>> = _state.asStateFlow()

    init { refresh() }

    fun refresh() {
        _state.value = UiState.Loading
        viewModelScope.launch {
            _state.value = repo.list().fold(
                onSuccess = { UiState.Success(AddressListState(it)) },
                onFailure = { UiState.Error(errorMessage(it)) },
            )
        }
    }

    fun delete(id: Long) {
        val current = (_state.value as? UiState.Success)?.data ?: return
        _state.value = UiState.Success(current.copy(actionInFlight = true))
        viewModelScope.launch {
            repo.delete(id).fold(
                onSuccess = {
                    _state.value = UiState.Success(
                        current.copy(
                            addresses = current.addresses.filter { it.id != id },
                            actionInFlight = false,
                            toast = "已删除",
                        ),
                    )
                },
                onFailure = { _state.value = UiState.Success(current.copy(actionInFlight = false, toast = errorMessage(it))) },
            )
        }
    }

    fun setDefault(id: Long) {
        val current = (_state.value as? UiState.Success)?.data ?: return
        _state.value = UiState.Success(current.copy(actionInFlight = true))
        viewModelScope.launch {
            repo.setDefault(id).fold(
                onSuccess = { _ -> refresh() },
                onFailure = { _state.value = UiState.Success(current.copy(actionInFlight = false, toast = errorMessage(it))) },
            )
        }
    }

    fun clearToast() {
        val current = (_state.value as? UiState.Success)?.data ?: return
        _state.value = UiState.Success(current.copy(toast = null))
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit ViewModel
// ─────────────────────────────────────────────────────────────────────────────

data class AddressEditState(
    val id: Long? = null,
    val receiverName: String = "",
    val receiverPhone: String = "",
    val province: String = "",
    val city: String = "",
    val district: String = "",
    val detail: String = "",
    val postalCode: String = "",
    val isDefault: Boolean = false,
    val submitting: Boolean = false,
    val loading: Boolean = false,
    val error: String? = null,
    val done: Boolean = false,
)

@HiltViewModel
class AddressEditViewModel @Inject constructor(
    private val repo: AddressRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val incomingId: Long =
        savedStateHandle.get<String>("id")?.toLongOrNull()?.takeIf { it > 0 } ?: 0L

    private val _state = MutableStateFlow(AddressEditState(id = incomingId.takeIf { it > 0 }))
    val state: StateFlow<AddressEditState> = _state.asStateFlow()

    init {
        if (incomingId > 0) load()
    }

    private fun load() {
        _state.value = _state.value.copy(loading = true)
        viewModelScope.launch {
            repo.get(incomingId).fold(
                onSuccess = { a ->
                    _state.value = _state.value.copy(
                        loading = false,
                        id = a.id,
                        receiverName = a.receiverName,
                        receiverPhone = a.receiverPhone,
                        province = a.province,
                        city = a.city,
                        district = a.district,
                        detail = a.detail,
                        postalCode = a.postalCode.orEmpty(),
                        isDefault = a.isDefault,
                    )
                },
                onFailure = { _state.value = _state.value.copy(loading = false, error = errorMessage(it)) },
            )
        }
    }

    fun update(block: (AddressEditState) -> AddressEditState) {
        _state.value = block(_state.value)
    }

    fun submit() {
        val s = _state.value
        val err = validate(s)
        if (err != null) {
            _state.value = s.copy(error = err)
            return
        }
        _state.value = s.copy(submitting = true, error = null)
        viewModelScope.launch {
            val result = if (s.id == null) {
                repo.create(
                    AddressCreateRequest(
                        receiverName = s.receiverName,
                        receiverPhone = s.receiverPhone,
                        province = s.province,
                        city = s.city,
                        district = s.district,
                        detail = s.detail,
                        postalCode = s.postalCode.takeIf { it.isNotBlank() },
                        isDefault = s.isDefault,
                    ),
                )
            } else {
                repo.update(
                    s.id,
                    AddressUpdateRequest(
                        receiverName = s.receiverName,
                        receiverPhone = s.receiverPhone,
                        province = s.province,
                        city = s.city,
                        district = s.district,
                        detail = s.detail,
                        postalCode = s.postalCode.takeIf { it.isNotBlank() },
                        isDefault = s.isDefault,
                    ),
                )
            }
            _state.value = result.fold(
                onSuccess = { _state.value.copy(submitting = false, done = true) },
                onFailure = { _state.value.copy(submitting = false, error = errorMessage(it)) },
            )
        }
    }

    private fun validate(s: AddressEditState): String? = when {
        s.receiverName.isBlank() -> "请填写收件人姓名"
        s.receiverPhone.length < 6 -> "请填写有效手机号"
        s.province.isBlank() || s.city.isBlank() || s.district.isBlank() -> "请填写完整省市区"
        s.detail.length < 3 -> "请填写详细地址"
        else -> null
    }
}
