'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './settings.module.css';

// Liste de toutes les clés localStorage utilisées dans l'application
const STORAGE_KEYS = [
  // AniList
  'anilist_theme',
  'anilist_color_theme',
  'anilist_background_image',
  'anilist_background_image_position',
  'anilist_background_image_zoom',
  'anilist_access_token',
  'anilist_user',
  'anilist_username',
  'anilist_saved_users',
  'anilist_user_filters',
  'anilist_filter_presets',
  'anilist_compact_mode',
  'anilist_last_visit',
  // Calculator
  'calculator_notes',
  'calculator_view_mode',
  'calculator_windows',
  // Météo
  'meteo-cities',
  // Homepage
  'toolbox-layout',
];

export default function SettingsPage() {
  const [exportData, setExportData] = useState<string>('');
  const [importData, setImportData] = useState<string>('');
  const [importError, setImportError] = useState<string>('');
  const [importSuccess, setImportSuccess] = useState<boolean>(false);
  const [stats, setStats] = useState<{ total: number; used: number; size: string }>({
    total: 0,
    used: 0,
    size: '0 KB',
  });

  // Calculer les statistiques du localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      let totalSize = 0;
      let usedKeys = 0;

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key) || '';
          totalSize += key.length + value.length;
          if (STORAGE_KEYS.includes(key)) {
            usedKeys++;
          }
        }
      }

      // Taille approximative (chaque caractère = 1 byte en UTF-8, mais peut être plus pour les caractères spéciaux)
      const sizeInKB = (totalSize / 1024).toFixed(2);
      const sizeInMB = (totalSize / (1024 * 1024)).toFixed(2);

      setStats({
        total: localStorage.length,
        used: usedKeys,
        size: totalSize > 1024 * 1024 ? `${sizeInMB} MB` : `${sizeInKB} KB`,
      });
    }
  }, []);

  // Exporter toutes les données
  const handleExport = () => {
    if (typeof window === 'undefined') return;

    const data: Record<string, string | null> = {};
    let hasData = false;

    STORAGE_KEYS.forEach((key) => {
      const value = localStorage.getItem(key);
      if (value !== null) {
        data[key] = value;
        hasData = true;
      }
    });

    if (!hasData) {
      setExportData('');
      alert('Aucune donnée à exporter.');
      return;
    }

    const exportObject = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      data: data,
    };

    const jsonString = JSON.stringify(exportObject, null, 2);
    setExportData(jsonString);

    // Créer un fichier de téléchargement
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `toolbox-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Importer des données
  const handleImport = () => {
    if (typeof window === 'undefined') return;

    setImportError('');
    setImportSuccess(false);

    if (!importData.trim()) {
      setImportError('Veuillez coller les données à importer.');
      return;
    }

    try {
      const parsed = JSON.parse(importData);

      // Vérifier le format
      if (!parsed.data || typeof parsed.data !== 'object') {
        setImportError('Format de fichier invalide. Le fichier doit contenir un objet "data".');
        return;
      }

      // Demander confirmation avant d'importer
      const confirmed = window.confirm(
        `Êtes-vous sûr de vouloir importer ces données ? Cela écrasera vos données actuelles pour les clés suivantes :\n\n${Object.keys(parsed.data).join(', ')}\n\nCette action est irréversible.`
      );

      if (!confirmed) {
        return;
      }

      // Importer les données
      let importedCount = 0;
      Object.entries(parsed.data).forEach(([key, value]) => {
        if (STORAGE_KEYS.includes(key) && typeof value === 'string') {
          localStorage.setItem(key, value);
          importedCount++;
        }
      });

      setImportSuccess(true);
      setImportData('');
      
      // Recharger la page après 1 seconde pour appliquer les changements
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      setImportError(`Erreur lors de l'import : ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  };

  // Effacer toutes les données
  const handleClear = () => {
    if (typeof window === 'undefined') return;

    const confirmed = window.confirm(
      'Êtes-vous sûr de vouloir effacer TOUTES les données sauvegardées ? Cette action est irréversible.'
    );

    if (!confirmed) {
      return;
    }

    const doubleConfirm = window.confirm(
      'Dernière confirmation : Voulez-vous vraiment tout effacer ?'
    );

    if (!doubleConfirm) {
      return;
    }

    STORAGE_KEYS.forEach((key) => {
      localStorage.removeItem(key);
    });

    alert('Toutes les données ont été effacées. La page va se recharger.');
    window.location.reload();
  };

  return (
    <div className={styles.container}>
      <Link href="/" className={styles.backButton}>
        ← Retour
      </Link>
      
      <div className={styles.content}>
        <h1 className={styles.title}>⚙️ Paramètres</h1>

        {/* Statistiques */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Statistiques</h2>
          <div className={styles.stats}>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Clés totales :</span>
              <span className={styles.statValue}>{stats.total}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Clés utilisées :</span>
              <span className={styles.statValue}>{stats.used}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Taille totale :</span>
              <span className={styles.statValue}>{stats.size}</span>
            </div>
          </div>
        </div>

        {/* Export */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Exporter les données</h2>
          <p className={styles.description}>
            Exportez toutes vos données sauvegardées (préférences, villes météo, calculs, etc.) dans un fichier JSON.
          </p>
          <button onClick={handleExport} className={styles.exportButton}>
            📥 Exporter les données
          </button>
          {exportData && (
            <div className={styles.exportPreview}>
              <h3>Données exportées :</h3>
              <textarea
                readOnly
                value={exportData}
                className={styles.textarea}
                rows={10}
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(exportData);
                  alert('Données copiées dans le presse-papiers !');
                }}
                className={styles.copyButton}
              >
                📋 Copier
              </button>
            </div>
          )}
        </div>

        {/* Import */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Importer les données</h2>
          <p className={styles.description}>
            Importez des données sauvegardées depuis un fichier JSON. Cela écrasera vos données actuelles.
          </p>
          <textarea
            value={importData}
            onChange={(e) => {
              setImportData(e.target.value);
              setImportError('');
              setImportSuccess(false);
            }}
            placeholder="Collez ici le contenu du fichier JSON exporté..."
            className={styles.textarea}
            rows={10}
          />
          {importError && (
            <div className={styles.error}>{importError}</div>
          )}
          {importSuccess && (
            <div className={styles.success}>
              ✅ Données importées avec succès ! La page va se recharger...
            </div>
          )}
          <button
            onClick={handleImport}
            className={styles.importButton}
            disabled={!importData.trim()}
          >
            📤 Importer les données
          </button>
        </div>

        {/* Effacer */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Effacer les données</h2>
          <p className={styles.description}>
            Supprime toutes les données sauvegardées de l'application. Cette action est irréversible.
          </p>
          <button onClick={handleClear} className={styles.clearButton}>
            🗑️ Effacer toutes les données
          </button>
        </div>
      </div>
    </div>
  );
}
