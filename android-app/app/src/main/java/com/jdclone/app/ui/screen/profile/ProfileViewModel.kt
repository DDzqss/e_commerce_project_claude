package com.jdclone.app.ui.screen.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.jdclone.app.data.local.AuthState
import com.jdclone.app.data.local.SessionState
import com.jdclone.app.data.repository.AuthRepository
import com.jdclone.app.ui.common.errorMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ProfileUiState(
    val toast: String? = null,
    val loading: Boolean = false,
    val changePasswordSubmitting: Boolean = false,
    val changePasswordDone: Boolean = false,
)

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val session: SessionState,
    private val authRepo: AuthRepository,
) : ViewModel() {

    val authState: StateFlow<AuthState> = session.authState

    private val _ui = MutableStateFlow(ProfileUiState())
    val ui: StateFlow<ProfileUiState> = _ui.asStateFlow()

    fun logout() {
        _ui.value = _ui.value.copy(loading = true)
        viewModelScope.launch {
            authRepo.logout()
            _ui.value = ProfileUiState()
        }
    }

    fun changePassword(oldPwd: String, newPwd: String) {
        if (oldPwd.isBlank() || newPwd.length < 8) {
            _ui.value = _ui.value.copy(toast = "请填写完整（新密码至少 8 位）")
            return
        }
        _ui.value = _ui.value.copy(changePasswordSubmitting = true, toast = null)
        viewModelScope.launch {
            authRepo.changePassword(oldPwd, newPwd).fold(
                onSuccess = {
                    _ui.value = _ui.value.copy(
                        changePasswordSubmitting = false,
                        changePasswordDone = true,
                        toast = "密码已更新",
                    )
                },
                onFailure = {
                    _ui.value = _ui.value.copy(
                        changePasswordSubmitting = false,
                        toast = errorMessage(it),
                    )
                },
            )
        }
    }

    fun clearChangeDone() {
        _ui.value = _ui.value.copy(changePasswordDone = false)
    }

    fun clearToast() { _ui.value = _ui.value.copy(toast = null) }
}
