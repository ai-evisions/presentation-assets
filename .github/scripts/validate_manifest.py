#!/usr/bin/env python3
"""Kontrola manifest.json proti tomu, co skutečně leží v optimized/.

Proč to existuje: `manifest.json` je jediné, co skilly a decky čtou — vybírají podle
`description`/`tags` a odkazují `url` nebo `path`. Když se soubor přejmenuje, zmizí,
nebo se přepíše jiným rozměrem a manifest zůstane starý, deck si toho nevšimne:
vloží se špatný obrázek, nebo se nevloží nic. Build (`build.mjs`) běží ručně na Macu
(potřebuje `sips`), takže tady nic negenerujeme — jen ověřujeme, že to, co je
commitnuté, drží pohromadě.

Použití:
    python3 validate_manifest.py
    python3 validate_manifest.py --selftest   # ověří, že check umí spadnout
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
REQUIRED = ("file", "path", "url", "description", "tags", "orientation",
            "dimensions", "people", "usage")
USAGE_OK = {"client-safe", "review"}
ORIENTATION_OK = {"landscape", "portrait", "square", "banner"}


def validate(manifest_path, optimized_dir, root=None):
    # root: proti čemu se rozbaluje `path` z manifestu. Selftest ho ukazuje do
    # tempu, jinak by se kontrolovaly skutečné soubory v repu a fixtury by nikdy
    # nespadly (přesně tohle selftest odhalil).
    root = root or manifest_path.parent
    problems = []
    try:
        manifest = json.loads(manifest_path.read_text())
    except Exception as exc:
        return [f"manifest.json se nedá přečíst: {exc}"]

    version = manifest.get("version")
    if not version:
        problems.append("manifest.json: chybí `version`")
    assets = manifest.get("assets")
    if not isinstance(assets, list) or not assets:
        return problems + ["manifest.json: `assets` musí být neprázdný seznam"]

    try:
        from PIL import Image
    except ImportError:
        Image = None

    seen = set()
    for asset in assets:
        name = asset.get("file", "<bez file>")
        for key in REQUIRED:
            if key not in asset:
                problems.append(f"{name}: chybí klíč `{key}`")
        if asset.get("usage") not in USAGE_OK:
            problems.append(f"{name}: `usage` je {asset.get('usage')!r}, čekáno {sorted(USAGE_OK)}")
        if asset.get("orientation") not in ORIENTATION_OK:
            problems.append(f"{name}: `orientation` je {asset.get('orientation')!r}")
        if not isinstance(asset.get("people"), bool):
            problems.append(f"{name}: `people` musí být true/false")
        if not asset.get("description", "").strip():
            problems.append(f"{name}: prázdný `description` (skill podle něj vybírá obrázek)")
        if not isinstance(asset.get("tags"), list) or not asset.get("tags"):
            problems.append(f"{name}: `tags` musí být neprázdný seznam")

        rel = asset.get("path", "")
        seen.add(pathlib.Path(rel).name)
        f = root / rel
        if not f.exists():
            problems.append(f"{name}: soubor {rel} v repu není")
            continue
        if f.stat().st_size == 0:
            problems.append(f"{name}: {rel} je prázdný soubor")

        if version and f"@{version}/" not in asset.get("url", ""):
            problems.append(f"{name}: `url` neodpovídá verzi {version} ({asset.get('url')})")

        dims = asset.get("dimensions") or {}
        if Image is not None and f.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp"):
            try:
                with Image.open(f) as im:
                    real = {"width": im.width, "height": im.height}
            except Exception as exc:
                problems.append(f"{name}: obrázek se nedá otevřít ({exc})")
            else:
                if dims.get("width") != real["width"] or dims.get("height") != real["height"]:
                    problems.append(
                        f"{name}: rozměry v manifestu {dims} ≠ skutečné {real} "
                        f"(manifest je zastaralý, nebo se soubor přepsal)")

    # osiřelé soubory: leží v optimized/, ale manifest o nich neví → skill je nenajde
    for f in sorted(optimized_dir.iterdir()):
        if f.name.startswith(".") or not f.is_file():
            continue
        if f.name not in seen:
            problems.append(f"{f.name}: leží v optimized/, ale v manifestu není")
    return problems


def selftest():
    """Rozbij manifest třemi způsoby a ověř, že to check najde.

    Každý případ má VLASTNÍ temp adresář: když je sdílely, soubor zkopírovaný pro
    případ „špatné rozměry" existoval i v případu „chybějící soubor" a ten pak
    neměl co najít (chyba v tomhle selftestu, odhalená prvním spuštěním).
    """
    import shutil
    import tempfile
    src = json.loads((ROOT / "manifest.json").read_text())
    first = src["assets"][0]
    # pro rozměry potřebujeme rastr, ne SVG
    raster = next(a for a in src["assets"]
                  if pathlib.Path(a["path"]).suffix.lower() in (".png", ".jpg", ".jpeg"))

    def fixture(mutate, copy_files=()):
        tmp = pathlib.Path(tempfile.mkdtemp())
        opt = tmp / "optimized"
        opt.mkdir()
        for asset in copy_files:
            shutil.copy(ROOT / asset["path"], opt / pathlib.Path(asset["path"]).name)
        data = json.loads(json.dumps(src))
        mutate(data)
        mf = tmp / "manifest.json"
        mf.write_text(json.dumps(data))
        return validate(mf, opt, root=tmp)

    def only_first(data):
        data["assets"] = [json.loads(json.dumps(first))]

    def wrong_dims(data):
        data["assets"] = [json.loads(json.dumps(raster))]
        data["assets"][0]["dimensions"] = {"width": 1, "height": 1}

    def orphan(data):
        # manifest zná jen `first`, ale v optimized/ leží i raster → osiřelý soubor
        data["assets"] = [json.loads(json.dumps(first))]

    cases = [
        ("chybějící soubor", fixture(only_first), "v repu není"),
        ("špatné rozměry", fixture(wrong_dims, copy_files=[raster]), "rozměry v manifestu"),
        ("osiřelý soubor", fixture(orphan, copy_files=[first, raster]), "v manifestu není"),
    ]

    failed = False
    for label, problems, needle in cases:
        found = [p for p in problems if needle in p]
        if found:
            print(f"OK selftest '{label}': {found[0]}")
        else:
            print(f"SELFTEST SPADL: '{label}' nenalezeno — check je jen ozdoba")
            failed = True
    return 1 if failed else 0


def main():
    if "--selftest" in sys.argv:
        return selftest()
    problems = validate(ROOT / "manifest.json", ROOT / "optimized", root=ROOT)
    if problems:
        print(f"NÁLEZY ({len(problems)}):")
        for p in problems:
            print("  -", p)
        return 1
    manifest = json.loads((ROOT / "manifest.json").read_text())
    print(f"✓ manifest.json v pořádku: {len(manifest['assets'])} assetů, verze "
          f"{manifest['version']}, všechny soubory existují a rozměry souhlasí")
    return 0


if __name__ == "__main__":
    sys.exit(main())
