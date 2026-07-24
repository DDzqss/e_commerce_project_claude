package com.jdclone.app.ui.screen.checkout

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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.Payment
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.jdclone.app.ui.common.DangerButton
import com.jdclone.app.ui.common.ErrorScreen
import com.jdclone.app.ui.common.LoadingScreen
import com.jdclone.app.ui.common.PrimaryButton
import com.jdclone.app.ui.common.UiState
import com.jdclone.app.ui.common.formatYuan

private data class Channel(val id: String, val label: String, val icon: androidx.compose.ui.graphics.vector.ImageVector)

private val CHANNELS = listOf(
    Channel("mock_alipay", "模拟支付宝", Icons.Filled.Payment),
    Channel("mock_wechat", "模拟微信支付", Icons.Filled.Payment),
    Channel("mock_bank", "模拟银行卡", Icons.Filled.AccountBalance),
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MockPaymentScreen(
    onPaid: (orderId: Long) -> Unit,
    onCancel: () -> Unit,
    vm: MockPaymentViewModel = hiltViewModel(),
) {
    val state by vm.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(state) {
        val toast = (state as? UiState.Success)?.data?.toast
        if (!toast.isNullOrBlank()) {
            snackbar.showSnackbar(toast)
            vm.clearToast()
        }
        val current = (state as? UiState.Success)?.data
        if (current?.done == true) {
            onPaid(current.orderId)
        }
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text("模拟支付") }) },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { pad ->
        Box(modifier = Modifier.fillMaxSize().padding(pad)) {
            when (val s = state) {
                UiState.Loading -> LoadingScreen()
                is UiState.Error -> ErrorScreen(s.message, onRetry = vm::load)
                is UiState.Success -> {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        WarningBanner()
                        Spacer(Modifier.height(24.dp))
                        Text(
                            text = "订单号 ${s.data.orderId}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.outline,
                        )
                        Text(
                            text = formatYuan(s.data.amountCents),
                            style = MaterialTheme.typography.displayMedium.copy(fontWeight = FontWeight.Bold),
                            color = MaterialTheme.colorScheme.primary,
                        )
                        Spacer(Modifier.height(24.dp))
                        Text(
                            text = "请选择支付渠道",
                            style = MaterialTheme.typography.titleSmall,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 8.dp),
                        )
                        CHANNELS.forEach { channel ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                RadioButton(
                                    selected = s.data.selectedChannel == channel.id,
                                    onClick = { vm.selectChannel(channel.id) },
                                )
                                Icon(channel.icon, contentDescription = null)
                                Text(
                                    text = channel.label,
                                    style = MaterialTheme.typography.bodyLarge,
                                    modifier = Modifier.padding(start = 8.dp),
                                )
                            }
                        }
                        Spacer(Modifier.height(24.dp))
                        PrimaryButton(
                            text = "模拟支付成功",
                            onClick = vm::mockSucceed,
                            loading = s.data.submitting,
                            modifier = Modifier.fillMaxWidth().height(56.dp),
                        )
                        Spacer(Modifier.height(12.dp))
                        DangerButton(
                            text = "模拟支付失败",
                            onClick = vm::mockFail,
                            loading = s.data.submitting,
                            modifier = Modifier.fillMaxWidth().height(48.dp),
                        )
                        Spacer(Modifier.height(24.dp))
                        Text(
                            text = "取消支付",
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.outline,
                            modifier = Modifier.padding(8.dp),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun WarningBanner() {
    Surface(
        color = MaterialTheme.colorScheme.errorContainer,
        shape = RoundedCornerShape(8.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Text(
            text = "⚠ 模拟支付 · 请勿真实付款\n仅供开发调试使用",
            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
            color = MaterialTheme.colorScheme.onErrorContainer,
            textAlign = TextAlign.Center,
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
        )
    }
}
