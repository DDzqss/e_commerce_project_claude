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
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.jdclone.app.ui.screen.cart.CartScreen
import com.jdclone.app.ui.screen.category.CategoryScreen
import com.jdclone.app.ui.screen.home.HomeScreen
import com.jdclone.app.ui.screen.profile.ProfileScreen

/**
 * Top-level composable that owns the bottom navigation and the [NavHost]
 * hosting the four primary consumer tabs.
 */
@Composable
fun App() {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route

    Scaffold(
        bottomBar = {
            NavigationBar {
                BottomTab.entries.forEach { tab ->
                    NavigationBarItem(
                        selected = backStackEntry?.destination?.hierarchy
                            ?.any { it.route == tab.route } == true,
                        onClick = {
                            if (currentRoute != tab.route) {
                                navController.navigate(tab.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
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
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = BottomTab.Home.route,
            modifier = Modifier.padding(innerPadding),
        ) {
            composable(BottomTab.Home.route) { HomeScreen() }
            composable(BottomTab.Category.route) { CategoryScreen() }
            composable(BottomTab.Cart.route) { CartScreen() }
            composable(BottomTab.Profile.route) { ProfileScreen() }
        }
    }
}

private enum class BottomTab(
    val route: String,
    val label: String,
    val icon: ImageVector,
) {
    Home("home", "首页", Icons.Outlined.Home),
    Category("category", "分类", Icons.Outlined.Category),
    Cart("cart", "购物车", Icons.Outlined.ShoppingCart),
    Profile("profile", "我的", Icons.Outlined.Person),
}
