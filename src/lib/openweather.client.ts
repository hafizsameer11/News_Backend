import env from "@/config/env";
import { logger } from "@/utils/logger";

/**
 * OpenWeatherMap API Response Types
 */
export interface OpenWeatherMapResponse {
  coord: {
    lon: number;
    lat: number;
  };
  weather: Array<{
    id: number;
    main: string;
    description: string;
    icon: string;
  }>;
  base: string;
  main: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    pressure: number;
    humidity: number;
  };
  visibility: number;
  wind: {
    speed: number;
    deg: number;
    gust?: number;
  };
  clouds: {
    all: number;
  };
  dt: number;
  sys: {
    type: number;
    id: number;
    country: string;
    sunrise: number;
    sunset: number;
  };
  timezone: number;
  id: number;
  name: string;
  cod: number;
}

/**
 * Simplified Weather Data Structure
 */
export interface WeatherData {
  city: string;
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  description: string;
  icon?: string;
  feelsLike?: number;
  pressure?: number;
  visibility?: number;
  cloudiness?: number;
  windDirection?: number;
  sunrise?: number;
  sunset?: number;
  updatedAt: Date;
  fullData?: OpenWeatherMapResponse; // Full API response for caching
}

/**
 * OpenWeatherMap API Client
 */
export class OpenWeatherMapClient {
  private readonly apiKey: string;
  private readonly baseUrl = "https://api.openweathermap.org/data/2.5";

  constructor() {
    this.apiKey = env.OPENWEATHER_API_KEY;
    if (!this.apiKey || this.apiKey === "") {
      logger.warn("OpenWeatherMap API key not configured");
    }
  }

  /**
   * Get current weather for a city
   * @param cityName - Name of the city
   * @param apiId - Optional OpenWeatherMap city ID
   * @param latitude - Optional latitude coordinate
   * @param longitude - Optional longitude coordinate
   * @returns Weather data or null if error
   */
  async getCurrentWeather(
    cityName: string,
    apiId?: string,
    latitude?: number,
    longitude?: number
  ): Promise<WeatherData | null> {
    if (!this.apiKey || this.apiKey === "") {
      logger.error("OpenWeatherMap API key not configured");
      throw new Error("OpenWeatherMap API key not configured");
    }

    try {
      let queryParam: string;

      // Priority: coordinates > apiId > city name
      if (latitude !== undefined && longitude !== undefined) {
        queryParam = `lat=${latitude}&lon=${longitude}`;
        logger.info(
          `Fetching weather for: ${cityName} (by coordinates: ${latitude}, ${longitude})`
        );
      } else if (apiId) {
        queryParam = `id=${apiId}`;
        logger.info(`Fetching weather for: ${cityName} (by API ID: ${apiId})`);
      } else {
        queryParam = `q=${encodeURIComponent(cityName)}`;
        logger.info(`Fetching weather for: ${cityName} (by name)`);
      }

      const url = `${this.baseUrl}/weather?${queryParam}&appid=${this.apiKey}&units=metric&lang=it`;

      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logger.error(`OpenWeatherMap API error: ${response.status}`, errorData);

        if (response.status === 401) {
          throw new Error("Invalid OpenWeatherMap API key");
        }
        if (response.status === 404) {
          throw new Error(`City "${cityName}" not found`);
        }
        throw new Error(`OpenWeatherMap API error: ${response.status}`);
      }

      const data = (await response.json()) as OpenWeatherMapResponse;

      // Transform to our WeatherData format
      const weatherData: WeatherData = {
        city: data.name,
        temperature: Math.round(data.main.temp * 10) / 10, // Round to 1 decimal
        condition: data.weather[0]?.main || "Unknown",
        humidity: data.main.humidity,
        windSpeed: Math.round(data.wind.speed * 10) / 10, // Round to 1 decimal
        description: data.weather[0]?.description || "",
        icon: data.weather[0]?.icon,
        feelsLike: Math.round(data.main.feels_like * 10) / 10,
        pressure: data.main.pressure,
        visibility: data.visibility,
        cloudiness: data.clouds.all,
        windDirection: data.wind.deg,
        sunrise: data.sys.sunrise * 1000, // Convert to milliseconds
        sunset: data.sys.sunset * 1000, // Convert to milliseconds
        updatedAt: new Date(),
        fullData: data,
      };

      logger.info(`Successfully fetched weather for ${cityName}`);
      return weatherData;
    } catch (error) {
      logger.error(`Error fetching weather for ${cityName}:`, error);
      throw error;
    }
  }

  /**
   * Check if API key is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey !== "";
  }
}
