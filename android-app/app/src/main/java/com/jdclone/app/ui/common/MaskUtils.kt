package com.jdclone.app.ui.common

import java.util.Locale

/** 手机号中间 4 位打星。少于 7 位直接返回原文。 */
fun maskPhone(phone: String?): String {
    if (phone.isNullOrBlank() || phone.length < 7) return phone.orEmpty()
    val head = phone.take(3)
    val tail = phone.takeLast(4)
    val stars = "*".repeat(phone.length - head.length - tail.length)
    return "$head$stars$tail"
}

/** 邮箱脱敏：前 1 位 + *** + 域名。 */
fun maskEmail(email: String?): String {
    if (email.isNullOrBlank() || "@" !in email) return email.orEmpty()
    val (local, domain) = email.split("@", limit = 2)
    val head = local.take(1)
    return String.format(Locale.CHINA, "%s***@%s", head, domain)
}

/** 展示态用户 identifier —— 优先手机脱敏，否则邮箱脱敏，否则 nickname。 */
fun displayIdentifier(
    phone: String?,
    email: String?,
    fallback: String = "",
): String = when {
    !phone.isNullOrBlank() -> maskPhone(phone)
    !email.isNullOrBlank() -> maskEmail(email)
    else -> fallback
}
