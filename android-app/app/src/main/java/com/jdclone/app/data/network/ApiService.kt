package com.jdclone.app.data.network

import com.jdclone.app.data.network.dto.AddressCreateRequest
import com.jdclone.app.data.network.dto.AddressDto
import com.jdclone.app.data.network.dto.AddressUpdateRequest
import com.jdclone.app.data.network.dto.AftersalesAppealRequest
import com.jdclone.app.data.network.dto.AftersalesCancelRequest
import com.jdclone.app.data.network.dto.AftersalesCreateRequest
import com.jdclone.app.data.network.dto.AftersalesDetailDto
import com.jdclone.app.data.network.dto.AftersalesEvidenceAddRequest
import com.jdclone.app.data.network.dto.AftersalesListItemDto
import com.jdclone.app.data.network.dto.AftersalesNudgeResultDto
import com.jdclone.app.data.network.dto.AftersalesSubmitTrackingRequest
import com.jdclone.app.data.network.dto.AuthTokensDto
import com.jdclone.app.data.network.dto.BrandDto
import com.jdclone.app.data.network.dto.CartAddRequest
import com.jdclone.app.data.network.dto.CartBatchDeleteRequest
import com.jdclone.app.data.network.dto.CartItemDto
import com.jdclone.app.data.network.dto.CartResponseDto
import com.jdclone.app.data.network.dto.CartSelectAllRequest
import com.jdclone.app.data.network.dto.CartUpdateRequest
import com.jdclone.app.data.network.dto.CategoryDto
import com.jdclone.app.data.network.dto.ChangePasswordRequest
import com.jdclone.app.data.network.dto.ForgotPasswordRequest
import com.jdclone.app.data.network.dto.LoginRequest
import com.jdclone.app.data.network.dto.LogoutRequest
import com.jdclone.app.data.network.dto.NotificationDto
import com.jdclone.app.data.network.dto.NotificationListDto
import com.jdclone.app.data.network.dto.OrderCancelRequest
import com.jdclone.app.data.network.dto.OrderCreateRequest
import com.jdclone.app.data.network.dto.OrderCreateResponse
import com.jdclone.app.data.network.dto.OrderDetailDto
import com.jdclone.app.data.network.dto.OrderListItemDto
import com.jdclone.app.data.network.dto.OrderPreviewDto
import com.jdclone.app.data.network.dto.OrderPreviewRequest
import com.jdclone.app.data.network.PageData
import com.jdclone.app.data.network.dto.PayCreateRequest
import com.jdclone.app.data.network.dto.PaymentAmountOnlyDto
import com.jdclone.app.data.network.dto.PaymentSessionDto
import com.jdclone.app.data.network.dto.RefreshRequest
import com.jdclone.app.data.network.dto.RegionDto
import com.jdclone.app.data.network.dto.RegisterRequest
import com.jdclone.app.data.network.dto.ResetPasswordRequest
import com.jdclone.app.data.network.dto.ShipmentInfoDto
import com.jdclone.app.data.network.dto.ShopPublicDto
import com.jdclone.app.data.network.dto.SpuDetailDto
import com.jdclone.app.data.network.dto.SpuListItemDto
import com.jdclone.app.data.network.dto.TokenPairDto
import com.jdclone.app.data.network.dto.UnreadCountDto
import com.jdclone.app.data.network.dto.UpdateProfileRequest
import com.jdclone.app.data.network.dto.UserMeDto
import kotlinx.serialization.json.JsonObject
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Retrofit 接口 —— 覆盖 Phase 1-5 全部 user 面 endpoints，
 * 加上 catalog 与 regions 的公开接口。
 *
 * 全部响应包一层 [ApiEnvelope]；Repository 层用 [unwrap] / [unwrapOptional] 解包。
 */
interface ApiService {

    // ─── Auth ────────────────────────────────────────────────────────────────
    @POST("user/auth/register")
    suspend fun register(@Body body: RegisterRequest): ApiEnvelope<AuthTokensDto>

    @POST("user/auth/login")
    suspend fun login(@Body body: LoginRequest): ApiEnvelope<AuthTokensDto>

    @POST("user/auth/refresh")
    suspend fun refresh(@Body body: RefreshRequest): ApiEnvelope<TokenPairDto>

    @POST("user/auth/logout")
    suspend fun logout(@Body body: LogoutRequest = LogoutRequest()): ApiEnvelope<JsonObject?>

    @POST("user/auth/forgot-password")
    suspend fun forgotPassword(@Body body: ForgotPasswordRequest): ApiEnvelope<JsonObject?>

    @POST("user/auth/reset-password")
    suspend fun resetPassword(@Body body: ResetPasswordRequest): ApiEnvelope<JsonObject?>

    // ─── Profile ─────────────────────────────────────────────────────────────
    @GET("user/me")
    suspend fun getMe(): ApiEnvelope<UserMeDto>

    @PATCH("user/me")
    suspend fun updateMe(@Body body: UpdateProfileRequest): ApiEnvelope<UserMeDto>

    @POST("user/me/change-password")
    suspend fun changePassword(@Body body: ChangePasswordRequest): ApiEnvelope<JsonObject?>

    // ─── Catalog ─────────────────────────────────────────────────────────────
    @GET("catalog/categories")
    suspend fun listCategories(
        @Query("visible") visible: Boolean = true,
    ): ApiEnvelope<List<CategoryDto>>

    @GET("catalog/brands")
    suspend fun listBrands(
        @Query("visible") visible: Boolean = true,
        @Query("keyword") keyword: String? = null,
        @Query("page") page: Int = 1,
        @Query("size") size: Int = 20,
    ): ApiEnvelope<PageData<BrandDto>>

    @GET("catalog/spus")
    suspend fun listSpus(
        @Query("category_id") categoryId: Long? = null,
        @Query("brand_id") brandId: Long? = null,
        @Query("keyword") keyword: String? = null,
        @Query("min_price_cents") minPriceCents: Int? = null,
        @Query("max_price_cents") maxPriceCents: Int? = null,
        @Query("sort") sort: String = "default",
        @Query("page") page: Int = 1,
        @Query("size") size: Int = 20,
    ): ApiEnvelope<PageData<SpuListItemDto>>

    @GET("catalog/spus/{id}")
    suspend fun getSpuDetail(@Path("id") id: Long): ApiEnvelope<SpuDetailDto>

    @GET("catalog/spus/{id}/related")
    suspend fun getRelatedSpus(
        @Path("id") id: Long,
        @Query("limit") limit: Int = 8,
    ): ApiEnvelope<List<SpuListItemDto>>

    @GET("catalog/recommendations")
    suspend fun getRecommendations(
        @Query("limit") limit: Int = 10,
    ): ApiEnvelope<List<SpuListItemDto>>

    @GET("catalog/shops/{id}")
    suspend fun getShop(@Path("id") id: Long): ApiEnvelope<ShopPublicDto>

    @GET("catalog/shops/{id}/spus")
    suspend fun listShopSpus(
        @Path("id") id: Long,
        @Query("category_id") categoryId: Long? = null,
        @Query("sort") sort: String = "default",
        @Query("page") page: Int = 1,
        @Query("size") size: Int = 20,
    ): ApiEnvelope<PageData<SpuListItemDto>>

    // ─── Regions ─────────────────────────────────────────────────────────────
    @GET("regions/tree")
    suspend fun getRegionTree(): ApiEnvelope<List<RegionDto>>

    @GET("regions/children")
    suspend fun listTopRegions(): ApiEnvelope<List<RegionDto>>

    @GET("regions/children/{parentCode}")
    suspend fun listRegionChildren(
        @Path("parentCode") parentCode: String,
    ): ApiEnvelope<List<RegionDto>>

    // ─── Cart ────────────────────────────────────────────────────────────────
    @GET("user/cart")
    suspend fun getCart(): ApiEnvelope<CartResponseDto>

    @POST("user/cart/items")
    suspend fun addToCart(@Body body: CartAddRequest): ApiEnvelope<CartItemDto>

    @PATCH("user/cart/items/{itemId}")
    suspend fun updateCartItem(
        @Path("itemId") itemId: Long,
        @Body body: CartUpdateRequest,
    ): ApiEnvelope<CartItemDto>

    @DELETE("user/cart/items/{itemId}")
    suspend fun deleteCartItem(@Path("itemId") itemId: Long): ApiEnvelope<JsonObject?>

    @POST("user/cart/items/batch-delete")
    suspend fun batchDeleteCart(@Body body: CartBatchDeleteRequest): ApiEnvelope<JsonObject?>

    @POST("user/cart/select-all")
    suspend fun selectAllCart(@Body body: CartSelectAllRequest): ApiEnvelope<CartResponseDto>

    @DELETE("user/cart/invalid")
    suspend fun clearInvalidCart(): ApiEnvelope<JsonObject?>

    // ─── Addresses ───────────────────────────────────────────────────────────
    @GET("user/addresses")
    suspend fun listAddresses(): ApiEnvelope<List<AddressDto>>

    @GET("user/addresses/{id}")
    suspend fun getAddress(@Path("id") id: Long): ApiEnvelope<AddressDto>

    @POST("user/addresses")
    suspend fun createAddress(@Body body: AddressCreateRequest): ApiEnvelope<AddressDto>

    @PATCH("user/addresses/{id}")
    suspend fun updateAddress(
        @Path("id") id: Long,
        @Body body: AddressUpdateRequest,
    ): ApiEnvelope<AddressDto>

    @DELETE("user/addresses/{id}")
    suspend fun deleteAddress(@Path("id") id: Long): ApiEnvelope<JsonObject?>

    @POST("user/addresses/{id}/set-default")
    suspend fun setDefaultAddress(@Path("id") id: Long): ApiEnvelope<AddressDto>

    // ─── Orders ──────────────────────────────────────────────────────────────
    @POST("user/orders/preview")
    suspend fun previewOrder(@Body body: OrderPreviewRequest): ApiEnvelope<OrderPreviewDto>

    @POST("user/orders")
    suspend fun createOrder(
        @Body body: OrderCreateRequest,
        @Header("Idempotency-Key") idempotencyKey: String,
    ): ApiEnvelope<OrderCreateResponse>

    @GET("user/orders")
    suspend fun listOrders(
        @Query("status") status: String? = null,
        @Query("keyword") keyword: String? = null,
        @Query("page") page: Int = 1,
        @Query("size") size: Int = 20,
    ): ApiEnvelope<PageData<OrderListItemDto>>

    @GET("user/orders/{orderId}")
    suspend fun getOrder(@Path("orderId") orderId: Long): ApiEnvelope<OrderDetailDto>

    @POST("user/orders/{orderId}/cancel")
    suspend fun cancelOrder(
        @Path("orderId") orderId: Long,
        @Body body: OrderCancelRequest,
    ): ApiEnvelope<OrderDetailDto>

    @POST("user/orders/{orderId}/confirm-receipt")
    suspend fun confirmReceipt(@Path("orderId") orderId: Long): ApiEnvelope<OrderDetailDto>

    @GET("user/orders/{orderId}/shipment")
    suspend fun getShipment(@Path("orderId") orderId: Long): ApiEnvelope<ShipmentInfoDto>

    // ─── Payments ────────────────────────────────────────────────────────────
    @POST("user/orders/{orderId}/pay")
    suspend fun createPaymentSession(
        @Path("orderId") orderId: Long,
        @Body body: PayCreateRequest,
        @Header("Idempotency-Key") idempotencyKey: String,
    ): ApiEnvelope<PaymentSessionDto>

    @POST("user/payment-sessions/{sessionId}/mock-succeed")
    suspend fun mockPaySucceed(
        @Path("sessionId") sessionId: Long,
    ): ApiEnvelope<PaymentAmountOnlyDto>

    @POST("user/payment-sessions/{sessionId}/mock-fail")
    suspend fun mockPayFail(
        @Path("sessionId") sessionId: Long,
    ): ApiEnvelope<PaymentAmountOnlyDto>

    @GET("user/payment-sessions/{sessionId}")
    suspend fun getPaymentSession(
        @Path("sessionId") sessionId: Long,
    ): ApiEnvelope<PaymentSessionDto>

    // ─── Aftersales ──────────────────────────────────────────────────────────
    @POST("user/orders/{orderId}/aftersales")
    suspend fun createAftersales(
        @Path("orderId") orderId: Long,
        @Body body: AftersalesCreateRequest,
        @Header("Idempotency-Key") idempotencyKey: String,
    ): ApiEnvelope<AftersalesDetailDto>

    @GET("user/aftersales")
    suspend fun listAftersales(
        @Query("status") status: String? = null,
        @Query("type") type: String? = null,
        @Query("keyword") keyword: String? = null,
        @Query("page") page: Int = 1,
        @Query("size") size: Int = 20,
    ): ApiEnvelope<PageData<AftersalesListItemDto>>

    @GET("user/aftersales/{id}")
    suspend fun getAftersales(@Path("id") id: Long): ApiEnvelope<AftersalesDetailDto>

    @POST("user/aftersales/{id}/cancel")
    suspend fun cancelAftersales(
        @Path("id") id: Long,
        @Body body: AftersalesCancelRequest,
    ): ApiEnvelope<AftersalesDetailDto>

    @POST("user/aftersales/{id}/submit-tracking")
    suspend fun submitTracking(
        @Path("id") id: Long,
        @Body body: AftersalesSubmitTrackingRequest,
    ): ApiEnvelope<AftersalesDetailDto>

    @POST("user/aftersales/{id}/confirm-exchange")
    suspend fun confirmExchange(@Path("id") id: Long): ApiEnvelope<AftersalesDetailDto>

    @POST("user/aftersales/{id}/nudge")
    suspend fun nudgeAftersales(
        @Path("id") id: Long,
    ): ApiEnvelope<AftersalesNudgeResultDto>

    @POST("user/aftersales/{id}/appeal")
    suspend fun appealAftersales(
        @Path("id") id: Long,
        @Body body: AftersalesAppealRequest,
    ): ApiEnvelope<AftersalesDetailDto>

    @POST("user/aftersales/{id}/evidences")
    suspend fun addAftersalesEvidence(
        @Path("id") id: Long,
        @Body body: AftersalesEvidenceAddRequest,
    ): ApiEnvelope<AftersalesDetailDto>

    // ─── Notifications ───────────────────────────────────────────────────────
    @GET("user/notifications")
    suspend fun listNotifications(
        @Query("is_read") isRead: Boolean? = null,
        @Query("category") category: String? = null,
        @Query("page") page: Int = 1,
        @Query("size") size: Int = 20,
    ): ApiEnvelope<NotificationListDto>

    @GET("user/notifications/unread-count")
    suspend fun unreadCount(): ApiEnvelope<UnreadCountDto>

    @POST("user/notifications/{id}/read")
    suspend fun markNotificationRead(@Path("id") id: Long): ApiEnvelope<NotificationDto>

    @POST("user/notifications/read-all")
    suspend fun markAllNotificationsRead(): ApiEnvelope<JsonObject?>

    @DELETE("user/notifications/{id}")
    suspend fun deleteNotification(@Path("id") id: Long): ApiEnvelope<JsonObject?>

    @DELETE("user/notifications/read")
    suspend fun deleteReadNotifications(): ApiEnvelope<JsonObject?>
}
