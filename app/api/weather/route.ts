import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const city = searchParams.get("city") || "Paris";
  const apiKey = process.env.WEATHER_API_KEY;

  try {
    // Si pas de clé API, utiliser wttr.in comme fallback
    if (!apiKey) {
      return await getWeatherFromWttr(city);
    }

    // Utiliser WeatherAPI.com
    // Le paramètre city peut être :
    // - "id:2801268" (format ID WeatherAPI, ne pas encoder)
    // - "lat,lon" (coordonnées, ne pas encoder)
    // - "nom de ville" (nom de ville, encoder)
    let query: string;
    if (city.startsWith("id:")) {
      // Format ID WeatherAPI (ex: id:2801268) - ne pas encoder
      query = city;
    } else if (city.includes(",") && !isNaN(parseFloat(city.split(",")[0]))) {
      // Format lat,lon - ne pas encoder
      query = city;
    } else {
      // Format nom de ville - encoder
      query = encodeURIComponent(city);
    }

    // Récupérer les données actuelles + forecast en une seule requête (forecast 5 jours)
    const weatherUrl = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${query}&days=5&lang=fr&aqi=no&alerts=no`;

    const response = await fetch(weatherUrl, {
      headers: {
        "Accept": "application/json",
      },
      next: { revalidate: 300 }, // Cache pendant 5 minutes
    });

    if (!response.ok) {
      // Fallback sur wttr.in si WeatherAPI échoue
      return await getWeatherFromWttr(city);
    }

    const data = await response.json();
    const currentData = data.current;
    const forecastData = data.forecast;

    // WeatherAPI retourne déjà les données structurées par jour
    const today = forecastData?.forecastday?.[0];
    const tomorrow = forecastData?.forecastday?.[1];

    const todayMax = today?.day?.maxtemp_c || currentData.temp_c;
    const todayMin = today?.day?.mintemp_c || currentData.temp_c;
    const tomorrowMax = tomorrow?.day?.maxtemp_c || null;
    const tomorrowMin = tomorrow?.day?.mintemp_c || null;
    const tomorrowCondition = tomorrow?.day?.condition?.text || "";
    const tomorrowIcon = getWeatherIconFromText(tomorrow?.day?.condition?.text || "");

    // Préparer le forecast multi-jours (5 jours)
    const forecastDays: any[] = [];

    if (forecastData && forecastData.forecastday) {
      forecastData.forecastday.forEach((day: any, index: number) => {
        const forecastDate = new Date(day.date);
        forecastDays.push({
          date: day.date,
          dayName: forecastDate.toLocaleDateString("fr-FR", { weekday: "long" }),
          dayShort: forecastDate.toLocaleDateString("fr-FR", { weekday: "short" }),
          maxTemp: Math.round(day.day.maxtemp_c).toString(),
          minTemp: Math.round(day.day.mintemp_c).toString(),
          condition: day.day.condition.text || "",
          icon: getWeatherIconFromText(day.day.condition.text || ""),
          humidity: day.day.avghumidity?.toString() || "N/A",
          windSpeed: Math.round(day.day.maxwind_kph || 0).toString(),
        });
      });
    }

    // Calculer le lever et coucher du soleil
    const sunrise = today?.astro?.sunrise 
      ? today.astro.sunrise
      : "N/A";
    const sunset = today?.astro?.sunset
      ? today.astro.sunset
      : "N/A";

    return NextResponse.json({
      city: data.location?.name || city,
      country: data.location?.country || "",
      region: data.location?.region || "",
      current: {
        temp: Math.round(currentData.temp_c).toString(),
        feelsLike: Math.round(currentData.feelslike_c).toString(),
        condition: currentData.condition?.text || "N/A",
        icon: getWeatherIconFromText(currentData.condition?.text || ""),
        humidity: currentData.humidity?.toString() || "N/A",
        windSpeed: Math.round(currentData.wind_kph || 0).toString(),
        windDir: currentData.wind_dir || "N/A",
        pressure: currentData.pressure_mb?.toString() || "N/A",
        visibility: currentData.vis_km ? Math.round(currentData.vis_km).toString() : "N/A",
      },
      today: {
        maxTemp: Math.round(todayMax).toString(),
        minTemp: Math.round(todayMin).toString(),
        sunrise: sunrise,
        sunset: sunset,
      },
      tomorrow: {
        maxTemp: tomorrowMax ? Math.round(tomorrowMax).toString() : "N/A",
        minTemp: tomorrowMin ? Math.round(tomorrowMin).toString() : "N/A",
        condition: tomorrowCondition || "N/A",
        icon: tomorrowIcon || "🌤️",
      },
      forecast: forecastDays,
    });
  } catch (error) {
    console.error("Weather API error:", error);
    // Fallback sur wttr.in en cas d'erreur
    return await getWeatherFromWttr(city);
  }
}

async function getWeatherFromWttr(city: string) {
  try {
    const response = await fetch(
      `https://wttr.in/${encodeURIComponent(city)}?format=j1&lang=fr`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
        next: { revalidate: 300 },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch weather data");
    }

    const data = await response.json();
    const current = data.current_condition?.[0];
    const today = data.weather?.[0];
    const tomorrow = data.weather?.[1];

    if (!current || !today) {
      throw new Error("Invalid weather data format");
    }

    return NextResponse.json({
      city: data.nearest_area?.[0]?.areaName?.[0]?.value || city,
      country: data.nearest_area?.[0]?.country?.[0]?.value || "",
      current: {
        temp: current.temp_C || "N/A",
        feelsLike: current.FeelsLikeC || "N/A",
        condition: current.lang_fr?.[0]?.value || current.weatherDesc?.[0]?.value || "N/A",
        icon: getWeatherIcon(current.weatherCode || "113"),
        humidity: current.humidity || "N/A",
        windSpeed: current.windspeedKmph || "N/A",
        windDir: current.winddir16Point || "N/A",
        pressure: current.pressure || "N/A",
        visibility: current.visibility || "N/A",
      },
      today: {
        maxTemp: today.maxtempC || "N/A",
        minTemp: today.mintempC || "N/A",
        sunrise: today.astronomy?.[0]?.sunrise || "N/A",
        sunset: today.astronomy?.[0]?.sunset || "N/A",
      },
      tomorrow: {
        maxTemp: tomorrow?.maxtempC || "N/A",
        minTemp: tomorrow?.mintempC || "N/A",
        condition: tomorrow?.lang_fr?.[0]?.value || tomorrow?.weatherDesc?.[0]?.value || "N/A",
        icon: getWeatherIcon(tomorrow?.hourly?.[4]?.weatherCode || "113"),
      },
      forecast: [], // wttr.in ne fournit pas de forecast multi-jours détaillé
    });
  } catch (error) {
    console.error("Wttr fallback error:", error);
    return NextResponse.json(
      { error: "Failed to fetch weather data" },
      { status: 500 }
    );
  }
}

function getWeatherIconFromText(text: string): string {
  // WeatherAPI retourne le texte en français, on fait correspondre avec des emojis
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes("orage") || lowerText.includes("thunder")) return "⛈️";
  if (lowerText.includes("pluie") || lowerText.includes("rain")) return "🌧️";
  if (lowerText.includes("bruine") || lowerText.includes("drizzle")) return "🌦️";
  if (lowerText.includes("neige") || lowerText.includes("snow")) return "🌨️";
  if (lowerText.includes("brouillard") || lowerText.includes("fog") || lowerText.includes("mist")) return "🌫️";
  if (lowerText.includes("ensoleillé") || lowerText.includes("sunny") || lowerText.includes("clear")) return "☀️";
  if (lowerText.includes("nuageux") || lowerText.includes("cloudy") || lowerText.includes("overcast")) return "☁️";
  if (lowerText.includes("partiellement") || lowerText.includes("partly")) return "⛅";
  if (lowerText.includes("nuage") || lowerText.includes("cloud")) return "🌤️";
  
  return "🌤️"; // Default
}


function getWeatherIcon(code: string): string {
  const codeNum = parseInt(code);
  // Codes météo wttr.in (fallback)
  if (codeNum === 113) return "☀️"; // Clear
  if (codeNum >= 116 && codeNum <= 119) return "⛅"; // Partly cloudy
  if (codeNum >= 122 && codeNum <= 143) return "☁️"; // Cloudy
  if (codeNum >= 176 && codeNum <= 179) return "🌦️"; // Patchy rain
  if (codeNum >= 182 && codeNum <= 185) return "🌧️"; // Freezing drizzle
  if (codeNum >= 200 && codeNum <= 202) return "⛈️"; // Thundery outbreaks
  if (codeNum >= 230 && codeNum <= 232) return "⛈️"; // Thundery outbreaks
  if (codeNum >= 248 && codeNum <= 260) return "🌫️"; // Fog
  if (codeNum >= 263 && codeNum <= 281) return "🌦️"; // Patchy rain
  if (codeNum >= 284 && codeNum <= 299) return "🌧️"; // Moderate rain
  if (codeNum >= 302 && codeNum <= 320) return "🌧️"; // Heavy rain
  if (codeNum >= 323 && codeNum <= 329) return "🌨️"; // Light snow
  if (codeNum >= 335 && codeNum <= 350) return "🌨️"; // Moderate snow
  if (codeNum >= 353 && codeNum <= 365) return "🌧️"; // Light rain
  if (codeNum >= 368 && codeNum <= 377) return "🌨️"; // Heavy snow
  if (codeNum >= 386 && codeNum <= 395) return "⛈️"; // Thundery outbreaks
  return "🌤️"; // Default
}
