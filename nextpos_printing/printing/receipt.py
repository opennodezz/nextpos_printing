import frappe
import os
from frappe.utils.jinja import render_template

CUT_FULL = '\x1D\x56\x00'   # GS V 0
PRINTER_WIDTH = 42  # characters per line
FEED_BEFORE_CUT = '\x1B\x64\x05'  # ESC d n = feed 5 lines

def wrap_text(text: str, width: int = PRINTER_WIDTH):
    """Wrap text to fit thermal printer width."""
    lines = []
    while len(text) > width:
        lines.append(text[:width])
        text = text[width:]
    if text:
        lines.append(text)
    return lines

def render_invoice(invoice_name: str):
    invoice = frappe.get_doc("POS Invoice", invoice_name)
    settings = frappe.get_single("NextPOS Settings")
    settings = frappe.get_single("NextPOS Settings")
    width = int(settings.paper_width or 42)


    lines = []

    # --- Header ---
    if invoice.docstatus == 0:
        lines.append("**** DRAFT RECEIPT ****")
    elif invoice.docstatus == 1:
        lines.append("**** FINAL RECEIPT ****")

    # Company name (centered)
    company = (invoice.company or "My Shop").center(width)
    lines.append(company)

    # Address/phone
    if settings.show_address and invoice.company:
        # First, try to fetch the primary address linked to the company
        addr = frappe.get_all(
            "Address",
            filters={
                "link_doctype": "Company",
                "link_name": invoice.company,
                "is_primary_address": 1
            },
            fields=["address_line1", "city", "phone"],
            limit=1
        )
        if addr:
            if addr[0].get("address_line1"):
                lines.append(addr[0].address_line1)
            if addr[0].get("city"):
                lines.append(addr[0].city)
            if addr[0].get("phone"):
                lines.append(f"Tel: {addr[0].phone}")
        else:
            # Fallback to Company phone number
            company = frappe.get_doc("Company", invoice.company)
            lines.append(f"Tel: {company.phone_no}")
            # if getattr(company, "phone_no", None):
            #     lines.append(f"Tel: {company.phone_no}")



    lines.append("-" * width)

    # --- Items ---
    for item in invoice.items:
        # Wrap item name if enabled
        if settings.wrap_long_names:
            for wrapped in wrap_text(item.item_name, width):
                lines.append(wrapped)
        else:
            lines.append(item.item_name)

        if settings.show_item_code:
            lines.append(f"  [{item.item_code}]")

        # Qty x Rate → Amount
        qty_rate = f"{item.qty:.0f} x {item.rate:.2f}"
        amt = f"{item.amount:.2f}"
        line = qty_rate.ljust(width - len(amt)) + amt
        lines.append(line)

    lines.append("-" * width)

    # --- Taxes ---
    if settings.show_tax:
        for tax in getattr(invoice, "taxes", []):
            tax_name = tax.description[:25]
            amt = f"{tax.tax_amount:.2f}"
            line = tax_name.ljust(width - len(amt)) + amt
            lines.append(line)

    # --- Totals ---
    lines.append("=" * width)
    total = f"{invoice.grand_total:.2f}"
    lines.append("TOTAL".ljust(width - len(total)) + total)

    paid = f"{getattr(invoice, 'paid_amount', 0.00):.2f}"
    lines.append("Paid".ljust(width - len(paid)) + paid)

    change = f"{getattr(invoice, 'change_amount', 0.00):.2f}"
    lines.append("Change".ljust(width - len(change)) + change)
    lines.append("=" * width)

    # --- Cashier ---
    if settings.show_cashier and getattr(invoice, "owner", None):
        user = frappe.get_doc("User", invoice.owner)
        cashier_name = user.full_name or user.username or invoice.owner
        lines.append(f"Cashier: {cashier_name}")
        lines.append("-" * width)

    # --- Footer ---
    if settings.custom_footer:
        for wrapped in wrap_text(settings.custom_footer, width):
            lines.append(wrapped.center(width))

    lines.append("\n\n\n")

    payload = "\n".join(lines)

    return [{
        "type": "raw",
        "format": "command",
        "data": payload
    }]