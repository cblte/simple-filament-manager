// src/db/schema.ts
import { pgTable, serial, text, real, integer, timestamp } from 'drizzle-orm/pg-core';

export const spools = pgTable('spools', {
  id: serial('id').primaryKey(),
  brand: text('brand').notNull(), // z. B. "3D Jake"
  material: text('material').notNull(), // z. B. "PETG"
  color_name: text('color_name').notNull(), // z. B. "Orange"
  color_hex: text('color_hex'), // z. B. "#ff6600"
});

export const filaments = pgTable('filaments', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(), // z. B. "Rolle #1", "Testspule"
  spool_id: integer('spool_id')
    .notNull()
    .references(() => spools.id),
  weight_g: integer('weight_g'),
  spool_weight_g: integer('spool_weight_g'),
  print_temp_min: integer('print_temp_min'),
  print_temp_max: integer('print_temp_max'),
  price_eur: real('price_eur'),
  created_at: timestamp('created_at').defaultNow(),
});
