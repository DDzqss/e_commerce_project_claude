package com.jdclone.app.data.repository

import com.jdclone.app.data.local.AuthTokenManager
import com.jdclone.app.data.local.SessionState
import com.jdclone.app.data.network.ApiException
import com.jdclone.app.data.network.ApiService
import com.jdclone.app.data.network.dto.ChangePasswordRequest
import com.jdclone.app.data.network.dto.ForgotPasswordRequest
import com.jdclone.app.data.network.dto.LoginRequest
import com.jdclone.app.data.network.dto.LogoutRequest
import com.jdclone.app.data.network.dto.RegisterRequest
import com.jdclone.app.data.network.dto.ResetPasswordRequest
import com.jdclone.app.data.network.dto.UpdateProfileRequest
import com.jdclone.app.data.network.dto.UserDto
import com.jdclone.app.data.network.dto.UserMeDto
import com.jdclone.app.data.network.unwrap
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Auth 相关 Repository —— 登录 / 注册 / 忘记密码 / 修改密码 / 登出，
 * 以及冷启动时的 session 恢复（`bootstrap`）。
 *
 * 成功登录后会：
 *  1. 持久化 access + refresh token（[AuthTokenManager]）
 *  2. 更新 [SessionState] 让 UI 层跳到主界面
 */
@Singleton
class AuthRepository @Inject constructor(
    private val api: ApiService,
    private val tokens: AuthTokenManager,
    private val session: SessionState,
) {
    suspend fun bootstrap(): Result<UserDto?> = safeIo {
        val access = tokens.access()
        if (access.isNullOrBlank()) {
            session.markInitialized(user = null)
            return@safeIo null
        }
        try {
            val me = api.getMe().unwrap()
            session.markInitialized(me.user)
            me.user
        } catch (t: Throwable) {
            // getMe 失败（网络或 token 已失效）：清 token + 走登录页
            tokens.clear()
            session.markInitialized(user = null)
            null
        }
    }

    suspend fun login(identifier: String, password: String): Result<UserDto> = safeIo {
        val result = api.login(LoginRequest(identifier = identifier, password = password)).unwrap()
        tokens.save(result.accessToken, result.refreshToken)
        session.setLoggedIn(result.user)
        result.user
    }

    suspend fun register(
        phone: String?,
        email: String?,
        password: String,
        nickname: String?,
    ): Result<UserDto> = safeIo {
        val result = api.register(
            RegisterRequest(
                phone = phone?.takeIf { it.isNotBlank() },
                email = email?.takeIf { it.isNotBlank() },
                password = password,
                nickname = nickname?.takeIf { it.isNotBlank() },
            ),
        ).unwrap()
        tokens.save(result.accessToken, result.refreshToken)
        session.setLoggedIn(result.user)
        result.user
    }

    suspend fun forgotPassword(identifier: String): Result<Unit> = safeIo {
        api.forgotPassword(ForgotPasswordRequest(identifier))
        Unit
    }

    suspend fun resetPassword(
        identifier: String,
        code: String,
        newPassword: String,
    ): Result<Unit> = safeIo {
        api.resetPassword(ResetPasswordRequest(identifier, code, newPassword))
        Unit
    }

    suspend fun changePassword(oldPassword: String, newPassword: String): Result<Unit> = safeIo {
        api.changePassword(ChangePasswordRequest(oldPassword, newPassword))
        Unit
    }

    suspend fun me(): Result<UserMeDto> = safeIo { api.getMe().unwrap() }

    suspend fun updateProfile(
        nickname: String? = null,
        avatarUrl: String? = null,
    ): Result<UserMeDto> = safeIo {
        val result = api.updateMe(UpdateProfileRequest(nickname, avatarUrl)).unwrap()
        session.setLoggedIn(result.user)
        result
    }

    suspend fun logout(): Result<Unit> = safeIo {
        val refresh = tokens.refresh()
        runCatching { api.logout(LogoutRequest(refreshToken = refresh)) }
        tokens.clear()
        session.setLoggedOut()
    }
}

/** 通用 IO 包裹：捕获 [ApiException] + 其他异常，转成 [Result]。 */
internal suspend inline fun <T> safeIo(crossinline block: suspend () -> T): Result<T> =
    withContext(Dispatchers.IO) {
        try {
            Result.success(block())
        } catch (e: ApiException) {
            Result.failure(e)
        } catch (e: Throwable) {
            Result.failure(e)
        }
    }
