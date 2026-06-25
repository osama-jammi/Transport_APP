package com.agileo.transport.config;

import com.agileo.transport.security.JwtService;
import com.nimbusds.jwt.SignedJWT;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;

import java.text.ParseException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Sécurité de l'API Transport.
 *
 * Deux populations, deux émetteurs de jetons, mais UN SEUL resource server :
 *  • WEB / admin web  → jeton Keycloak (RS256, validé via JWKS).
 *  • MOBILE (superviseur + chauffeur) → jeton émis par le backend (HS256),
 *    obtenu via /api/mobile/auth/login (superviseur) ou /api/chauffeurs/connect
 *    (chauffeur, après déchiffrement du QR). Keycloak n'est JAMAIS appelé par le
 *    mobile.
 *
 * Le {@code DelegatingJwtDecoder} ci-dessous aiguille chaque jeton vers le bon
 * décodeur selon l'algorithme d'en-tête (HS256 → backend, sinon → Keycloak).
 *
 * Restent publics : les portes d'entrée (login superviseur, connect chauffeur),
 * les images QR (chargées via <img> sans en-tête Authorization) et les flags de
 * fonctionnalités (lus au démarrage de l'app).
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, JwtDecoder jwtDecoder) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(cors -> {})
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // Préflight CORS
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                // ───── Portes d'entrée PUBLIQUES (émission des jetons mobile) ─────
                .requestMatchers(HttpMethod.POST, "/api/mobile/auth/login").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/chauffeurs/connect").permitAll()

                // Flags de fonctionnalités : lus par l'app au démarrage (lecture seule)
                .requestMatchers(HttpMethod.GET, "/api/admin/features").permitAll()

                // Images QR (chargées via <img> / téléchargement → sans en-tête Authorization)
                .requestMatchers(HttpMethod.GET, "/api/articles/*/qrcode").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/articles/*/*/qrcode").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/voyages-conteneurs/*/qrcode").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/voyages-conteneurs/*/*/qrcode").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/chauffeurs/*/qrcode").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/chauffeurs/*/*/qrcode").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/chauffeurs/gap/*/qrcode").permitAll()

                // ───── Infrastructure publique ─────
                .requestMatchers("/swagger-ui/**", "/v3/api-docs/**", "/actuator/health", "/error").permitAll()

                // ───── Tout le reste : jeton valide obligatoire (Keycloak web OU backend mobile) ─────
                .anyRequest().authenticated()
            )
            .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> jwt
                    .decoder(jwtDecoder)
                    .jwtAuthenticationConverter(jwtAuthConverter())));
        return http.build();
    }

    /**
     * Décodeur unique qui aiguille selon l'algorithme du jeton :
     *  • HS256 → jeton émis par le backend (mobile).
     *  • RS256 (autre) → jeton Keycloak (validé via JWKS + issuer).
     */
    @Bean
    public JwtDecoder jwtDecoder(
            JwtService jwtService,
            @Value("${spring.security.oauth2.resourceserver.jwt.jwk-set-uri}") String jwkSetUri,
            @Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri}") String issuerUri) {

        NimbusJwtDecoder keycloak = NimbusJwtDecoder.withJwkSetUri(jwkSetUri).build();
        keycloak.setJwtValidator(JwtValidators.createDefaultWithIssuer(issuerUri));
        JwtDecoder backend = jwtService.getDecoder();

        return token -> {
            try {
                String alg = SignedJWT.parse(token).getHeader().getAlgorithm().getName();
                return "HS256".equals(alg) ? backend.decode(token) : keycloak.decode(token);
            } catch (ParseException e) {
                throw new BadJwtException("Jeton illisible", e);
            }
        };
    }

    /**
     * Mappe les rôles en autorités « ROLE_* » :
     *  • Keycloak  : realm_access.roles + resource_access.*.roles
     *  • Backend   : claim "roles" (liste simple, ex. ["CHAUFFEUR"])
     */
    private JwtAuthenticationConverter jwtAuthConverter() {
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(jwt -> {
            Set<String> roles = new HashSet<>();

            Map<String, Object> realmAccess = jwt.getClaimAsMap("realm_access");
            if (realmAccess != null && realmAccess.get("roles") instanceof Collection<?> realmRoles) {
                realmRoles.forEach(r -> roles.add(String.valueOf(r)));
            }
            Map<String, Object> resourceAccess = jwt.getClaimAsMap("resource_access");
            if (resourceAccess != null) {
                for (Object client : resourceAccess.values()) {
                    if (client instanceof Map<?, ?> clientMap
                            && clientMap.get("roles") instanceof Collection<?> clientRoles) {
                        clientRoles.forEach(r -> roles.add(String.valueOf(r)));
                    }
                }
            }
            // Jetons backend (mobile) : claim "roles" simple
            if (jwt.getClaim("roles") instanceof Collection<?> simpleRoles) {
                simpleRoles.forEach(r -> roles.add(String.valueOf(r)));
            }

            List<GrantedAuthority> authorities = new ArrayList<>();
            for (String role : roles) {
                authorities.add(new SimpleGrantedAuthority("ROLE_" + role.toUpperCase()));
            }
            return authorities;
        });
        return converter;
    }
}
