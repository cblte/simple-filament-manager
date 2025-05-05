// src/db/schema.ts
import { pgTable, serial, text, real, integer, timestamp } from 'drizzle-orm/pg-core';

/**
 * Represents a table of filament profiles in the database.
 *
 * Each profile contains information about a specific filament type from a vendor.
 *
 * @property {number} id - Primary key for the profile entry
 * @property {string} vendor - Name of the filament manufacturer or vendor
 * @property {string} material - Type of filament material (PLA, PETG, ABS, etc.)
 * @property {number} density - Material density in g/cm³, used for calculations
 * @property {number} diameter - Filament diameter in millimeters
 */
export const profiles = pgTable('profiles', {
  id: serial('id').primaryKey(),
  vendor: text('vendor').notNull(), // Vendor name e.g. "3D Jake"
  material: text('material').notNull(), // e.g. "PETG"
  density: real('density').notNull().default(1.24), // Material density in g/cm³
  diameter: real('diameter').notNull().default(1.75), // Filament diameter in mm
});

/**
 * Represents a table of filament spools in the database.
 *
 * Each filament has properties like name, profile reference, color, price,
 * weight information, temperature settings, and creation timestamp.
 *
 * @property {number} id - Primary key for the filament entry
 * @property {string} name - Name identifier for the filament (e.g., "Rolle #1", "Testspule")
 * @property {number} profile_id - Foreign key reference to the profiles table
 * @property {string} color_hex - Hexadecimal color code (e.g., "#ff6600")
 * @property {number} price_eur - Price of the filament in Euros
 * @property {number} weight_g - Total weight of the filament spool in grams (spool + material)
 * @property {number} spool_weight_g - Empty spool weight in grams, defaults to 200g
 * @property {number} remaining_g - Calculated remaining material weight in grams
 * @property {number} print_temp_min - Minimum recommended printing temperature
 * @property {number} print_temp_max - Maximum recommended printing temperature
 * @property {Date} created_at - Timestamp when the filament was added to the database
 */
export const filaments = pgTable('filaments', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(), // e.g. "Spool #1", "Testspool"
  profile_id: integer('profile_id') // e.g. 1
    .notNull()
    .references(() => profiles.id),
  color_hex: text('color_hex'), // e.g. "#ff6600"
  price_eur: real('price_eur'),
  weight_g: integer('weight_g').notNull(), // Total weight (spool + material) in grams
  spool_weight_g: integer('spool_weight_g').notNull().default(200), // Empty spool weight in grams
  remaining_g: integer('remaining_g'), // Calculated remaining material weight
  print_temp_min: integer('print_temp_min'),
  print_temp_max: integer('print_temp_max'),
  created_at: timestamp('created_at').defaultNow(),
});
