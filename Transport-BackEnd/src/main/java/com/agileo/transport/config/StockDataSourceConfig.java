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
 * DataSource en LECTURE SEULE vers la base applicative DivNet/AGILEO.
 *
 * Sert uniquement à lire la vue {@code Article_en_stock} (stock disponible par
 * dépôt), exactement comme le fait l'écran « Consommation » de DivNet. Aucune
 * écriture n'est jamais effectuée : le transport ne modifie pas le stock, il le
 * lit pour proposer les articles disponibles à livrer.
 *
 * Propriétés : {@code spring.datasource.stock.*} (jdbc-url, username, password…).
 */
@Configuration
public class StockDataSourceConfig {

    @Bean(name = "stockDataSource")
    @ConfigurationProperties(prefix = "spring.datasource.stock")
    public DataSource stockDataSource() {
        return DataSourceBuilder.create()
                .type(HikariDataSource.class)
                .build();
    }

    @Bean(name = "stockJdbcTemplate")
    public JdbcTemplate stockJdbcTemplate(@Qualifier("stockDataSource") DataSource stockDataSource) {
        return new JdbcTemplate(stockDataSource);
    }
}
