# Phase 6 Android 客户端架构

> Android App 侧的架构与约定文档。**API 契约**沿用 Phase 1-5 的后端契约（`docs/API/phase-*-contracts.md`）。
>
> 版本：v1.0 · 生效范围：Phase 6

---

## 目录
1. [目标与范围](#1-目标与范围)
2. [技术栈](#2-技术栈)
3. [分层架构](#3-分层架构)
4. [模块划分](#4-模块划分)
5. [网络层与会话管理](#5-网络层与会话管理)
6. [导航结构](#6-导航结构)
7. [状态管理约定](#7-状态管理约定)
8. [错误处理与错误码映射](#8-错误处理与错误码映射)
9. [图片与占位策略](#9-图片与占位策略)
10. [Phase 6 交付清单](#10-phase-6-交付清单)
11. [Phase 6 明确不做](#11-phase-6-明确不做)

---

## 1. 目标与范围

Phase 6 交付一个可在 Android 模拟器/真机上跑起来的消费者端 App，覆盖：
- 认证（登录 / 注册 / 忘记密码）
- 商品浏览（首页 / 类目 / 搜索 / 详情 + SKU 选择）
- 购物车 + 结算 + 模拟支付
- 订单管理（列表 / 详情 / 取消 / 确认收货 / 时间线）
- 售后（申请 / 列表 / 详情 / 寄回单号回填）
- 地址簿 + 通知（简化）

**BASE_URL**：`http://10.0.2.2:8000/api/v1/`（模拟器指向宿主机 backend）
真机开发时需改 `BuildConfig.BASE_URL` 或用 adb reverse。

---

## 2. 技术栈（沿用 Phase 0 skeleton）

- Kotlin 2.0.21 · AGP 8.7.2 · KSP
- Compose BOM 2024.12.01 · Material 3
- Navigation Compose 2.8.5
- Hilt 2.53（+ hilt-navigation-compose 1.2.0）
- Retrofit 2.11 · OkHttp 4.12 · Kotlinx Serialization 1.7.3
- Coil 3.0.4（图片）
- DataStore Preferences 1.1.1（Token 持久化）
- Kotlin Coroutines 1.9.0 · Flow

**版本目录**在 `gradle/libs.versions.toml`；所有依赖引用 `libs.xxx`。

---

## 3. 分层架构

```
┌─────────────────────────────────────────┐
│  UI 层 (Composables + ViewModel)         │  Feature package: auth/, catalog/, cart/,
│  - StateFlow<UiState<T>>                 │  checkout/, orders/, aftersales/,
│  - eventFlow: SharedFlow<UiEvent>        │  addresses/, notifications/, profile/
├─────────────────────────────────────────┤
│  Domain 层 (models + repository iface)   │  data class + sealed interface；
│  - com.jdclone.app.domain.model.*        │  ViewModel 只依赖 domain
│  - com.jdclone.app.domain.repo.*         │
├─────────────────────────────────────────┤
│  Data 层 (repository impl + api + local) │
│  - Retrofit ApiService                   │
│  - DataStore preferences                 │
│  - Coil ImageLoader                      │
└─────────────────────────────────────────┘
       ↓ Hilt @Inject
```

- **ViewModel** 里 `viewModelScope.launch { repository.xxx() }`；不直接调 Retrofit
- **Repository** 里 `withContext(Dispatchers.IO)` 保护网络 / 磁盘 IO
- **UiState** 三态：`Loading | Success<T> | Error(msg, code?)`（sealed interface）
- **UiEvent** 单向：`Navigate(route) | ShowSnackbar(msg) | Toast(msg)` etc.

---

## 4. 模块划分

单模块（`app/`）+ 按 feature 分包：

```
com.jdclone.app/
├─ JDCloneApplication.kt            (@HiltAndroidApp)
├─ MainActivity.kt                  (@AndroidEntryPoint)
├─ data/
│  ├─ network/
│  │  ├─ ApiService.kt              (所有 Retrofit endpoint 定义)
│  │  ├─ NetworkModule.kt           (@Module @InstallIn(SingletonComponent))
│  │  ├─ AuthInterceptor.kt         (Bearer + 401→refresh chain)
│  │  ├─ ApiEnvelope.kt             ({code, message, data} 包装 + unwrap)
│  │  └─ dto/                       (@Serializable data class 请求响应)
│  ├─ local/
│  │  ├─ AuthTokenManager.kt        (DataStore, access + refresh token 持久化)
│  │  └─ SessionState.kt            (StateFlow<Session?>)
│  └─ repository/
│     ├─ AuthRepository.kt          (login/register/refresh/logout)
│     ├─ CatalogRepository.kt       (categories, spus, brands)
│     ├─ CartRepository.kt
│     ├─ OrderRepository.kt
│     ├─ PaymentRepository.kt
│     ├─ AftersalesRepository.kt
│     ├─ AddressRepository.kt
│     └─ NotificationRepository.kt
├─ domain/
│  └─ model/                        (User, SPU, SKU, CartItem, Order, ...)
├─ ui/
│  ├─ App.kt                        (Root: NavHost + Bottom nav 条件显示)
│  ├─ theme/                        (Color/Type/Theme)
│  ├─ common/                       (共享 composable + UiState)
│  │  ├─ UiState.kt
│  │  ├─ ApiErrorMapper.kt          (errorCode → 中文文案)
│  │  ├─ LoadingScreen.kt
│  │  ├─ ErrorScreen.kt
│  │  ├─ EmptyState.kt
│  │  ├─ Buttons.kt                 (Primary/Secondary/Danger)
│  │  ├─ PriceText.kt               (分转元)
│  │  ├─ RemoteImage.kt             (Coil wrapper + fallback)
│  │  └─ StarRating.kt
│  ├─ navigation/
│  │  ├─ NavRoutes.kt               (常量 route)
│  │  └─ AppNavGraph.kt             (NavHost composable)
│  └─ screen/
│     ├─ auth/
│     │  ├─ LoginScreen.kt / RegisterScreen.kt / ForgotPasswordScreen.kt / ResetPasswordScreen.kt
│     │  └─ AuthViewModel.kt
│     ├─ catalog/
│     │  ├─ HomeScreen.kt / CategoryScreen.kt / SearchScreen.kt / ProductDetailScreen.kt
│     │  └─ *ViewModel.kt
│     ├─ cart/
│     │  ├─ CartScreen.kt
│     │  └─ CartViewModel.kt
│     ├─ checkout/
│     │  ├─ CheckoutScreen.kt / MockPaymentScreen.kt
│     │  └─ *ViewModel.kt
│     ├─ orders/
│     │  ├─ OrderListScreen.kt / OrderDetailScreen.kt
│     │  └─ *ViewModel.kt
│     ├─ aftersales/
│     │  ├─ AftersalesApplyScreen.kt / AftersalesListScreen.kt / AftersalesDetailScreen.kt
│     │  └─ *ViewModel.kt
│     ├─ addresses/
│     │  ├─ AddressListScreen.kt / AddressEditScreen.kt
│     │  └─ AddressViewModel.kt
│     ├─ notifications/
│     │  ├─ NotificationListScreen.kt
│     │  └─ NotificationViewModel.kt
│     └─ profile/
│        ├─ ProfileScreen.kt
│        └─ ProfileViewModel.kt
```

---

## 5. 网络层与会话管理

### 5.1 AuthTokenManager

`data/local/AuthTokenManager.kt`：
```kotlin
@Singleton
class AuthTokenManager @Inject constructor(
    @ApplicationContext private val ctx: Context,
) {
    private val Context.dataStore by preferencesDataStore("auth")
    private val ACCESS = stringPreferencesKey("access_token")
    private val REFRESH = stringPreferencesKey("refresh_token")

    val accessFlow: Flow<String?> = ctx.dataStore.data.map { it[ACCESS] }
    val refreshFlow: Flow<String?> = ctx.dataStore.data.map { it[REFRESH] }

    suspend fun save(access: String, refresh: String) { ... }
    suspend fun clear() { ... }
    suspend fun access(): String? = accessFlow.first()
}
```

### 5.2 AuthInterceptor

`data/network/AuthInterceptor.kt`：
- 请求前：从 `AuthTokenManager` 拿 access（`runBlocking` 只在这一处允许），加 `Authorization: Bearer <access>`
- 响应后：若 401 且 code=1002 → 用 refresh 换新 access → 重放请求（单飞：`Mutex.withLock`）
- 若 refresh 也失败 → clear token + emit SessionState.LoggedOut 让 UI 自动跳登录

### 5.3 NetworkModule

`data/network/NetworkModule.kt` （Phase 0 已存在，本 phase 扩展）：
```kotlin
@Module @InstallIn(SingletonComponent::class)
object NetworkModule {
    @Provides @Singleton fun okHttp(auth: AuthInterceptor): OkHttpClient
    @Provides @Singleton fun retrofit(client: OkHttpClient, json: Json): Retrofit
    @Provides @Singleton fun apiService(retrofit: Retrofit): ApiService
    @Provides @Singleton fun json(): Json = Json { ignoreUnknownKeys = true; ... }
}
```

### 5.4 ApiEnvelope

后端所有响应 `{code, message, data}`。定义：
```kotlin
@Serializable data class ApiEnvelope<T>(val code: Int, val message: String, val data: T? = null)

// Extension
suspend fun <T> ApiEnvelope<T>.unwrap(): T =
    if (code == 0 && data != null) data else throw ApiException(code, message)

class ApiException(val code: Int, msg: String): Exception(msg)
```

Repository 层 catch `ApiException` 转成 `Result.Error(code, msg)`；ViewModel 转成 UiState.Error。

---

## 6. 导航结构

`ui/navigation/NavRoutes.kt`：
```kotlin
object Routes {
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
    fun productDetail(id: Long) = "catalog/product/$id"
    const val CATEGORY_LIST = "catalog/category/{id}"
    fun categoryList(id: Long) = "catalog/category/$id"

    // Checkout
    const val CHECKOUT = "checkout"
    const val MOCK_PAYMENT = "checkout/pay/{sessionId}"
    fun mockPayment(sessionId: Long) = "checkout/pay/$sessionId"

    // Orders
    const val ORDER_LIST = "orders"
    const val ORDER_DETAIL = "orders/{orderNo}"
    fun orderDetail(no: String) = "orders/$no"

    // Aftersales
    const val AFTERSALES_APPLY = "aftersales/apply/{orderNo}"
    fun aftersalesApply(no: String) = "aftersales/apply/$no"
    const val AFTERSALES_LIST = "aftersales"
    const val AFTERSALES_DETAIL = "aftersales/{id}"
    fun aftersalesDetail(id: Long) = "aftersales/$id"

    // Addresses
    const val ADDRESS_LIST = "addresses"
    const val ADDRESS_EDIT = "addresses/edit?id={id}"
    fun addressEdit(id: Long? = null) = "addresses/edit?id=${id ?: 0}"

    // Notifications
    const val NOTIFICATIONS = "notifications"
}
```

**顶层结构**：
- 未登录 → `Routes.LOGIN` 作为 startDestination
- 已登录 → Bottom-nav 4 tab（HOME / CATEGORY / CART / PROFILE），其他为深层路由
- 通过 `SessionState.isLoggedIn` StateFlow 决定；根 `App.kt` 用 `LaunchedEffect` 监听 → `navController.navigate` 切换

---

## 7. 状态管理约定

### 7.1 UiState

```kotlin
sealed interface UiState<out T> {
    data object Loading : UiState<Nothing>
    data class Success<T>(val data: T) : UiState<T>
    data class Error(val message: String, val code: Int? = null) : UiState<Nothing>
    // Empty 状态用 Success(emptyList()) 或专门的 domain empty
}
```

### 7.2 ViewModel 模板

```kotlin
@HiltViewModel
class ProductDetailViewModel @Inject constructor(
    private val repo: CatalogRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {
    private val spuId: Long = checkNotNull(savedStateHandle["id"])
    private val _state = MutableStateFlow<UiState<SPUDetail>>(UiState.Loading)
    val state: StateFlow<UiState<SPUDetail>> = _state.asStateFlow()

    init { load() }
    fun load() = viewModelScope.launch {
        _state.value = UiState.Loading
        _state.value = repo.getSPU(spuId).fold(
            onSuccess = { UiState.Success(it) },
            onFailure = { e -> UiState.Error(errorMessage(e), (e as? ApiException)?.code) },
        )
    }
}
```

### 7.3 Composable 消费

```kotlin
@Composable
fun ProductDetailScreen(vm: ProductDetailViewModel = hiltViewModel()) {
    val state by vm.state.collectAsStateWithLifecycle()
    when (val s = state) {
        UiState.Loading -> LoadingScreen()
        is UiState.Error -> ErrorScreen(msg = s.message, onRetry = vm::load)
        is UiState.Success -> ProductDetailContent(spu = s.data)
    }
}
```

---

## 8. 错误处理与错误码映射

`ui/common/ApiErrorMapper.kt` 集中一处：

```kotlin
fun errorMessage(t: Throwable): String = when (t) {
    is ApiException -> ErrorCodeMessages[t.code] ?: t.message ?: "未知错误"
    is IOException -> "网络异常，请检查连接"
    else -> t.message ?: "未知错误"
}

private val ErrorCodeMessages = mapOf(
    // Auth (1xxx)
    1001 to "请先登录", 1002 to "登录已过期", 1003 to "账号或密码错误",
    1004 to "账号已被禁用", 1020 to "权限不足",
    // Address (11xxx)
    11001 to "地址不存在",
    // Cart (12xxx)
    12002 to "商品已下架", 12003 to "库存不足",
    // Order (13xxx)
    13003 to "订单当前状态不允许此操作", 13008 to "订单已超时",
    // Payment (14xxx)
    14004 to "支付失败",
    // Aftersales (15xxx)
    15003 to "售后状态不允许当前操作", 15004 to "订单不允许发起此类型售后",
    // Review (19xxx) — Phase 6 只查看，不写
    // Notification (22xxx)
    22001 to "通知不存在",
    // Region (23xxx)
    23001 to "地区码无效",
)
```

---

## 9. 图片与占位策略

- 后端返回 MinIO object_key（如 `spu/xxx.jpg`）
- Android 侧拼 `BuildConfig.IMAGE_CDN` + object_key
- `BuildConfig.IMAGE_CDN` = `"http://10.0.2.2:9000/jdclone-public/"`（emulator）
- 用 Coil3 加载；`RemoteImage` composable 封装：
  ```kotlin
  @Composable
  fun RemoteImage(objectKey: String?, modifier: Modifier = Modifier, ...) {
      if (objectKey.isNullOrBlank()) {
          PlaceholderBox(modifier); return
      }
      val url = if (objectKey.startsWith("http")) objectKey else BuildConfig.IMAGE_CDN + objectKey
      AsyncImage(url, ..., error = { PlaceholderBox() })
  }
  ```

---

## 10. Phase 6 交付清单

### 数据层
- ApiService 覆盖所有需要的端点（user 域为主）
- AuthTokenManager (DataStore)
- AuthInterceptor (Bearer + 401→refresh)
- 8 个 Repository

### UI 层
- 4 tab bottom nav + 未登录跳转 LOGIN
- **Auth**：Login / Register / ForgotPassword / ResetPassword
- **Catalog**：Home（分类 grid + 推荐） / Category / Search / ProductDetail（gallery + SKU）
- **Cart**：CartScreen（分店铺分组 + 选中）
- **Checkout**：CheckoutScreen（地址选择 + 结算） + MockPaymentScreen（成功/失败）
- **Orders**：OrderListScreen（status tabs） + OrderDetailScreen（timeline + 操作）
- **Aftersales**：ApplyScreen（简化 3 类型 + 数量 + 金额 + 原因） + ListScreen + DetailScreen（timeline + 寄回单号回填 + 催办 + 申诉）
- **Addresses**：ListScreen + EditScreen（省市区级联 - 简化用 3 个 TextField）
- **Notifications**：ListScreen + 顶部铃铛未读数
- **Profile**：个人资料 + 退出登录 + 跳地址簿/我的售后/我的订单

### 测试
- 每个 ViewModel 至少 1 个 unit test（4-8 个 test 文件）
- 保留 Phase 0 的 ExampleUnitTest / ExampleInstrumentedTest

### CI
- 沿用 Phase 0 android-ci.yml（assembleDebug + testDebugUnitTest）

---

## 11. Phase 6 明确不做

- 商品评价发表（App 只看不发；Phase 7 补）
- 售后凭证图片上传（App 只看已上传图；Phase 7 补 CameraX/图库选择）
- 商家/管理员端 App（后期做）
- 推送通知（FCM 集成，Phase 后期）
- 完整地区级联下拉（简化为 3 个 TextField；Phase 7 补）
- 收藏 / 浏览记录 / 优惠券
- 离线缓存（Room / 结果持久化）
- 单元测试完整覆盖率（只做核心 ViewModel smoke test）
- 深链 / App Widget
