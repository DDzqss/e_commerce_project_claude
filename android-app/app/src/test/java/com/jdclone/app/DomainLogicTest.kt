package com.jdclone.app

import com.jdclone.app.ui.common.formatYuan
import com.jdclone.app.ui.common.maskEmail
import com.jdclone.app.ui.common.maskPhone
import com.jdclone.app.ui.screen.aftersales.AftersalesType
import com.jdclone.app.ui.screen.aftersales.aftersalesStatusLabel
import com.jdclone.app.ui.screen.aftersales.allowedAftersalesTypes
import com.jdclone.app.ui.screen.orders.orderStatusLabel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * 纯函数快照测试 —— 覆盖分转元、脱敏、售后类型联动、状态文案等核心逻辑。
 */
class DomainLogicTest {

    @Test
    fun `formatYuan formats cents into RMB with two decimals`() {
        assertEquals("¥99.00", formatYuan(9900))
        assertEquals("¥0.05", formatYuan(5))
        assertEquals("¥1234.56", formatYuan(123456))
    }

    @Test
    fun `maskPhone masks middle four digits`() {
        assertEquals("138****1234", maskPhone("13800001234"))
        assertEquals("", maskPhone(null))
    }

    @Test
    fun `maskEmail hides local part except first char`() {
        assertEquals("j***@example.com", maskEmail("john@example.com"))
    }

    @Test
    fun `allowedAftersalesTypes for paid only allows refund_only`() {
        val types = allowedAftersalesTypes("paid")
        assertEquals(listOf(AftersalesType.REFUND_ONLY), types)
    }

    @Test
    fun `allowedAftersalesTypes for shipped allows all three types`() {
        val types = allowedAftersalesTypes("shipped")
        assertEquals(3, types.size)
        assertTrue(types.contains(AftersalesType.REFUND_ONLY))
        assertTrue(types.contains(AftersalesType.RETURN_REFUND))
        assertTrue(types.contains(AftersalesType.EXCHANGE))
    }

    @Test
    fun `allowedAftersalesTypes for completed excludes refund_only`() {
        val types = allowedAftersalesTypes("completed")
        assertFalse(types.contains(AftersalesType.REFUND_ONLY))
    }

    @Test
    fun `allowedAftersalesTypes for cancelled is empty`() {
        assertTrue(allowedAftersalesTypes("cancelled").isEmpty())
    }

    @Test
    fun `orderStatusLabel returns Chinese label`() {
        assertEquals("待付款", orderStatusLabel("pending_payment"))
        assertEquals("已完成", orderStatusLabel("completed"))
        assertEquals("已取消", orderStatusLabel("cancelled"))
    }

    @Test
    fun `aftersalesStatusLabel returns Chinese label`() {
        assertEquals("等待商家审核", aftersalesStatusLabel("pending_merchant_review"))
        assertEquals("退款完成", aftersalesStatusLabel("completed_refunded"))
        assertEquals("平台仲裁中", aftersalesStatusLabel("admin_arbitrating"))
    }
}
