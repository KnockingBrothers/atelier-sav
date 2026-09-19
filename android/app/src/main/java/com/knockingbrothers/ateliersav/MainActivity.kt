package com.knockingbrothers.ateliersav

import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.floatingactionbutton.FloatingActionButton

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var ipLayout: LinearLayout
    private lateinit var ipEditText: EditText
    private lateinit var timeoutEditText: EditText
    private lateinit var errorText: TextView
    private lateinit var scanFab: FloatingActionButton

    // Fermeture automatique de l'appli après N minutes d'inactivité tactile
    // (valeur réglable dans l'écran de connexion, par défaut 2 minutes)
    private val inactivityHandler = Handler(Looper.getMainLooper())
    private var inactivityTimeoutMs = 120_000L
    private val inactivityRunnable = Runnable { finish() }

    private fun resetInactivityTimer() {
        inactivityHandler.removeCallbacks(inactivityRunnable)
        inactivityHandler.postDelayed(inactivityRunnable, inactivityTimeoutMs)
    }

    override fun dispatchTouchEvent(ev: MotionEvent?): Boolean {
        resetInactivityTimer()
        return super.dispatchTouchEvent(ev)
    }

    private val scanLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_OK) {
            val code = result.data?.getStringExtra(BarcodeScannerActivity.EXTRA_SCANNED_CODE)
            if (!code.isNullOrEmpty()) {
                injectScannedCode(code)
            }
        }
    }

    companion object {
        const val PORT = "3001"
        const val PREFS = "atelier_sav_prefs"
        const val KEY_IP = "server_ip"
        const val KEY_TIMEOUT_MINUTES = "inactivity_timeout_minutes"
        const val DEFAULT_TIMEOUT_MINUTES = 2
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webview)
        ipLayout = findViewById(R.id.ip_input_layout)
        ipEditText = findViewById(R.id.ip_edit_text)
        timeoutEditText = findViewById(R.id.timeout_edit_text)
        errorText = findViewById(R.id.error_text)
        scanFab = findViewById(R.id.scan_fab)
        val saveButton = findViewById<Button>(R.id.save_ip_button)

        setupWebView()

        scanFab.setOnClickListener {
            val intent = Intent(this, BarcodeScannerActivity::class.java)
            scanLauncher.launch(intent)
        }

        // Appui long sur la WebView pour changer l'IP plus tard
        webView.setOnLongClickListener {
            showIpInput(prefill = true)
            true
        }

        val prefs = getSharedPreferences(PREFS, MODE_PRIVATE)
        val savedIp = prefs.getString(KEY_IP, null)
        val savedTimeoutMinutes = prefs.getInt(KEY_TIMEOUT_MINUTES, DEFAULT_TIMEOUT_MINUTES)
        inactivityTimeoutMs = savedTimeoutMinutes * 60_000L
        timeoutEditText.setText(savedTimeoutMinutes.toString())

        if (savedIp != null) {
            loadServer(savedIp)
        } else {
            showIpInput()
        }

        resetInactivityTimer()

        saveButton.setOnClickListener {
            val ip = ipEditText.text.toString().trim()
            val timeoutMinutes = timeoutEditText.text.toString().trim().toIntOrNull()
                ?.coerceAtLeast(1) ?: DEFAULT_TIMEOUT_MINUTES
            if (ip.isNotEmpty()) {
                prefs.edit()
                    .putString(KEY_IP, ip)
                    .putInt(KEY_TIMEOUT_MINUTES, timeoutMinutes)
                    .apply()
                inactivityTimeoutMs = timeoutMinutes * 60_000L
                resetInactivityTimer()
                loadServer(ip)
            }
        }
    }

    override fun onResume() {
        super.onResume()
        // Si on est actuellement sur l'écran WebView et que le WiFi a été coupé
        // entre-temps (mise en veille, changement de réseau...), on repasse en KO.
        if (webView.visibility == View.VISIBLE && !isWifiConnected()) {
            showWifiKo()
        }
    }

    private fun isWifiConnected(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork ?: return false
        val capabilities = cm.getNetworkCapabilities(network) ?: return false
        return capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
    }

    private fun showWifiKo() {
        ipLayout.visibility = View.VISIBLE
        webView.visibility = View.GONE
        scanFab.visibility = View.GONE
        errorText.text = "KO : Wi-Fi non connecté. Activez le Wi-Fi et réessayez."
        errorText.visibility = View.VISIBLE
    }

    private fun setupWebView() {
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.addJavascriptInterface(object {
            @JavascriptInterface
            fun setKeepScreenOn(keepOn: Boolean) {
                runOnUiThread {
                    if (keepOn) {
                        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                    } else {
                        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                    }
                }
            }
        }, "AndroidBridge")
        webView.webViewClient = object : WebViewClient() {

            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val url = request?.url?.toString() ?: return false
                // Les schémas spéciaux (sms:, tel:, mailto:...) ne sont pas des
                // pages web — la WebView ne peut pas les "charger" elle-même.
                // On les délègue à l'application externe adaptée (Messages, Téléphone...).
                if (!url.startsWith("http://") && !url.startsWith("https://")) {
                    return try {
                        val intent = Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url))
                        startActivity(intent)
                        true
                    } catch (e: Exception) {
                        // Aucune application ne gère ce lien (ex: pas d'appli SMS installée)
                        true
                    }
                }
                return false
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true) {
                    runOnUiThread {
                        showIpInput(prefill = true)
                        scanFab.visibility = View.GONE
                        errorText.text = "Connexion impossible. Vérifiez l'adresse IP et le réseau."
                        errorText.visibility = View.VISIBLE
                    }
                }
            }
        }
    }

    private fun loadServer(ip: String) {
        if (!isWifiConnected()) {
            showWifiKo()
            return
        }
        errorText.visibility = View.GONE
        ipLayout.visibility = View.GONE
        webView.visibility = View.VISIBLE
        scanFab.visibility = View.VISIBLE
        webView.loadUrl("http://$ip:$PORT")
    }

    private fun showIpInput(prefill: Boolean = false) {
        val prefs = getSharedPreferences(PREFS, MODE_PRIVATE)
        if (prefill) {
            ipEditText.setText(prefs.getString(KEY_IP, ""))
            timeoutEditText.setText(prefs.getInt(KEY_TIMEOUT_MINUTES, DEFAULT_TIMEOUT_MINUTES).toString())
        }
        ipLayout.visibility = View.VISIBLE
        webView.visibility = View.GONE
        scanFab.visibility = View.GONE
    }

    /**
     * Reproduit fidèlement le comportement d'une douchette USB : l'app web
     * écoute un keydown global sur `window` et reconstitue un buffer tant que
     * les frappes s'enchaînent à moins de 300ms d'intervalle, puis vérifie le
     * buffer (14 chiffres = ean14) à la réception d'un Entrée. On simule donc
     * une frappe rafale de chaque chiffre du code scanné, suivie d'un Entrée.
     */
    private fun injectScannedCode(code: String) {
        val escaped = code.replace("\\", "\\\\").replace("'", "\\'")
        val js = """
            (function() {
                var code = '$escaped';
                var i = 0;

                function sendKey(key) {
                    var evt = new KeyboardEvent('keydown', { key: key, bubbles: true, cancelable: true });
                    window.dispatchEvent(evt);
                }

                function sendNext() {
                    if (i < code.length) {
                        sendKey(code.charAt(i));
                        i++;
                        setTimeout(sendNext, 15);
                    } else {
                        setTimeout(function() { sendKey('Enter'); }, 15);
                    }
                }

                sendNext();
            })();
        """.trimIndent()
        webView.evaluateJavascript(js, null)
    }

    override fun onBackPressed() {
        if (webView.visibility == View.VISIBLE && webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        inactivityHandler.removeCallbacks(inactivityRunnable)
        super.onDestroy()
    }
}
