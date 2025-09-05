# nextpos_printing/api/settings.py
import frappe
from nextpos_printing.utils import settings as settings_utils

@frappe.whitelist()
def get_nextpos_settings():
    return settings_utils.get_nextpos_settings()

@frappe.whitelist()
def get_printer_for_pos(pos_profile=None):
    return settings_utils.get_printer_for_pos(pos_profile)
