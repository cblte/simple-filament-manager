# ✨ Simple Filament Manager

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

A minimalistic, fast, and extensible web tool to manage your 3D printing filament inventory. Built with **Bun**, **Hono**, **Drizzle ORM**, **PostgreSQL**, and **Tailwind CSS v4**.

![Dashboard Screenshot](docs/screenshot.png)

---

## 🚀 Tech Stack

* **Runtime**: [Bun](https://bun.sh)
* **Framework**: [Hono](https://hono.dev) – ultra-lightweight and fast
* **ORM**: [Drizzle ORM](https://orm.drizzle.team)
* **Database**: PostgreSQL
* **Styling**: [Tailwind CSS v4](https://tailwindcss.com)
* **Auth (planned)**: JWT or [BetterAuth](https://github.com/hono-auth/better-auth)

---

## ⚙️ Features

* Manage spools (brand, type, weight, etc.)
* Link filaments with color, material, and temperatures
* Store current weight → calculate usage
* Responsive UI with Tailwind
* Separate tables for spools and filaments with relation
* Basis for extensions like consumption tracking

---

## 🚪 Local Development

### Requirements

* [Bun](https://bun.sh) installed
* PostgreSQL database (e.g., locally via Docker)

### Clone the project

```bash
git clone https://github.com/yourname/simple-filament-manager.git
cd simple-filament-manager
```

### Install dependencies

```bash
bun install
```

### Create a `.env` file

```env
DATABASE_URL=postgres://user:pass@localhost:5432/filaments
```

### Start development server

```bash
bun run dev
```

This will start both the backend server and Tailwind in watch mode (see scripts below).

---

## 📊 Database Schema

The application uses a PostgreSQL database with the following schema:

### Profiles Table

This table stores information about different filament types and their properties:

| Field | Type | Description |
|-------|------|-------------|
| id | serial | Primary key |
| vendor | text | Filament manufacturer (e.g., "3D Jake") |
| material | text | Material type (e.g., "PETG", "PLA") |
| density | real | Material density in g/cm³, default 1.24 |
| diameter | real | Filament diameter in mm, default 1.75 |

### Filaments Table

This table tracks individual spools of filament:

| Field | Type | Description |
|-------|------|-------------|
| id | serial | Primary key |
| name | text | Name identifier for the spool (e.g., "Rolle #1") |
| profile_id | integer | Foreign key reference to profiles table |
| color_hex | text | Hexadecimal color code (e.g., "#ff6600") |
| price_eur | real | Price of the filament in Euros |
| weight_g | integer | Total weight (spool + material) in grams |
| spool_weight_g | integer | Empty spool weight in grams, default 200 |
| remaining_g | integer | Calculated remaining material weight |
| print_temp_min | integer | Minimum recommended printing temperature |
| print_temp_max | integer | Maximum recommended printing temperature |
| created_at | timestamp | When the filament was added to the database |

## Features

* Track multiple filament types and manufacturers
* Monitor remaining filament on each spool
* Record price information for cost analysis
* Store printing temperature recommendations
* Track filament colors with hex codes

## Usage

The application provides a simple interface to:

* Add new filament profiles
* Register new spools
* Update remaining filament weights
* View your entire filament inventory

---

## 🔧 Scripts

The project includes several scripts to help with development and deployment. You can find them in the `package.json` file.

* **dev**: Starts the development server with hot module reloading
* **css**: Compiles and minifies Tailwind CSS styles
* **migrate**: Runs database migrations using Drizzle Kit
* **build**: Complete production build pipeline:
  1. Builds CSS
  2. Generates database schema
  3. Bundles the application
  4. Copies static assets to the dist folder
* **start**: Production startup script that runs migrations and starts the server from the dist folder

For local development, the `dev` script is all you need to get started.
For production deployment, use `build` followed by `start`

---

## 💡 Example Workflow

1. Add a spool: "3D Jake PETG, 1000g"
2. Add a filament: "Black, PETG, 230/80°C, 720g total weight, 100g spool weight"
3. Remaining calculated: 620g
4. UI displays all filaments with remaining weight

---

## 🏗️ Building the App for Production

To build the project for production:

### 1. Compile the backend code

```bash
bun build src/index.ts --outfile dist/index.js
```

### 2. Compile Tailwind CSS

```bash
bunx @tailwindcss/cli -i ./src/styles/global.css -o ./public/output.css --minify
```

This will generate:

* A single JS file in `dist/index.js`
* A minified CSS file in `public/output.css`

Make sure your `.env` file is available in the root or use a deployment-specific config.

---

## 📦 Running from `dist/` without installing dependencies

If you’ve built and bundled the project for deployment, you can run it directly from the `dist/` folder:

```bash
bun run dist/index.js
```

No `bun install` is required, as long as all files are already compiled and ready to run.
Make sure your `.env` file and `output.css` are present in the expected locations.

This is useful for lightweight deployments or prebuilt environments.

---

## 🐳 Docker Support

You can also run the app using Docker:

### Dockerfile (example)

```Dockerfile
FROM oven/bun:latest

WORKDIR /app
COPY . .

RUN bun install && \
    bun build src/index.ts --outfile dist/index.js --target bun && \
    bunx @tailwindcss/cli -i ./src/styles/global.css -o ./public/output.css --minify

EXPOSE 3000
CMD ["bun", "run", "dist/index.js"]
```

### Example build & run

```bash
docker build -t simple-filament-manager .
docker run -p 3000:3000 --env-file .env simple-filament-manager
```

Make sure your `.env` and any required data (e.g. volume-mounted PostgreSQL) are correctly configured.

---

You can also run the app using Docker:

### Docker Compose (App + PostgreSQL)

Create a `docker-compose.yml` file:

```yaml
version: '3.9'

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: filament
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: simple-fm
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  app:
    build: .
    ports:
      - "3000:3000"
    depends_on:
      - db
    environment:
      POSTGRES_URL: postgres://filament:secret@db:5432/simple-fm
      NODE_ENV: development
      PORT: 3000
    env_file:
      - .env

volumes:
  pgdata:
```

Then run:

```bash
docker compose up --build
```

## 📆 Planned / TODO

* [ ] Test the docker stuff
* [ ] Authentication with BetterAuth or via JWT stored in cookies
* [ ] Project-based consumption tracking
* [ ] CSV/JSON export & import
* [ ] Dark mode
* [ ] Screenshots for filament detail view & spool overview
* [x] Create/edit filament spools via frontend
* [x] Create/edit profiles via frontend

---

## 🧪 Example .env File

You can use this `.env.example` as a template:

```env
# PostgreSQL connection string
DATABASE_URL=postgres://filament:secret@localhost:5432/simple-fm
NODE_ENV=development
PORT=3000

# You can override this in docker-compose as needed
```

Be sure to rename it to `.env` when running the app locally or with Docker Compose.

---

## 📚 Resources

* [Hono Docs](https://hono.dev)
* [Drizzle ORM](https://orm.drizzle.team)
* [Tailwind CSS](https://tailwindcss.com)
* [Bun](https://bun.sh/docs)

---

## 🙏 Contributing

Found a bug? Got a feature idea? Feel free to open an issue or pull request. Feedback is welcome!

---

## 🎉 License

This project is licensed under the ISC License:

> Permission to use, copy, modify, and/or distribute this software for any
> purpose with or without fee is hereby granted, provided that the above
> copyright notice and this permission notice appear in all copies.
>
> THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
> REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
> AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
> INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
> LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
> OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
> PERFORMANCE OF THIS SOFTWARE.
