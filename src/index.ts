import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/node-postgres';
import { logger } from 'hono/logger';
import { filaments, profiles } from './db/schema';
import { desc, eq, count } from 'drizzle-orm';
import { serveStatic } from 'hono/bun';
import { color } from 'bun';

// Read database connection string from environment variable
const db = drizzle(process.env.POSTGRES_URL!);

// Profile interface
interface Profile {
  id: number; // Unique identifier for the profile.
  vendor: string; // Name of the filament vendor (e.g., Prusament, Bambu Lab).
  material: string; // Type of filament material (e.g., PLA, PETG, ABS).
  density: number; // Density of the material in grams per cubic centimeter (g/cm³). Used for volume calculations.
  diameter: number; // Diameter of the filament in millimeters (mm), typically 1.75mm or 2.85mm.
}

// Filament profile interface
interface Filament {
  id: number; // Unique identifier for the filament.
  name: string; // Name or identifier of the filament.
  profile_id: number; // Foreign key linking to the filament profile.
  color_hex?: string; // Hexadecimal color code representing the filament color (optional).
  price_eur: number | null; // Price of the filament in Euros, can be null if unknown.
  weight_g: number; // Total weight (spool + material) in grams.
  spool_weight_g: number; // Empty spool weight in grams.
  remaining_g: number; // Calculated remaining material in grams (optional).
  print_temp_min: number | null; // Minimum recommended printing temperature in Celsius, can be null if unknown.
  print_temp_max: number | null; // Maximum recommended printing temperature in Celsius, can be null if unknown.
  created_at: Date; // Timestamp indicating when the filament entry was created.
}

// Update the combined interface
interface FilamentWithProfile {
  filament: Filament;
  profile: Profile;
}

// Create a new Hono application instance
const app = new Hono();

// Middleware for logging requests
app.use('*', logger());

// Middleware for static files
app.use('/public/*', serveStatic({ root: './' }));

// Fetch filaments from the database
async function fetchFilaments(profileId?: number): Promise<FilamentWithProfile[]> {
  try {
    let query = db
      .select({
        filament: filaments,
        profile: profiles,
      })
      .from(filaments)
      .innerJoin(profiles, eq(filaments.profile_id, profiles.id))
      .orderBy(desc(filaments.created_at));

    if (profileId) {
      query.where(eq(filaments.profile_id, profileId));
    }

    const result = await query;
    return result as FilamentWithProfile[];
  } catch (error) {
    console.error('Error fetching filaments:', error);
    return [];
  }
}

// Fetch profiles from the database
async function fetchProfiles(): Promise<Profile[]> {
  try {
    const result = await db.select().from(profiles).orderBy(profiles.vendor);
    return result as Profile[];
  } catch (error) {
    console.error('Error fetching profiles:', error);
    return [];
  }
}

// Index Route
app.get('/', async (c) => {
  const profileParam = c.req.query('profile') || '';
  const profileId = Number(profileParam);

  // Fetch filaments based on the profile ID
  const filaments = await fetchFilaments(isNaN(profileId) ? undefined : profileId);
  // Fetch all profiles for the filter
  const profileOptions = await fetchProfiles();

  return c.html(`
    <html>
      <head>
        <title>Filament Manager</title>
        <link href="/public/output.css" rel="stylesheet">
      </head>
      <body class="p-6 font-sans bg-gray-50 text-gray-800">

        <h1 class="text-2xl font-bold mb-4 inline-block bg-sky-200 text-teal-800 px-4 py-2 rounded-lg">Filament Manager</h1>
        <p class="mb-4">Manage your filaments for 3D printing. You can add, edit, and delete your filaments.</p>
        <p class="mb-4">
          Go to <a href="/profiles" class="text-blue-600 hover:underline">Profile Management</a>
        </p>
        <p class="mb-6 flex flex-wrap gap-3">
        <a href="/filaments/new"
            class="inline-block bg-sky-100 hover:bg-sky-200 text-sky-800 px-4 py-2 rounded-lg shadow-sm transition">
            ➕ New Filament
          </a>
        </p>
        <form method="GET" class="mb-6 flex flex-wrap gap-2 items-center">
          ${profileOptions
            .map((s) => {
              const isActive = profileParam === s.id.toString();
              return `
                <button
                  type="submit"
                  name="profile"
                  value="${s.id}"
                  class="${
                    isActive ? 'bg-sky-700 text-white' : 'bg-gray-200 text-gray-700'
                  } px-4 py-1 rounded-full text-sm hover:bg-sky-600 hover:text-white transition"
                >
                  ${s.vendor} ${s.material} – ${s.diameter}mm
                </button>
              `;
            })
            .join('')}
          ${
            profileParam
              ? `<a href="/" class="ml-2 underline text-sm text-gray-500 hover:text-gray-700">Reset Filter</a>`
              : ''
          }
        </form>

        ${
          filaments.length === 0
            ? `<p class="text-center text-gray-500">No entries available.</p>`
            : `
              <div class="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 max-w-6xl">
                <!-- filaments -->
                ${filaments
                  .map(({ filament: f, profile: p }) => {
                    const percentage =
                      f.remaining_g > 0 ? Math.round((f.remaining_g / (f.weight_g - f.spool_weight_g)) * 100) : 0;

                    return `
                      <div class="rounded-lg shadow-sm p-4 bg-white border border-gray-200 flex items-start justify-between gap-3">
                        <!-- Content -->
                        <div class="flex-grow flex flex-col gap-2">
                          <h2 class="text-lg font-semibold text-gray-800 mb-1">${f.name}</h2>
                          <p class="text-sm text-gray-600">
                            <strong>Type:</strong> ${p.vendor} ${p.material} – ${p.diameter}
                          </p>

                          ${(() => {
                            return `
                          <p class="text-sm text-gray-700">
                            <strong>Remaining::</strong> ${f.remaining_g}g
                            <span class="text-xs text-gray-500">(${f.weight_g}g - ${f.spool_weight_g}g)</span>
                          </p>
                          <div class="">
                            <div class="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                              <div class="h-full rounded-full transition-all duration-300"
                                style="width: ${percentage}%; background-color: ${
                              percentage > 60
                                ? '#10b981' // green
                                : percentage > 30
                                ? '#f59e0b' // yellow
                                : '#ef4444' // red
                            };">
                              </div>
                            </div>
                            <p class="text-xs text-gray-500 mt-1">${percentage}% available</p>
                          </div>`;
                          })()}

                          <p class="text-sm text-gray-700">
                            <strong>Temp:</strong> ${f.print_temp_min ?? '-'}–${f.print_temp_max ?? '-'} °C
                          </p>

                          <p class="text-sm text-gray-700">
                            <strong>Price:</strong> ${f.price_eur ? f.price_eur.toFixed(2) : '-'} €
                          </p>

                          <div class="mt-4 flex gap-2">
                            <form action="/filaments/${f.id}/edit" method="get">
                              <button class="inline-flex items-center gap-1 bg-sky-100 hover:bg-sky-200 text-sky-800 text-sm font-medium px-3 py-1 rounded shadow-sm transition">
                                ✏️ <span>Edit</span>
                              </button>
                            </form>
                            <form action="/filaments/${
                              f.id
                            }/delete" method="post" onsubmit="return confirm('Really delete?')">
                              <button class="inline-flex items-center gap-1 bg-red-100 hover:bg-red-200 text-red-800 text-sm font-medium px-3 py-1 rounded shadow-sm transition">
                                🗑️ <span>Delete</span>
                              </button>
                            </form>
                          </div>
                        </div>

                        <!-- Color Indicator -->
                        <div class="relative">
                          <div class="absolute right-0 top-0">
                            <div class="relative w-20 h-20 rounded-lg" style="background-color: ${
                              f.color_hex ?? '#ffffff'
                            };">
                            <img
                              src="/public/spool-overlay.png"
                              alt="Filament Overlay"
                              class="absolute inset-0 w-full h-full object-contain pointer-events-none"
                            />
                          </div>
                          </div>

                        </div>
                      </div>`;
                  })
                  .join('')}
              </div>`
        }
      </body>
    </html>
  `);
});

// Route für die Spulenübersicht
app.get('/profiles', async (c) => {
  const profilesWithCount = await db
    .select({
      profiles: profiles,
      filamentCount: count(filaments.id),
    })
    .from(profiles)
    .leftJoin(filaments, eq(profiles.id, filaments.profile_id))
    .groupBy(profiles.id)
    .orderBy(profiles.vendor);

  return c.html(`
    <html>
      <head>
        <title>Profiles Overview</title>
        <link href="/public/output.css" rel="stylesheet">
      </head>
      <body class="p-6 font-sans bg-gray-50 text-gray-800">
        <h1 class="text-2xl font-bold mb-4 inline-block bg-teal-100 text-teal-800 px-4 py-2 rounded-lg">Profiles Overview</h1>
        <p class="mb-4">
          Here you can create a new vendor profiles or edit an existing one.
        </p>
        <p class="mb-4">
          Go to <a href="/" class="text-blue-600 hover:underline">Filament Overview</a>
        </p>

        <a href="/profiles/new" class="inline-block bg-teal-100 hover:bg-teal-200 text-teal-800 px-4 py-2 rounded-lg shadow-sm transition mb-6">➕ New Profile</a>
        ${
          profilesWithCount.length === 0
            ? '<p class="text-center text-gray-500">No profiles available.</p>'
            : `
          <div class="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 max-w-6xl">
            ${profilesWithCount
              .map(
                (p) => `
              <div class="rounded-lg shadow-sm p-4 bg-white border border-gray-200 flex items-start justify-between gap-3">
                <div class="ml-6 flex flex-col gap-2">
                  <h2 class="text-lg font-semibold text-gray-800 mb-1">${p.profiles.vendor} ${p.profiles.material}</h2>
                  <p class="text-sm text-gray-600">
                    <strong>Vendor:</strong> ${p.profiles.vendor}
                  </p>
                  <p class="text-sm text-gray-600">
                    <strong>Material:</strong> ${p.profiles.material}g
                  </p>
                  <p class="text-sm text-gray-600">
                    <strong>Density:</strong> ${p.profiles.density ?? '-'}g
                  </p>
                  <p class="text-sm text-gray-600">
                    <strong>Diameter:</strong> ${p.profiles.diameter ?? '-'}g
                  </p>
                  <p class="text-sm text-gray-500">
                    <strong>Used by </strong> ${p.filamentCount} Filaments
                  </p>
                  <div class="mt-4 flex gap-2">
                    <form action="/profiles/${p.profiles.id}/edit" method="get">
                      <button class="inline-flex items-center gap-1 bg-sky-100 hover:bg-sky-200 text-sky-800 text-sm font-medium px-3 py-1 rounded shadow-sm transition">
                        ✏️ <span>Edit</span>
                      </button>
                    </form>
                    ${
                      // Only show delete button if no filaments are using this profile
                      p.filamentCount === 0
                        ? `
                    <form action="/profiles/${p.profiles.id}/delete" method="post" onsubmit="return confirm('Really delete? This profile is not used by any filaments.')">
                      <button class="inline-flex items-center gap-1 bg-red-100 hover:bg-red-200 text-red-800 text-sm font-medium px-3 py-1 rounded shadow-sm transition">
                        🗑️ <span>Delete</span>
                      </button>
                    </form>
                    `
                        : '' // Don't show delete button if filaments are using it
                    }
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

// Render profiles
function renderProfileForm({
  action,
  title,
  profile,
}: {
  action: string;
  title: string;
  profile?: Partial<Profile>;
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

        <div class="grid grid-cols-1 gap-4 mb-4">
          <!-- Vendor -->
          <div class="flex items-center gap-4">
            <label for="vendor" class="text-sm font-medium text-gray-700 text-right w-32">Vendor</label>
            <input name="vendor" id="vendor" value="${profile?.vendor ?? ''}" required
              class="flex-grow h-10 p-1 border border-gray-300 rounded bg-white shadow-sm focus:ring-sky-500 focus:border-sky-500">
          </div>

          <!-- Material -->
          <div class="flex items-center gap-4">
            <label for="material" class="text-sm font-medium text-gray-700 text-right w-32">Material</label>
            <input name="material" id="material" value="${profile?.material ?? ''}" required
              class="flex-grow h-10 p-1 border border-gray-300 rounded bg-white shadow-sm focus:ring-sky-500 focus:border-sky-500">
          </div>

          <!-- Density -->
          <div class="flex items-center gap-4">
            <label for="density" class="text-sm font-medium text-gray-700 text-right w-32">Density (g/cm³)</label>
            <input name="density" id="density" type="number" step="0.01" value="${profile?.density ?? 1.24}" required
              class="flex-grow h-10 p-1 border border-gray-300 rounded bg-white shadow-sm focus:ring-sky-500 focus:border-sky-500">
          </div>

          <!-- Diameter -->
          <div class="flex items-center gap-4">
            <label for="diameter" class="text-sm font-medium text-gray-700 text-right w-32">Diameter (mm)</label>
            <input name="diameter" id="diameter" type="number" step="0.01" value="${profile?.diameter ?? 1.75}" required
              class="flex-grow h-10 p-1 border border-gray-300 rounded bg-white shadow-sm focus:ring-sky-500 focus:border-sky-500">
          </div>
        </div>

        <!-- Buttons -->
        <div class="flex gap-4 pt-4">
          <button type="submit" class="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded">
            ${profile ? 'Save' : '➕ Add Profile'}
          </button>
          <a href="/profiles" class="text-gray-600 underline self-center">Cancel</a>
        </div>
      </form>
    </body>
  </html>
  `;
}

// Route für das Erstellen einer neuen Spule
app.get('/profiles/new', async (c) => {
  return c.html(
    renderProfileForm({
      action: '/profiles/new',
      title: 'Create New Profile',
      profile: {},
    })
  );
});

// Function to parse profile form data
function parseProfileFormData(formData: FormData): Partial<Profile> {
  return {
    vendor: formData.get('vendor') as string,
    material: formData.get('material') as string,
    density: Number(formData.get('density') as string) || 1.24,
    diameter: Number(formData.get('diameter') as string) || 1.75,
  };
}

// Route for creating a new profile
app.post('/profiles/new', async (c) => {
  const formData = await c.req.formData();
  const profileData = parseProfileFormData(formData);
  if (!profileData.vendor || !profileData.material || !profileData.density || !profileData.diameter) {
    return c.text('Vendor, Material, Density, and Diameter are required.', 400);
  }
  try {
    await db.insert(profiles).values({
      vendor: profileData.vendor,
      material: profileData.material,
      density: profileData.density,
      diameter: profileData.diameter,
    });

    return c.redirect('/profiles');
  } catch (error: any) {
    console.error('Error saving:', error.message);
    return c.text('Error saving: ' + error.message, 500);
  }
});
// Route for editing a profile
app.get('/profiles/:id/edit', async (c) => {
  const id = Number(c.req.param('id'));
  if (isNaN(id)) return c.text('Invalid ID', 400);

  const result = await db.select().from(profiles).where(eq(profiles.id, id));
  if (!result.length) return c.text('Profile not found', 404);

  const profile = result[0];

  return c.html(
    renderProfileForm({
      action: `/profiles/${profile.id}/update`,
      title: `Edit Profile ${profile.vendor} ${profile.material}`,
      profile: { ...profile, density: profile.density ?? 1.24, diameter: profile.diameter ?? 1.75 },
    })
  );
});

// Route for updating a profile
app.post('/profiles/:id/update', async (c) => {
  const id = Number(c.req.param('id'));
  if (isNaN(id)) return c.text('Invalid ID', 400);

  const formData = await c.req.formData();
  const profileData = parseProfileFormData(formData);

  await db.update(profiles).set(profileData).where(eq(profiles.id, id));

  return c.redirect('/profiles');
});

// Route for deleting a profile
app.post('/profiles/:id/delete', async (c) => {
  const id = Number(c.req.param('id'));
  if (isNaN(id)) return c.text('Invalid ID', 400);

  try {
    // Check if the profile is used by any filament
    const filamentCount = await db
      .select({ count: count(filaments.id) })
      .from(filaments)
      .where(eq(filaments.profile_id, id));

    if (filamentCount[0]?.count > 0) {
      return c.text('This profile cannot be deleted because it is used by filaments.', 400);
    }
    await db.delete(profiles).where(eq(profiles.id, id));
    return c.redirect('/profiles');
  } catch (error: any) {
    console.error('Error deleting profile:', error.message);
    return c.text('Error deleting profile: ' + error.message, 500);
  }
});

// Funktion zum Rendern des Formulars für Filamente
// Update renderFilamentForm
function renderFilamentForm({
  action,
  title,
  filament,
  profileOptions,
  isEdit = false,
}: {
  action: string;
  title: string;
  filament?: Partial<Filament>;
  profileOptions: Profile[];
  isEdit?: boolean;
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

      <div class="grid grid-cols-1 gap-4 mb-4">

        <div class="flex items-center gap-4">
          <label for="name" class="text-sm font-medium text-gray-700 text-right w-32">Name</label>
          <input name="name" id="name" value="${filament?.name ?? ''}" required
            class="flex-grow h-10 p-1 border border-gray-300 rounded shadow-sm bg-white focus:ring-sky-500 focus:border-sky-500">
        </div>

        <!-- Profile Selection -->
        <div class="flex items-center gap-4">
            <label for="profile_id" class="text-sm font-medium text-gray-700 text-right w-32">Profile</label>
            <select name="profile_id" id="profile_id" required
            class="flex-grow h-10 p-1 border border-gray-300 rounded bg-white shadow-sm focus:ring-sky-500 focus:border-sky-500">
            <option value="">– Select Profile –</option>
            ${profileOptions
              .map(
                (p) => `<option value="${p.id}"${p.id === filament?.profile_id ? ' selected' : ''}>
              ${p.vendor} ${p.material} (${p.diameter}mm)
              </option>`
              )
              .join('')}
            </select>
        </div>

        <!-- Color -->
        <div class="flex items-center gap-4">
          <label for="color_hex" class="text-sm font-medium text-gray-700 text-right w-32">Color</label>
          <input type="color" name="color_hex" id="color_hex" value="${filament?.color_hex ?? '#000000'}" required
              class="flex-grow h-10 p-1 border border-gray-300 rounded bg-white shadow-sm cursor-pointer focus:ring-sky-500 focus:border-sky-500">
        </div>

        <!-- Price -->
        <div class="flex items-center gap-4">
          <label for="price_eur" class="text-sm font-medium text-gray-700 text-right w-32">Price (€)</label>
          <input name="price_eur" id="price_eur" type="number" step="0.01" value="${filament?.price_eur ?? ''}"
            class="flex-grow h-10 p-1 border border-gray-300 rounded shadow-sm bg-white focus:ring-sky-500 focus:border-sky-500">
        </div>


        <!-- Weight -->
        <div class="flex items-center gap-4">
          <label for="weight_g" class="text-sm font-medium text-gray-700 text-right w-32 mt-2">
            Total Weight (g)
          </label>
          <div class="flex flex-col flex-grow">
            <input
              name="weight_g"
              id="weight_g"
              type="number"
              value="${filament?.weight_g ?? '1200'}"
              required
              class="h-10 px-2 border border-gray-300 rounded shadow-sm bg-white focus:ring-sky-500 focus:border-sky-500"
            />
            <span class="text-sm text-gray-500 mt-1">
              Weight of the entire spool with filament (brutto weight)
            </span>
          </div>
        </div>

        <!-- Spool Weight -->
        <div class="flex items-center gap-4">
          <label for="spool_weight_g" class="text-sm font-medium text-gray-700 text-right w-32">Spool Weight (g)</label>
          <input name="spool_weight_g" id="spool_weight_g" type="number" value="${
            filament?.spool_weight_g ?? 200
          }" required
            class="flex-grow h-10 p-1 border border-gray-300 rounded shadow-sm bg-white focus:ring-sky-500 focus:border-sky-500">
        </div>

        ${
          isEdit
            ? `
          <!-- Remaining Weight (only visible in edit mode) -->
          <div class="flex items-center gap-4">
            <label for="remaining_g" class="text-sm font-medium text-gray-700 text-right w-32 mt-2">
              Remaining Weight (g)
            </label>
            <div class="flex flex-col flex-grow">
              <input
                name="remaining_g"
                id="remaining_g"
                type="number"
                value="${filament?.remaining_g ?? '0'}"
                required
                class="h-10 px-2 border border-gray-300 rounded shadow-sm bg-white focus:ring-sky-500 focus:border-sky-500"
              />
              <span class="text-sm text-gray-500 mt-1">
                Current weight of remaining filament on the spool
              </span>
            </div>
          </div>`
            : `<!-- Hidden remaining_g field for new filaments -->
          <input type="hidden" name="remaining_g" id="remaining_g" value="0">`
        }

        <!-- Temperature -->
        <div class="flex items-center gap-4">
          <label for="print_temp_min" class="text-sm font-medium text-gray-700 text-right w-32">Min Temp (°C)</label>
          <input name="print_temp_min" id="print_temp_min" type="number" value="${filament?.print_temp_min ?? ''}"
            class="flex-grow h-10 p-1 border border-gray-300 rounded shadow-sm bg-white focus:ring-sky-500 focus:border-sky-500">
        </div>

        <!-- Max Temperature -->
        <div class="flex items-center gap-4">
          <label for="print_temp_max" class="text-sm font-medium text-gray-700 text-right w-32">Max Temp (°C)</label>
          <input name="print_temp_max" id="print_temp_max" type="number" value="${filament?.print_temp_max ?? ''}"
            class="flex-grow h-10 p-1 border border-gray-300 rounded shadow-sm bg-white focus:ring-sky-500 focus:border-sky-500">
        </div>

        <!-- Buttons -->
        <div class="flex gap-4 pt-4">
          <button type="submit" class="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded">
            ${filament ? 'Save' : '➕ Add Filament'}
          </button>
          <a href="/" class="text-gray-600 underline self-center">Cancel</a>
        </div>
      </form>
    </body>
    </html>
  `;
}

// Route für das Erstellen eines neuen Filaments
app.get('/filaments/new', async (c) => {
  const profileOptions = await fetchProfiles();
  return c.html(
    renderFilamentForm({
      action: '/filaments/new',
      title: 'Create New Filament',
      profileOptions,
    })
  );
});

// Parse form data for filament
// Parse form data for filament
function parseFilamentFormData(formData: FormData, isEdit: boolean): Partial<Filament> {
  const weight_g = Number(formData.get('weight_g') as string) || 0;
  const spool_weight_g = Number(formData.get('spool_weight_g') as string) || 0;

  let remaining_g = 0;
  if (!isEdit) {
    // If it's a new filament, calculate remaining_g based on weight_g and spool_weight_g
    remaining_g = Math.max(weight_g - spool_weight_g, 0);
  } else {
    remaining_g = Number(formData.get('remaining_g') as string) || 0;
  }

  return {
    name: formData.get('name') as string,
    profile_id: Number(formData.get('profile_id') as string) || 0,
    color_hex: formData.get('color_hex') as string,
    weight_g: weight_g,
    spool_weight_g: spool_weight_g,
    remaining_g: remaining_g,
    print_temp_min: Number(formData.get('print_temp_min') as string) || null,
    print_temp_max: Number(formData.get('print_temp_max') as string) || null,
    price_eur: parseFloat(formData.get('price_eur') as string) || null,
  };
}

// Route für das Hinzufügen eines Filaments
app.post('/filaments/new', async (c) => {
  const formData = await c.req.formData();
  const filamentData = parseFilamentFormData(formData, false);

  if (!filamentData.name || !filamentData.profile_id) {
    return c.text('Name and Spool are required.', 400);
  }

  try {
    await db.insert(filaments).values({
      name: filamentData.name,
      profile_id: filamentData.profile_id,
      color_hex: filamentData.color_hex ?? '#000000',
      weight_g: filamentData.weight_g ?? 0,
      spool_weight_g: filamentData.spool_weight_g ?? 0,
      remaining_g: filamentData.remaining_g ?? 0,
      print_temp_min: filamentData.print_temp_min ?? 0,
      print_temp_max: filamentData.print_temp_max ?? 0,
      price_eur: filamentData.price_eur ?? 0,
    });

    return c.redirect('/');
  } catch (error: any) {
    console.error('Error saving:', error.message);
    return c.text('Error saving: ' + error.message, 500);
  }
});

// Route for editing a filament
app.get('/filaments/:id/edit', async (c) => {
  const id = Number(c.req.param('id'));
  if (isNaN(id)) return c.text('Invalid ID', 400);

  const result = await db
    .select({ filament: filaments, profiles: profiles })
    .from(filaments)
    .innerJoin(profiles, eq(filaments.profile_id, profiles.id))
    .where(eq(filaments.id, id));

  if (!result.length) return c.text('Filament not found', 404);

  const { filament } = result[0];
  const profileOptions = await fetchProfiles();

  return c.html(
    renderFilamentForm({
      action: `/filaments/${filament.id}/update`,
      title: `Edit Entry ${filament.name}`,
      filament,
      profileOptions,
      isEdit: true,
    })
  );
});

// Route for updating a filament
app.post('/filaments/:id/update', async (c) => {
  const id = Number(c.req.param('id'));
  if (isNaN(id)) return c.text('Invalid ID', 400);

  const formData = await c.req.formData();
  const filamentData = parseFilamentFormData(formData, true);
  if (!filamentData.name || !filamentData.profile_id) {
    return c.text('Name and Profile are required.', 400);
  }

  // calculate remaining weight
  const remaining_g = Math.max((filamentData.weight_g ?? 0) - (filamentData.spool_weight_g ?? 0), 0);

  try {
    await db
      .update(filaments)
      .set({
        name: filamentData.name,
        profile_id: filamentData.profile_id,
        color_hex: filamentData.color_hex ?? '#000000',
        weight_g: filamentData.weight_g ?? 0,
        spool_weight_g: filamentData.spool_weight_g ?? 0,
        remaining_g: filamentData.remaining_g ?? 0,
        print_temp_min: filamentData.print_temp_min ?? 0,
        print_temp_max: filamentData.print_temp_max ?? 0,
        price_eur: filamentData.price_eur ?? 0,
      })
      .where(eq(filaments.id, id));

    return c.redirect('/');
  } catch (error: any) {
    console.error('Error saving:', error.message);
    return c.text('Error saving: ' + error.message, 500);
  }
});

// Route für das Löschen eines Filaments
app.post('/filaments/:id/delete', async (c) => {
  const id = Number(c.req.param('id'));

  if (isNaN(id)) {
    return c.text('Invalid ID', 400);
  }

  try {
    await db.delete(filaments).where(eq(filaments.id, id));
    return c.redirect('/');
  } catch (error: any) {
    console.error('Error deleting:', error.message);
    return c.text('Error deleting: ' + error.message, 500);
  }
});

export default app;
