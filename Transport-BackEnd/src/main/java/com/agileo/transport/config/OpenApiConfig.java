package com.agileo.transport.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI transportOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Transport-Livraison API")
                        .description("API REST — Application de gestion et de suivi du transport et de la livraison")
                        .version("1.0.0"));
    }
}
