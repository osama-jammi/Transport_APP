package com.agileo.transport.config;

import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;

/**
 * DataSource en lecture seule vers la base Divalto (RB217_MIG) — matières premières
 * (tables MOUV = lignes de mouvement, ENT = entêtes de pièces ; affaires = PROJET/MARCHE).
 */
@Configuration
public class DivaltoDataSourceConfig {

    @Bean(name = "divaltoDataSource")
    @ConfigurationProperties(prefix = "spring.datasource.divalto")
    public DataSource divaltoDataSource() {
        return DataSourceBuilder.create()
                .type(HikariDataSource.class)
                .build();
    }

    @Bean(name = "divaltoJdbcTemplate")
    public JdbcTemplate divaltoJdbcTemplate(@Qualifier("divaltoDataSource") DataSource divaltoDataSource) {
        return new JdbcTemplate(divaltoDataSource);
    }
}
