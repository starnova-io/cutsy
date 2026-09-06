package io.starnova.hearth;

import android.app.AppOpsManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.Process;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.HashSet;
import java.util.List;

/**
 * Foreground service that keeps a focus session honest: every ~800ms it asks
 * UsageStatsManager which app is in front, and if it is on the blocklist it
 * covers the screen with a gentle full-screen shield (aubergine, a kind
 * message, one button back to Hearth). The shield lifts the moment the
 * blocked app is no longer in front, and the whole service stops when the
 * session ends (stopAppBlock) or the person swipes the notification away.
 */
public class AppBlockService extends Service {
    private static final String CHANNEL = "hearth_focus_shield";
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final HashSet<String> blocked = new HashSet<>();
    private LinearLayout shield;
    private WindowManager wm;
    private final Runnable tick = new Runnable() {
        @Override public void run() {
            String fg = foregroundPackage();
            if (fg != null && blocked.contains(fg)) showShield();
            else hideShield();
            handler.postDelayed(this, 800);
        }
    };

    static boolean hasUsageAccess(Context ctx) {
        AppOpsManager ops = (AppOpsManager) ctx.getSystemService(Context.APP_OPS_SERVICE);
        int mode = ops.unsafeCheckOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.getPackageName());
        return mode == AppOpsManager.MODE_ALLOWED;
    }

    @Override public IBinder onBind(Intent intent) { return null; }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        blocked.clear();
        if (intent != null) {
            List<String> pkgs = intent.getStringArrayListExtra("packages");
            if (pkgs != null) blocked.addAll(pkgs);
        }
        wm = (WindowManager) getSystemService(WINDOW_SERVICE);
        startForeground(1, buildNotification());
        handler.removeCallbacks(tick);
        handler.post(tick);
        return START_STICKY;
    }

    @Override public void onDestroy() {
        handler.removeCallbacks(tick);
        hideShield();
        super.onDestroy();
    }

    private Notification buildNotification() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            nm.createNotificationChannel(new NotificationChannel(
                CHANNEL, "Focus shield", NotificationManager.IMPORTANCE_LOW));
        }
        Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CHANNEL) : new Notification.Builder(this);
        return b.setContentTitle("Focus session running")
            .setContentText("Hearth is keeping distracting apps quiet.")
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setOngoing(true)
            .build();
    }

    private String foregroundPackage() {
        UsageStatsManager usm = (UsageStatsManager) getSystemService(Context.USAGE_STATS_SERVICE);
        long now = System.currentTimeMillis();
        UsageEvents events = usm.queryEvents(now - 3000, now);
        UsageEvents.Event e = new UsageEvents.Event();
        String last = null;
        int fgType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            ? UsageEvents.Event.ACTIVITY_RESUMED : UsageEvents.Event.MOVE_TO_FOREGROUND;
        while (events.hasNextEvent()) {
            events.getNextEvent(e);
            if (e.getEventType() == fgType) last = e.getPackageName();
        }
        return last;
    }

    private void showShield() {
        if (shield != null) return;
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackgroundColor(Color.parseColor("#33273A"));
        int pad = (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, 32,
            getResources().getDisplayMetrics());
        root.setPadding(pad, pad, pad, pad);

        TextView title = new TextView(this);
        title.setText("Your island is growing 🌱");
        title.setTextColor(Color.parseColor("#F2EAEE"));
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 24);
        title.setTypeface(Typeface.create(Typeface.SERIF, Typeface.BOLD));
        title.setGravity(Gravity.CENTER);

        TextView sub = new TextView(this);
        sub.setText("This app is resting until your focus session ends.\nYour companion kept your spot warm.");
        sub.setTextColor(Color.parseColor("#A89AA6"));
        sub.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        sub.setGravity(Gravity.CENTER);
        sub.setPadding(0, pad / 2, 0, pad);

        Button back = new Button(this);
        back.setText("Back to Hearth");
        back.setAllCaps(false);
        back.setOnClickListener(v -> {
            Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (launch != null) {
                launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(launch);
            }
            hideShield();
        });

        root.addView(title);
        root.addView(sub);
        root.addView(back);

        WindowManager.LayoutParams lp = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE,
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT);
        try {
            wm.addView(root, lp);
            shield = root;
        } catch (Exception ignored) { /* overlay permission revoked mid-session */ }
    }

    private void hideShield() {
        if (shield == null) return;
        try { wm.removeView(shield); } catch (Exception ignored) { }
        shield = null;
    }
}
