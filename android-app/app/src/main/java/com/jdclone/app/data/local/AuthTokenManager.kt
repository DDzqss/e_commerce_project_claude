package com.jdclone.app.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

/** 顶层扩展属性 —— 每个 Context 共享一份 DataStore。 */
private val Context.authDataStore: DataStore<Preferences> by preferencesDataStore(name = "auth")

/**
 * 持久化 access + refresh token（DataStore Preferences）。
 *
 * 用法：
 * - 登录/注册成功后调用 [save]
 * - AuthInterceptor 通过 [accessBlocking] 拿到当前 token
 * - refresh 成功后调用 [save] 覆盖
 * - refresh 失败 or 登出：[clear]
 */
@Singleton
class AuthTokenManager @Inject constructor(
    @ApplicationContext private val ctx: Context,
) {
    private object Keys {
        val ACCESS = stringPreferencesKey("access_token")
        val REFRESH = stringPreferencesKey("refresh_token")
    }

    val accessFlow: Flow<String?> = ctx.authDataStore.data.map { it[Keys.ACCESS] }
    val refreshFlow: Flow<String?> = ctx.authDataStore.data.map { it[Keys.REFRESH] }

    /** 同步保存 access + refresh。 */
    suspend fun save(access: String, refresh: String) {
        ctx.authDataStore.edit { prefs ->
            prefs[Keys.ACCESS] = access
            prefs[Keys.REFRESH] = refresh
        }
    }

    /** 清空 —— 登出 or refresh 失败时调用。 */
    suspend fun clear() {
        ctx.authDataStore.edit { prefs ->
            prefs.remove(Keys.ACCESS)
            prefs.remove(Keys.REFRESH)
        }
    }

    /** 挂起获取当前 access。 */
    suspend fun access(): String? = accessFlow.first()

    /** 挂起获取当前 refresh。 */
    suspend fun refresh(): String? = refreshFlow.first()

    /**
     * 阻塞获取 access —— 只允许在 OkHttp Interceptor 内使用（那里没法直接 suspend）。
     * 借助 runBlocking，但拉取本地 DataStore 是极快的操作，可以接受。
     */
    fun accessBlocking(): String? = kotlinx.coroutines.runBlocking { access() }
}
