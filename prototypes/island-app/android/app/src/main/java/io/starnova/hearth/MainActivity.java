package io.starnova.hearth;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FocusGuardPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
