Perfect 🚀 this is the last step — let’s add the docs so your app is release-ready.

---

## ✅ Step 7 → Documentation

We’ll add two files:

1. **`README.md`** → end-user guide (for your customers / ERPNext admins).
2. **`README_DEV.md`** → developer guide (for you / contributors).

---

### 1. `README.md`

Path:

```
nextpos_printing/README.md
```

````markdown
# NextPOS Printing

**NextPOS Printing** is a Frappe app that connects ERPNext POS to QZ Tray for reliable **thermal receipt printing** and **cash drawer handling**.

---

## Features
- 🔌 QZ Tray integration (secure printing via certificates/keys).
- 🖨️ Automatic receipt printing after invoice submit.
- ✂️ Cut modes (full, partial, or none).
- 💵 Open cash drawer automatically or manually.
- 📋 POS sidebar with quick buttons:
  - Print Current
  - Reprint Last
  - Open Drawer
- ⚙️ Settings panel with:
  - Default printer
  - Auto-print toggle
  - Copies, cut mode, feed lines
  - Custom header/footer text
  - Test Print and Test Drawer buttons
  - Setup Wizard (one-click defaults)

---

## Requirements
- ERPNext v15
- QZ Tray installed and running → [Download QZ Tray](https://qz.io/download/)
- Site config with QZ keys:
  ```json
  {
    "npp_cert_pem": "base64-encoded certificate",
    "npp_private_key": "base64-encoded private key"
  }
````

---

## Installation

From your bench folder:

```bash
bench get-app git@bitbucket.org:opennodescanada/nextpos_printing.git
bench --site yoursite install-app nextpos_printing
bench build
bench clear-cache
bench restart
```

---

## Usage

1. Go to **NextPOS Settings** in ERPNext.
2. Run **Setup Wizard** to apply defaults.
3. Use **Test Print** and **Test Drawer** to verify connection.
4. Open POS and use the sidebar buttons, or let receipts auto-print.

---

## Support

Developed by **Open Node Solutions**
Email: [support@opennodes.ca](mailto:support@opennodes.ca)

```

---

### 2. `README_DEV.md`

Path:  
```

nextpos\_printing/README\_DEV.md

````

```markdown
# NextPOS Printing – Developer Notes

## Folder Structure

````

nextpos\_printing/
├── nextpos\_printing/
│   ├── api/              # Whitelisted backend endpoints
│   │   ├── **init**.py
│   │   ├── print.py      # Print payloads for QZ
│   │   └── qz.py         # Certificate + signing for QZ Tray
│   ├── printing/         # Receipt renderers
│   │   ├── **init**.py
│   │   ├── receipt.py    # ESC/POS renderer
│   │   └── templates/
│   │       └── receipt.jinja  # Fallback receipt template
│   ├── utils/
│   │   ├── **init**.py
│   │   └── settings.py   # Fetch settings and printer mappings
│   ├── nextpos\_printing/ # DocTypes
│   │   └── doctype/
│   │       ├── nextpos\_printer\_mapping/
│   │       └── nextpos\_settings/
│   ├── public/
│   │   ├── css/
│   │   │   └── nextpos\_printing\_custom.css
│   │   └── js/
│   │       ├── nextpos\_pos.js
│   │       └── qz-tray.js
│   ├── hooks.py
│   └── ...

````

---

## Key Files

- **hooks.py** → injects `nextpos_pos.js` into POS, loads CSS.  
- **nextpos_pos.js** → main frontend logic:
  - Connects to QZ
  - Print invoices
  - Open drawer
  - Adds POS sidebar buttons
  - Replaces ERPNext print button
  - Auto-print invoices  
- **nextpos_settings.js** → UI logic for Test Print, Test Drawer, Setup Wizard.  
- **receipt.py** → ESC/POS rendering logic.  
- **settings.py** → mapping POS Profile → printer config.  

---

## Development Commands

```bash
# Build assets
bench build

# Apply schema updates
bench --site <site> migrate

# Clear cache
bench clear-cache

# Restart processes
bench restart
````

---

## Release Checklist

* [ ] Verify Test Print and Test Drawer work in **Settings**.
* [ ] Verify auto-print after invoice submit.
* [ ] Verify sidebar buttons (Print Current, Reprint Last, Drawer).
* [ ] Run `bench build && bench clear-cache && bench restart`.
* [ ] Tag stable release in git:

  ```bash
  git tag -a v1.0.0 -m "Stable release"
  git push origin v1.0.0
  ```

---

## Notes

* CSS must remain **global** (`.npp-sidebar`, `.npp-btn`) with `position: fixed`.
* Do not scope styles under `.point-of-sale-app` → it breaks layout.

```