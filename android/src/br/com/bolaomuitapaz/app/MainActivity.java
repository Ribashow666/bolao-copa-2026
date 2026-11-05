package br.com.bolaomuitapaz.app;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.google.firebase.messaging.FirebaseMessaging;

// O app abre o site dentro do WebView do próprio Android (não usa o app do Chrome).
// Como carrega o site ao vivo, toda mudança no bolão aparece aqui sem gerar APK novo.
public class MainActivity extends Activity {
    static final String HOST = "bolaomuitapaz.com.br";
    static final String HOME = "https://" + HOST + "/";
    static final int ESCOLHER_FOTO = 1;
    static final String NOTIFICACOES = "android.permission.POST_NOTIFICATIONS";
    static final String SEM_INTERNET = "<html><body style='background:#06200E;color:#F0EDD8;font-family:sans-serif;"
        + "display:flex;flex-direction:column;align-items:center;justify-content:center;height:90vh;text-align:center'>"
        + "<div style='font-size:48px'>📡</div><h2>Sem conexão</h2><p style='color:#A8C4A0'>Confere a internet e tenta de novo.</p>"
        + "<button onclick=\"location.href='" + HOME + "'\" style='background:#C9A84C;border:0;border-radius:8px;"
        + "padding:12px 28px;font-size:16px;font-weight:bold'>Tentar de novo</button></body></html>";

    WebView web;
    ValueCallback<Uri[]> fotoCallback;

    @Override
    protected void onCreate(Bundle estado) {
        super.onCreate(estado);
        web = new WebView(this);
        web.setBackgroundColor(0xFF06200E);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true); // Firebase guarda o login aqui
        CookieManager.getInstance().setAcceptCookie(true);
        // window.BolaoApp no site: agenda os lembretes. Só o nosso domínio é aberto aqui dentro (links de fora vão pro navegador).
        web.addJavascriptInterface(new Lembretes(this), "BolaoApp");
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(NOTIFICACOES) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(new String[]{NOTIFICACOES}, 2);
        // Push: pede o endereço do celular; quando chegar, o site (registrarPush) guarda na conta
        FirebaseMessaging.getInstance().getToken().addOnSuccessListener(t -> Lembretes.salvarToken(this, t));

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (HOST.equals(u.getHost()) || "www.bolaomuitapaz.com.br".equals(u.getHost())) return false;
                // Link de fora (ESPN, WhatsApp...) abre no app certo, não dentro do bolão
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) { }
                return true;
            }

            @Override
            public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame()) v.loadDataWithBaseURL(null, SEM_INTERNET, "text/html", "utf-8", null);
            }
        });

        // Sem isso o botão "Escolher foto" do perfil não faz nada no WebView
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (fotoCallback != null) fotoCallback.onReceiveValue(null);
                fotoCallback = cb;
                try {
                    startActivityForResult(p.createIntent(), ESCOLHER_FOTO);
                } catch (Exception e) {
                    fotoCallback = null;
                    return false;
                }
                return true;
            }
        });

        if (estado != null) web.restoreState(estado);
        else web.loadUrl(HOME);
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == ESCOLHER_FOTO && fotoCallback != null) {
            fotoCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data));
            fotoCallback = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
        CookieManager.getInstance().flush();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }
}
