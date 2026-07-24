package com.jdclone.app.data.repository

import com.jdclone.app.data.network.ApiService
import com.jdclone.app.data.network.dto.PayCreateRequest
import com.jdclone.app.data.network.dto.PaymentAmountOnlyDto
import com.jdclone.app.data.network.dto.PaymentSessionDto
import com.jdclone.app.data.network.unwrap
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PaymentRepository @Inject constructor(private val api: ApiService) {

    suspend fun createSession(
        orderId: Long,
        channel: String,
        idempotencyKey: String = UUID.randomUUID().toString(),
    ): Result<PaymentSessionDto> = safeIo {
        api.createPaymentSession(orderId, PayCreateRequest(channel), idempotencyKey).unwrap()
    }

    suspend fun mockSucceed(sessionId: Long): Result<PaymentAmountOnlyDto> = safeIo {
        api.mockPaySucceed(sessionId).unwrap()
    }

    suspend fun mockFail(sessionId: Long): Result<PaymentAmountOnlyDto> = safeIo {
        api.mockPayFail(sessionId).unwrap()
    }

    suspend fun getSession(sessionId: Long): Result<PaymentSessionDto> = safeIo {
        api.getPaymentSession(sessionId).unwrap()
    }
}
