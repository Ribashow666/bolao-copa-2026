package br.com.bolaomuitapaz.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

// O Android apaga os alarmes quando o celular reinicia: reagenda a última lista salva.
// Separado do Alarme porque precisa ser "exported" (o sistema chama) e não deve aceitar notificação de fora.
public class Reinicio extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(i.getAction())) Lembretes.agendarSalvos(c);
    }
}
