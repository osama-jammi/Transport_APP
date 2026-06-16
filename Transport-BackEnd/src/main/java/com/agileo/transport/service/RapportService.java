package com.agileo.transport.service;

import java.time.LocalDateTime;

public interface RapportService {
    byte[] exportSynthese(LocalDateTime debut, LocalDateTime fin);
    byte[] exportDetaille(LocalDateTime debut, LocalDateTime fin);
    byte[] exportReserves(LocalDateTime debut, LocalDateTime fin);
    byte[] exportNonLivres(LocalDateTime debut, LocalDateTime fin);
}
