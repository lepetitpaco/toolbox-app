"use client";

import { useEffect } from "react";
import CitySearch from "./CitySearch";
import styles from "./CitySearchModal.module.css";

interface CitySearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (city: string) => void;
  currentCity?: string;
}

export default function CitySearchModal({ isOpen, onClose, onSelect, currentCity = "" }: CitySearchModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelect = (city: string) => {
    onSelect(city);
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Rechercher une ville</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>
        <div className={styles.content}>
          <CitySearch
            value={currentCity}
            onChange={handleSelect}
            placeholder="Rechercher une ville..."
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
}
