const { defineConfig } = require('@mikro-orm/postgresql');
const { UnderscoreNamingStrategy } = require('@mikro-orm/core');
const path = require('path');

/**
 * Custom naming strategy that preserves exact field names
 */
class ExactNamingStrategy extends UnderscoreNamingStrategy {
  propertyToColumnName(propertyName) {
    // Keep column names exactly as defined in entities
    return propertyName;
  }
  
  joinColumnName(propertyName) {
    return propertyName;
  }
}

/**
 * MikroORM Configuration
 * 
 * IMPORTANT: This config connects to your EXISTING database
 * - No migrations will be run automatically
 * - No schema changes will be made
 * - Entities map to existing tables with exact field names
 */
module.exports = defineConfig({
  // Database connection from environment variable or fallback to local
  clientUrl: process.env.APP_DATABASE_URL || 'postgresql://anushathalivarathil@localhost:5432/unified_query_portal',
  
  // SSL configuration for cloud databases
  driverOptions: process.env.APP_DATABASE_URL ? {
    connection: {
      ssl: {
        rejectUnauthorized: false
      }
    }
  } : undefined,
  
  // Entity discovery
  entities: [path.join(__dirname, '../entities/**/*.entity.js')],
  entitiesTs: [path.join(__dirname, '../entities/**/*.entity.js')],
  
  // Use custom naming strategy
  namingStrategy: ExactNamingStrategy,
  
  // Schema management - DISABLED for safety
  schemaGenerator: {
    disableForeignKeys: false,
    createForeignKeyConstraints: true,
  },
  
  // Migrations - DISABLED (we're using existing schema)
  migrations: {
    path: path.join(__dirname, '../migrations'),
    disableForeignKeys: false,
  },
  
  // Debug mode - disabled for cleaner logs
  debug: false,
  
  // Connection pool settings
  pool: {
    min: 2,
    max: 10,
  },
});
