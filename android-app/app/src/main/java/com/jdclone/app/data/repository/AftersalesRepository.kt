package com.jdclone.app.data.repository

import com.jdclone.app.data.network.ApiService
import com.jdclone.app.data.network.dto.AftersalesAppealRequest
import com.jdclone.app.data.network.dto.AftersalesCancelRequest
import com.jdclone.app.data.network.dto.AftersalesCreateRequest
import com.jdclone.app.data.network.dto.AftersalesDetailDto
import com.jdclone.app.data.network.dto.AftersalesEvidenceAddRequest
import com.jdclone.app.data.network.dto.AftersalesItemRequest
import com.jdclone.app.data.network.dto.AftersalesListItemDto
import com.jdclone.app.data.network.dto.AftersalesNudgeResultDto
import com.jdclone.app.data.network.dto.AftersalesSubmitTrackingRequest
import com.jdclone.app.data.network.PageData
import com.jdclone.app.data.network.unwrap
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
open class AftersalesRepository @Inject constructor(private val api: ApiService) {

    open suspend fun create(
        orderId: Long,
        type: String,
        reasonCategory: String,
        reasonNote: String,
        items: List<AftersalesItemRequest>,
        refundAmountCents: Int,
        evidenceKeys: List<String> = emptyList(),
        idempotencyKey: String = UUID.randomUUID().toString(),
    ): Result<AftersalesDetailDto> = safeIo {
        api.createAftersales(
            orderId = orderId,
            body = AftersalesCreateRequest(
                type = type,
                reasonCategory = reasonCategory,
                reasonNote = reasonNote,
                items = items,
                refundAmountCents = refundAmountCents,
                evidenceImageKeys = evidenceKeys,
            ),
            idempotencyKey = idempotencyKey,
        ).unwrap()
    }

    open suspend fun list(
        status: String? = null,
        type: String? = null,
        page: Int = 1,
        size: Int = 20,
    ): Result<PageData<AftersalesListItemDto>> = safeIo {
        api.listAftersales(status = status, type = type, page = page, size = size).unwrap()
    }

    open suspend fun get(id: Long): Result<AftersalesDetailDto> = safeIo {
        api.getAftersales(id).unwrap()
    }

    open suspend fun cancel(id: Long, note: String? = null): Result<AftersalesDetailDto> = safeIo {
        api.cancelAftersales(id, AftersalesCancelRequest(note)).unwrap()
    }

    open suspend fun submitTracking(
        id: Long,
        carrier: String,
        trackingNo: String,
    ): Result<AftersalesDetailDto> = safeIo {
        api.submitTracking(id, AftersalesSubmitTrackingRequest(carrier, trackingNo)).unwrap()
    }

    open suspend fun confirmExchange(id: Long): Result<AftersalesDetailDto> = safeIo {
        api.confirmExchange(id).unwrap()
    }

    open suspend fun nudge(id: Long): Result<AftersalesNudgeResultDto> = safeIo {
        api.nudgeAftersales(id).unwrap()
    }

    open suspend fun appeal(
        id: Long,
        reason: String,
        evidenceKeys: List<String> = emptyList(),
    ): Result<AftersalesDetailDto> = safeIo {
        api.appealAftersales(id, AftersalesAppealRequest(reason, evidenceKeys)).unwrap()
    }

    open suspend fun addEvidence(
        id: Long,
        stage: String,
        imageKey: String,
        note: String? = null,
    ): Result<AftersalesDetailDto> = safeIo {
        api.addAftersalesEvidence(id, AftersalesEvidenceAddRequest(stage, imageKey, note)).unwrap()
    }
}
