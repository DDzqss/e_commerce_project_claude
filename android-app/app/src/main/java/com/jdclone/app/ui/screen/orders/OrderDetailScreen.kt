package com.jdclone.app.ui.screen.orders

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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.material3.Card
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.jdclone.app.data.network.dto.OrderDetailDto
import com.jdclone.app.data.network.dto.OrderStatusHistoryDto
import com.jdclone.app.ui.common.DangerButton
import com.jdclone.app.ui.common.ErrorScreen
import com.jdclone.app.ui.common.LoadingScreen
import com.jdclone.app.ui.common.PrimaryButton
import com.jdclone.app.ui.common.RemoteImage
import com.jdclone.app.ui.common.SecondaryButton
import com.jdclone.app.ui.common.UiState
import com.jdclone.app.ui.common.formatDateTime
import com.jdclone.app.ui.common.formatYuan
import com.jdclone.app.ui.common.maskPhone

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrderDetailScreen(
    onBack: () -> Unit,
    onPay: (Long) -> Unit,
    onAftersalesApply: (Long) -> Unit,
    vm: OrderDetailViewModel = hiltViewModel(),
) {
    val state by vm.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(state) {
        val toast = (state as? UiState.Success)?.data?.toast
        if (!toast.isNullOrBlank()) {
            snackbar.showSnackbar(toast)
            vm.clearToast()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("订单详情") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
        bottomBar = {
            val current = (state as? UiState.Success)?.data ?: return@Scaffold
            ActionBar(
                order = current.detail,
                inFlight = current.actionInFlight,
                onPay = { onPay(current.detail.id) },
                onCancel = vm::cancel,
                onConfirm = vm::confirmReceipt,
                onApplyAftersales = { onAftersalesApply(current.detail.id) },
            )
        },
    ) { pad ->
        Box(modifier = Modifier.fillMaxSize().padding(pad)) {
            when (val s = state) {
                UiState.Loading -> LoadingScreen()
                is UiState.Error -> ErrorScreen(s.message, onRetry = vm::load)
                is UiState.Success -> Content(s.data.detail)
            }
        }
    }
}

@Composable
private fun Content(order: OrderDetailDto) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { StatusBanner(order) }
        item {
            Card {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(
                        text = "${order.receiverName}  ${maskPhone(order.receiverPhone)}",
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold),
                    )
                    Text(
                        text = order.receiverAddress,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.outline,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
            }
        }
        item {
            Card {
                Column {
                    Text(
                        text = order.shop?.name ?: "商家店铺",
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold),
                        modifier = Modifier.padding(12.dp),
                    )
                    HorizontalDivider()
                    order.items.forEach { item ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                        ) {
                            RemoteImage(
                                objectKey = item.skuImage,
                                modifier = Modifier.size(64.dp),
                            )
                            Spacer(Modifier.size(8.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = item.spuTitle,
                                    style = MaterialTheme.typography.bodyMedium,
                                    maxLines = 2,
                                    overflow = TextOverflow.Ellipsis,
                                )
                                Text(
                                    text = item.skuSpecs.entries.joinToString(" / ") { "${it.key}:${it.value}" },
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.outline,
                                    modifier = Modifier.padding(top = 2.dp),
                                )
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(top = 4.dp),
                                ) {
                                    Text(
                                        text = formatYuan(item.unitPriceCents),
                                        style = MaterialTheme.typography.bodySmall,
                                    )
                                    Spacer(Modifier.weight(1f))
                                    Text(
                                        text = "×${item.quantity}",
                                        style = MaterialTheme.typography.bodySmall,
                                    )
                                }
                            }
                        }
                        HorizontalDivider()
                    }
                    AmountRow("商品金额", order.subtotalCents)
                    AmountRow("运费", order.shippingFeeCents)
                    AmountRow("优惠", -order.discountCents)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                    ) {
                        Text("实付", modifier = Modifier.weight(1f))
                        Text(
                            text = formatYuan(order.totalCents),
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                }
            }
        }

        if (order.status == "shipped" || order.shipmentEvents.isNotEmpty()) {
            item {
                Card {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Filled.LocalShipping, contentDescription = null)
                            Spacer(Modifier.size(6.dp))
                            Text(
                                text = "物流轨迹",
                                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold),
                            )
                        }
                        if (!order.shippingCarrier.isNullOrBlank()) {
                            Text(
                                text = "${order.shippingCarrier}  ${order.trackingNo ?: ""}",
                                style = MaterialTheme.typography.bodySmall,
                                modifier = Modifier.padding(top = 4.dp),
                            )
                        }
                        order.shipmentEvents.forEach { evt ->
                            Row(modifier = Modifier.padding(top = 8.dp)) {
                                Text(
                                    text = formatDateTime(evt.eventTime),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.outline,
                                    modifier = Modifier.width(120.dp),
                                )
                                Text(
                                    text = evt.description,
                                    style = MaterialTheme.typography.bodySmall,
                                )
                            }
                        }
                    }
                }
            }
        }

        item {
            Card {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(
                        text = "订单进程",
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold),
                    )
                    order.statusHistory.forEach { h ->
                        StatusHistoryRow(h)
                    }
                }
            }
        }

        if (!order.userNote.isNullOrBlank()) {
            item {
                Card {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(
                            text = "备注",
                            style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold),
                        )
                        Text(
                            text = order.userNote,
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }
                }
            }
        }
        item { Spacer(Modifier.height(80.dp)) }
    }
}

@Composable
private fun StatusBanner(order: OrderDetailDto) {
    Surface(
        color = MaterialTheme.colorScheme.primaryContainer,
        shape = RoundedCornerShape(8.dp),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = orderStatusLabel(order.status),
                style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                color = MaterialTheme.colorScheme.onPrimaryContainer,
            )
            val subtitle = when (order.status) {
                "pending_payment" -> "请在支付截止前完成付款"
                "paid" -> "商家备货中，请耐心等待"
                "shipped" -> "商品已发出，请注意查收"
                "completed" -> "订单已完成，欢迎再次光临"
                else -> ""
            }
            if (subtitle.isNotBlank()) {
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }
    }
}

@Composable
private fun StatusHistoryRow(h: OrderStatusHistoryDto) {
    Row(modifier = Modifier.padding(top = 6.dp)) {
        Text(
            text = formatDateTime(h.createdAt),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.outline,
            modifier = Modifier.width(120.dp),
        )
        Text(
            text = orderStatusLabel(h.toStatus) + if (h.note.isNullOrBlank()) "" else " · ${h.note}",
            style = MaterialTheme.typography.bodySmall,
        )
    }
}

@Composable
private fun AmountRow(label: String, cents: Int) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 4.dp),
    ) {
        Text(label, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodySmall)
        Text(text = formatYuan(cents), style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun ActionBar(
    order: OrderDetailDto,
    inFlight: Boolean,
    onPay: () -> Unit,
    onCancel: () -> Unit,
    onConfirm: () -> Unit,
    onApplyAftersales: () -> Unit,
) {
    Surface(tonalElevation = 4.dp) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.End,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            when (order.status) {
                "pending_payment" -> {
                    SecondaryButton(text = "取消订单", onClick = onCancel, loading = inFlight)
                    Spacer(Modifier.size(8.dp))
                    PrimaryButton(text = "去支付", onClick = onPay, loading = inFlight)
                }
                "paid" -> {
                    SecondaryButton(text = "申请售后", onClick = onApplyAftersales)
                }
                "shipped" -> {
                    SecondaryButton(text = "申请售后", onClick = onApplyAftersales)
                    Spacer(Modifier.size(8.dp))
                    PrimaryButton(text = "确认收货", onClick = onConfirm, loading = inFlight)
                }
                "completed" -> {
                    SecondaryButton(text = "申请售后", onClick = onApplyAftersales)
                }
                "cancelled", "closed" -> {
                    DangerButton(text = "已结束", onClick = {}, enabled = false)
                }
            }
        }
    }
}
