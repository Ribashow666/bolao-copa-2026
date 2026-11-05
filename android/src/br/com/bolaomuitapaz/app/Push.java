package br.com.bolaomuitapaz.app;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

// Notificação mandada pelo robô (robo/robo.mjs no GitHub) pelo Firebase Cloud Messaging.
// Chega com o app aberto, fechado ou em segundo plano: o robô manda só "data" e quem monta a notificação é o app.
public class Push extends FirebaseMessagingService {
    @Override
    public void onMessageReceived(RemoteMessage m) {
        Map<String, String> d = m.getData();
        String titulo = d.get("titulo"), texto = d.get("texto"), tag = d.get("tag");
        if (titulo == null) return;
        // Mesma tag = substitui a anterior (ex: duas marcações seguidas na Resenha viram uma)
        Alarme.mostrar(this, Alarme.CANAL_PUSH, tag != null ? tag.hashCode() : (int) System.currentTimeMillis(), titulo, texto);
    }

    // Endereço do celular mudou: o site pega o novo na próxima abertura e guarda na conta (main.js → registrarPush)
    @Override
    public void onNewToken(String token) {
        Lembretes.salvarToken(this, token);
    }
}
