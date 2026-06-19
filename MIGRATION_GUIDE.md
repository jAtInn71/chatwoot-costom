# Chatwoot Custom — Migration Guide

## How Migrations Work

### What is a Migration?
Migration = Database mein safely column ya table add/remove karna.
Har migration ek Ruby file hoti hai with a timestamp version number.

Example: `20260520000001_add_elevenlabs_to_channel_web_widgets.rb`
- `20260520000001` = version (timestamp)
- Adds `elevenlabs_agent_id` column to `channel_web_widgets` table

---

## Fresh DB Flow (docker compose down -v + up -d)

```
Step 1: db:chatwoot_prepare
  → Fresh DB detected → schema:load runs
  → schema.rb se saari base tables banti hain
  → schema_migrations table mein saare versions insert hote hain
  → BUT: custom columns schema.rb mein nahi hain
  → So: tables bane, custom columns nahi bane

Step 2: Custom migration check (Rails runner)
  → Checks: koi custom column missing hai?
  → elevenlabs_agent_id? → NO (missing!)
  → Deletes ONLY custom versions from schema_migrations:
    - 20260520000001, 20260520000002
    - 20260521000001 to 20260521000005
    - 20260618000001
  → Base Chatwoot versions SAFE rehte hain

Step 3: db:migrate
  → Custom versions ab "pending" hain
  → Saari custom migrations run hoti hain
  → Columns add hote hain:
    - elevenlabs_agent_id
    - voice_agent_provider, voice_agent_api_key, voice_agent_config_data
    - custom_branding_text, custom_branding_url
    - custom_bubble_icon_url, custom_bubble_icon_size
    - widget_bg_color, widget_font_family, etc.
    - message_font_size
    - available_message, unavailable_message

Step 4: Server start
```

---

## Existing DB Flow (docker compose pull + up -d)

```
Step 1: db:chatwoot_prepare
  → DB exists → db:migrate (base migrations only)

Step 2: Custom migration check
  → Checks: koi custom column missing hai?
  → elevenlabs_agent_id? → YES (exists!)
  → All columns present → SKIP (no deletion)

Step 3: db:migrate
  → Only NEW pending migrations run
  → Already applied migrations skip hote hain
  → Purana data SAFE rehta hai

Step 4: Server start
```

---

## How to Add a New Column

### Step 1: Create migration file
```
custom/backend/migrations/20260619000001_add_phone_to_channel_web_widgets.rb
```

```ruby
class AddPhoneToChannelWebWidgets < ActiveRecord::Migration[7.0]
  def change
    unless column_exists?(:channel_web_widgets, :phone)
      add_column :channel_web_widgets, :phone, :string
    end
  end
end
```

IMPORTANT: Always use `column_exists?` guard!

### Step 2: Add COPY to Dockerfile
```dockerfile
COPY custom/backend/migrations/20260619000001_add_phone_to_channel_web_widgets.rb \
     /app/db/migrate/20260619000001_add_phone_to_channel_web_widgets.rb
```

### Step 3: Update docker-compose.yaml
Add column name to `custom_cols` list:
```yaml
custom_cols = %i[elevenlabs_agent_id ... phone]
```

Add version to `custom_versions` list:
```yaml
custom_versions = %w[
  ...existing versions...
  20260619000001
]
```

### Step 4: Build and push
```bash
./build.sh
docker tag chatwoot-custom:latest ghcr.io/jatinn71/chatwoot-custom:latest
docker push ghcr.io/jatinn71/chatwoot-custom:latest
```

### Step 5: User pulls new image
```bash
docker compose pull
docker compose up -d
# New column automatically applied!
```

---

## Why schema_migrations Deletion is Needed

```
schema.rb contains:
  ✅ Table definitions (columns from base Chatwoot)
  ✅ Migration version numbers (ALL versions, including custom)
  ❌ Custom columns NOT in table definitions

Problem:
  schema:load → creates tables WITHOUT custom columns
           → BUT inserts custom version numbers
           → Rails thinks custom migrations already ran
           → db:migrate skips them
           → Custom columns never created!

Solution:
  Delete custom versions from schema_migrations
  → Rails thinks they are pending
  → db:migrate runs them
  → Custom columns created!
```

---

## Data Safety

| Command | Data |
|---|---|
| `docker compose restart` | SAFE |
| `docker compose down && up -d` | SAFE |
| `docker compose pull && up -d` | SAFE |
| `docker compose down -v` | ALL DATA DELETED |

`-v` flag = volumes delete = database delete

---

## Custom Initializers

| File | Purpose |
|---|---|
| `skip_onboarding.rb` | Clears onboarding_step on account save → no redirect loop |
| `enterprise_limits_patch.rb` | Skips cloud-only check on /limits endpoint → returns 200 OK |
| `installation_config_guard.rb` | Ignores AI SDK boot error on fresh DB |
| `force_open_widget_conversations.rb` | Auto-opens pending widget conversations |
| `rack_attack.rb` | Rate limiting configuration |

---

## Troubleshooting

### Widget 500 error
→ Custom columns missing. Run: `docker compose restart rails`

### Onboarding redirect loop
→ Should not happen with skip_onboarding.rb in image.
→ Manual fix: clear Account.custom_attributes['onboarding_step']

### enterprise/limits 404
→ enterprise_limits_patch.rb missing from image. Rebuild image.

### DuplicateColumn error in postgres
→ Base migration versions were deleted. Do `docker compose down -v && up -d`
