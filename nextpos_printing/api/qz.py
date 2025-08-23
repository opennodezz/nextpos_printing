import base64
import frappe

from cryptography.hazmat.primitives.serialization import load_pem_private_key
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric.utils import Prehashed
from cryptography.hazmat.backends import default_backend


@frappe.whitelist(allow_guest=True)
def qz_get_certificate():
    """Return publisher certificate PEM (string) for QZ Tray."""
    pem_b64 = frappe.conf.get("npp_cert_pem")
    if not pem_b64:
        frappe.throw("Missing npp_cert_pem in site_config.json")
    return base64.b64decode(pem_b64).decode("utf-8")


@frappe.whitelist(allow_guest=True)
def qz_sign():
    """Sign the raw string from QZ using RSA-SHA1 and return base64(signature)."""
    to_sign = frappe.form_dict.get("toSign")
    if not to_sign:
        frappe.throw("Missing toSign")

    key_b64 = frappe.conf.get("npp_private_key")
    if not key_b64:
        frappe.throw("Missing npp_private_key in site_config.json")

    key_bytes = base64.b64decode(key_b64)
    private_key = load_pem_private_key(key_bytes, password=None, backend=default_backend())

    # QZ wants raw string signed with SHA1+RSA
    signature = private_key.sign(
        to_sign.encode("utf-8"),
        padding.PKCS1v15(),
        hashes.SHA1()
    )

    return base64.b64encode(signature).decode("utf-8")
