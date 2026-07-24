package com.jdclone.app.ui.common

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Image
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import coil3.compose.SubcomposeAsyncImage
import coil3.request.ImageRequest
import com.jdclone.app.BuildConfig

/**
 * 远程图 —— 后端返回的是 MinIO object_key，我们拼上 CDN 前缀渲染。
 *
 * - null/blank → 直接展示占位
 * - 加载失败 → 占位
 * - 已经是完整 http(s) URL → 直接用
 */
@Composable
fun RemoteImage(
    objectKey: String?,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Crop,
    cornerRadiusDp: Int = 8,
    contentDescription: String? = null,
) {
    val shape = RoundedCornerShape(cornerRadiusDp.dp)
    if (objectKey.isNullOrBlank()) {
        PlaceholderBox(modifier = modifier.clip(shape))
        return
    }
    val url = if (objectKey.startsWith("http")) objectKey else BuildConfig.IMAGE_CDN + objectKey
    SubcomposeAsyncImage(
        model = ImageRequest.Builder(androidx.compose.ui.platform.LocalContext.current)
            .data(url)
            .build(),
        contentDescription = contentDescription,
        modifier = modifier.clip(shape),
        contentScale = contentScale,
        loading = { PlaceholderBox(modifier = Modifier.fillMaxSize()) },
        error = { PlaceholderBox(modifier = Modifier.fillMaxSize()) },
    )
}

@Composable
private fun PlaceholderBox(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier.background(MaterialTheme.colorScheme.surfaceVariant),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = Icons.Outlined.Image,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.outline,
            modifier = Modifier.size(28.dp),
        )
    }
}
