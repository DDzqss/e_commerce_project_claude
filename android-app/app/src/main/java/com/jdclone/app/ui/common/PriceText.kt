package com.jdclone.app.ui.common

import androidx.compose.foundation.layout.Row
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import java.util.Locale

/** 分转元展示 —— `9900` → `¥99.00`。 */
fun formatYuan(cents: Int): String = String.format(Locale.CHINA, "¥%.2f", cents / 100.0)

/**
 * 通用价格文本组件，可选划线原价。
 */
@Composable
fun PriceText(
    priceCents: Int,
    originalPriceCents: Int? = null,
    modifier: Modifier = Modifier,
    style: TextStyle = MaterialTheme.typography.titleMedium,
    priceColor: Color = MaterialTheme.colorScheme.primary,
) {
    Row(modifier = modifier, verticalAlignment = Alignment.CenterVertically) {
        Text(
            text = formatYuan(priceCents),
            style = style.copy(fontWeight = FontWeight.SemiBold),
            color = priceColor,
        )
        if (originalPriceCents != null && originalPriceCents > priceCents) {
            Text(
                text = "  ${formatYuan(originalPriceCents)}",
                style = MaterialTheme.typography.bodySmall.copy(
                    textDecoration = TextDecoration.LineThrough,
                ),
                color = MaterialTheme.colorScheme.outline,
            )
        }
    }
}

/** 单元素分转元；用于内联到其他文案。 */
@Composable
fun InlineYuan(cents: Int, style: TextStyle = LocalTextStyle.current) {
    Text(text = formatYuan(cents), style = style)
}
