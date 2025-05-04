CREATE TABLE "filaments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"material" text NOT NULL,
	"color" text,
	"weight" real
);
