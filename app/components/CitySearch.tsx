"use client";

import { useState, useEffect, useRef } from "react";
import styles from "./CitySearch.module.css";

interface CityResult {
  displayName: string;
  name: string;
  city: string;
  postcode?: string;
  department?: string;
  departmentName?: string;
  state?: string;
  country: string;
  countryCode?: string;
  searchQuery: string;
  id?: string; // ID WeatherAPI pour recherche précise
}

interface CitySearchProps {
  value: string;
  onChange: (city: string) => void;
  placeholder?: string;
  onClose?: () => void;
}

export default function CitySearch({ value, onChange, placeholder = "Rechercher une ville...", onClose }: CitySearchProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<CityResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Synchroniser query avec value quand value change (ex: quand le modal s'ouvre)
  useEffect(() => {
    setQuery(value);
    setResults([]);
    setShowResults(false);
    setSelectedIndex(-1);
  }, [value]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setIsLoading(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/cities/search?q=${encodeURIComponent(query)}`);
        if (response.ok) {
          const data = await response.json();
          setResults(data);
          setShowResults(true);
          setSelectedIndex(-1);
        }
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query]);

  const handleSelect = (city: CityResult) => {
    onChange(city.searchQuery);
    setQuery(city.displayName);
    setShowResults(false);
    if (onClose) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      } else if (results.length > 0) {
        handleSelect(results[0]);
      } else if (query.trim()) {
        onChange(query.trim());
        if (onClose) {
          onClose();
        }
      }
    } else if (e.key === "Escape") {
      setShowResults(false);
      if (onClose) {
        onClose();
      }
    }
  };

  useEffect(() => {
    if (selectedIndex >= 0 && resultsRef.current) {
      const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [selectedIndex]);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showResults && containerRef.current && resultsRef.current) {
      const resultsElement = resultsRef.current;
      const containerElement = containerRef.current;
      const inputElement = containerElement.querySelector('input');
      
      if (inputElement) {
        const inputRect = inputElement.getBoundingClientRect();
        const containerRect = containerElement.getBoundingClientRect();
        
        // Positionner les résultats juste en dessous du champ de recherche
        resultsElement.style.position = "absolute";
        resultsElement.style.top = `${inputRect.height + 8}px`;
        resultsElement.style.left = "0";
        resultsElement.style.right = "0";
        resultsElement.style.width = "100%";
        resultsElement.style.display = "block";
        resultsElement.style.visibility = "visible";
        resultsElement.style.opacity = "1";
        resultsElement.style.zIndex = "10001";
      }
    } else if (resultsRef.current) {
      // Cacher les résultats
      resultsRef.current.style.display = "none";
    }
  }, [showResults, results]);

  return (
    <div ref={containerRef} className={styles.searchContainer}>
      <div className={styles.searchInputWrapper}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && setShowResults(true)}
          placeholder={placeholder}
          className={styles.searchInput}
        />
        {isLoading && <div className={styles.loader} />}
        {query && (
          <button
            className={styles.clearButton}
            onClick={() => {
              setQuery("");
              setResults([]);
              setShowResults(false);
            }}
          >
            ×
          </button>
        )}
      </div>

      {showResults && results.length > 0 && (
        <div 
          ref={resultsRef} 
          className={styles.results}
          onClick={(e) => e.stopPropagation()}
        >
          {results.map((city, index) => (
            <button
              key={`${city.searchQuery}-${index}`}
              className={`${styles.resultItem} ${selectedIndex === index ? styles.selected : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(city);
              }}
              type="button"
            >
              <div className={styles.resultMain}>
                <span className={styles.resultCity}>{city.city}</span>
                {city.postcode && (
                  <span className={styles.resultPostcode}>{city.postcode}</span>
                )}
              </div>
              <div className={styles.resultDetails}>
                {city.department && (
                  <span className={styles.resultDepartment}>
                    {city.department}
                    {city.departmentName && city.departmentName !== city.department && (
                      <span className={styles.departmentName}> ({city.departmentName})</span>
                    )}
                  </span>
                )}
                {city.state && city.state !== city.department && (
                  <span className={styles.resultState}>{city.state}</span>
                )}
              </div>
              <div className={styles.resultCountry}>
                {city.country}
                {city.countryCode && (
                  <span className={styles.countryCode}>{city.countryCode}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {showResults && !isLoading && query.length >= 2 && results.length === 0 && (
        <div className={styles.noResults}>
          Aucun résultat trouvé pour "{query}"
        </div>
      )}
    </div>
  );
}
