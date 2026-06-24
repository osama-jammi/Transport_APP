package com.agileo.transport.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Sécurité de l'API Transport.
 *
 * Deux populations distinctes :
 *  • L'application MOBILE chauffeur s'authentifie par QR code (PAS de Keycloak).
 *    Les seuls endpoints dont elle a besoin restent donc PUBLICS (liste blanche
 *    ci-dessous).
 *  • L'interface WEB et le tableau de bord admin (mobile superviseur) envoient un
 *    jeton Keycloak (Bearer). Tout le reste de l'API exige donc un jeton valide.
 *
 * NB : les images QR (`**​/qrcode`) sont chargées via des balises <img> / liens de
 * téléchargement, SANS en-tête Authorization → elles doivent rester publiques.
 * `GET /api/admin/features` est lu par l'app chauffeur → public également.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            // Réutilise la configuration CORS de WebConfig (HandlerMappingIntrospector).
            .cors(cors -> {})
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // Préflight CORS
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                // ───── Endpoints PUBLICS de l'app mobile chauffeur (auth = QR code) ─────
                .requestMatchers(HttpMethod.POST,  "/api/chauffeurs/connect").permitAll()
                .requestMatchers(HttpMethod.PATCH, "/api/chauffeurs/*/push-token").permitAll()
                .requestMatchers(HttpMethod.GET,   "/api/voyages/gap").permitAll()
                .requestMatchers(HttpMethod.GET,   "/api/voyages/*/articles").permitAll()
                .requestMatchers(HttpMethod.PATCH, "/api/voyages/*/arrivee").permitAll()
                .requestMatchers(HttpMethod.POST,  "/api/voyages/*/bl").permitAll()
                .requestMatchers(HttpMethod.GET,   "/api/voyages-conteneurs").permitAll()
                .requestMatchers(HttpMethod.GET,   "/api/voyages-conteneurs/*/livraisons").permitAll()
                .requestMatchers(HttpMethod.POST,  "/api/articles/scan").permitAll()
                .requestMatchers(HttpMethod.POST,  "/api/gps/position").permitAll()
                // Flags de fonctionnalités : lus aussi par l'app chauffeur (lecture seule)
                .requestMatchers(HttpMethod.GET,   "/api/admin/features").permitAll()
                // Images QR (chargées via <img> / téléchargement → sans en-tête Authorization).
                // NB : Spring interdit ** au milieu d'un chemin → on énumère avec des * simples.
                .requestMatchers(HttpMethod.GET,   "/api/articles/*/qrcode").permitAll()
                .requestMatchers(HttpMethod.GET,   "/api/articles/*/*/qrcode").permitAll()
                .requestMatchers(HttpMethod.GET,   "/api/voyages-conteneurs/*/qrcode").permitAll()
                .requestMatchers(HttpMethod.GET,   "/api/voyages-conteneurs/*/*/qrcode").permitAll()
                .requestMatchers(HttpMethod.GET,   "/api/chauffeurs/*/qrcode").permitAll()
                .requestMatchers(HttpMethod.GET,   "/api/chauffeurs/*/*/qrcode").permitAll()

                // ───── Infrastructure publique ─────
                .requestMatchers("/swagger-ui/**", "/v3/api-docs/**", "/actuator/health", "/error").permitAll()

                // ───── Tout le reste : jeton Keycloak obligatoire (admin / web) ─────
                .anyRequest().authenticated()
            )
            .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthConverter())));
        return http.build();
    }

    /**
     * Mappe les rôles Keycloak (realm_access.roles + resource_access.*.roles)
     * en autorités Spring « ROLE_* », pour pouvoir durcir plus tard certaines
     * routes avec hasRole("ADMIN") si besoin.
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
            List<GrantedAuthority> authorities = new ArrayList<>();
            for (String role : roles) {
                authorities.add(new SimpleGrantedAuthority("ROLE_" + role.toUpperCase()));
            }
            return authorities;
        });
        return converter;
    }
}
