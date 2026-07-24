package com.jdclone.app.ui.screen.addresses

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.jdclone.app.ui.common.PrimaryButton

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddressEditScreen(
    onBack: () -> Unit,
    onSaved: () -> Unit,
    vm: AddressEditViewModel = hiltViewModel(),
) {
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(state.done) { if (state.done) onSaved() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (state.id == null) "新增地址" else "编辑地址") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")
                    }
                },
            )
        },
        bottomBar = {
            Surface(tonalElevation = 4.dp) {
                Row(modifier = Modifier.fillMaxWidth().padding(12.dp)) {
                    PrimaryButton(
                        text = "保存",
                        onClick = vm::submit,
                        loading = state.submitting,
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                    )
                }
            }
        },
    ) { pad ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(pad)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            OutlinedTextField(
                value = state.receiverName,
                onValueChange = { v -> vm.update { it.copy(receiverName = v) } },
                label = { Text("收件人姓名") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = state.receiverPhone,
                onValueChange = { v -> vm.update { it.copy(receiverPhone = v.filter { c -> c.isDigit() }) } },
                label = { Text("联系电话") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                modifier = Modifier.fillMaxWidth(),
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedTextField(
                    value = state.province,
                    onValueChange = { v -> vm.update { it.copy(province = v) } },
                    label = { Text("省") },
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                )
                OutlinedTextField(
                    value = state.city,
                    onValueChange = { v -> vm.update { it.copy(city = v) } },
                    label = { Text("市") },
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                )
                OutlinedTextField(
                    value = state.district,
                    onValueChange = { v -> vm.update { it.copy(district = v) } },
                    label = { Text("区/县") },
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                )
            }
            OutlinedTextField(
                value = state.detail,
                onValueChange = { v -> vm.update { it.copy(detail = v) } },
                label = { Text("详细地址") },
                modifier = Modifier.fillMaxWidth().height(80.dp),
            )
            OutlinedTextField(
                value = state.postalCode,
                onValueChange = { v -> vm.update { it.copy(postalCode = v.filter { c -> c.isDigit() }.take(10)) } },
                label = { Text("邮政编码（可选）") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                modifier = Modifier.fillMaxWidth(),
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("设为默认地址", modifier = Modifier.weight(1f))
                Switch(
                    checked = state.isDefault,
                    onCheckedChange = { v -> vm.update { it.copy(isDefault = v) } },
                )
            }
            if (state.error != null) {
                Text(
                    text = state.error ?: "",
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            Spacer(Modifier.height(72.dp))
        }
    }
}
