"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import styles from "./page.module.css";

interface App {
  id: string;
  name: string;
  path: string;
  icon: string;
  color: string;
  x: number;
  y: number;
  size: number;
}


const defaultApps: Omit<App, "x" | "y" | "size">[] = [
  {
    id: "anilist-home",
    name: "AniList Home",
    path: "/anilist/home",
    icon: "🏠",
    color: "#667eea",
  },
  {
    id: "anilist-search",
    name: "AniList Search",
    path: "/anilist/search",
    icon: "🔍",
    color: "#667eea",
  },
  {
    id: "meteo",
    name: "Météo",
    path: "/meteo",
    icon: "🌤️",
    color: "#3b82f6",
  },
  {
    id: "countdown",
    name: "Countdown",
    path: "/countdown",
    icon: "⏰",
    color: "#f59e0b",
  },
  {
    id: "encoder",
    name: "Encoder",
    path: "/encoder",
    icon: "🔐",
    color: "#10b981",
  },
  {
    id: "calculator",
    name: "Calculator",
    path: "/calculator",
    icon: "📝",
    color: "#3b82f6",
  },
  {
    id: "date-calc",
    name: "Date Calc",
    path: "/date-calculator",
    icon: "📅",
    color: "#8b5cf6",
  },
  {
    id: "file-diff",
    name: "File Diff",
    path: "/file-diff",
    icon: "📊",
    color: "#ef4444",
  },
  {
    id: "formatter",
    name: "Formatter",
    path: "/formatter",
    icon: "✨",
    color: "#ec4899",
  },
  {
    id: "settings",
    name: "Settings",
    path: "/settings",
    icon: "⚙️",
    color: "#6b7280",
  },
];

function getDefaultLayout(): { apps: App[] } {
  // Grille fixe de 20px pour un alignement précis
  const GRID_SIZE = 20;
  const APP_SIZE = 100;
  const APP_SPACING = 120; // Taille + marge (100 + 20)
  const gridCols = Math.floor((typeof window !== "undefined" ? window.innerWidth : 1920) / APP_SPACING) || 4;
  const startX = Math.floor(50 / GRID_SIZE) * GRID_SIZE; // Aligné sur la grille
  const startY = Math.floor(100 / GRID_SIZE) * GRID_SIZE; // Aligné sur la grille
  
  const apps = defaultApps.map((app, index) => ({
    ...app,
    x: startX + (index % gridCols) * APP_SPACING,
    y: startY + Math.floor(index / gridCols) * APP_SPACING,
    size: APP_SIZE,
  }));

  return { apps };
}

function loadLayout(): { apps: App[] } {
  if (typeof window === "undefined") return getDefaultLayout();
  
  const saved = localStorage.getItem("toolbox-layout");
  if (!saved) return getDefaultLayout();
  
  try {
    const parsed = JSON.parse(saved);
    const defaultLayout = getDefaultLayout();
    
    // Gérer les anciens layouts qui n'ont que des apps
    if (Array.isArray(parsed)) {
      // Ancien format - seulement des apps
      const savedIds = new Set(parsed.map((a: App) => a.id));
      const merged = [...parsed];
      
      defaultLayout.apps.forEach((app) => {
        if (!savedIds.has(app.id)) {
          merged.push(app);
        }
      });
      
      return { apps: merged };
    }
    
    // Format avec apps (et peut-être widgets qu'on ignore)
    const savedAppIds = new Set((parsed.apps || []).map((a: App) => a.id));
    const mergedApps = [...(parsed.apps || [])];
    
    defaultLayout.apps.forEach((app) => {
      if (!savedAppIds.has(app.id)) {
        mergedApps.push(app);
      }
    });
    
    return { apps: mergedApps };
  } catch {
    return getDefaultLayout();
  }
}

function saveLayout(apps: App[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem("toolbox-layout", JSON.stringify({ apps }));
}

export default function Home() {
  // Utiliser le layout par défaut pour l'hydratation (identique serveur/client)
  const defaultLayout = getDefaultLayout();
  const [apps, setApps] = useState<App[]>(defaultLayout.apps);
  const [isEditing, setIsEditing] = useState(false);
  const [currentTime, setCurrentTime] = useState("--:--:--");
  const [draggedItem, setDraggedItem] = useState<{ id: string; type: "app" } | null>(null);
  const [resizedItem, setResizedItem] = useState<{ id: string; type: "app" } | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, size: 0 });
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Charger le layout depuis localStorage après le montage
  useEffect(() => {
    setMounted(true);
    const layout = loadLayout();
    setApps(layout.apps);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("fr-FR", { 
        hour: "2-digit", 
        minute: "2-digit",
        second: "2-digit"
      }));
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [mounted]);

  useEffect(() => {
    if (!isEditing && mounted) {
      saveLayout(apps);
    }
  }, [apps, isEditing, mounted]);

  const handleMouseDown = (
    e: React.MouseEvent,
    id: string,
    type: "app",
    action: "drag" | "resize"
  ) => {
    if (!isEditing) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    if (action === "drag") {
      setDraggedItem({ id, type });
      const app = apps.find((a) => a.id === id);
      if (app) {
        const wrapperElement = (e.currentTarget as HTMLElement).closest(`.${styles.appWrapper}`) as HTMLElement;
        if (wrapperElement) {
          const wrapperRect = wrapperElement.getBoundingClientRect();
          // Calculer l'offset par rapport au point de clic dans l'élément
          setDragOffset({
            x: e.clientX - wrapperRect.left,
            y: e.clientY - wrapperRect.top,
          });
        } else {
          setDragOffset({
            x: e.clientX - containerRect.left - app.x,
            y: e.clientY - containerRect.top - app.y,
          });
        }
      }
    } else {
      setResizedItem({ id, type });
      const app = apps.find((a) => a.id === id);
      if (app) {
        setResizeStart({
          x: e.clientX,
          y: e.clientY,
          size: app.size,
        });
      }
    }
  };

  useEffect(() => {
    if (!draggedItem && !resizedItem) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return;

      if (draggedItem) {
        setApps((prevApps) =>
          prevApps.map((app) => {
            if (app.id === draggedItem.id) {
              const newX = e.clientX - containerRect.left - dragOffset.x;
              const newY = e.clientY - containerRect.top - dragOffset.y;
              const maxX = containerRect.width - app.size;
              const maxY = containerRect.height - app.size - 20;
              const minY = 80; // Empêcher d'aller derrière la top barre (60px + 20px de marge)
              
              // Aligner sur la grille de 20px
              const GRID_SIZE = 20;
              const snappedX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
              const snappedY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
              
              return {
                ...app,
                x: Math.max(0, Math.min(snappedX, maxX)),
                y: Math.max(minY, Math.min(snappedY, maxY)),
              };
            }
            return app;
          })
        );
      } else if (resizedItem) {
        setApps((prevApps) =>
          prevApps.map((app) => {
            if (app.id === resizedItem.id) {
              const deltaX = e.clientX - resizeStart.x;
              const deltaY = e.clientY - resizeStart.y;
              const delta = Math.max(deltaX, deltaY);
              
              // Resize avec snap sur la grille de 20px
              const GRID_SIZE = 20;
              let newSize = resizeStart.size + delta;
              newSize = Math.round(newSize / GRID_SIZE) * GRID_SIZE;
              newSize = Math.max(60, Math.min(150, newSize));
              
              return { ...app, size: newSize };
            }
            return app;
          })
        );
      }
    };

    const handleMouseUp = () => {
      setDraggedItem(null);
      setResizedItem(null);
    };

    document.addEventListener("mousemove", handleMouseMove, { passive: false });
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggedItem, resizedItem, dragOffset, resizeStart, apps]);

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.time}>{currentTime}</div>
        <div className={styles.topBarRight}>
          {isEditing && (
            <>
              <span className={styles.editHint}>Mode édition actif - Déplacez les icônes</span>
            </>
          )}
          <button
            className={`${styles.editButton} ${isEditing ? styles.active : ""}`}
            onClick={() => {
              setIsEditing(!isEditing);
            }}
            title={isEditing ? "Terminer l'édition" : "Modifier le layout"}
          >
            {isEditing ? "✓" : "✎"}
          </button>
        </div>
        
      </div>

      <main className={styles.main} ref={containerRef}>
        <div className={styles.appsContainer}>
          {apps.map((app) => (
            <div
              key={app.id}
              className={`${styles.appWrapper} ${isEditing ? styles.editing : ""}`}
              style={{
                left: `${app.x}px`,
                top: `${app.y}px`,
                width: `${app.size}px`,
              }}
            >
              {isEditing ? (
                <div 
                  className={styles.appIcon}
                  onMouseDown={(e) => handleMouseDown(e, app.id, "app", "drag")}
                >
                  <div
                    className={styles.appIconContainer}
                    style={{
                      width: `${app.size}px`,
                      height: `${app.size}px`,
                      backgroundColor: `${app.color}15`,
                      borderColor: `${app.color}30`,
                    }}
                  >
                    <div
                      className={styles.appIconEmoji}
                      style={{ color: app.color, fontSize: `${app.size * 0.3}px` }}
                    >
                      {app.icon}
                    </div>
                  </div>
                  <span
                    className={styles.appName}
                    style={{ fontSize: `${Math.max(10, app.size * 0.12)}px` }}
                  >
                    {app.name}
                  </span>
                </div>
              ) : (
                <Link
                  href={app.path}
                  className={styles.appIcon}
                >
                  <div
                    className={styles.appIconContainer}
                    style={{
                      width: `${app.size}px`,
                      height: `${app.size}px`,
                      backgroundColor: `${app.color}15`,
                      borderColor: `${app.color}30`,
                    }}
                  >
                    <div
                      className={styles.appIconEmoji}
                      style={{ color: app.color, fontSize: `${app.size * 0.3}px` }}
                    >
                      {app.icon}
                    </div>
                  </div>
                  <span
                    className={styles.appName}
                    style={{ fontSize: `${Math.max(10, app.size * 0.12)}px` }}
                  >
                    {app.name}
                  </span>
                </Link>
              )}
              {isEditing && (
                <div
                  className={styles.resizeHandle}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleMouseDown(e, app.id, "app", "resize");
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
