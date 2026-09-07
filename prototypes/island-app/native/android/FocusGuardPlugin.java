package io.starnova.hearth;

import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;

/**
 * Focus shield for Hearth Island sessions.
 *
 * enableDnd/disableDnd: flips Do Not Disturb (interruption filter) for the
 * length of a focus session, restoring whatever filter was active before.
 * Needs the one-time "Do Not Disturb access" grant; if it is missing we
 * open that settings screen and resolve { granted: false } so the web side
 * can tell the person the next session will be silent.
 *
 * startAppBlock/stopAppBlock: runs AppBlockService, which watches the
 * foreground app and covers blocked ones with a gentle shield overlay.
 * Needs Usage Access + "display over other apps"; missing grants open the
 * matching settings screens the same way.
 */
@CapacitorPlugin(name = "FocusGuard")
public class FocusGuardPlugin extends Plugin {
    private Integer prevFilter = null;

    /** what this build can actually deliver — the web side renders from this */
    @PluginMethod
    public void capabilities(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("dnd", true);
        ret.put("block", true);
        ret.put("needsPicker", false);   /* Android blocks by package name */
        ret.put("chosen", 0);
        call.resolve(ret);
    }

    /** Android grants are requested inline by start*, so nothing to do here */
    @PluginMethod
    public void requestAccess(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void enableDnd(PluginCall call) {
        NotificationManager nm =
            (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        JSObject ret = new JSObject();
        if (!nm.isNotificationPolicyAccessGranted()) {
            Intent i = new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            ret.put("granted", false);
            call.resolve(ret);
            return;
        }
        prevFilter = nm.getCurrentInterruptionFilter();
        nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_PRIORITY);
        ret.put("granted", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void disableDnd(PluginCall call) {
        NotificationManager nm =
            (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm.isNotificationPolicyAccessGranted()) {
            nm.setInterruptionFilter(
                prevFilter != null ? prevFilter : NotificationManager.INTERRUPTION_FILTER_ALL);
        }
        prevFilter = null;
        call.resolve();
    }

    @PluginMethod
    public void startAppBlock(PluginCall call) {
        Context ctx = getContext();
        boolean usage = AppBlockService.hasUsageAccess(ctx);
        boolean overlay = Settings.canDrawOverlays(ctx);
        JSObject ret = new JSObject();
        if (!usage) {
            Intent i = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
        } else if (!overlay) {
            Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + ctx.getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
        }
        if (!usage || !overlay) {
            ret.put("granted", false);
            call.resolve(ret);
            return;
        }
        ArrayList<String> pkgs = new ArrayList<>();
        try {
            for (Object o : call.getArray("packages").toList()) pkgs.add(String.valueOf(o));
        } catch (Exception ignored) { }
        Intent svc = new Intent(ctx, AppBlockService.class);
        svc.putStringArrayListExtra("packages", pkgs);
        ContextCompat.startForegroundService(ctx, svc);
        ret.put("granted", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void stopAppBlock(PluginCall call) {
        getContext().stopService(new Intent(getContext(), AppBlockService.class));
        call.resolve();
    }
}
