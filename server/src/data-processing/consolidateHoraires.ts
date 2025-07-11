import "dotenv/config";
import sequelize from "../config/database";
import { parseHoraires } from "../tools/horairesParser";
import {
  LogLevel,
  initializeConsoleLogStream,
  redirectConsoleOutput,
} from "../tools/logger";

import { Access } from "../models/access.model";
import { Book } from "../models/book.model";
import { BookTerminal } from "../models/book_terminal.model";
import { Compagny } from "../models/compagny.model";
import { ImportLog } from "../models/importlog.model";
import { Observation } from "../models/observation.model";
import { Operator } from "../models/operator.model";
import { Plug } from "../models/plug.model";
import { Power } from "../models/power.model";
import { Provider } from "../models/provider.model";
import { request } from "../models/request.model";
import { Station } from "../models/station.model";
import { Terminal } from "../models/terminal.model";
import { TerminalPlug } from "../models/terminal_plug.model";
import { User } from "../models/user.model";
import { Vehicule } from "../models/vehicule.model";

// Initialise les logs pour un affichage propre
initializeConsoleLogStream();
redirectConsoleOutput();

async function runHorairesConsolidation() {
  console.log(
    "Démarrage du script de consolidation des horaires...",
    LogLevel.INFO,
  );

  try {
    // --- DÉBUT DE L'AJOUT : INITIALISATION MINIMALE ---
    // On copie/colle la logique d'initialisation de app.ts ici.
    // 1. Initialiser chaque modèle
    User.initialize(sequelize);
    Access.initialize(sequelize);
    Book.initialize(sequelize);
    Compagny.initialize(sequelize);
    Operator.initialize(sequelize);
    Plug.initialize(sequelize);
    Power.initialize(sequelize);
    Provider.initialize(sequelize);
    ImportLog.initialize(sequelize);
    Station.initialize(sequelize);
    Vehicule.initialize(sequelize);
    Terminal.initialize(sequelize);
    Observation.initialize(sequelize);
    request.initialize(sequelize);
    BookTerminal.initialize(sequelize);
    TerminalPlug.initialize(sequelize);
    console.log("Modèles initialisés pour le script.", LogLevel.DEBUG);

    // 2. Définir les associations
    User.associate();
    Access.associate();
    Book.associate();
    BookTerminal.associate();
    Compagny.associate();
    Observation.associate();
    Operator.associate();
    Plug.associate();
    Power.associate();
    Provider.associate();
    request.associate();
    Station.associate();
    Terminal.associate();
    TerminalPlug.associate();
    Vehicule.associate();
    ImportLog.associate();
    console.log("Associations définies pour le script.", LogLevel.DEBUG);
    // --- FIN DE L'AJOUT ---

    const stationsToProcess = await Station.findAll({});

    console.log(`${stationsToProcess.length} stations à traiter.`);
    let successCount = 0;
    let errorCount = 0;

    // La boucle reste inchangée...
    for (const station of stationsToProcess) {
      if (station.horaires) {
        const parsedResult = parseHoraires(station.horaires);

        if (parsedResult) {
          await station.update({ consolidated_horaires: parsedResult });
          successCount++;
        } else {
          console.warn(
            `Échec du parsing pour la station ${station.id} (horaires: "${station.horaires}")`,
            LogLevel.WARN,
          );
          errorCount++;
        }
      }
    }

    console.log("--- Rapport de consolidation ---", LogLevel.INFO);
    console.log(
      `✅ Stations traitées avec succès: ${successCount}`,
      LogLevel.INFO,
    );
    console.log(`❌ Échecs de parsing: ${errorCount}`, LogLevel.INFO);
    console.log("Consolidation des horaires terminée.", LogLevel.INFO);
  } catch (error) {
    console.error(
      "❌ Une erreur critique est survenue pendant la consolidation:",
      error,
      LogLevel.CRITICAL,
    );
  } finally {
    await sequelize.close();
  }
}

runHorairesConsolidation().catch((error) => {
  console.error(
    "Le script de consolidation s'est terminé avec une erreur fatale:",
    error, // Affiche l'erreur qui a été propagée
    LogLevel.CRITICAL,
  );
  // Termine le processus avec un code d'erreur pour signaler l'échec
  process.exit(1);
});
