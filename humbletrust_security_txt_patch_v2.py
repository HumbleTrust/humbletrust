#!/usr/bin/env python3
"""
HumbleTrust — security.txt patch v2 (regex-based).

v1 used a literal anchor for Cargo.toml that no longer matched.
v2 finds the [dependencies] section and inserts solana-security-txt
regardless of how the other deps are formatted.

Run from project root:
    python3 humbletrust_security_txt_patch_v2.py
"""

import re
import shutil
import sys
import time
from pathlib import Path

PROJECT = Path(__file__).resolve().parent
CARGO_TOML = PROJECT / "programs" / "humbletrust" / "Cargo.toml"
LIB_RS = PROJECT / "programs" / "humbletrust" / "src" / "lib.rs"

for p in (CARGO_TOML, LIB_RS):
    if not p.exists():
        sys.exit(f"FATAL: {p} not found.")

TS = int(time.time())

# ============================================================
# 1) Cargo.toml — add solana-security-txt to [dependencies]
# ============================================================
print("── 1. Cargo.toml: add solana-security-txt ──")
text = CARGO_TOML.read_text()

if "solana-security-txt" in text:
    print("  ⏭  already present")
else:
    bak = CARGO_TOML.with_suffix(CARGO_TOML.suffix + f".sec.bak.txt2.{TS}")
    shutil.copy2(CARGO_TOML, bak)
    print(f"  backup: {bak.name}")

    # Strategy: find the [dependencies] section header and append our line
    # right after it. Works regardless of what's already there.
    m = re.search(r'^(\[dependencies\]\s*\n)', text, re.MULTILINE)
    if not m:
        sys.exit("  ❌ [dependencies] section not found in Cargo.toml")

    insertion = 'solana-security-txt = "1.1.1"\n'
    text = text[: m.end()] + insertion + text[m.end():]
    CARGO_TOML.write_text(text)
    print("  ✅ added")

# ============================================================
# 2) lib.rs — security_txt! macro after declare_id!
# ============================================================
print("\n── 2. lib.rs: add security_txt! macro ──")
text = LIB_RS.read_text()

if "solana_security_txt::security_txt!" in text:
    print("  ⏭  already present")
else:
    bak = LIB_RS.with_suffix(LIB_RS.suffix + f".sec.bak.txt2.{TS}")
    shutil.copy2(LIB_RS, bak)
    print(f"  backup: {bak.name}")

    m = re.search(r'declare_id!\([^)]+\);', text)
    if not m:
        sys.exit("  ❌ declare_id! not found in lib.rs")

    block = """

// security.txt — embedded into the .so binary as an ELF section.
// Solscan, Solana Explorer, and bug-bounty scanners read this automatically.
#[cfg(not(feature = "no-entrypoint"))]
solana_security_txt::security_txt! {
    name: "HumbleTrust",
    project_url: "https://humbletrust.vercel.app",
    contacts: "email:humble.trust@outlook.com,link:https://github.com/HumbleTrust/humbletrust/security",
    policy: "https://github.com/HumbleTrust/humbletrust/blob/main/SECURITY.md",
    preferred_languages: "en,ru",
    source_code: "https://github.com/HumbleTrust/humbletrust",
    source_revision: env!("CARGO_PKG_VERSION"),
    source_release: env!("CARGO_PKG_VERSION"),
    encryption: "",
    auditors: "None - devnet alpha. See SECURITY.md for known limitations."
}
"""
    insert_pos = m.end()
    text = text[:insert_pos] + block + text[insert_pos:]
    LIB_RS.write_text(text)
    print("  ✅ added")

print("""
============================================================
DONE. Build next:
============================================================

  cd ~/humbletrust && \\
    rm -rf target/idl && \\
    touch programs/humbletrust/src/lib.rs && \\
    anchor build 2>&1 | tail -20

If the build is clean:

  anchor upgrade target/deploy/humbletrust.so \\
    --program-id Gcz7NMtCqKdvzh53DF1ecoEYe7Hma9kWwdtCmmeBaxRi \\
    --provider.cluster devnet

Verify embedded contact appears in program data:

  solana program dump Gcz7NMtCqKdvzh53DF1ecoEYe7Hma9kWwdtCmmeBaxRi /tmp/h.so --url devnet && \\
    strings /tmp/h.so | grep -E 'humble\\.trust|HumbleTrust'
""")
