# Data Model: Registro de Movimientos con Tags

**Feature**: `002-registro-movimientos` | **Fecha**: 2026-09-02

Dos vistas del mismo modelo: **dominio** (VOs y entidades puras, principio VII) y **persistencia** (tablas Drizzle, principio V). El mapeo entre ambas vive en `src/infrastructure/db/mappers/`.

---

## 1. Vista de Dominio

### 1.1 Value Objects

#### `Money` (src/domain/movement/Money.ts)
Value Object inmutable para importes en EUR.

| Miembro | Regla |
|---|---|
| `amountCents: number` | Entero (sin decimales). `Number.isInteger` obligatorio. Rango: `0 < amountCents <= 999_999_999_99` (≤ 999.999.999,99 €). |
| `Money.fromCents(cents)` | Factory para importes de movimiento: **MUST ser > 0** (FR-003); lanza `InvalidMoneyError` si no es entero, es 0 o negativo, o excede el máximo. |
| `Money.fromCentsOrZero(cents)` | Para balances: permite 0 y negativos (una cuenta puede quedar en números rojos); valida entero. |
| `add(other)` / `subtract(other)` | Devuelven nuevo `Money`; aritmética entera exacta, sin `Math.round` sobre floats. |
| Invariantes | Inmutabilidad; sin conversión a/from float en ninguna capa. |

#### `MovementType` (src/domain/movement/MovementType.ts)
Enum `'expense' | 'income'` (gasto | ingreso).

#### `ExpenseNature` (src/domain/movement/ExpenseNature.ts)
Enum `'personal' | 'shared'` (personal | compartido). **Solo aplica a gastos** (FR-005).

#### `AccountType` (src/domain/account/AccountType.ts)
Enum `'personal' | 'shared'` (personal | común).

#### `TagStatus` (src/domain/tag/TagStatus.ts)
Enum `'active' | 'inactive'`. En esta feature todas las tags del catálogo están activas; el estado existe para no romper el histórico cuando la feature 004 las desactive.

#### IDs
`MemberId`, `AccountId`, `TagId`, `MovementId`: VOs wrappers sobre `number` (PK autoincrement de SQLite).

### 1.2 Entidades

#### `Member` (Miembro)
| Campo | Tipo | Regla |
|---|---|---|
| id | `MemberId` | |
| name | `string` | No vacío tras trim. Único (persistido con constraint). |

#### `Account` (Cuenta)
| Campo | Tipo | Regla |
|---|---|---|
| id | `AccountId` | |
| name | `string` | No vacío tras trim. Único. |
| type | `AccountType` | `'personal'` o `'shared'`. |
| memberId | `MemberId \| null` | **Invariante**: obligatorio si `type = 'personal'`; `null` si `type = 'shared'` (la cuenta común no atribuye a miembro). |

El balance **no es un campo** de la entidad: es una query derivada (`AccountRepository.getBalance(accountId)`, ADR 0009).

#### `Tag` (Etiqueta)
| Campo | Tipo | Regla |
|---|---|---|
| id | `TagId` | |
| name | `string` | No vacío tras trim. **Único ignorando mayúsculas/minúsculas** ("Luz" y "luz" duplicados, FR-007). |
| slug | `string` | Clave natural estable para el seed (kebab-case). Único. |
| status | `TagStatus` | `'active'` en esta feature. |

#### `Movement` (Movimiento) — raíz del agregado
| Campo | Tipo | Regla |
|---|---|---|
| id | `MovementId` | |
| accountId | `AccountId` | Cuenta existente (FK). |
| type | `MovementType` | `'expense'` \| `'income'`. |
| date | `string` (ISO `YYYY-MM-DD`) | Fecha válida de calendario; puede ser de cualquier mes (FR-004); el movimiento computa en el mes de su fecha. |
| concept | `string` | **Obligatorio**, no vacío tras trim (ej. "Mercadona"). |
| description | `string \| null` | Opcional. |
| amount | `Money` | **> 0** siempre (los abonos/devoluciones se registran como ingresos, FR-003). El signo contable lo determina `type` en la query de balance. |
| nature | `ExpenseNature \| null` | **Invariante**: obligatorio si `type = 'expense'`; prohibido (`null`) si `type = 'income'` (FR-005). |
| tagIds | `TagId[]` | 0 o más; deduplicado; todas deben existir y estar activas (FR-006). |
| createdAt | `string` (ISO-8601 UTC) | Audit. |

**Reglas de creación** (factory `Movement.create` / caso de uso `CreateMovement`):
1. Naturaleza por defecto según cuenta: si `account.type = 'shared'` → `'shared'` (gasto de la común es compartido); si la cuenta es personal, el usuario elige (UI preselecciona `'personal'`, FR-016) — el dominio solo exige presencia para gastos.
2. Si `type = 'income'`, `nature` se ignora/rechaza.
3. Inmutable tras la creación (sin edición/eliminación hasta la feature 003).

### 1.3 Relaciones (dominio)

```text
Member 1───0..1 Account        (una cuenta personal por miembro; la común no tiene miembro)
Account 1───n   Movement       (un movimiento pertenece a una cuenta)
Movement n──n  Tag            (via tagIds; 0..* tags por movimiento)
```

El miembro de un movimiento **se deriva** de la cuenta en cuentas personales (asunción de la spec); no se persiste en el movimiento.

### 1.4 Errores de dominio (src/domain/**/*Errors.ts)

Excepciones que extienden `DomainError`: `InvalidMoneyError` (importe ≤ 0, no entero, fuera de rango), `InvalidMovementError` (naturaleza ausente en gasto / presente en ingreso, campos vacíos), `DuplicateTagNameError` (nombre duplicado case-insensitive), `InactiveTagError` (tag inactiva asignada). Los adaptadores inbound las traducen a errores de campo o mensajes de UI.

### 1.5 Transiciones de estado

- `Movement`: sin transiciones (inmutable; CRUD diferido a feature 003).
- `Tag`: `active → inactive` llegará con la feature 004; aquí nacen `active` y permanecen activas.
- `Member`/`Account`: sin transiciones en esta feature.

---

## 2. Vista de Persistencia (Drizzle, SQLite/Turso)

Esquema en `src/infrastructure/db/schema/`. Migración inicial generada con drizzle-kit y versionada en `drizzle/`.

### 2.1 Tablas

```text
members                          accounts
├── id: integer PK autoincrement ├── id: integer PK autoincrement
└── name: text NOT NULL          ├── name: text NOT NULL
                                 ├── type: text NOT NULL  ('personal'|'shared')
                                 ├── member_id: integer FK→members.id (NULL si común)
                                 └── UNIQUE(name)

tags
├── id: integer PK autoincrement
├── name: text NOT NULL
├── slug: text NOT NULL
├── status: text NOT NULL DEFAULT 'active'
├── UNIQUE(slug)
└── UNIQUE INDEX tags_name_nocase_uq ON lower(name)   -- FR-007

movements
├── id: integer PK autoincrement
├── account_id: integer NOT NULL FK→accounts.id
├── type: text NOT NULL          ('expense'|'income')
├── date: text NOT NULL          (ISO 'YYYY-MM-DD')
├── concept: text NOT NULL
├── description: text NULL
├── amount_cents: integer NOT NULL  (> 0 garantizado por dominio+Zod)
├── nature: text NULL            ('personal'|'shared'; NULL si ingreso)
├── created_at: text NOT NULL    (ISO-8601 UTC)
└── INDEX idx_movements_account_date ON (account_id, date)

movement_tags
├── movement_id: integer NOT NULL FK→movements.id ON DELETE CASCADE
├── tag_id: integer NOT NULL FK→tags.id ON DELETE CASCADE
└── PRIMARY KEY (movement_id, tag_id)
```

### 2.2 Decisiones de tipos

- **Dinero**: `amount_cents` entero (nunca `real`/`numeric`); el signo contable (±) lo aplica la query de balance según `type`.
- **Fechas**: `date` como TEXT ISO `YYYY-MM-DD` (orden lexicográfico = cronológico). Sin columna `month`: el filtro mensual usa rango semicerrado `[YYYY-MM-01, mes+1-01)` sobre el índice `(account_id, date)` (sargable).
- **N-N**: escritura de movimiento + tags en un `db.batch` de libSQL (atómico).
- **Balance**: `SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount_cents ELSE -amount_cents END), 0) FROM movements WHERE account_id = ?` (ADR 0009).

### 2.3 Datos precargados (FR-001, FR-006) — src/infrastructure/db/seed-data.ts + scripts/seed.ts

Seed idempotente (`onConflictDoNothing` sobre claves naturales), ejecutado con `npm run db:seed` tras migrar:

**Miembros** (2): nombres reales de la pareja — *NEEDS CLARIFICATION → resuelto en implementación con placeholders editables*: valores iniciales "Miembro A" / "Miembro B" configurables en `seed-data.ts` antes del primer `db:seed`.

**Cuentas** (3):

| name | type | member_id |
|---|---|---|
| Cuenta de {Miembro A} | personal | → Miembro A |
| Cuenta de {Miembro B} | personal | → Miembro B |
| Cuenta común | shared | NULL |

**Tags** (12, todas `active`): Hogar, Coche, Salud, Alimentación, Ocio, Viaje, Ropa, Regalos, Suscripciones online, Sin Clasificar (catálogo del Excel) + **Vivienda** e **Hipoteca** (soporte al escenario 1 de la spec).

---

## 3. Validación por capa (dónde vive cada regla)

| Regla | Zod (frontera, action) | Dominio (VO/entidad) | DB (constraint) |
|---|---|---|---|
| Campos obligatorios presentes (fecha, concepto, importe, cuenta, tipo) | ✅ | — | NOT NULL |
| Importe > 0, ≤ 2 decimales, formato es-ES ("850,00"/"850.00"/"850") | ✅ (regex + parse a céntimos por string) | ✅ `Money.fromCents` | `amount_cents > 0` (check lógico) |
| Fecha ISO válida | ✅ | — | — |
| Tipo y naturaleza en enums; naturaleza solo en gastos | ✅ | ✅ `Movement.create` | — |
| Tags: 0..n, existen y activas | ✅ (ids enteros, dedup) | ✅ | FK + PK compuesta |
| Nombre de tag único case-insensitive | — (no aplica al registro) | ✅ `DuplicateTagNameError` | unique index `lower(name)` |
| Cuenta existe; naturaleza por defecto según tipo de cuenta | ✅ (cuenta válida) | ✅ (default `'shared'` si cuenta común) | FK |

---

## 4. Glosario ES ↔ EN (constitución VI)

Términos de dominio intraducibles o con equivalencia fijada; **los identificadores de código usan la columna EN**:

| Español (UI/spec) | English (código) | Notas |
|---|---|---|
| Movimiento | `Movement` | Fila del Excel mensual |
| Gasto / Ingreso | `expense` / `income` | `MovementType` |
| Naturaleza | `nature` | `ExpenseNature`: personal / compartido (`personal` / `shared`) |
| Personal / Compartido (gasto) | `personal` / `shared` | Renombrado desde "propio/común" del roadmap (clarificación) |
| Cuenta | `Account` | |
| Cuenta personal / Cuenta común | `personal` / `shared` | `AccountType` |
| Miembro | `Member` | |
| Etiqueta / Tag | `Tag` | "Tag" se usa tal cual en UI y código |
| Concepto | `concept` | Ej. "Mercadona" |
| Descripción | `description` | |
| Importe | `amount` / `Money` | Internamente céntimos (`amountCents`) |
| Balance (acumulado) | `balance` | Derivado, no persistido |
| Sin clasificar | `unclassified` | Agrupación de movimientos sin tags |
| Catálogo (de tags) | `tag catalog` | Seed precargado |
| Mes (del listado) | `month` | `YYYY-MM` en URL/listado |
