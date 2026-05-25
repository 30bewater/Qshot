"""Create or list a store-upload zip with forward-slash paths (no ./ prefix)."""
import json
import os
import sys
import zipfile


def list_entries(zip_path):
    with zipfile.ZipFile(zip_path) as zf:
        names = []
        for name in zf.namelist():
            p = name.replace("\\", "/").lstrip("./")
            if not p or p.endswith("/"):
                continue
            names.append(p)
    return names


def create_zip(dist_dir, zip_path):
    dist_dir = os.path.abspath(dist_dir)
    zip_path = os.path.abspath(zip_path)
    os.makedirs(os.path.dirname(zip_path), exist_ok=True)
    if os.path.exists(zip_path):
        os.remove(zip_path)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for root, _, files in os.walk(dist_dir):
            for name in files:
                full = os.path.join(root, name)
                arc = os.path.relpath(full, dist_dir).replace("\\", "/")
                zf.write(full, arc)


def main():
    if len(sys.argv) < 2:
        print("usage: zip-dist.py list <zip> | zip-dist.py create <dist> <zip>", file=sys.stderr)
        sys.exit(2)
    cmd = sys.argv[1]
    if cmd == "list":
        print(json.dumps(list_entries(sys.argv[2])))
    elif cmd == "create":
        create_zip(sys.argv[2], sys.argv[3])
        print(json.dumps(list_entries(sys.argv[3])))
    else:
        print(f"unknown command: {cmd}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
