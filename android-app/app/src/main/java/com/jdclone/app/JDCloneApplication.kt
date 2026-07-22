package com.jdclone.app

import android.app.Application
import dagger.hilt.android.HiltAndroidApp

/**
 * Application entry-point for the JD Clone consumer app.
 *
 * Marked with [HiltAndroidApp] so Dagger/Hilt can generate the
 * top-level dependency container used by activities, view-models
 * and other Android components.
 */
@HiltAndroidApp
class JDCloneApplication : Application()
