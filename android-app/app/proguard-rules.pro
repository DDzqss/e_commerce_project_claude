# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.kts.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Keep classes annotated for Kotlinx Serialization.
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.SerializationKt
-keep,includedescriptorclasses class com.jdclone.app.**$$serializer { *; }
-keepclassmembers class com.jdclone.app.** {
    *** Companion;
}
-keepclasseswithmembers class com.jdclone.app.** {
    kotlinx.serialization.KSerializer serializer(...);
}
