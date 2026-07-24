package com.jdclone.app.ui.screen.catalog

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
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.outlined.ShoppingCart
import androidx.compose.material.icons.outlined.Store
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.jdclone.app.data.network.dto.SpuDetailDto
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
fun ProductDetailScreen(
    onBack: () -> Unit,
    onGoCart: () -> Unit,
    onGoShop: (Long) -> Unit,
    onGoProduct: (Long) -> Unit,
    vm: ProductDetailViewModel = hiltViewModel(),
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
                title = { Text("商品详情") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")
                    }
                },
                actions = {
                    IconButton(onClick = onGoCart) {
                        Icon(Icons.Outlined.ShoppingCart, contentDescription = "购物车")
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
        bottomBar = {
            val current = (state as? UiState.Success)?.data
            if (current != null) {
                BottomActions(
                    onAddToCart = { vm.addToCart { /* handled via toast */ } },
                    loading = current.addingToCart,
                    outOfStock = current.selectedSku?.let { it.stock < current.quantity } ?: false,
                )
            }
        },
    ) { pad ->
        Box(modifier = Modifier.fillMaxSize().padding(pad)) {
            when (val s = state) {
                UiState.Loading -> LoadingScreen()
                is UiState.Error -> ErrorScreen(s.message, onRetry = vm::load)
                is UiState.Success -> DetailContent(
                    data = s.data,
                    onSelectSpec = vm::selectSpec,
                    onQuantityChange = vm::setQuantity,
                    onGoShop = onGoShop,
                    onGoProduct = onGoProduct,
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DetailContent(
    data: ProductDetailState,
    onSelectSpec: (String, String) -> Unit,
    onQuantityChange: (Int) -> Unit,
    onGoShop: (Long) -> Unit,
    onGoProduct: (Long) -> Unit,
) {
    val detail = data.detail
    val gallery = listOf(detail.mainImage) + detail.images
    val pagerState = rememberPagerState(pageCount = { gallery.size.coerceAtLeast(1) })

    LazyColumn(modifier = Modifier.fillMaxSize()) {
        item {
            Box(modifier = Modifier.fillMaxWidth().aspectRatio(1f)) {
                HorizontalPager(state = pagerState) { idx ->
                    RemoteImage(
                        objectKey = gallery.getOrNull(idx),
                        modifier = Modifier.fillMaxSize(),
                        cornerRadiusDp = 0,
                    )
                }
                // 页码指示
                Text(
                    text = "${pagerState.currentPage + 1}/${gallery.size}",
                    color = Color.White,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .padding(12.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                )
            }
        }
        item { TitleAndPrice(detail) }
        item { HorizontalDivider() }
        item {
            ShopBanner(
                name = detail.shop?.name ?: "商家店铺",
                onGoShop = { detail.shop?.id?.let(onGoShop) },
            )
        }
        item { HorizontalDivider() }
        item { SpecPicker(data, onSelectSpec) }
        item { QuantityPicker(data, onQuantityChange) }
        item { HorizontalDivider() }
        item {
            SectionHeader("商品详情")
            Text(
                text = detail.description ?: "暂无详情",
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            )
        }
        if (data.related.isNotEmpty()) {
            item { HorizontalDivider() }
            item { SectionHeader("相关推荐") }
            item {
                LazyRow(
                    modifier = Modifier.fillMaxWidth(),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    items(data.related, key = { it.id }) { rel ->
                        Card(
                            onClick = { onGoProduct(rel.id) },
                            modifier = Modifier.width(120.dp),
                        ) {
                            Column {
                                RemoteImage(
                                    objectKey = rel.mainImage,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .aspectRatio(1f),
                                    cornerRadiusDp = 4,
                                )
                                Text(
                                    rel.title,
                                    style = MaterialTheme.typography.bodySmall,
                                    maxLines = 2,
                                    overflow = TextOverflow.Ellipsis,
                                    modifier = Modifier.padding(6.dp),
                                )
                                PriceText(
                                    rel.minPriceCents,
                                    style = MaterialTheme.typography.bodySmall,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 4.dp),
                                )
                            }
                        }
                    }
                }
            }
        }
        item { Spacer(Modifier.height(24.dp)) }
    }
}

@Composable
private fun TitleAndPrice(detail: SpuDetailDto) {
    Column(modifier = Modifier.padding(16.dp)) {
        PriceText(
            priceCents = detail.minPriceCents,
            originalPriceCents = null,
            style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = detail.title,
            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
        )
        if (!detail.subtitle.isNullOrBlank()) {
            Text(
                text = detail.subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.outline,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
        Spacer(Modifier.height(6.dp))
        Text(
            text = "销量 ${detail.salesCount} · 浏览 ${detail.viewCount}",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.outline,
        )
    }
}

@Composable
private fun ShopBanner(name: String, onGoShop: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Surface(color = MaterialTheme.colorScheme.surfaceVariant) {
                Icon(
                    Icons.Outlined.Store,
                    contentDescription = null,
                    modifier = Modifier
                        .padding(6.dp)
                        .size(24.dp),
                )
            }
        }
        Spacer(Modifier.width(8.dp))
        Text(
            text = name,
            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
            modifier = Modifier.weight(1f),
        )
        SecondaryButton(text = "进店", onClick = onGoShop)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SpecPicker(
    data: ProductDetailState,
    onSelectSpec: (String, String) -> Unit,
) {
    val detail = data.detail
    if (detail.specAxes.isEmpty()) return
    Column(modifier = Modifier.padding(16.dp)) {
        detail.specAxes.forEach { axis ->
            Text(
                text = axis,
                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold),
                modifier = Modifier.padding(bottom = 6.dp),
            )
            val options = detail.skus.mapNotNull { it.specs[axis] }.distinct()
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(options) { option ->
                    val selected = data.selectedSpecs[axis] == option
                    FilterChip(
                        selected = selected,
                        onClick = { onSelectSpec(axis, option) },
                        label = { Text(option) },
                    )
                }
            }
            Spacer(Modifier.height(12.dp))
        }
        val sku = data.selectedSku
        if (sku != null) {
            Text(
                text = "已选 ${data.selectedSpecs.values.joinToString(" / ")} · 库存 ${sku.stock}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.outline,
            )
        } else {
            Text(
                text = "请选择规格",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error,
            )
        }
    }
}

@Composable
private fun QuantityPicker(
    data: ProductDetailState,
    onQuantityChange: (Int) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = "数量",
            style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold),
            modifier = Modifier.weight(1f),
        )
        IconButton(onClick = { onQuantityChange(data.quantity - 1) }, enabled = data.quantity > 1) {
            Icon(Icons.Filled.Remove, contentDescription = "减少")
        }
        Text(
            text = data.quantity.toString(),
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.padding(horizontal = 12.dp),
        )
        IconButton(onClick = { onQuantityChange(data.quantity + 1) }) {
            Icon(Icons.Filled.Add, contentDescription = "增加")
        }
    }
}

@Composable
private fun SectionHeader(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
    )
}

@Composable
private fun BottomActions(
    onAddToCart: () -> Unit,
    loading: Boolean,
    outOfStock: Boolean,
) {
    Surface(tonalElevation = 4.dp) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PrimaryButton(
                text = if (outOfStock) "库存不足" else "加入购物车",
                onClick = onAddToCart,
                loading = loading,
                enabled = !outOfStock,
                modifier = Modifier
                    .weight(1f)
                    .height(48.dp),
            )
        }
    }
}
