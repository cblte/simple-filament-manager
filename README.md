# Simple Filament Manager

Simple Filament Manager is a simple file manager built with Hono and Bun.
It allows you to add, edit and remove filaments from a PostgreSQL database.

To install dependencies:

```sh
bun install
```

Create a `.env` file in the root directory and add your `POSTGRES_URL`

```env
POSTGRES_URL=postgresql://postgres:@localhost:5432/simple-fm
```

To run:

```sh
bun run dev
```

open <http://localhost:3000>
