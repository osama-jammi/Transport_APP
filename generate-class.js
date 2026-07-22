const fs = require('fs');

const puml = `
@startuml
scale 1.5
skinparam defaultFontSize 14
skinparam defaultFontName sans-serif

skinparam class {
    BackgroundColor #f8fafc
    BorderColor #475569
    ArrowColor #334155
    HeaderBackgroundColor #e2e8f0
}

class Utilisateur {
    +id: Long
    +nom: String
    +prenom: String
    +matricule: String
    +role: RoleEnum
}

class Chauffeur {
    +permis: String
    +statut: String
}

class Camion {
    +id: Long
    +immatriculation: String
    +marque: String
    +capacite: Double
}

class Voyage {
    +id: Long
    +dateVoyage: Date
    +statut: StatutVoyage
    +realChargement: Date
    +realDechargement: Date
}

class Livraison {
    +id: Long
    +client: String
    +chantier: String
    +adresse: String
    +statut: StatutLivraison
}

class Article {
    +id: Long
    +reference: String
    +designation: String
    +quantite: Integer
    +estScanne: Boolean
}

class PositionGPS {
    +id: Long
    +latitude: Double
    +longitude: Double
    +timestamp: Date
}

Utilisateur <|-- Chauffeur
Chauffeur "1" -- "0..1" Camion : conduit >
Chauffeur "1" -- "*" Voyage : assigné à >
Voyage "1" *-- "*" Livraison : contient >
Livraison "1" *-- "*" Article : inclut >
Chauffeur "1" *-- "*" PositionGPS : enregistre >
Voyage "1" *-- "*" PositionGPS : tracé par >

@enduml
`;

async function generateImage() {
    try {
        console.log("Fetching class diagram from Kroki...");
        const response = await fetch('https://kroki.io/plantuml/png', {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: puml
        });

        if (!response.ok) {
            throw new Error("HTTP error! status: " + response.status);
        }

        const buffer = await response.arrayBuffer();
        fs.writeFileSync('C:\\\\Users\\\\user\\\\OneDrive\\\\Masaüstü\\\\Figures\\\\class_diagram.png', Buffer.from(buffer));
        console.log("Successfully generated class_diagram.png");
    } catch (e) {
        console.error("Failed to generate:", e);
    }
}

generateImage();
