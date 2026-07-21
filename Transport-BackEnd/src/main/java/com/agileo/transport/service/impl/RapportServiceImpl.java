package com.agileo.transport.service.impl;

import com.agileo.transport.Dtos.response.DashboardStatsDTO;
import com.agileo.transport.Dtos.response.VoyageConteneurDTO;
import com.agileo.transport.entity.Reserve;
import com.agileo.transport.entity.Voyage;
import com.agileo.transport.repository.ReserveRepository;
import com.agileo.transport.repository.VoyageRepository;
import com.agileo.transport.service.GapReadService;
import com.agileo.transport.service.RapportService;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RapportServiceImpl implements RapportService {

    private final VoyageRepository voyageRepository;
    private final ReserveRepository reserveRepository;
    private final GapReadService gapReadService;

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
    private static final DateTimeFormatter FMT_D = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    @Override
    public byte[] exportSynthese(LocalDateTime debut, LocalDateTime fin) {
        List<Voyage> voyages = voyageRepository.findArchivesBetween(debut, fin);
        try (Workbook wb = new XSSFWorkbook()) {
            Sheet sheet = wb.createSheet("Synthèse");
            String[] headers = {"ID", "Date Création", "Transporteur", "Camion", "Client",
                    "Nb Colis", "État Chg.", "État Dchg.", "BL", "Statut"};
            createHeaderRow(sheet, headers);
            int row = 1;
            for (Voyage v : voyages) {
                Row r = sheet.createRow(row++);
                r.createCell(0).setCellValue(v.getId());
                r.createCell(1).setCellValue(v.getDateCreation() != null ? v.getDateCreation().format(FMT) : "");
                r.createCell(2).setCellValue(v.getTransporteur() != null ? v.getTransporteur().getNom() : "");
                r.createCell(3).setCellValue(v.getCamion() != null ? v.getCamion().getImmatriculation() : "");
                r.createCell(4).setCellValue(v.getClient());
                r.createCell(5).setCellValue("");
                r.createCell(6).setCellValue(v.getEtatChargement() != null ? v.getEtatChargement().name() : "");
                r.createCell(7).setCellValue(v.getEtatDechargement() != null ? v.getEtatDechargement().name() : "");
                r.createCell(8).setCellValue(v.getBl() != null ? v.getBl() : "");
                r.createCell(9).setCellValue(v.getStatut().name());
            }
            autoSize(sheet, headers.length);
            insertLogo(wb, sheet);
            return toBytes(wb);
        } catch (Exception e) {
            throw new RuntimeException("Erreur export synthèse", e);
        }
    }

    @Override
    public byte[] exportDetaille(LocalDateTime debut, LocalDateTime fin) {
        List<Voyage> voyages = voyageRepository.findArchivesBetween(debut, fin);
        try (Workbook wb = new XSSFWorkbook()) {
            Sheet sheet = wb.createSheet("Détaillé");
            String[] headers = {"ID", "Date Création", "Transporteur", "Camion", "Client",
                    "Chg. Jour", "Chg. Heure", "Arriv. Eff. Chg.",
                    "Dchg. Jour", "Dchg. Heure", "Arriv. Eff. Dchg.", "BL", "Dernière Conn."};
            createHeaderRow(sheet, headers);
            int row = 1;
            for (Voyage v : voyages) {
                Row r = sheet.createRow(row++);
                r.createCell(0).setCellValue(v.getId());
                r.createCell(1).setCellValue(v.getDateCreation() != null ? v.getDateCreation().format(FMT) : "");
                r.createCell(2).setCellValue(v.getTransporteur() != null ? v.getTransporteur().getNom() : "");
                r.createCell(3).setCellValue(v.getCamion() != null ? v.getCamion().getImmatriculation() : "");
                r.createCell(4).setCellValue(v.getClient() != null ? v.getClient() : "");
                r.createCell(5).setCellValue(v.getChargementJour() != null ? v.getChargementJour().toString() : "");
                r.createCell(6).setCellValue(v.getChargementHeure() != null ? v.getChargementHeure().toString() : "");
                r.createCell(7).setCellValue(v.getArriveeEffectiveChargement() != null ? v.getArriveeEffectiveChargement().format(FMT) : "");
                r.createCell(8).setCellValue(v.getDechargementJour() != null ? v.getDechargementJour().toString() : "");
                r.createCell(9).setCellValue(v.getDechargementHeure() != null ? v.getDechargementHeure().toString() : "");
                r.createCell(10).setCellValue(v.getArriveeEffectiveDechargement() != null ? v.getArriveeEffectiveDechargement().format(FMT) : "");
                r.createCell(11).setCellValue(v.getBl() != null ? v.getBl() : "");
                r.createCell(12).setCellValue(v.getDerniereConnexion() != null ? v.getDerniereConnexion().format(FMT) : "Jamais");
            }
            autoSize(sheet, headers.length);
            insertLogo(wb, sheet);
            return toBytes(wb);
        } catch (Exception e) {
            throw new RuntimeException("Erreur export détaillé", e);
        }
    }

    @Override
    public byte[] exportReserves(LocalDateTime debut, LocalDateTime fin) {
        List<Reserve> reserves = reserveRepository.findByVoyageDateCreationBetween(debut, fin);
        try (Workbook wb = new XSSFWorkbook()) {
            Sheet sheet = wb.createSheet("Réserves");
            String[] headers = {"ID Voyage", "Client", "Description", "Date"};
            createHeaderRow(sheet, headers);
            int row = 1;
            for (Reserve res : reserves) {
                Row r = sheet.createRow(row++);
                r.createCell(0).setCellValue(res.getVoyage().getId());
                r.createCell(1).setCellValue(res.getVoyage().getClient() != null ? res.getVoyage().getClient() : "");
                r.createCell(2).setCellValue(res.getDescription() != null ? res.getDescription() : "");
                r.createCell(3).setCellValue(res.getDate() != null ? res.getDate().format(FMT) : "");
            }
            autoSize(sheet, headers.length);
            insertLogo(wb, sheet);
            return toBytes(wb);
        } catch (Exception e) {
            throw new RuntimeException("Erreur export réserves", e);
        }
    }

    @Override
    public byte[] exportNonLivres(LocalDateTime debut, LocalDateTime fin) {
        List<Voyage> voyages = voyageRepository.findArchivesBetween(debut, fin).stream()
                .filter(v -> v.getStatut() == Voyage.StatutVoyage.SUPPRIME
                        || v.getBl() == null)
                .toList();
        try (Workbook wb = new XSSFWorkbook()) {
            Sheet sheet = wb.createSheet("Non livrés");
            String[] headers = {"ID", "Date Création", "Client", "Camion", "Statut", "BL"};
            createHeaderRow(sheet, headers);
            int row = 1;
            for (Voyage v : voyages) {
                Row r = sheet.createRow(row++);
                r.createCell(0).setCellValue(v.getId());
                r.createCell(1).setCellValue(v.getDateCreation() != null ? v.getDateCreation().format(FMT) : "");
                r.createCell(2).setCellValue(v.getClient() != null ? v.getClient() : "");
                r.createCell(3).setCellValue(v.getCamion() != null ? v.getCamion().getImmatriculation() : "");
                r.createCell(4).setCellValue(v.getStatut().name());
                r.createCell(5).setCellValue(v.getBl() != null ? v.getBl() : "ABSENT");
            }
            autoSize(sheet, headers.length);
            insertLogo(wb, sheet);
            return toBytes(wb);
        } catch (Exception e) {
            throw new RuntimeException("Erreur export non livrés", e);
        }
    }

    @Override
    public byte[] exportVoyagesConteneurs(boolean archives, boolean tout) {
        List<VoyageConteneurDTO> voyages = gapReadService.getVoyagesConteneurs(archives, null, tout);
        try (Workbook wb = new XSSFWorkbook()) {
            Sheet sheet = wb.createSheet("Voyages");
            String[] headers = {"ID", "Date voyage", "Chauffeur", "Nb livraisons", "Nb matières",
                    "Chargement prévu", "Déchargement prévu", "Chargement réel", "Déchargement réel",
                    "Statut", "Local de départ"};
            createHeaderRow(sheet, headers);
            int row = 1;
            for (VoyageConteneurDTO v : voyages) {
                Row r = sheet.createRow(row++);
                r.createCell(0).setCellValue(v.getId() != null ? v.getId() : 0);
                r.createCell(1).setCellValue(v.getDateVoyage() != null ? v.getDateVoyage().format(FMT) : "");
                r.createCell(2).setCellValue(v.getChauffeur() != null ? v.getChauffeur() : "");
                r.createCell(3).setCellValue(v.getNbLivraisons());
                r.createCell(4).setCellValue(v.getNbMatieres());
                r.createCell(5).setCellValue(v.getChargement() != null ? v.getChargement().format(FMT) : "");
                r.createCell(6).setCellValue(v.getDechargement() != null ? v.getDechargement().format(FMT) : "");
                r.createCell(7).setCellValue(v.getRealChargement() != null ? v.getRealChargement().format(FMT) : "");
                r.createCell(8).setCellValue(v.getRealDechargement() != null ? v.getRealDechargement().format(FMT) : "");
                r.createCell(9).setCellValue(v.getStatut() != null ? v.getStatut() : "");
                r.createCell(10).setCellValue(v.getLocalNom() != null ? v.getLocalNom() : "");
            }
            autoSize(sheet, headers.length);
            insertLogo(wb, sheet);
            return toBytes(wb);
        } catch (Exception e) {
            throw new RuntimeException("Erreur export voyages", e);
        }
    }

    @Override
    public byte[] exportComplet(LocalDate debut, LocalDate fin, Long chantierId, Long chauffeurId) {
        // Plage par défaut = aujourd'hui (cohérent avec le tableau de bord)
        LocalDate d = debut != null ? debut : LocalDate.now();
        LocalDate f = fin != null ? fin : LocalDate.now();

        DashboardStatsDTO stats = gapReadService.getDashboardStats(chantierId, chauffeurId, debut, fin);
        List<DashboardStatsDTO.ChauffeurStat> parChauffeur =
                gapReadService.getChauffeurStats(chantierId, chauffeurId, debut, fin);
        List<Reserve> reserves = reserveRepository.findByVoyageDateCreationBetween(
                d.atStartOfDay(), f.atTime(23, 59, 59));

        try (Workbook wb = new XSSFWorkbook()) {
            CellStyle header = headerStyle(wb);
            CellStyle title = titleStyle(wb);
            CellStyle label = labelStyle(wb);

            // ── Feuille 1 : Synthèse ────────────────────────────────────────
            Sheet syn = wb.createSheet("Synthèse");
            int r = 0;
            Row t = syn.createRow(r++);
            Cell tc = t.createCell(0); tc.setCellValue("Rapport d'activité — Transport / Livraison"); tc.setCellStyle(title);
            kv(syn, r++, "Période", d.format(FMT_D) + "  →  " + f.format(FMT_D), label);
            r++; // ligne vide

            int total = stats.getVoyagesAujourdhui();
            int livres = stats.getLivresAujourdhui();
            int taux = total > 0 ? Math.round(livres * 100f / total) : 0;

            Row kh = syn.createRow(r++);
            cell(kh, 0, "Indicateur", header);
            cell(kh, 1, "Valeur", header);
            kv(syn, r++, "Voyages (livraisons)", total, label);
            kv(syn, r++, "Livrés", livres, label);
            kv(syn, r++, "En cours", stats.getEnCoursAujourdhui(), label);
            kv(syn, r++, "En attente", stats.getEnAttenteAujourdhui(), label);
            kv(syn, r++, "Taux de livraison", taux + " %", label);
            kv(syn, r++, "Articles livrés (lignes)", stats.getArticlesAujourdhui(), label);
            kv(syn, r++, "Durée moyenne chargement → livraison",
                    stats.getDureeMoyenneMinutes() != null ? fmtDuree(stats.getDureeMoyenneMinutes()) : "—", label);
            kv(syn, r++, "Chantiers actifs", stats.getChantiersActifs(), label);
            kv(syn, r++, "Chauffeurs actifs", stats.getChauffeursActifs(), label);
            kv(syn, r++, "Réserves / incidents", reserves.size(), label);
            kv(syn, r++, "Total voyages (hors archivés, filtre)", stats.getVoyagesTotal(), label);
            autoSize(syn, 2);
            insertLogo(wb, syn);

            // ── Feuille 2 : Par chauffeur ───────────────────────────────────
            Sheet sc = wb.createSheet("Par chauffeur");
            createHeaderRow(sc, new String[]{"Chauffeur", "Matricule", "Voyages", "Livrés", "En attente", "Taux %", "Articles"});
            int rc = 1;
            for (DashboardStatsDTO.ChauffeurStat c : parChauffeur) {
                Row row = sc.createRow(rc++);
                row.createCell(0).setCellValue(c.getChauffeur());
                row.createCell(1).setCellValue(c.getMatricule());
                row.createCell(2).setCellValue(c.getTotal());
                row.createCell(3).setCellValue(c.getLivres());
                row.createCell(4).setCellValue(c.getEnAttente());
                row.createCell(5).setCellValue(c.getTotal() > 0 ? Math.round(c.getLivres() * 100f / c.getTotal()) : 0);
                row.createCell(6).setCellValue(c.getArticles());
            }
            autoSize(sc, 7);
            insertLogo(wb, sc);

            // ── Feuille 3 : Par chantier ────────────────────────────────────
            Sheet sch = wb.createSheet("Par chantier");
            createHeaderRow(sch, new String[]{"Chantier", "Voyages", "Livrés", "Taux %"});
            int rch = 1;
            for (DashboardStatsDTO.ChantierStat c : stats.getParChantier()) {
                Row row = sch.createRow(rch++);
                row.createCell(0).setCellValue(c.getChantier());
                row.createCell(1).setCellValue(c.getTotal());
                row.createCell(2).setCellValue(c.getLivres());
                row.createCell(3).setCellValue(c.getTotal() > 0 ? Math.round(c.getLivres() * 100f / c.getTotal()) : 0);
            }
            autoSize(sch, 4);
            insertLogo(wb, sch);

            // ── Feuille 4 : Par jour ────────────────────────────────────────
            Sheet sj = wb.createSheet("Par jour");
            createHeaderRow(sj, new String[]{"Jour", "Voyages", "Livrés", "Taux %"});
            int rj = 1;
            for (DashboardStatsDTO.JourStat j : stats.getParJour()) {
                Row row = sj.createRow(rj++);
                row.createCell(0).setCellValue(j.getJour());
                row.createCell(1).setCellValue(j.getTotal());
                row.createCell(2).setCellValue(j.getLivres());
                row.createCell(3).setCellValue(j.getTotal() > 0 ? Math.round(j.getLivres() * 100f / j.getTotal()) : 0);
            }
            autoSize(sj, 4);
            insertLogo(wb, sj);

            // ── Feuille 5 : Réserves / incidents ────────────────────────────
            Sheet sr = wb.createSheet("Réserves");
            createHeaderRow(sr, new String[]{"ID Voyage", "Client", "Description", "Date"});
            int rr = 1;
            for (Reserve res : reserves) {
                Row row = sr.createRow(rr++);
                row.createCell(0).setCellValue(res.getVoyage() != null ? res.getVoyage().getId() : 0);
                row.createCell(1).setCellValue(res.getVoyage() != null && res.getVoyage().getClient() != null ? res.getVoyage().getClient() : "");
                row.createCell(2).setCellValue(res.getDescription() != null ? res.getDescription() : "");
                row.createCell(3).setCellValue(res.getDate() != null ? res.getDate().format(FMT) : "");
            }
            autoSize(sr, 4);
            insertLogo(wb, sr);

            return toBytes(wb);
        } catch (Exception e) {
            throw new RuntimeException("Erreur export rapport complet", e);
        }
    }

    private static String fmtDuree(int minutes) {
        if (minutes < 60) return minutes + " min";
        int h = minutes / 60, m = minutes % 60;
        return m > 0 ? h + "h" + String.format("%02d", m) : h + "h";
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private void createHeaderRow(Sheet sheet, String[] headers) {
        Row headerRow = sheet.createRow(0);
        CellStyle style = sheet.getWorkbook().createCellStyle();
        Font font = sheet.getWorkbook().createFont();
        font.setBold(true);
        style.setFont(font);
        font.setColor(IndexedColors.WHITE.getIndex());
        style.setFillForegroundColor(IndexedColors.TEAL.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        for (int i = 0; i < headers.length; i++) {
            Cell cell = headerRow.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(style);
        }
    }

    private void autoSize(Sheet sheet, int cols) {
        for (int i = 0; i < cols; i++) sheet.autoSizeColumn(i);
    }

    // ── styles & cellules (rapport complet) ──────────────────────────────────

    private CellStyle headerStyle(Workbook wb) {
        CellStyle s = wb.createCellStyle();
        Font f = wb.createFont(); f.setBold(true);
        s.setFont(f);
        f.setColor(IndexedColors.WHITE.getIndex());
        s.setFillForegroundColor(IndexedColors.TEAL.getIndex());
        s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return s;
    }

    private CellStyle titleStyle(Workbook wb) {
        CellStyle s = wb.createCellStyle();
        Font f = wb.createFont(); f.setBold(true); f.setFontHeightInPoints((short) 14);
        s.setFont(f);
        return s;
    }

    private CellStyle labelStyle(Workbook wb) {
        CellStyle s = wb.createCellStyle();
        Font f = wb.createFont(); f.setBold(true);
        s.setFont(f);
        return s;
    }

    /** Ligne « clé : valeur » (col 0 en gras, col 1 valeur). */
    private void kv(Sheet sheet, int rowIdx, String key, Object value, CellStyle keyStyle) {
        Row row = sheet.createRow(rowIdx);
        cell(row, 0, key, keyStyle);
        Cell v = row.createCell(1);
        if (value instanceof Number n) v.setCellValue(n.doubleValue());
        else v.setCellValue(value != null ? value.toString() : "");
    }

    private void cell(Row row, int col, String value, CellStyle style) {
        Cell c = row.createCell(col);
        c.setCellValue(value);
        if (style != null) c.setCellStyle(style);
    }

    private byte[] toBytes(Workbook wb) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        wb.write(out);
        return out.toByteArray();
    }

    private void insertLogo(Workbook wb, Sheet sheet) {
        try {
            java.io.InputStream is = getClass().getResourceAsStream("/reports/riche-bois-logo.jpg");
            if (is == null) return;
            byte[] bytes = org.apache.poi.util.IOUtils.toByteArray(is);
            int pictureIdx = wb.addPicture(bytes, Workbook.PICTURE_TYPE_JPEG);
            is.close();

            CreationHelper helper = wb.getCreationHelper();
            Drawing<?> drawing = sheet.createDrawingPatriarch();
            ClientAnchor anchor = helper.createClientAnchor();
            // Position logo flexibly far right
            anchor.setCol1(sheet.getRow(0) != null ? sheet.getRow(0).getLastCellNum() + 1 : 5);
            anchor.setRow1(0);
            Picture pict = drawing.createPicture(anchor, pictureIdx);
            pict.resize(1.2, 1.2);
        } catch (Exception e) {
            // ignore
        }
    }
}
