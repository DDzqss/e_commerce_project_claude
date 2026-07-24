package com.jdclone.app

import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import com.jdclone.app.data.network.ApiService
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import retrofit2.Retrofit

/**
 * 测试用的 [ApiService] —— 借 Retrofit 生成代理实例，但仅用于满足构造参数；
 * 实际测试中通过 open 的 Repository 方法覆写来拦截调用，此 stub 不会真正被访问。
 */
fun stubApiService(): ApiService {
    val json = Json { ignoreUnknownKeys = true }
    val retrofit = Retrofit.Builder()
        .baseUrl("http://localhost/")
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()
    return retrofit.create(ApiService::class.java)
}
