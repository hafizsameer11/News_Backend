import prisma from "../src/config/prisma";
import { logger } from "../src/utils/logger";

/**
 * Seed weather cities for Calabria
 */
async function seedWeatherCities() {
  try {
    // Calabria cities with their approximate coordinates
    const calabriaCities = [
      { name: "Catanzaro", lat: 38.8808, lon: 16.6014 },
      { name: "Cosenza", lat: 39.3099, lon: 16.2502 },
      { name: "Crotone", lat: 39.0800, lon: 17.1200 },
      { name: "Reggio Calabria", lat: 38.1105, lon: 15.6614 },
      { name: "Vibo Valentia", lat: 38.6753, lon: 16.1000 },
      { name: "Lamezia Terme", lat: 38.9626, lon: 16.3094 },
      { name: "Castrovillari", lat: 39.8167, lon: 16.2000 },
      { name: "Acri", lat: 39.5000, lon: 16.3833 },
      { name: "Montalto Uffugo", lat: 39.4000, lon: 16.1500 },
      { name: "Cassano all'Ionio", lat: 39.7833, lon: 16.3167 },
      { name: "San Giovanni in Fiore", lat: 39.2667, lon: 16.7000 },
      { name: "Paola", lat: 39.3667, lon: 16.0333 },
      { name: "Amantea", lat: 39.1333, lon: 16.0833 },
      { name: "Scalea", lat: 39.8167, lon: 15.8000 },
      { name: "Soverato", lat: 38.6833, lon: 16.5500 },
      { name: "Gioia Tauro", lat: 38.4333, lon: 15.9000 },
      { name: "Palmi", lat: 38.3667, lon: 15.8500 },
      { name: "Siderno", lat: 38.2833, lon: 16.3000 },
      { name: "Taurianova", lat: 38.3500, lon: 16.0167 },
      { name: "Rosarno", lat: 38.4833, lon: 15.9833 },
    ];

    const count = await prisma.weatherCity.count();
    
    if (count > 0) {
      logger.info(`⚠️  ${count} cities already exist. Skipping seed.`);
      logger.info("   To reseed, delete existing cities first or use the API endpoint.");
      return;
    }

    await prisma.weatherCity.createMany({
      data: calabriaCities.map((city, index) => ({
        name: city.name,
        latitude: city.lat,
        longitude: city.lon,
        order: index,
        isActive: true,
      })),
    });

    logger.info(`✅ Successfully seeded ${calabriaCities.length} Calabria cities`);
  } catch (error) {
    logger.error("❌ Error seeding weather cities:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed
seedWeatherCities()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    logger.error("Seed failed:", error);
    process.exit(1);
  });

