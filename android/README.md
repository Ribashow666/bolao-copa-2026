# 📲 App Android do Bolão Muita Paz

App que abre o site (https://bolaomuitapaz.com.br) dentro do WebView do Android, sem precisar do Chrome. Como carrega o site ao vivo, **mudança no site não precisa de APK novo**.

- **Lembretes locais**: o site calcula (`js/lembretes.js`) e o app agenda no celular (`Lembretes.java`, `Alarme.java`, `Reinicio.java`).
- **Notificações push**: o robô (`robo/`) manda pelo Firebase Cloud Messaging e o app mostra (`Push.java`). O site registra o celular em `pushTokens/{uid}`.

## Gerar o APK

Precisa de Java 17+, Android SDK (platform 35, build-tools 35.0.0) e Gradle 8.10. Depois, no Git Bash:

```bash
./build.sh 4      # o número da versão tem que ser maior que o do APK anterior
```

## Fora do repositório (de propósito)

| Arquivo | Como conseguir |
|---|---|
| `bolao-release.jks` + `keystore-senha.txt` | A chave que assina o app. **Fica só com o dono, com backup.** Sem ela, um APK novo não instala por cima do atual. |
| `google-services.json` | `npx firebase-tools apps:sdkconfig ANDROID 1:331660975900:android:78da3d8cb0ee32082e24d9 -o google-services.json` |
| `local.properties` | Uma linha: `sdk.dir=C:/caminho/do/Android/sdk` |
