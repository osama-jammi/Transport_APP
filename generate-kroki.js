const fs = require('fs');

const puml = `
@startuml
left to right direction
scale 1.5

skinparam defaultFontSize 14
skinparam defaultFontName sans-serif

skinparam packageStyle rectangle
skinparam rectangle {
    BorderColor #94a3b8
    BorderThickness 2
    FontStyle bold
}

skinparam usecase {
    BackgroundColor #e0f2fe
    BorderColor #0284c7
    BorderThickness 2
}

skinparam actor {
    BackgroundColor #fde68a
    BorderColor #d97706
    BorderThickness 2
}

skinparam arrow {
    Color #334155
    Thickness 2
    FontSize 12
    FontColor #b91c1c
    FontStyle bold
}

actor "Chauffeur" as C
actor "Back-office\\nLogistique" as B
actor "Superviseur\\nAdministrateur" as A

rectangle "Application de Gestion de Livraison" {
    
    usecase "S'authentifier" as Auth
    
    ' Grouper tous les autres cas ensemble pour forcer une colonne
    together {
        usecase "Consulter ses voyages" as V1
        usecase "Scanner la marchandise" as V2
        usecase "Confirmer arrivée chantier" as V3
        usecase "Signaler un incident" as V4
        
        usecase "Préparer un voyage" as A1
        usecase "Éditer Bon de Livraison" as A2
        
        usecase "Suivre les chauffeurs GPS" as S1
        usecase "Gérer la flotte" as S2
        usecase "Consulter statistiques" as S3
    }
}

C --> V1
C --> V2
C --> V3

B --> A1
B --> A2
B --> S1
B --> S3

A --> S1
A --> S2
A --> S3

V1 .> Auth : <<include>>
V2 .> Auth : <<include>>
V3 .> Auth : <<include>>
A1 .> Auth : <<include>>
A2 .> Auth : <<include>>
S1 .> Auth : <<include>>
S2 .> Auth : <<include>>
S3 .> Auth : <<include>>

V4 .> V2 : <<extend>>
V4 .> V3 : <<extend>>
@enduml
`;

async function generateImage() {
    try {
        console.log("Fetching diagram from Kroki...");
        const response = await fetch('https://kroki.io/plantuml/png', {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: puml
        });

        if (!response.ok) {
            throw new Error("HTTP error! status: " + response.status);
        }

        const buffer = await response.arrayBuffer();
        fs.writeFileSync('C:\\\\Users\\\\user\\\\OneDrive\\\\Masaüstü\\\\Figures\\\\use_case.png', Buffer.from(buffer));
        console.log("Successfully generated use_case.png via PlantUML");
    } catch (e) {
        console.error("Failed to generate:", e);
    }
}

generateImage();
