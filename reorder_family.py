import re

with open("src/app/admin/home-finance/page.tsx", "r") as f:
    content = f.read()

# Find the Family Needs tab section
start = content.find('{/* ═══════════════ FAMILY NEEDS TAB ═══════════════ */}')
end = content.find('{/* ═══════════════ TRANSACTIONS TAB (Expenses & Income) ═══════════════ */}')

if start == -1 or end == -1:
    print("Could not find section")
    exit(1)

family_tab = content[start:end]

# Extract the header block (إدارة طلبات وواجبات العائلة) and the Family Competition block
header_re = re.compile(r'(\s*<div className="flex justify-between items-start mb-6.*?</div>\s*</div>\s*)', re.DOTALL)
comp_re = re.compile(r'(\s*\{/\* Family Competition Feature \*/\}\s*<div className="mb-8">\s*<FamilyCompetition />\s*</div>\s*)', re.DOTALL)

h_match = header_re.search(family_tab)
c_match = comp_re.search(family_tab)

if h_match and c_match:
    print("Found both")
    # Swap them
    # But wait, there is a Search input in the header block?
    # Let me check the exact content of the header block first.
else:
    print("Could not find one of them")

