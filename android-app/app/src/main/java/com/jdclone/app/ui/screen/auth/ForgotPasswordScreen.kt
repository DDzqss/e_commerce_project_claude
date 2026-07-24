package com.jdclone.app.ui.screen.auth

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.jdclone.app.ui.common.PrimaryButton
import com.jdclone.app.ui.common.UiState

@Composable
fun ForgotPasswordScreen(
    onDone: () -> Unit,
    onGoReset: (identifier: String) -> Unit,
    vm: AuthViewModel = hiltViewModel(),
) {
    var identifier by rememberSaveable { mutableStateOf("") }

    val mutation by vm.mutation.collectAsStateWithLifecycle()
    val effect by vm.effect.collectAsStateWithLifecycle()

    LaunchedEffect(effect) {
        val current = effect
        if (current is AuthEffect.Info && current.message.contains("验证码已发送")) {
            vm.clearEffect()
            onGoReset(identifier)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp)
            .verticalScroll(rememberScrollState()),
    ) {
        Text(
            text = "找回密码",
            style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
        )
        Text(
            text = "输入你的手机号或邮箱，我们会向对应通道发送验证码",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.outline,
            modifier = Modifier.padding(top = 8.dp, bottom = 24.dp),
        )
        OutlinedTextField(
            value = identifier,
            onValueChange = { identifier = it },
            label = { Text("手机号或邮箱") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            modifier = Modifier.fillMaxWidth(),
        )
        if (mutation is UiState.Error) {
            Text(
                text = (mutation as UiState.Error).message,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(top = 8.dp),
            )
        }
        Spacer(Modifier.height(20.dp))
        PrimaryButton(
            text = "发送验证码",
            onClick = { vm.forgotPassword(identifier) },
            loading = mutation is UiState.Loading,
            modifier = Modifier.fillMaxWidth().height(48.dp),
        )
        Spacer(Modifier.height(8.dp))
        TextButton(
            onClick = onDone,
            modifier = Modifier.align(Alignment.CenterHorizontally),
        ) { Text("返回登录") }
    }
}
