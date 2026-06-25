package com.agileo.transport.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Chiffrement AES-GCM du contenu des QR codes chauffeur.
 *
 * Le QR encapsule "{TYPE}|{id}|{matricule}|{nom}" sous forme chiffrée : il est
 * impossible à forger sans la clé serveur, et n'est déchiffré que côté backend
 * au moment du scan (la clé ne quitte jamais le serveur). L'app ne fait que
 * transmettre la chaîne scannée.
 */
@Service
public class QrCipherService {

    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int IV_LENGTH = 12;          // 96 bits (recommandé pour GCM)
    private static final int TAG_LENGTH_BITS = 128;

    private final SecretKey key;
    private final SecureRandom random = new SecureRandom();

    public QrCipherService(@Value("${app.qr.aes-key}") String aesKey) {
        byte[] k = aesKey.getBytes(StandardCharsets.UTF_8);
        if (k.length != 16 && k.length != 24 && k.length != 32) {
            throw new IllegalStateException(
                    "app.qr.aes-key doit faire 16, 24 ou 32 caractères (AES-128/192/256).");
        }
        this.key = new SecretKeySpec(k, "AES");
    }

    /** Chiffre un texte clair → chaîne Base64 URL-safe (compacte, adaptée au QR). */
    public String chiffrer(String plain) {
        try {
            byte[] iv = new byte[IV_LENGTH];
            random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_LENGTH_BITS, iv));
            byte[] ct = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            byte[] out = new byte[iv.length + ct.length];
            System.arraycopy(iv, 0, out, 0, iv.length);
            System.arraycopy(ct, 0, out, iv.length, ct.length);
            return Base64.getUrlEncoder().withoutPadding().encodeToString(out);
        } catch (Exception e) {
            throw new RuntimeException("Erreur de chiffrement du QR", e);
        }
    }

    /** Déchiffre une chaîne produite par {@link #chiffrer}. Lève une exception si invalide/falsifié. */
    public String dechiffrer(String encoded) {
        try {
            byte[] in = Base64.getUrlDecoder().decode(encoded);
            byte[] iv = new byte[IV_LENGTH];
            System.arraycopy(in, 0, iv, 0, IV_LENGTH);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_LENGTH_BITS, iv));
            byte[] pt = cipher.doFinal(in, IV_LENGTH, in.length - IV_LENGTH);
            return new String(pt, StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalArgumentException("QR invalide ou falsifié");
        }
    }
}
