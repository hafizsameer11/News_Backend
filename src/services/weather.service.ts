import prisma from "@/config/prisma";
import { OpenWeatherMapClient } from "@/lib/openweather.client";
import { WeatherCacheService } from "./weather-cache.service";
import { logger } from "@/utils/logger";
import { WeatherData } from "@/lib/openweather.client";

export class WeatherService {
  private weatherClient: OpenWeatherMapClient;
  private cacheService: WeatherCacheService;

  constructor() {
    this.weatherClient = new OpenWeatherMapClient();
    this.cacheService = new WeatherCacheService();
  }

  /**
   * Get all cities
   */
  async getAllCities() {
    return await prisma.weatherCity.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
    });
  }

  /**
   * Get city by ID
   */
  async getCityById(cityId: string) {
    const city = await prisma.weatherCity.findUnique({
      where: { id: cityId },
    });

    if (!city) {
      throw new Error("City not found");
    }

    return city;
  }

  /**
   * Get weather for a specific city
   * Uses cache if available and fresh, otherwise fetches from OpenWeatherMap API
   */
  async getWeatherByCity(cityId: string): Promise<WeatherData> {
    const city = await prisma.weatherCity.findUnique({
      where: { id: cityId },
    });

    if (!city) {
      throw new Error("City not found");
    }

    // Check cache first
    const cachedData = await this.cacheService.getCachedWeather(cityId);
    if (cachedData) {
      logger.info(`Returning cached weather for ${city.name}`);
      return cachedData;
    }

    // If no cache or cache expired, fetch from API
    if (!this.weatherClient.isConfigured()) {
      logger.warn("OpenWeatherMap API key not configured, returning fallback data");
      // Return fallback data structure if API is not configured
      return {
        city: city.name,
        temperature: 0,
        condition: "Unknown",
        humidity: 0,
        windSpeed: 0,
        description: "Weather data unavailable - API key not configured",
        feelsLike: 0,
        pressure: 0,
        visibility: 0,
        cloudiness: 0,
        windDirection: 0,
        updatedAt: new Date(),
      };
    }

    try {
      logger.info(`Fetching fresh weather data for ${city.name} from OpenWeatherMap`);
      const weatherData = await this.weatherClient.getCurrentWeather(
        city.name,
        city.apiId || undefined,
        city.latitude || undefined,
        city.longitude || undefined
      );

      if (!weatherData) {
        throw new Error("Failed to fetch weather data");
      }

      // Cache the fresh data
      await this.cacheService.setCachedWeather(cityId, weatherData);

      return weatherData;
    } catch (error) {
      logger.error(`Error fetching weather for ${city.name}:`, error);

      // If we have stale cache, return it as fallback
      const staleCache = await prisma.weatherCache.findUnique({
        where: { cityId },
      });

      if (staleCache) {
        logger.warn(`Returning stale cache for ${city.name} due to API error`);
        let fullData = null;
        try {
          fullData = JSON.parse(staleCache.data);
        } catch (e) {
          // Ignore parse errors
        }

        return {
          city: staleCache.cityName,
          temperature: Number(staleCache.temperature),
          condition: staleCache.condition,
          humidity: staleCache.humidity,
          windSpeed: Number(staleCache.windSpeed),
          description: fullData?.weather?.[0]?.description || "Data may be outdated",
          icon: fullData?.weather?.[0]?.icon,
          feelsLike: fullData?.main?.feels_like
            ? Math.round(fullData.main.feels_like * 10) / 10
            : undefined,
          pressure: fullData?.main?.pressure,
          visibility: fullData?.visibility,
          cloudiness: fullData?.clouds?.all,
          windDirection: fullData?.wind?.deg,
          sunrise: fullData?.sys?.sunrise ? fullData.sys.sunrise * 1000 : undefined,
          sunset: fullData?.sys?.sunset ? fullData.sys.sunset * 1000 : undefined,
          updatedAt: staleCache.updatedAt,
          fullData: fullData || undefined,
        };
      }

      // If no cache available, throw error
      throw new Error(
        `Failed to fetch weather data: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Add new city (Admin)
   */
  async addCity(name: string, apiId?: string, latitude?: number, longitude?: number) {
    return await prisma.weatherCity.create({
      data: {
        name,
        apiId,
        latitude,
        longitude,
      },
    });
  }

  /**
   * Remove city (Admin)
   */
  async removeCity(id: string) {
    return await prisma.weatherCity.delete({
      where: { id },
    });
  }

  /**
   * Seed initial Calabria cities with coordinates
   */
  async seedCities() {
    // Calabria cities with their approximate coordinates
    const calabriaCities = [
      { name: "Catanzaro", lat: 38.8808, lon: 16.6014 },
      { name: "Cosenza", lat: 39.3099, lon: 16.2502 },
      { name: "Crotone", lat: 39.08, lon: 17.12 },
      { name: "Reggio Calabria", lat: 38.1105, lon: 15.6614 },
      { name: "Vibo Valentia", lat: 38.6753, lon: 16.1 },
      { name: "Lamezia Terme", lat: 38.9626, lon: 16.3094 },
      { name: "Castrovillari", lat: 39.8167, lon: 16.2 },
      { name: "Acri", lat: 39.5, lon: 16.3833 },
      { name: "Montalto Uffugo", lat: 39.4, lon: 16.15 },
      { name: "Cassano all'Ionio", lat: 39.7833, lon: 16.3167 },
      { name: "San Giovanni in Fiore", lat: 39.2667, lon: 16.7 },
      { name: "Paola", lat: 39.3667, lon: 16.0333 },
      { name: "Amantea", lat: 39.1333, lon: 16.0833 },
      { name: "Scalea", lat: 39.8167, lon: 15.8 },
      { name: "Soverato", lat: 38.6833, lon: 16.55 },
      { name: "Gioia Tauro", lat: 38.4333, lon: 15.9 },
      { name: "Palmi", lat: 38.3667, lon: 15.85 },
      { name: "Siderno", lat: 38.2833, lon: 16.3 },
      { name: "Taurianova", lat: 38.35, lon: 16.0167 },
      { name: "Rosarno", lat: 38.4833, lon: 15.9833 },
    ];

    const count = await prisma.weatherCity.count();
    if (count === 0) {
      await prisma.weatherCity.createMany({
        data: calabriaCities.map((city, index) => ({
          name: city.name,
          latitude: city.lat,
          longitude: city.lon,
          order: index,
        })),
      });
      return { message: "Cities seeded successfully", count: calabriaCities.length };
    }
    return { message: "Cities already exist" };
  }
}
