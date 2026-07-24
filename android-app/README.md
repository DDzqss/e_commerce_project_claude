# JD Clone Android App

Consumer-facing Android client for the **JD Clone** e-commerce platform.

## 技术栈

- **语言**：Kotlin 2.0
- **UI**：Jetpack Compose (Material 3)
- **构建**：Android Gradle Plugin 8.7 / Gradle 8.10 / Kotlin 2.0 / KSP
- **网络**：Retrofit + OkHttp + kotlinx.serialization
- **DI**：Hilt
- **图片**：Coil 3
- **异步**：Kotlin Coroutines + Flow
- **本地存储**：DataStore Preferences（Room 待引入）
- **导航**：Navigation Compose

依赖版本集中在 [`gradle/libs.versions.toml`](gradle/libs.versions.toml)。

## SDK 版本

| 项 | 版本 |
|---|---|
| compileSdk | 35 |
| targetSdk  | 35 |
| minSdk     | 24 |
| JVM target | 17 |

## 环境要求

- **Android Studio** Hedgehog (2023.1.1) 或更新版本，推荐 Ladybug (2024.2.1+)
- **JDK 17**（Android Studio 内置）
- Android SDK Platform 35 + Build-Tools 35.x
- 一台运行 Android 7.0 (API 24) 或更高的模拟器/真机

## 首次打开

1. 用 Android Studio 选择 **Open**，指向本目录 (`android-app/`)。
2. Android Studio 会提示 *Gradle wrapper missing*——直接同意 **Reload Gradle Project** 让 IDE 自动补齐 `gradlew`、`gradlew.bat`、`gradle/wrapper/gradle-wrapper.jar`（由 `gradle/wrapper/gradle-wrapper.properties` 声明 Gradle 8.10.2）。
3. 或者在命令行执行一次 `gradle wrapper --gradle-version 8.10.2`（需本机已装 Gradle）。
4. Sync 完成后即可 **Run 'app'**。

> 本目录**未提交 Gradle wrapper 二进制**，请按上一步生成。

## 后端 BASE_URL

- 默认值：`http://10.0.2.2:8000/api/v1/`  （`10.0.2.2` 是 Android 模拟器指向宿主机 loopback 的特殊别名）
- 定义在 `app/build.gradle.kts` 的 `buildConfigField("String", "BASE_URL", ...)`，运行时通过 `BuildConfig.BASE_URL` 读取。
- **真机调试**：需要改成宿主机在局域网中的 IP，并确保后端监听 `0.0.0.0`。
- **正式环境**：后续通过 `productFlavors` 或 `buildTypes` 覆盖。
- **明文 HTTP**：`AndroidManifest.xml` 已声明 `usesCleartextTraffic="true"` 便于本地联调；正式发布前请切换为 HTTPS 并移除该属性。

## 目录结构

```
android-app/
├── app/
│   ├── build.gradle.kts
│   ├── proguard-rules.pro
│   └── src/
│       ├── main/
│       │   ├── AndroidManifest.xml
│       │   ├── java/com/jdclone/app/
│       │   │   ├── JDCloneApplication.kt   # @HiltAndroidApp
│       │   │   ├── MainActivity.kt         # 单 Activity 承载 Compose
│       │   │   ├── data/network/           # Retrofit + Hilt module
│       │   │   └── ui/
│       │   │       ├── App.kt              # Scaffold + 底部导航 + NavHost
│       │   │       ├── theme/              # Material3 Theme / Color / Type
│       │   │       └── screen/             # home / category / cart / profile
│       │   └── res/
│       ├── test/                           # JVM 单元测试
│       └── androidTest/                    # 设备/模拟器 Instrumentation 测试
├── gradle/
│   ├── libs.versions.toml                  # 版本目录（唯一真源）
│   └── wrapper/gradle-wrapper.properties   # Gradle 8.10.2
├── build.gradle.kts                        # 根级 plugins 声明
├── settings.gradle.kts                     # rootProject.name = "JDCloneApp"
├── gradle.properties
└── README.md
```

## 常用命令（wrapper 生成后可用）

```bash
# 单元测试
./gradlew testDebugUnitTest

# 装机 debug APK
./gradlew installDebug

# 组装 release
./gradlew assembleRelease

# 代码风格（引入 ktlint 后启用）
# ./gradlew ktlintCheck
```

## 与主项目的关系

本模块对应 [`docs/DEVELOPMENT_PLAN.md`](../docs/DEVELOPMENT_PLAN.md) Phase 6 与 [`AGENTS.md`](../AGENTS.md) 第 3.3 / 4.7 节所列的 `feature/android-*` 分支。开发规范、Commit / PR 规范、代码红线均以那两份文档为准。
