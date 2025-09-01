import frappe
import re

DEFAULT_WIDTH = 42  # characters per line


def wrap_text(text: str, width: int = DEFAULT_WIDTH):
    """Wrap text to fit thermal printer width."""
    lines = []
    while len(text) > width:
        lines.append(text[:width])
        text = text[width:]
    if text:
        lines.append(text)
    return lines


def format_custom_block(text: str, width: int):
    """Clean and center-align each line of custom header/footer text."""
    if not text:
        return []

    # Replace HTML breaks and paragraphs with newlines
    clean = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    clean = re.sub(r"</?p.*?>", "\n", clean, flags=re.I)

    # Strip remaining HTML tags
    clean = frappe.utils.strip_html_tags(clean or "")

    # Split and center
    formatted = []
    for ln in [ln.strip() for ln in clean.split("\n") if ln.strip()]:
        for wrapped in wrap_text(ln, width):
            formatted.append(wrapped.center(width))
    return formatted


def render_invoice(invoice_name: str):
    """Render a POS Invoice into ESC/POS raw lines for thermal printers."""
    invoice = frappe.get_doc("POS Invoice", invoice_name)
    settings = frappe.get_single("NextPOS Settings")
    width = int(settings.paper_width or DEFAULT_WIDTH)

    lines = []

    # --- Header ---
    if settings.receipt_header:
        header_lines = format_custom_block(settings.receipt_header, width)
        if header_lines:
            # First line bold/double height
            lines.append("\x1BE\x01\x1B!\x10" + header_lines[0].center(width) + "\x1BE\x00\x1B!\x00")
            for ln in header_lines[1:]:
                lines.append(ln.center(width))
            lines.append("")
    lines.append("-" * width)

    # --- Items ---
    for item in invoice.items:
        amt = f"{item.amount:.2f}"
        name = item.item_name
        wrapped_name = wrap_text(name, width - len(amt) - 1)

        if wrapped_name:
            # First chunk with amount
            lines.append(wrapped_name[0].ljust(width - len(amt)) + amt)
            for extra in wrapped_name[1:]:
                lines.append("  " + extra)

        # Qty × Rate
        qty_rate = f"{item.qty:.0f} x {item.rate:.2f}"
        lines.append("   " + qty_rate)
        lines.append("")

    # --- Taxes ---
    if settings.show_tax and getattr(invoice, "taxes", []):
        for tax in invoice.taxes:
            tax_name = tax.description[:15]  # short label
            amt = f"{tax.tax_amount:.2f}"
            lines.append(tax_name.ljust(width - len(amt)) + amt)
        lines.append("")

    # --- Totals ---
    lines.append("=" * width)
    total = f"{invoice.grand_total:.2f}"
    lines.append("\x1BE\x01" + "TOTAL".ljust(width - len(total)) + total + "\x1BE\x00")
    lines.append("=" * width)
    lines.append("")

    # --- Payments ---
    paid = f"{getattr(invoice, 'paid_amount', 0.00):.2f}"
    change = f"{getattr(invoice, 'change_amount', 0.00):.2f}"
    lines.append("Payment".ljust(width - len(paid)) + paid)
    lines.append("Change Due".ljust(width - len(change)) + change)
    lines.append("")

    # --- Cashier ---
    if settings.show_cashier and getattr(invoice, "owner", None):
        user = frappe.get_doc("User", invoice.owner)
        cashier_name = user.full_name or user.username or invoice.owner
        lines.append(f"Cashier: {cashier_name}")

    # Metadata
    lines.append(f"Invoice: {invoice.name}")
    lines.append(f"Date: {frappe.utils.format_datetime(invoice.posting_date, 'HH:mm dd-MM-YYYY')}")
    lines.append("")

    # --- Footer ---
    if settings.receipt_footer:
        lines.extend(format_custom_block(settings.receipt_footer, width))

    lines.append("\n")
    lines.append(("**** FINAL RECEIPT ****" if invoice.docstatus == 1 else "**** DRAFT RECEIPT ****").center(width))
    lines.append("\n\n\n")  # feed before cut

    return [{"type": "raw", "data": "\n".join(lines)}]
