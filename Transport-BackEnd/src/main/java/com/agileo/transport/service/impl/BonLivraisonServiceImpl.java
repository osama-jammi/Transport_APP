package com.agileo.transport.service.impl;

import com.agileo.transport.Dtos.response.BlLigneDTO;
import com.agileo.transport.Dtos.response.GapVoyageArticleDTO;
import com.agileo.transport.Dtos.response.GapVoyageDTO;
import com.agileo.transport.service.BonLivraisonService;
import com.agileo.transport.service.GapReadService;
import jakarta.persistence.EntityNotFoundException;
import net.sf.jasperreports.engine.JasperCompileManager;
import net.sf.jasperreports.engine.JasperExportManager;
import net.sf.jasperreports.engine.JasperFillManager;
import net.sf.jasperreports.engine.JasperPrint;
import net.sf.jasperreports.engine.JasperReport;
import net.sf.jasperreports.engine.data.JRBeanCollectionDataSource;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Génère le bon de livraison RICHE BOIS via JasperReports
 * (modèle classpath {@code /reports/bon-livraison.jrxml}, compilé et mis en cache).
 */
@Service
public class BonLivraisonServiceImpl implements BonLivraisonService {

    private final GapReadService gap;
    private volatile JasperReport compiled;

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DecimalFormat QTE =
            new DecimalFormat("0.0##", DecimalFormatSymbols.getInstance(Locale.US));

    public BonLivraisonServiceImpl(GapReadService gap) {
        this.gap = gap;
    }

    @Override
    public byte[] genererBL(Long voyageId) {
        GapVoyageDTO v = gap.getVoyageById(voyageId);
        if (v == null) {
            throw new EntityNotFoundException("Voyage (livraison) introuvable : " + voyageId);
        }

        List<BlLigneDTO> lignes = new ArrayList<>();
        for (GapVoyageArticleDTO a : gap.getVoyageArticles(voyageId)) {
            lignes.add(new BlLigneDTO(
                    nz(a.getOrigineArticle()),                       // ID OF
                    nz(a.getNumPrix()),                              // N° de Prix
                    nz(a.getDesignation()),                          // Désignation
                    "",                                              // Repère / Emplacement (absent de GAP)
                    a.getQuantite() != null ? QTE.format(a.getQuantite()) : "",
                    ""                                               // Observation (absent de GAP)
            ));
        }

        Map<String, Object> params = new HashMap<>();
        params.put("blNumero", (v.getBl() != null && !v.getBl().isBlank()) ? v.getBl() : "BL-" + voyageId);
        params.put("lieu", nz(v.getAtelierDesignation()));
        params.put("dateBl", v.getDateLivraison() != null ? v.getDateLivraison().format(DATE) : "");
        params.put("projet", (nz(v.getProjetCode()) + " " + nz(v.getProjetDesignation())).trim());
        params.put("chauffeur", nz(v.getChauffeur()));
        InputStream logo = getClass().getResourceAsStream("/reports/riche-bois-logo.jpg");
        if (logo != null) {
            params.put("logo", logo);
        }

        try {
            JasperPrint print = JasperFillManager.fillReport(report(), params,
                    new JRBeanCollectionDataSource(lignes));
            return JasperExportManager.exportReportToPdf(print);
        } catch (Exception e) {
            throw new RuntimeException("Échec de génération du bon de livraison (Jasper)", e);
        }
    }

    /** Compile le modèle une seule fois (double-checked locking). */
    private JasperReport report() {
        JasperReport r = compiled;
        if (r == null) {
            synchronized (this) {
                if (compiled == null) {
                    try (InputStream in = getClass().getResourceAsStream("/reports/bon-livraison.jrxml")) {
                        if (in == null) {
                            throw new IllegalStateException("Modèle /reports/bon-livraison.jrxml introuvable");
                        }
                        compiled = JasperCompileManager.compileReport(in);
                    } catch (Exception e) {
                        throw new RuntimeException("Échec de compilation du modèle de bon de livraison", e);
                    }
                }
                r = compiled;
            }
        }
        return r;
    }

    private static String nz(String s) {
        return s != null ? s : "";
    }
}
