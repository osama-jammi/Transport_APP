package com.agileo.transport.service.impl;

import com.agileo.transport.entity.Reserve;
import com.agileo.transport.entity.Voyage;
import com.agileo.transport.repository.ReserveRepository;
import com.agileo.transport.repository.VoyageRepository;
import com.agileo.transport.service.RapportService;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RapportServiceImpl implements RapportService {

    private final VoyageRepository voyageRepository;
    private final ReserveRepository reserveRepository;

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

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
            return toBytes(wb);
        } catch (Exception e) {
            throw new RuntimeException("Erreur export non livrés", e);
        }
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private void createHeaderRow(Sheet sheet, String[] headers) {
        Row headerRow = sheet.createRow(0);
        CellStyle style = sheet.getWorkbook().createCellStyle();
        Font font = sheet.getWorkbook().createFont();
        font.setBold(true);
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.LIGHT_BLUE.getIndex());
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

    private byte[] toBytes(Workbook wb) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        wb.write(out);
        return out.toByteArray();
    }
}
