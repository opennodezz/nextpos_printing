import frappe
import re, base64
from frappe.utils.file_manager import get_file_path

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


def html_to_escpos(html_text: str) -> str:
    """Convert limited HTML from Text Editor into ESC/POS-friendly text."""
    text = html_text or ""

    # line breaks
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    text = re.sub(r"</?p>", "\n", text, flags=re.I)

    # bold
    text = re.sub(r"<b>|<strong>", "\x1B\x45\x01", text, flags=re.I)
    text = re.sub(r"</b>|</strong>", "\x1B\x45\x00", text, flags=re.I)

    # center
    text = re.sub(r"<center>", "\x1B\x61\x01", text, flags=re.I)
    text = re.sub(r"</center>", "\x1B\x61\x00", text, flags=re.I)

    # strip anything else
    text = frappe.utils.strip_html_tags(text)
    return text


import frappe
import re, base64
from frappe.utils.file_manager import get_file_path

PRINTER_WIDTH = 42  # characters per line


def wrap_text(text: str, width: int = PRINTER_WIDTH):
    """Wrap text to fit thermal printer width."""
    lines = []
    while len(text) > width:
        lines.append(text[:width])
        text = text[width:]
    if text:
        lines.append(text)
    return lines


def html_to_escpos(html_text: str) -> str:
    """Convert limited HTML into ESC/POS-friendly text."""
    text = html_text or ""

    # line breaks
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    text = re.sub(r"</?p>", "\n", text, flags=re.I)

    # bold
    text = re.sub(r"<b>|<strong>", "\x1BE\x01", text, flags=re.I)
    text = re.sub(r"</b>|</strong>", "\x1BE\x00", text, flags=re.I)

    # center
    text = re.sub(r"<center>", "\x1Ba\x01", text, flags=re.I)
    text = re.sub(r"</center>", "\x1Ba\x00", text, flags=re.I)

    # strip any other html
    text = frappe.utils.strip_html_tags(text)
    return text


def render_invoice(invoice_name: str):
    invoice = frappe.get_doc("POS Invoice", invoice_name)
    settings = frappe.get_single("NextPOS Settings")
    width = int(settings.paper_width or PRINTER_WIDTH)

    lines = []

    # --- Custom Header ---
    if settings.receipt_header:
        header_text = html_to_escpos(settings.receipt_header)
        for wrapped in wrap_text(header_text, width):
            lines.append(wrapped)

    lines.append("-" * width)

    # --- Items ---
    for item in invoice.items:
        if settings.wrap_long_names:
            for wrapped in wrap_text(item.item_name, width):
                lines.append(wrapped)
        else:
            lines.append(item.item_name)

        if settings.show_item_code:
            lines.append(f"  [{item.item_code}]")

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
    if settings.receipt_footer:
        footer_text = html_to_escpos(settings.receipt_footer)
        for wrapped in wrap_text(footer_text, width):
            lines.append(wrapped)
    elif settings.custom_footer:
        for wrapped in wrap_text(settings.custom_footer, width):
            lines.append(wrapped.center(width))

    # --- Receipt Type ---
    if invoice.docstatus == 0:
        lines.append("**** DRAFT RECEIPT ****".center(width))
    elif invoice.docstatus == 1:
        lines.append("**** FINAL RECEIPT ****".center(width))

    lines.append("\n\n\n")

    # --- Build Payload ---
    payload = []

    # Then receipt text block
    payload.append({
        "type": "raw",
        "data": "\n".join(lines)
    })

    return payload
