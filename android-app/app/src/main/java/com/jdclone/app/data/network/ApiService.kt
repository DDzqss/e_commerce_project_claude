package com.jdclone.app.data.network

import com.jdclone.app.data.network.models.HealthResponse
import retrofit2.http.GET

/**
 * Placeholder Retrofit interface for the JD Clone backend.
 *
 * Real domain endpoints (auth, products, cart, orders …) will be added
 * incrementally in the corresponding `feature/android-*` branches.
 */
interface ApiService {

    @GET("health")
    suspend fun health(): HealthResponse
}
