package com.agileo.transport.Dtos.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/** Identifiants envoyés par l'app mobile superviseur. */
@Data
public class MobileLoginDTO {
    @NotBlank
    private String username;
    @NotBlank
    private String password;
}
