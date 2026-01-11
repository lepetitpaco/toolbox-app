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
        </div>
      </main>
    </div>
  );
}
