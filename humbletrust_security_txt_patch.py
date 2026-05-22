#!/usr/bin/env python3
"""
HumbleTrust — add solana-security-txt to program binary.

This embeds a Security section into the .so ELF that Solscan, Solana
Explorer, and bug-bounty scanners read automatically. Contact info,
policy links, source code, and audit status become visible on:
  https://solscan.io/account/Gcz7NMtCqKdvzh53DF1ecoEYe7Hma9kWwdtCmmeBaxRi?cluster=devnet

Run from project root:
    python3 humbletrust_security_txt_patch.py
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
        sys.exit(f"FATAL: {p} not found. Run from project root.")

TS = int(time.time())


def patch_file(path: Path, old: str, new: str, name: str) -> None:
    bak = path.with_suffix(path.suffix + f".sec.bak.txt.{TS}")
    shutil.copy2(path, bak)
    print(f"  backup: {bak.name}")

    text = path.read_text()
    if new in text:
        print(f"  ⏭  [{name}] already applied")
        return
    if old not in text:
        print(f"  ❌ [{name}] anchor not found")
        sys.exit(1)
    path.write_text(text.replace(old, new, 1))
    print(f"  ✅ [{name}]")


# 1) Cargo.toml — add dependency
print("── 1. Cargo.toml: add solana-security-txt dependency ──")
patch_file(
    CARGO_TOML,
    'anchor-spl = { version = "0.32.1", features = ["token"] }',
    'anchor-spl = { version = "0.32.1", features = ["token"] }\n'
    'solana-security-txt = "1.1.1"',
    "cargo-dep",
)


# 2) lib.rs — add security_txt! macro near the top
print("\n── 2. lib.rs: add security_txt! macro ──")

SECURITY_BLOCK = """
// security.txt — embedded in .so, visible on Solscan / bug-bounty scanners
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

text = LIB_RS.read_text()

if "solana_security_txt::security_txt!" in text:
    print("  ⏭  [lib.rs-macro] already applied")
else:
    # Insert after the `declare_id!` line (uniquely placed near the top)
    m = re.search(r'(declare_id!\([^)]+\);)', text)
    if not m:
        sys.exit("  ❌ declare_id! not found in lib.rs")

    bak = LIB_RS.with_suffix(LIB_RS.suffix + f".sec.bak.txt.{TS}")
    shutil.copy2(LIB_RS, bak)
    print(f"  backup: {bak.name}")

    insert_pos = m.end()
    new_text = text[:insert_pos] + "\n" + SECURITY_BLOCK + text[insert_pos:]
    LIB_RS.write_text(new_text)
    print("  ✅ [lib.rs-macro]")


print(
    """
============================================================
security.txt patch applied. Next:
============================================================
  cd ~/humbletrust && \\
    rm -rf target/idl && \\
    touch programs/humbletrust/src/lib.rs && \\
    anchor build 2>&1 | tail -20

If build is clean:
  anchor upgrade target/deploy/humbletrust.so \\
    --program-id Gcz7NMtCqKdvzh53DF1ecoEYe7Hma9kWwdtCmmeBaxRi \\
    --provider.cluster devnet

Then verify via:
  curl -s https://api.devnet.solana.com -X POST \\
    -H 'Content-Type: application/json' \\
    -d '{"jsonrpc":"2.0","id":1,"method":"getAccountInfo","params":["Gcz7NMtCqKdvzh53DF1ecoEYe7Hma9kWwdtCmmeBaxRi",{"encoding":"base64"}]}' \\
    | grep -o 'humble.trust@outlook.com' && echo "✅ security.txt embedded"

Solscan will pick it up automatically — check:
  https://solscan.io/account/Gcz7NMtCqKdvzh53DF1ecoEYe7Hma9kWwdtCmmeBaxRi?cluster=devnet
  → "Security Info" tab
"""
)
