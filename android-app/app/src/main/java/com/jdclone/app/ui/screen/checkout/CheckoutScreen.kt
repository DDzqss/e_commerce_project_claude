package com.jdclone.app.ui.screen.checkout

import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.jdclone.app.data.network.dto.AddressDto
import com.jdclone.app.data.network.dto.CartItemDto
import com.jdclone.app.ui.common.ErrorScreen
import com.jdclone.app.ui.common.LoadingScreen
import com.jdclone.app.ui.common.PriceText
import com.jdclone.app.ui.common.PrimaryButton
import com.jdclone.app.ui.common.RemoteImage
import com.jdclone.app.ui.common.UiState
import com.jdclone.app.ui.common.formatYuan
import com.jdclone.app.ui.common.maskPhone

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CheckoutScreen(
    onBack: () -> Unit,
    onCreated: (orderId: Long) -> Unit,
    vm: CheckoutViewModel = hiltViewModel(),
) {
    val state by vm.state.collectAsStateWithLifecycle()
    val effect by vm.effect.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(effect) {
        (effect as? CheckoutEffect.Created)?.let {
            vm.clearEffect()
            onCreated(it.orderId)
        }
    }
    LaunchedEffect(state) {
        val toast = (state as? UiState.Success)?.data?.toast
        if (!toast.isNullOrBlank()) {
            snackbar.showSnackbar(toast)
            vm.clearToast()
        }
    }

    var addressSheetOpen by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("确认订单") },
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
            SubmitBar(
                totalCents = current.preview.grandTotalCents,
                submitting = current.submitting,
                onSubmit = vm::submit,
            )
        },
    ) { pad ->
        Box(modifier = Modifier.fillMaxSize().padding(pad)) {
            when (val s = state) {
                UiState.Loading -> LoadingScreen()
                is UiState.Error -> ErrorScreen(s.message, onRetry = vm::load)
                is UiState.Success -> CheckoutContent(
                    ui = s.data,
                    onAddressClick = { addressSheetOpen = true },
                    onNoteChange = vm::updateNote,
                )
            }
        }
    }

    if (addressSheetOpen) {
        val current = (state as? UiState.Success)?.data
        ModalBottomSheet(
            onDismissRequest = { addressSheetOpen = false },
            sheetState = sheetState,
        ) {
            Text(
                text = "选择收货地址",
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
                modifier = Modifier.padding(16.dp),
            )
            HorizontalDivider()
            LazyColumn(modifier = Modifier.fillMaxWidth()) {
                items(current?.addresses.orEmpty(), key = { it.id }) { addr ->
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = addr.receiverName,
                                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                            )
                            Spacer(Modifier.size(8.dp))
                            Text(
                                text = maskPhone(addr.receiverPhone),
                                style = MaterialTheme.typography.bodySmall,
                            )
                            if (addr.isDefault) {
                                Spacer(Modifier.size(8.dp))
                                Surface(
                                    color = MaterialTheme.colorScheme.primary,
                                    shape = RoundedCornerShape(4.dp),
                                ) {
                                    Text(
                                        text = "默认",
                                        color = MaterialTheme.colorScheme.onPrimary,
                                        style = MaterialTheme.typography.labelSmall,
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                    )
                                }
                            }
                        }
                        Text(
                            text = "${addr.province}${addr.city}${addr.district} ${addr.detail}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.outline,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                        Row(modifier = Modifier.padding(top = 8.dp)) {
                            Text(
                                text = "选择此地址",
                                color = MaterialTheme.colorScheme.primary,
                                style = MaterialTheme.typography.labelMedium,
                                modifier = Modifier
                                    .padding(end = 12.dp)
                                    .clickable {
                                        vm.switchAddress(addr)
                                        addressSheetOpen = false
                                    },
                            )
                        }
                        HorizontalDivider()
                    }
                }
            }
        }
    }
}

@Composable
private fun CheckoutContent(
    ui: CheckoutUiState,
    onAddressClick: () -> Unit,
    onNoteChange: (String) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            AddressCard(ui.selectedAddress, onClick = onAddressClick)
        }
        ui.preview.groupsByShop.forEach { group ->
            item {
                Card {
                    Column {
                        Text(
                            text = group.shop.name,
                            style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold),
                            modifier = Modifier.padding(12.dp),
                        )
                        HorizontalDivider()
                        group.items.forEach { GroupItemRow(it) }
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                text = "小计",
                                style = MaterialTheme.typography.bodySmall,
                                modifier = Modifier.weight(1f),
                            )
                            Text(
                                text = formatYuan(group.totalCents),
                                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                                color = MaterialTheme.colorScheme.primary,
                            )
                        }
                    }
                }
            }
        }
        item {
            OutlinedTextField(
                value = ui.note,
                onValueChange = onNoteChange,
                label = { Text("订单备注（选填）") },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(96.dp),
            )
        }
        if (ui.preview.warnings.isNotEmpty()) {
            item {
                Card {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(
                            text = "以下商品需要处理",
                            style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.SemiBold),
                            color = MaterialTheme.colorScheme.error,
                        )
                        ui.preview.warnings.forEach {
                            Text(
                                text = "· ${it.message}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.error,
                                modifier = Modifier.padding(top = 4.dp),
                            )
                        }
                    }
                }
            }
        }
        item { Spacer(Modifier.size(80.dp)) }
    }
}

@Composable
private fun AddressCard(address: AddressDto, onClick: () -> Unit) {
    Card(onClick = onClick) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                Icons.Filled.LocationOn,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
            )
            Spacer(Modifier.size(8.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = address.receiverName,
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold),
                    )
                    Spacer(Modifier.size(8.dp))
                    Text(
                        text = maskPhone(address.receiverPhone),
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
                Text(
                    text = "${address.province}${address.city}${address.district} ${address.detail}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.outline,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            Icon(Icons.Filled.KeyboardArrowRight, contentDescription = null)
        }
    }
}

@Composable
private fun GroupItemRow(item: CartItemDto) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(12.dp),
        verticalAlignment = Alignment.Top,
    ) {
        RemoteImage(
            objectKey = item.sku.image ?: item.spu.mainImage,
            modifier = Modifier.size(64.dp),
        )
        Spacer(Modifier.size(8.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = item.spu.title,
                style = MaterialTheme.typography.bodyMedium,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = item.sku.specs.entries.joinToString(" / ") { "${it.key}:${it.value}" }
                    .ifBlank { item.sku.skuCode },
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.outline,
            )
            Row(
                modifier = Modifier.padding(top = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PriceText(item.sku.priceCents)
                Spacer(Modifier.weight(1f))
                Text(
                    text = "×${item.quantity}",
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
    }
}

@Composable
private fun SubmitBar(totalCents: Int, submitting: Boolean, onSubmit: () -> Unit) {
    Surface(tonalElevation = 4.dp) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text("应付金额", style = MaterialTheme.typography.bodySmall)
                Text(
                    text = formatYuan(totalCents),
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                    color = MaterialTheme.colorScheme.primary,
                )
            }
            PrimaryButton(
                text = "提交订单",
                onClick = onSubmit,
                loading = submitting,
                modifier = Modifier.height(48.dp),
            )
        }
    }
}
