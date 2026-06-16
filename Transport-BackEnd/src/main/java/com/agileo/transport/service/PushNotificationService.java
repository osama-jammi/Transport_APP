package com.agileo.transport.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

/**
 * Envoi de notifications push via l'API Expo (https://exp.host/--/api/v2/push/send).
 * Fonctionne avec un "development build" / build standalone de l'app mobile
 * (les push distants ne sont pas supportés dans Expo Go).
 */
@Service
public class PushNotificationService {

    private static final Logger log = LoggerFactory.getLogger(PushNotificationService.class);
    private static final String EXPO_URL = "https://exp.host/--/api/v2/push/send";

    private final HttpClient http = HttpClient.newHttpClient();

    /** Envoi asynchrone : ne bloque jamais l'appel métier (création de voyage). */
    public void send(String token, String title, String body) {
        if (token == null || token.isBlank()) return;
        try {
            String json = "{"
                    + "\"to\":\"" + esc(token) + "\","
                    + "\"title\":\"" + esc(title) + "\","
                    + "\"body\":\"" + esc(body) + "\","
                    + "\"sound\":\"default\","
                    + "\"priority\":\"high\","
                    + "\"channelId\":\"default\""
                    + "}";
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(EXPO_URL))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json))
                    .build();
            http.sendAsync(req, HttpResponse.BodyHandlers.ofString())
                    .thenAccept(r -> log.debug("Push Expo -> {} : {}", r.statusCode(), r.body()))
                    .exceptionally(e -> { log.warn("Echec envoi push Expo : {}", e.getMessage()); return null; });
        } catch (Exception e) {
            log.warn("Echec preparation push Expo : {}", e.getMessage());
        }
    }

    private String esc(String s) {
        return s == null ? "" : s.replace("\\", "\\\\").replace("\"", "\\\"")
                .replace("\n", " ").replace("\r", " ");
    }
}
