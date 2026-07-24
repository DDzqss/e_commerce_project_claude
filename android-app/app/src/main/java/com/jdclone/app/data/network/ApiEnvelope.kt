package com.jdclone.app.data.network

import kotlinx.serialization.Serializable

/**
 * 后端所有响应统一结构 `{code, message, data}`。
 *
 * - `code == 0` 表示成功；`code > 0` 是业务错误
 * - 分页数据 [data] 内部会是 `{items, total, page, size}` 结构
 */
@Serializable
data class ApiEnvelope<T>(
    val code: Int = 0,
    val message: String = "",
    val data: T? = null,
)

/** 分页通用结构 —— 与 `docs/API/phase-1-contracts.md §1` 保持一致。 */
@Serializable
data class PageData<T>(
    val items: List<T> = emptyList(),
    val total: Int = 0,
    val page: Int = 1,
    val size: Int = 20,
)

/** 业务异常：Repository 从 [ApiEnvelope] 抛出，ViewModel 转换为 UiState.Error。 */
class ApiException(
    val code: Int,
    val displayMessage: String,
) : RuntimeException(displayMessage)

/** 把 envelope 解包成 data，非 0 抛 [ApiException]。 */
fun <T> ApiEnvelope<T>.unwrap(): T {
    if (code != 0) {
        throw ApiException(code, message.ifBlank { "未知错误" })
    }
    return data
        ?: throw ApiException(code, "响应数据为空")
}

/** 允许 data 可能为 null 的场景（如 logout、set default 等）。 */
fun <T> ApiEnvelope<T>.unwrapOptional(): T? {
    if (code != 0) {
        throw ApiException(code, message.ifBlank { "未知错误" })
    }
    return data
}
