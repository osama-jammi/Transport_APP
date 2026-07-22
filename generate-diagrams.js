const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const desktopPath = 'C:\\Users\\user\\OneDrive\\Masaüstü';

const diagrams = [
  {
    name: 'architecture_generale',
    content: `flowchart LR
    subgraph Clients ["Interfaces Utilisateurs"]
        W[Interface Web Angular\\n(Back-office & Admin)]
        M[Application Mobile React Native\\n(Chauffeurs)]
    end

    subgraph Serveur ["Backend Spring Boot"]
        A[API REST]
        K[Keycloak\\nAuthentification]
    end

    subgraph Data ["Bases de Données"]
        DB1[(Base App Locale\\nLivrables, GPS)]
        DB2[(Base ERP Divalto\\nLecture seule)]
    end

    W <-->|JSON/HTTP| A
    M <-->|JSON/HTTP| A
    W -.->|SSO| K
    
    A <-->|Lecture/Écriture| DB1
    A -->|Lecture seule| DB2`
  },
  {
    name: 'cas_utilisation',
    content: `flowchart LR
    actor1(Chauffeur)
    actor2(Superviseur / Admin)
    actor3(Back-office Logistique)

    subgraph App ["Application de Gestion de Livraison"]
        UC1([Se connecter avec QR Code])
        UC2([Consulter ses voyages])
        UC3([Scanner marchandise])
        UC4([Confirmer arrivée chantier])
        
        UC5([Préparer un voyage])
        UC6([Éditer un Bon de Livraison PDF])
        
        UC7([Suivre les chauffeurs GPS])
        UC8([Gérer la flotte])
        UC9([Consulter les statistiques])
    end

    actor1 --> UC1
    actor1 --> UC2
    actor1 --> UC3
    actor1 --> UC4

    actor3 --> UC5
    actor3 --> UC6
    actor3 --> UC7
    actor3 --> UC9

    actor2 --> UC7
    actor2 --> UC8
    actor2 --> UC9`
  },
  {
    name: 'diagramme_classes',
    content: `classDiagram
    class Voyage {
        +Long id
        +Date dateCreation
        +String statut
        +String refBL
        +creerBLPDF()
        +cloturer()
    }

    class Camion {
        +String immatriculation
        +String marque
        +String type
        +Boolean estLibre
    }

    class Chauffeur {
        +String matricule
        +String nom
        +String qrCode
        +Boolean estActif
    }

    class Chantier {
        +String code
        +String adresse
        +Double latitude
        +Double longitude
    }

    class LigneLivraison {
        +String codeArticle
        +Integer quantite
        +String statutScan
        +scanner()
    }

    class PositionGPS {
        +Double latitude
        +Double longitude
        +DateTime timestamp
    }

    Voyage "1" *-- "1..*" LigneLivraison : contient
    Voyage "n" --> "1" Camion : affecté à
    Voyage "n" --> "1" Chauffeur : conduit par
    Voyage "n" --> "1" Chantier : livré au
    Chauffeur "1" *-- "0..*" PositionGPS : émet`
  },
  {
    name: 'sequence_chargement',
    content: `sequenceDiagram
    participant C as Application Mobile (Chauffeur)
    participant S as Backend (Spring Boot)
    participant E as Base ERP Divalto

    C->>S: Scan QR Connexion
    S-->>C: Jeton d'authentification

    Note over C, S: Phase 1 : Chargement
    C->>S: GET /voyages/chauffeur
    S->>E: Lecture données Chantier/Articles
    E-->>S: Données ERP
    S-->>C: Liste des voyages à charger
    C->>S: Scan Article (POST /scan/chargement)
    S-->>C: Statut: "Chargé"

    Note over C, S: Phase 2 : Arrivée et Livraison
    C->>S: Confirmer Arrivée (envoi coordonnées GPS)
    S->>S: Vérification périmètre géolocalisation
    S-->>C: Validation Arrivée OK
    C->>S: Scan Article (POST /scan/livraison)
    S-->>C: Statut: "Livré"
    
    C->>S: Clôturer Voyage
    S->>S: Génération BL en PDF
    S-->>C: Voyage Terminé`
  },
  {
    name: 'sequence_gps',
    content: `sequenceDiagram
    participant C as App Mobile (Chauffeur)
    participant S as Backend (Spring Boot)
    participant W as Interface Web (Admin)

    Note over C: La tournée commence
    
    loop Toutes les X secondes
        C->>S: POST /gps/position {lat, lng, timestamp}
        S->>S: Enregistrement en base de données
    end

    W->>S: GET /gps/positions-actuelles
    S-->>W: Liste des dernières positions des chauffeurs
    Note over W: Mise à jour de la carte interactive`
  }
];

for (const diag of diagrams) {
    const mmdPath = path.join(__dirname, \`\${diag.name}.mmd\`);
    fs.writeFileSync(mmdPath, diag.content, 'utf-8');
    
    const outPath = path.join(desktopPath, \`\${diag.name}.png\`);
    console.log(\`Generating \${outPath}...\`);
    
    try {
        // Run mermaid-cli synchronously for each diagram
        execSync(\`npx -y @mermaid-js/mermaid-cli -i "\${mmdPath}" -o "\${outPath}" -b white\`, { stdio: 'inherit' });
        console.log(\`✅ \${diag.name}.png created successfully!\`);
    } catch (e) {
        console.error(\`❌ Failed to generate \${diag.name}: \`, e.message);
    }
}
console.log('All diagrams generated to desktop!');
