# Simple Filament Manager

Simple Filament Manager is a simple web application built with Hono and Bun.
It allows you to manage a list of 3D printing filaments stored in a PostgreSQL database.

## Requirements

* **Bun:** This project uses Bun as the runtime and package manager. Follow the installation instructions on the [Bun website](https://bun.sh/docs/installation).
* **PostgreSQL:** A running PostgreSQL database instance is required.

## Installation

1. Clone the repository:

    ```sh
    git clone <repository_url> # Replace <repository_url> with the actual URL
    cd simple-fm
    ```

2. Install dependencies:

    ```sh
    bun install
    ```

3. **Database Setup:**
    * Ensure your PostgreSQL server is running.
    * Create a database for the application (e.g., `simple-fm`).
    * Create a `.env` file in the project root by copying `.env.development` or `.env.production`.
      Then configure the `POSTGRES_URL` variable:

        ```env
        # Example for development using .env or .env.development
        POSTGRES_URL=postgresql://postgres:@localhost:5432/simple-fm
        ```

    To learn more about the usage of the `.env` file with `bun`, refer to the [Bun documentation](https://bun.sh/docs/runtime/env).

4. **Run Database Migrations:** Apply the database schema:

    ```sh
    bun run migrate
    ```

    *(Note: The `start` script also runs migrations automatically)*

## Running the Development Server

To run the application with hot-reloading enabled for development:

```sh
bun run dev
```

Open <http://localhost:3000> (or the port specified in your .env file) in your browser.

## Building the Application for Production

1. **Build the application:**

    ```sh
    bun run build
    ```

    This command performs the following steps:
    * Builds the CSS using Tailwind.
    * Generates Drizzle ORM artifacts.
    * Builds the TypeScript source code into JavaScript within the dist directory.
    * Copies the public assets folder to public.

    The dist directory now contains a self-contained build of the application, ready for deployment.

## Running the Production Build

There are two main ways to run the production build:

### 1. Using the `start` script (from the project root)

This is convenient if you are running the application on the same machine where you built it.

```sh
bun run start
```

This script will first attempt to run database migrations (`bun run migrate`)
and then start the server using the built code (`bun run dist/index.js`).
It relies on the .env file in the project root for configuration.

### 2. Running directly from the dist folder (Portable Deployment)

The dist folder is designed to be portable.
You can copy the entire dist folder to any machine that has **Bun installed**.
No `bun install` is needed within the dist folder as all necessary JavaScript code and assets are already included.

1. **Copy the dist folder:** Transfer the dist folder to your deployment server or desired location.
2. **Navigate into the dist folder:**

    ```sh
    cd path/to/your/copied/dist
    ```

3. **Configure the Database:** The application needs the `POSTGRES_URL`
   to connect to the database in the production environment. You have two options:
    * **Create a .env file:** Create a file named .env directly inside the dist folder
      and add your production database URL:

        ```env
        # Inside dist/.env
        POSTGRES_URL=your_production_database_url
        ```

    * **Use Environment Variables:** Set the `POSTGRES_URL` environment variable globally on the server
      before running the application.

4. **Run the application:**

    ```sh
    bun index.js
    ```

    This command executes the main application file (`index.js`) directly using Bun.

**Important Note:** When running directly from the dist folder using `bun index.js`,
database migrations are **not** automatically run.
You will need to handle database schema migrations as a separate step in your deployment process if required.
