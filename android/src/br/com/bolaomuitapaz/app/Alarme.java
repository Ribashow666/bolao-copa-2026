package br.com.bolaomuitapaz.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

// Hora do lembrete: mostra a notificação. Tocar nela abre o app.
// mostrar() também é usado pelas notificações push (Push.java), pra ficarem com o mesmo visual.
public class Alarme extends BroadcastReceiver {
    static final String CANAL = "lembretes";
    static final String CANAL_PUSH = "bolao";

    @Override
    public void onReceive(Context c, Intent i) {
        mostrar(c, CANAL, i.getIntExtra("id", 0), i.getStringExtra("titulo"), i.getStringExtra("texto"));
    }

    static void mostrar(Context c, String canal, int id, String titulo, String texto) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) {
            String nome = CANAL.equals(canal) ? "Lembretes de palpite" : "Resultados, conquistas e Resenha";
            nm.createNotificationChannel(new NotificationChannel(canal, nome, NotificationManager.IMPORTANCE_HIGH));
            b = new Notification.Builder(c, canal);
        } else {
            b = new Notification.Builder(c).setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL);
        }
        Intent abrir = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        b.setSmallIcon(R.drawable.ic_notif)
         .setColor(0xFFC9A84C)
         .setContentTitle(titulo)
         .setContentText(texto)
         .setStyle(new Notification.BigTextStyle().bigText(texto))
         .setAutoCancel(true)
         .setContentIntent(PendingIntent.getActivity(c, 0, abrir, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        nm.notify(id, b.build());
    }
}
