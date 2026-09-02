import re

with open("src/app/admin/home-finance/page.tsx", "r") as f:
    content = f.read()

# Target strings to extract
# We need to find the header block and the FamilyCompetition block
header_re = re.compile(r'(\s*<div className="flex justify-between items-start mb-6.*?</div>\s*</div>\s*)(?=\s*\{/\* Family Competition Feature \*/\})', re.DOTALL)
comp_re = re.compile(r'(\s*\{/\* Family Competition Feature \*/\}\s*<div className="mb-8">\s*<FamilyCompetition />\s*</div>\s*)', re.DOTALL)

h_match = header_re.search(content)
c_match = comp_re.search(content)

if not (h_match and c_match):
    print("Could not match all!")
    print(bool(h_match), bool(c_match))
    exit(1)

# Swap them
content = content.replace(h_match.group(1), "")
content = content.replace(c_match.group(1), "")

new_order = c_match.group(1) + h_match.group(1)

# Find where to insert (right after {activeTab === "familyNeeds" && ( <div className="space-y-4">)
marker = '{/* ═══════════════ FAMILY NEEDS TAB ═══════════════ */}\n        {activeTab === "familyNeeds" && (\n          <div className="space-y-4">\n'
if marker not in content:
    print("Marker not found")
    exit(1)

content = content.replace(marker, marker + new_order)

with open("src/app/admin/home-finance/page.tsx", "w") as f:
    f.write(content)

print("Family tab reordered successfully!")
