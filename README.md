# Neogen SAP Converter

Aplicación web interna para convertir órdenes de compra de ELECO al formato SAP Business One.

---

## Arquitectura

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Next.js    │────▶│  FastAPI     │────▶│ PostgreSQL  │
│  Frontend   │     │  Backend     │     │             │
│  :3000      │     │  :8000       │     │  :5432      │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    │   Services  │
                    ├─────────────┤
                    │ Parser      │ pdfplumber / pytesseract OCR
                    │ Matcher     │ rapidfuzz token_set_ratio
                    │ Exporter    │ openpyxl SAP format
                    └─────────────┘
```

## Flujo de procesamiento

```
[ELECO sube PDF/Excel]
        │
        ▼
[Parser detecta tabla]
        ├── PDF nativo   → pdfplumber
        ├── PDF escaneado → pytesseract OCR
        └── Excel/CSV    → pandas
        │
        ▼
[Rows: descripción, cantidad, precio]
        │
        ▼
[Matching contra base de productos]
        ├── Exacto (100%)    → ALTA  🟢
        ├── Fuzzy ≥75%       → MEDIA 🟡
        ├── Fuzzy 60-74%     → BAJA  🟠
        └── Sin match        → NONE  🔴
        │
        ▼
[Review Screen — edición manual]
        │
        ▼
[Excel SAP: SKU | DESCRIPCION | CANTIDAD | PRECIO]
```

## Stack tecnológico

| Capa       | Tecnología                          |
|------------|-------------------------------------|
| Frontend   | Next.js 14, TypeScript, Tailwind    |
| Backend    | Python 3.11, FastAPI                |
| Base datos | PostgreSQL 16                       |
| OCR        | pdfplumber, pytesseract, OpenCV     |
| Matching   | rapidfuzz token_set_ratio           |
| Excel      | pandas, openpyxl                    |
| Deploy     | Docker Compose                      |

## Estructura de carpetas

```
proyectosNeogen/
├── backend/
│   ├── app/
│   │   ├── api/routes/
│   │   │   ├── orders.py       # Upload, review, export
│   │   │   └── products.py     # CRUD + importación masiva
│   │   ├── core/config.py      # Settings pydantic-settings
│   │   ├── db/database.py      # Async SQLAlchemy
│   │   ├── models/models.py    # ORM models
│   │   ├── schemas/schemas.py  # Pydantic schemas
│   │   └── services/
│   │       ├── parser_service.py    # PDF/Excel/OCR
│   │       ├── matching_service.py  # Fuzzy matching
│   │       ├── export_service.py    # SAP Excel
│   │       └── order_service.py     # Orquestador
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/src/
│   ├── app/
│   │   ├── page.tsx              # Dashboard + upload drag&drop
│   │   ├── orders/page.tsx       # Historial de órdenes
│   │   ├── review/[id]/page.tsx  # Tabla editable por orden
│   │   └── products/page.tsx     # Base de productos CRUD
│   ├── components/layout/Sidebar.tsx
│   └── lib/
│       ├── api.ts                # Axios client + types
│       └── utils.ts              # Helpers: badges, formatting
├── docker-compose.yml
└── .env.example
```

## APIs

### Órdenes
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/orders/upload` | Subir y procesar OC |
| GET | `/api/orders/` | Listar órdenes |
| GET | `/api/orders/{id}` | Detalle con líneas |
| PATCH | `/api/orders/{id}/lines/{line_id}` | Editar línea |
| POST | `/api/orders/{id}/export` | Exportar Excel SAP |

### Productos
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/products/` | Listar productos |
| POST | `/api/products/` | Crear producto |
| PUT | `/api/products/{id}` | Actualizar |
| DELETE | `/api/products/{id}` | Desactivar |
| POST | `/api/products/import` | Importar Excel/CSV |

## Modelo de datos

### products
```sql
sku VARCHAR(100) UNIQUE, description VARCHAR(500),
price FLOAT, synonyms JSON, is_active BOOLEAN
```

### purchase_orders
```sql
status ENUM(pending|processing|review|completed|error)
distributor VARCHAR default 'ELECO'
parse_errors JSON, processed_at TIMESTAMP, export_path VARCHAR
```

### order_lines
```sql
raw_description, matched_sku, matched_description
quantity FLOAT, unit_price FLOAT
confidence ENUM(high|medium|low|none), confidence_score FLOAT
match_method VARCHAR, warnings JSON
manually_reviewed BOOLEAN, is_valid BOOLEAN
```

## Setup rápido

```bash
cp .env.example .env
# Editar .env con contraseñas reales

docker compose up --build

# Frontend:  http://localhost:3000
# API Docs:  http://localhost:8000/api/docs
```

## Importar base de productos

Excel con columnas exactas:

| SKU | DESCRIPCION | PRECIO | SINONIMOS |
|-----|-------------|--------|-----------|
| T-700001234 | Petrifilm EC | 59 | Petrifilm E.Coli\|EC Petrifilm |

Columna SINONIMOS: separar múltiples valores con `|`

## Formato Excel SAP exportado

| SKU | DESCRIPCION | CANTIDAD | PRECIO |
|-----|-------------|----------|--------|

Listo para copy-paste en SAP Business One.

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `POSTGRES_PASSWORD` | Contraseña PostgreSQL |
| `SECRET_KEY` | JWT secret (cambiar en producción) |
| `NEXT_PUBLIC_API_URL` | URL del backend desde el browser |
| `FUZZY_MATCH_THRESHOLD` | Score mínimo fuzzy (default 75) |
| `MAX_UPLOAD_SIZE_MB` | Límite upload (default 50) |

## Seguridad

- Uploads guardados con UUID (nombre original no expuesto en disco)
- Límite de tamaño configurable
- CORS restrictivo por dominio
- SQLAlchemy ORM → sin SQL injection
- Variables sensibles en `.env`

## Roadmap

### MVP (actual)
- [x] Upload PDF/Excel/CSV con drag & drop
- [x] Parsing automático (pdfplumber + OCR fallback)
- [x] Fuzzy matching rapidfuzz
- [x] Review screen editable tipo spreadsheet
- [x] Export Excel SAP format
- [x] CRUD + importación masiva de productos
- [x] Historial de órdenes

### v1.1
- [ ] Autenticación JWT
- [ ] Múltiples distribuidores
- [ ] Semantic matching (sentence-transformers)
- [ ] Processing asíncrono (Celery)

### v1.2
- [ ] Integración SAP API directa
- [ ] Plantillas por distribuidor
- [ ] Analytics dashboard
