# NextPOS Printing – Developer Guide

## Folder Layout

- **api/**  
  Whitelisted methods callable from client/browser.  
  - `print.py` → Return receipt payload for POS Invoice  
  - `qz.py` → Certificate + RSA signing for QZ Tray  

- **utils/**  
  Internal Python helpers (not exposed to client).  
  - `settings.py` → Fetch printer mapping and defaults  

- **printing/**  
  Receipt rendering logic.  
  - `receipt.py` → ESC/POS rendering  
  - `templates/` → Optional Jinja templates  

- **doctype/**  
  ERPNext DocTypes (NextPOS Settings + Printer Mapping).  

- **public/**  
  Frontend assets.  
  - `js/nextpos_pos.js` → POS overrides + QZ Tray logic  
  - `js/qz-tray.js` → Vendor library (from qz.io)  
  - `css/nextpos_printing_custom.css` → Sidebar + button styling  

- **config/**  
  ERPNext desktop module integration.  
  - `desktop.py`  

---

## Development Notes

- Always add new APIs to `api/` with `@frappe.whitelist`.  
- Keep all receipt formatting in `printing/`.  
- Use `utils/` only for shared backend logic.  
- Never modify `qz-tray.js` (vendor file).  
- Client-side form logic belongs in `doctype/<doctype>/<doctype>.js`.  

### CSS (POS Sidebar)
- File: `public/css/nextpos_printing_custom.css`
- Handles sidebar positioning and button styles for POS.
- **Important:** Must remain global (`.npp-sidebar`, `.npp-btn`) with `position: fixed`.
- Do NOT scope under `.point-of-sale-app` or change to `absolute` → this breaks POS layout.
