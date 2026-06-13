package com.limra.app;

import com.limra.restaurant.R;

import android.Manifest;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputType;
import android.view.View;
import android.webkit.GeolocationPermissions;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

public class MainActivity extends AppCompatActivity {

    private WebView mWebView;
    private SwipeRefreshLayout mSwipeRefresh;
    private LinearLayout mOfflineLayout;
    private LinearLayout mSplashLayout;
    private Button mBtnRetry;
    private Button mBtnTableOrder;

    private static final String BASE_URL = "https://vb9ucr22.insforge.site";
    private static final int LOCATION_PERMISSION_REQUEST = 1001;
    private String mPendingGeolocationOrigin = null;
    private GeolocationPermissions.Callback mPendingGeolocationCallback = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // Bind Views
        mWebView = findViewById(R.id.web_view);
        mSwipeRefresh = findViewById(R.id.swipe_refresh);
        mOfflineLayout = findViewById(R.id.offline_layout);
        mSplashLayout = findViewById(R.id.splash_layout);
        mBtnRetry = findViewById(R.id.btn_retry);
        mBtnTableOrder = findViewById(R.id.btn_table_order);

        // Configure Swipe Refresh
        mSwipeRefresh.setColorSchemeResources(R.color.gold);
        mSwipeRefresh.setOnRefreshListener(new SwipeRefreshLayout.OnRefreshListener() {
            @Override
            public void onRefresh() {
                mWebView.reload();
            }
        });

        // Setup WebView
        setupWebView();

        // Setup Buttons
        mBtnRetry.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                checkConnectionAndLoad();
            }
        });

        mBtnTableOrder.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showTableNumberDialog();
            }
        });

        // Check Connection and Load URL
        handleIntent(getIntent());
    }

    private void setupWebView() {
        WebSettings settings = mWebView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        
        // Add a unique user-agent tag so the website can identify the app if needed
        String defaultUserAgent = settings.getUserAgentString();
        settings.setUserAgentString(defaultUserAgent + " LimraAndroidApp/1.0");

        mWebView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                mOfflineLayout.setVisibility(View.GONE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                mSwipeRefresh.setRefreshing(false);
                
                // Hide splash overlay on initial load
                if (mSplashLayout.getVisibility() == View.VISIBLE) {
                    mSplashLayout.animate().alpha(0.0f).setDuration(500).withEndAction(new Runnable() {
                        @Override
                        public void run() {
                            mSplashLayout.setVisibility(View.GONE);
                        }
                    });
                }
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                // Show offline layout on connection failure
                mSwipeRefresh.setRefreshing(false);
                if (!isNetworkAvailable()) {
                    mOfflineLayout.setVisibility(View.VISIBLE);
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url == null) return false;

                // Handle WhatsApp
                if (url.startsWith("whatsapp:") || url.contains("wa.me") || url.contains("api.whatsapp.com")) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        startActivity(intent);
                    } catch (Exception e) {
                        Toast.makeText(MainActivity.this, "WhatsApp is not installed", Toast.LENGTH_SHORT).show();
                    }
                    return true;
                }

                // Handle Google Maps
                if (url.contains("maps.google") || url.contains("google.com/maps") || url.startsWith("geo:")) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        startActivity(intent);
                    } catch (Exception e) {
                        Toast.makeText(MainActivity.this, "Google Maps could not be opened", Toast.LENGTH_SHORT).show();
                    }
                    return true;
                }

                // Handle Phone calls
                if (url.startsWith("tel:")) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_DIAL, Uri.parse(url));
                        startActivity(intent);
                    } catch (Exception e) {
                        Toast.makeText(MainActivity.this, "Could not open dialer", Toast.LENGTH_SHORT).show();
                    }
                    return true;
                }

                // Handle Emails
                if (url.startsWith("mailto:")) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_SENDTO, Uri.parse(url));
                        startActivity(intent);
                    } catch (Exception e) {
                        Toast.makeText(MainActivity.this, "No email app installed", Toast.LENGTH_SHORT).show();
                    }
                    return true;
                }

                // Load all other links inside the WebView
                return false;
            }
        });

        mWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                // Handle Geolocation permissions gracefully
                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.ACCESS_FINE_LOCATION) 
                        == PackageManager.PERMISSION_GRANTED) {
                    callback.invoke(origin, true, false);
                } else {
                    mPendingGeolocationOrigin = origin;
                    mPendingGeolocationCallback = callback;
                    ActivityCompat.requestPermissions(MainActivity.this, 
                            new String[]{Manifest.permission.ACCESS_FINE_LOCATION}, 
                            LOCATION_PERMISSION_REQUEST);
                }
            }
        });
    }

    private void handleIntent(Intent intent) {
        if (intent == null) {
            checkConnectionAndLoad();
            return;
        }

        Uri data = intent.getData();
        if (data != null) {
            // Check if it's a deep link url
            String url = data.toString();
            if (isNetworkAvailable()) {
                mWebView.loadUrl(url);
            } else {
                mOfflineLayout.setVisibility(View.VISIBLE);
                mSplashLayout.setVisibility(View.GONE);
            }
        } else {
            checkConnectionAndLoad();
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    private void checkConnectionAndLoad() {
        if (isNetworkAvailable()) {
            mOfflineLayout.setVisibility(View.GONE);
            String currentUrl = mWebView.getUrl();
            if (currentUrl == null) {
                mWebView.loadUrl(BASE_URL);
            } else {
                mWebView.reload();
            }
        } else {
            mOfflineLayout.setVisibility(View.VISIBLE);
            mSplashLayout.setVisibility(View.GONE);
            mSwipeRefresh.setRefreshing(false);
        }
    }

    private boolean isNetworkAvailable() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm != null) {
            NetworkInfo activeNetwork = cm.getActiveNetworkInfo();
            return activeNetwork != null && activeNetwork.isConnectedOrConnecting();
        }
        return false;
    }

    private void showTableNumberDialog() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("🪑 Order from Table");
        builder.setMessage("Please enter your Table Number to order:");

        final EditText input = new EditText(this);
        input.setInputType(InputType.TYPE_CLASS_NUMBER);
        input.setHint("e.g. 5");
        builder.setView(input);

        builder.setPositiveButton("Open Menu", new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                String tableNum = input.getText().toString().trim();
                if (!tableNum.isEmpty()) {
                    String tableUrl = BASE_URL + "/table/?t=" + tableNum;
                    if (isNetworkAvailable()) {
                        mWebView.loadUrl(tableUrl);
                    } else {
                        mOfflineLayout.setVisibility(View.VISIBLE);
                    }
                } else {
                    Toast.makeText(MainActivity.this, "Please enter a valid table number", Toast.LENGTH_SHORT).show();
                }
            }
        });

        builder.setNegativeButton("Cancel", new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                dialog.cancel();
            }
        });

        AlertDialog dialog = builder.create();
        dialog.show();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == LOCATION_PERMISSION_REQUEST) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                if (mPendingGeolocationCallback != null && mPendingGeolocationOrigin != null) {
                    mPendingGeolocationCallback.invoke(mPendingGeolocationOrigin, true, false);
                }
            } else {
                if (mPendingGeolocationCallback != null && mPendingGeolocationOrigin != null) {
                    mPendingGeolocationCallback.invoke(mPendingGeolocationOrigin, false, false);
                }
                Toast.makeText(this, "Location permission is required to autofill delivery coordinates", Toast.LENGTH_LONG).show();
            }
            mPendingGeolocationCallback = null;
            mPendingGeolocationOrigin = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (mWebView.canGoBack()) {
            mWebView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
