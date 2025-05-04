// src/db/schema.ts
import { pgTable, serial, text, real, integer, timestamp } from 'drizzle-orm/pg-core';

export const filaments = pgTable('filaments', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  material: text('material').notNull(),
  color: text('color'),
  diameter: real('diameter').default(1.75),
  weight_g: integer('weight_g'),
  spool_weight_g: integer('spool_weight_g'),
  print_temp_min: integer('print_temp_min'),
  print_temp_max: integer('print_temp_max'),
  price_eur: real('price_eur'),
  created_at: timestamp('created_at').defaultNow(),
});
