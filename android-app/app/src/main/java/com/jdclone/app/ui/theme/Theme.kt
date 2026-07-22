package com.jdclone.app.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

private val LightColors = lightColorScheme(
    primary = JDRed,
    onPrimary = Color.White,
    primaryContainer = JDRedLight,
    onPrimaryContainer = Color.White,
    secondary = JDOrange,
    onSecondary = Color.White,
    tertiary = JDGold,
    background = NeutralBackground,
    onBackground = NeutralOnSurface,
    surface = NeutralSurface,
    onSurface = NeutralOnSurface,
    outline = NeutralOutline,
)

private val DarkColors = darkColorScheme(
    primary = JDRedLight,
    onPrimary = Color.Black,
    primaryContainer = JDRedDark,
    onPrimaryContainer = Color.White,
    secondary = JDOrange,
    onSecondary = Color.Black,
    tertiary = JDGold,
    background = DarkBackground,
    onBackground = DarkOnSurface,
    surface = DarkSurface,
    onSurface = DarkOnSurface,
)

/**
 * Root Material 3 theme for the JD Clone app.
 *
 * @param useDynamicColor opt-in to Material You dynamic colors on Android 12+.
 *   Defaults to `false` so the brand palette above is preserved.
 */
@Composable
fun JDCloneTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    useDynamicColor: Boolean = false,
    content: @Composable () -> Unit,
) {
    val colorScheme = when {
        useDynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColors
        else -> LightColors
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = JDCloneTypography,
        content = content,
    )
}
