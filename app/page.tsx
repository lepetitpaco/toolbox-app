import Link from "next/link";
import styles from "./page.module.css";

interface Feature {
  name: string;
  description: string;
  path: string;
  icon: string;
}

const anilistFeatures: Feature[] = [
  {
    name: "Home",
    description: "Affiche les statuts d'un utilisateur AniList avec leurs commentaires. Filtres et tri disponibles.",
    path: "/anilist/home",
    icon: "🏠",
  },
  {
    name: "Search",
    description: "Recherchez des animes et mangas avec auto-complétion. Affiche les informations et scores des utilisateurs suivis.",
    path: "/anilist/search",
    icon: "🔍",
  },
];

const otherTools: Feature[] = [
  {
    name: "Countdown",
    description: "Compte à rebours jusqu'à une heure spécifique avec notifications navigateur. Partageable via URL.",
    path: "/countdown",
    icon: "⏰",
  },
  {
    name: "Encoder / Decoder",
    description: "Encodez et décodez du texte en Base64, URL, HTML entities, ou générez des hash MD5, SHA-256, SHA-512.",
    path: "/encoder",
    icon: "🔐",
  },
  {
    name: "Calculator Notes",
    description: "Bloc-notes avec calculatrice intégrée. Tapez des calculs (1+1) et appuyez sur Entrée pour voir le résultat.",
    path: "/calculator",
    icon: "📝",
  },
  {
    name: "Date Calculator",
    description: "Calculez une date future en ajoutant une durée (ex: 7J et 4h). Affiche la date et l'heure exacte résultante.",
    path: "/date-calculator",
    icon: "📅",
  },
];

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>Paco's Toolbox</h1>
          <p className={styles.subtitle}>
            Collection d'outils et de pages utiles
          </p>
        </div>

        <div className={styles.toolsGrid}>
          <div className={styles.toolCard}>
            <div className={styles.toolHeader}>
              <div 
                className={styles.toolIcon}
                style={{ backgroundColor: '#667eea20', color: '#667eea' }}
              >
                📊
              </div>
              <div className={styles.toolContent}>
                <h2 className={styles.toolTitle}>AniList</h2>
                <p className={styles.toolDescription}>
                  Outils pour explorer et analyser les données AniList
                </p>
              </div>
            </div>
            
            <div className={styles.featuresList}>
              {anilistFeatures.map((feature) => (
                <Link 
                  key={feature.path} 
                  href={feature.path} 
                  className={styles.featureItem}
                >
                  <span className={styles.featureIcon}>{feature.icon}</span>
                  <div className={styles.featureContent}>
                    <h3 className={styles.featureName}>{feature.name}</h3>
                    <p className={styles.featureDescription}>{feature.description}</p>
                  </div>
                  <div className={styles.featureArrow}>→</div>
                </Link>
              ))}
            </div>
          </div>

          <div className={styles.toolCard}>
            <div className={styles.toolHeader}>
              <div 
                className={styles.toolIcon}
                style={{ backgroundColor: '#f59e0b20', color: '#f59e0b' }}
              >
                ⚡
              </div>
              <div className={styles.toolContent}>
                <h2 className={styles.toolTitle}>Outils</h2>
                <p className={styles.toolDescription}>
                  Collection d'outils pratiques et amusants
                </p>
              </div>
            </div>
            
            <div className={styles.featuresList}>
              {otherTools.map((feature) => (
                <Link 
                  key={feature.path} 
                  href={feature.path} 
                  className={styles.featureItem}
                >
                  <span className={styles.featureIcon}>{feature.icon}</span>
                  <div className={styles.featureContent}>
                    <h3 className={styles.featureName}>{feature.name}</h3>
                    <p className={styles.featureDescription}>{feature.description}</p>
                  </div>
                  <div className={styles.featureArrow}>→</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
