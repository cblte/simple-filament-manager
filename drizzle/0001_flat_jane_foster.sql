ALTER TABLE "filaments" RENAME COLUMN "weight" TO "weight_g";--> statement-breakpoint
ALTER TABLE "filaments" ADD COLUMN "diameter" real DEFAULT 1.75;--> statement-breakpoint
ALTER TABLE "filaments" ADD COLUMN "spool_weight_g" integer;--> statement-breakpoint
ALTER TABLE "filaments" ADD COLUMN "print_temp_min" integer;--> statement-breakpoint
ALTER TABLE "filaments" ADD COLUMN "print_temp_max" integer;--> statement-breakpoint
ALTER TABLE "filaments" ADD COLUMN "price_eur" real;--> statement-breakpoint
ALTER TABLE "filaments" ADD COLUMN "created_at" timestamp DEFAULT now();