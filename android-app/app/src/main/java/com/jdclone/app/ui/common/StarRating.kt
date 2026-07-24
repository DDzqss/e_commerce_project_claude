package com.jdclone.app.ui.common

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.StarBorder
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** 1..5 星静态展示。Phase 6 只读，不做点击交互。 */
@Composable
fun StarRating(
    rating: Int,
    modifier: Modifier = Modifier,
    starSize: Dp = 16.dp,
    activeColor: Color = MaterialTheme.colorScheme.tertiary,
) {
    Row(modifier = modifier, verticalAlignment = Alignment.CenterVertically) {
        val clamped = rating.coerceIn(0, 5)
        repeat(5) { index ->
            val filled = index < clamped
            Icon(
                imageVector = if (filled) Icons.Filled.Star else Icons.Outlined.StarBorder,
                contentDescription = null,
                tint = if (filled) activeColor else MaterialTheme.colorScheme.outline,
                modifier = Modifier.size(starSize),
            )
        }
    }
}
