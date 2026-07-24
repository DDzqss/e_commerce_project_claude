package com.jdclone.app.ui.navigation

/**
 * 路由常量集合 —— 与 `docs/API/phase-6-android-architecture.md §6` 保持一致。
 */
object NavRoutes {
    // Auth
    const val LOGIN = "auth/login"
    const val REGISTER = "auth/register"
    const val FORGOT_PASSWORD = "auth/forgot"
    const val RESET_PASSWORD = "auth/reset"

    // Main tabs (bottom nav)
    const val HOME = "main/home"
    const val CATEGORY = "main/category"
    const val CART = "main/cart"
    const val PROFILE = "main/profile"

    // Catalog
    const val SEARCH = "catalog/search"
    const val PRODUCT_DETAIL = "catalog/product/{id}"
    fun productDetail(id: Long): String = "catalog/product/$id"
    const val CATEGORY_LIST = "catalog/category/{id}"
    fun categoryList(id: Long): String = "catalog/category/$id"

    // Shop
    const val SHOP_DETAIL = "shops/{id}"
    fun shopDetail(id: Long): String = "shops/$id"

    // Checkout
    const val CHECKOUT = "checkout"
    const val MOCK_PAYMENT = "checkout/pay/{sessionId}?orderId={orderId}"
    fun mockPayment(sessionId: Long, orderId: Long): String =
        "checkout/pay/$sessionId?orderId=$orderId"

    // Orders
    const val ORDER_LIST = "orders"
    const val ORDER_DETAIL = "orders/{orderId}"
    fun orderDetail(orderId: Long): String = "orders/$orderId"

    // Aftersales
    const val AFTERSALES_APPLY = "aftersales/apply/{orderId}"
    fun aftersalesApply(orderId: Long): String = "aftersales/apply/$orderId"
    const val AFTERSALES_LIST = "aftersales"
    const val AFTERSALES_DETAIL = "aftersales/{id}"
    fun aftersalesDetail(id: Long): String = "aftersales/$id"

    // Addresses
    const val ADDRESS_LIST = "addresses"
    const val ADDRESS_EDIT = "addresses/edit?id={id}"
    fun addressEdit(id: Long? = null): String = "addresses/edit?id=${id ?: 0}"

    // Notifications
    const val NOTIFICATIONS = "notifications"

    // Change password
    const val CHANGE_PASSWORD = "profile/change-password"
}
