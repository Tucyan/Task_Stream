package com.taskstream.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.content.SharedPreferences;
import android.provider.Settings;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private void ensureReminderChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager notificationManager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (notificationManager == null) return;

        String[] ids = new String[] { "reminders_v1_s1", "reminders_v1_s0", "reminders_v0_s1", "reminders_v0_s0" };
        SharedPreferences prefs = getSharedPreferences("taskstream_prefs", MODE_PRIVATE);
        boolean migrated = prefs.getBoolean("reminder_channels_migrated_v3", false);
        if (!migrated) {
            for (String id : ids) {
                try {
                    notificationManager.deleteNotificationChannel(id);
                } catch (Exception ignored) {
                }
            }
            prefs.edit().putBoolean("reminder_channels_migrated_v3", true).apply();
        }

        long[] vibrationPattern = new long[] { 0, 250, 200, 250, 200, 400 };
        AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build();
        Uri defaultSoundUri = Settings.System.DEFAULT_NOTIFICATION_URI;

        NotificationChannel v1s1 = new NotificationChannel("reminders_v1_s1", "Task Stream Reminders", NotificationManager.IMPORTANCE_HIGH);
        v1s1.enableVibration(true);
        v1s1.setVibrationPattern(vibrationPattern);
        v1s1.setSound(defaultSoundUri, audioAttributes);
        v1s1.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        notificationManager.createNotificationChannel(v1s1);

        NotificationChannel v1s0 = new NotificationChannel("reminders_v1_s0", "Task Stream Reminders (Vibrate)", NotificationManager.IMPORTANCE_HIGH);
        v1s0.enableVibration(true);
        v1s0.setVibrationPattern(vibrationPattern);
        v1s0.setSound(null, null);
        v1s0.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        notificationManager.createNotificationChannel(v1s0);

        NotificationChannel v0s1 = new NotificationChannel("reminders_v0_s1", "Task Stream Reminders (Sound)", NotificationManager.IMPORTANCE_HIGH);
        v0s1.enableVibration(false);
        v0s1.setSound(defaultSoundUri, audioAttributes);
        v0s1.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        notificationManager.createNotificationChannel(v0s1);

        NotificationChannel v0s0 = new NotificationChannel("reminders_v0_s0", "Task Stream Reminders (Silent)", NotificationManager.IMPORTANCE_LOW);
        v0s0.enableVibration(false);
        v0s0.setSound(null, null);
        v0s0.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        notificationManager.createNotificationChannel(v0s0);
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ensureReminderChannels();
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }
    }
}
