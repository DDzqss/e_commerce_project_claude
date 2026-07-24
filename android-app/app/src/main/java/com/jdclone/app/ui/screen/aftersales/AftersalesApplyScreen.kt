package com.jdclone.app.ui.screen.aftersales

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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.jdclone.app.ui.common.ErrorScreen
import com.jdclone.app.ui.common.LoadingScreen
import com.jdclone.app.ui.common.PriceText
import com.jdclone.app.ui.common.PrimaryButton
import com.jdclone.app.ui.common.RemoteImage
import com.jdclone.app.ui.common.UiState
import com.jdclone.app.ui.common.formatYuan

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AftersalesApplyScreen(
    onBack: () -> Unit,
    onSubmitted: (aftersalesId: Long) -> Unit,
    vm: AftersalesApplyViewModel = hiltViewModel(),
) {
    val state by vm.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(state) {
        val current = (state as? UiState.Success)?.data
        val toast = current?.toast
        if (!toast.isNullOrBlank()) {
            snackbar.showSnackbar(toast)
            vm.clearToast()
        }
        current?.successId?.let { onSubmitted(it) }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("申请售后") },
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
            Surface(tonalElevation = 4.dp) {
                Row(modifier = Modifier.fillMaxWidth().padding(12.dp)) {
                    PrimaryButton(
                        text = "提交申请",
                        onClick = vm::submit,
                        loading = current.submitting,
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                    )
                }
            }
        },
    ) { pad ->
        Box(modifier = Modifier.fillMaxSize().padding(pad)) {
            when (val s = state) {
                UiState.Loading -> LoadingScreen()
                is UiState.Error -> ErrorScreen(s.message, onRetry = vm::load)
                is UiState.Success -> ApplyContent(s.data, vm)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class, androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
private fun ApplyContent(data: ApplyState, vm: AftersalesApplyViewModel) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // 订单摘要
        item {
            Card {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(
                        text = "订单号 ${data.order.orderNo}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.outline,
                    )
                    Text(
                        text = data.order.shop?.name ?: "商家店铺",
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold),
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
            }
        }

        // 售后类型
        item {
            Card {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(
                        text = "选择售后类型",
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold),
                    )
                    data.allowedTypes.forEach { t ->
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            RadioButton(
                                selected = data.selectedType == t,
                                onClick = { vm.selectType(t) },
                            )
                            Text(t.label, style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }
        }

        // 商品选择
        item {
            Card {
                Column {
                    Text(
                        text = "选择商品",
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold),
                        modifier = Modifier.padding(12.dp),
                    )
                    HorizontalDivider()
                    data.itemChoices.forEach { choice ->
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(12.dp),
                            verticalAlignment = Alignment.Top,
                        ) {
                            Checkbox(
                                checked = choice.selected,
                                onCheckedChange = { vm.toggleItem(choice.orderItem.id) },
                            )
                            RemoteImage(
                                objectKey = choice.orderItem.skuImage,
                                modifier = Modifier.size(56.dp),
                            )
                            Spacer(Modifier.size(8.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = choice.orderItem.spuTitle,
                                    style = MaterialTheme.typography.bodyMedium,
                                    maxLines = 2,
                                    overflow = TextOverflow.Ellipsis,
                                )
                                Text(
                                    text = choice.orderItem.skuSpecs.entries.joinToString(" / ") { "${it.key}:${it.value}" },
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.outline,
                                )
                                Row(
                                    modifier = Modifier.padding(top = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    PriceText(choice.orderItem.unitPriceCents)
                                    Spacer(Modifier.weight(1f))
                                    if (choice.selected) {
                                        IconButton(
                                            onClick = { vm.setItemQty(choice.orderItem.id, choice.quantity - 1) },
                                            enabled = choice.quantity > 1,
                                            modifier = Modifier.size(32.dp),
                                        ) { Icon(Icons.Filled.Remove, contentDescription = "减少") }
                                        Text(
                                            text = choice.quantity.toString(),
                                            modifier = Modifier.padding(horizontal = 8.dp),
                                        )
                                        IconButton(
                                            onClick = { vm.setItemQty(choice.orderItem.id, choice.quantity + 1) },
                                            enabled = choice.quantity < choice.orderItem.quantity,
                                            modifier = Modifier.size(32.dp),
                                        ) { Icon(Icons.Filled.Add, contentDescription = "增加") }
                                    } else {
                                        Text(
                                            text = "×${choice.orderItem.quantity}",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.outline,
                                        )
                                    }
                                }
                            }
                        }
                        HorizontalDivider()
                    }
                }
            }
        }

        // 退款金额（EXCHANGE 时隐藏）
        if (data.selectedType != AftersalesType.EXCHANGE) {
            item {
                Card {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(
                            text = "退款金额（可减不可增）",
                            style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold),
                        )
                        Text(
                            text = "最多可退：${formatYuan(data.maxRefundCents)}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.outline,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                        OutlinedTextField(
                            value = if (data.refundAmountCents == 0) "" else (data.refundAmountCents / 100.0).let { "%.2f".format(it) },
                            onValueChange = { input ->
                                val yuan = input.toDoubleOrNull() ?: 0.0
                                vm.setRefundAmount((yuan * 100).toInt())
                            },
                            label = { Text("退款金额（元）") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                        )
                    }
                }
            }
        }

        // 原因分类
        item {
            Card {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(
                        text = "原因分类",
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold),
                    )
                    Spacer(Modifier.height(8.dp))
                    androidx.compose.foundation.layout.FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        AftersalesReason.entries.forEach { r ->
                            FilterChip(
                                selected = data.reason == r,
                                onClick = { vm.selectReason(r) },
                                label = { Text(r.label) },
                            )
                        }
                    }
                }
            }
        }

        // 说明
        item {
            OutlinedTextField(
                value = data.note,
                onValueChange = vm::updateNote,
                label = { Text("详细说明（≥10 字）") },
                modifier = Modifier.fillMaxWidth().height(120.dp),
                supportingText = { Text("${data.note.length}/500") },
            )
        }

        item { Spacer(Modifier.height(80.dp)) }
    }
}
