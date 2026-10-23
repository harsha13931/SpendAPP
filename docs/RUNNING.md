# Running SPEND

There are two parts:

* **The app** (`app/`): React Native with Expo. It runs on your Android phone
  through Expo Go, in an Android emulator, or in a browser.
* **The engine** (`src/spend_engine`): a Python API that reads bank SMS and
  categorises them. The app needs it only for live mode. Sample mode works
  without it.

## What you need

| Tool | Version | Check with |
|---|---|---|
| Git | any | `git --version` |
| Node.js | 20 or newer | `node --version` |
| Python | 3.11 or newer | `python --version` (or `python3 --version`) |
| Expo Go (Android phone) | supports Expo SDK 58 | Play Store; update it if already installed |

Your phone and computer must be on the **same Wi-Fi** network.

## 1. Get the code

```bash
git clone https://github.com/harsha13931/SpendAPP.git
cd SpendAPP
```

## 2. Run the app with sample data (no server)

```bash
cd app
npm install
npx expo start
```

A QR code appears in the terminal.

* **Phone:** open **Expo Go** and scan the QR code.
* **Browser:** press `w` in the terminal.
* **Android emulator:** start one from Android Studio, then press `a`.

When the app opens, tap **Try with sample data**. You can explore Today,
Activity, re-tagging and Privacy with fictional transactions.

## 3. Run the engine for live mode

Open a **second terminal** in the `SpendAPP` folder (the repository root).

macOS / Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
SPEND_DB=spend.db uvicorn spend_engine.api:app --host 0.0.0.0 --port 8000
```

Windows (PowerShell):

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
$env:SPEND_DB = "spend.db"
uvicorn spend_engine.api:app --host 0.0.0.0 --port 8000
```

Check it works: open <http://localhost:8000/health> in a browser. The
interactive API docs are at <http://localhost:8000/docs>.

`SPEND_DB=spend.db` keeps your data in a local file between restarts. Leave it
out to keep everything in memory.

## 4. Connect the app to the engine

Find your computer's local IP address:

* **Windows:** run `ipconfig` and read the "IPv4 Address", e.g. `192.168.1.20`.
* **macOS:** `ipconfig getifaddr en0`
* **Linux:** `hostname -I`

In the app, enter `http://<your-ip>:8000` (e.g. `http://192.168.1.20:8000`) as
the **SPEND server address**. Do this on the onboarding screen and tap
**Continue**, or later in **Privacy → Connect to server**.

| Where the app runs | Server address |
|---|---|
| Phone with Expo Go | `http://<your-computer-ip>:8000` |
| Android emulator | `http://10.0.2.2:8000` (the default) |
| Browser on the same computer | `http://localhost:8000` (the default) |

To skip typing it, start the app with the address preset:

```bash
EXPO_PUBLIC_SPEND_API_URL=http://192.168.1.20:8000 npx expo start
```

Then tap **+** on Today, paste a bank SMS and tap **Read message**. Try this
fictional one:

```
Sent Rs.149.00 from Kotak Bank AC X7890 to rapido.ride@axisbank on 22-10-26.UPI Ref 629400000101.
```

## Run the tests

```bash
# engine, from the repository root
pytest

# app, from app/
npm run typecheck
npm run lint
npm test
```

## Troubleshooting

| Problem | Fix |
|---|---|
| Expo Go can't open the QR code, or loads forever | Use `npx expo start --tunnel`, or make sure phone and computer are on the same Wi-Fi |
| Expo Go says the project's SDK is not supported | Update Expo Go from the Play Store |
| App shows "Can't reach the SPEND server" | Check the engine terminal is running, the IP address is right, and your firewall allows port 8000 |
| Browser version can't reach the engine | The engine allows `http://localhost:8081` by default; for another origin set `SPEND_CORS_ORIGINS=http://localhost:19006` (comma-separated for several) |
| `uvicorn: command not found` | Activate the virtual environment first (`source .venv/bin/activate` or `.venv\Scripts\Activate.ps1`) |
| `npm install` fails on an old Node | Install Node 20 or newer |

## Security note

The engine has **no login yet**. Anyone who can reach port 8000 can read and
write data. Run it only on your own home network, never on public Wi-Fi or an
internet-facing server. Use only fictional sample SMS while testing.
