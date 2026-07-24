package com.jdclone.app.ui.common

import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private val fmtDateTime = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm", Locale.CHINA)
private val fmtDate = DateTimeFormatter.ofPattern("yyyy-MM-dd", Locale.CHINA)

/**
 * 尽力把后端返回的 ISO-8601 时间串（带/不带时区）格式化为本地展示串。
 * 失败时返回原文。
 */
fun formatDateTime(raw: String?): String {
    if (raw.isNullOrBlank()) return ""
    return try {
        val instant = Instant.parse(raw)
        LocalDateTime.ofInstant(instant, ZoneId.systemDefault()).format(fmtDateTime)
    } catch (e: Throwable) {
        try {
            LocalDateTime.parse(raw).format(fmtDateTime)
        } catch (_: Throwable) {
            raw
        }
    }
}

fun formatDate(raw: String?): String {
    if (raw.isNullOrBlank()) return ""
    return try {
        val instant = Instant.parse(raw)
        LocalDateTime.ofInstant(instant, ZoneId.systemDefault()).format(fmtDate)
    } catch (e: Throwable) {
        raw
    }
}
