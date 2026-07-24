package com.jdclone.app.data.local

import com.jdclone.app.data.network.dto.UserDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/** UI 层订阅的登录态。 */
sealed interface AuthState {
    /** 初始阶段 —— 从 DataStore 恢复 token 中。 */
    data object Loading : AuthState

    /** 未登录（token 缺失或已失效）。 */
    data object LoggedOut : AuthState

    /** 已登录（含最新 UserDto）。 */
    data class LoggedIn(val user: UserDto) : AuthState
}

/**
 * 单例登录态总线。
 *
 * - App 启动时 [markInitialized]
 * - AuthRepository.login/register 成功后 [setLoggedIn]
 * - AuthInterceptor 检测到 refresh 失败 or logout 后调用 [setLoggedOut]
 * - Root NavHost 订阅 [authState] 决定跳转
 */
@Singleton
class SessionState @Inject constructor() {
    private val _authState = MutableStateFlow<AuthState>(AuthState.Loading)
    val authState: StateFlow<AuthState> = _authState.asStateFlow()

    fun setLoggedIn(user: UserDto) {
        _authState.value = AuthState.LoggedIn(user)
    }

    fun setLoggedOut() {
        _authState.value = AuthState.LoggedOut
    }

    fun markInitialized(user: UserDto?) {
        _authState.value = if (user != null) AuthState.LoggedIn(user) else AuthState.LoggedOut
    }

    fun currentUser(): UserDto? = (authState.value as? AuthState.LoggedIn)?.user
}
