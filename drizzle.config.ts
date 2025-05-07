import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './drizzle', // Output directory for migrations
  schema: './src/db/schema.ts', // Path to the schema file
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.POSTGRES_URL!, // Database URL from environment variables
  },
});
