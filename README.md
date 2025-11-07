# D1 Database CRUD Worker

A complete RESTful API for Cloudflare D1 Database operations with full CRUD (Create, Read, Update, Delete) functionality.

## Features

- **List all tables** in your D1 database
- **View records** in any table with pagination support
- **Create new records** with dynamic field support
- **Update existing records** by ID
- **Delete records** by ID
- **Custom SQL queries** for advanced operations
- **API Key Authentication** for secure access
- Built-in API documentation at root endpoint
- CORS enabled for cross-origin requests
- SQL injection protection

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Create D1 Database

```bash
# Create a new D1 database
npx wrangler d1 create d1-database

# This will output a database_id - copy it to wrangler.toml
```

### 3. Configure API Key

**Option A: For Development (using wrangler.toml)**

Edit `wrangler.toml` and set your API key:

```toml
[vars]
API_KEY = "your-secret-api-key-here"
```

**Option B: For Production (using Wrangler Secrets - Recommended)**

Set your API key as a secret (more secure):

```bash
npx wrangler secret put API_KEY
# You'll be prompted to enter your API key
```

**Option C: For Local Development (using .dev.vars)**

Create a `.dev.vars` file in the project root:

```bash
cp .dev.vars.example .dev.vars
```

Then edit `.dev.vars` and set your API key:

```
API_KEY=your-secret-api-key-here
```

### 4. Update Database Configuration

Edit `wrangler.toml` and replace `your-database-id-here` with your actual database ID:

```toml
[[d1_databases]]
binding = "DB"
database_name = "d1-database"
database_id = "your-actual-database-id"
```

### 5. Create Sample Tables (Optional)

Create a sample schema:

```bash
# Create a migration file
npx wrangler d1 execute d1-database --remote --command "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"
```

Or for local development:

```bash
npx wrangler d1 execute d1-database --local --command "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"
```

## Development

Start the local development server:

```bash
npm run dev
```

Visit `http://localhost:8787` to see the API documentation.

## Deployment

Deploy to Cloudflare Workers:

```bash
npm run deploy
```

## Authentication

All API endpoints (except the root documentation page) require authentication via API key.

Include the API key in the request header:

```
X-API-Key: your-api-key-here
```

**Without a valid API key, you will receive a 401 Unauthorized response:**

```json
{
  "success": false,
  "error": "Unauthorized: Invalid or missing API key"
}
```

## API Endpoints

### List All Tables

```bash
GET /tables
```

**Example:**
```bash
curl https://your-worker.workers.dev/tables \
  -H "X-API-Key: your-api-key-here"
```

**Response:**
```json
{
  "success": true,
  "data": [
    { "name": "users" },
    { "name": "posts" }
  ]
}
```

---

### Get All Records from a Table

```bash
GET /tables/:tableName?limit=100&offset=0
```

**Parameters:**
- `limit` (optional): Number of records to return (default: 100)
- `offset` (optional): Number of records to skip (default: 0)

**Example:**
```bash
curl https://your-worker.workers.dev/tables/users?limit=10&offset=0 \
  -H "X-API-Key: your-api-key-here"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "created_at": "2024-01-01 12:00:00"
    }
  ],
  "meta": {
    "duration": 0.5,
    "rows_read": 1,
    "rows_written": 0
  }
}
```

---

### Get a Specific Record by ID

```bash
GET /tables/:tableName/:id
```

**Example:**
```bash
curl https://your-worker.workers.dev/tables/users/1 \
  -H "X-API-Key: your-api-key-here"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "created_at": "2024-01-01 12:00:00"
  }
}
```

---

### Create a New Record

```bash
POST /tables/:tableName
Content-Type: application/json
```

**Example:**
```bash
curl -X POST https://your-worker.workers.dev/tables/users \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key-here" \
  -d '{
    "name": "Jane Doe",
    "email": "jane@example.com"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "lastRowId": 2,
    "changes": 1
  }
}
```

---

### Update an Existing Record

```bash
PUT /tables/:tableName/:id
Content-Type: application/json
```

**Example:**
```bash
curl -X PUT https://your-worker.workers.dev/tables/users/1 \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key-here" \
  -d '{
    "name": "John Smith",
    "email": "john.smith@example.com"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "changes": 1
  }
}
```

---

### Delete a Record

```bash
DELETE /tables/:tableName/:id
```

**Example:**
```bash
curl -X DELETE https://your-worker.workers.dev/tables/users/1 \
  -H "X-API-Key: your-api-key-here"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "changes": 1
  }
}
```

---

### Execute Custom SQL Query

```bash
POST /query
Content-Type: application/json
```

**Example:**
```bash
curl -X POST https://your-worker.workers.dev/query \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key-here" \
  -d '{
    "query": "SELECT * FROM users WHERE email LIKE ?",
    "params": ["%@example.com"]
  }'
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "created_at": "2024-01-01 12:00:00"
    }
  ],
  "meta": {
    "duration": 0.5,
    "rows_read": 1,
    "rows_written": 0
  }
}
```

## Error Handling

All errors return appropriate HTTP status codes:

- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (missing or invalid API key)
- `404` - Not Found (record or table doesn't exist)
- `500` - Internal Server Error

**Error Response Format:**
```json
{
  "success": false,
  "error": "Error description"
}
```

## Security Features

- **API Key Authentication**: All endpoints (except documentation) require a valid API key via `X-API-Key` header
- **SQL Injection Protection**: Table names are validated using regex
- **Parameterized Queries**: All user inputs are bound as parameters
- **CORS Enabled**: Allows cross-origin requests (configurable)
- **Secret Management**: Use Wrangler secrets for production deployments

## Notes

- All tables must have an `id` column for update/delete operations to work correctly
- The worker validates table names to prevent SQL injection
- Use the `/query` endpoint for complex operations not covered by basic CRUD

## License

MIT
