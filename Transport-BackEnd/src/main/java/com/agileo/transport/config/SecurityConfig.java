package com.agileo.transport.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Sécurité de l'API Transport.
 *
 * L'application mobile s'authentifie UNIQUEMENT par QR code (pas de Keycloak),
 * et l'interface web gère l'authentification Keycloak côté client (SSO).
 * Le backend n'impose donc aucun token sur ses endpoints : tout /api/** est
 * ouvert. On n'active PAS le resource server OAuth2 ici, ce qui élimine toute
 * possibilité de réponse 401 sur des endpoints publics (ex. /api/articles/scan).
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(cors -> {})
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
        return http.build();
    }
}
