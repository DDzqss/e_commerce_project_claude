package com.jdclone.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.jdclone.app.ui.App
import com.jdclone.app.ui.theme.JDCloneTheme
import dagger.hilt.android.AndroidEntryPoint

/**
 * Single-activity host for the JD Clone Compose UI.
 */
@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            JDCloneTheme {
                App()
            }
        }
    }
}
