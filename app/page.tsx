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
];

function getDefaultLayout(): App[] {
  const gridCols = 4;
  const spacing = 140;
  const startX = 50;
  const startY = 100;
  
  return defaultApps.map((app, index) => ({
    ...app,
    x: startX + (index % gridCols) * spacing,
    y: startY + Math.floor(index / gridCols) * spacing,
    size: 100,
  }));
}

function loadLayout(): App[] {
  if (typeof window === "undefined") return getDefaultLayout();
  
  const saved = localStorage.getItem("toolbox-layout");
  if (!saved) return getDefaultLayout();
  
  try {
    const parsed = JSON.parse(saved);
    // Merge avec les apps par défaut au cas où de nouvelles apps sont ajoutées
    const savedIds = new Set(parsed.map((a: App) => a.id));
    const defaultLayout = getDefaultLayout();
    const merged = [...parsed];
    
    defaultLayout.forEach((app) => {
      if (!savedIds.has(app.id)) {
        merged.push(app);
      }
    });
    
    return merged;
  } catch {
    return getDefaultLayout();
  }
}

function saveLayout(apps: App[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem("toolbox-layout", JSON.stringify(apps));
}

export default function Home() {
  // Utiliser le layout par défaut pour l'hydratation (identique serveur/client)
  const [apps, setApps] = useState<App[]>(getDefaultLayout);
  const [isEditing, setIsEditing] = useState(false);
  const [currentTime, setCurrentTime] = useState("--:--:--");
  const [draggedApp, setDraggedApp] = useState<string | null>(null);
  const [resizedApp, setResizedApp] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, size: 0 });
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Charger le layout depuis localStorage après le montage
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("toolbox-layout");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const savedIds = new Set(parsed.map((a: App) => a.id));
        const defaultLayout = getDefaultLayout();
        const merged = [...parsed];
        
        defaultLayout.forEach((app) => {
          if (!savedIds.has(app.id)) {
            merged.push(app);
          }
        });
        
        setApps(merged);
      } catch {
        // En cas d'erreur, garder le layout par défaut
      }
    }
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
    if (!isEditing) {
      saveLayout(apps);
    }
  }, [apps, isEditing]);

  const handleMouseDown = (e: React.MouseEvent, appId: string, type: "drag" | "resize") => {
    if (!isEditing) return;
    
    e.preventDefault();
    e.stopPropagation();
    const app = apps.find((a) => a.id === appId);
    if (!app) return;

    if (type === "drag") {
      setDraggedApp(appId);
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (containerRect) {
        const wrapperRect = (e.currentTarget as HTMLElement).closest(`.${styles.appWrapper}`)?.getBoundingClientRect();
        if (wrapperRect) {
          setDragOffset({
            x: e.clientX - wrapperRect.left - app.size / 2,
            y: e.clientY - wrapperRect.top - app.size / 2,
          });
        } else {
          setDragOffset({
            x: e.clientX - containerRect.left - app.x,
            y: e.clientY - containerRect.top - app.y,
          });
        }
      }
    } else {
      setResizedApp(appId);
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        size: app.size,
      });
    }
  };

  useEffect(() => {
    if (!draggedApp && !resizedApp) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return;

      if (draggedApp) {
        setApps((prevApps) =>
          prevApps.map((app) => {
            if (app.id === draggedApp) {
              const newX = e.clientX - containerRect.left - dragOffset.x;
              const newY = e.clientY - containerRect.top - dragOffset.y;
              const maxX = containerRect.width - app.size;
              const maxY = containerRect.height - app.size - 20; // 20px pour le nom
              return {
                ...app,
                x: Math.max(0, Math.min(newX, maxX)),
                y: Math.max(0, Math.min(newY, maxY)),
              };
            }
            return app;
          })
        );
      } else if (resizedApp) {
        setApps((prevApps) =>
          prevApps.map((app) => {
            if (app.id === resizedApp) {
              const deltaX = e.clientX - resizeStart.x;
              const deltaY = e.clientY - resizeStart.y;
              const delta = Math.max(deltaX, deltaY);
              const newSize = Math.max(60, Math.min(150, resizeStart.size + delta));
              return { ...app, size: newSize };
            }
            return app;
          })
        );
      }
    };

    const handleMouseUp = () => {
      setDraggedApp(null);
      setResizedApp(null);
    };

    document.addEventListener("mousemove", handleMouseMove, { passive: false });
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggedApp, resizedApp, dragOffset, resizeStart]);

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.time}>{currentTime}</div>
        <div className={styles.topBarRight}>
          {isEditing && (
            <span className={styles.editHint}>Mode édition actif - Déplacez les icônes</span>
          )}
          <button
            className={`${styles.editButton} ${isEditing ? styles.active : ""}`}
            onClick={() => setIsEditing(!isEditing)}
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
                  onMouseDown={(e) => handleMouseDown(e, app.id, "drag")}
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
                    handleMouseDown(e, app.id, "resize");
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
