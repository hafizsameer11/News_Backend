import { Request, Response } from "express";
import { WeatherService } from "@/services/weather.service";
import { successResponse } from "@/utils/response";

const weatherService = new WeatherService();

export const weatherController = {
  /**
   * @openapi
   * /api/weather/cities:
   *   get:
   *     tags:
   *       - Weather
   *     summary: Get all active weather cities
   *     description: Returns a list of all active cities for which weather data is available
   *     responses:
   *       200:
   *         description: List of cities
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "Cities retrieved"
   *                 data:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                         format: uuid
   *                       name:
   *                         type: string
   *                         example: "Catanzaro"
   *                       apiId:
   *                         type: string
   *                         nullable: true
   *                       isActive:
   *                         type: boolean
   *                       order:
   *                         type: integer
   */
  getAllCities: async (_req: Request, res: Response) => {
    const result = await weatherService.getAllCities();
    return successResponse(res, "Cities retrieved", result);
  },

  /**
   * @openapi
   * /api/weather/{id}:
   *   get:
   *     tags:
   *       - Weather
   *     summary: Get weather data for a specific city
   *     description: Returns current weather data for the specified city. Data is cached for 1 hour and automatically updated via cron job.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: City ID
   *     responses:
   *       200:
   *         description: Weather data retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "Weather data retrieved"
   *                 data:
   *                   type: object
   *                   properties:
   *                     city:
   *                       type: string
   *                       example: "Catanzaro"
   *                     temperature:
   *                       type: number
   *                       format: float
   *                       example: 22.5
   *                       description: Temperature in Celsius
   *                     condition:
   *                       type: string
   *                       example: "Clear"
   *                       description: Weather condition (Clear, Clouds, Rain, etc.)
   *                     humidity:
   *                       type: integer
   *                       example: 65
   *                       description: Humidity percentage
   *                     windSpeed:
   *                       type: number
   *                       format: float
   *                       example: 5.2
   *                       description: Wind speed in m/s
   *                     description:
   *                       type: string
   *                       example: "clear sky"
   *                     icon:
   *                       type: string
   *                       example: "01d"
   *                       description: Weather icon code from OpenWeatherMap
   *                     updatedAt:
   *                       type: string
   *                       format: date-time
   *       404:
   *         description: City not found
   *       500:
   *         description: Error fetching weather data
   */
  getCityWeather: async (req: Request, res: Response) => {
    // Support both path parameter (:id) and query parameter (cityId)
    // Query parameter takes precedence if both are present
    const cityId = (req.query.cityId as string) || req.params.id;

    if (!cityId || typeof cityId !== "string") {
      return res.status(400).json({
        success: false,
        message:
          "City ID is required. Provide cityId as query parameter (?cityId=...) or path parameter (/:id)",
      });
    }

    const weatherData = await weatherService.getWeatherByCity(cityId);
    const city = await weatherService.getCityById(cityId);

    // Transform to match frontend expected format
    const result = {
      cityId: cityId,
      city: {
        id: city.id,
        name: city.name,
        country: "IT", // Default to Italy for Calabria cities
        latitude: city.latitude || 0,
        longitude: city.longitude || 0,
        isActive: city.isActive,
      },
      temperature: weatherData.temperature,
      feelsLike: weatherData.feelsLike || 0,
      humidity: weatherData.humidity,
      pressure: weatherData.pressure || 0,
      windSpeed: weatherData.windSpeed,
      windDirection: weatherData.windDirection || 0,
      condition: weatherData.condition,
      conditionDescription: weatherData.description,
      icon: weatherData.icon || "",
      visibility: weatherData.visibility || 0,
      cloudiness: weatherData.cloudiness || 0,
      sunrise: weatherData.sunrise ? new Date(weatherData.sunrise).toISOString() : undefined,
      sunset: weatherData.sunset ? new Date(weatherData.sunset).toISOString() : undefined,
      updatedAt: weatherData.updatedAt.toISOString(),
    };

    return successResponse(res, "Weather data retrieved", result);
  },

  /**
   * @openapi
   * /api/weather/cities:
   *   post:
   *     tags:
   *       - Weather
   *     summary: Add a new city (Admin only)
   *     description: Add a new city to the weather tracking system
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *             properties:
   *               name:
   *                 type: string
   *                 example: "Reggio Calabria"
   *               apiId:
   *                 type: string
   *                 nullable: true
   *                 example: "2523630"
   *                 description: OpenWeatherMap city ID (optional)
   *               latitude:
   *                 type: number
   *                 format: float
   *                 nullable: true
   *                 example: 38.1105
   *                 description: Latitude coordinate (optional, takes priority over name/apiId)
   *               longitude:
   *                 type: number
   *                 format: float
   *                 nullable: true
   *                 example: 15.6614
   *                 description: Longitude coordinate (optional, takes priority over name/apiId)
   *     responses:
   *       201:
   *         description: City added successfully
   *       400:
   *         description: Invalid request
   *       401:
   *         description: Unauthorized
   */
  addCity: async (req: Request, res: Response) => {
    const result = await weatherService.addCity(
      req.body.name,
      req.body.apiId,
      req.body.latitude,
      req.body.longitude
    );
    return successResponse(res, "City added", result, 201);
  },

  /**
   * @openapi
   * /api/weather/cities/{id}:
   *   delete:
   *     tags:
   *       - Weather
   *     summary: Remove a city (Admin only)
   *     description: Remove a city from the weather tracking system
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: City removed successfully
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: City not found
   */
  removeCity: async (req: Request, res: Response) => {
    await weatherService.removeCity(req.params.id);
    return successResponse(res, "City removed");
  },

  /**
   * @openapi
   * /api/weather/seed:
   *   post:
   *     tags:
   *       - Weather
   *     summary: Seed initial Calabria cities (Admin only)
   *     description: Populate the database with initial Calabria cities if none exist
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Seeding completed
   *       401:
   *         description: Unauthorized
   */
  seed: async (_req: Request, res: Response) => {
    const result = await weatherService.seedCities();
    return successResponse(res, "Seeding complete", result);
  },
};
