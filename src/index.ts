import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/node-postgres';
import { logger } from 'hono/logger';
import { filaments, spools } from './db/schema';
import { desc, eq, count } from 'drizzle-orm';
import { serveStatic } from 'hono/bun';
import { color } from 'bun';

// Importiere die Datenbankverbindung
const db = drizzle(process.env.POSTGRES_URL!);

// Datentyp für Materialspulen
interface Spool {
  id: number;
  brand: string;
  material: string;
  color_name: string;
  color_hex?: string; // z. B. "#ff6600"
  material_weight_g: number;
  spool_weight_g?: number;
}

// Datentyp für aktuellen Filamentbestand
interface Filament {
  id: number;
  name: string;
  spool_id: number;
  weight_g: number; // Gesamtgewicht (Spule + Material), wird gewogen
  print_temp_min: number | null;
  print_temp_max: number | null;
  price_eur: number | null;
  created_at: Date; // Timestamp of when the filament was created
}

// Datentyp für Anzeige nach Join
interface FilamentWithSpool {
  filament: Filament;
  spool: Spool;
}

// Erstelle die Hono-App
const app = new Hono();

// Logging Middleware hinzufügen
app.use('*', logger());

// Middleware für statische Dateien hinzufügen
app.use('/public/*', serveStatic({ root: './' }));

// Filamentliste (mit optionaler Filterung nach spool_id)
async function fetchFilaments(spoolId?: number): Promise<FilamentWithSpool[]> {
  try {
    let query = db
      .select({
        filament: filaments,
        spool: spools,
      })
      .from(filaments)
      .innerJoin(spools, eq(filaments.spool_id, spools.id))
      .orderBy(desc(filaments.created_at));

    if (spoolId) {
      query = query.where(eq(filaments.spool_id, spoolId));
    }

    const result = await query;
    return result as FilamentWithSpool[];
  } catch (error) {
    console.error('Error fetching filaments:', error);
    return [];
  }
}

// Spulenliste (für Filterbuttons)
async function fetchSpools(): Promise<Spool[]> {
  try {
    const result = await db.select().from(spools).orderBy(spools.brand);
    return result as Spool[];
  } catch (error) {
    console.error('Error fetching spools:', error);
    return [];
  }
}

// Index Route
app.get('/', async (c) => {
  const spoolParam = c.req.query('spool') || '';
  const spoolId = Number(spoolParam);

  const filaments = await fetchFilaments(isNaN(spoolId) ? undefined : spoolId);
  const spoolOptions = await fetchSpools();

  return c.html(`
    <html>
      <head>
        <title>Filament Manager</title>
        <link href="/public/output.css" rel="stylesheet">
      </head>
      <body class="p-6 font-sans bg-gray-50 text-gray-800">

        <h1 class="text-2xl font-bold mb-4 inline-block bg-sky-200 text-teal-800 px-4 py-2 rounded-lg">Filament Manager</h1>
        <p class="mb-4">Verwalte deine Filamente für den 3D-Druck. Du kannst deine Filamente hinzufügen, bearbeiten und löschen.</p>
        <p class="mb-4">
          Hier geht es zur <a href="/spools" class="text-blue-600 hover:underline">Spulenverwaltung</a>
        </p>
        <p class="mb-6 flex flex-wrap gap-3">
        <a href="/filaments/new"
            class="inline-block bg-sky-100 hover:bg-sky-200 text-sky-800 px-4 py-2 rounded-lg shadow-sm transition">
            ➕ Neues Filament
          </a>
        </p>
        <form method="GET" class="mb-6 flex flex-wrap gap-2 items-center">
          ${spoolOptions
            .map((s) => {
              const isActive = spoolParam === s.id.toString();
              return `
                <button
                  type="submit"
                  name="spool"
                  value="${s.id}"
                  class="${
                    isActive ? 'bg-sky-700 text-white' : 'bg-gray-200 text-gray-700'
                  } px-4 py-1 rounded-full text-sm hover:bg-sky-600 hover:text-white transition"
                >
                  ${s.brand} ${s.material} – ${s.color_name}
                </button>
              `;
            })
            .join('')}
          ${
            spoolParam
              ? `<a href="/" class="ml-2 underline text-sm text-gray-500 hover:text-gray-700">Filter zurücksetzen</a>`
              : ''
          }
        </form>

        ${
          filaments.length === 0
            ? `<p class="text-center text-gray-500">Keine Einträge vorhanden.</p>`
            : `
              <div class="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 max-w-6xl">
                ${filaments
                  .map(({ filament: f, spool: s }) => {
                    const spoolWeight = s.spool_weight_g ?? 0;
                    const remaining = Math.max(f.weight_g - spoolWeight, 0);
                    const percentage =
                      s.material_weight_g > 0 ? Math.round((remaining / s.material_weight_g) * 100) : 0;

                    return `
                        <div class="relative rounded-lg shadow-sm p-4 bg-white border border-gray-200">
                        <div class="absolute left-0 top-0 bottom-0 w-8 rounded-l" style="background-color: ${
                          s.color_hex ?? '#e5e7eb'
                        };"></div>


                        <div class="ml-6 flex flex-col gap-2">
                          <h2 class="text-lg font-semibold text-gray-800 mb-1">${f.name}</h2>
                          <p class="text-sm text-gray-600">
                            <strong>Typ:</strong> ${s.brand} ${s.material} – ${s.color_name}
                          </p>

                          ${(() => {
                            return `
                                <p class="text-sm text-gray-700">
                                  <strong>Gewicht:</strong> ${remaining}g
                                  <span class="text-xs text-gray-500">(${f.weight_g}g - ${s.spool_weight_g}g)</span>
                                </p>
                                <div class="">
                                  <div class="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                                    <div class="h-full rounded-full transition-all duration-300"
                                      style="width: ${percentage}%; background-color: ${
                              percentage > 60
                                ? '#10b981' // grün
                                : percentage > 30
                                ? '#f59e0b' // gelb
                                : '#ef4444' // rot
                            };">
                                    </div>
                                  </div>
                                  <p class="text-xs text-gray-500 mt-1">${percentage}% verfügbar</p>
                                </div>
                              `;
                          })()}

                          <p class="text-sm text-gray-700">
                            <strong>Temp:</strong> ${f.print_temp_min ?? '-'}–${f.print_temp_max ?? '-'} °C
                          </p>

                          <p class="text-sm text-gray-700">
                            <strong>Preis:</strong> ${f.price_eur ? f.price_eur.toFixed(2) : '-'} €
                          </p>

                          <div class="mt-4 flex gap-2">
                            <form action="/filaments/${f.id}/edit" method="get">
                              <button class="inline-flex items-center gap-1 bg-sky-100 hover:bg-sky-200 text-sky-800 text-sm font-medium px-3 py-1 rounded shadow-sm transition">
                                ✏️ <span>Bearbeiten</span>
                              </button>
                            </form>
                            <form action="/filaments/${
                              f.id
                            }/delete" method="post" onsubmit="return confirm('Wirklich löschen?')">
                              <button class="inline-flex items-center gap-1 bg-red-100 hover:bg-red-200 text-red-800 text-sm font-medium px-3 py-1 rounded shadow-sm transition">
                                🗑️ <span>Löschen</span>
                              </button>
                            </form>
                          </div>
                        </div>
                      </div>
                    `;
                  })
                  .join('')}
              </div>
            `
        }
      </body>
    </html>
  `);
});

// Route für die Spulenübersicht
app.get('/spools', async (c) => {
  const spoolsWithCount = await db
    .select({
      spools: spools,
      filamentCount: count(filaments.id),
    })
    .from(spools)
    .leftJoin(filaments, eq(spools.id, filaments.spool_id))
    .groupBy(spools.id)
    .orderBy(spools.brand);

  return c.html(`
    <html>
      <head>
        <title>Spulenübersicht</title>
        <link href="/public/output.css" rel="stylesheet">
      </head>
      <body class="p-6 font-sans bg-gray-50 text-gray-800">
        <h1 class="text-2xl font-bold mb-4 inline-block bg-teal-100 text-teal-800 px-4 py-2 rounded-lg">Spulenübersicht</h1>
        <p class="mb-4">
          Hier kannst du eine neue Spule anlegen oder eine bestehende Spule bearbeiten.
        </p>
        <p class="mb-4">
          Hier geht es zur <a href="/" class="text-blue-600 hover:underline">Filamentübersicht</a>
        </p>

        <a href="/spools/new" class="inline-block bg-teal-100 hover:bg-teal-200 text-teal-800 px-4 py-2 rounded-lg shadow-sm transition mb-6">➕ Neue Spule</a>
        ${
          spoolsWithCount.length === 0
            ? '<p class="text-center text-gray-500">Keine Spulen vorhanden.</p>'
            : `
          <div class="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 max-w-6xl">
            ${spoolsWithCount
              .map(
                (s) => `
              <div class="relative rounded-lg shadow-sm p-4 bg-white border border-gray-200">
                <div class="absolute left-0 top-0 bottom-0 w-8 rounded-l" style="background-color: ${
                  s.spools.color_hex ?? '#e5e7eb'
                };"></div>
                <div class="ml-6 flex flex-col gap-2">
                  <h2 class="text-lg font-semibold text-gray-800 mb-1">${s.spools.brand} ${s.spools.material}</h2>
                  <p class="text-sm text-gray-600">
                    <strong>Farbe:</strong> ${s.spools.color_name}
                  </p>
                  <p class="text-sm text-gray-600">
                    <strong>Materialgewicht:</strong> ${s.spools.material_weight_g}g
                  </p>
                  <p class="text-sm text-gray-600">
                    <strong>Leergewicht:</strong> ${s.spools.spool_weight_g ?? '-'}g
                  </p>
                  <p class="text-sm text-gray-500">
                    <strong>Verwendet von:</strong> ${s.filamentCount} Filamenten
                  </p>
                  <div class="mt-4 flex gap-2">
                    <form action="/spools/${s.spools.id}/edit" method="get">
                      <button class="inline-flex items-center gap-1 bg-sky-100 hover:bg-sky-200 text-sky-800 text-sm font-medium px-3 py-1 rounded shadow-sm transition">
                        ✏️ <span>Bearbeiten</span>
                      </button>
                    </form>
                    ${
                      // Only show delete button if no filaments are using this spool
                      s.filamentCount === 0
                        ? `
                    <form action="/spools/${s.spools.id}/delete" method="post" onsubmit="return confirm('Wirklich löschen? Diese Spule wird von keinen Filamenten verwendet.')">
                      <button class="inline-flex items-center gap-1 bg-red-100 hover:bg-red-200 text-red-800 text-sm font-medium px-3 py-1 rounded shadow-sm transition">
                        🗑️ <span>Löschen</span>
                      </button>
                    </form>
                    `
                        : '' // Don't show delete button if filaments are using it
                    }
                    </form>
                  </div>
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        `
        }
      </body>
    </html>
  `);
});

// Funktion zum Rendern des Formulars für Spulen
function renderSpoolForm({ action, title, spool }: { action: string; title: string; spool?: Partial<Spool> }): string {
  return `
  <html>
    <head>
      <title>${title} – Filament Manager</title>
      <link href="/public/output.css" rel="stylesheet">
    </head>
    <body class="p-8 font-sans bg-gray-50 text-gray-800">
      <h1 class="text-2xl font-bold mb-6">${title}</h1>
      <form action="${action}" method="POST" class="grid gap-6 max-w-2xl">
        <!-- Brand & Material -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label for="brand" class="block text-sm font-medium text-gray-700 mb-1">Marke</label>
            <input name="brand" id="brand" value="${spool?.brand ?? ''}" required
              class="w-full p-2 border border-gray-300 rounded bg-white shadow-sm focus:ring-sky-500 focus:border-sky-500">
          </div>
          <div>
            <label for="material" class="block text-sm font-medium text-gray-700 mb-1">Material</label>
            <input name="material" id="material" value="${spool?.material ?? ''}" required
              class="w-full p-2 border border-gray-300 rounded bg-white shadow-sm focus:ring-sky-500 focus:border-sky-500">
          </div>
        </div>

        <!-- Color Name & Hex -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label for="color_name" class="block text-sm font-medium text-gray-700 mb-1">Farbname</label>
            <input name="color_name" id="color_name" value="${spool?.color_name ?? ''}" required
              class="w-full p-2 border border-gray-300 rounded bg-white shadow-sm focus:ring-sky-500 focus:border-sky-500">
          </div>
          <div>
            <label for="color_hex" class="block text-sm font-medium text-gray-700 mb-1">Farbcode (Hex)</label>
            <input type="color" name="color_hex" id="color_hex" value="${spool?.color_hex ?? '#000000'}"
              class="w-full h-10 p-1 border border-gray-300 rounded bg-white shadow-sm cursor-pointer focus:ring-sky-500 focus:border-sky-500">
          </div>
        </div>

        <!-- Material Weight & Spool Weight -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label for="material_weight_g" class="block text-sm font-medium text-gray-700 mb-1">Materialgewicht (g)</label>
            <input name="material_weight_g" id="material_weight_g" type="number" value="${
              spool?.material_weight_g ?? 1000
            }" required
              class="w-full p-2 border border-gray-300 rounded bg-white shadow-sm focus:ring-sky-500 focus:border-sky-500">
          </div>
          <div>
            <label for="spool_weight_g" class="block text-sm font-medium text-gray-700 mb-1">Leergewicht Spule (g)</label>
            <input name="spool_weight_g" id="spool_weight_g" type="number" value="${spool?.spool_weight_g ?? ''}"
              class="w-full p-2 border border-gray-300 rounded bg-white shadow-sm focus:ring-sky-500 focus:border-sky-500">
          </div>
        </div>

        <!-- Buttons -->
        <div class="flex gap-4 pt-4">
          <button type="submit" class="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded">
            ${spool ? 'Speichern' : '➕ Spule hinzufügen'}
          </button>
          <a href="/" class="text-gray-600 underline self-center">Abbrechen</a>
        </div>
      </form>
    </body>
  </html>
  `;
}

// Route für das Erstellen einer neuen Spule
app.get('/spools/new', async (c) => {
  return c.html(
    renderSpoolForm({
      action: '/spools/new',
      title: 'Neue Spule anlegen',
    })
  );
});

// Funktion zum Parsen der Formulardaten für Spulen
function parseSpoolFormData(formData: FormData): Partial<Spool> {
  return {
    brand: formData.get('brand') as string,
    material: formData.get('material') as string,
    color_name: formData.get('color_name') as string,
    color_hex: formData.get('color_hex') as string,
    material_weight_g: Number(formData.get('material_weight_g') as string) || 0,
    spool_weight_g: Number(formData.get('spool_weight_g') as string) || 0,
  };
}

// Route für das Hinzufügen einer neuen Spule

app.post('/spools/new', async (c) => {
  const formData = await c.req.formData();
  const spoolData = parseSpoolFormData(formData);
  if (!spoolData.brand || !spoolData.material || !spoolData.color_name) {
    return c.text('Marke, Material und Farbname sind erforderlich.', 400);
  }
  try {
    await db.insert(spools).values({
      brand: spoolData.brand,
      material: spoolData.material,
      color_name: spoolData.color_name,
      color_hex: spoolData.color_hex,
      material_weight_g: spoolData.material_weight_g ?? 0,
      spool_weight_g: spoolData.spool_weight_g ?? 0,
    });

    return c.redirect('/spools');
  } catch (error: any) {
    console.error('Fehler beim Speichern:', error.message);
    return c.text('Fehler beim Speichern: ' + error.message, 500);
  }
});
// Route für das Bearbeiten einer Spule
app.get('/spools/:id/edit', async (c) => {
  const id = Number(c.req.param('id'));
  if (isNaN(id)) return c.text('Ungültige ID', 400);

  const result = await db.select().from(spools).where(eq(spools.id, id));
  if (!result.length) return c.text('Spule nicht gefunden', 404);

  const spool = result[0];

  return c.html(
    renderSpoolForm({
      action: `/spools/${spool.id}/update`,
      title: `Eintrag ${spool.brand} ${spool.material} bearbeiten`,
      spool: { ...spool, color_hex: spool.color_hex ?? undefined, spool_weight_g: spool.spool_weight_g ?? undefined },
    })
  );
});

// Route für das Aktualisieren einer Spule
app.post('/spools/:id/update', async (c) => {
  const id = Number(c.req.param('id'));
  if (isNaN(id)) return c.text('Ungültige ID', 400);

  const formData = await c.req.formData();
  const spoolData = parseSpoolFormData(formData);

  await db.update(spools).set(spoolData).where(eq(spools.id, id));

  return c.redirect('/spools');
});

// Funktion zum Rendern des Formulars für Filamente
function renderFilamentForm({
  action,
  title,
  filament,
  spoolOptions,
}: {
  action: string;
  title: string;
  filament?: Partial<Filament>;
  spoolOptions: Spool[];
}): string {
  return `
    <html>
    <head>
      <title>${title} – Filament Manager</title>
      <link href="/public/output.css" rel="stylesheet">
    </head>
    <body class="p-8 font-sans bg-gray-50 text-gray-800">
      <h1 class="text-2xl font-bold mb-6">${title}</h1>

      <form action="${action}" method="POST" class="grid gap-6 max-w-2xl">
        <!-- Spulenwahl -->
        <div>
          <label for="spool_id" class="block text-sm font-medium text-gray-700 mb-1">Spule</label>
          <select name="spool_id" id="spool_id" required
            class="w-full p-2 border border-gray-300 rounded bg-white shadow-sm focus:ring-sky-500 focus:border-sky-500">
            <option value="">– Spule auswählen –</option>
            ${spoolOptions
              .map(
                (s) => `<option value="${s.id}"${s.id === filament?.spool_id ? ' selected' : ''}>
                    ${s.brand} ${s.material} – ${s.color_name}
                </option>`
              )
              .join('')}
          </select>
        </div>

        <!-- Name -->
        <div>
          <label for="name" class="block text-sm font-medium text-gray-700 mb-1">Bezeichnung</label>
          <input name="name" id="name" value="${filament?.name ?? ''}" required
            class="w-full p-2 border border-gray-300 rounded shadow-sm bg-white focus:ring-sky-500 focus:border-sky-500">
        </div>

        <!-- Gewicht & Preis -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label for="weight_g" class="block text-sm font-medium text-gray-700 mb-1">Gewicht (gesamt, g)</label>
            <input name="weight_g" id="weight_g" type="number" value="${filament?.weight_g ?? ''}"
              class="w-full p-2 border border-gray-300 rounded shadow-sm bg-white focus:ring-sky-500 focus:border-sky-500">
          </div>
          <div>
            <label for="price_eur" class="block text-sm font-medium text-gray-700 mb-1">Preis (€)</label>
            <input name="price_eur" id="price_eur" type="number" step="0.01" value="${filament?.price_eur ?? ''}"
              class="w-full p-2 border border-gray-300 rounded shadow-sm bg-white focus:ring-sky-500 focus:border-sky-500">
          </div>
        </div>

        <!-- Temperatur -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label for="print_temp_min" class="block text-sm font-medium text-gray-700 mb-1">Temp. min (°C)</label>
            <input name="print_temp_min" id="print_temp_min" type="number" value="${filament?.print_temp_min ?? ''}"
              class="w-full p-2 border border-gray-300 rounded shadow-sm bg-white focus:ring-sky-500 focus:border-sky-500">
          </div>
          <div>
            <label for="print_temp_max" class="block text-sm font-medium text-gray-700 mb-1">Temp. max (°C)</label>
            <input name="print_temp_max" id="print_temp_max" type="number" value="${filament?.print_temp_max ?? ''}"
              class="w-full p-2 border border-gray-300 rounded shadow-sm bg-white focus:ring-sky-500 focus:border-sky-500">
          </div>
        </div>

        <!-- Buttons -->
        <div class="flex gap-4 pt-4">
          <button type="submit" class="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded">
            ${filament ? 'Speichern' : '➕ Filament hinzufügen'}
          </button>
          <a href="/" class="text-gray-600 underline self-center">Abbrechen</a>
        </div>
      </form>
    </body>
    </html>
  `;
}

// Route für das Erstellen eines neuen Filaments
app.get('/filaments/new', async (c) => {
  const spoolOptions = await fetchSpools();
  return c.html(
    renderFilamentForm({
      action: '/filaments/new',
      title: 'Neues Filament anlegen',
      spoolOptions,
    })
  );
});

// Funktion zum Parsen der Formulardaten
function parseFilamentFormData(formData: FormData): Partial<Filament> {
  return {
    name: formData.get('name') as string,
    spool_id: Number(formData.get('spool_id') as string) || 0,
    weight_g: Number(formData.get('weight_g') as string) || 0,
    print_temp_min: Number(formData.get('print_temp_min') as string) || null,
    print_temp_max: Number(formData.get('print_temp_max') as string) || null,
    price_eur: parseFloat(formData.get('price_eur') as string) || null,
  };
}

// Route für das Hinzufügen eines Filaments
app.post('/filaments/new', async (c) => {
  const formData = await c.req.formData();
  const filamentData = parseFilamentFormData(formData);

  if (!filamentData.name || !filamentData.spool_id) {
    return c.text('Name und Spule sind erforderlich.', 400);
  }

  try {
    await db.insert(filaments).values({
      name: filamentData.name,
      spool_id: filamentData.spool_id,
      weight_g: filamentData.weight_g ?? 0,
      print_temp_min: filamentData.print_temp_min,
      print_temp_max: filamentData.print_temp_max,
      price_eur: filamentData.price_eur,
    });

    return c.redirect('/');
  } catch (error: any) {
    console.error('Fehler beim Speichern:', error.message);
    return c.text('Fehler beim Speichern: ' + error.message, 500);
  }
});

// Route für das Bearbeiten eines Filaments
app.get('/filaments/:id/edit', async (c) => {
  const id = Number(c.req.param('id'));
  if (isNaN(id)) return c.text('Ungültige ID', 400);

  const result = await db
    .select({ filament: filaments, spool: spools })
    .from(filaments)
    .innerJoin(spools, eq(filaments.spool_id, spools.id))
    .where(eq(filaments.id, id));

  if (!result.length) return c.text('Filament nicht gefunden', 404);

  const { filament } = result[0];
  const spoolOptions = await fetchSpools();

  return c.html(
    renderFilamentForm({
      action: `/filaments/${filament.id}/update`,
      title: `Eintrag ${filament.name} editieren`,
      filament,
      spoolOptions,
    })
  );
});

// Route für das Hinzufügen eines Filaments
app.post('/filaments/:id/update', async (c) => {
  const id = Number(c.req.param('id'));
  if (isNaN(id)) return c.text('Ungültige ID', 400);

  const formData = await c.req.formData();
  const filamentData = parseFilamentFormData(formData);
  if (!filamentData.name || !filamentData.spool_id) {
    return c.text('Name und Material sind erforderlich.', 400);
  }

  try {
    await db
      .update(filaments)
      .set({
        name: filamentData.name,
        spool_id: filamentData.spool_id,
        weight_g: filamentData.weight_g ?? 0,
        print_temp_min: filamentData.print_temp_min,
        print_temp_max: filamentData.print_temp_max,
        price_eur: filamentData.price_eur,
      })
      .where(eq(filaments.id, id));

    return c.redirect('/');
  } catch (error: any) {
    console.error('Fehler beim Speichern:', error.message);
    return c.text('Fehler beim Speichern: ' + error.message, 500);
  }
});

// Route für das Löschen eines Filaments
app.post('/filaments/:id/delete', async (c) => {
  const id = Number(c.req.param('id'));

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
