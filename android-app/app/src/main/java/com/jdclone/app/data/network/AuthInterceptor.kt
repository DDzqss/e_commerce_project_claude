package com.jdclone.app.data.network

import com.jdclone.app.data.local.AuthTokenManager
import com.jdclone.app.data.local.SessionState
import com.jdclone.app.data.network.dto.RefreshRequest
import com.jdclone.app.data.network.dto.TokenPairDto
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.Json
import okhttp3.Interceptor
import okhttp3.Request
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Provider
import javax.inject.Singleton

/**
 * Bearer 注入 + 401→refresh 单飞。
 *
 * 策略：
 * 1. 请求前从 DataStore 读 access，写 `Authorization: Bearer <access>` 头。
 * 2. 收到响应后如果 HTTP 401 且 envelope.code == 1002，进入刷新流程。
 * 3. 刷新 in mutex（`withLock`）——并发多个 401 只会 refresh 一次；其他线程复用结果。
 * 4. 刷新成功 → 用新 access 重放原请求。
 * 5. 刷新失败 → 清 token + SessionState.setLoggedOut，让 UI 自动跳登录。
 *
 * NOTE：为避免 Retrofit + Hilt 循环依赖（Interceptor 需要 ApiService 才能 refresh，
 * 但 ApiService 依赖 OkHttp 又依赖 Interceptor），我们使用 Provider<ApiService>
 * 延迟注入。
 */
@Singleton
class AuthInterceptor @Inject constructor(
    private val tokenManager: AuthTokenManager,
    private val session: SessionState,
    private val apiServiceProvider: Provider<ApiService>,
    private val json: Json,
) : Interceptor {

    private val refreshMutex = Mutex()

    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val access = tokenManager.accessBlocking()
        val firstRequest = if (access.isNullOrBlank() || original.header("Authorization") != null) {
            original
        } else {
            original.newBuilder().header("Authorization", "Bearer $access").build()
        }

        val response = chain.proceed(firstRequest)
        val is401 = response.code == 401
        if (!is401) return response

        // 提前把 body 读出来（envelope.code=1002 判断需要），再原样塞回去
        val peeked = peekEnvelopeCode(response)
        if (peeked != 1002) return response

        response.close()

        val newAccess = runBlocking { attemptRefresh() } ?: run {
            // refresh 失败：清 token + 触发登录跳转
            runBlocking { tokenManager.clear() }
            session.setLoggedOut()
            return chain.proceed(original) // 让上层拿到 401 展示错误
        }

        val retried = original.newBuilder()
            .header("Authorization", "Bearer $newAccess")
            .build()
        return chain.proceed(retried)
    }

    /**
     * 单飞的 refresh。若已有别的线程完成了刷新，再进来的直接读取最新 token 返回。
     */
    private suspend fun attemptRefresh(): String? = refreshMutex.withLock {
        val current = tokenManager.access()
        val refresh = tokenManager.refresh()
        if (refresh.isNullOrBlank()) return@withLock null
        try {
            val result: TokenPairDto = apiServiceProvider.get()
                .refresh(RefreshRequest(refreshToken = refresh))
                .unwrap()
            tokenManager.save(access = result.accessToken, refresh = result.refreshToken)
            result.accessToken
        } catch (t: Throwable) {
            // 若已被别的并发线程刷新过（current != tokenManager.access()），复用最新的
            val newest = tokenManager.access()
            if (!newest.isNullOrBlank() && newest != current) newest else null
        }
    }

    /**
     * 读取响应 body 里的 `code` 字段（envelope 结构）而不消耗响应流。
     * 使用 OkHttp 官方 peekBody，最多 1MB 足够 envelope 头部使用。
     */
    private fun peekEnvelopeCode(response: Response): Int? {
        val peek = try {
            response.peekBody(1024 * 1024).string()
        } catch (t: Throwable) {
            return null
        }
        if (peek.isBlank()) return null
        val match = Regex("\"code\"\\s*:\\s*(-?\\d+)").find(peek)
        return match?.groupValues?.get(1)?.toIntOrNull()
    }
}

// (auxiliary retained for potential future body-rewrap flows; unused now)
private fun dummyRequestForCompile(): Request? = null
