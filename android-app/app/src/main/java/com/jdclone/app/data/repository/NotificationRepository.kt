package com.jdclone.app.data.repository

import com.jdclone.app.data.network.ApiService
import com.jdclone.app.data.network.dto.NotificationDto
import com.jdclone.app.data.network.dto.NotificationListDto
import com.jdclone.app.data.network.unwrap
import com.jdclone.app.data.network.unwrapOptional
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class NotificationRepository @Inject constructor(private val api: ApiService) {

    suspend fun list(
        isRead: Boolean? = null,
        category: String? = null,
        page: Int = 1,
        size: Int = 20,
    ): Result<NotificationListDto> = safeIo {
        api.listNotifications(isRead = isRead, category = category, page = page, size = size)
            .unwrap()
    }

    suspend fun unreadCount(): Result<Int> = safeIo {
        api.unreadCount().unwrap().count
    }

    suspend fun markRead(id: Long): Result<NotificationDto> = safeIo {
        api.markNotificationRead(id).unwrap()
    }

    suspend fun markAllRead(): Result<Unit> = safeIo {
        api.markAllNotificationsRead().unwrapOptional()
        Unit
    }

    suspend fun delete(id: Long): Result<Unit> = safeIo {
        api.deleteNotification(id).unwrapOptional()
        Unit
    }

    suspend fun deleteRead(): Result<Unit> = safeIo {
        api.deleteReadNotifications().unwrapOptional()
        Unit
    }
}
