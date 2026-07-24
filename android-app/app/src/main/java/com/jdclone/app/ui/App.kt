package com.jdclone.app.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Category
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.ShoppingCart
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.jdclone.app.data.local.AuthState
import com.jdclone.app.data.local.SessionState
import com.jdclone.app.data.repository.AuthRepository
import com.jdclone.app.ui.common.LoadingScreen
import com.jdclone.app.ui.navigation.NavRoutes
import com.jdclone.app.ui.screen.addresses.AddressEditScreen
import com.jdclone.app.ui.screen.addresses.AddressListScreen
import com.jdclone.app.ui.screen.aftersales.AftersalesApplyScreen
import com.jdclone.app.ui.screen.aftersales.AftersalesDetailScreen
import com.jdclone.app.ui.screen.aftersales.AftersalesListScreen
import com.jdclone.app.ui.screen.auth.ForgotPasswordScreen
import com.jdclone.app.ui.screen.auth.LoginScreen
import com.jdclone.app.ui.screen.auth.RegisterScreen
import com.jdclone.app.ui.screen.auth.ResetPasswordScreen
import com.jdclone.app.ui.screen.cart.CartScreen
import com.jdclone.app.ui.screen.catalog.CategoryListScreen
import com.jdclone.app.ui.screen.catalog.CategoryScreen
import com.jdclone.app.ui.screen.catalog.HomeScreen
import com.jdclone.app.ui.screen.catalog.ProductDetailScreen
import com.jdclone.app.ui.screen.catalog.SearchScreen
import com.jdclone.app.ui.screen.checkout.CheckoutScreen
import com.jdclone.app.ui.screen.checkout.MockPaymentScreen
import com.jdclone.app.ui.screen.notifications.NotificationListScreen
import com.jdclone.app.ui.screen.orders.OrderDetailScreen
import com.jdclone.app.ui.screen.orders.OrderListScreen
import com.jdclone.app.ui.screen.profile.ChangePasswordScreen
import com.jdclone.app.ui.screen.profile.ProfileScreen
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * 应用入口 —— 根据 SessionState 分 Auth / Main 两套 NavGraph。
 */
@HiltViewModel
class AppBootstrapViewModel @Inject constructor(
    private val authRepo: AuthRepository,
    private val session: SessionState,
) : ViewModel() {
    val authState = session.authState

    init {
        viewModelScope.launch { authRepo.bootstrap() }
    }
}

@Composable
fun App(bootstrap: AppBootstrapViewModel = hiltViewModel()) {
    val authState by bootstrap.authState.collectAsStateWithLifecycle()

    when (authState) {
        AuthState.Loading -> LoadingScreen()
        AuthState.LoggedOut -> AuthGraphHost()
        is AuthState.LoggedIn -> MainGraphHost()
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth graph
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun AuthGraphHost() {
    val nav = rememberNavController()
    NavHost(navController = nav, startDestination = NavRoutes.LOGIN) {
        composable(NavRoutes.LOGIN) {
            LoginScreen(
                onLoginSuccess = { /* SessionState 自动切换到 MainGraph */ },
                onGoRegister = { nav.navigate(NavRoutes.REGISTER) },
                onGoForgot = { nav.navigate(NavRoutes.FORGOT_PASSWORD) },
            )
        }
        composable(NavRoutes.REGISTER) {
            RegisterScreen(
                onRegistered = { /* SessionState 自动切换 */ },
                onBackToLogin = { nav.popBackStack() },
            )
        }
        composable(NavRoutes.FORGOT_PASSWORD) {
            ForgotPasswordScreen(
                onDone = { nav.popBackStack() },
                onGoReset = { _ -> nav.navigate(NavRoutes.RESET_PASSWORD) },
            )
        }
        composable(NavRoutes.RESET_PASSWORD) {
            ResetPasswordScreen(
                onResetSuccess = { nav.popBackStack(NavRoutes.LOGIN, inclusive = false) },
            )
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main graph（登录后）
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun MainGraphHost() {
    val nav = rememberNavController()
    val backStackEntry by nav.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route
    val showBottomBar = currentRoute in bottomTabRoutes

    Scaffold(
        bottomBar = {
            if (showBottomBar) BottomBar(nav)
        },
    ) { innerPadding ->
        NavHost(
            navController = nav,
            startDestination = NavRoutes.HOME,
            modifier = Modifier.padding(innerPadding),
        ) {
            // ── Bottom nav tabs ────────────────────────────────────────────
            composable(NavRoutes.HOME) {
                HomeScreen(
                    onGoSearch = { nav.navigate(NavRoutes.SEARCH) },
                    onGoProduct = { id -> nav.navigate(NavRoutes.productDetail(id)) },
                    onGoCategory = { id -> nav.navigate(NavRoutes.categoryList(id)) },
                )
            }
            composable(NavRoutes.CATEGORY) {
                CategoryScreen(
                    onGoCategory = { id -> nav.navigate(NavRoutes.categoryList(id)) },
                )
            }
            composable(NavRoutes.CART) {
                CartScreen(
                    onCheckout = { ids ->
                        nav.navigate(NavRoutes.CHECKOUT + "?ids=${ids.joinToString(",")}")
                    },
                    onGoProduct = { id -> nav.navigate(NavRoutes.productDetail(id)) },
                )
            }
            composable(NavRoutes.PROFILE) {
                ProfileScreen(
                    onGoLogin = { /* 未登录用户理论上此页看不到，但保留兜底 */ },
                    onGoOrders = { nav.navigate(NavRoutes.ORDER_LIST) },
                    onGoAftersales = { nav.navigate(NavRoutes.AFTERSALES_LIST) },
                    onGoAddresses = { nav.navigate(NavRoutes.ADDRESS_LIST) },
                    onGoNotifications = { nav.navigate(NavRoutes.NOTIFICATIONS) },
                    onGoChangePassword = { nav.navigate(NavRoutes.CHANGE_PASSWORD) },
                )
            }

            // ── Catalog 深层 ───────────────────────────────────────────────
            composable(NavRoutes.SEARCH) {
                SearchScreen(
                    onBack = { nav.popBackStack() },
                    onGoProduct = { id -> nav.navigate(NavRoutes.productDetail(id)) },
                )
            }
            composable(NavRoutes.PRODUCT_DETAIL) {
                ProductDetailScreen(
                    onBack = { nav.popBackStack() },
                    onGoCart = { nav.navigate(NavRoutes.CART) },
                    onGoShop = { id -> nav.navigate(NavRoutes.shopDetail(id)) },
                    onGoProduct = { id -> nav.navigate(NavRoutes.productDetail(id)) },
                )
            }
            composable(NavRoutes.CATEGORY_LIST) {
                CategoryListScreen(
                    onBack = { nav.popBackStack() },
                    onGoProduct = { id -> nav.navigate(NavRoutes.productDetail(id)) },
                )
            }

            // ── Checkout / Payment ────────────────────────────────────────
            composable(NavRoutes.CHECKOUT + "?ids={ids}") {
                CheckoutScreen(
                    onBack = { nav.popBackStack() },
                    onCreated = { orderId ->
                        nav.navigate(NavRoutes.mockPayment(sessionId = 0L, orderId = orderId)) {
                            popUpTo(NavRoutes.CART)
                        }
                    },
                )
            }
            composable(NavRoutes.MOCK_PAYMENT) {
                MockPaymentScreen(
                    onPaid = { orderId ->
                        nav.navigate(NavRoutes.orderDetail(orderId)) {
                            popUpTo(NavRoutes.CART)
                        }
                    },
                    onCancel = { nav.popBackStack() },
                )
            }

            // ── Orders ────────────────────────────────────────────────────
            composable(NavRoutes.ORDER_LIST) {
                OrderListScreen(
                    onBack = { nav.popBackStack() },
                    onOpenOrder = { id -> nav.navigate(NavRoutes.orderDetail(id)) },
                    onPayOrder = { id ->
                        nav.navigate(NavRoutes.mockPayment(sessionId = 0L, orderId = id))
                    },
                )
            }
            composable(NavRoutes.ORDER_DETAIL) {
                OrderDetailScreen(
                    onBack = { nav.popBackStack() },
                    onPay = { id ->
                        nav.navigate(NavRoutes.mockPayment(sessionId = 0L, orderId = id))
                    },
                    onAftersalesApply = { orderId ->
                        nav.navigate(NavRoutes.aftersalesApply(orderId))
                    },
                )
            }

            // ── Aftersales ────────────────────────────────────────────────
            composable(NavRoutes.AFTERSALES_APPLY) {
                AftersalesApplyScreen(
                    onBack = { nav.popBackStack() },
                    onSubmitted = { asId ->
                        nav.navigate(NavRoutes.aftersalesDetail(asId)) {
                            popUpTo(NavRoutes.ORDER_LIST)
                        }
                    },
                )
            }
            composable(NavRoutes.AFTERSALES_LIST) {
                AftersalesListScreen(
                    onBack = { nav.popBackStack() },
                    onOpen = { id -> nav.navigate(NavRoutes.aftersalesDetail(id)) },
                )
            }
            composable(NavRoutes.AFTERSALES_DETAIL) {
                AftersalesDetailScreen(onBack = { nav.popBackStack() })
            }

            // ── Addresses ─────────────────────────────────────────────────
            composable(NavRoutes.ADDRESS_LIST) {
                AddressListScreen(
                    onBack = { nav.popBackStack() },
                    onAdd = { nav.navigate(NavRoutes.addressEdit(null)) },
                    onEdit = { id -> nav.navigate(NavRoutes.addressEdit(id)) },
                )
            }
            composable(NavRoutes.ADDRESS_EDIT) {
                AddressEditScreen(
                    onBack = { nav.popBackStack() },
                    onSaved = { nav.popBackStack() },
                )
            }

            // ── Notifications ─────────────────────────────────────────────
            composable(NavRoutes.NOTIFICATIONS) {
                NotificationListScreen(
                    onBack = { nav.popBackStack() },
                    onOpenAction = { notif ->
                        // 依据 related_type/related_id 跳目标页
                        when (notif.relatedType) {
                            "order" -> notif.relatedId?.let { nav.navigate(NavRoutes.orderDetail(it)) }
                            "aftersales" -> notif.relatedId?.let { nav.navigate(NavRoutes.aftersalesDetail(it)) }
                            else -> Unit
                        }
                    },
                )
            }

            // ── Profile 深层 ──────────────────────────────────────────────
            composable(NavRoutes.CHANGE_PASSWORD) {
                ChangePasswordScreen(onBack = { nav.popBackStack() })
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bottom navigation
// ─────────────────────────────────────────────────────────────────────────────

private val bottomTabRoutes = setOf(
    NavRoutes.HOME, NavRoutes.CATEGORY, NavRoutes.CART, NavRoutes.PROFILE,
)

private data class BottomTab(
    val route: String,
    val label: String,
    val icon: ImageVector,
)

private val bottomTabs = listOf(
    BottomTab(NavRoutes.HOME, "首页", Icons.Outlined.Home),
    BottomTab(NavRoutes.CATEGORY, "分类", Icons.Outlined.Category),
    BottomTab(NavRoutes.CART, "购物车", Icons.Outlined.ShoppingCart),
    BottomTab(NavRoutes.PROFILE, "我的", Icons.Outlined.Person),
)

@Composable
private fun BottomBar(nav: NavHostController) {
    val backStackEntry by nav.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route
    NavigationBar {
        bottomTabs.forEach { tab ->
            NavigationBarItem(
                selected = backStackEntry?.destination?.hierarchy?.any { it.route == tab.route } == true,
                onClick = {
                    if (currentRoute != tab.route) {
                        nav.navigate(tab.route) {
                            popUpTo(nav.graph.findStartDestination().id) { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
                },
                icon = { Icon(tab.icon, contentDescription = tab.label) },
                label = { Text(tab.label) },
            )
        }
    }
}
