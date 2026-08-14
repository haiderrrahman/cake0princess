import os
import re

admin_dir = "/Users/haiderrahman/Work/antigravity/Cake-Publisher/src/app/admin"

pages_to_update = [
    "categories/page.tsx",
    "banners/page.tsx",
    "offers/page.tsx",
    "ads/page.tsx",
    "competitions/page.tsx",
    "custom-orders/page.tsx",
    "users/page.tsx",
    "inventory/page.tsx",
    "products/page.tsx"
]

header_pattern = re.compile(
    r'<div className="px-5 pt-6 pb-4 flex flex-col gap-4">.*?<Link href="/admin" className="[^"]*">.*?<ArrowRight className="[^"]*" />\s*</Link>\s*<div>\s*<h1 className="[^"]*">(.*?)</h1>\s*<p className="[^"]*">(.*?)</p>\s*</div>\s*</div>\s*(<button.*?</button>)?',
    re.DOTALL
)

def update_page(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Find the header section
    match = re.search(r'<div className="px-5 pt-6 pb-4 flex flex-col gap-4">.*?</div>\s*</div>', content, re.DOTALL)
    
    if not match:
        print(f"Header pattern not found in {filepath}")
        return

    original = match.group(0)
    print(f"Found header in {filepath}")
    
