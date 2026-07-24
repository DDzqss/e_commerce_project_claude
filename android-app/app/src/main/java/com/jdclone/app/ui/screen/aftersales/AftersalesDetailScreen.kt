package com.jdclone.app.ui.screen.aftersales

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.jdclone.app.data.network.dto.AftersalesDetailDto
import com.jdclone.app.data.network.dto.AftersalesEvidenceDto
import com.jdclone.app.data.network.dto.AftersalesStatusHistoryDto
import com.jdclone.app.ui.common.DangerButton
import com.jdclone.app.ui.common.ErrorScreen
import com.jdclone.app.ui.common.LoadingScreen
import com.jdclone.app.ui.common.PrimaryButton
import com.jdclone.app.ui.common.RemoteImage
import com.jdclone.app.ui.common.SecondaryButton
import com.jdclone.app.ui.common.UiState
import com.jdclone.app.ui.common.formatDateTime
import com.jdclone.app.ui.common.formatYuan

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AftersalesDetailScreen(
    onBack: () -> Unit,
    vm: AftersalesDetailViewModel = hiltViewModel(),
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
                title = { Text("售后详情") },
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
            ActionBar(current.detail, inFlight = current.actionInFlight, vm = vm)
        },
    ) { pad ->
        Box(modifier = Modifier.fillMaxSize().padding(pad)) {
            when (val s = state) {
                UiState.Loading -> LoadingScreen()
                is UiState.Error -> ErrorScreen(s.message, onRetry = vm::load)
                is UiState.Success -> {
                    DetailBody(s.data.detail)
                    if (s.data.trackingDialogOpen) TrackingDialog(vm)
                    if (s.data.appealDialogOpen) AppealDialog(vm)
                }
            }
        }
    }
}

@Composable
private fun DetailBody(d: AftersalesDetailDto) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { StatusBadge(d) }
        item {
            Card {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(
                        text = "售后单 ${d.aftersalesNo}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.outline,
                    )
                    Text(
                        text = "关联订单 ID：${d.orderId}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.outline,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                    Text(
                        text = "类型：${aftersalesTypeLabel(d.type)}",
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                    Text(
                        text = "原因：${d.reasonCategory}",
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                    Text(
                        text = "说明：${d.reasonNote}",
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                    Text(
                        text = "申请退款：${formatYuan(d.refundAmountCents)}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(top = 6.dp),
                    )
                    d.actualRefundCents?.let {
                        Text(
                            text = "实际退款：${formatYuan(it)}",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(top = 2.dp),
                        )
                    }
                    if (!d.returnAddress.isNullOrBlank()) {
                        Text(
                            text = "退货地址：${d.returnAddress}",
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }
                    if (!d.returnTrackingNo.isNullOrBlank()) {
                        Text(
                            text = "寄回快递：${d.returnCarrier} ${d.returnTrackingNo}",
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.padding(top = 2.dp),
                        )
                    }
                }
            }
        }

        // Timeline
        item {
            Card {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(
                        text = "处理进程",
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold),
                    )
                    d.statusHistory.forEach { h -> TimelineRow(h) }
                    if (d.messages.isNotEmpty()) {
                        HorizontalDivider(modifier = Modifier.padding(vertical = 6.dp))
                        d.messages.forEach { m ->
                            Row(modifier = Modifier.padding(vertical = 2.dp)) {
                                Text(
                                    text = formatDateTime(m.createdAt),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.outline,
                                    modifier = Modifier.width(120.dp),
                                )
                                Text(
                                    text = "[${m.senderType}] ${m.content}",
                                    style = MaterialTheme.typography.bodySmall,
                                )
                            }
                        }
                    }
                }
            }
        }

        // 凭证
        if (d.evidences.isNotEmpty()) {
            item {
                Card {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(
                            text = "凭证",
                            style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold),
                        )
                        Spacer(Modifier.height(8.dp))
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            items(d.evidences, key = { it.id }) { ev -> EvidenceThumb(ev) }
                        }
                    }
                }
            }
        }
        item { Spacer(Modifier.height(96.dp)) }
    }
}

@Composable
private fun StatusBadge(d: AftersalesDetailDto) {
    Surface(
        color = MaterialTheme.colorScheme.primaryContainer,
        shape = RoundedCornerShape(8.dp),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = aftersalesStatusLabel(d.status),
                style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                color = MaterialTheme.colorScheme.onPrimaryContainer,
            )
            if (!d.merchantReviewNote.isNullOrBlank()) {
                Text(
                    text = "商家备注：${d.merchantReviewNote}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }
    }
}

@Composable
private fun TimelineRow(h: AftersalesStatusHistoryDto) {
    Row(modifier = Modifier.padding(top = 4.dp)) {
        Text(
            text = formatDateTime(h.createdAt),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.outline,
            modifier = Modifier.width(120.dp),
        )
        Text(
            text = aftersalesStatusLabel(h.toStatus) +
                if (h.note.isNullOrBlank()) "" else " · ${h.note}",
            style = MaterialTheme.typography.bodySmall,
        )
    }
}

@Composable
private fun EvidenceThumb(ev: AftersalesEvidenceDto) {
    RemoteImage(
        objectKey = ev.imageUrl,
        modifier = Modifier
            .size(80.dp)
            .aspectRatio(1f),
    )
}

@Composable
private fun ActionBar(d: AftersalesDetailDto, inFlight: Boolean, vm: AftersalesDetailViewModel) {
    // 根据当前状态决定可用操作（架构文档 §7）
    val actions = mutableListOf<@Composable () -> Unit>()
    when (d.status) {
        "pending_merchant_review" -> {
            actions += { SecondaryButton(text = "催办", onClick = vm::nudge, loading = inFlight) }
            actions += { DangerButton(text = "撤销申请", onClick = vm::cancel, loading = inFlight) }
        }
        "merchant_rejected" -> {
            actions += { SecondaryButton(text = "申诉", onClick = { vm.setAppealDialog(true) }) }
            actions += { DangerButton(text = "撤销申请", onClick = vm::cancel, loading = inFlight) }
        }
        "merchant_agreed_waiting_return" -> {
            actions += { DangerButton(text = "撤销申请", onClick = vm::cancel, loading = inFlight) }
            actions += { PrimaryButton(text = "回填快递单号", onClick = { vm.setTrackingDialog(true) }) }
        }
        "exchange_shipped_waiting_receive" -> {
            actions += { PrimaryButton(text = "确认收货", onClick = vm::confirmExchange, loading = inFlight) }
        }
        else -> Unit
    }
    if (actions.isEmpty()) return
    Surface(tonalElevation = 4.dp) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            horizontalArrangement = Arrangement.End,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            actions.forEachIndexed { idx, action ->
                action()
                if (idx != actions.lastIndex) Spacer(Modifier.size(8.dp))
            }
        }
    }
}

// ─── Dialogs ────────────────────────────────────────────────────────────────

@Composable
private fun TrackingDialog(vm: AftersalesDetailViewModel) {
    var carrier by rememberSaveable { mutableStateOf("") }
    var trackingNo by rememberSaveable { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = { vm.setTrackingDialog(false) },
        confirmButton = {
            TextButton(onClick = { vm.submitTracking(carrier, trackingNo) }) { Text("提交") }
        },
        dismissButton = {
            TextButton(onClick = { vm.setTrackingDialog(false) }) { Text("取消") }
        },
        title = { Text("回填寄回物流") },
        text = {
            Column {
                OutlinedTextField(
                    value = carrier,
                    onValueChange = { carrier = it },
                    label = { Text("快递公司") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = trackingNo,
                    onValueChange = { trackingNo = it },
                    label = { Text("快递单号") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        },
    )
}

@Composable
private fun AppealDialog(vm: AftersalesDetailViewModel) {
    var reason by rememberSaveable { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = { vm.setAppealDialog(false) },
        confirmButton = {
            TextButton(onClick = { vm.submitAppeal(reason) }) { Text("提交申诉") }
        },
        dismissButton = {
            TextButton(onClick = { vm.setAppealDialog(false) }) { Text("取消") }
        },
        title = { Text("提交申诉") },
        text = {
            Column {
                Text(
                    text = "申诉将升级至平台仲裁，仅可申诉 1 次。理由请写详尽（≥20 字）",
                    style = MaterialTheme.typography.bodySmall,
                )
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = reason,
                    onValueChange = { reason = it },
                    label = { Text("申诉理由") },
                    modifier = Modifier.fillMaxWidth().height(120.dp),
                )
            }
        },
    )
}
