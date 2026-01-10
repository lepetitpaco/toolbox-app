import Link from "next/link";
import styles from "./page.module.css";

interface Tool {
  title: string;
  description: string;
  path: string;
  icon: string;
  color: string;
}

const tools: Tool[] = [
  {
    title: "AniList - Statuts avec Commentaires",
    description: "Affiche les statuts d'un utilisateur AniList avec leurs commentaires. Filtres et tri disponibles.",
    path: "/anilist",
    icon: "📊",
    color: "#667eea",
  },
  {
    title: "AniList - Recherche Anime/Manga",
    description: "Recherchez des animes et mangas avec auto-complétion. Affiche les informations de base.",
    path: "/anilist/media-search",
    icon: "🔍",
    color: "#ff5757",
  },
  // Ajoutez d'autres outils ici au fur et à mesure
];

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>Toolbox App</h1>
          <p className={styles.subtitle}>
            Collection d'outils et de pages utiles
          </p>
        </div>

        <div className={styles.toolsGrid}>
          {tools.map((tool) => (
            <Link key={tool.path} href={tool.path} className={styles.toolCard}>
              <div 
                className={styles.toolIcon}
                style={{ backgroundColor: `${tool.color}20`, color: tool.color }}
              >
                {tool.icon}
              </div>
              <div className={styles.toolContent}>
                <h2 className={styles.toolTitle}>{tool.title}</h2>
                <p className={styles.toolDescription}>{tool.description}</p>
              </div>
              <div className={styles.toolArrow}>→</div>
            </Link>
          ))}
        </div>

        {tools.length === 0 && (
          <div className={styles.empty}>
            <p>Aucun outil disponible pour le moment.</p>
          </div>
        )}
      </main>
    </div>
  );
}
