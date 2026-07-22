package com.jdclone.app.data.network.models

import kotlinx.serialization.Serializable

/**
 * Response payload for the backend health probe.
 */
@Serializable
data class HealthResponse(
    val status: String,
    val version: String? = null,
)
