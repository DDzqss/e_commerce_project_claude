package com.jdclone.app.data.network.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// ─────────────────────────────────────────────────────────────────────────────
// User / Auth
// ─────────────────────────────────────────────────────────────────────────────

@Serializable
data class UserDto(
    val id: Long,
    val phone: String? = null,
    val email: String? = null,
    val nickname: String,
    @SerialName("avatar_url") val avatarUrl: String? = null,
    val status: String? = null,
)

@Serializable
data class AuthTokensDto(
    val user: UserDto,
    @SerialName("access_token") val accessToken: String,
    @SerialName("refresh_token") val refreshToken: String,
    @SerialName("expires_in") val expiresIn: Int,
)

/** `POST /auth/refresh` 返回不带 user 字段。 */
@Serializable
data class TokenPairDto(
    @SerialName("access_token") val accessToken: String,
    @SerialName("refresh_token") val refreshToken: String,
    @SerialName("expires_in") val expiresIn: Int,
)

@Serializable
data class RegisterRequest(
    val phone: String? = null,
    val email: String? = null,
    val password: String,
    val nickname: String? = null,
)

@Serializable
data class LoginRequest(
    val identifier: String,
    val password: String,
)

@Serializable
data class RefreshRequest(
    @SerialName("refresh_token") val refreshToken: String,
)

@Serializable
data class LogoutRequest(
    @SerialName("refresh_token") val refreshToken: String? = null,
)

@Serializable
data class ForgotPasswordRequest(val identifier: String)

@Serializable
data class ResetPasswordRequest(
    val identifier: String,
    val code: String,
    @SerialName("new_password") val newPassword: String,
)

@Serializable
data class ChangePasswordRequest(
    @SerialName("old_password") val oldPassword: String,
    @SerialName("new_password") val newPassword: String,
)

@Serializable
data class UpdateProfileRequest(
    val nickname: String? = null,
    @SerialName("avatar_url") val avatarUrl: String? = null,
)

@Serializable
data class UserMeDto(
    val user: UserDto,
    @SerialName("merchant_account_ids") val merchantAccountIds: List<Long> = emptyList(),
    @SerialName("pending_application_id") val pendingApplicationId: Long? = null,
)
