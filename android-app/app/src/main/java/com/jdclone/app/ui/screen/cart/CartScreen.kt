package com.jdclone.app.ui.screen.cart

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Store
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.jdclone.app.data.network.dto.CartItemDto
import com.jdclone.app.ui.common.EmptyState
import com.jdclone.app.ui.common.ErrorScreen
import com.jdclone.app.ui.common.LoadingScreen
import com.jdclone.app.ui.common.PriceText
import com.jdclone.app.ui.common.PrimaryButton
import com.jdclone.app.ui.common.RemoteImage
import com.jdclone.app.ui.common.SecondaryButton
import com.jdclone.app.ui.common.UiState
import com.jdclone.app.ui.common.formatYuan

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CartScreen(
    onCheckout: (selectedIds: List<Long>) -> Unit,
    onGoProduct: (Long) -> Unit,
    vm: CartViewModel = hiltViewModel(),
) {
    val state by vm.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(Unit) { vm.refresh() }
    LaunchedEffect(state) {
        val toast = (state as? UiState.Success)?.data?.toast
        if (!toast.isNullOrBlank()) {
            snackbar.showSnackbar(toast)
            vm.clearToast()
        }
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text("购物车") }) },
        snackbarHost = { SnackbarHost(snackbar) },
        bottomBar = {
            val current = (state as? UiState.Success)?.data ?: return@Scaffold
            CheckoutBar(
                allSelected = current.allSelected,
                totalCents = current.response.totalCentsSelected,
                totalCount = current.response.totalSelectedCount,
                onToggleAll = { vm.selectAll(!current.allSelected) },
                onCheckout = { onCheckout(vm.selectedItemIds()) },
                canCheckout = current.response.totalSelectedCount > 0,
            )
        },
    ) { pad ->
        Box(modifier = Modifier.fillMaxSize().padding(pad)) {
            when (val s = state) {
                UiState.Loading -> LoadingScreen()
                is UiState.Error -> ErrorScreen(s.message, onRetry = vm::refresh)
                is UiState.Success -> {
                    val response = s.data.response
                    if (response.groups.isEmpty()) {
                        EmptyState(text = "购物车空空如也\n去逛逛心仪商品吧")
                    } else {
                        CartContent(
                            state = s.data,
                            onToggleItem = vm::toggleSelected,
                            onQtyChange = vm::updateQuantity,
                            onDelete = vm::deleteItem,
                            onClearInvalid = vm::clearInvalid,
                            onGoProduct = onGoProduct,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun CartContent(
    state: CartUiState,
    onToggleItem: (CartItemDto) -> Unit,
    onQtyChange: (CartItemDto, Int) -> Unit,
    onDelete: (CartItemDto) -> Unit,
    onClearInvalid: () -> Unit,
    onGoProduct: (Long) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (state.response.invalidCount > 0) {
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            color = MaterialTheme.colorScheme.errorContainer,
                            shape = RoundedCornerShape(6.dp),
                        )
                        .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "有 ${state.response.invalidCount} 件商品已失效",
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.weight(1f),
                    )
                    SecondaryButton(text = "移除失效商品", onClick = onClearInvalid)
                }
            }
        }
        state.response.groups.forEach { group ->
            item {
                Card {
                    Column {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(Icons.Outlined.Store, contentDescription = null)
                            Spacer(Modifier.size(6.dp))
                            Text(
                                text = group.shop.name,
                                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold),
                                modifier = Modifier.weight(1f),
                            )
                        }
                        HorizontalDivider()
                        group.items.forEach { item ->
                            CartItemRow(
                                item = item,
                                onToggle = { onToggleItem(item) },
                                onQtyChange = { qty -> onQtyChange(item, qty) },
                                onDelete = { onDelete(item) },
                                onGoProduct = { onGoProduct(item.spu.id) },
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CartItemRow(
    item: CartItemDto,
    onToggle: () -> Unit,
    onQtyChange: (Int) -> Unit,
    onDelete: () -> Unit,
    onGoProduct: () -> Unit,
) {
    val valid = item.status == "valid"
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(12.dp)
            .alpha(if (valid) 1f else 0.5f),
        verticalAlignment = Alignment.Top,
    ) {
        Checkbox(
            checked = item.selected,
            onCheckedChange = { onToggle() },
            enabled = valid,
        )
        RemoteImage(
            objectKey = item.sku.image ?: item.spu.mainImage,
            modifier = Modifier.size(72.dp),
            contentDescription = item.spu.title,
        )
        Spacer(Modifier.size(8.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = item.spu.title,
                style = MaterialTheme.typography.bodyMedium,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(bottom = 2.dp),
            )
            Text(
                text = item.sku.specs.entries.joinToString(" / ") { "${it.key}:${it.value}" }
                    .ifBlank { item.sku.skuCode },
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.outline,
            )
            if (!valid) {
                Text(
                    text = "· 已失效: ${item.invalidReason ?: ""}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                )
            }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PriceText(item.sku.priceCents)
                Spacer(Modifier.weight(1f))
                QuantityStepper(
                    quantity = item.quantity,
                    onQtyChange = onQtyChange,
                    enabled = valid,
                )
                IconButton(onClick = onDelete) {
                    Icon(Icons.Outlined.Delete, contentDescription = "删除")
                }
            }
        }
    }
}

@Composable
private fun QuantityStepper(
    quantity: Int,
    onQtyChange: (Int) -> Unit,
    enabled: Boolean,
) {
    Surface(
        shape = RoundedCornerShape(6.dp),
        color = MaterialTheme.colorScheme.surfaceVariant,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(
                onClick = { if (quantity > 1) onQtyChange(quantity - 1) },
                enabled = enabled && quantity > 1,
                modifier = Modifier.size(32.dp),
            ) { Icon(Icons.Filled.Remove, contentDescription = "减少") }
            Text(
                text = quantity.toString(),
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(horizontal = 6.dp),
            )
            IconButton(
                onClick = { onQtyChange(quantity + 1) },
                enabled = enabled,
                modifier = Modifier.size(32.dp),
            ) { Icon(Icons.Filled.Add, contentDescription = "增加") }
        }
    }
}

@Composable
private fun CheckoutBar(
    allSelected: Boolean,
    totalCents: Int,
    totalCount: Int,
    onToggleAll: () -> Unit,
    onCheckout: () -> Unit,
    canCheckout: Boolean,
) {
    Surface(tonalElevation = 4.dp) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.weight(1f),
            ) {
                Checkbox(checked = allSelected, onCheckedChange = { onToggleAll() })
                Text("全选")
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "合计 ${formatYuan(totalCents)}",
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = MaterialTheme.colorScheme.primary,
                )
                Text(
                    text = "已选 $totalCount 件",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.outline,
                )
            }
            Spacer(Modifier.size(12.dp))
            PrimaryButton(
                text = "去结算",
                onClick = onCheckout,
                enabled = canCheckout,
                modifier = Modifier.height(44.dp),
            )
        }
    }
}
