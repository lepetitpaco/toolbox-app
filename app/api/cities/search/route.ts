import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");

  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  const apiKey = process.env.WEATHER_API_KEY;

  // Utiliser WeatherAPI Search API si une clé API est disponible (plus fiable et cohérent)
  // Sinon, utiliser Nominatim comme fallback
  try {
    if (apiKey) {
      return await searchWithWeatherAPI(query, apiKey);
    } else {
      return await searchWithNominatim(query);
    }
  } catch (error) {
    console.error("Cities search error:", error);
    // En cas d'erreur avec WeatherAPI, essayer Nominatim comme fallback
    if (apiKey) {
      try {
        return await searchWithNominatim(query);
      } catch (fallbackError) {
        console.error("Nominatim fallback error:", fallbackError);
      }
    }
    return NextResponse.json(
      { error: "Failed to search cities" },
      { status: 500 }
    );
  }
}

async function searchWithWeatherAPI(query: string, apiKey: string) {
  try {
    const response = await fetch(
      `https://api.weatherapi.com/v1/search.json?key=${apiKey}&q=${encodeURIComponent(query)}`,
      {
        headers: {
          "Accept": "application/json",
        },
        next: { revalidate: 3600 }, // Cache 1 heure
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch cities from WeatherAPI");
    }

    const data = await response.json();

    // WeatherAPI Search API retourne un tableau d'objets Location
    const results = data.map((location: any) => {
      // Utiliser l'ID pour une recherche précise : q=id:2801268
      // C'est la méthode recommandée par WeatherAPI pour garantir la bonne ville
      const searchQuery = location.id ? `id:${location.id}` : `${location.name},${location.country}`;

      // Formater le displayName de manière lisible
      const parts = [location.name];
      if (location.region && location.region !== location.name) {
        parts.push(location.region);
      }
      if (location.country) {
        parts.push(location.country);
      }
      const displayName = parts.join(", ");

      return {
        displayName: displayName,
        name: location.name,
        city: location.name,
        postcode: "", // WeatherAPI Search API ne retourne pas de postcode
        department: location.region || "",
        departmentName: location.region || "",
        state: location.region || "",
        country: location.country || "",
        countryCode: "", // WeatherAPI Search API ne retourne pas le code pays
        lat: location.lat?.toString() || "",
        lon: location.lon?.toString() || "",
        searchQuery: searchQuery, // Utiliser l'ID pour garantir la bonne ville
        id: location.id?.toString() || "", // ID WeatherAPI pour recherche précise
      };
    });

    return NextResponse.json(results);
  } catch (error) {
    console.error("WeatherAPI search error:", error);
    throw error;
  }
}

async function searchWithNominatim(query: string) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10&accept-language=fr`,
      {
        headers: {
          "User-Agent": "ToolboxApp/1.0",
        },
        next: { revalidate: 3600 },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch cities");
    }

    const data = await response.json();

    // Filtrer pour n'avoir que des villes
    const cityTypes = ["city", "town", "village", "municipality", "administrative"];
    const filtered = data.filter((item: any) => {
      const type = item.type || item.class;
      const address = item.address || {};
      
      // Exclure les types non pertinents
      if (type === "highway" || type === "building" || type === "place_of_worship" || 
          type === "amenity" || type === "shop" || type === "office" || type === "house") {
        return false;
      }
      
      // Inclure si c'est un type de ville ou si l'adresse contient une ville
      return cityTypes.includes(type) || 
             address.city || 
             address.town || 
             address.village ||
             address.municipality ||
             (type === "place" && (address.city || address.town || address.village));
    });

    const results = filtered.map((item: any) => {
      const address = item.address || {};
      const city = address.city || address.town || address.village || address.municipality || item.name;
      const postcode = address.postcode || "";
      const state = address.state || address.region || "";
      const department = address.county || address.state_district || "";
      const country = address.country || "";
      
      const searchQuery = country ? `${city},${country}` : city;

      return {
        displayName: item.display_name,
        name: item.name,
        city: city,
        postcode: postcode,
        department: department,
        departmentName: department,
        state: state,
        country: country,
        countryCode: address.country_code?.toUpperCase() || "",
        lat: item.lat,
        lon: item.lon,
        searchQuery: searchQuery,
      };
    });

    return NextResponse.json(results);
  } catch (error) {
    console.error("Nominatim fallback error:", error);
    return NextResponse.json(
      { error: "Failed to search cities" },
      { status: 500 }
    );
  }
}
