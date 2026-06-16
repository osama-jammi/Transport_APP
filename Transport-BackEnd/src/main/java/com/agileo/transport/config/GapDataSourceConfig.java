package com.agileo.transport.config;

import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;

@Configuration
public class GapDataSourceConfig {

    /** DataSource en lecture seule vers la base GAP (articles à livrer) */
    @Bean(name = "gapDataSource")
    @ConfigurationProperties(prefix = "spring.datasource.gap")
    public DataSource gapDataSource() {
        return DataSourceBuilder.create()
                .type(HikariDataSource.class)
                .build();
    }

    /** JdbcTemplate en lecture seule pour interroger la base GAP (articles, chauffeurs, ...) */
    @Bean(name = "gapJdbcTemplate")
    public JdbcTemplate gapJdbcTemplate(@Qualifier("gapDataSource") DataSource gapDataSource) {
        return new JdbcTemplate(gapDataSource);
    }
}
