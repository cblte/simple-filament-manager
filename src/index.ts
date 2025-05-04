import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/node-postgres';
import { logger } from 'hono/logger';
import { filaments } from './db/schema';
import { desc, eq } from 'drizzle-orm';

// Importiere die Datenbankverbindung
const db = drizzle(process.env.POSTGRES_URL!);

// Datentyp für Anzeige
interface Filament {
  id: number;
  name: string;
  material: string;
  color: string | '';
  diameter: number | 0;
  weight_g: number | 0;
  spool_weight_g: number | 0;
  print_temp_min: number | 0;
  print_temp_max: number | 0;
  price_eur: number | 0;
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

// Funktion zum Parsen der Formulardaten
function parseFilamentFormData(formData: FormData): Partial<Filament> {
  return {
    name: formData.get('name') as string,
    material: formData.get('material') as string,
    color: (formData.get('color') as string) || '',
    diameter: parseFloat(formData.get('diameter') as string) || 0,
    weight_g: parseInt(formData.get('weight_g') as string) || 0,
    spool_weight_g: parseInt(formData.get('spool_weight_g') as string) || 0,
    print_temp_min: parseInt(formData.get('print_temp_min') as string) || 0,
    print_temp_max: parseInt(formData.get('print_temp_max') as string) || 0,
    price_eur: parseFloat(formData.get('price_eur') as string) || 0,
  };
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
                      <form action="/filaments/${f.id}/edit" method="GET">
                        <button class="text-blue-600 underline">Bearbeiten</button>
                      </form>
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

// Route für das Hinzufügen eines Filaments
app.post('/filaments', async (c) => {
  const formData = await c.req.formData();

  const filamentData = parseFilamentFormData(formData);

  if (
    !filamentData.name ||
    typeof filamentData.name !== 'string' ||
    !filamentData.material ||
    typeof filamentData.material !== 'string'
  ) {
    return c.text('Name und Material sind erforderlich.', 400);
  }

  try {
    await db.insert(filaments).values({
      name: filamentData.name,
      material: filamentData.material,
      color: filamentData.color,
      diameter: filamentData.diameter ?? 0,
      weight_g: filamentData.weight_g ?? 0,
      spool_weight_g: filamentData.spool_weight_g ?? 0,
      print_temp_min: filamentData.print_temp_min ?? 0,
      print_temp_max: filamentData.print_temp_max ?? 0,
      price_eur: filamentData.price_eur ?? 0,
    });

    return c.redirect('/');
  } catch (error: any) {
    console.error('Fehler beim Einfügen:', error.message);
    return c.text('Fehler beim Speichern: ' + error.message, 500);
  }
});

app.post('/filaments/:id/delete', async (c) => {
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    return c.text('Ungültige ID', 400);
  }

  try {
    await db.delete(filaments).where(eq(filaments.id, id));
    return c.redirect('/');
  } catch (error: any) {
    console.error('Fehler beim Löschen:', error.message);
    return c.text('Fehler beim Löschen: ' + error.message, 500);
  }
});

app.get('/filaments/:id/edit', async (c) => {
  const id = parseInt(c.req.param('id'));
  if (isNaN(id)) return c.text('Ungültige ID', 400);

  try {
    const result = await db.select().from(filaments).where(eq(filaments.id, id)).limit(1);

    const filament = result[0];
    if (!filament) return c.text('Filament nicht gefunden', 404);

    return c.html(`
      <html>
        <head>
          <title>Filament bearbeiten</title>
          <link href="/output.css" rel="stylesheet">
        </head>
        <body class="p-8 font-sans bg-gray-50">
          <h1 class="text-xl font-bold mb-6">Filament bearbeiten</h1>

          <form action="/filaments/${id}/update" method="POST" class="grid grid-cols-[200px_1fr] gap-3 max-w-2xl">
            <label class="self-center">Name:</label>
            <input type="text" name="name" value="${filament.name}" required class="p-2 border rounded">

            <label class="self-center">Material:</label>
            <input type="text" name="material" value="${filament.material}" required class="p-2 border rounded">

            <label class="self-center">Farbe:</label>
            <input type="text" name="color" value="${filament.color ?? ''}" class="p-2 border rounded">

            <label class="self-center">Durchmesser:</label>
            <input type="number" step="0.01" name="diameter" value="${
              filament.diameter ?? ''
            }" class="p-2 border rounded">

            <label class="self-center">Gewicht (g):</label>
            <input type="number" name="weight_g" value="${filament.weight_g ?? ''}" class="p-2 border rounded">

            <label class="self-center">Spulengewicht (g):</label>
            <input type="number" name="spool_weight_g" value="${
              filament.spool_weight_g ?? ''
            }" class="p-2 border rounded">

            <label class="self-center">Drucktemp. min (°C):</label>
            <input type="number" name="print_temp_min" value="${
              filament.print_temp_min ?? ''
            }" class="p-2 border rounded">

            <label class="self-center">Drucktemp. max (°C):</label>
            <input type="number" name="print_temp_max" value="${
              filament.print_temp_max ?? ''
            }" class="p-2 border rounded">

            <label class="self-center">Preis (€):</label>
            <input type="number" step="0.01" name="price_eur" value="${
              filament.price_eur ?? ''
            }" class="p-2 border rounded">

            <div class="col-span-2 flex gap-4 pt-4">
              <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded">Speichern</button>
              <button type="button" onclick="window.location.href='/'" class="text-gray-600 underline self-center">Abbrechen</button>
            </div>
          </form>

        </body>
      </html>
    `);
  } catch (error: any) {
    console.error('Fehler beim Laden des Eintrags:', error.message);
    return c.text('Fehler beim Laden', 500);
  }
});

// Route für das Hinzufügen eines Filaments
app.post('/filaments/:id/update', async (c) => {
  const id = parseInt(c.req.param('id'));
  if (isNaN(id)) return c.text('Ungültige ID', 400);

  const formData = await c.req.formData();
  const filamentData = parseFilamentFormData(formData);
  if (
    !filamentData.name ||
    typeof filamentData.name !== 'string' ||
    !filamentData.material ||
    typeof filamentData.material !== 'string'
  ) {
    return c.text('Name und Material sind erforderlich.', 400);
  }
  const { name, material, color, diameter, weight_g, spool_weight_g, print_temp_min, print_temp_max, price_eur } =
    filamentData;

  try {
    await db
      .update(filaments)
      .set({
        name,
        material,
        color: color || null,
        diameter: isNaN(diameter) ? null : diameter,
        weight_g: isNaN(weight_g) ? null : weight_g,
        spool_weight_g: isNaN(spool_weight_g) ? null : spool_weight_g,
        print_temp_min: isNaN(print_temp_min) ? null : print_temp_min,
        print_temp_max: isNaN(print_temp_max) ? null : print_temp_max,
        price_eur: isNaN(price_eur) ? null : price_eur,
      })
      .where(eq(filaments.id, id));

    return c.redirect('/');
  } catch (error: any) {
    console.error('Fehler beim Speichern:', error.message);
    return c.text('Fehler beim Speichern: ' + error.message, 500);
  }
});

app.post('/filaments/:id/delete', async (c) => {
  const id = parseInt(c.req.param('id'));

  if (isNaN(id)) {
    return c.text('Ungültige ID', 400);
  }

  try {
    await db.delete(filaments).where(eq(filaments.id, id));
    return c.redirect('/');
  } catch (error: any) {
    console.error('Fehler beim Löschen:', error.message);
    return c.text('Fehler beim Löschen: ' + error.message, 500);
  }
});

export default app;
