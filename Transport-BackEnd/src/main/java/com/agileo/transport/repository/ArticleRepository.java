package com.agileo.transport.repository;

import com.agileo.transport.entity.Article;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ArticleRepository extends JpaRepository<Article, Long> {
    List<Article> findByColisId(Long colisId);
    List<Article> findByColis_VoyageId(Long voyageId);
    Optional<Article> findByQrCode(String qrCode);
    List<Article> findByColisIsNull();
}