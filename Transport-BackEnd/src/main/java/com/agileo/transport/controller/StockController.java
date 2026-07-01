package com.agileo.transport.controller;

import com.agileo.transport.Dtos.response.ArticleStockDTO;
import com.agileo.transport.service.StockReadService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Stock DivNet en lecture seule : dépôts (RB1..RB5) puis articles disponibles
 * par dépôt. Sert à la saisie d'un voyage de type STOCK. Aucune écriture stock.
 */
@RestController
@RequestMapping("/api/stock")
@Tag(name = "Stock", description = "Articles disponibles par dépôt (lecture seule DivNet)")
public class StockController {

    private final StockReadService stockReadService;

    public StockController(StockReadService stockReadService) {
        this.stockReadService = stockReadService;
    }

    @GetMapping("/depots")
    @Operation(summary = "Liste des dépôts ayant du stock (codes DEPO, ex. RB1..RB5)")
    public ResponseEntity<List<String>> getDepots() {
        return ResponseEntity.ok(stockReadService.getDepots());
    }

    @GetMapping("/depots/{depot}/articles")
    @Operation(summary = "Articles disponibles (stock > 0) d'un dépôt, filtre optionnel par référence/désignation")
    public ResponseEntity<List<ArticleStockDTO>> getArticles(
            @PathVariable String depot,
            @RequestParam(required = false) String search) {
        return ResponseEntity.ok(stockReadService.getArticlesByDepot(depot, search));
    }
}
