Alright 🚀 let’s lock this down with a **Release Test Checklist** so you can confirm everything works before tagging your first version.

---

# ✅ NextPOS Printing – Release Test Checklist

## 1. Environment Prep

* [*] Run `bench build && bench clear-cache && bench restart`
* [*] Hard refresh browser (`Ctrl + Shift + R`)
* [*] Confirm **QZ Tray** is running and trusted in browser

---

## 2. Settings Page (NextPOS Settings)

* [*] Open **NextPOS Settings** Doctype
* [-] Confirm **Default Printer** is saved
* [-] Run **Test Print** → receipt prints on default printer
* [-] Run **Test Drawer** → cash drawer opens on default printer
* [*] Toggle **Enable Auto Print** ON/OFF → save, ensure setting persists
* [*] Change **Cut Mode** (None → Full → Partial) → test cut commands work
* [*] Change **Receipt Header/Footer** → test receipt updates

---

## 3. POS Page – Sidebar Buttons

* [*] **Print Current** → prints currently open invoice
* [*] **Reprint Last** → prints most recent submitted invoice
* [-] **Open Drawer** → opens drawer using mapped printer

---

## 4. Auto Print

* [*] Submit new POS Invoice
* [*] Receipt prints automatically (if auto-print enabled)
* [-] Drawer opens (if “Open Drawer After Print” enabled in settings)

---

## 5. Error Handling

* [*] Stop QZ Tray → try to print → error message shown (“QZ Tray Not Running”)
* [*] Remove printer mapping → try print → fallback to default printer
* [*] Configure invalid printer name → app shows error & uses first available printer

---

## 6. Layout Checks

* [*] Sidebar appears left & right in POS view
* [*] Buttons align (70x70px, icons centered)
* [*] No visual overlap with ERPNext POS layout
* [*] Works on both **fullscreen POS** and **windowed POS**

---

## 7. Documentation

* [*] README.md exists with install + usage instructions
* [*] README\_DEV.md exists with folder structure + dev notes
* [-] Changelog started (`CHANGELOG.md`)

---

## 8. Git Tagging

* [ ] Commit all final changes
* [ ] Tag release:

  ```bash
  git tag -a v1.0.0 -m "Stable release v1.0.0"
  git push origin v1.0.0
  ```

---

👉 Once you check these off, you can call **v1.0.0 stable** 🎉.

Do you want me to also create a **CHANGELOG.md starter file** so you’re ready for versioning updates going forward?
