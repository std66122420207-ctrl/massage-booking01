# Keep Flutter generated classes
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.embedding.** { *; }
-keep class io.flutter.plugins.** { *; }

# Keep Firebase/Google services classes commonly used by the app
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }

# Keep app model classes used by reflection or serialization
-keepattributes *Annotation*
-keep class com.massagebooking.app.** { *; }
