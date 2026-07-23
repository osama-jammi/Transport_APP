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
import org.springframework.beans.factory.annotation.Value;
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

    // Agents du processus FL-PRO-07 (cachet/visa). Configurables par environnement.
    @Value("${app.bl.agent-livraison:}")
    private String agentLivraison;
    @Value("${app.bl.agent-controle-qualite:}")
    private String agentControleQualite;
    @Value("${app.bl.agent-reception:}")
    private String agentReception;

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

        // Infos par ligne calculées exactement comme GAP (ID OF, emplacement, observation).
        java.util.Map<Long, String[]> infos = gap.getBlInfosParLigne(voyageId);
        List<BlLigneDTO> lignes = new ArrayList<>();
        for (GapVoyageArticleDTO a : gap.getVoyageArticles(voyageId)) {
            String[] info = infos.get(a.getId());
            String idOf = (info != null && !info[0].isBlank()) ? info[0] : formatIdOf(a.getOrigineArticle());
            String emplacement = info != null ? info[1] : "";
            String observation = info != null ? info[2] : "";
            lignes.add(new BlLigneDTO(
                    idOf,                                            // ID OF (façon GAP)
                    nz(a.getNumPrix()),                              // N° de Prix
                    nz(a.getDesignation()),                          // Désignation
                    emplacement,                                     // Repère / Emplacement
                    a.getQuantite() != null ? QTE.format(a.getQuantite()) : "",
                    observation                                      // Observation
            ));
        }

        // Agents façon GAP (atelier + utilisateur saisisseur) ; repli sur la config si introuvables.
        String[] agents = gap.getBlAgents(voyageId);
        String aLivraison = !agents[0].isEmpty() ? agents[0] : nz(agentLivraison);
        String aControle = !agents[1].isEmpty() ? agents[1] : nz(agentControleQualite);

        Map<String, Object> params = new HashMap<>();
        // N° BL identique à GAP : "BL-" + id de la livraison.
        params.put("blNumero", "BL-" + voyageId);
        params.put("lieu", nz(v.getAtelierDesignation()));
        params.put("dateBl", v.getDateLivraison() != null ? v.getDateLivraison().format(DATE) : "");
        params.put("projet", (nz(v.getProjetCode()) + " " + nz(v.getProjetDesignation())).trim());
        params.put("chauffeur", nz(v.getChauffeur()).toUpperCase());
        params.put("agentLivraison", aLivraison);
        params.put("agentControleQualite", aControle);
        params.put("agentReception", nz(agentReception));
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

    /** ID OF tel qu'affiché sur le BL de référence : « OF 193-06S ». Préfixe « OF » si absent. */
    private static String formatIdOf(String origineArticle) {
        String of = nz(origineArticle).trim();
        if (of.isEmpty()) return "";
        return of.toUpperCase(Locale.ROOT).startsWith("OF") ? of : "OF " + of;
    }
}
