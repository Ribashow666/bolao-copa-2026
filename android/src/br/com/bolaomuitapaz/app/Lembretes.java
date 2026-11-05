package br.com.bolaomuitapaz.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.webkit.JavascriptInterface;

import org.json.JSONArray;
import org.json.JSONObject;

// Recebe do site (main.js → montarLembretes) a lista completa de lembretes e agenda no Android.
// Cada lista nova substitui a anterior; ela fica salva pra ser reagendada quando o celular reinicia.
public class Lembretes {
    static final String PREFS = "lembretes";
    static final int MAX = 60;           // mesmo limite do lembretes.js
    static final int MAX_TEXTO = 300;
    final Context ctx;

    Lembretes(Context c) { ctx = c.getApplicationContext(); }

    @JavascriptInterface
    public void agendar(String json) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        cancelar(ctx, p.getString("json", "[]"));
        p.edit().putString("json", json).apply();
        agendarTodos(ctx, json);
    }

    // Endereço deste celular no Firebase Cloud Messaging ("" enquanto não chegou). O site guarda na conta logada.
    @JavascriptInterface
    public String tokenPush() {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("token", "");
    }

    static void salvarToken(Context c, String token) {
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("token", token).apply();
    }

    static void agendarSalvos(Context c) {
        agendarTodos(c, c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("json", "[]"));
    }

    static void agendarTodos(Context c, String json) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        long agora = System.currentTimeMillis();
        // Android 12+ pode negar alarme exato: aí usa o inexato (pode atrasar alguns minutos)
        boolean exato = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
        try {
            JSONArray a = new JSONArray(json);
            for (int i = 0; i < Math.min(a.length(), MAX); i++) {
                JSONObject o = a.getJSONObject(i);
                long quando = o.getLong("quando");
                if (quando <= agora) continue;
                PendingIntent pi = alarme(c, o);
                if (exato) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, quando, pi);
                else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, quando, pi);
            }
        } catch (Exception e) { /* lista inválida: ignora, a próxima abertura do app manda de novo */ }
    }

    static void cancelar(Context c, String json) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        try {
            JSONArray a = new JSONArray(json);
            for (int i = 0; i < a.length(); i++) am.cancel(alarme(c, a.getJSONObject(i)));
        } catch (Exception e) { }
    }

    // O id do lembrete vira o código do alarme: o mesmo id sempre aponta pro mesmo alarme (dá pra cancelar)
    static PendingIntent alarme(Context c, JSONObject o) {
        String id = o.optString("id");
        Intent i = new Intent(c, Alarme.class)
            .putExtra("id", id.hashCode())
            .putExtra("titulo", corta(o.optString("titulo")))
            .putExtra("texto", corta(o.optString("texto")));
        return PendingIntent.getBroadcast(c, id.hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static String corta(String s) { return s.length() > MAX_TEXTO ? s.substring(0, MAX_TEXTO) : s; }
}
