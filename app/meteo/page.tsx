"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import CitySearchModal from "../components/CitySearchModal";
import styles from "./page.module.css";

interface WeatherData {
  city: string;
  country: string;
  region?: string;
  current: {
    temp: string;
    feelsLike: string;
    condition: string;
    icon: string;
    humidity: string;
    windSpeed: string;
    windDir: string;
    pressure: string;
    visibility: string;
  };
  today: {
    maxTemp: string;
    minTemp: string;
    sunrise: string;
    sunset: string;
  };
  tomorrow: {
    maxTemp: string;
    minTemp: string;
    condition: string;
    icon: string;
  };
  forecast?: Array<{
    date: string;
    dayName: string;
    dayShort: string;
    maxTemp: string;
    minTemp: string;
    condition: string;
    icon: string;
    humidity: string;
    windSpeed: string;
  }>;
}

export default function MeteoPage() {
  const [cities, setCities] = useState<string[]>([]);
  const [weatherData, setWeatherData] = useState<Map<string, WeatherData>>(new Map());
  const [loading, setLoading] = useState<Map<string, boolean>>(new Map());
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [showCityModal, setShowCityModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingCityIndex, setEditingCityIndex] = useState<number | null>(null);
  const [draggedCityIndex, setDraggedCityIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Charger les villes depuis localStorage après le montage (client uniquement)
  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem("meteo-cities");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCities(parsed);
        }
      } catch {
        // Ignore invalid JSON
      }
    }
  }, []);

  // Sauvegarder les villes dans localStorage
  useEffect(() => {
    if (isMounted && cities.length > 0) {
      localStorage.setItem("meteo-cities", JSON.stringify(cities));
    }
  }, [cities, isMounted]);

  // Si aucune ville, activer le mode édition
  useEffect(() => {
    if (isMounted && cities.length === 0) {
      setIsEditing(true);
    }
  }, [cities.length, isMounted]);

  // Charger les données météo pour toutes les villes
  useEffect(() => {
    cities.forEach((city) => {
      if (!city || city.trim() === "") return;

      const fetchWeather = async () => {
        try {
          setLoading((prev) => new Map(prev).set(city, true));
          setErrors((prev) => new Map(prev).set(city, ""));
          const response = await fetch(`/api/weather?city=${encodeURIComponent(city)}`);
          
          if (!response.ok) {
            throw new Error("Échec du chargement");
          }
          
          const data = await response.json();
          setWeatherData((prev) => new Map(prev).set(city, data));
        } catch (err) {
          setErrors((prev) => new Map(prev).set(city, err instanceof Error ? err.message : "Erreur de chargement"));
        } finally {
          setLoading((prev) => new Map(prev).set(city, false));
        }
      };

      fetchWeather();
    });
  }, [cities]);

  // Rafraîchir toutes les 10 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      cities.forEach((city) => {
        if (!city || city.trim() === "") return;
        fetch(`/api/weather?city=${encodeURIComponent(city)}`)
          .then((res) => res.json())
          .then((data) => {
            setWeatherData((prev) => new Map(prev).set(city, data));
          })
          .catch(() => {});
      });
    }, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [cities]);

  const handleCitySelect = (newCity: string) => {
    if (newCity.trim()) {
      setCities([...cities, newCity.trim()]);
      setShowCityModal(false);
    }
  };

  const handleCityUpdate = (index: number, city: string) => {
    setCities((prevCities) => {
      if (prevCities[index] === city) return prevCities;
      const newCities = [...prevCities];
      newCities[index] = city;
      return newCities;
    });
  };

  const handleRemoveCity = (index: number) => {
    const newCities = cities.filter((_, i) => i !== index);
    setCities(newCities);
    if (newCities.length === 0) {
      setIsEditing(true);
    }
  };

  const handleDragStart = (index: number) => {
    if (!isEditing) return;
    setDraggedCityIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedCityIndex !== null && draggedCityIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    if (draggedCityIndex !== null && dragOverIndex !== null && draggedCityIndex !== dragOverIndex) {
      const newCities = [...cities];
      const [removed] = newCities.splice(draggedCityIndex, 1);
      newCities.splice(dragOverIndex, 0, removed);
      setCities(newCities);
    }
    setDraggedCityIndex(null);
    setDragOverIndex(null);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  // Générer le lien vers WeatherAPI.com
  // Format attendu: /weather/q/{ville-slug}-{region-slug}-{pays-slug}-{id}
  const getWeatherAPILink = (cityQuery: string, cityName?: string, country?: string, region?: string) => {
    // Fonction helper pour créer un slug URL-friendly
    const createSlug = (text: string): string => {
      return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Supprimer les accents
        .replace(/[^a-z0-9]+/g, "-") // Remplacer les caractères spéciaux par des tirets
        .replace(/^-+|-+$/g, ""); // Supprimer les tirets en début/fin
    };

    // Si c'est un format ID (id:775178), extraire l'ID et créer le lien direct
    if (cityQuery.startsWith("id:")) {
      const cityId = cityQuery.replace("id:", "");
      
      // Construire le slug dans le format WeatherAPI: ville-region-pays-id
      const slugParts: string[] = [];
      
      if (cityName) {
        slugParts.push(createSlug(cityName));
      }
      if (region && region !== cityName) {
        slugParts.push(createSlug(region));
      }
      if (country) {
        slugParts.push(createSlug(country));
      }
      slugParts.push(cityId);
      
      const slug = slugParts.join("-");
      return `https://www.weatherapi.com/weather/q/${slug}`;
    }
    
    // Si c'est des coordonnées (lat,lon)
    if (cityQuery.includes(",") && !isNaN(parseFloat(cityQuery.split(",")[0]))) {
      const [lat, lon] = cityQuery.split(",");
      return `https://www.weatherapi.com/my/location?lat=${lat}&lon=${lon}`;
    }
    
    // Sinon, utiliser le format de recherche standard
    return `https://www.weatherapi.com/weather/q/${encodeURIComponent(cityQuery)}`;
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link href="/" className={styles.backButton}>
          ← Retour
        </Link>
        <h1 className={styles.title}>Météo</h1>
        <div className={styles.headerActions}>
          <button
            className={styles.editButton}
            onClick={() => setIsEditing(!isEditing)}
            title={isEditing ? "Terminer l'édition" : "Modifier"}
          >
            {isEditing ? "✓" : "✎"}
          </button>
          {isEditing && (
            <button
              className={styles.addButton}
              onClick={() => setShowCityModal(true)}
              title="Ajouter une ville"
            >
              +
            </button>
          )}
        </div>
      </div>

      {cities.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyContent}>
            <div className={styles.emptyIcon}>🌤️</div>
            <p className={styles.emptyText}>Aucune ville configurée</p>
            <button
              className={styles.emptyButton}
              onClick={() => setShowCityModal(true)}
            >
              + Ajouter une ville
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.citiesGrid}>
          {cities.map((city, index) => {
              const cityWeather = weatherData.get(city);
              const cityLoading = loading.get(city);
              const cityError = errors.get(city);

              return (
                <div
                  key={index}
                  className={`${styles.cityCard} ${draggedCityIndex === index ? styles.dragging : ""} ${dragOverIndex === index ? styles.dragOver : ""}`}
                  draggable={isEditing}
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  onDragLeave={handleDragLeave}
                >
                  {cityLoading ? (
                    <div className={styles.loading}>Chargement...</div>
                  ) : cityError || !cityWeather ? (
                    <div className={styles.error}>
                      <div className={styles.errorIcon}>❌</div>
                      <p>{cityError || "Erreur de chargement"}</p>
                      {isEditing && (
                        <div className={styles.errorActions}>
                          <button
                            className={styles.editCityButton}
                            onClick={() => {
                              setEditingCityIndex(index);
                              setShowCityModal(true);
                            }}
                          >
                            ✎ Modifier
                          </button>
                          {cities.length > 1 && (
                            <button
                              className={styles.removeButton}
                              onClick={() => handleRemoveCity(index)}
                            >
                              × Supprimer
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className={styles.cityHeader}>
                        <div className={styles.location}>
                          <h2 className={styles.cityName}>{cityWeather.city}</h2>
                          <p className={styles.country}>{cityWeather.country}</p>
                        </div>
                        <div className={styles.headerButtons}>
                          <a
                            href={getWeatherAPILink(city, cityWeather.city, cityWeather.country, cityWeather.region)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.externalLink}
                            title="Voir la météo détaillée sur WeatherAPI.com"
                          >
                            🌐
                          </a>
                          {isEditing && (
                            <>
                              <button
                                className={styles.iconButton}
                            onClick={() => {
                              setEditingCityIndex(index);
                              setShowCityModal(true);
                            }}
                                title="Modifier la ville"
                              >
                                ✎
                              </button>
                              {cities.length > 1 && (
                                <button
                                  className={styles.iconButton}
                                  onClick={() => handleRemoveCity(index)}
                                  title="Supprimer"
                                >
                                  ×
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      <div className={styles.mainWeather}>
                        <div className={styles.temperature}>
                          <span className={styles.temp}>{cityWeather.current.temp}°</span>
                          <span className={styles.feelsLike}>Ressenti {cityWeather.current.feelsLike}°</span>
                        </div>
                        <div className={styles.condition}>
                          <span className={styles.icon}>{cityWeather.current.icon}</span>
                          <span className={styles.text}>{cityWeather.current.condition}</span>
                        </div>
                      </div>

                      <div className={styles.details}>
                        <div className={styles.detailsColumn}>
                          <div className={styles.detailsGrid}>
                            <div className={styles.detailCard}>
                              <span className={styles.detailLabel}>Max</span>
                              <span className={styles.detailValue}>{cityWeather.today.maxTemp}°</span>
                            </div>
                            <div className={styles.detailCard}>
                              <span className={styles.detailLabel}>Min</span>
                              <span className={styles.detailValue}>{cityWeather.today.minTemp}°</span>
                            </div>
                            <div className={styles.detailCard}>
                              <span className={styles.detailLabel}>Humidité</span>
                              <span className={styles.detailValue}>{cityWeather.current.humidity}%</span>
                            </div>
                            <div className={styles.detailCard}>
                              <span className={styles.detailLabel}>Vent</span>
                              <span className={styles.detailValue}>{cityWeather.current.windSpeed} km/h</span>
                            </div>
                            <div className={styles.detailCard}>
                              <span className={styles.detailLabel}>Direction</span>
                              <span className={styles.detailValue}>{cityWeather.current.windDir}</span>
                            </div>
                            <div className={styles.detailCard}>
                              <span className={styles.detailLabel}>Pression</span>
                              <span className={styles.detailValue}>{cityWeather.current.pressure} hPa</span>
                            </div>
                            <div className={styles.detailCard}>
                              <span className={styles.detailLabel}>Visibilité</span>
                              <span className={styles.detailValue}>{cityWeather.current.visibility} km</span>
                            </div>
                            <div className={styles.detailCard}>
                              <span className={styles.detailLabel}>Lever</span>
                              <span className={styles.detailValue}>{cityWeather.today.sunrise}</span>
                            </div>
                            <div className={styles.detailCard}>
                              <span className={styles.detailLabel}>Coucher</span>
                              <span className={styles.detailValue}>{cityWeather.today.sunset}</span>
                            </div>
                          </div>
                        </div>
                        <div className={styles.detailsColumn}>
                          {cityWeather.forecast && cityWeather.forecast.length > 0 ? (
                            <div className={styles.forecast}>
                              <h3 className={styles.forecastTitle}>Prévisions 5 jours</h3>
                              <div className={styles.forecastList}>
                                {cityWeather.forecast.map((day, idx) => (
                                  <div key={day.date} className={styles.forecastDay}>
                                    <div className={styles.forecastDayHeader}>
                                      <span className={styles.forecastDayName}>{idx === 0 ? "Aujourd'hui" : idx === 1 ? "Demain" : day.dayShort}</span>
                                      <span className={styles.forecastDayIcon}>{day.icon}</span>
                                    </div>
                                    <div className={styles.forecastDayTemp}>
                                      <span className={styles.forecastMax}>{day.maxTemp}°</span>
                                      <span className={styles.forecastMin}>/{day.minTemp}°</span>
                                    </div>
                                    <div className={styles.forecastDayDetails}>
                                      <span className={styles.forecastCondition}>{day.condition}</span>
                                      <div className={styles.forecastMeta}>
                                        <span>{day.humidity}%</span>
                                        <span>{day.windSpeed} km/h</span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className={styles.tomorrow}>
                              <h3 className={styles.tomorrowTitle}>Demain</h3>
                              <div className={styles.tomorrowContent}>
                                <span className={styles.tomorrowIcon}>{cityWeather.tomorrow.icon}</span>
                                <div className={styles.tomorrowInfo}>
                                  <span className={styles.tomorrowTemp}>
                                    {cityWeather.tomorrow.maxTemp}° / {cityWeather.tomorrow.minTemp}°
                                  </span>
                                  <span className={styles.tomorrowCondition}>{cityWeather.tomorrow.condition}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
        </div>
      )}


      {/* Modal pour ajouter/modifier une ville */}
      <CitySearchModal
        isOpen={showCityModal}
        onClose={() => {
          setShowCityModal(false);
          setEditingCityIndex(null);
        }}
        onSelect={(newCity) => {
          if (editingCityIndex !== null) {
            handleCityUpdate(editingCityIndex, newCity);
            setEditingCityIndex(null);
          } else {
            handleCitySelect(newCity);
          }
        }}
        currentCity={editingCityIndex !== null ? cities[editingCityIndex] || "" : ""}
      />
    </div>
  );
}
