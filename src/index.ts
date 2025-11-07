export interface Env {
  DB: D1Database;
}

interface JsonResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Route: GET /tables - List all tables
      if (path === '/tables' && method === 'GET') {
        const result = await env.DB.prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'"
        ).all();

        return jsonResponse({ success: true, data: result.results }, corsHeaders);
      }

      // Route: GET /tables/:tableName - Get all records from a table
      if (path.match(/^\/tables\/[^\/]+$/) && method === 'GET') {
        const tableName = path.split('/')[2];

        // Validate table name to prevent SQL injection
        if (!isValidTableName(tableName)) {
          return jsonResponse({ success: false, error: 'Invalid table name' }, corsHeaders, 400);
        }

        const limit = url.searchParams.get('limit') || '100';
        const offset = url.searchParams.get('offset') || '0';

        const result = await env.DB.prepare(
          `SELECT * FROM ${tableName} LIMIT ? OFFSET ?`
        ).bind(parseInt(limit), parseInt(offset)).all();

        return jsonResponse({ success: true, data: result.results, meta: result.meta }, corsHeaders);
      }

      // Route: GET /tables/:tableName/:id - Get a specific record by ID
      if (path.match(/^\/tables\/[^\/]+\/[^\/]+$/) && method === 'GET') {
        const parts = path.split('/');
        const tableName = parts[2];
        const id = parts[3];

        if (!isValidTableName(tableName)) {
          return jsonResponse({ success: false, error: 'Invalid table name' }, corsHeaders, 400);
        }

        const result = await env.DB.prepare(
          `SELECT * FROM ${tableName} WHERE id = ?`
        ).bind(id).first();

        if (!result) {
          return jsonResponse({ success: false, error: 'Record not found' }, corsHeaders, 404);
        }

        return jsonResponse({ success: true, data: result }, corsHeaders);
      }

      // Route: POST /tables/:tableName - Create a new record
      if (path.match(/^\/tables\/[^\/]+$/) && method === 'POST') {
        const tableName = path.split('/')[2];

        if (!isValidTableName(tableName)) {
          return jsonResponse({ success: false, error: 'Invalid table name' }, corsHeaders, 400);
        }

        const body = await request.json() as Record<string, any>;

        if (!body || Object.keys(body).length === 0) {
          return jsonResponse({ success: false, error: 'Request body is required' }, corsHeaders, 400);
        }

        const columns = Object.keys(body);
        const values = Object.values(body);
        const placeholders = columns.map(() => '?').join(', ');

        const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
        const result = await env.DB.prepare(query).bind(...values).run();

        return jsonResponse({
          success: result.success,
          data: {
            lastRowId: result.meta.last_row_id,
            changes: result.meta.changes
          }
        }, corsHeaders, 201);
      }

      // Route: PUT /tables/:tableName/:id - Update a record
      if (path.match(/^\/tables\/[^\/]+\/[^\/]+$/) && method === 'PUT') {
        const parts = path.split('/');
        const tableName = parts[2];
        const id = parts[3];

        if (!isValidTableName(tableName)) {
          return jsonResponse({ success: false, error: 'Invalid table name' }, corsHeaders, 400);
        }

        const body = await request.json() as Record<string, any>;

        if (!body || Object.keys(body).length === 0) {
          return jsonResponse({ success: false, error: 'Request body is required' }, corsHeaders, 400);
        }

        const columns = Object.keys(body);
        const values = Object.values(body);
        const setClause = columns.map(col => `${col} = ?`).join(', ');

        const query = `UPDATE ${tableName} SET ${setClause} WHERE id = ?`;
        const result = await env.DB.prepare(query).bind(...values, id).run();

        if (result.meta.changes === 0) {
          return jsonResponse({ success: false, error: 'Record not found' }, corsHeaders, 404);
        }

        return jsonResponse({
          success: result.success,
          data: { changes: result.meta.changes }
        }, corsHeaders);
      }

      // Route: DELETE /tables/:tableName/:id - Delete a record
      if (path.match(/^\/tables\/[^\/]+\/[^\/]+$/) && method === 'DELETE') {
        const parts = path.split('/');
        const tableName = parts[2];
        const id = parts[3];

        if (!isValidTableName(tableName)) {
          return jsonResponse({ success: false, error: 'Invalid table name' }, corsHeaders, 400);
        }

        const query = `DELETE FROM ${tableName} WHERE id = ?`;
        const result = await env.DB.prepare(query).bind(id).run();

        if (result.meta.changes === 0) {
          return jsonResponse({ success: false, error: 'Record not found' }, corsHeaders, 404);
        }

        return jsonResponse({
          success: result.success,
          data: { changes: result.meta.changes }
        }, corsHeaders);
      }

      // Route: POST /query - Execute custom SQL query (for advanced operations)
      if (path === '/query' && method === 'POST') {
        const body = await request.json() as { query: string; params?: any[] };

        if (!body.query) {
          return jsonResponse({ success: false, error: 'Query is required' }, corsHeaders, 400);
        }

        let stmt = env.DB.prepare(body.query);
        if (body.params && body.params.length > 0) {
          stmt = stmt.bind(...body.params);
        }

        const result = await stmt.all();

        return jsonResponse({
          success: true,
          data: result.results,
          meta: result.meta
        }, corsHeaders);
      }

      // Route: GET / - API documentation
      if (path === '/' && method === 'GET') {
        return new Response(getApiDocs(), {
          headers: { ...corsHeaders, 'Content-Type': 'text/html' },
        });
      }

      return jsonResponse({ success: false, error: 'Route not found' }, corsHeaders, 404);

    } catch (error: any) {
      return jsonResponse({
        success: false,
        error: error.message || 'Internal server error'
      }, corsHeaders, 500);
    }
  },
};

// Helper function to validate table names
function isValidTableName(tableName: string): boolean {
  // Only allow alphanumeric characters and underscores
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName);
}

// Helper function to create JSON responses
function jsonResponse(
  data: JsonResponse,
  corsHeaders: Record<string, string>,
  status: number = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

// API Documentation
function getApiDocs(): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>D1 Database CRUD API</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 1000px; margin: 50px auto; padding: 20px; }
    h1 { color: #f38020; }
    h2 { color: #333; border-bottom: 2px solid #f38020; padding-bottom: 5px; }
    .endpoint { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px; }
    .method { font-weight: bold; color: white; padding: 3px 8px; border-radius: 3px; }
    .get { background: #61affe; }
    .post { background: #49cc90; }
    .put { background: #fca130; }
    .delete { background: #f93e3e; }
    code { background: #eee; padding: 2px 6px; border-radius: 3px; }
    pre { background: #2d2d2d; color: #f8f8f2; padding: 15px; border-radius: 5px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>D1 Database CRUD API</h1>
  <p>RESTful API for Cloudflare D1 Database operations</p>

  <h2>Endpoints</h2>

  <div class="endpoint">
    <span class="method get">GET</span> <code>/tables</code>
    <p>List all tables in the database</p>
    <pre>curl https://your-worker.workers.dev/tables</pre>
  </div>

  <div class="endpoint">
    <span class="method get">GET</span> <code>/tables/:tableName</code>
    <p>Get all records from a specific table (supports pagination)</p>
    <p><strong>Query Parameters:</strong></p>
    <ul>
      <li><code>limit</code> - Number of records to return (default: 100)</li>
      <li><code>offset</code> - Number of records to skip (default: 0)</li>
    </ul>
    <pre>curl https://your-worker.workers.dev/tables/users?limit=10&offset=0</pre>
  </div>

  <div class="endpoint">
    <span class="method get">GET</span> <code>/tables/:tableName/:id</code>
    <p>Get a specific record by ID</p>
    <pre>curl https://your-worker.workers.dev/tables/users/1</pre>
  </div>

  <div class="endpoint">
    <span class="method post">POST</span> <code>/tables/:tableName</code>
    <p>Create a new record</p>
    <pre>curl -X POST https://your-worker.workers.dev/tables/users \\
  -H "Content-Type: application/json" \\
  -d '{"name": "John Doe", "email": "john@example.com"}'</pre>
  </div>

  <div class="endpoint">
    <span class="method put">PUT</span> <code>/tables/:tableName/:id</code>
    <p>Update an existing record</p>
    <pre>curl -X PUT https://your-worker.workers.dev/tables/users/1 \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Jane Doe", "email": "jane@example.com"}'</pre>
  </div>

  <div class="endpoint">
    <span class="method delete">DELETE</span> <code>/tables/:tableName/:id</code>
    <p>Delete a record</p>
    <pre>curl -X DELETE https://your-worker.workers.dev/tables/users/1</pre>
  </div>

  <div class="endpoint">
    <span class="method post">POST</span> <code>/query</code>
    <p>Execute a custom SQL query (advanced)</p>
    <pre>curl -X POST https://your-worker.workers.dev/query \\
  -H "Content-Type: application/json" \\
  -d '{"query": "SELECT * FROM users WHERE email LIKE ?", "params": ["%@example.com"]}'</pre>
  </div>

  <h2>Response Format</h2>
  <p>All responses are in JSON format:</p>
  <pre>{
  "success": true,
  "data": { ... },
  "meta": { ... }  // Optional metadata
}</pre>

  <h2>Error Handling</h2>
  <p>Errors return appropriate HTTP status codes with error messages:</p>
  <pre>{
  "success": false,
  "error": "Error description"
}</pre>
</body>
</html>
  `.trim();
}
