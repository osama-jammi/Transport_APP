const fs = require('fs');

const puml = `
@startuml
skinparam defaultFontSize 14
skinparam defaultFontName sans-serif

actor "Chauffeur" as C
participant "Application Mobile" as M
participant "Backend (Spring Boot)" as B
database "Base de données" as DB

C -> M: Scanne le QR code (Article)
M -> B: POST /api/livraison/scan (articleId, qte)
activate B
B -> DB: Vérifie si article existe et non livré
activate DB
DB --> B: Article OK
deactivate DB

B -> DB: Met à jour statut = SCANNÉ
B --> M: 200 OK (Scan validé)
deactivate B
M --> C: Affiche succès

C -> M: Clique sur "Confirmer Arrivée"
M -> M: Récupère GPS actuel
M -> B: POST /api/livraison/arrivee (GPS)
activate B
B -> DB: Enregistre heure + position arrivée
B --> M: 200 OK
deactivate B
M --> C: Affiche "Arrivé sur site"

C -> M: Valide la livraison finale
M -> B: POST /api/livraison/valider
activate B
B -> DB: Clôture la livraison
B --> M: 200 OK
deactivate B
M --> C: Affiche écran de signature (Bon de Livraison)

@enduml
`;

async function generateImage() {
    try {
        console.log("Fetching sequence diagram 1 from Kroki...");
        const response = await fetch('https://kroki.io/plantuml/png', {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: puml
        });

        const buffer = await response.arrayBuffer();
        fs.writeFileSync('C:\\\\Users\\\\user\\\\OneDrive\\\\Masaüstü\\\\Figures\\\\sequence_scan_livraison.png', Buffer.from(buffer));
        console.log("Successfully generated sequence_scan_livraison.png");
    } catch (e) {
        console.error("Failed to generate:", e);
    }
}

generateImage();
