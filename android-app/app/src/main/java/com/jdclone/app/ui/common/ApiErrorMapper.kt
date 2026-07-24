package com.jdclone.app.ui.common

import com.jdclone.app.data.network.ApiException
import java.io.IOException

/**
 * 错误码 → 中文文案映射（参考架构文档 §8）。
 */
private val ErrorCodeMessages: Map<Int, String> = mapOf(
    // Auth (1xxx)
    1001 to "请先登录",
    1002 to "登录已过期",
    1003 to "账号或密码错误",
    1004 to "账号已被禁用",
    1005 to "刷新凭证已失效，请重新登录",
    1010 to "验证码错误或已过期",
    1020 to "权限不足",
    // 用户资料 (2xxx)
    2001 to "用户不存在",
    2002 to "该手机号已被注册",
    2003 to "该邮箱已被注册",
    2010 to "原密码不正确",
    // 商品 (7xxx / 8xxx)
    7001 to "商品不存在",
    7003 to "商品状态不允许此操作",
    7005 to "商品已下架",
    8001 to "SKU 不存在",
    8003 to "库存不足",
    // Address (11xxx)
    11001 to "地址不存在",
    11002 to "无权访问此地址",
    // Cart (12xxx)
    12001 to "购物车项不存在",
    12002 to "商品已下架",
    12003 to "数量超过库存",
    12004 to "数量超过上限",
    // Order (13xxx)
    13001 to "订单不存在",
    13002 to "无权访问此订单",
    13003 to "订单当前状态不允许此操作",
    13004 to "库存不足下单失败",
    13005 to "购物车为空",
    13006 to "未选中任何商品",
    13007 to "收货地址无效",
    13008 to "订单已过支付截止时间",
    13009 to "重复提交订单，请稍后再试",
    13010 to "快递单号格式无效",
    // Payment (14xxx)
    14001 to "支付会话不存在",
    14002 to "该支付已完成或已失败，不可重试",
    14003 to "不支持的支付渠道",
    14004 to "支付失败",
    // Aftersales (15xxx)
    15001 to "售后单不存在",
    15002 to "无权访问此售后单",
    15003 to "售后状态不允许当前操作",
    15004 to "订单不允许发起此类型售后",
    15005 to "该订单已有进行中的售后单",
    15006 to "退款金额超过订单可退金额",
    15007 to "售后类型与订单状态不匹配",
    15008 to "请至少选择一件商品",
    15009 to "售后单已进入平台仲裁，不可撤销",
    // Aftersales 凭证 & 物流 (16/17)
    16001 to "凭证数量超上限（8 张）",
    17001 to "快递单号无效",
    17002 to "尚未同意退货，暂不可回填",
    17003 to "已回填过物流，不可再回填",
    // Notification (22xxx)
    22001 to "通知不存在",
    22002 to "无权访问",
    // Region (23xxx)
    23001 to "地区码无效",
    23002 to "地区不匹配",
    // 通用
    5001 to "参数校验失败",
    5002 to "资源不存在",
    5003 to "请求过频，请稍候再试",
    9000 to "服务器开小差了，请稍后再试",
)

fun errorMessage(t: Throwable): String = when (t) {
    is ApiException -> ErrorCodeMessages[t.code] ?: t.displayMessage.ifBlank { "未知错误" }
    is IOException -> "网络异常，请检查连接"
    else -> t.message ?: "未知错误"
}
