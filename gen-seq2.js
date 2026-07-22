const fs = require('fs');

const puml = `
@startuml
skinparam defaultFontSize 14
skinparam defaultFontName sans-serif

participant "Application Mobile" as M
participant "Backend (Spring Boot)" as B
database "Base de données" as DB
participant "Interface Web (Admin)" as W

loop Toutes les 2 minutes (Tâche de fond)
    M -> M: Récupère position GPS
    M -> B: POST /api/gps/position (lat, lng, chauffeurId)
    activate B
    B -> DB: Sauvegarde PositionGPS (lat, lng, timestamp)
    B --> M: 200 OK
    deactivate B
end

== Consultation par l'administration ==

W -> B: GET /api/gps/chauffeurs/actifs
activate B
B -> DB: Récupère dernières positions
activate DB
DB --> B: Liste des positions
deactivate DB
B --> W: JSON (positions)
deactivate B

W -> W: Affiche marqueurs sur la carte Leaflet

@enduml
`;

async function generateImage() {
    try {
        console.log("Fetching sequence diagram 2 from Kroki...");
        const response = await fetch('https://kroki.io/plantuml/png', {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: puml
        });

        const buffer = await response.arrayBuffer();
        fs.writeFileSync('C:\\\\Users\\\\user\\\\OneDrive\\\\Masaüstü\\\\Figures\\\\sequence_gps.png', Buffer.from(buffer));
        console.log("Successfully generated sequence_gps.png");
    } catch (e) {
        console.error("Failed to generate:", e);
    }
}

generateImage();
