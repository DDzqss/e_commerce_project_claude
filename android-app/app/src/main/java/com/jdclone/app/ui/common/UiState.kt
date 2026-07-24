package com.jdclone.app.ui.common

/**
 * 三态 UiState —— 所有 ViewModel 通过 StateFlow<UiState<T>> 向 UI 层暴露状态。
 */
sealed interface UiState<out T> {
    data object Loading : UiState<Nothing>
    data class Success<T>(val data: T) : UiState<T>
    data class Error(val message: String, val code: Int? = null) : UiState<Nothing>
}

/** 将 [Result] 转换为 [UiState]（成功 → Success，失败 → Error）。 */
fun <T> Result<T>.toUiState(): UiState<T> = fold(
    onSuccess = { UiState.Success(it) },
    onFailure = { UiState.Error(errorMessage(it), (it as? com.jdclone.app.data.network.ApiException)?.code) },
)
