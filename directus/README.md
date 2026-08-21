# Directus-Setup (nicht mehr der Happy Path)

Die App und der Scraper nutzen **Supabase**. Anleitung: [`../supabase/README.md`](../supabase/README.md). Dieser Ordner bleibt vorerst als Altlast.

Lokales Directus-Backend (SQLite). Siehe `../docs/spec-datenpipeline.md` für den historischen Kontext.

## Starten

1. `directus/.env` aus `.env.example` erzeugen (Werte für `SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` setzen).
2. `docker compose up -d`
3. Admin-UI: http://localhost:8055 (Login mit den Werten aus `.env`)

## Schema neu aufsetzen

Nach frischem Checkout und leerer Datenbank:
```bash
docker compose up -d
docker compose exec directus npx directus schema apply --yes ./schema/snapshot.yaml
```

Nach einem `git pull` dasselbe `schema apply --yes` ausführen, damit neue Felder (`SquadMembership.user_id`, `ManagerProfile`, `CompetitorSquad`) ankommen.

Invite-Rolle (einmal, Directus muss laufen):

```bash
node --env-file=directus/.env directus/scripts/ensure-manager-role.mjs
```

Danach in der Admin-UI User anlegen und die Rolle **manager** zuweisen. Keine öffentliche Registrierung.

Directus 12 Core speichert keine Item-Filter (`$CURRENT_USER`). Die App filtert trotzdem nach Session-User; Directus-Admin-URL nicht an die Freundesrunde geben.

Production: `PUBLIC_URL` in `.env` auf die HTTPS-URL von Directus setzen.

## Oracle Always Free (Produktion)

Die Web-App bleibt auf Vercel. Directus läuft auf einer **Ampere-ARM-VM** (Always Free), SQLite auf der Platte, HTTPS über Caddy.

### 1. Instanz anlegen (OCI Console)

Wenn der Account „bereit“ ist:

1. **Compute → Instances → Create instance**
2. Name z. B. `comunio-directus`
3. Image: **Ubuntu 24.04** (Minimal reicht)
4. Shape: nicht bei `VM.Standard.E2.1.Micro` (AMD, 1 GB) bleiben. **Change shape** → Processor **Ampere** → **VM.Standard.A1.Flex**, **1 OCPU**, **6 GB RAM**. Das ist ebenfalls Always Free (Kontingent: bis 4 OCPU / 24 GB in der Tenancy). Der Wizard zeigt zuerst die AMD-Mikroinstanz, weil die „einfach“ ist, nicht weil Ampere kostenpflichtig wäre.
5. SSH-Key hochladen (dein `id_ed25519.pub`)
6. Boot volume: 50 GB reicht
7. Öffentliche IPv4 behalten

Ampere grau / „out of capacity“: andere Availability Domain in derselben Region, oder später nochmal. **Nicht** mit der 1-GB-Mikroinstanz weitermachen — Directus + Docker + Caddy passen da nicht zuverlässig (Out-of-Memory). Eine zweite Always-Free-Mikroinstanz hilft auch nicht, SQLite läuft auf einer Maschine.

### 2. Ports

**Networking → die VCN der Instanz → Security List → Ingress:**

- TCP 22 (am besten nur deine IP)
- TCP 80 und 443 von `0.0.0.0/0` (Let's Encrypt + HTTPS)

Zusätzlich auf der VM (Oracle-Ubuntu blockt sonst oft trotzdem):

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save 2>/dev/null || sudo apt-get install -y iptables-persistent && sudo netfilter-persistent save
```

### 3. Domain

Let's Encrypt braucht einen **Hostnamen**, keine nackte IP. Subdomain (z. B. `directus.deinedomain.de`) per A-Record auf die Public IP. Die URL nicht in der Freundesrunde verteilen — nur Vercel kennt sie (`DIRECTUS_URL`).

### 4. Docker + Compose auf der VM

```bash
sudo apt-get update
sudo apt-get install -y git docker.io docker-compose-v2
sudo usermod -aG docker $USER
# neu einloggen, dann:
git clone https://github.com/schroepa/comunio-skrt.git
cd comunio-skrt/directus
cp .env.example .env
# SECRET, ADMIN_*, DIRECTUS_DOMAIN, PUBLIC_URL setzen
nano .env
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec directus npx directus schema apply --yes ./schema/snapshot.yaml
```

Rolle `manager` vom Laptop (Directus muss öffentlich erreichbar sein):

```bash
DIRECTUS_URL=https://directus.deinedomain.de node --env-file=directus/.env directus/scripts/ensure-manager-role.mjs
```

`directus/.env` auf dem Laptop hat dann `ADMIN_EMAIL` / `ADMIN_PASSWORD` der **Produktions**-Instanz, nicht die lokalen Werte vermischen.

Katalog: in `scraper/.env` `DIRECTUS_URL` auf dieselbe HTTPS-URL, dann `npm run sync:openligadb` und `npm run sync:transfermarkt`. Nicht die lokale SQLite-Datei auf den Server kopieren, wenn Prod schon Admin-User hat — Schema + Sync ist sauberer.

### 5. Vercel

Env `DIRECTUS_URL=https://directus.deinedomain.de` (ohne Slash-Spielereien, trailing slash ist egal, die App strippt ihn). Kein Admin-Passwort auf Vercel.

## Collections

`Player`, `ValueHistory`, `RatingHistory`, `Fixture`, `AvailabilityStatus`, `SquadMembership` (`user_id`), `ManagerProfile`, `CompetitorSquad`, `ScrapeLog`.
