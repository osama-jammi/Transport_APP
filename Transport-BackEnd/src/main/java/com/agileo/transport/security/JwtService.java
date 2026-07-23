package com.agileo.transport.security;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Émission et vérification des jetons JWT propres au backend (HS256), utilisés
 * par l'app mobile (superviseur + chauffeur) — indépendamment de Keycloak.
 *
 * Le web continue d'utiliser Keycloak (RS256) ; le {@code DelegatingJwtDecoder}
 * de {@link com.agileo.transport.config.SecurityConfig} aiguille selon l'algo.
 */
@Service
public class JwtService {

    /** Émetteur des jetons backend (distinct de l'émetteur Keycloak). */
    public static final String ISSUER = "transport-backend";

    private final JwtEncoder encoder;
    private final JwtDecoder decoder;
    private final long expirationDays;

    public JwtService(@Value("${app.jwt.secret}") String secret,
                      @Value("${app.jwt.expiration-days:365}") long expirationDays) {
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            throw new IllegalStateException(
                    "app.jwt.secret doit faire au moins 32 caractères (clé HS256).");
        }
        SecretKey key = new SecretKeySpec(keyBytes, "HmacSHA256");
        this.encoder = new NimbusJwtEncoder(new ImmutableSecret<>(key));
        this.decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
        this.expirationDays = expirationDays;
    }

    /**
     * Génère un jeton HS256 pour le mobile.
     *
     * @param subject identifiant logique (ex. "chauffeur:12", "superviseur:3")
     * @param role    rôle applicatif (ex. CHAUFFEUR, SUPERVISEUR, ADMIN)
     */
    public String generer(String subject, String role, String nom, String prenom) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(ISSUER)
                .issuedAt(now)
                .expiresAt(now.plus(expirationDays, ChronoUnit.DAYS))
                .subject(subject)
                .claim("roles", List.of(role))
                .claim("nom", nom == null ? "" : nom)
                .claim("prenom", prenom == null ? "" : prenom)
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }

    /** Décodeur des jetons backend (HS256) — utilisé par le resource server. */
    public JwtDecoder getDecoder() {
        return decoder;
    }
}
