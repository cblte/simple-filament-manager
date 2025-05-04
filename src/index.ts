import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/node-postgres';
import { logger } from 'hono/logger';
import { filaments } from './db/schema';

// Importiere die Datenbankverbindung
const db = drizzle(process.env.POSTGRES_URL!);

// Datentyp für Anzeige
interface Filament {
  id: number;
  name: string;
  material: string;
  color: string | null;
  diameter: number | null;
  weight_g: number | null;
  spool_weight_g: number | null;
  print_temp_min: number | null;
  print_temp_max: number | null;
  price_eur: number | null;
  created_at: string;
}

// Erstelle die Hono-App
const app = new Hono();

// Logging Middleware hinzufügen
app.use('*', logger());

// Filament List aus der Datenbank abrufen
async function fetchFilaments(): Promise<Filament[]> {
  try {
    const result = await db.select().from(filaments).orderBy(desc(filaments.created_at));

    return result as unknown as Filament[];
  } catch (error) {
    console.error('Error fetching filaments:', error);
    return [];
  }
}

// Index Route
app.get('/', async (c) => {
  // Abrufen der Filamentliste
  const filaments = await fetchFilaments();

  return c.html(`
    <html>
      <head>
        <title>Filament Manager</title>
        <link href="/output.css" rel="stylesheet">
      </head>
      <body class="p-8 font-sans">
        <h1 class="text-2xl font-bold mb-4">Filament Manager</h1>

        <form action="/filaments" method="POST" class="mb-8 grid grid-cols-2 gap-4 max-w-2xl">
          <input type="text" name="name" placeholder="Name" required class="p-2 border rounded">
          <input type="text" name="material" placeholder="Material" required class="p-2 border rounded">
          <input type="text" name="color" placeholder="Farbe" class="p-2 border rounded">
          <input type="number" step="0.01" name="diameter" placeholder="Durchmesser" class="p-2 border rounded">
          <input type="number" name="weight_g" placeholder="Gewicht (g)" class="p-2 border rounded">
          <input type="number" name="spool_weight_g" placeholder="Spulengewicht (g)" class="p-2 border rounded">
          <input type="number" name="print_temp_min" placeholder="Temp min" class="p-2 border rounded">
          <input type="number" name="print_temp_max" placeholder="Temp max" class="p-2 border rounded">
          <input type="number" step="0.01" name="price_eur" placeholder="Preis (€)" class="p-2 border rounded">
          <button type="submit" class="col-span-2 bg-blue-600 text-white py-2 rounded">Filament hinzufügen</button>
        </form>

        <table class="table-auto border-collapse border w-full max-w-4xl">
          <thead>
            <tr class="bg-gray-100">
              <th class="border p-2">Name</th>
              <th class="border p-2">Material</th>
              <th class="border p-2">Farbe</th>
              <th class="border p-2">Durchmesser</th>
              <th class="border p-2">Gewicht</th>
              <th class="border p-2">Spule</th>
              <th class="border p-2">Temp</th>
              <th class="border p-2">Preis</th>
              <th class="border p-2">Aktion</th>
            </tr>
          </thead>
          <tbody>
            ${
              filaments.length === 0
                ? `<tr><td colspan="9" class="p-4 text-center text-gray-500">Keine Einträge vorhanden</td></tr>`
                : filaments
                    .map(
                      (f) => `
                  <tr>
                    <td class="border p-2">${f.name}</td>
                    <td class="border p-2">${f.material}</td>
                    <td class="border p-2">${f.color || '-'}</td>
                    <td class="border p-2">${f.diameter ?? '-'}</td>
                    <td class="border p-2">${f.weight_g ?? '-'}</td>
                    <td class="border p-2">${f.spool_weight_g ?? '-'}</td>
                    <td class="border p-2">${f.print_temp_min ?? '-'}–${f.print_temp_max ?? '-'}</td>
                    <td class="border p-2">${f.price_eur ?? '-'}</td>
                    <td class="border p-2">
                      <form action="/filaments/${
                        f.id
                      }/delete" method="POST" onsubmit="return confirm('Wirklich löschen?')">
                        <button class="text-red-600 underline">Löschen</button>
                      </form>
                    </td>
                  </tr>
                `
                    )
                    .join('')
            }
          </tbody>
        </table>
      </body>
    </html>
  `);
});

export default app;
