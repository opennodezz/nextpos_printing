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

def render_invoice(invoice_name: str, cut: bool = True):
    invoice = frappe.get_doc("POS Invoice", invoice_name)

    lines = []
    if invoice.docstatus == 0:
        lines.append("**** DRAFT RECEIPT ****")
    elif invoice.docstatus == 1:
        lines.append("**** FINAL RECEIPT ****")

    lines.append(invoice.company or "My Shop")
    lines.append("-" * PRINTER_WIDTH)

    # Items
    for item in invoice.items:
        # Wrap long item name
        for wrapped in wrap_text(item.item_name, PRINTER_WIDTH):
            lines.append(wrapped)

        # Print qty, rate, amount aligned
        qty = f"{item.qty:.0f}"
        rate = f"{item.rate:.2f}"
        amt = f"{item.amount:.2f}"
        line = f"{qty} x {rate}".ljust(PRINTER_WIDTH - len(amt)) + amt
        lines.append(line)

    lines.append("-" * PRINTER_WIDTH)

    # Taxes
    for tax in getattr(invoice, "taxes", []):
        tax_name = tax.description[:25]  # limit length
        amt = f"{tax.tax_amount:.2f}"
        line = tax_name.ljust(PRINTER_WIDTH - len(amt)) + amt
        lines.append(line)

    # Totals
    total = f"{invoice.grand_total:.2f}"
    lines.append("TOTAL".ljust(PRINTER_WIDTH - len(total)) + total)

    paid = f"{getattr(invoice, 'paid_amount', 0.00):.2f}"
    lines.append("Paid".ljust(PRINTER_WIDTH - len(paid)) + paid)

    change = f"{getattr(invoice, 'change_amount', 0.00):.2f}"
    lines.append("Change".ljust(PRINTER_WIDTH - len(change)) + change)

    lines.append("-" * PRINTER_WIDTH)
    lines.append("Thank you, come again!")
    lines.append("\n\n\n")

    payload = "\n".join(lines)
    if cut:
        payload += FEED_BEFORE_CUT + CUT_FULL

    return [{
        "type": "raw",
        "format": "command",
        "data": payload
    }]

